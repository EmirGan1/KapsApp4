import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanBindings, DEFAULT_BINDINGS, conflicts, held, validBinding} from '../src/games/kapsstrike/controls';
import {touchAimDelta} from '../src/games/kapsstrike/aimAssist';
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
