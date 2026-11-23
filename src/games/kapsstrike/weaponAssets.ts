import type { WeaponId } from "./types";

export type WeaponPbrSetId =
  | "metal_plate_02"
  | "blue_metal_plate"
  | "american_walnut_veneer"
  | "smoked_walnut_veneer"
  | "fabric_leather_02"
  | "marble_01"
  | "rubber_tiles";

export interface WeaponPbrAssetEntry {
  id: WeaponPbrSetId;
  label: string;
  license: "CC0 1.0";
  source: string;
  basePath: string;
  albedo: string;
  normal: string;
  arm: string;
}

/**
 * Verified CC0 1.0 PBR weapon surface maps sourced from Poly Haven.
 * Stored locally as WebP textures under /public/kapsstrike/weapon-pbr/ and /catalog-v1/.
 */
export const WEAPON_PBR_ASSETS: Record<WeaponPbrSetId, WeaponPbrAssetEntry> = {
  metal_plate_02: {
    id: "metal_plate_02",
    label: "Machined Gunmetal Steel",
    license: "CC0 1.0",
    source: "https://polyhaven.com/a/metal_plate_02",
    basePath: "/kapsstrike/weapon-pbr/",
    albedo: "metal_plate_02_diff_1k.webp",
    normal: "metal_plate_02_nor_gl_1k.webp",
    arm: "metal_plate_02_arm_1k.webp",
  },
  blue_metal_plate: {
    id: "blue_metal_plate",
    label: "Blued / Anodized Tactical Steel",
    license: "CC0 1.0",
    source: "https://polyhaven.com/a/blue_metal_plate",
    basePath: "/kapsstrike/weapon-pbr/",
    albedo: "blue_metal_plate_diff_1k.webp",
    normal: "blue_metal_plate_nor_gl_1k.webp",
    arm: "blue_metal_plate_arm_1k.webp",
  },
  american_walnut_veneer: {
    id: "american_walnut_veneer",
    label: "American Walnut Gunstock",
    license: "CC0 1.0",
    source: "https://polyhaven.com/a/american_walnut_veneer",
    basePath: "/kapsstrike/weapon-pbr/",
    albedo: "american_walnut_veneer_diff_1k.webp",
    normal: "american_walnut_veneer_nor_gl_1k.webp",
    arm: "american_walnut_veneer_arm_1k.webp",
  },
  smoked_walnut_veneer: {
    id: "smoked_walnut_veneer",
    label: "Smoked Dark Walnut Furniture",
    license: "CC0 1.0",
    source: "https://polyhaven.com/a/smoked_walnut_veneer",
    basePath: "/kapsstrike/weapon-pbr/",
    albedo: "smoked_walnut_veneer_diff_1k.webp",
    normal: "smoked_walnut_veneer_nor_gl_1k.webp",
    arm: "smoked_walnut_veneer_arm_1k.webp",
  },
  fabric_leather_02: {
    id: "fabric_leather_02",
    label: "Tactical Grip Wrap & Leather",
    license: "CC0 1.0",
    source: "https://polyhaven.com/a/fabric_leather_02",
    basePath: "/kapsstrike/weapon-pbr/",
    albedo: "fabric_leather_02_diff_1k.webp",
    normal: "fabric_leather_02_nor_gl_1k.webp",
    arm: "fabric_leather_02_arm_1k.webp",
  },
  marble_01: {
    id: "marble_01",
    label: "Polished Ceramic / Collector Finish Grain",
    license: "CC0 1.0",
    source: "https://polyhaven.com/a/marble_01",
    basePath: "/kapsstrike/weapon-pbr/",
    albedo: "marble_01_diff_1k.webp",
    normal: "marble_01_nor_gl_1k.webp",
    arm: "marble_01_arm_1k.webp",
  },
  rubber_tiles: {
    id: "rubber_tiles",
    label: "Stippled Tactical Rubber Grip",
    license: "CC0 1.0",
    source: "https://polyhaven.com/a/rubber_tiles",
    basePath: "/kapsstrike/catalog-v1/",
    albedo: "rubber_tiles_diff_1k.webp",
    normal: "rubber_tiles_nor_gl_2k.webp",
    arm: "rubber_tiles_arm_2k.webp",
  },
};

export interface WeaponPresentationSpec {
  archetype: string;
  /** First-person hipfire base offset relative to camera */
  fpOffset: [number, number, number];
  /** First-person ADS offset relative to camera */
  adsOffset: [number, number, number];
  /** First-person base Euler rotation [rx, ry, rz] */
  fpRotation: [number, number, number];
  /** Muzzle flash local offset relative to weapon root */
  muzzleOffset: [number, number, number];
  /** Third-person scale multiplier */
  tpScale: number;
  /** Ground dropped weapon resting height above floor & natural side-lying roll */
  groundY: number;
  groundRollZ: number;
  groundScale: number;
  /** 3D Inventory preview camera framing distance & vertical target offset */
  previewRadius: number;
  previewTargetY: number;
  previewTargetZ: number;
}

