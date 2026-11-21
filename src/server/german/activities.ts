import { questionKey } from './questionHistory';
import { randomInt, randomUUID } from "node:crypto";
import {
  activities,
  isCefrLevel,
  oppositeStudyDirection,
  SATZBAU_MODE_LABELS,
  type CefrLevel,
  type DistractorDifficulty,
  type SatzbauMode,
  type StudyDirection,
} from "../../shared/germanActivities";
import { gradeAnswer } from "./cefr";
import { selectSemanticDistractors } from "./distractors";
import { buildSatzbauSpecForWord, chooseSatzbauModeForWord } from "./satzbau";
import {
  normalize,
  validateTask,
  type Task,
  type TaskDirection,
  type TaskObjective,
  type Vocabulary,
} from "./learning";

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqueById(items: Vocabulary[]): Vocabulary[] {
  return [...new Map(items.map((w) => [w.id, w])).values()];
}

function makeWordMeta(w: Vocabulary) {
  return {
    de: w.de,
    tr: w.tr,
    article: w.article || undefined,
    topic: w.topic || undefined,
    grammar: w.grammar || undefined,
    exampleDe: w.exampleDe || undefined,
    exampleTr: w.exampleTr || undefined,
    pronunciation: w.pronunciation,
  };
}

function hasArticleNoun(w: Vocabulary): boolean {
  return /^(der|die|das)\s+/u.test(w.de.trim());
}

function hasSentenceContent(w: Vocabulary): boolean {
  if (w.exampleDe && w.exampleTr && w.exampleDe.trim().split(/\s+/u).length >= 3) {
    return true;
  }
  const tokens = w.de.trim().split(/\s+/u);
  return tokens.length >= 3 && /[.!?]$/u.test(w.de.trim());
}

function getSentencePair(w: Vocabulary): { de: string; tr: string } | null {
  if (w.exampleDe && w.exampleTr && w.exampleDe.trim().split(/\s+/u).length >= 3) {
    return { de: w.exampleDe.trim(), tr: w.exampleTr.trim() };
  }
  const tokens = w.de.trim().split(/\s+/u);
  if (tokens.length >= 3 && /[.!?]$/u.test(w.de.trim())) {
    return { de: w.de.trim(), tr: w.tr.trim() };
  }
  return null;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function isSeparableVerb(de: string): boolean {
  return /^(?:ab|an|auf|aus|bei|ein|fest|fern|heran|hervor|hin|los|mit|nach|teil|um|vor|weg|weiter|zu|zurück)[a-zäöüß]{3,}$/iu.test(
    de.trim(),
  );
}

/**
 * Matches ONLY an authentic grammatical form of `word` inside `sentence`.
 * Never falls back to masking an arbitrary neighboring token!
 */
export function matchWordFormInSentence(
  sentence: string,
  word: Vocabulary,
): { masked: string; answer: string } | null {
  const bare = word.de.replace(/^(?:der|die|das)\s+/iu, "").trim();
  const candidates: string[] = [];

  if (bare.length >= 2) candidates.push(bare);
  if (word.plural) {
    const barePlural = word.plural.replace(/^die\s+/iu, "").trim();
    if (barePlural.length >= 2) candidates.push(barePlural);
  }
  if (word.conjugation?.answer) {
    candidates.push(word.conjugation.answer.trim());
  }

  // Direct exact word-boundary check first
  for (const cand of [...new Set(candidates)]) {
    const wordRegex = new RegExp(
      `(?<![\\p{L}])(${escapeRegExp(cand)})(?![\\p{L}])`,
      "iu",
    );
    const m = sentence.match(wordRegex);
    if (m && m[1]) {
      return {
        masked: sentence.replace(wordRegex, "_____"),
        answer: m[1],
      };
    }
  }

  // Adjective inflections (e.g., neu -> neues, nachhaltig -> nachhaltige, stichhaltig -> stichhaltigen)
  if (word.pos === "adj" && bare.length >= 3) {
    const adjRegex = new RegExp(
      `(?<![\\p{L}])(${escapeRegExp(bare)}(?:e|en|em|er|es)?)(?![\\p{L}])`,
      "iu",
    );
    const m = sentence.match(adjRegex);
    if (m && m[1]) {
      return {
        masked: sentence.replace(adjRegex, "_____"),
        answer: m[1],
      };
    }
  }

  // Noun regular case/plural suffixes (only when bare noun doesn't end in e/n)
  if (word.pos === "noun" && bare.length >= 3) {
    const nounRegex = new RegExp(
      `(?<![\\p{L}])(${escapeRegExp(bare)}(?:s|es|n|en|e)?)(?![\\p{L}])`,
      "iu",
    );
    const m = sentence.match(nounRegex);
    if (m && m[1]) {
      return {
        masked: sentence.replace(nounRegex, "_____"),
        answer: m[1],
      };
    }
  }

  // Verb inflections ONLY for non-separable verbs (separable verbs split across the clause
  // and cannot be faithfully replaced by a single blank without corrupting the sentence meaning)
  if (word.pos === "verb") {
    const rawVerb = bare.replace(/^sich\s+/iu, "").trim();
    if (!isSeparableVerb(rawVerb) && rawVerb.length >= 4) {
      const stem = rawVerb.replace(/(?:en|n)$/u, "");
      if (stem.length >= 3) {
        const patterns = [
          `${escapeRegExp(stem)}(?:e|st|t|en|te|ten|test|tet)`,
          `ge${escapeRegExp(stem)}(?:t|en)`,
        ];
        const verbRegex = new RegExp(
          `(?<![\\p{L}])(${patterns.join("|")})(?![\\p{L}])`,
          "iu",
        );
        const m = sentence.match(verbRegex);
        if (m && m[1]) {
          return {
            masked: sentence.replace(verbRegex, "_____"),
            answer: m[1],
          };
        }
      }
    }
  }

  return null;
}

type WordCategory = "sentence" | "noun" | "verb" | "adj" | "adv_phrase" | "other";

function wordCategory(w: Vocabulary): WordCategory {
  if (w.pos === "sentence") return "sentence";
  if (!w.pos && w.de.trim().split(/\s+/u).length >= 4 && /[.!?]$/u.test(w.de.trim())) {
    return "sentence";
  }
  if (w.pos === "noun" || hasArticleNoun(w)) return "noun";
  if (w.pos === "verb") return "verb";
  if (w.pos === "adj") return "adj";
  if (w.pos === "adv" || w.pos === "phrase") return "adv_phrase";
  return "other";
}

function normalizedMeanings(w: Vocabulary): string[] {
  const raw = [
    ...w.tr.split(/\s*\/\s*/u),
    ...(w.alternatives ?? []),
  ];
  return [
    ...new Set(
      raw
        .map((s) =>
          normalize(s)
            .replace(/\([^)]*\)/gu, "")
            .trim(),
        )
        .filter((s) => s.length >= 2),
    ),
  ];
}

