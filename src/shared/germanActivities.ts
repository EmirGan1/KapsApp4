export const activities = [
  ["choice", "Anlam Avı", "Doğru Türkçe anlamı kartlardan seç.", "◎"],
  ["matching", "Eşini Bul", "Almanca ve Türkçe kartları eşleştir.", "⇄"],
  ["article", "Artikel Arenası", "İsmin artikelini seç: der, die veya das.", "◈"],
  ["ordering", "Cümle Ustası", "Karışık kelimeleri doğru sıraya diz.", "≡"],
  ["spelling", "Harf Atölyesi", "Harf taşlarıyla Almanca ifadeyi oluştur.", "A"],
  ["missing", "Eksik Harf", "İfadede gizlenen harfi tamamla.", "_"],
  ["true_false", "Doğru mu?", "Gösterilen kelime ve anlam eşleşmesini değerlendir.", "✓"],
  ["intruder", "Uyumsuzu Yakala", "Anlamı yanlış eşleştirilmiş kartı bul.", "⌕"],
  ["multi", "Çoklu Seçim", "İfadeye ait bütün anlam kartlarını seç.", "☷"],
  ["translation", "Çeviri Görevi", "Türkçe ipucundan Almanca ifadeyi hatırla.", "✎"],
  ["sentence_translation", "Cümle Çevirisi", "Ders notlarındaki cümleyi seçtiğin yönde çevir.", "↔"],
  ["sentence_ordering", "Cümleyi Kur", "Tam cümleyi kelime taşlarıyla yeniden oluştur.", "▤"],
  ["sentence_gap", "Cümleyi Tamamla", "Cümlede gizlenen kelimeyi bul.", "…"],
] as const;
export const studyLevels = ["A1", "A2", "B1", "B2", "C1"] as const;
export type StudyDirection = "de_tr" | "tr_de" | "mixed";
export function validStudyFilters(direction: unknown, levels: unknown): boolean {
  return ["de_tr", "tr_de", "mixed"].includes(String(direction)) && Array.isArray(levels) && levels.length > 0 && levels.length <= 5 && levels.every(l => studyLevels.includes(l as any));
}
export const activityLabel = (type: string) => activities.find(a => a[0] === type)?.[1] ?? type;
