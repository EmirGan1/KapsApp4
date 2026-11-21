import { createHash } from "node:crypto";
import { Client } from "@libsql/client";
import { CefrLevel } from "./cefr.ts";
import { Task, Vocabulary, normalizeText } from "./learning.ts";
import { SatzbauMode, SATZBAU_MODE_LABELS } from "../../shared/germanActivities.ts";
import { deterministicShuffle } from "./distractors.ts";
import { classifyWordIntoHierarchy } from "./curriculumHierarchy.ts";

export interface SatzbauItemSpec {
  sentenceDe: string;
  sentenceTr: string;
  alternativesDe: string[];
  tokens: string[];
  distractorTokens: string[];
  flawedSentenceDe: string;
  grammarExplanationTr: string;
  grammarFocus: string;
}

export interface SatzbauReviewResult {
  needsReview?: boolean;
  isValid: boolean;
  score: number;
  feedbackTr: string;
  correctedSentenceDe: string;
  alternativeSentenceDe: string;
  grammarRuleTr: string;
  targetWordUsed: boolean;
  wordOrderValid: boolean;
  source: "deterministic" | "ai" | "cache";
  isCorrect?: boolean;
  correctedDe?: string;
  alternativeDe?: string;
  grammarExplanationTr?: string;
  ruleTipTr?: string;
}

function stripArticle(de: string): { article: "der" | "die" | "das" | ""; bare: string } {
  const m = de.trim().match(/^(der|die|das)\s+(.+)$/i);
  if (!m) return { article: "", bare: de.trim() };
  return {
    article: m[1].toLowerCase() as "der" | "die" | "das",
    bare: m[2].trim(),
  };
}

function tokenizeGermanSentence(sentence: string): string[] {
  return sentence
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function cleanSentencePunctuation(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "")
    .trim();
}

