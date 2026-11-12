export type ThemeId = "dark" | "light" | "pink" | "navy" | "emerald" | "amethyst";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  nameTr: string;
  badgeTr: string;
  descriptionTr: string;
  previewBg: string;
  previewSurface: string;
  previewAccent: string;
  previewText: string;
  icon: string;
  isDark: boolean;
}

export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: "dark",
    name: "Dark",
    nameTr: "Karanlık (Obsidian)",
    badgeTr: "Varsayılan",
    descriptionTr: "Göz yormayan derin antrasit ve gece mavisi yüzeyler, maksimum kontrast ve odaklanma.",
    previewBg: "#020617",
    previewSurface: "#0f172a",
    previewAccent: "#3b82f6",
    previewText: "#f8fafc",
    icon: "🌙",
    isDark: true,
  },
  {
    id: "light",
    name: "Light",
    nameTr: "Açık (Alabaster)",
    badgeTr: "Gündüz",
    descriptionTr: "Aydınlık ortamlar için ferah, net ve yüksek okunabilirlikli beyaz-gri çalışma tuvali.",
    previewBg: "#f8fafc",
    previewSurface: "#ffffff",
    previewAccent: "#2563eb",
    previewText: "#0f172a",
    icon: "☀️",
    isDark: false,
  },
  {
    id: "pink",
    name: "Pink",
    nameTr: "Pembe (Rose Quartz)",
    badgeTr: "Özel",
    descriptionTr: "Sıcak gül kuvars, vişne ve pastel pembe vurgularıyla zarif ve modern görünüm.",
    previewBg: "#170712",
    previewSurface: "#260f1e",
    previewAccent: "#f43f5e",
    previewText: "#fff1f2",
    icon: "🌸",
    isDark: true,
  },
  {
    id: "navy",
    name: "Navy",
    nameTr: "Lacivert (Midnight Ocean)",
    badgeTr: "Gece",
    descriptionTr: "Derin okyanus laciverti, safir yüzeyler ve gökyüzü mavisi detaylarla profesyonel deneyim.",
    previewBg: "#020817",
    previewSurface: "#0b1736",
    previewAccent: "#38bdf8",
    previewText: "#f0f6fc",
    icon: "⚓",
    isDark: true,
  },
  {
    id: "emerald",
    name: "Emerald",
    nameTr: "Zümrüt (Nordic Forest)",
    badgeTr: "Doğa",
    descriptionTr: "Kuzey çam ormanı tonları ve zümrüt yeşili vurgularla sakinleştirici çalışma atmosferi.",
    previewBg: "#03140e",
    previewSurface: "#07241a",
    previewAccent: "#10b981",
    previewText: "#ecfdf5",
    icon: "🌲",
    isDark: true,
  },
  {
    id: "amethyst",
    name: "Amethyst",
    nameTr: "Ametist (Royal Violet)",
    badgeTr: "Stüdyo",
    descriptionTr: "Derin kadife mor yüzeyler ve elektrik lavanta vurgularıyla yaratıcı stüdyo ambiyansı.",
    previewBg: "#0f0720",
    previewSurface: "#1a0e36",
    previewAccent: "#a855f7",
    previewText: "#faf5ff",
    icon: "🔮",
    isDark: true,
  },
];

const VALID_THEMES: readonly ThemeId[] = ["dark", "light", "pink", "navy", "emerald", "amethyst"];

export function applyTheme(theme: ThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const normalized: ThemeId = VALID_THEMES.includes(theme) ? theme : "dark";

  root.setAttribute("data-theme", normalized);
  root.classList.remove("theme-pink", "theme-navy", "theme-emerald", "theme-amethyst");

  if (normalized === "light") {
    root.classList.remove("dark");
  } else {
    root.classList.add("dark");
    if (normalized !== "dark") {
      root.classList.add(`theme-${normalized}`);
    }
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("lan_theme_id", normalized);
      localStorage.setItem("lan_theme", normalized === "light" ? "light" : "dark");
    }
  } catch {}

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    const colorMap: Record<ThemeId, string> = {
      dark: "#020617",
      light: "#f8fafc",
      pink: "#170712",
      navy: "#020817",
      emerald: "#03140e",
      amethyst: "#0f0720",
    };
    metaTheme.setAttribute("content", colorMap[normalized] || "#020617");
  }
}

export function getStoredTheme(candidate?: unknown): ThemeId {
  if (typeof candidate === "string" && VALID_THEMES.includes(candidate as ThemeId)) {
    return candidate as ThemeId;
  }
  try {
    if (typeof localStorage !== "undefined") {
      const storedId = localStorage.getItem("lan_theme_id") as ThemeId | null;
      if (storedId && VALID_THEMES.includes(storedId)) {
        return storedId;
      }
      const legacy = localStorage.getItem("lan_theme");
      if (legacy === "light") return "light";
    }
    return "dark";
  } catch {
    return "dark";
  }
}

export function isThemeDark(theme: ThemeId): boolean {
  return theme !== "light";
}

