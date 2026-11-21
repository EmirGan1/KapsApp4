import { createHash } from "node:crypto";
import {
  MASTERY_TARGET,
  isCefrLevel,
  masteryStatusFromStreak,
  type CefrLevel,
  type MasteryStatus,
  type SatzbauMode,
  type StoredCefrLevel,
} from "../../shared/germanActivities";
import {
  canonicalWordKey,
  classifyVocabularyEntry,
  normalizeText,
  parseCefrHeading,
  type CefrSource,
} from "./cefr";
import type { CurriculumEntry, PartOfSpeech } from "./curriculum";
import {
  classifyWordIntoHierarchy,
  isCorruptedTopicLabel,
  sanitizeLegacyTopic,
} from "./curriculumHierarchy";
import type { PronunciationGuide } from "./pronunciation";

export const normalize = normalizeText;
export { normalizeText };

export const fingerprint = (value: string) =>
  createHash("sha256").update(value.normalize("NFC")).digest("hex");

export type Vocabulary = {
  id: string;
  canonicalKey: string;
  de: string;
  tr: string;
  alternatives?: string[];
  raw: string;
  topic: string;
  categoryId?: string;
  unitId?: string;
  subtopic?: string;
  semanticTags?: string[];
  level: StoredCefrLevel;
  cefrSource: CefrSource;
  article: string;
  plural?: string;
  pos?: PartOfSpeech;
  grammar: string;
  exampleDe?: string;
  exampleTr?: string;
  conjugation?: CurriculumEntry["conjugation"];
  completion?: CurriculumEntry["completion"];
  pronunciation?: PronunciationGuide;
};

