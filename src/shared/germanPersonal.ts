export const PERSONAL_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "UNKNOWN"] as const;
export type PersonalCefrLevel = (typeof PERSONAL_CEFR_LEVELS)[number];

export const PERSONAL_EXERCISE_MODES = [
  {
    id: "flashcards",
    code: "A",
    titleTr: "Bilgi Kartları",
    shortTr: "Kartlar",
    descriptionTr: "Ön-arka yüz, telaffuz, örnek cümle ve yazılı/öz değerlendirmeli hatırlama.",
    supportsDirection: true,
    accent: "#0d9488",
  },
  {
    id: "matching",
    code: "B",
    titleTr: "Kelime Eşleştirme",
    shortTr: "Eşleştirme",
    descriptionTr: "Aynı anlam çakışması olmadan Almanca ve Türkçe çiftlerini hızlıca eşle.",
    supportsDirection: false,
    accent: "#2563eb",
  },
  {
    id: "multiple_choice",
    code: "C",
    titleTr: "Çoktan Seçmeli",
    shortTr: "Test",
    descriptionTr: "Anlamca yakın ve dilbilgisi uyumlu çeldiricilerle tek doğru yanıtı bul.",
    supportsDirection: true,
    accent: "#4f46e5",
  },
  {
    id: "true_false",
    code: "D",
    titleTr: "Doğru / Yanlış",
    shortTr: "D / Y",
    descriptionTr: "Verilen Almanca–Türkçe eşleştirmesinin doğru olup olmadığını ayırt et.",
    supportsDirection: false,
    accent: "#0284c7",
  },
  {
    id: "translation_de_tr",
    code: "E",
    titleTr: "Almanca → Türkçe Çeviri",
    shortTr: "DE → TR",
    descriptionTr: "Doğal Türkçe karşılıkları kabul eden anlam odaklı yapay zekâ değerlendirmesi.",
    supportsDirection: false,
    accent: "#059669",
  },
  {
    id: "translation_tr_de",
    code: "F",
    titleTr: "Türkçe → Almanca Çeviri",
    shortTr: "TR → DE",
    descriptionTr: "Artikel, hâl, fiil çekimi ve söz dizimini kontrol eden Almanca üretim pratiği.",
    supportsDirection: false,
    accent: "#d97706",
  },
  {
    id: "spelling",
    code: "G",
    titleTr: "Yazım & Aktif Hatırlama",
    shortTr: "Yazım",
    descriptionTr: "Artikel, büyük/küçük harf, umlaut (ä, ö, ü) ve ß doğruluğu için sıkı yazım.",
    supportsDirection: false,
    accent: "#be123c",
  },
  {
    id: "sentence_construction",
    code: "H",
    titleTr: "Cümle Kurma",
    shortTr: "Cümle Kur",
    descriptionTr: "Kendi kelimelerinle oluşturulan karışık Almanca kelimeleri doğru sıraya diz.",
    supportsDirection: false,
    accent: "#7c3aed",
  },
  {
    id: "fill_blank",
    code: "I",
    titleTr: "Boşluk Doldurma",
    shortTr: "Boşluk",
    descriptionTr: "Bağlam içindeki Almanca cümlede eksik hedef ifadeyi yazarak veya seçerek tamamla.",
    supportsDirection: false,
    accent: "#0891b2",
  },
  {
    id: "contextual",
    code: "J",
    titleTr: "Bağlamsal Kelime Pratiği",
    shortTr: "Bağlam",
    descriptionTr: "Seviyene uygun mini diyalog ve gerçek hayat senaryolarında kelimeyi kullan.",
    supportsDirection: false,
    accent: "#ea580c",
  },
] as const;

export type PersonalExerciseModeId = (typeof PERSONAL_EXERCISE_MODES)[number]["id"];

export type PersonalDirection = "de_tr" | "tr_de" | "mixed";

export type PersonalSourceType = "text" | "gdoc" | "file";

export type PersonalSyncStatus =
  | "idle"
  | "syncing"
  | "synced"
  | "unchanged"
  | "error"
  | "auth_required"
  | "not_found"
  | "rate_limited";

export interface PersonalCefrBreakdownEntry {
  level: PersonalCefrLevel;
  count: number;
  percent: number;
}

export interface PersonalCefrSummary {
  total: number;
  breakdown: PersonalCefrBreakdownEntry[];
  dominantLevels: PersonalCefrLevel[];
  summaryTr: string;
}

export interface PersonalMasterySnapshot {
  wordId: string;
  consecutiveCorrect: number;
  totalCorrect: number;
  totalIncorrect: number;
  masteryStatus: "not_learned" | "learning" | "almost_mastered" | "mastered";
  needsReview: boolean;
  lastPracticedAt: string | null;
  masteredAt: string | null;
  nextReviewAt: string | null;
}

