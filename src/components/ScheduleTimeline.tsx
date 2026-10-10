import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Clock, CheckCircle2, ArrowRight, Sparkles, BookOpen, 
  Coffee, Calendar, ChevronRight, Layers, Flame
} from "lucide-react";
import { 
  WEEKLY_SCHEDULE, 
  resolveSubjectByRole, 
  getCurrentPeriodStatus, 
  DaySchedule, 
  SchedulePeriod, 
  PeriodTimeStatus,
  ResolvedSubject
} from "../utils/scheduleData";

export interface CourseTimelineItem extends SchedulePeriod {
  resolved: ResolvedSubject;
  statusInfo: PeriodTimeStatus;
  folderTarget: string;
}

interface ScheduleTimelineProps {
  currentUserRoles?: string[];
  onNavigateCourse?: (courseId: string) => void;
  className?: string;
}

// Map subjectKey & user role to standard KapsApp folder IDs
function getCourseFolderId(subjectKey: string, userRoles: string[] = []): string {
  const normRoles = userRoles.map(r => r.toLowerCase());
  switch (subjectKey) {
    case "math":
      return "Mathematics";
    case "literature":
      return "Turkish";
    case "foreign_language":
    case "foreign_languages_lit":
      return "English";
    case "physics_psychology":
      if (normRoles.some(r => r.includes("psychology"))) return "Digital Society";
      return "Physics";
    case "chemistry_digsoc_psycho":
      if (normRoles.some(r => r.includes("chemistry"))) return "Chemistry";
      if (normRoles.some(r => r.includes("psychology"))) return "Digital Society";
      return "Digital Society";
    case "biology_history":
      if (normRoles.some(r => r.includes("biology"))) return "Biology";
      return "TITC";
    case "tok":
      return "TITC";
    default:
      return "Mathematics";
  }
}

