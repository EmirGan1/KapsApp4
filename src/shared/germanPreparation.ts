export interface PreparationProgress {
  stage: string;
  percent: number;
  status: 'working' | 'done' | 'failed';
  estimateMs: number;
  elapsedMs: number;
  remainingMs?: number;
}
export const PREPARATION_STAGES: Record<string, string> = {
  accepted: 'İsteğin alındı, hazırlık başlıyor…',
  loading_vocabulary: 'Seçtiğin seviye ve kelimeler yükleniyor…',
  building_questions: 'Alıştırma soruları oluşturuluyor…',
  generating_ai: 'Sana özel sorular hazırlanıyor…',
  validating_questions: 'Sorular ve cevaplar kontrol ediliyor…',
  saving_session: 'Testin kaydediliyor…',
  ready: 'Testin hazır!',
  failed: 'Hazırlık tamamlanamadı.',
};
