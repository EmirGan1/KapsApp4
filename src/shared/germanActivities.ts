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
] as const;
export const activityLabel = (type: string) => activities.find(a => a[0] === type)?.[1] ?? type;
