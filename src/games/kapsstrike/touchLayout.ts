export type TouchControlId =
  | "fire"
  | "ads"
  | "jump"
  | "crouch"
  | "reload"
  | "inspect"
  | "weapon"
  | "joystick";

export interface TouchControlItem {
  id: TouchControlId;
  name: string;
  label: string;
  icon?: string;
  /** Percentage from screen left (0 - 100) */
  x: number;
  /** Percentage from screen top (0 - 100) */
  y: number;
  /** Scale factor (0.6 - 1.6) */
  size: number;
  /** Opacity (0.3 - 1.0) */
  opacity: number;
}

export type TouchLayout = Record<TouchControlId, TouchControlItem>;

/**
 * Ergonomic default touch button layout, specifically spaced for tablets
 * and mobile screens so buttons never overlap or get accidentally misclicked.
 */
export const DEFAULT_TOUCH_LAYOUT: TouchLayout = {
  joystick: {
    id: "joystick",
    name: "Hareket Joystick'i",
    label: "JOYSTICK",
    icon: "🕹️",
    x: 16,
    y: 78,
    size: 1.1,
    opacity: 0.85,
  },
  fire: {
    id: "fire",
    name: "Ateş Butonu",
    label: "ATEŞ",
    icon: "💥",
    x: 88,
    y: 76,
    size: 1.2,
    opacity: 0.95,
  },
  ads: {
    id: "ads",
    name: "Dürbün / ADS",
    label: "DÜRBÜN",
    icon: "🎯",
    x: 90,
    y: 50,
    size: 1.05,
    opacity: 0.85,
  },
  jump: {
    id: "jump",
    name: "Zıpla Butonu",
    label: "ZIPLA",
    icon: "🦘",
    x: 79,
    y: 45,
    size: 1.0,
    opacity: 0.85,
  },
  crouch: {
    id: "crouch",
    name: "Çömel / Kay",
    label: "KAY",
    icon: "🔻",
    x: 74,
    y: 82,
    size: 1.0,
    opacity: 0.85,
  },
  reload: {
    id: "reload",
    name: "Şarjör Değiştir",
    label: "ŞARJÖR",
    icon: "🔄",
    x: 77,
    y: 64,
    size: 0.95,
    opacity: 0.85,
  },
  inspect: {
    id: "inspect",
    name: "Silahı İncele",
    label: "İNCELE",
    icon: "👁️",
    x: 67,
    y: 51,
    size: 0.9,
    opacity: 0.85,
  },
  weapon: {
    id: "weapon",
    name: "Silah Kartı & Menü",
    label: "SİLAH",
    icon: "🔫",
    x: 50,
    y: 91,
    size: 1.0,
    opacity: 0.9,
  },
};

const STORAGE_KEY = "kapsstrike_touch_layout_v2";

export function loadTouchLayout(): TouchLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TOUCH_LAYOUT };
    const parsed = JSON.parse(raw);
    const layout = { ...DEFAULT_TOUCH_LAYOUT };
    for (const key of Object.keys(DEFAULT_TOUCH_LAYOUT) as TouchControlId[]) {
      if (parsed[key]) {
        layout[key] = {
          ...DEFAULT_TOUCH_LAYOUT[key],
          ...parsed[key],
          // Sanitize percentages and scale
          x: Math.max(5, Math.min(95, Number(parsed[key].x) || DEFAULT_TOUCH_LAYOUT[key].x)),
          y: Math.max(5, Math.min(95, Number(parsed[key].y) || DEFAULT_TOUCH_LAYOUT[key].y)),
          size: Math.max(0.6, Math.min(1.6, Number(parsed[key].size) || 1.0)),
          opacity: Math.max(0.3, Math.min(1.0, Number(parsed[key].opacity) || 0.85)),
        };
      }
    }
    return layout;
  } catch {
    return { ...DEFAULT_TOUCH_LAYOUT };
  }
}

export function saveTouchLayout(layout: TouchLayout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {}
}

export function resetTouchLayout(): TouchLayout {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  return { ...DEFAULT_TOUCH_LAYOUT };
}
