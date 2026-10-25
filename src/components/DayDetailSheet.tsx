import React from "react";
import { X, Clock, MapPin, Sparkles, BookOpen, Coffee, AlertCircle, ArrowRight } from "lucide-react";
import { ScheduleEntry, CancelledClassInfo, MockExam } from "../utils/mockExamData";
import { ScheduleGapItem, isScheduleGap } from "../utils/scheduleGapDetector";

export interface DayDetailSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  items: Array<ScheduleEntry | ScheduleGapItem>;
  currentUserRoles?: string[];
  onSelectExam?: (exam: MockExam, cancelledClasses?: CancelledClassInfo[]) => void;
  onOpenScheduleModal?: () => void;
}

export const formatSelectedDateTitle = (dateStr: string | null): string => {
  if (!dateStr) return "Seçilen Gün";
  try {
    return new Date(dateStr).toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  } catch {
    return dateStr;
  }
};

export default function DayDetailSheet({
  isOpen,
  onClose,
  selectedDate,
  items = [],
  currentUserRoles = [],
  onSelectExam,
  onOpenScheduleModal
}: DayDetailSheetProps) {
  if (!isOpen && !selectedDate) return null;

  return (
    <div
      className={`mobile-window fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
        isOpen && selectedDate ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Karartma Katmanı (Backdrop) */}
      <div 
        onClick={onClose} 
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Alt Çekmece İçeriği */}
      <div 
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl p-4 flex flex-col shadow-2xl transition-transform duration-300 ${
          isOpen && selectedDate ? "translate-y-0" : "translate-y-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Çekmece Tutamacı (Drag Handle) & Kapat Butonu */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 relative">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-0" />
          <div className="pt-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {formatSelectedDateTitle(selectedDate)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {items.length} Etkinlik / Program
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full bg-slate-100 dark:bg-slate-800 transition-colors"
            aria-label="Kapat"
          >
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Kaydırılabilir Etkinlik Listesi */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 min-h-0 overscroll-y-contain">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Bu tarihte planlanmış ders veya sınav bulunmuyor.
            </div>
          ) : (
            items.map((item) => {
              // 1. Teneffüs / Mola (Gap) Kartı
              if (isScheduleGap(item)) {
                return (
                  <div 
                    key={item.id} 
                    className="w-full py-1.5 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700/80 bg-slate-100/60 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs shrink-0">☕</span>
                      <span className="font-medium text-xs truncate">
                        {item.title || "Teneffüs / Mola"}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({item.durationMinutes} dk)
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                      {item.startTime} - {item.endTime}
                    </span>
                  </div>
                );
              }

              const entry = item as ScheduleEntry;
              const isExam = Boolean(entry.isExamSlot && entry.overriddenByExam);

              // 2. Mock Sınav Kartı
              if (isExam && entry.overriddenByExam) {
                const exam = entry.overriddenByExam;
                return (
                  <div 
                    key={entry.id} 
                    onClick={() => {
                      if (onSelectExam) {
                        onSelectExam(exam, entry.cancelledClasses);
                      }
                    }}
                    className="w-full p-3 rounded-xl border bg-amber-500/5 dark:bg-amber-500/10 border-amber-400/40 dark:border-amber-400/30 flex flex-col gap-2 cursor-pointer active:scale-[0.99] transition-transform shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400 ring-2 ring-amber-400/30" />
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words line-clamp-2">
                          {exam.title}
                        </h4>
                      </div>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 shrink-0 font-bold">
                        {entry.startTime} - {entry.endTime}
                      </span>
                    </div>

                    {/* Detay Bilgileri: Derslik / Seviye / İptal Bilgisi */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-1.5 pt-1 border-t border-amber-200/50 dark:border-amber-700/30">
                      <span>📍 {exam.room || "Sınav Salonu"}</span>
                      <div className="flex items-center gap-1.5">
                        {exam.subject && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            {exam.subject}
                          </span>
                        )}
                        {entry.cancelledClasses && entry.cancelledClasses.length > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400">
                            {entry.cancelledClasses.length} İptal Ders
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // 3. Normal Ders Kartı
              return (
                <div 
                  key={entry.id} 
                  className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/70 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-2 h-2 rounded-full shrink-0 bg-sky-400" />
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-words line-clamp-2">
                        {entry.title}
                      </h4>
                    </div>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 shrink-0">
                      {entry.startTime} - {entry.endTime}
                    </span>
                  </div>

                  {/* Detay Bilgileri: Derslik / Seviye */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-700/40">
                    <span>📍 {entry.roomOrNote || "Derslik Belirtilmedi"}</span>
                    {entry.resolved?.level && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        {entry.resolved.level}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Alt Bilgi & Çizelge Butonu */}
        {onOpenScheduleModal && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Mock Sınav Çizelgesi
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenScheduleModal();
              }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Haftalık Çizelgeyi Aç</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
