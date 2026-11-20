import { randomInt, randomUUID } from "node:crypto";
import {
  activities,
  isCefrLevel,
  type StudyDirection,
} from "../../shared/germanActivities";
import { normalize, type Task, type Vocabulary } from "./learning";

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

function maskTargetInSentence(sentence: string, target: string): { masked: string; answer: string } | null {
  const cleanTarget = target.replace(/^(?:der|die|das)\s+/iu, "").trim();
  if (cleanTarget.length >= 2) {
    const wordRegex = new RegExp(`(?<![\\p{L}])(${escapeRegExp(cleanTarget)})(?![\\p{L}])`, "iu");
    const m = sentence.match(wordRegex);
    if (m && m[1]) {
      return {
        masked: sentence.replace(wordRegex, "_____"),
        answer: m[1],
      };
    }
  }
  const tokens = sentence.split(/\s+/u);
  const idx = tokens.findIndex((tok, i) => i > 0 && /^[\p{L}]{3,}[.!?]?$/u.test(tok));
  if (idx < 0) return null;
  const rawTok = tokens[idx].replace(/[.!?,;:]+$/u, "");
  const punct = tokens[idx].slice(rawTok.length);
  const maskedTokens = [...tokens];
  maskedTokens[idx] = "_____" + punct;
  return { masked: maskedTokens.join(" "), answer: rawTok };
}

export interface BuildActivityOptions {
  mistakeWordIds?: Set<string>;
  reviewMode?: boolean;
  limit?: number;
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
  if (selected === "mistake_review") {
    if (!mistakePool.length) return [];
    baseSource = mistakePool;
  }

  let candidates: Vocabulary[];
  if (selected === "article") {
    candidates = baseSource.filter(hasArticleNoun).slice(0, 20);
  } else if (selected === "conjugation") {
    candidates = baseSource.filter((w) => !!w.conjugation).slice(0, 20);
  } else if (selected === "sentence_completion") {
    candidates = baseSource.filter((w) => !!w.completion || hasSentenceContent(w)).slice(0, 20);
  } else if (selected === "sentence_translation" || selected.startsWith("sentence_")) {
    candidates = baseSource.filter(hasSentenceContent).slice(0, 20);
  } else if (selected === "ordering") {
    candidates = baseSource
      .filter((w) => hasSentenceContent(w) || w.de.trim().split(/\s+/u).length >= 3)
      .slice(0, 20);
  } else if (selected === "gap") {
    candidates = baseSource.filter(hasSentenceContent).slice(0, 20);
  } else if (selected === "multi") {
    candidates = baseSource.filter((w) => w.tr.includes("/")).slice(0, 20);
  } else {
    candidates = baseSource.slice(0, 20);
  }

  if (selected === "mixed") {
    candidates = uniqueById([
      ...candidates,
      ...baseSource.filter(hasSentenceContent).slice(0, 6),
      ...baseSource.filter(hasArticleNoun).slice(0, 6),
      ...baseSource.filter((w) => !!w.conjugation).slice(0, 4),
      ...baseSource.filter((w) => !!w.completion).slice(0, 4),
    ]);
  }

  if (!candidates.length) return [];

  // Distractor pool STRICTLY bounded to the validated, level-filtered `words` list!
  const distractorPool = uniqueById([...words.slice(0, 48), ...candidates]);
  const byType = new Map<string, Task[]>();

  const add = (
    w: Vocabulary,
    type: string,
    prompt: string,
    answer: string,
    opts: string[] = [],
    interaction?: Task["interaction"],
    alternatives: string[] = [],
    explanation?: string,
    passage = "",
  ) => {
    const task: Task = {
      id: randomUUID(),
      module: "vocabulary",
      type,
      part: 1,
      level: w.level,
      topic: w.topic,
      prompt,
      passage,
      options: opts,
      answer,
      alternatives: [...alternatives, ...(w.alternatives ?? [])].filter(Boolean),
      explanation: explanation || `${w.de} — ${w.tr}`,
      vocabularyIds: [w.id],
      evidence: "",
      fingerprint: randomUUID(),
      interaction: {
        ...interaction,
        wordMeta: makeWordMeta(w),
      },
    };
    byType.set(type, [...(byType.get(type) ?? []), task]);
  };

