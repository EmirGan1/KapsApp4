import React, { useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Folder,
  Users,
  ArrowRight,
  Clock,
  Flame,
  Calculator,
  CalendarDays,
  Compass,
  Radio,
  Search,
  Settings as SettingsIcon,
  BellOff,
} from "lucide-react";
import Avatar from "./Avatar";
import RoleBadges from "./RoleBadges";
import ScheduleTimeline from "./ScheduleTimeline";
import OpenLobbiesWidget from "./OpenLobbiesWidget";
import CafeteriaMenuWidget from "./CafeteriaMenuWidget";
import CommunityMiniFeedWidget from "./CommunityMiniFeedWidget";
import MiniChatWidget from "./MiniChatWidget";
import AyvalikHomeWidget from "./AyvalikHomeWidget";
import {
  getCachedWeather,
  fetchWeatherForecast,
  DEFAULT_ISTANBUL_LOCATION,
  getWeatherMeta,
  WeatherData,
  getSmartWeatherAdvice,
} from "../utils/weatherService";
import { getApiUrl } from "../utils/api";
import { UserPreferences, formatPreferenceTime, getStoredPreferences } from "../utils/preferences";

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
  preferences?: UserPreferences;
  onOpenCommandPalette?: () => void;
}

const FAVORITE_COURSES = [
  { id: "Mathematics", name: "Matematik (AA)", level: "HL / SL", icon: "📐" },
  { id: "Physics", name: "Fizik", level: "HL / SL", icon: "⚛️" },
  { id: "Digital Society", name: "Digital Society", level: "SL", icon: "🌐" },
  { id: "Chemistry", name: "Kimya", level: "HL / SL", icon: "🧪" },
  { id: "Turkish", name: "Türk Dili ve Ed.", level: "SL / HL", icon: "📖" },
  { id: "English", name: "English B", level: "HL", icon: "💬" },
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
  isEmirgan = false,
  preferences,
  onOpenCommandPalette,
}: DashboardProps) {
  const activePrefs = preferences || getStoredPreferences();

  // 1. Current Time & Greeting (ticks every second if showSeconds is enabled, else every 10s)
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  useEffect(() => {
    const intervalMs = activePrefs.showSeconds ? 1000 : 10000;
    const timer = setInterval(() => setCurrentTime(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [activePrefs.showSeconds]);

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
      year: "numeric",
    });
  }, [currentTime]);

  const formattedClock = useMemo(() => {
    return formatPreferenceTime(currentTime, activePrefs);
  }, [currentTime, activePrefs]);

  // Dynamic Daily Quote Managed via Emirgan Admin
  const [dailyQuote, setDailyQuote] = useState<{ quote_text: string; author?: string }>({
    quote_text: "Büyük hedeflere giden yol, bugünün küçük adımlarıyla başlar.",
    author: "Emirgan",
  });

  useEffect(() => {
    fetch(getApiUrl("/api/public/daily-quote"))
      .then((res) => res.json())
      .then((data) => {
        if (data && data.quote_text) {
          setDailyQuote({
            quote_text: data.quote_text,
            author: data.author || "Emirgan",
          });
        }
      })
      .catch(() => {});

    if (!socket) return;
    const handleQuoteUpdated = (newQuote: any) => {
      if (newQuote && newQuote.quote_text) {
        setDailyQuote({
          quote_text: newQuote.quote_text,
          author: newQuote.author || "Emirgan",
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
    fetchWeatherForecast(
      DEFAULT_ISTANBUL_LOCATION.latitude,
      DEFAULT_ISTANBUL_LOCATION.longitude,
      DEFAULT_ISTANBUL_LOCATION.name
    )
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
    const statuses = [
      "Ders çalışıyor",
      "KapsPool Bilardo",
      "Boşta",
      "Ders Notlarını İnceliyor",
      "Çevrimiçi",
    ];
    return friends
      .map((f, idx) => {
        const isOnline = onlineUsers.includes(f.id);
        const statusText = isOnline ? statuses[(f.id + idx) % statuses.length] : "Çevrimdışı";
        return {
          id: f.id,
          username: f.username,
          avatar: f.avatar,
          color: f.color,
          statusText,
          isOnline,
        };
      })
      .sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
  }, [friends, onlineUsers]);

  // 4. Daily Screen Time / Focus Tracker
  const [todayScreenSeconds, setTodayScreenSeconds] = useState<number>(() => {
    return Number(localStorage.getItem("kaps_focus_seconds")) || 3600;
  });

  useEffect(() => {
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
    if (!token) return;

    fetch(getApiUrl("/api/user/my-screen-time"), {
      headers: { Authorization: `Bearer ${token}` },
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
    return `${m} dk`;
  };

  const focusTargetSeconds = 7200; // 2 saatlik hedef
  const focusPercent = Math.min(100, Math.round((todayScreenSeconds / focusTargetSeconds) * 100));

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 md:p-8 space-y-6 md:space-y-7 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 touch-pan-y overscroll-y-contain">
      {/* ========================================================================= */}
      {/* 1. ÜST KARŞILAMA PANELİ: AKADEMİK ÇALIŞMA ALANI & HAVA DURUMU             */}
      {/* ========================================================================= */}
      <section className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Sol: Avatar, Karşılama & Günün Sözü */}
          <div className="flex items-start sm:items-center gap-4 sm:gap-5">
            <div className="relative shrink-0">
              <Avatar
                url={avatar}
                name={currentUsername}
                color={color}
                size={16}
                className="w-16 h-16 sm:w-20 sm:h-20 ring-2 ring-slate-200 dark:ring-slate-800 shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>{dateString}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Clock size={12} />
                  <span>{formattedClock}</span>
                </span>
                {isEmirgan && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      ROOT Yönetici
                    </span>
                  </>
                )}
                {activePrefs.doNotDisturb && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold inline-flex items-center gap-1">
                      <BellOff size={12} />
                      <span>Odak Modu Aktif</span>
                    </span>
                  </>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {greeting}, {currentUsername}
              </h1>

              {/* Dinamik Günün Sözü */}
              <div className="pt-1 max-w-2xl">
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
                  "{dailyQuote.quote_text}"
                  {dailyQuote.author && (
                    <span className="not-italic font-semibold text-slate-500 dark:text-slate-400 ml-2">
                      — {dailyQuote.author}
                    </span>
                  )}
                </p>
              </div>

              {/* Kullanıcı Rolleri */}
              {currentUserRoles.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-1.5 items-center">
                  <RoleBadges roles={currentUserRoles} size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* Sağ: Kampüs Hava Durumu & Hızlı Erişim */}
          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link
              to="/hava-durumu"
              onClick={() => onNavigate("weather")}
              className="group flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl sm:text-4xl select-none">
                  {weatherMeta?.emoji || "🌤️"}
                </span>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                      {weatherData?.current ? `${weatherData.current.temperature}°C` : "16°C"}
                    </span>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {weatherMeta?.label || "Parçalı Bulutlu"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-[210px] line-clamp-1 mt-0.5">
                    {smartAdvice?.message || "Kampüs genelinde dengeli hava koşulları."}
                  </p>
                </div>
              </div>
              <ArrowRight
                size={16}
                className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0"
              />
            </Link>
          </div>
        </div>

        {/* Hızlı Modül Araç Çubuğu (Quick Action Strip) */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/dersler"
              onClick={() => onNavigate("folders")}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Folder size={14} className="text-blue-500" />
              <span>Ders Klasörleri</span>
            </Link>
            <Link
              to="/ib-hesaplayici"
              onClick={() => onNavigate("ib-calculator")}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Calculator size={14} className="text-purple-500" />
              <span>KapsCulator</span>
            </Link>
            <Link
              to="/ajanda"
              onClick={() => onNavigate("agenda")}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <CalendarDays size={14} className="text-sky-500" />
              <span>Ajanda & Takvim</span>
            </Link>
            <Link
              to="/sesli-sohbet"
              onClick={() => onNavigate("voice")}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Radio size={14} className="text-violet-500" />
              <span>Sesli Çalışma Odası</span>
            </Link>
            <Link
              to="/ayarlar"
              onClick={() => onNavigate("settings")}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <SettingsIcon size={14} className="text-slate-500" />
              <span>Ayarlar & Temalar</span>
            </Link>
          </div>

          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Search size={13} />
              <span>Hızlı Geçiş & Arama...</span>
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500">
                ⌘K
              </kbd>
            </button>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. ÖNE ÇIKAN: AYVALIK CAS PROJESİ 2026 GEZİ & REHBER PORTALI             */}
      {/* ========================================================================= */}
      <AyvalikHomeWidget
        socket={socket}
        currentUserId={currentUserId}
        currentUsername={currentUsername}
        avatar={avatar}
        color={color}
        onOpenFullPanel={() => onNavigate("ayvalik-cas", "/ayvalik-cas")}
      />

      {/* ========================================================================= */}
      {/* 3. ANA BENTO GRID: CANLI SOHBET & DİKEY DERS PROGRAMI (GÜNÜN AKIŞI)     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SOL PANEL (5 cols): KOMPAKT GENEL SOHBET & TOPLULUK AKIŞI */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <MiniChatWidget
            socket={socket}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            onNavigateChat={() => {
              onNavigate("chats", "/sohbetler");
            }}
          />

          <CommunityMiniFeedWidget onNavigateFeed={() => onNavigate("feed", "/akis")} />
        </div>

        {/* SAĞ PANEL (7 cols): DİKEY DERS PROGRAMI */}
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
      {/* 4. ORTA BENTO GRID: AÇIK OYUN MASALARI & YEMEK MENÜSÜ                    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 h-full">
          <OpenLobbiesWidget
            socket={socket}
            currentUserId={currentUserId}
            currentUsername={currentUsername}
            onNavigateGames={() => onNavigate("games")}
            className="h-full"
          />
        </div>

        <div className="lg:col-span-4 h-full flex flex-col">
          <CafeteriaMenuWidget
            onNavigateAgenda={() => onNavigate("agenda")}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ALT BENTO GRID: ÇEVRİMİÇİ ARKADAŞLAR & DERS KLASÖRLERİ / ODAKLANMA    */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KART 1: ÇEVRİMİÇİ ARKADAŞLAR */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
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
                  <p className="text-[11px] text-slate-400 font-mono">
                    {onlineUsers.length} kişi aktif
                  </p>
                </div>
              </div>

              <Link
                to="/arkadaslar"
                onClick={() => onNavigate("friends")}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Tümü →
              </Link>
            </div>

            <div className="space-y-2.5">
              {friendsWithStatus.slice(0, 4).map((f) => (
                <div
                  key={f.id}
                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-200 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onUserClick?.(f.id)}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
                  >
                    <div className="relative shrink-0">
                      <Avatar url={f.avatar} name={f.username} color={f.color} size={8} />
                      <span
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 border border-white dark:border-slate-900 rounded-full ${
                          f.isOnline ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
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
                    type="button"
                    onClick={() => onStartChat?.(f.id)}
                    className="py-1.5 px-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Özel Mesaj Yaz"
                  >
                    <MessageSquare size={13} />
                    <span>Yaz</span>
                  </button>
                </div>
              ))}

              {friendsWithStatus.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-xs">
                  Henüz arkadaş listen boş. Arkadaş ekleyerek birlikte çalışabilirsin.
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

        {/* KART 2: ÇALIŞMA KLASÖRLERİ & GÜNLÜK ODAKLANMA HEDEFİ */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 md:p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
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
                    IB Müfredatı Notlar, PDF ve Kaynaklar
                  </p>
                </div>
              </div>

              <Link
                to="/dersler"
                onClick={() => onNavigate("folders")}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Tümü →
              </Link>
            </div>

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

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <Flame size={14} className="text-amber-500" />
                  <span>Bugünkü Odaklanma Süren</span>
                </span>
                <span className="font-mono text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  {formatScreenTime(todayScreenSeconds)}
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${focusPercent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
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
