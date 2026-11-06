import {StrikeSampleBank, type SampleId} from "./audioSamples";
import type {StepSurface} from "./footsteps";
import {WEAPONS} from "./config";
import { WeaponId, Vec3 } from "./types";

export type AudioKind =
  | WeaponId
  | "hit"
  | "headshot"
  | "reload"
  | "damage"
  | "death"
  | "bombTick"
  | "bombPlant"
  | "bombExplode"
  | "bombDefuseStart"
  | "bombDefuseTick"
  | "bombDefused"
  | "footstep";

/**
 * Recorded firearm/foley samples with bounded voices and spatial stereo panning.
 * Procedural combat cues remain available while the sample bank loads.
 */
export class StrikeAudio {
  private ctx: AudioContext | null = null;
  private voices = new Set<{ stop: () => void }>();
  private masterGain: GainNode | null = null;
  private samples = new StrikeSampleBank();
  private reloadVoices = new Set<{stop:()=>void}>();
  private _volume = 0.45;
  get volume(){return this._volume;}
  set volume(value:number){
    this._volume=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
    if(this.masterGain&&this.ctx)this.masterGain.gain.setValueAtTime(this._volume>0?1:0,this.ctx.currentTime);
    if(this._volume===0)this.cancelReload();
  }
  private stepIndex = 0;
  cancelReload(){for(const voice of this.reloadVoices)voice.stop();this.reloadVoices.clear();}
  reload(weapon:WeaponId,duration=WEAPONS[weapon].reload){
    this.cancelReload();
    if(weapon==='knife'||!this.ctx||this.ctx.state!=='running'||this.volume<=0)return;
    const parts=[['reload-out',.02],['reload-in',.58],['reload-bolt',.86]] as const;
    if(!parts.every(([id])=>this.samples.get(id))){this.play('reload');return;}
    for(const [id,fraction]of parts)this.sample(id,undefined,.65,1,this.ctx.currentTime+Math.max(0,Math.min(Math.max(.3,duration)*fraction,duration-.3)),true);
  }
  footstep(material:StepSurface='concrete',loudness=.65,position?:Vec3){
    const id=`step-${material}-${this.stepIndex++%4}` as SampleId;
    if(this.voices.size>=24)return;
    if(!this.sample(id,position,.28*loudness,.96+Math.random()*.08))this.play('footstep',0,position);
  }
  private sample(id:SampleId,position?:Vec3,level=1,rate=1,when?:number,reload=false){
    const ctx=this.ctx,clip=this.samples.get(id);
    if(!ctx||ctx.state!=='running'||this.volume<=0||this.voices.size>=32||!clip)return false;
    const spatial=this.create3DNode(position),source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=clip.buffer;source.playbackRate.value=rate;
    gain.gain.value=this.volume*level;source.connect(gain);gain.connect(spatial.input);
    let ended=false;
    const entry={stop:()=>{try{source.stop();}catch{}finish();}};
    const finish=()=>{if(ended)return;ended=true;this.voices.delete(entry);this.reloadVoices.delete(entry);source.disconnect();gain.disconnect();spatial.cleanup();};
    source.onended=finish;this.voices.add(entry);if(reload)this.reloadVoices.add(entry);
    source.start(when??ctx.currentTime,clip.offset,clip.duration);
    return true;
  }
  private announcements = new Set<SpeechSynthesisUtterance>();

  // Current listener pose for 360 spatial calculation
  private listenerPos: Vec3 = { x: 0, y: 1.62, z: 0 };
  private listenerYaw = 0; // Radians, 0 = forward along +Z

  updateListener(pos: Vec3, yaw: number) {
    this.listenerPos = { x: pos.x, y: pos.y, z: pos.z };
    this.listenerYaw = yaw;
  }

