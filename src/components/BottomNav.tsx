import UserProfileLink from "./UserProfileLink";
import Avatar from "./Avatar";
import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Home,
  LayoutGrid,
  MessageSquare,
  Folder,
  MoreHorizontal,
  Bell,
  Megaphone,
  CalendarDays,
  Globe,
  CloudSun,
  MapPin,
  Radio,
  Gamepad2,
  Users,
  GraduationCap,
  Crown,
  Sun,
  Moon,
  LogOut,
  X,
  Calculator,
  Compass,
  Settings as SettingsIcon,
  Smartphone,
  Sparkles,
  BrainCircuit,
  Search,
  BellOff,
} from "lucide-react";
import { AppTab } from "../routes";

export interface BottomNavProps {
  activeTab: AppTab;
  unreadDmCount: number;
  unreadNotificationsCount: number;
  hasUnreadAnnouncement: boolean;
  isMobileMoreOpen: boolean;
  setIsMobileMoreOpen: (open: boolean) => void;
  handleTabChange: (tab: AppTab) => void;
  username: string;
  avatar?: string | null;
  color?: string;
  isEmirgan: boolean;
  unreadGlobalCount: number;
  pendingApprovalsCount: number;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  doNotDisturb?: boolean;
  onToggleDnd?: () => void;
  onOpenSearch?: () => void;
  handleLogout: () => void;
  isInVoiceRoom?: boolean;
  isChatOpen?: boolean;
  isInActiveGame?: boolean;
  onOpenInstallGuide?: () => void;
  isStandalone?: boolean;
}

