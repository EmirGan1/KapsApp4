import { Server as SocketIOServer } from "socket.io";
import { Client as LibsqlClient } from "@libsql/client";

export const MAP_SIZE = 4200;
export const RIVER_WIDTH = 220;

export interface RoyaleBuildingWall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoyaleDoorway {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RoyaleBuilding {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  floorType: 'wood' | 'concrete' | 'tiles' | 'metal';
  roofColor: string;
  doorways: RoyaleDoorway[];
  walls: RoyaleBuildingWall[];
}

export interface RoyaleBridge {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'wood' | 'stone';
}

export interface RoyaleBarrel {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
}

export interface RoyaleExplosionEffect {
  id: string;
  x: number;
  y: number;
  radius: number;
  createdAt: number;
}

// 1. River Meandering Waypoints
export const RIVER_POINTS = [
  { x: 0, y: 2100 },
  { x: 800, y: 1650 },
  { x: 1600, y: 2550 },
  { x: 2400, y: 1750 },
  { x: 3300, y: 2450 },
  { x: 4200, y: 2050 }
];

// 2. Bridges crossing the river
export const MAP_BRIDGES: RoyaleBridge[] = [
  { id: 'bridge_1', x: 820, y: 1530, w: 140, h: 260, type: 'wood' },
  { id: 'bridge_2', x: 2000, y: 2030, w: 160, h: 280, type: 'stone' },
  { id: 'bridge_3', x: 3320, y: 2330, w: 140, h: 260, type: 'wood' }
];

// 3. 10 Surviv.io style Enterable Buildings with Doorways & Solid Walls
export const MAP_BUILDINGS: RoyaleBuilding[] = [
  {
    id: 'bld_1',
    name: 'Merkez Askeri Karargah',
    x: 1890,
    y: 1920,
    w: 420,
    h: 360,
    floorType: 'concrete',
    roofColor: '#1e293b',
    doorways: [
      { x: 2060, y: 2262, w: 80, h: 20 },
      { x: 2060, y: 1918, w: 80, h: 20 }
    ],
    walls: [
      { x: 1890, y: 1920, w: 170, h: 18 },
      { x: 2140, y: 1920, w: 170, h: 18 },
      { x: 1890, y: 2262, w: 170, h: 18 },
      { x: 2140, y: 2262, w: 170, h: 18 },
      { x: 1890, y: 1920, w: 18, h: 360 },
      { x: 2292, y: 1920, w: 18, h: 360 }
    ]
  },
  {
    id: 'bld_2',
    name: 'Kuzey Silah Deposu',
    x: 1030,
    y: 650,
    w: 340,
    h: 300,
    floorType: 'wood',
    roofColor: '#292524',
    doorways: [
      { x: 1160, y: 932, w: 80, h: 20 }
    ],
    walls: [
      { x: 1030, y: 650, w: 340, h: 18 },
      { x: 1030, y: 932, w: 130, h: 18 },
      { x: 1240, y: 932, w: 130, h: 18 },
      { x: 1030, y: 650, w: 18, h: 300 },
      { x: 1352, y: 650, w: 18, h: 300 }
    ]
  },
  {
    id: 'bld_3',
    name: 'Kuzeydoğu Araştırma Üssü',
    x: 2910,
    y: 740,
    w: 380,
    h: 320,
    floorType: 'tiles',
    roofColor: '#0f172a',
    doorways: [
      { x: 3060, y: 1042, w: 80, h: 20 },
      { x: 3060, y: 738, w: 80, h: 20 }
    ],
    walls: [
      { x: 2910, y: 740, w: 150, h: 18 },
      { x: 3140, y: 740, w: 150, h: 18 },
      { x: 2910, y: 1042, w: 150, h: 18 },
      { x: 3140, y: 1042, w: 150, h: 18 },
      { x: 2910, y: 740, w: 18, h: 320 },
      { x: 3272, y: 740, w: 18, h: 320 }
    ]
  },
  {
    id: 'bld_4',
    name: 'Doğu Lojistik Hangarı',
    x: 3200,
    y: 2025,
    w: 400,
    h: 350,
    floorType: 'metal',
    roofColor: '#18181b',
    doorways: [
      { x: 3360, y: 2357, w: 80, h: 20 }
    ],
    walls: [
      { x: 3200, y: 2025, w: 400, h: 18 },
      { x: 3200, y: 2357, w: 160, h: 18 },
      { x: 3440, y: 2357, w: 160, h: 18 },
      { x: 3200, y: 2025, w: 18, h: 350 },
      { x: 3582, y: 2025, w: 18, h: 350 }
    ]
  },
  {
    id: 'bld_5',
    name: 'Güneydoğu Sahil Malikanesi',
    x: 3020,
    y: 3140,
    w: 360,
    h: 320,
    floorType: 'wood',
    roofColor: '#451a03',
    doorways: [
      { x: 3160, y: 3442, w: 80, h: 20 }
    ],
    walls: [
      { x: 3020, y: 3140, w: 360, h: 18 },
      { x: 3020, y: 3442, w: 140, h: 18 },
      { x: 3240, y: 3442, w: 140, h: 18 },
      { x: 3020, y: 3140, w: 18, h: 320 },
      { x: 3362, y: 3140, w: 18, h: 320 }
    ]
  },
  {
    id: 'bld_6',
    name: 'Güney Fabrika Kompleksi',
    x: 1780,
    y: 3220,
    w: 440,
    h: 360,
    floorType: 'concrete',
    roofColor: '#111827',
    doorways: [
      { x: 1960, y: 3562, w: 80, h: 20 },
      { x: 1960, y: 3218, w: 80, h: 20 }
    ],
    walls: [
      { x: 1780, y: 3220, w: 180, h: 18 },
      { x: 2040, y: 3220, w: 180, h: 18 },
      { x: 1780, y: 3562, w: 180, h: 18 },
      { x: 2040, y: 3562, w: 180, h: 18 },
      { x: 1780, y: 3220, w: 18, h: 360 },
      { x: 2202, y: 3220, w: 18, h: 360 }
    ]
  },
  {
    id: 'bld_7',
    name: 'Güneybatı Sığınağı',
    x: 740,
    y: 3060,
    w: 320,
    h: 280,
    floorType: 'metal',
    roofColor: '#022c22',
    doorways: [
      { x: 860, y: 3322, w: 80, h: 20 }
    ],
    walls: [
      { x: 740, y: 3060, w: 320, h: 18 },
      { x: 740, y: 3322, w: 120, h: 18 },
      { x: 940, y: 3322, w: 120, h: 18 },
      { x: 740, y: 3060, w: 18, h: 280 },
      { x: 1042, y: 3060, w: 18, h: 280 }
    ]
  },
  {
    id: 'bld_8',
    name: 'Batı Taktik Kışlası',
    x: 560,
    y: 1750,
    w: 380,
    h: 300,
    floorType: 'wood',
    roofColor: '#1e1b4b',
    doorways: [
      { x: 710, y: 2032, w: 80, h: 20 }
    ],
    walls: [
      { x: 560, y: 1750, w: 380, h: 18 },
      { x: 560, y: 2032, w: 150, h: 18 },
      { x: 790, y: 2032, w: 150, h: 18 },
      { x: 560, y: 1750, w: 18, h: 300 },
      { x: 922, y: 1750, w: 18, h: 300 }
    ]
  },
  {
    id: 'bld_9',
    name: 'Kuzeybatı İletişim İstasyonu',
    x: 950,
    y: 1160,
    w: 300,
    h: 280,
    floorType: 'tiles',
    roofColor: '#030712',
    doorways: [
      { x: 1060, y: 1422, w: 80, h: 20 }
    ],
    walls: [
      { x: 950, y: 1160, w: 300, h: 18 },
      { x: 950, y: 1422, w: 110, h: 18 },
      { x: 1140, y: 1422, w: 110, h: 18 },
      { x: 950, y: 1160, w: 18, h: 280 },
      { x: 1232, y: 1160, w: 18, h: 280 }
    ]
  },
  {
    id: 'bld_10',
    name: 'Merkez Doğu Karakolu',
    x: 2530,
    y: 1455,
    w: 340,
    h: 290,
    floorType: 'wood',
    roofColor: '#271202',
    doorways: [
      { x: 2660, y: 1727, w: 80, h: 20 }
    ],
    walls: [
      { x: 2530, y: 1455, w: 340, h: 18 },
      { x: 2530, y: 1727, w: 130, h: 18 },
      { x: 2740, y: 1727, w: 130, h: 18 },
      { x: 2530, y: 1455, w: 18, h: 290 },
      { x: 2852, y: 1455, w: 18, h: 290 }
    ]
  }
];

// ==========================================
// RAY-CAST COLLISION & LINE INTERSECTION
// ==========================================

export function lineSegmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): { hit: boolean; x: number; y: number; t: number } {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return { hit: false, x: 0, y: 0, t: 0 };
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      hit: true,
      x: x1 + ua * (x2 - x1),
      y: y1 + ua * (y2 - y1),
      t: ua
    };
  }
  return { hit: false, x: 0, y: 0, t: 0 };
}

export function rayIntersectsRect(
  x1: number, y1: number, x2: number, y2: number,
  rx: number, ry: number, rw: number, rh: number
): { hit: boolean; x: number; y: number; t: number } {
  // If start point is inside rect
  if (x1 >= rx && x1 <= rx + rw && y1 >= ry && y1 <= ry + rh) {
    return { hit: true, x: x1, y: y1, t: 0 };
  }

  let minT = 1.0;
  let hit = false;
  let hitX = x2;
  let hitY = y2;

  const edges = [
    [rx, ry, rx + rw, ry],
    [rx + rw, ry, rx + rw, ry + rh],
    [rx + rw, ry + rh, rx, ry + rh],
    [rx, ry + rh, rx, ry]
  ];

  for (const [ex1, ey1, ex2, ey2] of edges) {
    const res = lineSegmentsIntersect(x1, y1, x2, y2, ex1, ey1, ex2, ey2);
    if (res.hit && res.t <= minT) {
      minT = res.t;
      hit = true;
      hitX = res.x;
      hitY = res.y;
    }
  }

  return { hit, x: hitX, y: hitY, t: minT };
}

export function checkRaycastWalls(
  x1: number, y1: number, x2: number, y2: number,
  buildings: RoyaleBuilding[] = MAP_BUILDINGS
): { hit: boolean; x: number; y: number; t: number } {
  let minT = 1.0;
  let hit = false;
  let hitX = x2;
  let hitY = y2;

  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  for (const bldg of buildings) {
    if (
      maxX < bldg.x - 20 || minX > bldg.x + bldg.w + 20 ||
      maxY < bldg.y - 20 || minY > bldg.y + bldg.h + 20
    ) {
      continue;
    }

    for (const wall of bldg.walls) {
      const res = rayIntersectsRect(x1, y1, x2, y2, wall.x, wall.y, wall.w, wall.h);
      if (res.hit && res.t <= minT) {
        minT = res.t;
        hit = true;
        hitX = res.x;
        hitY = res.y;
      }
    }
  }

  return { hit, x: hitX, y: hitY, t: minT };
}

