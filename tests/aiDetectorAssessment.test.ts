import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessAiDetectorResult, DESKLIB_MODEL, DESKLIB_REVISION, TURKISH_MODEL, TURKISH_REVISION, parseDetectorResult, type DetectorResult } from '../src/utils/aiDetectorAssessment';

const sample: DetectorResult = {
  model: DESKLIB_MODEL, revision: DESKLIB_REVISION, words: 260, tokens: 340, truncated: false,
  scores: [0.05, 0.95], segmentAi: [0.94, 0.96], language: 'english',
};

test('short English, Turkish and unidentified text do not receive model scores', () => {
  const blank = { ...sample, scores: null, segmentAi: [], tokens: 0 };
  for (const [input, kind] of [
    [{ ...blank, words: 16 }, 'insufficient'],
    [{ ...blank, language: 'turkish' }, 'unsupported'],
    [{ ...blank, language: 'unsupported' }, 'unsupported'],
    [{ ...blank, truncated: true }, 'partial'],
  ] as const) {
    const result = parseDetectorResult(input);
    assert.ok(result);
    assert.equal(assessAiDetectorResult(result).kind, kind);
  }
  assert.equal(parseDetectorResult({ ...sample, language: 'turkish' }), null);
});

test('disagreeing windows are inconclusive even when the aggregate is high', () => {
  assert.equal(assessAiDetectorResult({ ...sample, segmentAi: [0.99, 0.21] }).kind, 'inconclusive');
});

test('model polarity and exact threshold describe signals without asserting authorship', () => {
  assert.equal(assessAiDetectorResult(sample).kind, 'ai_signal');
  assert.equal(assessAiDetectorResult({ ...sample, segmentAi: [0.49] }).kind, 'human_signal');
  assert.equal(assessAiDetectorResult({ ...sample, segmentAi: [0.5] }).kind, 'ai_signal');
  assert.match(assessAiDetectorResult(sample).detail, /kanıtlamaz/);
});

test('results from the old detector, wrong revisions and invalid scores are rejected', () => {
  for (const input of [
    { scores: [0.01, 0.99], tokens: 12, truncated: false },
    { ...sample, revision: 'wrong' },
    { ...sample, scores: [NaN, 0.95] },
    { ...sample, scores: [0.15, 0.95] },
    { ...sample, segmentAi: [] },
  ]) assert.equal(parseDetectorResult(input), null);
});


test('withdrawn Turkish checkpoint cannot report an AI or human verdict even from cached scores', () => {
  const tr: DetectorResult = { ...sample, model: TURKISH_MODEL, revision: TURKISH_REVISION, language: 'turkish', words: 100 };
  for (const score of [0, 0.02, 0.48, 0.95, 0.997, 1]) {
    const payload = { ...tr, scores: [1 - score, score], segmentAi: [score] };
    const parsed = parseDetectorResult(payload);
    assert.ok(parsed);
    assert.equal(assessAiDetectorResult(parsed).kind, 'unvalidated');
  }
  const unscored = { ...tr, tokens: 0, scores: null, segmentAi: [] };
  const parsed = parseDetectorResult(unscored);
  assert.ok(parsed);
  assert.equal(assessAiDetectorResult(parsed).kind, 'unvalidated');
  assert.equal(parseDetectorResult({ ...unscored, tokens: 1 }), null);
  assert.equal(parseDetectorResult({ ...tr, language: 'english' }), null);
  assert.equal(parseDetectorResult({ ...tr, revision: DESKLIB_REVISION }), null);
  const short = { ...unscored, words: 59 };
  assert.ok(parseDetectorResult(short));
  assert.equal(assessAiDetectorResult(short).kind, 'insufficient');
});
