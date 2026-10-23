const MUTE_KEY = 'bug-patrol-1024.muted';

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  ensure(): void {
    if (this.muted) return;
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.025): void {
    if (this.muted) return;
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  net(): void {
    this.tone(320, 0, 0.06, 'square', 0.018);
    this.tone(480, 0.04, 0.06, 'sine', 0.02);
  }

  perfect(): void {
    [660, 880, 1100].forEach((f, i) => this.tone(f, i * 0.06, 0.14, 'sine', 0.035));
  }

  good(): void {
    [520, 660].forEach((f, i) => this.tone(f, i * 0.07, 0.12, 'sine', 0.03));
  }

  miss(): void {
    this.tone(180, 0, 0.12, 'sawtooth', 0.02);
    this.tone(140, 0.08, 0.14, 'square', 0.015);
  }

  tame(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.08, 0.2, 'sine', 0.032));
  }

  alert(): void {
    this.tone(740, 0, 0.06, 'square', 0.012);
  }

  brew(): void {
    this.tone(240, 0, 0.08, 'sine', 0.02);
    this.tone(300, 0.1, 0.12, 'sine', 0.02);
  }

  phase(): void {
    [392, 523].forEach((f, i) => this.tone(f, i * 0.1, 0.24, 'triangle', 0.022));
  }

  egg(): void {
    [523, 587, 659, 784, 880, 1047].forEach((f, i) => this.tone(f, i * 0.07, 0.13, 'triangle', 0.03));
  }

  toggle(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (!this.muted) this.tame();
    return this.muted;
  }
}