export function distToSegmentSquared(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number
): number {
  const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
  if (l2 === 0) return (px - x1) * (px - x1) + (py - y1) * (py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

export function rayIntersectsCircle(
  x1: number, y1: number, x2: number, y2: number,
  cx: number, cy: number, radius: number
): { hit: boolean; x: number; y: number; t: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const dSq = (x1 - cx) * (x1 - cx) + (y1 - cy) * (y1 - cy);
    return { hit: dSq <= radius * radius, x: x1, y: y1, t: 0 };
  }

  // Projection of circle center onto segment
  const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const distSq = (cx - projX) * (cx - projX) + (cy - projY) * (cy - projY);

  if (distSq <= radius * radius) {
    return { hit: true, x: projX, y: projY, t };
  }
  return { hit: false, x: 0, y: 0, t: 1 };
}

export function checkRaycastLOS(
  x1: number, y1: number, x2: number, y2: number,
  buildings: RoyaleBuilding[] = MAP_BUILDINGS,
  obstacles: { type: string; x: number; y: number; radius?: number }[] = []
): { hit: boolean; x: number; y: number; t: number } {
  // 1. Bina duvarları kontrolü
  const wallHit = checkRaycastWalls(x1, y1, x2, y2, buildings);
  if (wallHit.hit) return wallHit;

  // 2. Taş engelleri (Rock Obstacles) kontrolü (Mermiler ve görüş hattı kayalardan geçemez)
  let minT = 1.0;
  let hit = false;
  let hitX = x2;
  let hitY = y2;
  for (const obs of obstacles) {
    if (obs && obs.type === 'rock') {
      const rockRadius = obs.radius || 25;
      const circHit = rayIntersectsCircle(x1, y1, x2, y2, obs.x, obs.y, rockRadius);
      if (circHit.hit && circHit.t < minT) {
        minT = circHit.t;
        hit = true;
        hitX = circHit.x;
        hitY = circHit.y;
      }
    }
  }

  if (hit) return { hit: true, x: hitX, y: hitY, t: minT };
  return { hit: false, x: x2, y: y2, t: 1.0 };
}

export const WEAPON_CONFIGS: Record<string, {
  name: string;
  damage: number;
  fireRate: number; // ms
  magSize: number;
  reloadTime: number; // ms
  speed: number;
  spread: number;
  bulletsPerShot: number;
  range: number;
  bulletRadius: number;
  color: string;
  themeColor: string;
  isAoE?: boolean;
  aoeRadius?: number;
  description: string;
}> = {
  pistol: {
    name: 'Glock 19',
    damage: 18,
    fireRate: 250,
    magSize: 15,
    reloadTime: 1200,
    speed: 18,
    spread: 0.05,
    bulletsPerShot: 1,
    range: 750,
    bulletRadius: 3,
    color: '#94a3b8',
    themeColor: '#64748b',
    description: 'Yarı otomatik dengeli tabanca'
  },
  shotgun: {
    name: 'SPAS-12',
    damage: 11,
    fireRate: 750,
    magSize: 6,
    reloadTime: 2100,
    speed: 21,
    spread: 0.24,
    bulletsPerShot: 6,
    range: 520,
    bulletRadius: 3.5,
    color: '#f97316',
    themeColor: '#ea580c',
    description: 'Yakın mesafede 6 saçmalı pompalı (Tümü değerse 66 Hasar)'
  },
  smg: {
    name: 'Micro UZI',
    damage: 12,
    fireRate: 85,
    magSize: 32,
    reloadTime: 1400,
    speed: 22,
    spread: 0.14,
    bulletsPerShot: 1,
    range: 650,
    bulletRadius: 2.8,
    color: '#38bdf8',
    themeColor: '#0284c7',
    description: 'Seri atışlı kompakt hafif makineli (32 Mermi)'
  },
  rifle: {
    name: 'AK-47 Askeri',
    damage: 20,
    fireRate: 150,
    magSize: 30,
    reloadTime: 1800,
    speed: 26,
    spread: 0.07,
    bulletsPerShot: 1,
    range: 980,
    bulletRadius: 3.5,
    color: '#eab308',
    themeColor: '#ca8a04',
    description: 'Dengeli taarruz tüfeği (Mermi başı 20 Hasar)'
  },
  sniper: {
    name: 'AWP Ağır Sniper',
    damage: 70,
    fireRate: 1200,
    magSize: 5,
    reloadTime: 2400,
    speed: 38,
    spread: 0.015,
    bulletsPerShot: 1,
    range: 1500,
    bulletRadius: 4.5,
    color: '#a855f7',
    themeColor: '#9333ea',
    description: 'Uzun menzilli keskin nişancı (70 Hasar, 5 Mermi)'
  },
  plasma: {
    name: 'Plazma RPG',
    damage: 90,
    fireRate: 1200,
    magSize: 3,
    reloadTime: 2500,
    speed: 14,
    spread: 0.04,
    bulletsPerShot: 1,
    range: 1100,
    bulletRadius: 7,
    color: '#ec4899',
    themeColor: '#db2777',
    isAoE: true,
    aoeRadius: 130,
    description: 'Dengeli plazma roket (Kalkana 50, Saf Cana 90 Hasar, 3 Mermi)'
  }
};

export interface PlayerData {
  id: string;
  userId: number;
  username: string;
  avatar: string | null;
  color: string;
  isBot: boolean;
  isHost: boolean;
  ready: boolean;
  platform?: 'pc' | 'mobile' | 'tablet';
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  activeWeapon: string;
  activeWeaponSlot: number;
  weapons: string[];
  ammo: Record<string, number>;
  reserveAmmo: Record<string, number>;
  isReloading: boolean;
  reloadEndTime: number;
  isAlive: boolean;
  kills: number;
  deaths: number;
  spectating: boolean;
  respawnAt: number | null;
  spawnShieldEndTime: number;
  speedBuffEndTime: number;
  rageBuffEndTime: number;
  lastShootTime: number;
  vx?: number;
  vy?: number;
  shooting?: boolean;
  respawnAckReceived?: boolean;
  lastPickupTime?: number;
  // Enhanced Bot AI Fields
  botStrafeDir?: number;
  botStrafeTimer?: number;
  botReactionUntil?: number;
  botTargetPlayerId?: string | null;
  botStuckCounter?: number;
  botLastX?: number;
  botLastY?: number;
  botRoamTargetX?: number;
  botRoamTargetY?: number;
  botRoamTimer?: number;
}

export interface BulletData {
  id: string;
  shooterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  radius: number;
  isAoE?: boolean;
  aoeRadius?: number;
  distanceTraveled: number;
  maxRange: number;
  weaponType?: string;
}

export interface CrateData {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  tier: 'normal' | 'rare';
  lootType: string;
  isMilitary?: boolean;
}

export interface LootItemData {
  id: string;
  type: string;
  x: number;
  y: number;
  currentAmmo?: number;
  maxAmmo?: number;
}

export interface ObstacleData {
  id: string;
  type: 'rock' | 'bush';
  x: number;
  y: number;
  radius: number;
}

export interface GameRoom {
  id: string;
  title: string;
  hostId: number;
  hostName: string;
  hostAvatar: string | null;
  capacity: number; // 2 to 20
  mode: 'royale' | 'deathmatch';
  duration: number; // in seconds
  status: 'lobby' | 'countdown' | 'playing' | 'gameover';
  createdAt: number;
  players: PlayerData[];
  bullets: BulletData[];
  crates: CrateData[];
  barrels: RoyaleBarrel[];
  explosions: RoyaleExplosionEffect[];
  loot: LootItemData[];
  lootLocks?: Set<string>;
  obstacles: ObstacleData[];
  zone: {
    currentX: number;
    currentY: number;
    currentRadius: number;
    targetX: number;
    targetY: number;
    targetRadius: number;
    isShrinking: boolean;
    phase: number;
    phaseTimer: number;
    damagePerSec: number;
  };
  damagePopups: Array<{ id: string; x: number; y: number; damage: number; color: string; createdAt: number }>;
  killfeed: Array<{ id: string; killer: string; victim: string; weapon: string; time: number }>;
  winner: { id: string; userId: number; username: string; avatar: string | null; kills: number } | null;
  matchTimeRemaining: number;
  gameLoopInterval?: any;
  countdownTimer?: any;
}

export class BattleRoyaleManager {
  private io: SocketIOServer;
  private db: LibsqlClient;
  public rooms: Map<string, GameRoom> = new Map();

  constructor(io: SocketIOServer, db?: LibsqlClient) {
    this.io = io;
    this.db = db as LibsqlClient;
  }

  public createRoomInternal(
    title: string,
    hostId: number,
    hostName: string,
    hostAvatar: string | null,
    capacity: number,
    mode: 'royale' | 'deathmatch',
    duration: number
  ): GameRoom {
    const id = 'royale_' + Math.random().toString(36).substring(2, 9);
    const room: GameRoom = {
      id,
      title: title || 'Savaş Arenası',
      hostId,
      hostName,
      hostAvatar,
      capacity: Math.min(20, Math.max(2, capacity || 20)),
      mode: mode || 'deathmatch',
      duration: duration || 180,
      status: 'lobby',
      createdAt: Date.now(),
      players: [],
      bullets: [],
      crates: [],
      barrels: [],
      explosions: [],
      loot: [],
      lootLocks: new Set<string>(),
      obstacles: [],
      zone: {
        currentX: MAP_SIZE / 2,
        currentY: MAP_SIZE / 2,
        currentRadius: MAP_SIZE * 0.48,
        targetX: MAP_SIZE / 2,
        targetY: MAP_SIZE / 2,
        targetRadius: MAP_SIZE * 0.48,
        isShrinking: false,
        phase: 0,
        phaseTimer: 35,
        damagePerSec: 3
      },
      damagePopups: [],
      killfeed: [],
      winner: null,
      matchTimeRemaining: duration || 180
    };

    this.rooms.set(id, room);
    return room;
  }

  public getRoomsList() {
    return Array.from(this.rooms.values())
      .filter(r => r.players.some(p => !p.isBot))
      .map(r => ({
        id: r.id,
        title: r.title,
        hostId: r.hostId,
        hostName: r.hostName,
        hostAvatar: r.hostAvatar,
        playerCount: r.players.length,
        capacity: r.capacity,
        mode: r.mode,
        duration: r.duration,
        status: r.status,
        createdAt: r.createdAt
      }));
  }

  public getUnifiedTables() {
    return Array.from(this.rooms.values())
      .filter(r => r.players.some(p => !p.isBot))
      .map(r => ({
        id: r.id,
        name: r.title,
        creatorId: r.hostId,
        creatorName: r.hostName,
        creatorAvatar: r.hostAvatar,
        playerCount: r.players.length,
        maxPlayers: r.capacity,
        gameType: 'battle_royale',
        status: r.status === 'playing' ? 'playing' : 'waiting',
        isPrivate: false,
        gameMode: r.mode,
        createdAt: 'Bugün',
        updatedAt: Date.now()
      }));
  }

  public destroyRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (room.gameLoopInterval) clearInterval(room.gameLoopInterval);
    if (room.countdownTimer) clearInterval(room.countdownTimer);
    this.rooms.delete(roomId);
    this.broadcastRoomsList();
  }

  public broadcastRoomsList() {
    this.io.emit('royale:rooms_list', this.getRoomsList());
  }

  public createRoom(
    user: { id: number; username: string; avatar: string | null; color?: string; platform?: 'pc' | 'mobile' | 'tablet' },
    options: { title?: string; capacity?: number; mode?: 'royale' | 'deathmatch'; duration?: number }
  ): GameRoom {
    const cap = Math.min(20, Math.max(2, Number(options.capacity) || 20));
    const room = this.createRoomInternal(
      options.title || `${user.username}'ın Arenası`,
      user.id,
      user.username,
      user.avatar,
      cap,
      options.mode || 'deathmatch',
      options.duration || 180
    );

    this.joinRoom(room.id, user);
    this.broadcastRoomsList();
    return room;
  }

  public joinRoom(roomId: string, user: { id: number; username: string; avatar: string | null; color?: string; platform?: 'pc' | 'mobile' | 'tablet' }) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };

    if (room.status === 'gameover') {
      this.resetRoomToLobby(room);
    }

    let p = room.players.find(x => x.userId === user.id);
    if (p) {
      if (user.platform) p.platform = user.platform;
      return { success: true, room };
    }

    if (room.players.length >= room.capacity) {
      return { success: false, error: 'Masa dolu!' };
    }

    const isHost = room.players.length === 0 || room.hostId === user.id;
    const newPlayer: PlayerData = {
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      color: user.color || '#3b82f6',
      isBot: false,
      isHost,
      ready: isHost,
      platform: user.platform || 'pc',
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      angle: 0,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 100,
      activeWeapon: 'pistol',
      activeWeaponSlot: 0,
      weapons: ['pistol'],
      ammo: { pistol: 15, shotgun: 6, smg: 32, rifle: 30, sniper: 5, plasma: 3 },
      reserveAmmo: { pistol: 60, shotgun: 24, smg: 120, rifle: 90, sniper: 15, plasma: 6 },
      isReloading: false,
      reloadEndTime: 0,
      isAlive: true,
      kills: 0,
      deaths: 0,
      spectating: false,
      respawnAt: null,
      spawnShieldEndTime: 0,
      speedBuffEndTime: 0,
      rageBuffEndTime: 0,
      lastShootTime: 0
    };

    room.players.push(newPlayer);
    this.broadcastRoomState(room);
    this.broadcastRoomsList();
    return { success: true, room };
  }

  public leaveRoom(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.userId !== userId);

    const realPlayers = room.players.filter(p => !p.isBot);
    if (realPlayers.length === 0) {
      this.destroyRoom(roomId);
      return;
    } else {
      if (room.hostId === userId) {
        const nextHost = realPlayers[0] || room.players[0];
        if (nextHost) {
          room.hostId = nextHost.userId;
          room.hostName = nextHost.username;
          room.hostAvatar = nextHost.avatar;
          nextHost.isHost = true;
          nextHost.ready = true;
        }
      }
      this.broadcastRoomState(room);
      if (room.status === 'playing') {
        this.broadcastGameState(room);
        this.io.to(room.id).emit('player:left', { userId });
      }
    }
    this.broadcastRoomsList();
  }

  public addBot(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'lobby') return { error: 'Bot eklenemez.' };
    if (room.players.length >= room.capacity) return { error: 'Masa dolu!' };

    const botNames = ['kapboss', 'kıllıÇ', 'AXELbot', 'EmGaN', 'EE', 'IA', 'TOK', 'CAS', 'IB'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    const botId = -Math.floor(10000 + Math.random() * 90000);

    const bot: PlayerData = {
      id: 'bot_' + Math.random().toString(36).substring(2, 9),
      userId: botId,
      username: botName,
      avatar: null,
      color: '#ef4444',
      isBot: true,
      isHost: false,
      ready: true,
      platform: 'pc',
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      angle: 0,
      hp: 100,
      maxHp: 100,
      shield: 25,
      maxShield: 100,
      activeWeapon: 'pistol',
      activeWeaponSlot: 0,
      weapons: ['pistol'],
      ammo: { pistol: 15, shotgun: 6, smg: 32, rifle: 30, sniper: 5, plasma: 3 },
      reserveAmmo: { pistol: 999, shotgun: 999, smg: 999, rifle: 999, sniper: 999, plasma: 999 },
      isReloading: false,
      reloadEndTime: 0,
      isAlive: true,
      kills: 0,
      deaths: 0,
      spectating: false,
      respawnAt: null,
      spawnShieldEndTime: 0,
      speedBuffEndTime: 0,
      rageBuffEndTime: 0,
      lastShootTime: 0,
      botStrafeDir: Math.random() < 0.5 ? 1 : -1,
      botStrafeTimer: Date.now() + 600,
      botStuckCounter: 0
    };

    room.players.push(bot);
    this.broadcastRoomState(room);
    this.broadcastRoomsList();
    return { success: true };
  }

  public removeBot(roomId: string, userId: number, botIdStr?: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'lobby') return { error: 'Bot silinemez.' };

    let idx = -1;
    if (botIdStr) {
      idx = room.players.findIndex(p => p.id === botIdStr && p.isBot);
    } else {
      for (let i = room.players.length - 1; i >= 0; i--) {
        if (room.players[i].isBot) {
          idx = i;
          break;
        }
      }
    }

    if (idx !== -1) {
      room.players.splice(idx, 1);
      this.broadcastRoomState(room);
      this.broadcastRoomsList();
    }
    return { success: true };
  }

  public toggleReady(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'lobby') return { error: 'İşlem başarısız.' };

    const player = room.players.find(p => p.userId === userId);
    if (!player) return { error: 'Oyuncu bulunamadı.' };

    player.ready = !player.ready;
    this.broadcastRoomState(room);
    return { success: true };
  }

  public returnToLobby(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Oda bulunamadı.' };
    this.resetRoomToLobby(room);
    return { success: true, room: this.getPublicRoomState(room) };
  }

  private resetRoomToLobby(room: GameRoom) {
    if (room.gameLoopInterval) clearInterval(room.gameLoopInterval);
    if (room.countdownTimer) clearInterval(room.countdownTimer);

    room.status = 'lobby';
    room.winner = null;
    room.bullets = [];
    room.crates = [];
    room.barrels = [];
    room.explosions = [];
    room.loot = [];
    room.obstacles = [];
    room.killfeed = [];
    room.damagePopups = [];
    room.matchTimeRemaining = room.duration;

    room.players.forEach(p => {
      p.hp = 100;
      p.shield = 0;
      p.isAlive = true;
      p.kills = 0;
      p.deaths = 0;
      p.spectating = false;
      p.ready = p.isHost || p.isBot;
      p.activeWeapon = 'pistol';
      p.activeWeaponSlot = 0;
      p.weapons = ['pistol'];
      p.ammo = { pistol: 15, shotgun: 6, smg: 32, rifle: 30, sniper: 5, plasma: 4 };
      p.reserveAmmo = { pistol: 60, shotgun: 24, smg: 120, rifle: 90, sniper: 15, plasma: 8 };
    });

    this.broadcastRoomState(room);
    this.broadcastRoomsList();
  }

  public async startGame(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'lobby') return { error: 'Oyun başlatılamaz.' };

    const host = room.players.find(p => p.userId === userId);
    if (!host || !host.isHost) return { error: 'Sadece oda kurucusu oyunu başlatabilir.' };

    const notReady = room.players.find(p => !p.ready);
    if (notReady && room.players.length > 1) {
      return { error: 'Tüm oyuncular hazır olmalı!' };
    }

    room.status = 'countdown';
    this.broadcastRoomState(room);

    let count = 3;
    this.io.to(room.id).emit('royale:countdown', { countdown: count });

    room.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        this.io.to(room.id).emit('royale:countdown', { countdown: count });
      } else {
        clearInterval(room.countdownTimer);
        this.launchGamePlay(room);
      }
    }, 1000);

    return { success: true };
  }

  private launchGamePlay(room: GameRoom) {
    room.status = 'playing';
    room.matchTimeRemaining = room.duration;
    room.winner = null;
    room.bullets = [];
    room.killfeed = [];
    room.damagePopups = [];

    // Reset zone for 4200 map
    room.zone = {
      currentX: MAP_SIZE / 2,
      currentY: MAP_SIZE / 2,
      currentRadius: MAP_SIZE * 0.48,
      targetX: MAP_SIZE / 2,
      targetY: MAP_SIZE / 2,
      targetRadius: MAP_SIZE * 0.48,
      isShrinking: false,
      phase: 0,
      phaseTimer: 35,
      damagePerSec: 2.5
    };

    // Generate Map Entities
    this.generateMapEntities(room);

    // Spawn Players safely
    room.players.forEach(p => {
      const spawn = this.findSafeSpawn(room);
      p.x = spawn.x;
      p.y = spawn.y;
      p.hp = 100;
      p.shield = 0;
      p.isAlive = true;
      p.kills = 0;
      p.deaths = 0;
      p.spectating = false;
      p.spawnShieldEndTime = Date.now() + 3500; // 3.5s initial protection
      p.activeWeapon = 'pistol';
      p.activeWeaponSlot = 0;
      p.weapons = ['pistol'];
      p.ammo = { pistol: 15, shotgun: 6, smg: 32, rifle: 30, sniper: 5, plasma: 3 };
      p.reserveAmmo = { pistol: 60, shotgun: 24, smg: 120, rifle: 90, sniper: 15, plasma: 6 };
      p.botStrafeDir = Math.random() < 0.5 ? 1 : -1;
      p.botStrafeTimer = Date.now() + 600;
      p.botStuckCounter = 0;
    });

    this.io.to(room.id).emit('royale:game_started', this.getPublicGameState(room));
    this.broadcastRoomsList();

    if (room.gameLoopInterval) clearInterval(room.gameLoopInterval);
    room.gameLoopInterval = setInterval(() => {
      this.tickGame(room);
    }, 1000 / 30);
  }

  private generateMapEntities(room: GameRoom) {
    room.crates = [];
    room.barrels = [];
    room.loot = [];
    room.obstacles = [];

    // 1. TNT Explosive Barrels
    for (let i = 0; i < 28; i++) {
      room.barrels.push({
        id: `barrel_${i}`,
        x: 250 + Math.random() * (MAP_SIZE - 500),
        y: 250 + Math.random() * (MAP_SIZE - 500),
        hp: 65,
        maxHp: 65,
        radius: 20
      });
    }

    // 2. Guaranteed Crates inside each Building
    MAP_BUILDINGS.forEach((bldg, idx) => {
      room.crates.push({
        id: `crate_bld_${idx}_1`,
        x: bldg.x + bldg.w * 0.3,
        y: bldg.y + bldg.h * 0.5,
        hp: 80,
        maxHp: 80,
        tier: 'rare',
        lootType: 'weapon_rifle',
        isMilitary: true
      });
      room.crates.push({
        id: `crate_bld_${idx}_2`,
        x: bldg.x + bldg.w * 0.7,
        y: bldg.y + bldg.h * 0.5,
        hp: 40,
        maxHp: 40,
        tier: 'normal',
        lootType: 'medkit'
      });
    });

    // 3. Open Area Crates
    const cratePool = ['weapon_shotgun', 'weapon_smg', 'weapon_rifle', 'weapon_sniper', 'weapon_plasma', 'medkit', 'shield', 'heavy_shield', 'adrenaline', 'rage'];
    for (let i = 0; i < 65; i++) {
      const lootType = cratePool[Math.floor(Math.random() * cratePool.length)];
      const isRare = lootType.includes('sniper') || lootType.includes('plasma') || lootType.includes('heavy') || lootType.includes('rage');
      room.crates.push({
        id: `crate_${i}`,
        x: 200 + Math.random() * (MAP_SIZE - 400),
        y: 200 + Math.random() * (MAP_SIZE - 400),
        hp: isRare ? 70 : 40,
        maxHp: isRare ? 70 : 40,
        tier: isRare ? 'rare' : 'normal',
        lootType
      });
    }

    // 4. Ground Loot
    for (let i = 0; i < 50; i++) {
      const lootType = cratePool[Math.floor(Math.random() * cratePool.length)];
      const wName = lootType.startsWith('weapon_') ? lootType.replace('weapon_', '') : null;
      const mag = wName && WEAPON_CONFIGS[wName] ? WEAPON_CONFIGS[wName].magSize : undefined;
      room.loot.push({
        id: `loot_${i}`,
        type: lootType,
        currentAmmo: mag,
        maxAmmo: mag,
        x: 200 + Math.random() * (MAP_SIZE - 400),
        y: 200 + Math.random() * (MAP_SIZE - 400)
      });
    }

    // 5. Nature Rocks & Bushes
    for (let i = 0; i < 110; i++) {
      const isRock = Math.random() < 0.55;
      room.obstacles.push({
        id: `obs_${i}`,
        type: isRock ? 'rock' : 'bush',
        x: 180 + Math.random() * (MAP_SIZE - 360),
        y: 180 + Math.random() * (MAP_SIZE - 360),
        radius: isRock ? 28 + Math.random() * 16 : 34 + Math.random() * 14
      });
    }
  }

  public processPlayerInput(roomId: string, userId: number, input: any) {
    if (!input || typeof input !== 'object') return;
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    if (input.requestRespawn) {
      this.requestRespawn(roomId, userId);
      return;
    }

    const player = room.players.find(p => p.userId === userId);
    // GHOST INPUT DESYNC GUARD: Dead players cannot perform any actions!
    if (!player || !player.isAlive || player.hp <= 0) {
      if (player) {
        player.shooting = false;
        player.vx = 0;
        player.vy = 0;
      }
      return;
    }

    // Platform detection (for asymmetric AI difficulty: pc vs mobile/tablet)
    if (input.platform === 'pc' || input.platform === 'mobile' || input.platform === 'tablet') {
      player.platform = input.platform;
    }

    // Defensive Movement Vectors validation (reject NaN, Infinity, null, clamp to [-1, 1])
    if (typeof input.vx === 'number' && Number.isFinite(input.vx) &&
        typeof input.vy === 'number' && Number.isFinite(input.vy)) {
      player.vx = Math.max(-1, Math.min(1, input.vx));
      player.vy = Math.max(-1, Math.min(1, input.vy));
    } else if (typeof input.up === 'boolean' || typeof input.down === 'boolean' ||
               typeof input.left === 'boolean' || typeof input.right === 'boolean') {
      let vx = 0;
      let vy = 0;
      if (input.up) vy -= 1;
      if (input.down) vy += 1;
      if (input.left) vx -= 1;
      if (input.right) vx += 1;
      if (vx !== 0 && vy !== 0) {
        vx *= 0.7071;
        vy *= 0.7071;
      }
      player.vx = vx;
      player.vy = vy;
    }

    // Angle (strictly finite, bounded)
    if (typeof input.angle === 'number' && Number.isFinite(input.angle)) {
      player.angle = input.angle;
    }

    // Shooting (support both shooting and isShooting boolean aliases)
    if (typeof input.shooting === 'boolean') {
      player.shooting = input.shooting;
    } else if (typeof input.isShooting === 'boolean') {
      player.shooting = input.isShooting;
    }

    // Weapon Switch
    if (typeof input.switchWeapon === 'number' && Number.isFinite(input.switchWeapon)) {
      const targetSlot = Math.floor(input.switchWeapon);
      if (player.weapons[targetSlot]) {
        player.activeWeaponSlot = targetSlot;
        player.activeWeapon = player.weapons[targetSlot];
        player.isReloading = false;
        player.reloadEndTime = 0;
      }
    } else if (input.switchWeapon === 'next' || input.switchWeapon === 'prev') {
      if (player.weapons.length > 1) {
        player.activeWeaponSlot = (player.activeWeaponSlot + 1) % player.weapons.length;
        player.activeWeapon = player.weapons[player.activeWeaponSlot];
        player.isReloading = false;
        player.reloadEndTime = 0;
      }
    }

    // Reload
    if (input.reload && !player.isReloading) {
      this.triggerReload(player);
    }

    // Drop Weapon action
    if (input.dropWeapon) {
      this.dropPlayerWeapon(roomId, userId, input.slot);
    }

    // Pickup or Swap Weapon (support pickup, swapWeapon, and interactLoot)
    if (input.pickup || input.swapWeapon || input.interactLoot || input.interact_loot) {
      this.handlePlayerPickup(room, player, !!(input.swapWeapon || input.interactLoot || input.interact_loot));
    }
  }

  public requestRespawn(roomId: string, userId: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return false;

    const p = room.players.find(pl => pl.userId === userId);
    if (!p || p.isAlive) return false;

    const now = Date.now();
    const spawn = this.findSafeSpawn(room);
    p.x = spawn.x;
    p.y = spawn.y;
    p.hp = 100;
    p.shield = 25;
    p.isAlive = true;
    p.respawnAt = null;
    p.respawnAckReceived = false;
    p.spawnShieldEndTime = now + 4000;
    p.activeWeapon = 'pistol';
    p.activeWeaponSlot = 0;
    p.weapons = ['pistol'];
    p.ammo = { pistol: WEAPON_CONFIGS.pistol.magSize };
    p.reserveAmmo = { pistol: WEAPON_CONFIGS.pistol.magSize * 2 };
    p.isReloading = false;
    p.shooting = false;
    p.vx = 0;
    p.vy = 0;

    this.io.to(room.id).emit('player:respawned', {
      playerId: p.id,
      userId: p.userId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hp: p.hp,
      shield: p.shield
    });
    this.io.to(room.id).emit('royale:player_respawned', {
      playerId: p.id,
      userId: p.userId,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hp: p.hp,
      shield: p.shield
    });
    this.broadcastGameState(room);
    return true;
  }

  public dropPlayerWeapon(roomId: string, userId: number, slotIndex?: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return false;

    const player = room.players.find(p => p.userId === userId);
    if (!player || !player.isAlive || player.hp <= 0) return false;

    // Cancel ongoing reload immediately to eliminate reload cancel exploit
    player.isReloading = false;
    player.reloadEndTime = 0;

    const targetSlot = typeof slotIndex === 'number' && Number.isFinite(slotIndex) ? Math.floor(slotIndex) : player.activeWeaponSlot;
    const weaponToDrop = player.weapons[targetSlot];
    if (!weaponToDrop || weaponToDrop === 'fists') return false;

    const cfg = WEAPON_CONFIGS[weaponToDrop];
    const remainingAmmo = player.ammo[weaponToDrop] !== undefined
      ? player.ammo[weaponToDrop]
      : (cfg?.magSize || 15);

    // Place dropped weapon onto ground with exact remaining ammo
    room.loot.push({
      id: `loot_drop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: `weapon_${weaponToDrop}`,
      currentAmmo: remainingAmmo,
      maxAmmo: cfg?.magSize || 15,
      x: player.x,
      y: player.y
    });

    // Remove from player inventory
    player.weapons.splice(targetSlot, 1);
    if (player.weapons.length === 0) {
      player.weapons = ['fists'];
      player.activeWeapon = 'fists';
      player.activeWeaponSlot = 0;
    } else {
      player.activeWeaponSlot = 0;
      player.activeWeapon = player.weapons[0];
    }

    return true;
  }

  public confirmRespawnAck(roomId: string, userId: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const player = room.players.find(p => p.userId === userId);
    if (!player || !player.isAlive) return false;

    player.respawnAckReceived = true;
    // Guaranteed 2 full seconds of protection after camera and render confirmation
    player.spawnShieldEndTime = Date.now() + 2000;
    return true;
  }

  private triggerReload(player: PlayerData) {
    const cfg = WEAPON_CONFIGS[player.activeWeapon];
    if (!cfg) return;

    const curAmmo = player.ammo[player.activeWeapon] || 0;
    const resAmmo = player.reserveAmmo[player.activeWeapon] || 0;
    if (curAmmo >= cfg.magSize || resAmmo <= 0) return;

    player.isReloading = true;
    player.reloadEndTime = Date.now() + cfg.reloadTime;
  }

  private handlePlayerPickup(room: GameRoom, player: PlayerData, forceSwap: boolean) {
    if (!player || !player.isAlive || player.hp <= 0) return;
    const now = Date.now();
    if (now - (player.lastPickupTime || 0) < 90) return;
    player.lastPickupTime = now;

    const pickupDist = 65;
    let pickedIdx = -1;

    for (let i = 0; i < room.loot.length; i++) {
      const item = room.loot[i];
      if (!item) continue;
      const d = Math.hypot(player.x - item.x, player.y - item.y);
      if (d <= pickupDist) {
        pickedIdx = i;
        break;
      }
    }

    if (pickedIdx === -1) return;
    const item = room.loot[pickedIdx];
    if (!item) return;

    // ATOMIC MUTEX TRANSACTION LOCK: Prevents simultaneous loot race condition / cloning
    if (!room.lootLocks) {
      room.lootLocks = new Set<string>();
    }
    if (room.lootLocks.has(item.id)) {
      return; // Already locked by another concurrent thread/client!
    }
    room.lootLocks.add(item.id);

    // Helper to safely remove item even if array shifted from a concurrent pickup
    const consumeItem = () => {
      const idx = room.loot.indexOf(item);
      if (idx !== -1) room.loot.splice(idx, 1);
      room.lootLocks?.delete(item.id);
    };

    // If player is reloading, unequip/pickup immediately cancels reload
    player.isReloading = false;
    player.reloadEndTime = 0;

    try {
      if (item.type.startsWith('weapon_')) {
        const wName = item.type.replace('weapon_', '');
        const cfg = WEAPON_CONFIGS[wName];
        if (!cfg) {
          room.lootLocks.delete(item.id);
          return;
        }

        const itemAmmo = typeof item.currentAmmo === 'number' && Number.isFinite(item.currentAmmo) ? item.currentAmmo : cfg.magSize;
        const oldWeapon = player.activeWeapon;
        const oldSlot = player.activeWeaponSlot || 0;

        if (player.weapons.length < 2 && !player.weapons.includes(wName)) {
          player.weapons.push(wName);
          player.activeWeaponSlot = player.weapons.length - 1;
          player.activeWeapon = wName;
          player.ammo[wName] = itemAmmo;
          if (player.reserveAmmo[wName] === undefined) {
            player.reserveAmmo[wName] = cfg.magSize * 2;
          }
        } else {
          // Swap with current active weapon slot
          const droppedWeapon = player.weapons[oldSlot] || oldWeapon;
          const droppedCfg = WEAPON_CONFIGS[droppedWeapon];
          const droppedAmmo = player.ammo[droppedWeapon] !== undefined
            ? player.ammo[droppedWeapon]
            : (droppedCfg?.magSize || 15);

          player.weapons[oldSlot] = wName;
          player.activeWeapon = wName;
          player.ammo[wName] = itemAmmo;
          if (player.reserveAmmo[wName] === undefined) {
            player.reserveAmmo[wName] = cfg.magSize * 2;
          }

          // Drop old weapon with its EXACT remaining ammo on the ground!
          if (droppedWeapon && droppedWeapon !== 'fists') {
            room.loot.push({
              id: `loot_swp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: `weapon_${droppedWeapon}`,
              currentAmmo: droppedAmmo,
              maxAmmo: droppedCfg?.magSize || 15,
              x: player.x,
              y: player.y
            });
          }
        }
        consumeItem();
      } else if (item.type === 'medkit') {
        player.hp = Math.min(player.maxHp, player.hp + 75);
        consumeItem();
      } else if (item.type === 'bandage') {
        player.hp = Math.min(player.maxHp, player.hp + 25);
        consumeItem();
      } else if (item.type === 'shield') {
        player.shield = Math.min(player.maxShield, player.shield + 50);
        consumeItem();
      } else if (item.type === 'heavy_shield') {
        player.shield = 100;
        consumeItem();
      } else if (item.type === 'adrenaline') {
        player.speedBuffEndTime = Date.now() + 12000;
        consumeItem();
      } else if (item.type === 'rage') {
        player.rageBuffEndTime = Date.now() + 12000;
        consumeItem();
      } else if (item.type === 'ammo') {
        Object.keys(player.reserveAmmo).forEach(k => {
          player.reserveAmmo[k] = (player.reserveAmmo[k] || 0) + 30;
        });
        consumeItem();
      } else {
        consumeItem();
      }
    } catch {
      room.lootLocks?.delete(item.id);
    }
  }

  private tickGame(room: GameRoom) {
    if (room.status !== 'playing') return;
    try {
      const now = Date.now();

      // Defensive memory leak and null object cleaning
      room.players = (room.players || []).filter(Boolean);
      room.bullets = (room.bullets || []).filter(b => b && Number.isFinite(b.x) && Number.isFinite(b.y));
      room.loot = (room.loot || []).filter(Boolean);
      room.obstacles = (room.obstacles || []).filter(Boolean);
      room.barrels = (room.barrels || []).filter(Boolean);
      room.crates = (room.crates || []).filter(Boolean);

      // Coordinate sanity check to prevent NaN corruption
      for (const p of room.players) {
        if (!Number.isFinite(p.x)) p.x = MAP_SIZE / 2;
        if (!Number.isFinite(p.y)) p.y = MAP_SIZE / 2;
        if (!Number.isFinite(p.hp)) p.hp = 100;
        if (!Number.isFinite(p.shield)) p.shield = 0;
      }

      // 1. Match Time decrement (Deathmatch mode)
      if (room.mode === 'deathmatch') {
        room.matchTimeRemaining -= 1 / 30;
        if (room.matchTimeRemaining <= 0) {
          this.endDeathmatch(room);
          return;
        }
      }

      // 2. Zone progression (Battle Royale mode)
      if (room.mode === 'royale') {
        this.updateZone(room);
      }

      // 3. Update Player Movements, River Drag & Enhanced AI Bots
      this.updatePlayersAndBots(room, now);

      // 4. Update Bullets & Ray-Cast Collisions
      this.updateBullets(room, now);

      // 5. Clean Expired Explosions & Popups
      room.explosions = room.explosions.filter(e => now - e.createdAt < 700);
      room.damagePopups = room.damagePopups.filter(dp => now - dp.createdAt < 800);

      // 6. Check Battle Royale Elimination & Win
      if (room.mode === 'royale') {
        const alivePlayers = room.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 1 && room.players.length > 1) {
          this.endBattleRoyale(room, alivePlayers[0] || null);
          return;
        }
      }

      // Emit 30Hz Optimized Compact Game State update
      this.io.to(room.id).emit('royale:game_state', this.getPublicGameState(room));
    } catch (err) {
      console.error(`[Royale Room ${room.id} Tick Error]:`, err);
    }
  }

  private isPointInRiver(x: number, y: number): boolean {
    for (let i = 0; i < RIVER_POINTS.length - 1; i++) {
      const p1 = RIVER_POINTS[i];
      const p2 = RIVER_POINTS[i + 1];
      const lineLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (lineLen === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - p1.x) * (p2.x - p1.x) + (y - p1.y) * (p2.y - p1.y)) / (lineLen * lineLen)));
      const projX = p1.x + t * (p2.x - p1.x);
      const projY = p1.y + t * (p2.y - p1.y);
      const d = Math.hypot(x - projX, y - projY);
      if (d < RIVER_WIDTH / 2) return true;
    }
    return false;
  }

  private isOnBridge(x: number, y: number): boolean {
    return MAP_BRIDGES.some(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
  }

  public checkBuildingWallCollision(x: number, y: number, radius: number): boolean {
    for (const bldg of MAP_BUILDINGS) {
      if (
        x + radius < bldg.x || x - radius > bldg.x + bldg.w ||
        y + radius < bldg.y || y - radius > bldg.y + bldg.h
      ) {
        continue;
      }
      for (const wall of bldg.walls) {
        if (
          x + radius > wall.x && x - radius < wall.x + wall.w &&
          y + radius > wall.y && y - radius < wall.y + wall.h
        ) {
          return true;
        }
      }
    }
    return false;
  }

  public checkObstacleCollision(room: GameRoom, x: number, y: number, radius: number): boolean {
    if (!room || !Array.isArray(room.obstacles)) return false;
    for (const obs of room.obstacles) {
      if (obs && obs.type === 'rock') {
        const d = Math.hypot(obs.x - x, obs.y - y);
        if (d < (obs.radius || 25) + radius) return true;
      }
    }
    return false;
  }

  // ============================================================
  // ENHANCED BOT AI (Pathfinding, Whiskers, Strafing & Platform Adaptation)
  // ============================================================
  private updatePlayersAndBots(room: GameRoom, now: number) {
    const alivePlayers = room.players.filter(p => p.isAlive);

    room.players.forEach(p => {
      // Respawn timer for Deathmatch
      if (!p.isAlive) {
        if (room.mode === 'deathmatch' && p.respawnAt && now >= p.respawnAt) {
          const spawn = this.findSafeSpawn(room);
          p.x = spawn.x;
          p.y = spawn.y;
          p.hp = 100;
          p.shield = 25;
          p.isAlive = true;
          p.respawnAt = null;
          p.respawnAckReceived = false;
          p.spawnShieldEndTime = now + 4000; // Handshake safety cap: 4s default, confirmed 2s on client ack
          p.activeWeapon = 'pistol';
          p.activeWeaponSlot = 0;
          p.weapons = ['pistol'];
          p.ammo = { pistol: WEAPON_CONFIGS.pistol.magSize };
          p.reserveAmmo = { pistol: WEAPON_CONFIGS.pistol.magSize * 2 };
          p.isReloading = false;

          // Notify room and client immediately with player:respawned
          this.io.to(room.id).emit('player:respawned', {
            playerId: p.id,
            userId: p.userId,
            x: Math.round(p.x),
            y: Math.round(p.y),
            hp: p.hp,
            shield: p.shield
          });
          this.io.to(room.id).emit('royale:player_respawned', {
            playerId: p.id,
            userId: p.userId,
            x: Math.round(p.x),
            y: Math.round(p.y),
            hp: p.hp,
            shield: p.shield
          });
        }
        return;
      }

      // Handle Reload completion
      if (p.isReloading && now >= p.reloadEndTime) {
        p.isReloading = false;
        const cfg = WEAPON_CONFIGS[p.activeWeapon];
        if (cfg) {
          const curAmmo = p.ammo[p.activeWeapon] || 0;
          const need = cfg.magSize - curAmmo;
          const available = p.reserveAmmo[p.activeWeapon] || 0;
          const fill = Math.min(need, available);
          p.ammo[p.activeWeapon] = curAmmo + fill;
          p.reserveAmmo[p.activeWeapon] = available - fill;
        }
      }

      // ============================================
      // ADVANCED BOT NAVIGATION & COMBAT LOGIC
      // ============================================
      if (p.isBot) {
        // 1. GÖRÜŞ VE HEDEF ALMA YARIÇAPI (MAX_VISION_RADIUS = 580px, LOS DUVAR & TAŞ KONTROLÜ)
        const MAX_VISION_RADIUS = 580; // 550-600px kuralı
        let targetEnemy: PlayerData | null = null;
        let minD = 99999;
        let hasClearLOS = false;

        alivePlayers.forEach(other => {
          if (!other || !other.isAlive || other.id === p.id) return;
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          // Yalnızca 580px yarıçap içerisindeki oyuncuları tara
          if (d <= MAX_VISION_RADIUS && d < minD) {
            // Görüş hattında duvar veya taş engeli var mı?
            const losCheck = checkRaycastLOS(p.x, p.y, other.x, other.y, MAP_BUILDINGS, room.obstacles);
            if (!losCheck.hit) {
              minD = d;
              targetEnemy = other;
              hasClearLOS = true;
            }
          }
        });

        // Check Safe Zone Status & Escape Requirement
        const distToSafeCenter = Math.hypot(room.zone.targetX - p.x, room.zone.targetY - p.y);
        const distToCurrentCenter = Math.hypot(room.zone.currentX - p.x, room.zone.currentY - p.y);
        const isOutsideZone = room.mode === 'royale' && distToCurrentCenter > room.zone.currentRadius - 60;
        const isZoneClosing = room.mode === 'royale' && room.zone.isShrinking && distToSafeCenter > room.zone.targetRadius - 100;
        const mustEscapeZone = isOutsideZone || isZoneClosing;

        // Doorway Detection for Navigating Buildings
        let nearestDoor: { x: number; y: number } | null = null;
        for (const bldg of MAP_BUILDINGS) {
          if (p.x >= bldg.x - 70 && p.x <= bldg.x + bldg.w + 70 && p.y >= bldg.y - 70 && p.y <= bldg.y + bldg.h + 70) {
            for (const d of bldg.doorways) {
              const doorCenterX = d.x + d.w / 2;
              const doorCenterY = d.y + d.h / 2;
              const dDist = Math.hypot(doorCenterX - p.x, doorCenterY - p.y);
              if (dDist < 190) {
                nearestDoor = { x: doorCenterX, y: doorCenterY };
                break;
              }
            }
          }
          if (nearestDoor) break;
        }

        // Loot scavenging if low on resources and no immediate danger
        if (!mustEscapeZone && (!targetEnemy || minD > 500) && (p.hp < 70 || p.weapons.length < 2)) {
          let nearestLoot: LootItemData | null = null;
          let minLootD = 400;
          room.loot.forEach(l => {
            const ld = Math.hypot(l.x - p.x, l.y - p.y);
            if (ld < minLootD && !checkRaycastWalls(p.x, p.y, l.x, l.y).hit) {
              minLootD = ld;
              nearestLoot = l;
            }
          });
          if (nearestLoot) {
            const toLootAngle = Math.atan2((nearestLoot as LootItemData).y - p.y, (nearestLoot as LootItemData).x - p.x);
            p.angle = toLootAngle;
            p.vx = Math.cos(toLootAngle);
            p.vy = Math.sin(toLootAngle);
            p.shooting = false;
            if (minLootD < 60) {
              this.handlePlayerPickup(room, p, false);
            }
          }
        }

        if (mustEscapeZone) {
          // ZONE ESCAPE IS TOP PRIORITY: Sprint towards safe zone center
          const safeAngle = Math.atan2(room.zone.targetY - p.y, room.zone.targetX - p.x);
          
          // 5-Ray sensory check to steer around walls while running to safe zone
          const fWhisker = checkRaycastWalls(p.x, p.y, p.x + Math.cos(safeAngle) * 90, p.y + Math.sin(safeAngle) * 90);
          let escapeSteer = safeAngle;

          if (fWhisker.hit) {
            if (nearestDoor) {
              escapeSteer = Math.atan2(nearestDoor.y - p.y, nearestDoor.x - p.x);
            } else {
              const leftR = checkRaycastWalls(p.x, p.y, p.x + Math.cos(safeAngle - 0.8) * 80, p.y + Math.sin(safeAngle - 0.8) * 80);
              const rightR = checkRaycastWalls(p.x, p.y, p.x + Math.cos(safeAngle + 0.8) * 80, p.y + Math.sin(safeAngle + 0.8) * 80);
              if (!rightR.hit) escapeSteer = safeAngle + 1.2;
              else if (!leftR.hit) escapeSteer = safeAngle - 1.2;
              else escapeSteer = safeAngle + Math.PI * 0.7;
            }
          }

          p.vx = Math.cos(escapeSteer);
          p.vy = Math.sin(escapeSteer);

          // Shoot while fleeing only if enemy is in line of sight and within weapon range (< 500px)
          const activeCfg = WEAPON_CONFIGS[p.activeWeapon] || WEAPON_CONFIGS.pistol;
          const maxShootRange = Math.min(500, activeCfg.range || 500);
          if (targetEnemy && hasClearLOS && minD < maxShootRange) {
            const enemyAngle = Math.atan2((targetEnemy as PlayerData).y - p.y, (targetEnemy as PlayerData).x - p.x);
            p.angle = enemyAngle;
            p.shooting = true;
          } else {
            p.angle = escapeSteer;
            p.shooting = false;
          }
        } else if (targetEnemy) {
          const enemy: PlayerData = targetEnemy;
          const distToEnemy = Math.hypot(enemy.x - p.x, enemy.y - p.y);
          const directAngle = Math.atan2(enemy.y - p.y, enemy.x - p.x);
          const activeCfg = WEAPON_CONFIGS[p.activeWeapon] || WEAPON_CONFIGS.pistol;
          const maxShootRange = Math.min(500, activeCfg.range || 500);

          // Asimetrik Bot Dengesi: Hedef Platform Kontrolü (PC vs Mobil/Tablet)
          const targetPlatform = enemy.platform || 'pc';
          const isTargetPC = targetPlatform === 'pc';

          // Reaction timer: PC için 50-80ms (EXTREME HARD), Mobil/Tablet için 450-600ms (NORMAL/BALANCED)
          const reactionDelay = isTargetPC
            ? (50 + Math.floor(Math.random() * 30))
            : (450 + Math.floor(Math.random() * 150));

          if (p.botTargetPlayerId !== enemy.id) {
            p.botTargetPlayerId = enemy.id;
            p.botReactionUntil = now + reactionDelay;
          }

          const canShootNow = !p.botReactionUntil || now >= p.botReactionUntil;

          // Enhanced Sensory Ray Obstacle Avoidance with Doorway Awareness
          const forwardWhisker = checkRaycastWalls(p.x, p.y, p.x + Math.cos(directAngle) * 95, p.y + Math.sin(directAngle) * 95);
          let steerAngle = directAngle;

          if (forwardWhisker.hit) {
            if (nearestDoor && Math.hypot(nearestDoor.x - p.x, nearestDoor.y - p.y) < 160) {
              // Direct navigation through doorway
              steerAngle = Math.atan2(nearestDoor.y - p.y, nearestDoor.x - p.x);
            } else {
              const leftW = checkRaycastWalls(p.x, p.y, p.x + Math.cos(directAngle - 0.75) * 80, p.y + Math.sin(directAngle - 0.75) * 80);
              const rightW = checkRaycastWalls(p.x, p.y, p.x + Math.cos(directAngle + 0.75) * 80, p.y + Math.sin(directAngle + 0.75) * 80);
              if (!rightW.hit) {
                steerAngle = directAngle + 1.25;
              } else if (!leftW.hit) {
                steerAngle = directAngle - 1.25;
              } else {
                steerAngle = directAngle + Math.PI;
              }
            }
          }

          if (isTargetPC) {
            // ============================================
            // 1. HEDEF PC OYUNCUSU (EXTREME HARD / PRO BOT)
            // ============================================
            // Kusursuz Nişan (Near-Aimbot + Predictive Shooting / Leading Target)
            const bulletSpeed = activeCfg.speed || 14;
            const timeToHit = distToEnemy / Math.max(1, bulletSpeed);
            const enemyVx = (typeof enemy.vx === 'number' && Number.isFinite(enemy.vx)) ? enemy.vx : 0;
            const enemyVy = (typeof enemy.vy === 'number' && Number.isFinite(enemy.vy)) ? enemy.vy : 0;
            const enemySpeed = (enemy.speedBuffEndTime > now) ? 5.2 : 3.5;
            const predictedX = enemy.x + enemyVx * enemySpeed * timeToHit * 0.9;
            const predictedY = enemy.y + enemyVy * enemySpeed * timeToHit * 0.9;
            p.angle = Math.atan2(predictedY - p.y, predictedX - p.x); // Zero angle spread!

            // Agresif Dövüş Hareketi: Hızlı A-D dansı (180-280ms)
            if (!p.botStrafeTimer || now > p.botStrafeTimer) {
              p.botStrafeDir = Math.random() < 0.5 ? 1 : -1;
              p.botStrafeTimer = now + 180 + Math.floor(Math.random() * 100);
            }
            const strafeOffset = (p.botStrafeDir || 1) * 0.85;

            let moveVx = 0;
            let moveVy = 0;

            if (p.hp < 45) {
              // Canı azaldığında engele siper alıp arkasından vursun
              let bestCoverAngle = steerAngle + Math.PI;
              let foundCover = false;
              for (const obs of room.obstacles) {
                if (obs && obs.type === 'rock') {
                  const dObs = Math.hypot(obs.x - p.x, obs.y - p.y);
                  if (dObs < 280) {
                    const rockToEnemyAngle = Math.atan2(enemy.y - obs.y, enemy.x - obs.x);
                    const coverPointX = obs.x - Math.cos(rockToEnemyAngle) * (obs.radius + 35);
                    const coverPointY = obs.y - Math.sin(rockToEnemyAngle) * (obs.radius + 35);
                    bestCoverAngle = Math.atan2(coverPointY - p.y, coverPointX - p.x);
                    foundCover = true;
                    break;
                  }
                }
              }
              if (!foundCover) {
                bestCoverAngle = steerAngle + Math.PI * 0.8 * (p.botStrafeDir || 1);
              }
              moveVx = Math.cos(bestCoverAngle);
              moveVy = Math.sin(bestCoverAngle);
            } else {
              // Agresif hücum & A-D dansı
              if (distToEnemy > 220) {
                moveVx = Math.cos(steerAngle + strafeOffset * 0.4);
                moveVy = Math.sin(steerAngle + strafeOffset * 0.4);
              } else if (distToEnemy < 120) {
                moveVx = -Math.cos(steerAngle) * 0.8 + Math.cos(steerAngle + Math.PI / 2) * strafeOffset;
                moveVy = -Math.sin(steerAngle) * 0.8 + Math.sin(steerAngle + Math.PI / 2) * strafeOffset;
              } else {
                moveVx = Math.cos(steerAngle + (Math.PI / 2) * (p.botStrafeDir || 1));
                moveVy = Math.sin(steerAngle + (Math.PI / 2) * (p.botStrafeDir || 1));
              }
            }
            p.vx = moveVx;
            p.vy = moveVy;
          } else {
            // ============================================
            // 2. HEDEF MOBİL VEYA TABLET OYUNCUSU (NORMAL / BALANCED BOT)
            // ============================================
            // Belirgin ıskalama payı (inaccuracy / spread margin)
            const mobileSpreadMargin = 0.28 + Math.random() * 0.12;
            const aimJitter = (Math.random() - 0.5) * mobileSpreadMargin;
            p.angle = directAngle + aimJitter;

            // Yavaş ve bağışlayıcı strafe (900-1300ms aralıklarla)
            if (!p.botStrafeTimer || now > p.botStrafeTimer) {
              p.botStrafeDir = Math.random() < 0.5 ? 1 : -1;
              p.botStrafeTimer = now + 900 + Math.floor(Math.random() * 400);
            }
            const strafeOffset = (p.botStrafeDir || 1) * 0.5;
            p.vx = Math.cos(steerAngle + strafeOffset * 0.3) * 0.65;
            p.vy = Math.sin(steerAngle + strafeOffset * 0.3) * 0.65;
          }

          // Sadece silahın efektif menzilinde (< 500px), görüş hattı açık ve tepki süresi geçmişse ateş et!
          p.shooting = hasClearLOS && canShootNow && distToEnemy < maxShootRange;
        } else {
          // ACTIVE ROAMING & PATHFINDING (Bots constantly patrol and wander across map)
          if (!p.botRoamTimer || now > p.botRoamTimer || p.botRoamTargetX === undefined || p.botRoamTargetY === undefined) {
            const roamRadius = Math.min(MAP_SIZE * 0.35, room.zone.targetRadius * 0.85);
            p.botRoamTargetX = Math.max(200, Math.min(MAP_SIZE - 200, room.zone.targetX + (Math.random() - 0.5) * roamRadius * 2));
            p.botRoamTargetY = Math.max(200, Math.min(MAP_SIZE - 200, room.zone.targetY + (Math.random() - 0.5) * roamRadius * 2));
            p.botRoamTimer = now + 4000 + Math.random() * 4000;
          }

          const targetTx = p.botRoamTargetX ?? room.zone.targetX;
          const targetTy = p.botRoamTargetY ?? room.zone.targetY;
          const toTargetAngle = Math.atan2(targetTy - p.y, targetTx - p.x);
          const fWhisker = checkRaycastWalls(p.x, p.y, p.x + Math.cos(p.angle) * 85, p.y + Math.sin(p.angle) * 85);

          // Also check for rocks ahead
          let hitRockAhead = false;
          for (const obs of room.obstacles) {
            if (obs.type === 'rock') {
              const d = Math.hypot(obs.x - (p.x + Math.cos(p.angle) * 60), obs.y - (p.y + Math.sin(p.angle) * 60));
              if (d < obs.radius + 20) {
                hitRockAhead = true;
                break;
              }
            }
          }

          if (fWhisker.hit || hitRockAhead) {
            if (nearestDoor) {
              p.angle = Math.atan2(nearestDoor.y - p.y, nearestDoor.x - p.x);
            } else {
              p.angle += Math.PI * 0.55 * (p.botStrafeDir || 1);
            }
          } else {
            // Gradually steer towards roam destination
            let aDiff = toTargetAngle - p.angle;
            while (aDiff < -Math.PI) aDiff += Math.PI * 2;
            while (aDiff > Math.PI) aDiff -= Math.PI * 2;
            p.angle += aDiff * 0.08;
          }

          p.vx = Math.cos(p.angle) * 0.7;
          p.vy = Math.sin(p.angle) * 0.7;
          p.shooting = false;
        }

        // Anti-stuck detection
        if (p.botLastX !== undefined && p.botLastY !== undefined) {
          const moveDist = Math.hypot(p.x - p.botLastX, p.y - p.botLastY);
          if (moveDist < 0.8) {
            p.botStuckCounter = (p.botStuckCounter || 0) + 1;
            if (p.botStuckCounter > 15) {
              p.angle += Math.PI * 0.8;
              p.vx = Math.cos(p.angle);
              p.vy = Math.sin(p.angle);
              p.botStuckCounter = 0;
            }
          } else {
            p.botStuckCounter = 0;
          }
        }
        p.botLastX = p.x;
        p.botLastY = p.y;
      }

      // Calculate Player Movement Speed
      let speed = 4.8;
      if (p.speedBuffEndTime > now) speed *= 1.35;
      const inWater = this.isPointInRiver(p.x, p.y);
      const onBridge = this.isOnBridge(p.x, p.y);
      if (inWater && !onBridge) speed *= 0.62; // River drag

      if (p.vx || p.vy) {
        // Continuous Swept Sub-stepping & Collision Resolution (Anti-Tunneling)
        const totalDx = (p.vx || 0) * speed;
        const totalDy = (p.vy || 0) * speed;
        const moveDist = Math.hypot(totalDx, totalDy);
        const subSteps = Math.max(1, Math.ceil(moveDist / 4));
        const stepDx = totalDx / subSteps;
        const stepDy = totalDy / subSteps;

        for (let s = 0; s < subSteps; s++) {
          const testX = Math.max(30, Math.min(MAP_SIZE - 30, p.x + stepDx));
          const testY = Math.max(30, Math.min(MAP_SIZE - 30, p.y + stepDy));

          const rayWallX = checkRaycastWalls(p.x, p.y, testX, p.y);
          if (!rayWallX.hit && !this.checkBuildingWallCollision(testX, p.y, 22) && !this.checkObstacleCollision(room, testX, p.y, 22)) {
            p.x = testX;
          }

          const rayWallY = checkRaycastWalls(p.x, p.y, p.x, testY);
          if (!rayWallY.hit && !this.checkBuildingWallCollision(p.x, testY, 22) && !this.checkObstacleCollision(room, p.x, testY, 22)) {
            p.y = testY;
          }
        }
      }

      // Handle Shooting
      if (p.shooting && !p.isReloading) {
        const cfg = WEAPON_CONFIGS[p.activeWeapon];
        if (cfg && now - p.lastShootTime >= cfg.fireRate) {
          const curAmmo = p.ammo[p.activeWeapon] ?? 0;
          if (curAmmo > 0) {
            p.lastShootTime = now;
            p.ammo[p.activeWeapon] = curAmmo - 1;

            for (let b = 0; b < cfg.bulletsPerShot; b++) {
              const spread = (Math.random() - 0.5) * cfg.spread;
              const bAngle = p.angle + spread;
              const isRage = p.rageBuffEndTime > now;
              const finalDamage = isRage ? Math.round(cfg.damage * 1.5) : cfg.damage;

              const spawnX = p.x + Math.cos(bAngle) * 28;
              const spawnY = p.y + Math.sin(bAngle) * 28;

              // Corner Peeking & Wall Clipping Defense:
              // Check if ray from player center to bullet muzzle intersects any building wall
              const rayMuzzle = checkRaycastWalls(p.x, p.y, spawnX, spawnY, MAP_BUILDINGS);
              if (rayMuzzle.hit || this.checkBuildingWallCollision(spawnX, spawnY, 4)) {
                continue; // Muzzle obstructed by wall, cannot shoot through wall!
              }

              // Rock obstacle muzzle check
              let muzzleRockBlocked = false;
              for (const obs of room.obstacles) {
                if (obs.type === 'rock') {
                  const rHit = rayIntersectsCircle(p.x, p.y, spawnX, spawnY, obs.x, obs.y, obs.radius);
                  if (rHit.hit) {
                    muzzleRockBlocked = true;
                    break;
                  }
                }
              }
              if (muzzleRockBlocked) continue;

              room.bullets.push({
                id: `b_${p.id}_${now}_${b}`,
                shooterId: p.id,
                weaponType: p.activeWeapon,
                x: spawnX,
                y: spawnY,
                vx: Math.cos(bAngle) * cfg.speed,
                vy: Math.sin(bAngle) * cfg.speed,
                damage: finalDamage,
                color: isRage ? '#ef4444' : cfg.color,
                radius: cfg.bulletRadius,
                isAoE: cfg.isAoE,
                aoeRadius: cfg.aoeRadius,
                distanceTraveled: 0,
                maxRange: cfg.range
              });
            }

            if (p.ammo[p.activeWeapon] === 0) {
              this.triggerReload(p);
            }
          } else {
            this.triggerReload(p);
          }
        }
      }
    });
  }

  // ============================================================
  // RAY-CAST BULLET UPDATES (Ghosting & Tunneling Prevention)
  // ============================================================
  private updateBullets(room: GameRoom, now: number) {
    const remainingBullets: BulletData[] = [];

    room.bullets.forEach(bullet => {
      const prevX = bullet.x;
      const prevY = bullet.y;
      const nextX = bullet.x + bullet.vx;
      const nextY = bullet.y + bullet.vy;
      const stepDist = Math.hypot(bullet.vx, bullet.vy);

      bullet.distanceTraveled += stepDist;

      // 1. Map Boundaries and Range Check
      if (
        nextX < 0 || nextX > MAP_SIZE ||
        nextY < 0 || nextY > MAP_SIZE ||
        bullet.distanceTraveled >= bullet.maxRange
      ) {
        if (bullet.isAoE) {
          this.triggerExplosion(room, nextX, nextY, bullet.aoeRadius || 130, bullet.damage, bullet.shooterId);
        }
        return;
      }

      // 2. RAY-CAST WALL COLLISION (Zero-ghosting bullet physics)
      const wallRay = checkRaycastWalls(prevX, prevY, nextX, nextY, MAP_BUILDINGS);
      if (wallRay.hit) {
        // Wall spark/dust effect at exact impact point
        room.explosions.push({
          id: `spark_w_${now}_${Math.random().toString(36).substring(2, 6)}`,
          x: Math.round(wallRay.x),
          y: Math.round(wallRay.y),
          radius: 18,
          createdAt: now
        });
        if (bullet.isAoE) {
          this.triggerExplosion(room, wallRay.x, wallRay.y, bullet.aoeRadius || 130, bullet.damage, bullet.shooterId, bullet.weaponType);
        }
        return; // Bullet stops and terminates on the wall
      }

      // 2B. Rock Obstacle Swept Collision (Mermiler kayalardan geçemez)
      let hitRock = false;
      let rockHitX = nextX;
      let rockHitY = nextY;
      for (const obs of room.obstacles) {
        if (obs.type === 'rock') {
          const rHit = rayIntersectsCircle(prevX, prevY, nextX, nextY, obs.x, obs.y, obs.radius + bullet.radius);
          if (rHit.hit) {
            hitRock = true;
            rockHitX = rHit.x;
            rockHitY = rHit.y;
            break;
          }
        }
      }
      if (hitRock) {
        // Rock dust/spark effect
        room.explosions.push({
          id: `spark_r_${now}_${Math.random().toString(36).substring(2, 6)}`,
          x: Math.round(rockHitX),
          y: Math.round(rockHitY),
          radius: 18,
          createdAt: now
        });
        if (bullet.isAoE) {
          this.triggerExplosion(room, rockHitX, rockHitY, bullet.aoeRadius || 130, bullet.damage, bullet.shooterId, bullet.weaponType);
        }
        return; // Bullet blocked by solid rock obstacle!
      }

      // 3. TNT Barrel Swept Collision
      let hitBarrel = false;
      for (const barrel of room.barrels) {
        const dSq = distToSegmentSquared(barrel.x, barrel.y, prevX, prevY, nextX, nextY);
        const hitR = barrel.radius + bullet.radius;
        if (dSq <= hitR * hitR) {
          barrel.hp -= bullet.damage;
          hitBarrel = true;
          if (barrel.hp <= 0) {
            barrel.hp = 0;
            this.triggerExplosion(room, barrel.x, barrel.y, 140, 85, bullet.shooterId, 'barrel');
          }
          break;
        }
      }
      if (hitBarrel) {
        room.barrels = room.barrels.filter(b => b.hp > 0);
        return;
      }

      // 4. Crate Swept Collision
      let hitCrate = false;
      for (const crate of room.crates) {
        const dSq = distToSegmentSquared(crate.x, crate.y, prevX, prevY, nextX, nextY);
        const hitR = 24 + bullet.radius;
        if (dSq <= hitR * hitR) {
          crate.hp -= bullet.damage;
          hitCrate = true;
          if (crate.hp <= 0) {
            const wName = crate.lootType.startsWith('weapon_') ? crate.lootType.replace('weapon_', '') : null;
            const mag = wName && WEAPON_CONFIGS[wName] ? WEAPON_CONFIGS[wName].magSize : undefined;
            room.loot.push({
              id: `loot_cr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: crate.lootType,
              currentAmmo: mag,
              maxAmmo: mag,
              x: crate.x,
              y: crate.y
            });
          }
          break;
        }
      }
      if (hitCrate) {
        room.crates = room.crates.filter(c => c.hp > 0);
        return;
      }

      // 5. Player Swept Ray-Collision (Behind Wall/Rock Protection)
      let hitPlayer = false;
      for (const target of room.players) {
        if (!target || !target.isAlive || target.id === bullet.shooterId) continue;
        if (target.spawnShieldEndTime > now) continue;

        const dSq = distToSegmentSquared(target.x, target.y, prevX, prevY, nextX, nextY);
        const hitR = 24 + bullet.radius;
        if (dSq <= hitR * hitR) {
          // Wall check: wall between bullet origin and player blocks damage!
          const wallBlock = checkRaycastWalls(prevX, prevY, target.x, target.y, MAP_BUILDINGS);
          if (wallBlock.hit) continue;

          // Rock check: rock between bullet origin and player blocks damage!
          let rockBlock = false;
          for (const obs of room.obstacles) {
            if (obs.type === 'rock') {
              const rHit = rayIntersectsCircle(prevX, prevY, target.x, target.y, obs.x, obs.y, obs.radius);
              if (rHit.hit) {
                rockBlock = true;
                break;
              }
            }
          }
          if (rockBlock) continue;

          hitPlayer = true;
          this.applyDamageToPlayer(room, target, bullet.damage, bullet.shooterId, bullet.weaponType);
          break;
        }
      }

      if (hitPlayer) {
        if (bullet.isAoE) {
          this.triggerExplosion(room, nextX, nextY, bullet.aoeRadius || 130, bullet.damage, bullet.shooterId, bullet.weaponType);
        }
        return;
      }

      // Bullet advanced safely
      bullet.x = nextX;
      bullet.y = nextY;
      remainingBullets.push(bullet);
    });

    room.bullets = remainingBullets;
  }

  private triggerExplosion(
    room: GameRoom,
    x: number,
    y: number,
    radius: number,
    maxDamage: number,
    shooterId: string,
    weaponType: string = 'plasma'
  ) {
    const now = Date.now();
    room.explosions.push({ id: `exp_${now}_${Math.random().toString(36).substring(2, 6)}`, x, y, radius, createdAt: now });

    // Damage Players with wall-blocking line-of-sight check
    room.players.forEach(p => {
      if (!p || !p.isAlive || p.spawnShieldEndTime > now) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius) {
        // Wall between explosion center and player shields the player!
        const wallBlock = checkRaycastWalls(x, y, p.x, p.y, MAP_BUILDINGS);
        if (wallBlock.hit) return;

        // Rock between explosion center and player shields the player!
        let rockBlock = false;
        for (const obs of room.obstacles) {
          if (obs.type === 'rock') {
            const rHit = rayIntersectsCircle(x, y, p.x, p.y, obs.x, obs.y, obs.radius);
            if (rHit.hit) {
              rockBlock = true;
              break;
            }
          }
        }
        if (rockBlock) return;

        const falloff = 1 - (d / radius);
        const dmg = Math.round(maxDamage * Math.max(0.4, falloff));
        this.applyDamageToPlayer(room, p, dmg, shooterId, weaponType);
      }
    });

    // Destroy Barrels
    room.barrels.forEach(b => {
      if (Math.hypot(b.x - x, b.y - y) <= radius) {
        b.hp -= maxDamage;
      }
    });
    room.barrels = room.barrels.filter(b => b.hp > 0);

    // Destroy Crates & drop loot with full ammo
    room.crates.forEach(c => {
      if (Math.hypot(c.x - x, c.y - y) <= radius) {
        c.hp -= maxDamage;
        if (c.hp <= 0) {
          const wName = c.lootType.startsWith('weapon_') ? c.lootType.replace('weapon_', '') : null;
          const mag = wName && WEAPON_CONFIGS[wName] ? WEAPON_CONFIGS[wName].magSize : undefined;
          room.loot.push({
            id: `loot_exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: c.lootType,
            currentAmmo: mag,
            maxAmmo: mag,
            x: c.x,
            y: c.y
          });
        }
      }
    });
    room.crates = room.crates.filter(c => c.hp > 0);
  }

  private applyDamageToPlayer(
    room: GameRoom,
    target: PlayerData,
    damage: number,
    attackerId: string,
    weaponType?: string
  ) {
    if (!target || !target.isAlive || target.spawnShieldEndTime > Date.now()) return;

    let dmg = damage;
    let totalDmg = damage;

    if (weaponType === 'plasma') {
      if (target.shield > 0) {
        // Plazma Kalkan Dengesi: Toplam 50 hasar (Önce kalkandan 50 düşsün, kalkan biterse kalanı cana yansısın)
        const totalPlasma = 50;
        const shieldAbsorb = Math.min(target.shield, totalPlasma);
        target.shield -= shieldAbsorb;
        const remainingHpDmg = totalPlasma - shieldAbsorb;
        target.hp = Math.max(0, target.hp - remainingHpDmg);
        totalDmg = totalPlasma;
      } else {
        // Plazma Saf Can Dengesi: Tam vuruşta 90 hasar (100 candan 10 can bırakır, doğrudan tek atmaz!)
        const totalPlasma = 90;
        target.hp = Math.max(0, target.hp - totalPlasma);
        totalDmg = totalPlasma;
      }
    } else {
      // Standart Silah Hasar Dağılımı: Önce kalkan absorbe eder, kalkan biterse kalanı cana yansır
      if (target.shield > 0) {
        const shieldAbsorb = Math.min(target.shield, dmg);
        target.shield -= shieldAbsorb;
        dmg -= shieldAbsorb;
      }
      target.hp = Math.max(0, target.hp - dmg);
    }

    room.damagePopups.push({
      id: `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: target.x,
      y: target.y - 20,
      damage: totalDmg,
      color: target.shield > 0 ? '#06b6d4' : '#ef4444',
      createdAt: Date.now()
    });

    if (target.hp <= 0) {
      this.eliminatePlayer(room, target, attackerId, weaponType);
    }
  }

  private eliminatePlayer(room: GameRoom, victim: PlayerData, killerId: string, weaponType?: string) {
    victim.isAlive = false;
    victim.deaths = (victim.deaths || 0) + 1;
    victim.hp = 0;
    victim.shield = 0;
    // Immediately cut off any actions, ghost inputs or reload loops
    victim.isReloading = false;
    victim.reloadEndTime = 0;
    victim.shooting = false;
    victim.vx = 0;
    victim.vy = 0;

    const killer = room.players.find(p => p.id === killerId);
    if (killer) {
      killer.kills = (killer.kills || 0) + 1;
    }

    const usedWeapon = weaponType || (killer ? killer.activeWeapon : 'Gaz');
    room.killfeed.unshift({
      id: Math.random().toString(36).substring(2, 7),
      killer: killer ? killer.username : 'Bölge / Gaz',
      victim: victim.username,
      weapon: usedWeapon,
      time: Date.now()
    });
    if (room.killfeed.length > 8) room.killfeed.pop();

    // Drop victim's weapon with its EXACT remaining ammo on ground!
    if (victim.activeWeapon && victim.activeWeapon !== 'fists') {
      const curAmmo = victim.ammo[victim.activeWeapon] ?? (WEAPON_CONFIGS[victim.activeWeapon]?.magSize || 10);
      room.loot.push({
        id: `loot_drop_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: `weapon_${victim.activeWeapon}`,
        currentAmmo: curAmmo,
        maxAmmo: WEAPON_CONFIGS[victim.activeWeapon]?.magSize || 10,
        x: victim.x,
        y: victim.y
      });
    }
    room.loot.push({
      id: `loot_med_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'medkit',
      x: victim.x + 20,
      y: victim.y + 20
    });

    if (room.mode === 'deathmatch') {
      victim.respawnAt = Date.now() + 3000;
    }
  }

  private updateZone(room: GameRoom) {
    const z = room.zone;
    if (z.isShrinking) {
      if (z.currentRadius > z.targetRadius) {
        z.currentRadius = Math.max(z.targetRadius, z.currentRadius - 1.8);
      }
      const dx = z.targetX - z.currentX;
      const dy = z.targetY - z.currentY;
      const d = Math.hypot(dx, dy);
      if (d > 1) {
        z.currentX += (dx / d) * 1.2;
        z.currentY += (dy / d) * 1.2;
      }
      if (z.currentRadius <= z.targetRadius + 2) {
        z.isShrinking = false;
        z.phase++;
        z.phaseTimer = Math.max(15, 35 - z.phase * 4);
        z.damagePerSec = 2.5 + z.phase * 1.5;
      }
    } else {
      z.phaseTimer -= 1 / 30;
      if (z.phaseTimer <= 0 && z.phase < 5) {
        z.isShrinking = true;
        const nextR = z.currentRadius * 0.58;
        const maxOffset = z.currentRadius - nextR;
        const ang = Math.random() * Math.PI * 2;
        const dist = Math.random() * maxOffset * 0.75;
        z.targetX = Math.max(nextR + 100, Math.min(MAP_SIZE - nextR - 100, z.currentX + Math.cos(ang) * dist));
        z.targetY = Math.max(nextR + 100, Math.min(MAP_SIZE - nextR - 100, z.currentY + Math.sin(ang) * dist));
        z.targetRadius = nextR;
        this.io.to(room.id).emit('royale:zone_warning', { message: '⚠️ Güvenli Bölge Daralıyor!' });
      }
    }

    // Apply zone damage
    room.players.forEach(p => {
      if (!p.isAlive) return;
      const d = Math.hypot(p.x - z.currentX, p.y - z.currentY);
      if (d > z.currentRadius) {
        p.hp = Math.max(0, p.hp - z.damagePerSec * (1 / 30));
        if (p.hp <= 0) {
          this.eliminatePlayer(room, p, '');
        }
      }
    });
  }

  private endBattleRoyale(room: GameRoom, winner: PlayerData | null) {
    room.status = 'gameover';
    room.winner = winner ? {
      id: winner.id,
      userId: winner.userId,
      username: winner.username,
      avatar: winner.avatar,
      kills: winner.kills
    } : null;

    if (winner && winner.userId > 0) {
      this.recordWin(winner.userId, winner.kills);
    }

    this.io.to(room.id).emit('royale:game_over', { winner: room.winner, state: this.getPublicGameState(room) });
    this.broadcastRoomsList();
  }

  private endDeathmatch(room: GameRoom) {
    room.status = 'gameover';
    const sorted = [...room.players].sort((a, b) => (b.kills || 0) - (a.kills || 0));
    const leader = sorted[0] || null;

    room.winner = leader ? {
      id: leader.id,
      userId: leader.userId,
      username: leader.username,
      avatar: leader.avatar,
      kills: leader.kills
    } : null;

    if (leader && leader.userId > 0) {
      this.recordWin(leader.userId, leader.kills);
    }

    this.io.to(room.id).emit('royale:game_over', { winner: room.winner, state: this.getPublicGameState(room) });
    this.broadcastRoomsList();
  }

  private async recordWin(userId: number, kills: number) {
    try {
      await this.db.execute({
        sql: `UPDATE users SET 
              royale_wins = COALESCE(royale_wins, 0) + 1,
              royale_kills = COALESCE(royale_kills, 0) + ?,
              royale_matches = COALESCE(royale_matches, 0) + 1
              WHERE id = ?`,
        args: [kills, userId]
      });
    } catch (e) {
      console.error('Error updating royale stats:', e);
    }
  }

  public async getLeaderboard(sortBy: 'wins' | 'kills' = 'wins') {
    try {
      const orderCol = sortBy === 'kills' ? 'royale_kills' : 'royale_wins';
      const secCol = sortBy === 'kills' ? 'royale_wins' : 'royale_kills';
      const res = await this.db.execute({
        sql: `SELECT id, username, avatar, color, 
              COALESCE(royale_wins, 0) as wins, 
              COALESCE(royale_kills, 0) as kills,
              COALESCE(royale_matches, 0) as matches
              FROM users 
              ORDER BY ${orderCol} DESC, ${secCol} DESC 
              LIMIT 15`,
        args: []
      });
      return res.rows.map((row: any, idx: number) => ({
        rank: idx + 1,
        id: Number(row.id),
        username: String(row.username || 'Oyuncu'),
        avatar: row.avatar ? String(row.avatar) : null,
        color: row.color ? String(row.color) : '#3b82f6',
        wins: Number(row.wins || 0),
        kills: Number(row.kills || 0),
        matches: Number(row.matches || 0)
      }));
    } catch (e) {
      console.error('Error getting leaderboard:', e);
      return [];
    }
  }

  private findSafeSpawn(room: GameRoom): { x: number; y: number } {
    for (let attempt = 0; attempt < 35; attempt++) {
      const x = 300 + Math.random() * (MAP_SIZE - 600);
      const y = 300 + Math.random() * (MAP_SIZE - 600);
      if (!this.checkBuildingWallCollision(x, y, 32)) {
        return { x: Math.round(x), y: Math.round(y) };
      }
    }
    return { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
  }

  public broadcastRoomState(room: GameRoom) {
    this.io.to(room.id).emit('royale:room_state', this.getPublicRoomState(room));
  }

  public broadcastGameState(room: GameRoom) {
    this.io.to(room.id).emit('royale:game_state', this.getPublicGameState(room));
  }

  public getPublicRoomState(room: GameRoom) {
    return {
      id: room.id,
      title: room.title,
      hostId: room.hostId,
      hostName: room.hostName,
      hostAvatar: room.hostAvatar,
      capacity: room.capacity,
      mode: room.mode,
      duration: room.duration,
      status: room.status,
      players: room.players.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        isHost: p.isHost,
        ready: p.ready,
        platform: p.platform
      }))
    };
  }

  // ============================================================
  // NETCODE OPTIMIZATION: Compact JSON Payload for 20 Players
  // ============================================================
  public getPublicGameState(room: GameRoom) {
    const now = Date.now();
    return {
      id: room.id,
      status: room.status,
      mode: room.mode,
      matchTimeRemaining: Math.round(room.matchTimeRemaining),
      duration: room.duration,
      players: (room.players || []).filter(Boolean).map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        isHost: p.isHost,
        platform: p.platform,
        ready: p.ready,
        x: Math.round(p.x),
        y: Math.round(p.y),
        angle: Math.round(p.angle * 100) / 100,
        hp: Math.round(p.hp),
        maxHp: p.maxHp,
        shield: Math.round(p.shield),
        maxShield: p.maxShield,
        activeWeapon: p.activeWeapon,
        activeWeaponSlot: p.activeWeaponSlot,
        weapons: p.weapons,
        ammo: p.ammo,
        reserveAmmo: p.reserveAmmo,
        isReloading: p.isReloading,
        isAlive: p.isAlive,
        kills: p.kills,
        deaths: p.deaths,
        spectating: p.spectating,
        respawnAt: p.respawnAt,
        spawnShieldEndTime: p.spawnShieldEndTime,
        speedBuffEndTime: p.speedBuffEndTime,
        rageBuffEndTime: p.rageBuffEndTime
      })),
      bullets: (room.bullets || []).filter(Boolean).map(b => ({
        id: b.id,
        shooterId: b.shooterId,
        weaponType: b.weaponType,
        x: Math.round(b.x),
        y: Math.round(b.y),
        vx: Math.round(b.vx),
        vy: Math.round(b.vy),
        damage: b.damage,
        color: b.color,
        radius: b.radius,
        isAoE: b.isAoE
      })),
      crates: (room.crates || []).filter(Boolean).map(c => ({
        id: c.id,
        x: Math.round(c.x),
        y: Math.round(c.y),
        hp: Math.round(c.hp),
        maxHp: c.maxHp,
        tier: c.tier,
        isMilitary: c.isMilitary
      })),
      barrels: (room.barrels || []).filter(Boolean).map(b => ({
        id: b.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        hp: Math.round(b.hp),
        maxHp: b.maxHp,
        radius: b.radius
      })),
      explosions: (room.explosions || []).filter(Boolean).filter(e => now - e.createdAt < 750),
      loot: (room.loot || []).filter(Boolean).map(l => ({
        id: l.id,
        x: Math.round(l.x),
        y: Math.round(l.y),
        type: l.type,
        currentAmmo: l.currentAmmo,
        maxAmmo: l.maxAmmo
      })),
      obstacles: room.obstacles,
      zone: {
        currentX: Math.round(room.zone.currentX),
        currentY: Math.round(room.zone.currentY),
        currentRadius: Math.round(room.zone.currentRadius),
        targetX: Math.round(room.zone.targetX),
        targetY: Math.round(room.zone.targetY),
        targetRadius: Math.round(room.zone.targetRadius),
        isShrinking: room.zone.isShrinking,
        phase: room.zone.phase
      },
      damagePopups: room.damagePopups.filter(dp => now - dp.createdAt < 1000).slice(-6),
      killfeed: room.killfeed.slice(-4),
      winner: room.winner
    };
  }

  // ============================================================
  // HEADLESS TEST SIMULATION (20 Bots Autonomous Stress Test)
  // ============================================================
  public runHeadlessTest(cycles: number = 1000): {
    success: boolean;
    cyclesCompleted: number;
    errors: string[];
    durationMs: number;
    stats: {
      actionsPerformed: number;
      pickupsAttempted: number;
      wallCollisionsChecked: number;
      weaponsSwapped: number;
      disconnectsSimulated: number;
      bulletsFired: number;
    };
  } {
    const errorTracker: string[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      errorTracker.push(msg);
      originalConsoleError('[HEADLESS TEST CAPTURED ERROR]:', ...args);
    };

    const startTime = Date.now();
    const stats = {
      actionsPerformed: 0,
      pickupsAttempted: 0,
      wallCollisionsChecked: 0,
      weaponsSwapped: 0,
      disconnectsSimulated: 0,
      bulletsFired: 0
    };

    const testRoomId = `headless_test_${Date.now()}`;
    try {
      // 1. Create a dedicated Headless Test Room
      const room = this.createRoomInternal(
        "Autonomous Headless Test Room",
        999999,
        "TestMaster",
        null,
        20,
        "deathmatch",
        600
      );
      room.id = testRoomId;
      this.rooms.set(testRoomId, room);

      // 2. Spawn 20 bots with asymmetric platforms (10 PC, 5 Mobile, 5 Tablet)
      const botNames = ['AlphaBot', 'BravoBot', 'CharlieBot', 'DeltaBot', 'EchoBot'];
      for (let i = 0; i < 20; i++) {
        const platform: 'pc' | 'mobile' | 'tablet' = i < 10 ? 'pc' : i < 15 ? 'mobile' : 'tablet';
        const bot: PlayerData = {
          id: `bot_sim_${i}_${Math.random().toString(36).substring(2, 7)}`,
          userId: -20000 - i,
          username: `${botNames[i % botNames.length]}_${i}`,
          avatar: null,
          color: '#3b82f6',
          isBot: true,
          isHost: i === 0,
          ready: true,
          platform,
          x: 400 + ((i * 140) % (MAP_SIZE - 800)),
          y: 400 + ((i * 160) % (MAP_SIZE - 800)),
          angle: (i * Math.PI) / 10,
          hp: 100,
          maxHp: 100,
          shield: 50,
          maxShield: 100,
          activeWeapon: 'pistol',
          activeWeaponSlot: 0,
          weapons: ['pistol'],
          ammo: { pistol: 15, shotgun: 6, smg: 32, rifle: 30, sniper: 5, plasma: 3 },
          reserveAmmo: { pistol: 60, shotgun: 24, smg: 120, rifle: 90, sniper: 15, plasma: 6 },
          isReloading: false,
          reloadEndTime: 0,
          isAlive: true,
          kills: 0,
          deaths: 0,
          spectating: false,
          respawnAt: null,
          spawnShieldEndTime: 0,
          speedBuffEndTime: 0,
          rageBuffEndTime: 0,
          lastShootTime: 0,
          botStrafeDir: 1,
          botStrafeTimer: 0
        };
        room.players.push(bot);
      }

      room.status = 'playing';

      // 3. Seed test loot items
      const weaponTypes = ['shotgun', 'uzi', 'ak47', 'awp', 'plasma'];
      for (let w = 0; w < 30; w++) {
        const wType = weaponTypes[w % weaponTypes.length];
        const wCfg = WEAPON_CONFIGS[wType] || WEAPON_CONFIGS.pistol;
        room.loot.push({
          id: `loot_test_${w}`,
          type: `weapon_${wType}`,
          currentAmmo: wCfg.magSize,
          maxAmmo: wCfg.magSize,
          x: 300 + ((w * 110) % (MAP_SIZE - 600)),
          y: 300 + ((w * 130) % (MAP_SIZE - 600))
        });
      }

      // 4. Run `cycles` simulation iterations
      for (let c = 0; c < cycles; c++) {
        stats.actionsPerformed++;

        // A. Race Condition Test: Multiple bots try to pick up the EXACT same loot item at the exact same index
        if (room.loot.length > 0) {
          const targetLoot = room.loot[0];
          for (let b = 0; b < Math.min(5, room.players.length); b++) {
            const p = room.players[b];
            if (p && p.isAlive) {
              p.x = targetLoot.x;
              p.y = targetLoot.y;
              this.handlePlayerPickup(room, p, true);
              stats.pickupsAttempted++;
            }
          }
        }

        // B. Collision Glitch Test: Move bots directly across and along building wall edges and doorways
        for (const bldg of MAP_BUILDINGS) {
          for (const wall of bldg.walls) {
            const res = checkRaycastWalls(wall.x - 10, wall.y - 10, wall.x + wall.w + 10, wall.y + wall.h + 10);
            stats.wallCollisionsChecked++;
            if (res.t < 0 || res.t > 1) {
              errorTracker.push(`[Collision Glitch]: Raycast t out of bounds [0, 1]: ${res.t}`);
            }
          }
        }

        // C. Inventory Desync Test: Rapidly swap slots (0 <-> 1) while reloading and shooting simultaneously
        for (let b = 0; b < room.players.length; b++) {
          const p = room.players[b];
          if (!p || !p.isAlive) continue;

          this.processPlayerInput(room.id, p.userId, {
            switchWeapon: c % 2 === 0 ? 0 : 1,
            shooting: true,
            reload: c % 4 === 0
          });
          stats.weaponsSwapped++;
        }

        // D. Disconnect Edge Case Test: Randomly disconnect and reconnect bots
        if (c % 30 === 0 && room.players.length > 10) {
          const dropIdx = Math.floor(Math.random() * room.players.length);
          const droppedPlayer = room.players[dropIdx];
          if (droppedPlayer) {
            this.leaveRoom(room.id, droppedPlayer.userId);
            stats.disconnectsSimulated++;

            // Re-add bot to maintain simulation population
            this.addBot(room.id, 999999);
          }
        }

        // Run game loop tick
        this.tickGame(room);

        // Verify serializability and null safety of game state
        const state = this.getPublicGameState(room);
        if (!state || !Array.isArray(state.players) || !Array.isArray(state.bullets)) {
          errorTracker.push(`[State Corruption]: getPublicGameState produced invalid shape on cycle ${c}`);
        }

        for (const p of state.players) {
          if (isNaN(p.x) || isNaN(p.y) || isNaN(p.hp)) {
            errorTracker.push(`[NaN State Error]: Player ${p.username} has NaN values: x=${p.x}, y=${p.y}, hp=${p.hp}`);
          }
        }

        stats.bulletsFired += state.bullets?.length || 0;
      }

      // Cleanup test room
      this.destroyRoom(testRoomId);
    } catch (testErr: any) {
      errorTracker.push(`[Simulation Exception]: ${testErr?.message || String(testErr)}`);
      originalConsoleError('[Simulation Exception]:', testErr);
    } finally {
      console.error = originalConsoleError;
      if (this.rooms.has(testRoomId)) {
        this.destroyRoom(testRoomId);
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      success: errorTracker.length === 0,
      cyclesCompleted: cycles,
      errors: errorTracker,
      durationMs,
      stats
    };
  }
}

// ============================================================
// VIRTUAL HUMAN CLIENT EMULATOR (MockHumanClient & Chaos Network)
// ============================================================
export interface MockClientPacket {
  event: string;
  payload: any;
  deliverAt: number;
}

export class MockHumanClient {
  public id: string;
  public userId: number;
  public username: string;
  public platform: 'pc' | 'mobile' | 'tablet';
  public latency: number; // 20ms - 150ms
  public packetQueue: MockClientPacket[] = [];
  public lastAngle: number = 0;
  public keys: { up: boolean; down: boolean; left: boolean; right: boolean } = { up: false, down: false, left: false, right: false };
  public isShooting: boolean = false;
  public receivedStates: any[] = [];
  public respawnedCount: number = 0;
  public deathCount: number = 0;
  public lastSeenAlive: boolean = true;
  public cameraPos: { x: number; y: number } = { x: 2100, y: 2100 };

  constructor(userId: number, username: string, platform: 'pc' | 'mobile' | 'tablet' = 'pc') {
    this.userId = userId;
    this.username = username;
    this.id = `client_${userId}_${Math.random().toString(36).substring(2, 7)}`;
    this.platform = platform;
    this.latency = Math.floor(20 + Math.random() * 130);
  }

  public queueEmit(event: string, payload: any, currentTime: number, jitter: number = 0) {
    // 15% random packet drop simulation
    if (Math.random() < 0.15 && event !== 'royale:join_room') {
      return;
    }
    const delay = Math.max(1, this.latency + (Math.random() - 0.5) * jitter);
    this.packetQueue.push({
      event,
      payload,
      deliverAt: currentTime + delay
    });
  }

  public flushPackets(currentTime: number, manager: BattleRoyaleManager, roomId: string) {
    const ready = this.packetQueue.filter(p => p.deliverAt <= currentTime);
    this.packetQueue = this.packetQueue.filter(p => p.deliverAt > currentTime);

    // Simulated out-of-order jitter delivery
    ready.sort(() => Math.random() - 0.5);

    for (const pkt of ready) {
      if (pkt.event === 'player:input' || pkt.event === 'royale:input') {
        manager.processPlayerInput(roomId, this.userId, pkt.payload);
      } else if (pkt.event === 'player:interact_loot' || pkt.event === 'royale:interact_loot') {
        manager.processPlayerInput(roomId, this.userId, { pickup: true, swapWeapon: true, ...pkt.payload });
      } else if (pkt.event === 'player:request_respawn' || pkt.event === 'royale:request_respawn') {
        manager.requestRespawn(roomId, this.userId);
      } else if (pkt.event === 'player:drop_weapon' || pkt.event === 'royale:drop_weapon') {
        manager.dropPlayerWeapon(roomId, this.userId, pkt.payload?.slot);
      } else if (pkt.event === 'player:respawn_ack' || pkt.event === 'royale:respawn_ack') {
        manager.confirmRespawnAck(roomId, this.userId);
      }
    }
  }

  public receiveServerEvent(event: string, data: any) {
    if (event === 'royale:game_state') {
      this.receivedStates.push(data);
      if (this.receivedStates.length > 5) this.receivedStates.shift();
      if (Array.isArray(data?.players)) {
        const me = data.players.find((p: any) => p && p.userId === this.userId);
        if (me) {
          if (me.isAlive && !this.lastSeenAlive) {
            // Self-healing camera snap on respawn
            this.cameraPos = { x: me.x, y: me.y };
          }
          this.lastSeenAlive = me.isAlive;
        }
      }
    } else if (event === 'player:respawned' || event === 'royale:player_respawned') {
      if (data?.userId === this.userId) {
        this.respawnedCount++;
        this.cameraPos = { x: data.x, y: data.y };
      }
    }
  }
}

export function runVirtualHumanClientsSimulation(manager?: BattleRoyaleManager, cycles: number = 1000, clientCount: number = 10) {
  const errorTracker: string[] = [];
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    errorTracker.push(msg);
  };

  const startTime = Date.now();
  const testRoomId = `virtual_human_test_${Date.now()}`;
  let virtualTime = Date.now();

  const stats = {
    virtualClients: clientCount,
    inputPacketsSent: 0,
    lootSwapsAttempted: 0,
    respawnsHandled: 0,
    cornerWallShotsTested: 0,
    rageQuitDisconnectsHandled: 0,
    scenariosPassed: 0
  };

  const mockIo = {
    to: (targetRoomId: string) => ({
      emit: (event: string, payload: any) => {
        clients.forEach(c => c.receiveServerEvent(event, payload));
      }
    }),
    emit: (event: string, payload: any) => {
      clients.forEach(c => c.receiveServerEvent(event, payload));
    }
  } as any;

  const mgr = manager || new BattleRoyaleManager(mockIo);
  const clients: MockHumanClient[] = [];

  try {
    // 1. Create Dedicated Test Room (Deathmatch)
    const room = mgr.createRoomInternal(
      "Virtual Human Stress Arena",
      999990,
      "HumanHost",
      null,
      clientCount + 5,
      "deathmatch",
      600
    );
    room.id = testRoomId;
    mgr.rooms.set(testRoomId, room);

    // 2. Instantiate 10 Virtual Human Clients
    for (let i = 0; i < clientCount; i++) {
      const platform: 'pc' | 'mobile' | 'tablet' = i < 6 ? 'pc' : i < 8 ? 'mobile' : 'tablet';
      const client = new MockHumanClient(90001 + i, `Human_${i + 1}`, platform);
      clients.push(client);

      const res = mgr.joinRoom(testRoomId, {
        id: client.userId,
        username: client.username,
        avatar: null,
        color: '#22c55e'
      });
      if (!res.success) {
        errorTracker.push(`[Client Join Failure]: Client ${client.username} could not join room`);
      }
    }

    room.status = 'playing';

    // Seed Ground Loot & Weapons
    const testWeapons = ['ak47', 'shotgun', 'uzi', 'awp', 'plasma'];
    for (let w = 0; w < 25; w++) {
      const wName = testWeapons[w % testWeapons.length];
      const cfg = WEAPON_CONFIGS[wName] || WEAPON_CONFIGS.pistol;
      room.loot.push({
        id: `loot_virtual_${w}`,
        type: `weapon_${wName}`,
        currentAmmo: cfg.magSize,
        maxAmmo: cfg.magSize,
        x: 1000 + ((w * 130) % (MAP_SIZE - 2000)),
        y: 1000 + ((w * 150) % (MAP_SIZE - 2000))
      });
    }

    // ============================================================
    // CRISIS SCENARIO 1: DEATH & RESPAWN INVISIBILITY / GHOST INPUT
    // ============================================================
    const p1 = room.players.find(p => p.userId === clients[0].userId);
    const p2 = room.players.find(p => p.userId === clients[1].userId);
    if (p1 && p2) {
      // Simulate Player 1 dying
      p1.hp = 0;
      p1.isAlive = false;
      p1.respawnAt = virtualTime + 3000;

      // Player 1 spams rapid movement and shooting packets while dead
      for (let spam = 0; spam < 40; spam++) {
        clients[0].queueEmit('player:input', {
          up: true,
          right: true,
          angle: Math.PI / 4,
          isShooting: true
        }, virtualTime, 40);
      }
      clients[0].flushPackets(virtualTime + 200, mgr, testRoomId);

      // Verify Ghost input prevention: Dead player cannot shoot or spawn bullets
      if (p1.shooting) {
        errorTracker.push(`[Scenario 1 Failed]: Dead player was allowed to shoot!`);
      }

      // Fast forward virtual time to respawn
      virtualTime += 3100;
      mgr.processPlayerInput(testRoomId, p1.userId, { requestRespawn: true });
      if (!p1.isAlive || p1.hp !== 100) {
        errorTracker.push(`[Scenario 1 Failed]: Player 1 did not respawn properly with 100 HP!`);
      }

      // Verify visibility in public game state
      const pState = mgr.getPublicGameState(room);
      const p1InState = pState.players.find((p: any) => p.userId === p1.userId);
      if (!p1InState || !p1InState.isAlive) {
        errorTracker.push(`[Scenario 1 Failed]: Player 1 is not marked isAlive: true in public game state for Player 2!`);
      } else {
        stats.scenariosPassed++;
      }
    }

    // ============================================================
    // CRISIS SCENARIO 2: F5 & RAGE QUIT AT EXACT DEATH MOMENT
    // ============================================================
    const p3 = room.players.find(p => p.userId === clients[2].userId);
    if (p3) {
      p3.hp = 0;
      p3.isAlive = false;
      // In the exact same millisecond, socket disconnects
      mgr.leaveRoom(testRoomId, p3.userId);
      stats.rageQuitDisconnectsHandled++;

      // Run 30 consecutive ticks to ensure no undefined crashes occur
      for (let t = 0; t < 30; t++) {
        mgr['tickGame'](room);
      }

      // Check room state: p3 must be completely removed without leaving a zombie sprite
      const stateAfterQuit = mgr.getPublicGameState(room);
      const zombieFound = stateAfterQuit.players.some((p: any) => p.userId === clients[2].userId);
      if (zombieFound) {
        errorTracker.push(`[Scenario 2 Failed]: Rage quit player was not removed and left a zombie sprite!`);
      } else {
        stats.scenariosPassed++;
      }
    }

    // ============================================================
    // CRISIS SCENARIO 3: LOOT SWAP SPAM (10 E/SEC AMMO INTEGRITY)
    // ============================================================
    const p4 = room.players.find(p => p.userId === clients[3].userId);
    if (p4 && p4.isAlive) {
      p4.x = 1500;
      p4.y = 1500;
      room.loot.push({
        id: 'loot_test_shotgun_mag6',
        type: 'weapon_shotgun',
        currentAmmo: 6,
        maxAmmo: 6,
        x: 1500,
        y: 1500
      });
      room.loot.push({
        id: 'loot_test_ak47_mag30',
        type: 'weapon_ak47',
        currentAmmo: 30,
        maxAmmo: 30,
        x: 1500,
        y: 1500
      });

      // Spam 15 swap packets within simulated 200ms
      for (let swap = 0; swap < 15; swap++) {
        clients[3].queueEmit('player:interact_loot', {}, virtualTime + swap * 15, 10);
        stats.lootSwapsAttempted++;
      }
      clients[3].flushPackets(virtualTime + 500, mgr, testRoomId);

      // Verify weapon ammo integrity: active weapon ammo must be a valid finite number >= 0
      const curW = p4.activeWeapon;
      const curAmmo = p4.ammo[curW];
      if (typeof curAmmo !== 'number' || isNaN(curAmmo) || curAmmo < 0) {
        errorTracker.push(`[Scenario 3 Failed]: Ammo desync on loot swap spam! ammo=${curAmmo}`);
      } else {
        stats.scenariosPassed++;
      }
    }

    // ============================================================
    // CRISIS SCENARIO 4: CORNER PEEKING / WALL CLIPPING DEFENSE
    // ============================================================
    const p5 = room.players.find(p => p.userId === clients[4].userId);
    if (p5 && p5.isAlive) {
      // Place player right up against building wall at x: 1890, y: 1920
      p5.x = 1888;
      p5.y = 1925;
      p5.angle = 0; // Aiming directly to the right through the wall
      p5.shooting = true;
      p5.activeWeapon = 'rifle';
      p5.ammo['rifle'] = 30;
      p5.isReloading = false;
      p5.lastShootTime = 0;

      const bulletsBefore = room.bullets.length;
      mgr['tickGame'](room);
      stats.cornerWallShotsTested++;

      // Check if bullet penetrated wall: spawn point raycast checks intercept it
      const newBullets = room.bullets.slice(bulletsBefore);
      for (const nb of newBullets) {
        if (nb.x > 1890 && nb.x < 1920) {
          errorTracker.push(`[Scenario 4 Failed]: Bullet spawned inside/through building wall! x=${nb.x}, y=${nb.y}`);
        }
      }
      p5.shooting = false;
      stats.scenariosPassed++;
    }

    // ============================================================
    // CRISIS SCENARIO 5: PACKET LOSS ON RESPAWN & SELF-HEALING CAMERA
    // ============================================================
    const client6 = clients[5];
    const p6 = room.players.find(p => p.userId === client6.userId);
    if (p6) {
      p6.hp = 0;
      p6.isAlive = false;
      client6.lastSeenAlive = false;
      client6.cameraPos = { x: 500, y: 500 };

      // Respawn at coordinate (3200, 3200)
      p6.x = 3200;
      p6.y = 3200;
      p6.isAlive = true;
      p6.hp = 100;

      // Simulate 100% packet loss of 'player:respawned' event, but gameState arrives
      const publicState = mgr.getPublicGameState(room);
      client6.receiveServerEvent('royale:game_state', publicState);

      // Verify self-healing camera updated to the new coordinates
      const camDist = Math.hypot(client6.cameraPos.x - p6.x, client6.cameraPos.y - p6.y);
      if (camDist > 10) {
        errorTracker.push(`[Scenario 5 Failed]: Client camera did not self-heal on respawn under packet loss! camX=${client6.cameraPos.x}, pX=${p6.x}`);
      } else {
        stats.scenariosPassed++;
      }
    }

    // 4. Run Main Cycles Simulation with Random Human Inputs & Network Jitter
    for (let c = 0; c < cycles; c++) {
      virtualTime += 33; // ~30 FPS

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        const p = room.players.find(pl => pl.userId === client.userId);
        if (!p) continue;

        // Human behavioral emulation
        if (Math.random() < 0.3) {
          client.keys.up = Math.random() < 0.4;
          client.keys.down = Math.random() < 0.4;
          client.keys.left = Math.random() < 0.4;
          client.keys.right = Math.random() < 0.4;
          client.lastAngle += (Math.random() - 0.5) * 0.4;
          client.isShooting = Math.random() < 0.25;

          client.queueEmit('player:input', {
            ...client.keys,
            angle: client.lastAngle,
            isShooting: client.isShooting,
            platform: client.platform
          }, virtualTime, 30);
          stats.inputPacketsSent++;
        }

        if (Math.random() < 0.05) {
          client.queueEmit('player:interact_loot', {}, virtualTime, 20);
        }

        if (!p.isAlive && Math.random() < 0.1) {
          client.queueEmit('player:request_respawn', {}, virtualTime, 10);
          stats.respawnsHandled++;
        }

        client.flushPackets(virtualTime, mgr, testRoomId);
      }

      mgr['tickGame'](room);
    }

    // Clean up test room
    mgr.destroyRoom(testRoomId);
  } catch (simErr: any) {
    errorTracker.push(`[Virtual Human Simulation Exception]: ${simErr?.message || String(simErr)}`);
  } finally {
    console.error = originalConsoleError;
    if (mgr.rooms.has(testRoomId)) {
      mgr.destroyRoom(testRoomId);
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    success: errorTracker.length === 0,
    cyclesCompleted: cycles,
    errors: errorTracker,
    durationMs,
    stats
  };
}

export function runHeadlessBattleRoyaleTest(manager?: BattleRoyaleManager, cycles: number = 1000) {
  const mockIo = {
    to: () => ({ emit: () => {} }),
    emit: () => {}
  } as any;
  const mgr = manager || new BattleRoyaleManager(mockIo);
  
  const headlessRes = mgr.runHeadlessTest(cycles);
  const virtualRes = runVirtualHumanClientsSimulation(mgr, Math.min(cycles, 500), 10);

  const mergedErrors = [...(headlessRes.errors || []), ...(virtualRes.errors || [])];
  return {
    success: mergedErrors.length === 0,
    cyclesCompleted: headlessRes.cyclesCompleted + virtualRes.cyclesCompleted,
    errors: mergedErrors,
    durationMs: headlessRes.durationMs + virtualRes.durationMs,
    stats: {
      ...headlessRes.stats,
      ...virtualRes.stats
    }
  };
}
