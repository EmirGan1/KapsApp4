import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildActivities } from '../src/server/german/activities';
import { activities, validStudyFilters } from '../src/shared/germanActivities';
import { parseDocument } from '../src/server/german/learning';
const words = parseDocument({ body: { content: ['der Apfel — elma / elma meyvesi', 'die Schule — okul', 'das Haus — ev', 'Ich freue mich darauf. — Bunu sabırsızlıkla bekliyorum.', 'obwohl — rağmen'].map(content => ({paragraph:{elements:[{textRun:{content}}]}})) }}).entries;
test('all activity types are built from imported vocabulary with stable source IDs', () => {
 const tasks = buildActivities(words);
 assert.equal(new Set(tasks.map(t => t.type)).size, activities.length);
 assert.equal(new Set(tasks.map(t => t.id)).size, tasks.length);
 for (const task of tasks) { assert.ok(task.vocabularyIds.every(id => words.some(w => w.id === id))); assert.ok(task.answer); }
 assert.equal(new Set(tasks.slice(0,10).map(t => t.type)).size,10);
});
test('options, matching, and tiles carry internally consistent answers', () => {
 for (const task of buildActivities(words)) {
   if (task.options.length && task.type !== 'multi') assert.ok(task.options.includes(task.answer));
   if (task.type === 'multi') assert.ok(task.answer.split(' | ').every(a => task.options.includes(a)));
   if (task.interaction?.tiles) assert.deepEqual([...task.interaction.tiles].sort(), (task.type === 'spelling' ? Array.from(task.answer) : task.answer.split(' ')).sort());
   if (task.type === 'matching') assert.deepEqual([...JSON.parse(task.answer)].sort(), [...task.interaction!.right!].sort());
 }
});
test('filters and insufficient sources never fabricate material', () => {
 for (const [id] of activities) assert.ok(buildActivities(words,id).every(t => t.type === id));
 assert.deepEqual(buildActivities([]), []);
 assert.deepEqual(buildActivities([words[0]], 'matching'), []);
 assert.deepEqual(buildActivities([words[4]], 'article'), []);
 assert.deepEqual(buildActivities([words[4]], 'ordering'), []);
});

test('language direction changes prompts and correct answers without changing source identities', () => {
  for (const direction of ['de_tr', 'tr_de'] as const) {
    for (const task of buildActivities(words, 'translation', direction)) {
      const source = words.find(w => w.id === task.vocabularyIds[0])!;
      assert.equal(task.answer, direction === 'de_tr' ? source.tr : source.de);
      assert.ok(task.prompt.includes(direction === 'de_tr' ? source.de : source.tr));
    }
  }
});
test('sentence methods use only complete imported sentences and preserve their word order', () => {
  const tasks = buildActivities(words).filter(t => t.type.startsWith('sentence_'));
  assert.equal(new Set(tasks.map(t => t.type)).size, 3);
  for (const task of tasks) {
    const source = words.find(w => w.id === task.vocabularyIds[0])!;
    assert.ok(/[.!?]$/u.test(source.de));
    if (task.type === 'sentence_gap') assert.ok(source.de.includes(task.answer));
    if (task.type === 'sentence_ordering') assert.equal(task.answer, source.de);
  }
});

test('multi-level selection rejects empty or invalid client settings', () => {
  assert.ok(validStudyFilters('mixed', ['A2', 'B1']));
  assert.equal(validStudyFilters('de_tr', []), false);
  assert.equal(validStudyFilters('de_tr', ['C9']), false);
  assert.equal(validStudyFilters('xx', ['B1']), false);
});
