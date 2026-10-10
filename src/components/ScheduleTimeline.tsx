import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Socket } from "socket.io-client";
import { 
  Clock, CheckCircle2, ArrowRight, Sparkles, BookOpen, 
  Coffee, Calendar, ChevronRight, Layers, Flame, Award, Star,
  Info, AlertCircle
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
import { 
  OFFICIAL_SATURDAY_SCHEDULE_DATES,
  resolveOfficialSaturdaySubject,
  OfficialSaturdayPeriod
} from "../utils/saturdayScheduleData";

export interface CourseTimelineItem extends SchedulePeriod {
  resolved: ResolvedSubject;
  statusInfo: PeriodTimeStatus;
  folderTarget: string;
  isUserEnrolled?: boolean;
}

interface ScheduleTimelineProps {
  socket?: Socket | null;
  currentUserRoles?: string[];
  userStudyEnrolled?: boolean;
  onNavigateCourse?: (courseId: string) => void;
  className?: string;
}

// Map subjectKey / text & user role to standard KapsApp folder IDs
function getCourseFolderId(text: string, userRoles: string[] = []): string {
  const norm = text.toLowerCase();
  if (norm.includes("physic") || norm.includes("fizik")) return "Physics";
  if (norm.includes("math") || norm.includes("matematik")) return "Mathematics";
  if (norm.includes("chem") || norm.includes("kimya")) return "Chemistry";
  if (norm.includes("bio") || norm.includes("biyoloji")) return "Biology";
  if (norm.includes("turkish") || norm.includes("edebiyat") || norm.includes("turk")) return "Turkish";
  if (norm.includes("english") || norm.includes("foreign") || norm.includes("ingiliz")) return "English";
  if (norm.includes("tok")) return "TITC";
  if (norm.includes("titc") || norm.includes("inkılap") || norm.includes("tarih")) return "TITC";
  if (norm.includes("digsoc") || norm.includes("digital society") || norm.includes("psycholog") || norm.includes("psikoloji")) {
    return "Digital Society";
  }
  return "Mathematics";
}

export default function ScheduleTimeline({
  socket,
  currentUserRoles = [],
  userStudyEnrolled,
  onNavigateCourse,
  className = ""
}: ScheduleTimelineProps) {
  const [now, setNow] = useState<Date>(new Date());

  // Heartbeat to update period remaining minutes, progress and countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentDayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;

  // Selected day index for the timeline (default to current day)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() => {
    return currentDayOfWeek;
  });

  // Keep in sync with current day of week
  useEffect(() => {
    setSelectedDayIndex(currentDayOfWeek);
  }, [currentDayOfWeek]);

  // Target Saturday calculation (today if Saturday, or upcoming Saturday)
  const targetSaturdayInfo = useMemo(() => {
    const target = new Date(now);
    if (currentDayOfWeek === 6) {
      // Today is Saturday
    } else {
      const diffDays = (6 - currentDayOfWeek + 7) % 7;
      target.setDate(now.getDate() + diffDays);
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, "0");
    const day = String(target.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const formatted = target.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    return { date: target, dateStr, formatted };
  }, [now, currentDayOfWeek]);

  const isSaturday = selectedDayIndex === 6;
  const isSunday = selectedDayIndex === 0;
  const isTodayView = selectedDayIndex === currentDayOfWeek;

  // 1. Check Official Saturday Schedule Table for target Saturday
  const officialSaturdayEntry = useMemo(() => {
    if (!isSaturday) return null;
    return OFFICIAL_SATURDAY_SCHEDULE_DATES[targetSaturdayInfo.dateStr] || null;
  }, [isSaturday, targetSaturdayInfo.dateStr]);

  const activeDaySchedule: DaySchedule | undefined = useMemo(() => {
    return WEEKLY_SCHEDULE.find((d) => d.dayIndex === selectedDayIndex);
  }, [selectedDayIndex]);

  // Construct timeline items
  const timelineItems: CourseTimelineItem[] = useMemo(() => {
    // A. CUMARTESİ: RESMİ 12-IB DP DESTEK ÇİZELGESİ
    if (isSaturday) {
      if (!officialSaturdayEntry || !officialSaturdayEntry.periods) {
        return [];
      }

      return officialSaturdayEntry.periods.map((period) => {
        const resolvedSubject = resolveOfficialSaturdaySubject(period.rawSubject, currentUserRoles);
        const statusInfo = getCurrentPeriodStatus(
          period.startTime,
          period.endTime,
          6,
          now
        );

        const resolved: ResolvedSubject = {
          name: resolvedSubject.name,
          group: period.blockLabel,
          color: resolvedSubject.color,
          bgColor: resolvedSubject.bgColor,
          borderColor: resolvedSubject.borderColor,
          icon: resolvedSubject.icon,
          isElective: period.rawSubject.includes("/")
        };

        return {
          periodNumber: period.periodNumber,
          startTime: period.startTime,
          endTime: period.endTime,
          subjectKey: `sat_${period.periodNumber}`,
          defaultName: period.defaultName,
          roomOrNote: `${period.blockLabel} • ${period.startTime} - ${period.endTime}`,
          resolved,
          statusInfo,
          folderTarget: resolvedSubject.folderTarget,
          isUserEnrolled: resolvedSubject.isEnrolled
        };
      });
    }

    // B. HAFTA İÇİ (Pazartesi - Cuma): STANDART DERS PROGRAMI
    if (!activeDaySchedule || !activeDaySchedule.periods) return [];
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
  }, [isSaturday, officialSaturdayEntry, activeDaySchedule, currentUserRoles, now]);

  const currentActivePeriod = useMemo(() => {
    if (selectedDayIndex !== currentDayOfWeek) return null;
    return timelineItems.find((item) => item.statusInfo.status === "current") || null;
  }, [timelineItems, selectedDayIndex, currentDayOfWeek]);

  const nextUpcomingPeriod = useMemo(() => {
    if (selectedDayIndex !== currentDayOfWeek) return null;
    return timelineItems.find((item) => item.statusInfo.status === "next") || null;
  }, [timelineItems, selectedDayIndex, currentDayOfWeek]);

  // Real-time Countdown to Monday 08:00 (First Period of the Week)
  const mondayCountdown = useMemo(() => {
    const targetMonday = new Date(now);
    let daysUntilMonday = (1 - currentDayOfWeek + 7) % 7;
    if (daysUntilMonday === 0) {
      if (now.getHours() >= 8) {
        daysUntilMonday = 7;
      }
    }
    targetMonday.setDate(now.getDate() + daysUntilMonday);
    targetMonday.setHours(8, 0, 0, 0);

    const diffMs = targetMonday.getTime() - now.getTime();
    if (diffMs <= 0) return { hours: 0, minutes: 0, seconds: 0, formatted: "Ders saati geldi!" };

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return {
      hours,
      minutes,
      seconds,
      formatted: `${hours} saat ${minutes} dakika ${seconds} saniye`
    };
  }, [now, currentDayOfWeek]);

  // Order of tabs: Pzt, Sal, Çar, Per, Cum, Cmt, Paz
  const orderedTabs = useMemo(() => {
    const list = [...WEEKLY_SCHEDULE];
    return list.sort((a, b) => {
      const orderA = a.dayIndex === 0 ? 7 : a.dayIndex;
      const orderB = b.dayIndex === 0 ? 7 : b.dayIndex;
      return orderA - orderB;
    });
  }, []);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between ${className}`}>
      <div>
        {/* Header with Title and Day Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
              isSaturday
                ? "bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                : isSunday
                ? "bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                : "bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
            }`}>
              <Clock size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {isSaturday 
                    ? "Cumartesi Destek Programı" 
                    : isSunday 
                    ? "Pazar Dinlenme & Geri Sayım" 
                    : "Günün Ders Akışı"}
                </h2>
                {isTodayView && !isSunday && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" title="Canlı Zaman Takibi" />
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isSaturday 
                  ? `${targetSaturdayInfo.formatted} • Resmi 12-IB DP Çizelgesi` 
                  : isSunday 
                  ? "Hafta Sonu Dinlenmesi" 
                  : `${activeDaySchedule?.dayName} • 12 G IB Zaman Çizelgesi`}
              </p>
            </div>
          </div>

          {/* Day selection tabs (Pzt - Cum - Cmt - Paz) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl self-start sm:self-auto overflow-x-auto no-scrollbar max-w-full">
            {orderedTabs.map((d) => {
              const isSelected = d.dayIndex === selectedDayIndex;
              const isToday = d.dayIndex === currentDayOfWeek;
              return (
                <button
                  key={d.dayIndex}
                  type="button"
                  onClick={() => setSelectedDayIndex(d.dayIndex)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer relative shrink-0 ${
                    isSelected
                      ? d.dayIndex === 6
                        ? "bg-amber-500 text-white shadow-xs"
                        : d.dayIndex === 0
                        ? "bg-rose-500 text-white shadow-xs"
                        : "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>{d.dayShort}</span>
                  {isToday && (
                    <span className={`absolute -top-1 -right-0.5 w-1.5 h-1.5 rounded-full ${
                      d.dayIndex === 6 ? "bg-amber-400" : d.dayIndex === 0 ? "bg-rose-400" : "bg-sky-500"
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Break Indicator */}
        {isTodayView && !isSunday && nextUpcomingPeriod && !currentActivePeriod && (
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

        {/* ========================================================================= */}
        {/* RESMİ CUMARTESİ ETÜT BİLGİLENDİRME ŞERİDİ                                */}
        {/* ========================================================================= */}
        {isSaturday && timelineItems.length > 0 && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 mb-4 animate-fade-in">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">📋</span>
              <div>
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  12-IB DP Resmi Destek Programı (6 Ders)
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Sabah Bloğu (08:30 - 10:50) & Öğle Bloğu (11:00 - 13:15)
                </p>
              </div>
            </div>
            <Link
              to="/ajanda"
              className="text-xs font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 shrink-0"
            >
              <span>Ajandada Gör</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BOŞ GÜN VEYA ETÜT BULUNMAMA DURUMU (FALLBACK)                            */}
        {/* ========================================================================= */}
        {(isSunday || (isSaturday && timelineItems.length === 0)) && (
          <div className="py-6 px-5 rounded-3xl bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-pink-50/50 dark:from-slate-800/80 dark:via-slate-800/40 dark:to-purple-950/20 border border-indigo-100 dark:border-slate-800 my-2 space-y-4 text-center">
            
            <div className="w-14 h-14 mx-auto rounded-3xl bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-3xl shadow-md ring-4 ring-indigo-500/10">
              ☕
            </div>

            <div>
              <span className="px-3 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-300 font-black text-xs uppercase tracking-wider">
                {isSaturday ? "Planlanmış Etüt Yok" : "Hafta Sonu Dinlenme Modu"}
              </span>
              <h3 className="mt-2 text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                {isSaturday 
                  ? "Bu hafta sonu için planlanmış resmi etüt bulunmuyor" 
                  : "Bugün planlanmış dersin bulunmuyor, dinlenme zamanı! ☕"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                {isSaturday 
                  ? "Resmi 12-IB DP akademik destek takviminde bu Cumartesi için ders planlanmamıştır. Serbest çalışma yapabilir veya dinlenebilirsiniz."
                  : "Zihnini dinlendir, hobilerine vakit ayır ve yeni haftaya enerjik başla. Pazartesi ilk dersin saat 08:00'de başlayacak."}
              </p>
            </div>

            {/* Dinamik Canlı Geri Sayım Kutusu (Pazartesi ilk derse kalan süre) */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-indigo-100/80 dark:border-slate-800 shadow-sm max-w-sm mx-auto">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                <Sparkles size={14} className="animate-pulse" />
                <span>Pazartesi İlk Derse Kalan Süre</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-slate-800 dark:text-slate-100 font-mono">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-2.5 py-1.5 text-center min-w-[54px]">
                  <span className="text-lg font-black block">{mondayCountdown.hours}</span>
                  <span className="text-[10px] text-slate-400 font-sans block">Saat</span>
                </div>
                <span className="font-bold text-slate-400 text-lg">:</span>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-2.5 py-1.5 text-center min-w-[54px]">
                  <span className="text-lg font-black block">{mondayCountdown.minutes}</span>
                  <span className="text-[10px] text-slate-400 font-sans block">Dakika</span>
                </div>
                <span className="font-bold text-slate-400 text-lg">:</span>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-xl px-2.5 py-1.5 text-center min-w-[54px]">
                  <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 block">{mondayCountdown.seconds}</span>
                  <span className="text-[10px] text-slate-400 font-sans block">Saniye</span>
                </div>
              </div>
            </div>

            {/* Hızlı Butonlar */}
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedDayIndex(1)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
              >
                <span>Pazartesi Programını İncele</span>
                <ArrowRight size={13} />
              </button>
              <Link
                to="/ajanda"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                <span>Ajandayı Aç</span>
                <Calendar size={13} />
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DİKEY ZAMAN ÇİZELGESİ (VERTICAL TIMELINE LIST)                           */}
        {/* ========================================================================= */}
        {timelineItems.length > 0 && (
          <div className="relative pl-2 sm:pl-4 space-y-3.5 my-2">
            {/* Dikey Bağlayıcı Çizgi */}
            <div className="absolute left-[78px] sm:left-[88px] top-3 bottom-3 w-0.5 bg-slate-200 dark:bg-slate-800 -z-0" />

            {timelineItems.map((period, idx) => {
              const isCurrent = isTodayView && period.statusInfo.status === "current";
              const isPast = isTodayView && period.statusInfo.status === "past";
              const isNext = isTodayView && period.statusInfo.status === "next";

              // Rol Eşleşmesi ve Canlı Vurgu Kuralları (Sarı Parlama / Gold Glow)
              const isEnrolled = isSaturday ? Boolean(period.isUserEnrolled) : false;

              return (
                <div 
                  key={idx} 
                  className={`relative flex items-start gap-4 transition-all duration-200 ${
                    isCurrent ? "scale-[1.01]" : ""
                  }`}
                >
                  {/* 1. Saat Sütunu (Sol Taraf) */}
                  <div className="w-[66px] sm:w-[74px] shrink-0 text-right pt-2.5">
                    <span className={`font-mono text-xs font-bold block ${
                      isCurrent 
                        ? "text-emerald-600 dark:text-emerald-400 font-black text-sm" 
                        : isEnrolled
                        ? "text-amber-700 dark:text-amber-300 font-black"
                        : isPast 
                        ? "text-slate-400" 
                        : "text-slate-700 dark:text-slate-300"
                    }`}>
                      {period.startTime}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 block -mt-0.5">
                      {period.endTime}
                    </span>
                  </div>

                  {/* 2. Zaman Düğümü (Ortadaki Dikey Nokta) */}
                  <div className="relative shrink-0 pt-2 z-10">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCurrent
                        ? "bg-emerald-500 border-white dark:border-slate-900 ring-4 ring-emerald-500/40 scale-110"
                        : isEnrolled
                        ? "bg-amber-400 border-white dark:border-slate-900 ring-4 ring-amber-400/30"
                        : isNext
                        ? "bg-amber-400 border-white dark:border-slate-900 ring-2 ring-amber-400/30"
                        : isPast
                        ? "bg-slate-300 dark:bg-slate-700 border-white dark:border-slate-900"
                        : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                    }`}>
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      {!isCurrent && isEnrolled && <span className="w-1 h-1 rounded-full bg-white" />}
                    </div>
                  </div>

                  {/* 3. Ders Kartı (Sağ Taraf) */}
                  <div 
                    className={`flex-1 rounded-2xl p-3.5 border transition-all duration-200 ${
                      isCurrent
                        ? "border-emerald-500 ring-2 ring-emerald-500/80 shadow-lg shadow-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/15"
                        : isEnrolled
                        ? "border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.25)] bg-amber-400/10"
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
                          <div className="flex items-center gap-1.5">
                            <h4 className={`text-xs sm:text-sm font-bold ${
                              isPast 
                                ? "line-through text-slate-400" 
                                : isCurrent 
                                ? "text-emerald-950 dark:text-emerald-100 font-black" 
                                : isEnrolled
                                ? "text-amber-950 dark:text-amber-100 font-black"
                                : "text-slate-900 dark:text-slate-100"
                            }`}>
                              {period.resolved.name}
                            </h4>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {period.resolved.group} • {period.defaultName}
                          </p>
                        </div>
                      </div>

                      {/* Durum Rozeti */}
                      <div className="shrink-0">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black animate-pulse shadow-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            ŞU ANKİ DERS
                          </span>
                        ) : isEnrolled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow-xs">
                            <Star size={10} className="fill-slate-950" />
                            Kayıtlı Dersiniz
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

                    {/* Canlı İlerleme Çubuğu (Şu anki derste aktif) */}
                    {isCurrent && (
                      <div className="mt-2.5 pt-2 border-t border-emerald-500/20">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                          <span>Dersin bitmesine {period.statusInfo.remainingMinutes} dakika</span>
                          <span>%{period.statusInfo.progressPercent || 0}</span>
                        </div>
                        <div className="w-full bg-emerald-200 dark:bg-emerald-950/60 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${period.statusInfo.progressPercent || 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Derslik / Saat ve Notlara Git Butonu */}
                    <div className="mt-2 flex items-center justify-between gap-2 pt-1.5 text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 truncate">
                        {period.roomOrNote}
                      </span>

                      <Link
                        to={`/dersler/${encodeURIComponent(period.folderTarget)}`}
                        onClick={() => onNavigateCourse?.(period.folderTarget)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer shrink-0 ${
                          isCurrent 
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs" 
                            : isEnrolled
                            ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                        title={`${period.folderTarget} ders notlarını aç`}
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
        )}
      </div>

      {/* Footer link to Full Agenda */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <span className="text-[11px]">Resmi takvim, sınavlar ve yemek menüsü için:</span>
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
