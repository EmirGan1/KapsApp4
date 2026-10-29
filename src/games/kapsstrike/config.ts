import { WeaponId, StrikeSettings } from "./types";
export const PHYSICS = {
  dt: 1 / 120,
  radius: 0.32,
  standing: 1.8,
  crouching: 1.12,
  eye: 1.62,
  crouchEye: 0.94,
  step: 0.32,
  gravity: 24,
  jumpSpeed: 8.2,
  walkSpeed: 6.7,
  sprintSpeed: 9.4,
  crouchSpeed: 3.2,
  maxSpeed: 13,
  groundAcceleration: 65,
  airAcceleration: 12,
  friction: 8,
  slideFriction: 1.3,
  slideTicks: 85,
  respawnTicks: 240,
  protectionTicks: 240,
};
export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  capacity: number;
  damage: number;
  rpm: number;
  range: number;
  reload: number;
  spread: number;
  recoil: number;
  ads: number;
  mobility: number;
  automatic: boolean;
  pellets: number;
  color: string;
  length: number;
  zoom: number;
}
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  rifle: {
    id: "rifle",
    name: "AR-30 Yörünge",
    capacity: 30,
    damage: 25,
    rpm: 600,
    range: 90,
    reload: 2.1,
    spread: 0.011,
    recoil: 0.009,
    ads: 0.35,
    mobility: 1,
    automatic: true,
    pellets: 1,
    color: "#dfad58",
    length: 1.05,
    zoom: 0.76,
  },
  smg: {
    id: "smg",
    name: "SM-35 Kıvılcım",
    capacity: 35,
    damage: 18,
    rpm: 850,
    range: 55,
    reload: 1.7,
    spread: 0.023,
    recoil: 0.006,
    ads: 0.55,
    mobility: 1.12,
    automatic: true,
    pellets: 1,
    color: "#56c6bf",
    length: 0.72,
    zoom: 0.84,
  },
  sniper: {
    id: "sniper",
    name: "SR-5 Ufuk",
    capacity: 5,
    damage: 90,
    rpm: 50,
    range: 180,
    reload: 2.8,
    spread: 0.038,
    recoil: 0.035,
    ads: 0.012,
    mobility: 0.83,
    automatic: false,
    pellets: 1,
    color: "#93a2db",
    length: 1.5,
    zoom: 0.35,
  },
  shotgun: {
    id: "shotgun",
    name: "SG-6 Yarma",
    capacity: 6,
    damage: 80,
    rpm: 75,
    range: 35,
    reload: 2.6,
    spread: 0.065,
    recoil: 0.032,
    ads: 0.8,
    mobility: 0.94,
    automatic: false,
    pellets: 8,
    color: "#d67b66",
    length: 1.1,
    zoom: 0.83,
  },
  pistol: {
    id: "pistol",
    name: "P-12 İz",
    capacity: 12,
    damage: 28,
    rpm: 360,
    range: 65,
    reload: 1.4,
    spread: 0.014,
    recoil: 0.016,
    ads: 0.4,
    mobility: 1.08,
    automatic: false,
    pellets: 1,
    color: "#bfcbce",
    length: 0.53,
    zoom: 0.85,
  },
};
export const WEAPON_ORDER = Object.keys(WEAPONS) as WeaponId[];
export const DEFAULT_SETTINGS: StrikeSettings = {
  quality: "medium",
  scale: 1,
  sensitivity: 1,
  fov: 90,
  volume: 0.35,
  invertY: false,
};
export function cleanSettings(s: Partial<StrikeSettings>): StrikeSettings {
  const n = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(min, Math.min(max, v))
      : fallback;
  return {
    quality: ["low", "medium", "high"].includes(s.quality || "")
      ? s.quality!
      : DEFAULT_SETTINGS.quality,
    scale: n(s.scale, 0.5, 1.5, 1),
    sensitivity: n(s.sensitivity, 0.15, 3, 1),
    fov: n(s.fov, 65, 115, 90),
    volume: n(s.volume, 0, 1, 0.35),
    invertY: s.invertY === true,
  };
}

export const TARGET_HITBOXES = {
  body: { radius: 0.34, min: 0.15, max: 1.4 },
  head: { radius: 0.22, min: 1.42, max: 1.86 },
} as const;
