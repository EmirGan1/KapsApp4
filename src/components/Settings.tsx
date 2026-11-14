import { disableDeviceNotifications, enableDeviceNotifications, showDeviceNotification } from "./DeviceNotifications";
import React, { useState } from "react";
import {
  Palette,
  Bell,
  ShieldCheck,
  User,
  Volume2,
  VolumeX,
  Monitor,
  Trash2,
  LogOut,
  Check,
  MapPin,
  Eye,
  EyeOff,
  Info,
  Sliders,
  BellOff,
  Clock,
  MessageSquare,
  Download,
  RotateCcw,
  PanelLeftClose,
  PanelLeft,
  Zap,
  Compass,
} from "lucide-react";
import { THEME_OPTIONS, ThemeId } from "../utils/theme";
import {
  UserPreferences,
  ACCENT_COLOR_OPTIONS,
  AccentColorId,
  DensityMode,
  FontScaleMode,
  TimeFormatMode,
  DefaultStartTab,
  formatPreferenceTime,
  playNotificationChime,
} from "../utils/preferences";

export interface SettingsProps {
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  preferences?: UserPreferences;
  onUpdatePreferences?: (partial: Partial<UserPreferences>) => void;
  onResetPreferences?: () => void;
  currentUsername: string;
  currentUserId: number;
  currentUserRoles?: string[];
  isEmirgan?: boolean;
  onLogout: () => void;
}

type SettingsSectionId = "appearance" | "layout" | "notifications" | "workspace" | "privacy";

