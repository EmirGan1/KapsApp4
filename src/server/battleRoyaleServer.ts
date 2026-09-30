import { Server as SocketIOServer, Socket } from "socket.io";
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
  activeWeapon: string; // 'pistol' | 'shotgun' | 'rifle' | 'sniper'
  weapons: string[];
  ammo: Record<string, number>;
  reserveAmmo: Record<string, number>;
  isReloading: boolean;
  reloadEndTime: number;
  lastShotTime: number;
  isAlive: boolean;
  kills: number;
  spectating: boolean;
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
}

export interface RoyaleCrate {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  lootType: string;
}

export interface RoyaleLoot {
  id: string;
  type: 'weapon_shotgun' | 'weapon_rifle' | 'weapon_sniper' | 'ammo' | 'medkit' | 'shield';
  x: number;
  y: number;
  value?: number;
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

export interface RoyaleRoom {
  id: string;
  title: string;
  hostId: number;
  hostName: string;
  hostAvatar: string | null;
  capacity: number; // 2, 3, or 4
  buyIn: number; // 0, 100, 250, 500, 1000 etc.
  pot: number;
  status: 'lobby' | 'countdown' | 'playing' | 'gameover';
  countdown: number;
  players: RoyalePlayer[];
  bullets: RoyaleBullet[];
  crates: RoyaleCrate[];
  loot: RoyaleLoot[];
  obstacles: RoyaleObstacle[];
  zone: RoyaleZone;
  killfeed: RoyaleKillfeedItem[];
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
}> = {
  pistol: {
    name: 'Tabanca',
    damage: 16,
    speed: 18,
    fireRate: 350,
    magazine: 12,
    reloadTime: 1100,
    maxRange: 650,
    spread: 0.05,
    bulletRadius: 3.5,
    bulletColor: '#fbbf24' // amber
  },
  shotgun: {
    name: 'Pompalı',
    damage: 15, // 5 pellets x 15 = 75 max damage
    speed: 16,
    fireRate: 850,
    magazine: 5,
    reloadTime: 1800,
    maxRange: 420,
    spread: 0.32,
    pellets: 5,
    bulletRadius: 3,
    bulletColor: '#f97316' // orange
  },
  rifle: {
    name: 'Taramalı Tüfek',
    damage: 19,
    speed: 23,
    fireRate: 150,
    magazine: 30,
    reloadTime: 1500,
    maxRange: 800,
    spread: 0.07,
    bulletRadius: 3.8,
    bulletColor: '#38bdf8' // sky blue
  },
  sniper: {
    name: 'Keskin Nişancı',
    damage: 65,
    speed: 34,
    fireRate: 1300,
    magazine: 5,
    reloadTime: 2200,
    maxRange: 1200,
    spread: 0.015,
    bulletRadius: 4.5,
    bulletColor: '#ec4899' // pink
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

  // Create Room
  public createRoom(
    hostUser: { id: number; username: string; avatar: string | null; color?: string },
    options: { title?: string; capacity?: number; buyIn?: number }
  ): RoyaleRoom {
    const roomId = `br_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const capacity = Math.min(4, Math.max(2, options.capacity || 4));
    const buyIn = Math.max(0, options.buyIn || 0);
    const title = options.title?.trim() || `${hostUser.username}'ın Arenası`;

    const hostPlayer: RoyalePlayer = {
      id: `u_${hostUser.id}`,
      userId: hostUser.id,
      username: hostUser.username,
      avatar: hostUser.avatar,
      color: hostUser.color || '#3b82f6',
      isBot: false,
      isHost: true,
      ready: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 100,
      activeWeapon: 'pistol',
      weapons: ['pistol'],
      ammo: { pistol: 12, shotgun: 0, rifle: 0, sniper: 0 },
      reserveAmmo: { pistol: 60, shotgun: 0, rifle: 0, sniper: 0 },
      isReloading: false,
      reloadEndTime: 0,
      lastShotTime: 0,
      isAlive: true,
      kills: 0,
      spectating: false
    };

    const room: RoyaleRoom = {
      id: roomId,
      title,
      hostId: hostUser.id,
      hostName: hostUser.username,
      hostAvatar: hostUser.avatar,
      capacity,
      buyIn,
      pot: 0,
      status: 'lobby',
      countdown: 3,
      players: [hostPlayer],
      bullets: [],
      crates: [],
      loot: [],
      obstacles: [],
      zone: {
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
      },
      killfeed: [],
      winner: null,
      startedAt: 0,
      lastZoneDamageTime: 0,
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    this.broadcastRoomsList();
    return room;
  }

  // Join Room
  public joinRoom(
    roomId: string,
    user: { id: number; username: string; avatar: string | null; color?: string }
  ): { success: boolean; room?: RoyaleRoom; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };

    if (room.status !== 'lobby') {
      return { success: false, error: 'Oyun zaten başlamış.' };
    }

    if (room.players.length >= room.capacity) {
      return { success: false, error: 'Masa dolu.' };
    }

    const existing = room.players.find(p => !p.isBot && p.userId === user.id);
    if (existing) {
      return { success: true, room };
    }

    const player: RoyalePlayer = {
      id: `u_${user.id}`,
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      color: user.color || '#10b981',
      isBot: false,
      isHost: false,
      ready: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 100,
      maxHp: 100,
      shield: 0,
      maxShield: 100,
      activeWeapon: 'pistol',
      weapons: ['pistol'],
      ammo: { pistol: 12, shotgun: 0, rifle: 0, sniper: 0 },
      reserveAmmo: { pistol: 60, shotgun: 0, rifle: 0, sniper: 0 },
      isReloading: false,
      reloadEndTime: 0,
      lastShotTime: 0,
      isAlive: true,
      kills: 0,
      spectating: false
    };

    room.players.push(player);
    this.io.to(roomId).emit('royale:room_state', this.getPublicRoomState(room));
    this.broadcastRoomsList();
    return { success: true, room };
  }

  // Add Bot
  public addBot(roomId: string, hostId: number): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };
    if (room.hostId !== hostId) return { success: false, error: 'Sadece masa sahibi bot ekleyebilir.' };
    if (room.status !== 'lobby') return { success: false, error: 'Oyun sırasında bot eklenemez.' };
    if (room.players.length >= room.capacity) return { success: false, error: 'Masa kapasitesi dolu.' };

    const botNumber = room.players.filter(p => p.isBot).length + 1;
    const botName = BOT_NAMES[(botNumber - 1) % BOT_NAMES.length];

    const botPlayer: RoyalePlayer = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: 0,
      username: botName,
      avatar: null,
      color: '#f59e0b',
      isBot: true,
      isHost: false,
      ready: true,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 100,
      maxHp: 100,
      shield: 25,
      maxShield: 100,
      activeWeapon: 'pistol',
      weapons: ['pistol'],
      ammo: { pistol: 12, shotgun: 0, rifle: 0, sniper: 0 },
      reserveAmmo: { pistol: 60, shotgun: 0, rifle: 0, sniper: 0 },
      isReloading: false,
      reloadEndTime: 0,
      lastShotTime: 0,
      isAlive: true,
      kills: 0,
      spectating: false
    };

