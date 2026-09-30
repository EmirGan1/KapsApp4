import { Server as SocketIOServer } from "socket.io";
import { Client as LibsqlClient } from "@libsql/client";

export interface RoyalePlayer {
  id: string; // socket.id or bot_id
  userId: number; // 0 for bot
  username: string;
  avatar: string | null;
  color: string;
  isBot: boolean;
  isHost: boolean;
  ready: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  activeWeapon: string; // 'pistol' | 'shotgun' | 'smg' | 'rifle' | 'sniper' | 'plasma'
  activeWeaponSlot: number; // 0 or 1
  weapons: string[]; // max 2 weapons: e.g. ['pistol', 'rifle']
  ammo: Record<string, number>;
  reserveAmmo: Record<string, number>;
  isReloading: boolean;
  reloadEndTime: number;
  lastShotTime: number;
  isAlive: boolean;
  kills: number;
  deaths: number;
  spectating: boolean;
  // Deathmatch respawn & protection
  respawnAt: number | null;
  spawnShieldEndTime: number;
  // Buffs
  speedBuffEndTime: number;
  rageBuffEndTime: number;
  lastSwapTime: number;
  // Bot AI state
  botTargetX?: number;
  botTargetY?: number;
  botTargetEnemyId?: string | null;
  botNextActionTime?: number;
}

export interface RoyaleBullet {
  id: string;
  shooterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  distanceTraveled: number;
  maxDistance: number;
  color: string;
  radius: number;
  isAoE?: boolean;
  aoeRadius?: number;
  isRage?: boolean;
}

export interface RoyaleCrate {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  tier: 'normal' | 'rare';
  lootType: string;
}

export interface RoyaleLoot {
  id: string;
  type: 
    | 'weapon_pistol' 
    | 'weapon_shotgun' 
    | 'weapon_smg' 
    | 'weapon_rifle' 
    | 'weapon_sniper' 
    | 'weapon_plasma'
    | 'bandage' 
    | 'medkit' 
    | 'shield' 
    | 'heavy_shield' 
    | 'ammo' 
    | 'adrenaline' 
    | 'rage';
  x: number;
  y: number;
  value?: number;
  createdAt?: number;
}

export interface RoyaleObstacle {
  id: string;
  type: 'rock' | 'bush';
  x: number;
  y: number;
  radius: number;
}

export interface RoyaleZone {
  currentX: number;
  currentY: number;
  currentRadius: number;
  targetX: number;
  targetY: number;
  targetRadius: number;
  shrinkSpeed: number;
  phase: number;
  isShrinking: boolean;
  nextShrinkTime: number;
  damage: number;
}

export interface RoyaleKillfeedItem {
  id: string;
  killer: string;
  victim: string;
  weapon: string;
  time: number;
}

export interface RoyaleDamagePopup {
  id: string;
  x: number;
  y: number;
  damage: number;
  color: string;
  createdAt: number;
}

export interface RoyaleRoom {
  id: string;
  title: string;
  hostId: number;
  hostName: string;
  hostAvatar: string | null;
  capacity: number; // 2, 3, or 4
  mode: 'royale' | 'deathmatch';
  duration: number; // match duration in seconds (120, 180, 300) for deathmatch
  matchTimeRemaining: number; // countdown in seconds
  status: 'lobby' | 'countdown' | 'playing' | 'gameover';
  countdown: number;
  players: RoyalePlayer[];
  bullets: RoyaleBullet[];
  crates: RoyaleCrate[];
  loot: RoyaleLoot[];
  obstacles: RoyaleObstacle[];
  zone: RoyaleZone;
  killfeed: RoyaleKillfeedItem[];
  damagePopups: RoyaleDamagePopup[];
  winner: RoyalePlayer | null;
  startedAt: number;
  timerInterval?: any;
  tickInterval?: any;
  lastZoneDamageTime: number;
  createdAt: number;
}

export const MAP_SIZE = 2400;
const TICK_RATE = 30; // 30 FPS server simulation
const PLAYER_RADIUS = 24;

export const WEAPON_CONFIGS: Record<string, {
  name: string;
  damage: number;
  speed: number;
  fireRate: number; // ms between shots
  magazine: number;
  reloadTime: number; // ms
  maxRange: number;
  spread: number; // radians
  pellets?: number;
  bulletRadius: number;
  bulletColor: string;
  themeColor: string;
  isAoE?: boolean;
  aoeRadius?: number;
}> = {
  pistol: {
    name: 'Tabanca',
    damage: 18,
    speed: 20,
    fireRate: 280,
    magazine: 15,
    reloadTime: 1000,
    maxRange: 700,
    spread: 0.04,
    bulletRadius: 3.5,
    bulletColor: '#f8fafc',
    themeColor: '#94a3b8'
  },
  shotgun: {
    name: 'Pompalı Tüfek',
    damage: 14, // 6 pellets x 14 = 84 max damage
    speed: 18,
    fireRate: 750,
    magazine: 6,
    reloadTime: 1700,
    maxRange: 450,
    spread: 0.34,
    pellets: 6,
    bulletRadius: 3,
    bulletColor: '#f87171',
    themeColor: '#ef4444'
  },
  smg: {
    name: 'Uzi SMG',
    damage: 12,
    speed: 22,
    fireRate: 85,
    magazine: 35,
    reloadTime: 1200,
    maxRange: 620,
    spread: 0.12,
    bulletRadius: 3.2,
    bulletColor: '#22d3ee',
    themeColor: '#06b6d4'
  },
  rifle: {
    name: 'AK-47 Tüfek',
    damage: 24,
    speed: 24,
    fireRate: 135,
    magazine: 30,
    reloadTime: 1400,
    maxRange: 850,
    spread: 0.06,
    bulletRadius: 4,
    bulletColor: '#fb923c',
    themeColor: '#f97316'
  },
  sniper: {
    name: 'AWP Sniper',
    damage: 75,
    speed: 38,
    fireRate: 1200,
    magazine: 5,
    reloadTime: 2000,
    maxRange: 1300,
    spread: 0.01,
    bulletRadius: 5,
    bulletColor: '#c084fc',
    themeColor: '#a855f7'
  },
  plasma: {
    name: 'Plazma Roket',
    damage: 65,
    speed: 16,
    fireRate: 900,
    magazine: 4,
    reloadTime: 2100,
    maxRange: 750,
    spread: 0.02,
    bulletRadius: 7.5,
    bulletColor: '#facc15',
    themeColor: '#eab308',
    isAoE: true,
    aoeRadius: 65
  }
};

const BOT_NAMES = [
  'Bot Göktürk',
  'Bot Aslan',
  'Bot Haydut',
  'Bot Kartal',
  'Bot Bozkurt',
  'Bot Pars',
  'Bot Fırtına',
  'Bot Şahin'
];

export class BattleRoyaleManager {
  private io: SocketIOServer;
  private db: LibsqlClient;
  public rooms = new Map<string, RoyaleRoom>();

