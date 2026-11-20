import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildActivities } from '../src/server/german/activities';
import { activities } from '../src/shared/germanActivities';
import { parseDocument } from '../src/server/german/learning';
const words = parseDocument({ body: { content: ['der Apfel — elma / elma meyvesi', 'die Schule — okul', 'das Haus — ev', 'Ich freue mich darauf. — Bunu sabırsızlıkla bekliyorum.', 'obwohl — rağmen'].map(content => ({paragraph:{elements:[{textRun:{content}}]}})) }}).entries;
test('all ten activities are built from imported vocabulary with stable source IDs', () => {
 const tasks = buildActivities(words);
 assert.equal(new Set(tasks.map(t => t.type)).size, 10);
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