    room.players.push(botPlayer);
    this.io.to(roomId).emit('royale:room_state', this.getPublicRoomState(room));
    this.broadcastRoomsList();
    return { success: true };
  }

  // Remove Bot
  public removeBot(roomId: string, hostId: number, botId?: string): { success: boolean; error?: string } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };
    if (room.hostId !== hostId) return { success: false, error: 'Sadece masa sahibi bot çıkarabilir.' };
    if (room.status !== 'lobby') return { success: false, error: 'Oyun sırasında bot çıkarılamaz.' };

    const botIndex = botId
      ? room.players.findIndex(p => p.isBot && p.id === botId)
      : room.players.map(p => p.isBot).lastIndexOf(true);

    if (botIndex === -1) return { success: false, error: 'Çıkarılacak bot bulunamadı.' };

    room.players.splice(botIndex, 1);
    this.io.to(roomId).emit('royale:room_state', this.getPublicRoomState(room));
    this.broadcastRoomsList();
    return { success: true };
  }

  // Toggle Ready
  public toggleReady(roomId: string, userId: number): { success: boolean; ready?: boolean } {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'lobby') return { success: false };

    const player = room.players.find(p => !p.isBot && p.userId === userId);
    if (!player) return { success: false };

    player.ready = !player.ready;
    this.io.to(roomId).emit('royale:room_state', this.getPublicRoomState(room));
    return { success: true, ready: player.ready };
  }

  // Leave Room
  public leaveRoom(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => !p.isBot && p.userId === userId);
    if (playerIndex === -1) return;

    const wasHost = room.players[playerIndex].isHost;
    room.players.splice(playerIndex, 1);

    // If no human players left, clean up room
    const humanPlayers = room.players.filter(p => !p.isBot);
    if (humanPlayers.length === 0) {
      this.destroyRoom(roomId);
      return;
    }

    // If host left, migrate host to first human
    if (wasHost && humanPlayers.length > 0) {
      humanPlayers[0].isHost = true;
      humanPlayers[0].ready = true;
      room.hostId = humanPlayers[0].userId;
      room.hostName = humanPlayers[0].username;
      room.hostAvatar = humanPlayers[0].avatar;
    }

    this.io.to(roomId).emit('royale:room_state', this.getPublicRoomState(room));
    this.broadcastRoomsList();
  }

  // Start Game
  public async startGame(roomId: string, hostId: number): Promise<{ success: boolean; error?: string }> {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Masa bulunamadı.' };
    if (room.hostId !== hostId) return { success: false, error: 'Sadece masa sahibi oyunu başlatabilir.' };
    if (room.status !== 'lobby') return { success: false, error: 'Oyun zaten başlatıldı.' };
    if (room.players.length < 2) return { success: false, error: 'Oyunu başlatmak için en az 2 oyuncu veya bot gereklidir.' };

    const humanPlayers = room.players.filter(p => !p.isBot);

    // Check balances if buyIn > 0
    if (room.buyIn > 0) {
      for (const p of humanPlayers) {
        const uRes = await this.db.execute({
          sql: "SELECT id, chips FROM users WHERE id = ?",
          args: [p.userId]
        });
        let currentChips = Number(uRes.rows[0]?.chips ?? 0);
        if (currentChips < room.buyIn) {
          // If user has 0 chips, give them 1000 free test chips
          if (currentChips === 0) {
            await this.db.execute({
              sql: "UPDATE users SET chips = 1000 WHERE id = ?",
              args: [p.userId]
            });
            currentChips = 1000;
            this.io.emit('chips_updated', { userId: p.userId, chips: 1000 });
          } else {
            return {
              success: false,
              error: `${p.username} yeterli bakiyeye sahip değil! Gereken: ${room.buyIn} Coin (Mevcut: ${currentChips})`
            };
          }
        }
      }

      // Deduct buy-in from all real players
      for (const p of humanPlayers) {
        await this.db.execute({
          sql: "UPDATE users SET chips = MAX(0, chips - ?) WHERE id = ?",
          args: [room.buyIn, p.userId]
        });
        const updated = await this.db.execute({
          sql: "SELECT chips FROM users WHERE id = ?",
          args: [p.userId]
        });
        const newChips = Number(updated.rows[0]?.chips ?? 0);
        this.io.emit('chips_updated', { userId: p.userId, chips: newChips });
      }

      room.pot = room.buyIn * humanPlayers.length;
    } else {
      room.pot = 0;
    }

    // Clear any previous timers
    if (room.timerInterval) clearInterval(room.timerInterval);
    if (room.tickInterval) clearInterval(room.tickInterval);

    // Transition to countdown
    room.status = 'countdown';
    room.countdown = 3;
    this.io.to(roomId).emit('royale:countdown', { countdown: 3, pot: room.pot });

    room.timerInterval = setInterval(() => {
      room.countdown--;
      if (room.countdown > 0) {
        this.io.to(roomId).emit('royale:countdown', { countdown: room.countdown, pot: room.pot });
      } else {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
        this.launchMatch(room);
      }
    }, 1000);

    this.broadcastRoomsList();
    return { success: true };
  }

  // Launch Match arena setup
  private launchMatch(room: RoyaleRoom) {
    if (room.tickInterval) clearInterval(room.tickInterval);

    room.status = 'playing';
    room.startedAt = Date.now();
    room.lastZoneDamageTime = Date.now();

    // Spawn obstacles (Rocks & Bushes)
    room.obstacles = this.generateObstacles();

    // Spawn crates
    room.crates = this.generateCrates();
    room.loot = [];
    room.bullets = [];
    room.killfeed = [];
    room.winner = null;

    // Initialize Zone
    room.zone = {
      currentX: MAP_SIZE / 2,
      currentY: MAP_SIZE / 2,
      currentRadius: MAP_SIZE * 0.72,
      targetX: MAP_SIZE / 2,
      targetY: MAP_SIZE / 2,
      targetRadius: MAP_SIZE * 0.48,
      shrinkSpeed: 1.1,
      phase: 1,
      isShrinking: false,
      nextShrinkTime: Date.now() + 15000, // starts shrinking after 15s
      damage: 5
    };

    // Position players around the safe circle
    const count = Math.max(1, room.players.length);
    const spawnRadius = 550;
    const center = MAP_SIZE / 2;

    room.players.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const px = center + Math.cos(angle) * spawnRadius;
      const py = center + Math.sin(angle) * spawnRadius;
      p.x = Number.isFinite(px) ? Math.round(px) : center;
      p.y = Number.isFinite(py) ? Math.round(py) : center;
      p.vx = 0;
      p.vy = 0;
      p.angle = Number.isFinite(angle) ? angle + Math.PI : 0;
      p.hp = 100;
      p.maxHp = 100;
      p.shield = p.isBot ? 25 : 0;
      p.maxShield = 100;
      p.isAlive = true;
      p.kills = 0;
      p.spectating = false;
      p.activeWeapon = 'pistol';
      p.weapons = ['pistol'];
      p.ammo = { pistol: 12, shotgun: 0, rifle: 0, sniper: 0 };
      p.reserveAmmo = { pistol: 60, shotgun: 0, rifle: 0, sniper: 0 };
      p.isReloading = false;
    });

    // Start 30 FPS tick loop
    room.tickInterval = setInterval(() => {
      this.tickRoom(room);
    }, 1000 / TICK_RATE);

    const initialGameState = this.getPublicGameState(room);
    this.io.to(room.id).emit('royale:game_started', initialGameState);
    this.io.to(room.id).emit('royale:game_state', initialGameState);
    this.broadcastRoomsList();
  }

  // 30 FPS Game Simulation Tick
  private tickRoom(room: RoyaleRoom) {
    if (room.status !== 'playing') return;

    const now = Date.now();

    // 1. Zone / Storm Updates
    this.updateZone(room, now);

    // 2. Bot AI updates
    this.updateBots(room, now);

    // 3. Player Movement & Physics
    this.updatePlayers(room, now);

    // 4. Bullet Movement & Collisions
    this.updateBullets(room);

    // 5. Zone Damage (every 1 second)
    if (now - room.lastZoneDamageTime >= 1000) {
      room.lastZoneDamageTime = now;
      this.applyZoneDamage(room);
    }

    // 6. Check Win Condition
    const alivePlayers = room.players.filter(p => p.isAlive);
    if (alivePlayers.length <= 1) {
      this.finishMatch(room, alivePlayers[0] || null);
      return;
    }

    // 7. Broadcast state
    this.io.to(room.id).emit('royale:game_state', this.getPublicGameState(room));
  }

  // Zone / Storm Mechanics
  private updateZone(room: RoyaleRoom, now: number) {
    const z = room.zone;

    // Check if shrink phase triggers
    if (!z.isShrinking && now >= z.nextShrinkTime) {
      z.isShrinking = true;
      this.io.to(room.id).emit('royale:zone_warning', {
        message: '⚠️ Dikkat! Fırtına Gazı Daralıyor!',
        phase: z.phase
      });
    }

    // Shrink radius towards target
    if (z.isShrinking) {
      if (z.currentRadius > z.targetRadius) {
        z.currentRadius = Math.max(z.targetRadius, z.currentRadius - z.shrinkSpeed);
        // Slightly nudge center towards target
        z.currentX += (z.targetX - z.currentX) * 0.002;
        z.currentY += (z.targetY - z.currentY) * 0.002;
      } else {
        // Stage completed, prepare next smaller circle
        z.isShrinking = false;
        z.phase++;
        z.damage += 5; // damage increases each phase (5 -> 10 -> 15 -> 20)
        z.nextShrinkTime = now + 12000; // 12 seconds grace period

        // Random new target center inside current circle
        const maxOffset = z.currentRadius * 0.35;
        const randAngle = Math.random() * Math.PI * 2;
        const randDist = Math.random() * maxOffset;

        z.targetX = Math.max(400, Math.min(MAP_SIZE - 400, z.currentX + Math.cos(randAngle) * randDist));
        z.targetY = Math.max(400, Math.min(MAP_SIZE - 400, z.currentY + Math.sin(randAngle) * randDist));
        z.targetRadius = Math.max(120, z.currentRadius * 0.55);
        z.shrinkSpeed = Math.max(0.8, z.shrinkSpeed * 1.15);
      }
    }
  }

  // Apply zone damage to players outside currentRadius
  private applyZoneDamage(room: RoyaleRoom) {
    const z = room.zone;
    room.players.forEach(p => {
      if (!p.isAlive) return;
      const dx = p.x - z.currentX;
      const dy = p.y - z.currentY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > z.currentRadius) {
        p.hp -= z.damage;
        if (p.hp <= 0) {
          p.hp = 0;
          this.handlePlayerDeath(room, p, null, 'Fırtına');
        }
      }
    });
  }

  // Bot AI System
  private updateBots(room: RoyaleRoom, now: number) {
    const aliveBots = room.players.filter(p => p.isBot && p.isAlive);
    const z = room.zone;

    aliveBots.forEach(bot => {
      // Find nearest living enemy
      let nearestEnemy: RoyalePlayer | null = null;
      let nearestEnemyDist = Infinity;

      room.players.forEach(other => {
        if (!other.isAlive || other.id === bot.id) return;
        const dist = Math.hypot(other.x - bot.x, other.y - bot.y);
        if (dist < nearestEnemyDist) {
          nearestEnemyDist = dist;
          nearestEnemy = other;
        }
      });

      // Zone safety priority: if bot is in or close to storm, head towards center of safe zone
      const distFromZone = Math.hypot(bot.x - z.currentX, bot.y - z.currentY);
      const isDangerousStorm = distFromZone > z.currentRadius * 0.85;

      let moveTargetX = bot.x;
      let moveTargetY = bot.y;
      let shouldShoot = false;

      if (isDangerousStorm) {
        // Run towards safe zone
        moveTargetX = z.currentX + (Math.random() - 0.5) * 150;
        moveTargetY = z.currentY + (Math.random() - 0.5) * 150;
      } else if (nearestEnemy && nearestEnemyDist < 600) {
        // Combat engagement
        bot.angle = Math.atan2((nearestEnemy as RoyalePlayer).y - bot.y, (nearestEnemy as RoyalePlayer).x - bot.x);

        if (nearestEnemyDist > 250) {
          // Move towards enemy
          moveTargetX = (nearestEnemy as RoyalePlayer).x;
          moveTargetY = (nearestEnemy as RoyalePlayer).y;
        } else {
          // Circle or strafe enemy
          moveTargetX = bot.x + Math.cos(bot.angle + Math.PI / 2) * 50;
          moveTargetY = bot.y + Math.sin(bot.angle + Math.PI / 2) * 50;
        }

        // Shoot if within weapon range
        const config = WEAPON_CONFIGS[bot.activeWeapon] || WEAPON_CONFIGS.pistol;
        if (nearestEnemyDist <= config.maxRange) {
          shouldShoot = true;
        }
      } else {
        // Wander or search for nearest crate/loot
        let nearestCrate: RoyaleCrate | null = null;
        let nearestCrateDist = Infinity;

        room.crates.forEach(c => {
          const d = Math.hypot(c.x - bot.x, c.y - bot.y);
          if (d < nearestCrateDist) {
            nearestCrateDist = d;
            nearestCrate = c;
          }
        });

        if (nearestCrate && nearestCrateDist < 450) {
          moveTargetX = (nearestCrate as RoyaleCrate).x;
          moveTargetY = (nearestCrate as RoyaleCrate).y;
          bot.angle = Math.atan2((nearestCrate as RoyaleCrate).y - bot.y, (nearestCrate as RoyaleCrate).x - bot.x);
          if (nearestCrateDist < 200) shouldShoot = true;
        } else {
          // Idle patrol
          if (!bot.botNextActionTime || now > bot.botNextActionTime) {
            bot.botTargetX = z.currentX + (Math.random() - 0.5) * z.currentRadius * 0.8;
            bot.botTargetY = z.currentY + (Math.random() - 0.5) * z.currentRadius * 0.8;
            bot.botNextActionTime = now + 2500 + Math.random() * 2000;
          }
          moveTargetX = bot.botTargetX || bot.x;
          moveTargetY = bot.botTargetY || bot.y;
          bot.angle = Math.atan2(moveTargetY - bot.y, moveTargetX - bot.x);
        }
      }

      // Compute velocity
      const toX = moveTargetX - bot.x;
      const toY = moveTargetY - bot.y;
      const d = Math.hypot(toX, toY);
      if (d > 10) {
        bot.vx = (toX / d) * 4.2;
        bot.vy = (toY / d) * 4.2;
      } else {
        bot.vx = 0;
        bot.vy = 0;
      }

      // Bot auto-reload
      const wpn = bot.activeWeapon;
      if (bot.ammo[wpn] === 0 && bot.reserveAmmo[wpn] > 0 && !bot.isReloading) {
        this.startReload(bot, now);
      }

      // Bot shoot
      if (shouldShoot && !bot.isReloading) {
        this.tryShoot(room, bot, now);
      }
    });
  }

  // Update Players & Obstacle Collisions
  private updatePlayers(room: RoyaleRoom, now: number) {
    room.players.forEach(p => {
      if (!p.isAlive) return;

      // Handle reload finish
      if (p.isReloading && now >= p.reloadEndTime) {
        p.isReloading = false;
        const config = WEAPON_CONFIGS[p.activeWeapon] || WEAPON_CONFIGS.pistol;
        const needed = config.magazine - (p.ammo[p.activeWeapon] || 0);
        const available = p.reserveAmmo[p.activeWeapon] || 0;
        const amount = Math.min(needed, available);
        p.ammo[p.activeWeapon] = (p.ammo[p.activeWeapon] || 0) + amount;
        p.reserveAmmo[p.activeWeapon] = Math.max(0, available - amount);
      }

      // Proposed position
      let newX = p.x + p.vx;
      let newY = p.y + p.vy;

      // Map boundary check
      newX = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, newX));
      newY = Math.max(PLAYER_RADIUS, Math.min(MAP_SIZE - PLAYER_RADIUS, newY));

      // Solid obstacle collisions (Rocks)
      room.obstacles.forEach(obs => {
        if (obs.type === 'rock') {
          const dx = newX - obs.x;
          const dy = newY - obs.y;
          const dist = Math.hypot(dx, dy);
          const minDist = PLAYER_RADIUS + obs.radius;
          if (dist < minDist && dist > 0) {
            newX = obs.x + (dx / dist) * minDist;
            newY = obs.y + (dy / dist) * minDist;
          }
        }
      });

      // Crate collisions
      room.crates.forEach(c => {
        const dx = newX - c.x;
        const dy = newY - c.y;
        const dist = Math.hypot(dx, dy);
        const minDist = PLAYER_RADIUS + 22;
        if (dist < minDist && dist > 0) {
          newX = c.x + (dx / dist) * minDist;
          newY = c.y + (dy / dist) * minDist;
        }
      });

      p.x = newX;
      p.y = newY;

      // Check auto-pickup of nearby loot
      this.checkPlayerLootPickup(room, p);
    });
  }

  // Check and pickup loot
  private checkPlayerLootPickup(room: RoyaleRoom, p: RoyalePlayer) {
    const pickupRadius = PLAYER_RADIUS + 25;
    for (let i = room.loot.length - 1; i >= 0; i--) {
      const item = room.loot[i];
      const dist = Math.hypot(p.x - item.x, p.y - item.y);
      if (dist <= pickupRadius) {
        let picked = false;

        if (item.type === 'medkit' && p.hp < p.maxHp) {
          p.hp = Math.min(p.maxHp, p.hp + 50);
          picked = true;
        } else if (item.type === 'shield' && p.shield < p.maxShield) {
          p.shield = Math.min(p.maxShield, p.shield + 50);
          picked = true;
        } else if (item.type === 'ammo') {
          p.reserveAmmo.pistol = (p.reserveAmmo.pistol || 0) + 30;
          p.reserveAmmo.shotgun = (p.reserveAmmo.shotgun || 0) + 15;
          p.reserveAmmo.rifle = (p.reserveAmmo.rifle || 0) + 60;
          p.reserveAmmo.sniper = (p.reserveAmmo.sniper || 0) + 10;
          picked = true;
        } else if (item.type.startsWith('weapon_')) {
          const wpnName = item.type.replace('weapon_', '');
          if (!p.weapons.includes(wpnName)) {
            p.weapons.push(wpnName);
            p.activeWeapon = wpnName;
            p.ammo[wpnName] = WEAPON_CONFIGS[wpnName]?.magazine || 10;
            p.reserveAmmo[wpnName] = (WEAPON_CONFIGS[wpnName]?.magazine || 10) * 3;
            picked = true;
          } else {
            // Give ammo if already has weapon
            p.reserveAmmo[wpnName] = (p.reserveAmmo[wpnName] || 0) + (WEAPON_CONFIGS[wpnName]?.magazine || 10);
            picked = true;
          }
        }

        if (picked) {
          room.loot.splice(i, 1);
        }
      }
    }
  }

  // Update Bullets & Collisions
  private updateBullets(room: RoyaleRoom) {
    for (let i = room.bullets.length - 1; i >= 0; i--) {
      const b = room.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.distanceTraveled += Math.hypot(b.vx, b.vy);

      // Max distance check
      if (b.distanceTraveled >= b.maxDistance) {
        room.bullets.splice(i, 1);
        continue;
      }

      // Map bounds check
      if (b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
        room.bullets.splice(i, 1);
        continue;
      }

      // Check collision with solid rocks
      let hitObstacle = false;
      for (const obs of room.obstacles) {
        if (obs.type === 'rock') {
          if (Math.hypot(b.x - obs.x, b.y - obs.y) <= obs.radius + b.radius) {
            hitObstacle = true;
            break;
          }
        }
      }
      if (hitObstacle) {
        room.bullets.splice(i, 1);
        continue;
      }

      // Check collision with Crates
      let hitCrate = false;
      for (let cIdx = room.crates.length - 1; cIdx >= 0; cIdx--) {
        const c = room.crates[cIdx];
        if (Math.hypot(b.x - c.x, b.y - c.y) <= 24 + b.radius) {
          hitCrate = true;
          c.hp -= b.damage;
          if (c.hp <= 0) {
            // Drop loot
            room.loot.push({
              id: `loot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              type: c.lootType as any,
              x: c.x,
              y: c.y
            });
            room.crates.splice(cIdx, 1);
          }
          break;
        }
      }
      if (hitCrate) {
        room.bullets.splice(i, 1);
        continue;
      }

      // Check collision with other players
      let hitPlayer = false;
      for (const p of room.players) {
        if (!p.isAlive || p.id === b.shooterId) continue;

        if (Math.hypot(b.x - p.x, b.y - p.y) <= PLAYER_RADIUS + b.radius) {
          hitPlayer = true;
          // Damage calculation (absorb with shield first)
          let remainingDamage = b.damage;
          if (p.shield > 0) {
            if (p.shield >= remainingDamage) {
              p.shield -= remainingDamage;
              remainingDamage = 0;
            } else {
              remainingDamage -= p.shield;
              p.shield = 0;
            }
          }

          p.hp -= remainingDamage;

          // Check kill
          if (p.hp <= 0) {
            p.hp = 0;
            const shooter = room.players.find(s => s.id === b.shooterId);
            if (shooter) shooter.kills++;
            this.handlePlayerDeath(room, p, shooter || null, 'Mermi');
          }
          break;
        }
      }

      if (hitPlayer) {
        room.bullets.splice(i, 1);
      }
    }
  }

  // Handle Player Death
  private handlePlayerDeath(
    room: RoyaleRoom,
    victim: RoyalePlayer,
    killer: RoyalePlayer | null,
    weaponName: string
  ) {
    victim.isAlive = false;

    // Drop all loot from victim
    victim.weapons.forEach(w => {
      if (w !== 'pistol') {
        room.loot.push({
          id: `loot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: `weapon_${w}` as any,
          x: victim.x + (Math.random() - 0.5) * 40,
          y: victim.y + (Math.random() - 0.5) * 40
        });
      }
    });

    room.loot.push({
      id: `loot_${Date.now()}_ammo`,
      type: 'ammo',
      x: victim.x + (Math.random() - 0.5) * 30,
      y: victim.y + (Math.random() - 0.5) * 30
    });

    room.loot.push({
      id: `loot_${Date.now()}_med`,
      type: 'medkit',
      x: victim.x + (Math.random() - 0.5) * 30,
      y: victim.y + (Math.random() - 0.5) * 30
    });

    // Add to killfeed
    const killerName = killer ? killer.username : 'Fırtına';
    room.killfeed.unshift({
      id: `kf_${Date.now()}_${Math.random()}`,
      killer: killerName,
      victim: victim.username,
      weapon: weaponName,
      time: Date.now()
    });

    if (room.killfeed.length > 5) room.killfeed.pop();

    this.io.to(room.id).emit('royale:player_killed', {
      victimId: victim.id,
      victimName: victim.username,
      killerName,
      aliveCount: room.players.filter(p => p.isAlive).length
    });
  }

  // Finish Match & Award Pot to Winner
  private async finishMatch(room: RoyaleRoom, winner: RoyalePlayer | null) {
    if (room.status === 'gameover') return;
    room.status = 'gameover';
    room.winner = winner;

    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    // Award Pot to Winner
    if (winner && !winner.isBot && room.pot > 0) {
      try {
        await this.db.execute({
          sql: "UPDATE users SET chips = chips + ?, royale_wins = COALESCE(royale_wins, 0) + 1 WHERE id = ?",
          args: [room.pot, winner.userId]
        });

        const userRes = await this.db.execute({
          sql: "SELECT chips FROM users WHERE id = ?",
          args: [winner.userId]
        });
        const newChips = Number(userRes.rows[0]?.chips ?? 0);

        this.io.emit('chips_updated', {
          userId: winner.userId,
          chips: newChips,
          message: `🏆 Battle Royale Zaferi! +${room.pot} Coin Kazandınız!`
        });
        this.io.emit('leaderboard_updated');
      } catch (err) {
        console.error('Error awarding royale pot:', err);
      }
    }

    this.io.to(room.id).emit('royale:game_over', {
      winner: winner
        ? {
            id: winner.id,
            userId: winner.userId,
            username: winner.username,
            avatar: winner.avatar,
            kills: winner.kills,
            isBot: winner.isBot
          }
        : null,
      pot: room.pot,
      state: this.getPublicGameState(room)
    });

    this.broadcastRoomsList();
  }

  // Shoot Attempt
  public tryShoot(room: RoyaleRoom, player: RoyalePlayer, now: number) {
    if (!player.isAlive || player.isReloading) return;

    const wpn = player.activeWeapon;
    const config = WEAPON_CONFIGS[wpn] || WEAPON_CONFIGS.pistol;

    // Check fire rate cooldown
    if (now - player.lastShotTime < config.fireRate) return;

    // Check ammo
    const currentAmmo = player.ammo[wpn] || 0;
    if (currentAmmo <= 0) {
      this.startReload(player, now);
      return;
    }

    player.lastShotTime = now;
    player.ammo[wpn] = currentAmmo - 1;

    // Spawn bullets
    const pellets = config.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const spreadOffset = (Math.random() - 0.5) * config.spread;
      const angle = player.angle + spreadOffset;

      const spawnX = player.x + Math.cos(player.angle) * (PLAYER_RADIUS + 12);
      const spawnY = player.y + Math.sin(player.angle) * (PLAYER_RADIUS + 12);

      room.bullets.push({
        id: `b_${Date.now()}_${Math.random()}`,
        shooterId: player.id,
        x: spawnX,
        y: spawnY,
        vx: Math.cos(angle) * config.speed,
        vy: Math.sin(angle) * config.speed,
        damage: config.damage,
        distanceTraveled: 0,
        maxDistance: config.maxRange,
        color: config.bulletColor,
        radius: config.bulletRadius
      });
    }

    // Auto reload if empty after this shot
    if (player.ammo[wpn] <= 0) {
      this.startReload(player, now);
    }
  }

  // Start Reload
  public startReload(player: RoyalePlayer, now: number) {
    if (player.isReloading) return;
    const wpn = player.activeWeapon;
    const reserve = player.reserveAmmo[wpn] || 0;
    if (reserve <= 0) return;

    const config = WEAPON_CONFIGS[wpn] || WEAPON_CONFIGS.pistol;
    if ((player.ammo[wpn] || 0) >= config.magazine) return;

    player.isReloading = true;
    player.reloadEndTime = now + config.reloadTime;
  }

  // Switch Weapon
  public switchWeapon(player: RoyalePlayer, weaponName: string) {
    if (!player.isAlive || player.isReloading) return;
    if (player.weapons.includes(weaponName)) {
      player.activeWeapon = weaponName;
    }
  }

  // Process Player Input
  public processPlayerInput(
    roomId: string,
    userId: number,
    input: {
      vx?: number;
      vy?: number;
      angle?: number;
      shooting?: boolean;
      reload?: boolean;
      switchWeapon?: string;
    }
  ) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => !p.isBot && p.userId === userId);
    if (!player || !player.isAlive) return;

    const now = Date.now();

    // Movement speed: 5.2 pixels per tick
    const maxSpeed = 5.2;
    if (typeof input.vx === 'number' && typeof input.vy === 'number') {
      const len = Math.hypot(input.vx, input.vy);
      if (len > 0.05) {
        player.vx = (input.vx / len) * maxSpeed;
        player.vy = (input.vy / len) * maxSpeed;
      } else {
        player.vx = 0;
        player.vy = 0;
      }
    } else {
      player.vx = 0;
      player.vy = 0;
    }
    if (!Number.isFinite(player.vx)) player.vx = 0;
    if (!Number.isFinite(player.vy)) player.vy = 0;

    // Aim Angle
    if (typeof input.angle === 'number' && Number.isFinite(input.angle)) {
      player.angle = input.angle;
    }

    // Shooting
    if (input.shooting) {
      this.tryShoot(room, player, now);
    }

    // Reload
    if (input.reload) {
      this.startReload(player, now);
    }

    // Switch Weapon
    if (typeof input.switchWeapon === 'string') {
      this.switchWeapon(player, input.switchWeapon);
    }
  }

  // Generate obstacles (Rocks & Bushes)
  private generateObstacles(): RoyaleObstacle[] {
    const obstacles: RoyaleObstacle[] = [];
    const count = 38;

    for (let i = 0; i < count; i++) {
      const isRock = Math.random() > 0.45;
      const radius = isRock ? 30 + Math.random() * 22 : 45 + Math.random() * 25;
      const x = 200 + Math.random() * (MAP_SIZE - 400);
      const y = 200 + Math.random() * (MAP_SIZE - 400);

      // Keep center somewhat clear
      if (Math.hypot(x - MAP_SIZE / 2, y - MAP_SIZE / 2) < 200) continue;

      obstacles.push({
        id: `obs_${i}`,
        type: isRock ? 'rock' : 'bush',
        x,
        y,
        radius
      });
    }
    return obstacles;
  }

  // Generate Crates
  private generateCrates(): RoyaleCrate[] {
    const crates: RoyaleCrate[] = [];
    const count = 28;
    const lootPool = [
      'weapon_shotgun',
      'weapon_shotgun',
      'weapon_rifle',
      'weapon_rifle',
      'weapon_sniper',
      'medkit',
      'shield',
      'ammo',
      'ammo'
    ];

    for (let i = 0; i < count; i++) {
      const x = 250 + Math.random() * (MAP_SIZE - 500);
      const y = 250 + Math.random() * (MAP_SIZE - 500);
      const lootType = lootPool[Math.floor(Math.random() * lootPool.length)];

      crates.push({
        id: `crate_${i}`,
        x,
        y,
        hp: 45,
        maxHp: 45,
        lootType
      });
    }
    return crates;
  }

  // Destroy Room
  public destroyRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (room.timerInterval) clearInterval(room.timerInterval);
    if (room.tickInterval) clearInterval(room.tickInterval);

    this.rooms.delete(roomId);
    this.broadcastRoomsList();
  }

  // Public Room List info
  public getRoomsList() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      title: r.title,
      hostId: r.hostId,
      hostName: r.hostName,
      hostAvatar: r.hostAvatar,
      playerCount: r.players.length,
      capacity: r.capacity,
      buyIn: r.buyIn,
      pot: r.pot,
      status: r.status,
      isPrivate: false,
      createdAt: r.createdAt
    }));
  }

  public broadcastRoomsList() {
    this.io.emit('royale:rooms_list', this.getRoomsList());
    this.io.emit('active_tables_updated', this.getUnifiedTables());
  }

  // Unified tables for platform Active Tables list
  public getUnifiedTables() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      gameType: 'royale',
      title: r.title,
      hostId: r.hostId,
      hostName: r.hostName,
      hostAvatar: r.hostAvatar,
      playerCount: r.players.filter(p => !p.isBot).length,
      maxPlayers: r.capacity,
      botCount: r.players.filter(p => p.isBot).length,
      status: r.status === 'lobby' ? 'Lobi Bekliyor' : 'Oyunda',
      minBet: r.buyIn,
      maxBet: r.buyIn,
      minBalance: r.buyIn,
      isPrivate: false,
      createdAt: 'Bugün',
      updatedAt: Date.now()
    }));
  }

  // Public Room State for Lobby
  public getPublicRoomState(r: RoyaleRoom) {
    return {
      id: r.id,
      title: r.title,
      hostId: r.hostId,
      hostName: r.hostName,
      capacity: r.capacity,
      buyIn: r.buyIn,
      pot: r.pot,
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
        ready: p.ready
      }))
    };
  }

  // Public Full Game State for Canvas
  public getPublicGameState(r: RoyaleRoom) {
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      pot: r.pot,
      countdown: r.countdown,
      players: r.players.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        isHost: p.isHost,
        x: Number.isFinite(p.x) ? Math.round(p.x * 10) / 10 : MAP_SIZE / 2,
        y: Number.isFinite(p.y) ? Math.round(p.y * 10) / 10 : MAP_SIZE / 2,
        vx: Number.isFinite(p.vx) ? p.vx : 0,
        vy: Number.isFinite(p.vy) ? p.vy : 0,
        angle: Number.isFinite(p.angle) ? p.angle : 0,
        hp: p.hp,
        maxHp: p.maxHp,
        shield: p.shield,
        maxShield: p.maxShield,
        activeWeapon: p.activeWeapon,
        weapons: p.weapons,
        ammo: p.ammo,
        reserveAmmo: p.reserveAmmo,
        isReloading: p.isReloading,
        isAlive: p.isAlive,
        kills: p.kills,
        spectating: p.spectating
      })),
      bullets: r.bullets.map(b => ({
        id: b.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        color: b.color,
        radius: b.radius
      })),
      crates: r.crates.map(c => ({
        id: c.id,
        x: c.x,
        y: c.y,
        hp: c.hp,
        maxHp: c.maxHp
      })),
      loot: r.loot,
      obstacles: r.obstacles,
      zone: {
        currentX: Math.round(r.zone.currentX),
        currentY: Math.round(r.zone.currentY),
        currentRadius: Math.round(r.zone.currentRadius),
        targetX: Math.round(r.zone.targetX),
        targetY: Math.round(r.zone.targetY),
        targetRadius: Math.round(r.zone.targetRadius),
        isShrinking: r.zone.isShrinking,
        phase: r.zone.phase,
        damage: r.zone.damage
      },
      killfeed: r.killfeed,
      winner: r.winner
        ? {
            id: r.winner.id,
            userId: r.winner.userId,
            username: r.winner.username,
            kills: r.winner.kills
          }
        : null
    };
  }
}