  constructor(io: SocketIOServer, db: LibsqlClient) {
    this.io = io;
    this.db = db;
  }

  // Create Room (100% Free - no coin deductions)
  public createRoom(
    hostUser: { id: number; username: string; avatar: string | null; color?: string },
    options: { title?: string; capacity?: number; mode?: 'royale' | 'deathmatch'; duration?: number }
  ): RoyaleRoom {
    const roomId = `br_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const capacity = Math.min(4, Math.max(2, options.capacity || 4));
    const mode = options.mode === 'deathmatch' ? 'deathmatch' : 'royale';
    const duration = options.duration && [120, 180, 300].includes(options.duration) ? options.duration : 180;
    const title = options.title?.trim() || `${hostUser.username}'ın Arenası`;

    const hostPlayer: RoyalePlayer = this.createInitialPlayer(
      `u_${hostUser.id}`,
      hostUser.id,
      hostUser.username,
      hostUser.avatar,
      hostUser.color || '#3b82f6',
      false,
      true
    );

    const room: RoyaleRoom = {
      id: roomId,
      title,
      hostId: hostUser.id,
      hostName: hostUser.username,
      hostAvatar: hostUser.avatar,
      capacity,
      mode,
      duration,
      matchTimeRemaining: duration,
      status: 'lobby',
      countdown: 3,
      players: [hostPlayer],
      bullets: [],
      crates: [],
      loot: [],
      obstacles: [],
      zone: this.createInitialZone(),
      killfeed: [],
      damagePopups: [],
      winner: null,
      startedAt: 0,
      lastZoneDamageTime: 0,
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    this.broadcastRoomsList();
    return room;
  }

  // Helper to create clean initial player state
  private createInitialPlayer(
    id: string,
    userId: number,
    username: string,
    avatar: string | null,
    color: string,
    isBot: boolean,
    isHost: boolean
  ): RoyalePlayer {
    return {
      id,
      userId,
      username,
      avatar,
      color,
      isBot,
      isHost,
      ready: isHost,
      x: MAP_SIZE / 2,
      y: MAP_SIZE / 2,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 100,
      activeWeapon: 'pistol',
      activeWeaponSlot: 0,
      weapons: ['pistol'],
      ammo: { pistol: 15, shotgun: 0, smg: 0, rifle: 0, sniper: 0, plasma: 0 },
      reserveAmmo: { pistol: 60, shotgun: 0, smg: 0, rifle: 0, sniper: 0, plasma: 0 },
      isReloading: false,
      reloadEndTime: 0,
      lastShotTime: 0,
      isAlive: true,
      kills: 0,
      deaths: 0,
      spectating: false,
      respawnAt: null,
      spawnShieldEndTime: 0,
      speedBuffEndTime: 0,
      rageBuffEndTime: 0,
      lastSwapTime: 0
    };
  }

  // Create initial storm zone
  private createInitialZone(): RoyaleZone {
    return {
      currentX: MAP_SIZE / 2,
      currentY: MAP_SIZE / 2,
      currentRadius: MAP_SIZE * 0.7,
      targetX: MAP_SIZE / 2,
      targetY: MAP_SIZE / 2,
      targetRadius: MAP_SIZE * 0.45,
      shrinkSpeed: 1.2,
      phase: 0,
      isShrinking: false,
      nextShrinkTime: 0,
      damage: 5
    };
  }

  // Join Room
  public joinRoom(
    roomId: string,
    user: { id: number; username: string; avatar: string | null; color?: string }
  ): { success: boolean; room?: RoyaleRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };

    if (room.status !== 'lobby') {
      return { success: false, error: 'Bu oyun zaten başlamış veya bitti.' };
    }

    if (room.players.length >= room.capacity) {
      return { success: false, error: 'Masa dolu.' };
    }

    // Check if player is already in room
    const existing = room.players.find(p => p.userId === user.id);
    if (existing) {
      existing.avatar = user.avatar;
      existing.color = user.color || existing.color;
      return { success: true, room };
    }

    const player = this.createInitialPlayer(
      `u_${user.id}`,
      user.id,
      user.username,
      user.avatar,
      user.color || '#10b981',
      false,
      false
    );

    room.players.push(player);
    this.broadcastRoomState(room);
    this.broadcastRoomsList();
    return { success: true, room };
  }

  // Leave Room (Only delete room if ALL human players have left)
  public leaveRoom(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const pIdx = room.players.findIndex(p => p.userId === userId);
    if (pIdx !== -1) {
      const isHost = room.players[pIdx].isHost;
      room.players.splice(pIdx, 1);

      // Check if any real human players remain
      const realPlayers = room.players.filter(p => !p.isBot);

      if (realPlayers.length === 0) {
        // Safe to destroy room completely
        this.destroyRoom(roomId);
        return;
      }

      // If host left, pass host crown to next real human player
      if (isHost && realPlayers.length > 0) {
        realPlayers[0].isHost = true;
        realPlayers[0].ready = true;
        room.hostId = realPlayers[0].userId;
        room.hostName = realPlayers[0].username;
        room.hostAvatar = realPlayers[0].avatar;
      }

      this.broadcastRoomState(room);
      this.broadcastRoomsList();
    }
  }

