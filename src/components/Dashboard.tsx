import React, { useState, useEffect, useMemo, useRef } from "react";
import { Socket } from "socket.io-client";
import { Link } from "react-router-dom";
import { 
  MessageSquare, Globe, Folder, MapPin, Gamepad2, 
  Radio, CalendarDays, CloudSun, Megaphone, LayoutGrid, Users,
  ArrowRight, Sparkles, Clock, CheckCircle2, BookOpen, Send,
  ChevronRight, Compass, ShieldAlert, Award, Flame, Play,
  Plus, ExternalLink, Zap, UtensilsCrossed
} from "lucide-react";
import Avatar from "./Avatar";
import RoleBadges from "./RoleBadges";
import ScheduleTimeline from "./ScheduleTimeline";
import OpenLobbiesWidget from "./OpenLobbiesWidget";
import CafeteriaMenuWidget from "./CafeteriaMenuWidget";
import CommunityMiniFeedWidget from "./CommunityMiniFeedWidget";
import MiniChatWidget from "./MiniChatWidget";
import { AnnouncementItem, isVisibleToUser } from "../types";
import { 
  getCachedWeather, 
  fetchWeatherForecast, 
  DEFAULT_ISTANBUL_LOCATION, 
  getWeatherMeta, 
  WeatherData,
  getSmartWeatherAdvice,
  getDetailed3DayAdvice
} from "../utils/weatherService";
import { getApiUrl } from "../utils/api";

export interface GlobalMiniMessage {
  id: number | string;
  sender_name?: string;
  username?: string;
  sender?: number | string;
  content: string;
  avatar?: string | null;
  color?: string;
  timestamp?: number | string;
  created_at?: string;
}

export interface UserActivityStatus {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  statusText: string;
  isOnline: boolean;
}

interface DashboardProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername: string;
  avatar: string | null;
  color?: string;
  currentUserRoles?: string[];
  onlineUsers: number[];
  onNavigate: (tab: any, path?: string) => void;
  onUserClick?: (id: number) => void;
  onStartChat?: (userId: number) => void;
  miniWeatherBadge?: { emoji: string; temp: number } | null;
  unreadDmCount?: number;
  unreadGlobalCount?: number;
  hasUnreadAnnouncement?: boolean;
  isEmirgan?: boolean;
  hasPredictedAccess?: boolean;
}

const FAVORITE_COURSES = [
  { id: "Mathematics", name: "Matematik (AA)", level: "HL/SL", color: "from-sky-500 to-blue-600", icon: "📐" },
  { id: "Physics", name: "Fizik", level: "HL/SL", color: "from-purple-500 to-indigo-600", icon: "⚛️" },
  { id: "Digital Society", name: "Digital Society", level: "SL", color: "from-cyan-500 to-teal-600", icon: "🌐" },
  { id: "Chemistry", name: "Kimya", level: "HL/SL", color: "from-emerald-500 to-teal-600", icon: "🧪" },
  { id: "Turkish", name: "Türk Dili ve Ed.", level: "SL/HL", color: "from-orange-500 to-amber-600", icon: "📖" },
  { id: "English", name: "English B", level: "HL", color: "from-blue-500 to-indigo-600", icon: "💬" }
];