export const WEAPON_PRESENTATION: Record<WeaponId, WeaponPresentationSpec> = {
  rifle: {
    archetype: "AK-47 / Kalashnikov Assault Rifle",
    fpOffset: [0.22, -0.21, 0.50],
    adsOffset: [0.0, -0.145, 0.36],
    fpRotation: [0.0, -0.04, 0.0],
    muzzleOffset: [0, 0.022, 0.72],
    tpScale: 0.92,
    groundY: 0.055,
    groundRollZ: Math.PI / 2,
    groundScale: 0.96,
    previewRadius: 1.02,
    previewTargetY: -0.02,
    previewTargetZ: 0.14,
  },
  carbine: {
    archetype: "M4A1-S Tactical Carbine",
    fpOffset: [0.22, -0.21, 0.50],
    adsOffset: [0.0, -0.155, 0.35],
    fpRotation: [0.0, -0.04, 0.0],
    muzzleOffset: [0, 0.022, 0.74],
    tpScale: 0.9,
    groundY: 0.055,
    groundRollZ: Math.PI / 2,
    groundScale: 0.96,
    previewRadius: 1.04,
    previewTargetY: -0.01,
    previewTargetZ: 0.16,
  },
  smg: {
    archetype: "MP5 Tactical Submachine Gun",
    fpOffset: [0.21, -0.20, 0.45],
    adsOffset: [0.0, -0.14, 0.33],
    fpRotation: [0.0, -0.04, 0.0],
    muzzleOffset: [0, 0.022, 0.50],
    tpScale: 0.88,
    groundY: 0.048,
    groundRollZ: Math.PI / 2,
    groundScale: 0.95,
    previewRadius: 0.82,
    previewTargetY: -0.02,
    previewTargetZ: 0.08,
  },
  sniper: {
    archetype: "AWP / L96A1 Bolt-Action Sniper Rifle",
    fpOffset: [0.23, -0.22, 0.50],
    adsOffset: [0.0, -0.18, 0.30],
    fpRotation: [0.0, -0.03, 0.0],
    muzzleOffset: [0, 0.028, 0.96],
    tpScale: 0.9,
    groundY: 0.06,
    groundRollZ: Math.PI / 2,
    groundScale: 0.94,
    previewRadius: 1.28,
    previewTargetY: 0.02,
    previewTargetZ: 0.24,
  },
  shotgun: {
    archetype: "M870 Tactical Pump-Action Shotgun",
    fpOffset: [0.22, -0.21, 0.50],
    adsOffset: [0.0, -0.14, 0.36],
    fpRotation: [0.0, -0.04, 0.0],
    muzzleOffset: [0, 0.032, 0.76],
    tpScale: 0.92,
    groundY: 0.052,
    groundRollZ: Math.PI / 2,
    groundScale: 0.96,
    previewRadius: 1.06,
    previewTargetY: -0.01,
    previewTargetZ: 0.16,
  },
  pistol: {
    archetype: "USP / Glock Tactical Sidearm",
    fpOffset: [0.19, -0.19, 0.46],
    adsOffset: [0.0, -0.125, 0.36],
    fpRotation: [0.0, -0.03, 0.0],
    muzzleOffset: [0, 0.028, 0.24],
    tpScale: 0.92,
    groundY: 0.035,
    groundRollZ: Math.PI / 2,
    groundScale: 0.98,
    previewRadius: 0.56,
    previewTargetY: -0.03,
    previewTargetZ: 0.04,
  },
  lmg: {
    archetype: "M249 SAW Light Machine Gun",
    fpOffset: [0.24, -0.24, 0.49],
    adsOffset: [0.0, -0.165, 0.35],
    fpRotation: [0.0, -0.035, 0.0],
    muzzleOffset: [0, 0.028, 0.79],
    tpScale: 0.9,
    groundY: 0.082,
    groundRollZ: Math.PI / 2,
    groundScale: 0.94,
    previewRadius: 1.12,
    previewTargetY: -0.01,
    previewTargetZ: 0.16,
  },
  railgun: {
    archetype: "RX-3 Electromagnetic Rail Sniper",
    fpOffset: [0.23, -0.22, 0.50],
    adsOffset: [0.0, -0.175, 0.31],
    fpRotation: [0.0, -0.03, 0.0],
    muzzleOffset: [0, 0.022, 0.92],
    tpScale: 0.9,
    groundY: 0.06,
    groundRollZ: Math.PI / 2,
    groundScale: 0.94,
    previewRadius: 1.24,
    previewTargetY: 0.01,
    previewTargetZ: 0.22,
  },
  knife: {
    archetype: "Tactical Melee Blades (Combat / Tanto / Karambit / Balisong)",
    fpOffset: [0.25, -0.25, 0.48],
    adsOffset: [0.25, -0.25, 0.48],
    fpRotation: [-0.05, 0.1, -0.1],
    muzzleOffset: [0, 0, 0.3],
    tpScale: 0.95,
    groundY: 0.025,
    groundRollZ: Math.PI / 2,
    groundScale: 1.0,
    previewRadius: 0.52,
    previewTargetY: 0.0,
    previewTargetZ: 0.06,
  },
};
