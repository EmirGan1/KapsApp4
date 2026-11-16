import type { Client, Row } from "@libsql/client";
import type { ChatMessage, ChatSource, SavedChatTurn } from "../shared/kapsAppAi";
import { AI_HISTORY_LIMIT } from "../shared/kapsAppAi";

const PAGE_SIZE = 30;
const PENDING = "state IN ('queued', 'running')";
const columns = "seq, id, conversation_id, question, source_title, state, answer, notice";

function savedTurn(row: Row): SavedChatTurn {
  const state = String(row.state);
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    question: String(row.question),
    answer: String(row.answer),
    sources: row.source_title ? [{ id: "1", title: String(row.source_title) }] : [],
    state: state === "queued" || state === "running" ? "waiting" : state as SavedChatTurn["state"],
    phase: state === "queued" ? "queued" : undefined,
    notice: row.notice ? String(row.notice) : undefined,
  };
}

export function createKapsAiHistory(db: Client) {
  let schema: Promise<unknown> | undefined;
  function ready() {
    return schema ??= db.batch([
      `CREATE TABLE IF NOT EXISTS kapsai_conversations (
        id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL, last_activity INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS kapsai_turns (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL, owner TEXT NOT NULL, conversation_id TEXT NOT NULL,
        question TEXT NOT NULL, source_title TEXT, source_text TEXT, answer TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL CHECK(state IN ('queued','running','done','stopped','error')), notice TEXT,
        UNIQUE(owner, id)
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS kapsai_one_pending_owner ON kapsai_turns(owner) WHERE ${PENDING}`,
      "CREATE INDEX IF NOT EXISTS kapsai_turn_history ON kapsai_turns(owner, conversation_id, seq)",
      "CREATE INDEX IF NOT EXISTS kapsai_conversation_history ON kapsai_conversations(owner, last_activity)",
      `CREATE INDEX IF NOT EXISTS kapsai_pending_queue ON kapsai_turns(seq) WHERE ${PENDING}`,
    ], "write").catch(error => { schema = undefined; throw error; });
  }

  async function get(owner: string, id: string) {
    const { rows } = await db.execute({ sql: `SELECT ${columns} FROM kapsai_turns WHERE owner = ? AND id = ?`, args: [owner, id] });
    return rows[0] ? savedTurn(rows[0]) : null;
  }

  return {
    ready,
    get,
    async list(owner: string, before: number) {
      const [page, active] = await db.batch([
        { sql: "SELECT last_activity, id, title FROM kapsai_conversations WHERE owner = ? AND last_activity < ? ORDER BY last_activity DESC LIMIT ?", args: [owner, before, PAGE_SIZE + 1] },
        { sql: `SELECT id, conversation_id FROM kapsai_turns WHERE owner = ? AND ${PENDING}`, args: [owner] },
      ], "read");
      return {
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
    async append(owner: string, conversationId: string, id: string, question: string, source: ChatSource | undefined, capacity: number) {
      const title = Array.from(question.replace(/\s+/g, " ")).slice(0, 65).join("");
      // Insert the conversation only for an accepted turn, in the same transaction.
      await db.batch([
        {
          sql: `INSERT OR IGNORE INTO kapsai_turns(id, owner, conversation_id, question, source_title, source_text, state)
            SELECT ?, ?, ?, ?, ?, ?, 'queued' WHERE (SELECT count(*) FROM kapsai_turns WHERE ${PENDING}) < ?
            AND NOT EXISTS(SELECT 1 FROM kapsai_conversations WHERE id = ? AND owner <> ?)`,
          args: [id, owner, conversationId, question, source?.title ?? null, source?.text ?? null, capacity, conversationId, owner],
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
      const { rows } = await db.execute(`SELECT seq, id, owner, conversation_id, question, source_title, source_text
        FROM kapsai_turns WHERE ${PENDING} ORDER BY seq LIMIT 1`);
      const row = rows[0];
      return row ? {
        seq: Number(row.seq), id: String(row.id), owner: String(row.owner), conversationId: String(row.conversation_id),
        question: String(row.question),
        source: row.source_title ? { title: String(row.source_title), text: String(row.source_text) } : undefined,
      } : null;
    },
    async start(owner: string, id: string) {
      return (await db.execute({
        sql: `UPDATE kapsai_turns SET state = 'running' WHERE owner = ? AND id = ? AND ${PENDING}`, args: [owner, id],
      })).rowsAffected === 1;
    },
    async context(owner: string, conversationId: string, before: number) {
      const { rows } = await db.execute({
        sql: "SELECT question, answer FROM kapsai_turns WHERE owner = ? AND conversation_id = ? AND seq < ? AND state = 'done' ORDER BY seq DESC LIMIT ?",
        args: [owner, conversationId, before, AI_HISTORY_LIMIT / 2],
      });
      return rows.reverse().flatMap((row): ChatMessage[] => [
        { role: "user", content: String(row.question) },
        { role: "assistant", content: String(row.answer).slice(0, 6000) },
      ]);
    },
    async finish(owner: string, id: string, state: "done" | "error", answer: string, notice: string | null) {
      await db.execute({
        sql: "UPDATE kapsai_turns SET state = ?, answer = ?, notice = ? WHERE owner = ? AND id = ? AND state = 'running'",
        args: [state, answer, notice, owner, id],
      });
    },
    async stop(owner: string, id: string, answer: string) {
      await db.execute({
        sql: `UPDATE kapsai_turns SET state = 'stopped', answer = ?, notice = 'Yanıt durduruldu.' WHERE owner = ? AND id = ? AND ${PENDING}`,
        args: [answer, owner, id],
      });
      return get(owner, id);
    },
    async retry(owner: string, id: string, capacity: number) {
      const result = await db.execute({
        sql: `UPDATE OR IGNORE kapsai_turns SET state = 'queued', answer = '', notice = NULL
          WHERE owner = ? AND id = ? AND state IN ('error', 'stopped')
          AND NOT EXISTS (SELECT 1 FROM kapsai_turns AS newer WHERE newer.owner = kapsai_turns.owner
            AND newer.conversation_id = kapsai_turns.conversation_id AND newer.seq > kapsai_turns.seq)
          AND (SELECT count(*) FROM kapsai_turns WHERE ${PENDING}) < ?`,
        args: [owner, id, capacity],
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
