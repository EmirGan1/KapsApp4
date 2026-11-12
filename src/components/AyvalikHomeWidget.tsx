import React, { useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { 
  Compass, CalendarDays, MapPin, Clock, ChevronRight
} from "lucide-react";
import { DEFAULT_PACKING_ITEMS } from "../utils/ayvalikPacking";
import { usePackingList } from "./ayvalik/usePackingList";
import { getApiUrl, getAuthHeaders } from "../utils/api";

export interface AyvalikHomeWidgetProps {
  socket?: Socket | null;
  currentUserId?: number;
  currentUsername?: string;
  avatar?: string | null;
  color?: string;
  onOpenFullPanel: () => void;
}

export default function AyvalikHomeWidget(props: AyvalikHomeWidgetProps) {
  const { onOpenFullPanel, currentUserId = 1 } = props;

  // Geri sayım: 25 Kasım 2026, 06:00
  const tripDate = useMemo(() => new Date("2026-11-25T06:00:00+03:00"), []);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
  });

  const [activeMiniSection, setActiveMiniSection] = useState<'none' | 'checklist' | 'chat' | 'gallery'>('none');
  const { checked, toggle, loading, status } = usePackingList(currentUserId, DEFAULT_PACKING_ITEMS.map(i => i.id));
  const [chatInput, setChatInput] = useState('');
  const [miniMessages, setMiniMessages] = useState<{ id: number; content: string }[]>([]);
  const [miniGallery, setMiniGallery] = useState<{ id: number; media_url: string; caption?: string }[]>([]);

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
      onClick={(e) => {
        if (e.target !== e.currentTarget && (e.target as HTMLElement).closest('button, input, [role="checkbox"], form')) return;
        onOpenFullPanel();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenFullPanel();
        }
      }}
      className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-7 text-slate-900 dark:text-white shadow-xs hover:border-emerald-500/50 transition-all cursor-pointer border border-slate-200/90 dark:border-slate-800 border-l-4 border-l-emerald-500"
    >
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Sol Bilgi Alanı */}
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold tracking-wide text-emerald-600 dark:text-emerald-400">
            <span className="inline-flex items-center gap-1.5 uppercase">
              <Compass size={14} className="text-emerald-500" />
              <span>AYVALIK CAS PROJESİ</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="font-mono text-amber-600 dark:text-amber-400">25 - 27 KASIM 2026</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">2 Gece • 3 Gün</span>
          </div>

          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Ayvalık CAS Projesi 2026
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
              Kardeş Okul Toplum Hizmeti, Küçükköy Yaratıcı Teknolojiler, Şeytan Sofrası ve Kürşat Zeytin Hasadı 3 günlük gezi ajandası, oda seçimi, anlık gezi sohbeti ve rehber paneli.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin size={13} className="text-emerald-500" />
              Ayvalık, Balıkesir
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5 font-medium">
              <CalendarDays size={13} className="text-emerald-500" />
              Kardeş Okul & Cunda & Hasat
            </span>
          </div>
        </div>

        {/* Sağ Sayaç & Yönlendirme Butonu */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl px-4 py-2 text-center">
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider flex items-center justify-center gap-1">
              <Clock size={11} className="text-emerald-500" />
              <span>Kalan Süre</span>
            </div>
            <div className="text-base sm:text-lg font-extrabold font-mono tracking-tight text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {countdown.days > 0 ? (
                <span>{countdown.days}g {countdown.hours}s {countdown.minutes}d</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">Gezi Aktif</span>
              )}
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all">
            <span>Gezi Paneline Git</span>
            <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>

      {/* Mini Hızlı Erişim Butonları */}
      <div className="relative z-10 flex flex-wrap gap-2 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setActiveMiniSection(prev => prev === 'checklist' ? 'none' : 'checklist')}
          className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all border ${
            activeMiniSection === 'checklist'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80'
          }`}
        >
          🎒 Çanta Kontrol Listesi
        </button>
        <button
          type="button"
          onClick={() => setActiveMiniSection(prev => prev === 'chat' ? 'none' : 'chat')}
          className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all border ${
            activeMiniSection === 'chat'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80'
          }`}
        >
          💬 Gezi Canlı Sohbeti
        </button>
        <button
          type="button"
          onClick={() => setActiveMiniSection(prev => prev === 'gallery' ? 'none' : 'gallery')}
          className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all border ${
            activeMiniSection === 'gallery'
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/80'
          }`}
        >
          📷 Gezi Medya Galerisi
        </button>
      </div>

      {/* Mini Bölüm İçerikleri */}
      {activeMiniSection === 'checklist' && (
        <div className="relative z-10 mt-3 p-4 rounded-2xl bg-black/40 border border-white/20 space-y-2 max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center text-xs font-bold text-emerald-200">
            <span>Hızlı Çanta Kontrolü ({checked.length}/{DEFAULT_PACKING_ITEMS.length})</span>
          </div>
          <p role="status" className="text-xs text-emerald-300">{loading ? 'Liste yükleniyor…' : status || 'Seçimlerin hesabına kaydedilir.'}</p>
          <div className="space-y-1">
            {DEFAULT_PACKING_ITEMS.map(item => {
              const isChecked = checked.includes(item.id);
              return (
                <div
                  key={item.id}
                  role="checkbox"
                  tabIndex={0}
                  aria-checked={isChecked}
                  aria-disabled={loading}
                  aria-label={item.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(item.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(item.id);
                    }
                  }}
                  className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 text-left text-xs cursor-pointer select-none"
                >
                  <span className="text-emerald-300 font-bold">{isChecked ? "☑" : "☐"}</span>
                  <span className={isChecked ? "line-through text-white/50" : "text-white"}>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeMiniSection === 'chat' && (
        <div className="relative z-10 mt-3 p-4 rounded-2xl bg-black/40 border border-white/20 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {miniMessages.map((m) => (
              <div key={m.id} className="text-xs text-white p-1 rounded bg-white/10">
                {m.content}
              </div>
            ))}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!chatInput.trim()) return;
              const content = chatInput.trim();
              setChatInput('');
              try {
                const res = await fetch(getApiUrl('/api/ayvalik/messages'), {
                  method: 'POST',
                  headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify({ content })
                });
                const data = await res.json();
                if (data?.message) {
                  setMiniMessages(prev => [...prev, data.message]);
                }
              } catch {}
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              placeholder="Gezi grubuna mesaj yaz..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/60 text-xs focus:outline-none"
            />
            <button type="submit" className="px-3 py-1.5 rounded-xl bg-white text-emerald-950 font-bold text-xs cursor-pointer">
              Gönder
            </button>
          </form>
        </div>
      )}

      {activeMiniSection === 'gallery' && (
        <div className="relative z-10 mt-3 p-4 rounded-2xl bg-black/40 border border-white/20 space-y-3" onClick={(e) => e.stopPropagation()}>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const formData = new FormData();
              formData.append('file', file);
              try {
                const upRes = await fetch(getApiUrl('/api/upload'), {
                  method: 'POST',
                  headers: getAuthHeaders(),
                  body: formData
                });
                const upData = await upRes.json();
                if (upData?.url) {
                  const caption = file.name.replace(/\.[^/.]+$/, '');
                  const galRes = await fetch(getApiUrl('/api/ayvalik/gallery'), {
                    method: 'POST',
                    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                    body: JSON.stringify({
                      media_url: upData.url,
                      media_type: file.type.startsWith('video') ? 'video' : 'image',
                      caption,
                      day_tag: '1. Gün - Saha Çalışması & Cunda'
                    })
                  });
                  const galData = await galRes.json();
                  if (galData?.item) {
                    setMiniGallery(prev => [galData.item, ...prev]);
                  }
                }
              } catch {}
            }}
            className="text-xs text-white"
          />
          <div className="flex gap-2 flex-wrap">
            {miniGallery.map((g) => (
              <img
                key={g.id}
                src={g.media_url}
                alt={g.caption || 'mini-upload'}
                className="w-16 h-16 object-cover rounded-xl border border-white/20"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