function wordsOverlap(a: Vocabulary, b: Vocabulary): boolean {
  if (normalize(a.de) === normalize(b.de)) return true;
  if (normalize(a.tr) === normalize(b.tr)) return true;
  const aM = normalizedMeanings(a);
  const bM = normalizedMeanings(b);
  return aM.some((am) =>
    bM.some((bm) => am === bm || (am.length >= 4 && bm.length >= 4 && (am.includes(bm) || bm.includes(am)))),
  );
}

function buildSentenceTurkishAlternatives(sentenceDe: string, sentenceTr: string): string[] {
  const alts: string[] = [];
  const trimTr = sentenceTr.trim();
  const trimDe = sentenceDe.trim();
  const lowerFirst = (s: string) =>
    s.charAt(0).toLocaleLowerCase("tr") + s.slice(1);
  const capFirst = (s: string) =>
    s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);

  // Turkish is pro-drop: if German starts with Ich/Wir/Du/Er/Ihr and Turkish omits the pronoun,
  // accept optional matching Turkish subject pronoun; if Turkish includes it, accept omitting it!
  if (/^(?:Ben|Sen|O|Biz|Siz|Onlar)\s+/u.test(trimTr)) {
    const stripped = trimTr.replace(/^(?:Ben|Sen|O|Biz|Siz|Onlar)\s+/u, "");
    if (stripped.length >= 4) alts.push(capFirst(stripped));
  } else {
    if (/^Ich\s+/u.test(trimDe)) alts.push(`Ben ${lowerFirst(trimTr)}`);
    else if (/^Wir\s+/u.test(trimDe)) alts.push(`Biz ${lowerFirst(trimTr)}`);
    else if (/^Du\s+/u.test(trimDe)) alts.push(`Sen ${lowerFirst(trimTr)}`);
    else if (/^Ihr\s+/u.test(trimDe)) alts.push(`Siz ${lowerFirst(trimTr)}`);
    else if (/^Er\s+/u.test(trimDe)) alts.push(`O ${lowerFirst(trimTr)}`);
  }

  return [...new Set(alts)];
}

function selectCompatibleDistractors(
  target: Vocabulary,
  pool: Vocabulary[],
): Vocabulary[] {
  const targetCat = wordCategory(target);
  const nonOverlapping = pool.filter(
    (v) => v.id !== target.id && !wordsOverlap(target, v),
  );

  // Never mix sentences with single words
  const isTargetSentence = targetCat === "sentence";
  const sameSentenceClass = nonOverlapping.filter(
    (v) => (wordCategory(v) === "sentence") === isTargetSentence,
  );

  const sameCatSameLevel = shuffle(
    sameSentenceClass.filter(
      (v) => wordCategory(v) === targetCat && v.level === target.level,
    ),
  );
  const sameCatAnyLevel = shuffle(
    sameSentenceClass.filter(
      (v) => wordCategory(v) === targetCat && v.level !== target.level,
    ),
  );
  const fallbackSameClass = shuffle(
    sameSentenceClass.filter((v) => wordCategory(v) !== targetCat),
  );

  return [...sameCatSameLevel, ...sameCatAnyLevel, ...fallbackSameClass];
}

function selectBalancedCandidates(
  source: Vocabulary[],
  options: BuildActivityOptions,
): Vocabulary[] {
  const groupedByLevel = new Map<CefrLevel, Vocabulary[]>();
  const recentSet = options.recentWordIds ?? new Set<string>();
  const mistakeSet = options.mistakeWordIds ?? new Set<string>();

  for (const w of source) {
    if (!isCefrLevel(w.level)) continue;
    const arr = groupedByLevel.get(w.level) ?? [];
    arr.push(w);
    groupedByLevel.set(w.level, arr);
  }

  const sortAndRotateTier = (items: Vocabulary[]) => {
    const mistakes = shuffle(items.filter((w) => mistakeSet.has(w.id)));
    const freshUnseen = shuffle(items.filter((w) => !mistakeSet.has(w.id) && !recentSet.has(w.id)));
    const recentlySeen = shuffle(items.filter((w) => !mistakeSet.has(w.id) && recentSet.has(w.id)));
    // Rotate weak words as well: mistakes must not permanently starve unseen words.
    const byExposure = (a: Vocabulary, b: Vocabulary) => (options.wordExposureCounts?.get(a.id) || 0) - (options.wordExposureCounts?.get(b.id) || 0);
    mistakes.sort(byExposure); freshUnseen.sort(byExposure); recentlySeen.sort(byExposure);
    const result: Vocabulary[] = [];
    while (mistakes.length || freshUnseen.length) {
      if (mistakes.length) result.push(mistakes.shift()!);
      result.push(...freshUnseen.splice(0, 2));
    }
    return [...result, ...recentlySeen];
  };

  const levelQueues = [...groupedByLevel.values()].map(sortAndRotateTier);
  const balanced: Vocabulary[] = [];
  let idx = 0;
  while (balanced.length < source.length) {
    let addedAny = false;
    for (const q of levelQueues) {
      if (idx < q.length) {
        balanced.push(q[idx]);
        addedAny = true;
      }
    }
    if (!addedAny) break;
    idx++;
  }
  return balanced;
}

