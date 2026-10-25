/**
 * Kapstorial Map Generator
 * Generates high-fidelity 2D terrain grids (300 x 200) for Territorial.io clone
 * 
 * Terrain cell values:
 * 0 = Water / Ocean (Passable by boat)
 * 1 = Land / Neutral Land (Conquerable)
 * 2 = Mountains / Impassable Obstacle
 */

const BASE_WIDTH = 300;
export const MAP_WIDTH = 600;
const BASE_HEIGHT = 200;
export const MAP_HEIGHT = 400;
export const TOTAL_PIXELS = MAP_WIDTH * MAP_HEIGHT;

export type MapType = 'world' | 'europe' | 'anatolia' | 'archipelago' | 'arena';

export interface MapMetadata {
  id: MapType;
  name: string;
  description: string;
  landPercentage: number;
  previewThumbnailColor: string;
}

export const MAP_PRESETS: Record<MapType, MapMetadata> = {
  world: {
    id: 'world',
    name: 'Dünya (World)',
    description: 'Kıtalar, okyanuslar ve stratejik dağ geçitleri.',
    landPercentage: 35,
    previewThumbnailColor: '#1e3a8a'
  },
  europe: {
    id: 'europe',
    name: 'Avrupa (Europe)',
    description: 'Akdeniz havzası, Alpler ve geniş Avrupa ovaları.',
    landPercentage: 45,
    previewThumbnailColor: '#065f46'
  },
  anatolia: {
    id: 'anatolia',
    name: 'Türkiye (Anatolia)',
    description: 'Üç tarafı denizlerle çevrili, Toroslar ve Karadeniz dağları.',
    landPercentage: 55,
    previewThumbnailColor: '#991b1b'
  },
  archipelago: {
    id: 'archipelago',
    name: 'Adalar (Archipelago)',
    description: 'Deniz savaşları ve çıkarma gemileri odaklı takımada haritası.',
    landPercentage: 28,
    previewThumbnailColor: '#0e7490'
  },
  arena: {
    id: 'arena',
    name: 'Arena (Simetrik)',
    description: 'Tamamen dengeli, adil rekabetçi dairesel savaş arenası.',
    landPercentage: 60,
    previewThumbnailColor: '#854d0e'
  }
};

/**
 * Procedural Perlin-like 2D value noise for realistic natural coastlines and contours
 */
class NoiseGenerator {
  private p: number[] = [];

  constructor(seed = 12345) {
    const perm: number[] = [];
    for (let i = 0; i < 256; i++) perm.push(i);
    // Shuffle with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 16807) % 2147483647;
      const j = s % (i + 1);
      const tmp = perm[i];
      perm[i] = perm[j];
      perm[j] = tmp;
    }
    this.p = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.p[i] = perm[i & 255];
    }
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));
    return (this.lerp(v, x1, x2) + 1) / 2; // Return [0, 1]
  }

  public fbm(x: number, y: number, octaves = 4): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return total / maxValue;
  }
}

/**
 * Generates a 300x200 Terrain Array:
 * 0: Water
 * 1: Neutral Land
 * 2: Mountain
 */
