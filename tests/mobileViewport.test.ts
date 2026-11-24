import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMobileShellHeight } from '../src/utils/mobileViewport';

for (const [name, visibleHeight, innerHeight] of [
  ['short browser viewport', 568, 568],
  ['browser toolbar reduces visible area', 724, 844],
  ['standalone viewport', 810, 810],
  ['tall phone', 932, 932],
  ['landscape viewport', 390, 390],
] as const) {
  test(`${name} uses available viewport bounds`, () => {
    assert.deepEqual(resolveMobileShellHeight({
      visibleHeight, innerHeight, unobscuredHeight: innerHeight, editing: false
    }), { keyboardOpen: false, shellHeight: Math.min(visibleHeight, innerHeight) });
  });
}

test('keyboard takes precedence even when innerHeight also shrinks', () => {
  assert.deepEqual(resolveMobileShellHeight({
    visibleHeight: 470, innerHeight: 470,
    unobscuredHeight: 800, editing: true
  }), { keyboardOpen: true, shellHeight: 470 });
});

test('focused input without keyboard does not hide the dock', () => {
  assert.deepEqual(resolveMobileShellHeight({
    visibleHeight: 800, innerHeight: 800, unobscuredHeight: 800, editing: true
  }), { keyboardOpen: false, shellHeight: 800 });
});
