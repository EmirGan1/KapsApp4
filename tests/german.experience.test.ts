import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { once } from 'node:events';
import { createClient } from '@libsql/client';
import { normalizeOverview } from '../src/components/german/overview';
import { taskHelpPolicy } from '../src/shared/germanTaskHelp';
import { registerGerman } from '../src/server/german';
import { BUILTIN_CURRICULUM } from '../src/server/german/curriculum';
import { buildActivities } from '../src/server/german/activities';
import { gradeAnswer } from '../src/server/german/cefr';
import { gradeOpenSentence } from '../src/server/german/sentenceGrading';
import { evaluateSatzbauDeterministic } from '../src/server/german/satzbau';
import { resetGermanAIStateForTests, setGermanAITransportForTests } from '../src/server/german/provider';

const vocab = BUILTIN_CURRICULUM.map(w => ({ ...w, canonicalKey: w.de.toLowerCase(), raw: `${w.de} — ${w.tr}`, cefrSource: 'builtin' as const }));

test('hints cannot disclose articles, missing forms, target translations or model sentences', () => {
  for (const type of ['article', 'gap', 'conjugation', 'ordering', 'spelling', 'missing', 'sentence_completion', 'satzbau']) {
    const task: any = { type, direction: 'de_only', prompt: '_____ Apfel', interaction: { audioText: 'der Apfel', wordMeta: { de: 'der Apfel' } } };
    assert.deepEqual(taskHelpPolicy(task, false), { wordPronunciation: false, audioText: undefined });
    assert.equal(taskHelpPolicy(task, true).audioText, 'der Apfel');
  }
  const translation: any = { type: 'sentence_translation', direction: 'tr_de', prompt: 'Almancaya çevir: Elma yiyorum.', passage: 'Bir cümle kur.', interaction: { audioText: 'Ich esse einen Apfel.' } };
  assert.equal(taskHelpPolicy(translation, false).audioText, undefined);
  const visibleSource: any = { type: 'choice', direction: 'de_tr', prompt: 'der Apfel ne demek?', interaction: { wordMeta: { de: 'der Apfel' } } };
  assert.equal(taskHelpPolicy(visibleSource, false).audioText, 'der Apfel');
  const own = buildActivities(vocab, 'satzbau', 'tr_de', { satzbauMode: 'create_own', limit: 10 });
  assert.ok(own.length > 0);
  for (const task of own) assert.ok(!task.hint?.includes(task.answer), 'Own-sentence hint cannot contain its model answer');
});

test('negation and arbitrary word overlap are not proof of a correct free sentence', () => {
  const task = { ...buildActivities(vocab, 'satzbau', 'tr_de', { satzbauMode: 'create_own', limit: 1 })[0],
    targetWordDe: 'der Apfel', answer: 'Ich kaufe einen Apfel.', alternatives: [] };
  for (const answer of ['Apfel kaufe bla', 'Ich kaufe keinen Apfel.']) {
    const mode = answer.startsWith('Ich') ? 'free_translation' as const : 'create_own' as const;
    assert.equal(gradeAnswer({ ...task, satzbauMode: mode, userAnswer: answer }), false);
    const preliminary = evaluateSatzbauDeterministic({ ...task, satzbauMode: mode }, answer);
    assert.equal(preliminary.isValid, false);
    assert.equal(preliminary.needsReview, true);
  }
});