export function normalizeGermanSentenceForComparison(s: string): string {
  return cleanSentencePunctuation(s)
    .toLowerCase()
    .replace(/[„“"']/g, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generates level-appropriate, natural German sentence specs with valid alternative word orders
 * (e.g. Time-first inversion vs Subject-first V2 order) and a validated single-error sentence for Mode E.
 */
export function buildSatzbauSpecForWord(word: Vocabulary, pool: Vocabulary[] = []): SatzbauItemSpec {
  const level = (word.level || "A1") as CefrLevel;
  const hierarchy = classifyWordIntoHierarchy({
    de: word.de,
    tr: word.tr,
    topic: word.topic,
    pos: word.pos,
    level: word.level,
    article: word.article ?? "",
    grammar: word.grammar,
    exampleDe: word.exampleDe,
    exampleTr: word.exampleTr,
  });

  const { article, bare } = stripArticle(word.de);
  const trClean = word.tr.split(/[,;/]/)[0].trim();
  const isNoun = Boolean(article) || (word.pos || "").toLowerCase().includes("isim") || /^[A-ZÄÖÜ][a-zäöüß-]+$/.test(bare);
  const isVerb =
    !isNoun &&
    ((word.pos || "").toLowerCase().includes("fiil") ||
      (word.pos || "").toLowerCase().includes("verb") ||
      /(en|eln|ern)$/i.test(bare));
  const isAdj =
    !isNoun &&
    !isVerb &&
    ((word.pos || "").toLowerCase().includes("sıfat") ||
      (word.pos || "").toLowerCase().includes("zarf"));

  // Check if word already has a clean, authentic example sentence (4 to 13 words)
  if (word.exampleDe && word.exampleTr) {
    const exDe = word.exampleDe.trim();
    const exTr = word.exampleTr.trim();
    const exTokens = tokenizeGermanSentence(exDe);
    if (exTokens.length >= 4 && exTokens.length <= 13 && !exDe.startsWith("TR:")) {
      const alts = deriveGermanWordOrderAlternatives(exDe);
      const flawed = buildSingleGrammarError(exDe, word);
      const distractors = pickGrammaticalDistractorTokens(exTokens, word, pool);
      return {
        sentenceDe: exDe,
        sentenceTr: exTr,
        alternativesDe: alts,
        tokens: exTokens,
        distractorTokens: distractors,
        flawedSentenceDe: flawed.flawedSentence,
        grammarExplanationTr: flawed.explanationTr,
        grammarFocus: flawed.grammarFocus,
      };
    }
  }

  let sentenceDe = "";
  let sentenceTr = "";
  let alternativesDe: string[] = [];
  let flawedSentenceDe = "";
  let grammarExplanationTr = "";
  let grammarFocus = "V2 Fiil Konumu ve Cümle Dizilimi";

  if (isNoun) {
    const defArt = article || "das";
    const accArt = defArt === "der" ? "den" : defArt;
    const datArt = defArt === "der" || defArt === "das" ? "dem" : "der";

    if (level === "A1") {
      if (hierarchy.categoryId === "food_drink") {
        sentenceDe = `Ich kaufe heute ${accArt} ${bare} im Supermarkt.`;
        sentenceTr = `Bugün süpermarketten ${trClean} satın alıyorum.`;
        alternativesDe = [
          `Heute kaufe ich ${accArt} ${bare} im Supermarkt.`,
          `Im Supermarkt kaufe ich heute ${accArt} ${bare}.`,
        ];
        flawedSentenceDe = `Ich heute kaufe ${accArt} ${bare} im Supermarkt.`;
        grammarExplanationTr =
          "Almanca düz cümlelerde çekimli fiil (kaufe) her zaman 2. konumda (V2 kuralı) yer alır: 'Ich kaufe heute...' veya 'Heute kaufe ich...'.";
      } else if (hierarchy.categoryId === "home_living") {
        sentenceDe = `Wir brauchen ${accArt} ${bare} für unsere Wohnung.`;
        sentenceTr = `Dairemiz için ${trClean} gerekiyor.`;
        alternativesDe = [`Für unsere Wohnung brauchen wir ${accArt} ${bare}.`];
        flawedSentenceDe = `Wir ${accArt} ${bare} brauchen für unsere Wohnung.`;
        grammarExplanationTr =
          "Ana cümlede çekimli fiil (brauchen) özneden hemen sonra 2. sırada bulunmalıdır.";
      } else if (hierarchy.categoryId === "travel_transport") {
        sentenceDe = `Wo finde ich hier ${accArt} ${bare}?`;
        sentenceTr = `Burada ${trClean} nerede bulabilirim?`;
        alternativesDe = [`Wo kann ich hier ${accArt} ${bare} finden?`];
        flawedSentenceDe = `Wo ich finde hier ${accArt} ${bare}?`;
        grammarExplanationTr =
          "Soru kelimesiyle (Wo) başlayan sorularda çekimli fiil (finde) soru kelimesinden hemen sonra 2. sırada gelir.";
        grammarFocus = "W-Frage Soru Dizilimi";
      } else {
        sentenceDe = `Heute sehe ich ${accArt} ${bare} zum ersten Mal.`;
        sentenceTr = `Bugün ilk kez ${trClean} görüyorum.`;
        alternativesDe = [`Ich sehe heute ${accArt} ${bare} zum ersten Mal.`];
        flawedSentenceDe = `Heute ich sehe ${accArt} ${bare} zum ersten Mal.`;
        grammarExplanationTr =
          "Cümle zaman zarfıyla ('Heute') başladığında özne ile fiil yer değiştirir (Inversion): 'Heute sehe ich...'.";
        grammarFocus = "Zaman Zarfı ile Devrik Kuruluş (Inversion)";
      }
    } else if (level === "A2") {
      sentenceDe = `Gestern habe ich ${accArt} ${bare} sofort gefunden.`;
      sentenceTr = `Dün ${trClean} hemen buldum.`;
      alternativesDe = [`Ich habe gestern ${accArt} ${bare} sofort gefunden.`];
      flawedSentenceDe = `Gestern habe ich gefunden ${accArt} ${bare} sofort.`;
      grammarExplanationTr =
        "Perfekt geçmiş zamanda yardımcı fiil (habe) 2. konumda, Partizip II (gefunden) ise cümlenin en sonunda (Satzklammer) yer alır.";
      grammarFocus = "Perfekt & Satzklammer (Cümle Kıskacı)";
    } else if (level === "B1") {
      sentenceDe = `Ich freue mich, weil ${defArt} ${bare} sehr nützlich ist.`;
      sentenceTr = `${trClean} çok faydalı olduğu için seviniyorum.`;
      alternativesDe = [`Weil ${defArt} ${bare} sehr nützlich ist, freue ich mich.`];
      flawedSentenceDe = `Ich freue mich, weil ${defArt} ${bare} ist sehr nützlich.`;
      grammarExplanationTr =
        "'weil' bağlacı ile kurulan yan cümlelerde (Nebensatz) çekimli fiil (ist) yan cümlenin en sonuna gider.";
      grammarFocus = "Nebensatz (weil) Fiil Sonda Kuralı";
    } else if (level === "B2") {
      sentenceDe = `Obwohl ${defArt} ${bare} wichtig ist, sprechen wir selten darüber.`;
      sentenceTr = `${trClean} önemli olmasına rağmen bunun hakkında nadiren konuşuyoruz.`;
      alternativesDe = [`Wir sprechen selten darüber, obwohl ${defArt} ${bare} wichtig ist.`];
      flawedSentenceDe = `Obwohl ${defArt} ${bare} wichtig ist, wir sprechen selten darüber.`;
      grammarExplanationTr =
        "Yan cümle ('Obwohl...') başta olduğunda, virgülden sonraki ana cümle doğrudan çekimli fiille ('sprechen wir') başlar.";
      grammarFocus = "Obwohl Yan Cümlesi ve Ana Cümle Bağlantısı";
    } else {
      sentenceDe = `In Bezug auf ${datArt} ${bare} müssen wir eine nachhaltige Lösung entwickeln.`;
      sentenceTr = `${trClean} ile ilgili olarak sürdürülebilir bir çözüm geliştirmeliyiz.`;
      alternativesDe = [`Wir müssen in Bezug auf ${datArt} ${bare} eine nachhaltige Lösung entwickeln.`];
      flawedSentenceDe = `In Bezug auf ${datArt} ${bare} wir müssen entwickeln eine nachhaltige Lösung.`;
      grammarExplanationTr =
        "Modal fiilli (müssen) cümlelerde çekimli modal fiil 2. konumda, esas fiil mastar hâlde (entwickeln) en sonda yer alır.";
      grammarFocus = "Akademik İfade ve Modal Cümle Kıskacı";
    }
  } else if (isVerb) {
    const inf = bare.replace(/^sich\s+/i, "").trim();
    const isReflexive = /^sich\s+/i.test(bare);
    if (level === "A1" || level === "A2") {
      if (isReflexive) {
        sentenceDe = `Wir möchten uns heute gut ${inf}.`;
        sentenceTr = `Bugün iyi bir şekilde ${trClean} istiyoruz.`;
        alternativesDe = [`Heute möchten wir uns gut ${inf}.`];
        flawedSentenceDe = `Wir möchten heute ${inf} uns gut.`;
      } else {
        sentenceDe = `Wir möchten heute Abend zusammen ${inf}.`;
        sentenceTr = `Bu akşam birlikte ${trClean} istiyoruz.`;
        alternativesDe = [`Heute Abend möchten wir zusammen ${inf}.`];
        flawedSentenceDe = `Wir möchten ${inf} heute Abend zusammen.`;
      }
      grammarExplanationTr =
        "Modal fiil ('möchten') 2. sırada çekimlenir, esas fiil ('" +
        inf +
        "') ise mastar hâlde cümlenin en sonuna gider.";
      grammarFocus = "Modalverben + Mastar Sonda";
    } else if (level === "B1") {
      sentenceDe = `Es ist wichtig, regelmäßig auf Deutsch zu ${inf}.`;
      sentenceTr = `Düzenli olarak Almanca ${trClean} önemlidir.`;
      alternativesDe = [`Regelmäßig auf Deutsch zu ${inf}, ist sehr wichtig.`];
      flawedSentenceDe = `Es ist wichtig, zu ${inf} regelmäßig auf Deutsch.`;
      grammarExplanationTr =
        "'zu + Infinitiv' yapısında 'zu " + inf + "' ifadesi yan cümlenin en sonunda yer alır.";
      grammarFocus = "Infinitiv mit zu";
    } else {
      sentenceDe = `Damit wir unser Ziel erreichen, müssen wir sorgfältig ${inf}.`;
      sentenceTr = `Hedefimize ulaşmak için titizlikle ${trClean} zorundayız.`;
      alternativesDe = [`Wir müssen sorgfältig ${inf}, damit wir unser Ziel erreichen.`];
      flawedSentenceDe = `Damit wir erreichen unser Ziel, müssen wir sorgfältig ${inf}.`;
      grammarExplanationTr =
        "'damit' amaç yan cümlesinde çekimli fiil ('erreichen') virgülden hemen önce yan cümle sonunda bulunur.";
      grammarFocus = "Finalsatz (damit) ve Modal Yapı";
    }
  } else if (isAdj) {
    if (level === "A1" || level === "A2") {
      sentenceDe = `Das Ergebnis ist heute wirklich sehr ${bare}.`;
      sentenceTr = `Sonuç bugün gerçekten çok ${trClean}.`;
      alternativesDe = [`Heute ist das Ergebnis wirklich sehr ${bare}.`];
      flawedSentenceDe = `Das Ergebnis heute ist wirklich sehr ${bare}.`;
      grammarExplanationTr =
        "Ana cümlede çekimli fiil ('ist') özneden hemen sonra 2. konumda yer almalıdır.";
      grammarFocus = "Sıfat Yüklemli Cümlede V2 Kuralı";
    } else {
      sentenceDe = `Ich finde es bemerkenswert, dass diese Lösung so ${bare} ist.`;
      sentenceTr = `Bu çözümün bu kadar ${trClean} olmasını dikkate değer buluyorum.`;
      alternativesDe = [`Dass diese Lösung so ${bare} ist, finde ich bemerkenswert.`];
      flawedSentenceDe = `Ich finde es bemerkenswert, dass diese Lösung ist so ${bare}.`;
      grammarExplanationTr =
        "'dass' yan cümlesinde çekimli fiil ('ist') cümlenin en sonuna yerleşir.";
      grammarFocus = "Konjunktionalsatz mit dass";
    }
  } else {
    // Phrase or connector
    sentenceDe = `Im Alltag sagen wir oft: ${word.de}.`;
    sentenceTr = `Günlük hayatta sık sık şöyle deriz: ${trClean}.`;
    alternativesDe = [`Wir sagen im Alltag oft: ${word.de}.`];
    flawedSentenceDe = `Im Alltag wir sagen oft: ${word.de}.`;
    grammarExplanationTr =
      "Cümle yer/zaman tamlayıcısıyla ('Im Alltag') başladığında çekimli fiil ('sagen') özneden önce 2. sırada gelir.";
    grammarFocus = "Kalıp İfade Kullanımı ve V2 Sıralaması";
  }

  const tokens = tokenizeGermanSentence(sentenceDe);
  const distractorTokens = pickGrammaticalDistractorTokens(tokens, word, pool);

  return {
    sentenceDe,
    sentenceTr,
    alternativesDe,
    tokens,
    distractorTokens,
    flawedSentenceDe,
    grammarExplanationTr,
    grammarFocus,
  };
}

function deriveGermanWordOrderAlternatives(sentenceDe: string): string[] {
  const clean = cleanSentencePunctuation(sentenceDe);
  const tokens = clean.split(" ").filter(Boolean);
  const alts: string[] = [];
  if (tokens.length >= 4 && /^(Ich|Wir|Du|Er|Sie|Es)$/i.test(tokens[0])) {
    const timeIdx = tokens.findIndex((t, idx) =>
      idx >= 2 && /^(heute|gestern|morgen|oft|immer|jetzt|täglich)$/i.test(t.replace(/[,.!?]/g, "")),
    );
    if (timeIdx > 1) {
      const timeWord = tokens[timeIdx].replace(/[,.!?]/g, "");
      const verb = tokens[1];
      const subj = tokens[0].toLowerCase();
      const rest = tokens.filter((_, i) => i !== 0 && i !== 1 && i !== timeIdx);
      const capTime = timeWord.charAt(0).toUpperCase() + timeWord.slice(1);
      alts.push(`${capTime} ${verb} ${subj} ${rest.join(" ")}.`);
    }
  }
  return alts;
}

function buildSingleGrammarError(
  sentenceDe: string,
  word: Vocabulary,
): { flawedSentence: string; explanationTr: string; grammarFocus: string } {
  const tokens = tokenizeGermanSentence(sentenceDe);
  if (tokens.length >= 4) {
    // Swap verb in position 2 with position 3 to create a classic V2 word-order mistake
    const copy = [...tokens];
    const second = copy[1];
    const third = copy[2];
    copy[1] = third;
    copy[2] = second;
    return {
      flawedSentence: copy.join(" "),
      explanationTr: `"${word.de}" kelimesinin kullanıldığı bu cümlede çekimli fiil 2. konumda (V2 kuralı) yer almalıdır. Doğru dizilim: "${sentenceDe}"`,
      grammarFocus: "V2 Fiil Konumu (Verb-Zweit-Stellung)",
    };
  }
  return {
    flawedSentence: sentenceDe,
    explanationTr: `Doğru cümle yapısı: "${sentenceDe}"`,
    grammarFocus: "Cümle Dizilimi",
  };
}

function pickGrammaticalDistractorTokens(
  sentenceTokens: string[],
  target: Vocabulary,
  pool: Vocabulary[],
): string[] {
  const existingNorm = new Set(sentenceTokens.map((t) => normalizeText(t)));
  const candidates: string[] = [];

  const { article } = stripArticle(target.de);
  if (article === "der") candidates.push("die", "das");
  else if (article === "die") candidates.push("der", "das");
  else if (article === "das") candidates.push("der", "die");

  candidates.push("nicht", "kein", "habe", "sind", "wird", "mit", "für", "auf");

  for (const w of pool.slice(0, 12)) {
    if (w.id === target.id) continue;
    const { bare } = stripArticle(w.de);
    if (bare && !bare.includes(" ") && bare.length >= 3) {
      candidates.push(bare);
    }
  }

  const out: string[] = [];
  for (const c of candidates) {
    const n = normalizeText(c);
    if (!n || existingNorm.has(n)) continue;
    existingNorm.add(n);
    out.push(c);
    if (out.length >= 3) break;
  }
  return out;
}

export function chooseSatzbauModeForWord(
  word: Vocabulary,
  index: number,
  requestedMode?: SatzbauMode,
): SatzbauMode {
  if (requestedMode) return requestedMode;
  const lvl = word.level || "A1";
  if (lvl === "A1") {
    const cycle: SatzbauMode[] = ["arrange", "construct_bank", "arrange", "correct_sentence", "create_own"];
    return cycle[index % cycle.length];
  }
  if (lvl === "A2") {
    const cycle: SatzbauMode[] = ["arrange", "construct_bank", "correct_sentence", "free_translation", "create_own"];
    return cycle[index % cycle.length];
  }
  const cycle: SatzbauMode[] = ["construct_bank", "free_translation", "correct_sentence", "create_own", "arrange"];
  return cycle[index % cycle.length];
}

export function buildSatzbauTask(
  word: Vocabulary,
  pool: Vocabulary[],
  index: number,
  requestedMode?: SatzbauMode,
): Task {
  const mode = chooseSatzbauModeForWord(word, index, requestedMode);
  const spec = buildSatzbauSpecForWord(word, pool);
  const modeMeta = SATZBAU_MODE_LABELS[mode];
  const seed = `${word.id}:satzbau:${mode}:${index}`;

  if (mode === "arrange") {
    let shuffled = deterministicShuffle(spec.tokens, seed);
    if (shuffled.join(" ") === spec.tokens.join(" ") && shuffled.length > 1) {
      shuffled = [...shuffled.slice(1), shuffled[0]];
    }
    return {
      id: `task-satzbau-${mode}-${word.id}-${index}`,
      module: "vocabulary",
      type: "satzbau",
      part: 1,
      level: word.level,
      passage: "",
      options: [],
      answer: spec.sentenceDe,
      explanation: spec.grammarExplanationTr,
      evidence: spec.sentenceTr,
      fingerprint: createHash("sha256").update(spec.sentenceDe).digest("hex"),
      activity: "satzbau",
      satzbauMode: "arrange",
      prompt: spec.sentenceTr,
      subPrompt: `${modeMeta} • Kelimelere dokunarak doğru Almanca cümleyi oluştur.`,
      hint: `Hedef kelime: ${word.de} (${word.tr}) • ${spec.grammarFocus}`,
      expected: spec.sentenceDe,
      alternatives: spec.alternativesDe,
      wordBank: shuffled,
      targetWordDe: word.de,
      targetWordTr: word.tr,
      turkishPromptSentence: spec.sentenceTr,
      grammarExplanationTr: spec.grammarExplanationTr,
      grammarFocus: spec.grammarFocus,
      vocabularyIds: [word.id],
      audioText: spec.sentenceDe,
      pronunciation: word.pronunciation,
    };
  }

  if (mode === "construct_bank") {
    const bank = deterministicShuffle([...spec.tokens, ...spec.distractorTokens], `${seed}:bank`);
    return {
      id: `task-satzbau-${mode}-${word.id}-${index}`,
      module: "vocabulary",
      type: "satzbau",
      part: 1,
      level: word.level,
      passage: "",
      options: [],
      answer: spec.sentenceDe,
      explanation: spec.grammarExplanationTr,
      evidence: spec.sentenceTr,
      fingerprint: createHash("sha256").update(spec.sentenceDe).digest("hex"),
      activity: "satzbau",
      satzbauMode: "construct_bank",
      prompt: spec.sentenceTr,
      subPrompt: `${modeMeta} • Fazladan çeldirici kelimelere dikkat ederek doğru cümleyi kur.`,
      hint: `Hedef kelime: ${word.de} • Havuzda ${spec.distractorTokens.length} fazladan kelime var.`,
      expected: spec.sentenceDe,
      alternatives: spec.alternativesDe,
      wordBank: bank,
      distractorWords: spec.distractorTokens,
      targetWordDe: word.de,
      targetWordTr: word.tr,
      turkishPromptSentence: spec.sentenceTr,
      grammarExplanationTr: spec.grammarExplanationTr,
      grammarFocus: spec.grammarFocus,
      vocabularyIds: [word.id],
      audioText: spec.sentenceDe,
      pronunciation: word.pronunciation,
    };
  }

  if (mode === "free_translation") {
    return {
      id: `task-satzbau-${mode}-${word.id}-${index}`,
      module: "vocabulary",
      type: "satzbau",
      part: 1,
      level: word.level,
      passage: "",
      options: [],
      answer: spec.sentenceDe,
      explanation: spec.grammarExplanationTr,
      evidence: spec.sentenceTr,
      fingerprint: createHash("sha256").update(spec.sentenceDe).digest("hex"),
      activity: "satzbau",
      satzbauMode: "free_translation",
      prompt: spec.sentenceTr,
      subPrompt: `${modeMeta} • Verilen Türkçe cümleyi kelime havuzu olmadan Almancaya çevir.`,
      hint: `İpucu: "${word.de}" (${word.tr}) kelimesini kullanabilirsin.`,
      expected: spec.sentenceDe,
      alternatives: spec.alternativesDe,
      targetWordDe: word.de,
      targetWordTr: word.tr,
      turkishPromptSentence: spec.sentenceTr,
      grammarExplanationTr: spec.grammarExplanationTr,
      grammarFocus: spec.grammarFocus,
      vocabularyIds: [word.id],
      audioText: spec.sentenceDe,
      pronunciation: word.pronunciation,
    };
  }

  if (mode === "correct_sentence") {
    return {
      id: `task-satzbau-${mode}-${word.id}-${index}`,
      module: "vocabulary",
      type: "satzbau",
      part: 1,
      level: word.level,
      passage: "",
      options: [],
      answer: spec.sentenceDe,
      explanation: spec.grammarExplanationTr,
      evidence: spec.sentenceTr,
      fingerprint: createHash("sha256").update(spec.sentenceDe).digest("hex"),
      activity: "satzbau",
      satzbauMode: "correct_sentence",
      prompt: spec.flawedSentenceDe,
      subPrompt: `${modeMeta} • Cümledeki dil bilgisi / kelime sırası hatasını düzelterek yeniden yaz.`,
      hint: `Anlamı: "${spec.sentenceTr}" • Odak: ${spec.grammarFocus}`,
      expected: spec.sentenceDe,
      alternatives: spec.alternativesDe,
      flawedSentenceDe: spec.flawedSentenceDe,
      targetWordDe: word.de,
      targetWordTr: word.tr,
      turkishPromptSentence: spec.sentenceTr,
      grammarExplanationTr: spec.grammarExplanationTr,
      grammarFocus: spec.grammarFocus,
      vocabularyIds: [word.id],
      audioText: spec.sentenceDe,
      pronunciation: word.pronunciation,
    };
  }

  // Mode D: create_own
  return {
    id: `task-satzbau-create_own-${word.id}-${index}`,
    module: "vocabulary",
    type: "satzbau",
    part: 1,
    level: word.level,
    passage: "",
    options: [],
    answer: spec.sentenceDe,
    explanation: spec.grammarExplanationTr,
    evidence: spec.sentenceTr,
    fingerprint: createHash("sha256").update(spec.sentenceDe).digest("hex"),
    activity: "satzbau",
    satzbauMode: "create_own",
    prompt: `${word.de} — ${word.tr}`,
    subPrompt: `${modeMeta} • Bu kelimeyi kullanarak anlamlı ve kurallı bir Almanca cümle yaz.`,
    hint: `Örnek model: "${spec.sentenceDe}" (${spec.sentenceTr})`,
    expected: spec.sentenceDe,
    alternatives: spec.alternativesDe,
    targetWordDe: word.de,
    targetWordTr: word.tr,
    turkishPromptSentence: spec.sentenceTr,
    grammarExplanationTr: spec.grammarExplanationTr,
    grammarFocus: spec.grammarFocus,
    vocabularyIds: [word.id],
    audioText: spec.sentenceDe,
    pronunciation: word.pronunciation,
  };
}

/**
 * Deterministic German sentence validator that checks:
 * - Exact or alternative valid German word orders (Mode A, B, C, E)
 * - Target word stem/inflection presence, minimum clause structure, and V2 verb presence (Mode D `create_own` and open translation)
 */
export function evaluateSatzbauDeterministic(
  task: Task,
  userAnswer: string,
): SatzbauReviewResult {
  const trimmed = (userAnswer || "").trim();
  const mode = task.satzbauMode || "arrange";
  const expectedDe = task.expected ?? "";
  const explanationTr = task.grammarExplanationTr ?? "";
  const normUser = normalizeGermanSentenceForComparison(trimmed);
  const normExpected = normalizeGermanSentenceForComparison(expectedDe);
  const normAlts = (task.alternatives ?? []).map(normalizeGermanSentenceForComparison);

  if (!normUser) {
    return {
      isValid: false,
      score: 0,
      feedbackTr: "Lütfen bir Almanca cümle oluştur veya yaz.",
      correctedSentenceDe: expectedDe,
      alternativeSentenceDe: task.alternatives?.[0] ?? expectedDe,
      grammarRuleTr: explanationTr || "Almanca ana cümlede çekimli fiil 2. konumda yer alır.",
      targetWordUsed: false,
      wordOrderValid: false,
      source: "deterministic",
    };
  }

  const matchesCanonical = normUser === normExpected || normAlts.includes(normUser);

  if (matchesCanonical) {
    return {
      isValid: true,
      score: 100,
      feedbackTr:
        normUser === normExpected
          ? "Harika! Kelime dizilimi ve dil bilgisi tam olarak doğru."
          : "Tebrikler! Geçerli bir alternatif Almanca kelime dizilimi kullandın.",
      correctedSentenceDe: expectedDe,
      alternativeSentenceDe: task.alternatives?.[0] ?? expectedDe,
      grammarRuleTr:
        explanationTr ||
        "Almanca V2 kuralına göre zaman veya yer zarfı başa geldiğinde fiil yine 2. sırada kalır.",
      targetWordUsed: true,
      wordOrderValid: true,
      source: "deterministic",
    };
  }

  const targetRaw = task.targetWordDe || expectedDe;
  const { bare } = stripArticle(targetRaw);
  const stem = normalizeText(bare.replace(/(en|eln|ern|n)$/i, "")).slice(0, Math.max(3, bare.length - 2));
  const targetUsed =
    normUser.includes(normalizeText(bare)) ||
    (stem.length >= 3 && normUser.includes(stem));

  const words = trimmed.split(/\s+/).filter(Boolean);

  if (mode === "create_own" || mode === "free_translation") {
    return {
      needsReview: true, isValid: false, score: 0,
      feedbackTr: "Bu serbest cümle örnek çözümlerden farklı. Kelime benzerliği tek başına dilbilgisi ve anlam doğruluğunu göstermez; kesin değerlendirme için AI incelemesi gerekir.",
      correctedSentenceDe: expectedDe, alternativeSentenceDe: task.alternatives?.[0] ?? expectedDe,
      grammarRuleTr: explanationTr || "Aşağıdaki cümle tek geçerli yanıt değil, bir örnektir.",
      targetWordUsed: targetUsed, wordOrderValid: false, source: "deterministic",
    };
  }

  return {
    isValid: false,
    score: targetUsed ? 50 : 25,
    feedbackTr:
      mode === "correct_sentence"
        ? `Cümledeki dil bilgisi hatası tam düzeltilmedi. ${explanationTr}`
        : `Kelime sırası veya çekim beklenen cümleyle eşleşmedi. Doğrusu: "${expectedDe}"`,
    correctedSentenceDe: expectedDe,
    alternativeSentenceDe: task.alternatives?.[0] ?? expectedDe,
    grammarRuleTr:
      explanationTr ||
      "Almanca düz cümlelerde çekimli fiil 2. sırada (V2), mastar veya Partizip II ise sonda yer alır.",
    targetWordUsed: targetUsed,
    wordOrderValid: false,
    source: "deterministic",
  };
}

/**
 * Full AI-assisted Satzbau review for "✨ Cümlemi AI ile İncele" button.
 * Uses SQLite cache (`german_ai_cache`) + Groq LLM when configured, with deterministic grammar fallback.
 */
export async function reviewSatzbauWithAi(
  db: Client,
  input: {
    userSentence: string;
    expectedSentence: string;
    turkishPrompt: string;
    targetWordDe: string;
    targetWordTr: string;
    mode: SatzbauMode;
    level: string;
    grammarExplanationTr?: string;
  },
): Promise<SatzbauReviewResult> {
  const syntheticTask: Task = {
    id: "review",
    module: "vocabulary",
    type: "satzbau",
    part: 1,
    level: input.level || "A1",
    passage: "",
    options: [],
    alternatives: [],
    answer: input.expectedSentence || "",
    explanation: input.grammarExplanationTr || "",
    evidence: input.turkishPrompt || "",
    fingerprint: createHash("sha256").update(input.userSentence).digest("hex"),
    activity: "satzbau",
    satzbauMode: input.mode,
    prompt: input.turkishPrompt || input.targetWordDe || "",
    expected: input.expectedSentence || "",
    targetWordDe: input.targetWordDe || "",
    targetWordTr: input.targetWordTr || "",
    turkishPromptSentence: input.turkishPrompt || "",
    grammarExplanationTr: input.grammarExplanationTr || "",
    vocabularyIds: [],
  };

  const det = evaluateSatzbauDeterministic(syntheticTask, input.userSentence);
  const cacheKey = `satzbau:v2:${input.mode}:${normalizeText(input.targetWordDe)}:${normalizeGermanSentenceForComparison(input.userSentence)}`;

  try {
    const cached = await db.execute({
      sql: "SELECT payload_json FROM german_ai_cache WHERE cache_key=?",
      args: [cacheKey],
    });
    if (cached.rows[0]?.payload_json) {
      const parsed = JSON.parse(String(cached.rows[0].payload_json)) as SatzbauReviewResult;
      return { ...parsed, source: "cache" };
    }
  } catch {}

  const apiKey = (process.env.GROQ_API_KEY || "").trim();
  if (!apiKey || !input.userSentence.trim()) {
    return det;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.KAPS_GERMAN_GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sen uzman bir Almanca (DaF) öğretmenisin. Öğrencinin kurduğu Almanca cümleyi değerlendir ve SADECE geçerli bir JSON döndür. Alanlar: isValid (boolean), score (0-100 sayı), feedbackTr (Türkçe yapıcı açıklama), correctedSentenceDe (düzeltilmiş doğal Almanca cümle), alternativeSentenceDe (alternatif geçerli Almanca dizilim), grammarRuleTr (kısa Türkçe gramer kuralı özeti), targetWordUsed (boolean), wordOrderValid (boolean).",
          },
          {
            role: "user",
            content: JSON.stringify({
              level: input.level,
              mode: input.mode,
              targetWordDe: input.targetWordDe,
              targetWordTr: input.targetWordTr,
              turkishPrompt: input.turkishPrompt,
              expectedReferenceDe: input.expectedSentence,
              studentSentenceDe: input.userSentence,
            }),
          },
        ],
      }),
    });
    clearTimeout(timer);

    if (response.ok) {
      const data = (await response.json()) as any;
      const rawContent = data?.choices?.[0]?.message?.content;
      if (rawContent) {
        const parsed = JSON.parse(rawContent);
        const result: SatzbauReviewResult = {
          isValid: Boolean(parsed.isValid ?? det.isValid),
          score: Number.isFinite(Number(parsed.score)) ? Number(parsed.score) : det.score,
          feedbackTr: String(parsed.feedbackTr || det.feedbackTr),
          correctedSentenceDe: String(parsed.correctedSentenceDe || det.correctedSentenceDe),
          alternativeSentenceDe: String(parsed.alternativeSentenceDe || det.alternativeSentenceDe),
          grammarRuleTr: String(parsed.grammarRuleTr || det.grammarRuleTr),
          targetWordUsed: Boolean(parsed.targetWordUsed ?? det.targetWordUsed),
          wordOrderValid: Boolean(parsed.wordOrderValid ?? det.wordOrderValid),
          source: "ai",
        };
        try {
          await db.execute({
            sql: "INSERT OR REPLACE INTO german_ai_cache(cache_key, payload_json, created_at) VALUES(?,?,?)",
            args: [cacheKey, JSON.stringify(result), new Date().toISOString()],
          });
        } catch {}
        return result;
      }
    }
  } catch {}

  return det;
}
