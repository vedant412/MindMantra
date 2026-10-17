import { AppState } from 'react-native';
import { toByteArray } from 'base64-js';
import { ApiService, API_BASE_URL } from './api';
import { authenticatedUid } from './identity';

type Callbacks = { onState: (state: string) => void; onTranscript: (role: string, text: string) => void; onError: (message: string) => void };

// Loaded only when voice starts so Expo Go can still render the app and use text.
export class LiveVoice {
  private socket: WebSocket | null = null;
  private recorder: import('react-native-audio-api').AudioRecorder | null = null;
  private context: import('react-native-audio-api').AudioContext | null = null;
  private sources = new Set<import('react-native-audio-api').AudioBufferSourceNode>();
  private nextStart = 0;
  private stopped = false;
  private owner = authenticatedUid();
  private subscriptions: { remove: () => void }[] = [];
  private native: typeof import('react-native-audio-api') | null = null;
  constructor(private callbacks: Callbacks) {}

  async start(language: string) {
    try {
      this.callbacks.onState('connecting');
      this.subscriptions.push(AppState.addEventListener('change', state => { if (state !== 'active') void this.stop(); }));
      this.native = require('react-native-audio-api');
      const { AudioManager, AudioRecorder, AudioContext } = this.native!;
      const permission = await AudioManager.requestRecordingPermissions();
      if (permission !== 'Granted') throw new Error('Microphone permission is required.');
      if (this.stopped) return;
      AudioManager.setAudioSessionOptions({ iosCategory: 'playAndRecord', iosMode: 'voiceChat', iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'] });
      await AudioManager.setAudioSessionActivity(true);
      if (this.stopped) { await AudioManager.setAudioSessionActivity(false); return; }
      this.context = new AudioContext({ sampleRate: 24000 });
      await this.context.resume();
      if (this.stopped) { await this.context.close(); return; }
      this.recorder = new AudioRecorder();
      const session = await ApiService.createLiveSession(language);
      if (this.stopped || authenticatedUid() !== this.owner) { await this.stop(); return; }
      this.socket = new WebSocket(`${API_BASE_URL.replace(/^http/, 'ws')}/live/ws`);
      this.socket.binaryType = 'arraybuffer';
      this.socket.onopen = () => this.socket?.send(JSON.stringify({ ticket: session.ticket, user_id: session.user_id }));
      this.socket.onmessage = async event => {
        try {
          const message = JSON.parse(event.data);
          if (this.stopped) return;
          if (authenticatedUid() !== this.owner) { await this.stop(); return; }
          if (message.type === 'ready') {
            this.recorder!.onAudioReady({ sampleRate: 16000, bufferLength: 1600, channelCount: 1 }, ({ buffer }) => {
              if (this.stopped || this.socket?.readyState !== WebSocket.OPEN) return;
              if (this.socket.bufferedAmount > 64000) { void this.fail('Connection too slow. Please reconnect.'); return; }
              const samples = buffer.getChannelData(0);
              const pcm = new ArrayBuffer(samples.length * 2);
              const view = new DataView(pcm);
              for (let i = 0; i < samples.length; i++) view.setInt16(i * 2, Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), true);
              this.socket.send(pcm);
            });
            const result = await this.recorder!.start();
            if (result.status === 'error') throw new Error(result.message);
            this.callbacks.onState('listening');
          } else if (message.type === 'audio') {
            this.play(message.data);
            this.callbacks.onState('speaking');
          } else if (message.type === 'interrupted') {
            this.clearPlayback();
            this.callbacks.onState('listening');
          } else if (message.type === 'transcript') this.callbacks.onTranscript(message.role, message.text);
          else if (message.type === 'turn_complete') this.callbacks.onState('listening');
          else if (message.type === 'error') await this.fail(message.message);
        } catch { await this.fail('Voice interrupted. Please reconnect.'); }
      };
      this.socket.onerror = () => { void this.fail('Could not connect to live voice.'); };
      this.socket.onclose = () => { if (!this.stopped) void this.fail('Voice disconnected. Tap to reconnect.'); };
      this.subscriptions.push(AudioManager.addSystemEventListener('interruption', () => { void this.stop(); }));
      this.subscriptions.push(AudioManager.addSystemEventListener('routeChange', event => {
        if (event.reason === 'OldDeviceUnavailable') void this.stop();
      }));
    } catch (error) {
      await this.fail(error instanceof Error ? error.message : 'Live voice requires a native development build.');
    }
  }

  private play(encoded: string) {
    const context = this.context;
    if (!context) return;
    const bytes = toByteArray(encoded);
    if (bytes.length % 2 || bytes.length > 192000) throw new Error('Invalid audio');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const audio = context.createBuffer(1, bytes.length / 2, 24000);
    const channel = audio.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    if (this.nextStart - context.currentTime > 5) throw new Error('Playback queue exceeded');
    const source = context.createBufferSource();
    source.buffer = audio;
    source.connect(context.destination);
    source.onEnded = () => { this.sources.delete(source); source.disconnect(); };
    this.sources.add(source);
    this.nextStart = Math.max(context.currentTime + .03, this.nextStart);
    source.start(this.nextStart);
    this.nextStart += audio.duration;
  }

  private clearPlayback() {
    this.sources.forEach(source => { try { source.stop(); source.disconnect(); } catch {} });
    this.sources.clear();
    this.nextStart = 0;
  }
  private async fail(message: string) { this.callbacks.onError(message); await this.stop(); }
  async stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.subscriptions.forEach(subscription => subscription.remove());
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: 'stop' }));
    this.socket?.close();
    this.recorder?.clearOnAudioReady();
    try { await this.recorder?.stop(); } catch {}
    this.clearPlayback();
    try { await this.context?.close(); } catch {}
    try { await this.native?.AudioManager.setAudioSessionActivity(false); } catch {}
    this.callbacks.onState('idle');
  }
}
