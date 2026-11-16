export const KAPSAPP_AI_PATH = "/api/kapsapp-ai/chat";
export const AI_MESSAGE_LIMIT = 1600;
export const AI_SOURCE_TITLE_LIMIT = 80;
export const AI_SOURCE_TEXT_LIMIT = 800;
export const AI_HISTORY_LIMIT = 6;

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatSource = { title: string; text: string };
export type SourceLabel = { id: string; title: string };
export type ChatEvent =
  | { type: "status" }
  | { type: "sources"; sources: SourceLabel[] }
  | { type: "delta"; text: string }
  | { type: "done"; truncated: boolean }
  | { type: "error"; error: string };

export async function* readJsonLines<T>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      if (done && pending.trim()) lines.push(pending);
      for (const line of lines) {
        if (line.length > 32_768) throw new Error("Oversized stream frame");
        if (line.trim()) yield JSON.parse(line) as T;
      }
      if (done) return;
      if (pending.length > 32_768) throw new Error("Oversized stream frame");
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
