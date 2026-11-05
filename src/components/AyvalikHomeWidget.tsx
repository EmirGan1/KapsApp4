import {usePackingList} from "./ayvalik/usePackingList";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Socket } from "socket.io-client";
import { 
  Compass, CalendarDays, CloudRain, Sun, Wind, Umbrella, 
  MessageSquare, Image, Send, CheckCircle2, Circle, Backpack, 
  MapPin, Clock, ArrowRight, ExternalLink, AlertTriangle, 
  Sparkles, Hotel, Heart, Download, Upload, Info, RefreshCw
} from "lucide-react";
import { AYVALIK_PROGRAM, AYVALIK_CLOTHING_GUIDE, DEFAULT_PACKING_ITEMS } from "./AyvalikCasPanel";
import { getApiUrl } from "../utils/api";
import Avatar from "./Avatar";

interface AyvalikHomeWidgetProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername: string;
  avatar: string | null;
  color?: string;
  onOpenFullPanel: () => void;
}

export default function AyvalikHomeWidget(props:AyvalikHomeWidgetProps){return <AyvalikWidgetContent key={props.currentUserId} {...props}/>;}

function AyvalikWidgetContent({
  socket,
  currentUserId,
  currentUsername,
  avatar,
  color,
  onOpenFullPanel
}: AyvalikHomeWidgetProps) {
  const [activeTab, setActiveTab] = useState<"weather" | "agenda" | "chat" | "gallery" | "packing">("weather");
  const [selectedDay, setSelectedDay] = useState<number>(1);

  // Countdown to 25 Kasım 2026 06:00
  const tripDate = useMemo(() => new Date("2026-11-25T06:00:00+03:00"), []);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number }>({ days: 0, hours: 0, minutes: 0 });

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

  // Mini Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Mini Gallery State
  const [galleryItems, setGalleryItems] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Mini Packing State
  const {checked:packedIds,toggle:togglePacked,loading:packingLoading,status:packingStatus}=usePackingList(currentUserId,DEFAULT_PACKING_ITEMS.map(i=>i.id));
  const packedItems=Object.fromEntries(packedIds.map(id=>[id,true]));
  const [notice,setNotice]=useState('');

  // Fetch initial mini chat and gallery
  useEffect(() => {
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    // Fetch messages
    fetch(getApiUrl("/api/ayvalik/messages"), { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.messages)) {
          setMessages(data.messages.slice(-5));
        }
      })
      .catch(() => {});

    // Fetch gallery
    fetch(getApiUrl("/api/ayvalik/gallery"), { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.items)) {
          setGalleryItems(data.items.slice(0, 6));
        }
      })
      .catch(() => {});
  }, []);

  // Socket.IO Listeners for real-time chat & gallery
  useEffect(() => {
    if (!socket) return;

    const handleNewMsg = (msg: any) => {
      setMessages(prev => [...prev.filter(m=>m.id!==msg.id).slice(-4), msg]);
      setTimeout(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      }, 50);
    };

    const handleNewItem = (item: any) => {
      setGalleryItems(prev => [item, ...prev.filter(m=>m.id!==item.id).slice(0, 5)]);
    };

    socket.on("ayvalik:new_message", handleNewMsg);
    socket.on("ayvalik:new_gallery_item", handleNewItem);

    return () => {
      socket.off("ayvalik:new_message", handleNewMsg);
      socket.off("ayvalik:new_gallery_item", handleNewItem);
    };
  }, [socket]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isSending) return;

    const token = localStorage.getItem("lan_token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    if (!token) return;

    setIsSending(true);
    try {
      const res = await fetch(getApiUrl("/api/ayvalik/messages"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ content: chatInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChatInput("");setMessages(prev=>[...prev.filter(m=>m.id!==data.message.id).slice(-4),data.message]);
      }else setNotice(data.error||"Mesaj gönderilemedi.");
    } catch (err) {
      setNotice("Mesaj gönderilemedi. Bağlantını kontrol et.");
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input=e.currentTarget,file=input.files?.[0];if(!file)return;
    const token=localStorage.getItem('lan_token')||localStorage.getItem('token')||localStorage.getItem('auth_token');if(!token)return;
    setIsUploading(true);try{
      const form=new FormData();form.append('file',file);
      const upload=await fetch(getApiUrl('/api/upload'),{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});const data=await upload.json();if(!upload.ok||!data.url)throw Error(data.error||'Dosya yüklenemedi.');
      const response=await fetch(getApiUrl('/api/ayvalik/gallery'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({media_url:data.url,media_type:file.type.startsWith('video/')?'video':'image',caption:file.name.replace(/\.[^/.]+$/,''),day_tag:['1. Gün - Saha Çalışması & Cunda','2. Gün - Küçükköy & Şeytan Sofrası','3. Gün - Zeytin Hasadı & Dönüş'][selectedDay-1],location_tag:'Ayvalık'})});const saved=await response.json();if(!response.ok||!saved.success)throw Error(saved.error||'Galeri kaydedilemedi.');setGalleryItems(prev=>[saved.item,...prev.filter(i=>i.id!==saved.item.id).slice(0,5)]);
    }catch(error){setNotice(error instanceof Error?error.message:'Yükleme tamamlanamadı.');}finally{setIsUploading(false);input.value='';}
  };

  const packingItems=DEFAULT_PACKING_ITEMS.map(i=>({...i,critical:i.required,sub:i.note}));

  const currentDayProgram = AYVALIK_PROGRAM.filter(p => p.day === selectedDay);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl transition-all">
      {notice&&<p role="alert" className="p-4 bg-amber-50 dark:bg-amber-950">{notice}</p>}
      {/* Üst Başlık Banner */}
      <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 p-5 sm:p-6 text-white overflow-hidden">
        {/* Dekoratif Arka Plan Işıkları */}
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 -bottom-10 w-40 h-40 bg-teal-400/20 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider text-white">
                <Compass size={14} className="animate-spin" /> AYVALIK CAS PROJESİ 2026
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black tracking-wide">
                25 - 27 KASIM 2026
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-100 text-xs font-semibold">
                2 Gece • 3 Gün
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Öğrenci Gezi & Rehber Portalı 🎒🌿
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
              Kardeş Okul Toplum Hizmeti, Küçükköy Yaratıcı Teknolojiler, Şeytan Sofrası ve Kürşat Zeytin Hasadı etkinlik programı, hava durumu uyarıları ve anlık gezi paylaşım alanı.
            </p>
          </div>

          {/* Geri Sayım & Tam Paneli Aç Butonu */}
          <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
            <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl px-4 py-2 text-center">
              <div className="text-[10px] uppercase font-bold text-emerald-200 tracking-wider">
                Geziye Kalan Süre
              </div>
              <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-white">
                {countdown.days > 0 ? (
                  <span>{countdown.days}g {countdown.hours}s {countdown.minutes}d</span>
                ) : (
                  <span className="text-amber-300">Gezi Aktif! 🎉</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenFullPanel}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold text-xs shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>Tüm Gezi Paneline Git</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>

        {/* Tab Navigasyon Şeridi */}
        <div className="mt-4 pt-3 border-t border-white/15 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("weather")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "weather"
                ? "bg-white text-emerald-900 shadow-sm"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <CloudRain size={14} />
            <span>25-27 Kasım Hava Durumu & Uyarılar</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("agenda")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "agenda"
                ? "bg-white text-emerald-900 shadow-sm"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <CalendarDays size={14} />
            <span>3 Günlük Gezi Ajandası</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "chat"
                ? "bg-white text-emerald-900 shadow-sm"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <MessageSquare size={14} />
            <span>Gezi Canlı Sohbeti</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gallery")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "gallery"
                ? "bg-white text-emerald-900 shadow-sm"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <Image size={14} />
            <span>Gezi Medya Galerisi</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("packing")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === "packing"
                ? "bg-white text-emerald-900 shadow-sm"
                : "bg-white/15 text-white hover:bg-white/25"
            }`}
          >
            <Backpack size={14} />
            <span>Çanta Kontrol Listesi</span>
          </button>
        </div>
      </div>

      {/* Tab İçerik Alanı */}
      <div className="p-5 sm:p-6 bg-slate-50/50 dark:bg-slate-900/50">
        
        {/* ======================================================== */}
        {/* TAB 1: 25-27 KASIM AYVALIK HAVA DURUMU & GÜNLÜK UYARILAR */}
        {/* ======================================================== */}
        {activeTab==='weather'&&<div className="space-y-4"><h3 className="text-xl font-black">Gezi için giyim hazırlığı</h3><p className="text-sm text-slate-500">Bu bir hazırlık rehberidir, canlı hava tahmini değildir.</p><a className="inline-block text-emerald-600 font-bold" href="https://www.mgm.gov.tr/?il=Balikesir&ilce=Ayvalik" target="_blank" rel="noopener noreferrer">MGM Ayvalık tahminini aç ↗</a><div className="grid md:grid-cols-3 gap-4">{AYVALIK_CLOTHING_GUIDE.map(day=><article key={day.dayNum} className="p-5 border rounded-2xl space-y-3"><h4 className="font-black">{day.emoji} {day.dayNum}. gün · {day.title}</h4><p className="text-sm text-slate-500">{day.text}</p><p className="text-sm">{day.essentials.join(' · ')}</p></article>)}</div></div>}

        {activeTab === "agenda" && (
          <div className="space-y-4">
            {/* Gün Seçicisi */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      selectedDay === d
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {d}. Gün ({d === 1 ? "25 Kasım" : d === 2 ? "26 Kasım" : "27 Kasım"})
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={onOpenFullPanel}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Tüm Programı Aç</span>
                <ExternalLink size={13} />
              </button>
            </div>

            {/* Seçili Günün Aktiviteleri Listesi */}
            <div className="space-y-2.5">
              {currentDayProgram.slice(0, 5).map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3 transition-all hover:border-emerald-500/40"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-lg flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {item.time}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                      {item.title}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={onOpenFullPanel}
                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Tüm saatleri ve aktiviteleri incelemek için tıklayınız →
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: GEZİ CANLI SOHBETİ (Socket.IO Senkron Mini Chat)   */}
        {/* ======================================================== */}
        {activeTab === "chat" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Ayvalık CAS Canlı Gezi Odası
              </span>
              <button
                type="button"
                onClick={onOpenFullPanel}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Geniş Sohbet Ekranı →
              </button>
            </div>

            {/* Mesaj Listesi */}
            <div
              ref={chatScrollRef}
              className="h-44 overflow-y-auto space-y-2 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                  <MessageSquare size={24} className="mb-1 text-slate-300 dark:text-slate-600" />
                  <span>Henüz gezi mesajı yazılmamış. İlk mesajı sen bırak!</span>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === currentUserId;
                  return (
                    <div
                      key={m.id}
                      className={`flex items-start gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}
                    >
                      <Avatar
                        url={m.avatar}
                        name={m.username}
                        color={m.color}
                        size={7}
                        className="w-7 h-7 shrink-0 text-[10px]"
                      />
                      <div className={`max-w-[80%] rounded-2xl p-2.5 text-xs ${
                        isMe
                          ? "bg-emerald-600 text-white rounded-tr-none"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none"
                      }`}>
                        {!isMe && (
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-0.5">
                            {m.username}
                          </div>
                        )}
                        <p className="leading-snug">{m.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Mesaj Gönderme Formu */}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                maxLength={4000} value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Gezi grubuna mesaj yaz..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isSending || !chatInput.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Send size={13} />
                <span>Gönder</span>
              </button>
            </form>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: GEZİ MEDYA GALERİSİ                               */}
        {/* ======================================================== */}
        {activeTab === "gallery" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Sadece Ayvalık Gezisi Fotoğraf ve Videoları
              </span>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                  <Upload size={12} />
                  <span>{isUploading ? "Yükleniyor..." : "Medya Yükle"}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleQuickUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={onOpenFullPanel}
                  className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Tüm Galeri →
                </button>
              </div>
            </div>

            {/* Galeri Küçük Önizleme Izgarası */}
            {galleryItems.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-slate-400 text-xs space-y-2">
                <Image size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                <div>Henüz galeriye medya yüklenmemiş. Gezi anlarını ilk sen paylaş!</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {galleryItems.map((item) => (
                  <div
                    key={item.id} role="button" aria-label="Galeriyi aç" tabIndex={0}
                    onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();onOpenFullPanel();}}}
                    onClick={onOpenFullPanel}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-xs"
                  >
                    {item.media_type === "video" ? (
                      <video
                        src={item.media_url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={item.media_url}
                        alt={item.caption || "Ayvalık Gezi Medyası"}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end text-white">
                      <div className="text-[10px] font-bold truncate">{item.username}</div>
                      <div className="text-[9px] text-slate-300 flex items-center gap-1">
                        <Heart size={10} className="text-rose-400 fill-rose-400" />
                        <span>{item.likes_count || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: ÇANTA KONTROL LİSTESİ                             */}
        {/* ======================================================== */}
        {activeTab==='packing'&&<p role="status" className="p-3 text-sm text-slate-500">{packingLoading?'Liste yükleniyor…':packingStatus}</p>}
        {activeTab === "packing" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Resmi Gezi Şartnamesine Göre Hazırlanmış Çanta Kontrol Listesi
              </span>
              <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {Object.values(packedItems).filter(Boolean).length} / {packingItems.length} Hazır
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {packingItems.map((item) => {
                const isChecked = !!packedItems[item.id];
                return (
                  <div
                    key={item.id} role="checkbox" aria-label={item.label} aria-checked={isChecked} aria-disabled={packingLoading} tabIndex={0}
                    onKeyDown={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();togglePacked(item.id);}}}
                    onClick={() => togglePacked(item.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isChecked
                        ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="mt-0.5 text-emerald-600 dark:text-emerald-400">
                      {isChecked ? <CheckCircle2 size={16} /> : <Circle size={16} className="text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isChecked ? "line-through text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                          {item.label}
                        </span>
                        {item.critical && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            Zorunlu
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                        {item.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
