/**
 * Tiririka Web Audio API Synthesizer
 * Provides pure synthesized multi-sensory feedback without external audio asset downloads.
 */

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private waterNoiseNode: AudioNode | null = null;
  private waterGainNode: GainNode | null = null;
  private isWaterSoundPlaying = false;
  private cachedNoiseBuffer: AudioBuffer | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Plays a subtle cryptographic signature tick sound (sine burst)
   */
  playVoucherTick(enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(650, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(950, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Browser autoplay policy guard
    }
  }

  /**
   * Starts synthesized water flowing sound (gentle filtered white noise)
   */
  startWaterFlow(enabled = true) {
    if (!enabled || this.isWaterSoundPlaying) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      if (!this.cachedNoiseBuffer) {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.02 * white) / 1.02;
          data[i] = lastOut * 3.5;
        }
        this.cachedNoiseBuffer = buffer;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = this.cachedNoiseBuffer;
      noise.loop = true;

      // Bandpass filter to sound like gentle pouring water
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.Q.setValueAtTime(2.0, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
      this.waterNoiseNode = noise;
      this.waterGainNode = gain;
      this.isWaterSoundPlaying = true;
    } catch {
      // Audio policy guard
    }
  }

  /**
   * Stops synthesized water flowing sound
   */
  stopWaterFlow() {
    if (!this.isWaterSoundPlaying || !this.waterGainNode || !this.ctx) return;
    try {
      this.waterGainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
      setTimeout(() => {
        if (this.waterNoiseNode && 'stop' in this.waterNoiseNode) {
          (this.waterNoiseNode as AudioBufferSourceNode).stop();
        }
        this.waterNoiseNode = null;
        this.waterGainNode = null;
        this.isWaterSoundPlaying = false;
      }, 120);
    } catch {
      this.isWaterSoundPlaying = false;
    }
  }

  /**
   * Plays a celebratory settlement chime (4-note harmonic chord)
   */
  playSettlementChord(enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.07);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.07);
        osc.stop(ctx.currentTime + idx * 0.07 + 0.4);
      });
    } catch {
      // Audio policy guard
    }
  }

  /**
   * Plays an alert warning sound for anti-cheat demonstration
   */
  playAttackAlert(enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio policy guard
    }
  }
}

export const audioSynth = new AudioSynthesizer();
