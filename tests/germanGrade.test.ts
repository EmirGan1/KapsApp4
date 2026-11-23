import test from 'node:test';
import assert from 'node:assert/strict';
import { ibToGermanGrade } from '../src/utils/germanGrade';

test('KMK IB conversion table, including truncation and the 42–45 cap', () => {
  const expected = [4, 3.8, 3.6, 3.5, 3.3, 3.1, 3, 2.8, 2.6, 2.5, 2.3, 2.1, 2, 1.8, 1.6, 1.5, 1.3, 1.1, 1, 1, 1, 1];
  expected.forEach((grade, index) => assert.equal(ibToGermanGrade(index + 24), grade));
});

test('rejects out-of-range, fractional and non-finite scores', () => {
  for (const score of [0, 23, 46, 35.5, NaN, Infinity, -Infinity]) {
    assert.equal(ibToGermanGrade(score), null);
  }
});
