import type { Cosmetic } from "./cosmetics";
import type { WeaponPbrSetId } from "./weaponAssets";

export type FinishMaterialKind =
  | "tactical_camo"
  | "anodized_metal"
  | "carbon_fiber"
  | "damascus_steel"
  | "engraved_gold"
  | "ceramic_pearl"
  | "collector_fade"
  | "military_polymer";

export interface FinishPbrProfile {
  base: string;
  accent: string;
  glow: number;
  eclipse: boolean;
  materialKind: FinishMaterialKind;
  pbrSet: WeaponPbrSetId;
  metallic: number;
  roughness: number;
  specularPower: number;
  bumpLevel: number;
}

/**
 * Deterministic PBR finish profile and authored high-resolution weapon coat atlas.
 * Shared across first-person viewmodels, third-person weapons, dropped ground weapons,
 * spectator views, and 3D inventory previews.
 */
export function finishAppearance(item: Cosmetic): FinishPbrProfile {
  const eclipse = item.id.endsWith("-neon-3");
  const base = eclipse ? "#a45a09" : item.color;
  const accent = item.accent;
  const glow =
    item.rarity === "uncommon"
      ? 0.2
      : item.rarity === "rare"
        ? 0.25
        : item.rarity === "epic"
          ? 0.32
          : 0.38;

  let materialKind: FinishMaterialKind = "anodized_metal";
  let pbrSet: WeaponPbrSetId = "metal_plate_02";
  let metallic = 0.72;
  let roughness = 0.32;
  let specularPower = 96;
  let bumpLevel = 0.42;

  if (item.pattern === 0) {
    materialKind = "tactical_camo";
    pbrSet = "blue_metal_plate";
    metallic = 0.28;
    roughness = 0.62;
    specularPower = 44;
    bumpLevel = 0.34;
  } else if (item.pattern === 1 || item.pattern === 6) {
    materialKind = "military_polymer";
    pbrSet = "blue_metal_plate";
    metallic = 0.42;
    roughness = 0.48;
    specularPower = 64;
    bumpLevel = 0.38;
  } else if (item.pattern === 5 || item.pattern === 9 || item.pattern === 11) {
    materialKind = "carbon_fiber";
    pbrSet = "fabric_leather_02";
    metallic = 0.52;
    roughness = 0.36;
    specularPower = 92;
    bumpLevel = 0.5;
  } else if (item.pattern === 7 || item.pattern === 12 || item.pattern === 13) {
    materialKind = "damascus_steel";
    pbrSet = "metal_plate_02";
    metallic = 0.88;
    roughness = 0.22;
    specularPower = 136;
    bumpLevel = 0.45;
  } else if (item.pattern === 16 || item.pattern === 19 || eclipse) {
    materialKind = "engraved_gold";
    pbrSet = "metal_plate_02";
    metallic = 0.92;
    roughness = 0.19;
    specularPower = 148;
    bumpLevel = 0.48;
  } else if (item.pattern === 14 || item.pattern === 15 || item.pattern === 17) {
    materialKind = "ceramic_pearl";
    pbrSet = "marble_01";
    metallic = 0.56;
    roughness = 0.24;
    specularPower = 128;
    bumpLevel = 0.36;
  } else if (item.pattern === 3 || item.pattern === 4 || item.pattern === 2) {
    materialKind = "collector_fade";
    pbrSet = "metal_plate_02";
    metallic = 0.84;
    roughness = 0.22;
    specularPower = 132;
    bumpLevel = 0.32;
  }

  return {
    base,
    accent,
    glow,
    eclipse,
    materialKind,
    pbrSet,
    metallic,
    roughness,
    specularPower,
    bumpLevel,
  };
}

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [120, 128, 138];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function shadeHex(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const toHex = (v: number) => clampByte(v).toString(16).padStart(2, "0");
  return `#${toHex(r * factor)}${toHex(g * factor)}${toHex(b * factor)}`;
}

