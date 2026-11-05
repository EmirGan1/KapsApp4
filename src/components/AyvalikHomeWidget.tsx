import React, { useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { 
  Compass, CalendarDays, MapPin, ArrowRight, Sparkles, Clock, ChevronRight
} from "lucide-react";

export interface AyvalikHomeWidgetProps {
  socket?: Socket | null;
  currentUserId?: number;
  currentUsername?: string;
  avatar?: string | null;
  color?: string;
  onOpenFullPanel: () => void;
}

export default function AyvalikHomeWidget(props: AyvalikHomeWidgetProps) {
  const { onOpenFullPanel } = props;

  // Geri sayım: 25 Kasım 2026, 06:00
  const tripDate = useMemo(() => new Date("2026-11-25T06:00:00+03:00"), []);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
  });

  useEffect(() => {
    const calc = () => {
      const now = new Date();
      const diff = tripDate.getTime() - now.getTime();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        setCountdown({ days, hours, minutes });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0 });
      }
    };
    calc();
    const interval = setInterval(calc, 60000);
    return () => clearInterval(interval);
  }, [tripDate]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Ayvalık CAS Projesi Paneline Git"
      onClick={onOpenFullPanel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenFullPanel();
        }
      }}
      className="group relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-5 sm:p-6 text-white shadow-lg hover:shadow-xl transition-all cursor-pointer border border-emerald-500/30 hover:scale-[1.008] active:scale-[0.995]"
    >
      {/* Dekoratif Arka Plan Işıkları */}
      <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute left-1/3 -bottom-10 w-40 h-40 bg-teal-400/20 rounded-full blur-xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Sol Bilgi Alanı */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider text-white">
              <Compass size={14} className="animate-spin" /> AYVALIK CAS PROJESİ
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black tracking-wide">
              25 - 27 KASIM 2026
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-950/40 text-emerald-100 text-xs font-semibold">
              2 Gece • 3 Gün
            </span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Ayvalık CAS Projesi 2026 🎒🌿
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed mt-1">
              Kardeş Okul Toplum Hizmeti, Küçükköy Yaratıcı Teknolojiler, Şeytan Sofrası ve Kürşat Zeytin Hasadı 3 günlük gezi ajandası, oda seçimi, anlık gezi sohbeti ve rehber paneli.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-emerald-200">
            <span className="flex items-center gap-1 font-semibold">
              <MapPin size={13} className="text-amber-300" />
              Ayvalık, Balıkesir
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-semibold">
              <CalendarDays size={13} className="text-emerald-300" />
              Kardeş Okul & Cunda & Hasat
            </span>
          </div>
        </div>

        {/* Sağ Sayaç & Yönlendirme Butonu */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-white/15">
          <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-4 py-2 text-center">
            <div className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider flex items-center justify-center gap-1">
              <Clock size={11} />
              <span>Kalan Süre</span>
            </div>
            <div className="text-base sm:text-lg font-black font-mono tracking-tight text-white mt-0.5">
              {countdown.days > 0 ? (
                <span>{countdown.days}g {countdown.hours}s {countdown.minutes}d</span>
              ) : (
                <span className="text-amber-300">Gezi Aktif! 🎉</span>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs sm:text-sm shadow-md transition-all group-hover:scale-105 active:scale-95">
            <span>Gezi Paneline Git</span>
            <ChevronRight size={16} className="text-emerald-700 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
