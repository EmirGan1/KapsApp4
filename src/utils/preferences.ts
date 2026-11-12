import { ThemeId, applyTheme, getStoredTheme } from "./theme";

export type DensityMode = "comfortable" | "default" | "compact";
export type FontScaleMode = "sm" | "base" | "lg";
export type AccentColorId = "blue" | "indigo" | "emerald" | "rose" | "amber" | "violet";
export type TimeFormatMode = "24h" | "12h";
export type DefaultStartTab = "dashboard" | "chats" | "folders" | "agenda" | "ayvalik-cas";

export interface UserPreferences {
  theme: ThemeId;
  accentColor: AccentColorId;
  density: DensityMode;
  fontScale: FontScaleMode;
  reducedMotion: boolean;
  sidebarCollapsed: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0 - 100
  desktopNotifs: boolean;
  doNotDisturb: boolean;
  chatSendOnEnter: boolean;
  timeFormat: TimeFormatMode;
  showSeconds: boolean;
  privacyHideSensitive: boolean;
  onlineStatusVisible: boolean;
  defaultStartTab: DefaultStartTab;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  accentColor: "blue",
  density: "default",
  fontScale: "base",
  reducedMotion: false,
  sidebarCollapsed: false,
  soundEnabled: true,
  soundVolume: 75,
  desktopNotifs: false,
  doNotDisturb: false,
  chatSendOnEnter: true,
  timeFormat: "24h",
  showSeconds: false,
  privacyHideSensitive: false,
  onlineStatusVisible: true,
  defaultStartTab: "dashboard",
};

export interface AccentColorOption {
  id: AccentColorId;
  labelTr: string;
  hex: string;
  hoverHex: string;
  softBg: string;
}

export const ACCENT_COLOR_OPTIONS: readonly AccentColorOption[] = [
  { id: "blue", labelTr: "Kaps Mavi", hex: "#2563eb", hoverHex: "#1d4ed8", softBg: "rgba(37, 99, 235, 0.12)" },
  { id: "indigo", labelTr: "İndigo Safir", hex: "#4f46e5", hoverHex: "#4338ca", softBg: "rgba(79, 70, 229, 0.12)" },
  { id: "emerald", labelTr: "Kuzey Zümrüt", hex: "#10b981", hoverHex: "#059669", softBg: "rgba(16, 185, 129, 0.12)" },
  { id: "rose", labelTr: "Kuvars Pembe", hex: "#f43f5e", hoverHex: "#e11d48", softBg: "rgba(244, 63, 94, 0.12)" },
  { id: "amber", labelTr: "Kehribar Altın", hex: "#f59e0b", hoverHex: "#d97706", softBg: "rgba(245, 158, 11, 0.12)" },
  { id: "violet", labelTr: "Asil Mor", hex: "#8b5cf6", hoverHex: "#7c3aed", softBg: "rgba(139, 92, 246, 0.12)" },
];

const PREFS_STORAGE_KEY = "kaps_user_preferences_v2";

const VALID_DENSITIES: readonly DensityMode[] = ["comfortable", "default", "compact"];
const VALID_FONT_SCALES: readonly FontScaleMode[] = ["sm", "base", "lg"];
const VALID_ACCENTS: readonly AccentColorId[] = ["blue", "indigo", "emerald", "rose", "amber", "violet"];
const VALID_TIME_FORMATS: readonly TimeFormatMode[] = ["24h", "12h"];
const VALID_START_TABS: readonly DefaultStartTab[] = ["dashboard", "chats", "folders", "agenda", "ayvalik-cas"];

export function sanitizePreferences(raw: Partial<UserPreferences> | null | undefined): UserPreferences {
  const src = raw && typeof raw === "object" ? raw : {};
  const theme = getStoredTheme(src.theme);
  const accentColor = VALID_ACCENTS.includes(src.accentColor as AccentColorId)
    ? (src.accentColor as AccentColorId)
    : DEFAULT_PREFERENCES.accentColor;
  const density = VALID_DENSITIES.includes(src.density as DensityMode)
    ? (src.density as DensityMode)
    : DEFAULT_PREFERENCES.density;
  const fontScale = VALID_FONT_SCALES.includes(src.fontScale as FontScaleMode)
    ? (src.fontScale as FontScaleMode)
    : DEFAULT_PREFERENCES.fontScale;
  const timeFormat = VALID_TIME_FORMATS.includes(src.timeFormat as TimeFormatMode)
    ? (src.timeFormat as TimeFormatMode)
    : DEFAULT_PREFERENCES.timeFormat;
  const defaultStartTab = VALID_START_TABS.includes(src.defaultStartTab as DefaultStartTab)
    ? (src.defaultStartTab as DefaultStartTab)
    : DEFAULT_PREFERENCES.defaultStartTab;

  const volumeNum = typeof src.soundVolume === "number" && Number.isFinite(src.soundVolume)
    ? Math.max(0, Math.min(100, Math.round(src.soundVolume)))
    : DEFAULT_PREFERENCES.soundVolume;

  return {
    theme,
    accentColor,
    density,
    fontScale,
    reducedMotion: typeof src.reducedMotion === "boolean" ? src.reducedMotion : DEFAULT_PREFERENCES.reducedMotion,
    sidebarCollapsed: typeof src.sidebarCollapsed === "boolean" ? src.sidebarCollapsed : DEFAULT_PREFERENCES.sidebarCollapsed,
    soundEnabled: typeof src.soundEnabled === "boolean" ? src.soundEnabled : DEFAULT_PREFERENCES.soundEnabled,
    soundVolume: volumeNum,
    desktopNotifs: typeof src.desktopNotifs === "boolean" ? src.desktopNotifs : DEFAULT_PREFERENCES.desktopNotifs,
    doNotDisturb: typeof src.doNotDisturb === "boolean" ? src.doNotDisturb : DEFAULT_PREFERENCES.doNotDisturb,
    chatSendOnEnter: typeof src.chatSendOnEnter === "boolean" ? src.chatSendOnEnter : DEFAULT_PREFERENCES.chatSendOnEnter,
    timeFormat,
    showSeconds: typeof src.showSeconds === "boolean" ? src.showSeconds : DEFAULT_PREFERENCES.showSeconds,
    privacyHideSensitive: typeof src.privacyHideSensitive === "boolean" ? src.privacyHideSensitive : DEFAULT_PREFERENCES.privacyHideSensitive,
    onlineStatusVisible: typeof src.onlineStatusVisible === "boolean" ? src.onlineStatusVisible : DEFAULT_PREFERENCES.onlineStatusVisible,
    defaultStartTab,
  };
}

