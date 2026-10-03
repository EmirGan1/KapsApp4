import React, { useEffect } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  Thermometer,
  CloudRain,
  Wind,
  Shirt,
  Compass,
  AlertCircle,
  Sun,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { ThreeDayWeatherAdvice, DayAdviceDetail } from '../utils/weatherService';
import WeatherIcon from './WeatherIcon';

interface WeatherAdviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  adviceData: ThreeDayWeatherAdvice | null;
  locationName?: string;
}

export default function WeatherAdviceModal({
  isOpen,
  onClose,
  adviceData,
  locationName = "İstanbul"
}: WeatherAdviceModalProps) {
  // ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !adviceData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-md border border-white/20">
              <Sparkles size={18} className="text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg tracking-tight flex items-center gap-2">
                <span>3 Günlük Akıllı Hava Rehberi</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  {locationName}
                </span>
              </h3>
              <p className="text-xs text-white/80 line-clamp-1">
                Giyim, yağış olasılığı ve etkinlik önerileri
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 touch-pan-y overscroll-contain">
          {adviceData.days.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm">Genişletilmiş tahmin verisi yükleniyor...</p>
            </div>
          ) : (
            adviceData.days.map((day: DayAdviceDetail) => {
              const isFirstDay = day.dayIndex === 1;
              return (
                <div
                  key={day.dayIndex}
                  className={`rounded-2xl p-4 sm:p-5 border transition-all ${
                    isFirstDay
                      ? 'bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/80 dark:from-indigo-950/40 dark:via-slate-800/60 dark:to-slate-900/60 border-indigo-200/80 dark:border-indigo-800/80 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80'
                  }`}
                >
                  {/* Top Bar of Day Card */}
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                        <WeatherIcon code={day.weatherCode} isDay={true} size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                            {day.dayName}
                          </h4>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            • {day.dateLabel}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {day.weatherLabel} ({day.tempMin}° / {day.tempMax}°C)
                        </p>
                      </div>
                    </div>

                    {/* Rain Badge */}
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black font-mono border ${
                          day.rainProbability >= 45
                            ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <CloudRain size={13} className={day.rainProbability >= 45 ? 'text-sky-500' : 'text-slate-400'} />
                        <span>%{day.rainProbability}</span>
                      </span>
                    </div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-3">
                    {/* Clothing advice */}
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                        <Shirt size={15} />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                          Giyim Tavsiyesi
                        </span>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                          {day.clothingAdvice}
                        </p>
                      </div>
                    </div>

                    {/* Wind & Condition trend */}
                    <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60">
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                        <Wind size={15} />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 block">
                          Rüzgar & Trend
                        </span>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                          {day.tempDiffText} • {day.windText}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Activity suitability */}
                  <div className="mt-2.5 px-3 py-2 rounded-xl bg-blue-50/60 dark:bg-slate-900/40 border border-blue-100 dark:border-slate-800/80 flex items-center gap-2">
                    <Compass size={14} className="text-blue-500 shrink-0" />
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-tight">
                      <strong className="text-slate-800 dark:text-slate-200">Etkinlik Durumu: </strong>
                      {day.activityAdvice}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {/* Tahmin Belirsizliği Uyarısı (Disclaimer) */}
          <div className="text-[11px] text-slate-400 dark:text-slate-500 italic text-center mt-4 border-t border-slate-200/70 dark:border-white/10 pt-3">
            {adviceData.disclaimer}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            Anladım / Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
