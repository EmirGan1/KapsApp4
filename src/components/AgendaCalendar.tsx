import React, { useState, useMemo, useEffect } from "react";
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
  ScheduleGapItem
} from "../utils/scheduleGapDetector";
import ScheduleGapCard from "./ScheduleGapCard";
import DayDetailSheet, { formatSelectedDateTitle } from "./DayDetailSheet";

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
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
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
      isToday: boolean;
    }> = [];

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

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
        isInMockPeriod: isMockExamPeriod(dateStr),
        isToday: dateStr === todayStr
      });
    }

    // Current month days
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isInMockPeriod: isMockExamPeriod(dateStr),
        isToday: dateStr === todayStr
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
        isInMockPeriod: isMockExamPeriod(dateStr),
        isToday: dateStr === todayStr
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
  const selectedDayEntriesWithGaps: Array<ScheduleEntry | ScheduleGapItem> = useMemo(() => {
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

  const handleToday = () => {
    const now = new Date();
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setSelectedDateStr(todayStr);
    // Mobilde bugünü seçip çekmeceyi aç
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsMobileSheetOpen(true);
    }
  };

  const handleJumpToMock = () => {
    setViewDate(new Date("2026-10-12T00:00:00"));
    setSelectedDateStr("2026-10-12");
  };

  const handleDaySelect = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    // Mobilde alt çekmeceyi otomatik aç
    setIsMobileSheetOpen(true);
  };

  // Lock background body scroll when selectedExamDetail modal is active
  useEffect(() => {
    if (selectedExamDetail) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [selectedExamDetail]);

  return (
    <div className={`flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-hidden w-full max-w-full ${className}`}>
      
      {/* 1. MOCK EXAM PERIOD INFORMATION BANNER */}
      <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-indigo-500/15 border-b border-amber-500/30 p-3.5 sm:p-4 lg:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-base sm:text-lg shadow-sm shrink-0">
            📝
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/30 text-amber-900 dark:text-amber-200 border border-amber-400/40 shrink-0">
                Mock Sınav Düzeni
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                12 - 26 Ekim 2026
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Normal ders saatleri sınav saatleriyle ikame edilmiştir. SL/HL seviyelerine göre sınavlar listelenir.
            </p>
          </div>
        </div>

        {/* Quick jump & Toggle button */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setOnlyMyExams((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
              onlyMyExams
                ? "bg-amber-400 text-slate-950 border-amber-400 shadow-amber-400/20"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200"
            }`}
            title="Sadece kayıtlı olduğunuz IB derslerinin sınavlarını görüntüler"
          >
            <Star size={13} className={onlyMyExams ? "fill-slate-950 text-slate-950" : "text-amber-500"} />
            <span>Sınavlarımı Göster</span>
          </button>

          <button
            type="button"
            onClick={handleJumpToMock}
            className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span>Mock Haftası</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 2. CALENDAR HEADER / TOOLBAR */}
      {/* 2A. Mobile View Toolbar (< md) */}
      <div className="flex lg:hidden items-center justify-between w-full px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          aria-label="Önceki Ay"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="text-center min-w-0 px-2">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">
            {MONTH_NAMES_TR[month]} {year}
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleToday}
            className="text-xs px-2.5 py-1 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold hover:bg-sky-100 transition-colors"
          >
            Bugün
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
            aria-label="Sonraki Ay"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 2B. Desktop View Toolbar (>= md) */}
      <div className="hidden lg:flex p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 items-center justify-between gap-3">
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
            type="button"
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Bugün
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Önceki Ay"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            title="Sonraki Ay"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* 3. GRID & DETAIL SPLIT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 w-full overflow-hidden">
        
        {/* Left Side: Calendar Grid (7 columns) */}
        <div className="w-full lg:col-span-7 lg:col-span-7 p-2 sm:p-3 lg:p-5 overflow-hidden">
          {/* Weekday Names */}
          <div className="grid grid-cols-7 mb-1.5 lg:mb-2 text-center text-[11px] sm:text-xs font-bold text-slate-400">
            {WEEKDAY_NAMES_TR.map((wd, i) => (
              <div key={wd} className={i >= 5 ? "text-rose-500 font-bold" : ""}>
                {wd}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 w-full">
            {calendarDays.map((day) => {
              const dayExams = examsByDate[day.dateStr] || [];
              const isSelected = selectedDateStr === day.dateStr;
              const hasEnrolledExam = dayExams.some((e) => isUserEnrolledInExam(e, currentUserRoles));
              const isWeekday = new Date(day.dateStr).getDay() !== 0 && new Date(day.dateStr).getDay() !== 6;

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => handleDaySelect(day.dateStr)}
                  className={`w-full aspect-square min-h-[42px] sm:min-h-[48px] lg:min-h-[76px] lg:aspect-auto p-1 sm:p-1.5 rounded-xl lg:rounded-2xl flex flex-col justify-between transition-all cursor-pointer relative text-left border overflow-hidden ${
                    isSelected
                      ? "border-sky-500 ring-2 ring-sky-500 bg-sky-500/10 dark:bg-sky-500/15 font-bold"
                      : day.isInMockPeriod
                      ? "border-amber-400/40 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-400"
                      : !day.isCurrentMonth
                      ? "border-transparent opacity-35 text-slate-400"
                      : "border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  {/* Gün Numarası & Masaüstü Rozet */}
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[11px] sm:text-xs font-bold ${
                      isSelected
                        ? "text-sky-600 dark:text-sky-400 font-black"
                        : day.isCurrentMonth
                        ? "text-slate-800 dark:text-slate-200"
                        : "text-slate-400"
                    }`}>
                      {day.dayNumber}
                    </span>

                    {/* Masaüstünde Nabız Noktası */}
                    {hasEnrolledExam && (
                      <span className="hidden lg:inline-block w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/30 animate-pulse" />
                    )}
                  </div>

                  {/* MOBİL İÇİN RENKLİ DURUM NOKTALARI (DOTS / INDICATORS) (< md) */}
                  <div className="flex lg:hidden items-center justify-center gap-0.5 sm:gap-1 mt-auto pb-0.5 w-full">
                    {/* Sınav Noktası (Sarı/Amber) */}
                    {dayExams.length > 0 && (
                      <span 
                        className={`w-1.5 h-1.5 rounded-full ${
                          hasEnrolledExam ? "bg-amber-400 ring-1 ring-amber-400/60 animate-pulse" : "bg-amber-400"
                        }`} 
                        title="Mock Sınav"
                      />
                    )}
                    {/* Normal Ders Noktası (Mavi/Sky) */}
                    {day.isCurrentMonth && isWeekday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" title="Ders Programı" />
                    )}
                    {/* Mock Dönemi Noktası */}
                    {day.isInMockPeriod && dayExams.length === 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500" title="Mock Dönemi" />
                    )}
                  </div>

                  {/* MASAÜSTÜ İÇİN DETAYLI ETİKETLER (>= md) */}
                  {dayExams.length > 0 && (
                    <div className="hidden lg:block space-y-0.5 mt-1 w-full">
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

        {/* Right Side: Desktop Day Schedule & Overlay Detail Panel (HIDDEN ON MOBILE) */}
        <div className="hidden lg:flex lg:col-span-5 lg:col-span-5 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-200/80 dark:border-slate-800">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Seçili Günün Programı
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 truncate">
                  {formatSelectedDateTitle(selectedDateStr)}
                </h3>
              </div>

              {isMockExamPeriod(selectedDateStr) && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 flex items-center gap-1 shadow-2xs shrink-0">
                  <Star size={10} className="fill-slate-950" />
                  Mock Günü
                </span>
              )}
            </div>

            {/* List of Periods, Overlaid Exam Cards & Gap Fillers for Desktop */}
            <div className="space-y-2.5 overflow-y-auto max-h-[520px] pr-1 overscroll-y-contain">
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
                      className="rounded-2xl p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 flex items-center justify-between gap-2 shadow-2xs"
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

          {/* Desktop Bottom Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between mt-3">
            <span className="text-[11px] text-slate-400">
              Mock Sınav Koordinasyonu (12-IB DP)
            </span>
            {onOpenScheduleModal && (
              <button
                type="button"
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

      {/* 4. MOBİL GÜN DETAYI İÇİN ALT ÇEKMECE (BOTTOM SHEET) (BÖLÜM 1) */}
      <DayDetailSheet
        isOpen={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
        selectedDate={selectedDateStr}
        items={selectedDayEntriesWithGaps}
        currentUserRoles={currentUserRoles}
        onSelectExam={(exam, cancelledClasses) => {
          setSelectedExamDetail({ exam, cancelledClasses });
        }}
        onOpenScheduleModal={onOpenScheduleModal}
      />

      {/* 5. MOCK SINAV VE İKAME DERS DETAY POPUP / MODAL (z-[60] ÜSTTE AÇILIR) */}
      {selectedExamDetail && (
        <div 
          className="mobile-window fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedExamDetail(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 sm:p-6 overflow-hidden max-h-[88dvh] sm:max-h-[90dvh] flex flex-col justify-between pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden pt-1 pb-2 flex justify-center shrink-0">
              <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 mb-3 shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl sm:text-2xl shadow-sm shrink-0">
                  📝
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100 leading-tight break-words">
                    {selectedExamDetail.exam.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {selectedExamDetail.exam.subject} {selectedExamDetail.exam.paper ? `• ${selectedExamDetail.exam.paper}` : ""}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedExamDetail(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div 
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1 space-y-3"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              {/* Timing & Location Info */}
              {(() => {
                const t = getUserExamTiming(selectedExamDetail.exam, currentUserRoles);
                return (
                  <div className="space-y-2.5">
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                        <Clock size={16} className="text-amber-500 shrink-0" />
                        <span>Sınav Saati ({t.userLevel}):</span>
                      </div>
                      <span className="font-mono text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400">
                        {t.userStartTime} - {t.userEndTime} ({t.userDurationMinutes} dk)
                      </span>
                    </div>

                    {/* HL Extension Note for SL Students */}
                    {t.hasDifferentHlExtension && (
                      <div className="p-2.5 sm:p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-400/30 flex items-center gap-2 text-xs text-sky-800 dark:text-sky-300">
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

              {/* Çakışan Ders Bilgisi */}
              {selectedExamDetail.cancelledClasses && selectedExamDetail.cancelledClasses.length > 0 && (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2 w-full min-w-0 overflow-hidden">
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                    ↳ İptal Edilen Normal Dersler
                  </span>
                  <div className="space-y-2 w-full min-w-0">
                    {selectedExamDetail.cancelledClasses.map((cc, idx) => (
                      <div 
                        key={idx} 
                        className="p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-400/20 text-xs text-slate-700 dark:text-slate-300 w-full min-w-0 shadow-2xs"
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
