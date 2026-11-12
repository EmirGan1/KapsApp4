// Sample offsets generated from the licensed edits documented in public/assets/kapsstrike/audio/CREDITS.md.
export const AUDIO_SAMPLES = {
  knife: { bank: 'knife', offset: 0, duration: .28 },
  "rifle": {
    "bank": "guns",
    "offset": 0.0,
    "duration": 0.85
  },
  "carbine": {
    "bank": "guns",
    "offset": 0.91,
    "duration": 0.85
  },
  "pistol": {
    "bank": "guns",
    "offset": 1.82,
    "duration": 0.65
  },
  "smg": {
    "bank": "guns",
    "offset": 2.53,
    "duration": 0.65
  },
  "sniper": {
    "bank": "guns",
    "offset": 3.24,
    "duration": 1.1
  },
  "shotgun": {
    "bank": "guns",
    "offset": 4.4,
    "duration": 1.0
  },
  "reload-out": {
    "bank": "foley",
    "offset": 0.0,
    "duration": 0.176125
  },
  "reload-in": {
    "bank": "foley",
    "offset": 0.236125,
    "duration": 0.14154166666666668
  },
  "reload-bolt": {
    "bank": "foley",
    "offset": 0.43766666666666665,
    "duration": 0.175875
  },
  "step-concrete-0": {
    "bank": "foley",
    "offset": 0.6735416666666667,
    "duration": 0.10304166666666667
  },
  "step-concrete-1": {
    "bank": "foley",
    "offset": 0.8365833333333333,
    "duration": 0.10475
  },
  "step-concrete-2": {
    "bank": "foley",
    "offset": 1.0013333333333334,
    "duration": 0.109875
  },
  "step-concrete-3": {
    "bank": "foley",
    "offset": 1.1712083333333334,
    "duration": 0.10758333333333334
  },
  "step-wood-0": {
    "bank": "foley",
    "offset": 1.3387916666666666,
    "duration": 0.271375
  },
  "step-wood-1": {
    "bank": "foley",
    "offset": 1.6701666666666666,
    "duration": 0.24866666666666667
  },
  "step-wood-2": {
    "bank": "foley",
    "offset": 1.9788333333333334,
    "duration": 0.2485
  },
  "step-wood-3": {
    "bank": "foley",
    "offset": 2.287333333333333,
    "duration": 0.248625
  },
  "step-grass-0": {
    "bank": "foley",
    "offset": 2.5959583333333334,
    "duration": 0.28
  },
  "step-grass-1": {
    "bank": "foley",
    "offset": 2.9359583333333332,
    "duration": 0.28
  },
  "step-grass-2": {
    "bank": "foley",
    "offset": 3.2759583333333335,
    "duration": 0.28
  },
  "step-grass-3": {
    "bank": "foley",
    "offset": 3.6159583333333334,
    "duration": 0.28
  }
} as const;
export type SampleId = keyof typeof AUDIO_SAMPLES;
export class StrikeSampleBank {
  private buffers = new Map<string,AudioBuffer>();
  private pending?:Promise<void>;
  private abort = new AbortController();
  private disposed = false;
  load(ctx:AudioContext) {
    if(this.pending||this.disposed)return this.pending;
    this.pending=Promise.all(['guns','foley','knife'].map(async bank=>{
      if(this.buffers.has(bank))return;
      try {
        const response=await fetch(`/assets/kapsstrike/audio/${bank}.mp3`,{signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(10000)])});
        if(!response.ok)throw Error('Audio sample unavailable');
        const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
        if(!this.disposed&&ctx.state!=='closed')this.buffers.set(bank,buffer);
      }catch{} // Gameplay keeps the procedural fallback if an asset cannot load.
    })).then(()=>{this.pending=undefined;});
    return this.pending;
  }
  get(id:SampleId){const clip=AUDIO_SAMPLES[id],buffer=this.buffers.get(clip.bank);return buffer?{buffer,...clip}:undefined;}
  dispose(){this.disposed=true;this.abort.abort();this.buffers.clear();}
}