test('real overview maps all CEFR categories to selectable unit IDs; creation progress is owner-scoped', async () => {
  const db = createClient({ url: ':memory:' });
  await db.execute('CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT)');
  await db.execute("INSERT INTO users VALUES(1,'learner'),(2,'other')");
  const app = express();
  registerGerman(app, db, async req => req.headers.authorization === 'Bearer learner' ? { id: 1 } : req.headers.authorization === 'Bearer other' ? { id: 2 } : null,
    (_q, _r, next) => next(), { autoSeedCurriculum: true });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/kaps-german`;
  const request = (path: string, body?: any, token = 'learner', id?: string) => fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(id ? { 'X-German-Preparation-Id': id } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  try {
    const overview = normalizeOverview(await (await request('/overview?compact=1')).json());
    let count = 0;
    for (const level of ['A1','A2','B1','B2','C1'] as const) {
      const categories = overview.curriculumHierarchy![level];
      assert.ok(categories.length > 0, level);
      for (const category of categories) {
        assert.ok(category.id && !category.id.startsWith(`${level}:`));
        assert.equal(category.totalUnits, category.units.length);
        assert.ok(category.accentColor.startsWith('#'));
        assert.equal(category.status, "not_started", "Recommended is not the same as already attempted");
        for (const unit of category.units) { count += unit.wordIds.length; assert.equal(unit.categoryId, category.id); }
      }
    }
    assert.equal(count, overview.overall.totalValidated);
    const packResponse = await request('/audio/pack?level=A1');
    assert.equal(packResponse.status, 200);
    assert.ok((await packResponse.json()).items.length > 0);
    // Both normalized and legacy responses remain usable across deployments.
    assert.deepEqual(normalizeOverview(overview), overview);
    await db.execute('INSERT INTO german_permissions VALUES(2,1)');
    const category = overview.curriculumHierarchy!.A1[0]; const unit = category.units[0];
    const progressId = crypto.randomUUID();
    const response = await request('/sessions', { module: 'vocabulary', mode: 'practice', activity: 'mixed', levels: ['A1'], direction: 'tr_de', categoryId: category.id, unitId: unit.id }, 'learner', progressId);
    assert.equal(response.status, 200, await response.clone().text());
    const { id } = await response.json();
    const saved = (await db.execute({ sql: 'SELECT tasks FROM german_sessions WHERE id=?', args: [id] })).rows[0];
    const tasks = JSON.parse(String(saved.tasks)); assert.ok(tasks.length > 0);
    for (const task of tasks) assert.ok(task.vocabularyIds.every((wid: string) => unit.wordIds.includes(wid)));
    let status: any;
    for (let attempt = 0; attempt < 20; attempt++) {
      status = await (await request(`/preparations/${progressId}`)).json();
      if (status.status === 'done') break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(status.percent, 100); assert.equal(status.status, 'done'); assert.ok(status.estimateMs > 0);
    assert.equal((await request(`/preparations/${progressId}`, undefined, 'other')).status, 404);
    const failedId = crypto.randomUUID();
    assert.equal((await request('/sessions', { activity: 'article', levels: [], direction: 'tr_de' }, 'learner', failedId)).status, 400);
    const failed = await (await request(`/preparations/${failedId}`)).json();
    assert.equal(failed.status, 'failed'); assert.equal(failed.percent, 0);
    const before = (await db.execute('SELECT count(*) AS n FROM german_sessions')).rows[0].n;
    assert.equal((await request('/sessions', {}, 'learner', progressId)).status, 409);
    assert.equal((await db.execute('SELECT count(*) AS n FROM german_sessions')).rows[0].n, before);

    resetGermanAIStateForTests();
    const free = { ...tasks[0], type: 'satzbau', satzbauMode: 'create_own', targetWordDe: 'der Apfel', answer: 'Ich kaufe einen Apfel.' };
    setGermanAITransportForTests(async () => { throw new Error('offline'); });
    const pending = await gradeOpenSentence(db, free, 'Ich esse heute einen Apfel.', 1);
    assert.equal(pending.pending, true); assert.equal(pending.score, null);
    setGermanAITransportForTests(async () => ({ text: JSON.stringify({ correct: true, confidence: 0.95, feedback: 'Doğru.', correctedSentence: 'Ich esse heute einen Apfel.' }) }));
    const evaluated = await gradeOpenSentence(db, free, 'Ich esse heute einen Apfel.', 1);
    assert.equal(evaluated.score, 1); assert.equal(evaluated.pending, false);
    // Real check endpoint: uncertainty preserves the answer without recording a failed attempt or granting mastery.
    await db.execute({ sql: 'UPDATE german_sessions SET tasks=? WHERE id=?', args: [JSON.stringify([{ ...free, id: tasks[0].id }]), id] });
    setGermanAITransportForTests(async () => { throw new Error('offline'); });
    const checkedPending = await (await request(`/sessions/${id}/check`, { taskId: tasks[0].id, answer: 'Ich esse morgen einen Apfel.' })).json();
    assert.equal(checkedPending.result.pending, true); assert.equal(checkedPending.result.score, null); assert.equal(checkedPending.xpAwarded, 0);
    assert.equal((await db.execute('SELECT count(*) AS n FROM german_attempts')).rows[0].n, 0);
    setGermanAITransportForTests(async () => ({ text: JSON.stringify({ correct: true, confidence: 0.95, feedback: 'Doğru.', correctedSentence: 'Ich esse morgen einen Apfel.' }) }));
    const checked = await (await request(`/sessions/${id}/check`, { taskId: tasks[0].id, answer: 'Ich esse morgen einen Apfel.' })).json();
    assert.equal(checked.result.score, 1); assert.ok(checked.xpAwarded > 0);
    const repeated = await (await request(`/sessions/${id}/check`, { taskId: tasks[0].id, answer: 'Ich esse morgen einen Apfel.' })).json();
    assert.equal(repeated.alreadyChecked, true); assert.equal(repeated.xpAwarded, 0);

    // A genuinely in-flight AI request exposes its stage, not a time-based fake percentage.
    let releaseAI!: (value: any) => void;
    const aiGate = new Promise<any>(resolve => { releaseAI = resolve; });
    setGermanAITransportForTests(async () => aiGate);
    const aiProgressId = crypto.randomUUID();
    const creating = request('/ai/reinforcement', { levels: ['A1'], direction: 'tr_de' }, 'learner', aiProgressId);
    let observed: any;
    try {
      for (let attempt = 0; attempt < 60; attempt++) {
        const response = await request(`/preparations/${aiProgressId}`);
        if (response.ok) observed = await response.json();
        if (observed?.stage === 'generating_ai') break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.equal(observed.stage, 'generating_ai'); assert.equal(observed.status, 'working'); assert.ok(observed.percent < 100); assert.ok(observed.remainingMs > 0);
    } finally { releaseAI({ text: JSON.stringify({ tasks: [] }) }); }
    const createdAI = await creating;
    assert.equal(createdAI.status, 200);

  } finally {
    resetGermanAIStateForTests(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); db.close();
  }
});
