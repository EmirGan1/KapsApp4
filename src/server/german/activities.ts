import { randomUUID, randomInt } from 'node:crypto';
import { activities } from '../../shared/germanActivities';
import { normalize, type Task, type Vocabulary } from './learning';
export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function buildActivities(words: Vocabulary[], selected = 'mixed'): Task[] {
  const byType = new Map<string, Task[]>();
  const add = (w: Vocabulary, type: string, prompt: string, answer: string, options: string[] = [], interaction?: Task['interaction']) => {
    const task: Task = { id: randomUUID(), module: 'vocabulary', type, part: 1, level: w.level, prompt, passage: '', answer, options, alternatives: [], explanation: `${w.de} — ${w.tr}`, vocabularyIds: [w.id], evidence: '', fingerprint: randomUUID(), interaction };
    byType.set(type, [...(byType.get(type) ?? []), task]);
  };
  for (const w of words) {
    const meanings = w.tr.split(/\s*\/\s*/u).filter(Boolean);
    const other = shuffle(words.filter(v => v.id !== w.id && !meanings.some(m => v.tr.includes(m)) && normalize(v.de) !== normalize(w.de)));
    if (other.length >= 2) {
      add(w, 'choice', `“${w.de}” ne anlama geliyor?`, w.tr, shuffle([w.tr, ...other.slice(0, 3).map(v => v.tr)]));
      const wrong = other[0];
      const truth = randomInt(2) === 1;
      add(w, 'true_false', `${w.de} = ${truth ? w.tr : wrong.tr}`, truth ? 'Doğru' : 'Yanlış', ['Doğru', 'Yanlış']);
      const bad = `${w.de} → ${wrong.tr}`;
      add(w, 'intruder', 'Hangi eşleştirme yanlış?', bad, shuffle([bad, ...other.slice(0, 2).map(v => `${v.de} → ${v.tr}`)]));
      if (meanings.length >= 2 && meanings.length <= 4) add(w, 'multi', `“${w.de}” için belgede verilen tüm anlamları seç.`, [...meanings].sort().join(' | '), shuffle([...meanings, ...other.slice(0, 2).map(v => v.tr)]));
      const group = [w, ...other.slice(0, 2)];
      if (new Set(group.map(v => normalize(v.tr))).size === group.length) {
        const left = group.map(v => v.de), right = shuffle(group.map(v => v.tr));
        add(w, 'matching', 'Her Almanca kart için Türkçe eşini seç.', JSON.stringify(group.map(v => v.tr)), [], { left, right });
      }
    }
    if (/^(der|die|das) /u.test(w.de)) add(w, 'article', w.de.replace(/^(der|die|das) /u, '___ '), w.de.split(' ')[0], ['der', 'die', 'das']);
    const tokens = w.de.split(/\s+/u);
    if (tokens.length >= 3) add(w, 'ordering', `İfadeyi sırala: ${w.tr}`, w.de, [], { tiles: shuffle(tokens) });
    if (w.de.length <= 32) add(w, 'spelling', `Harflerle oluştur: ${w.tr}`, w.de, [], { tiles: shuffle(Array.from(w.de)) });
    const pos = Array.from(w.de).findIndex((c, i) => i > 0 && /[a-zäöüß]/iu.test(c));
    if (pos >= 0) {
      const chars = Array.from(w.de), answer = chars[pos]; chars[pos] = '＿';
      add(w, 'missing', chars.join('') + ' · ' + w.tr, answer, shuffle([...new Set([answer, ...'aein'.split('')])]).slice(0, 5));
    }
    add(w, 'translation', `Almanca yaz: ${w.tr}`, w.de);
  }
  // Round-robin preserves diversity after the caller truncates the session.
  const keys = selected === 'mixed' ? activities.map(a => a[0]) : [selected];
  const result: Task[] = [];
  for (let i = 0; i < words.length; i++) keys.forEach((key, offset) => { const group = byType.get(key); if (group && i < group.length) result.push(group[(i + offset) % group.length]); });
  return result;
}
