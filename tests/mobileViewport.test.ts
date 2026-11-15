import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMobileShellHeight } from '../src/utils/mobileViewport';

test('iPhone standalone dock reaches the screen edge below a shorter CSS viewport', () => {
  assert.deepEqual(resolveMobileShellHeight({
    visibleHeight: 800, innerHeight: 800, screenHeight: 844,
    unobscuredHeight: 800, editing: false, iosStandalone: true
  }), { keyboardOpen: false, shellHeight: 844 });
});

test('browser tab and regular viewport keep their actual height', () => {
  assert.equal(resolveMobileShellHeight({
    visibleHeight: 800, innerHeight: 800, screenHeight: 844,
    unobscuredHeight: 800, editing: false, iosStandalone: false
  }).shellHeight, 800);
});

test('keyboard takes precedence even when innerHeight also shrinks', () => {
  assert.deepEqual(resolveMobileShellHeight({
    visibleHeight: 470, innerHeight: 470, screenHeight: 844,
    unobscuredHeight: 800, editing: true, iosStandalone: true
  }), { keyboardOpen: true, shellHeight: 470 });
});

test('rejects implausible screen heights', () => {
  assert.equal(resolveMobileShellHeight({
    visibleHeight: 800, innerHeight: 800, screenHeight: 1000,
    unobscuredHeight: 800, editing: false, iosStandalone: true
  }).shellHeight, 800);
});
