import React, { useMemo } from "react";
import { Clock, Star, Sparkles, MapPin, AlertCircle, Info, Layers } from "lucide-react";
import { 
  MockExam, 
  CancelledClassInfo, 
  getUserExamTiming, 
  UserExamTiming 
} from "../utils/mockExamData";
import { PeriodTimeStatus } from "../utils/scheduleData";

export interface MockExamCardProps {
  exam: MockExam;
  cancelledClasses?: CancelledClassInfo[];
  currentUserRoles?: string[];
  courseLevels?: Record<string, "SL" | "HL">;
  isEnrolled?: boolean;
  isCurrent?: boolean;
  statusInfo?: PeriodTimeStatus;
  variant?: "timeline" | "calendar" | "compact" | "modal";
  className?: string;
  onClick?: () => void;
}

export default function MockExamCard({
  exam,
  cancelledClasses = [],
  currentUserRoles = [],
  courseLevels,
  isEnrolled,
  isCurrent = false,
  statusInfo,
  variant = "timeline",
  className = "",
  onClick
}: MockExamCardProps) {
  // Compute dynamic user timing (SL vs HL finish times & extensions)
  const timing: UserExamTiming = useMemo(() => {
    return getUserExamTiming(exam, currentUserRoles, courseLevels);
  }, [exam, currentUserRoles, courseLevels]);

  const isUserExam = isEnrolled !== undefined ? isEnrolled : Boolean(timing.userLevel);
  const remainingMinutes = statusInfo?.remainingMinutes ?? 0;
  const progressPercent = statusInfo?.progressPercent ?? 0;

  // Format cancelled lessons for clean chip rendering
  const cancelledLessons = useMemo(() => {
    return cancelledClasses.map((cc, idx) => ({
      id: `${cc.originalSubjectKey}_${idx}`,
      name: cc.name,
      room: cc.roomOrNote || "302",
      startTime: cc.startTime,
      endTime: cc.endTime
    }));
  }, [cancelledClasses]);

  return (
    <div
      onClick={onClick}
      className={`w-full min-w-0 h-auto flex flex-col justify-between rounded-2xl p-4 transition-all duration-200 ${
        isCurrent
          ? "border-emerald-500 ring-2 ring-emerald-500/80 shadow-lg shadow-emerald-500/20 bg-emerald-500/10 dark:bg-emerald-500/15"
          : isUserExam
          ? "border-amber-400 ring-2 ring-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.25)] bg-amber-400/10 dark:bg-amber-400/10 text-slate-900 dark:text-amber-100"
          : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300"
      } ${onClick ? "cursor-pointer hover:shadow-md" : ""} ${className}`}
    >
      {/* 1. ÜST BAŞLIK VE ROZETLER SATIRI */}
      <div className="flex items-start justify-between gap-2.5 mb-2.5 min-w-0 w-full">
        {/* Sol Taraf: İkon, Başlık ve Alt Bilgi */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="text-xl shrink-0 mt-0.5" role="img" aria-label="exam">
            📝
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 
                className={`text-xs sm:text-sm font-black leading-tight truncate ${
                  isUserExam 
                    ? "text-slate-900 dark:text-white" 
                    : "text-slate-800 dark:text-slate-200"
                }`}
                title={exam.title}
              >
                {exam.title}
              </h4>

              {/* HL / SL Rozeti */}
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 border ${
                timing.userLevel === "HL"
                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30"
                  : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
              }`}>
                {timing.displayBadgeText}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {exam.subject} {exam.paper ? `• ${exam.paper}` : ""}
            </p>
          </div>
        </div>

        {/* Sağ Taraf: Durum Rozeti ve Saat */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          {isCurrent ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black animate-pulse shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              SINAV DEVAM EDİYOR
            </span>
          ) : isUserExam ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black shadow-xs">
              ✍️ Gireceğin Sınav
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
              Diğer Grup Sınavı
            </span>
          )}

          {/* Dinamik Kullanıcı Sınav Saati */}
          <span className="font-mono text-xs font-black text-amber-700 dark:text-amber-300">
            {timing.userStartTime} - {timing.userEndTime}
          </span>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 -mt-0.5">
            ({timing.userDurationMinutes} dk)
          </span>
        </div>
      </div>

      {/* 2. SALON BİLGİSİ VE BİLGİLENDİRME ÇİPLERİ */}
      <div className="flex flex-wrap items-center gap-2 mb-2 w-full min-w-0">
        <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-black/5 dark:bg-black/25 px-2.5 py-1 rounded-xl">
          <MapPin size={12} className="text-amber-500 shrink-0" />
          <span className="truncate">Salon: {exam.room}</span>
        </div>

        {/* SL Öğrencisi İçin HL Devam Ediyor Notu (Kafa Karıştırmayan Zarif Rozet) */}
        {timing.hasDifferentHlExtension && (
          <div 
            className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-800 dark:text-sky-300 bg-sky-500/10 dark:bg-sky-500/20 border border-sky-500/30 px-2 py-1 rounded-xl truncate"
            title={`Senin sınavın ${timing.userEndTime}'de biter. HL öğrencileri ${timing.hlEndTime}'ye kadar devam eder.`}
          >
            <Info size={12} className="shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="truncate">HL devam ediyor: {timing.hlEndTime}'ye kadar</span>
          </div>
        )}
      </div>

      {/* 3. CANLI SINAV İLERLEME ÇUBUĞU (EĞER ŞU AN YAPILIYORSA) */}
      {isCurrent && (
        <div className="mb-2 pt-1 border-t border-emerald-500/20 w-full min-w-0">
          <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
            <span>Sınavın bitmesine {remainingMinutes} dakika</span>
            <span>%{progressPercent}</span>
          </div>
          <div className="w-full bg-emerald-200 dark:bg-emerald-950/60 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 4. TAŞMAYAN VE KOMPAKT İPTAL EDİLEN DERSLER ÇİP ALANI (BÖLÜM 2) */}
      {cancelledLessons.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-white/10 flex flex-wrap items-center gap-1.5 w-full min-w-0 overflow-hidden">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            Yerine:
          </span>
          {cancelledLessons.map((lesson) => (
            <div 
              key={lesson.id} 
              className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 line-through truncate min-w-0 shadow-2xs"
              title={`${lesson.name} (${lesson.room}) • ${lesson.startTime} - ${lesson.endTime}`}
            >
              <span className="truncate max-w-[160px] sm:max-w-[220px]">
                {lesson.name}
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-400 no-underline shrink-0">
                ({lesson.room})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
