import type { Client } from '@libsql/client';
import { fingerprint, normalize, type Task } from './learning';

// Independent of UUIDs, option order, punctuation and incidental whitespace.
export function questionKey(task: Pick<Task, 'type' | 'prompt' | 'passage'> & Partial<Task>) {
  const text = (value: string) => normalize(value).replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return fingerprint(JSON.stringify([task.type === 'multiple_choice' ? 'choice' : task.type,
    task.direction || '', text(task.prompt || ''), text(task.passage || ''), text(task.type === 'listening' ? task.interaction?.audioText || '' : ''),
    task.type === 'matching' ? [...(task.interaction?.left || []), ...(task.interaction?.right || [])].map(text).sort() : [],
    ['ordering', 'sentence_ordering', 'satzbau'].includes(task.type) ? [...(task.interaction?.tiles || task.wordBank || [])].map(text).sort() : []]));
}
export interface QuestionHistory {
  counts: Map<string, number>;
  wordCounts: Map<string, number>;
  prompts: string[];
}
export async function recentQuestionHistory(db: Client, user: number, limit = 30): Promise<QuestionHistory> {
  const rows = await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE user_id=? AND module='vocabulary' ORDER BY started_at DESC, id DESC LIMIT ?", args: [user, limit] });
  const counts = new Map<string, number>(), wordCounts = new Map<string, number>();
  const prompts: string[] = [];
  for (const row of rows.rows) {
    let tasks: Task[];
    try { tasks = JSON.parse(String(row.tasks)); } catch { continue; }
    if (!Array.isArray(tasks)) continue;
    for (const task of tasks) {
      if (typeof task.prompt !== 'string') continue;
      const key = questionKey(task);
      counts.set(key, (counts.get(key) || 0) + 1);
      prompts.push(`${task.prompt} ${task.passage || ''}`.slice(0, 500));
      for (const id of task.vocabularyIds || []) wordCounts.set(id, (wordCounts.get(id) || 0) + 1);
    }
  }
  return { counts, wordCounts, prompts: [...new Set(prompts)].slice(0, 60) };
}
export function preferNovelQuestions(tasks: Task[], history: QuestionHistory, limit = 10) {
  const seen = new Set<string>();
  return tasks.filter(task => { const key = questionKey(task); if (seen.has(key)) return false; seen.add(key); return true; })
    .sort((a, b) => (history.counts.get(questionKey(a)) || 0) - (history.counts.get(questionKey(b)) || 0))
    .slice(0, limit);
}
