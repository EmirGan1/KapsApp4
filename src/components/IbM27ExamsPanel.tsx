import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  Sparkles,
  Sun,
  Sunset,
  Search,
  CheckCircle2,
  GraduationCap,
  SlidersHorizontal,
  Info,
  X,
  BookOpen,
  Award,
  Flame,
} from "lucide-react";
import { COURSE_ROLES } from "../types";
import {
  OFFICIAL_IB_M27_EXAMS,
  IbM27ExamPaper,
  CalendarWindowDay,
  getIbM27WindowDays,
  isExamRegisteredForUser,
  getMatchedRolesForExam,
  getFirstExamCountdown,
} from "../utils/ibM27Exams";

const FALLBACK_USER_ROLES = ["titc", "eng_b_hl"];

export interface IbM27ExamsPanelProps {
  currentUserRoles: string[];
  onUpdateUserRoles?: (roles: string[]) => void;
  onNavigateCalculator?: () => void;
}

const WEEKDAY_HEADERS = [
  { short: "PZT", full: "Pazartesi" },
  { short: "SAL", full: "Salı" },
  { short: "ÇAR", full: "Çarşamba" },
  { short: "PER", full: "Perşembe" },
  { short: "CUM", full: "Cuma" },
  { short: "CMT", full: "Cumartesi" },
  { short: "PAZ", full: "Pazar" },
];

