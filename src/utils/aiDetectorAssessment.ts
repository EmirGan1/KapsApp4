export const DESKLIB_MODEL = 'desklib/ai-text-detector-v1.01';
export const DESKLIB_REVISION = '5fdea974cd4287c61674951ec78803aa274e2fb7';
export const AI_TEXT_LIMIT = 50_000;
export const AI_SEGMENT_LIMIT = 32;
export const AI_MIN_WORDS = 120;
export const AI_RESULT_TTL_MS = 30 * 60 * 1000;

export type DetectorResult = {
  model: typeof DESKLIB_MODEL;
  revision: typeof DESKLIB_REVISION;
  scores: [number, number] | null;
  tokens: number;
  truncated: boolean;
  words: number;
  segmentAi: number[];
  language: 'english' | 'turkish' | 'unsupported';
};

export function parseDetectorResult(value: unknown): DetectorResult | null {
  if (!value || typeof value !== 'object') return null;
  const { model, revision, scores, tokens, truncated, words, segmentAi, language } = value as DetectorResult;
  const isScore = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  if (model !== DESKLIB_MODEL || revision !== DESKLIB_REVISION
    || !Number.isInteger(tokens) || tokens < 0 || tokens > AI_SEGMENT_LIMIT * 510
    || !Number.isInteger(words) || words < 1 || words > AI_TEXT_LIMIT
    || typeof truncated !== 'boolean' || !['english', 'turkish', 'unsupported'].includes(language)
    || !Array.isArray(segmentAi) || segmentAi.length > AI_SEGMENT_LIMIT || !segmentAi.every(isScore)) return null;

  const scored = language === 'english' && words >= AI_MIN_WORDS && !truncated;
  if (scored) {
    if (!Array.isArray(scores) || scores.length !== 2 || !scores.every(isScore)
      || Math.abs(scores[0] + scores[1] - 1) > 1e-9 || !segmentAi.length || !tokens) return null;
  } else if (scores !== null || segmentAi.length || tokens !== 0) return null;

  return { model, revision, scores, tokens, truncated, words, segmentAi, language };
}

export function assessAiDetectorResult(result: DetectorResult) {
  if (result.language !== 'english') {
    return { kind: 'unsupported', title: 'Bu dil için güvenilir değerlendirme yapılamıyor',
      detail: result.language === 'turkish' ? 'Desklib İngilizce için eğitildi. Türkçe metinler puanlanmaz.'
        : 'Metni güvenle İngilizce olarak tanımlayamadık.' };
  }
  if (result.words < AI_MIN_WORDS) {
    return { kind: 'insufficient', title: 'Metin kısa',
      detail: `Daha uzun bir örnekle yeniden dene. Analiz için en az ${AI_MIN_WORDS} kelime gerekiyor.` };
  }
  if (result.truncated) {
    return { kind: 'partial', title: 'Metin analiz sınırını aşıyor',
      detail: 'Bu metin modelin 16.320 tokenlık analiz sınırını aşıyor. Metni daha küçük bölümlere ayır.' };
  }
  // The 0.5 split comes from the model card. These are model signals, without local calibration.
  if (result.segmentAi.every(score => score >= 0.5)) {
    return { kind: 'ai_signal', title: 'AI benzeri özellikler tespit edildi',
      detail: 'Model skoru AI üretimi yönünde. Bu değerlendirme yazarlığı kanıtlamaz.' };
  }
  if (result.segmentAi.every(score => score < 0.5)) {
    return { kind: 'human_signal', title: 'İnsan yazımıyla uyumlu özellikler',
      detail: 'Model skoru insan yazımı yönünde. Bu değerlendirme yazarlığı kanıtlamaz.' };
  }
  return { kind: 'inconclusive', title: 'Sonuç belirsiz',
    detail: 'Metnin farklı bölümleri farklı yönlerde sinyal verdi.' };
}
