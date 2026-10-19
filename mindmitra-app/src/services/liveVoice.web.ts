import { toByteArray } from 'base64-js';
import { ApiService, API_BASE_URL } from './api';
import { authenticatedUid } from './identity';
import { subscribeAuth } from './authState';
import { VOICE_CAPTURE_WORKLET } from './voiceCaptureWorklet';
import { LookupFeedback } from './lookupFeedback';

type Callbacks = { onState: (state: string) => void; onTranscript: (role: string, text: string) => void; onError: (message: string) => void };

export class LiveVoice {
  private socket: WebSocket | null = null;
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private stopped = false;
  private ready = false;
  private owner = authenticatedUid();
  private unsubscribe: (() => void) | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private feedback: LookupFeedback;
  constructor(private callbacks: Callbacks) {
    this.feedback = new LookupFeedback(state => callbacks.onState(!this.ready && state === 'listening' ? 'connecting' : state), audio => this.play(audio));
  }

  private ownsSession() {
    try { return authenticatedUid() === this.owner; } catch { return false; }
  }
  private onHidden = () => { if (document.hidden) void this.stop(); };
  private onPageHide = () => { void this.stop(); };

  async start(language: string) {
    if (this.stopped || this.context) return;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Microphone streaming requires HTTPS or localhost.');
      if (typeof window.AudioContext !== 'function' || typeof AudioWorkletNode !== 'function') throw new Error('This browser does not support live microphone streaming. Open the app in a current Chrome, Edge or Safari browser.');
      this.callbacks.onState('connecting');
      document.addEventListener('visibilitychange', this.onHidden);
      window.addEventListener('pagehide', this.onPageHide);
      this.unsubscribe = subscribeAuth(user => { if (user?.uid !== this.owner) void this.stop(); });
      // Resume inside the Start button's user gesture, before network requests.
      this.context = new window.AudioContext({ latencyHint: 'interactive' });
      await this.context.resume();
      if (this.stopped) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false,
      });
      if (this.stopped || !this.ownsSession()) { stream.getTracks().forEach(track => track.stop()); await this.stop(); return; }
      this.stream = stream;
      stream.getAudioTracks().forEach(track => { track.onended = () => { void this.fail('Microphone disconnected. Please reconnect.'); }; });
      const url = URL.createObjectURL(new Blob([VOICE_CAPTURE_WORKLET], { type: 'application/javascript' }));
      try { await this.context.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
      if (this.stopped || !this.ownsSession()) { await this.stop(); return; }
      // Obtain the 30-second ticket after permission/module loading to avoid expiry.
      const session = await ApiService.createLiveSession(language);
      if (this.stopped || !this.ownsSession()) { await this.stop(); return; }
      this.context.onstatechange = () => {
        if (!this.stopped && this.context?.state !== 'running') void this.stop();
      };
      const socket = new WebSocket(`${API_BASE_URL.replace(/^http/, 'ws')}/live/ws`);
      this.socket = socket;
      socket.binaryType = 'arraybuffer';
      this.connectTimeout = setTimeout(() => { void this.fail('Voice connection timed out. Please reconnect.'); }, 30000);
      socket.onopen = () => {
        if (this.stopped || !this.ownsSession()) { void this.stop(); return; }
        socket.send(JSON.stringify({ ticket: session.ticket, user_id: session.user_id }));
      };
      socket.onmessage = event => {
        try {
          if (this.stopped) return;
          if (!this.ownsSession()) { void this.stop(); return; }
          const message = JSON.parse(event.data);
          if (message.type === 'ready') this.beginCapture();
          else if (message.type === 'lookup_status') this.feedback.status(message);
          else if (message.type === 'audio') this.feedback.receiveAudio(message.data);
          else if (message.type === 'interrupted') { this.feedback.interrupt(); this.clearPlayback(); this.callbacks.onState('listening'); }
          else if (message.type === 'transcript') this.callbacks.onTranscript(message.role, message.text);
          else if (message.type === 'turn_complete') this.feedback.turnComplete();
          else if (message.type === 'error') void this.fail(message.message);
        } catch { void this.fail('Voice interrupted. Please reconnect.'); }
      };
      socket.onerror = () => { void this.fail('Could not connect to live voice.'); };
      socket.onclose = () => { if (!this.stopped) void this.fail('Voice disconnected. Tap to reconnect.'); };
    } catch (error) {
      if (this.stopped) return;
      const name = error instanceof Error ? error.name : '';
      const message = name === 'NotAllowedError' ? 'Microphone access was blocked. Allow microphone access for this app, or open it in Chrome or Edge.'
        : name === 'NotFoundError' ? 'No microphone was found. Connect one and try again.'
        : error instanceof Error ? error.message : 'Could not start browser voice.';
      await this.fail(message);
    }
  }

  private beginCapture() {
    if (this.ready || this.stopped || !this.context || !this.stream) return;
    this.ready = true;
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
    const node = new AudioWorkletNode(this.context, 'mindmitra-capture', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1,
    });
    this.capture = node;
    node.port.onmessage = event => {
      if (this.stopped) return;
      if (!this.ownsSession()) { void this.stop(); return; }
      const frame = event.data;
      if (!(frame instanceof ArrayBuffer) || frame.byteLength !== 3200) { void this.fail('Audio capture could not keep up. Please reconnect.'); return; }
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      if (this.socket.bufferedAmount > 64000) { void this.fail('Connection too slow. Please reconnect.'); return; }
      this.socket.send(frame);
      node.port.postMessage('ack');
    };
    node.onprocessorerror = () => { void this.fail('Audio capture stopped. Please reconnect.'); };
    this.microphone = this.context.createMediaStreamSource(this.stream);
    this.microphone.connect(node);
    node.connect(this.context.destination);
    this.feedback.turnComplete();
  }

  private play(encoded: string) {
    if (!this.context || typeof encoded !== 'string' || encoded.length > 256000) throw new Error('Invalid audio');
    const bytes = toByteArray(encoded);
    if (!bytes.length || bytes.length % 2 || bytes.length > 192000) throw new Error('Invalid audio');
    if (this.nextStart - this.context.currentTime > 5) throw new Error('Playback queue exceeded');
    const audio = this.context.createBuffer(1, bytes.length / 2, 24000);
    const channel = audio.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    const source = this.context.createBufferSource();
    source.buffer = audio;
    source.connect(this.context.destination);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    this.sources.add(source);
    this.nextStart = Math.max(this.context.currentTime + .03, this.nextStart);
    source.start(this.nextStart);
    this.nextStart += audio.duration;
  }
  private clearPlayback() {
    this.sources.forEach(source => { try { source.stop(); source.disconnect(); } catch {} });
    this.sources.clear();
    this.nextStart = 0;
  }
  private async fail(message: string) {
    if (this.stopped) return;
    this.callbacks.onError(message);
    await this.stop();
  }
  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.feedback.stop();
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.unsubscribe?.();
    document.removeEventListener('visibilitychange', this.onHidden);
    window.removeEventListener('pagehide', this.onPageHide);
    if (this.socket) {
      this.socket.onopen = this.socket.onmessage = this.socket.onerror = this.socket.onclose = null;
      try { if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'stop' })); } catch {}
      try { this.socket.close(); } catch {}
    }
    if (this.capture) {
      this.capture.port.onmessage = null;
      try { this.capture.port.postMessage('stop'); this.capture.port.close(); this.capture.disconnect(); } catch {}
    }
    try { this.microphone?.disconnect(); } catch {}
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    this.clearPlayback();
    if (this.context) { this.context.onstatechange = null; try { await this.context.close(); } catch {} }
    this.callbacks.onState('idle');
  }
}
