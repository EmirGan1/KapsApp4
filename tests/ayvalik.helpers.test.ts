import test from 'node:test';import assert from 'node:assert/strict';
import {activityTime,activityId,isActivityCompleted,isActivityAutoTicked,programState,programCalendar,readStringList,readReflectionDraft,casDateLabel} from '../src/utils/ayvalik';
const program=[{day:1,time:'06:00',title:'İlk, etkinlik;\nNot',description:'Türkçe açıklama '.repeat(20),location:'Okul'},{day:2,time:'09:00',title:'Aynı ad',description:'',location:'Atölye'},{day:3,time:'20:00',title:'Aynı ad',description:'',location:'Okul'}];
test('program uses Istanbul times and handles before/during/after trip',()=>{assert.equal(new Date(activityTime(program[0])).toISOString(),'2026-11-25T03:00:00.000Z');assert.equal(programState(program,Date.parse('2026-11-24T20:00Z')).next,program[0]);assert.equal(programState(program,activityTime(program[1])).current,program[1]);assert.equal(programState(program,activityTime(program[2])).ended,true);assert.notEqual(activityId(program[1]),activityId(program[2]));assert.equal(programState([],Date.now()).ended,false);});
test('schedule auto-ticks as activity time passes and supports manual tick/untick overrides',()=>{
  const item1=program[0]; // Day 1 06:00
  const item2=program[1]; // Day 2 09:00
  const beforeTrip=Date.parse('2026-11-20T10:00:00Z');
  const day1During=Date.parse('2026-11-25T03:30:00Z'); // 06:30 Istanbul
  const day3After=Date.parse('2026-11-28T10:00:00Z');

  // Before trip: not auto-ticked
  assert.equal(isActivityAutoTicked(item1,beforeTrip),false);
  assert.equal(isActivityCompleted(item1,beforeTrip,[]),false);

  // Manual completion works even before the time passes
  assert.equal(isActivityCompleted(item1,beforeTrip,[activityId(item1)]),true);

  // When time passes: automatically ticked without requiring manual entry
  assert.equal(isActivityAutoTicked(item1,day1During),true);
  assert.equal(isActivityCompleted(item1,day1During,[]),true);
  // Item 2 is still in the future during Day 1
  assert.equal(isActivityAutoTicked(item2,day1During),false);
  assert.equal(isActivityCompleted(item2,day1During,[]),false);

  // Manual untick override suppresses auto-tick for past events
  assert.equal(isActivityCompleted(item1,day1During,[],[activityId(item1)]),false);

  // After entire trip: both are auto-ticked
  assert.equal(isActivityAutoTicked(item1,day3After),true);
  assert.equal(isActivityAutoTicked(item2,day3After),true);
  assert.equal(isActivityCompleted(item1,day3After,[]),true);
  assert.equal(isActivityCompleted(item2,day3After,[]),true);
});
test('ICS uses CRLF, UTC dates, stable event IDs, escaped text and UTF-8 line folding',()=>{const text=programCalendar(program);assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,3);assert.ok(text.includes('DTSTART:20261125T030000Z\r\n'));assert.ok(text.includes('SUMMARY:İlk\\, etkinlik\\;\\nNot'));assert.equal(text.replace(/\r\n/g,'').includes('\n'),false);for(const line of text.split('\r\n'))assert.ok(new TextEncoder().encode(line).length<=75);assert.equal(new Set([...text.matchAll(/UID:(.+)/g)].map(m=>m[1])).size,3);});
test('corrupt storage and arbitrary data cannot turn progress into a crash or leak another account draft',()=>{const storage=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>storage.get(k)||null};storage.set('list','{"wrong":true}');assert.deepEqual(readStringList('list'),[]);storage.set('list','["id_card",null,"id_card",5,"unknown"]');assert.deepEqual(readStringList('list',['id_card']),['id_card']);storage.set('ayvalik_reflection_draft_1',JSON.stringify({text:'Taslak',day:2,outcome:'SERVICE'}));assert.equal(readReflectionDraft(1).text,'Taslak');assert.equal(readReflectionDraft(2).text,'');storage.set('ayvalik_reflection_draft_2','null');assert.equal(readReflectionDraft(2).day,1);delete (globalThis as any).localStorage;});
test('SQLite UTC timestamps and ISO timestamps display the same Turkey date and time',()=>{assert.equal(casDateLabel('2026-11-25 03:00:00'),casDateLabel('2026-11-25T03:00:00Z'));assert.match(casDateLabel('2026-11-25 03:00:00'),/06:00/);assert.equal(casDateLabel('broken'),'Tarih bilinmiyor');});
