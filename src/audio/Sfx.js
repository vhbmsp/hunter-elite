/** Procedural WebAudio sound effects. The context is created lazily on a user gesture. */
export class Sfx {
  constructor() {
    this.ctx = null;
    this.noiseCache = new Map();
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  shot() {
    this.play({
      osc: { type: 'square', from: 900, to: 80, sweep: 0.07, gain: 0.35, fade: 0.09, length: 0.1 },
      noise: { length: 0.06, gain: 0.45, fade: 0.06 },
    });
  }

  // Metallic clack of the bolt opening, then closing, across the cycle.
  bolt() {
    this.play({
      delay: 0.1,
      osc: { type: 'triangle', from: 740, to: 210, sweep: 0.05, gain: 0.2, fade: 0.07, length: 0.08 },
      noise: { length: 0.05, gain: 0.28, fade: 0.05 },
    });
    this.play({
      delay: 0.5,
      osc: { type: 'square', from: 260, to: 90, sweep: 0.03, gain: 0.14, fade: 0.05, length: 0.06 },
      noise: { length: 0.035, gain: 0.3, fade: 0.04 },
    });
  }

  // Dry fire: sharp metallic click so an empty magazine is obvious (reload needed).
  empty() {
    this.play({
      osc: { type: 'square', from: 1800, to: 420, sweep: 0.018, gain: 0.28, fade: 0.03, length: 0.035 },
      noise: { length: 0.02, gain: 0.32, fade: 0.02 },
    });
    this.play({
      delay: 0.028,
      osc: { type: 'triangle', from: 520, to: 160, sweep: 0.03, gain: 0.18, fade: 0.04, length: 0.045 },
      noise: { length: 0.018, gain: 0.2, fade: 0.02 },
    });
  }

  pickup() {
    this.play({
      osc: { type: 'sine', from: 680, to: 620, sweep: 0.07, gain: 0.16, fade: 0.08, length: 0.09 },
      noise: { length: 0.015, gain: 0.03, fade: 0.015 },
    });
    this.play({
      delay: 0.08,
      osc: { type: 'sine', from: 880, to: 840, sweep: 0.1, gain: 0.16, fade: 0.12, length: 0.13 },
      noise: { length: 0.015, gain: 0.03, fade: 0.015 },
    });
  }

  death() {
    this.play({
      osc: { type: 'sine', from: 160, to: 30, sweep: 0.28, gain: 0.45, fade: 0.32, length: 0.32 },
      noise: { length: 0.18, gain: 0.3, fade: 0.16 },
    });
  }

  play({ osc, noise, delay = 0 }) {
    this.unlock();
    const { ctx } = this;
    if (!ctx) return;
    const now = ctx.currentTime + delay;

    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = osc.type;
    o.frequency.setValueAtTime(osc.from, now);
    o.frequency.exponentialRampToValueAtTime(osc.to, now + osc.sweep);
    og.gain.setValueAtTime(osc.gain, now);
    og.gain.exponentialRampToValueAtTime(0.01, now + osc.fade);
    o.connect(og).connect(ctx.destination);
    o.start(now);
    o.stop(now + osc.length);

    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer(noise.length);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(noise.gain, now);
    ng.gain.exponentialRampToValueAtTime(0.01, now + noise.fade);
    n.connect(ng).connect(ctx.destination);
    n.start(now);
  }

  // Decaying white noise, generated once per length and reused.
  noiseBuffer(seconds) {
    let buffer = this.noiseCache.get(seconds);
    if (buffer) return buffer;
    const { ctx } = this;
    const size = Math.floor(ctx.sampleRate * seconds);
    buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    this.noiseCache.set(seconds, buffer);
    return buffer;
  }
}
