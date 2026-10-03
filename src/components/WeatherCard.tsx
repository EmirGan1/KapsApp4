import React, { useState, useMemo } from 'react';
import {
  Thermometer,
  Umbrella,
  Wind,
  Sun,
  Sparkles,
  ArrowRight,
  CloudRain
} from 'lucide-react';
import WeatherIcon from './WeatherIcon';
import WeatherAdviceModal from './WeatherAdviceModal';
import {
  WeatherData,
  getWeatherMeta,
  getDetailed3DayAdvice,
  ThreeDayWeatherAdvice
} from '../utils/weatherService';

interface WeatherCardProps {
  weatherData: WeatherData;
  className?: string;
  onOpenDetailedAdvice?: () => void;
}

export default function WeatherCard({
  weatherData,
  className = "",
  onOpenDetailedAdvice
}: WeatherCardProps) {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const weatherMeta = useMemo(() => {
    return getWeatherMeta(weatherData.current.weatherCode, weatherData.current.isDay);
  }, [weatherData.current.weatherCode, weatherData.current.isDay]);

  const adviceData: ThreeDayWeatherAdvice = useMemo(() => {
    return getDetailed3DayAdvice(weatherData);
  }, [weatherData]);

  const handleOpenModal = () => {
    if (onOpenDetailedAdvice) {
      onOpenDetailedAdvice();
    } else {
      setIsDetailModalOpen(true);
    }
  };

  const smartAdvice = adviceData.todaySummary;

  return (
    <>
      <section
        className={`relative rounded-3xl p-5 sm:p-7 overflow-hidden shadow-xl sm:shadow-2xl bg-gradient-to-br ${
          weatherData.current.isDay ? weatherMeta.bgGradientDay : weatherMeta.bgGradientNight
        } transition-all duration-700 border border-white/20 space-y-4 ${className}`}
      >
        {/* Atmospheric Glow Background Effects */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-black/20 blur-3xl pointer-events-none" />

        {/* ------------------------------------------------------------- */}
        {/* AKILLI HAVA ASİSTANI & GÜNÜN + SONRAKİ GÜNÜN TAVSİYESİ KUTUSU */}
        {/* ------------------------------------------------------------- */}
        <div className="relative z-10 bg-white/10 dark:bg-slate-800/40 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 sm:p-4 text-white shadow-xs space-y-2.5">
          {/* Today's Advice Line */}
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-md shrink-0 mt-0.5 shadow-2xs">
              {smartAdvice.iconType === 'umbrella' && <Umbrella size={18} className="text-sky-300" />}
              {smartAdvice.iconType === 'wind' && <Wind size={18} className="text-indigo-200" />}
              {smartAdvice.iconType === 'sun' && <Sun size={18} className="text-amber-300" />}
              {smartAdvice.iconType === 'thermometer' && <Thermometer size={18} className="text-blue-200" />}
              {smartAdvice.iconType === 'sparkles' && <Sparkles size={18} className="text-amber-300" />}
            </div>

            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300 drop-shadow-xs">
                  {smartAdvice.title}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug text-white/95">
                {smartAdvice.message}
              </p>
            </div>
          </div>

          {/* Tomorrow's Quick Comparative Advice */}
          {adviceData.tomorrowQuickSummary && (
            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-start gap-2 flex-1 min-w-0 text-xs text-white/90 font-medium leading-relaxed">
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/30 text-[10px] font-black uppercase tracking-wide text-indigo-100 border border-white/10 shrink-0 mt-0.5">
                  YARIN
                </span>
                <p className="line-clamp-2">
                  {adviceData.tomorrowQuickSummary}
                </p>
              </div>

              {/* 3 Günlük Detaylar Button */}
              <button
                type="button"
                onClick={handleOpenModal}
                className="self-end sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-xs backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <span>3 Günlük Detaylar</span>
                <ArrowRight size={13} className="text-amber-300" />
              </button>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* MAIN WEATHER STATS */}
        {/* ------------------------------------------------------------- */}
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-1">
          {/* Left: Location & Condition */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-black text-white/90">
                {weatherData.location.name}
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-sm">
              {weatherMeta.label}
            </h1>

            <p className="text-xs sm:text-sm text-white/95 max-w-md font-medium leading-relaxed">
              {weatherMeta.description}
            </p>

            <div className="pt-2 flex items-center gap-3 sm:gap-4 text-xs font-semibold text-white/90 flex-wrap">
              <span className="flex items-center gap-1">
                <Thermometer size={14} />
                Hissedilen: <strong className="text-white">{weatherData.current.apparentTemperature}°C</strong>
              </span>
              <span>•</span>
              <span>
                En Yüksek: <strong className="text-white">{weatherData.daily[0]?.temperatureMax}°C</strong>
              </span>
              <span>•</span>
              <span>
                En Düşük: <strong className="text-white">{weatherData.daily[0]?.temperatureMin}°C</strong>
              </span>
            </div>
          </div>

          {/* Right: Big Temperature & Big Dynamic Icon */}
          <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-center">
            <div className="p-3 sm:p-4 rounded-3xl bg-white/15 backdrop-blur-md border border-white/25 shadow-xl">
              <WeatherIcon
                code={weatherData.current.weatherCode}
                isDay={weatherData.current.isDay}
                size={54}
              />
            </div>
            <div className="flex flex-col text-right">
              <span className="text-5xl sm:text-7xl font-black tracking-tighter text-white drop-shadow-md">
                {weatherData.current.temperature}°
              </span>
              <span className="text-xs font-bold text-white/90 uppercase tracking-wider">
                Santigrat (°C)
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Day Advice Details Modal */}
      <WeatherAdviceModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        adviceData={adviceData}
        locationName={weatherData.location.name}
      />
    </>
  );
}