export default function Settings({
  currentTheme,
  onThemeChange,
  preferences,
  onUpdatePreferences,
  onResetPreferences,
  currentUsername,
  currentUserId,
  currentUserRoles = [],
  isEmirgan = false,
  onLogout,
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsSectionId>("appearance");
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);
  const [resetNotice, setResetNotice] = useState(false);
  const [soundTestPlayed, setSoundTestPlayed] = useState(false);

  // Fallback internal state if rendered standalone in tests without preferences prop
  const [localSound, setLocalSound] = useState<boolean>(() => localStorage.getItem("kaps_pref_sound") !== "false");
  const [localVolume, setLocalVolume] = useState<number>(75);
  const [localDesktopNotifs, setLocalDesktopNotifs] = useState<boolean>(
    () => localStorage.getItem("kaps_pref_desktop_notifs") === "true"
  );
  const [localDensity, setLocalDensity] = useState<DensityMode>(
    () => (localStorage.getItem("kaps_pref_density") as DensityMode) || "default"
  );
  const [localFontScale, setLocalFontScale] = useState<FontScaleMode>(
    () => (localStorage.getItem("kaps_pref_font_scale") as FontScaleMode) || "base"
  );
  const [localAccent, setLocalAccent] = useState<AccentColorId>("blue");
  const [localReducedMotion, setLocalReducedMotion] = useState<boolean>(false);
  const [localSidebarCollapsed, setLocalSidebarCollapsed] = useState<boolean>(false);
  const [localDnd, setLocalDnd] = useState<boolean>(false);
  const [localChatEnter, setLocalChatEnter] = useState<boolean>(true);
  const [localTimeFormat, setLocalTimeFormat] = useState<TimeFormatMode>("24h");
  const [localShowSeconds, setLocalShowSeconds] = useState<boolean>(false);
  const [localPrivacyMask, setLocalPrivacyMask] = useState<boolean>(false);
  const [localOnlineVisible, setLocalOnlineVisible] = useState<boolean>(true);
  const [localStartTab, setLocalStartTab] = useState<DefaultStartTab>("dashboard");

  const activePrefs: UserPreferences = preferences || {
    theme: currentTheme,
    accentColor: localAccent,
    density: localDensity,
    fontScale: localFontScale,
    reducedMotion: localReducedMotion,
    sidebarCollapsed: localSidebarCollapsed,
    soundEnabled: localSound,
    soundVolume: localVolume,
    desktopNotifs: localDesktopNotifs,
    doNotDisturb: localDnd,
    chatSendOnEnter: localChatEnter,
    timeFormat: localTimeFormat,
    showSeconds: localShowSeconds,
    privacyHideSensitive: localPrivacyMask,
    onlineStatusVisible: localOnlineVisible,
    defaultStartTab: localStartTab,
  };

  const updatePref = (partial: Partial<UserPreferences>) => {
    if (partial.theme) {
      onThemeChange(partial.theme);
    }
    if (onUpdatePreferences) {
      onUpdatePreferences(partial);
    } else {
      if (partial.density) {
        setLocalDensity(partial.density);
        document.documentElement.setAttribute("data-density", partial.density);
      }
      if (partial.fontScale) {
        setLocalFontScale(partial.fontScale);
        document.documentElement.setAttribute("data-font-scale", partial.fontScale);
      }
      if (partial.accentColor) {
        setLocalAccent(partial.accentColor);
        document.documentElement.setAttribute("data-accent", partial.accentColor);
      }
      if (typeof partial.reducedMotion === "boolean") {
        setLocalReducedMotion(partial.reducedMotion);
        document.documentElement.setAttribute("data-reduced-motion", String(partial.reducedMotion));
      }
      if (typeof partial.sidebarCollapsed === "boolean") setLocalSidebarCollapsed(partial.sidebarCollapsed);
      if (typeof partial.soundEnabled === "boolean") setLocalSound(partial.soundEnabled);
      if (typeof partial.soundVolume === "number") setLocalVolume(partial.soundVolume);
      if (typeof partial.desktopNotifs === "boolean") setLocalDesktopNotifs(partial.desktopNotifs);
      if (typeof partial.doNotDisturb === "boolean") setLocalDnd(partial.doNotDisturb);
      if (typeof partial.chatSendOnEnter === "boolean") setLocalChatEnter(partial.chatSendOnEnter);
      if (partial.timeFormat) setLocalTimeFormat(partial.timeFormat);
      if (typeof partial.showSeconds === "boolean") setLocalShowSeconds(partial.showSeconds);
      if (typeof partial.privacyHideSensitive === "boolean") {
        setLocalPrivacyMask(partial.privacyHideSensitive);
        document.documentElement.setAttribute("data-privacy-mask", String(partial.privacyHideSensitive));
      }
      if (typeof partial.onlineStatusVisible === "boolean") setLocalOnlineVisible(partial.onlineStatusVisible);
      if (partial.defaultStartTab) setLocalStartTab(partial.defaultStartTab);
    }
  };

  const isDemoSession =
    typeof window !== "undefined" &&
    (localStorage.getItem("lan_is_demo") === "true" ||
      (localStorage.getItem("lan_token") || "").startsWith("demo-"));

  const [deviceNotice, setDeviceNotice] = useState("");
  const [deviceBusy, setDeviceBusy] = useState(false);
  const deviceEnabled = activePrefs.desktopNotifs && typeof Notification !== "undefined" &&
    Notification.permission === "granted";

  const handleToggleDesktopNotifs = async () => {
    setDeviceNotice("");
    if (deviceEnabled) {
      disableDeviceNotifications();
      updatePref({ desktopNotifs: false });
      return;
    }
    setDeviceBusy(true);
    try {
      const message = await enableDeviceNotifications();
      updatePref({ desktopNotifs: !message });
      setDeviceNotice(message || "Sistem bildirimleri açık.");
    } finally {
      setDeviceBusy(false);
    }
  };

  const handleTestSound = () => {
    playNotificationChime(activePrefs.soundVolume);
    setSoundTestPlayed(true);
    setTimeout(() => setSoundTestPlayed(false), 2000);
  };

  const handleExportSettings = () => {
    try {
      const dataStr = JSON.stringify(activePrefs, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kapsapp-tercihler-${currentUsername || "kullanici"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleResetAll = () => {
    if (onResetPreferences) {
      onResetPreferences();
    } else {
      updatePref({
        theme: "dark",
        accentColor: "blue",
        density: "default",
        fontScale: "base",
        reducedMotion: false,
        sidebarCollapsed: false,
        soundEnabled: true,
        soundVolume: 75,
        doNotDisturb: false,
        chatSendOnEnter: true,
        timeFormat: "24h",
        showSeconds: false,
        privacyHideSensitive: false,
        onlineStatusVisible: true,
        defaultStartTab: "dashboard",
      });
    }
    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 3500);
  };

  const handleClearLocalCache = () => {
    try {
      const keysToKeep = [
        "lan_token",
        "lan_username",
        "lan_user_id",
        "lan_theme_id",
        "lan_theme",
        "lan_is_demo",
        "lan_account_role",
        "lan_user_roles",
        "kaps_user_preferences_v2",
      ];
      const preserved: Record<string, string> = {};
      for (const k of keysToKeep) {
        const val = localStorage.getItem(k);
        if (val !== null) preserved[k] = val;
      }
      localStorage.clear();
      for (const [k, v] of Object.entries(preserved)) {
        localStorage.setItem(k, v);
      }
      setCacheClearedNotice(true);
      setTimeout(() => setCacheClearedNotice(false), 4000);
    } catch {}
  };

  const sections: { id: SettingsSectionId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: "appearance", label: "Görünüm & Tema", icon: Palette },
    { id: "layout", label: "Yerleşim & Boyut", icon: Monitor },
    { id: "notifications", label: "Bildirim, Ses & Odak", icon: Bell },
    { id: "workspace", label: "Sohbet & Saat", icon: Sliders },
    { id: "privacy", label: "Gizlilik & Hesap", icon: ShieldCheck },
  ];

  const activeThemeMeta = THEME_OPTIONS.find((t) => t.id === activePrefs.theme) || THEME_OPTIONS[0];

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-10 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>KapsApp Çalışma Alanı</span>
              <span aria-hidden="true">·</span>
              <span>Kişiselleştirme ve Sistem Kontrolü</span>
              {isDemoSession && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">Önizleme Oturumu</span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Ayarlar ve Tercihler
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              Renk temaları, arayüz yoğunluğu, okunabilirlik ölçeği, odak modu, sohbet kısayolları ve gizlilik tercihlerinizi anlık olarak yönetin.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleExportSettings}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download size={14} />
              <span>Ayarları İndir</span>
            </button>
            <button
              type="button"
              onClick={handleResetAll}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw size={14} />
              <span>Varsayılana Sıfırla</span>
            </button>
          </div>
        </div>

        {resetNotice && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <span>✓ Tüm görünüm, ses ve çalışma alanı tercihleriniz varsayılan değerlere sıfırlandı.</span>
          </div>
        )}

        {/* Section Navigation Bar */}
        <div
          role="tablist"
          aria-label="Ayarlar Kategorileri"
          className="flex items-center gap-1.5 p-1.5 bg-slate-200/70 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-full overflow-x-auto no-scrollbar"
        >
          {sections.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Two-Column Settings Workspace (Active Controls + Live Preview Sidebar) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 8 Columns: Active Section Controls */}
          <div className="lg:col-span-8 space-y-6">
            {/* ================================================================= */}
            {/* TAB 1: GÖRÜNÜM & TEMA                                             */}
            {/* ================================================================= */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Arayüz Renk Teması
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Gündüz ve gece çalışmalarınıza uygun renk atmosferini seçin. Seçtiğiniz tema tüm panellerde anında etkinleşir.
                    </p>
                  </div>

                  {/* 6 Curated Themes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {THEME_OPTIONS.map((theme) => {
                      const isSelected = activePrefs.theme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => updatePref({ theme: theme.id })}
                          aria-pressed={isSelected}
                          className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[148px] ${
                            isSelected
                              ? "ring-2 ring-blue-600 dark:ring-blue-400 border-blue-600 dark:border-blue-400 bg-blue-50/20 dark:bg-blue-950/20"
                              : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Mini UI Swatch Preview */}
                            <div
                              className="h-12 rounded-lg p-2 flex items-center justify-between border border-black/10 dark:border-white/10"
                              style={{ backgroundColor: theme.previewBg }}
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-5 h-5 rounded-md border border-black/10 dark:border-white/10 flex items-center justify-center text-xs"
                                  style={{ backgroundColor: theme.previewSurface }}
                                >
                                  {theme.icon}
                                </span>
                                <span
                                  className="w-4 h-4 rounded-md"
                                  style={{ backgroundColor: theme.previewAccent }}
                                />
                                <span
                                  className="text-[11px] font-mono font-semibold ml-1"
                                  style={{ color: theme.previewText }}
                                >
                                  Aa 12
                                </span>
                              </div>
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                  <Check size={12} />
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                  {theme.nameTr}
                                </h3>
                                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                  {theme.badgeTr}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-1">
                                {theme.descriptionTr}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2.5 mt-2.5 border-t border-slate-200/60 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                            <span
                              className={`font-semibold ${
                                isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                              }`}
                            >
                              {isSelected ? "Aktif Tema" : "Temayı Uygula"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Primary Accent Color Picker */}
                <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Vurgu Rengi (Odak & Etkileşim Tonu)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Klavye odak halkaları, aktif göstergeler ve vurgu bileşenlerinde kullanılacak ana rengi belirleyin.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    {ACCENT_COLOR_OPTIONS.map((acc) => {
                      const isSelected = activePrefs.accentColor === acc.id;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => updatePref({ accentColor: acc.id })}
                          aria-pressed={isSelected}
                          className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                            isSelected
                              ? "border-slate-900 dark:border-white bg-slate-100/80 dark:bg-slate-800"
                              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                          }`}
                        >
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white shadow-xs"
                            style={{ backgroundColor: acc.hex }}
                          >
                            {isSelected && <Check size={13} />}
                          </span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {acc.labelTr}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 2: YERLEŞİM & ERİŞİLEBİLİRLİK                                 */}
            {/* ================================================================= */}
            {activeTab === "layout" && (
              <div className="space-y-6">
                <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Yerleşim Yoğunluğu ve Metin Ölçeği
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Ekran boyutunuza ve okuma alışkanlığınıza göre kart iç boşluklarını ve yazı boyutlarını ayarlayın.
                    </p>
                  </div>

                  {/* Density Control */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Arayüz Boşluk Seviyesi (Yoğunluk)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        {
                          id: "comfortable",
                          label: "Rahat",
                          desc: "Geniş kart dolguları ve ferah satır aralıkları",
                        },
                        {
                          id: "default",
                          label: "Dengeli (Varsayılan)",
                          desc: "Standart okuma ve içerik yoğunluğu",
                        },
                        {
                          id: "compact",
                          label: "Kompakt",
                          desc: "Tek ekrana daha fazla veri sığdıran sıkı düzen",
                        },
                      ].map((d) => {
                        const isSelected = activePrefs.density === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => updatePref({ density: d.id as DensityMode })}
                            aria-pressed={isSelected}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "border-blue-600 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-950/30"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                {d.label}
                              </span>
                              {isSelected && <Check size={14} className="text-blue-600 dark:text-blue-400" />}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                              {d.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Font Scale Control */}
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      Metin Okunabilirlik Boyutu
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: "sm", label: "Küçük (90%)", sample: "14.5px taban ölçek" },
                        { id: "base", label: "Standart (100%)", sample: "16px taban ölçek" },
                        { id: "lg", label: "Büyük (110%)", sample: "17.5px taban ölçek" },
                      ].map((s) => {
                        const isSelected = activePrefs.fontScale === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => updatePref({ fontScale: s.id as FontScaleMode })}
                            aria-pressed={isSelected}
                            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "border-blue-600 dark:border-blue-400 bg-blue-50/30 dark:bg-blue-950/30"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                                {s.label}
                              </span>
                              {isSelected && <Check size={14} className="text-blue-600 dark:text-blue-400" />}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{s.sample}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Desktop Sidebar & Reduced Motion Toggles */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          {activePrefs.sidebarCollapsed ? (
                            <PanelLeftClose size={16} className="text-blue-500" />
                          ) : (
                            <PanelLeft size={16} className="text-blue-500" />
                          )}
                          <span>Kompakt Masaüstü Kenar Çubuğu</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Masaüstü sol menüsünü yalnızca simgelerden oluşan ince şerit görünümüne daraltır.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activePrefs.sidebarCollapsed}
                        aria-label="Kompakt Masaüstü Kenar Çubuğu"
                        onClick={() => updatePref({ sidebarCollapsed: !activePrefs.sidebarCollapsed })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          activePrefs.sidebarCollapsed ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            activePrefs.sidebarCollapsed ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <Zap size={16} className="text-amber-500" />
                          <span>Azaltılmış Hareket (Anında Geçiş Modu)</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Sayfa geçişleri ve arayüz animasyonlarını devre dışı bırakarak sıfır gecikmeli tepki sağlar.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activePrefs.reducedMotion}
                        aria-label="Azaltılmış Hareket"
                        onClick={() => updatePref({ reducedMotion: !activePrefs.reducedMotion })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          activePrefs.reducedMotion ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            activePrefs.reducedMotion ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 3: BİLDİRİMLER, SES & ODAK MODU                               */}
            {/* ================================================================= */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Odak Modu, Bildirimler ve Ses Kontrolü
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Ders çalışırken dikkat dağıtıcı uyarıları susturun veya bildirim ses düzeyini ayarlayın.
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Do Not Disturb / Focus Mode */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <BellOff size={16} className="text-amber-500" />
                          <span>Odak Modu (Rahatsız Etmeyin)</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Etkinleştirildiğinde kayan bildirim kutularını (toast) ve uyarı seslerini geçici olarak susturur.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activePrefs.doNotDisturb}
                        aria-label="Odak Modu (Rahatsız Etmeyin)"
                        onClick={() => updatePref({ doNotDisturb: !activePrefs.doNotDisturb })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          activePrefs.doNotDisturb ? "bg-amber-500" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            activePrefs.doNotDisturb ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Sound Effects Toggle */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          {activePrefs.soundEnabled ? (
                            <Volume2 size={16} className="text-emerald-500" />
                          ) : (
                            <VolumeX size={16} className="text-slate-400" />
                          )}
                          <span>Uygulama İçi Ses Efektleri</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Yeni mesaj, arama daveti ve etkileşimlerde sesli bildirim çal.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activePrefs.soundEnabled}
                        aria-label="Uygulama İçi Ses Efektleri"
                        onClick={() => updatePref({ soundEnabled: !activePrefs.soundEnabled })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          activePrefs.soundEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            activePrefs.soundEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Sound Volume Slider + Test Button */}
                    <div className="py-4 space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <label
                            htmlFor="sound-volume-slider"
                            className="font-bold text-sm text-slate-900 dark:text-white block"
                          >
                            Bildirim Ses Seviyesi: <span className="font-mono">%{activePrefs.soundVolume}</span>
                          </label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Ses yüksekliğini ayarlayın ve örnek bildirim tonunu dinleyin.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleTestSound}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          <Volume2 size={14} className="text-blue-500" />
                          <span>{soundTestPlayed ? "Ses Çalındı ✓" : "Sesi Test Et"}</span>
                        </button>
                      </div>
                      <input
                        id="sound-volume-slider"
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={activePrefs.soundVolume}
                        onChange={(e) => updatePref({ soundVolume: Number(e.target.value) })}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    {/* Desktop Notifications */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <Monitor size={16} className="text-indigo-500" />
                          <span>Cihaz Bildirimleri</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          KapsApp açıkken yeni mesajları ve bildirimleri cihazında göster.
                        </p>
                        {deviceNotice && <p role="status" className="mt-2 text-xs text-slate-600 dark:text-slate-300">{deviceNotice}</p>}
                        {deviceEnabled && <button type="button" className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400" onClick={async () => {
                          const shown = await showDeviceNotification("Test bildirimi", "KapsApp cihaz bildirimleri çalışıyor.", undefined, true);
                          setDeviceNotice(shown ? "Test bildirimi gönderildi." : "Test bildirimi gönderilemedi.");
                        }}>Test bildirimi gönder</button>}
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={deviceEnabled}
                        disabled={deviceBusy}
                        aria-label="Cihaz Bildirimleri"
                        onClick={handleToggleDesktopNotifs}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          deviceEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            deviceEnabled ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 4: SOHBET & ÇALIŞMA ALANI                                     */}
            {/* ================================================================= */}
            {activeTab === "workspace" && (
              <div className="space-y-6">
                <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Sohbet Davranışı, Saat Biçimi ve Başlangıç Modülü
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Mesajlaşma kısayollarınızı, saat görünümünü ve açılış ekranınızı özelleştirin.
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Enter key behavior */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <MessageSquare size={16} className="text-blue-500" />
                          <span>Enter Tuşu ile Hızlı Mesaj Gönder</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Açıkken Enter mesajı gönderir (Shift+Enter alt satıra geçer). Kapalıyken yalnızca Gönder butonuyla iletilir.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activePrefs.chatSendOnEnter}
                        aria-label="Enter Tuşu ile Hızlı Mesaj Gönder"
                        onClick={() => updatePref({ chatSendOnEnter: !activePrefs.chatSendOnEnter })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          activePrefs.chatSendOnEnter ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            activePrefs.chatSendOnEnter ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Time Format (24h vs 12h) */}
                    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <Clock size={16} className="text-indigo-500" />
                          <span>Saat Gösterim Biçimi</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Üst bilgi çubuğu, ders çizelgesi ve sohbet zaman damgalarında kullanılır.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(["24h", "12h"] as TimeFormatMode[]).map((fmt) => (
                          <button
                            key={fmt}
                            type="button"
                            onClick={() => updatePref({ timeFormat: fmt })}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              activePrefs.timeFormat === fmt
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {fmt === "24h" ? "24 Saat (14:30)" : "12 Saat (02:30 PM)"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Show Seconds Toggle */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          Canlı Saatte Saniye Gösterimi
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Çalışma alanı saatinde saniye sayacını (SS:DD:sn) ayrıntılı olarak gösterir.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activePrefs.showSeconds}
                        aria-label="Canlı Saatte Saniye Gösterimi"
                        onClick={() => updatePref({ showSeconds: !activePrefs.showSeconds })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          activePrefs.showSeconds ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            activePrefs.showSeconds ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Default Start Tab */}
                    <div className="py-4 space-y-2.5">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          <Compass size={16} className="text-emerald-500" />
                          <span>Varsayılan Açılış Sayfası</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          KapsApp'e doğrudan giriş yaptığınızda ilk açılacak çalışma modülü.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { id: "dashboard", label: "Ana Sayfa" },
                          { id: "chats", label: "Sohbetler" },
                          { id: "folders", label: "Ders Klasörleri" },
                          { id: "agenda", label: "Ajanda" },
                          { id: "ayvalik-cas", label: "Ayvalık CAS" },
                        ].map((item) => {
                          const isSelected = activePrefs.defaultStartTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => updatePref({ defaultStartTab: item.id as DefaultStartTab })}
                              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                                isSelected
                                  ? "border-blue-600 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                                  : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* ================================================================= */}
            {/* TAB 5: GİZLİLİK, VERİ & HESAP                                     */}
            {/* ================================================================= */}
            {activeTab === "privacy" && (
              <div className="space-y-6">
                <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                      Gizlilik Koruması ve Oturum Güvenliği
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Ekran paylaşımı sırasında özel verilerinizi koruyun ve konum gizliliği ilkelerini yönetin.
                    </p>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {/* Privacy Mask / Streamer Mode */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          {activePrefs.privacyHideSensitive ? (
                            <EyeOff size={16} className="text-emerald-500" />
                          ) : (
                            <Eye size={16} className="text-slate-400" />
                          )}
                          <span>Ekran Paylaşımı Gizlilik Maskesi</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Sesli odada ekran paylaşırken özel mesaj özetlerini ve hesap numaranızı fareyle üzerine gelene kadar bulanıklaştırır.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activePrefs.privacyHideSensitive}
                        aria-label="Ekran Paylaşımı Gizlilik Maskesi"
                        onClick={() =>
                          updatePref({ privacyHideSensitive: !activePrefs.privacyHideSensitive })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          activePrefs.privacyHideSensitive ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            activePrefs.privacyHideSensitive ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Online Status Visibility */}
                    <div className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          Çevrimiçi Aktiflik Durumunu Göster
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Arkadaşlarınızın çevrimiçi olduğunuzu ve çalışma durumunuzu görmesine izin verir.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activePrefs.onlineStatusVisible}
                        aria-label="Çevrimiçi Aktiflik Durumunu Göster"
                        onClick={() => updatePref({ onlineStatusVisible: !activePrefs.onlineStatusVisible })}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          activePrefs.onlineStatusVisible ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                            activePrefs.onlineStatusVisible ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Geodesic GPS & KVKK Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <MapPin size={15} />
                        <span>50–150m Jeodezik Konum Koruması</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Canlı Harita'da ham GPS koordinatınız asla paylaşılmaz; otomatik sapma ile kesin bina konumunuz gizlenir.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                        <Info size={15} />
                        <span>KVKK & 5651 Veri Güvenliği</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Kişisel verileriniz üçüncü taraf reklam ağlarıyla paylaşılmaz; oturum tercihleri yerel olarak saklanır.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Account & Cache Section */}
                <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-7 border border-slate-200 dark:border-slate-800 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                        {(currentUsername || "K").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                          <span>{currentUsername || "Kullanıcı"}</span>
                          {isEmirgan && (
                            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                              · ROOT
                            </span>
                          )}
                          {isDemoSession && (
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              · Önizleme Modu
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 privacy-sensitive">
                          Kullanıcı ID: <span className="font-mono">{currentUserId}</span> · Roller:{" "}
                          {currentUserRoles.join(", ") || "Öğrenci"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onLogout}
                      className="px-4 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shrink-0"
                    >
                      <LogOut size={14} />
                      <span>Güvenli Çıkış Yap</span>
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <Trash2 size={15} className="text-slate-400" />
                        <span>Yerel Önbelleği Temizle</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Oturumunuzu ve tema ayarlarınızı koruyarak geçici önbellek verilerini sıfırlar.
                      </p>
                      {cacheClearedNotice && (
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                          ✓ Geçici önbellek verileri başarıyla temizlendi.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleClearLocalCache}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      Önbelleği Temizle
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Right 4 Columns: Live Interactive Preview & Status Card */}
          <div className="lg:col-span-4 space-y-5">
            <aside className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-5 sticky top-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Canlı Görünüm Önizlemesi
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Seçimlerinizin gerçek zamanlı yansıması
                  </p>
                </div>
                <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {formatPreferenceTime(new Date(), activePrefs)}
                </span>
              </div>

              {/* Simulated Preview Card */}
              <div
                className="rounded-xl p-4 border transition-all space-y-3"
                style={{
                  backgroundColor: activeThemeMeta.previewSurface,
                  borderColor: "rgba(148, 163, 184, 0.2)",
                  color: activeThemeMeta.previewText,
                }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold flex items-center gap-1.5">
                    <span>{activeThemeMeta.icon}</span>
                    <span>{activeThemeMeta.nameTr}</span>
                  </span>
                  <span
                    className="font-mono text-[11px] font-semibold"
                    style={{ color: activeThemeMeta.previewAccent }}
                  >
                    {activePrefs.density === "compact"
                      ? "Kompakt"
                      : activePrefs.density === "comfortable"
                      ? "Rahat"
                      : "Dengeli"}
                  </span>
                </div>

                <p className="text-xs opacity-80 leading-relaxed">
                  IB Matematik AA HL çalışma notları ve Ayvalık CAS gezi programı senkronize edildi.
                </p>

                {/* Privacy Mask Demo Box */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                  <span className="opacity-70">Gizli Mesaj Önizlemesi:</span>
                  <span className="font-mono font-semibold privacy-sensitive">
                    Özel Oda Kodu: #4829
                  </span>
                </div>
              </div>

              {/* Active Configuration Summary List */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/70">
                  <span className="text-slate-500 dark:text-slate-400">Aktif Tema</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {activeThemeMeta.nameTr}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/70">
                  <span className="text-slate-500 dark:text-slate-400">Metin Ölçeği</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-white">
                    {activePrefs.fontScale === "sm"
                      ? "%90 (Küçük)"
                      : activePrefs.fontScale === "lg"
                      ? "%110 (Büyük)"
                      : "%100 (Standart)"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/70">
                  <span className="text-slate-500 dark:text-slate-400">Odak Modu</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {activePrefs.doNotDisturb ? "Açık (Sessiz)" : "Kapalı"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/70">
                  <span className="text-slate-500 dark:text-slate-400">Mesaj Gönderimi</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {activePrefs.chatSendOnEnter ? "Enter ile Gönder" : "Buton ile Gönder"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-500 dark:text-slate-400">Gizlilik Maskesi</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {activePrefs.privacyHideSensitive ? "Etkin (Bulanık)" : "Devre Dışı"}
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