export default function IbM27ExamsPanel({
  currentUserRoles,
  onUpdateUserRoles,
  onNavigateCalculator,
}: IbM27ExamsPanelProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [filterMode, setFilterMode] = useState<"all" | "registered">("all");
  const [sessionFilter, setSessionFilter] = useState<"all" | "morning" | "afternoon">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState<boolean>(false);
  const [selectedExamModal, setSelectedExamModal] = useState<IbM27ExamPaper | null>(null);

  // Effective user roles: if user has none assigned yet, fall back to FALLBACK_USER_ROLES so "Kayıtlı Sınavınız" highlights work out of the box
  const activeRoles = useMemo(() => {
    if (Array.isArray(currentUserRoles) && currentUserRoles.length > 0) {
      return currentUserRoles;
    }
    return FALLBACK_USER_ROLES;
  }, [currentUserRoles]);

  // Live 1-second ticker for the countdown banner at the very top
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Countdown to the very first official IB M27 exam (23 April 2027, 13:00)
  const officialFirstCountdown = useMemo(
    () => getFirstExamCountdown(nowMs, OFFICIAL_IB_M27_EXAMS),
    [nowMs]
  );

  // Countdown to the user's own first registered exam
  const registeredFirstCountdown = useMemo(
    () => getFirstExamCountdown(nowMs, OFFICIAL_IB_M27_EXAMS, activeRoles),
    [nowMs, activeRoles]
  );

  // Count how many total official papers and how many match the user's roles
  const registeredPapersList = useMemo(
    () =>
      OFFICIAL_IB_M27_EXAMS.filter((exam) =>
        isExamRegisteredForUser(exam, activeRoles)
      ),
    [activeRoles]
  );

  // Filtered exams for the calendar window
  const filteredExams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return OFFICIAL_IB_M27_EXAMS.filter((exam) => {
      if (filterMode === "registered" && !isExamRegisteredForUser(exam, activeRoles)) {
        return false;
      }
      if (sessionFilter !== "all" && exam.session !== sessionFilter) {
        return false;
      }
      if (q) {
        const hay = `${exam.subjectTitleTr} ${exam.subjectTitleEn} ${exam.paper} ${exam.dateLabelTr} ${exam.level}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filterMode, sessionFilter, searchQuery, activeRoles]);

  // Build uncompressed April (15–30) and May (1–19) calendar window
  const { aprilSecondHalf, mayFirstHalf } = useMemo(
    () => getIbM27WindowDays(filteredExams),
    [filteredExams]
  );

  const handleToggleRole = (roleId: string) => {
    const exists = activeRoles.includes(roleId);
    const next = exists
      ? activeRoles.filter((r) => r !== roleId)
      : [...activeRoles, roleId];
    localStorage.setItem("lan_user_roles", JSON.stringify(next));
    if (onUpdateUserRoles) {
      onUpdateUserRoles(next);
    }
  };

  const activeRoleObjects = useMemo(
    () => COURSE_ROLES.filter((cr) => activeRoles.includes(cr.id)),
    [activeRoles]
  );

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 lg:pb-12">
      <div className="max-w-[1600px] mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
        {/* ================================================================= */}
        {/* 1. TOP COUNTDOWN BANNER (İLK SINAVA KALAN SÜRE - CANLI GERİ SAYIM) */}
        {/* ================================================================= */}
        <section
          aria-label="IB M27 İlk Sınav Canlı Geri Sayım"
          className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
        >
          {/* Subtle Top Accent Line */}
          <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-rose-500" />

          <div className="p-4 sm:p-6 lg:p-7">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-center">
              {/* Left Column: Title & Official Window Summary */}
              <div className="xl:col-span-5 space-y-2.5">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  <GraduationCap size={16} />
                  <span>IB Diploma Programme · May 2027 (M27) Resmi Takvimi</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  IB M27 Sınavları &amp; Resmi Ajanda
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Resmi IB Mayıs 2027 sınav dönemi{" "}
                  <strong className="font-bold text-slate-900 dark:text-slate-100">
                    23 Nisan 2027 Cuma
                  </strong>{" "}
                  günü başlar ve{" "}
                  <strong className="font-bold text-slate-900 dark:text-slate-100">
                    18 Mayıs 2027 Salı
                  </strong>{" "}
                  günü tamamlanır. Aşağıdaki ajandada yalnızca sınav dönemini kapsayan{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    15–30 Nisan 2027 (Nisan 2. Yarı)
                  </span>{" "}
                  ve{" "}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                    1–19 Mayıs 2027 (Mayıs 1. Yarı)
                  </span>{" "}
                  tarihleri sıkıştırma olmadan tam görünümde yer alır.
                </p>
              </div>

              {/* Right Column: Live Countdown Boxes */}
              <div className="xl:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary Countdown: First Official IB M27 Exam */}
                <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <Clock size={13} />
                        <span>İLK RESMİ IB M27 SINAVINA KALAN SÜRE</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {officialFirstCountdown.targetTitleTr}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {officialFirstCountdown.targetSubtitleTr}
                      </div>
                    </div>
                  </div>

                  {/* Tabular Countdown Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <CountdownUnit value={officialFirstCountdown.days} label="GÜN" accent="blue" />
                    <CountdownUnit value={officialFirstCountdown.hours} label="SAAT" accent="blue" />
                    <CountdownUnit value={officialFirstCountdown.minutes} label="DAKİKA" accent="blue" />
                    <CountdownUnit value={officialFirstCountdown.seconds} label="SANİYE" accent="blue" />
                  </div>
                </div>

                {/* Secondary Countdown: User's First Registered Exam ("Kayıtlı Sınavınız") */}
                <div className="rounded-xl border border-amber-300/80 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/25 p-4 flex flex-col justify-between gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <Sparkles size={13} />
                        <span>İLK KAYITLI SINAVINIZA KALAN SÜRE</span>
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {registeredFirstCountdown.targetTitleTr}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {registeredFirstCountdown.targetSubtitleTr}
                      </div>
                    </div>
                  </div>

                  {/* Tabular Countdown Grid */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <CountdownUnit value={registeredFirstCountdown.days} label="GÜN" accent="amber" />
                    <CountdownUnit value={registeredFirstCountdown.hours} label="SAAT" accent="amber" />
                    <CountdownUnit value={registeredFirstCountdown.minutes} label="DAKİKA" accent="amber" />
                    <CountdownUnit value={registeredFirstCountdown.seconds} label="SANİYE" accent="amber" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 2. USER ROLES & FILTER BAR ("KAYITLI SINAVINIZ" KONTROL MERKEZİ)    */}
        {/* ================================================================= */}
        <section
          aria-label="Kayıtlı Ders Rolleriniz ve Takvim Filtreleri"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Active User Roles Display */}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Award size={15} className="text-amber-500" />
                  <span>Ders Rolleriniz ({activeRoleObjects.length} Ders · {registeredPapersList.length} Sınav Oturumu):</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsRoleEditorOpen((prev) => !prev)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <SlidersHorizontal size={13} />
                  <span>{isRoleEditorOpen ? "Ders Seçimini Kapat" : "Ders Rollerimi Düzenle"}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {activeRoleObjects.map((role) => (
                  <span
                    key={role.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs"
                    style={{
                      backgroundColor: `${role.color}15`,
                      borderColor: `${role.color}45`,
                      color: role.color,
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: role.color }}
                    />
                    <span>{role.label}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Filter & Search Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* View Mode Switch: All Official vs Registered Only */}
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterMode === "all"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Tüm Resmi Sınavlar ({OFFICIAL_IB_M27_EXAMS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("registered")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    filterMode === "registered"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                  }`}
                >
                  <Sparkles size={13} />
                  <span>Kayıtlı Sınavlarım ({registeredPapersList.length})</span>
                </button>
              </div>

              {/* Session Filter */}
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setSessionFilter("all")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    sessionFilter === "all"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Tümü
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilter("morning")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    sessionFilter === "morning"
                      ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Sun size={13} />
                  <span>Sabah</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSessionFilter("afternoon")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    sessionFilter === "afternoon"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <Sunset size={13} />
                  <span>Öğleden Sonra</span>
                </button>
              </div>

              {/* Search Input */}
              <div className="relative min-w-[200px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ders veya Paper ara..."
                  aria-label="Sınav takviminde ders ara"
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Aramayı temizle"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Expandable Course Role Customizer */}
          {isRoleEditorOpen && (
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Aldığınız IB derslerini seçin; seçtiğiniz derslerin sınavları ajandada{" "}
                  <span className="font-extrabold text-amber-600 dark:text-amber-400">
                    &ldquo;★ Kayıtlı Sınavınız&rdquo;
                  </span>{" "}
                  olarak parlar:
                </p>
                {onNavigateCalculator && (
                  <button
                    type="button"
                    onClick={onNavigateCalculator}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    KapsCulator IB Puan Hesaplayıcı →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {COURSE_ROLES.map((cr) => {
                  const selected = activeRoles.includes(cr.id);
                  return (
                    <button
                      key={cr.id}
                      type="button"
                      onClick={() => handleToggleRole(cr.id)}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                        selected
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cr.color }}
                        />
                        <span className="truncate">{cr.label}</span>
                      </span>
                      {selected && <CheckCircle2 size={14} className="shrink-0 text-emerald-400 dark:text-emerald-600" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legend Row */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/70 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                <span className="w-3 h-3 rounded-sm bg-amber-500/20 border-2 border-amber-500 inline-block" />
                <span>★ Kayıtlı Sınavınız (Rolünüze Ait Sınav)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sun size={13} className="text-amber-500" />
                <span>Sabah Oturumu (09:00)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sunset size={13} className="text-indigo-500" />
                <span>Öğleden Sonra Oturumu (13:00)</span>
              </span>
            </div>
            <div className="font-mono text-[11px] tabular-nums">
              Gösterilen Dönem: <strong>15 Nisan 2027 – 19 Mayıs 2027</strong> (Tam Açık Ajanda)
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 3. PART 1: APRIL 2027 SECOND HALF (15 NİSAN – 30 NİSAN 2027)       */}
        {/* ================================================================= */}
        <CalendarHalfMonthSection
          title="Nisan 2027 — İkinci Yarı (15 – 30 Nisan 2027)"
          subtitle="Sınav Öncesi Son Hazırlık Haftası & IB M27 1. Hafta Sınavları (23 Nisan Cuma Başlangıç)"
          badgeText="NİSAN 2. YARI · 15–30 NİSAN"
          accentColor="blue"
          days={aprilSecondHalf}
          activeRoles={activeRoles}
          onSelectExam={setSelectedExamModal}
        />

        {/* ================================================================= */}
        {/* 4. PART 2: MAY 2027 FIRST HALF (1 MAYIS – 19 MAYIS 2027)           */}
        {/* ================================================================= */}
        <CalendarHalfMonthSection
          title="Mayıs 2027 — İlk Yarı / Sınav Dönemi (1 – 19 Mayıs 2027)"
          subtitle="IB M27 2., 3. ve 4. Hafta Resmi Yazılı Sınavları (18 Mayıs Salı Kapanış)"
          badgeText="MAYIS 1. YARI · 1–19 MAYIS"
          accentColor="indigo"
          days={mayFirstHalf}
          activeRoles={activeRoles}
          onSelectExam={setSelectedExamModal}
        />

        {/* ================================================================= */}
        {/* 5. PERSONALIZED REGISTERED EXAMS SUMMARY TABLE                    */}
        {/* ================================================================= */}
        <section
          aria-label="Kayıtlı Sınavlarınız Özet Listesi"
          className="rounded-2xl border border-amber-300/80 dark:border-amber-800/70 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
        >
          <div className="px-5 py-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Flame size={18} />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Sizin Kayıtlı Sınav Takviminiz</span>
                  <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 tabular-nums">
                    {registeredPapersList.length} Oturum
                  </span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Rollerinize ({activeRoleObjects.map((r) => r.label).join(", ")}) göre gireceğiniz resmi IB M27 sınav kağıtlarının kronolojik listesi
                </p>
              </div>
            </div>
          </div>

          {registeredPapersList.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Henüz kayıtlı bir IB ders rolünüz seçili değil.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Yukarıdaki &ldquo;Ders Rollerimi Düzenle&rdquo; butonuna tıklayarak derslerinizi seçebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/50">
                    <th className="py-3 px-4">Resmi Tarih</th>
                    <th className="py-3 px-4">Oturum &amp; Saat</th>
                    <th className="py-3 px-4">Ders &amp; Seviye</th>
                    <th className="py-3 px-4">Sınav Kağıdı (Paper)</th>
                    <th className="py-3 px-4">Süre</th>
                    <th className="py-3 px-4 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs sm:text-sm">
                  {registeredPapersList.map((exam) => (
                    <tr
                      key={exam.id}
                      onClick={() => setSelectedExamModal(exam)}
                      className="hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap tabular-nums">
                        {exam.dateLabelTr}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${
                            exam.session === "morning"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-indigo-600 dark:text-indigo-400"
                          }`}
                        >
                          {exam.session === "morning" ? <Sun size={14} /> : <Sunset size={14} />}
                          <span>{exam.sessionLabelTr}</span>
                          <span className="font-mono text-xs opacity-80 tabular-nums">
                            ({exam.startTime})
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: exam.color }}
                          />
                          <span>{exam.subjectTitleTr}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {exam.paper}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">
                        {exam.duration}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-extrabold">
                          <Sparkles size={12} />
                          <span>Kayıtlı Sınavınız</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ================================================================= */}
      {/* EXAM PAPER DETAIL MODAL                                           */}
      {/* ================================================================= */}
      {selectedExamModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
          onClick={() => setSelectedExamModal(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Sınav Oturumu Detayı"
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="h-2 w-full"
              style={{ backgroundColor: selectedExamModal.color }}
            />
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  {isExamRegisteredForUser(selectedExamModal, activeRoles) && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-xs font-extrabold">
                      <Sparkles size={13} />
                      <span>★ Kayıtlı Sınavınız</span>
                    </div>
                  )}
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {selectedExamModal.subjectTitleTr}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {selectedExamModal.subjectTitleEn} · {selectedExamModal.paper}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedExamModal(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Kapat"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">
                    Resmi Sınav Tarihi
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {selectedExamModal.dateLabelTr}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">
                    Oturum &amp; Başlangıç
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {selectedExamModal.sessionLabelTr} ({selectedExamModal.startTime})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">
                    Sınav Kağıdı &amp; Seviye
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {selectedExamModal.paper} ({selectedExamModal.level})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">
                    Resmi Sınav Süresi
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                    {selectedExamModal.duration}
                  </div>
                </div>
              </div>

              {selectedExamModal.notesTr && (
                <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/50 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                  <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>{selectedExamModal.notesTr}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedExamModal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold cursor-pointer"
                >
                  Tamam
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CountdownUnit({
  value,
  label,
  accent,
}: {
  value: number;
  label: string;
  accent: "blue" | "amber";
}) {
  const formatted = String(Math.max(0, value)).padStart(2, "0");
  return (
    <div
      className={`rounded-lg border p-2 text-center ${
        accent === "amber"
          ? "bg-white dark:bg-slate-900 border-amber-300/80 dark:border-amber-800/70"
          : "bg-white dark:bg-slate-900 border-blue-200/80 dark:border-blue-900/70"
      }`}
    >
      <div
        className={`font-mono text-xl sm:text-2xl font-black tracking-tight tabular-nums ${
          accent === "amber"
            ? "text-amber-600 dark:text-amber-400"
            : "text-blue-600 dark:text-blue-400"
        }`}
      >
        {formatted}
      </div>
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">
        {label}
      </div>
    </div>
  );
}

function CalendarHalfMonthSection({
  title,
  subtitle,
  badgeText,
  accentColor,
  days,
  activeRoles,
  onSelectExam,
}: {
  title: string;
  subtitle: string;
  badgeText: string;
  accentColor: "blue" | "indigo";
  days: CalendarWindowDay[];
  activeRoles: string[];
  onSelectExam: (exam: IbM27ExamPaper) => void;
}) {
  // Leading empty weekday cells so the first day aligns with its exact Monday-Sunday column
  const firstDayOffset = days.length > 0 ? days[0].dayOfWeekIndex : 0;
  const leadingPlaceholders = Array.from({ length: firstDayOffset }, (_, i) => i);

  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
    >
      {/* Section Header */}
      <div
        className={`px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
          accentColor === "blue"
            ? "bg-blue-50/40 dark:bg-blue-950/20"
            : "bg-indigo-50/40 dark:bg-indigo-950/20"
        }`}
      >
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Calendar
              size={18}
              className={
                accentColor === "blue"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-indigo-600 dark:text-indigo-400"
              }
            />
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <span
          className={`self-start sm:self-auto font-mono text-xs font-extrabold px-3 py-1 rounded-lg border tabular-nums ${
            accentColor === "blue"
              ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
              : "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
          }`}
        >
          {badgeText}
        </span>
      </div>

      {/* Desktop 7-Column Weekday Header */}
      <div className="hidden lg:grid lg:grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
        {WEEKDAY_HEADERS.map((wh) => (
          <div
            key={wh.short}
            className="px-3 py-2.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-r last:border-r-0 border-slate-200/70 dark:border-slate-800/70"
          >
            {wh.full}
          </div>
        ))}
      </div>

      {/* Uncompressed Full Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 divide-y lg:divide-y-0 gap-px bg-slate-200 dark:bg-slate-800">
        {/* Leading alignment cells on desktop (strictly inside the half-month grid, no outside dates shown) */}
        {leadingPlaceholders.map((idx) => (
          <div
            key={`pad-${idx}`}
            aria-hidden="true"
            className="hidden lg:block bg-slate-50/70 dark:bg-slate-950/40 min-h-[88px]"
          />
        ))}

        {days.map((day) => {
          const hasExams = day.exams.length > 0;
          const hasRegisteredExam = day.exams.some((ex) =>
            isExamRegisteredForUser(ex, activeRoles)
          );
          const morningExams = day.exams.filter((e) => e.session === "morning");
          const afternoonExams = day.exams.filter((e) => e.session === "afternoon");

          return (
            <div
              key={day.date}
              data-testid={`calendar-day-${day.date}`}
              className={`flex flex-col ${hasExams ? "min-h-[165px]" : "min-h-[88px]"} p-2.5 sm:p-3 transition-colors ${
                hasRegisteredExam
                  ? "bg-amber-50/40 dark:bg-amber-950/20 ring-2 ring-inset ring-amber-400 dark:ring-amber-500/80"
                  : day.isWeekend
                  ? "bg-slate-50/90 dark:bg-slate-950/50"
                  : "bg-white dark:bg-slate-900"
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-mono text-base font-black tabular-nums ${
                      hasRegisteredExam
                        ? "text-amber-600 dark:text-amber-400"
                        : hasExams
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {day.dayOfMonth}{" "}
                    <span className="text-xs font-bold">
                      {day.month === 4 ? "Nis" : "May"}
                    </span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {day.dayNameTr}
                  </span>
                </div>

                {hasRegisteredExam ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-extrabold tracking-tight shadow-2xs">
                    <Sparkles size={10} />
                    <span>Sınavınız Var</span>
                  </span>
                ) : hasExams ? (
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
                    {day.exams.length} Oturum
                  </span>
                ) : null}
              </div>

              {/* Official Holiday Banner if applicable */}
              {day.isOfficialHoliday && day.holidayLabelTr && (
                <div className="mb-2 px-2 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-[11px] font-bold text-rose-600 dark:text-rose-400 leading-snug">
                  {day.holidayLabelTr}
                </div>
              )}

              {/* Day Content: Full Uncompressed Exam List */}
              {hasExams ? (
                <div className="space-y-2.5 flex-1">
                  {morningExams.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        <Sun size={11} />
                        <span>Sabah (09:00)</span>
                      </div>
                      {morningExams.map((exam) => (
                        <ExamPaperCard
                          key={exam.id}
                          exam={exam}
                          activeRoles={activeRoles}
                          onClick={() => onSelectExam(exam)}
                        />
                      ))}
                    </div>
                  )}

                  {afternoonExams.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        <Sunset size={11} />
                        <span>Öğleden Sonra (13:00)</span>
                      </div>
                      {afternoonExams.map((exam) => (
                        <ExamPaperCard
                          key={exam.id}
                          exam={exam}
                          activeRoles={activeRoles}
                          onClick={() => onSelectExam(exam)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-center py-4">
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-600">
                    {day.isWeekend
                      ? "Hafta Sonu (Sınav Yok)"
                      : day.month === 4 && day.dayOfMonth < 23
                      ? "Sınav Öncesi Hazırlık Günü"
                      : day.month === 5 && day.dayOfMonth === 1
                      ? "Resmi IB Tatili (Sınav Yok)"
                      : "Sınav Oturumu Yok"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ExamPaperCard({
  exam,
  activeRoles,
  onClick,
}: {
  exam: IbM27ExamPaper;
  activeRoles: string[];
  onClick: () => void;
}) {
  const isRegistered = isExamRegisteredForUser(exam, activeRoles);
  const matchedRoles = getMatchedRolesForExam(exam, activeRoles);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl p-2.5 border transition-all cursor-pointer group ${
        isRegistered
          ? "bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent dark:from-amber-500/25 dark:via-amber-500/10 border-amber-500 dark:border-amber-400 shadow-sm ring-1 ring-amber-400/50"
          : "bg-slate-50/90 dark:bg-slate-800/70 border-slate-200/90 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
      }`}
    >
      {/* Prominent "Kayıtlı Sınavınız" Highlight Badge */}
      {isRegistered && (
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-black tracking-tight shadow-2xs">
            <Sparkles size={10} />
            <span>Kayıtlı Sınavınız</span>
          </span>
          <span className="font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300 tabular-nums">
            {exam.duration}
          </span>
        </div>
      )}

      <div className="flex items-start gap-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: exam.color }}
        />
        <div className="min-w-0 flex-1">
          <div
            className={`text-xs font-extrabold leading-snug ${
              isRegistered
                ? "text-slate-950 dark:text-white"
                : "text-slate-800 dark:text-slate-200"
            }`}
          >
            {exam.subjectTitleTr}
          </div>
          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5 leading-tight">
            {exam.paper}
          </div>
          {!isRegistered && (
            <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
              <span>{exam.level}</span>
              <span>{exam.duration}</span>
            </div>
          )}
          {isRegistered && matchedRoles.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {matchedRoles.map((mr) => (
                <span
                  key={mr.id}
                  className="text-[10px] font-bold px-1.5 py-0.2 rounded"
                  style={{
                    backgroundColor: `${mr.color}22`,
                    color: mr.color,
                  }}
                >
                  {mr.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
