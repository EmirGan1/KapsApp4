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
    damage: 22,
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
    description: 'Yarı otomatik hafif tabanca'
  },
  shotgun: {
    name: 'SPAS-12',
    damage: 18,
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
    description: 'Yakın mesafede ölümcül 6 saçmalı pompalı'
  },
  smg: {
    name: 'Micro UZI',
    damage: 15,
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
    description: 'Seri atışlı kompakt hafif makineli'
  },
  rifle: {
    name: 'AK-47 Askeri',
    damage: 32,
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
    description: 'Yüksek hasarlı taarruz tüfeği'
  },
  sniper: {
    name: 'AWP Ağır Sniper',
    damage: 92,
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
    description: 'Ultra menzilli ağır keskin nişancı'
  },
  plasma: {
    name: 'Plazma RPG',
    damage: 85,
    fireRate: 1400,
    magSize: 4,
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
    description: 'Düştüğü yerde patlayan plazma roket'
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
  platform?: 'pc' | 'mobile';
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

  constructor(io: SocketIOServer, db: LibsqlClient) {
    this.io = io;
    this.db = db;
  }

  private createRoomInternal(
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
    user: { id: number; username: string; avatar: string | null; color?: string; platform?: 'pc' | 'mobile' },
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

  public joinRoom(roomId: string, user: { id: number; username: string; avatar: string | null; color?: string; platform?: 'pc' | 'mobile' }) {
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
      ammo: { pistol: 15, shotgun: 6, smg: 32, rifle: 30, sniper: 5, plasma: 4 },
      reserveAmmo: { pistol: 60, shotgun: 24, smg: 120, rifle: 90, sniper: 15, plasma: 8 },
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
      ammo: { pistol: 15, shotgun: 6, smg: 32, rifle: 30, sniper: 5, plasma: 4 },
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
      p.ammo = { pistol: 15, shotgun: 6, smg: 32, rifle: 30, sniper: 5, plasma: 4 };
      p.reserveAmmo = { pistol: 60, shotgun: 24, smg: 120, rifle: 90, sniper: 15, plasma: 8 };
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
      room.loot.push({
        id: `loot_${i}`,
        type: lootType,
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
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.userId === userId);
    if (!player || !player.isAlive) return;

    // Platform detection (for asymmetric AI difficulty)
    if (input.platform === 'pc' || input.platform === 'mobile') {
      player.platform = input.platform;
    }

    // Movement Vectors
    if (typeof input.vx === 'number' && typeof input.vy === 'number') {
      player.vx = Math.max(-1, Math.min(1, input.vx));
      player.vy = Math.max(-1, Math.min(1, input.vy));
    }

    // Angle
    if (typeof input.angle === 'number' && Number.isFinite(input.angle)) {
      player.angle = input.angle;
    }

    // Shooting
    if (typeof input.shooting === 'boolean') {
      player.shooting = input.shooting;
    }

    // Weapon Switch
    if (typeof input.switchWeapon === 'number') {
      const targetSlot = input.switchWeapon;
      if (player.weapons[targetSlot]) {
        player.activeWeaponSlot = targetSlot;
        player.activeWeapon = player.weapons[targetSlot];
        player.isReloading = false;
      }
    } else if (input.switchWeapon === 'next' || input.switchWeapon === 'prev') {
      if (player.weapons.length > 1) {
        player.activeWeaponSlot = (player.activeWeaponSlot + 1) % player.weapons.length;
        player.activeWeapon = player.weapons[player.activeWeaponSlot];
        player.isReloading = false;
      }
    }

    // Reload
    if (input.reload && !player.isReloading) {
      this.triggerReload(player);
    }

    // Pickup or Swap Weapon
    if (input.pickup || input.swapWeapon) {
      this.handlePlayerPickup(room, player, !!input.swapWeapon);
    }
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
    const pickupDist = 65;
    let pickedIdx = -1;

    for (let i = 0; i < room.loot.length; i++) {
      const item = room.loot[i];
      const d = Math.hypot(player.x - item.x, player.y - item.y);
      if (d <= pickupDist) {
        pickedIdx = i;
        break;
      }
    }

    if (pickedIdx === -1) return;
    const item = room.loot[pickedIdx];

    if (item.type.startsWith('weapon_')) {
      const wName = item.type.replace('weapon_', '');
      const oldWeapon = player.activeWeapon;

      if (player.weapons.length < 2 && !player.weapons.includes(wName)) {
        player.weapons.push(wName);
        player.activeWeaponSlot = player.weapons.length - 1;
        player.activeWeapon = wName;
      } else {
        // Swap with current active weapon slot
        player.weapons[player.activeWeaponSlot] = wName;
        player.activeWeapon = wName;

        // Drop old weapon
        if (oldWeapon && oldWeapon !== 'pistol') {
          room.loot.push({
            id: `loot_swp_${Date.now()}`,
            type: `weapon_${oldWeapon}`,
            x: player.x,
            y: player.y
          });
        }
      }
      room.loot.splice(pickedIdx, 1);
    } else if (item.type === 'medkit') {
      player.hp = Math.min(player.maxHp, player.hp + 75);
      room.loot.splice(pickedIdx, 1);
    } else if (item.type === 'bandage') {
      player.hp = Math.min(player.maxHp, player.hp + 25);
      room.loot.splice(pickedIdx, 1);
    } else if (item.type === 'shield') {
      player.shield = Math.min(player.maxShield, player.shield + 50);
      room.loot.splice(pickedIdx, 1);
    } else if (item.type === 'heavy_shield') {
      player.shield = 100;
      room.loot.splice(pickedIdx, 1);
    } else if (item.type === 'adrenaline') {
      player.speedBuffEndTime = Date.now() + 12000;
      room.loot.splice(pickedIdx, 1);
    } else if (item.type === 'rage') {
      player.rageBuffEndTime = Date.now() + 12000;
      room.loot.splice(pickedIdx, 1);
    } else if (item.type === 'ammo') {
      Object.keys(player.reserveAmmo).forEach(k => {
        player.reserveAmmo[k] += 30;
      });
      room.loot.splice(pickedIdx, 1);
    }
  }

  private tickGame(room: GameRoom) {
    if (room.status !== 'playing') return;
    const now = Date.now();

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
          p.spawnShieldEndTime = now + 2500;
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
        // Find closest visible enemy
        let targetEnemy: PlayerData | null = null;
        let minD = 99999;
        let hasClearLOS = false;

        alivePlayers.forEach(other => {
          if (other.id === p.id) return;
          const d = Math.hypot(other.x - p.x, other.y - p.y);
          if (d < 1100) {
            const losCheck = checkRaycastWalls(p.x, p.y, other.x, other.y);
            const isClear = !losCheck.hit;
            if (isClear && d < minD) {
              minD = d;
              targetEnemy = other;
              hasClearLOS = true;
            } else if (!hasClearLOS && d < minD) {
              minD = d;
              targetEnemy = other;
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

          // Shoot while fleeing if enemy is in line of sight
          if (targetEnemy && hasClearLOS && minD < 700) {
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

          // Balanced Combat AI (Nerf & Balance: 350-500ms human reaction time + spread inaccuracy)
          const botReactionDelay = 380 + Math.floor(Math.random() * 120);
          const botSpreadMargin = 0.22; // Inaccuracy spread so bots don't laser headshot

          // Reaction delay timer
          if (p.botTargetPlayerId !== enemy.id) {
            p.botTargetPlayerId = enemy.id;
            p.botReactionUntil = now + botReactionDelay;
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

          // Strafe & Combat movement
          if (!p.botStrafeTimer || now > p.botStrafeTimer) {
            p.botStrafeDir = Math.random() < 0.5 ? 1 : -1;
            p.botStrafeTimer = now + 900;
          }

          const strafeOffset = (p.botStrafeDir || 1) * 0.75;
          let moveVx = 0;
          let moveVy = 0;

          if (distToEnemy > 280) {
            // Approach target while strafing slightly
            moveVx = Math.cos(steerAngle + strafeOffset * 0.3);
            moveVy = Math.sin(steerAngle + strafeOffset * 0.3);
          } else if (distToEnemy < 140) {
            // Kite / Backpedal
            moveVx = -Math.cos(steerAngle) + Math.cos(steerAngle + Math.PI / 2) * strafeOffset;
            moveVy = -Math.sin(steerAngle) + Math.sin(steerAngle + Math.PI / 2) * strafeOffset;
          } else {
            // Circle strafe
            moveVx = Math.cos(steerAngle + (Math.PI / 2) * (p.botStrafeDir || 1));
            moveVy = Math.sin(steerAngle + (Math.PI / 2) * (p.botStrafeDir || 1));
          }

          p.vx = moveVx;
          p.vy = moveVy;

          // Apply aim angle with human-like inaccuracy spread
          const aimJitter = (Math.random() - 0.5) * botSpreadMargin;
          p.angle = directAngle + aimJitter;

          // Shoot only if LOS is clear and reaction delay has passed
          p.shooting = hasClearLOS && canShootNow && distToEnemy < 800;
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
        const nextX = Math.max(30, Math.min(MAP_SIZE - 30, p.x + (p.vx || 0) * speed));
        const nextY = Math.max(30, Math.min(MAP_SIZE - 30, p.y + (p.vy || 0) * speed));

        // Wall collision check
        if (!this.checkBuildingWallCollision(nextX, p.y, 22)) p.x = nextX;
        if (!this.checkBuildingWallCollision(p.x, nextY, 22)) p.y = nextY;
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

              room.bullets.push({
                id: `b_${p.id}_${now}_${b}`,
                shooterId: p.id,
                x: p.x + Math.cos(bAngle) * 28,
                y: p.y + Math.sin(bAngle) * 28,
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
        if (bullet.isAoE) {
          this.triggerExplosion(room, wallRay.x, wallRay.y, bullet.aoeRadius || 130, bullet.damage, bullet.shooterId);
        }
        return; // Bullet stops and terminates on the wall
      }

      // 2B. Rock Obstacle Swept Collision (Mermiler kayalardan geçemez)
      let hitRock = false;
      for (const obs of room.obstacles) {
        if (obs.type === 'rock') {
          const dSq = distToSegmentSquared(obs.x, obs.y, prevX, prevY, nextX, nextY);
          const hitR = obs.radius + bullet.radius;
          if (dSq <= hitR * hitR) {
            hitRock = true;
            if (bullet.isAoE) {
              this.triggerExplosion(room, nextX, nextY, bullet.aoeRadius || 130, bullet.damage, bullet.shooterId);
            }
            break;
          }
        }
      }
      if (hitRock) return; // Bullet blocked by solid rock obstacle!

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
            this.triggerExplosion(room, barrel.x, barrel.y, 140, 85, bullet.shooterId);
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
            room.loot.push({
              id: `loot_cr_${Date.now()}_${Math.random()}`,
              type: crate.lootType,
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

      // 5. Player Swept Ray-Collision
      let hitPlayer = false;
      for (const target of room.players) {
        if (!target.isAlive || target.id === bullet.shooterId) continue;
        if (target.spawnShieldEndTime > now) continue;

        const dSq = distToSegmentSquared(target.x, target.y, prevX, prevY, nextX, nextY);
        const hitR = 24 + bullet.radius;
        if (dSq <= hitR * hitR) {
          hitPlayer = true;
          this.applyDamageToPlayer(room, target, bullet.damage, bullet.shooterId);
          break;
        }
      }

      if (hitPlayer) {
        if (bullet.isAoE) {
          this.triggerExplosion(room, nextX, nextY, bullet.aoeRadius || 130, bullet.damage, bullet.shooterId);
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

  private triggerExplosion(room: GameRoom, x: number, y: number, radius: number, maxDamage: number, shooterId: string) {
    const now = Date.now();
    room.explosions.push({ id: `exp_${now}_${Math.random()}`, x, y, radius, createdAt: now });

    // Damage Players
    room.players.forEach(p => {
      if (!p.isAlive || p.spawnShieldEndTime > now) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius) {
        const falloff = 1 - (d / radius);
        const dmg = Math.round(maxDamage * Math.max(0.35, falloff));
        this.applyDamageToPlayer(room, p, dmg, shooterId);
      }
    });

    // Destroy Barrels
    room.barrels.forEach(b => {
      if (Math.hypot(b.x - x, b.y - y) <= radius) {
        b.hp -= maxDamage;
      }
    });
    room.barrels = room.barrels.filter(b => b.hp > 0);

    // Destroy Crates
    room.crates.forEach(c => {
      if (Math.hypot(c.x - x, c.y - y) <= radius) {
        c.hp -= maxDamage;
        if (c.hp <= 0) {
          room.loot.push({ id: `loot_exp_${Date.now()}`, type: c.lootType, x: c.x, y: c.y });
        }
      }
    });
    room.crates = room.crates.filter(c => c.hp > 0);
  }

  private applyDamageToPlayer(room: GameRoom, target: PlayerData, damage: number, attackerId: string) {
    let dmg = damage;
    if (target.shield > 0) {
      const shieldAbsorb = Math.min(target.shield, Math.round(dmg * 0.65));
      target.shield -= shieldAbsorb;
      dmg -= shieldAbsorb;
    }

    target.hp = Math.max(0, target.hp - dmg);
    room.damagePopups.push({
      id: `dp_${Date.now()}_${Math.random()}`,
      x: target.x,
      y: target.y - 20,
      damage,
      color: target.shield > 0 ? '#06b6d4' : '#ef4444',
      createdAt: Date.now()
    });

    if (target.hp <= 0) {
      this.eliminatePlayer(room, target, attackerId);
    }
  }

  private eliminatePlayer(room: GameRoom, victim: PlayerData, killerId: string) {
    victim.isAlive = false;
    victim.deaths = (victim.deaths || 0) + 1;

    const killer = room.players.find(p => p.id === killerId);
    if (killer) {
      killer.kills = (killer.kills || 0) + 1;
    }

    room.killfeed.unshift({
      id: Math.random().toString(36).substring(2, 7),
      killer: killer ? killer.username : 'Bölge / Gaz',
      victim: victim.username,
      weapon: killer ? killer.activeWeapon : 'Gaz',
      time: Date.now()
    });
    if (room.killfeed.length > 8) room.killfeed.pop();

    // Drop guaranteed medkit & player's weapon
    room.loot.push({
      id: `loot_drop_${Date.now()}`,
      type: `weapon_${victim.activeWeapon}`,
      x: victim.x,
      y: victim.y
    });
    room.loot.push({
      id: `loot_med_${Date.now()}`,
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
    return {
      id: room.id,
      status: room.status,
      mode: room.mode,
      matchTimeRemaining: Math.round(room.matchTimeRemaining),
      duration: room.duration,
      players: room.players.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        isHost: p.isHost,
        platform: p.platform,
        ready: p.ready,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
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
      bullets: room.bullets.map(b => ({
        id: b.id,
        shooterId: b.shooterId,
        x: Math.round(b.x * 10) / 10,
        y: Math.round(b.y * 10) / 10,
        vx: Math.round(b.vx * 10) / 10,
        vy: Math.round(b.vy * 10) / 10,
        damage: b.damage,
        color: b.color,
        radius: b.radius,
        isAoE: b.isAoE
      })),
      crates: room.crates,
      barrels: room.barrels,
      explosions: room.explosions,
      loot: room.loot,
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
      damagePopups: room.damagePopups.slice(-10),
      killfeed: room.killfeed,
      winner: room.winner
    };
  }
}
