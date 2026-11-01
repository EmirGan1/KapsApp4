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
  play(kind: WeaponId | "hit" | "reload" | "damage" | "bombTick" | "bombPlant" | "bombExplode", urgency = 0) {
    const ctx = this.ctx;
    if (
      !ctx ||
      ctx.state !== "running" ||
      this.volume === 0 ||
      this.voices.size >= 16
    )
      return;

    if (kind === "bombTick") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const pitch = 2650 + Math.min(1, Math.max(0, urgency)) * 650;
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, ctx.currentTime);
      osc.frequency.setValueAtTime(pitch * 1.03, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(this.volume * 0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.095);
      osc.connect(gain);
      gain.connect(ctx.destination);
      this.voices.add(osc);
      osc.onended = () => {
        this.voices.delete(osc);
        osc.disconnect();
        gain.disconnect();
      };
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      return;
    }

    if (kind === "bombPlant") {
      const notes = [1560, 1980, 2480, 3120];
      notes.forEach((freq, idx) => {
        if (this.voices.size >= 16) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t0 = ctx.currentTime + idx * 0.065;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, t0);
        gain.gain.setValueAtTime(this.volume * 0.18, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
        osc.connect(gain);
        gain.connect(ctx.destination);
        this.voices.add(osc);
        osc.onended = () => {
          this.voices.delete(osc);
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t0);
        osc.stop(t0 + 0.065);
      });
      return;
    }

    if (kind === "bombExplode") {
      const t0 = ctx.currentTime;
      // 1. Sub-bass shockwave boom + mid punch
      for (const [startFreq, endFreq, dur, amp, wave] of [
        [135, 24, 1.9, 0.45, "triangle"],
        [380, 42, 0.55, 0.28, "sawtooth"],
      ] as const) {
        if (this.voices.size >= 16) break;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(startFreq, t0);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
        gain.gain.setValueAtTime(this.volume * amp, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        this.voices.add(osc);
        osc.onended = () => {
          this.voices.delete(osc);
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      }
      // 2. Filtered broadband blast roar (white/pink noise burst)
      try {
        const sampleRate = ctx.sampleRate || 44100;
        const length = Math.floor(sampleRate * 2.1);
        const buffer = ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < length; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = (lastOut + 0.08 * white) / 1.08;
          data[i] = lastOut * 2.4 * Math.exp(-i / (sampleRate * 0.65));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2200, t0);
        filter.frequency.exponentialRampToValueAtTime(95, t0 + 1.95);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(this.volume * 0.48, t0);
        nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.05);
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(ctx.destination);
        noise.onended = () => {
          noise.disconnect();
          filter.disconnect();
          nGain.disconnect();
        };
        noise.start(t0);
        noise.stop(t0 + 2.1);
      } catch {}
      return;
    }

    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const frequencies = {
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
