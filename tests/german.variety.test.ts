import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { createClient } from '@libsql/client';
import { buildActivities } from '../src/server/german/activities';
import { BUILTIN_CURRICULUM } from '../src/server/german/curriculum';
import { registerGerman } from '../src/server/german';
import { freshPractice } from '../src/server/german/freshPractice';
import { questionKey, preferNovelQuestions, recentQuestionHistory } from '../src/server/german/questionHistory';
import { completeWordMeanings, questionWords } from '../src/server/german/glossary';
import { resetGermanAIStateForTests, setGermanAITransportForTests } from '../src/server/german/provider';
import { explainAttemptWithAI } from '../src/server/german/aiFeatures';
import type { Task } from '../src/server/german/learning';

const words = BUILTIN_CURRICULUM.map(w => ({ ...w, canonicalKey: w.de.toLowerCase(), raw: w.de, cefrSource: 'builtin' as const }));
const a1 = words.filter(w => w.level === 'A1');
const empty = () => ({ counts: new Map<string, number>(), wordCounts: new Map<string, number>(), prompts: [] as string[] });

test('content history ignores UUIDs and option shuffles but distinguishes matching sets and tiles', () => {
  const task = buildActivities(a1, 'choice', 'de_tr', { limit: 1 })[0];
  const clone = { ...task, id: 'different', fingerprint: 'different', options: [...task.options].reverse(), prompt: task.prompt + '  !!', interaction: { ...task.interaction, audioText: 'private model' } };
  assert.equal(questionKey(task), questionKey(clone));
  const history = empty(); history.counts.set(questionKey(task), 2);
  const novel = { ...task, id: 'novel', prompt: 'Yeni bir bağlam sorusu' };
  assert.deepEqual(preferNovelQuestions([task, clone, novel], history).map(t => t.id), [novel.id, task.id]);
  assert.notEqual(questionKey({ ...task, type: 'matching', interaction: { left: ['Haus'], right: ['ev'] } }), questionKey({ ...task, type: 'matching', interaction: { left: ['Apfel'], right: ['elma'] } }));
  const all = buildActivities(a1, 'article', 'tr_de', { limit: 100 });
  const recent = new Set(all.slice(0, 5).map(questionKey));
  const rotated = buildActivities(a1, 'article', 'tr_de', { limit: 5, recentQuestionKeys: recent, wordExposureCounts: new Map(all.slice(0,5).map(t => [t.vocabularyIds[0], 10])) });
  assert.ok(rotated.every(t => !recent.has(questionKey(t))));
});

test('question rotation uses fresh content at every CEFR level', () => {
  for (const level of ['A1','A2','B1','B2','C1']) {
    const pool = words.filter(w => w.level === level);
    const first = buildActivities(pool, 'choice', 'de_tr', { limit: 8 });
    const recent = new Set(first.map(questionKey));
    const second = buildActivities(pool, 'choice', 'de_tr', { limit: 8, recentQuestionKeys: recent, wordExposureCounts: new Map(first.map(t => [t.vocabularyIds[0], 8])) });
    assert.equal(second.length, 8, level);
    assert.ok(second.every(t => !recent.has(questionKey(t))), level);
  }
});

test('glossary blocks translation answers, unlocks after checking and preserves contextual repeated words', () => {
  const t = buildActivities(a1, 'sentence_translation', 'de_tr', { limit: 1 })[0];
  assert.ok(questionWords(t, words, false).every(w => w.locked && w.meaningTr === null));
  assert.ok(questionWords(t, words, true).every(w => !w.locked));
  const gap = { ...t, type: 'gap', direction: 'de_only' as const, sentenceDe: undefined, prompt: 'Ich kaufe einen _____.', answer: 'Apfel', alternatives: [], interaction: { wordMeta: { de: 'der Apfel', tr: 'elma' } } };
  const before = questionWords(gap, words, false);
  assert.ok(before.some(w => w.token === 'Ich' && !w.locked));
  assert.ok(!before.some(w => w.token === 'Apfel'), 'Hidden answer tokens must not even be transmitted');
  const meanings = completeWordMeanings('Sie sieht sie.', [{token:'Sie',meaningTr:'O'},{token:'sieht',meaningTr:'görüyor'},{token:'sie',meaningTr:'onu'}], words);
  assert.deepEqual(meanings.map(w => w.meaningTr), ['O','görüyor','onu']);
  assert.equal(completeWordMeanings('ErfundeneWortform', [], words)[0].meaningTr, null);
});

