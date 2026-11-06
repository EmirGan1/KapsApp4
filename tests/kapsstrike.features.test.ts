import test from 'node:test';import assert from 'node:assert/strict';
import {createWorld,advanceWorld,claimSupply,DROP_INTERVAL} from '../src/games/kapsstrike/world';
import {createTraining,takeDamage} from '../src/games/kapsstrike/combat';import {MAPS} from '../src/games/kapsstrike/maps';import {COSMETICS,caseRewards,cleanLoadout} from '../src/games/kapsstrike/cosmetics';import {knifeTiming,GRAPHICS} from '../src/games/kapsstrike/presentation';import {KapsStrikeServerManager} from '../src/server/kapsstrikeServer';import {WEAPONS} from '../src/games/kapsstrike/config';
test('all kill-race maps contain real heal/shield crates; full, dead and duplicate claims never consume them',()=>{
 for(const map of Object.values(MAPS)){
  const s=createTraining(map.id),world=createWorld(map,13),hp=world.pickups.find(p=>p.consumable==='health')!,shield=world.pickups.find(p=>p.consumable==='armor')!;assert.ok(hp&&shield);
  s.player.movement.position={...hp.position};assert.equal(claimSupply(world,map,s.player,1),false);assert.equal(hp.opened,false);s.player.hp=40;assert.equal(claimSupply(world,map,s.player,2),true);assert.equal(s.player.hp,90);assert.equal(claimSupply(world,map,s.player,3),false);
  s.player.movement.position={...shield.position};s.player.hp=0;assert.equal(claimSupply(world,map,s.player,4),false);s.player.hp=90;s.player.armor=80;assert.ok(claimSupply(world,map,s.player,5));assert.equal(s.player.armor,100);
 }
});
test('each seeded airdrop grants exactly one of three weapons and cannot be claimed twice',()=>{
 const seen=new Set<string>();for(let seed=1;seed<=60;seed++){
 const state=createTraining('dust'),world=createWorld(MAPS.dust,seed);advanceWorld(world,MAPS.dust,DROP_INTERVAL);const drop=world.pickups.at(-1)!;assert.ok(['railgun','carbine','lmg'].includes(drop.weapon));assert.equal(drop.weapons,undefined);seen.add(drop.weapon);state.player.movement.position={...drop.position};assert.ok(claimSupply(world,MAPS.dust,state.player,DROP_INTERVAL));assert.deepEqual(state.player.weapon.inventory,[drop.weapon]);assert.equal(state.player.weapon.ammo[drop.weapon],WEAPONS[drop.weapon].capacity);assert.equal(claimSupply(world,MAPS.dust,state.player,DROP_INTERVAL+1),false);
 }assert.equal(seen.size,3);
});
test('training shield takes damage before HP and is finite',()=>{const s=createTraining('dust');s.player.protectedUntil=0;s.player.armor=50;takeDamage(s,30,{x:0,y:0,z:0});assert.equal(s.player.hp,100);assert.equal(s.player.armor,20);takeDamage(s,40,{x:0,y:0,z:0});assert.equal(s.player.hp,80);assert.equal(s.player.armor,0);});
test('server shields absorb damage, report confirmed shield hits, and reset on respawn',()=>{
 const solids=MAPS.dust.solids;MAPS.dust.solids=[];
 try{const emitted:any[]=[];const manager=new KapsStrikeServerManager({to:()=>({emit:(event:string,data:any)=>emitted.push({event,data})}),emit(){}} as any);const room=manager.createRoom({id:1,username:'a',avatar:null},'a',{mode:'ffa',map:'dust'});manager.joinRoom(room.roomCode,{id:2,username:'b',avatar:null},'b');manager.startGame('a');manager.stopRoomSimulationLoop(room);room.tick=1000;const [a,b]=[...room.players.values()];for(const [i,p] of [a,b].entries()){p.state.movement.position={x:0,y:0,z:i*5};p.state.protectedUntil=0;p.history=[];}a.state.pitch=Math.atan2(.62,5);b.state.armor=50;(manager as any).verifyAndExecuteShot(room,a,true,room.tick);assert.equal(b.state.hp,100);assert.ok(b.state.armor!<50);assert.ok(emitted.some(e=>e.event==='strike:shot_ack'&&e.data.damage>0));b.state.hp=0;b.state.deadUntil=room.tick;manager.tickSimulation(room);assert.equal(b.state.armor,0);
 }finally{MAPS.dust.solids=solids;}
});
test('knife draw is 25% slower with extended inspections, and all four shapes have unlockable skin variants without changing case rarity',()=>{
 for(const style of ['karambit','butterfly']){const t=knifeTiming(style);assert.equal(t.inspect,2.6);assert.ok(Math.abs(.18/t.deploy-.75)<1e-8);}
 for(const style of ['karambit','butterfly','tanto','default'])assert.ok(COSMETICS.filter(c=>c.weapon==='knife'&&c.knife===style).length>=4);
 assert.deepEqual(cleanLoadout({knife:'knife-karambit-2'}),{knife:'knife-karambit-2'});const rewards=caseRewards('arsenal');assert.ok(Math.abs(rewards.filter(r=>r.item.weapon==='knife').reduce((a,r)=>a+r.chance,0)-5)<1e-6);
 assert.equal(GRAPHICS.low.surface,0);assert.equal(GRAPHICS.low.shadow,0);assert.ok(GRAPHICS.low.pixelScale<1);assert.equal(GRAPHICS.high.shadow,2048);
});