export default function BottomNav({
  activeTab,
  unreadDmCount,
  unreadNotificationsCount,
  hasUnreadAnnouncement,
  isMobileMoreOpen,
  setIsMobileMoreOpen,
  handleTabChange,
  username,
  avatar,
  color,
  isEmirgan,
  unreadGlobalCount,
  pendingApprovalsCount,
  darkMode,
  setDarkMode,
  doNotDisturb = false,
  onToggleDnd,
  onOpenSearch,
  handleLogout,
  isInVoiceRoom = false,
  isChatOpen = false,
  isInActiveGame = false,
  onOpenInstallGuide,
  isStandalone = false,
}: BottomNavProps) {
  const dragStartYRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const isMoreTabActive =
    isMobileMoreOpen ||
    [
      "ib-m27",
      "profile",
      "notifications",
      "announcements",
      "ayvalik-cas",
      "ib-calculator",
      "kapsapp-ai",
      "ai-checker",
      "agenda",
      "global",
      "weather",
      "map",
      "voice",
      "games",
      "friends",
      "admin",
      "settings",
      "travel",
    ].includes(activeTab);

  // Lock background scroll & support Escape while drawer is open
  useEffect(() => {
    if (!isMobileMoreOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsMobileMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileMoreOpen, setIsMobileMoreOpen]);

  // Hide bottom navigation ONLY during immersive full-screen experiences
  if (isInVoiceRoom || isChatOpen || isInActiveGame || activeTab === "german") {
    return null;
  }

  const navigateFromDrawer = (tab: AppTab) => {
    handleTabChange(tab);
    setIsMobileMoreOpen(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (sheetRef.current && sheetRef.current.scrollTop > 4) return;
    dragStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStartYRef.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? dragStartYRef.current;
    const deltaY = endY - dragStartYRef.current;
    dragStartYRef.current = null;
    if (deltaY > 72 && (!sheetRef.current || sheetRef.current.scrollTop <= 4)) {
      setIsMobileMoreOpen(false);
    }
  };

  return (
    <>
      {/* Native Mobile Fixed Bottom Dock Bar (56px + safe area) */}
      <div className="kapsapp-bottom-nav lg:hidden fixed bottom-0 inset-x-0 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-950 pb-safe shrink-0 z-40 select-none shadow-[0_-6px_24px_rgba(2,6,23,0.08)] dark:shadow-[0_-8px_28px_rgba(2,6,23,0.35)]">
        <nav
          aria-label="Mobil alt gezinti menüsü"
          className="grid grid-cols-5 items-center px-1 h-[56px] relative"
        >
          <BottomNavItem
            to="/"
            icon={<Home size={20} strokeWidth={activeTab === "dashboard" ? 2.4 : 1.9} />}
            label="Ana Sayfa"
            active={activeTab === "dashboard"}
            onClick={() => handleTabChange("dashboard")}
          />

          <BottomNavItem
            to="/akis"
            icon={<LayoutGrid size={20} strokeWidth={activeTab === "feed" ? 2.4 : 1.9} />}
            label="Akış"
            active={activeTab === "feed"}
            onClick={() => handleTabChange("feed")}
          />

          <BottomNavItem
            to="/sohbetler"
            icon={<MessageSquare size={20} strokeWidth={activeTab === "chats" ? 2.4 : 1.9} />}
            label="Mesajlar"
            active={activeTab === "chats"}
            badge={unreadDmCount}
            onClick={() => handleTabChange("chats")}
          />

          <BottomNavItem
            to="/dersler"
            icon={<Folder size={20} strokeWidth={activeTab === "folders" || activeTab === "subject" ? 2.4 : 1.9} />}
            label="Dersler"
            active={activeTab === "folders" || activeTab === "subject"}
            onClick={() => handleTabChange("folders")}
          />

          <BottomNavItem
            icon={<MoreHorizontal size={20} strokeWidth={isMoreTabActive ? 2.4 : 1.9} />}
            label="Menü"
            active={isMoreTabActive}
            badge={unreadNotificationsCount + unreadGlobalCount}
            dotBadge={hasUnreadAnnouncement}
            onClick={() => setIsMobileMoreOpen(true)}
          />
        </nav>
      </div>

      {/* Redesigned Mobile Navigation Hub Bottom Sheet */}
      {isMobileMoreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="KapsApp Menü"
          className="mobile-window fixed inset-0 z-[9999] lg:hidden flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs kaps-backdrop-enter"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div
            ref={sheetRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="kaps-sheet-enter bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 rounded-t-[26px] max-h-[88dvh] overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl space-y-4 touch-pan-y"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Swipe Handle */}
            <div className="flex justify-center pb-0.5 shrink-0">
              <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Account Header Card */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigateFromDrawer("profile")}
                className="flex items-center gap-3 min-w-0 text-left flex-1 min-h-[44px] cursor-pointer active:opacity-80"
              >
                <Avatar url={avatar} name={username || "K"} color={color} size={11} className="shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-[15px] text-slate-900 dark:text-white truncate">
                      <UserProfileLink username={username || "Kullanıcı"} embedded />
                    </h3>
                    {isEmirgan && (
                      <span className="text-[10px] font-mono font-bold text-amber-500">ROOT</span>
                    )}
                  </div>
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold block">
                    Profilimi Aç
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => navigateFromDrawer("settings")}
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                  aria-label="Ayarlar"
                >
                  <SettingsIcon size={19} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileMoreOpen(false)}
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                  aria-label="Menüyü Kapat"
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            {/* Quick Utility Strip: Search + Focus Mode */}
            <div className="grid grid-cols-2 gap-2">
              {onOpenSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMoreOpen(false);
                    onOpenSearch();
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform cursor-pointer"
                >
                  <Search size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>Hızlı Ara</span>
                </button>
              )}
              {onToggleDnd && (
                <button
                  type="button"
                  onClick={onToggleDnd}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer ${
                    doNotDisturb
                      ? "bg-amber-500/15 border-amber-500/35 text-amber-600 dark:text-amber-400"
                      : "bg-slate-100/90 dark:bg-slate-800/80 border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <BellOff size={16} className="shrink-0" />
                  <span>{doNotDisturb ? "Odak: Açık" : "Odak Modu"}</span>
                </button>
              )}
            </div>

            {/* Standalone PWA Install Card (only in mobile browser) */}
            {!isStandalone && onOpenInstallGuide && (
              <button
                type="button"
                data-testid="mobile-drawer-install-btn"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  onOpenInstallGuide();
                }}
                className="w-full min-h-[56px] px-3.5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-between gap-3 shadow-md shadow-blue-600/20 active:scale-[0.99] transition-transform cursor-pointer text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <Smartphone size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold truncate">Ana Ekrana Ekle</div>
                    <p className="text-[11px] text-blue-100 truncate">
                      Tam ekran uygulama ve anlık arama deneyimi
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-white text-blue-700 font-extrabold text-[11px] shrink-0">
                  Kur
                </span>
              </button>
            )}

            {/* Category 1: Akademik & Sınavlar */}
            <section className="space-y-2">
              <h4 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Akademik & Araçlar
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <DrawerGridItem
                  icon={<GraduationCap size={20} className="text-amber-500" />}
                  label="IB M27"
                  active={activeTab === "ib-m27"}
                  onClick={() => navigateFromDrawer("ib-m27")}
                />
                <DrawerGridItem
                  icon={<CalendarDays size={20} className="text-indigo-500" />}
                  label="Ajanda"
                  active={activeTab === "agenda"}
                  onClick={() => navigateFromDrawer("agenda")}
                />
                <DrawerGridItem
                  icon={<Calculator size={20} className="text-purple-500" />}
                  label="KapsCulator"
                  active={activeTab === "ib-calculator"}
                  onClick={() => navigateFromDrawer("ib-calculator")}
                />
                <DrawerGridItem
                  icon={<Sparkles size={20} className="text-blue-500" />}
                  label="KapsAI"
                  active={activeTab === "kapsapp-ai"}
                  onClick={() => navigateFromDrawer("kapsapp-ai")}
                />
                <DrawerGridItem
                  icon={<BrainCircuit size={20} className="text-violet-500" />}
                  label="AI Dedektör"
                  active={activeTab === "ai-checker"}
                  onClick={() => navigateFromDrawer("ai-checker")}
                />
                <DrawerGridItem
                  icon={<Compass size={20} className="text-emerald-500" />}
                  label="Ayvalık CAS"
                  active={activeTab === "ayvalik-cas"}
                  onClick={() => navigateFromDrawer("ayvalik-cas")}
                />
              </div>
            </section>

            {/* Category 2: İletişim & Topluluk */}
            <section className="space-y-2">
              <h4 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                İletişim & Canlı
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <DrawerGridItem
                  icon={<Radio size={20} className="text-violet-500" />}
                  label="Sesli Oda"
                  active={activeTab === "voice"}
                  onClick={() => navigateFromDrawer("voice")}
                />
                <DrawerGridItem
                  icon={<Globe size={20} className="text-emerald-500" />}
                  label="Genel Sohbet"
                  badge={unreadGlobalCount}
                  active={activeTab === "global"}
                  onClick={() => navigateFromDrawer("global")}
                />
                <DrawerGridItem
                  icon={<Users size={20} className="text-cyan-500" />}
                  label="Arkadaşlar"
                  active={activeTab === "friends"}
                  onClick={() => navigateFromDrawer("friends")}
                />
                <DrawerGridItem
                  icon={<MapPin size={20} className="text-teal-500" />}
                  label="Canlı Harita"
                  active={activeTab === "map"}
                  onClick={() => navigateFromDrawer("map")}
                />
                <DrawerGridItem
                  icon={<Gamepad2 size={20} className="text-pink-500" />}
                  label="Oyunlar"
                  active={activeTab === "games"}
                  onClick={() => navigateFromDrawer("games")}
                />
                <DrawerGridItem
                  icon={<CloudSun size={20} className="text-sky-500" />}
                  label="Hava Durumu"
                  active={activeTab === "weather"}
                  onClick={() => navigateFromDrawer("weather")}
                />
              </div>
            </section>

            {/* Category 3: Kampüs & Yönetim */}
            <section className="space-y-2">
              <h4 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Kampüs & Bildirim
              </h4>
              <div className="grid grid-cols-3 gap-2">
                <DrawerGridItem
                  icon={<Bell size={20} className="text-amber-500" />}
                  label="Bildirimler"
                  badge={unreadNotificationsCount}
                  active={activeTab === "notifications"}
                  onClick={() => navigateFromDrawer("notifications")}
                />
                <DrawerGridItem
                  icon={<Megaphone size={20} className="text-orange-500" />}
                  label="Duyurular"
                  dotBadge={hasUnreadAnnouncement}
                  active={activeTab === "announcements"}
                  onClick={() => navigateFromDrawer("announcements")}
                />
                {isEmirgan && (
                  <DrawerGridItem
                    icon={<Crown size={20} className="text-yellow-500" />}
                    label="Yönetim"
                    badge={pendingApprovalsCount}
                    active={activeTab === "admin"}
                    onClick={() => navigateFromDrawer("admin")}
                  />
                )}
              </div>
            </section>

            {/* Footer Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="flex-1 min-h-[44px] py-2.5 px-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-[0.98]"
                aria-label={darkMode ? "Açık Temaya Geç" : "Koyu Temaya Geç"}
              >
                {darkMode ? <Sun size={16} className="text-amber-500" /> : <Moon size={16} className="text-indigo-500" />}
                <span>{darkMode ? "Açık Tema" : "Koyu Tema"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  handleLogout();
                }}
                className="min-h-[44px] py-2.5 px-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
                aria-label="Oturumu Kapat"
              >
                <LogOut size={16} />
                <span>Çıkış Yap</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BottomNavItem({
  icon,
  label,
  to,
  active,
  badge,
  dotBadge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  to?: string;
  active: boolean;
  badge?: number;
  dotBadge?: boolean;
  onClick?: () => void;
}) {
  const commonClass = `flex-1 min-h-[48px] h-full flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-colors relative cursor-pointer no-underline select-none group active:scale-95 ${
    active
      ? "text-blue-600 dark:text-blue-400 font-extrabold"
      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold"
  }`;

  const content = (
    <>
      <span
        aria-hidden="true"
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full transition-all duration-150 ${
          active ? "w-7 bg-blue-600 dark:bg-blue-400 opacity-100" : "w-0 bg-transparent opacity-0"
        }`}
      />
      <div className="relative flex items-center justify-center w-9 h-7">
        {icon}
        {badge && badge > 0 ? (
          <span
            aria-label={`${badge} yeni bildirim`}
            className="absolute -top-0.5 -right-1 px-1 min-w-[16px] h-[16px] bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950 leading-none"
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : dotBadge ? (
          <span
            aria-label="Yeni bildirim var"
            className="absolute top-0 right-0.5 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-slate-950"
          />
        ) : null}
      </div>

      <span className="text-[10.5px] tracking-tight truncate max-w-full leading-tight">
        {label}
      </span>
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        onClick={(e) => {
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        className={commonClass}
        aria-label={label}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={commonClass}
      aria-label={label}
      aria-expanded={label === "Menü" ? active : undefined}
    >
      {content}
    </button>
  );
}

function DrawerGridItem({
  icon,
  label,
  active,
  badge,
  dotBadge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  dotBadge?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`min-h-[68px] flex flex-col items-center justify-center gap-1.5 px-2 py-2.5 rounded-2xl border transition-all text-center relative cursor-pointer active:scale-[0.97] ${
        active
          ? "bg-blue-50 dark:bg-blue-900/35 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-extrabold"
          : "bg-slate-50 dark:bg-slate-800/65 border-slate-200/70 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      <div className="relative">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-white dark:border-slate-900 leading-none">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : dotBadge ? (
          <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white dark:border-slate-900" />
        ) : null}
      </div>
      <span className="text-[11.5px] font-bold leading-tight truncate max-w-full">
        {label}
      </span>
    </button>
  );
}
