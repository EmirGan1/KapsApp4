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
