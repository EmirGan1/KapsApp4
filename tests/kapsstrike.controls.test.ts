import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanBindings, DEFAULT_BINDINGS, conflicts, held, validBinding} from '../src/games/kapsstrike/controls';
import {touchAimDelta, TouchCombatAssist, type TouchCombatTarget} from '../src/games/kapsstrike/aimAssist';
import {StrikeController} from '../src/games/kapsstrike/controller';
import {MAPS} from '../src/games/kapsstrike/maps';

test('bindings validate physical codes and preserve safe defaults',()=>{
 assert.equal(cleanBindings({forward:'KeyI',jump:'__proto__'}).forward,'KeyI');
 assert.equal(cleanBindings({jump:'bogus'}).jump,'Space');
 assert.ok(validBinding('Ctrl+Shift+Mouse2'));
 assert.ok(validBinding('WheelUp'));
 assert.ok(validBinding('Unbound'));
 assert.equal(validBinding('Ctrl+Ctrl+KeyA'),false);
});
test('modifier bindings require modifiers and collision reports overlapping physical keys',()=>{
 assert.equal(held('Ctrl+KeyF',new Set(['KeyF'])),false);
 assert.equal(held('Ctrl+KeyF',new Set(['KeyF','ControlRight'])),true);
 assert.deepEqual(conflicts(DEFAULT_BINDINGS,'jump','Shift+KeyW'),['forward']);
 assert.deepEqual(conflicts(DEFAULT_BINDINGS,'jump','KeyI'),[]);
});
test('legacy main-branch custom keys migrate without replacing the five default firearm slots',()=>{
 const old={forward:'KeyI',primary:'Digit1',secondary:'Digit2',knife:'Digit3',jump:'KeyF'};
 const migrated=cleanBindings(undefined,old);
 assert.equal(migrated.forward,'KeyI');assert.equal(migrated.jump,'KeyF');
 assert.equal(migrated.sniper,'Digit3');assert.equal(migrated.knife,'Digit6');assert.equal(migrated.pistol,'Digit5');
 assert.equal(cleanBindings({forward:'KeyL'},old).forward,'KeyL');
});

const eye = {x:0,y:1.62,z:0};
const target = {position:{x:.4,y:.57,z:10},hp:100};
const swipe = {yaw:.012,pitch:0};
const openMap = {...MAPS.dust,solids:[]};
const assist = (targets: Parameters<typeof touchAimDelta>[4], delta = swipe, aiming = false, map: typeof MAPS.dust = openMap) =>
  touchAimDelta(eye, 0, 0, delta, targets, map, aiming);

test('touch aim reinforces small input toward a visible target without adding a second axis',()=>{
  const hip = assist([target]);
  const ads = assist([target],swipe,true);
  assert.ok(hip.yaw > swipe.yaw && hip.yaw < swipe.yaw * 1.12);
  assert.ok(ads.yaw > hip.yaw && ads.yaw < swipe.yaw * 1.16);
  assert.equal(hip.pitch,0);
  const smallOvershoot = {yaw:.015,pitch:0};
  const closeTarget = {...target,position:{...target.position,x:.1}};
  assert.ok(assist([closeTarget],smallOvershoot).yaw < smallOvershoot.yaw);
  const away = {yaw:-swipe.yaw,pitch:0};
  assert.deepEqual(assist([target],away),away);
});

test('touch aim ignores walls, allies, dead enemies, wide angles, fast flicks and zero input',()=>{
  const wall: typeof MAPS.dust = {...openMap,solids:[{id:'wall',kind:'box',x:0,y:0,z:5,w:5,h:3,d:1,color:'#fff'}]};
  assert.deepEqual(assist([target],swipe,false,wall),swipe);
  for (const ignored of [{...target,friendly:true},{...target,hp:0},{...target,position:{...target.position,z:50}},{...target,position:{...target.position,x:5}}]) {
    assert.deepEqual(assist([ignored]),swipe);
  }
  for (const delta of [{yaw:.12,pitch:0},{yaw:0,pitch:0}]) assert.deepEqual(assist([target],delta),delta);
  const crouched = {...target,crouched:true,position:{...target.position,y:.97,z:3,x:.12}};
  assert.ok(assist([crouched]).yaw > swipe.yaw);
  assert.deepEqual(assist([{...crouched,crouched:false}]),swipe);
});

test('real controller touch look only assists active touch firearm input with the setting on',()=>{
  const run = ({enabled=true, mode='touch', active=true, menu=false, hp=100, selected='pistol'}={}) => {
    const movement = {position:{x:0,y:0,z:0},stance:'stand'};
    const controller = {
      active,menuOverlay:menu,isTouchDevice:mode==='touch',isMultiplayer:false,yaw:0,pitch:0,
      settings:{mobileSensitivity:1,touchAimAssist:enabled},
      state:{player:{hp,weapon:{selected},movement},targets:[target],map:'dust'},
    };
    const original = MAPS.dust;
    MAPS.dust = openMap;
    try { StrikeController.prototype.addTouchLook.call(controller,4,0); }
    finally { MAPS.dust = original; }
    return controller.yaw;
  };
  assert.ok(run() > swipe.yaw);
  for (const options of [{enabled:false},{hp:0},{selected:'knife'}]) assert.equal(run(options),swipe.yaw);
  for (const options of [{mode:'mouse'},{active:false},{menu:true}]) assert.equal(run(options),0);
});

