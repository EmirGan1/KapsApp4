import { readFile } from "node:fs/promises";

export const GROQ_MODEL = "groq:openai/gpt-oss-120b";
export class GroqFailure extends Error {
  constructor(message: string, readonly status = 503) { super(message); }
}

type Message = { role: string; content: string; images?: string[] };
type Frame = { message?: { content: string }; done?: boolean; done_reason?: string };

// Convert SSE events to the same bounded frames used by the local provider.
export async function* groqFrames(body: ReadableStream<Uint8Array>): AsyncGenerator<Frame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let finished = false;
  const parse = (event: string): Frame[] => {
    const data = event.split("\n").filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") return [];
    const frame = JSON.parse(data);
    if (frame.error) throw new GroqFailure("Groq yanıtı tamamlayamadı. Tekrar dene.");
    const choice = frame.choices?.[0];
    const result: Frame[] = [];
    if (typeof choice?.delta?.content === "string" && choice.delta.content) result.push({ message: { content: choice.delta.content } });
    if (choice?.finish_reason) {
      if (!["stop", "length"].includes(choice.finish_reason)) throw new GroqFailure("Groq yanıtı tamamlayamadı. Tekrar dene.");
      finished = true;
      result.push({ done: true, done_reason: choice.finish_reason });
    }
    return result;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      // Normalize only after buffering so split CRLF delimiters remain intact.
      pending = pending.replace(/\r\n/g, "\n");
      if (pending.length > 131072) throw new GroqFailure("Groq yanıt akışı geçersiz.");
      let end: number;
      while ((end = pending.indexOf("\n\n")) >= 0) {
        const result = parse(pending.slice(0, end));
        pending = pending.slice(end + 2);
        yield* result;
        if (finished) return;
      }
      if (done) {
        if (pending.trim()) { const result = parse(pending); yield* result; }
        if (!finished) throw new GroqFailure("Groq bağlantısı yanıt tamamlanmadan kesildi. Tekrar dene.");
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function openGroqChat(messages: Message[], signal: AbortSignal) {
  if (messages.some(message => message.images?.length)) throw new GroqFailure("Fotoğraflar için Gemma 4 E2B modelini seç.", 400);
  let key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    try { key = (await readFile(process.env.GROQ_API_KEY_FILE || "/etc/kapsapp/groq-api-key", "utf8")).trim(); } catch { /* configured below */ }
  }
  if (!key) throw new GroqFailure("Groq bağlantısı henüz yapılandırılmadı. Yerel bir model seçebilirsin.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: messages.map(({ role, content }) => ({ role, content })),
      stream: true, reasoning_effort: "low", max_completion_tokens: 12288, temperature: 0.2 }),
  }).catch(error => {
    if (signal.aborted) throw error;
    throw new GroqFailure("Groq hizmetine şu anda ulaşılamıyor. Yerel bir model seçebilirsin.");
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    // Never return the provider's raw body, headers or credential to the client/logs.
    if (response.status === 429) throw new GroqFailure("Groq ücretsiz kullanım kotası doldu. Biraz bekle veya yerel bir model seç.", 429);
    if (response.status === 401 || response.status === 403) throw new GroqFailure("Groq erişimi doğrulanamadı. Yerel bir model seçebilirsin.");
    throw new GroqFailure("Groq hizmetine şu anda ulaşılamıyor. Yerel bir model seçebilirsin.");
  }
  return groqFrames(response.body);
}
