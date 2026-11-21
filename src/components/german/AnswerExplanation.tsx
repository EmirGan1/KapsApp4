import type { MistakeExplanationResponse } from './types';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { GermanSpeakButtons } from './PronunciationGuideBox';
export function AnswerExplanation({ explanation }: { explanation: MistakeExplanationResponse }) {
  return <section className="kg-ai-explain-card kg-answer-explanation" aria-label="Cümle ve kelime açıklaması">
    <div className="kg-section-head"><strong><CheckCircle2 size={16} /> {explanation.headlineTr}</strong>{explanation.fallbackUsed && <span className="kg-badge-soft">Sözlük özeti</span>}</div>
    {explanation.possibleQuestionIssue && <p className="kg-alert">Soru anahtarı belirsiz olabilir; hata bildirerek incelemeye gönderebilirsin.</p>}
    <p>{explanation.whyWrongOrRightTr}</p>
    <div className="kg-corrected-box"><div className="kg-section-head"><strong>Doğru ifade</strong><GermanSpeakButtons text={explanation.correctedSentenceDe || explanation.example.de} compact /></div>
      <p lang="de" className="kg-corrected-sentence">{explanation.correctedSentenceDe || explanation.example.de}</p>
      <p>{explanation.correctedSentenceTr || (explanation.fallbackUsed ? "Tam cümle çevirisi şu anda alınamadı." : explanation.correctMeaningTr)}</p>
    </div>
    {!!explanation.wordBreakdown?.length && <div className="kg-word-breakdown"><h3><BookOpen size={16} /> Cümledeki kelimeler</h3>
      <dl>{explanation.wordBreakdown.map((word, index) => <div key={`${index}-${word.token}`}><dt lang="de">{word.token}</dt><dd>{word.meaningTr || 'Bağlamsal anlam alınamadı'}{word.noteTr && <small>{word.noteTr}</small>}</dd></div>)}</dl>
    </div>}
    <details className="kg-disclosure"><summary>Kural ve hatırlama ipucu</summary><p>{explanation.ruleTr}</p><p>{explanation.memoryTipTr}</p>{explanation.detailedNoteTr && <p>{explanation.detailedNoteTr}</p>}<p lang="de">{explanation.example.de}</p><p>{explanation.example.tr}</p></details>
  </section>;
}
