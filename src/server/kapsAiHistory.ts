import type { Client, Row } from "@libsql/client";
import type { ChatMessage, ChatSource, KapsAiModel, SavedChatTurn, StoredKapsAiModel } from "../shared/kapsAppAi";
import { AI_HISTORY_LIMIT, KAPSAPP_AI_DEFAULT_MODEL, isKapsAiModel, isLegacyKapsAiModel } from "../shared/kapsAppAi";

const PAGE_SIZE = 30;
const PENDING = "state IN ('queued', 'running')";
const columns = "seq, id, conversation_id, question, source_title, state, answer, notice, model, generation_ms, image_hash, requested_model, image_data";

function savedTurn(row: Row): SavedChatTurn {
  const state = String(row.state);
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    model: storedTurnModel(row.model),
    requestedModel: storedTurnModel(row.requested_model ?? row.model),
    question: String(row.question),
    answer: String(row.answer),
    sources: row.source_title ? [{ id: "1", title: String(row.source_title) }] : [],
    state: state === "queued" || state === "running" ? "waiting" : state as SavedChatTurn["state"],
    phase: state === "queued" ? "queued" : undefined,
    notice: row.notice ? String(row.notice) : undefined,
    generationMs: row.generation_ms == null ? undefined : Number(row.generation_ms),
    imageHash: row.image_hash ? String(row.image_hash) : undefined,
    imageCount: row.image_data ? (String(row.image_data).startsWith("[") ? (JSON.parse(String(row.image_data)) as string[]).length : 1) : undefined,
  };
}

function storedModel(value: unknown): KapsAiModel {
  return isKapsAiModel(value) ? value : KAPSAPP_AI_DEFAULT_MODEL;
}

function storedTurnModel(value: unknown): StoredKapsAiModel {
  return isKapsAiModel(value) || isLegacyKapsAiModel(value) ? value : KAPSAPP_AI_DEFAULT_MODEL;
}

