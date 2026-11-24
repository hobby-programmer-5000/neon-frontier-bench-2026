/**
 * Mechanical Web Audio Synthesizer for the 1936 Universal Tape Machine.
 * Synthesizes electromagnetic solenoid strikes, escapement ratchet ticks,
 * archival paper-tape friction bursts, and a warm brass halt chime.
 * Zero external audio assets; completely silent and safe before init().
 */

export class UTMAudio {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.initialized = false;
  }

  /**
   * Lazily create/resume the AudioContext (intended to be called from a user gesture).
   * Safe to call multiple times; never throws if Web Audio is unavailable.
   */
  init() {
    try {
      if (typeof window === 'undefined') return false;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;

      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0.0 : 0.42, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this.noiseBuffer = this._createNoiseBuffer(this.ctx, 0.25);
      }

      if (this.ctx.state === 'suspended') {
        const p = this.ctx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      }

      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Mute or unmute synthesized mechanical audio without clicks.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this.muted = Boolean(muted);
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.muted ? 0.0 : 0.42, now, 0.015);
    }
  }

  /**
   * Trigger mechanical step acoustics:
   * - Electromagnetic solenoid stamp click (heavier punch when wroteChanged is true)
   * - Brass escapement pawl ratchet tick
   * - Soft filtered paper-advance friction burst when moveDir !== 0
   * @param {-1|0|1} moveDir
   * @param {boolean} wroteChanged
   */
  playStep(moveDir = 0, wroteChanged = false) {
    if (!this._canPlay()) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dirPitch = moveDir > 0 ? 1.04 : moveDir < 0 ? 0.94 : 1.0;

    // 1. Electromagnetic solenoid armature strike + walnut plinth body thump
    const stampGain = wroteChanged ? 0.44 : 0.22;
    this._playSolenoidClick(now, stampGain, wroteChanged);

    // 2. Escapement ratchet pawl double-tick (slightly delayed by mechanical linkage)
    this._playEscapementTick(now + 0.016, dirPitch, 0.19);
    if (moveDir !== 0) {
      this._playEscapementTick(now + 0.044, dirPitch * 1.12, 0.11);
      // 3. Archival paper-tape advance over brass guide rollers
      this._playPaperAdvance(now + 0.018, moveDir);
    }
  }

  /**
   * Trigger a warm resonant 1936 laboratory brass bell chime on program HALT.
   */
  playHalt() {
    if (!this._canPlay()) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Soft brass hammer clapper transient
    this._playSolenoidClick(now, 0.16, false);

    // Tuned brass bell inharmonic partials (D5 fundamental = 587.33 Hz)
    const fundamental = 587.33;
    const partials = [
      { ratio: 1.0, amp: 0.34, decay: 1.55 },
      { ratio: 2.0, amp: 0.18, decay: 1.15 },
      { ratio: 2.756, amp: 0.11, decay: 0.82 },
      { ratio: 4.07, amp: 0.06, decay: 0.52 },
      { ratio: 5.41, amp: 0.03, decay: 0.32 },
    ];

    for (let i = 0; i < partials.length; i += 1) {
      const p = partials[i];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(fundamental * p.ratio, now);
      // Subtle brass shimmer detune on upper partials
      if (i > 0) {
        osc.detune.setValueAtTime((i % 2 === 0 ? 1 : -1) * 3.5, now);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(p.amp, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + p.decay + 0.03);
    }
  }

  _canPlay() {
    return Boolean(this.initialized && this.ctx && this.masterGain && !this.muted && this.ctx.state === 'running');
  }

  _createNoiseBuffer(ctx, durationSec) {
    const sampleRate = ctx.sampleRate || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    // Deterministic xorshift32 noise for clean repeatable paper grain
    let seed = 0x1936c0de;
    for (let i = 0; i < frameCount; i += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    return buffer;
  }

  _playSolenoidClick(startTime, level, heavyStamp) {
    const ctx = this.ctx;

    // Sharp metallic armature snap (short filtered impulse)
    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(heavyStamp ? 2450 : 3100, startTime);
      bp.Q.setValueAtTime(3.2, startTime);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.linearRampToValueAtTime(level * 0.9, startTime + 0.0015);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + (heavyStamp ? 0.022 : 0.014));

      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(startTime, 0, 0.03);
    }

    // Walnut plinth low resonant thump from type-hammer impact
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(heavyStamp ? 215 : 265, startTime);
    bodyOsc.frequency.exponentialRampToValueAtTime(heavyStamp ? 78 : 112, startTime + 0.036);

    bodyGain.gain.setValueAtTime(0.0001, startTime);
    bodyGain.gain.linearRampToValueAtTime(level * (heavyStamp ? 0.65 : 0.3), startTime + 0.002);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.042);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(this.masterGain);
    bodyOsc.start(startTime);
    bodyOsc.stop(startTime + 0.048);
  }

  _playEscapementTick(startTime, pitchMult, level) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const hp = ctx.createBiquadFilter();
    const g = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(4200 * pitchMult, startTime);
    osc.frequency.exponentialRampToValueAtTime(1650 * pitchMult, startTime + 0.011);

    hp.type = 'highpass';
    hp.frequency.setValueAtTime(2100, startTime);

    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(level, startTime + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.013);

    osc.connect(hp);
    hp.connect(g);
    g.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + 0.018);
  }

  _playPaperAdvance(startTime, moveDir) {
    if (!this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(moveDir > 0 ? 1950 : 1720, startTime);
    bp.frequency.linearRampToValueAtTime(moveDir > 0 ? 2350 : 1480, startTime + 0.052);
    bp.Q.setValueAtTime(1.6, startTime);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(0.11, startTime + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.058);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    src.start(startTime, 0.04, 0.068);
  }
}
