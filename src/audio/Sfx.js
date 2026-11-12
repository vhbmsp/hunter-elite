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

  death() {
    this.play({
      osc: { type: 'sine', from: 160, to: 30, sweep: 0.28, gain: 0.45, fade: 0.32, length: 0.32 },
      noise: { length: 0.18, gain: 0.3, fade: 0.16 },
    });
  }

  play({ osc, noise }) {
    this.unlock();
    const { ctx } = this;
    if (!ctx) return;
    const now = ctx.currentTime;

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
