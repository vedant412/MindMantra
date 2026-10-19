type Status = { id: string; phase: 'started' | 'finished' };

// Progress is visual only. Answer audio plays immediately while the microphone
// remains open; no speech synthesis or extra audio queue is needed.
export class LookupFeedback {
  private pending = new Set<string>();
  private disposed = false;
  constructor(private state: (state: string) => void, private play: (audio: string) => void) {}

  status(event: Status) {
    if (this.disposed || typeof event.id !== 'string') return;
    if (event.phase === 'started') {
      this.pending.add(event.id);
      this.state('getting_info');
    } else if (event.phase === 'finished') {
      this.pending.delete(event.id);
      if (!this.pending.size) this.state('listening');
    }
  }
  receiveAudio(encoded: string) {
    if (this.disposed) return;
    this.play(encoded);
    this.state(this.pending.size ? 'getting_info' : 'speaking');
  }
  turnComplete() {
    if (!this.disposed) this.state(this.pending.size ? 'getting_info' : 'listening');
  }
  interrupt() { this.pending.clear(); }
  stop() { this.disposed = true; this.pending.clear(); }
}