test('Low/High profiles change real render work while preserving map physics and retain reusable High materials on return to Low',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine');const {StrikeRenderer}=await import('../src/games/kapsstrike/renderer');const {DEFAULT_SETTINGS}=await import('../src/games/kapsstrike/config');const engine=new NullEngine();const r=new StrikeRenderer({} as HTMLCanvasElement,MAPS.district,{...DEFAULT_SETTINGS,quality:'low'},engine);const solids=MAPS.district.solids.length;
 try{
  assert.equal(r.scene.shadowsEnabled,false);assert.equal((r as any).terrainMaterials.size,0);assert.ok(r.scene.meshes.filter(m=>m.metadata?.detail).every(m=>!m.isEnabled()));
  r.updateSettings({...DEFAULT_SETTINGS,quality:'high'});assert.ok((r as any).terrainMaterials.size>0);assert.equal((r as any).shadow.getShadowMap().getSize().width,2048);assert.equal(r.scene.shadowsEnabled,true);assert.ok(r.scene.meshes.some(m=>m.metadata?.detail&&m.isEnabled()));
  r.updateSettings({...DEFAULT_SETTINGS,quality:'low'});assert.ok((r as any).terrainMaterials.size>0);assert.equal((r as any).shadow,undefined);assert.equal(r.scene.shadowsEnabled,false);assert.equal(MAPS.district.solids.length,solids);
 }finally{r.dispose();}
});

test('actual renderer finishes fast inspect/deploy at 60 FPS and new skins keep their correct knife geometry',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine');const {StrikeRenderer}=await import('../src/games/kapsstrike/renderer');const {DEFAULT_SETTINGS}=await import('../src/games/kapsstrike/config');
 const engine=new NullEngine(),r=new StrikeRenderer({} as HTMLCanvasElement,MAPS.dust,{...DEFAULT_SETTINGS,quality:'low'},engine),state=createTraining('dust');state.player.weapon.selected='knife';
 try{for(const style of ['karambit','butterfly','tanto','default']){
  const item=COSMETICS.find(c=>c.id===`knife-${style}-1`)!;r.updateSettings({...DEFAULT_SETTINGS,quality:'low',cosmeticLoadout:{knife:item.id}});r.render(state,0,0,false,1,state.player.movement.position,1/60);assert.ok((r as any).knifeDeployTimer>0);
  for(let i=0;i<Math.ceil(knifeTiming(style).deploy*60)+2;i++)r.render(state,0,0,false,1,state.player.movement.position,1/60);assert.equal((r as any).knifeDeployTimer,0);r.inspect();const duration=(r as any).inspectTime;assert.ok(duration<=2.6);
  for(let i=0;i<170;i++)r.render(state,0,0,false,1,state.player.movement.position,1/60);assert.equal((r as any).inspectTime,0);
  const meshes=r.scene.getTransformNodeByName('knife')!.getChildMeshes();assert.ok(meshes.filter(m=>m.metadata?.knifeStyle===style&&m.metadata?.knifePart==='blade').every(m=>m.isEnabled()));assert.ok(meshes.filter(m=>m.metadata?.knifeStyle&&m.metadata.knifeStyle!==style).every(m=>!m.isEnabled()));
 }}finally{r.dispose();}
});