export interface BuildActivityOptions {
  mistakeWordIds?: Set<string>;
  recentWordIds?: Set<string>;
  recentQuestionKeys?: Set<string>;
  wordExposureCounts?: Map<string, number>;
  reviewMode?: boolean;
  limit?: number;
  forceDirectionByWordId?: Map<string, "de_tr" | "tr_de">;
  avoidTypesByWordId?: Map<string, Set<string>>;
  isMistakeReview?: boolean;
  distractorWords?: Vocabulary[];
  difficulty?: DistractorDifficulty;
  masteryStreakByWordId?: Map<string, number>;
  satzbauMode?: SatzbauMode;
}

export function buildActivities(
  rawWords: Vocabulary[],
  selected = "mixed",
  direction: StudyDirection = "tr_de",
  options: BuildActivityOptions = {},
): Task[] {
  // STRICT CEFR SAFETY: Exclude any UNCLASSIFIED or invalid entries so they never appear in exercises.
  const words = uniqueById(rawWords).filter((w) => isCefrLevel(w.level));
  if (!words.length) return [];

  const mistakePool = options.mistakeWordIds
    ? words.filter((w) => options.mistakeWordIds!.has(w.id))
    : [];

  let baseSource = words;
  const isMistakeSession = selected === "mistake_review" || options.isMistakeReview === true;
  if (selected === "mistake_review") {
    if (!mistakePool.length) return [];
    baseSource = mistakePool;
  }

  let eligiblePool: Vocabulary[];
  if (selected === "article") {
    eligiblePool = baseSource.filter(hasArticleNoun);
  } else if (selected === "conjugation") {
    eligiblePool = baseSource.filter((w) => !!w.conjugation);
  } else if (selected === "sentence_completion") {
    eligiblePool = baseSource.filter(
      (w) => !!w.completion || (hasSentenceContent(w) && matchWordFormInSentence(getSentencePair(w)!.de, w) !== null),
    );
  } else if (selected === "sentence_translation" || selected.startsWith("sentence_")) {
    eligiblePool = baseSource.filter(hasSentenceContent);
  } else if (selected === "ordering") {
    eligiblePool = baseSource.filter(
      (w) => hasSentenceContent(w) || w.de.trim().split(/\s+/u).length >= 3,
    );
  } else if (selected === "gap") {
    eligiblePool = baseSource.filter((w) => {
      const sp = getSentencePair(w);
      return sp !== null && matchWordFormInSentence(sp.de, w) !== null;
    });
  } else if (selected === "multi") {
    eligiblePool = baseSource.filter((w) => {
      const m = w.tr.split(/\s*\/\s*/u).filter(Boolean);
      return m.length >= 2 && m.length <= 4;
    });
  } else {
    eligiblePool = baseSource;
  }

  // Balance across ALL selected levels and rotate unseen/mistake items fairly (no slice(0, 20) starvation!)
  const candidates = selectBalancedCandidates(eligiblePool, options);
  if (!candidates.length) return [];

  // Distractor pool uses ALL validated words in the allowed level scope!
  const distractorPool = options.distractorWords?.length
    ? uniqueById(options.distractorWords).filter((w) => isCefrLevel(w.level))
    : words;
  const validationPool = uniqueById([...words, ...distractorPool]);
  const byType = new Map<string, Task[]>();
  const byWordAndType = new Map<string, Map<string, Task>>();

  const pushTask = (
    w: Vocabulary,
    type: string,
    prompt: string,
    answer: string,
    opts: string[] = [],
    taskMeta: {
      direction: TaskDirection;
      objective: TaskObjective;
      interaction?: Task["interaction"];
      alternatives?: string[];
      explanation?: string;
      passage?: string;
      vocabularyIds?: string[];
      pairVocabularyIds?: string[];
      satzbauMode?: SatzbauMode;
      subPrompt?: string;
      hint?: string;
      wordBank?: string[];
      distractorWords?: string[];
      targetWordDe?: string;
      targetWordTr?: string;
      turkishPromptSentence?: string;
      flawedSentenceDe?: string;
      grammarExplanationTr?: string;
      grammarFocus?: string;
      audioText?: string;
    },
  ) => {
    const task: Task = {
      id: randomUUID(),
      module: "vocabulary",
      type,
      activity: type,
      part: 1,
      level: w.level,
      topic: w.topic,
      direction: taskMeta.direction,
      objective: taskMeta.objective,
      isMistakeReview: isMistakeSession || undefined,
      pairVocabularyIds: taskMeta.pairVocabularyIds,
      prompt,
      subPrompt: taskMeta.subPrompt,
      hint: taskMeta.hint,
      passage: taskMeta.passage ?? "",
      options: opts,
      answer,
      expected: answer,
      alternatives: (taskMeta.alternatives ?? []).filter(Boolean),
      explanation: taskMeta.explanation || `${w.de} — ${w.tr}`,
      vocabularyIds: taskMeta.vocabularyIds ?? [w.id],
      evidence: "",
      fingerprint: randomUUID(),
      satzbauMode: taskMeta.satzbauMode,
      wordBank: taskMeta.wordBank,
      distractorWords: taskMeta.distractorWords,
      targetWordDe: taskMeta.targetWordDe,
      targetWordTr: taskMeta.targetWordTr,
      turkishPromptSentence: taskMeta.turkishPromptSentence,
      flawedSentenceDe: taskMeta.flawedSentenceDe,
      grammarExplanationTr: taskMeta.grammarExplanationTr,
      grammarFocus: taskMeta.grammarFocus,
      audioText: taskMeta.audioText,
      pronunciation: w.pronunciation,
      interaction: {
        ...taskMeta.interaction,
        wordMeta: makeWordMeta(w),
      },
    };
    task.fingerprint = questionKey(task);
    const validated = validateTask(task, validationPool);
    if (!validated) return;
    byType.set(type, [...(byType.get(type) ?? []), validated]);
    const wordMap = byWordAndType.get(w.id) ?? new Map<string, Task>();
    if (!wordMap.has(type)) wordMap.set(type, validated);
    byWordAndType.set(w.id, wordMap);
  };

  for (let candIdx = 0; candIdx < candidates.length; candIdx++) {
    const w = candidates[candIdx];
    const forcedDir = options.forceDirectionByWordId?.get(w.id);
    const reverse = forcedDir
      ? forcedDir === "tr_de"
      : direction === "tr_de" || (direction === "mixed" && randomInt(2) === 1);
    const taskDir: TaskDirection = reverse ? "tr_de" : "de_tr";

    const source = reverse ? w.tr : w.de;
    const target = reverse ? w.de : w.tr;
    const cat = wordCategory(w);
    const meanings = w.tr.split(/\s*\/\s*/u).filter(Boolean);
    const other = selectCompatibleDistractors(w, distractorPool);

    // 1. Context-Aware Multiple-Choice Translation (10-step semantic & grammatical distractor pipeline)
    const semanticChoice = selectSemanticDistractors({
      target: w,
      pool: distractorPool,
      direction: taskDir,
      difficulty: options.difficulty ?? "adaptive",
      masteryStreak: options.masteryStreakByWordId?.get(w.id) ?? 0,
      count: 3,
      seed: `${w.id}:${candIdx}:${taskDir}`,
    });

    const filteredSemanticDistractors = semanticChoice.distractors.filter(
      (opt) =>
        opt !== target &&
        !gradeAnswer({
          type: "choice",
          answer: target,
          alternatives: reverse ? [] : w.alternatives,
          hasOptions: true,
          userAnswer: opt,
        }),
    );

    if (filteredSemanticDistractors.length < 3 && other.length >= 2) {
      for (const cand of other) {
        const opt = reverse ? cand.de : cand.tr;
        if (
          opt !== target &&
          !filteredSemanticDistractors.includes(opt) &&
          !gradeAnswer({
            type: "choice",
            answer: target,
            alternatives: reverse ? [] : w.alternatives,
            hasOptions: true,
            userAnswer: opt,
          })
        ) {
          filteredSemanticDistractors.push(opt);
        }
        if (filteredSemanticDistractors.length >= 3) break;
      }
    }

    const uniqueOpts = [...new Set([target, ...filteredSemanticDistractors.slice(0, 3)])];
    if (uniqueOpts.length >= 3) {
      const nounOrPhraseLabel =
        cat === "sentence"
          ? "cümlesinin"
          : cat === "adv_phrase"
            ? "ifadesinin"
            : "kelimesinin";
      pushTask(
        w,
        "choice",
        reverse
          ? `“${source}” ${cat === "sentence" ? "cümlesinin" : "ifadesinin"} Almanca karşılığı hangisidir?`
          : `“${source}” Almanca ${nounOrPhraseLabel} Türkçe anlamı nedir?`,
        target,
        shuffle(uniqueOpts),
        {
          direction: taskDir,
          objective: reverse ? "production" : "meaning",
          passage: semanticChoice.contextHint || w.topic || "",
        },
      );
    }

    if (other.length >= 2) {

      // 2. Interactive Vocabulary Matching (3 unambiguous pairs, direction-aware!)
      const matchGroup: Vocabulary[] = [w];
      // Every matching pair is tested and credited, unlike a mere choice distractor.
      // Keep all pairs inside the selected learning pool and the target CEFR level.
      for (const cand of selectCompatibleDistractors(w, words.filter(v => v.level === w.level))) {
        if (matchGroup.some((m) => wordsOverlap(m, cand))) continue;
        // Prefer comparable word length / non-sentence items in matching cards
        if (wordCategory(cand) === "sentence" && cat !== "sentence") continue;
        matchGroup.push(cand);
        if (matchGroup.length === 3) break;
      }
      if (matchGroup.length === 3) {
        const left = matchGroup.map((v) => (reverse ? v.tr : v.de));
        const expectedRight = matchGroup.map((v) => (reverse ? v.de : v.tr));
        const right = shuffle(expectedRight);
        if (
          new Set(left.map(normalize)).size === 3 &&
          new Set(right.map(normalize)).size === 3
        ) {
          pushTask(
            w,
            "matching",
            reverse
              ? "Türkçe ifadeleri doğru Almanca karşılıklarıyla eşleştir."
              : "Almanca kelimeleri doğru Türkçe anlamlarıyla eşleştir.",
            JSON.stringify(expectedRight),
            [],
            {
              direction: taskDir,
              objective: "matching",
              interaction: { left, right },
              explanation: matchGroup.map((g) => `${g.de} = ${g.tr}`).join(" · "),
              vocabularyIds: matchGroup.map((g) => g.id),
              pairVocabularyIds: matchGroup.map((g) => g.id),
            },
          );
        }
      }

      // Legacy compatibility task types when specifically requested
      if (selected === "true_false") {
        const wrong = other[0];
        const truth = randomInt(2) === 1;
        pushTask(
          w,
          "true_false",
          `${w.de} = ${truth ? w.tr : wrong.tr}`,
          truth ? "Doğru" : "Yanlış",
          ["Doğru", "Yanlış"],
          { direction: "de_tr", objective: "meaning" },
        );
      }
      if (selected === "intruder") {
        const wrong = other[0];
        const bad = `${w.de} → ${wrong.tr}`;
        pushTask(
          w,
          "intruder",
          "Hangi eşleştirme yanlış?",
          bad,
          shuffle([bad, ...other.slice(0, 2).map((v) => `${v.de} → ${v.tr}`)]),
          { direction: "de_tr", objective: "meaning" },
        );
      }
      if (selected === "multi" && meanings.length >= 2 && meanings.length <= 4) {
        pushTask(
          w,
          "multi",
          `“${w.de}” için geçerli olan tüm anlamları seç.`,
          [...meanings].sort().join(" | "),
          shuffle([...meanings, ...other.slice(0, 2).map((v) => v.tr)]),
          { direction: "de_tr", objective: "meaning" },
        );
      }
    }

    // 3. Article Practice (der / die / das)
    if (hasArticleNoun(w)) {
      const bareNoun = w.de.replace(/^(der|die|das)\s+/u, "");
      const article = w.de.split(/\s+/u)[0];
      pushTask(
        w,
        "article",
        `_____ ${bareNoun} (${w.tr})`,
        article,
        ["der", "die", "das"],
        {
          direction: "de_only",
          objective: "article",
          explanation: `Doğru artikel: ${w.de} (${w.tr})${w.grammar ? " · " + w.grammar : ""}`,
        },
      );
    }

    // 4. Verb Conjugation (CEFR-tailored)
    if (w.conjugation) {
      const c = w.conjugation;
      pushTask(
        w,
        "conjugation",
        `${c.promptDe}`,
        c.answer,
        shuffle([...new Set([c.answer, ...c.options])]),
        {
          direction: "de_only",
          objective: "conjugation",
          explanation: c.explanation,
          passage: `${c.tense} · Özne: ${c.pronoun}`,
        },
      );
    }

    // 5. Fill in the Blank (gap) — strictly authentic word-form matching!
    const sentencePair = getSentencePair(w);
    if (sentencePair) {
      const masked = matchWordFormInSentence(sentencePair.de, w);
      if (masked) {
        const cleanBare = (v: Vocabulary) => v.de.replace(/^(?:der|die|das)\s+/iu, "").trim();
        const samePosWords = other
          .filter((v) => wordCategory(v) === cat && wordCategory(v) !== "sentence")
          .map(cleanBare)
          .filter(
            (d) =>
              d.length >= 2 &&
              !d.includes(" ") &&
              normalize(d) !== normalize(masked.answer) &&
              !sentencePair.de.toLowerCase().includes(d.toLowerCase()),
          );
        const fallbackWords = other
          .filter((v) => wordCategory(v) !== "sentence")
          .map(cleanBare)
          .filter(
            (d) =>
              d.length >= 2 &&
              !d.includes(" ") &&
              normalize(d) !== normalize(masked.answer) &&
              !sentencePair.de.toLowerCase().includes(d.toLowerCase()),
          );

        const gapDistractors = [...new Set([...samePosWords, ...fallbackWords])].slice(0, 3);
        const gapOpts =
          gapDistractors.length >= 3
            ? shuffle([masked.answer, ...gapDistractors])
            : [];
        pushTask(
          w,
          "gap",
          `${masked.masked}`,
          masked.answer,
          gapOpts,
          {
            direction: "de_only",
            objective: "cloze",
            explanation: `${sentencePair.de} — ${sentencePair.tr}`,
            passage: sentencePair.tr,
          },
        );
      }

      // 6. Sentence Translation (NEVER inherits isolated word synonyms!)
      const sSource = reverse ? sentencePair.tr : sentencePair.de;
      const sTarget = reverse ? sentencePair.de : sentencePair.tr;
      const sentAlts = reverse
        ? []
        : buildSentenceTurkishAlternatives(sentencePair.de, sentencePair.tr);
      pushTask(
        w,
        "sentence_translation",
        reverse
          ? `Bu cümleyi Almancaya çevir: “${sSource}”`
          : `Bu cümleyi Türkçeye çevir: “${sSource}”`,
        sTarget,
        [],
        {
          direction: taskDir,
          objective: reverse ? "production" : "meaning",
          alternatives: sentAlts,
          explanation: `${sentencePair.de} — ${sentencePair.tr}`,
        },
      );
    }

    // 7. Word Ordering
    const orderSource =
      w.de.trim().split(/\s+/u).length >= 3
        ? { de: w.de.trim(), tr: w.tr.trim() }
        : sentencePair;
    if (orderSource) {
      const tokens = orderSource.de.split(/\s+/u).filter(Boolean);
      if (tokens.length >= 3) {
        pushTask(
          w,
          "ordering",
          `Kelimeleri doğru Almanca sıraya diz: “${orderSource.tr}”`,
          orderSource.de,
          [],
          {
            direction: "tr_de",
            objective: "ordering",
            interaction: { tiles: shuffle(tokens) },
            explanation: `${orderSource.de} — ${orderSource.tr}`,
          },
        );
        if (selected === "sentence_ordering") {
          pushTask(
            w,
            "sentence_ordering",
            `Almanca cümleyi kur: ${orderSource.tr}`,
            orderSource.de,
            [],
            {
              direction: "tr_de",
              objective: "ordering",
              interaction: { tiles: shuffle(tokens) },
            },
          );
        }
      }
    }

    // 7B. AI-Assisted German Sentence Building ("satzbau" / "Cümle Kurma — Satzbau") across Modes A–E
    const sbMode = chooseSatzbauModeForWord(w, candIdx, options.satzbauMode);
    const sbSpec = buildSatzbauSpecForWord(w, other);
    const sbMeta = SATZBAU_MODE_LABELS[sbMode];
    if (sbMode === "arrange") {
      let sbTiles = shuffle(sbSpec.tokens);
      if (sbTiles.join(" ") === sbSpec.tokens.join(" ") && sbTiles.length > 1) {
        sbTiles = [...sbTiles.slice(1), sbTiles[0]];
      }
      pushTask(
        w,
        "satzbau",
        `Cümleyi kur: “${sbSpec.sentenceTr}”`,
        sbSpec.sentenceDe,
        [],
        {
          direction: "tr_de",
          objective: "ordering",
          satzbauMode: "arrange",
          subPrompt: `${sbMeta} • Kelimelere dokunarak doğru Almanca cümleyi oluştur.`,
          hint: `Hedef kelime: ${w.de} (${w.tr}) • ${sbSpec.grammarFocus}`,
          passage: `${sbMeta} • Hedef: ${w.de}`,
          alternatives: sbSpec.alternativesDe,
          explanation: `${sbSpec.sentenceDe} — ${sbSpec.sentenceTr} · ${sbSpec.grammarExplanationTr}`,
          wordBank: sbTiles,
          targetWordDe: w.de,
          targetWordTr: w.tr,
          turkishPromptSentence: sbSpec.sentenceTr,
          grammarExplanationTr: sbSpec.grammarExplanationTr,
          grammarFocus: sbSpec.grammarFocus,
          audioText: sbSpec.sentenceDe,
          interaction: {
            tiles: sbTiles,
            audioText: sbSpec.sentenceDe,
            audioLang: "de-DE",
            hintTr: sbSpec.grammarFocus,
          },
        },
      );
    } else if (sbMode === "construct_bank") {
      const bankTiles = shuffle([...sbSpec.tokens, ...sbSpec.distractorTokens]);
      pushTask(
        w,
        "satzbau",
        `Çeldiricili kelime havuzundan cümleyi kur: “${sbSpec.sentenceTr}”`,
        sbSpec.sentenceDe,
        [],
        {
          direction: "tr_de",
          objective: "ordering",
          satzbauMode: "construct_bank",
          subPrompt: `${sbMeta} • Havuzdaki ${sbSpec.distractorTokens.length} fazladan çeldirici kelimeye dikkat et.`,
          hint: `Hedef kelime: ${w.de} (${w.tr}) • ${sbSpec.grammarFocus}`,
          passage: `${sbMeta} • Hedef: ${w.de}`,
          alternatives: sbSpec.alternativesDe,
          explanation: `${sbSpec.sentenceDe} — ${sbSpec.sentenceTr} · ${sbSpec.grammarExplanationTr}`,
          wordBank: bankTiles,
          distractorWords: sbSpec.distractorTokens,
          targetWordDe: w.de,
          targetWordTr: w.tr,
          turkishPromptSentence: sbSpec.sentenceTr,
          grammarExplanationTr: sbSpec.grammarExplanationTr,
          grammarFocus: sbSpec.grammarFocus,
          audioText: sbSpec.sentenceDe,
          interaction: {
            tiles: bankTiles,
            audioText: sbSpec.sentenceDe,
            audioLang: "de-DE",
            hintTr: sbSpec.grammarFocus,
          },
        },
      );
    } else if (sbMode === "free_translation") {
      pushTask(
        w,
        "satzbau",
        `Serbest Almanca cümle kur: “${sbSpec.sentenceTr}”`,
        sbSpec.sentenceDe,
        [],
        {
          direction: "tr_de",
          objective: "production",
          satzbauMode: "free_translation",
          subPrompt: `${sbMeta} • Kelime havuzu olmadan cümleyi Almancaya çevir.`,
          hint: `İpucu: "${w.de}" (${w.tr}) kelimesini kullan.`,
          passage: `${sbMeta} • Anahtar kelime: ${w.de} (${w.tr})`,
          alternatives: sbSpec.alternativesDe,
          explanation: `${sbSpec.sentenceDe} — ${sbSpec.sentenceTr} · ${sbSpec.grammarExplanationTr}`,
          targetWordDe: w.de,
          targetWordTr: w.tr,
          turkishPromptSentence: sbSpec.sentenceTr,
          grammarExplanationTr: sbSpec.grammarExplanationTr,
          grammarFocus: sbSpec.grammarFocus,
          audioText: sbSpec.sentenceDe,
          interaction: {
            audioText: sbSpec.sentenceDe,
            audioLang: "de-DE",
            hintTr: sbSpec.grammarFocus,
          },
        },
      );
    } else if (sbMode === "correct_sentence") {
      pushTask(
        w,
        "satzbau",
        `Hatalı cümleyi düzelt: “${sbSpec.flawedSentenceDe}”`,
        sbSpec.sentenceDe,
        [],
        {
          direction: "de_only",
          objective: "production",
          satzbauMode: "correct_sentence",
          subPrompt: `${sbMeta} • Kelime sırası veya gramer hatasını düzelterek doğru Almanca cümleyi yaz.`,
          hint: `Anlamı: "${sbSpec.sentenceTr}" • Odak: ${sbSpec.grammarFocus}`,
          passage: `${sbMeta} • Anlamı: ${sbSpec.sentenceTr}`,
          alternatives: sbSpec.alternativesDe,
          explanation: `${sbSpec.sentenceDe} — ${sbSpec.grammarExplanationTr}`,
          flawedSentenceDe: sbSpec.flawedSentenceDe,
          targetWordDe: w.de,
          targetWordTr: w.tr,
          turkishPromptSentence: sbSpec.sentenceTr,
          grammarExplanationTr: sbSpec.grammarExplanationTr,
          grammarFocus: sbSpec.grammarFocus,
          audioText: sbSpec.sentenceDe,
          interaction: {
            audioText: sbSpec.sentenceDe,
            audioLang: "de-DE",
            hintTr: sbSpec.grammarFocus,
          },
        },
      );
    } else {
      // create_own
      pushTask(
        w,
        "satzbau",
        `“${w.de}” (${w.tr}) kelimesiyle özgün bir Almanca cümle kur`,
        sbSpec.sentenceDe,
        [],
        {
          direction: "tr_de",
          objective: "production",
          satzbauMode: "create_own",
          subPrompt: `${sbMeta} • Bu kelimeyi kullanarak en az 3 kelimelik anlamlı bir Almanca cümle yaz.`,
          hint: `Hedef kelimeyi kullanarak kendi cümleni kur. Odak: ${sbSpec.grammarFocus}. Örnek çözüm yanıtından sonra gösterilecek.`,
          passage: `${sbMeta} • Örnek anlam: ${sbSpec.sentenceTr}`,
          alternatives: sbSpec.alternativesDe,
          explanation: `Örnek cümle: ${sbSpec.sentenceDe} — ${sbSpec.sentenceTr}`,
          targetWordDe: w.de,
          targetWordTr: w.tr,
          turkishPromptSentence: sbSpec.sentenceTr,
          grammarExplanationTr: sbSpec.grammarExplanationTr,
          grammarFocus: sbSpec.grammarFocus,
          audioText: sbSpec.sentenceDe,
          interaction: {
            audioText: sbSpec.sentenceDe,
            audioLang: "de-DE",
            hintTr: sbSpec.grammarFocus,
          },
        },
      );
    }

    // 8. Sentence Completion
    if (w.completion) {
      const cmp = w.completion;
      pushTask(
        w,
        "sentence_completion",
        cmp.stem,
        cmp.answer,
        shuffle([cmp.answer, ...cmp.distractors]),
        {
          direction: "de_only",
          objective: "cloze",
          explanation: cmp.explanation,
          passage: cmp.trHint,
        },
      );
    } else if (sentencePair && other.length >= 3) {
      const masked = matchWordFormInSentence(sentencePair.de, w);
      if (masked) {
        const cleanBare = (v: Vocabulary) => v.de.replace(/^(?:der|die|das)\s+/iu, "").trim();
        const dist = [...new Set(
          other
            .filter((v) => wordCategory(v) === cat || wordCategory(v) !== "sentence")
            .map(cleanBare)
            .filter(
              (d) =>
                d.length >= 2 &&
                normalize(d) !== normalize(masked.answer) &&
                !d.includes(" "),
            ),
        )].slice(0, 3);
        if (dist.length >= 2) {
          pushTask(
            w,
            "sentence_completion",
            masked.masked,
            masked.answer,
            shuffle([masked.answer, ...dist]),
            {
              direction: "de_only",
              objective: "cloze",
              explanation: `${sentencePair.de} — ${sentencePair.tr}`,
              passage: sentencePair.tr,
            },
          );
        }
      }
    }

    // 9. Listening Exercise (strictly matching sentence-vs-sentence or word-vs-word options!)
    if (other.length >= 2) {
      let useSentenceAudio = Boolean(sentencePair && sentencePair.de !== w.de);
      let sentenceDistPool: string[] = [];
      if (useSentenceAudio) {
        sentenceDistPool = shuffle(
          other
            .map((v) => getSentencePair(v)?.tr)
            .filter((tr): tr is string => Boolean(tr && tr !== sentencePair!.tr)),
        ).slice(0, 3);
        if (sentenceDistPool.length < 2) {
          useSentenceAudio = false;
        }
      }

      const spokenText = useSentenceAudio ? sentencePair!.de : w.de;
      const expectedListening = useSentenceAudio ? sentencePair!.tr : w.tr;
      const distOpts = useSentenceAudio
        ? sentenceDistPool
        : shuffle(other.filter((v) => wordCategory(v) !== "sentence"))
            .map((v) => v.tr)
            .filter((tr) => tr !== expectedListening)
            .slice(0, 3);

      const uniqListenOpts = [...new Set([expectedListening, ...distOpts])];
      if (uniqListenOpts.length >= 3) {
        pushTask(
          w,
          "listening",
          "Almanca telaffuzu dinle ve doğru Türkçe karşılığı seç.",
          expectedListening,
          shuffle(uniqListenOpts),
          {
            direction: "de_tr",
            objective: "listening",
            interaction: {
              audioText: spokenText,
              audioLang: "de-DE",
              hintTr: useSentenceAudio ? undefined : w.topic,
            },
            explanation: `${spokenText} — ${expectedListening}`,
          },
        );
      }
    }

    // 10. Direct Word Translation (typing) — NEVER leaks Turkish alternatives when producing German!
    pushTask(
      w,
      "translation",
      reverse
        ? `Almanca yaz: “${source}”`
        : `Türkçe yaz: “${source}”`,
      target,
      [],
      {
        direction: taskDir,
        objective: reverse ? "production" : "meaning",
        alternatives: reverse ? [] : (w.alternatives ?? []),
      },
    );

    if (selected === "spelling" && w.de.length <= 32) {
      pushTask(
        w,
        "spelling",
        `Harflerle oluştur: ${w.tr}`,
        w.de,
        [],
        {
          direction: "tr_de",
          objective: "production",
          interaction: { tiles: shuffle(Array.from(w.de)) },
        },
      );
    }

    if (selected === "missing") {
      const pos = Array.from(w.de).findIndex(
        (c, i) => i > 0 && /[a-zäöüß]/iu.test(c),
      );
      if (pos >= 0) {
        const chars = Array.from(w.de);
        const answer = chars[pos];
        chars[pos] = "＿";
        pushTask(
          w,
          "missing",
          chars.join("") + " · " + w.tr,
          answer,
          shuffle([...new Set([answer, ..."aein".split("")])]).slice(0, 5),
          {
            direction: "de_only",
            objective: "cloze",
          },
        );
      }
    }
  }

  // Candidate-priority selection: guarantee mistakes/freshUnseen words are covered in priority order
  // before falling back to multiple passes on smaller pools, rotating activity types evenly.
  const limit =
    selected === "mistake_review" ? (options.limit ?? 30) : (options.limit ?? 40);

  if (selected !== "mixed" && selected !== "mistake_review") {
    const group = byType.get(selected) ?? [];
    return [...group].sort((a, b) => Number(options.recentQuestionKeys?.has(questionKey(a)) || false) - Number(options.recentQuestionKeys?.has(questionKey(b)) || false)).slice(0, limit);
  }

  const keys =
    selected === "mistake_review"
      ? ["choice", "article", "gap", "translation", "listening", "conjugation", "sentence_completion"]
      : activities.map((a) => a[0]).filter((k) => k !== "mistake_review" && byType.has(k));

  if (!keys.length) return [];

  const result: Task[] = [];
  const usedFingerprints = new Set<string>();
  const usedWordTypes = new Map<string, Set<string>>();
  let keyCursor = randomInt(keys.length);

  // Multiple passes: Pass 0 covers each candidate once in exact priority order;
  // subsequent passes only run if fewer unique candidates exist than `limit`.
  for (const freshOnly of [true, false]) {
  for (let pass = 0; pass < keys.length && result.length < limit; pass++) {
    let addedInPass = false;
    for (const w of candidates) {
      if (result.length >= limit) break;
      const wordMap = byWordAndType.get(w.id);
      if (!wordMap || wordMap.size === 0) continue;
      const tried = usedWordTypes.get(w.id) ?? new Set<string>();
      for (let step = 0; step < keys.length; step++) {
        const k = keys[(keyCursor + step) % keys.length];
        if (tried.has(k)) continue;
        const candidateTask = wordMap.get(k);
        if (!candidateTask || usedFingerprints.has(candidateTask.fingerprint)) continue;
        if (freshOnly && options.recentQuestionKeys?.has(questionKey(candidateTask))) continue;
        usedFingerprints.add(candidateTask.fingerprint);
        tried.add(k);
        usedWordTypes.set(w.id, tried);
        result.push(
          selected === "mistake_review"
            ? { ...candidateTask, isMistakeReview: true }
            : candidateTask,
        );
        keyCursor = (keyCursor + step + 1) % keys.length;
        addedInPass = true;
        break;
      }
    }
    if (!addedInPass) break;
  }

  }
  return result.slice(0, limit);
}

