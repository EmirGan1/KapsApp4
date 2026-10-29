import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanBindings, DEFAULT_BINDINGS, conflicts, held, validBinding} from '../src/games/kapsstrike/controls';
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
