import { cleanBindings } from "./controls";
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
export const MELEE = { damage:40, heavyDamage:65, range:2.2, cooldown:0.5, heavyCooldown:0.9 };
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  knife: { id:"knife", name:"K-1 Çelik", capacity:1, damage:MELEE.damage, rpm:120, range:MELEE.range, reload:0, spread:0, recoil:0, ads:1, mobility:1.12, automatic:false, pellets:1, color:"#bccbd4", length:0.6, zoom:1 },
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
export const WEAPON_ORDER: WeaponId[] = ["rifle","smg","sniper","shotgun","pistol","knife"];
export function detectAutoQuality(): "low" | "medium" | "high" {
  if (typeof window === "undefined") return "medium";
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.innerWidth < 800;
  if (isMobile) return "low";
  const cores = navigator.hardwareConcurrency || 4;
  if (cores >= 8) return "high";
  if (cores <= 2) return "low";
  return "medium";
}

export const DEFAULT_SETTINGS: StrikeSettings = {
  quality: "auto",
  scale: 1,
  sensitivity: 1,
  mobileSensitivity: 1.2,
  fov: 90,
  volume: 0.5,
  effectsVolume: 0.8,
  voiceVolume: 1.0,
  dynamicResolution: true,
  invertY: false,
};
export function cleanSettings(s: Partial<StrikeSettings>): StrikeSettings {
  const n = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(min, Math.min(max, v))
      : fallback;
  return {
    bindings: cleanBindings(s.bindings),
    quality: ["low", "medium", "high", "auto"].includes(s.quality || "")
      ? (s.quality as StrikeSettings["quality"])
      : DEFAULT_SETTINGS.quality,
    scale: n(s.scale, 0.5, 1.5, 1),
    sensitivity: n(s.sensitivity, 0.15, 3, 1),
    mobileSensitivity: n(s.mobileSensitivity, 0.2, 4, 1.2),
    fov: n(s.fov, 65, 115, 90),
    volume: n(s.volume, 0, 1, 0.5),
    effectsVolume: n(s.effectsVolume, 0, 1, 0.8),
    voiceVolume: n(s.voiceVolume, 0, 1.5, 1.0),
    dynamicResolution: s.dynamicResolution !== false,
    invertY: s.invertY === true,
  };
}

export const TARGET_HITBOXES = {
  body: { radius: 0.34, min: 0.15, max: 1.4 },
  head: { radius: 0.22, min: 1.42, max: 1.86 },
} as const;
