export const KAPSAPP_AI_PATH = "/api/kapsapp-ai/chat";
export const KAPSAPP_AI_STATUS_PATH = "/api/kapsapp-ai/status";
export const AI_MESSAGE_LIMIT = 6000;
export const AI_SOURCE_TITLE_LIMIT = 120;
export const AI_SOURCE_TEXT_LIMIT = 2400;
export const AI_HISTORY_LIMIT = 6;

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type ChatSource = { title: string; text: string };
export type SourceLabel = { id: string; title: string };
export type ChatStatusPhase =
  | "accepted"
  | "queued"
  | "loading_model"
  | "processing_prompt"
  | "heartbeat";

export type ChatEvent =
  | { type: "status"; phase?: ChatStatusPhase; requestId?: string; queuePosition?: number }
  | { type: "sources"; sources: SourceLabel[] }
  | { type: "delta"; text: string }
  | { type: "done"; truncated: boolean }
  | { type: "error"; error: string };

const CODE_TOKEN_RE = /(```[\s\S]*?```|`[^`\n]+`)/g;
const STANDALONE_ENV_RE = /(^|\n)\s*(\\begin\{(align\*?|aligned|equation\*?|gather\*?|multline\*?|cases|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix)\}[\s\S]*?\\end\{\3\})\s*(?=\n|$)/g;

function normalizeMathSegment(segment: string, isTail: boolean, streaming: boolean): string {
  let out = segment;

  // 1. Convert \[ ... \] display math delimiters to $$ ... $$ blocks
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_match, inner: string) => {
    const trimmed = inner.trim();
    return trimmed ? `\n\n$$\n${trimmed}\n$$\n\n` : "";
  });

  // 2. Convert \( ... \) inline/multiline math delimiters
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_match, inner: string) => {
    const trimmed = inner.trim();
    if (!trimmed) return "";
    if (trimmed.includes("\n") || /\\begin\{/.test(trimmed)) {
      return `\n\n$$\n${trimmed}\n$$\n\n`;
    }
    return `$${trimmed}$`;
  });

  // 3. Ensure $$ ... $$ display math blocks sit on their own lines so remark-math emits display mode
  out = out.replace(/\$\$([\s\S]+?)\$\$/g, (_match, inner: string) => {
    const trimmed = inner.trim();
    return trimmed ? `\n\n$$\n${trimmed}\n$$\n\n` : "";
  });

  // 4. Wrap standalone LaTeX environments (\begin{align}...\end{align}, matrices, cases) not already inside $$
  const parts = out.split(/(\n\n\$\$[\s\S]*?\$\$\n\n)/g);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i].replace(STANDALONE_ENV_RE, (_m, lead: string, envBlock: string) => {
      return `${lead}\n\n$$\n${envBlock.trim()}\n$$\n\n`;
    });
    // Trim inner whitespace on single-line $ ... $ when it contains math notation so remark-math parses it
    parts[i] = parts[i].replace(/(?<!\$)\$(?!\$)([^\n$]+?)\$(?!\$)/g, (full, inner: string) => {
      const trimmed = inner.trim();
      if (!trimmed || trimmed === inner) return full;
      if (/[\\^_{}=<>+\-*/]|(?:\b(?:sin|cos|tan|lim|log|ln|int|sum|prod|sqrt|frac)\b)/.test(trimmed)) {
        return `$${trimmed}$`;
      }
      return full;
    });
  }
  out = parts.join("");

  // 5. While streaming, gracefully close a trailing unclosed math block at the end of the message
  if (streaming && isTail) {
    const openBracket = out.lastIndexOf("\\[");
    const closeBracket = out.lastIndexOf("\\]");
    if (openBracket !== -1 && openBracket > closeBracket) {
      const head = out.slice(0, openBracket);
      const expr = out.slice(openBracket + 2).trim();
      if (expr) return `${head}\n\n$$\n${expr}\n$$\n\n`;
    }

    const openParen = out.lastIndexOf("\\(");
    const closeParen = out.lastIndexOf("\\)");
    if (openParen !== -1 && openParen > closeParen) {
      const head = out.slice(0, openParen);
      const expr = out.slice(openParen + 2).trim();
      if (expr) {
        return expr.includes("\n")
          ? `${head}\n\n$$\n${expr}\n$$\n\n`
          : `${head}$${expr}$`;
      }
    }

    const doubleDollarMatches = [...out.matchAll(/\$\$/g)];
    if (doubleDollarMatches.length % 2 === 1) {
      const lastIdx = doubleDollarMatches.at(-1)!.index!;
      const head = out.slice(0, lastIdx);
      const expr = out.slice(lastIdx + 2).trim();
      if (expr) return `${head}\n\n$$\n${expr}\n$$\n\n`;
    }
  }

  return out;
}

export function normalizeMathMarkdown(content: string, streaming = false): string {
  if (!content) return "";
  const tokens = content.split(CODE_TOKEN_RE);
  return tokens
    .map((segment, index) => {
      if (index % 2 === 1) return segment; // Preserve fenced & inline code blocks verbatim
      return normalizeMathSegment(segment, index === tokens.length - 1, streaming);
    })
    .join("");
}

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

export const KAPSAPP_AI_CONVERSATIONS_PATH = "/api/kapsapp-ai/conversations";
export const KAPSAPP_AI_PREFERENCE_PATH = "/api/kapsapp-ai/model-preference";

export const KAPSAPP_AI_MODELS = {
  "qwen3.5:2b-q4_K_M": { label: "Qwen3.5 2B", description: "Yerel model · 3 CPU thread · 2048 bağlam" },
} as const;
export type KapsAiModel = keyof typeof KAPSAPP_AI_MODELS;
export type LegacyKapsAiModel = "llama3.2" | "qwen3:0.6b";
export type StoredKapsAiModel = KapsAiModel | LegacyKapsAiModel;
export const KAPSAPP_AI_DEFAULT_MODEL: KapsAiModel = "qwen3.5:2b-q4_K_M";
export function isKapsAiModel(value: unknown): value is KapsAiModel {
  return typeof value === "string" && Object.hasOwn(KAPSAPP_AI_MODELS, value);
}
export function isLegacyKapsAiModel(value: unknown): value is LegacyKapsAiModel {
  return value === "llama3.2" || value === "qwen3:0.6b";
}
export function kapsAiModelLabel(model: unknown): string {
  if (isKapsAiModel(model)) return KAPSAPP_AI_MODELS[model].label;
  if (model === "llama3.2") return "Llama 3.2 (eski sohbet)";
  if (model === "qwen3:0.6b") return "Qwen3 0.6B (eski sohbet)";
  return "Bilinmeyen eski model";
}

export const KAPSAPP_AI_TURNS_PATH = "/api/kapsapp-ai/turns";

export type SavedChatState = "waiting" | "streaming" | "done" | "stopped" | "error";

export type SavedChatTurn = {
  id: string;
  conversationId: string;
  model: StoredKapsAiModel;
  question: string;
  answer: string;
  sources: SourceLabel[];
  state: SavedChatState;
  phase?: ChatStatusPhase;
  notice?: string;
};

export type SavedChatSummary = { id: string; title: string };