export interface PersonalSourceSummary {
  id: string;
  title: string;
  sourceType: PersonalSourceType;
  fileName: string | null;
  gdocId: string | null;
  gdocUrl: string | null;
  autoSyncEnabled: boolean;
  syncIntervalMin: number;
  syncStatus: PersonalSyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  totalActiveItems: number;
  masteredItems: number;
  almostMasteredItems: number;
  learningItems: number;
  uncertainItems: number;
  excludedItems: number;
  completionPercent: number;
  cefrSummary: PersonalCefrSummary;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalVocabItemDTO {
  id: string;
  sourceItemId?: string;
  canonicalKey: string;
  senseKey: string;
  de: string;
  tr: string;
  alternatives: string[];
  article: string;
  plural: string;
  partOfSpeech: string;
  reflexive: boolean;
  separable: boolean;
  preposition: string;
  requiredCase: string;
  exampleDe: string;
  exampleTr: string;
  cefrLevel: PersonalCefrLevel;
  cefrConfidence: number;
  cefrSource: string;
  category: string;
  notes: string;
  uncertain: boolean;
  excluded?: boolean;
  active?: boolean;
  originalExcerpt?: string;
  sourceIds: string[];
  sourceTitles: string[];
  mastery: PersonalMasterySnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface PersonalQuestion {
  id: string;
  vocabId: string;
  vocabIds: string[];
  mode: PersonalExerciseModeId;
  direction: "de_tr" | "tr_de" | "de_only";
  prompt: string;
  subPrompt?: string;
  contextPassage?: string;
  contextTag: string;
  fingerprint: string;
  cefrLevel: PersonalCefrLevel;
  options?: string[];
  tiles?: string[];
  matchingLeft?: string[];
  matchingRight?: string[];
  matchingVocabIds?: string[];
  expectedAnswer: string;
  acceptableAnswers: string[];
  displayMeta: {
    de: string;
    tr: string;
    article?: string;
    plural?: string;
    partOfSpeech?: string;
    grammar?: string;
    exampleDe?: string;
    exampleTr?: string;
    audioText?: string;
  };
  aiGenerated: boolean;
  variant?: "typed" | "choice" | "recall" | "self_assess";
  statementIsTrue?: boolean;
}

export interface PersonalQuestionResult {
  questionId: string;
  attemptId: string;
  isCorrect: boolean;
  creditGranted: boolean;
  selfAssessed?: boolean;
  skipped?: boolean;
  userAnswer: string;
  expectedAnswer: string;
  feedbackTr: string;
  errorTags: string[];
  wordBreakdown?: Array<{ token: string; noteTr: string }>;
  naturalAlternative?: string;
  pairResults?: boolean[];
  streakBefore: number;
  streakAfter: number;
  masteredNow: boolean;
  reported?: boolean;
  aiEvaluated: boolean;
}

export interface PersonalComprehensiveReport {
  totalTargets: number;
  coveredTargets: number;
  coveragePercent: number;
  answeredCount: number;
  correctCount: number;
  incorrectCount: number;
  testAccuracyPercent: number;
  newlyMastered: Array<{ vocabId: string; de: string; tr: string }>;
  stillLearning: Array<{ vocabId: string; de: string; tr: string; streak: number }>;
  weakestWords: Array<{ vocabId: string; de: string; tr: string; incorrectCount: number; streak: number }>;
  byMode: Array<{
    mode: PersonalExerciseModeId;
    labelTr: string;
    total: number;
    correct: number;
    accuracyPercent: number;
  }>;
  sourceMasterySnapshots: Array<{
    sourceId: string;
    title: string;
    masteredItems: number;
    totalActiveItems: number;
    completionPercent: number;
  }>;
  recommendedNextTr: string;
}

export interface PersonalSessionDTO {
  id: string;
  kind: "practice" | "comprehensive";
  mode: PersonalExerciseModeId | "adaptive" | "comprehensive";
  direction: PersonalDirection;
  sourceIds: string[];
  status: "loading" | "ready" | "active" | "paused" | "completed" | "error";
  totalTargets: number;
  coveredCount: number;
  coveragePercent: number;
  currentBatch: number;
  totalBatches: number;
  batchSize: number;
  extendedMode: boolean;
  currentIndex: number;
  questions: PersonalQuestion[];
  results: Record<string, PersonalQuestionResult>;
  masteryMap: Record<string, PersonalMasterySnapshot>;
  report: PersonalComprehensiveReport | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function isPersonalExerciseMode(v: unknown): v is PersonalExerciseModeId {
  return typeof v === "string" && PERSONAL_EXERCISE_MODES.some((m) => m.id === v);
}

export function isPersonalCefrLevel(v: unknown): v is PersonalCefrLevel {
  return typeof v === "string" && (PERSONAL_CEFR_LEVELS as readonly string[]).includes(v);
}

export function personalModeLabelTr(mode: string): string {
  if (mode === "adaptive") return "Akıllı Adaptif Pratik";
  if (mode === "comprehensive") return "Genel Test — Tüm Kelimeler";
  return PERSONAL_EXERCISE_MODES.find((m) => m.id === mode)?.titleTr ?? mode;
}

export function formatTurkishPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `%${rounded.toFixed(rounded % 1 === 0 ? 0 : 1).replace(".", ",")}`;
}
