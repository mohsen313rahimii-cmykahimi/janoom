/** Tiny procedural WebAudio synth — no assets, all game-feel blips. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture. */
  unlock() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.02);
    }
  }

  private tone(
    f0: number,
    f1: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    delay = 0
  ) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.06);
  }

  click() {
    this.tone(620, 920, 0.07, "sine", 0.16);
  }
  jump() {
    this.tone(280, 560, 0.16, "square", 0.14);
  }
  dash() {
    this.tone(170, 780, 0.2, "sawtooth", 0.1);
  }
  pickup() {
    this.tone(740, 760, 0.09, "sine", 0.2);
    this.tone(1108, 1120, 0.11, "sine", 0.2, 0.07);
    this.tone(1480, 1520, 0.16, "sine", 0.16, 0.14);
  }
  stomp() {
    this.tone(330, 70, 0.2, "square", 0.24);
    this.tone(660, 200, 0.12, "sine", 0.14, 0.02);
  }
  hit() {
    this.tone(220, 52, 0.3, "sawtooth", 0.3);
    this.tone(120, 38, 0.34, "square", 0.18, 0.01);
  }
  fall() {
    this.tone(500, 90, 0.6, "sawtooth", 0.16);
  }
  portal() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f * 1.01, 0.24, "triangle", 0.18, i * 0.09));
  }
  win() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      this.tone(f, f, 0.32, "triangle", 0.2, i * 0.11)
    );
  }
  lose() {
    this.tone(330, 85, 1.1, "sawtooth", 0.2);
    this.tone(165, 50, 1.2, "square", 0.12, 0.1);
  }
  tick() {
    this.tone(1250, 1200, 0.05, "sine", 0.1);
  }
  roar() {
    this.tone(95, 42, 0.75, "sawtooth", 0.3);
    this.tone(62, 36, 0.85, "square", 0.2, 0.05);
  }
  chargeUp() {
    this.tone(170, 760, 0.5, "sawtooth", 0.12);
  }
}