export default function Dashboard({
  socket,
  currentUserId,
  currentUsername,
  avatar,
  color,
  currentUserRoles = [],
  onlineUsers = [],
  onNavigate,
  onUserClick,
  onStartChat,
  miniWeatherBadge,
  unreadDmCount = 0,
  unreadGlobalCount = 0,
  hasUnreadAnnouncement = false,
  isEmirgan = false,
  hasPredictedAccess = false,
}: DashboardProps) {
  // 1. Current Time & Greeting
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return "Günaydın";
    if (hour >= 12 && hour < 18) return "İyi günler";
    if (hour >= 18 && hour < 22) return "İyi akşamlar";
    return "İyi geceler";
  }, [currentTime]);

  const dateString = useMemo(() => {
    return currentTime.toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, [currentTime]);

  // Dynamic Daily Quote Managed via Emirgan Admin
  const [dailyQuote, setDailyQuote] = useState<{ quote_text: string; author?: string }>({
    quote_text: "Büyük hedeflere giden yol, bugünün küçük adımlarıyla başlar.",
    author: "Emirgan"
  });

  useEffect(() => {
    // 1. Initial fetch from public API
    fetch(getApiUrl("/api/public/daily-quote"))
      .then((res) => res.json())
      .then((data) => {
        if (data && data.quote_text) {
          setDailyQuote({
            quote_text: data.quote_text,
            author: data.author || "Emirgan"
          });
        }
      })
      .catch((err) => {
        console.error("Daily quote fetch error:", err);
      });

    // 2. Realtime sync via Socket.IO
    if (!socket) return;
    const handleQuoteUpdated = (newQuote: any) => {
      if (newQuote && newQuote.quote_text) {
        setDailyQuote({
          quote_text: newQuote.quote_text,
          author: newQuote.author || "Emirgan"
        });
      }
    };

    socket.on("quote_updated", handleQuoteUpdated);
    return () => {
      socket.off("quote_updated", handleQuoteUpdated);
    };
  }, [socket]);

  // 2. Weather Data State
  const [weatherData, setWeatherData] = useState<WeatherData | null>(() => getCachedWeather());
  useEffect(() => {
    fetchWeatherForecast(DEFAULT_ISTANBUL_LOCATION.latitude, DEFAULT_ISTANBUL_LOCATION.longitude, DEFAULT_ISTANBUL_LOCATION.name)
      .then((data) => setWeatherData(data))
      .catch(() => {});
  }, []);

  const weatherMeta = useMemo(() => {
    if (!weatherData?.current) return null;
    return getWeatherMeta(weatherData.current.weatherCode, weatherData.current.isDay);
  }, [weatherData]);

  const smartAdvice = useMemo(() => {
    return getSmartWeatherAdvice(weatherData);
  }, [weatherData]);

  // 3. Online Friends & Dynamic Status
  const [friends, setFriends] = useState<any[]>([]);
  useEffect(() => {
    if (!socket) return;
    socket.emit("get_friends", (res: any) => {
      if (Array.isArray(res)) {
        setFriends(res);
      }
    });
  }, [socket]);

  const friendsWithStatus: UserActivityStatus[] = useMemo(() => {
    const statuses = ["Ders çalışıyor", "KapsPool Bilardo 🎱", "Boşta ☕", "Ders Notlarını İnceliyor", "Çevrimiçi"];
    return friends.map((f, idx) => {
      const isOnline = onlineUsers.includes(f.id);
      const statusText = isOnline 
        ? statuses[(f.id + idx) % statuses.length]
        : "Çevrimdışı";
      return {
        id: f.id,
        username: f.username,
        avatar: f.avatar,
        color: f.color,
        statusText,
        isOnline
      };
    }).sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
  }, [friends, onlineUsers]);

  // 5. Daily Screen Time / Focus Tracker
  const [todayScreenSeconds, setTodayScreenSeconds] = useState<number>(() => {
    return Number(localStorage.getItem("kaps_focus_seconds")) || 3600;
  });

  useEffect(() => {
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
    if (!token) return;

    fetch(getApiUrl("/api/user/my-screen-time"), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.today_seconds === "number") {
          setTodayScreenSeconds(data.today_seconds);
          localStorage.setItem("kaps_focus_seconds", String(data.today_seconds));
        }
      })
      .catch(() => {});
  }, []);

  const formatScreenTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h} sa ${m} dk`;
    return `${m} dakika`;
  };

  const focusTargetSeconds = 7200; // 2 saatlik hedef
  const focusPercent = Math.min(100, Math.round((todayScreenSeconds / focusTargetSeconds) * 100));

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:p-8 space-y-6 md:space-y-8 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 touch-pan-y overscroll-y-contain">
      
      {/* ========================================================================= */}
      {/* 1. ÜST HERO PANEL: KİŞİSELLEŞTİRİLMİŞ KARŞILAMA & AKILLI HAVA DURUMU     */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 sm:p-8 text-white shadow-xl">
        {/* Dekoratif Arka Plan Efektleri */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute right-1/3 -top-12 w-48 h-48 rounded-full bg-purple-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Sol Taraf: Karşılama, Tarih & Dinamik Emirgan Günün Sözü */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="relative shrink-0">
              <Avatar 
                url={avatar} 
                name={currentUsername} 
                color={color} 
                size={16} 
                className="w-16 h-16 sm:w-20 sm:h-20 ring-4 ring-white/30 shadow-lg"
              />
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 border-2 border-white rounded-full shadow-sm" title="Çevrimiçi" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide uppercase text-blue-100">
                  {dateString}
                </span>
                {isEmirgan && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-xs font-black tracking-wider uppercase shadow-xs">
                    👑 ROOT YÖNETİCİ
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                {greeting}, {currentUsername}! 👋
              </h1>
              
              {/* Dinamik Günün Sözü (Reaktif & Emirgan Paneli Yönetimli) */}
              <div className="mt-2 p-2.5 sm:p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 max-w-xl">
                <div className="flex items-start gap-2">
                  <Sparkles size={16} className="text-amber-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-100 text-xs sm:text-sm font-medium italic leading-relaxed">
                      "{dailyQuote.quote_text}"
                    </p>
                    {dailyQuote.author && (
                      <p className="text-amber-200 text-[11px] font-bold mt-1 text-right">
                        — {dailyQuote.author}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Kullanıcı Rol Rozetleri */}
              {currentUserRoles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                  <RoleBadges roles={currentUserRoles} size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* Sağ Taraf: Cam Efektli (Glassmorphism) Akıllı Hava Kartı */}
          <Link
            to="/hava-durumu"
            onClick={() => onNavigate("weather")}
            className="group relative flex items-center justify-between sm:justify-start gap-4 p-4 sm:p-5 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 transition-all duration-300 shadow-md hover:scale-[1.02] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-4xl sm:text-5xl select-none filter drop-shadow">
                {weatherMeta?.emoji || "🌤️"}
              </span>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-black">
                    {weatherData?.current ? `${weatherData.current.temperature}°C` : "16°C"}
                  </span>
                  <span className="text-xs font-semibold text-blue-100">
                    {weatherMeta?.label || "Parçalı Bulutlu"}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-blue-100 max-w-[210px] line-clamp-2 mt-0.5 leading-snug">
                  {smartAdvice?.message || "Bugün hava dengeli ve sakin görünüyor."}
                </p>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-white/20 text-white group-hover:translate-x-1 transition-transform shrink-0">
              <ArrowRight size={16} />
            </div>
          </Link>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ANA BENTO GRID: CANLI SOHBET & DİKEY DERS PROGRAMI (GÜNÜN AKIŞI)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* SOL PANEL (5 cols): KOMPAKT GENEL SOHBET & TOPLULUK AKIŞI (MINI FEED) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          {/* 1. KOMPAKT GENEL SOHBET WIDGET'I (Socket.IO Çift Taraflı Senkron, Son 2-3 Mesaj) */}
          <MiniChatWidget 
            socket={socket}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            onNavigateChat={() => {
              onNavigate("chats", "/sohbetler");
            }}
          />

          {/* 2. TOPLULUK AKIŞI (MINI FEED WIDGET - SON 2-3 GÖNDERİ) */}
          <CommunityMiniFeedWidget 
            onNavigateFeed={() => onNavigate("feed", "/akis")}
          />

        </div>

        {/* SAĞ PANEL (7 cols): DİKEY DERS PROGRAMI (VERTICAL TIMELINE WIDGET) */}
        <div className="lg:col-span-7">
          <ScheduleTimeline 
            socket={socket}
            currentUserRoles={currentUserRoles}
            onNavigateCourse={(courseId) => {
              onNavigate("folders", `/dersler/${encodeURIComponent(courseId)}`);
            }}
          />
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. ORTA BENTO GRID: TÜM OYUNLAR İÇİN AÇIK MASALAR & KARE YEMEK MENÜSÜ    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* SOL PANEL (8 cols): TÜM ÇOK OYUNCULU OYUNLAR İÇİN ORTAK AÇIK MASA LİSTESİ */}
        <div className="lg:col-span-8 h-full">
          <OpenLobbiesWidget 
            socket={socket}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            onNavigateGames={() => onNavigate("games")}
            className="h-full"
          />
        </div>

        {/* SAĞ PANEL (4 cols): KARE YEMEK MENÜSÜ (CAFETERIA MENU WIDGET) */}
        <div className="lg:col-span-4 h-full flex flex-col">
          <CafeteriaMenuWidget 
            onNavigateAgenda={() => onNavigate("agenda")}
            className="w-full h-full"
          />
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. ALT BENTO GRID: ARKADAŞLAR, ÇALIŞMA KLASÖRLERİ & ODAKLANMA ROZETİ    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">

        {/* KART 1: ÇEVRİMİÇİ ARKADAŞLAR & SOSYAL PANEL */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Çevrimiçi Arkadaşlar
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {onlineUsers.length} kişi şu an aktif
                  </p>
                </div>
              </div>

              <Link
                to="/arkadaslar"
                onClick={() => onNavigate("friends")}
                className="text-xs font-semibold text-emerald-600 hover:underline"
              >
                Tümü →
              </Link>
            </div>

            {/* Arkadaş Listesi */}
            <div className="space-y-2.5">
              {friendsWithStatus.slice(0, 4).map((f) => (
                <div
                  key={f.id}
                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-200 transition-colors"
                >
                  <button
                    onClick={() => onUserClick?.(f.id)}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <Avatar url={f.avatar} name={f.username} color={f.color} size={8} />
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 border border-white dark:border-slate-900 rounded-full ${
                        f.isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate block">
                        {f.username}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block">
                        {f.statusText}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => onStartChat?.(f.id)}
                    className="p-1.5 px-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-100 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Özel Mesaj Yaz"
                  >
                    <MessageSquare size={13} />
                    <span>Yaz</span>
                  </button>
                </div>
              ))}

              {friendsWithStatus.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Henüz arkadaş listen boş. Arkadaş ekleyerek birlikte çalışabilirsin!
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/sohbetler"
              onClick={() => onNavigate("chats")}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Özel Mesajlara Git</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* KART 2: HIZLI DERS KLASÖRLERİ & ODAKLANMA / EKRAN SÜRESİ ROZETİ */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <Folder size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Çalışma & Ders Klasörleri
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Notlar, PDF ve paylaşımlar
                  </p>
                </div>
              </div>

              <Link
                to="/dersler"
                onClick={() => onNavigate("folders")}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Tümü →
              </Link>
            </div>

            {/* Favori Ders Klasörleri Kısayolları */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {FAVORITE_COURSES.slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  to={`/dersler/${encodeURIComponent(c.id)}`}
                  onClick={() => onNavigate("folders", `/dersler/${encodeURIComponent(c.id)}`)}
                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all flex items-center gap-2 group"
                >
                  <span className="text-base">{c.icon}</span>
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate block group-hover:text-blue-600 transition-colors">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{c.level}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Günlük Odaklanma / Ekran Süresi Rozeti */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10 border border-sky-500/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
                  <Flame size={14} className="text-amber-500" />
                  <span>Bugünkü Odaklanma Süren</span>
                </span>
                <span className="font-mono text-sm font-black text-sky-600 dark:text-sky-400">
                  {formatScreenTime(todayScreenSeconds)}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-sky-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${focusPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                2 saatlik günlük odaklanma hedefinin %{focusPercent}'ine ulaştın.
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Link
              to="/dersler"
              onClick={() => onNavigate("folders")}
              className="w-full py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>8 Ders Klasörünün Tamamını Gör</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
}
