export const DESKLIB_MODEL = 'desklib/ai-text-detector-v1.01';
export const DESKLIB_REVISION = '5fdea974cd4287c61674951ec78803aa274e2fb7';
export const LEGACY_TURKISH_MODEL = 'ertoluk/ai-metin-dedektor';
export const LEGACY_TURKISH_REVISION = '2df7f6df282445a42353bb87fb512c4cb7c06fb5';
export const TURKISH_MODEL = 'ads2009/turkish-ai-text-detector-berturk-v2';
export const TURKISH_REVISION = 'bc9df3aab4cb42cf8e6bea0a7fb377b12b8bb661';
export const TURKISH_MIN_WORDS = 60;
export const AI_TEXT_LIMIT = 50_000;
export const AI_SEGMENT_LIMIT = 32;
export const AI_CHECKER_RESULT_NOTIFICATION = 'ai_checker_result';
export const AI_MIN_WORDS = 120;
export const AI_RESULT_TTL_MS = 30 * 60 * 1000;

export type DetectorResult = {
  model: typeof DESKLIB_MODEL | typeof TURKISH_MODEL | typeof LEGACY_TURKISH_MODEL;
  revision: typeof DESKLIB_REVISION | typeof TURKISH_REVISION | typeof LEGACY_TURKISH_REVISION;
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
  const turkish = model === TURKISH_MODEL && revision === TURKISH_REVISION && (language === 'turkish' || language === 'unsupported');
  const legacy = model === LEGACY_TURKISH_MODEL && revision === LEGACY_TURKISH_REVISION && (language === 'turkish' || language === 'unsupported');
  const english = model === DESKLIB_MODEL && revision === DESKLIB_REVISION;
  if ((!turkish && !english && !legacy)
    || !Number.isInteger(tokens) || tokens < 0 || tokens > AI_SEGMENT_LIMIT * 510
    || !Number.isInteger(words) || words < 0 || words > AI_TEXT_LIMIT
    || typeof truncated !== 'boolean' || !['english', 'turkish', 'unsupported'].includes(language)
    || !Array.isArray(segmentAi) || segmentAi.length > AI_SEGMENT_LIMIT || !segmentAi.every(isScore)) return null;

  const minimum = turkish || legacy ? TURKISH_MIN_WORDS : AI_MIN_WORDS;
  const scored = (turkish && language === 'turkish' || legacy && language === 'turkish' && scores !== null || english && language === 'english') && words >= minimum && !truncated;
  if (scored) {
    if (!Array.isArray(scores) || scores.length !== 2 || !scores.every(isScore)
      || Math.abs(scores[0] + scores[1] - 1) > 1e-9 || !segmentAi.length || !tokens) return null;
  } else if (scores !== null || segmentAi.length || tokens !== 0) return null;

  return { model, revision, scores, tokens, truncated, words, segmentAi, language };
}

export function assessAiDetectorResult(result: DetectorResult) {
  const legacy = result.model === LEGACY_TURKISH_MODEL && result.language === 'turkish';
  const turkish = result.model === TURKISH_MODEL && result.language === 'turkish';
  const minimum = turkish || legacy ? TURKISH_MIN_WORDS : AI_MIN_WORDS;
  if (result.language !== 'english' && !turkish && !legacy) {
    return { kind: 'unsupported', title: 'Bu dil için güvenilir değerlendirme yapılamıyor',
      detail: result.language === 'turkish' ? 'Desklib İngilizce için eğitildi. Türkçe metinler puanlanmaz.'
        : 'Metni güvenle İngilizce olarak tanımlayamadık.' };
  }
  if (result.words < minimum) {
    return { kind: 'insufficient', title: 'Metin kısa',
      detail: `Daha uzun bir örnekle yeniden dene. Analiz için en az ${minimum} kelime gerekiyor.` };
  }
  if (result.truncated) {
    return { kind: 'partial', title: 'Metin analiz sınırını aşıyor',
      detail: 'Bu metin modelin 32 bölümlük analiz sınırını aşıyor. Metni daha küçük bölümlere ayır.' };
  }
  if (legacy) {
    return { kind: 'unvalidated', title: 'Türkçe dedektör doğrulanamadı',
      detail: 'Bu model insan yazımı ve AI metinlerini güvenilir biçimde ayıramadığı için Türkçe sonuç üretimi durduruldu.' };
  }
  // Turkish 0.2/0.8 margins are conservative product defaults, not calibrated accuracy.
  // Contradicting windows always abstain.
  if (!result.scores || !result.segmentAi.length) {
    return { kind: 'inconclusive', title: 'Belirsiz', detail: 'Model puanı alınamadı. Metni yeniden analiz et.' };
  }
  if (result.segmentAi.every(score => turkish ? score > 0.8 : score >= 0.5)) {
    return { kind: 'ai_signal', title: 'AI benzeri özellikler tespit edildi',
      detail: 'Model skoru AI üretimi yönünde. Bu değerlendirme yazarlığı kanıtlamaz.' };
  }
  if (result.segmentAi.every(score => score < (turkish ? 0.2 : 0.5))) {
    return { kind: 'human_signal', title: 'İnsan yazımıyla uyumlu özellikler',
      detail: turkish ? 'Model skoru insan yazımı yönünde. Kişisel anlatı ve yeniden yazılmış AI metinleri de bu sonucu verebilir. Bu değerlendirme yazarlığı kanıtlamaz.' : 'Model skoru insan yazımı yönünde. Bu değerlendirme yazarlığı kanıtlamaz.' };
  }
  return { kind: 'inconclusive', title: 'Belirsiz',
    detail: 'Model güvenli bir sonuca ulaşamadı veya metnin bölümleri farklı sinyaller verdi.' };
}
