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
  X 
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
  hasPredictedAccess: boolean;
  unreadGlobalCount: number;
  pendingApprovalsCount: number;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  handleLogout: () => void;
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
  hasPredictedAccess,
  unreadGlobalCount,
  pendingApprovalsCount,
  darkMode,
  setDarkMode,
  handleLogout,
}: BottomNavProps) {
  const isMoreTabActive = isMobileMoreOpen || [
    'profile', 
    'notifications', 
    'announcements', 
    'agenda', 
    'global', 
    'weather', 
    'map', 
    'voice', 
    'games', 
    'friends', 
    'admin', 
    'predicted'
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

  return (
    <>
      {/* Mobile Fixed Bottom Nav Bar (4 Ana Sekme + 1 'Daha Fazla' Çekmecesi) */}
      <div className="md:hidden fixed bottom-0 inset-x-0 border-t border-slate-200/90 dark:border-slate-800/90 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe shrink-0 z-40 select-none shadow-lg">
        <nav 
          aria-label="Mobil alt gezinti menüsü"
          className="grid grid-cols-5 items-center px-1 h-14 relative"
        >
          {/* 1. Ana Sayfa */}
          <BottomNavItem 
            to="/" 
            icon={<Home size={20} />} 
            label="Ana Sayfa"
            active={activeTab === 'dashboard'} 
            onClick={() => handleTabChange('dashboard')} 
          />

          {/* 2. Akış */}
          <BottomNavItem 
            to="/akis" 
            icon={<LayoutGrid size={20} />} 
            label="Akış"
            active={activeTab === 'feed'} 
            onClick={() => handleTabChange('feed')} 
          />

          {/* 3. Sohbetler */}
          <BottomNavItem 
            to="/sohbetler" 
            icon={<MessageSquare size={20} />} 
            label="Sohbetler"
            active={activeTab === 'chats'} 
            badge={unreadDmCount} 
            onClick={() => handleTabChange('chats')} 
          />

          {/* 4. Dersler */}
          <BottomNavItem 
            to="/dersler" 
            icon={<Folder size={20} />} 
            label="Dersler"
            active={activeTab === 'folders' || activeTab === 'subject'} 
            onClick={() => handleTabChange('folders')} 
          />

          {/* 5. Daha Fazla (Çekmece Menü) */}
          <BottomNavItem 
            icon={<MoreHorizontal size={20} />} 
            label="Daha Fazla"
            active={isMoreTabActive} 
            badge={unreadNotificationsCount}
            dotBadge={hasUnreadAnnouncement}
            onClick={() => setIsMobileMoreOpen(true)} 
          />
        </nav>
      </div>

      {/* Mobile "Daha Fazla" Sheet / Drawer Modal */}
      {isMobileMoreOpen && (
        <div 
          className="fixed inset-0 z-[9999] md:hidden flex flex-col justify-end bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div 
            className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-3xl max-h-[88dvh] overflow-y-auto overscroll-contain p-4 sm:p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] shadow-2xl animate-in slide-in-from-bottom duration-200 space-y-4 touch-pan-y"
            style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="pt-0 pb-1 flex justify-center shrink-0 -mt-1">
              <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                  {username ? username[0].toUpperCase() : "K"}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                    {username || "Kullanıcı"}
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isEmirgan ? "Yönetici (Emirgan)" : "KapsApp Öğrenci"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Menüyü Kapat"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Module Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <DrawerGridItem 
                icon={<UserCircle2 size={22} className="text-blue-500" />} 
                label="Profilim" 
                active={activeTab === 'profile'} 
                onClick={() => { handleTabChange('profile'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<Bell size={22} className="text-amber-500" />} 
                label="Bildirimler" 
                badge={unreadNotificationsCount} 
                active={activeTab === 'notifications'} 
                onClick={() => { handleTabChange('notifications'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<Megaphone size={22} className="text-orange-500" />} 
                label="Duyurular" 
                dotBadge={hasUnreadAnnouncement} 
                active={activeTab === 'announcements'} 
                onClick={() => { handleTabChange('announcements'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<CalendarDays size={22} className="text-indigo-500" />} 
                label="Ajanda" 
                active={activeTab === 'agenda'} 
                onClick={() => { handleTabChange('agenda'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<Globe size={22} className="text-emerald-500" />} 
                label="Genel Sohbet" 
                badge={unreadGlobalCount} 
                active={activeTab === 'global'} 
                onClick={() => { handleTabChange('global'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<CloudSun size={22} className="text-sky-500" />} 
                label="Hava Durumu" 
                active={activeTab === 'weather'} 
                onClick={() => { handleTabChange('weather'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<MapPin size={22} className="text-teal-500" />} 
                label="Canlı Harita" 
                active={activeTab === 'map'} 
                onClick={() => { handleTabChange('map'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<Radio size={22} className="text-purple-500" />} 
                label="Sesli Sohbet" 
                active={activeTab === 'voice'} 
                onClick={() => { handleTabChange('voice'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<Gamepad2 size={22} className="text-pink-500" />} 
                label="Oyunlar" 
                active={activeTab === 'games'} 
                onClick={() => { handleTabChange('games'); setIsMobileMoreOpen(false); }} 
              />
              <DrawerGridItem 
                icon={<Users size={22} className="text-cyan-500" />} 
                label="Arkadaşlar" 
                active={activeTab === 'friends'} 
                onClick={() => { handleTabChange('friends'); setIsMobileMoreOpen(false); }} 
              />
              {(isEmirgan || hasPredictedAccess) && (
                <DrawerGridItem 
                  icon={<GraduationCap size={22} className="text-amber-500" />} 
                  label="IB Predicted" 
                  active={activeTab === 'predicted'} 
                  onClick={() => { handleTabChange('predicted'); setIsMobileMoreOpen(false); }} 
                />
              )}
              {isEmirgan && (
                <DrawerGridItem 
                  icon={<Crown size={22} className="text-yellow-500" />} 
                  label="Yönetim" 
                  badge={pendingApprovalsCount} 
                  active={activeTab === 'admin'} 
                  onClick={() => { handleTabChange('admin'); setIsMobileMoreOpen(false); }} 
                />
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                className="py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
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
  const commonClass = `flex-1 h-full flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative cursor-pointer no-underline select-none group ${
    active 
      ? 'text-blue-600 dark:text-blue-400 font-extrabold' 
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium'
  }`;

  const content = (
    <>
      {/* Aktif Sekme Gösterge Çizgisi (Top Indicator Line) */}
      {active && (
        <span 
          aria-hidden="true" 
          className="absolute top-0 w-8 h-1 bg-blue-600 dark:bg-blue-400 rounded-full shadow-xs transition-all animate-in fade-in zoom-in duration-150"
        />
      )}

      <div className="relative flex items-center justify-center mt-0.5">
        <div className={`transition-transform duration-150 ${active ? 'scale-110' : 'group-hover:scale-105'}`}>
          {icon}
        </div>
        {badge && badge > 0 ? (
          <span 
            aria-label={`${badge} yeni bildirim`}
            className="absolute -top-1.5 -right-2 px-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-white dark:border-slate-900 leading-none shadow-sm"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : dotBadge ? (
          <span 
            aria-label="Yeni bildirim var"
            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse shadow-sm shadow-red-500/50"
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
        onClick={onClick}
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
      aria-expanded={label === "Daha Fazla" ? active : undefined}
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
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center relative cursor-pointer ${
        active
          ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-extrabold shadow-xs"
          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      <div className="relative mb-1">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1.5 -right-2 px-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-white dark:border-slate-900 leading-none shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : dotBadge ? (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse shadow-sm shadow-red-500/50"></span>
        ) : null}
      </div>
      <span className="text-[11px] font-bold leading-tight truncate max-w-full">
        {label}
      </span>
    </button>
  );
}