export default function ScheduleTimeline({
  currentUserRoles = [],
  onNavigateCourse,
  className = ""
}: ScheduleTimelineProps) {
  const [now, setNow] = useState<Date>(new Date());

  // Heartbeat to update period remaining minutes and statuses
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;

  // Selected day index for the timeline (default to current day or Mon if weekend)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    return isWeekend ? 1 : currentDayOfWeek;
  });

  // Keep in sync with day of week unless user manually toggled
  useEffect(() => {
    if (!isWeekend) {
      setSelectedDayIndex(currentDayOfWeek);
    }
  }, [currentDayOfWeek, isWeekend]);

  const activeDaySchedule: DaySchedule | undefined = useMemo(() => {
    return WEEKLY_SCHEDULE.find((d) => d.dayIndex === selectedDayIndex);
  }, [selectedDayIndex]);

  // Prepared items with status and folder links
  const timelineItems: CourseTimelineItem[] = useMemo(() => {
    if (!activeDaySchedule) return [];
    return activeDaySchedule.periods.map((period) => {
      const resolved = resolveSubjectByRole(period.subjectKey, currentUserRoles);
      const statusInfo = getCurrentPeriodStatus(
        period.startTime,
        period.endTime,
        activeDaySchedule.dayIndex,
        now
      );
      const folderTarget = getCourseFolderId(period.subjectKey, currentUserRoles);
      return {
        ...period,
        resolved,
        statusInfo,
        folderTarget,
      };
    });
  }, [activeDaySchedule, currentUserRoles, now]);

  const currentActivePeriod = useMemo(() => {
    if (selectedDayIndex !== currentDayOfWeek) return null;
    return timelineItems.find((item) => item.statusInfo.status === "current") || null;
  }, [timelineItems, selectedDayIndex, currentDayOfWeek]);

  const nextUpcomingPeriod = useMemo(() => {
    if (selectedDayIndex !== currentDayOfWeek) return null;
    return timelineItems.find((item) => item.statusInfo.status === "next") || null;
  }, [timelineItems, selectedDayIndex, currentDayOfWeek]);

  const isTodayView = selectedDayIndex === currentDayOfWeek;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between ${className}`}>
      <div>
        {/* Header with Title and Day Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Günün Ders Akışı</span>
                {isTodayView && !isWeekend && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" title="Canlı Zaman Takibi" />
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeDaySchedule?.dayName} • 12 G IB Zaman Çizelgesi
              </p>
            </div>
          </div>

          {/* Day selection tabs (Pzt - Cum) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl self-start sm:self-auto overflow-x-auto no-scrollbar">
            {WEEKLY_SCHEDULE.map((d) => {
              const isSelected = d.dayIndex === selectedDayIndex;
              const isToday = d.dayIndex === currentDayOfWeek;
              return (
                <button
                  key={d.dayIndex}
                  type="button"
                  onClick={() => setSelectedDayIndex(d.dayIndex)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer relative shrink-0 ${
                    isSelected
                      ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>{d.dayShort}</span>
                  {isToday && (
                    <span className="absolute -top-1 -right-0.5 w-1.5 h-1.5 rounded-full bg-sky-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Break Indicator */}
        {isTodayView && nextUpcomingPeriod && !currentActivePeriod && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">☕</span>
              <div>
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">TENEFFÜSTESİNİZ</p>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  Sonraki: <strong>{nextUpcomingPeriod.resolved.name}</strong> ({nextUpcomingPeriod.statusInfo.remainingMinutes} dk sonra)
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0">
              {nextUpcomingPeriod.startTime}
            </span>
          </div>
        )}

        {/* Weekend Empty State */}
        {isWeekend && selectedDayIndex === currentDayOfWeek && (
          <div className="py-8 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 my-4 space-y-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center text-2xl">
              ☕
            </div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
              Bugün planlanmış dersin bulunmuyor, dinlenme zamanı!
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Hafta sonu tatili devam ediyor. Pazartesi gününün ders akışını incelemek için yukarıdaki sekmeleri kullanabilirsin.
            </p>
            <button
              onClick={() => setSelectedDayIndex(1)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 font-bold text-xs hover:bg-sky-100 cursor-pointer"
            >
              <span>Pazartesi Programını Gör</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* VERTICAL TIMELINE LIST */}
        <div className="relative pl-2 sm:pl-4 space-y-4 my-2">
          {/* Vertical Connecting Line */}
          <div className="absolute left-[78px] sm:left-[88px] top-3 bottom-3 w-0.5 bg-slate-200 dark:bg-slate-800 -z-0" />

          {timelineItems.map((period, idx) => {
            const isCurrent = isTodayView && period.statusInfo.status === "current";
            const isPast = isTodayView && period.statusInfo.status === "past";
            const isNext = isTodayView && period.statusInfo.status === "next";

            return (
              <div 
                key={idx} 
                className={`relative flex items-start gap-4 transition-all duration-200 ${
                  isCurrent ? "scale-[1.01]" : ""
                }`}
              >
                {/* 1. Time Column (Left) */}
                <div className="w-[66px] sm:w-[74px] shrink-0 text-right pt-2.5">
                  <span className={`font-mono text-xs font-bold block ${
                    isCurrent ? "text-sky-600 dark:text-sky-400 font-black text-sm" : isPast ? "text-slate-400" : "text-slate-700 dark:text-slate-300"
                  }`}>
                    {period.startTime}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 block -mt-0.5">
                    {period.endTime}
                  </span>
                </div>

                {/* 2. Timeline Status Node (Center) */}
                <div className="relative shrink-0 pt-2 z-10">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent
                      ? "bg-sky-500 border-white dark:border-slate-900 ring-4 ring-sky-500/30 scale-110"
                      : isNext
                      ? "bg-amber-400 border-white dark:border-slate-900 ring-2 ring-amber-400/30"
                      : isPast
                      ? "bg-slate-300 dark:bg-slate-700 border-white dark:border-slate-900"
                      : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                  }`}>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  </div>
                </div>

                {/* 3. Course Card (Right) */}
                <div 
                  className={`flex-1 rounded-2xl p-3.5 border transition-all duration-200 ${
                    isCurrent
                      ? "border-sky-500 bg-sky-500/10 shadow-lg ring-1 ring-sky-500/50"
                      : isNext
                      ? "border-amber-300/80 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-950/20"
                      : isPast
                      ? "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 opacity-60 text-slate-400"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{period.resolved.icon}</span>
                      <div>
                        <h4 className={`text-xs sm:text-sm font-bold ${
                          isPast ? "line-through text-slate-400" : isCurrent ? "text-sky-900 dark:text-sky-100 font-black" : "text-slate-900 dark:text-slate-100"
                        }`}>
                          {period.resolved.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {period.resolved.group} • {period.defaultName}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-black animate-pulse shadow-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          ŞU ANKİ DERS
                        </span>
                      ) : isNext ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                          Sırada
                        </span>
                      ) : isPast ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                          <CheckCircle2 size={13} />
                          <span>Bitti</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-400 font-semibold">
                          {Array.isArray(period.periodNumber) ? `${period.periodNumber.join("-")}. Ders` : `${period.periodNumber}. Ders`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Active Period Progress Bar & Remaining Counter */}
                  {isCurrent && (
                    <div className="mt-2.5 pt-2 border-t border-sky-500/20">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-sky-700 dark:text-sky-300 mb-1">
                        <span>Dersin bitmesine {period.statusInfo.remainingMinutes} dakika</span>
                        <span>%{period.statusInfo.progressPercent || 0}</span>
                      </div>
                      <div className="w-full bg-sky-200 dark:bg-sky-950/60 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-sky-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${period.statusInfo.progressPercent || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Room / Note & Course Folder Micro-button */}
                  <div className="mt-2 flex items-center justify-between gap-2 pt-1.5 text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400 truncate">
                      {period.roomOrNote || `${period.resolved.level || "SL/HL"} Müfredatı`}
                    </span>

                    <Link
                      to={`/dersler/${encodeURIComponent(period.folderTarget)}`}
                      onClick={() => onNavigateCourse?.(period.folderTarget)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                        isCurrent 
                          ? "bg-sky-600 hover:bg-sky-700 text-white shadow-xs" 
                          : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                      title={`${period.folderTarget} ders notlarını ve materyallerini aç`}
                    >
                      <BookOpen size={11} />
                      <span>Notlara Git</span>
                      <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer link to Full Agenda */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <span className="text-[11px]">Haftalık sınavlar ve yemek menüsü için:</span>
        <Link 
          to="/ajanda" 
          className="font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>Tüm Ajanda & Takvim</span>
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}
