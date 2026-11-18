import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { createClient } from "@libsql/client";
import express from "express";
import { groqFrames, openGroqChat, GROQ_MODEL } from "../src/server/kapsAiGroq";
import { registerKapsAppAi } from "../src/server/kapsAppAi";

const encoder = new TextEncoder();
function stream(text: string) {
  const bytes = encoder.encode(text);
  return new ReadableStream<Uint8Array>({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
}
const event = (delta: object, reason: string | null = null) => `data: ${JSON.stringify({ choices: [{ delta, finish_reason: reason }] })}\r\n\r\n`;

test("SSE fragmentation, Unicode, reasoning exclusion, combined final content and length", async () => {
  const frames = [];
  for await (const frame of groqFrames(stream(': ping\r\n\r\n' + event({ reasoning: "private reasoning" }) + event({ content: "Türkçe " }) + event({ content: "yanıt" }, "length")))) frames.push(frame);
  assert.deepEqual(frames, [{ message: { content: "Türkçe " } }, { message: { content: "yanıt" } }, { done: true, done_reason: "length" }]);
  await assert.rejects(async () => { for await (const _ of groqFrames(stream(event({ content: "partial" }) + 'data: [DONE]\n\n'))) {} }, /kesildi/);
});

test("Groq route streams without Ollama; handles quotas without leaking key; local default stays", async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test-secret-never-return";
  let quota = false;
  let calls = 0;
  globalThis.fetch = (async (input: any, init: any) => {
    if (String(input) !== 'https://api.groq.com/openai/v1/chat/completions') return originalFetch(input, init);
    calls++;
    const payload = JSON.parse(init.body);
    assert.equal(payload.model, 'openai/gpt-oss-120b');
    assert.equal(payload.reasoning_effort, 'low');
    assert.equal(payload.max_completion_tokens, 2048);
    assert.equal(payload.messages[0].role, 'system');
    assert.ok(!('options' in payload));
    if (quota) return new Response('test-secret-never-return', { status: 429 });
    return new Response(stream(event({ content: 'Ready' }) + event({}, 'stop')), { status: 200 });
  }) as typeof fetch;
  const app = express();
  const db = createClient({ url: ':memory:' });
  registerKapsAppAi(app, async () => 'tester', (_req, _res, next) => next(), db);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const send = () => originalFetch(`http://127.0.0.1:${address.port}/api/kapsapp-ai/chat`, {
    method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: 'Ready please' }] }),
  }).then(r => r.text());
  try {
    const answer = await send();
    assert.match(answer, /"text":"Ready"/);
    assert.match(answer, /"type":"done"/);
    quota = true;
    const error = await send();
    assert.match(error, /kotası doldu/);
    assert.ok(!error.includes('test-secret'));
    assert.equal(calls, 2);
    await assert.rejects(() => openGroqChat([{ role:'user', content:'image', images:['photo'] }], new AbortController().signal), /Gemma/);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = oldKey;
    await new Promise<void>(resolve => server.close(() => resolve()));
    db.close();
  }
});
