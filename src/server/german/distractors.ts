import {
  studyLevels,
  type CefrLevel,
  type DistractorDifficulty,
} from "../../shared/germanActivities";
import { classifyWordIntoHierarchy } from "./curriculumHierarchy";
import { normalizeText, type Vocabulary } from "./learning";

export type ConcreteDifficulty = "easy" | "normal" | "challenging";

export interface DistractorSelectionOptions {
  target: Vocabulary;
  pool: Vocabulary[];
  direction: "tr_de" | "de_tr";
  difficulty?: DistractorDifficulty;
  masteryStreak?: number;
  count?: number;
  seed?: string;
}

export interface DistractorSelectionResult {
  options: string[];
  correctAnswer: string;
  distractors: string[];
  resolvedDifficulty: ConcreteDifficulty;
  contextHint?: string;
}

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deterministicShuffle<T>(arr: T[], seedStr: string): T[] {
  const out = [...arr];
  let seed = deterministicHash(seedStr) || 123456789;
  for (let i = out.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function resolveAdaptiveDifficulty(
  requested: DistractorDifficulty | undefined,
  masteryStreak = 0,
): ConcreteDifficulty {
  if (requested === "easy" || requested === "normal" || requested === "challenging") {
    return requested;
  }
  if (masteryStreak >= 3) return "challenging";
  if (masteryStreak >= 1) return "normal";
  return "easy";
}

function levelIndex(lvl: string): number {
  const idx = studyLevels.indexOf(lvl as CefrLevel);
  return idx >= 0 ? idx : 0;
}

function splitTranslationTokens(tr: string): string[] {
  return tr
    .split(/[,;/]| veya | ya da /i)
    .map((s) => normalizeText(s.replace(/\([^)]*\)/g, "")))
    .filter((s) => s.length >= 2);
}

function stripGermanArticle(de: string): string {
  return normalizeText(de.replace(/^(der|die|das)\s+/i, ""));
}

/**
 * Checks whether a candidate vocabulary item could be a valid synonym, translation overlap,
 * or orthographically indistinguishable variant of the target word.
 */
export function isAmbiguousOrSynonymCandidate(target: Vocabulary, candidate: Vocabulary): boolean {
  if (target.id === candidate.id) return true;
  if (normalizeText(target.de) === normalizeText(candidate.de)) return true;
  if (normalizeText(target.tr) === normalizeText(candidate.tr)) return true;
  if (stripGermanArticle(target.de) === stripGermanArticle(candidate.de)) return true;

  const targetTrSet = new Set([
    normalizeText(target.tr),
    ...splitTranslationTokens(target.tr),
    ...(target.alternatives ?? []).map((a) => normalizeText(a)),
  ]);
  const candTrList = [
    normalizeText(candidate.tr),
    ...splitTranslationTokens(candidate.tr),
    ...(candidate.alternatives ?? []).map((a) => normalizeText(a)),
  ];

  for (const ct of candTrList) {
    if (!ct) continue;
    if (targetTrSet.has(ct)) return true;
    for (const tt of targetTrSet) {
      if (tt.length >= 4 && ct.length >= 4 && (tt === ct || tt.includes(ct) || ct.includes(tt))) {
        return true;
      }
    }
  }

  return false;
}

function inferPosGroup(word: Vocabulary): string {
  const rawPos = (word.pos || "").toLowerCase();
  if (rawPos.includes("verb") || rawPos.includes("fiil")) return "verb";
  if (rawPos.includes("isim") || rawPos.includes("noun") || word.article || /^(der|die|das)\s+/i.test(word.de)) {
    return "noun";
  }
  if (rawPos.includes("sıfat") || rawPos.includes("adj")) return "adjective";
  if (rawPos.includes("zarf") || rawPos.includes("adv")) return "adverb";
  if (rawPos.includes("bağlaç") || rawPos.includes("edat") || rawPos.includes("zamir")) return "connector";
  if (rawPos.includes("ifade") || rawPos.includes("kalıp") || word.de.trim().includes(" ")) return "phrase";

  const deTrim = word.de.trim();
  if (/^[A-ZÄÖÜ][a-zäöüß]+$/.test(deTrim)) return "noun";
  if (/(en|eln|ern)$/i.test(deTrim) && /^[a-zäöüß]+$/.test(deTrim)) return "verb";
  return "general";
}

function editSimilarity(a: string, b: string): number {
  const s1 = stripGermanArticle(a);
  const s2 = stripGermanArticle(b);
  if (!s1 || !s2) return 0;
  let shared = 0;
  const minLen = Math.min(s1.length, s2.length);
  for (let i = 0; i < minLen; i++) {
    if (s1[i] === s2[i]) shared++;
  }
  const suffixMatch = s1.slice(-2) === s2.slice(-2) ? 0.25 : 0;
  return shared / Math.max(s1.length, s2.length) + suffixMatch;
}

const DOMAIN_FALLBACK_BANK: Array<{
  de: string;
  tr: string;
  posGroup: string;
  categoryId: string;
  level: CefrLevel;
}> = [
  // Nouns - Home & Household
  { de: "der Kühlschrank", tr: "buzdolabı", posGroup: "noun", categoryId: "home_living", level: "A1" },
  { de: "die Waschmaschine", tr: "çamaşır makinesi", posGroup: "noun", categoryId: "home_living", level: "A2" },
  { de: "der Staubsauger", tr: "elektrikli süpürge", posGroup: "noun", categoryId: "home_living", level: "A2" },
  { de: "die Spülmaschine", tr: "bulaşık makinesi", posGroup: "noun", categoryId: "home_living", level: "A2" },
  { de: "der Backofen", tr: "fırın", posGroup: "noun", categoryId: "home_living", level: "A2" },
  { de: "das Wohnzimmer", tr: "oturma odası", posGroup: "noun", categoryId: "home_living", level: "A1" },
  // Nouns - Food & Drink
  { de: "das Frühstück", tr: "kahvaltı", posGroup: "noun", categoryId: "food_drink", level: "A1" },
  { de: "das Abendessen", tr: "akşam yemeği", posGroup: "noun", categoryId: "food_drink", level: "A1" },
  { de: "die Speisekarte", tr: "menü", posGroup: "noun", categoryId: "food_drink", level: "A2" },
  { de: "das Mineralwasser", tr: "maden suyu", posGroup: "noun", categoryId: "food_drink", level: "A1" },
  // Nouns - Travel & Transport
  { de: "der Bahnhof", tr: "tren istasyonu", posGroup: "noun", categoryId: "travel_transport", level: "A1" },
  { de: "der Flughafen", tr: "havalimanı", posGroup: "noun", categoryId: "travel_transport", level: "A1" },
  { de: "die Fahrkarte", tr: "bilet", posGroup: "noun", categoryId: "travel_transport", level: "A1" },
  { de: "die Haltestelle", tr: "durak", posGroup: "noun", categoryId: "travel_transport", level: "A1" },
  // Nouns - Work & Education
  { de: "die Besprechung", tr: "toplantı", posGroup: "noun", categoryId: "work_career", level: "B1" },
  { de: "die Bewerbung", tr: "iş başvurusu", posGroup: "noun", categoryId: "work_career", level: "B1" },
  { de: "die Erfahrung", tr: "deneyim", posGroup: "noun", categoryId: "work_career", level: "B1" },
  { de: "die Verantwortung", tr: "sorumluluk", posGroup: "noun", categoryId: "society_culture", level: "B2" },
  // Verbs
  { de: "einkaufen", tr: "alışveriş yapmak", posGroup: "verb", categoryId: "shopping_finance", level: "A1" },
  { de: "bezahlen", tr: "ödemek", posGroup: "verb", categoryId: "shopping_finance", level: "A1" },
  { de: "bestellen", tr: "sipariş vermek", posGroup: "verb", categoryId: "food_drink", level: "A2" },
  { de: "reservieren", tr: "rezervasyon yapmak", posGroup: "verb", categoryId: "travel_transport", level: "A2" },
  { de: "untersuchen", tr: "muayene etmek / incelemek", posGroup: "verb", categoryId: "health_body", level: "B1" },
  { de: "entscheiden", tr: "karar vermek", posGroup: "verb", categoryId: "communication_opinions", level: "B1" },
  { de: "überzeugen", tr: "ikna etmek", posGroup: "verb", categoryId: "communication_opinions", level: "B2" },
  { de: "berücksichtigen", tr: "dikkate almak", posGroup: "verb", categoryId: "academic_advanced", level: "C1" },
  // Adjectives & Adverbs
  { de: "gemütlich", tr: "rahat / sıcak", posGroup: "adjective", categoryId: "home_living", level: "A2" },
  { de: "pünktlich", tr: "dakik", posGroup: "adjective", categoryId: "daily_life", level: "A2" },
  { de: "zuverlässig", tr: "güvenilir", posGroup: "adjective", categoryId: "work_career", level: "B1" },
  { de: "nachhaltig", tr: "sürdürülebilir", posGroup: "adjective", categoryId: "nature_environment", level: "B2" },
  // Phrases
  { de: "Guten Morgen", tr: "Günaydın", posGroup: "phrase", categoryId: "greetings_basics", level: "A1" },
  { de: "Auf Wiedersehen", tr: "Hoşça kalın", posGroup: "phrase", categoryId: "greetings_basics", level: "A1" },
  { de: "Entschuldigung", tr: "Afedersiniz", posGroup: "phrase", categoryId: "greetings_basics", level: "A1" },
  { de: "Vielen Dank", tr: "Çok teşekkürler", posGroup: "phrase", categoryId: "greetings_basics", level: "A1" },
];

/**
 * 10-Step Context-Aware Semantic & Grammatical Distractor Pipeline:
 * 1. Identify Target POS, Category, Subtopic, Semantic Tags, and CEFR Level.
 * 2. Resolve Difficulty Tier (`easy`, `normal`, `challenging`).
 * 3. Filter Pool to exclude the target word, any synonyms, or overlapping translations.
 * 4. Match Part of Speech & Structural Form (e.g. nouns with articles stay with nouns with articles, verbs with verbs).
 * 5. Enforce CEFR Level Appropriateness (never pull C1 academic jargon into A1 beginner choices).
 * 6. Score Semantic Category, Subtopic, and Morphological Affinity according to difficulty tier.
 * 7. Deduplicate normalized surface strings so no two options ever look identical.
 * 8. Backfill from curated domain fallback bank if pool is small.
 * 9. Deterministically shuffle the 4 options while guaranteeing exactly 1 correct answer.
 * 10. Generate disambiguating context hint when helpful.
 */
export function selectSemanticDistractors(opts: DistractorSelectionOptions): DistractorSelectionResult {
  const count = opts.count ?? 3;
  const target = opts.target;
  const direction = opts.direction;
  const correctAnswer = direction === "tr_de" ? target.de : target.tr;
  const resolvedDifficulty = resolveAdaptiveDifficulty(opts.difficulty, opts.masteryStreak ?? 0);

  const targetHierarchy = classifyWordIntoHierarchy({
    de: target.de,
    tr: target.tr,
    topic: target.topic,
    pos: target.pos,
    level: target.level,
    grammar: target.grammar,
    exampleDe: target.exampleDe,
    exampleTr: target.exampleTr,
  });
  const targetCategory = target.categoryId || targetHierarchy.categoryId;
  const targetSubtopic = target.subtopic || targetHierarchy.subtopicTr;
  const targetTags = new Set(
    target.semanticTags?.length ? target.semanticTags : targetHierarchy.semanticTags,
  );
  const targetPosGroup = inferPosGroup(target);
  const targetLvlIdx = levelIndex(target.level);
  const targetHasArticle = /^(der|die|das)\s+/i.test(target.de);

  const scoredCandidates: Array<{ value: string; score: number }> = [];
  const seenValues = new Set<string>([normalizeText(correctAnswer)]);

  for (const cand of opts.pool) {
    if (isAmbiguousOrSynonymCandidate(target, cand)) continue;
    const val = direction === "tr_de" ? cand.de : cand.tr;
    const normVal = normalizeText(val);
    if (!normVal || seenValues.has(normVal)) continue;

    const candPosGroup = inferPosGroup(cand);
    const candLvlIdx = levelIndex(cand.level);
    const levelDiff = Math.abs(targetLvlIdx - candLvlIdx);

    // Never show C1/B2 vocabulary in A1/A2 multiple choice options
    if (targetLvlIdx <= 1 && candLvlIdx > targetLvlIdx + 1) continue;

    const candHierarchy = classifyWordIntoHierarchy({
      de: cand.de,
      tr: cand.tr,
      topic: cand.topic,
      pos: cand.pos,
      level: cand.level,
      article: cand.article ?? "",
      grammar: cand.grammar ?? "",
      exampleDe: cand.exampleDe,
      exampleTr: cand.exampleTr,
    });
    const candCategory = cand.categoryId || candHierarchy.categoryId;
    const candSubtopic = cand.subtopic || candHierarchy.subtopicTr;
    const candTags = cand.semanticTags?.length ? cand.semanticTags : candHierarchy.semanticTags;
    const sharedTagCount = candTags.filter((t) => targetTags.has(t)).length;
    const candHasArticle = /^(der|die|das)\s+/i.test(cand.de);

    let score = 0;

    // 1. Grammatical / POS alignment is mandatory for realistic options
    if (candPosGroup === targetPosGroup) {
      score += 45;
    } else if (
      (targetPosGroup === "adjective" && candPosGroup === "adverb") ||
      (targetPosGroup === "adverb" && candPosGroup === "adjective")
    ) {
      score += 20;
    } else {
      score -= 25;
    }

    if (direction === "tr_de" && targetHasArticle === candHasArticle) {
      score += 18;
    }
    if (direction === "tr_de" && targetHasArticle && candHasArticle && target.article && cand.article === target.article) {
      score += resolvedDifficulty === "challenging" ? 12 : 5;
    }

    // 2. CEFR proximity
    if (levelDiff === 0) score += 22;
    else if (levelDiff === 1) score += 10;
    else score -= levelDiff * 12;

    // 3. Semantic proximity tuned by difficulty tier
    const sameCategory = candCategory === targetCategory;
    const sameSubtopic = candSubtopic === targetSubtopic;

    if (resolvedDifficulty === "challenging") {
      // Challenging: closely related subtopic, shared semantic tags, and similar word length/morphology
      if (sameCategory) score += 35;
      if (sameSubtopic) score += 25;
      score += sharedTagCount * 14;
      score += Math.round(editSimilarity(target.de, cand.de) * 20);
    } else if (resolvedDifficulty === "normal") {
      // Normal: same semantic category and POS, clearly distinct meaning
      if (sameCategory) score += 32;
      if (sameSubtopic) score += 14;
      score += sharedTagCount * 10;
    } else {
      // Easy: same POS and same level, preferably same or neighboring everyday category without tricky lookalikes
      if (sameCategory) score += 18;
      if (editSimilarity(target.de, cand.de) > 0.65) score -= 20;
    }

    // Small deterministic tie-breaker
    const tie = (deterministicHash(`${opts.seed || target.id}:${cand.id}`) % 100) / 100;
    scoredCandidates.push({ value: val, score: score + tie });
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  const distractors: string[] = [];
  for (const item of scoredCandidates) {
    if (distractors.length >= count) break;
    const norm = normalizeText(item.value);
    if (seenValues.has(norm)) continue;
    seenValues.add(norm);
    distractors.push(item.value);
  }

  // Curated domain fallback if pool was tiny
  if (distractors.length < count) {
    const fallbackSorted = [...DOMAIN_FALLBACK_BANK].sort((a, b) => {
      const aScore =
        (a.posGroup === targetPosGroup ? 30 : 0) +
        (a.categoryId === targetCategory ? 20 : 0) -
        Math.abs(levelIndex(a.level) - targetLvlIdx) * 8;
      const bScore =
        (b.posGroup === targetPosGroup ? 30 : 0) +
        (b.categoryId === targetCategory ? 20 : 0) -
        Math.abs(levelIndex(b.level) - targetLvlIdx) * 8;
      return bScore - aScore;
    });

    for (const fb of fallbackSorted) {
      if (distractors.length >= count) break;
      const val = direction === "tr_de" ? fb.de : fb.tr;
      const norm = normalizeText(val);
      if (seenValues.has(norm)) continue;
      if (normalizeText(fb.de) === normalizeText(target.de) || normalizeText(fb.tr) === normalizeText(target.tr)) {
        continue;
      }
      seenValues.add(norm);
      distractors.push(val);
    }
  }

  const allOptions = deterministicShuffle(
    [correctAnswer, ...distractors.slice(0, count)],
    `${opts.seed || target.id}:${direction}:${resolvedDifficulty}`,
  );

  const contextHint = buildContextualHint(target, targetHierarchy.subtopicTr);

  return {
    options: allOptions,
    correctAnswer,
    distractors: distractors.slice(0, count),
    resolvedDifficulty,
    contextHint,
  };
}

function buildContextualHint(word: Vocabulary, subtopicTr: string): string {
  const parts: string[] = [];
  if (subtopicTr) parts.push(subtopicTr);
  if (word.pos) parts.push(word.pos);
  if (word.grammar) parts.push(word.grammar);
  return parts.join(" • ");
}
