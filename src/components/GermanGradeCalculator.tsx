import React, { useState } from 'react';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { ibToGermanGrade } from '../utils/germanGrade';

export default function GermanGradeCalculator({ onBack }: { onBack: () => void }) {
  const [score, setScore] = useState('');
  const grade = score.trim() === '' ? null : ibToGermanGrade(Number(score));
  const invalid = score.trim() !== '' && grade === null;

  return (
    <div className="flex-1 w-full min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-8">
      <div className="max-w-xl mx-auto">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 py-2 mb-6 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500">
          <ArrowLeft size={18} /> KapsCulator ana menü
        </button>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5"><GraduationCap size={26} /></div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Almanya Not Dönüşümü</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 mb-7">IB final puanın → Alman ortalama notu (Durchschnittsnote)</p>

          <label htmlFor="ib-final-score" className="block text-sm font-bold mb-2">IB final puanın</label>
          <div className="relative">
            <input id="ib-final-score" type="number" inputMode="numeric" min={24} max={45} step={1}
              value={score} onChange={event => setScore(event.target.value)} placeholder="Örn. 35"
              aria-invalid={invalid} aria-describedby={`ib-score-help${invalid ? ' ib-score-error' : ''}`}
              className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-4 pr-16 text-2xl font-bold focus:outline-2 focus:outline-indigo-500" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">/ 45</span>
          </div>
          <p id="ib-score-help" className="text-xs text-slate-500 dark:text-slate-400 mt-2">TOK ve EE dahil toplam puanını gir.</p>
          {invalid && <p id="ib-score-error" role="alert" className="text-sm text-red-600 dark:text-red-400 mt-2">24–45 arasında tam sayı gir.</p>}

          <div role="status" aria-live="polite" aria-atomic="true" className="mt-6 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-6 text-center">
            <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Alman notun</p>
            <p className="text-6xl font-black tracking-tight text-indigo-600 dark:text-indigo-400 my-3">{grade === null ? '—' : grade.toFixed(1).replace('.', ',')}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">1,0 en iyi · 4,0 en düşük geçer not</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-5 leading-relaxed">NC, bölümün kabul sınırıdır; bu sonuç not dönüşümüdür. Diploma tanınması ve kabul ayrıca değerlendirilir.</p>
          <details className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            <summary className="cursor-pointer font-semibold py-1">Hesaplama ve kaynak</summary>
            <p className="mt-2 leading-relaxed">KMK: 1 + 3 × (42 − IB puanı) / 18. Sonuç tek ondalıkta kesilir, yuvarlanmaz. 42–45 puan = 1,0.</p>
            <a href="https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/#2-grade-conversion" target="_blank" rel="noopener noreferrer" className="inline-block text-indigo-600 dark:text-indigo-400 underline mt-2">DAAD · IB not dönüşümü</a>
          </details>
        </div>
      </div>
    </div>
  );
}
