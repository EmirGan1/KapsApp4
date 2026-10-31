import { WeaponId } from "./types";
/** Original synthesized sounds, bounded polyphony, no shared sample restart. */
export class StrikeAudio {
  private ctx: AudioContext | null = null;
  private voices = new Set<OscillatorNode>();
  volume = 0.35;
  private announcements=new Set<SpeechSynthesisUtterance>();
  announce(message:string){
    if(!this.ctx||this.volume<=0||typeof speechSynthesis==='undefined')return;
    const speech=new SpeechSynthesisUtterance(message);speech.lang='tr-TR';speech.volume=Math.min(1,this.volume);speech.rate=1.05;
    speech.onend=speech.onerror=()=>this.announcements.delete(speech);
    this.announcements.add(speech);speechSynthesis.speak(speech);
  }
  unlock() {
    try {
      this.ctx ||= new AudioContext();
      void this.ctx.resume();
    } catch {}
  }
  play(kind: WeaponId | "hit" | "reload" | "damage" | "bombTick" | "bombPlant" | "bombExplode") {
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
      bombTick:1200,bombPlant:650,bombExplode:42,
      carbine: 120, lmg: 100, railgun: 50,
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
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind==="bombExplode"?1.4:0.16));
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(ctx.currentTime + (kind==="bombExplode"?1.5:0.17));
  }
  dispose() {
    for(const speech of this.announcements)speech.volume=0;this.announcements.clear();
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
