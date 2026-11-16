import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiCheckerError, createAiChecker } from '../src/server/aiChecker';
import { DESKLIB_MODEL, DESKLIB_REVISION } from '../src/utils/aiDetectorAssessment';

const fixture = {
  model: DESKLIB_MODEL, revision: DESKLIB_REVISION, words: 4, tokens: 0,
  scores: null, segmentAi: [], language: 'english', truncated: false,
};

test('private jobs are account-scoped, single-flight and recoverable without storing text in results', async () => {
  let next = () => {};
  let started = 0;
  const checker = createAiChecker({
    request: async () => {
      started++;
      await new Promise<void>(resolve => { next = resolve; });
      return { status: 200, data: fixture };
    },
  });
  const secret = 'A private essay';
  try {
    const first = checker.start('a', secret);
    const second = checker.start('b', 'Second job');
    assert.equal(started, 1);
    assert.equal(checker.status('a', first)?.status, 'processing');
    assert.equal(checker.status('b', second)?.status, 'queued');
    assert.equal(checker.status('b', first), null);
    assert.equal(checker.latest('a').current?.id, first);
    assert.throws(() => checker.start('a', secret), { status: 409 });
    await assert.rejects(checker.analyze('a', secret), { status: 409 });
    next();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(started, 2);
    assert.equal(checker.latest('a').lastResult?.status, 'done');
    assert.ok(!JSON.stringify(checker.latest('a')).includes(secret));
    assert.equal(checker.latest('b').lastResult, null);
    next();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(checker.status('b', second)?.status, 'done');
  } finally { checker.stop(); }
});

test('bad model payloads fail safely and both submission styles share rate limiting', async () => {
  const checker = createAiChecker({ request: async () => ({ status: 200, data: { scores: [0, 1] } }) });
  try {
    for (let i = 0; i < 4; i++) {
      await assert.rejects(checker.analyze('a', 'private'), { status: 503 });
    }
    await assert.rejects(checker.analyze('a', 'private'), { status: 429 });
    assert.throws(() => checker.start('a', 'private'), { status: 429 });
    await assert.rejects(checker.analyze('b', 'private'), { status: 503 });
  } finally { checker.stop(); }
});

test('real Desklib integration returns stable scores and skips Turkish and short texts', {
  skip: process.env.DESKLIB_LIVE_TEST !== '1' && 'Start the local Python service and enable DESKLIB_LIVE_TEST',
}, async () => {
  const checker = createAiChecker();
  try {
    assert.equal(await checker.health(), true);
    const [short, turkish] = await Promise.all([
      checker.analyze('short', 'I wrote this sentence myself.'),
      checker.analyze('turkish', 'Hafta sonu arkadaşlarımla buluşmak için erkenden evden çıktım.'),
    ]);
    assert.equal(short.words, 5);
    assert.equal(short.scores, null);
    assert.equal(turkish.language, 'turkish');
    assert.equal(turkish.scores, null);
    const essay = 'The rain was still coming down when we reached the door. I put the keys in my pocket and wondered whether the lights were still on upstairs. '.repeat(36);
    const first = await checker.analyze('a', essay);
    const second = await checker.analyze('a', essay);
    assert.ok(first.scores && first.segmentAi.length > 1);
    assert.deepEqual(first, second);
  } catch (error) {
    if (error instanceof AiCheckerError) assert.fail(error.message);
    throw error;
  } finally { checker.stop(); }
});
