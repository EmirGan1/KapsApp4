/**
 * Procedural Web Audio API sound effects for KapsPool 8-Ball Billiards.
 * Zero external asset dependencies.
 */

class BilliardsAudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Sound when the cue stick strikes the cue ball (solid chalky wood impact)
   */
  public playCueHit(powerRatio: number = 0.5) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(260 + powerRatio * 180, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.07);

      const vol = Math.min(0.35, 0.12 + powerRatio * 0.22);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      // Noise layer for chalk tap texture
      const bufferSize = ctx.sampleRate * 0.03;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 1800;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vol * 0.4, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      noise.start(now);
      osc.stop(now + 0.09);
      noise.stop(now + 0.04);
    } catch {}
  }

  /**
   * Crisp resin ball-to-ball collision sound (clack!)
   */
  public playBallHit(speed: number = 5) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const intensity = Math.min(1, Math.max(0.1, speed / 12));
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400 + Math.random() * 300, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.045);

      const vol = Math.min(0.4, 0.08 + intensity * 0.28);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.055);
    } catch {}
  }

  public playBallCollision(speed: number = 5) {
    this.playBallHit(speed);
  }

  /**
   * Deep dull thud when ball bounces off rubber cushion
   */
  public playCushionHit(speed: number = 5) {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const intensity = Math.min(1, Math.max(0.1, speed / 10));
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.09);

      const vol = Math.min(0.25, 0.06 + intensity * 0.16);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.11);
    } catch {}
  }

  /**
   * Ball dropping into leather/plastic pocket
   */
  public playPocketDrop() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Two-stage thud-clunk
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(320, now);
      osc1.frequency.exponentialRampToValueAtTime(110, now + 0.12);

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(180, now + 0.04);
      osc2.frequency.exponentialRampToValueAtTime(75, now + 0.2);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.03);
      osc1.stop(now + 0.13);
      osc2.stop(now + 0.22);
    } catch {}
  }

  /**
   * Harsh tone on foul
   */
  public playFoul() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(165, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch {}
  }

  /**
   * Joyful victory fanfare
   */
  public playVictory() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, C
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.11;
        const duration = idx === notes.length - 1 ? 0.4 : 0.16;

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      });
    } catch {}
  }

  public playWin() {
    this.playVictory();
  }
}

export const billiardsAudio = new BilliardsAudioManager();
