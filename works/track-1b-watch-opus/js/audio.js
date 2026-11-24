/*
 * Chronos Calibre O-5 — synthesised Swiss-lever acoustics (Web Audio API)
 * Each beat is three transients a few milliseconds apart — unlocking, impulse,
 * drop — band-passed noise bursts over a short case resonance. Tick and tock
 * alternate in pitch, giving the 8 beats/s (4 Hz) signature. The context is
 * only created inside a user gesture, so there is never an autoplay warning.
 */
(function (root) {
  'use strict';

  class LeverAcoustics {
    constructor() {
      this.ctx = null;
      this.enabled = false;
      this.master = null;
      this.noise = null;
    }

    ensure() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const len = Math.floor(ctx.sampleRate * 0.25);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const ch = buf.getChannelData(0);
      let s = 1234567;
      for (let i = 0; i < len; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        ch[i] = (s / 0x7fffffff) * 2 - 1;
      }
      this.noise = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 520;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(hp);
      hp.connect(comp);
      comp.connect(ctx.destination);
    }

    setEnabled(on) {
      if (on) this.ensure();
      if (!this.ctx) return false;
      this.enabled = on;
      const t = this.ctx.currentTime;
      if (on && this.ctx.state === 'suspended') this.ctx.resume();
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(on ? 0.85 : 0, t, 0.03);
      return this.enabled;
    }

    now() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    transient(when, freq, q, peak, dur) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak, when + 0.0004);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start(when, Math.random() * 0.2, dur + 0.01);
    }

    ping(when, freq, peak, dur) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak, when + 0.0006);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(when);
      o.stop(when + dur + 0.02);
    }

    /** One escapement beat. tock = odd beat, lite = reduced voice count (fast-forward). */
    beat(when, tock, amp, lite) {
      if (!this.enabled || !this.ctx) return;
      const k = tock ? 0.86 : 1.0;
      const a = Math.max(0.15, Math.min(1, amp));
      if (!lite) {
        this.transient(when, 2900 * k, 9, 0.18 * a, 0.004);           // unlocking
        this.transient(when + 0.0026, 4300 * k, 7, 0.22 * a, 0.005);  // impulse
      }
      this.transient(when + 0.0052, 3500 * k, 5, 0.5 * a, 0.012);     // drop on the locking face
      this.ping(when + 0.0052, 5200 * k, 0.05 * a, 0.03);             // case resonance
    }

    /** Ratchet click while winding. */
    click(when) {
      if (!this.enabled || !this.ctx) return;
      this.transient(when, 6200, 6, 0.35, 0.006);
      this.ping(when, 2100, 0.06, 0.02);
    }
  }

  root.CO5 = root.CO5 || {};
  root.CO5.LeverAcoustics = LeverAcoustics;
})(window);
