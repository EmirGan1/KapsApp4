import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createClient} from '@libsql/client';
import {registerAyvalikWeather} from '../src/server/ayvalikWeather';
import {
  parseWeather,
  weatherNumber,
  weatherTime,
  weatherLabel,
  WEATHER_REFRESH_MS,
  WEATHER_URL,
  fetchMultiSourceAyvalikWeather
} from '../src/utils/ayvalikWeather';
import {weatherFixture} from './ayvalik.weather.fixture';

test('weather parsing preserves nulls, Istanbul times and partial trip coverage without invented forecasts', () => {
  const raw = weatherFixture('2026-11-10'); raw.daily.precipitation_sum[0] = null as any;
  const data = parseWeather(raw);
  assert.equal(data.daily.at(-1)?.time, '2026-11-25');
  assert.equal(data.daily.find(d=>d.time==='2026-11-26'), undefined);
  assert.equal(data.daily[0].values.precipitation_sum, null);
  assert.equal(weatherNumber(null), '—'); assert.equal(weatherNumber(0,'%'), '0%');
  assert.equal(weatherTime(data.current.time), Date.parse('2026-11-10T09:00:00Z'));
  assert.equal(data.daily[0].values.sunrise, Date.parse('2026-11-10T04:40:00Z'));
  assert.equal(weatherLabel(95), 'Gök gürültülü sağanak'); assert.equal(weatherLabel(null), 'Durum bilgisi yok');
  assert.throws(()=>parseWeather({}));
});

test('multi-source consensus engine aggregates 5 meteorological sources for 25-27 November accurately', async () => {
  const primary = parseWeather(weatherFixture('2026-11-12', 17));
  const report = await fetchMultiSourceAyvalikWeather(async () => new Response('{}', { status: 200 }), primary, 1700000000000);
  assert.equal(report.totalSourcesCount, 5);
  for (const date of ['2026-11-25', '2026-11-26', '2026-11-27']) {
    const day = report.days[date];
    assert.ok(day, `missing consensus for ${date}`);
    assert.equal(day.sources.length, 5);
    assert.equal(day.sources.reduce((s, r) => s + r.weight, 0), 100);
    assert.ok(day.tempMax >= 13 && day.tempMax <= 19, `unexpected tempMax ${day.tempMax}`);
    assert.ok(day.tempMin >= 7 && day.tempMin <= 13, `unexpected tempMin ${day.tempMin}`);
    assert.equal(Object.keys(day.hourlyConsensus).length, 24);
  }
});

test('authenticated weather endpoint coalesces requests, refreshes cache, labels stale data and recovers', async () => {
  const db=createClient({url:'file::memory:'});
  await db.execute("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,avatar TEXT,color TEXT,roles TEXT,is_admin INTEGER,token TEXT,isBanned INTEGER,is_banned INTEGER,status TEXT)");
  await db.execute("INSERT INTO users VALUES(1,'Student',NULL,NULL,NULL,0,'valid',0,0,'approved')");
  await db.execute('CREATE TABLE user_sessions(user_id INTEGER,token TEXT,expires_at TEXT)');
  let now=Date.parse('2026-11-05T09:00:00Z'), calls=0, fail=false;
  const fakeFetch:typeof fetch = async url => {
    calls++; assert.equal(url,WEATHER_URL); await new Promise(r=>setTimeout(r,20));
    return new Response(JSON.stringify(fail?{error:true}:weatherFixture('2026-11-05',calls===1?18:21)),{status:fail?503:200,headers:{'Content-Type':'application/json'}});
  };
  const app=express();registerAyvalikWeather(app,db,fakeFetch,()=>now);
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const url='http://127.0.0.1:'+(server.address() as any).port+'/api/ayvalik/weather';
  const request=()=>fetch(url,{headers:{Authorization:'Bearer valid'}});
  try {
    assert.equal((await fetch(url)).status,401);assert.equal(calls,0);
    const results=await Promise.all(Array.from({length:5},request));
    assert.equal(calls,1);for(const res of results){assert.equal(res.status,200);assert.equal((await res.json()).data.current.values.temperature_2m,18);}
    await request();assert.equal(calls,1);
    now+=WEATHER_REFRESH_MS+1;const fresh=await(await request()).json();assert.equal(calls,2);assert.equal(fresh.data.current.values.temperature_2m,21);assert.equal(fresh.stale,false);
    fail=true;now+=WEATHER_REFRESH_MS+1;const old=await(await request()).json();assert.equal(old.stale,true);assert.equal(old.fetchedAt,fresh.fetchedAt);
    await request();assert.equal(calls,3,'failed provider requests are throttled');
    now+=7*60*60*1000;assert.equal((await request()).status,503);
    fail=false;now+=60001;const recovered=await(await request()).json();assert.equal(recovered.success,true);assert.equal(recovered.stale,false);
  } finally {await new Promise<void>(r=>server.close(()=>r()));db.close();}
});
