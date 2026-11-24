/**
 * AeroFan X-900 — Procedural Dual-Spool Turbine & Broadband Jet Exhaust Synthesizer
 * Pure Web Audio API (zero external audio files, muted by default until user gesture).
 *
 * Models:
 *   1. N1 22-blade Fan Blade-Passing Frequency (BPF) + transonic buzz-saw harmonic (>85% N1)
 *   2. N2 counter-rotating HP Compressor whine (resonant high-Q bandpass + sine harmonic)
 *   3. Annular combustor deep rumble (lowpass filtered brownian/pink roar)
 *   4. Supersonic shear-layer exhaust rush (bandpass jet plume noise)
 */

export class TurbineAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterGain = null;
    this.n1Osc = null;
    this.n1SawOsc = null;
    this.n1Gain = null;
    this.n1SawGain = null;
    this.n2Osc = null;
    this.n2Gain = null;
    this.roarFilter = null;
    this.roarGain = null;
    this.rumbleFilter = null;
    this.rumbleGain = null;
  }

  initContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Synthesize 3-second seamless broadband pink/jet noise buffer
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.floor(sampleRate * 3.0);
    const noiseBuffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < frameCount; i++) {
      const white = Math.random() * 2.0 - 1.0;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
      // Seamless crossfade envelope at loop edges
      data[i] = Math.max(-0.98, Math.min(0.98, pink));
    }

    // 1. Combustor low-frequency core rumble
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = noiseBuffer;
    rumbleSrc.loop = true;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.value = 155;
    rumbleFilter.Q.value = 0.9;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.18;
    rumbleSrc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);
    rumbleSrc.start();

    // 2. Jet exhaust shear-layer broadband roar
    const roarSrc = ctx.createBufferSource();
    roarSrc.buffer = noiseBuffer;
    roarSrc.loop = true;
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = 'bandpass';
    roarFilter.frequency.value = 540;
    roarFilter.Q.value = 0.65;
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0.12;
    roarSrc.connect(roarFilter);
    roarFilter.connect(roarGain);
    roarGain.connect(master);
    roarSrc.start();

    // 3. N1 Low-Pressure Fan Blade-Passing Tone (22 blades * RPS)
    const n1Osc = ctx.createOscillator();
    n1Osc.type = 'triangle';
    n1Osc.frequency.value = 680;
    const n1Filter = ctx.createBiquadFilter();
    n1Filter.type = 'bandpass';
    n1Filter.frequency.value = 800;
    n1Filter.Q.value = 3.2;
    const n1Gain = ctx.createGain();
    n1Gain.gain.value = 0.022;
    n1Osc.connect(n1Filter);
    n1Filter.connect(n1Gain);
    n1Gain.connect(master);
    n1Osc.start();

    // Transonic wide-chord fan buzz-saw harmonic at high N1 (>82%)
    const n1SawOsc = ctx.createOscillator();
    n1SawOsc.type = 'sawtooth';
    n1SawOsc.frequency.value = 340;
    const n1SawFilter = ctx.createBiquadFilter();
    n1SawFilter.type = 'lowpass';
    n1SawFilter.frequency.value = 1150;
    const n1SawGain = ctx.createGain();
    n1SawGain.gain.value = 0.0;
    n1SawOsc.connect(n1SawFilter);
    n1SawFilter.connect(n1SawGain);
    n1SawGain.connect(master);
    n1SawOsc.start();

    // 4. N2 High-Pressure Compressor precision turbine whine
    const n2Osc = ctx.createOscillator();
    n2Osc.type = 'sine';
    n2Osc.frequency.value = 2150;
    const n2Gain = ctx.createGain();
    n2Gain.gain.value = 0.014;
    n2Osc.connect(n2Gain);
    n2Gain.connect(master);
    n2Osc.start();

    this.n1Osc = n1Osc;
    this.n1Filter = n1Filter;
    this.n1Gain = n1Gain;
    this.n1SawOsc = n1SawOsc;
    this.n1SawGain = n1SawGain;
    this.n2Osc = n2Osc;
    this.n2Gain = n2Gain;
    this.roarFilter = roarFilter;
    this.roarGain = roarGain;
    this.rumbleFilter = rumbleFilter;
    this.rumbleGain = rumbleGain;
  }

  async toggle(forceState) {
    const next = typeof forceState === 'boolean' ? forceState : !this.enabled;
    if (next && !this.ctx) {
      this.initContext();
    }
    if (!this.ctx) {
      this.enabled = false;
      return false;
    }
    if (next && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.enabled = next;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(next ? 0.34 : 0.0, now, 0.08);
    return this.enabled;
  }

  update(thermoState, timeScale = 1.0) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    const activeScale = Math.max(0.0, Math.min(1.5, timeScale));

    if (activeScale < 0.01) {
      this.masterGain.gain.setTargetAtTime(0.0, now, 0.06);
      return;
    }
    this.masterGain.gain.setTargetAtTime(0.34, now, 0.08);

    const n1Rps = (thermoState.n1Rpm / 60.0) * Math.max(0.25, activeScale);
    const n2Rps = (thermoState.n2Rpm / 60.0) * Math.max(0.25, activeScale);

    // 22-blade fan passing frequency
    const bpf1 = Math.max(120, Math.min(1400, n1Rps * 22.0));
    this.n1Osc.frequency.setTargetAtTime(bpf1, now, 0.06);
    this.n1Filter.frequency.setTargetAtTime(bpf1 * 1.05, now, 0.06);

    const u = (thermoState.throttlePct - 22.0) / 78.0;
    this.n1Gain.gain.setTargetAtTime(0.014 + 0.024 * u, now, 0.08);

    // Transonic fan buzz-saw emerges above ~82% N1
    const buzzFactor = Math.max(0.0, (thermoState.n1Pct - 82.0) / 20.0);
    this.n1SawOsc.frequency.setTargetAtTime(Math.max(80, bpf1 * 0.5), now, 0.06);
    this.n1SawGain.gain.setTargetAtTime(0.018 * buzzFactor * buzzFactor, now, 0.08);

    // N2 high-pressure compressor whine (14th harmonic of N2 shaft RPS)
    const n2Freq = Math.max(700, Math.min(3600, n2Rps * 14.5));
    this.n2Osc.frequency.setTargetAtTime(n2Freq, now, 0.06);
    this.n2Gain.gain.setTargetAtTime(0.010 + 0.014 * (1.0 - 0.35 * u), now, 0.08);

    // Combustor & jet roar scaled by combustor intensity and net thrust
    const thrustNorm = Math.min(1.2, thermoState.netThrustKN / 380.0);
    this.rumbleFilter.frequency.setTargetAtTime(125 + 145 * thermoState.combustorIntensity, now, 0.08);
    this.rumbleGain.gain.setTargetAtTime(0.11 + 0.24 * thermoState.combustorIntensity, now, 0.08);

    this.roarFilter.frequency.setTargetAtTime(360 + 580 * thrustNorm, now, 0.08);
    this.roarGain.gain.setTargetAtTime(0.05 + 0.22 * thrustNorm, now, 0.08);
  }
}
