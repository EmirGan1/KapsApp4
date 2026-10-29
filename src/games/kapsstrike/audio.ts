import { WeaponId } from "./types";
/** Original synthesized sounds, bounded polyphony, no shared sample restart. */
export class StrikeAudio {
  private ctx: AudioContext | null = null;
  private voices = new Set<OscillatorNode>();
  volume = 0.35;
  unlock() {
    try {
      this.ctx ||= new AudioContext();
      void this.ctx.resume();
    } catch {}
  }
  play(kind: WeaponId | "hit" | "reload" | "damage") {
    const ctx = this.ctx;
    if (
      !ctx ||
      ctx.state !== "running" ||
      this.volume === 0 ||
      this.voices.size >= 16
    )
      return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const frequencies = {
      knife: 420,
      rifle: 130,
      smg: 180,
      sniper: 65,
      shotgun: 75,
      pistol: 200,
      hit: 900,
      reload: 360,
      damage: 90,
    };
    oscillator.type = kind === "hit" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(frequencies[kind], ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(25, frequencies[kind] * 0.25),
      ctx.currentTime + 0.12,
    );
    gain.gain.setValueAtTime(
      this.volume * (kind === "hit" ? 0.06 : 0.12),
      ctx.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.17);
  }
  dispose() {
    for (const v of this.voices) {
      try {
        v.stop();
      } catch {}
    }
    this.voices.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}