test('straight blade attacks interrupt deployment instead of blending two wrist motions',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine');const {StrikeRenderer}=await import('../src/games/kapsstrike/renderer');const {DEFAULT_SETTINGS}=await import('../src/games/kapsstrike/config');
 const r=new StrikeRenderer({} as HTMLCanvasElement,MAPS.warehouse,{...DEFAULT_SETTINGS,quality:'low'},new NullEngine()),state=createTraining('warehouse');state.player.weapon.selected='knife';
 try{for(const style of ['tanto','default']){r.updateSettings({...DEFAULT_SETTINGS,quality:'low',cosmeticLoadout:{knife:`knife-${style}-1`}});r.render(state,0,0,false,1,state.player.movement.position,1/60);(r as any).knifeDeployTimer=.4;(r as any).knifeAttackTimer=.28;r.render(state,0,0,false,1,state.player.movement.position,1/60);assert.equal((r as any).knifeDeployTimer,0);}}finally{r.dispose();}
});

test('auto-reload triggers automatically on empty magazine, High PBR materials freeze, and static shadow maps render once',async()=>{
 const {simulate,shouldAutoReload}=await import('../src/games/kapsstrike/combat');
 const {PHYSICS:C,DEFAULT_SETTINGS}=await import('../src/games/kapsstrike/config');
 const s=createTraining('dust');
 s.player.weapon.selected='rifle';
 s.player.weapon.ammo.rifle=1;
 s.player.weapon.nextFire=0;
 s.player.weapon.switchUntil=0;
 const cmd={sequence:1,tick:s.tick,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:true,ads:false,reload:false};
 simulate(s,cmd,true);
 assert.equal(s.player.weapon.ammo.rifle,0);
 assert.ok(s.player.weapon.reloadUntil>s.tick,'auto-reload must start immediately upon firing the last round');
 assert.equal(cmd.reload,true,'auto-reload sets cmd.reload for server synchronization');
 assert.ok(s.events.some(e=>e.kind==='reload'&&e.weapon==='rifle'));
 const reloadTicks=Math.ceil(WEAPONS.rifle.reload/C.dt)+2;
 for(let i=0;i<reloadTicks;i++){
  simulate(s,{sequence:i+2,tick:s.tick,moveX:0,moveZ:0,yaw:0,pitch:0,jump:false,sprint:false,crouch:false,fire:false,ads:false,reload:shouldAutoReload(s.player.weapon,s.tick)},true);
 }
 assert.equal(s.player.weapon.ammo.rifle,WEAPONS.rifle.capacity,'magazine refills after auto-reload completes');

 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine');
 const {StrikeRenderer}=await import('../src/games/kapsstrike/renderer');
 const {RenderTargetTexture}=await import('@babylonjs/core/Materials/Textures/renderTargetTexture');
 const r=new StrikeRenderer({} as HTMLCanvasElement,MAPS.district,{...DEFAULT_SETTINGS,quality:'high'},new NullEngine());
 try{
  const mpState=createTraining('district');mpState.targets=[];
  r.render(mpState,0,0,false,1,mpState.player.movement.position,1/60);
  assert.equal((r as any).shadow.getShadowMap().getSize().width,2048);
  assert.equal((r as any).shadow.getShadowMap().refreshRate,RenderTargetTexture.REFRESHRATE_RENDER_ONCE);
  assert.ok([...(r as any).terrainMaterials.values()].every((m:any)=>m.isFrozen));
 }finally{r.dispose();}
});

