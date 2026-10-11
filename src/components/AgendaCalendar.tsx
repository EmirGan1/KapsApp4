import React, { useState, useMemo } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Sparkles, 
  Filter, 
  Star, 
  GraduationCap, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  ArrowRight,
  BookOpen,
  Info,
  X,
  Layers,
  MapPin
} from "lucide-react";
import { 
  OFFICIAL_MOCK_EXAMS, 
  MockExam, 
  isMockExamPeriod, 
  isUserEnrolledInExam, 
  buildDayScheduleWithOverlay,
  ScheduleEntry,
  CancelledClassInfo,
  getUserExamTiming,
  MOCK_EXAM_START_DATE,
  MOCK_EXAM_END_DATE
} from "../utils/mockExamData";
import MockExamCard from "./MockExamCard";
import {
  insertScheduleGaps,
  isScheduleGap,
  ScheduleGap
} from "../utils/scheduleGapDetector";
import ScheduleGapCard from "./ScheduleGapCard";

interface AgendaCalendarProps {
  currentUserRoles?: string[];
  currentUsername?: string;
  onOpenScheduleModal?: () => void;
  className?: string;
}

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

const WEEKDAY_NAMES_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export default function AgendaCalendar({
  currentUserRoles = [],
  currentUsername,
  onOpenScheduleModal,
  className = ""
}: AgendaCalendarProps) {
  // Calendar month view (defaults to October 2026 for the Mock Exam Period)
  const [viewDate, setViewDate] = useState(() => new Date("2026-10-12T00:00:00"));
  const [selectedDateStr, setSelectedDateStr] = useState<string>("2026-10-12");
  const [onlyMyExams, setOnlyMyExams] = useState<boolean>(false);
  const [selectedExamDetail, setSelectedExamDetail] = useState<{
    exam: MockExam;
    cancelledClasses?: CancelledClassInfo[];
  } | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed

  // Filtered exams according to "onlyMyExams" toggle
  const displayedExams = useMemo(() => {
    if (!onlyMyExams) return OFFICIAL_MOCK_EXAMS;
    return OFFICIAL_MOCK_EXAMS.filter((exam) => isUserEnrolledInExam(exam, currentUserRoles));
  }, [onlyMyExams, currentUserRoles]);

  // Map exams by YYYY-MM-DD
  const examsByDate = useMemo(() => {
    const map: Record<string, MockExam[]> = {};
    for (const exam of displayedExams) {
      if (!map[exam.date]) map[exam.date] = [];
      map[exam.date].push(exam);
    }
    return map;
  }, [displayedExams]);

  // Calendar Day Grid generation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const totalDays = lastDayOfMonth.getDate();
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isInMockPeriod: boolean;
    }> = [];

    // Previous month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isInMockPeriod: isMockExamPeriod(dateStr)
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isInMockPeriod: isMockExamPeriod(dateStr)
      });
    }

    // Next month padding
    const remainingSlots = 42 - days.length;
    for (let i = 1; i <= remainingSlots; i++) {
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isInMockPeriod: isMockExamPeriod(dateStr)
      });
    }

    return days;
  }, [year, month]);

  // Selected date schedule with overlay calculation
  const selectedDayEntries: ScheduleEntry[] = useMemo(() => {
    if (!selectedDateStr) return [];
    const d = new Date(selectedDateStr);
    const dayOfWeek = d.getDay();
    const schedule = buildDayScheduleWithOverlay(dayOfWeek, selectedDateStr, currentUserRoles, new Date());
    if (onlyMyExams) {
      return schedule.filter((s) => !s.isExamSlot || (s.overriddenByExam && isUserEnrolledInExam(s.overriddenByExam, currentUserRoles)));
    }
    return schedule;
  }, [selectedDateStr, currentUserRoles, onlyMyExams]);

  // Akıllı Boşluk ve Teneffüs Yakalayıcı (Gap Slicing Engine)
  const selectedDayEntriesWithGaps = useMemo(() => {
    const d = selectedDateStr ? new Date(selectedDateStr) : new Date();
    const dayOfWeek = d.getDay();
    return insertScheduleGaps(selectedDayEntries, dayOfWeek, currentUserRoles);
  }, [selectedDayEntries, selectedDateStr, currentUserRoles]);

  // Seçilen günün bugün olup olmadığını denetle
  const isTodaySelected = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return selectedDateStr === todayStr;
  }, [selectedDateStr]);

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleJumpToMock = () => {
    setViewDate(new Date("2026-10-12T00:00:00"));
    setSelectedDateStr("2026-10-12");
  };

  return (
    <div className={`flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden ${className}`}>
      
      {/* 1. MOCK EXAM PERIOD INFORMATION BANNER */}
      <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-indigo-500/15 border-b border-amber-500/30 p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shadow-sm shrink-0">
            📝
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/30 text-amber-900 dark:text-amber-200 border border-amber-400/40">
                Mock Sınav Düzeni
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                12 - 26 Ekim 2026
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Normal ders saatleri sınav saatleriyle ikame edilmiştir. SL ve HL seviyelerine göre kesin süreler ve çakışan dersler listelenmektedir.
            </p>
          </div>
        </div>

        {/* Quick jump & Toggle button */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => setOnlyMyExams((prev) => !prev)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border shadow-xs ${
              onlyMyExams
                ? "bg-amber-400 text-slate-950 border-amber-400 shadow-amber-400/20"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
            }`}
            title="Sadece kayıtlı olduğunuz IB derslerinin sınavlarını görüntüler"
          >
            <Star size={13} className={onlyMyExams ? "fill-slate-950 text-slate-950" : "text-amber-500"} />
            <span>Yalnızca Sınavlarımı Göster</span>
          </button>

          <button
            onClick={handleJumpToMock}
            className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Mock Haftasına Git</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 2. CALENDAR HEADER */}
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <CalendarIcon size={18} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {MONTH_NAMES_TR[month]} {year}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sınav günlerine tıklayarak seviyene göre sınav süresini ve ikame edilen dersleri inceleyin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Önceki Ay"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Sonraki Ay"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 3. GRID & DETAIL SPLIT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        
        {/* Left Side: Calendar Grid (7 columns) */}
        <div className="lg:col-span-7 p-4 sm:p-5">
          {/* Weekday Names */}
          <div className="grid grid-cols-7 mb-2 text-center text-xs font-bold text-slate-400">
            {WEEKDAY_NAMES_TR.map((wd, i) => (
              <div key={wd} className={i >= 5 ? "text-rose-500" : ""}>
                {wd}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day) => {
              const dayExams = examsByDate[day.dateStr] || [];
              const isSelected = selectedDateStr === day.dateStr;
              const hasEnrolledExam = dayExams.some((e) => isUserEnrolledInExam(e, currentUserRoles));

              return (
                <button
                  key={day.dateStr}
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`min-h-[64px] sm:min-h-[76px] p-1.5 rounded-2xl flex flex-col justify-between transition-all cursor-pointer relative text-left border ${
                    isSelected
                      ? "border-amber-400 ring-2 ring-amber-400/50 bg-amber-500/10 dark:bg-amber-500/15"
                      : day.isInMockPeriod
                      ? "border-amber-400/30 bg-amber-50/30 dark:bg-amber-950/20 hover:border-amber-400"
                      : !day.isCurrentMonth
                      ? "border-transparent opacity-40 text-slate-400"
                      : "border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-bold ${
                      isSelected
                        ? "text-amber-900 dark:text-amber-200 font-black"
                        : day.isCurrentMonth
                        ? "text-slate-800 dark:text-slate-200"
                        : "text-slate-400"
                    }`}>
                      {day.dayNumber}
                    </span>
                    {hasEnrolledExam && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30 animate-pulse" />
                    )}
                  </div>

                  {/* Exam Mini Badges inside day cell */}
                  {dayExams.length > 0 && (
                    <div className="space-y-0.5 mt-1 w-full">
                      {dayExams.slice(0, 2).map((ex) => {
                        const isEnrolled = isUserEnrolledInExam(ex, currentUserRoles);
                        return (
                          <div
                            key={ex.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDateStr(day.dateStr);
                              setSelectedExamDetail({ exam: ex });
                            }}
                            className={`text-[9px] font-bold px-1 py-0.5 rounded truncate transition-opacity hover:opacity-80 ${
                              isEnrolled
                                ? "bg-amber-400 text-slate-950 font-black"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                            title={`${ex.title} (${ex.startTime} - ${ex.endTime})`}
                          >
                            {ex.subject}
                          </div>
                        );
                      })}
                      {dayExams.length > 2 && (
                        <div className="text-[8px] font-bold text-slate-400 text-right pr-0.5">
                          +{dayExams.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Day Schedule & Overlay Detail Panel */}
        <div className="lg:col-span-5 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200/80 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Seçili Günün Programı
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                  {new Date(selectedDateStr).toLocaleDateString("tr-TR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}
                </h3>
              </div>

              {isMockExamPeriod(selectedDateStr) && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
                  <Star size={10} className="fill-slate-950" />
                  Mock Sınav Günü
                </span>
              )}
            </div>

            {/* List of Periods, Overlaid Exam Cards & Gap Fillers */}
            <div className="space-y-2.5 overflow-y-auto max-h-[520px] pr-1">
              {selectedDayEntriesWithGaps.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <p className="text-xs text-slate-400">Bu gün için planlanan ders veya sınav bulunmuyor.</p>
                </div>
              ) : (
                selectedDayEntriesWithGaps.map((item) => {
                  // Akıllı Boşluk / Teneffüs Kartı
                  if (isScheduleGap(item)) {
                    return (
                      <ScheduleGapCard
                        key={item.id}
                        gap={item}
                        isToday={isTodaySelected}
                        now={new Date()}
                        variant="calendar"
                      />
                    );
                  }

                  const entry = item;
                  const isExam = Boolean(entry.isExamSlot && entry.overriddenByExam);

                  if (isExam && entry.overriddenByExam) {
                    return (
                      <MockExamCard
                        key={entry.id}
                        exam={entry.overriddenByExam}
                        cancelledClasses={entry.cancelledClasses}
                        currentUserRoles={currentUserRoles}
                        isEnrolled={entry.isUserEnrolled}
                        statusInfo={entry.statusInfo}
                        variant="calendar"
                        onClick={() => setSelectedExamDetail({
                          exam: entry.overriddenByExam!,
                          cancelledClasses: entry.cancelledClasses
                        })}
                      />
                    );
                  }

                  // Normal Period Card
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 flex items-center justify-between gap-2 shadow-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{entry.resolved?.icon || "📚"}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                            {entry.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {entry.roomOrNote || "Standart Ders"}
                          </p>
                        </div>
                      </div>

                      <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">
                        {entry.startTime} - {entry.endTime}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between mt-3">
            <span className="text-[11px] text-slate-400">
              Mock Sınav Koordinasyonu (12-IB DP)
            </span>
            {onOpenScheduleModal && (
              <button
                onClick={onOpenScheduleModal}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Haftalık Çizelgeyi Aç</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. MOCK SINAV VE İKAME DERS DETAY POPUP / MODAL (BÖLÜM 3) */}
      {selectedExamDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedExamDetail(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-2xl shadow-sm shrink-0">
                    📝
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100 leading-tight">
                      {selectedExamDetail.exam.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {selectedExamDetail.exam.subject} {selectedExamDetail.exam.paper ? `• ${selectedExamDetail.exam.paper}` : ""}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedExamDetail(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Timing & Location Info */}
              {(() => {
                const t = getUserExamTiming(selectedExamDetail.exam, currentUserRoles);
                return (
                  <div className="space-y-3 mb-4">
                    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <Clock size={16} className="text-amber-500 shrink-0" />
                        <span>Sınav Saati ({t.userLevel}):</span>
                      </div>
                      <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                        {t.userStartTime} - {t.userEndTime} ({t.userDurationMinutes} dk)
                      </span>
                    </div>

                    {/* HL Extension Note for SL Students */}
                    {t.hasDifferentHlExtension && (
                      <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-400/30 flex items-center gap-2 text-xs text-sky-800 dark:text-sky-300">
                        <Info size={16} className="text-sky-500 shrink-0" />
                        <span className="leading-snug">
                          Senin sınavın <strong>{t.userEndTime}</strong>'de biter. HL öğrencileri <strong>{t.hlEndTime}</strong>'ye kadar devam eder.
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 px-1">
                      <MapPin size={14} className="text-amber-500 shrink-0" />
                      <span>Sınav Salonu: <strong>{selectedExamDetail.exam.room}</strong></span>
                    </div>
                  </div>
                );
              })()}

              {/* Çakışan Ders Bilgisi & Temiz Uyarı Kutusu */}
              {selectedExamDetail.cancelledClasses && selectedExamDetail.cancelledClasses.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2 mb-4 w-full min-w-0 overflow-hidden">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                    ↳ İptal Edilen Normal Dersler
                  </span>
                  <div className="space-y-2 w-full min-w-0">
                    {selectedExamDetail.cancelledClasses.map((cc, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-400/20 text-xs text-slate-700 dark:text-slate-300 w-full min-w-0 shadow-2xs"
                      >
                        <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                          Bu saatteki normal <span className="underline text-amber-600 dark:text-amber-400">{cc.name}</span> dersi yerine yapılmaktadır
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700">
                          <span>Derslik: {cc.roomOrNote || "302"}</span>
                          <span className="font-mono text-amber-700 dark:text-amber-300 font-bold">{cc.startTime} - {cc.endTime}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedExamDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Anladım, Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