test('fresh AI contexts require structural and independent semantic approval; history rejects repeats and offline falls back', async () => {
  const db = createClient({ url: ':memory:' });
  const app = express(); registerGerman(app, db, async () => ({ id:1 }), (_q,_r,n)=>n());
  // Ensure lazy initialization has run before direct service use.
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/kaps-german/overview`);
    resetGermanAIStateForTests();
    const template = { ...buildActivities(a1,'gap','tr_de',{limit:1})[0], prompt:'Ich kaufe einen _____.', passage:'Bir elma satın alıyorum.', answer:'Apfel', vocabularyIds:[a1.find(w=>w.de==='der Apfel')!.id] };
    let reviews=0; let approve=true;
    setGermanAITransportForTests(async req => {
      const data = JSON.parse(req.messages[1].content);
      if (data.templates) return { text: JSON.stringify({items:[{templateId:template.id,prompt:'Heute kaufe ich einen _____.',passage:'Bugün bir elma satın alıyorum.',answer:'Apfel',alternatives:[],options:[],explanation:'Apfel isimdir.',sentenceDe:'Heute kaufe ich einen Apfel.',sentenceTr:'Bugün bir elma satın alıyorum.'}]}) };
      reviews++; return { text: JSON.stringify({approvedIds:approve ? data.tasks.map((t:Task)=>t.id) : []}) };
    });
    const generated = await freshPractice(db,{userId:1,templates:[template],words:a1,history:empty()});
    assert.equal(generated.length,1); assert.equal(reviews,1); assert.equal(generated[0].level,template.level);
    assert.deepEqual(generated[0].vocabularyIds,template.vocabularyIds);
    const history=empty(); history.counts.set(questionKey(generated[0]),1);
    assert.equal((await freshPractice(db,{userId:1,templates:[template],words:a1,history})).length,0);
    approve=false;
    assert.deepEqual(await freshPractice(db,{userId:1,templates:[template],words:a1,history:empty()}),[], 'A semantic rejection must never enter a session');
    setGermanAITransportForTests(async () => { throw new Error('offline'); });
    assert.deepEqual(await freshPractice(db,{userId:1,templates:[template],words:a1,history:empty()}),[]);
    const fallback=await explainAttemptWithAI(db,{userId:1,task:generated[0],studentAnswer:'Haus',isCorrect:false,words:a1});
    assert.equal(fallback.correctedSentenceDe,'Heute kaufe ich einen Apfel.');
    assert.equal(fallback.correctedSentenceTr,'Bugün bir elma satın alıyorum.');
    assert.deepEqual(fallback.wordBreakdown.map(w=>w.token),['Heute','kaufe','ich','einen','Apfel']);
  } finally { resetGermanAIStateForTests(); server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r()));db.close(); }
});

test('session word-help and explanations enforce owner, checked result, exam guard and stored answers; resume preserves questions', async () => {
 const db=createClient({url:':memory:'}); await db.execute('CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT)'); await db.execute("INSERT INTO users VALUES(1,'owner'),(2,'other')");
 const app=express();registerGerman(app,db,async req=>({id:Number(req.headers.authorization?.replace('Bearer ','')||1)}),(_q,_r,n)=>n(),{autoSeedCurriculum:true});
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${(server.address() as any).port}/api/kaps-german`;
 const ask=(path:string,body?:unknown,user=1)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${user}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 try {
  const filters={module:'vocabulary',mode:'practice',activity:'sentence_translation',levels:['A1'],direction:'de_tr'};
  const created=await (await ask('/sessions',filters)).json(); assert.ok(created.id,JSON.stringify(created));
  assert.equal((await (await ask('/sessions',filters)).json()).id,created.id);
  const session=await (await ask(`/sessions/${created.id}`)).json();const task=session.tasks[0];
  assert.equal(task.sentenceDe,undefined);
  const hidden=await (await ask(`/sessions/${created.id}/words`,{taskId:task.id})).json();assert.equal(hidden.reviewed,false);assert.ok(hidden.words.every((w:any)=>w.locked&&w.meaningTr===null));
  assert.equal((await ask('/ai/explain',{sessionId:created.id,taskId:task.id,answer:'spoof',isCorrect:true})).status,409);
  await db.execute('INSERT OR IGNORE INTO german_permissions VALUES(2,1)');
  assert.equal((await ask(`/sessions/${created.id}/words`,{taskId:task.id},2)).status,404);
  const check=await ask(`/sessions/${created.id}/check`,{taskId:task.id,answer:'bilerek yanlış cevap'});assert.equal(check.status,200);
  const unlocked=await (await ask(`/sessions/${created.id}/words`,{taskId:task.id})).json();assert.equal(unlocked.reviewed,true);assert.ok(unlocked.words.every((w:any)=>!w.locked));
  resetGermanAIStateForTests();let seen:any;
  setGermanAITransportForTests(async req=>{seen=JSON.parse(req.messages[1].content);throw new Error('offline');});
  const explained=await ask('/ai/explain',{sessionId:created.id,taskId:task.id,answer:'spoof',isCorrect:true});assert.equal(explained.status,200);assert.equal(seen.studentAnswer,'bilerek yanlış cevap');assert.equal(seen.isCorrect,false);
  await db.execute({sql:"UPDATE german_sessions SET mode='exam' WHERE id=?",args:[created.id]});
  assert.deepEqual((await (await ask(`/sessions/${created.id}/words`,{taskId:task.id})).json()).words,[]);
  assert.equal((await ask('/ai/explain',{sessionId:created.id,taskId:task.id})).status,409);
  const history=await recentQuestionHistory(db,1);assert.ok(history.counts.size>0);assert.equal((await recentQuestionHistory(db,2)).counts.size,0);
 } finally {resetGermanAIStateForTests();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));db.close();}
});