function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const toHex = (v: number) => clampByte(v).toString(16).padStart(2, "0");
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`;
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const cache = new Map<string, string>();

/**
 * Generates a rich 512x512 authored SVG weapon finish atlas combining:
 * - Multi-stop anodized/matte base coat with directional brushed gunmetal micro-grain
 * - Weapon-finish-specific high-craft patterns (camo, carbon weave, Damascus waves,
 *   tactical hex armor, engraved filigree, geometric splinter, tiger stripe, collector fade)
 * - Machined panel seams, subtle rivets, edge-wear specular highlights, and factory micro-stencils
 * Deterministic and cached by cosmetic ID so inventory thumbnails and 3D PBR finishes match 1:1.
 */
export function finishTextureUrl(item: Cosmetic): string {
  const profile = finishAppearance(item);
  const { base, accent, eclipse } = profile;
  const cacheKey = `${base}|${accent}|${item.pattern}|${eclipse ? 1 : 0}|${item.variant ?? -1}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const darkBase = shadeHex(base, 0.54);
  const deepBase = shadeHex(base, 0.34);
  const midBlend = mixHex(base, accent, 0.42);
  const brightAccent = mixHex(accent, "#ffffff", 0.35);
  const seed = hashSeed(cacheKey);
  const variant = item.variant ?? seed % 12;

  let detail = "";

  // Subtle brushed machined metal horizontal micro-grain + factory receiver panel lines
  let grain = "";
  for (let i = 0; i < 28; i++) {
    const y = ((i * 19 + (seed % 17)) % 508) + 2;
    grain += `<line x1="0" y1="${y}" x2="512" y2="${y}" stroke="${i % 2 ? "#ffffff" : "#000000"}" stroke-opacity="${i % 2 ? "0.055" : "0.08"}" stroke-width="${i % 5 === 0 ? 1.5 : 0.8}"/>`;
  }

  if (eclipse) {
    // Burnished bronze / dark steel eclipse with gold-edged plasma slashes & machined grooves
    detail += `<rect x="0" y="0" width="512" height="512" fill="${deepBase}" opacity="0.45"/>`;
    for (let i = 0; i < 6; i++) {
      const y = 32 + i * 82;
      detail += `<path d="M-20 ${y + 52} L532 ${y - 44}" stroke="${accent}" stroke-width="${i % 2 ? 7 : 3}" opacity="${i % 2 ? 0.78 : 0.45}"/>`;
      detail += `<path d="M-20 ${y + 44} L532 ${y - 52}" stroke="${brightAccent}" stroke-width="1.5" opacity="0.65"/>`;
    }
    detail += `<circle cx="340" cy="240" r="118" fill="none" stroke="${accent}" stroke-width="4" opacity="0.55"/>`;
    detail += `<circle cx="340" cy="240" r="106" fill="${deepBase}" opacity="0.5"/>`;
  } else if (item.pattern === 0) {
    // Realistic Multi-Tone Tactical Woodland / Urban Camouflage
    for (let i = 0; i < 26; i++) {
      const cx = ((i * 137 + seed) % 512);
      const cy = ((i * 211 + seed * 3) % 512);
      const rx = 28 + ((i * 17) % 54);
      const ry = 16 + ((i * 13) % 34);
      const rot = (i * 37 + variant * 19) % 180;
      const fill = i % 3 === 0 ? darkBase : i % 3 === 1 ? accent : midBlend;
      detail += `<path d="M${cx - rx} ${cy} Q${cx - rx * 0.4} ${cy - ry * 1.2} ${cx + rx * 0.2} ${cy - ry * 0.6} T${cx + rx} ${cy + ry * 0.2} Q${cx + rx * 0.3} ${cy + ry * 1.1} ${cx - rx * 0.4} ${cy + ry * 0.7} Z" fill="${fill}" opacity="${i % 3 === 1 ? 0.68 : 0.56}" transform="rotate(${rot} ${cx} ${cy})"/>`;
    }
    // Digital pixel micro-breakup overlay
    for (let i = 0; i < 36; i++) {
      const x = ((i * 97 + seed) % 480);
      const y = ((i * 149 + seed) % 480);
      detail += `<rect x="${x}" y="${y}" width="${10 + (i % 4) * 6}" height="${6 + (i % 3) * 4}" fill="${i % 2 ? accent : deepBase}" opacity="0.34"/>`;
    }
  } else if (item.pattern === 1) {
    // Angular Splinter / Geometric Stealth Camo (CS:GO Asiimov / Redline / Shattered style)
    for (let i = 0; i < 20; i++) {
      const x = ((i * 119 + seed) % 540) - 30;
      const y = ((i * 173 + seed) % 540) - 30;
      const w = 70 + (i % 4) * 35;
      const h = 45 + (i % 3) * 30;
      const tone = i % 4 === 0 ? accent : i % 4 === 1 ? darkBase : i % 4 === 2 ? midBlend : "#f8fafc";
      detail += `<polygon points="${x},${y} ${x + w},${y - h * 0.4} ${x + w * 0.7},${y + h} ${x - w * 0.25},${y + h * 0.65}" fill="${tone}" opacity="${tone === "#f8fafc" ? 0.24 : 0.62}"/>`;
    }
    // Crisp tactical racing stripes
    detail += `<path d="M0 176 L512 112 M0 192 L512 128" stroke="${accent}" stroke-width="5" opacity="0.82"/>`;
    detail += `<path d="M0 364 L512 300" stroke="${brightAccent}" stroke-width="2.5" opacity="0.58"/>`;
  } else if (item.pattern === 2) {
    // Fluid Hydrographic / Energy Wave Engraving
    for (let i = 0; i < 7; i++) {
      let d = `M${i * 78 - 10} 0`;
      for (let y = 24; y <= 512; y += 24) {
        d += ` L${i * 78 - 10 + Math.sin(y * 0.045 + i * 1.1) * 32} ${y}`;
      }
      detail += `<path d="${d}" fill="none" stroke="${accent}" stroke-width="14" opacity="0.16"/>`;
      detail += `<path d="${d}" fill="none" stroke="${accent}" stroke-width="3.6" opacity="0.88"/>`;
      detail += `<path d="${d}" fill="none" stroke="${brightAccent}" stroke-width="1.1" opacity="0.65"/>`;
    }
  } else if (item.pattern === 4) {
    // Bold Tiger-Stripe / Predator Slash Finish
    for (let i = 0; i < 11; i++) {
      const x = i * 54 - 70;
      detail += `<path d="M${x} 0 L${x + 48} 145 L${x + 28} 238 L${x + 115} 512 L${x + 76} 512 L${x - 10} 248 L${x + 12} 148 L${x - 30} 0 Z" fill="${accent}" opacity="0.84"/>`;
      detail += `<path d="M${x + 8} 0 L${x + 56} 145 L${x + 36} 238 L${x + 123} 512" fill="none" stroke="${brightAccent}" stroke-width="2" opacity="0.45"/>`;
    }
  } else if (item.pattern === 5) {
    // Woven Carbon-Fiber + Hexagonal Tactical Armor Mesh
    for (let y = 0; y < 512; y += 16) {
      for (let x = 0; x < 512; x += 16) {
        const alt = ((x + y) / 16) % 2 === 0;
        detail += `<rect x="${x}" y="${y}" width="14" height="7" rx="1" fill="${alt ? deepBase : darkBase}" opacity="0.58"/>`;
        detail += `<rect x="${x + 1}" y="${y + 8}" width="14" height="7" rx="1" fill="${alt ? darkBase : deepBase}" opacity="0.45"/>`;
      }
    }
    for (let y = -28; y < 540; y += 48) {
      for (let x = -28; x < 540; x += 56) {
        const dx = x + (Math.floor(y / 48) % 2 ? 28 : 0);
        detail += `<path d="M${dx} ${y} l24 14 v28 l-24 14 l-24 -14 v-28 Z" fill="none" stroke="${accent}" stroke-width="2.4" opacity="0.72"/>`;
      }
    }
  } else if (item.pattern === 6) {
    // Low-Poly Faceted Shard / Crystal Tactical Finish
    for (let i = 0; i < 38; i++) {
      const x = ((i * 131 + seed) % 512);
      const y = ((i * 89 + seed) % 512);
      const dx = 34 + (i % 5) * 16;
      const dy = 28 + (i % 4) * 18;
      detail += `<polygon points="${x},${y} ${x + dx},${y - dy * 0.6} ${x + dx * 0.25},${y + dy}" fill="${i % 3 === 0 ? brightAccent : i % 3 === 1 ? accent : darkBase}" opacity="${0.3 + (i % 3) * 0.2}"/>`;
    }
  } else if (item.pattern === 7) {
    // Authentic Folded Damascus Steel Concentric Ripples
    detail += `<rect x="0" y="0" width="512" height="512" fill="${darkBase}" opacity="0.35"/>`;
    for (let c = 0; c < 3; c++) {
      const cx = 120 + c * 145;
      const cy = 140 + ((c * 130) % 260);
      for (let i = 0; i < 14; i++) {
        detail += `<ellipse cx="${cx}" cy="${cy}" rx="${18 + i * 20}" ry="${9 + i * 11}" fill="none" stroke="${i % 2 ? accent : brightAccent}" stroke-width="${i % 3 === 0 ? 3 : 1.6}" transform="rotate(${-26 + c * 18} ${cx} ${cy})" opacity="${i % 2 ? 0.68 : 0.32}"/>`;
      }
    }
  } else if (item.pattern >= 8 && item.pattern <= 19) {
    // 12 Distinct Collector / Prism Crafted Finish Families (unique per weapon + variant)
    const phase = variant * 23;
    const motifIndex = item.pattern - 8;
    // Deep metallic under-coat diagonal bands
    detail += `<path d="M0 ${140 + (phase % 120)} L512 ${40 + (phase % 90)} L512 ${180 + (phase % 90)} L0 ${290 + (phase % 120)} Z" fill="${darkBase}" opacity="0.48"/>`;
    detail += `<path d="M0 ${370 - (phase % 80)} L512 ${260 - (phase % 80)} L512 ${310 - (phase % 80)} L0 ${420 - (phase % 80)} Z" fill="${midBlend}" opacity="0.34"/>`;

    let motifGroup = "";
    for (let i = 0; i < 14; i++) {
      const x = (i * 79 + phase * 2) % 512;
      const y = (i * 113 + phase * 3) % 512;
      const motifs = [
        // 8: Diagonal Anodized Ribbing
        `<path d="M${x} 0 l140 512 m-105 -512 l140 512"/>`,
        // 9: Circuit / Tactical PCB Trace
        `<path d="M0 ${y} h${x} v34 h${512 - x}"/><circle cx="${x}" cy="${y + 34}" r="6" fill="${accent}"/>`,
        // 10: Pulse Telemetry / Sonar Wave
        `<path d="M0 ${y} h120 l22 -38 l34 76 l22 -38 h314"/>`,
        // 11: Concentric Machined Squares
        `<path d="M${x} ${y} h58 v58 h-44 v-44 h30 v30"/>`,
        // 12: Guilloché Ribbon Waves
        `<path d="M0 ${y} q128 -68 256 0 t256 0"/>`,
        // 13: Orbital Topographic Rings
        `<ellipse cx="256" cy="256" rx="${34 + i * 17}" ry="${18 + i * 10}" transform="rotate(${phase + 32} 256 256)"/>`,
        // 14: Botanical / Arabesque Filigree
        `<path d="M${x} ${y} q-44 -54 0 -36 q44 -18 0 36 q54 -10 36 28 q-36 28 -36 -28 q-44 36 -36 0 Z"/>`,
        // 15: Alpine Ridge / Shatter Horizon
        `<path d="M0 ${y} l80 -24 l64 40 l100 -58 l100 58 l80 -30 l88 14"/>`,
        // 16: Heraldic Chevron & Crest
        `<path d="M${x} ${y} l-42 -32 l14 48 l28 22 l28 -22 l14 -48 Z"/>`,
        // 17: Porcelain / Marble Crackle Veins
        `<path d="M${x} ${y} c-72 -72 -72 72 0 0 s72 72 0 0"/>`,
        // 18: Dragon Scale / Armor Scallop
        `<path d="M${x} ${y} q32 58 64 0 q-32 18 -64 0 Z"/>`,
        // 19: Royal Crown & Sunburst Engraving
        `<path d="M${x} ${y} l-32 -44 l24 14 l8 -36 l8 36 l24 -14 l-32 44 Z"/>`,
      ];
      motifGroup += `<g fill="none" stroke="${i % 4 === 0 ? brightAccent : accent}" stroke-width="${i % 3 === 0 ? 4.2 : 2.1}" opacity="${0.4 + (i % 3) * 0.22}">${motifs[motifIndex]}</g>`;
    }
    detail += `<g transform="rotate(${(variant * 13) % 45 - 22} 256 256)">${motifGroup}</g>`;
    // Crisp weapon-specific serial stripe & precision accent bars
    detail += `<rect x="${28 + variant * 14}" y="446" width="84" height="9" rx="2" fill="${accent}" opacity="0.9"/>`;
    detail += `<rect x="${124 + variant * 14}" y="446" width="24" height="9" rx="2" fill="${brightAccent}" opacity="0.75"/>`;
  } else {
    // Pattern 3: Collector Metallic Fade / Nebula Iridescent Finish
    detail += `<ellipse cx="268" cy="210" rx="210" ry="125" fill="${accent}" opacity="0.34"/>`;
    detail += `<ellipse cx="140" cy="360" rx="165" ry="90" fill="${brightAccent}" opacity="0.22"/>`;
    for (let i = 0; i < 48; i++) {
      const cx = (i * 137 + seed) % 512;
      const cy = (i * 223 + seed) % 512;
      detail += `<circle cx="${cx}" cy="${cy}" r="${i % 7 === 0 ? 2.6 : 1.3}" fill="#ffffff" opacity="${i % 5 === 0 ? 0.85 : 0.45}"/>`;
    }
  }

  // Structural gunsmith receiver seams, chamfered edge wear & mounting rivets
  const hardwareOverlay = `
    <g opacity="0.32" stroke="#000000" stroke-width="1.6" fill="none">
      <line x1="0" y1="86" x2="512" y2="86"/>
      <line x1="0" y1="426" x2="512" y2="426"/>
      <path d="M128 0 V512 M384 0 V512" stroke-opacity="0.45" stroke-dasharray="18 10"/>
    </g>
    <g opacity="0.24" stroke="#ffffff" stroke-width="1.1" fill="none">
      <line x1="0" y1="88" x2="512" y2="88"/>
      <line x1="0" y1="428" x2="512" y2="428"/>
    </g>
    <g fill="#0c1218" stroke="#ffffff" stroke-opacity="0.28" stroke-width="1">
      <circle cx="44" cy="44" r="5"/><circle cx="468" cy="44" r="5"/>
      <circle cx="44" cy="468" r="5"/><circle cx="468" cy="468" r="5"/>
    </g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><defs><linearGradient id="coat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${darkBase}"/><stop offset=".24" stop-color="${base}"/><stop offset=".48" stop-color="${midBlend}"/><stop offset=".72" stop-color="${base}"/><stop offset="1" stop-color="${deepBase}"/></linearGradient><linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".34"/><stop offset=".16" stop-color="#ffffff" stop-opacity=".06"/><stop offset=".45" stop-color="#000000" stop-opacity=".08"/><stop offset=".72" stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#000000" stop-opacity=".28"/></linearGradient></defs><rect fill="url(#coat)" width="512" height="512"/>${grain}${detail}${hardwareOverlay}<rect fill="url(#sheen)" width="512" height="512"/></svg>`;

  const url = "data:image/svg+xml;base64," + btoa(svg);
  cache.set(cacheKey, url);
  return url;
}