/**
 * Generates an optional reverse-direction reinforcement session using the EXACT same
 * learning material from a completed parent practice session.
 * - Prioritizes missed/skipped parent items first, then shuffles the remaining parent set.
 * - Flips direction (de_tr <-> tr_de; or flips each item's dominant parent direction for mixed).
 * - Replaces grammar-only items (article/conjugation) with meaningful active recall/usage tasks
 *   for those exact nouns/verbs rather than fabricating nonsensical mirrored prompts.
 */
export function buildReinforcementActivities(input: {
  parentTasks: Task[];
  parentResults: Record<string, { score: number | null; skipped?: boolean }>;
  parentDirection: StudyDirection;
  scopedWords: Vocabulary[];
  distractorUniverse: Vocabulary[];
  limit?: number;
}): { tasks: Task[]; targetDirection: StudyDirection } {
  const {
    parentTasks,
    parentResults,
    parentDirection,
    scopedWords,
    distractorUniverse,
    limit = 10,
  } = input;

  const targetDirection = oppositeStudyDirection(parentDirection);
  if (!scopedWords.length || !parentTasks.length) {
    return { tasks: [], targetDirection };
  }

  const wrongWordIds = new Set<string>();
  const skippedWordIds = new Set<string>();
  const dominantParentDirByWord = new Map<string, "de_tr" | "tr_de">();
  const parentTypesByWord = new Map<string, Set<string>>();

  for (const t of parentTasks) {
    const r = parentResults[t.id];
    const isExplicitWrong = Boolean(r && !r.skipped && r.score !== null && r.score < 0.8);
    const isSkipped = !r || r.skipped || r.score === null;
    const inferredDir: "de_tr" | "tr_de" =
      t.direction === "de_tr" || t.direction === "tr_de"
        ? t.direction
        : t.prompt.includes("Almanca karşılığı") ||
            t.prompt.startsWith("Almanca yaz") ||
            t.prompt.includes("Almancaya çevir") ||
            t.type === "ordering"
          ? "tr_de"
          : "de_tr";

    for (const wid of t.vocabularyIds) {
      if (isExplicitWrong) wrongWordIds.add(wid);
      else if (isSkipped) skippedWordIds.add(wid);
      if (!dominantParentDirByWord.has(wid)) {
        dominantParentDirByWord.set(wid, inferredDir);
      }
      const typeSet = parentTypesByWord.get(wid) ?? new Set<string>();
      typeSet.add(t.type);
      parentTypesByWord.set(wid, typeSet);
    }
  }

  // Determine exact opposite direction per word
  const forceDirMap = new Map<string, "de_tr" | "tr_de">();
  for (const w of scopedWords) {
    if (parentDirection === "tr_de") {
      forceDirMap.set(w.id, "de_tr");
    } else if (parentDirection === "de_tr") {
      forceDirMap.set(w.id, "tr_de");
    } else {
      const prevDir = dominantParentDirByWord.get(w.id) ?? "tr_de";
      forceDirMap.set(w.id, prevDir === "tr_de" ? "de_tr" : "tr_de");
    }
  }

  // Order exact parent words: explicitly wrong first, skipped second, passed third (each tier shuffled)
  const wrongWords = shuffle(scopedWords.filter((w) => wrongWordIds.has(w.id)));
  const skippedWords = shuffle(
    scopedWords.filter((w) => !wrongWordIds.has(w.id) && skippedWordIds.has(w.id)),
  );
  const passedWords = shuffle(
    scopedWords.filter((w) => !wrongWordIds.has(w.id) && !skippedWordIds.has(w.id)),
  );
  const orderedParentWords = [...wrongWords, ...skippedWords, ...passedWords];
  const parentIdSet = new Set(orderedParentWords.map((w) => w.id));
  const missedWordIds = new Set([...wrongWordIds, ...skippedWordIds]);

  // Build candidate pool with exact parent words + full level distractors,
  // then filter strictly so generated tasks ONLY test the parent session's words!
  const combinedPool = uniqueById([...orderedParentWords, ...distractorUniverse]);
  const generatedAll = buildActivities(combinedPool, "mixed", targetDirection, {
    mistakeWordIds: missedWordIds,
    forceDirectionByWordId: forceDirMap,
    limit: 120,
  });

  // Restrict to tasks whose tested vocabulary comes strictly from parentIdSet
  // (for matching, keep only if at least the primary word or all paired words are from parentIdSet;
  // prefer all words in parentIdSet when >= 3 parent words exist)
  const strictlyParent = generatedAll.filter((t) => {
    if (t.vocabularyIds.length === 1) {
      return parentIdSet.has(t.vocabularyIds[0]);
    }
    if (parentIdSet.size >= 3) {
      return t.vocabularyIds.every((id) => parentIdSet.has(id));
    }
    return parentIdSet.has(t.vocabularyIds[0]);
  });

  // Pick 1 meaningful reverse/complementary task per parent word cleanly!
  // Avoid repeating grammar-only article/conjugation when a bilingual meaning/production task exists.
  const picked: Task[] = [];
  const usedFingerprints = new Set<string>();
  const rankTaskForWord = (t: Task, wid: string): number => {
    const prevTypes = parentTypesByWord.get(wid) ?? new Set<string>();
    const targetDir = forceDirMap.get(wid);
    let score = 0;
    if (t.direction === targetDir) score += 20;
    if (!prevTypes.has(t.type)) score += 10;
    // Prefer rich active/meaning tasks over pure article/conjugation in reinforcement
    if (["choice", "translation", "sentence_translation", "ordering", "listening", "matching"].includes(t.type)) {
      score += 8;
    }
    if (prevTypes.has("article") && (t.type === "translation" || t.type === "choice")) {
      score += 12;
    }
    if (prevTypes.has("conjugation") && (t.type === "sentence_completion" || t.type === "choice" || t.type === "translation")) {
      score += 12;
    }
    return score;
  };

  for (const w of orderedParentWords) {
    const wordTasks = strictlyParent
      .filter((t) => t.vocabularyIds.includes(w.id) && !usedFingerprints.has(t.fingerprint))
      .sort((a, b) => rankTaskForWord(b, w.id) - rankTaskForWord(a, w.id));
    if (wordTasks[0]) {
      picked.push(wordTasks[0]);
      usedFingerprints.add(wordTasks[0].fingerprint);
    }
    if (picked.length >= limit) break;
  }

  return {
    tasks: picked.slice(0, limit),
    targetDirection,
  };
}
