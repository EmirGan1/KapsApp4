/**
 * Conservative reporting policy for an uncalibrated English-only detector.
 * These are UX guardrails, NOT calibrated authorship probabilities or a
 * validated accuracy improvement. Human-verified benchmark data is needed
 * before using detector scores in consequential decisions.
 */
export type DetectorResult = {
  scores: number[];
  tokens: number;
  truncated: boolean;
  words?: number;
  segmentAi?: number[];
  language?: 'likely_turkish' | 'not_identified';
};

export type DetectorAssessment = {
  kind: 'unsupported' | 'insufficient' | 'partial' | 'inconclusive' | 'ai_signal' | 'human_signal' | 'legacy';
  title: string;
  detail: string;
};

export function assessAiDetectorResult(result: DetectorResult): DetectorAssessment {
  const segmentAi = Array.isArray(result.segmentAi)
    ? result.segmentAi.filter(score => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 1)
    : [];
  if (!Number.isInteger(result.words) || !segmentAi.length) {
    return { kind: 'legacy', title: 'Önceki sonuç doğrulanamadı',
      detail: 'Yeni güvenlik kontrolleri için metnini yeniden analiz et.' };
  }
  if (result.language === 'likely_turkish') {
    return { kind: 'unsupported', title: 'Türkçe için güvenilir değerlendirme yok',
      detail: 'Bu model İngilizce üzerinde eğitildi. Türkçe metne AI veya İnsan hükmü vermiyoruz.' };
  }
  if (result.words! < 120) {
    return { kind: 'insufficient', title: 'Metin kısa: sonuç belirsiz',
      detail: '120 kelimeden kısa metinlerde bu modelin AI tahmini özellikle yanıltıcı olabilir.' };
  }
  if (result.truncated) {
    return { kind: 'partial', title: 'Metin kısmen incelendi',
      detail: 'Uzun metnin farklı bölümleri örneklendi; tamamı işlenmediği için genel bir hüküm vermiyoruz.' };
  }
  if (segmentAi.length < 2) {
    return { kind: 'insufficient', title: 'Tek ölçümle karar verilemez',
      detail: 'Güvenilir yorum için farklı metin bölümlerinin tutarlı olması gerekir.' };
  }
  const ai = result.scores[1];
  // Conservative, deliberately uncalibrated rules: never say "AI-written".
  if (result.words! >= 200 && ai >= 0.98 && segmentAi.every(score => score >= 0.95)) {
    return { kind: 'ai_signal', title: 'AI benzeri dil sinyali saptandı',
      detail: 'Birden fazla bölüm aynı yönde sinyal verdi. Bu, metnin AI tarafından yazıldığını kanıtlamaz.' };
  }
  if (ai <= 0.20 && segmentAi.every(score => score <= 0.40)) {
    return { kind: 'human_signal', title: 'İnsan yazımıyla uyumlu özellikler',
      detail: 'Bölüm sonuçları insan yazımı yönünde. Bu da yazarlığı kesin biçimde doğrulamaz.' };
  }
  return { kind: 'inconclusive', title: 'Metnin kaynağı belirlenemedi',
    detail: 'Model skorları tek başına güvenilir sınıflandırma için yeterli değil.' };
}