  announce(message: string) {
    if (!this.ctx || this.volume <= 0 || typeof speechSynthesis === "undefined") return;
    try {
      const speech = new SpeechSynthesisUtterance(message);
      speech.lang = "tr-TR";
      speech.volume = Math.min(1, this.volume * 1.2);
      speech.rate = 1.05;
      speech.onend = speech.onerror = () => this.announcements.delete(speech);
      this.announcements.add(speech);
      speechSynthesis.speak(speech);
    } catch {}
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume>0?1:0, this.ctx.currentTime);
        const limiter=this.ctx.createDynamicsCompressor();
        limiter.threshold.value=-6;limiter.knee.value=12;limiter.ratio.value=6;limiter.attack.value=.003;limiter.release.value=.12;
        this.masterGain.connect(limiter);limiter.connect(this.ctx.destination);
      }
      void this.samples.load(this.ctx);
      if (this.ctx.state === "suspended") {
        void this.ctx.resume().catch(()=>{});
      }
    } catch {}
  }

  /**
   * Builds an authentic 360 spatial audio bus:
   * Translates 3D world source coordinates relative to the player's position & yaw into:
   * 1. Stereo Panner (-1.0 to 1.0)
   * 2. Distance roll-off gain (smooth inverse-distance curve)
   * 3. Lowpass air absorption (distant sounds lose high frequencies)
   */
  private create3DNode(sourcePos?: Vec3): {
    input: AudioNode;
    distGain: number;
    cleanup: () => void;
  } {
    const ctx = this.ctx!;
    const bus = ctx.createGain();

    if (!sourcePos) {
      // 2D direct center audio (e.g. local player weapon or UI)
      bus.connect(this.masterGain || ctx.destination);
      return { input: bus, distGain: 1, cleanup: () => bus.disconnect() };
    }

    const dx = sourcePos.x - this.listenerPos.x;
    const dy = sourcePos.y - this.listenerPos.y;
    const dz = sourcePos.z - this.listenerPos.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Calculate relative horizontal angle in listener's local view frame
    // In our coordinate system: yaw 0 looks toward +Z.
    const worldAngle = Math.atan2(dx, dz);
    let relAngle = worldAngle - this.listenerYaw;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    // Pan: sin of relative angle maps -PI/2 (left) to -1, +PI/2 (right) to +1
    const pan = Math.max(-1, Math.min(1, Math.sin(relAngle)));

    // Distance attenuation: CS style hearing up to 75 meters, sharp near presence
    const refDist = 2.5;
    const maxDist = 75;
    const clampedDist = Math.max(refDist, Math.min(maxDist, dist));
    const distGain = Math.pow(refDist / clampedDist, 0.95);

    // Air absorption lowpass filter: distant gunshots are muffled, close ones have bright crack
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    const cutoff = Math.max(800, 18000 - (clampedDist / maxDist) * 15000);
    filter.frequency.setValueAtTime(cutoff, ctx.currentTime);

    // Stereo Panner Node
    let panner: StereoPannerNode | GainNode;
    if (typeof ctx.createStereoPanner === "function") {
      const sp = ctx.createStereoPanner();
      sp.pan.setValueAtTime(pan, ctx.currentTime);
      panner = sp;
    } else {
      panner = ctx.createGain(); // Fallback if StereoPanner is unsupported
    }

    const localGain = ctx.createGain();
    localGain.gain.setValueAtTime(distGain, ctx.currentTime);

    bus.connect(filter);
    filter.connect(panner);
    panner.connect(localGain);
    localGain.connect(this.masterGain || ctx.destination);

    return {
      input: bus,
      distGain,
      cleanup: () => {
        try {
          bus.disconnect();
          filter.disconnect();
          panner.disconnect();
          localGain.disconnect();
        } catch {}
      },
    };
  }

  play(kind: AudioKind, urgency = 0, sourcePos?: Vec3) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.volume === 0 || this.voices.size >= 32) return;

    const profiles:Partial<Record<AudioKind,[SampleId,number,number]>>={
      rifle:['rifle',.85,1],carbine:['carbine',.85,1],smg:['smg',.72,1.05],pistol:['pistol',.8,1],
      sniper:['sniper',1,.94],shotgun:['shotgun',1,1],lmg:['rifle',.95,.88],railgun:['sniper',1,.82]
    };
    const profile=profiles[kind];
    if(profile&&this.sample(profile[0],sourcePos,profile[1],profile[2]*(.985+Math.random()*.03)))return;
    const t0 = ctx.currentTime;
    const { input, distGain, cleanup } = this.create3DNode(sourcePos);
    if (distGain < 0.01) {
      cleanup();
      return;
    }

    const voiceEntry = { stop: () => cleanup() };
    this.voices.add(voiceEntry);
    const finish = (duration: number) => {
      setTimeout(() => {
        this.voices.delete(voiceEntry);
        cleanup();
      }, (duration + 0.08) * 1000);
    };

    // =========================================================================
    // 1. RELOAD AUDIO (CS:GO Tactical Mechanical Magazine Eject + Insert + Slide Snap)
    // =========================================================================
    if (kind === "reload") {
      const vol = this.volume * 0.42;

      // Stage 1: Mag Eject Click (t0)
      this.playMechanicalClick(input, t0, 1800, 420, 0.04, vol * 0.9);
      this.playMechanicalClick(input, t0 + 0.04, 900, 280, 0.06, vol * 0.65);

      // Stage 2: Mag Sliding In & Heavy Locking Latch Clack (t0 + 0.42s)
      this.playMechanicalClick(input, t0 + 0.42, 650, 180, 0.08, vol * 0.7);
      this.playMechanicalClick(input, t0 + 0.48, 2200, 850, 0.05, vol * 1.0);

      // Stage 3: Bolt / Slide Pull & Release Snap (t0 + 0.85s)
      this.playMechanicalClick(input, t0 + 0.82, 1400, 320, 0.05, vol * 0.85);
      this.playMechanicalClick(input, t0 + 0.91, 2800, 600, 0.07, vol * 1.1);

      finish(1.1);
      return;
    }

    // =========================================================================
    // 2. BOMB TICK / BEEP (360 3D spatialized around planted bomb location)
    // =========================================================================
    if (kind === "bombTick") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const pitch = 2650 + Math.min(1, Math.max(0, urgency)) * 650;
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, t0);
      osc.frequency.setValueAtTime(pitch * 1.04, t0 + 0.035);
      gain.gain.setValueAtTime(this.volume * 0.28, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.085);
      osc.connect(gain);
      gain.connect(input);
      osc.start(t0);
      osc.stop(t0 + 0.09);
      finish(0.1);
      return;
    }

    // =========================================================================
    // 3. BOMB PLANT AUDIO (Keypad Beeps + Arming Clack)
    // =========================================================================
    if (kind === "bombPlant") {
      const notes = [1560, 1980, 2480, 3120];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const pt = t0 + idx * 0.065;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, pt);
        gain.gain.setValueAtTime(this.volume * 0.22, pt);
        gain.gain.exponentialRampToValueAtTime(0.0001, pt + 0.06);
        osc.connect(gain);
        gain.connect(input);
        osc.start(pt);
        osc.stop(pt + 0.065);
      });
      // Final arming latch
      this.playMechanicalClick(input, t0 + 0.32, 850, 160, 0.12, this.volume * 0.35);
      finish(0.48);
      return;
    }

    // =========================================================================
    // 4. BOMB DEFUSE AUDIO (Cable Snip + Multi-stage Defusal Kit Click & Beep)
    // =========================================================================
    if (kind === "bombDefuseStart") {
      // Defuse kit opening latch & pliers metallic snip
      this.playMechanicalClick(input, t0, 3200, 1200, 0.04, this.volume * 0.45);
      this.playMechanicalClick(input, t0 + 0.06, 1100, 350, 0.08, this.volume * 0.35);
      finish(0.2);
      return;
    }

    if (kind === "bombDefuseTick") {
      // Rapid electronics analysis ticks during defusal hold
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(1420 + Math.random() * 300, t0);
      gain.gain.setValueAtTime(this.volume * 0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
      osc.connect(gain);
      gain.connect(input);
      osc.start(t0);
      osc.stop(t0 + 0.05);
      finish(0.06);
      return;
    }

    if (kind === "bombDefused") {
      // Victorious dual-tone confirm chime + wire cut
      this.playMechanicalClick(input, t0, 2400, 800, 0.06, this.volume * 0.5);
      [880, 1320].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const pt = t0 + 0.08 + idx * 0.1;
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, pt);
        gain.gain.setValueAtTime(this.volume * 0.28, pt);
        gain.gain.exponentialRampToValueAtTime(0.0001, pt + 0.25);
        osc.connect(gain);
        gain.connect(input);
        osc.start(pt);
        osc.stop(pt + 0.28);
      });
      finish(0.5);
      return;
    }

    // =========================================================================
    // 5. BOMB EXPLODE (Massive Sub-bass Shockwave + Broadband Fireball Roar)
    // =========================================================================
    if (kind === "bombExplode") {
      // 1. Sub-bass earthquake punch
      for (const [startFreq, endFreq, dur, amp, wave] of [
        [150, 22, 2.2, 0.65, "triangle"],
        [420, 36, 0.75, 0.38, "sawtooth"],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(startFreq, t0);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
        gain.gain.setValueAtTime(this.volume * amp, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(input);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      }
      // 2. Blast noise roar
      this.playNoiseBlast(input, t0, 2.4, 2800, 85, this.volume * 0.65);
      finish(2.5);
      return;
    }

    // =========================================================================
    // 6. HIT / HEADSHOT / DAMAGE
    // =========================================================================
    if (kind === "hit" || kind === "headshot") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const isHead = kind === "headshot";
      osc.type = isHead ? "triangle" : "sine";
      osc.frequency.setValueAtTime(isHead ? 1450 : 880, t0);
      osc.frequency.exponentialRampToValueAtTime(isHead ? 2200 : 440, t0 + (isHead ? 0.14 : 0.08));
      gain.gain.setValueAtTime(this.volume * (isHead ? 0.24 : 0.14), t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (isHead ? 0.16 : 0.09));
      osc.connect(gain);
      gain.connect(input);
      osc.start(t0);
      osc.stop(t0 + 0.18);
      finish(0.2);
      return;
    }

    if (kind === "damage") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, t0);
      osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.18);
      gain.gain.setValueAtTime(this.volume * 0.25, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
      osc.connect(gain);
      gain.connect(input);
      osc.start(t0);
      osc.stop(t0 + 0.2);
      finish(0.22);
      return;
    }

    if (kind === "footstep") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(95, t0);
      osc.frequency.exponentialRampToValueAtTime(35, t0 + 0.07);
      gain.gain.setValueAtTime(this.volume * 0.08, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      osc.connect(gain);
      gain.connect(input);
      osc.start(t0);
      osc.stop(t0 + 0.09);
      finish(0.1);
      return;
    }

    if (kind === "death") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(110, t0);
      osc.frequency.exponentialRampToValueAtTime(30, t0 + 0.32);
      gain.gain.setValueAtTime(this.volume * 0.28, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      osc.connect(gain);
      gain.connect(input);
      osc.start(t0);
      osc.stop(t0 + 0.38);
      finish(0.4);
      return;
    }

    // =========================================================================
    // 7. WEAPON SHOT AUDIO (Punchy CS:GO Procedural Profiles)
    // =========================================================================
    this.synthesizeGunshot(input, kind as WeaponId, t0);
    finish(0.5);
  }

  /**
   * Generates punchy, layered procedural gunshots:
   * Layer 1: Supersonic Muzzle Crack (high-frequency burst)
   * Layer 2: Chamber Punch / Thump (sub-bass pitch ramp)
   * Layer 3: Gunpowder Expansion Noise Body
   */
  private synthesizeGunshot(dest: AudioNode, weapon: WeaponId, t0: number) {
    const ctx = this.ctx!;
    const isLocal = true; // gain scaled via 3D node distGain

    // Weapon-specific audio profiles (Frequency, Body Duration, Volume, Muzzle Sharpness)
    const specs: Record<
      WeaponId,
      {
        crackFreq: number;
        thumpStart: number;
        thumpEnd: number;
        dur: number;
        noiseCutoff: number;
        amp: number;
      }
    > = {
      rifle: { crackFreq: 3400, thumpStart: 180, thumpEnd: 55, dur: 0.32, noiseCutoff: 3800, amp: 0.48 },
      carbine: { crackFreq: 3600, thumpStart: 195, thumpEnd: 60, dur: 0.28, noiseCutoff: 4200, amp: 0.46 },
      smg: { crackFreq: 2800, thumpStart: 240, thumpEnd: 75, dur: 0.22, noiseCutoff: 3200, amp: 0.38 },
      sniper: { crackFreq: 4800, thumpStart: 140, thumpEnd: 32, dur: 0.58, noiseCutoff: 5200, amp: 0.72 },
      railgun: { crackFreq: 5600, thumpStart: 95, thumpEnd: 25, dur: 0.65, noiseCutoff: 7500, amp: 0.75 },
      shotgun: { crackFreq: 2200, thumpStart: 120, thumpEnd: 40, dur: 0.45, noiseCutoff: 2600, amp: 0.65 },
      lmg: { crackFreq: 3100, thumpStart: 160, thumpEnd: 50, dur: 0.36, noiseCutoff: 3500, amp: 0.52 },
      pistol: { crackFreq: 2400, thumpStart: 290, thumpEnd: 95, dur: 0.19, noiseCutoff: 2900, amp: 0.35 },
      knife: { crackFreq: 1100, thumpStart: 420, thumpEnd: 180, dur: 0.14, noiseCutoff: 1800, amp: 0.28 },
    };

    const spec = specs[weapon] || specs.rifle;
    const vol = this.volume * spec.amp;

    if (weapon === "knife") {
      // Whoosh/slash curve for knife
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(spec.thumpStart, t0);
      osc.frequency.exponentialRampToValueAtTime(spec.thumpEnd, t0 + spec.dur);
      gain.gain.setValueAtTime(vol * 0.7, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t0);
      osc.stop(t0 + spec.dur + 0.02);
      this.playNoiseBlast(dest, t0, 0.12, 1600, 300, vol * 0.5);
      return;
    }

    // 1. Low Thump (Chamber Pressure Kick)
    const thump = ctx.createOscillator();
    const tGain = ctx.createGain();
    thump.type = "sawtooth";
    thump.frequency.setValueAtTime(spec.thumpStart, t0);
    thump.frequency.exponentialRampToValueAtTime(spec.thumpEnd, t0 + spec.dur * 0.6);
    tGain.gain.setValueAtTime(vol * 0.9, t0);
    tGain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur * 0.75);
    thump.connect(tGain);
    tGain.connect(dest);
    thump.start(t0);
    thump.stop(t0 + spec.dur);

    // 2. High Muzzle Snap / Crack
    const crack = ctx.createOscillator();
    const cGain = ctx.createGain();
    crack.type = "triangle";
    crack.frequency.setValueAtTime(spec.crackFreq, t0);
    crack.frequency.exponentialRampToValueAtTime(spec.crackFreq * 0.3, t0 + 0.045);
    cGain.gain.setValueAtTime(vol * 0.8, t0);
    cGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    crack.connect(cGain);
    cGain.connect(dest);
    crack.start(t0);
    crack.stop(t0 + 0.06);

    // 3. Gunpowder Blast Noise
    this.playNoiseBlast(dest, t0, spec.dur, spec.noiseCutoff, 120, vol * 0.85);

    // 4. Railgun Sci-Fi Synth Tail Accent
    if (weapon === "railgun") {
      const charge = ctx.createOscillator();
      const chGain = ctx.createGain();
      charge.type = "sine";
      charge.frequency.setValueAtTime(800, t0);
      charge.frequency.exponentialRampToValueAtTime(2600, t0 + 0.25);
      chGain.gain.setValueAtTime(vol * 0.45, t0);
      chGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
      charge.connect(chGain);
      chGain.connect(dest);
      charge.start(t0);
      charge.stop(t0 + 0.38);
    }
  }

  private playMechanicalClick(
    dest: AudioNode,
    time: number,
    startFreq: number,
    endFreq: number,
    dur: number,
    gainLevel: number,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + dur);
      gain.gain.setValueAtTime(gainLevel, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(time);
      osc.stop(time + dur + 0.01);
    } catch {}
  }

  private playNoiseBlast(
    dest: AudioNode,
    time: number,
    duration: number,
    cutoffHigh: number,
    cutoffLow: number,
    gainLevel: number,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    try {
      const sampleRate = ctx.sampleRate || 44100;
      const bufferLength = Math.max(128, Math.floor(sampleRate * Math.min(1.5, duration)));
      const buffer = ctx.createBuffer(1, bufferLength, sampleRate);
      const data = buffer.getChannelData(0);
      let b0 = 0, b1 = 0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        // Mild pink filter to avoid harsh white hiss
        b0 = 0.95 * b0 + white * 0.05;
        b1 = 0.85 * b1 + white * 0.15;
        data[i] = (b0 + b1) * 1.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cutoffHigh, time);
      filter.frequency.exponentialRampToValueAtTime(cutoffLow, time + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainLevel, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(time);
      noise.stop(time + duration + 0.02);
    } catch {}
  }

  dispose() {
    this.cancelReload();
    this.samples.dispose();
    for (const speech of this.announcements) speech.volume = 0;
    this.announcements.clear();
    for (const v of this.voices) {
      try {
        v.stop();
      } catch {}
    }
    this.voices.clear();
    void this.ctx?.close().catch(()=>{});
    this.ctx = null;
  }
}