export function createKapsAiHistory(db: Client) {
  let schema: Promise<unknown> | undefined;
  async function migrate() {
    await db.batch([
      `CREATE TABLE IF NOT EXISTS kapsai_conversations (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, last_activity INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS kapsai_turns (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, owner TEXT NOT NULL, conversation_id TEXT NOT NULL,
        question TEXT NOT NULL, source_title TEXT, source_text TEXT, answer TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL CHECK(state IN ('queued','running','done','stopped','error')), notice TEXT,
        model TEXT NOT NULL DEFAULT 'qwen3.5:2b-q4_K_M', generation_ms INTEGER, image_data TEXT, image_hash TEXT, requested_model TEXT,
        UNIQUE(owner, id)
      )`,
      "CREATE TABLE IF NOT EXISTS kapsai_model_preferences (owner TEXT PRIMARY KEY, model TEXT NOT NULL)",
      `CREATE UNIQUE INDEX IF NOT EXISTS kapsai_one_pending_owner ON kapsai_turns(owner) WHERE ${PENDING}`,
      "CREATE INDEX IF NOT EXISTS kapsai_turn_history ON kapsai_turns(owner, conversation_id, seq)",
      "CREATE INDEX IF NOT EXISTS kapsai_conversation_history ON kapsai_conversations(owner, last_activity)",
      `CREATE INDEX IF NOT EXISTS kapsai_pending_queue ON kapsai_turns(seq) WHERE ${PENDING}`,
    ], "write");
    const hasColumn = async (name: string) => {
      const { rows } = await db.execute("PRAGMA table_info(kapsai_turns)");
      return rows.some(row => row.name === name);
    };
    const additions = [
      // Rows predating model selection were originally generated with Llama 3.2.
      ["model", "TEXT NOT NULL DEFAULT 'llama3.2'"],
      ["generation_ms", "INTEGER"],
      ["image_data", "TEXT"],
      ["image_hash", "TEXT"],
      ["requested_model", "TEXT"],
    ];
    for (const [name, definition] of additions) {
      if (await hasColumn(name)) continue;
      try {
        await db.execute(`ALTER TABLE kapsai_turns ADD COLUMN ${name} ${definition}`);
      } catch (error) {
        if (!await hasColumn(name)) throw error;
      }
    }
  }

  function ready() {
    return schema ??= migrate().catch(error => { schema = undefined; throw error; });
  }

  async function get(owner: string, id: string) {
    const { rows } = await db.execute({ sql: `SELECT ${columns} FROM kapsai_turns WHERE owner = ? AND id = ?`, args: [owner, id] });
    return rows[0] ? savedTurn(rows[0]) : null;
  }

  return {
    ready,
    get,
    async image(owner: string, id: string) {
      const { rows } = await db.execute({
        sql: "SELECT image_data FROM kapsai_turns WHERE owner = ? AND id = ?",
        args: [owner, id],
      });
      return rows[0]?.image_data ? String(rows[0].image_data) : null;
    },
    async setModel(owner: string, model: KapsAiModel) {
      await db.execute({
        sql: "INSERT INTO kapsai_model_preferences(owner, model) VALUES (?, ?) ON CONFLICT(owner) DO UPDATE SET model = excluded.model",
        args: [owner, model],
      });
    },
    async list(owner: string, before: number) {
      const [page, active, preference] = await db.batch([
        { sql: "SELECT last_activity, id, title FROM kapsai_conversations WHERE owner = ? AND last_activity < ? ORDER BY last_activity DESC LIMIT ?", args: [owner, before, PAGE_SIZE + 1] },
        { sql: `SELECT id, conversation_id FROM kapsai_turns WHERE owner = ? AND ${PENDING}`, args: [owner] },
        { sql: "SELECT model FROM kapsai_model_preferences WHERE owner = ?", args: [owner] },
      ], "read");
      return {
        model: storedModel(preference.rows[0]?.model),
        conversations: page.rows.slice(0, PAGE_SIZE).map(row => ({ id: String(row.id), title: String(row.title) })),
        next: page.rows.length > PAGE_SIZE ? Number(page.rows[PAGE_SIZE - 1].last_activity) : null,
        active: active.rows[0] ? { id: String(active.rows[0].id), conversationId: String(active.rows[0].conversation_id) } : null,
      };
    },
    async conversation(owner: string, id: string, before: number) {
      const [chat, page] = await db.batch([
        { sql: "SELECT title FROM kapsai_conversations WHERE owner = ? AND id = ?", args: [owner, id] },
        { sql: `SELECT ${columns} FROM kapsai_turns WHERE owner = ? AND conversation_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?`, args: [owner, id, before, PAGE_SIZE + 1] },
      ], "read");
      if (!chat.rows[0]) return null;
      return {
        title: String(chat.rows[0].title),
        turns: page.rows.slice(0, PAGE_SIZE).reverse().map(savedTurn),
        next: page.rows.length > PAGE_SIZE ? Number(page.rows[PAGE_SIZE - 1].seq) : null,
      };
    },
    async append(owner: string, conversationId: string, id: string, question: string, source: ChatSource | undefined, model: KapsAiModel, capacity: number, image?: { dataUrl: string; hash: string }) {
      const title = Array.from(question.replace(/\s+/g, " ")).slice(0, 65).join("");
      // Insert the conversation only for an accepted turn, in the same transaction.
      await db.batch([
        {
          sql: `INSERT OR IGNORE INTO kapsai_turns(id, owner, conversation_id, question, source_title, source_text, state, model, image_data, image_hash, requested_model)
            SELECT ?, ?, ?, ?, ?, ?, 'queued', ?, ?, ?, ? WHERE (SELECT count(*) FROM kapsai_turns WHERE ${PENDING}) < ?
            AND NOT EXISTS(SELECT 1 FROM kapsai_conversations WHERE id = ? AND owner <> ?)`,
          args: [id, owner, conversationId, question, source?.title ?? null, source?.text ?? null, model, image?.dataUrl ?? null, image?.hash ?? null, model, capacity, conversationId, owner],
        },
        {
          sql: `INSERT INTO kapsai_conversations(id, owner, title, last_activity)
            SELECT ?, ?, ?, seq FROM kapsai_turns WHERE owner = ? AND id = ? AND conversation_id = ?
            ON CONFLICT(id) DO UPDATE SET last_activity = MAX(last_activity, excluded.last_activity)
            WHERE owner = excluded.owner`,
          args: [conversationId, owner, title, owner, id, conversationId],
        },
      ], "write");
      return get(owner, id);
    },
    async next() {
      const { rows } = await db.execute(`SELECT seq, id, owner, conversation_id, question, source_title, source_text, model, image_data
        FROM kapsai_turns WHERE ${PENDING} ORDER BY seq LIMIT 1`);
      const row = rows[0];
      return row ? {
        seq: Number(row.seq), id: String(row.id), owner: String(row.owner), conversationId: String(row.conversation_id),
        question: String(row.question),
        model: storedModel(row.model),
        image: row.image_data ? String(row.image_data) : undefined,
        source: row.source_title ? { title: String(row.source_title), text: String(row.source_text) } : undefined,
      } : null;
    },
    async start(owner: string, id: string, model: KapsAiModel) {
      return (await db.execute({
        sql: `UPDATE kapsai_turns SET state = 'running', model = ? WHERE owner = ? AND id = ? AND ${PENDING}`,
        args: [model, owner, id],
      })).rowsAffected === 1;
    },
    async context(owner: string, conversationId: string, before: number) {
      const { rows } = await db.execute({
        sql: "SELECT question, answer, image_data FROM kapsai_turns WHERE owner = ? AND conversation_id = ? AND seq < ? AND state = 'done' ORDER BY seq DESC LIMIT ?",
        args: [owner, conversationId, before, AI_HISTORY_LIMIT / 2],
      });
      return rows.reverse().flatMap((row): ChatMessage[] => [
        { role: "user", content: String(row.question), image: row.image_data ? (String(row.image_data).startsWith("[") ? JSON.parse(String(row.image_data)) as string[] : String(row.image_data)) : undefined },
        { role: "assistant", content: String(row.answer).slice(0, 6000) },
      ]);
    },
    async finish(owner: string, id: string, state: "done" | "error", answer: string, notice: string | null, generationMs: number | null) {
      await db.execute({
        sql: "UPDATE kapsai_turns SET state = ?, answer = ?, notice = ?, generation_ms = ? WHERE owner = ? AND id = ? AND state = 'running'",
        args: [state, answer, notice, generationMs, owner, id],
      });
    },
    async stop(owner: string, id: string, answer: string) {
      await db.execute({
        sql: `UPDATE kapsai_turns SET state = 'stopped', answer = ?, notice = 'Yanıt durduruldu.' WHERE owner = ? AND id = ? AND ${PENDING}`,
        args: [answer, owner, id],
      });
      return get(owner, id);
    },
    async retry(owner: string, id: string, capacity: number, model: KapsAiModel) {
      const result = await db.execute({
        sql: `UPDATE OR IGNORE kapsai_turns SET state = 'queued', answer = '', notice = NULL, generation_ms = NULL, model = ?, requested_model = ?
          WHERE owner = ? AND id = ? AND state IN ('error', 'stopped')
          AND NOT EXISTS (SELECT 1 FROM kapsai_turns AS newer WHERE newer.owner = kapsai_turns.owner
            AND newer.conversation_id = kapsai_turns.conversation_id AND newer.seq > kapsai_turns.seq)
          AND (SELECT count(*) FROM kapsai_turns WHERE ${PENDING}) < ?`,
        args: [model, model, owner, id, capacity],
      });
      return result.rowsAffected === 1;
    },
    async remove(owner: string, id: string) {
      const [chat] = await db.batch([
        {
          sql: `DELETE FROM kapsai_conversations WHERE owner = ? AND id = ?
            AND NOT EXISTS(SELECT 1 FROM kapsai_turns WHERE owner = ? AND conversation_id = ? AND ${PENDING})`,
          args: [owner, id, owner, id],
        },
        {
          sql: `DELETE FROM kapsai_turns WHERE owner = ? AND conversation_id = ?
            AND NOT EXISTS(SELECT 1 FROM kapsai_conversations WHERE owner = ? AND id = ?)`,
          args: [owner, id, owner, id],
        },
      ], "write");
      return chat.rowsAffected === 1;
    },
  };
}
