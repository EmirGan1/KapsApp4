import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMobileShellHeight, usesIosStandaloneLayout } from '../src/utils/mobileViewport';

for (const [name, visibleHeight, innerHeight] of [
  ['short browser viewport', 568, 568],
  ['browser toolbar reduces visible area', 724, 844],
  ['standalone viewport', 810, 810],
  ['tall phone', 932, 932],
  ['landscape viewport', 390, 390],
] as const) {
  test(`${name} leaves fullscreen height to CSS`, () => {
    assert.deepEqual(resolveMobileShellHeight({
      visibleHeight, innerHeight, unobscuredHeight: innerHeight, editing: false
    }), { keyboardOpen: false, shellHeight: null });
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
  }), { keyboardOpen: false, shellHeight: null });
});

// These dimensions reproduce the stale iOS measurements that left the dock
// above the bottom of the display. Neither measurement may pin normal layout.
for (const editing of [false, true]) {
  test(`stale iOS viewport cannot shrink the shell (editing=${editing})`, () => {
    assert.deepEqual(resolveMobileShellHeight({
      visibleHeight: 756, innerHeight: 800, unobscuredHeight: 800, editing
    }), { keyboardOpen: false, shellHeight: null });
  });
}

for (const [name, input, expected] of [
  ['iPhone PWA', { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, standalone: true }, true],
  ['iPhone Safari', { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, standalone: false }, false],
  ['iPad desktop UA PWA', { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 5, standalone: true }, true],
  ['Android PWA', { userAgent: 'Android', platform: 'Linux', maxTouchPoints: 5, standalone: true }, false],
  ['Mac desktop PWA', { userAgent: 'Macintosh', platform: 'MacIntel', maxTouchPoints: 0, standalone: true }, false],
] as const) {
  test(`${name} selects the appropriate viewport layout`, () => {
    assert.equal(usesIosStandaloneLayout(input), expected);
  });
}
