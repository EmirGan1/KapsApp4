import React from "react";
import { Coffee, Utensils, Clock, BookOpen, AlertCircle, Sparkles } from "lucide-react";
import { ScheduleGapItem, getGapLiveStatus } from "../utils/scheduleGapDetector";

interface ScheduleGapCardProps {
  gap: ScheduleGapItem;
  isToday?: boolean;
  now?: Date;
  variant?: "timeline" | "calendar" | "compact";
  className?: string;
}

export default function ScheduleGapCard({
  gap,
  isToday = false,
  now = new Date(),
  variant = "timeline",
  className = ""
}: ScheduleGapCardProps) {
  const liveStatus = getGapLiveStatus(gap, isToday, now);

  // =========================================================================
  // DURUM A: KALAN DERS SÜRESİ KARTI (partial_lesson)
  // Kesikli çizgi yerine hafif yarı saydam bir ders kartı görünümü, sol kenarda
  // dersin renginde ince çizgi ve pedagojik bilgilendirme.
  // =========================================================================
  if (gap.type === "partial_lesson") {
    const course = gap.originalCourse;
    const courseColor = course?.color || "text-emerald-600 dark:text-emerald-400";
    const barColor = course?.borderColor?.includes("border-") 
      ? course.borderColor.replace("border-", "bg-") 
      : "bg-emerald-500";

    if (variant === "calendar" || variant === "compact") {
      return (
        <div
          className={`my-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/60 p-2.5 transition-all shadow-2xs relative overflow-hidden ${
            liveStatus.isActive ? "ring-2 ring-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20" : ""
          } ${className}`}
        >
          {/* Sol kenar renk çizgisi */}
          <div className={`absolute top-0 left-0 bottom-0 w-1 ${barColor}`} />

          <div className="flex items-start justify-between gap-2 pl-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  📐 {course?.name || "Ders"} — Son {gap.durationMinutes} dk
                </span>
                {liveStatus.isActive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black animate-pulse">
                    <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                    Ders Sürüyor ({liveStatus.remainingMinutes} dk)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {gap.subtitle || `Derslik: ${course?.room || "302"} — Normal ders devam ediyor`}
              </p>
            </div>
            <span className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
              {gap.startTime} – {gap.endTime}
            </span>
          </div>
        </div>
      );
    }

    // TIMELINE ROW
    return (
      <div
        className={`relative flex items-start gap-4 py-1 transition-all duration-200 ${
          liveStatus.isActive ? "scale-[1.01]" : ""
        } ${className}`}
      >
        {/* 1. Sol Saat Sütunu */}
        <div className="w-[66px] sm:w-[74px] shrink-0 text-right pt-2.5 pr-0.5">
          <span
            className={`font-mono text-xs block transition-colors ${
              liveStatus.isActive
                ? "text-emerald-600 dark:text-emerald-400 font-black text-sm"
                : "text-slate-600 dark:text-slate-300 font-bold"
            }`}
          >
            {gap.startTime}
          </span>
          <span className="font-mono text-[10px] text-slate-400 block -mt-0.5">
            {gap.endTime}
          </span>
        </div>

        {/* 2. Dikey Çizgideki Düğüm */}
        <div className="relative shrink-0 pt-2 z-10">
          <div
            className={`w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all ${
              liveStatus.isActive
                ? "bg-emerald-500 border-white dark:border-slate-900 ring-4 ring-emerald-500/40 scale-110"
                : "bg-emerald-100 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-600"
            }`}
          >
            {liveStatus.isActive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
            ) : (
              <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            )}
          </div>
        </div>

        {/* 3. Kalan Ders Süresi Kartı (Yarı saydam ders kartı görünümü, sol kenar çizgisi) */}
        <div
          className={`flex-1 rounded-2xl p-3 border transition-all duration-200 relative overflow-hidden ${
            liveStatus.isActive
              ? "border-emerald-500 ring-2 ring-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-500/15 shadow-sm"
              : "border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
          }`}
        >
          {/* Sol kenar renk çizgisi */}
          <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${barColor}`} />

          <div className="pl-1">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-base">📐</span>
                <div>
                  <h4 className={`text-xs sm:text-sm font-bold ${
                    liveStatus.isActive
                      ? "text-emerald-950 dark:text-emerald-100 font-black"
                      : "text-slate-900 dark:text-slate-100"
                  }`}>
                    {course?.name || "Ders"} — Son {gap.durationMinutes} Dakika
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Sınavın erken bitti; sınıfta normal ders işleniyor olabilir ({course?.room ? `Derslik: ${course.room}` : "Kendi sınıfınız"})
                  </p>
                </div>
              </div>

              {/* Canlı sayaç rozeti */}
              <div className="shrink-0 text-right">
                {liveStatus.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black animate-pulse shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    Dersin bitmesine {liveStatus.remainingMinutes} dk kaldı
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                    {gap.durationMinutes} dk kalan süre
                  </span>
                )}
              </div>
            </div>

            {/* Canlı İlerleme Çubuğu */}
            {liveStatus.isActive && (
              <div className="mt-2 pt-1.5 border-t border-emerald-500/20">
                <div className="w-full bg-emerald-200 dark:bg-emerald-950/60 h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${liveStatus.progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // DURUM B: TENEFFÜS KARTI (official_recess)
  // Minimalist, şık, kesikli kenarlıklı (dashed) ara çizgi ve sonraki derse hazırlık.
  // =========================================================================
  if (gap.type === "official_recess") {
    if (variant === "calendar" || variant === "compact") {
      return (
        <div
          className={`my-1.5 rounded-xl border border-dashed border-sky-300 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 px-3 py-2 flex items-center justify-between gap-2.5 transition-all backdrop-blur-xs ${
            liveStatus.isActive ? "ring-2 ring-sky-400/60 bg-sky-100/50 dark:bg-sky-950/40" : ""
          } ${className}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Coffee size={14} className="text-sky-600 dark:text-sky-400 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-sky-900 dark:text-sky-200 truncate">
                  ☕ Teneffüs ({gap.durationMinutes} dk)
                </span>
                {liveStatus.isActive && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-sky-500 text-white text-[9px] font-black animate-pulse">
                    <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                    Zile {liveStatus.remainingMinutes} dk
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {gap.subtitle || `${gap.startTime} – ${gap.endTime} · ${gap.durationMinutes} dk`}
              </p>
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 shrink-0">
            {gap.durationMinutes} dk
          </span>
        </div>
      );
    }

    // TIMELINE ROW
    return (
      <div
        className={`relative flex items-center gap-4 py-1 transition-all duration-200 ${
          liveStatus.isActive ? "scale-[1.01]" : ""
        } ${className}`}
      >
        {/* 1. Sol Saat Sütunu */}
        <div className="w-[66px] sm:w-[74px] shrink-0 text-right pr-0.5">
          <span
            className={`font-mono text-[11px] block transition-colors ${
              liveStatus.isActive
                ? "text-sky-600 dark:text-sky-400 font-black text-xs"
                : "text-slate-400 dark:text-slate-500 font-semibold"
            }`}
          >
            {gap.startTime}
          </span>
          <span className="font-mono text-[9px] text-slate-400/80 block -mt-0.5">
            {gap.endTime}
          </span>
        </div>

        {/* 2. Dikey Çizgideki Mola Düğümü (Mini kesikli halka) */}
        <div className="relative shrink-0 z-10 flex items-center justify-center">
          <div
            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 border-dashed transition-all ${
              liveStatus.isActive
                ? "bg-sky-400 border-white dark:border-slate-900 ring-4 ring-sky-400/30 scale-105"
                : "bg-sky-100 dark:bg-sky-950 border-sky-300 dark:border-sky-700"
            }`}
            title={`Teneffüs (${gap.durationMinutes} dk)`}
          >
            {liveStatus.isActive ? (
              <span className="w-1 h-1 rounded-full bg-white animate-ping" />
            ) : (
              <span className="w-0.5 h-0.5 rounded-full bg-sky-500" />
            )}
          </div>
        </div>

        {/* 3. Mola Kartı (Minimalist kesikli ara çizgi) */}
        <div
          className={`flex-1 rounded-xl border border-dashed px-3 py-2 transition-all duration-200 backdrop-blur-xs flex items-center justify-between gap-3 ${
            liveStatus.isActive
              ? "border-sky-400 bg-sky-50/70 dark:bg-sky-950/30 ring-1 ring-sky-400/40"
              : "border-sky-200/80 dark:border-sky-800/60 bg-sky-50/35 dark:bg-sky-950/15"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="shrink-0 p-1 rounded-lg bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400">
              <Coffee size={14} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-bold truncate ${
                  liveStatus.isActive
                    ? "text-sky-950 dark:text-sky-100 font-black"
                    : "text-slate-800 dark:text-slate-200"
                }`}>
                  ☕ Teneffüs ({gap.startTime} – {gap.endTime} · {gap.durationMinutes} dk)
                </span>

                {liveStatus.isActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-black animate-pulse shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    Teneffüs — Zile {liveStatus.remainingMinutes} dk kaldı
                  </span>
                )}
              </div>

              {gap.nextCourse && (
                <p className="text-[10px] text-sky-700 dark:text-sky-300 font-medium truncate mt-0.5">
                  👉 Sonraki Ders: <strong>{gap.nextCourse.name}</strong> ({gap.nextCourse.startTime})
                </p>
              )}
            </div>
          </div>

          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 shrink-0">
            {gap.durationMinutes} dk
          </span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // DURUM C: RESMİ ÖĞLE ARASI & YEMEKHANE (lunch)
  // =========================================================================
  if (variant === "calendar" || variant === "compact") {
    return (
      <div
        className={`my-1.5 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 px-3 py-2 flex items-center justify-between gap-2.5 transition-all backdrop-blur-xs ${
          liveStatus.isActive ? "ring-2 ring-amber-400/60 bg-amber-100/50 dark:bg-amber-950/40" : ""
        } ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Utensils size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 truncate">
                {gap.title}
              </span>
              {liveStatus.isActive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-black animate-pulse">
                  <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                  Yemek Saati ({liveStatus.remainingMinutes} dk)
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {gap.subtitle || `${gap.startTime} – ${gap.endTime} · ${gap.durationMinutes} dk`}
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 shrink-0">
          {gap.durationMinutes} dk
        </span>
      </div>
    );
  }

  // TIMELINE ROW FOR LUNCH
  return (
    <div
      className={`relative flex items-center gap-4 py-1 transition-all duration-200 ${
        liveStatus.isActive ? "scale-[1.01]" : ""
      } ${className}`}
    >
      <div className="w-[66px] sm:w-[74px] shrink-0 text-right pr-0.5">
        <span
          className={`font-mono text-[11px] block transition-colors ${
            liveStatus.isActive
              ? "text-amber-600 dark:text-amber-400 font-black text-xs"
              : "text-slate-400 dark:text-slate-500 font-semibold"
          }`}
        >
          {gap.startTime}
        </span>
        <span className="font-mono text-[9px] text-slate-400/80 block -mt-0.5">
          {gap.endTime}
        </span>
      </div>

      <div className="relative shrink-0 z-10 flex items-center justify-center">
        <div
          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 border-dashed transition-all ${
            liveStatus.isActive
              ? "bg-amber-400 border-white dark:border-slate-900 ring-4 ring-amber-400/30 scale-105"
              : "bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-700"
          }`}
          title="Öğle Arası & Yemekhane"
        >
          {liveStatus.isActive ? (
            <span className="w-1 h-1 rounded-full bg-white animate-ping" />
          ) : (
            <span className="w-0.5 h-0.5 rounded-full bg-amber-500" />
          )}
        </div>
      </div>

      <div
        className={`flex-1 rounded-xl border border-dashed px-3 py-2 transition-all duration-200 backdrop-blur-xs flex items-center justify-between gap-3 ${
          liveStatus.isActive
            ? "border-amber-400 bg-amber-50/70 dark:bg-amber-950/30 ring-1 ring-amber-400/40"
            : "border-amber-200/80 dark:border-amber-800/60 bg-amber-50/35 dark:bg-amber-950/15"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 p-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
            <Utensils size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold truncate ${
                liveStatus.isActive
                  ? "text-amber-950 dark:text-amber-100 font-black"
                  : "text-slate-800 dark:text-slate-200"
              }`}>
                {gap.title}
              </span>

              {liveStatus.isActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  Öğle arası ({liveStatus.remainingMinutes} dk kaldı)
                </span>
              )}
            </div>

            <p className="text-[10px] text-amber-800 dark:text-amber-300 font-medium truncate mt-0.5">
              {gap.subtitle || `${gap.startTime} – ${gap.endTime} • Yemekhane açık`}
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 shrink-0">
          {gap.durationMinutes} dk
        </span>
      </div>
    </div>
  );
}
