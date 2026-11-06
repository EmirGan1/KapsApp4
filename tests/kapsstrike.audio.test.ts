import test from 'node:test';import assert from 'node:assert/strict';
import {FootstepTracker,stepSurface} from '../src/games/kapsstrike/footsteps';
import {MAPS} from '../src/games/kapsstrike/maps';
import {AUDIO_SAMPLES} from '../src/games/kapsstrike/audioSamples';
import {readFileSync,statSync} from 'node:fs';
test('footsteps follow distance; walls, jumps, slide, teleports and pauses stay silent',()=>{
 const tracker=new FootstepTracker();const p={x:0,y:0,z:0};let time=0;
 const step=(dx:number,ground=true,stance:'stand'|'crouch'|'slide'='stand',dt=100)=>{time+=dt;p.x+=dx;return tracker.step('local',p,ground,stance,time);};
 assert.equal(step(0),0);for(let i=0;i<20;i++)assert.equal(step(0),0);
 let walking=0;for(let i=0;i<30;i++)if(step(.6))walking++;assert.ok(walking>=7&&walking<=10);
 for(let i=0;i<20;i++)assert.equal(step(.6,false),0);
 for(let i=0;i<20;i++)assert.equal(step(.6,true,'slide'),0);
 assert.equal(step(20),0);assert.equal(step(.6,true,'stand',1500),0);
 let crouch=0;for(let i=0;i<30;i++){const level=step(.2,true,'crouch');if(level){crouch++;assert.equal(level,.22);}}assert.ok(crouch>=3);
 tracker.reset();assert.equal(step(.6),0);
});
test('per-actor cadence and material support are independent',()=>{
 const tracker=new FootstepTracker();for(let i=0;i<5;i++){tracker.step('a',{x:i*.5,y:0,z:0},true,'stand',i*100);assert.equal(tracker.step('b',{x:0,y:0,z:0},true,'stand',i*100),0);}
 const map={...MAPS.warehouse,solids:[{id:'wood-test',kind:'box' as const,x:0,y:0,z:0,w:4,h:1,d:4,color:'#fff',surface:'wood' as const}]};assert.equal(stepSurface(map,{x:0,y:1,z:0}),'wood');assert.equal(stepSurface(map,{x:10,y:0,z:0}),'concrete');
});
test('sample sprite manifest is present, compact, and synchronized with runtime offsets',()=>{
 const manifest=JSON.parse(readFileSync('public/assets/kapsstrike/audio/samples.json','utf8'));assert.deepEqual(manifest,AUDIO_SAMPLES);
 for(const clip of Object.values(AUDIO_SAMPLES)){assert.ok(clip.offset>=0&&clip.duration>.05&&clip.duration<=1.2);assert.ok(statSync(`public/assets/kapsstrike/audio/${clip.bank}.mp3`).size>1000);}
 assert.ok(statSync('public/assets/kapsstrike/audio/guns.mp3').size+statSync('public/assets/kapsstrike/audio/foley.mp3').size<130000);
});