  // Add Bot
  public addBot(roomId: string, hostUserId: number): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };
    if (room.hostId !== hostUserId) return { success: false, error: 'Sadece masa sahibi bot ekleyebilir.' };
    if (room.status !== 'lobby') return { success: false, error: 'Oyun sırasında bot eklenemez.' };
    if (room.players.length >= room.capacity) return { success: false, error: 'Masa dolu.' };

    const botColors = ['#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#3b82f6'];
    const botIdx = room.players.filter(p => p.isBot).length;
    const botName = BOT_NAMES[botIdx % BOT_NAMES.length];
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const botPlayer = this.createInitialPlayer(
      botId,
      0,
      botName,
      null,
      botColors[botIdx % botColors.length],
      true,
      false
    );
    botPlayer.ready = true;

    room.players.push(botPlayer);
    this.broadcastRoomState(room);
    this.broadcastRoomsList();
    return { success: true };
  }

  // Remove Bot
  public removeBot(roomId: string, hostUserId: number, botId?: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };
    if (room.hostId !== hostUserId) return { success: false, error: 'Sadece masa sahibi bot çıkarabilir.' };

    let idx = -1;
    if (botId) {
      idx = room.players.findIndex(p => p.id === botId && p.isBot);
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
      return { success: true };
    }
    return { success: false, error: 'Bot bulunamadı.' };
  }

  // Toggle Ready
  public toggleReady(roomId: string, userId: number): { success: boolean; ready?: boolean } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false };
    const player = room.players.find(p => p.userId === userId);
    if (player && !player.isHost) {
      player.ready = !player.ready;
      this.broadcastRoomState(room);
      return { success: true, ready: player.ready };
    }
    return { success: false };
  }

  // Return Room to Lobby (Persistent room cycle - allows playing again without recreating table)
  public returnToLobby(roomId: string, userId: number): { success: boolean; room?: RoyaleRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };

    // Clear active match timers
    if (room.timerInterval) clearInterval(room.timerInterval);
    if (room.tickInterval) clearInterval(room.tickInterval);

    // Reset room state
    room.status = 'lobby';
    room.winner = null;
    room.bullets = [];
    room.crates = [];
    room.loot = [];
    room.obstacles = [];
    room.killfeed = [];
    room.damagePopups = [];
    room.matchTimeRemaining = room.duration || 180;
    room.countdown = 3;

    // Reset all existing players for next match
    room.players.forEach(p => {
      p.hp = 100;
      p.shield = 0;
      p.isAlive = true;
      p.activeWeapon = 'pistol';
      p.activeWeaponSlot = 0;
      p.weapons = ['pistol'];
      p.ammo = { pistol: 15, shotgun: 0, smg: 0, rifle: 0, sniper: 0, plasma: 0 };
      p.reserveAmmo = { pistol: 60, shotgun: 0, smg: 0, rifle: 0, sniper: 0, plasma: 0 };
      p.isReloading = false;
      p.reloadEndTime = 0;
      p.lastShotTime = 0;
      p.kills = 0;
      p.deaths = 0;
      p.spectating = false;
      p.respawnAt = null;
      p.spawnShieldEndTime = 0;
      p.speedBuffEndTime = 0;
      p.rageBuffEndTime = 0;
      p.lastSwapTime = 0;
      p.ready = p.isHost || p.isBot;
    });

    this.broadcastRoomState(room);
    this.broadcastRoomsList();
    return { success: true, room };
  }

  // Start Game
  public async startGame(roomId: string, hostUserId: number): Promise<{ success: boolean; error?: string }> {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };
    if (room.hostId !== hostUserId) return { success: false, error: 'Sadece masa sahibi oyunu başlatabilir.' };
    if (room.players.length < 2) return { success: false, error: 'Oyunu başlatmak için en az 2 oyuncu (veya bot) olmalıdır.' };
    if (room.status !== 'lobby') return { success: false, error: 'Oyun zaten başlamış.' };

    room.status = 'countdown';
    room.countdown = 3;
    room.winner = null;
    room.bullets = [];
    room.damagePopups = [];
    room.killfeed = [];
    room.matchTimeRemaining = room.duration || 180;

    // Generate Map Entities
    this.generateObstacles(room);
    this.generateCrates(room);
    this.generateInitialLoot(room);
    this.spawnPlayers(room);

    this.broadcastRoomState(room);

    // 3s Countdown Timer
    let count = 3;
    this.io.to(roomId).emit('royale:countdown', { countdown: count });

    const countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        room.countdown = count;
        this.io.to(roomId).emit('royale:countdown', { countdown: count });
      } else {
        clearInterval(countdownTimer);
        this.beginPlayingState(room);
      }
    }, 1000);

    return { success: true };
  }

  // Transition to playing state & start 30 FPS tick loop
  private beginPlayingState(room: RoyaleRoom) {
    room.status = 'playing';
    room.startedAt = Date.now();
    room.lastZoneDamageTime = Date.now();

    // Reset zone for Battle Royale mode
    room.zone = {
      currentX: MAP_SIZE / 2,
      currentY: MAP_SIZE / 2,
      currentRadius: MAP_SIZE * 0.72,
      targetX: MAP_SIZE / 2,
      targetY: MAP_SIZE / 2,
      targetRadius: MAP_SIZE * 0.45,
      shrinkSpeed: 1.1,
      phase: 0,
      isShrinking: false,
      nextShrinkTime: Date.now() + 18000,
      damage: 5
    };

    this.io.to(room.id).emit('royale:game_started', this.getPublicGameState(room));
    this.broadcastRoomsList();

    // 1-second interval for Deathmatch Timer & Zone Warnings
    if (room.timerInterval) clearInterval(room.timerInterval);
    room.timerInterval = setInterval(() => {
      if (room.status !== 'playing') {
        clearInterval(room.timerInterval);
        return;
      }

      // In Deathmatch mode, decrement time remaining
      if (room.mode === 'deathmatch') {
        room.matchTimeRemaining--;
        if (room.matchTimeRemaining <= 0) {
          this.endDeathmatchByTime(room);
          return;
        }
      }

      // In Royale mode, check zone phases
      if (room.mode === 'royale') {
        const now = Date.now();
        if (!room.zone.isShrinking && now >= room.zone.nextShrinkTime) {
          room.zone.isShrinking = true;
          this.io.to(room.id).emit('royale:zone_warning', {
            message: `⚠️ Faz ${room.zone.phase + 1}: Fırtına Çemberi Daralıyor!`
          });
        }
      }
    }, 1000);

    // 30 FPS Game Simulation Tick Loop
    if (room.tickInterval) clearInterval(room.tickInterval);
    room.tickInterval = setInterval(() => {
      this.gameTick(room);
    }, 1000 / TICK_RATE);
  }

  // 30 FPS Authoritative Game Tick
  private gameTick(room: RoyaleRoom) {
    if (room.status !== 'playing') return;

    const now = Date.now();

    // 1. Update Zone (Royale mode only)
    if (room.mode === 'royale') {
      this.updateZone(room, now);
    }

    // 2. Update Bullets and Collisions
    this.updateBullets(room);

    // 3. Update Players & Respawn in Deathmatch
    this.updatePlayers(room, now);

    // 4. Update Bot AI
    this.updateBots(room, now);

    // 5. Clean expired damage popups (older than 1.2s)
    room.damagePopups = room.damagePopups.filter(p => now - p.createdAt < 1200);

    // 6. Check Win Condition
    this.checkWinCondition(room);

    // 7. Broadcast state to players in room
    this.io.to(room.id).emit('royale:game_state', this.getPublicGameState(room));
  }

  // Update Players position, reload timers, and respawns
  private updatePlayers(room: RoyaleRoom, now: number) {
    for (const p of room.players) {
      // Deathmatch Respawn check
      if (room.mode === 'deathmatch' && !p.isAlive && p.respawnAt && now >= p.respawnAt) {
        this.respawnPlayerInDeathmatch(room, p);
      }

      if (!p.isAlive) continue;

      // Handle Reload completion
      if (p.isReloading && now >= p.reloadEndTime) {
        p.isReloading = false;
        const wpn = p.activeWeapon;
        const config = WEAPON_CONFIGS[wpn] || WEAPON_CONFIGS.pistol;
        const needed = config.magazine - (p.ammo[wpn] || 0);
        const available = p.reserveAmmo[wpn] || 0;
        const toLoad = Math.min(needed, available);
        p.ammo[wpn] = (p.ammo[wpn] || 0) + toLoad;
        p.reserveAmmo[wpn] = Math.max(0, available - toLoad);
      }

      // Calculate speed (apply +35% speed buff if active)
      let baseSpeed = 5.2;
      if (p.speedBuffEndTime > now) {
        baseSpeed *= 1.35;
      }

      // Apply movement velocity
      let nextX = p.x + p.vx * baseSpeed;
      let nextY = p.y + p.vy * baseSpeed;

      // Map bounds clamping
      nextX = Math.max(PLAYER_RADIUS + 10, Math.min(MAP_SIZE - PLAYER_RADIUS - 10, nextX));
      nextY = Math.max(PLAYER_RADIUS + 10, Math.min(MAP_SIZE - PLAYER_RADIUS - 10, nextY));

      // Obstacle & Rock collisions
      for (const obs of room.obstacles) {
        if (obs.type === 'rock') {
          const dist = Math.hypot(nextX - obs.x, nextY - obs.y);
          const minDist = PLAYER_RADIUS + obs.radius;
          if (dist < minDist) {
            const angle = Math.atan2(nextY - obs.y, nextX - obs.x);
            nextX = obs.x + Math.cos(angle) * minDist;
            nextY = obs.y + Math.sin(angle) * minDist;
          }
        }
      }

      // Crate collisions
      for (const c of room.crates) {
        const dist = Math.hypot(nextX - c.x, nextY - c.y);
        const minDist = PLAYER_RADIUS + 22;
        if (dist < minDist) {
          const angle = Math.atan2(nextY - c.y, nextX - c.x);
          nextX = c.x + Math.cos(angle) * minDist;
          nextY = c.y + Math.sin(angle) * minDist;
        }
      }

      p.x = nextX;
      p.y = nextY;

      // Auto-pickup nearby loot & consumables
      this.checkPlayerLootPickup(room, p);
    }
  }

  // Respawn a player in deathmatch mode with 2s spawn shield
  private respawnPlayerInDeathmatch(room: RoyaleRoom, player: RoyalePlayer) {
    // Find safe spot far from other players
    let bestX = MAP_SIZE / 2;
    let bestY = MAP_SIZE / 2;
    let maxMinDist = 0;

    for (let i = 0; i < 10; i++) {
      const candidateX = 200 + Math.random() * (MAP_SIZE - 400);
      const candidateY = 200 + Math.random() * (MAP_SIZE - 400);

      let minDistToPlayer = 9999;
      for (const other of room.players) {
        if (other.id !== player.id && other.isAlive) {
          const d = Math.hypot(candidateX - other.x, candidateY - other.y);
          if (d < minDistToPlayer) minDistToPlayer = d;
        }
      }

      if (minDistToPlayer > maxMinDist) {
        maxMinDist = minDistToPlayer;
        bestX = candidateX;
        bestY = candidateY;
      }
    }

    player.x = bestX;
    player.y = bestY;
    player.hp = 100;
    player.shield = 0;
    player.isAlive = true;
    player.respawnAt = null;
    player.spawnShieldEndTime = Date.now() + 2000; // 2s invincible protection
    player.weapons = ['pistol'];
    player.activeWeapon = 'pistol';
    player.activeWeaponSlot = 0;
    player.ammo.pistol = 15;
    player.reserveAmmo.pistol = 60;
    player.isReloading = false;
  }

  // Check and pickup loot
  private checkPlayerLootPickup(room: RoyaleRoom, p: RoyalePlayer, customRadius?: number) {
    const pickupRadius = customRadius || (PLAYER_RADIUS + 30);
    const now = Date.now();

    for (let i = room.loot.length - 1; i >= 0; i--) {
      const item = room.loot[i];
      const dist = Math.hypot(p.x - item.x, p.y - item.y);

      if (dist < pickupRadius) {
        let pickedUp = false;

        // Consumables: Always Auto-Pickup
        if (item.type === 'bandage') {
          if (p.hp < p.maxHp) {
            p.hp = Math.min(p.maxHp, p.hp + 25);
            this.pushDamagePopup(room, p.x, p.y - 20, 25, '#4ade80');
            pickedUp = true;
          }
        } else if (item.type === 'medkit') {
          if (p.hp < p.maxHp) {
            p.hp = Math.min(p.maxHp, p.hp + 60);
            this.pushDamagePopup(room, p.x, p.y - 20, 60, '#22c55e');
            pickedUp = true;
          }
        } else if (item.type === 'shield') {
          if (p.shield < p.maxShield) {
            p.shield = Math.min(p.maxShield, p.shield + 50);
            this.pushDamagePopup(room, p.x, p.y - 30, 50, '#38bdf8');
            pickedUp = true;
          }
        } else if (item.type === 'heavy_shield') {
          if (p.shield < p.maxShield) {
            p.shield = Math.min(p.maxShield, p.shield + 100);
            this.pushDamagePopup(room, p.x, p.y - 30, 100, '#0ea5e9');
            pickedUp = true;
          }
        } else if (item.type === 'ammo') {
          // Add ammo to all weapons
          for (const w of Object.keys(WEAPON_CONFIGS)) {
            p.reserveAmmo[w] = (p.reserveAmmo[w] || 0) + (WEAPON_CONFIGS[w].magazine * 2);
          }
          pickedUp = true;
        } else if (item.type === 'adrenaline') {
          p.speedBuffEndTime = now + 10000; // 10s +35% speed
          pickedUp = true;
        } else if (item.type === 'rage') {
          p.rageBuffEndTime = now + 10000; // 10s +50% dmg & flame bullets
          pickedUp = true;
        } 
        // Weapon Pickup Logic (Max 2 Weapons)
        else if (item.type.startsWith('weapon_')) {
          const wName = item.type.replace('weapon_', '');
          if (WEAPON_CONFIGS[wName]) {
            // If player has empty slot (< 2 weapons), auto-equip into empty slot
            if (p.weapons.length < 2 && !p.weapons.includes(wName)) {
              p.weapons.push(wName);
              p.activeWeapon = wName;
              p.activeWeaponSlot = p.weapons.length - 1;
              p.ammo[wName] = WEAPON_CONFIGS[wName].magazine;
              p.reserveAmmo[wName] = WEAPON_CONFIGS[wName].magazine * 3;
              pickedUp = true;
            }
          }
        }

        if (pickedUp) {
          room.loot.splice(i, 1);
        }
      }
    }
  }

  // Swap active weapon with ground weapon when requested
  public swapWeaponWithGround(room: RoyaleRoom, player: RoyalePlayer) {
    const now = Date.now();
    if (now - (player.lastSwapTime || 0) < 500) return; // Debounce to prevent ground loops

    const pickupRadius = PLAYER_RADIUS + 45;
    for (let i = room.loot.length - 1; i >= 0; i--) {
      const item = room.loot[i];
      if (item.type.startsWith('weapon_')) {
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < pickupRadius) {
          const newWeaponName = item.type.replace('weapon_', '');
          const oldWeaponName = player.activeWeapon;

          if (WEAPON_CONFIGS[newWeaponName]) {
            // Drop old weapon to ground
            room.loot[i] = {
              id: `loot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: `weapon_${oldWeaponName}` as any,
              x: player.x,
              y: player.y,
              createdAt: Date.now()
            };

            // Equip new weapon into active slot
            const slotIdx = player.activeWeaponSlot || 0;
            player.weapons[slotIdx] = newWeaponName;
            player.activeWeapon = newWeaponName;
            player.ammo[newWeaponName] = WEAPON_CONFIGS[newWeaponName].magazine;
            player.reserveAmmo[newWeaponName] = WEAPON_CONFIGS[newWeaponName].magazine * 3;
            player.lastSwapTime = now;
            break;
          }
        }
      }
    }
  }

  // Update Bullets and handle hits
  private updateBullets(room: RoyaleRoom) {
    const now = Date.now();

    for (let i = room.bullets.length - 1; i >= 0; i--) {
      const b = room.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.distanceTraveled += Math.hypot(b.vx, b.vy);

      let bulletDestroyed = false;

      // 1. Max Range Check
      if (b.distanceTraveled >= b.maxDistance) {
        if (b.isAoE) this.triggerAoEExplosion(room, b.x, b.y, b.damage, b.shooterId, b.aoeRadius || 65);
        room.bullets.splice(i, 1);
        continue;
      }

      // 2. Map Boundary Check
      if (b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
        if (b.isAoE) this.triggerAoEExplosion(room, b.x, b.y, b.damage, b.shooterId, b.aoeRadius || 65);
        room.bullets.splice(i, 1);
        continue;
      }

      // 3. Obstacle Collision (Rocks block bullets)
      for (const obs of room.obstacles) {
        if (obs.type === 'rock') {
          const dist = Math.hypot(b.x - obs.x, b.y - obs.y);
          if (dist < obs.radius + b.radius) {
            bulletDestroyed = true;
            if (b.isAoE) this.triggerAoEExplosion(room, b.x, b.y, b.damage, b.shooterId, b.aoeRadius || 65);
            break;
          }
        }
      }

      if (bulletDestroyed) {
        room.bullets.splice(i, 1);
        continue;
      }

      // 4. Crate Collision
      for (let ci = room.crates.length - 1; ci >= 0; ci--) {
        const c = room.crates[ci];
        const dist = Math.hypot(b.x - c.x, b.y - c.y);
        if (dist < 22 + b.radius) {
          c.hp -= b.damage;
          this.pushDamagePopup(room, c.x, c.y - 15, b.damage, '#fbbf24');
          bulletDestroyed = true;

          if (c.hp <= 0) {
            // Drop loot from destroyed crate
            this.dropCrateLoot(room, c);
            room.crates.splice(ci, 1);
          }
          break;
        }
      }

      if (bulletDestroyed) {
        if (b.isAoE) this.triggerAoEExplosion(room, b.x, b.y, b.damage, b.shooterId, b.aoeRadius || 65);
        room.bullets.splice(i, 1);
        continue;
      }

      // 5. Player Hit Collision
      for (const p of room.players) {
        if (p.id === b.shooterId || !p.isAlive) continue;

        // Check if player has active spawn shield (invulnerable)
        if (p.spawnShieldEndTime > now) continue;

        const dist = Math.hypot(b.x - p.x, b.y - p.y);
        if (dist < PLAYER_RADIUS + b.radius) {
          bulletDestroyed = true;
          this.applyDamageToPlayer(room, p, b.damage, b.shooterId);
          break;
        }
      }

      if (bulletDestroyed) {
        if (b.isAoE) this.triggerAoEExplosion(room, b.x, b.y, b.damage, b.shooterId, b.aoeRadius || 65);
        room.bullets.splice(i, 1);
      }
    }
  }

  // Trigger AoE Explosion (for Plasma / Rocket launcher)
  private triggerAoEExplosion(room: RoyaleRoom, x: number, y: number, damage: number, shooterId: string, radius: number) {
    const now = Date.now();
    for (const p of room.players) {
      if (p.id === shooterId || !p.isAlive || p.spawnShieldEndTime > now) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius + PLAYER_RADIUS) {
        const falloff = 1 - (d / (radius + PLAYER_RADIUS));
        const finalDmg = Math.round(damage * Math.max(0.4, falloff));
        this.applyDamageToPlayer(room, p, finalDmg, shooterId);
      }
    }

    // Also damage crates in AoE radius
    for (let ci = room.crates.length - 1; ci >= 0; ci--) {
      const c = room.crates[ci];
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < radius + 22) {
        c.hp -= damage;
        this.pushDamagePopup(room, c.x, c.y - 15, damage, '#f59e0b');
        if (c.hp <= 0) {
          this.dropCrateLoot(room, c);
          room.crates.splice(ci, 1);
        }
      }
    }
  }

  // Apply damage to player, absorbing with shield first
  private applyDamageToPlayer(room: RoyaleRoom, victim: RoyalePlayer, dmg: number, shooterId: string) {
    let remaining = dmg;
    if (victim.shield > 0) {
      if (victim.shield >= remaining) {
        victim.shield -= remaining;
        this.pushDamagePopup(room, victim.x, victim.y - 30, remaining, '#38bdf8');
        remaining = 0;
      } else {
        remaining -= victim.shield;
        this.pushDamagePopup(room, victim.x, victim.y - 30, victim.shield, '#38bdf8');
        victim.shield = 0;
      }
    }

    if (remaining > 0) {
      victim.hp = Math.max(0, victim.hp - remaining);
      this.pushDamagePopup(room, victim.x, victim.y - 15, remaining, '#ef4444');
    }

    // Check Death
    if (victim.hp <= 0) {
      victim.isAlive = false;
      victim.deaths++;

      const shooter = room.players.find(p => p.id === shooterId);
      if (shooter) {
        shooter.kills++;
      }

      // Add to killfeed
      const kName = shooter ? shooter.username : 'Fırtına';
      room.killfeed.unshift({
        id: `kf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        killer: kName,
        victim: victim.username,
        weapon: shooter ? (WEAPON_CONFIGS[shooter.activeWeapon]?.name || 'Silah') : 'Zehirli Gaz',
        time: Date.now()
      });
      if (room.killfeed.length > 5) room.killfeed.pop();

      // Drop victim loot
      if (room.mode === 'royale') {
        // Drop weapons & medkit in classic Battle Royale
        for (const w of victim.weapons) {
          if (w !== 'pistol') {
            room.loot.push({
              id: `loot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: `weapon_${w}` as any,
              x: victim.x + (Math.random() - 0.5) * 40,
              y: victim.y + (Math.random() - 0.5) * 40,
              createdAt: Date.now()
            });
          }
        }
        room.loot.push({
          id: `loot_${Date.now()}_ammo`,
          type: 'ammo',
          x: victim.x + 20,
          y: victim.y,
          createdAt: Date.now()
        });
        room.loot.push({
          id: `loot_${Date.now()}_med`,
          type: 'medkit',
          x: victim.x - 20,
          y: victim.y,
          createdAt: Date.now()
        });
      } else {
        // In Deathmatch, set 3-second respawn timer & drop a random ammo or bandage
        victim.respawnAt = Date.now() + 3000;
        room.loot.push({
          id: `loot_${Date.now()}_dm`,
          type: Math.random() > 0.5 ? 'ammo' : 'bandage',
          x: victim.x,
          y: victim.y,
          createdAt: Date.now()
        });
      }
    }
  }

  // Push damage numbers for client animation
  private pushDamagePopup(room: RoyaleRoom, x: number, y: number, damage: number, color: string) {
    room.damagePopups.push({
      id: `dp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x: x + (Math.random() - 0.5) * 16,
      y: y + (Math.random() - 0.5) * 16,
      damage,
      color,
      createdAt: Date.now()
    });
  }

  // Drop loot when crate breaks
  private dropCrateLoot(room: RoyaleRoom, c: RoyaleCrate) {
    room.loot.push({
      id: `loot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: c.lootType as any,
      x: c.x,
      y: c.y,
      createdAt: Date.now()
    });

    // Extra ammo drop for rare crates
    if (c.tier === 'rare') {
      room.loot.push({
        id: `loot_${Date.now()}_rare_ammo`,
        type: 'ammo',
        x: c.x + 25,
        y: c.y + 15,
        createdAt: Date.now()
      });
    }
  }

  // Update Storm Zone (Royale mode only)
  private updateZone(room: RoyaleRoom, now: number) {
    const z = room.zone;
    if (z.isShrinking) {
      const dx = z.targetX - z.currentX;
      const dy = z.targetY - z.currentY;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        z.currentX += (dx / dist) * z.shrinkSpeed;
        z.currentY += (dy / dist) * z.shrinkSpeed;
      }

      if (z.currentRadius > z.targetRadius) {
        z.currentRadius = Math.max(z.targetRadius, z.currentRadius - z.shrinkSpeed);
      } else {
        // Phase shrink completed, set next phase
        z.isShrinking = false;
        z.phase++;
        z.damage += 3;
        z.nextShrinkTime = now + 15000;
        z.targetRadius = Math.max(120, z.currentRadius * 0.55);
        z.targetX = Math.max(z.targetRadius + 100, Math.min(MAP_SIZE - z.targetRadius - 100, z.currentX + (Math.random() - 0.5) * 250));
        z.targetY = Math.max(z.targetRadius + 100, Math.min(MAP_SIZE - z.targetRadius - 100, z.currentY + (Math.random() - 0.5) * 250));
      }
    }

    // Apply Zone Damage every 1 second
    if (now - room.lastZoneDamageTime >= 1000) {
      room.lastZoneDamageTime = now;
      for (const p of room.players) {
        if (!p.isAlive) continue;
        const distFromCenter = Math.hypot(p.x - z.currentX, p.y - z.currentY);
        if (distFromCenter > z.currentRadius) {
          this.applyDamageToPlayer(room, p, z.damage, 'zone');
        }
      }
    }
  }

  // Bot AI behavior
  private updateBots(room: RoyaleRoom, now: number) {
    for (const bot of room.players) {
      if (!bot.isBot || !bot.isAlive) continue;

      if (!bot.botNextActionTime || now >= bot.botNextActionTime) {
        bot.botNextActionTime = now + 400 + Math.random() * 500;

        // Find nearest living enemy
        let nearestEnemy: RoyalePlayer | null = null;
        let minDist = 700;

        for (const other of room.players) {
          if (other.id !== bot.id && other.isAlive && other.spawnShieldEndTime <= now) {
            const d = Math.hypot(other.x - bot.x, other.y - bot.y);
            if (d < minDist) {
              minDist = d;
              nearestEnemy = other;
            }
          }
        }

        if (nearestEnemy) {
          bot.botTargetEnemyId = nearestEnemy.id;
          const angle = Math.atan2(nearestEnemy.y - bot.y, nearestEnemy.x - bot.x);
          bot.angle = angle;

          if (minDist > 260) {
            bot.vx = Math.cos(angle);
            bot.vy = Math.sin(angle);
          } else if (minDist < 120) {
            bot.vx = -Math.cos(angle);
            bot.vy = -Math.sin(angle);
          } else {
            bot.vx = -Math.sin(angle);
            bot.vy = Math.cos(angle);
          }
        } else {
          bot.botTargetEnemyId = null;
          // Wander or seek storm center
          let targetX = MAP_SIZE / 2;
          let targetY = MAP_SIZE / 2;
          if (room.mode === 'royale') {
            targetX = room.zone.currentX;
            targetY = room.zone.currentY;
          }
          const angle = Math.atan2(targetY - bot.y, targetX - bot.x) + (Math.random() - 0.5) * 1.2;
          bot.vx = Math.cos(angle) * 0.75;
          bot.vy = Math.sin(angle) * 0.75;
          bot.angle = angle;
        }
      }

      // Bot Shooting
      const wpn = bot.activeWeapon;
      const config = WEAPON_CONFIGS[wpn] || WEAPON_CONFIGS.pistol;
      const shouldShoot = bot.botTargetEnemyId && now - bot.lastShotTime >= config.fireRate;

      if (bot.ammo[wpn] === 0 && bot.reserveAmmo[wpn] > 0 && !bot.isReloading) {
        this.reloadWeapon(bot);
      }

      if (shouldShoot && !bot.isReloading) {
        this.shootBullet(room, bot, bot.angle);
      }
    }
  }

  // Check Win Condition
  private checkWinCondition(room: RoyaleRoom) {
    if (room.status !== 'playing') return;

    if (room.mode === 'royale') {
      // Classic Battle Royale: Last man standing wins
      const alivePlayers = room.players.filter(p => p.isAlive);
      if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0] || room.players[0];
        this.endMatch(room, winner);
      }
    }
  }

  // End Deathmatch when timer hits 00:00 (Winner has most kills)
  private endDeathmatchByTime(room: RoyaleRoom) {
    if (room.status !== 'playing') return;

    // Sort players by kills descending, then by lowest deaths
    const sorted = [...room.players].sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.deaths - b.deaths;
    });

    const winner = sorted[0] || room.players[0];
    this.endMatch(room, winner);
  }

  // End Match & Update Database Stats
  private async endMatch(room: RoyaleRoom, winner: RoyalePlayer) {
    room.status = 'gameover';
    room.winner = winner;

    if (room.timerInterval) clearInterval(room.timerInterval);
    if (room.tickInterval) clearInterval(room.tickInterval);

    // Save statistics in database for all real human players
    try {
      for (const p of room.players) {
        if (!p.isBot && p.userId > 0) {
          const isWin = p.id === winner.id ? 1 : 0;
          await this.db.execute({
            sql: `UPDATE users SET 
                    royale_wins = COALESCE(royale_wins, 0) + ?, 
                    royale_kills = COALESCE(royale_kills, 0) + ?, 
                    royale_matches = COALESCE(royale_matches, 0) + 1 
                  WHERE id = ?`,
            args: [isWin, p.kills, p.userId]
          });
        }
      }
    } catch (e) {
      console.error('Error updating Battle Royale match stats:', e);
    }

    this.io.to(room.id).emit('royale:game_over', {
      winner,
      state: this.getPublicGameState(room)
    });

    this.broadcastRoomsList();
  }

  // Shoot bullet
  private shootBullet(room: RoyaleRoom, player: RoyalePlayer, angle: number) {
    const now = Date.now();
    const wpn = player.activeWeapon;
    const config = WEAPON_CONFIGS[wpn] || WEAPON_CONFIGS.pistol;

    if (player.isReloading) return;

    if ((player.ammo[wpn] || 0) <= 0) {
      this.reloadWeapon(player);
      return;
    }

    player.ammo[wpn]--;
    player.lastShotTime = now;

    // Check rage buff (+50% damage & flame bullets)
    const isRage = player.rageBuffEndTime > now;
    const dmgMultiplier = isRage ? 1.5 : 1.0;
    const bulletColor = isRage ? '#ef4444' : config.bulletColor;

    const pellets = config.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const spreadAngle = angle + (Math.random() - 0.5) * config.spread;
      const bulletSpeed = config.speed;
      const vx = Math.cos(spreadAngle) * bulletSpeed;
      const vy = Math.sin(spreadAngle) * bulletSpeed;

      const bullet: RoyaleBullet = {
        id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        shooterId: player.id,
        x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 6),
        y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 6),
        vx,
        vy,
        damage: Math.round(config.damage * dmgMultiplier),
        distanceTraveled: 0,
        maxDistance: config.maxRange,
        color: bulletColor,
        radius: config.bulletRadius,
        isAoE: config.isAoE,
        aoeRadius: config.aoeRadius,
        isRage
      };

      room.bullets.push(bullet);
    }
  }

  // Reload active weapon
  public reloadWeapon(player: RoyalePlayer) {
    const now = Date.now();
    const wpn = player.activeWeapon;
    const config = WEAPON_CONFIGS[wpn] || WEAPON_CONFIGS.pistol;

    if (player.isReloading) return;
    if ((player.ammo[wpn] || 0) >= config.magazine) return;
    if ((player.reserveAmmo[wpn] || 0) <= 0) return;

    player.isReloading = true;
    player.reloadEndTime = now + config.reloadTime;
  }

  // Switch weapon slot (0 or 1), cycle 'next' / 'prev', or by weapon name
  public switchWeapon(player: RoyalePlayer, weaponNameOrSlot: string | number) {
    if (!player.isAlive || player.isReloading) return;

    if (typeof weaponNameOrSlot === 'number') {
      const slot = weaponNameOrSlot === 1 ? 1 : 0;
      if (player.weapons[slot]) {
        player.activeWeaponSlot = slot;
        player.activeWeapon = player.weapons[slot];
      }
    } else if (weaponNameOrSlot === 'next' || weaponNameOrSlot === 'prev') {
      if (player.weapons.length > 1) {
        const newSlot = player.activeWeaponSlot === 0 ? 1 : 0;
        player.activeWeaponSlot = newSlot;
        player.activeWeapon = player.weapons[newSlot];
      }
    } else if (typeof weaponNameOrSlot === 'string') {
      const idx = player.weapons.indexOf(weaponNameOrSlot);
      if (idx !== -1) {
        player.activeWeaponSlot = idx;
        player.activeWeapon = weaponNameOrSlot;
      }
    }
  }

  // Process player input from client (30 FPS)
  public processPlayerInput(
    roomId: string,
    userId: number,
    input: {
      vx?: number;
      vy?: number;
      angle?: number;
      shooting?: boolean;
      reload?: boolean;
      switchWeapon?: string | number;
      pickup?: boolean;
      swapWeapon?: boolean;
    }
  ) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.userId === userId && !p.isBot);
    if (!player || !player.isAlive) return;

    // Movement
    if (typeof input.vx === 'number' && typeof input.vy === 'number') {
      const len = Math.hypot(input.vx, input.vy);
      if (len > 0) {
        player.vx = input.vx / len;
        player.vy = input.vy / len;
      } else {
        player.vx = 0;
        player.vy = 0;
      }
    }

    // Aim angle
    if (typeof input.angle === 'number') {
      player.angle = input.angle;
    }

    // Shooting
    if (input.shooting) {
      const wpn = player.activeWeapon;
      const config = WEAPON_CONFIGS[wpn] || WEAPON_CONFIGS.pistol;
      const now = Date.now();
      if (now - player.lastShotTime >= config.fireRate) {
        this.shootBullet(room, player, player.angle);
      }
    }

    // Reload
    if (input.reload) {
      this.reloadWeapon(player);
    }

    // Switch Weapon
    if (input.switchWeapon !== undefined) {
      this.switchWeapon(player, input.switchWeapon);
    }

    // Manual pickup / swap weapon on ground
    if (input.swapWeapon || input.pickup) {
      this.swapWeaponWithGround(room, player);
      this.checkPlayerLootPickup(room, player, PLAYER_RADIUS + 50);
    }
  }

  // Generate obstacles (Rocks & Bushes)
  private generateObstacles(room: RoyaleRoom) {
    room.obstacles = [];

    // Rocks (hard cover, blocks bullets)
    for (let i = 0; i < 28; i++) {
      room.obstacles.push({
        id: `obs_rock_${i}`,
        type: 'rock',
        x: 150 + Math.random() * (MAP_SIZE - 300),
        y: 150 + Math.random() * (MAP_SIZE - 300),
        radius: 28 + Math.random() * 20
      });
    }

    // Bushes (soft foliage, hides players inside)
    for (let i = 0; i < 34; i++) {
      room.obstacles.push({
        id: `obs_bush_${i}`,
        type: 'bush',
        x: 100 + Math.random() * (MAP_SIZE - 200),
        y: 100 + Math.random() * (MAP_SIZE - 200),
        radius: 36 + Math.random() * 24
      });
    }
  }

  // Generate crates (Normal wooden & Rare golden crates)
  private generateCrates(room: RoyaleRoom) {
    room.crates = [];
    const normalLootPool = [
      'weapon_shotgun',
      'weapon_smg',
      'weapon_rifle',
      'bandage',
      'medkit',
      'shield',
      'ammo',
      'adrenaline'
    ];
    const rareLootPool = [
      'weapon_sniper',
      'weapon_plasma',
      'heavy_shield',
      'rage',
      'medkit'
    ];

    // 25 Normal Crates
    for (let i = 0; i < 25; i++) {
      const lootType = normalLootPool[Math.floor(Math.random() * normalLootPool.length)];
      room.crates.push({
        id: `crate_norm_${i}`,
        x: 180 + Math.random() * (MAP_SIZE - 360),
        y: 180 + Math.random() * (MAP_SIZE - 360),
        hp: 45,
        maxHp: 45,
        tier: 'normal',
        lootType
      });
    }

    // 10 Rare Golden/Purple Crates
    for (let i = 0; i < 10; i++) {
      const lootType = rareLootPool[Math.floor(Math.random() * rareLootPool.length)];
      room.crates.push({
        id: `crate_rare_${i}`,
        x: 250 + Math.random() * (MAP_SIZE - 500),
        y: 250 + Math.random() * (MAP_SIZE - 500),
        hp: 90,
        maxHp: 90,
        tier: 'rare',
        lootType
      });
    }
  }

  // Generate initial ground loot
  private generateInitialLoot(room: RoyaleRoom) {
    room.loot = [];
    const initialPool = [
      'weapon_shotgun',
      'weapon_smg',
      'weapon_rifle',
      'weapon_sniper',
      'weapon_plasma',
      'bandage',
      'medkit',
      'shield',
      'heavy_shield',
      'ammo',
      'adrenaline',
      'rage'
    ];

    for (let i = 0; i < 30; i++) {
      const t = initialPool[Math.floor(Math.random() * initialPool.length)];
      room.loot.push({
        id: `loot_init_${i}`,
        type: t as any,
        x: 120 + Math.random() * (MAP_SIZE - 240),
        y: 120 + Math.random() * (MAP_SIZE - 240),
        createdAt: Date.now()
      });
    }
  }

  // Spawn players in circle formation around map
  private spawnPlayers(room: RoyaleRoom) {
    const total = room.players.length;
    const center = MAP_SIZE / 2;
    const spawnRadius = 600;

    room.players.forEach((p, idx) => {
      const angle = (idx / total) * Math.PI * 2;
      p.x = center + Math.cos(angle) * spawnRadius;
      p.y = center + Math.sin(angle) * spawnRadius;
      p.hp = 100;
      p.shield = 0;
      p.isAlive = true;
      p.kills = 0;
      p.deaths = 0;
      p.weapons = ['pistol'];
      p.activeWeapon = 'pistol';
      p.activeWeaponSlot = 0;
      p.ammo.pistol = 15;
      p.reserveAmmo.pistol = 60;
      p.isReloading = false;
      p.respawnAt = null;
      p.spawnShieldEndTime = 0;
      p.speedBuffEndTime = 0;
      p.rageBuffEndTime = 0;
    });
  }

  // Get Win/Kill Leaderboard
  public async getLeaderboard(sortBy: 'wins' | 'kills' = 'wins'): Promise<any[]> {
    try {
      const orderCol = sortBy === 'kills' ? 'royale_kills' : 'royale_wins';
      const res = await this.db.execute({
        sql: `SELECT id, username, avatar, color, 
                     COALESCE(royale_wins, 0) as wins, 
                     COALESCE(royale_kills, 0) as kills, 
                     COALESCE(royale_matches, 0) as matches 
              FROM users 
              WHERE (royale_wins > 0 OR royale_kills > 0 OR royale_matches > 0)
              ORDER BY ${orderCol} DESC, royale_wins DESC 
              LIMIT 25`,
        args: []
      });

      return res.rows.map((row: any, index: number) => ({
        rank: index + 1,
        id: Number(row.id),
        username: String(row.username || 'Oyuncu'),
        avatar: row.avatar ? String(row.avatar) : null,
        color: row.color ? String(row.color) : '#3b82f6',
        wins: Number(row.wins || 0),
        kills: Number(row.kills || 0),
        matches: Number(row.matches || 0)
      }));
    } catch (e) {
      console.error('Error fetching Battle Royale leaderboard:', e);
      return [];
    }
  }

  // Broadcast unified active rooms list
  public broadcastRoomsList() {
    const list = this.getRoomsList();
    this.io.emit('royale:rooms_list', list);
  }

  // Broadcast single room state
  public broadcastRoomState(room: RoyaleRoom) {
    this.io.to(room.id).emit('royale:room_state', this.getPublicRoomState(room));
  }

  // Get public rooms list for lobby
  public getRoomsList() {
    const list: any[] = [];
    for (const [, r] of this.rooms) {
      list.push({
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
      });
    }
    return list;
  }

  // Public Room state
  public getPublicRoomState(r: RoyaleRoom) {
    return {
      id: r.id,
      title: r.title,
      hostId: r.hostId,
      hostName: r.hostName,
      hostAvatar: r.hostAvatar,
      capacity: r.capacity,
      mode: r.mode,
      duration: r.duration,
      matchTimeRemaining: r.matchTimeRemaining,
      status: r.status,
      countdown: r.countdown,
      players: r.players.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        isHost: p.isHost,
        ready: p.ready,
        kills: p.kills,
        deaths: p.deaths,
        isAlive: p.isAlive
      }))
    };
  }

  // Public Game state for 30 FPS sync
  public getPublicGameState(r: RoyaleRoom) {
    return {
      id: r.id,
      status: r.status,
      mode: r.mode,
      matchTimeRemaining: r.matchTimeRemaining,
      duration: r.duration,
      players: r.players.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        isHost: p.isHost,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        maxHp: p.maxHp,
        shield: p.shield,
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
      bullets: r.bullets,
      crates: r.crates,
      loot: r.loot,
      obstacles: r.obstacles,
      zone: r.zone,
      damagePopups: r.damagePopups,
      killfeed: r.killfeed,
      winner: r.winner ? {
        id: r.winner.id,
        userId: r.winner.userId,
        username: r.winner.username,
        avatar: r.winner.avatar,
        kills: r.winner.kills
      } : null
    };
  }

  // Unified tables for global active tables list
  public getUnifiedTables() {
    const list: any[] = [];
    for (const [, r] of this.rooms) {
      list.push({
        id: r.id,
        name: r.title,
        gameType: 'royale',
        gameTitle: r.mode === 'deathmatch' ? 'Mini Battle Royale (Ölüm Maçı)' : 'Mini Battle Royale (Hayatta Kalma)',
        capacity: r.capacity,
        playerCount: r.players.length,
        status: r.status === 'lobby' ? 'waiting' : 'playing',
        players: r.players.map(p => ({
          userId: p.userId,
          username: p.username,
          avatar: p.avatar,
          isHost: p.isHost
        })),
        createdAt: r.createdAt
      });
    }
    return list;
  }

  // Destroy room completely
  public destroyRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      if (room.tickInterval) clearInterval(room.tickInterval);
      this.rooms.delete(roomId);
      this.broadcastRoomsList();
    }
  }
}
