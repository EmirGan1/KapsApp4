export type GameControlMode = "auto" | "touch" | "desktop" | "gamepad";

export interface InputDeviceProfile {
  touch: boolean;
  nativeTouch: boolean;
  tablet: boolean;
  mobile: boolean;
  phone: boolean;
  desktop: boolean;
}

export function currentInputDevice(): InputDeviceProfile {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { touch: false, nativeTouch: false, tablet: false, mobile: false, phone: false, desktop: true };
  }

  const userAgent = (navigator.userAgent || navigator.vendor || "").toLowerCase();
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isTouch = maxTouchPoints > 0 || "ontouchstart" in window;

  const isIpad = /ipad/.test(userAgent) || (navigator.platform === "MacIntel" && maxTouchPoints > 1);
  const isAndroidTablet = /android/.test(userAgent) && !/mobile/.test(userAgent);
  const isTablet = isIpad || isAndroidTablet || (isTouch && window.innerWidth >= 768 && window.innerWidth <= 1366);

  const isPhone = isTouch && !isTablet;
  const isMobile = isTouch && (isPhone || isTablet);

  return {
    touch: isTouch,
    nativeTouch: isTouch,
    tablet: isTablet,
    mobile: isMobile,
    phone: isPhone,
    desktop: !isTouch
  };
}

export interface TouchControlsFn {
  (controlMode?: string): boolean;
  isEnabled: () => boolean;
  isTablet: () => boolean;
  isPhone: () => boolean;
}

const touchControlsImpl = (controlMode?: string): boolean => {
  if (controlMode === "touch") return true;
  if (controlMode === "desktop") return false;
  return currentInputDevice().touch;
};

(touchControlsImpl as any).isEnabled = () => currentInputDevice().touch;
(touchControlsImpl as any).isTablet = () => currentInputDevice().tablet;
(touchControlsImpl as any).isPhone = () => currentInputDevice().phone;

export const touchControls: TouchControlsFn = touchControlsImpl as any;
