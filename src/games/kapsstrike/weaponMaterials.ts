import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { FresnelParameters } from "@babylonjs/core/Materials/fresnelParameters";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Cosmetic } from "./cosmetics";
import type { WeaponId } from "./types";
import { finishAppearance, finishTextureUrl } from "./finishAppearance";
import { WEAPON_PBR_ASSETS, type WeaponPbrSetId } from "./weaponAssets";

export type WeaponSurfaceRole =
  | "steel"
  | "bluedSteel"
  | "darkMetal"
  | "chrome"
  | "wood"
  | "darkWood"
  | "polymer"
  | "rubber"
  | "leather"
  | "brass"
  | "shellRed"
  | "opticGlass"
  | "railGlow"
  | "sightDot"
  | "glove"
  | "gloveAccent";

export type WeaponQualityTier = "low" | "medium" | "high";

interface WeaponMaterialCache {
  textures: Map<string, Texture>;
  baseMaterials: Map<string, StandardMaterial>;
  finishMaterials: Map<string, StandardMaterial>;
}

const sceneCaches = new WeakMap<Scene, WeaponMaterialCache>();

function getCache(scene: Scene): WeaponMaterialCache {
  let cache = sceneCaches.get(scene);
  if (!cache) {
    cache = {
      textures: new Map(),
      baseMaterials: new Map(),
      finishMaterials: new Map(),
    };
    sceneCaches.set(scene, cache);
    scene.onDisposeObservable.addOnce(() => {
      cache?.textures.clear();
      cache?.baseMaterials.clear();
      cache?.finishMaterials.clear();
      sceneCaches.delete(scene);
    });
  }
  return cache;
}

function canLoadTextures(scene: Scene): boolean {
  return (
    typeof document !== "undefined" &&
    scene.getEngine().getClassName() !== "NullEngine"
  );
}

