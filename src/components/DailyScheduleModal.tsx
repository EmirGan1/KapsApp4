import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  Sparkles,
  ChevronRight,
  Layers,
  ArrowRight,
  BookOpen,
  Info,
  CalendarDays,
  Timer,
  Play,
  RotateCcw,
  Maximize2,
  Minimize2,
  GraduationCap
} from "lucide-react";
import {
  WEEKLY_SCHEDULE,
  PERIOD_BELL_TIMES,
  LUNCH_BREAK,
  getLunchBreakForDay,
  resolveSubjectByRole,
  getCurrentPeriodStatus,
  DaySchedule,
  SchedulePeriod,
  ResolvedSubject
} from "../utils/scheduleData";

interface DailyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRoles?: string[];
  currentUsername?: string;
  onOpenEditRoles?: () => void;
}

export default function DailyScheduleModal({
  isOpen,
  onClose,
  userRoles = [],
  currentUsername,
  onOpenEditRoles
}: DailyScheduleModalProps) {
  // Live clock updating every 30 seconds for real-time period status
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Determine current day of week (1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, else weekend -> Mon)
  const currentDayIndex = useMemo(() => {
    const d = now.getDay();
    // 0 = Sun, 6 = Sat
    if (d >= 1 && d <= 5) return d;
    return 1; // Default to Monday on weekends
  }, [now]);

  // Selected Day in Modal (defaults to current weekday)
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(currentDayIndex);

  // View Mode: "daily" or "weekly"
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");

  // Keep selectedDayIndex in sync when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDayIndex(currentDayIndex);
    }
  }, [isOpen, currentDayIndex]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Get active day's schedule
  const activeDaySchedule = useMemo(() => {
    return (
      WEEKLY_SCHEDULE.find((d) => d.dayIndex === selectedDayIndex) ||
      WEEKLY_SCHEDULE[0]
    );
  }, [selectedDayIndex]);

  // User's detected elective & core course tags
  const detectedUserRolesSummary = useMemo(() => {
    const rolesLower = (userRoles || []).map((r) => r.toLowerCase().trim());
    const list: { label: string; color: string }[] = [];

    // Math
    if (rolesLower.some((r) => r.includes("math_hl") || r.includes("mathematics hl"))) {
      list.push({ label: "Matematik AA HL", color: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-400" });
    } else if (rolesLower.some((r) => r.includes("math_sl") || r.includes("mathematics sl"))) {
      list.push({ label: "Matematik AA SL", color: "bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-400" });
    }

    // Elective Group 3 / 4 (Kimya / DigSoc / Psikoloji)
    if (rolesLower.some((r) => r.includes("digital_society") || r.includes("digsoc"))) {
      list.push({ label: "Digital Society HL", color: "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-400" });
    } else if (rolesLower.some((r) => r.includes("chemistry_hl") || r.includes("chemistry hl"))) {
      list.push({ label: "Kimya HL", color: "bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-400" });
    } else if (rolesLower.some((r) => r.includes("chemistry_sl") || r.includes("chemistry sl"))) {
      list.push({ label: "Kimya SL", color: "bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-400" });
    } else if (rolesLower.some((r) => r.includes("psychology_hl") || r.includes("psychology hl"))) {
      list.push({ label: "Psikoloji HL", color: "bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-400" });
    } else if (rolesLower.some((r) => r.includes("psychology_sl") || r.includes("psychology sl"))) {
      list.push({ label: "Psikoloji SL", color: "bg-pink-500/20 text-pink-700 dark:text-pink-300 border-pink-400" });
    }

    // Science Group (Fizik / Biyoloji)
    if (rolesLower.some((r) => r.includes("physics_hl") || r.includes("physics hl"))) {
      list.push({ label: "Fizik HL", color: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-400" });
    } else if (rolesLower.some((r) => r.includes("physics_sl") || r.includes("physics sl"))) {
      list.push({ label: "Fizik SL", color: "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-400" });
    } else if (rolesLower.some((r) => r.includes("biology_hl") || r.includes("biology hl"))) {
      list.push({ label: "Biyoloji HL", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400" });
    } else if (rolesLower.some((r) => r.includes("biology_sl") || r.includes("biology sl"))) {
      list.push({ label: "Biyoloji SL", color: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400" });
    }

    // Turkish Literature
    if (rolesLower.some((r) => r.includes("turkish_hl") || r.includes("turkish a hl"))) {
      list.push({ label: "Türk Dili ve Ed. HL", color: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-400" });
    } else {
      list.push({ label: "Türk Dili ve Ed. SL", color: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-400" });
    }

    return list;
  }, [userRoles]);

  // Current active or upcoming period right now
  const liveActivePeriodInfo = useMemo(() => {
    const todayIndex = now.getDay();
    if (todayIndex < 1 || todayIndex > 5) return null;

    const todaySched = WEEKLY_SCHEDULE.find((d) => d.dayIndex === todayIndex);
    if (!todaySched) return null;

    for (const p of todaySched.periods) {
      const status = getCurrentPeriodStatus(p.startTime, p.endTime, todayIndex, now);
      if (status.status === "current") {
        const resolved = resolveSubjectByRole(p.subjectKey, userRoles);
        return {
          type: "current" as const,
          period: p,
          resolved,
          status,
        };
      }
      if (status.status === "next") {
        const resolved = resolveSubjectByRole(p.subjectKey, userRoles);
        return {
          type: "next" as const,
          period: p,
          resolved,
          status,
        };
      }
    }
    return null;
  }, [now, userRoles]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div
        className={`w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 my-auto ${
          viewMode === "weekly" ? "max-w-6xl max-h-[94vh]" : "max-w-2xl max-h-[92vh]"
        }`}
      >
        {/* ========================================================= */}
        {/* MODAL HEADER */}
        {/* ========================================================= */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-white dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
              <CalendarDays size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  12 G IB Ders Programı
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Dinamik & Rol Bazlı
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Rollerinize göre filtrelenmiş güncel ders saatleri ve canlı durum takibi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Full Weekly vs Daily View Button */}
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === "daily" ? "weekly" : "daily"))}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title={viewMode === "daily" ? "Tüm Haftalık Tabloyu Göster" : "Günlük Listeye Dön"}
            >
              {viewMode === "daily" ? (
                <>
                  <Maximize2 size={13} className="text-indigo-500" />
                  <span>Haftalık Görünüm</span>
                </>
              ) : (
                <>
                  <Minimize2 size={13} className="text-indigo-500" />
                  <span>Günlük Görünüm</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* USER IB ROLES BADGES BAR */}
        {/* ========================================================= */}
        <div className="px-5 py-2.5 bg-slate-50/80 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <GraduationCap size={13} className="text-indigo-500" />
              <span>Dersleriniz:</span>
            </span>
            {detectedUserRolesSummary.length > 0 ? (
              detectedUserRolesSummary.map((item, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${item.color}`}
                >
                  {item.label}
                </span>
              ))
            ) : (
              <span className="text-[11px] text-slate-500 italic">
                Standart Program (Özel rol tanımlanmamış)
              </span>
            )}
          </div>

          {onOpenEditRoles && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenEditRoles();
              }}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Rollerimi Değiştir ⚙️
            </button>
          )}
        </div>

        {/* ========================================================= */}
        {/* LIVE ACTIVE / NEXT PERIOD BANNER (IF ON SCHOOL DAY) */}
        {/* ========================================================= */}
        {liveActivePeriodInfo && (
          <div className="px-5 py-3 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border-b border-blue-500/20 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                      {liveActivePeriodInfo.type === "current"
                        ? "Şu Anki Ders İşleniyor"
                        : "Sıradaki Ders Başlamak Üzere"}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                      ({liveActivePeriodInfo.period.startTime} - {liveActivePeriodInfo.period.endTime})
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mt-0.5">
                    <span>{liveActivePeriodInfo.resolved.icon}</span>
                    <span>
                      {liveActivePeriodInfo.period.periodNumber}. Ders:{" "}
                      {liveActivePeriodInfo.resolved.name}
                    </span>
                  </h4>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-block px-2.5 py-1 rounded-xl bg-blue-500 text-white font-black text-xs shadow-sm">
                  {liveActivePeriodInfo.status.label}
                </span>
                {liveActivePeriodInfo.status.progressPercent !== undefined && (
                  <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5 ml-auto">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${liveActivePeriodInfo.status.progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* DAY SELECTOR TABS (Pzt, Sal, Çar, Per, Cum) */}
        {/* ========================================================= */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
            <div className="flex items-center gap-1 sm:gap-2">
              {WEEKLY_SCHEDULE.map((day) => {
                const isSelected = selectedDayIndex === day.dayIndex && viewMode === "daily";
                const isToday = currentDayIndex === day.dayIndex && now.getDay() >= 1 && now.getDay() <= 5;

                return (
                  <button
                    key={day.dayIndex}
                    type="button"
                    onClick={() => {
                      setSelectedDayIndex(day.dayIndex);
                      setViewMode("daily");
                    }}
                    className={`px-3 sm:px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/25 scale-[1.02]"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>{day.dayName}</span>
                    {isToday && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase ${
                          isSelected
                            ? "bg-white/25 text-white"
                            : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        Bugün
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === "weekly" ? "daily" : "weekly"))}
              className={`sm:hidden px-3 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === "weekly"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              <span>Haftalık</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL MAIN CONTENT BODY */}
        {/* ========================================================= */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 touch-pan-y overscroll-y-contain">
          {viewMode === "daily" ? (
            /* ------------------------------------------------------- */
            /* DAILY SCHEDULE VIEW (DEFAULT)                           */
            /* ------------------------------------------------------- */
            <div className="space-y-2.5 max-w-xl mx-auto">
              <div className="flex items-center justify-between pb-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Calendar size={13} />
                  <span>
                    {activeDaySchedule.dayName} Günü Ders Akışı ({activeDaySchedule.periods.length} Ders)
                  </span>
                </h4>
                <span className="text-[11px] font-mono text-slate-400">
                  {activeDaySchedule.periods[0]?.startTime || "08:00"} - {activeDaySchedule.periods[activeDaySchedule.periods.length - 1]?.endTime || "15:30"}
                </span>
              </div>

              {activeDaySchedule.periods.map((period, idx) => {
                const resolved = resolveSubjectByRole(period.subjectKey, userRoles);
                const timeStatus = getCurrentPeriodStatus(
                  period.startTime,
                  period.endTime,
                  activeDaySchedule.dayIndex,
                  now
                );

                const isCurrent = timeStatus.status === "current";
                const isPast = timeStatus.status === "past";
                const isNext = timeStatus.status === "next";

                return (
                  <React.Fragment key={period.periodNumber}>
                    {/* Lunch Break Banner between 5th and 6th periods */}
                    {period.periodNumber === 6 && (
                      <div className="my-3 p-3 rounded-2xl bg-amber-500/10 border border-dashed border-amber-500/30 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                        <div className="flex items-center gap-2 font-bold">
                          <span className="text-base">🍲</span>
                          <span>{getLunchBreakForDay(activeDaySchedule.dayIndex).title}</span>
                        </div>
                        <span className="font-mono font-black">
                          {getLunchBreakForDay(activeDaySchedule.dayIndex).start} - {getLunchBreakForDay(activeDaySchedule.dayIndex).end} ({getLunchBreakForDay(activeDaySchedule.dayIndex).durationMin} dk)
                        </span>
                      </div>
                    )}

                    <div
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-blue-500/15 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/10 scale-[1.01]"
                          : isNext
                          ? "bg-amber-500/10 border-amber-500/50 shadow-sm"
                          : isPast
                          ? "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-65"
                          : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/70 hover:border-slate-300 shadow-xs"
                      }`}
                    >
                      {/* Left: Period Number & Time Range */}
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 ${
                            isCurrent
                              ? "bg-blue-600 text-white shadow-md shadow-blue-500/30"
                              : isNext
                              ? "bg-amber-500 text-slate-950 font-black"
                              : isPast
                              ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <span className="text-xs leading-none">{period.periodNumber}</span>
                          <span className="text-[9px] uppercase font-bold tracking-tight">Ders</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm sm:text-base font-black ${
                                isCurrent
                                  ? "text-blue-700 dark:text-blue-300 font-black"
                                  : isPast
                                  ? "text-slate-500 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-slate-600"
                                  : "text-slate-900 dark:text-slate-100"
                              }`}
                            >
                              {resolved.name}
                            </span>

                            {resolved.level && (
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                                  resolved.level === "HL"
                                    ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                }`}
                              >
                                {resolved.level}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span className="font-mono font-bold flex items-center gap-1">
                              <Clock size={11} className="text-slate-400" />
                              {period.startTime} - {period.endTime}
                            </span>
                            {resolved.notes && (
                              <>
                                <span>•</span>
                                <span className="truncate max-w-[200px] text-[11px]">
                                  {resolved.notes}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Status Badge & Pulse Indicator */}
                      <div className="text-right shrink-0">
                        {isCurrent ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500 text-white font-black text-xs shadow-sm shadow-blue-500/30 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-white"></span>
                            <span>▶ Şu An</span>
                          </div>
                        ) : isNext ? (
                          <div className="px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black text-xs">
                            <span>⏳ {timeStatus.label}</span>
                          </div>
                        ) : isPast ? (
                          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            <CheckCircle2 size={13} className="text-emerald-500" />
                            <span>Bitti</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">
                            {period.startTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            /* ------------------------------------------------------- */
            /* FULL WEEKLY GRID VIEW (PAZARTESİ - CUMA)                */
            /* ------------------------------------------------------- */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <Layers size={13} />
                  <span>Haftalık Genel Bakış (12 G IB)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setViewMode("daily")}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Günlük Detaya Dön</span>
                  <ChevronRight size={13} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {WEEKLY_SCHEDULE.map((day) => {
                  const isToday = currentDayIndex === day.dayIndex && now.getDay() >= 1 && now.getDay() <= 5;

                  return (
                    <div
                      key={day.dayIndex}
                      className={`rounded-2xl border p-3 flex flex-col gap-2 transition-all ${
                        isToday
                          ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-400/80 shadow-md ring-1 ring-blue-500/30"
                          : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {/* Day Column Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
                        <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                          {day.dayName}
                        </span>
                        {isToday ? (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-500 text-white uppercase tracking-wider">
                            Bugün
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">
                            {day.periods.length} Ders
                          </span>
                        )}
                      </div>

                      {/* Day Periods List */}
                      <div className="space-y-1.5 flex-1">
                        {day.periods.map((period) => {
                          const resolved = resolveSubjectByRole(period.subjectKey, userRoles);
                          const status = getCurrentPeriodStatus(
                            period.startTime,
                            period.endTime,
                            day.dayIndex,
                            now
                          );

                          const isCurrent = status.status === "current";

                          return (
                            <div
                              key={period.periodNumber}
                              className={`p-2 rounded-xl border text-xs transition-all ${
                                isCurrent
                                  ? "bg-blue-500 text-white border-blue-600 font-bold shadow-md shadow-blue-500/20"
                                  : "bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 text-[10px] opacity-80 mb-0.5">
                                <span className="font-bold">
                                  {period.periodNumber}. Ders
                                </span>
                                <span className="font-mono">
                                  {period.startTime}
                                </span>
                              </div>
                              <div className="font-black text-[11px] leading-tight truncate">
                                {resolved.name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* MODAL FOOTER */}
        {/* ========================================================= */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 text-center sm:text-left">
            <Info size={13} className="text-blue-500 shrink-0" />
            <span>
              Dersler kullanıcı profilinizdeki rollere göre çözümlenmektedir (Örn: Kimya, DigSoc, Psikoloji, Fizik, Biyoloji).
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => setViewMode((prev) => (prev === "daily" ? "weekly" : "daily"))}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
            >
              {viewMode === "daily" ? "Tüm Haftalık Programı Gör" : "Günlük Görünüme Dön"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm shadow-blue-500/20"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
