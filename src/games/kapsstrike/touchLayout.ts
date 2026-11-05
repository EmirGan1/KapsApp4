export interface TouchElementLayout {
  x: number;
  y: number;
  size: number;
  opacity: number;
}

export interface TouchLayout {
  joystick: TouchElementLayout;
  fire: TouchElementLayout;
  ads: TouchElementLayout;
  reload: TouchElementLayout;
  jump: TouchElementLayout;
  crouch: TouchElementLayout;
  inspect: TouchElementLayout;
  weapon: TouchElementLayout;
}

export const DEFAULT_TOUCH_LAYOUT: TouchLayout = {
  joystick: { x: 15, y: 75, size: 1, opacity: 0.8 },
  fire: { x: 85, y: 75, size: 1.2, opacity: 0.9 },
  ads: { x: 75, y: 60, size: 1, opacity: 0.8 },
  reload: { x: 85, y: 55, size: 1, opacity: 0.8 },
  jump: { x: 92, y: 65, size: 1, opacity: 0.8 },
  crouch: { x: 70, y: 75, size: 1, opacity: 0.8 },
  inspect: { x: 50, y: 90, size: 0.9, opacity: 0.7 },
  weapon: { x: 50, y: 80, size: 1, opacity: 0.85 }
};

export function loadTouchLayout(): TouchLayout {
  if (typeof localStorage === "undefined") return DEFAULT_TOUCH_LAYOUT;
  try {
    const raw = localStorage.getItem("kaps_strike_touch_layout");
    if (!raw) return DEFAULT_TOUCH_LAYOUT;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_TOUCH_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_TOUCH_LAYOUT;
  }
}

export function saveTouchLayout(layout: TouchLayout): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem("kaps_strike_touch_layout", JSON.stringify(layout));
  } catch {}
}