const centeredEnemy: TouchCombatTarget = {id:'enemy',position:{x:0,y:0,z:10},hp:100};
const torsoEye = {x:0,y:1.15,z:0};
const wallMap: typeof MAPS.dust = {
  ...openMap,solids:[{id:'wall',kind:'box',x:0,y:0,z:5,w:5,h:3,d:1,color:'#fff'}],
};
const dt = 1/60;

test('automatic fire waits for continuous crosshair contact and resets on target change or lost sight',()=>{
  const system = new TouchCombatAssist();
  const tick = (targets = [centeredEnemy], map = openMap as typeof MAPS.dust, yaw = 0) =>
    system.step(torsoEye,yaw,0,targets,map,35,false,true,dt).fire;
  for (let i = 0; i < 7; i++) assert.equal(tick(),false);
  assert.equal(tick(),true);
  assert.equal(tick(),true);
  assert.equal(tick([centeredEnemy],openMap,.1),false);
  assert.equal(tick(),false);
  for (let i = 0; i < 8; i++) tick();
  assert.equal(tick([{...centeredEnemy,id:'other'}]),false);
  assert.equal(tick([centeredEnemy],wallMap),false);
});

test('automatic fire rejects teammates, spawn protection, dead and out of range targets',()=>{
  const system = new TouchCombatAssist();
  const friend = {...centeredEnemy,id:'friend',friendly:true,position:{x:0,y:0,z:5}};
  const protectedEnemy = {...friend,friendly:false,protected:true};
  const tooFar = {...centeredEnemy,position:{x:0,y:0,z:40}};
  for (const targets of [[friend,centeredEnemy],[protectedEnemy,centeredEnemy],[tooFar],[{...centeredEnemy,hp:0}]]) {
    for (let i = 0; i < 12; i++) assert.equal(system.step(torsoEye,0,0,targets,openMap,35,true,true,dt).fire,false);
  }
});

test('tracking follows already acquired target motion gently without snapping or requiring auto fire',()=>{
  const system = new TouchCombatAssist();
  const shifted = {...centeredEnemy,position:{x:.1,y:0,z:10}};
  const tick = (target: TouchCombatTarget, map: typeof MAPS.dust = openMap) =>
    system.step(torsoEye,0,0,[target],map,35,true,false,dt);
  assert.equal(tick(centeredEnemy).yaw,0);
  const followed = tick(shifted);
  assert.ok(followed.yaw > 0 && followed.yaw <= .24 * dt);
  assert.equal(followed.fire,false);
  assert.equal(tick(centeredEnemy,wallMap).yaw,0);
  assert.equal(tick(shifted).yaw,0);
  assert.equal(tick({...centeredEnemy,position:{x:5,y:0,z:10}}).yaw,0);
});

test('mobile auto fire emits repeatable semi-auto presses through normal weapon cooldown',()=>{
  const weapon = {selected:'pistol',triggerHeld:false,reloadUntil:0,nextFire:0,switchUntil:0,ammo:{pistol:10}};
  const state = {map:'dust',tick:0,player:{hp:100,weapon,movement:{position:{x:0,y:0,z:0},stance:'stand'}},
    targets:[{...centeredEnemy,position:{x:0,y:.1,z:10}}]};
  const controller = {state,yaw:0,pitch:0,isTouchDevice:true,settings:{touchAimAssist:false,touchAutoFire:true},
    isMultiplayer:false,touchCombat:new TouchCombatAssist()};
  const update = (StrikeController.prototype as any).updateTouchCombat.bind(controller);
  const original = MAPS.dust;
  MAPS.dust = openMap;
  try {
    let presses = 0;
    for (; state.tick < 60; state.tick++) {
      const fire = update(0);
      if (fire) {
        assert.equal(weapon.triggerHeld,false);
        assert.ok(state.tick >= weapon.nextFire);
        weapon.nextFire = state.tick + 12;
        presses++;
      }
      weapon.triggerHeld = fire;
    }
    assert.ok(presses >= 3);
    controller.settings.touchAutoFire = false;
    assert.equal(update(0),false);
    controller.settings.touchAutoFire = true;
    controller.isTouchDevice = false;
    assert.equal(update(0),false);
  } finally { MAPS.dust = original; }
});

test('weapon wheel includes owned grenades in both directions and keeps the underlying firearm',()=>{
 const controller=Object.create(StrikeController.prototype);
 const utility={flash:1,smoke:1};
 Object.assign(controller,{active:true,bindings:DEFAULT_BINDINGS,keys:new Set<string>(),
  socket:{id:'p',emit(){}},pushHUD(){},settings:{},
  state:{player:{hp:100,weapon:{selected:'knife'}},bomb:{phase:'active',players:{p:{weapons:['pistol','knife'],utility}}}}});
 const wheel=(key:string)=>{
  controller.keys=new Set([key]);
  controller.handleActions(false);
 };
 wheel('WheelDown');
 assert.equal(controller.utilityEquipped,'flash');
 wheel('WheelDown');
 assert.equal(controller.utilityEquipped,'smoke');
 wheel('WheelUp');
 assert.equal(controller.utilityEquipped,'flash');
 wheel('WheelUp');
 assert.equal(controller.utilityEquipped,undefined);
 assert.equal(controller.state.player.weapon.selected,'knife');
});
