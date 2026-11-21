import { BUILTIN_CURRICULUM } from "./curriculum";
import {
  isCefrLevel,
  studyLevels,
  type CefrLevel,
  type StoredCefrLevel,
} from "../../shared/germanActivities";

export { isCefrLevel, studyLevels, type CefrLevel, type StoredCefrLevel };

export const normalizeText = (value: string) =>
  value.normalize("NFC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("de");

export const stripArticle = (de: string) =>
  normalizeText(de).replace(/^(?:der|die|das|ein|eine)\s+/u, "");

export const canonicalWordKey = (de: string) =>
  normalizeText(de)
    .replace(/[()[\]"]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();

const EXTRA_REFERENCE_LEVELS: Array<[string, CefrLevel]> = [
  ["der baum", "A1"],
  ["hallo", "A1"],
  ["tschüss", "A1"],
  ["ja", "A1"],
  ["nein", "A1"],
  ["ich", "A1"],
  ["du", "A1"],
  ["wir", "A1"],
  ["ihr", "A1"],
  ["sie", "A1"],
  ["der mann", "A1"],
  ["die frau", "A1"],
  ["der bruder", "A1"],
  ["die schwester", "A1"],
  ["der lehrer", "A1"],
  ["die lehrerin", "A1"],
  ["das zimmer", "A1"],
  ["die küche", "A1"],
  ["das bett", "A1"],
  ["der kaffee", "A1"],
  ["das bier", "A1"],
  ["der käse", "A1"],
  ["das ei", "A1"],
  ["die tomate", "A1"],
  ["die kartoffel", "A1"],
  ["der hund", "A1"],
  ["die katze", "A1"],
  ["rot", "A1"],
  ["blau", "A1"],
  ["grün", "A1"],
  ["schwarz", "A1"],
  ["weiß", "A1"],
  ["viel", "A1"],
  ["wenig", "A1"],
  ["schnell", "A1"],
  ["langsam", "A1"],
  ["heiß", "A1"],
  ["kalt", "A1"],
  ["warm", "A1"],
  ["hier", "A1"],
  ["dort", "A1"],
  ["jetzt", "A1"],
  ["immer", "A1"],
  ["oft", "A1"],
  ["nie", "A1"],
  ["heißen", "A1"],
  ["trinken", "A1"],
  ["spielen", "A1"],
  ["suchen", "A2"],
  ["finden", "A2"],
  ["warten", "A2"],
  ["feiern", "A2"],
  ["kochen", "A2"],
  ["mieten", "A2"],
  ["fahren", "A2"],
  ["geben", "A2"],
  ["fernsehen", "A2"],
  ["mitbringen", "A2"],
  ["früher", "A2"],
  ["möglich", "A2"],
  ["dass", "A2"],
  ["ob", "A2"],
  ["ich freue mich darauf.", "B1"],
  ["deshalb", "B1"],
  ["während", "B1"],
  ["allerdings", "B1"],
  ["zunächst", "B1"],
  ["überzeugend", "B1"],
  ["sinnvoll", "B1"],
  ["entscheidend", "B1"],
  ["nachdenken", "B1"],
  ["übernehmen", "B1"],
  ["sich beschweren", "B1"],
  ["feststellen", "B1"],
  ["begründen", "B1"],
  ["berichten", "B1"],
  ["überzeugen", "B1"],
  ["diskutieren", "B1"],
  ["die forschung", "B1"],
  ["die gleichberechtigung", "B1"],
  ["die globalisierung", "B2"],
  ["die debatte", "B2"],
  ["die transparenz", "B2"],
  ["die effizienz", "B2"],
  ["die infrastruktur", "B2"],
  ["umfassend", "B2"],
  ["offensichtlich", "B2"],
  ["widersprüchlich", "B2"],
  ["vielschichtig", "B2"],
  ["bemerkenswert", "B2"],
  ["ausschlaggebend", "B2"],
  ["demzufolge", "B2"],
  ["widersprechen", "B2"],
  ["fördern", "B2"],
  ["nachvollziehen", "B2"],
  ["beurteilen", "B2"],
  ["rechtfertigen", "B2"],
  ["die unabdingbarkeit", "C1"],
  ["die plausibilität", "C1"],
  ["die divergenz", "C1"],
  ["die eigenverantwortung", "C1"],
  ["die heterogenität", "C1"],
  ["die ausprägung", "C1"],
  ["facettenreich", "C1"],
  ["weitreichend", "C1"],
  ["unablässig", "C1"],
  ["fragwürdig", "C1"],
  ["beispiellos", "C1"],
  ["mithin", "C1"],
  ["demgegenüber", "C1"],
  ["abstrahieren", "C1"],
  ["artikulieren", "C1"],
  ["suggerieren", "C1"],
  ["kompensieren", "C1"],
  ["unterstreichen", "C1"],
  ["belegen", "C1"],
];

export const CEFR_REFERENCE_MAP = new Map<string, CefrLevel>();

for (const entry of BUILTIN_CURRICULUM) {
  const full = normalizeText(entry.de);
  const bare = stripArticle(entry.de);
  CEFR_REFERENCE_MAP.set(full, entry.level);
  if (bare && bare.length >= 2 && !CEFR_REFERENCE_MAP.has(bare)) {
    CEFR_REFERENCE_MAP.set(bare, entry.level);
  }
}
for (const [word, lvl] of EXTRA_REFERENCE_LEVELS) {
  const norm = normalizeText(word);
  CEFR_REFERENCE_MAP.set(norm, lvl);
  const bare = stripArticle(word);
  if (bare && bare.length >= 2 && !CEFR_REFERENCE_MAP.has(bare)) {
    CEFR_REFERENCE_MAP.set(bare, lvl);
  }
}

export function lookupReferenceCefr(de: string): CefrLevel | null {
  const norm = normalizeText(de);
  if (CEFR_REFERENCE_MAP.has(norm)) return CEFR_REFERENCE_MAP.get(norm)!;
  const bare = stripArticle(de);
  if (bare && CEFR_REFERENCE_MAP.has(bare)) return CEFR_REFERENCE_MAP.get(bare)!;
  return null;
}

/**
 * Parses CEFR level markers in headings or tab titles such as:
 * "A1", "A1.1", "Seviye A1", "Level: A2", "## B1 — Alltag", "[B2] Akademik", "C1 Kelimeler"
 */
export function parseCefrHeading(rawLine: string): CefrLevel | null {
  const cleaned = rawLine
    .normalize("NFC")
    .trim()
    .replace(/^\s*(?:[•*#>-]+|\d+[.)])\s*/u, "")
    .trim();
  if (!cleaned || cleaned.length > 80) return null;
  // Never confuse a translation line containing — or = as a bare level heading unless the prefix itself starts with level tag and has no German-Turkish separator structure
  if (/\s+(?:—|–|->|=)\s+.{2,}$/u.test(cleaned) && !/^(?:seviye|level|cefr|niveau|bölüm|teil|modul)\b/iu.test(cleaned)) {
    // Allow headings like "A1 — Grundwortschatz" or "B1 — Alltag" if the left side IS literally a CEFR marker
    const leftOnly = cleaned.split(/\s+(?:—|–|->|=|-|:)\s+/u)[0]?.trim() ?? "";
    const leftMatch = leftOnly.match(/^(?:(?:seviye|level|cefr|niveau)\s*[:\-]?\s*)?(A1|A2|B1|B2|C1)(?:\.[12])?$/iu);
    if (!leftMatch) return null;
    const candidate = leftMatch[1].toUpperCase();
    return isCefrLevel(candidate) ? candidate : null;
  }

  const exactMatch = cleaned.match(
    /^(?:\[?\s*(?:seviye|level|cefr|niveau|kur|teil|modul)?\s*[:\-]?\s*)?(A1|A2|B1|B2|C1)(?:\.[12])?(?:\s*\]\s*(?:[:—–-]\s*)?.*|\s*[:—–-]\s*.*|\s+(?:kelimeler|kelime|wortschatz|vokabeln|grundwortschatz|alltag|başlangıç|temel|orta|ileri|beginner|elementary|intermediate|upper\s*intermediate|advanced|seviyesi|seviye|modülü|bölümü).*)?$/iu,
  );
  if (!exactMatch) return null;
  const candidate = exactMatch[1].toUpperCase();
  return isCefrLevel(candidate) ? candidate : null;
}

export type CefrSource = "heading" | "reference" | "manual" | "builtin" | "unclassified";

export function classifyVocabularyEntry(input: {
  de: string;
  headingLevel?: CefrLevel | null;
  existingLevel?: string | null;
  existingSource?: string | null;
}): { level: StoredCefrLevel; source: CefrSource } {
  const ref = lookupReferenceCefr(input.de);

  if (input.existingSource === "manual" && isCefrLevel(input.existingLevel)) {
    return { level: input.existingLevel, source: "manual" };
  }
  if (input.existingSource === "builtin" && isCefrLevel(input.existingLevel)) {
    return { level: input.existingLevel, source: "builtin" };
  }

  // If heading explicitly assigned a CEFR level during this parse
  if (input.headingLevel && isCefrLevel(input.headingLevel)) {
    return { level: input.headingLevel, source: "heading" };
  }

  // If this was explicitly classified by a heading previously, keep it unless it looks like the old silent-B1 default bug
  if (input.existingSource === "heading" && isCefrLevel(input.existingLevel)) {
    return { level: input.existingLevel, source: "heading" };
  }

  // Legacy data migration: old parser defaulted everything without heading to "B1".
  // If we recognize the word in the verified CEFR reference dictionary, assign the accurate CEFR level!
  if (ref) {
    return { level: ref, source: "reference" };
  }

  // Only trust existingLevel if it explicitly had a non-legacy-default valid source
  if (
    isCefrLevel(input.existingLevel) &&
    input.existingSource &&
    input.existingSource !== "unclassified" &&
    input.existingSource !== "legacy_default"
  ) {
    return { level: input.existingLevel, source: input.existingSource as CefrSource };
  }

  return { level: "UNCLASSIFIED", source: "unclassified" };
}

const cleanForCompare = (value: string, foldEszett = false): string => {
  let s = normalizeText(value)
    .replace(/[„“"«»'’`]/gu, "")
    .replace(/^[¿¡]+/gu, "")
    .replace(/[.!?,;:…]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
  if (foldEszett) {
    s = s.replace(/ß/gu, "ss");
  }
  return s;
};

/**
 * Strips parenthetical hints like "elma (meyve)" -> "elma" for fair flexible grading
 */
const stripParens = (value: string): string =>
  value.replace(/\([^)]*\)/gu, "").replace(/\s+/gu, " ").trim();

export function expandAcceptableAnswers(
  primary: string,
  alternatives: string[] = [],
  allowSlashSplit = true,
): string[] {
  const set = new Set<string>();
  const addVariants = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    set.add(trimmed);
    const noParen = stripParens(trimmed);
    if (noParen) set.add(noParen);
    if (allowSlashSplit && trimmed.includes("/")) {
      for (const part of trimmed.split(/\s*\/\s*/u)) {
        const p = part.trim();
        if (p) {
          set.add(p);
          const np = stripParens(p);
          if (np) set.add(np);
        }
      }
    }
  };
  addVariants(primary);
  for (const alt of alternatives) addVariants(alt);
  return [...set];
}

export function evaluateMatchingPairs(
  answerJson: string,
  userJson: string,
): boolean[] | null {
  try {
    const exp = JSON.parse(answerJson);
    const usr = JSON.parse(userJson);
    if (
      !Array.isArray(exp) ||
      !Array.isArray(usr) ||
      exp.length === 0 ||
      exp.length !== usr.length
    ) {
      return null;
    }
    return exp.map(
      (val: unknown, idx: number) =>
        cleanForCompare(String(val ?? "")) === cleanForCompare(String(usr[idx] ?? "")),
    );
  } catch {
    return null;
  }
}

export function gradeAnswer(input: {
  type: string;
  answer: string;
  alternatives?: string[];
  hasOptions?: boolean;
  hasInteraction?: boolean;
  direction?: "de_tr" | "tr_de" | "de_only";
  satzbauMode?: string;
  targetWordDe?: string;
  userAnswer: string;
}): boolean {
  const userRaw = input.userAnswer ?? "";
  if (!userRaw.trim()) return false;

  // Structured choice/tile/matching checks require exact canonical equality (or order-normalized for multi)
  if (input.type === "multi") {
    const expectedSet = new Set(
      input.answer
        .split(" | ")
        .map((s) => cleanForCompare(s))
        .filter(Boolean),
    );
    const userSet = new Set(
      userRaw
        .split(" | ")
        .map((s) => cleanForCompare(s))
        .filter(Boolean),
    );
    if (expectedSet.size !== userSet.size || expectedSet.size === 0) return false;
    return [...expectedSet].every((x) => userSet.has(x));
  }

  if (input.type === "matching") {
    const pairChecks = evaluateMatchingPairs(input.answer, userRaw);
    return pairChecks !== null && pairChecks.every(Boolean);
  }

  if (input.hasOptions) {
    return cleanForCompare(input.answer) === cleanForCompare(userRaw);
  }

  if (input.type === "satzbau") {
    const acceptedSatzbau = [input.answer, ...(input.alternatives ?? [])];
    const userFolded = cleanForCompare(userRaw, true);
    for (const cand of acceptedSatzbau) {
      if (cleanForCompare(cand, true) === userFolded) return true;
    }

    const targetRaw = (input.targetWordDe || "").replace(/^(der|die|das)\s+/iu, "").trim();
    const targetFolded = cleanForCompare(targetRaw, true);
    const stem = targetFolded.replace(/(en|eln|ern|n)$/iu, "").slice(0, Math.max(3, targetFolded.length - 2));
    const hasTarget =
      Boolean(targetFolded && userFolded.includes(targetFolded)) ||
      Boolean(stem.length >= 3 && userFolded.includes(stem));

    if (input.satzbauMode === "create_own") {
      const tokens = userRaw.trim().split(/\s+/).filter(Boolean);
      const hasVerbSignal =
        /\b(bin|bist|ist|sind|seid|habe|hast|hat|haben|habt|werde|wird|werden|kann|muss|möchte|will|soll|darf|gehe|geht|kaufe|kauft|sehe|sieht|finde|findet|brauche|braucht|mache|macht|arbeite|arbeitet|lerne|lernt|spreche|spricht|wohne|wohnt|esse|isst|trinke|trinkt|komme|kommt|fahre|fährt|nehme|nimmt|gebe|gibt)\b/iu.test(
          userRaw,
        ) || tokens.some((w) => /(e|st|t|en)$/iu.test(w.replace(/[.!?]/g, "")) && w.length >= 3);
      return hasTarget && tokens.length >= 3 && userFolded !== targetFolded && hasVerbSignal;
    }

    if (input.satzbauMode === "free_translation") {
      const expTokens = cleanForCompare(input.answer, true).split(" ").filter(Boolean);
      const usrTokens = userFolded.split(" ").filter(Boolean);
      const matched = expTokens.filter((t) => usrTokens.includes(t)).length;
      const ratio = expTokens.length > 0 ? matched / expTokens.length : 0;
      if (hasTarget && ratio >= 0.75 && Math.abs(usrTokens.length - expTokens.length) <= 2) {
        return true;
      }
    }

    return false;
  }

  if (input.hasInteraction) {
    // Tiles / ordering / spelling: preserve word/character sequence while tolerating trailing punctuation and valid alternatives
    const accepted = [input.answer, ...(input.alternatives ?? [])];
    const userFolded = cleanForCompare(userRaw, true);
    return accepted.some((cand) => cleanForCompare(cand, true) === userFolded);
  }

  // Sentence translation NEVER splits on "/" unless explicit alternative is listed,
  // preventing single-word or fragmented substring false positives.
  const isSentence = input.type === "sentence_translation";
  const userStrict = cleanForCompare(userRaw, false);
  const userFolded = cleanForCompare(userRaw, true);
  const accepted = expandAcceptableAnswers(
    input.answer,
    input.alternatives ?? [],
    !isSentence,
  );

  for (const cand of accepted) {
    if (cleanForCompare(cand, false) === userStrict) return true;
    // Allow ß <-> ss equivalence when all umlauts still strictly match
    if (cleanForCompare(cand, true) === userFolded) return true;
  }

  // Optional bare-noun forgiveness ONLY for word translation in German-production direction
  // (wrong article like "die Apfel" for "der Apfel" MUST remain false!)
  if (
    (input.type === "translation" || input.type === "translation_tr_de") &&
    input.direction !== "de_tr" &&
    /^(?:der|die|das)\s+/iu.test(input.answer)
  ) {
    const bareExpected = cleanForCompare(
      input.answer.replace(/^(?:der|die|das)\s+/iu, ""),
      true,
    );
    if (bareExpected && bareExpected === userFolded) return true;
  }

  return false;
}
