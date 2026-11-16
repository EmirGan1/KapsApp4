import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessAiDetectorResult, type DetectorResult } from '../src/utils/aiDetectorAssessment';

const sample = (words: number, ai: number, segmentAi: number[], language: DetectorResult['language'] = 'not_identified', truncated = false): DetectorResult => ({
  words, scores: [1 - ai, ai], tokens: words * 2, segmentAi, language, truncated,
});

test('a short human-written sentence with a near-100% AI raw score is NOT declared AI', () => {
  const result = assessAiDetectorResult(sample(16, 0.999, [0.999]));
  assert.equal(result.kind, 'insufficient');
  assert.doesNotMatch(result.title, /AI benzeri/);
});

test('likely Turkish text has no AI verdict even with very high raw score', () => {
  const result = assessAiDetectorResult(sample(420, 0.999, [0.999, 0.998], 'likely_turkish'));
  assert.equal(result.kind, 'unsupported');
});

test('long text evaluated from samples is not treated as a verdict about the entire essay', () => {
  assert.equal(assessAiDetectorResult(sample(900, 0.999, [0.999, 0.999, 0.999], 'not_identified', true)).kind, 'partial');
});

test('disagreeing windows and non-extreme scores remain inconclusive', () => {
  assert.equal(assessAiDetectorResult(sample(300, 0.6, [0.99, 0.21])).kind, 'inconclusive');
});

test('even consistent very high AI scores are reported only as an unverified signal', () => {
  const assessment = assessAiDetectorResult(sample(300, 0.99, [0.99, 0.99]));
  assert.equal(assessment.kind, 'ai_signal');
  assert.match(assessment.detail, /kanıtlamaz/);
});

test('older results without independent windows are not relabeled', () => {
  const assessment = assessAiDetectorResult({ scores: [0.01, 0.99], tokens: 12, truncated: false });
  assert.equal(assessment.kind, 'legacy');
});