function generateBaseTerrainMap(type: MapType, seed = Math.floor(Math.random() * 100000)): Uint8Array {
  const grid = new Uint8Array(BASE_WIDTH * BASE_HEIGHT); // Defaults to 0 (Water)
  const noise = new NoiseGenerator(seed);

  const getIdx = (x: number, y: number) => y * BASE_WIDTH + x;

  if (type === 'arena') {
    // Perfectly balanced circular arena with concentric rings, mountain rings, and 4 bridge chokepoints
    const cx = BASE_WIDTH / 2;
    const cy = BASE_HEIGHT / 2;
    const maxR = Math.min(BASE_WIDTH, BASE_HEIGHT) * 0.44;

    for (let y = 0; y < BASE_HEIGHT; y++) {
      for (let x = 0; x < BASE_WIDTH; x++) {
        const dx = x - cx;
        const dy = (y - cy) * 1.35; // Aspect correction
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        if (dist <= maxR) {
          // Inside arena circle
          const n = noise.fbm(x * 0.05, y * 0.05, 3);
          
          // Mountain barrier at radius ~65% with 4 openings (gates)
          const mountainR = maxR * 0.65;
          const isGate = Math.abs(Math.sin(angle * 2)) < 0.2; // 4 cardinal gates

          if (Math.abs(dist - mountainR) < 5 && !isGate) {
            grid[getIdx(x, y)] = 2; // Mountain
          } else if (dist < maxR * 0.12 && n > 0.6) {
            // Small central mountain monument
            grid[getIdx(x, y)] = 2;
          } else {
            grid[getIdx(x, y)] = 1; // Land
          }
        } else {
          grid[getIdx(x, y)] = 0; // Water moat
        }
      }
    }
    return grid;
  }

  if (type === 'archipelago') {
    // 12-18 distinct islands scattered across vast oceans
    const islandCenters: Array<{ x: number; y: number; r: number }> = [
      { x: 50, y: 50, r: 28 },
      { x: 120, y: 40, r: 24 },
      { x: 190, y: 55, r: 32 },
      { x: 260, y: 45, r: 22 },
      { x: 70, y: 110, r: 30 },
      { x: 150, y: 100, r: 38 },
      { x: 230, y: 115, r: 34 },
      { x: 45, y: 160, r: 26 },
      { x: 115, y: 165, r: 30 },
      { x: 195, y: 160, r: 28 },
      { x: 265, y: 155, r: 25 },
      // Smaller stepping stone isles
      { x: 150, y: 155, r: 16 },
      { x: 90, y: 75, r: 15 },
      { x: 225, y: 70, r: 16 }
    ];

    for (let y = 0; y < BASE_HEIGHT; y++) {
      for (let x = 0; x < BASE_WIDTH; x++) {
        let isLand = false;
        let isMountain = false;

        const n = noise.fbm(x * 0.04, y * 0.04, 3);

        for (const isle of islandCenters) {
          const dx = x - isle.x;
          const dy = (y - isle.y) * 1.2;
          const d = Math.sqrt(dx * dx + dy * dy);
          const effectiveR = isle.r * (0.75 + n * 0.5);

          if (d < effectiveR) {
            isLand = true;
            if (d < effectiveR * 0.35 && n > 0.58) {
              isMountain = true;
            }
            break;
          }
        }

        if (isMountain) {
          grid[getIdx(x, y)] = 2;
        } else if (isLand) {
          grid[getIdx(x, y)] = 1;
        } else {
          grid[getIdx(x, y)] = 0;
        }
      }
    }
    return grid;
  }

  if (type === 'anatolia') {
    // High accuracy Anatolian peninsula (Turkey):
    // Black sea to North, Mediterranean to South, Aegean & Marmara to West
    // Taurus mountains south, Pontic mountains north, Ararat/Eastern highlands
    for (let y = 0; y < BASE_HEIGHT; y++) {
      for (let x = 0; x < BASE_WIDTH; x++) {
        const nx = x / BASE_WIDTH; // 0..1
        const ny = y / BASE_HEIGHT; // 0..1

        const nCoast = noise.fbm(x * 0.03, y * 0.03, 4);
        const nMountain = noise.fbm(x * 0.06 + 50, y * 0.06 + 50, 3);

        // Anatolia Bounding Shape
        let landScore = 0;

        // Main plateau: extends from x=0.15 to x=0.92, y=0.25 to y=0.75
        if (nx >= 0.12 && nx <= 0.94 && ny >= 0.22 && ny <= 0.78) {
          const centerY = 0.48;
          const halfH = 0.22 - Math.abs(nx - 0.5) * 0.05; // slightly narrows at ends
          const distY = Math.abs(ny - centerY);

          if (distY < halfH) {
            landScore = 1.0;
          } else {
            landScore = 1.0 - (distY - halfH) / 0.08;
          }
        }

        // Aegean islands & Greece coastline hint on far west (nx < 0.15)
        if (nx < 0.16 && nx > 0.04 && ny > 0.30 && ny < 0.75) {
          if (nCoast > 0.52) landScore = Math.max(landScore, 0.9);
        }

        // Cyprus island to the south (nx ~ 0.52, ny ~ 0.84)
        const dCyp = Math.hypot((nx - 0.54) * 2, ny - 0.84);
        if (dCyp < 0.06 && nCoast > 0.40) {
          landScore = Math.max(landScore, 1.0);
        }

        // Marmara Sea cutout (nx ~ 0.22, ny ~ 0.30)
        const dMarmara = Math.hypot((nx - 0.23) * 1.8, ny - 0.31);
        if (dMarmara < 0.05) {
          landScore -= 1.2;
        }

        // Add fractal organic noise to borders
        const finalLand = (landScore + (nCoast - 0.5) * 0.7) > 0.45;

        if (finalLand) {
          // Mountains placement:
          // 1. Pontic Mountains along Northern Black Sea coast (ny: 0.28..0.38, nx: 0.28..0.85)
          const isPontic = ny > 0.27 && ny < 0.38 && nx > 0.28 && nx < 0.85 && nMountain > 0.55;
          // 2. Taurus Mountains along Southern Coast (ny: 0.58..0.70, nx: 0.30..0.75)
          const isTaurus = ny > 0.58 && ny < 0.70 && nx > 0.30 && nx < 0.75 && nMountain > 0.56;
          // 3. Eastern Anatolia high peaks (nx > 0.75, ny > 0.35 && ny < 0.65)
          const isEast = nx > 0.75 && ny > 0.35 && ny < 0.65 && nMountain > 0.52;

          if (isPontic || isTaurus || isEast) {
            grid[getIdx(x, y)] = 2; // Mountain
          } else {
            grid[getIdx(x, y)] = 1; // Land
          }
        } else {
          grid[getIdx(x, y)] = 0; // Sea
        }
      }
    }
    return grid;
  }

  if (type === 'europe') {
    // Europe + Scandinavia + Mediterranean + UK + Iberian peninsula
    for (let y = 0; y < BASE_HEIGHT; y++) {
      for (let x = 0; x < BASE_WIDTH; x++) {
        const nx = x / BASE_WIDTH;
        const ny = y / BASE_HEIGHT;
        const n = noise.fbm(x * 0.035, y * 0.035, 4);
        const nMount = noise.fbm(x * 0.065 + 100, y * 0.065 + 100, 3);

        let land = false;

        // British Isles (nx 0.22..0.34, ny 0.25..0.48)
        if (nx > 0.22 && nx < 0.34 && ny > 0.25 && ny < 0.48 && n > 0.46) {
          land = true;
        }
        // Scandinavia (nx 0.45..0.68, ny 0.05..0.32)
        if (nx > 0.45 && nx < 0.68 && ny > 0.05 && ny < 0.32 && n > 0.44) {
          land = true;
        }
        // Mainland Europe (France, Germany, Poland, Russia, Balkans)
        if (nx > 0.28 && nx < 0.95 && ny > 0.32 && ny < 0.72) {
          const distToMed = ny > 0.65 ? (ny - 0.65) : 0;
          if (n + 0.3 - distToMed * 2.5 > 0.45) {
            land = true;
          }
        }
        // Iberia (Spain/Portugal)
        if (nx > 0.12 && nx < 0.29 && ny > 0.52 && ny < 0.78 && n > 0.42) {
          land = true;
        }
        // Italy boot
        if (nx > 0.46 && nx < 0.56 && ny > 0.60 && ny < 0.82 && n > 0.47) {
          land = true;
        }
        // Greece & Anatolia bridge
        if (nx > 0.60 && nx < 0.88 && ny > 0.68 && ny < 0.84 && n > 0.45) {
          land = true;
        }

        // Mediterranean Sea cut (ny > 0.70 && nx < 0.60)
        if (ny > 0.73 && nx > 0.28 && nx < 0.46) {
          land = false;
        }

        if (land) {
          // Alps (nx ~0.42..0.52, ny ~0.50..0.58)
          const isAlps = nx > 0.40 && nx < 0.52 && ny > 0.50 && ny < 0.58 && nMount > 0.50;
          // Pyrenees (nx ~0.26..0.32, ny ~0.56..0.62)
          const isPyrenees = nx > 0.26 && nx < 0.32 && ny > 0.56 && ny < 0.62 && nMount > 0.54;
          // Carpathians (nx ~0.58..0.68, ny ~0.48..0.56)
          const isCarpathians = nx > 0.58 && nx < 0.68 && ny > 0.48 && ny < 0.56 && nMount > 0.52;

          if (isAlps || isPyrenees || isCarpathians) {
            grid[getIdx(x, y)] = 2; // Mountain
          } else {
            grid[getIdx(x, y)] = 1; // Land
          }
        } else {
          grid[getIdx(x, y)] = 0; // Water
        }
      }
    }
    return grid;
  }

  // DEFAULT: 'world'
  // World Map: Americas (West), Eurasia/Africa (Center/East), Australia (Southeast)
  for (let y = 0; y < BASE_HEIGHT; y++) {
    for (let x = 0; x < BASE_WIDTH; x++) {
      const nx = x / BASE_WIDTH;
      const ny = y / BASE_HEIGHT;
      const n = noise.fbm(x * 0.03, y * 0.03, 4);
      const nMount = noise.fbm(x * 0.06 + 200, y * 0.06 + 200, 3);

      let land = false;

      // North America
      if (nx > 0.06 && nx < 0.32 && ny > 0.12 && ny < 0.45) {
        if (n + (0.35 - Math.hypot(nx - 0.18, ny - 0.28) * 1.5) > 0.38) land = true;
      }
      // South America
      if (nx > 0.18 && nx < 0.34 && ny > 0.45 && ny < 0.88) {
        if (n + (0.35 - Math.hypot(nx - 0.25, ny - 0.62) * 1.6) > 0.38) land = true;
      }
      // Europe & Asia (Eurasia)
      if (nx > 0.36 && nx < 0.90 && ny > 0.10 && ny < 0.55) {
        if (n + (0.42 - Math.hypot(nx - 0.62, ny - 0.30) * 1.2) > 0.35) land = true;
      }
      // Africa
      if (nx > 0.40 && nx < 0.64 && ny > 0.42 && ny < 0.85) {
        if (n + (0.38 - Math.hypot(nx - 0.52, ny - 0.60) * 1.4) > 0.38) land = true;
      }
      // Australia
      if (nx > 0.72 && nx < 0.92 && ny > 0.62 && ny < 0.88) {
        if (n + (0.32 - Math.hypot(nx - 0.82, ny - 0.74) * 2.0) > 0.38) land = true;
      }

      if (land) {
        // Rockies & Andes on the west of Americas
        const isRockies = nx > 0.10 && nx < 0.18 && ny > 0.15 && ny < 0.40 && nMount > 0.54;
        const isAndes = nx > 0.19 && nx < 0.24 && ny > 0.48 && ny < 0.82 && nMount > 0.52;
        // Himalayas in southern Asia
        const isHimalayas = nx > 0.65 && nx < 0.78 && ny > 0.36 && ny < 0.44 && nMount > 0.50;
        // Alps
        const isAlps = nx > 0.45 && nx < 0.52 && ny > 0.26 && ny < 0.32 && nMount > 0.55;

        if (isRockies || isAndes || isHimalayas || isAlps) {
          grid[getIdx(x, y)] = 2; // Mountain
        } else {
          grid[getIdx(x, y)] = 1; // Land
        }
      } else {
        grid[getIdx(x, y)] = 0; // Ocean
      }
    }
  }

  return grid;
}

export function generateTerrainMap(type: MapType, seed = Math.floor(Math.random() * 100000)): Uint8Array {
  const normalizedSeed = Number.isFinite(seed) ? (Math.abs(Math.trunc(seed)) % 2147483646) + 1 : 1;
  const base = generateBaseTerrainMap(type, normalizedSeed);
  const result = new Uint8Array(TOTAL_PIXELS);
  for (let y = 0; y < MAP_HEIGHT; y++) for (let x = 0; x < MAP_WIDTH; x++) {
    result[y * MAP_WIDTH + x] = base[Math.floor(y / 2) * BASE_WIDTH + Math.floor(x / 2)];
  }
  return result;
}

/**
 * Finds all valid neutral land pixels where a player or bot can spawn
 */
export function getValidSpawnPixels(terrain: Uint8Array): number[] {
  const valid: number[] = [];
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === 1) {
      valid.push(i);
    }
  }
  return valid;
}