  for (const w of candidates) {
    const reverse =
      direction === "tr_de" || (direction === "mixed" && randomInt(2) === 1);
    const source = reverse ? w.tr : w.de;
    const target = reverse ? w.de : w.tr;
    const meanings = w.tr.split(/\s*\/\s*/u).filter(Boolean);
    const other = shuffle(
      distractorPool.filter(
        (v) =>
          v.id !== w.id &&
          !meanings.some((m) => normalize(v.tr).includes(normalize(m))) &&
          normalize(v.de) !== normalize(w.de),
      ),
    );

    // 1. Multiple-choice translation
    if (other.length >= 2) {
      const choiceDistractors = other
        .slice(0, 3)
        .map((v) => (reverse ? v.de : v.tr));
      const uniqueOpts = [...new Set([target, ...choiceDistractors])];
      if (uniqueOpts.length >= 3) {
        add(
          w,
          "choice",
          reverse
            ? `“${source}” ifadesinin Almanca karşılığı hangisidir?`
            : `“${source}” Almanca kelimesinin Türkçe anlamı nedir?`,
          target,
          shuffle(uniqueOpts),
        );
      }

      // 2. Interactive Vocabulary Matching (3 pairs)
      const group = [w, ...other.slice(0, 2)];
      if (
        new Set(group.map((v) => normalize(v.tr))).size === group.length &&
        new Set(group.map((v) => normalize(v.de))).size === group.length
      ) {
        const left = group.map((v) => v.de);
        const right = shuffle(group.map((v) => v.tr));
        add(
          w,
          "matching",
          "Almanca kelimeleri doğru Türkçe anlamlarıyla eşleştir.",
          JSON.stringify(group.map((v) => v.tr)),
          [],
          { left, right },
          [],
          group.map((g) => `${g.de} = ${g.tr}`).join(" · "),
        );
      }

      // Legacy compatibility task types when specifically requested
      if (selected === "true_false") {
        const wrong = other[0];
        const truth = randomInt(2) === 1;
        add(
          w,
          "true_false",
          `${w.de} = ${truth ? w.tr : wrong.tr}`,
          truth ? "Doğru" : "Yanlış",
          ["Doğru", "Yanlış"],
        );
      }
      if (selected === "intruder") {
        const wrong = other[0];
        const bad = `${w.de} → ${wrong.tr}`;
        add(
          w,
          "intruder",
          "Hangi eşleştirme yanlış?",
          bad,
          shuffle([bad, ...other.slice(0, 2).map((v) => `${v.de} → ${v.tr}`)]),
        );
      }
      if (selected === "multi" && meanings.length >= 2 && meanings.length <= 4) {
        add(
          w,
          "multi",
          `“${w.de}” için geçerli olan tüm anlamları seç.`,
          [...meanings].sort().join(" | "),
          shuffle([...meanings, ...other.slice(0, 2).map((v) => v.tr)]),
        );
      }
    }

    // 3. Article Practice (der / die / das)
    if (hasArticleNoun(w)) {
      const bareNoun = w.de.replace(/^(der|die|das)\s+/u, "");
      const article = w.de.split(/\s+/u)[0];
      add(
        w,
        "article",
        `_____ ${bareNoun} (${w.tr})`,
        article,
        ["der", "die", "das"],
        undefined,
        [],
        `Doğru artikel: ${w.de} (${w.tr})${w.grammar ? " · " + w.grammar : ""}`,
      );
    }

    // 4. Verb Conjugation (CEFR-tailored)
    if (w.conjugation) {
      const c = w.conjugation;
      add(
        w,
        "conjugation",
        `${c.promptDe}`,
        c.answer,
        shuffle([...new Set([c.answer, ...c.options])]),
        undefined,
        [],
        c.explanation,
        `${c.tense} · Özne: ${c.pronoun}`,
      );
    }

    // 5. Fill in the Blank (gap)
    const sentencePair = getSentencePair(w);
    if (sentencePair) {
      const masked = maskTargetInSentence(sentencePair.de, w.de);
      if (masked) {
        const sameLevelWords = distractorPool
          .flatMap((v) => v.de.split(/\s+/u))
          .map((tok) => tok.replace(/[.!?,;:]+$/u, ""))
          .filter(
            (t) =>
              /^[\p{L}]{2,}$/u.test(t) &&
              !/^(der|die|das)$/iu.test(t) &&
              normalize(t) !== normalize(masked.answer),
          );
        const uniqDist = [...new Set(sameLevelWords)];
        const gapOpts =
          uniqDist.length >= 3
            ? shuffle([masked.answer, ...shuffle(uniqDist).slice(0, 3)])
            : [];
        add(
          w,
          "gap",
          `${masked.masked}`,
          masked.answer,
          gapOpts,
          undefined,
          [],
          `${sentencePair.de} — ${sentencePair.tr}`,
          sentencePair.tr,
        );
      }

      // 6. Sentence Translation (CEFR-accurate)
      const sSource = reverse ? sentencePair.tr : sentencePair.de;
      const sTarget = reverse ? sentencePair.de : sentencePair.tr;
      add(
        w,
        "sentence_translation",
        reverse
          ? `Bu cümleyi Almancaya çevir: “${sSource}”`
          : `Bu cümleyi Türkçeye çevir: “${sSource}”`,
        sTarget,
        [],
        undefined,
        [],
        `${sentencePair.de} — ${sentencePair.tr}`,
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
        add(
          w,
          "ordering",
          `Kelimeleri doğru Almanca sıraya diz: “${orderSource.tr}”`,
          orderSource.de,
          [],
          { tiles: shuffle(tokens) },
          [],
          `${orderSource.de} — ${orderSource.tr}`,
        );
        if (selected === "sentence_ordering") {
          add(
            w,
            "sentence_ordering",
            `Almanca cümleyi kur: ${orderSource.tr}`,
            orderSource.de,
            [],
            { tiles: shuffle(tokens) },
          );
        }
      }
    }

    // 8. Sentence Completion
    if (w.completion) {
      const cmp = w.completion;
      add(
        w,
        "sentence_completion",
        cmp.stem,
        cmp.answer,
        shuffle([cmp.answer, ...cmp.distractors]),
        undefined,
        [],
        cmp.explanation,
        cmp.trHint,
      );
    } else if (sentencePair && other.length >= 3) {
      // Fallback sentence completion strictly using same-level words when explicit completion metadata isn't set
      const masked = maskTargetInSentence(sentencePair.de, w.de);
      if (masked) {
        const cleanBare = (v: Vocabulary) => v.de.replace(/^(?:der|die|das)\s+/iu, "");
        const dist = shuffle(other)
          .map(cleanBare)
          .filter((d) => normalize(d) !== normalize(masked.answer) && !d.includes(" "))
          .slice(0, 3);
        if (dist.length >= 2) {
          add(
            w,
            "sentence_completion",
            masked.masked,
            masked.answer,
            shuffle([masked.answer, ...dist]),
            undefined,
            [],
            `${sentencePair.de} — ${sentencePair.tr}`,
            sentencePair.tr,
          );
        }
      }
    }

    // 9. Listening Exercise (with audioText & replay support)
    if (other.length >= 2) {
      const spokenText = sentencePair?.de ?? w.de;
      const isSentenceAudio = spokenText === sentencePair?.de && spokenText !== w.de;
      const expectedListening = isSentenceAudio ? sentencePair!.tr : w.tr;
      const distOpts = shuffle(other)
        .slice(0, 3)
        .map((v) => (isSentenceAudio && v.exampleTr ? v.exampleTr : v.tr));
      const uniqListenOpts = [...new Set([expectedListening, ...distOpts])];
      if (uniqListenOpts.length >= 3) {
        add(
          w,
          "listening",
          "Almanca telaffuzu dinle ve doğru Türkçe karşılığı seç.",
          expectedListening,
          shuffle(uniqListenOpts),
          {
            audioText: spokenText,
            audioLang: "de-DE",
            hintTr: isSentenceAudio ? undefined : w.topic,
          },
          [],
          `${spokenText} — ${expectedListening}`,
        );
      }
    }

    // 10. Direct Word Translation (typing)
    add(
      w,
      "translation",
      reverse
        ? `Almanca yaz: “${source}”`
        : `Türkçe yaz: “${source}”`,
      target,
      [],
      undefined,
      reverse && w.article ? [w.de.replace(/^(der|die|das)\s+/u, "")] : [],
    );

    if (selected === "spelling" && w.de.length <= 32) {
      add(
        w,
        "spelling",
        `Harflerle oluştur: ${w.tr}`,
        w.de,
        [],
        { tiles: shuffle(Array.from(w.de)) },
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
        add(
          w,
          "missing",
          chars.join("") + " · " + w.tr,
          answer,
          shuffle([...new Set([answer, ..."aein".split("")])]).slice(0, 5),
        );
      }
    }
  }

  // Round-robin mixing across available activity types for engaging variety
  if (selected === "mistake_review") {
    const reviewTypes = ["choice", "article", "gap", "translation", "listening", "conjugation"];
    const pool: Task[] = [];
    for (let i = 0; i < candidates.length; i++) {
      for (const rt of reviewTypes) {
        const g = byType.get(rt);
        if (g && i < g.length) {
          pool.push({ ...g[i], type: "mistake_review" });
        }
      }
    }
    return pool.slice(0, options.limit ?? 30);
  }

  const keys =
    selected === "mixed"
      ? activities.map((a) => a[0]).filter((k) => k !== "mistake_review")
      : [selected];
  const result: Task[] = [];
  const usedPromptFingerprints = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    keys.forEach((key, offset) => {
      const group = byType.get(key);
      if (group && group.length > 0) {
        const idx = (i + offset) % group.length;
        const t = group[idx];
        const pKey = `${t.type}:${t.vocabularyIds.join(",")}:${t.prompt}`;
        if (i < group.length && !usedPromptFingerprints.has(pKey)) {
          usedPromptFingerprints.add(pKey);
          result.push(t);
        }
      }
    });
  }

  return result.slice(0, options.limit ?? 40);
}
