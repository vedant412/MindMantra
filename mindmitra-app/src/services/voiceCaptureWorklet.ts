// Only executable worklet source goes into this Blob, never recorded audio.
// Stream mono PCM16 little-endian in 100 ms frames at the backend's 16 kHz rate.
export const VOICE_CAPTURE_WORKLET = `
class MindMitraCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.weight = 0;
    this.sum = 0;
    this.offset = 0;
    this.pending = 0;
    this.running = true;
    this.frame = new ArrayBuffer(3200);
    this.view = new DataView(this.frame);
    this.port.onmessage = ({ data }) => {
      if (data === 'stop') this.running = false;
      if (data === 'ack') this.pending = Math.max(0, this.pending - 1);
    };
  }
  emit(sample) {
    const clipped = Math.max(-1, Math.min(1, sample));
    this.view.setInt16(this.offset * 2, Math.round(clipped < 0 ? clipped * 32768 : clipped * 32767), true);
    this.offset++;
    if (this.offset === 1600) {
      if (this.pending >= 8) {
        this.running = false;
        this.port.postMessage({ error: 'capture-overrun' });
        return;
      }
      this.port.postMessage(this.frame, [this.frame]);
      this.pending++;
      this.frame = new ArrayBuffer(3200);
      this.view = new DataView(this.frame);
      this.offset = 0;
    }
  }
  process(inputs) {
    if (!this.running) return false;
    const channels = inputs[0];
    if (!channels || !channels.length) return true;
    // Weighted averaging preserves phase across render quanta, including 44.1 kHz.
    for (let i = 0; i < channels[0].length && this.running; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i] || 0;
      sample /= channels.length;
      let remaining = 1;
      while (remaining > 1e-8 && this.running) {
        const take = Math.min(remaining, this.ratio - this.weight);
        this.sum += sample * take;
        this.weight += take;
        remaining -= take;
        if (this.weight >= this.ratio - 1e-8) {
          this.emit(this.sum / this.ratio);
          this.weight = 0;
          this.sum = 0;
        }
      }
    }
    // The output stays silent: microphone monitoring would cause feedback.
    return this.running;
  }
}
registerProcessor('mindmitra-capture', MindMitraCapture);
`;