export function getStoredPreferences(): UserPreferences {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    const rawStr = localStorage.getItem(PREFS_STORAGE_KEY);
    const parsed = rawStr ? JSON.parse(rawStr) : {};
    // Backwards-compatible migration from legacy keys
    const legacyTheme = getStoredTheme();
    const legacySound = localStorage.getItem("kaps_pref_sound");
    const legacyDesktopNotifs = localStorage.getItem("kaps_pref_desktop_notifs");
    const legacyDensity = localStorage.getItem("kaps_pref_density") as DensityMode | null;
    const legacyFontScale = localStorage.getItem("kaps_pref_font_scale") as FontScaleMode | null;

    return sanitizePreferences({
      ...parsed,
      theme: parsed.theme || legacyTheme,
      soundEnabled: typeof parsed.soundEnabled === "boolean" ? parsed.soundEnabled : legacySound !== "false",
      desktopNotifs: typeof parsed.desktopNotifs === "boolean" ? parsed.desktopNotifs : legacyDesktopNotifs === "true",
      density: parsed.density || legacyDensity || DEFAULT_PREFERENCES.density,
      fontScale: parsed.fontScale || legacyFontScale || DEFAULT_PREFERENCES.fontScale,
    });
  } catch {
    return { ...DEFAULT_PREFERENCES, theme: getStoredTheme() };
  }
}

export const loadPreferences = getStoredPreferences;

export function applyPreferencesToDOM(prefs: UserPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // 1. Apply Theme
  applyTheme(prefs.theme);

  // 2. Apply Density
  root.setAttribute("data-density", prefs.density);

  // 3. Apply Font Scale
  root.setAttribute("data-font-scale", prefs.fontScale);

  // 4. Apply Reduced Motion
  root.setAttribute("data-reduced-motion", prefs.reducedMotion ? "true" : "false");

  // 5. Apply Privacy Mask
  root.setAttribute("data-privacy-mask", prefs.privacyHideSensitive ? "true" : "false");

  // 6. Apply Accent Color Variables
  root.setAttribute("data-accent", prefs.accentColor);
  const accentObj = ACCENT_COLOR_OPTIONS.find((a) => a.id === prefs.accentColor) || ACCENT_COLOR_OPTIONS[0];
  root.style.setProperty("--kaps-accent", accentObj.hex);
  root.style.setProperty("--kaps-accent-hover", accentObj.hoverHex);
  root.style.setProperty("--kaps-accent-soft", accentObj.softBg);
}

export function savePreferences(partial: Partial<UserPreferences>): UserPreferences {
  const current = getStoredPreferences();
  const next = sanitizePreferences({ ...current, ...partial });

  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      // Keep legacy keys synced for any consumers reading them directly
      localStorage.setItem("lan_theme_id", next.theme);
      localStorage.setItem("lan_theme", next.theme === "light" ? "light" : "dark");
      localStorage.setItem("kaps_pref_sound", String(next.soundEnabled));
      localStorage.setItem("kaps_pref_desktop_notifs", String(next.desktopNotifs));
      localStorage.setItem("kaps_pref_density", next.density);
      localStorage.setItem("kaps_pref_font_scale", next.fontScale);
    } catch {}
  }

  applyPreferencesToDOM(next);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kaps:preferences_changed", { detail: next }));
  }

  return next;
}

export function resetPreferencesToDefault(): UserPreferences {
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(PREFS_STORAGE_KEY);
    } catch {}
  }
  return savePreferences(DEFAULT_PREFERENCES);
}

export function formatPreferenceTime(date: Date, prefs: Pick<UserPreferences, "timeFormat" | "showSeconds">): string {
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    ...(prefs.showSeconds ? { second: "2-digit" } : {}),
    hour12: prefs.timeFormat === "12h",
  });
}

// Synthesized Web Audio notification chime (zero external audio file dependencies)
export function playNotificationChime(volumePercent = 75): boolean {
  if (typeof window === "undefined") return false;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return false;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const gainValue = Math.max(0.02, Math.min(0.4, (volumePercent / 100) * 0.35));

    // Pleasant two-note harmonic chime (C5 -> G5)
    const freqs = [523.25, 783.99];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(gainValue, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.3);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 700);
    return true;
  } catch {
    return false;
  }
}
