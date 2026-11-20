import { createHash } from "node:crypto";
export const normalize = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("de");
export const fingerprint = (value: string) =>
  createHash("sha256").update(value.normalize("NFC")).digest("hex");
export type Vocabulary = {
  id: string;
  de: string;
  tr: string;
  raw: string;
  topic: string;
  level: string;
  article: string;
  grammar: string;
};
export function parseDocument(doc: any) {
  const lines: string[] = [];
  function blocks(content: any[]) {
    for (const b of content ?? []) {
      if (b.paragraph)
        lines.push(
          (b.paragraph.elements ?? [])
            .map((e: any) => e.textRun?.content ?? "")
            .join(""),
        );
      if (b.table)
        for (const row of b.table.tableRows ?? []) {
          const cells = (row.tableCells ?? []).map((cell: any) =>
            (cell.content ?? [])
              .map((p: any) =>
                (p.paragraph?.elements ?? [])
                  .map((e: any) => e.textRun?.content ?? "")
                  .join(""),
              )
              .join(" ")
              .trim(),
          );
          if (cells.length === 2) lines.push(cells.join(" — "));
          else for (const cell of row.tableCells ?? []) blocks(cell.content);
        }
    }
  }
  function tabs(values: any[]) {
    for (const t of values ?? []) {
      blocks(t.documentTab?.body?.content);
      tabs(t.childTabs);
    }
  }
  if (doc.tabs?.length) tabs(doc.tabs);
  else blocks(doc.body?.content);
  if (lines.join("").length > 1_000_000)
    throw new Error("Kaynak belge çok büyük.");
  let topic = "",
    level = "B1";
  const entries: Vocabulary[] = [],
    warnings: string[] = [];
  let duplicates = 0;
  const seen = new Set<string>();
  for (const rawLine of lines.join("\n").split(/\r?\n/u)) {
    const raw = rawLine.normalize("NFC").trim();
    if (!raw) continue;
    const line = raw.replace(/^\s*(?:[•*#]+|\d+[.)])\s*/u, "");
    if (/^(?:A1|A2|B1|B2|C1)$/u.test(line)) {
      level = line;
      continue;
    }
    const match = line.match(/^(.{1,300}?)\s+(?:—|–|->|=|-)\s+(.{1,600})$/u);
    if (!match) {
      if (line.length < 100 && !/[—=]/u.test(line)) topic = line;
      warnings.push(raw.slice(0, 600));
      continue;
    }
    const de = match[1].trim(),
      tr = match[2].trim();
    const key = normalize(de) + "\0" + normalize(tr);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    seen.add(key);
    entries.push({
      id: fingerprint(key),
      de,
      tr,
      raw,
      topic,
      level,
      article: de.match(/^(der|die|das)\s/u)?.[1] ?? "",
      grammar:
        de
          .match(/(?:Akk\.|Dat\.|Gen\.|sich|für|mit|auf|von|zu)/gu)
          ?.join(" ") ?? "",
    });
  }
  if (entries.length > 5000)
    throw new Error("Bir kaynakta en fazla 5.000 ifade işlenebilir.");
  return { entries, warnings: warnings.slice(0, 100), duplicates };
}
export type Memory = {
  attempts: number;
  correct: number;
  streak: number;
  ease: number;
  interval: number;
  due: string;
  last: string | null;
  spaced: number;
  productive: number;
  state: string;
};
export const newMemory = (): Memory => ({
  attempts: 0,
  correct: 0,
  streak: 0,
  ease: 2.5,
  interval: 0,
  due: new Date(0).toISOString(),
  last: null,
  spaced: 0,
  productive: 0,
  state: "new",
});
/** SM-2 inspired schedule, not FSRS. Promotion requires reviews separated by >=20 hours. No calibrated retention probability. */
export function review(
  old: Memory,
  correct: boolean,
  production: boolean,
  now = new Date(),
): Memory {
  const spaced =
    old.last === null || now.getTime() - Date.parse(old.last) >= 20 * 3600000;
  const next = {
    ...old,
    attempts: old.attempts + 1,
    correct: old.correct + Number(correct),
    last: now.toISOString(),
  };
  if (!correct) {
    next.streak = 0;
    next.interval = 1;
    next.ease = Math.max(1.3, old.ease - 0.2);
    next.state = "needs_review";
  } else {
    next.streak++;
    if (spaced) {
      next.spaced++;
      if (production) next.productive++;
      next.interval =
        old.spaced === 0
          ? 1
          : old.spaced === 1
            ? 6
            : Math.min(120, Math.max(1, Math.round(old.interval * old.ease)));
    }
    next.state =
      next.productive >= 3 &&
      next.spaced >= 4 &&
      next.interval >= 21 &&
      next.streak >= 3
        ? "mastered"
        : next.spaced >= 3 && next.streak >= 2
          ? "strong"
          : next.streak >= 2
            ? "improving"
            : "learning";
  }
  next.due =
    spaced || !correct
      ? new Date(now.getTime() + next.interval * 86400000).toISOString()
      : old.due;
  return next;
}
export const EXAM_STRUCTURE = {
  Lesen: {
    minutes: 65,
    parts: [6, 6, 7, 7, 4],
    formats: [
      "true_false",
      "multiple_choice",
      "matching",
      "yes_no",
      "multiple_choice",
    ],
  },
  Hören: {
    minutes: 40,
    parts: [10, 5, 7, 8],
    formats: ["mixed", "multiple_choice", "true_false", "speaker_matching"],
    plays: [2, 1, 1, 2],
  },
  Schreiben: {
    minutes: 60,
    parts: [1, 1, 1],
    formats: ["personal_email", "opinion", "formal_email"],
    words: [80, 80, 40],
    weights: [40, 40, 20],
  },
  Sprechen: {
    minutes: 15,
    preparation: 15,
    parts: [1, 1, 1],
    formats: ["joint_planning", "presentation", "response"],
  },
};
export type Task = {
  interaction?: { tiles?: string[]; left?: string[]; right?: string[] };
  id: string;
  module: string;
  type: string;
  part: number;
  level: string;
  prompt: string;
  passage: string;
  options: string[];
  answer: string;
  alternatives: string[];
  explanation: string;
  vocabularyIds: string[];
  evidence: string;
  fingerprint: string;
};
export function validateTask(value: any, words: Vocabulary[]): Task | null {
  if (!value || typeof value !== "object") return null;
  for (const field of [
    "prompt",
    "passage",
    "answer",
    "explanation",
    "evidence",
  ])
    if (typeof value[field] !== "string" || value[field].length > 15000)
      return null;
  if (
    !value.prompt.trim() ||
    !value.explanation.trim() ||
    !["vocabulary", ...Object.keys(EXAM_STRUCTURE)].includes(value.module) ||
    !Array.isArray(value.options) ||
    value.options.length > 12 ||
    value.options.some((s: any) => typeof s !== "string" || s.length > 500)
  )
    return null;
  if (
    !Array.isArray(value.alternatives) ||
    value.alternatives.length > 20 ||
    value.alternatives.some(
      (s: any) => typeof s !== "string" || s.length > 3000,
    )
  )
    return null;
  if (
    !Array.isArray(value.vocabularyIds) ||
    !value.vocabularyIds.length ||
    value.vocabularyIds.length > 8
  )
    return null;
  if (value.vocabularyIds.some((id: any) => !words.some((w) => w.id === id)))
    return null;
  const context = normalize(value.passage + " " + value.prompt);
  if (
    !value.vocabularyIds.some((id: string) =>
      context.includes(
        normalize(words.find((w) => w.id === id)!.de).replace(
          /^(der|die|das) /u,
          "",
        ),
      ),
    )
  )
    return null;
  if (!Number.isInteger(value.part) || value.part < 1 || value.part > 5)
    return null;
  if (value.module !== "vocabulary") {
    const config = EXAM_STRUCTURE[value.module as keyof typeof EXAM_STRUCTURE];
    if (
      value.part > config.parts.length ||
      value.type !== config.formats[value.part - 1]
    )
      return null;
  }
  if (
    value.options.length &&
    (new Set(value.options.map(normalize)).size !== value.options.length ||
      !value.options.includes(value.answer))
  )
    return null;
  if (
    value.module === "Lesen" &&
    (!value.passage ||
      !value.evidence ||
      !value.passage.includes(value.evidence) ||
      !value.answer)
  )
    return null;
  if (
    value.module === "vocabulary" &&
    (!value.answer.trim() ||
      ![
        "multiple_choice",
        "gap",
        "article",
        "conjugation",
        "cases",
        "correction",
        "translation_de_tr",
        "translation_tr_de",
      ].includes(value.type))
  )
    return null;
  if (value.module === "Hören") return null; // Never publish listening tasks until a secure audio provider is implemented.
  return {
    ...value,
    id: fingerprint(
      JSON.stringify([value.module, value.prompt, value.passage]),
    ),
    level: "B1",
    fingerprint: fingerprint(normalize(value.prompt + " " + value.passage)),
  };
}
