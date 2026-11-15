import assert from 'node:assert/strict';
import test from 'node:test';
import { isChatKeyboardOpen } from '../src/utils/chatViewport';

test('standalone iPhone keyboard works when innerHeight shrinks along with visualViewport', () => {
  assert.equal(isChatKeyboardOpen(true, 1, true, 0), true);
});
test('standard visual viewport keyboard detection remains available', () => {
  assert.equal(isChatKeyboardOpen(true, 1, false, 330), true);
});
test('chat keyboard closes after focus moves elsewhere', () => {
  assert.equal(isChatKeyboardOpen(false, 1, true, 330), false);
});
test('pinch zoom is not treated as a keyboard', () => {
  assert.equal(isChatKeyboardOpen(true, 2, true, 330), false);
});