function getPbrTexture(
  scene: Scene,
  setId: WeaponPbrSetId,
  channel: "albedo" | "normal" | "arm",
  uScale = 2,
  vScale = 2,
  quality: WeaponQualityTier = "high",
): Texture | null {
  if (!canLoadTextures(scene)) return null;
  const entry = WEAPON_PBR_ASSETS[setId];
  const file = entry[channel];
  const url = entry.basePath + file;
  const cacheKey = `${url}|${uScale}|${vScale}`;
  const cache = getCache(scene);
  let tex = cache.textures.get(cacheKey);
  if (!tex) {
    tex = new Texture(url, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
    tex.name = `wpn-pbr-${setId}-${channel}`;
    tex.gammaSpace = channel === "albedo";
    tex.uScale = uScale;
    tex.vScale = vScale;
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.anisotropicFilteringLevel = quality === "high" ? 8 : 4;
    cache.textures.set(cacheKey, tex);
  }
  return tex;
}

function applyRimFresnel(
  mat: StandardMaterial,
  color: Color3,
  bias: number,
  power: number,
) {
  const fresnel = new FresnelParameters();
  fresnel.isEnabled = true;
  fresnel.bias = bias;
  fresnel.power = power;
  fresnel.leftColor = color;
  fresnel.rightColor = Color3.Black();
  mat.emissiveFresnelParameters = fresnel;
}

interface RoleConfig {
  diffuse: string;
  specular: string;
  specularPower: number;
  emissive?: string;
  disableLighting?: boolean;
  pbrSet?: WeaponPbrSetId;
  useAlbedoMap?: boolean;
  bumpLevel?: number;
  uvScale?: number;
  fresnel?: [string, number, number];
}

const ROLE_SPECS: Record<WeaponSurfaceRole, RoleConfig> = {
  steel: {
    diffuse: "#687582",
    specular: "#c2d0de",
    specularPower: 84,
    pbrSet: "metal_plate_02",
    useAlbedoMap: true,
    bumpLevel: 0.42,
    uvScale: 2.6,
    fresnel: ["#61758a", 0.1, 3.0],
  },
  bluedSteel: {
    diffuse: "#3f4f60",
    specular: "#b0c4d9",
    specularPower: 96,
    pbrSet: "blue_metal_plate",
    useAlbedoMap: true,
    bumpLevel: 0.36,
    uvScale: 2.4,
    fresnel: ["#55708c", 0.09, 3.1],
  },
  darkMetal: {
    diffuse: "#2c3540",
    specular: "#8696a8",
    specularPower: 72,
    pbrSet: "blue_metal_plate",
    useAlbedoMap: false,
    bumpLevel: 0.3,
    uvScale: 3.0,
    fresnel: ["#3e4f61", 0.08, 3.4],
  },
  chrome: {
    diffuse: "#d6e0e8",
    specular: "#ffffff",
    specularPower: 148,
    pbrSet: "metal_plate_02",
    useAlbedoMap: false,
    bumpLevel: 0.18,
    uvScale: 3.0,
    fresnel: ["#e4eef8", 0.14, 2.3],
  },
  wood: {
    diffuse: "#9a623a",
    specular: "#6b4e38",
    specularPower: 34,
    pbrSet: "american_walnut_veneer",
    useAlbedoMap: true,
    bumpLevel: 0.48,
    uvScale: 2.0,
    fresnel: ["#5c3b24", 0.05, 4.0],
  },
  darkWood: {
    diffuse: "#62412c",
    specular: "#4e3a2d",
    specularPower: 38,
    pbrSet: "smoked_walnut_veneer",
    useAlbedoMap: true,
    bumpLevel: 0.45,
    uvScale: 2.2,
  },
  polymer: {
    diffuse: "#303842",
    specular: "#4d5764",
    specularPower: 28,
    pbrSet: "rubber_tiles",
    useAlbedoMap: false,
    bumpLevel: 0.22,
    uvScale: 4.5,
  },
  rubber: {
    diffuse: "#222830",
    specular: "#3a424d",
    specularPower: 20,
    pbrSet: "rubber_tiles",
    useAlbedoMap: true,
    bumpLevel: 0.52,
    uvScale: 5.0,
  },
  leather: {
    diffuse: "#3b2c22",
    specular: "#45372e",
    specularPower: 22,
    pbrSet: "fabric_leather_02",
    useAlbedoMap: true,
    bumpLevel: 0.55,
    uvScale: 3.2,
  },
  brass: {
    diffuse: "#c5983e",
    specular: "#ffe29a",
    specularPower: 118,
    pbrSet: "metal_plate_02",
    useAlbedoMap: false,
    bumpLevel: 0.2,
    uvScale: 3.0,
    fresnel: ["#d8ad4f", 0.1, 2.8],
  },
  shellRed: {
    diffuse: "#a82424",
    specular: "#df7070",
    specularPower: 46,
  },
  opticGlass: {
    diffuse: "#145369",
    specular: "#9be8ff",
    specularPower: 180,
    emissive: "#0d3a4b",
    fresnel: ["#67d4f6", 0.25, 2.0],
  },
  railGlow: {
    diffuse: "#38d9ff",
    specular: "#c8f6ff",
    specularPower: 96,
    emissive: "#28c7f5",
    disableLighting: true,
  },
  sightDot: {
    diffuse: "#e8fff2",
    specular: "#ffffff",
    specularPower: 64,
    emissive: "#8cf5b5",
    disableLighting: true,
  },
  glove: {
    diffuse: "#1e2730",
    specular: "#2f3a45",
    specularPower: 18,
    pbrSet: "fabric_leather_02",
    useAlbedoMap: true,
    bumpLevel: 0.4,
    uvScale: 3.5,
  },
  gloveAccent: {
    diffuse: "#334150",
    specular: "#516173",
    specularPower: 28,
    pbrSet: "rubber_tiles",
    useAlbedoMap: false,
    bumpLevel: 0.32,
    uvScale: 4.0,
  },
};

/**
 * Returns a cached realistic weapon base material (gunmetal, walnut wood, polymer,
 * rubber grip, brass, optics glass, etc.) backed by Poly Haven CC0 1K PBR normal/albedo
 * maps in the browser and deterministic StandardMaterial properties in NullEngine.
 */
export function getWeaponRoleMaterial(
  scene: Scene,
  role: WeaponSurfaceRole,
  quality: WeaponQualityTier = "high",
): StandardMaterial {
  const cache = getCache(scene);
  const key = `wpn-role-${role}-${quality}`;
  let mat = cache.baseMaterials.get(key);
  if (mat) return mat;

  const spec = ROLE_SPECS[role];
  mat = new StandardMaterial(key, scene);
  mat.diffuseColor = Color3.FromHexString(spec.diffuse);
  mat.specularColor = Color3.FromHexString(spec.specular);
  mat.specularPower = spec.specularPower;
  if (spec.emissive) {
    mat.emissiveColor = Color3.FromHexString(spec.emissive);
  }
  if (spec.disableLighting) {
    mat.disableLighting = true;
  }

  if (canLoadTextures(scene) && spec.pbrSet && quality !== "low") {
    const scale = spec.uvScale ?? 2.4;
    if (spec.useAlbedoMap) {
      const albedo = getPbrTexture(scene, spec.pbrSet, "albedo", scale, scale, quality);
      if (albedo) {
        mat.diffuseTexture = albedo;
        // Blend diffuse color subtly so wood/steel keeps true material hue without washing out
        const tint = Color3.FromHexString(spec.diffuse);
        mat.diffuseColor = Color3.Lerp(Color3.White(), tint, role === "wood" || role === "darkWood" ? 0.52 : 0.72);
      }
    }
    if (quality === "high" && spec.bumpLevel) {
      const normal = getPbrTexture(scene, spec.pbrSet, "normal", scale, scale, quality);
      if (normal) {
        mat.bumpTexture = normal;
        mat.bumpTexture.level = spec.bumpLevel;
        mat.invertNormalMapY = true;
      }
    }
  }

  if (spec.fresnel && !spec.disableLighting && quality !== "low") {
    const [hex, bias, power] = spec.fresnel;
    applyRimFresnel(mat, Color3.FromHexString(hex), bias, power);
    if (!spec.emissive) {
      mat.emissiveColor = Color3.FromHexString(hex).scale(0.18);
    }
  }

  mat.freeze();
  cache.baseMaterials.set(key, mat);
  return mat;
}

/**
 * Shared cosmetic finish material resolver used identically across FP viewmodel,
 * TP remote players, dropped physical weapons, spectator view, and 3D Inventory Preview.
 * Preserves canonical material naming ('finish-' + item.id) and texture contracts.
 */
export function resolveFinishMaterial(
  scene: Scene,
  finish: Cosmetic,
  quality: WeaponQualityTier = "high",
): StandardMaterial {
  const cache = getCache(scene);
  const key = "finish-" + finish.id;
  let mat = cache.finishMaterials.get(key);
  if (mat) return mat;

  const appearance = finishAppearance(finish);
  mat = new StandardMaterial(key, scene);
  mat.diffuseColor = Color3.FromHexString(appearance.base);
  mat.specularColor = Color3.Lerp(
    Color3.White(),
    Color3.FromHexString(appearance.accent),
    appearance.metallic > 0.7 ? 0.42 : 0.24,
  ).scale(appearance.metallic > 0.7 ? 1.0 : 0.72);
  mat.specularPower = appearance.specularPower;
  // Subtle self-lit coat preserves skin readability in dark interior corridors
  // while keeping realistic directional shading and metallic highlights.
  mat.emissiveColor = Color3.White().scale(appearance.glow);

  if (canLoadTextures(scene)) {
    const url = finishTextureUrl(finish);
    let paintTex = cache.textures.get(url);
    if (!paintTex) {
      paintTex = new Texture(url, scene, false, false, Texture.TRILINEAR_SAMPLINGMODE);
      paintTex.name = key + "-shared-paint";
      paintTex.gammaSpace = true;
      paintTex.wrapU = Texture.WRAP_ADDRESSMODE;
      paintTex.wrapV = Texture.WRAP_ADDRESSMODE;
      paintTex.anisotropicFilteringLevel = quality === "high" ? 8 : 4;
      cache.textures.set(url, paintTex);
    }
    mat.diffuseTexture = paintTex;
    mat.emissiveTexture = paintTex;
    mat.diffuseColor = Color3.White();

    // Pair the authored skin atlas with a real Poly Haven CC0 normal map for tactile gunmetal/ceramic/carbon relief
    if (quality !== "low") {
      const normal = getPbrTexture(scene, appearance.pbrSet, "normal", 2.2, 2.2, quality);
      if (normal) {
        mat.bumpTexture = normal;
        mat.bumpTexture.level = appearance.bumpLevel;
        mat.invertNormalMapY = true;
      }
    }
  }

  mat.freeze();
  cache.finishMaterials.set(key, mat);
  return mat;
}

/**
 * Applies (or clears) a cosmetic weapon finish across any sculpted weapon hierarchy
 * (first-person viewmodel, third-person held weapon, dropped world weapon, or 3D preview).
 */
export function applyWeaponCosmetic(
  root: TransformNode,
  weapon: WeaponId,
  finish: Cosmetic | undefined,
  scene: Scene,
  quality: WeaponQualityTier = "high",
): void {
  const mat = finish ? resolveFinishMaterial(scene, finish, quality) : undefined;
  const targetKnifeStyle = finish?.knife || "default";

  for (const mesh of root.getChildMeshes()) {
    if (!mesh.metadata?.baseMaterial) {
      mesh.metadata = { ...mesh.metadata, baseMaterial: mesh.material };
    }
    if (weapon === "knife" && mesh.metadata?.knifeStyle) {
      mesh.setEnabled(mesh.metadata.knifeStyle === targetKnifeStyle);
    }
    const isBlade = mesh.metadata?.knifePart === "blade";
    const isKnifeHandle = weapon === "knife" && !isBlade;
    const isSkinnablePart =
      mesh.metadata?.skinnable === true ||
      /receiver|stock|barrel|magazine|pump/.test(mesh.name);
    const tinted = !isKnifeHandle && (weapon === "knife" ? isBlade : isSkinnablePart);
    mesh.material = mat && tinted ? mat : mesh.metadata.baseMaterial;
  }
}
