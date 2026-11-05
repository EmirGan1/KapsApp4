export type GyroStatus = "unsupported" | "idle" | "needs_permission" | "permission_denied" | "active";

export const GYRO_STATUS: Record<GyroStatus, string> = {
  unsupported: "Jiroskop Donanımı Bulunamadı",
  idle: "Jiroskop Hazır (Pasif)",
  needs_permission: "Sensör İzni Gerekli",
  permission_denied: "Sensör İzni Reddedildi",
  active: "Jiroskop Aktif"
};

export interface GyroSample {
  alpha: number;
  beta: number;
  gamma: number;
}

export interface GyroDelta {
  yaw: number;
  pitch: number;
  roll: number;
}

export function checkGyroSupport(): boolean {
  if (typeof window === "undefined") return false;
  return "DeviceOrientationEvent" in window || "DeviceMotionEvent" in window;
}
