export const studyLevels = ["A1", "A2", "B1", "B2", "C1"] as const;
export type CefrLevel = (typeof studyLevels)[number];
export type StoredCefrLevel = CefrLevel | "UNCLASSIFIED";

export const CEFR_META: Record<
  CefrLevel,
  {
    code: CefrLevel;
    trName: string;
    enName: string;
    subtitle: string;
    accent: string;
    accentDark: string;
  }
> = {
  A1: {
    code: "A1",
    trName: "Başlangıç",
    enName: "Beginner",
    subtitle: "Günlük temel kelimeler, tanışma ve şimdiki zaman",
    accent: "#58CC02",
    accentDark: "#46A302",
  },
  A2: {
    code: "A2",
    trName: "Temel",
    enName: "Elementary",
    subtitle: "Geçmiş zaman (Perfekt), modal fiiller ve günlük diyalog",
    accent: "#1CB0F6",
    accentDark: "#1899D6",
  },
  B1: {
    code: "B1",
    trName: "Orta",
    enName: "Intermediate",
    subtitle: "Bağlaçlar, Präteritum, Konjunktiv II ve bağımsız anlatım",
    accent: "#CE82FF",
    accentDark: "#A855F7",
  },
  B2: {
    code: "B2",
    trName: "Orta Üstü",
    enName: "Upper Intermediate",
    subtitle: "Edilgen çatı, soyut kavramlar ve akademik ifadeler",
    accent: "#FF9600",
    accentDark: "#D97706",
  },
  C1: {
    code: "C1",
    trName: "İleri",
    enName: "Advanced",
    subtitle: "Akıcı söylem, nüanslı bağlaçlar ve üst düzey kelime hazinesi",
    accent: "#FF4B4B",
    accentDark: "#DC2626",
  },
};

export const MASTERY_TARGET = 5;

export type MasteryStatus =
  | "not_learned"
  | "learning"
  | "almost_mastered"
  | "mastered";

export function masteryStatusFromStreak(
  consecutiveCorrect: number,
  permanentlyMastered = false,
): MasteryStatus {
  if (permanentlyMastered || consecutiveCorrect >= MASTERY_TARGET) {
    return "mastered";
  }
  if (consecutiveCorrect >= 4) return "almost_mastered";
  if (consecutiveCorrect >= 1) return "learning";
  return "not_learned";
}

export const MASTERY_STATUS_LABELS: Record<MasteryStatus, string> = {
  not_learned: "Öğrenilmedi",
  learning: "Öğreniliyor",
  almost_mastered: "Ustalaşmaya Yakın",
  mastered: "Tam Öğrenildi",
};

export const XP_RULES = {
  CORRECT_ANSWER: 5,
  NEW_MASTERY: 15,
  COMPLETED_LESSON: 20,
} as const;

export const ACHIEVEMENT_DEFS = [
  {
    id: "first_10",
    title: "İlk 10 Kelime",
    description: "Toplam 10 farklı Almanca kelimeyi 5/5 yaparak tamamla.",
    target: 10,
    metric: "mastered_total",
  },
  {
    id: "mastered_50",
    title: "50 Kelime Ustası",
    description: "Toplam 50 farklı kelimeyi kalıcı olarak öğren.",
    target: 50,
    metric: "mastered_total",
  },
  {
    id: "mastered_100",
    title: "100 Kelime Ustası",
    description: "Toplam 100 farklı kelimeyi kalıcı olarak öğren.",
    target: 100,
    metric: "mastered_total",
  },
  {
    id: "a1_completed",
    title: "A1 Tamamlandı",
    description: "A1 — Başlangıç seviyesindeki tüm doğrulanmış kelimeleri tamamla.",
    target: 100,
    metric: "a1_percent",
  },
  {
    id: "streak_7",
    title: "7 Günlük Seri",
    description: "Arka arkaya 7 gün Almanca pratiği yap.",
    target: 7,
    metric: "streak",
  },
  {
    id: "perfect_lesson",
    title: "İlk Kusursuz Ders",
    description: "Bir kelime oturumunu tüm soruları doğru yanıtlayarak tamamla.",
    target: 1,
    metric: "perfect_lessons",
  },
] as const;

export const activities = [
  ["choice", "Çoktan Seçmeli Çeviri", "Doğru Almanca veya Türkçe anlamı seç.", "◎"],
  ["matching", "Kelime Eşleştirme", "Almanca kelimeleri Türkçe anlamlarıyla eşle.", "⇄"],
  ["article", "Artikel Çalışması", "İsmin doğru artikelini seç: der, die veya das.", "◈"],
  ["conjugation", "Fiil Çekimi", "Seviyeye uygun fiil çekimini tamamla.", "⚡"],
  ["gap", "Boşluk Doldurma", "Cümlede eksik bırakılan kelimeyi bul.", "…"],
  ["ordering", "Kelime Sıralama", "Karışık kelimeleri doğru Almanca sıraya diz.", "≡"],
  ["sentence_translation", "Cümle Çevirisi", "Seviyene uygun tam cümleleri çevir.", "↔"],
  ["sentence_completion", "Cümle Tamamlama", "Anlam ve dilbilgisine uygun ifadeyi seç.", "▤"],
  ["listening", "Dinleme Alıştırması", "Almanca telaffuzu dinle ve anlamını bul.", "♪"],
  ["mistake_review", "Hata Tekrarı", "Daha önce yanıldığın kelimeleri yeniden çöz.", "↺"],
  ["translation", "Kelime Yazma", "İpucundan yola çıkarak doğru kelimeyi yaz.", "✎"],
] as const;

export type ActivityType = (typeof activities)[number][0] | "mixed" | string;

export type StudyDirection = "de_tr" | "tr_de" | "mixed";

export function isCefrLevel(value: unknown): value is CefrLevel {
  return typeof value === "string" && (studyLevels as readonly string[]).includes(value);
}

export function validStudyFilters(direction: unknown, levels: unknown): boolean {
  return (
    ["de_tr", "tr_de", "mixed"].includes(String(direction)) &&
    Array.isArray(levels) &&
    levels.length > 0 &&
    levels.length <= 5 &&
    levels.every((l) => isCefrLevel(l))
  );
}

export const activityLabel = (type: string): string => {
  const found = activities.find((a) => a[0] === type);
  if (found) return found[1];
  const legacy: Record<string, string> = {
    sentence_ordering: "Kelime Sıralama",
    sentence_gap: "Boşluk Doldurma",
    spelling: "Harf Atölyesi",
    missing: "Eksik Harf",
    true_false: "Doğru / Yanlış",
    intruder: "Uyumsuzu Yakala",
    multi: "Çoklu Seçim",
    cases: "İsim Hâlleri",
    correction: "Cümle Düzeltme",
    multiple_choice: "Çoktan Seçmeli",
  };
  return legacy[type] ?? type;
};
