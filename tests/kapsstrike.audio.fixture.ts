import {StrikeAudio} from '../src/games/kapsstrike/audio';
const audio=new StrikeAudio();const logs:any[]=[];let oscillators=0;
const nativeSource=AudioContext.prototype.createBufferSource,nativeOsc=AudioContext.prototype.createOscillator;
AudioContext.prototype.createBufferSource=function(){const source=nativeSource.call(this),start=source.start.bind(source),stop=source.stop.bind(source);(source as any).start=(...args:any[])=>{logs.push({args,duration:source.buffer?.duration,stopped:false});const entry=logs.at(-1);(source as any).stop=(...s:any[])=>{entry.stopped=true;return stop(...s);};return start(...args);};return source;};
AudioContext.prototype.createOscillator=function(){oscillators++;return nativeOsc.call(this);};
Object.assign(window,{audio,logs,getOscillators:()=>oscillators});
document.querySelector('button')!.onclick=async()=>{audio.unlock();await(audio as any).samples.load((audio as any).ctx);(window as any).ready=true;};
