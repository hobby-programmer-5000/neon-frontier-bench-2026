export class KineticAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = true; // Stays quiet & lazy-created until explicit user gesture
    this.userUnlocked = false;
    this.rollOsc = null;
    this.rollGain = null;
    this.rollFilter = null;
    this.noiseBuffer = null;
  }

  unlock() {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this._buildNoiseBuffer();
      this._buildRollHum();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.userUnlocked = true;
    this.muted = false;
    this.master.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.02);
    return true;
  }

  toggleMute() {
    if (!this.userUnlocked) {
      this.unlock();
      return false;
    }
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0.0 : 0.55, this.ctx.currentTime, 0.025);
    }
    return this.muted;
  }

  _canPlay() {
    return this.userUnlocked && !this.muted && this.ctx && this.ctx.state === 'running';
  }

  _buildNoiseBuffer() {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 1.2);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.06 * white) / 1.06;
      data[i] = last * 2.4;
    }
    this.noiseBuffer = buffer;
  }

  _buildRollHum() {
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 95;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 260;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start();

    this.rollOsc = osc;
    this.rollFilter = filter;
    this.rollGain = gain;
  }

  setRollHum(speed) {
    if (!this.ctx || !this.rollGain) return;
    const t = this.ctx.currentTime;
    if (!this._canPlay() || speed < 0.08) {
      this.rollGain.gain.setTargetAtTime(0, t, 0.04);
      return;
    }
    const norm = Math.min(1, speed / 3.0);
    this.rollOsc.frequency.setTargetAtTime(75 + norm * 85, t, 0.05);
    this.rollFilter.frequency.setTargetAtTime(190 + norm * 420, t, 0.05);
    this.rollGain.gain.setTargetAtTime(0.06 * norm, t, 0.04);
  }

  playLeverClink(intensity = 0.8) {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    const freqs = [1480, 2240, 3510];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      const peak = (0.14 * intensity) / (idx + 1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16 - idx * 0.03);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.18);
    });
  }

  playDominoClack(index) {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    const pitch = 280 + index * 24;

    // Resonant mahogany knock
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch * 1.15, now);
    osc.frequency.exponentialRampToValueAtTime(pitch, now + 0.035);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = pitch * 1.6;
    filter.Q.value = 3.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.24, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.095);

    // Crisp click transient
    if (this.noiseBuffer) {
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.value = 1800 + index * 90;
      nFilter.Q.value = 2.0;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      nSrc.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.master);
      nSrc.start(now);
      nSrc.stop(now + 0.03);
    }
  }

  playCradlePing(strength = 1.0) {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    const partials = [2640, 4180, 5920];
    partials.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      const amp = Math.min(0.22, 0.16 * strength) / (idx * 0.9 + 1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(amp, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24 - idx * 0.05);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.26);
    });
  }

  playCatapultTwang() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(128, now + 0.28);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.28);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.20, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.32);

    this.playLeverClink(0.75);
  }

  playSilkWhoosh() {
    if (!this._canPlay() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(360, now);
    filter.frequency.exponentialRampToValueAtTime(1450, now + 0.14);
    filter.frequency.exponentialRampToValueAtTime(480, now + 0.52);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + 0.58);
  }

  playBellChime() {
    if (!this._canPlay()) return;
    const now = this.ctx.currentTime;
    // Harmonic D5 emerald-glass & brass bell chime (587.33 Hz fundamental)
    const d5 = 587.33;
    const partials = [
      { ratio: 1.0, amp: 0.26, dur: 2.3 },
      { ratio: 2.0, amp: 0.16, dur: 1.8 },
      { ratio: 2.756, amp: 0.11, dur: 1.3 },
      { ratio: 3.98, amp: 0.07, dur: 0.9 },
      { ratio: 5.40, amp: 0.04, dur: 0.65 },
    ];
    for (const p of partials) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(d5 * p.ratio, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(p.amp, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + p.dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + p.dur + 0.05);
    }
  }
}
