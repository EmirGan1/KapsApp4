import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Home, 
  LayoutGrid, 
  MessageSquare, 
  Folder, 
  MoreHorizontal, 
  UserCircle2, 
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
  Sparkles
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
  isEmirgan: boolean;
  unreadGlobalCount: number;
  pendingApprovalsCount: number;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  handleLogout: () => void;
  isInVoiceRoom?: boolean;
  isChatOpen?: boolean;
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
  isEmirgan,
  unreadGlobalCount,
  pendingApprovalsCount,
  darkMode,
  setDarkMode,
  handleLogout,
  isInVoiceRoom = false,
  isChatOpen = false,
  onOpenInstallGuide,
  isStandalone = false,
}: BottomNavProps) {
  const isMoreTabActive = isMobileMoreOpen || [
    'ib-m27',
    'profile', 
    'notifications', 
    'announcements', 
    'ayvalik-cas',
    'ib-calculator',
    'agenda', 
    'global', 
    'weather', 
    'map', 
    'voice', 
    'games', 
    'friends', 
    'admin',
    'settings'
  ].includes(activeTab);

  // Prevent background body scroll when mobile more drawer is open
  useEffect(() => {
    if (isMobileMoreOpen) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isMobileMoreOpen]);

  // Automatically hide bottom navigation bar when user is inside an active voice/video room or active chat
  if (isInVoiceRoom || isChatOpen) {
    return null;
  }

  return (
    <>
      {/* Native Mobile Fixed Bottom Dock Bar (4 Ana Sekme + 1 'Menü' Çekmecesi) */}
      <div className="kapsapp-bottom-nav lg:hidden fixed bottom-0 inset-x-0 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/92 dark:bg-slate-950/92 backdrop-blur-xl pb-safe shrink-0 z-40 select-none shadow-[0_-8px_30px_rgba(2,6,23,0.12)]">
        <nav 
          aria-label="Mobil alt gezinti menüsü"
          className="grid grid-cols-5 items-center px-1.5 h-[60px] relative"
        >
          {/* 1. Ana Sayfa */}
          <BottomNavItem 
            to="/" 
            icon={<Home size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />} 
            label="Ana Sayfa"
            active={activeTab === 'dashboard'} 
            onClick={() => handleTabChange('dashboard')} 
          />

          {/* 2. Akış */}
          <BottomNavItem 
            to="/akis" 
            icon={<LayoutGrid size={20} strokeWidth={activeTab === 'feed' ? 2.5 : 2} />} 
            label="Akış"
            active={activeTab === 'feed'} 
            onClick={() => handleTabChange('feed')} 
          />

          {/* 3. Sohbetler */}
          <BottomNavItem 
            to="/sohbetler" 
            icon={<MessageSquare size={20} strokeWidth={activeTab === 'chats' ? 2.5 : 2} />} 
            label="Mesajlar"
            active={activeTab === 'chats'} 
            badge={unreadDmCount} 
            onClick={() => handleTabChange('chats')} 
          />

          {/* 4. Dersler */}
          <BottomNavItem 
            to="/dersler" 
            icon={<Folder size={20} strokeWidth={activeTab === 'folders' || activeTab === 'subject' ? 2.5 : 2} />} 
            label="Dersler"
            active={activeTab === 'folders' || activeTab === 'subject'} 
            onClick={() => handleTabChange('folders')} 
          />

          {/* 5. Tüm Bölümler / Daha Fazla (Çekmece Menü) */}
          <BottomNavItem 
            icon={<MoreHorizontal size={20} strokeWidth={isMoreTabActive ? 2.5 : 2} />} 
            label="Menü"
            active={isMoreTabActive} 
            badge={unreadNotificationsCount + unreadGlobalCount}
            dotBadge={hasUnreadAnnouncement}
            onClick={() => setIsMobileMoreOpen(true)} 
          />
        </nav>
      </div>

      {/* Native Mobile "Tüm Bölümler" Categorized Sheet / Drawer Modal */}
      {isMobileMoreOpen && (
        <div 
          className="mobile-window fixed inset-0 z-[9999] lg:hidden flex flex-col justify-end bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 rounded-t-[28px] max-h-[88dvh] overflow-y-auto overscroll-contain p-4 sm:p-5 pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] shadow-2xl animate-in slide-in-from-bottom duration-200 space-y-4 touch-pan-y"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="pt-0 pb-0.5 flex justify-center shrink-0">
              <div className="w-11 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Profile Card & Quick Account Bar */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  handleTabChange('profile');
                  setIsMobileMoreOpen(false);
                }}
                className="flex items-center gap-3 min-w-0 text-left flex-1 cursor-pointer"
              >
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-base shadow-md shrink-0">
                  {username ? username[0].toUpperCase() : "K"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {username || "Kullanıcı"}
                    </h3>
                    {isEmirgan && (
                      <span className="text-[10px] font-mono font-bold text-amber-500">ROOT</span>
                    )}
                  </div>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold block">
                    Profili Görüntüle →
                  </span>
                </div>
              </button>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleTabChange('settings');
                    setIsMobileMoreOpen(false);
                  }}
                  className="min-w-[40px] min-h-[40px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Ayarlar"
                >
                  <SettingsIcon size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileMoreOpen(false)}
                  className="min-w-[40px] min-h-[40px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Menüyü Kapat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Standalone PWA Install Banner (when in mobile browser) */}
            {!isStandalone && onOpenInstallGuide && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMoreOpen(false);
                  onOpenInstallGuide();
                }}
                className="w-full p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between gap-3 shadow-lg shadow-blue-600/20 active:scale-[0.99] transition-transform cursor-pointer text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <Smartphone size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold flex items-center gap-1.5">
                      <span>Telefon Uygulaması Olarak Kullan</span>
                      <Sparkles size={12} className="text-amber-300" />
                    </div>
                    <p className="text-[11px] text-blue-100 truncate mt-0.5">
                      Ana ekrana ekle: tam ekran deneyim ve anlık arama ekranı
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-white text-blue-700 font-extrabold text-[11px] shrink-0">
                  Yükle
                </span>
              </button>
            )}

            {/* Category 1: Akademik & Sınavlar */}
            <div className="space-y-2">
              <div className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Akademik & Sınavlar
              </div>
              <div className="grid grid-cols-4 gap-2">
                <DrawerGridItem 
                  icon={<GraduationCap size={21} className="text-amber-500" />} 
                  label="IB M27" 
                  active={activeTab === 'ib-m27'} 
                  onClick={() => { handleTabChange('ib-m27'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<Calculator size={21} className="text-purple-500" />} 
                  label="KapsCulator" 
                  active={activeTab === 'ib-calculator'} 
                  onClick={() => { handleTabChange('ib-calculator'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<CalendarDays size={21} className="text-indigo-500" />} 
                  label="Ajanda" 
                  active={activeTab === 'agenda'} 
                  onClick={() => { handleTabChange('agenda'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<Compass size={21} className="text-emerald-500" />} 
                  label="Ayvalık CAS" 
                  active={activeTab === 'ayvalik-cas'} 
                  onClick={() => { handleTabChange('ayvalik-cas'); setIsMobileMoreOpen(false); }} 
                />
              </div>
            </div>

            {/* Category 2: İletişim & Canlı Odalar */}
            <div className="space-y-2">
              <div className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                İletişim & Canlı Odalar
              </div>
              <div className="grid grid-cols-4 gap-2">
                <DrawerGridItem 
                  icon={<Radio size={21} className="text-violet-500" />} 
                  label="Sesli Oda" 
                  active={activeTab === 'voice'} 
                  onClick={() => { handleTabChange('voice'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<Globe size={21} className="text-emerald-500" />} 
                  label="Genel Sohbet" 
                  badge={unreadGlobalCount} 
                  active={activeTab === 'global'} 
                  onClick={() => { handleTabChange('global'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<Users size={21} className="text-cyan-500" />} 
                  label="Arkadaşlar" 
                  active={activeTab === 'friends'} 
                  onClick={() => { handleTabChange('friends'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<MapPin size={21} className="text-teal-500" />} 
                  label="Canlı Harita" 
                  active={activeTab === 'map'} 
                  onClick={() => { handleTabChange('map'); setIsMobileMoreOpen(false); }} 
                />
              </div>
            </div>

            {/* Category 3: Kampüs, Bildirimler & Eğlence */}
            <div className="space-y-2">
              <div className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Kampüs & Eğlence
              </div>
              <div className="grid grid-cols-4 gap-2">
                <DrawerGridItem 
                  icon={<Gamepad2 size={21} className="text-pink-500" />} 
                  label="Oyunlar" 
                  active={activeTab === 'games'} 
                  onClick={() => { handleTabChange('games'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<Bell size={21} className="text-amber-500" />} 
                  label="Bildirimler" 
                  badge={unreadNotificationsCount} 
                  active={activeTab === 'notifications'} 
                  onClick={() => { handleTabChange('notifications'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<Megaphone size={21} className="text-orange-500" />} 
                  label="Duyurular" 
                  dotBadge={hasUnreadAnnouncement} 
                  active={activeTab === 'announcements'} 
                  onClick={() => { handleTabChange('announcements'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<CloudSun size={21} className="text-sky-500" />} 
                  label="Hava Durumu" 
                  active={activeTab === 'weather'} 
                  onClick={() => { handleTabChange('weather'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<UserCircle2 size={21} className="text-blue-500" />} 
                  label="Profilim" 
                  active={activeTab === 'profile'} 
                  onClick={() => { handleTabChange('profile'); setIsMobileMoreOpen(false); }} 
                />
                <DrawerGridItem 
                  icon={<SettingsIcon size={21} className="text-slate-500" />} 
                  label="Ayarlar" 
                  active={activeTab === 'settings'} 
                  onClick={() => { handleTabChange('settings'); setIsMobileMoreOpen(false); }} 
                />
                {isEmirgan && (
                  <DrawerGridItem 
                    icon={<Crown size={21} className="text-yellow-500" />} 
                    label="Yönetim" 
                    badge={pendingApprovalsCount} 
                    active={activeTab === 'admin'} 
                    onClick={() => { handleTabChange('admin'); setIsMobileMoreOpen(false); }} 
                  />
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
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
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  to?: string; 
  active: boolean; 
  badge?: number; 
  dotBadge?: boolean; 
  onClick?: () => void; 
}) {
  const commonClass = `flex-1 min-h-[48px] h-full flex flex-col items-center justify-center py-1 px-1 rounded-2xl transition-all relative cursor-pointer no-underline select-none group active:scale-95 ${
    active 
      ? 'text-blue-600 dark:text-blue-400 font-extrabold' 
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold'
  }`;

  const content = (
    <>
      <div
        className={`relative flex items-center justify-center px-3.5 py-1 rounded-2xl transition-all duration-150 ${
          active
            ? 'bg-blue-600/12 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400'
            : 'bg-transparent'
        }`}
      >
        <div className={`transition-transform duration-150 ${active ? 'scale-105' : 'group-hover:scale-105'}`}>
          {icon}
        </div>
        {badge && badge > 0 ? (
          <span 
            aria-label={`${badge} yeni bildirim`}
            className="absolute -top-1 -right-1 px-1 min-w-[17px] h-[17px] bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950 leading-none shadow-sm"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : dotBadge ? (
          <span 
            aria-label="Yeni bildirim var"
            className="absolute -top-0.5 right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-950 animate-pulse shadow-sm shadow-rose-500/50"
          />
        ) : null}
      </div>

      <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-full leading-tight">
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
  onClick
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
      className={`min-h-[68px] flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all text-center relative cursor-pointer active:scale-95 ${
        active
          ? "bg-blue-50 dark:bg-blue-900/35 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-extrabold shadow-xs"
          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      <div className="relative mb-1.5">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[16px] h-4 bg-rose-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-white dark:border-slate-900 leading-none shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : dotBadge ? (
          <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse shadow-sm shadow-rose-500/50"></span>
        ) : null}
      </div>
      <span className="text-[10.5px] font-bold leading-tight truncate max-w-full">
        {label}
      </span>
    </button>
  );
}