export function parseDocument(doc: any) {
  type RawLine = { text: string; tabLevel?: CefrLevel | null };
  const lines: RawLine[] = [];

  function blocks(content: any[], tabLevel: CefrLevel | null = null) {
    for (const b of content ?? []) {
      if (b.paragraph) {
        const txt = (b.paragraph.elements ?? [])
          .map((e: any) => e.textRun?.content ?? "")
          .join("");
        lines.push({ text: txt, tabLevel });
      }
      if (b.table) {
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
          if (cells.length === 2) {
            lines.push({ text: cells.join(" — "), tabLevel });
          } else {
            for (const cell of row.tableCells ?? []) blocks(cell.content, tabLevel);
          }
        }
      }
    }
  }

  function tabs(values: any[]) {
    for (const t of values ?? []) {
      const tabTitle = String(t.tabProperties?.title ?? t.documentTab?.tabProperties?.title ?? "");
      const tabLevel = parseCefrHeading(tabTitle);
      if (tabLevel) {
        lines.push({ text: `__RESET_TAB_LEVEL__:${tabLevel}`, tabLevel });
      } else {
        lines.push({ text: `__RESET_TAB_LEVEL__:NONE`, tabLevel: null });
      }
      blocks(t.documentTab?.body?.content, tabLevel);
      tabs(t.childTabs);
    }
  }

  if (doc.tabs?.length) tabs(doc.tabs);
  else blocks(doc.body?.content, null);

  if (lines.map((l) => l.text).join("").length > 1_000_000) {
    throw new Error("Kaynak belge çok büyük.");
  }

  let topic = "";
  let headingLevel: CefrLevel | null = null;
  const entries: Vocabulary[] = [];
  const warnings: string[] = [];
  let duplicates = 0;
  const seen = new Set<string>();

  for (const item of lines) {
    if (item.text.startsWith("__RESET_TAB_LEVEL__:")) {
      const tag = item.text.slice("__RESET_TAB_LEVEL__:".length);
      headingLevel = tag === "NONE" ? null : (tag as CefrLevel);
      topic = "";
      continue;
    }

    for (const rawLine of item.text.split(/\r?\n/u)) {
      const raw = rawLine.normalize("NFC").trim();
      if (!raw) continue;
      const line = raw.replace(/^\s*(?:[•*#]+|\d+[.)])\s*/u, "").trim();

      const detectedHeading = parseCefrHeading(line);
      if (detectedHeading) {
        headingLevel = detectedHeading;
        continue;
      }

      const match = line.match(/^(.{1,300}?)\s+(?:—|–|->|=|-)\s+(.{1,600})$/u);
      if (!match) {
        // Attach `TR: ...` or `DE: ...` or `Örnek: ...` lines to the preceding vocabulary item instead of corrupting `topic`!
        const trExampleMatch = line.match(/^(?:tr|türkçe|turkce)\s*[:\-]\s*(.+)$/iu);
        if (trExampleMatch && entries.length > 0) {
          const prev = entries[entries.length - 1];
          const cleanedEx = trExampleMatch[1].replace(/^[„“"']+|[„“"']+$/gu, "").trim();
          if (cleanedEx && !prev.exampleTr) {
            prev.exampleTr = cleanedEx;
          }
          continue;
        }
        const deExampleMatch = line.match(/^(?:de|almanca|örnek|ornek|bsp|beispiel)\s*[:\-]\s*(.+)$/iu);
        if (deExampleMatch && entries.length > 0) {
          const prev = entries[entries.length - 1];
          const cleanedEx = deExampleMatch[1].replace(/^[„“"']+|[„“"']+$/gu, "").trim();
          if (cleanedEx && !prev.exampleDe) {
            prev.exampleDe = cleanedEx;
          }
          continue;
        }

        if (line.length < 52 && !/[—=]/u.test(line) && !isCorruptedTopicLabel(line)) {
          topic = sanitizeLegacyTopic(line);
        }
        warnings.push(raw.slice(0, 600));
        continue;
      }

      const de = match[1].trim();
      const tr = match[2].trim();
      const cKey = canonicalWordKey(de);
      const dedupeKey = cKey + "\0" + normalize(tr);
      if (seen.has(dedupeKey)) {
        duplicates++;
        continue;
      }
      seen.add(dedupeKey);

      const classified = classifyVocabularyEntry({
        de,
        headingLevel,
      });
      const article = de.match(/^(der|die|das)\s/u)?.[1] ?? "";
      const grammar =
        de
          .match(/(?:Akk\.|Dat\.|Gen\.|sich|für|mit|auf|von|zu)/gu)
          ?.join(" ") ?? "";
      const hierarchy = classifyWordIntoHierarchy({
        de,
        tr,
        level: classified.level,
        topic: topic || "Genel",
        article,
        grammar,
      });

      entries.push({
        id: fingerprint(normalize(de) + "\0" + normalize(tr)),
        canonicalKey: cKey,
        de,
        tr,
        raw,
        topic: hierarchy.cleanTopic,
        categoryId: hierarchy.categoryId,
        subtopic: hierarchy.subtopicTr,
        semanticTags: hierarchy.semanticTags,
        pos: hierarchy.inferredPos,
        level: classified.level,
        cefrSource: classified.source,
        article,
        grammar,
      });
    }
  }

  if (entries.length > 5000) {
    throw new Error("Bir kaynakta en fazla 5.000 ifade işlenebilir.");
  }
  return { entries, warnings: warnings.slice(0, 100), duplicates };
}

export interface MasteryRecord {
  wordId: string;
  cefrLevel: StoredCefrLevel;
  consecutiveCorrect: number;
  totalCorrect: number;
  totalIncorrect: number;
  masteryStatus: MasteryStatus;
  lastPracticedAt: string | null;
  masteredAt: string | null;
}

export function newMastery(
  wordId = "",
  cefrLevel: StoredCefrLevel = "UNCLASSIFIED",
): MasteryRecord {
  return {
    wordId,
    cefrLevel,
    consecutiveCorrect: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    masteryStatus: "not_learned",
    lastPracticedAt: null,
    masteredAt: null,
  };
}

/**
 * Five-Consecutive-Correct Mastery Rule:
 * - Correct answer: consecutiveCorrect + 1, totalCorrect + 1.
 *   Reaching 5 consecutive sets masteryStatus = "mastered" and permanently records masteredAt.
 * - Incorrect answer: consecutiveCorrect resets to 0, totalIncorrect + 1.
 *   Optional review of already-mastered words NEVER erases permanent mastery!
 */
export function applyMasteryAttempt(
  old: MasteryRecord,
  correct: boolean,
  options: { isReview?: boolean; now?: Date } = {},
): MasteryRecord {
  const nowIso = (options.now ?? new Date()).toISOString();
  const isReview = options.isReview === true;
  const alreadyMastered =
    old.masteryStatus === "mastered" || old.masteredAt !== null;

  if (correct) {
    const nextConsecutive = Math.min(MASTERY_TARGET, old.consecutiveCorrect + 1);
    const becomesMastered = alreadyMastered || nextConsecutive >= MASTERY_TARGET;
    return {
      ...old,
      consecutiveCorrect: alreadyMastered ? MASTERY_TARGET : nextConsecutive,
      totalCorrect: old.totalCorrect + 1,
      masteryStatus: masteryStatusFromStreak(nextConsecutive, becomesMastered),
      lastPracticedAt: nowIso,
      masteredAt: old.masteredAt ?? (becomesMastered ? nowIso : null),
    };
  }

  // Incorrect answer
  if (isReview && alreadyMastered) {
    // Optional review exercises must NEVER erase completed mastery status.
    return {
      ...old,
      totalIncorrect: old.totalIncorrect + 1,
      consecutiveCorrect: MASTERY_TARGET,
      masteryStatus: "mastered",
      lastPracticedAt: nowIso,
      masteredAt: old.masteredAt ?? nowIso,
    };
  }

  return {
    ...old,
    consecutiveCorrect: 0,
    totalIncorrect: old.totalIncorrect + 1,
    masteryStatus: alreadyMastered ? "mastered" : "not_learned",
    lastPracticedAt: nowIso,
    masteredAt: alreadyMastered ? old.masteredAt : null,
  };
}

// Legacy Memory representation maintained alongside MasteryRecord for compatibility
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
  consecutiveCorrect?: number;
  totalCorrect?: number;
  totalIncorrect?: number;
  masteryStatus?: MasteryStatus;
  masteredAt?: string | null;
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
  state: "not_learned",
  consecutiveCorrect: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  masteryStatus: "not_learned",
  masteredAt: null,
});

export function memoryToMastery(
  raw: any,
  wordId: string,
  cefrLevel: StoredCefrLevel,
): MasteryRecord {
  if (!raw || typeof raw !== "object") return newMastery(wordId, cefrLevel);
  if (typeof raw.consecutiveCorrect === "number" && typeof raw.masteryStatus === "string") {
    const mastered = raw.masteryStatus === "mastered" || raw.masteredAt != null;
    return {
      wordId,
      cefrLevel,
      consecutiveCorrect: mastered ? MASTERY_TARGET : Math.max(0, Math.min(MASTERY_TARGET, raw.consecutiveCorrect)),
      totalCorrect: Math.max(0, Number(raw.totalCorrect ?? raw.correct ?? 0)),
      totalIncorrect: Math.max(0, Number(raw.totalIncorrect ?? 0)),
      masteryStatus: masteryStatusFromStreak(raw.consecutiveCorrect, mastered),
      lastPracticedAt: raw.lastPracticedAt ?? raw.last ?? null,
      masteredAt: raw.masteredAt ?? (mastered ? raw.last ?? new Date().toISOString() : null),
    };
  }
  const attempts = Math.max(0, Number(raw.attempts ?? 0));
  const correct = Math.max(0, Number(raw.correct ?? 0));
  const legacyMastered = raw.state === "mastered";
  const streak = legacyMastered
    ? MASTERY_TARGET
    : Math.max(0, Math.min(MASTERY_TARGET - 1, Number(raw.streak ?? 0)));
  return {
    wordId,
    cefrLevel,
    consecutiveCorrect: streak,
    totalCorrect: correct,
    totalIncorrect: Math.max(0, attempts - correct),
    masteryStatus: masteryStatusFromStreak(streak, legacyMastered),
    lastPracticedAt: typeof raw.last === "string" ? raw.last : null,
    masteredAt: legacyMastered ? (typeof raw.last === "string" ? raw.last : new Date().toISOString()) : null,
  };
}

export function masteryToMemory(m: MasteryRecord): Memory {
  const attempts = m.totalCorrect + m.totalIncorrect;
  return {
    attempts,
    correct: m.totalCorrect,
    streak: m.consecutiveCorrect,
    ease: 2.5,
    interval: m.masteryStatus === "mastered" ? 30 : m.consecutiveCorrect,
    due:
      m.masteryStatus === "mastered"
        ? new Date(Date.now() + 30 * 86400000).toISOString()
        : new Date().toISOString(),
    last: m.lastPracticedAt,
    spaced: m.consecutiveCorrect,
    productive: m.consecutiveCorrect,
    state: m.masteryStatus,
    consecutiveCorrect: m.consecutiveCorrect,
    totalCorrect: m.totalCorrect,
    totalIncorrect: m.totalIncorrect,
    masteryStatus: m.masteryStatus,
    masteredAt: m.masteredAt,
  };
}

export function review(
  old: Memory,
  correct: boolean,
  _production: boolean,
  now = new Date(),
  isReview = false,
): Memory {
  const prev = memoryToMastery(old, "", "UNCLASSIFIED");
  const next = applyMasteryAttempt(prev, correct, { isReview, now });
  return masteryToMemory(next);
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

export type TaskDirection = "de_tr" | "tr_de" | "de_only";
export type TaskObjective =
  | "meaning"
  | "production"
  | "article"
  | "conjugation"
  | "cloze"
  | "ordering"
  | "satzbau"
  | "listening"
  | "matching"
  | "exam";

export type Task = {
  sentenceDe?: string;
  sentenceTr?: string;
  activity?: string;
  satzbauMode?: SatzbauMode;
  subPrompt?: string;
  hint?: string;
  expected?: string;
  targetWordDe?: string;
  targetWordTr?: string;
  turkishPromptSentence?: string;
  grammarExplanationTr?: string;
  grammarFocus?: string;
  audioText?: string;
  pronunciation?: PronunciationGuide;
  interaction?: {
    tiles?: string[];
    left?: string[];
    right?: string[];
    audioText?: string;
    audioLang?: string;
    hintTr?: string;
    satzbauMode?: SatzbauMode;
    flawedSentenceDe?: string;
    errorHintTr?: string;
    targetWordDe?: string;
    targetWordTr?: string;
    grammarFocusTr?: string;
    wordMeta?: {
      de: string;
      tr: string;
      article?: string;
      topic?: string;
      categoryId?: string;
      unitId?: string;
      grammar?: string;
      exampleDe?: string;
      exampleTr?: string;
      pronunciation?: PronunciationGuide;
    };
  };
  id: string;
  module: string;
  type: string;
  part: number;
  level: string;
  topic?: string;
  categoryId?: string;
  unitId?: string;
  direction?: TaskDirection;
  objective?: TaskObjective;
  isMistakeReview?: boolean;
  pairVocabularyIds?: string[];
  prompt: string;
  passage: string;
  options: string[];
  answer: string;
  alternatives: string[];
  explanation: string;
  vocabularyIds: string[];
  evidence: string;
  fingerprint: string;
  wordBank?: string[];
  distractorWords?: string[];
  flawedSentenceDe?: string;
  difficulty?: string;
};

const BARE_OPTION_LABEL_RE = /^(?:\(?[A-E]\)[.:]?|[A-E][.)]?|[1-5][.)]?)$/iu;

function extractMatchableTokens(w: Vocabulary): string[] {
  const bareDe = normalize(w.de).replace(/^(?:der|die|das)\s+/u, "").trim();
  const tokens: string[] = [];
  if (bareDe) tokens.push(bareDe);
  if (w.plural) {
    const barePlural = normalize(w.plural).replace(/^(?:die)\s+/u, "").trim();
    if (barePlural) tokens.push(barePlural);
  }
  for (const part of w.tr.split(/\s*\/\s*/u)) {
    const cleanTr = normalize(part).replace(/\([^)]*\)/gu, "").trim();
    if (cleanTr.length >= 2) tokens.push(cleanTr);
  }
  if (w.exampleDe) tokens.push(normalize(w.exampleDe));
  if (w.exampleTr) tokens.push(normalize(w.exampleTr));
  if (w.conjugation?.answer) tokens.push(normalize(w.conjugation.answer));
  if (w.completion?.answer) tokens.push(normalize(w.completion.answer));
  // Verb / adjective stem prefix (>= 4 chars) to allow valid German inflected stems like "kauf" or "neu"
  if ((w.pos === "verb" || w.pos === "adj") && bareDe.length >= 4) {
    const stem =
      w.pos === "verb"
        ? bareDe.replace(/^sich\s+/u, "").replace(/(?:en|n)$/u, "")
        : bareDe;
    if (stem.length >= 3) tokens.push(stem);
  }
  return [...new Set(tokens)].filter((t) => t.length >= 2);
}

export function validateTask(value: any, words: Vocabulary[]): Task | null {
  if (!value || typeof value !== "object") return null;
  for (const field of [
    "prompt",
    "passage",
    "answer",
    "explanation",
    "evidence",
  ]) {
    if (typeof value[field] !== "string" || value[field].length > 15000)
      return null;
  }
  if (
    !value.prompt.trim() ||
    !value.explanation.trim() ||
    !["vocabulary", ...Object.keys(EXAM_STRUCTURE)].includes(value.module) ||
    !Array.isArray(value.options) ||
    value.options.length > 12 ||
    value.options.some((s: any) => typeof s !== "string" || !s.trim() || s.length > 500)
  ) {
    return null;
  }
  if (
    !Array.isArray(value.alternatives) ||
    value.alternatives.length > 20 ||
    value.alternatives.some(
      (s: any) => typeof s !== "string" || s.length > 3000,
    )
  ) {
    return null;
  }
  if (
    !Array.isArray(value.vocabularyIds) ||
    !value.vocabularyIds.length ||
    value.vocabularyIds.length > 8
  ) {
    return null;
  }

  const matchedWords = value.vocabularyIds
    .map((id: any) => words.find((w) => w.id === id))
    .filter(Boolean) as Vocabulary[];
  if (matchedWords.length !== value.vocabularyIds.length) return null;
  // Never validate unclassified vocabulary into level-restricted tasks
  if (matchedWords.some((w) => !isCefrLevel(w.level))) return null;

  // Reject bare option labels like "A", "(B)", "1)" as canonical answers!
  if (
    value.answer.trim() &&
    BARE_OPTION_LABEL_RE.test(value.answer.trim()) &&
    value.type !== "missing"
  ) {
    return null;
  }

  const context = normalize(
    [
      value.passage,
      value.prompt,
      value.answer,
      value.interaction?.audioText ?? "",
      value.interaction?.flawedSentenceDe ?? "",
      value.interaction?.targetWordDe ?? "",
      value.interaction?.targetWordTr ?? "",
      ...(Array.isArray(value.interaction?.tiles) ? value.interaction.tiles : []),
      ...(Array.isArray(value.interaction?.left) ? value.interaction.left : []),
      ...(Array.isArray(value.interaction?.right) ? value.interaction.right : []),
    ].join(" "),
  );
  if (
    !matchedWords.every((w) =>
      extractMatchableTokens(w).some((tok) => context.includes(tok)),
    )
  ) {
    return null;
  }

  if (!Number.isInteger(value.part) || value.part < 1 || value.part > 5)
    return null;

  if (value.module !== "vocabulary") {
    const config = EXAM_STRUCTURE[value.module as keyof typeof EXAM_STRUCTURE];
    if (
      value.part > config.parts.length ||
      value.type !== config.formats[value.part - 1]
    ) {
      return null;
    }
  }

  if (
    value.options.length &&
    value.type !== "multi" &&
    (new Set(value.options.map(normalize)).size !== value.options.length ||
      !value.options.includes(value.answer))
  ) {
    return null;
  }

  if (value.type === "multi") {
    const expParts = value.answer.split(" | ").map((s: string) => s.trim()).filter(Boolean);
    if (
      expParts.length < 2 ||
      new Set(value.options.map(normalize)).size !== value.options.length ||
      !expParts.every((p: string) => value.options.includes(p))
    ) {
      return null;
    }
  }

  if (value.type === "matching") {
    const left = value.interaction?.left;
    const right = value.interaction?.right;
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length < 2 ||
      left.length !== right.length ||
      matchedWords.length !== left.length
    ) {
      return null;
    }
    let parsedAns: unknown;
    try {
      parsedAns = JSON.parse(value.answer);
    } catch {
      return null;
    }
    if (!Array.isArray(parsedAns) || parsedAns.length !== left.length) return null;
    const sortedRight = [...right].map((x) => normalize(String(x))).sort();
    const sortedAns = [...parsedAns].map((x) => normalize(String(x))).sort();
    if (sortedRight.some((val, i) => val !== sortedAns[i])) return null;
    if (new Set(left.map((x: unknown) => normalize(String(x)))).size !== left.length) {
      return null;
    }
    if (new Set(right.map((x: unknown) => normalize(String(x)))).size !== right.length) {
      return null;
    }
  }

  if (value.type === "ordering" || value.type === "sentence_ordering") {
    const tiles = value.interaction?.tiles;
    if (!Array.isArray(tiles) || tiles.length < 2) return null;
    const expectedTokens = value.answer.trim().split(/\s+/u).filter(Boolean).map(normalize).sort();
    const tileTokens = tiles.map((t: unknown) => normalize(String(t))).sort();
    if (
      expectedTokens.length !== tileTokens.length ||
      expectedTokens.some((tok: string, i: number) => tok !== tileTokens[i])
    ) {
      return null;
    }
  }

  if (value.type === "satzbau") {
    const mode = value.interaction?.satzbauMode;
    if (mode === "arrange" || mode === "construct_bank") {
      const tiles = value.interaction?.tiles;
      if (!Array.isArray(tiles) || tiles.length < 3) return null;
      const cleanToken = (s: string) =>
        normalize(s).replace(/[.!?,;:…]+$/gu, "").trim();
      const expectedTokens = value.answer
        .trim()
        .split(/\s+/u)
        .map(cleanToken)
        .filter(Boolean);
      const tilePool = tiles.map((t: unknown) => cleanToken(String(t)));
      // Every expected word must be constructible from the tile pool
      const remaining = [...tilePool];
      for (const tok of expectedTokens) {
        const idx = remaining.indexOf(tok);
        if (idx === -1) return null;
        remaining.splice(idx, 1);
      }
    }
  }

  if (value.type === "listening" && !value.interaction?.audioText?.trim()) {
    return null;
  }

  if (
    value.module === "Lesen" &&
    (!value.passage ||
      !value.evidence ||
      !value.passage.includes(value.evidence) ||
      !value.answer)
  ) {
    return null;
  }

  const allowedVocabTypes = [
    "multiple_choice",
    "choice",
    "satzbau",
    "matching",
    "gap",
    "article",
    "conjugation",
    "cases",
    "correction",
    "ordering",
    "sentence_ordering",
    "sentence_gap",
    "sentence_translation",
    "sentence_completion",
    "listening",
    "translation",
    "translation_de_tr",
    "translation_tr_de",
    "true_false",
    "intruder",
    "multi",
    "spelling",
    "missing",
  ];
  if (
    value.module === "vocabulary" &&
    (!value.answer.trim() || !allowedVocabTypes.includes(value.type))
  ) {
    return null;
  }
  if (value.module === "Hören") return null;

  const taskLevel = isCefrLevel(value.level) ? value.level : matchedWords[0].level;
  return {
    ...value,
    id:
      typeof value.id === "string" && value.id.length > 0
        ? value.id
        : fingerprint(JSON.stringify([value.module, value.prompt, value.passage])),
    level: taskLevel,
    fingerprint:
      typeof value.fingerprint === "string" && value.fingerprint.length > 0
        ? value.fingerprint
        : fingerprint(normalize(value.prompt + " " + value.passage)),
  };
}
