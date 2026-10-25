import { Server, Socket } from "socket.io";
import { 
  MAP_WIDTH, 
  MAP_HEIGHT, 
  TOTAL_PIXELS, 
  MapType, 
  generateTerrainMap 
} from "../utils/kapstorialMaps";

export interface KapstorialPlayer {
  id: number; // In-game player ID: 1, 2, ... N
  userId: number; // KapsApp user ID (negative for bots)
  socketId?: string;
  username: string;
  avatar: string | null;
  color: string;
  team: number; // 0 = FFA, 1..4 = Teams
  isBot: boolean;
  botDifficulty?: 'easy' | 'normal' | 'hard';
  isHost: boolean;
  isReady: boolean;
  isAlive: boolean;
  spawnPixel: number | null;
  troops: number;
  pixels: number;
  centroidX: number;
  centroidY: number;
  interestRate: number; // e.g. 0.07 down to 0.01
  attackPercentage: number; // Default 20%
  // Bot AI internal state
  botTimer?: number;
  botTargetId?: number | null;
}

export interface AttackWave {
  id: string;
  attackerId: number;
  targetId: number | 0; // 0 = Neutral land
  remainingTroops: number;
  frontierPixels: number[];
  visitedPixels: Set<number>;
}

export interface NavalBoat {
  id: string;
  ownerId: number;
  troops: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  targetPixel: number;
  vx: number;
  vy: number;
}

export interface FloatingEmoji {
  id: string;
  ownerId: number;
  emoji: string;
  x: number;
  y: number;
  createdAt: number;
  expiresAt: number;
}

export interface TruceAgreement {
  playerA: number;
  playerB: number;
  timestamp: number;
}

export interface KapstorialRoomState {
  roomCode: string;
  name: string;
  hostId: number; // KapsApp user ID
  status: 'waiting' | 'spawn_phase' | 'running' | 'game_over';
  mapType: MapType;
  gameMode: 'ffa' | 'teams_2' | 'teams_4';
  maxPlayers: number;
  botCount: number;
  botDifficulty: 'easy' | 'normal' | 'hard';
  buyIn: number;
  pot: number;
  // Terrain & Grid Matrices
  terrain: Uint8Array; // 0 = Ocean, 1 = Neutral Land, 2 = Mountain
  owners: Uint16Array; // 0 = Neutral, 1..N = Player ID
  totalConquerablePixels: number;
  // Game Entities
  players: KapstorialPlayer[];
  attackWaves: AttackWave[];
  boats: NavalBoat[];
  emojis: FloatingEmoji[];
  truces: Set<string>; // "${min(A,B)}_${max(A,B)}"
  pendingTruceOffers: Map<number, Set<number>>; // TargetPlayerId -> Set of Offerers
  // Loops & Timers
  tickCount: number;
  spawnCountdownRemaining: number;
  incomeCycleProgress: number; // 0..100%
  gameTimerInterval?: NodeJS.Timeout;
  spawnTimerInterval?: NodeJS.Timeout;
  winnerPlayerId?: number | null;
  winnerTeam?: number | null;
  winnerReason?: string | null;
  lastDeltaChanges: number[]; // Flat array [pixelIdx, ownerId, ...]
  createdAt: number;
}

export const PLAYER_COLORS = [
  '#ef4444', // Crimson Red
  '#3b82f6', // Royal Blue
  '#10b981', // Emerald Green
  '#8b5cf6', // Electric Purple
  '#f59e0b', // Sun Gold
  '#06b6d4', // Cyan
  '#ec4899', // Hot Pink
  '#f97316', // Sunset Orange
  '#14b8a6', // Teal
  '#a855f7', // Violet
  '#84cc16', // Lime
  '#e11d48', // Rose
  '#6366f1', // Indigo
  '#d97706', // Amber
  '#0284c7', // Sky Blue
  '#4ade80'  // Light Mint
];

export class KapstorialManager {
  private io: Server;
  private client: any;
  public rooms: Map<string, KapstorialRoomState> = new Map();

  constructor(io: Server, client: any) {
    this.io = io;
    this.client = client;
  }

  public getActiveRoomsList() {
    const list: any[] = [];
    this.rooms.forEach((r) => {
      const humanCount = r.players.filter((p) => !p.isBot).length;
      const host = r.players.find((p) => p.userId === r.hostId) || r.players[0];
      list.push({
        roomCode: r.roomCode,
        name: r.name,
        hostName: host ? host.username : 'Masa Yöneticisi',
        hostAvatar: host ? host.avatar : null,
        playerCount: humanCount,
        maxPlayers: r.maxPlayers,
        botCount: r.botCount,
        mapType: r.mapType,
        gameMode: r.gameMode,
        buyIn: r.buyIn,
        pot: r.pot,
        status: r.status === 'running' ? 'Oyunda' : (r.status === 'spawn_phase' ? 'Konum Seçimi' : (r.status === 'game_over' ? 'Bitti' : 'Lobi Bekliyor'))
      });
    });
    return list;
  }

  public getUnifiedTables(): any[] {
    const list: any[] = [];
    this.rooms.forEach((r) => {
      const humanPlayers = r.players.filter((p) => !p.isBot);
      const host = r.players.find((p) => p.userId === r.hostId) || humanPlayers[0];
      list.push({
        id: r.roomCode,
        gameType: "kapstorial",
        title: r.name || `Kapstorial ${r.roomCode}`,
        hostId: r.hostId,
        hostName: host ? host.username : "Masa Yöneticisi",
        hostAvatar: host ? host.avatar : null,
        playerCount: Math.max(1, humanPlayers.length),
        maxPlayers: r.maxPlayers,
        botCount: r.botCount,
        status: r.status === 'running' || r.status === 'spawn_phase' ? 'Oyunda' : 'Lobi Bekliyor',
        minBet: r.buyIn,
        maxBet: r.buyIn,
        isPrivate: false,
        gameMode: r.mapType,
        createdAt: 'Bugün',
        updatedAt: Date.now()
      });
    });
    return list;
  }

  private broadcastRooms() {
    this.io.emit("kapstorial:rooms_list", this.getActiveRoomsList());
    this.io.emit("active_tables_updated", this.getUnifiedTables());
  }

  private broadcastRoom(room: KapstorialRoomState) {
    this.io.to(`kapstorial:${room.roomCode}`).emit("kapstorial:room_state", this.getPublicRoomState(room));
    this.broadcastRooms();
  }

  public getPublicRoomState(room: KapstorialRoomState) {
    return {
      roomCode: room.roomCode,
      name: room.name,
      hostId: room.hostId,
      status: room.status,
      mapType: room.mapType,
      gameMode: room.gameMode,
      maxPlayers: room.maxPlayers,
      botCount: room.botCount,
      botDifficulty: room.botDifficulty,
      buyIn: room.buyIn,
      pot: room.pot,
      totalConquerablePixels: room.totalConquerablePixels,
      spawnCountdownRemaining: room.spawnCountdownRemaining,
      incomeCycleProgress: room.incomeCycleProgress,
      winnerPlayerId: room.winnerPlayerId,
      winnerTeam: room.winnerTeam,
      winnerReason: room.winnerReason,
      players: room.players.map((p) => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        team: p.team,
        isBot: p.isBot,
        botDifficulty: p.botDifficulty,
        isHost: p.isHost,
        isReady: p.isReady,
        isAlive: p.isAlive,
        troops: p.troops,
        pixels: p.pixels,
        percentageLand: room.totalConquerablePixels > 0 ? (p.pixels / room.totalConquerablePixels) * 100 : 0,
        centroidX: p.centroidX,
        centroidY: p.centroidY,
        interestRate: p.interestRate,
        attackPercentage: p.attackPercentage,
        spawnPixel: p.spawnPixel
      })),
      truces: Array.from(room.truces)
    };
  }

  public createRoom(
    user: { id: number; username: string; avatar: string | null; color?: string },
    options: {
      name?: string;
      mapType?: MapType;
      gameMode?: 'ffa' | 'teams_2' | 'teams_4';
      maxPlayers?: number;
      botCount?: number;
      botDifficulty?: 'easy' | 'normal' | 'hard';
      buyIn?: number;
    }
  ): KapstorialRoomState {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const mapType = options.mapType || 'world';
    const terrain = generateTerrainMap(mapType);
    const owners = new Uint16Array(TOTAL_PIXELS);

    let totalConquerablePixels = 0;
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      if (terrain[i] === 1) totalConquerablePixels++;
    }

    const hostColor = user.color && user.color.startsWith('#') ? user.color : PLAYER_COLORS[0];

    const hostPlayer: KapstorialPlayer = {
      id: 1,
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      color: hostColor,
      team: options.gameMode === 'teams_2' ? 1 : (options.gameMode === 'teams_4' ? 1 : 0),
      isBot: false,
      isHost: true,
      isReady: true,
      isAlive: true,
      spawnPixel: null,
      troops: 500,
      pixels: 0,
      centroidX: MAP_WIDTH / 2,
      centroidY: MAP_HEIGHT / 2,
      interestRate: 0.07,
      attackPercentage: 20
    };

    const room: KapstorialRoomState = {
      roomCode,
      name: options.name || `${user.username}'ın Kapstorial Masası`,
      hostId: user.id,
      status: 'waiting',
      mapType,
      gameMode: options.gameMode || 'ffa',
      maxPlayers: Math.max(2, Math.min(16, Number(options.maxPlayers) || 8)),
      botCount: Math.max(0, Math.min(60, Number(options.botCount) || 12)),
      botDifficulty: options.botDifficulty || 'normal',
      buyIn: Math.max(0, Number(options.buyIn) || 0),
      pot: Math.max(0, Number(options.buyIn) || 0),
      terrain,
      owners,
      totalConquerablePixels,
      players: [hostPlayer],
      attackWaves: [],
      boats: [],
      emojis: [],
      truces: new Set(),
      pendingTruceOffers: new Map(),
      tickCount: 0,
      spawnCountdownRemaining: 10,
      incomeCycleProgress: 0,
      lastDeltaChanges: [],
      createdAt: Date.now()
    };

    this.rooms.set(roomCode, room);
    this.broadcastRooms();
    return room;
  }

  public joinRoom(
    roomCode: string,
    user: { id: number; username: string; avatar: string | null; color?: string; socketId?: string }
  ) {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: "Masa bulunamadı." };

    if (room.status !== 'waiting') {
      return { success: false, error: "Oyun zaten başlamış durumda!" };
    }

    const humanCount = room.players.filter((p) => !p.isBot).length;
    if (humanCount >= room.maxPlayers) {
      return { success: false, error: "Masa maksimum oyuncu kapasitesine ulaştı." };
    }

    // Check if player already in room
    let player = room.players.find((p) => p.userId === user.id);
    if (player) {
      player.socketId = user.socketId;
      return { success: true, room };
    }

    // Pick unused color
    const usedColors = new Set(room.players.map((p) => p.color.toLowerCase()));
    let assignedColor = PLAYER_COLORS.find((c) => !usedColors.has(c.toLowerCase())) || PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];

    const nextId = room.players.length + 1;
    let assignedTeam = 0;
    if (room.gameMode === 'teams_2') {
      const t1 = room.players.filter((p) => p.team === 1).length;
      const t2 = room.players.filter((p) => p.team === 2).length;
      assignedTeam = t1 <= t2 ? 1 : 2;
    } else if (room.gameMode === 'teams_4') {
      assignedTeam = (room.players.length % 4) + 1;
    }

    player = {
      id: nextId,
      userId: user.id,
      socketId: user.socketId,
      username: user.username,
      avatar: user.avatar,
      color: assignedColor,
      team: assignedTeam,
      isBot: false,
      isHost: false,
      isReady: false,
      isAlive: true,
      spawnPixel: null,
      troops: 500,
      pixels: 0,
      centroidX: MAP_WIDTH / 2,
      centroidY: MAP_HEIGHT / 2,
      interestRate: 0.07,
      attackPercentage: 20
    };

    room.players.push(player);
    if (room.buyIn > 0) {
      room.pot += room.buyIn;
    }

    this.broadcastRoom(room);
    return { success: true, room };
  }

  public leaveRoom(roomCode: string, userId: number) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const pIdx = room.players.findIndex((p) => p.userId === userId);
    if (pIdx === -1) return;

    const leavingPlayer = room.players[pIdx];

    if (room.status === 'waiting') {
      // If host leaves, pass host or delete room
      if (leavingPlayer.isHost) {
        room.players.splice(pIdx, 1);
        const nextHuman = room.players.find((p) => !p.isBot);
        if (nextHuman) {
          nextHuman.isHost = true;
          room.hostId = nextHuman.userId;
          this.broadcastRoom(room);
        } else {
          this.destroyRoom(roomCode);
        }
      } else {
        room.players.splice(pIdx, 1);
        this.broadcastRoom(room);
      }
    } else {
      // Mid game exit: eliminate player, turn their pixels neutral
      leavingPlayer.isAlive = false;
      leavingPlayer.troops = 0;
      for (let i = 0; i < TOTAL_PIXELS; i++) {
        if (room.owners[i] === leavingPlayer.id) {
          room.owners[i] = 0; // Back to neutral
          room.lastDeltaChanges.push(i, 0);
        }
      }
      leavingPlayer.pixels = 0;

      // Check if all humans left
      const remainingHumans = room.players.filter((p) => !p.isBot && p.isAlive);
      if (remainingHumans.length === 0) {
        this.destroyRoom(roomCode);
        return;
      }
      this.broadcastRoom(room);
    }
  }

  public destroyRoom(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    if (room.gameTimerInterval) clearInterval(room.gameTimerInterval);
    if (room.spawnTimerInterval) clearInterval(room.spawnTimerInterval);

    this.rooms.delete(roomCode);
    this.broadcastRooms();
  }

  /**
   * Starts the 10-second Spawn Phase
   */
  public startSpawnPhase(roomCode: string, userId: number) {
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== 'waiting') return { success: false, error: "Oyun başlatılamaz." };

    if (room.hostId !== userId) {
      return { success: false, error: "Yalnızca masa kurucusu oyunu başlatabilir." };
    }

    // Deduct buy-in chips if wager is set
    if (room.buyIn > 0 && this.client) {
      const humans = room.players.filter((p) => !p.isBot);
      for (const h of humans) {
        this.client.execute({
          sql: "UPDATE users SET chips = MAX(0, COALESCE(chips, 1000) - ?) WHERE id = ?",
          args: [room.buyIn, h.userId]
        }).catch(() => {});
      }
    }

    // Populate configured bots into player array
    const botNames = [
      "Fatih Sultan Bot", "Barbaros Bot", "İskender Bot", "Sezar Bot", 
      "Napoleon Bot", "Cengiz Bot", "Attila Bot", "Bismarck Bot", 
      "Süleyman Bot", "Kürşad Bot", "Alparslan Bot", "Tuğrul Bot",
      "Hannibal Bot", "Saladin Bot", "Ragnar Bot", "Leonidas Bot",
      "Gökbörü Bot", "Yavuz Bot", "Kanuni Bot", "Metehan Bot",
      "Yıldırım Bot", "Kılıçarslan Bot", "Aksungur Bot", "Selçuk Bot"
    ];

    const currentHumanCount = room.players.length;
    for (let i = 0; i < room.botCount; i++) {
      const bId = currentHumanCount + i + 1;
      const bColor = PLAYER_COLORS[bId % PLAYER_COLORS.length];
      const botName = botNames[i % botNames.length] + (i >= botNames.length ? ` #${Math.floor(i / botNames.length) + 1}` : "");
      
      let botTeam = 0;
      if (room.gameMode === 'teams_2') {
        botTeam = (i % 2) + 1;
      } else if (room.gameMode === 'teams_4') {
        botTeam = (i % 4) + 1;
      }

      room.players.push({
        id: bId,
        userId: -bId,
        username: botName,
        avatar: null,
        color: bColor,
        team: botTeam,
        isBot: true,
        botDifficulty: room.botDifficulty,
        isHost: false,
        isReady: true,
        isAlive: true,
        spawnPixel: null,
        troops: 500,
        pixels: 0,
        centroidX: MAP_WIDTH / 2,
        centroidY: MAP_HEIGHT / 2,
        interestRate: 0.07,
        attackPercentage: 25,
        botTimer: Math.floor(Math.random() * 20)
      });
    }

    room.status = 'spawn_phase';
    room.spawnCountdownRemaining = 10;
    this.broadcastRoom(room);

    // 10s countdown timer
    room.spawnTimerInterval = setInterval(() => {
      room.spawnCountdownRemaining -= 1;
      this.io.to(`kapstorial:${room.roomCode}`).emit("kapstorial:spawn_countdown", {
        remaining: room.spawnCountdownRemaining
      });

      if (room.spawnCountdownRemaining <= 0) {
        if (room.spawnTimerInterval) clearInterval(room.spawnTimerInterval);
        this.finishSpawnPhaseAndStartGame(room);
      }
    }, 1000);

    return { success: true };
  }

  /**
   * Finalizes spawn locations and seeds the initial 12-pixel circular territories
   */
  private finishSpawnPhaseAndStartGame(room: KapstorialRoomState) {
    // Find all valid neutral land pixels
    const validLandPixels: number[] = [];
    for (let i = 0; i < TOTAL_PIXELS; i++) {
      if (room.terrain[i] === 1) {
        validLandPixels.push(i);
      }
    }

    if (validLandPixels.length === 0) {
      return;
    }

    // Seed spawn for unselected players and all bots
    const chosenPositions: Array<{ x: number; y: number }> = [];

    // Collect already picked human positions
    for (const p of room.players) {
      if (p.spawnPixel !== null && room.terrain[p.spawnPixel] === 1) {
        const sx = p.spawnPixel % MAP_WIDTH;
        const sy = Math.floor(p.spawnPixel / MAP_WIDTH);
        chosenPositions.push({ x: sx, y: sy });
      }
    }

    // For any player/bot without spawn, find a spot well-spaced from others
    for (const p of room.players) {
      if (p.spawnPixel === null || room.terrain[p.spawnPixel] !== 1) {
        let bestPixel = validLandPixels[Math.floor(Math.random() * validLandPixels.length)];
        let maxMinDist = -1;

        // Try 25 random samples to maximize distance from neighbors
        for (let attempt = 0; attempt < 25; attempt++) {
          const cand = validLandPixels[Math.floor(Math.random() * validLandPixels.length)];
          const cx = cand % MAP_WIDTH;
          const cy = Math.floor(cand / MAP_WIDTH);

          let minDist = 999999;
          for (const pos of chosenPositions) {
            const d = Math.hypot(cx - pos.x, cy - pos.y);
            if (d < minDist) minDist = d;
          }

          if (minDist > maxMinDist) {
            maxMinDist = minDist;
            bestPixel = cand;
          }
        }

        p.spawnPixel = bestPixel;
        const bx = bestPixel % MAP_WIDTH;
        const by = Math.floor(bestPixel / MAP_WIDTH);
        chosenPositions.push({ x: bx, y: by });
      }
    }

    // Now seed each player with ~12 pixels in a small circle around their spawn
    const seedRadius = 2.2;
    for (const p of room.players) {
      if (p.spawnPixel === null) continue;
      const cx = p.spawnPixel % MAP_WIDTH;
      const cy = Math.floor(p.spawnPixel / MAP_WIDTH);
      let pixelCount = 0;

      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const px = cx + dx;
          const py = cy + dy;
          if (px >= 0 && px < MAP_WIDTH && py >= 0 && py < MAP_HEIGHT) {
            const dist = Math.hypot(dx, dy);
            if (dist <= seedRadius) {
              const idx = py * MAP_WIDTH + px;
              if (room.terrain[idx] === 1 && (room.owners[idx] === 0 || room.owners[idx] === p.id)) {
                room.owners[idx] = p.id;
                pixelCount++;
              }
            }
          }
        }
      }

      p.pixels = Math.max(1, pixelCount);
      p.troops = 500;
      p.centroidX = cx;
      p.centroidY = cy;
      p.isAlive = true;
    }

    room.status = 'running';
    room.tickCount = 0;
    room.incomeCycleProgress = 0;

    // Send complete initial terrain & owners map once to clients
    this.io.to(`kapstorial:${room.roomCode}`).emit("kapstorial:game_start", {
      room: this.getPublicRoomState(room),
      terrain: Array.from(room.terrain),
      owners: Array.from(room.owners)
    });

    // Start 100ms server tick loop
    this.startGameLoop(room);
  }

  /**
   * Main 100ms Authoritative Game Engine Loop
   */
  private startGameLoop(room: KapstorialRoomState) {
    if (room.gameTimerInterval) clearInterval(room.gameTimerInterval);

    room.gameTimerInterval = setInterval(() => {
      this.tick(room);
    }, 100);
  }

  private tick(room: KapstorialRoomState) {
    if (room.status !== 'running') return;

    room.tickCount++;
    room.lastDeltaChanges = [];

    // 1. Economic Cycles
    // A. Interest every 5 ticks (0.5s)
    if (room.tickCount % 5 === 0) {
      for (const p of room.players) {
        if (!p.isAlive) continue;

        // Interest Rate decays over time from ~7% to 1%
        const timeDecay = Math.max(0.01, 0.07 - (room.tickCount / (10 * 300)) * 0.06);
        p.interestRate = timeDecay;

        // Soft Cap: pixels * 100
        // Hard Cap: pixels * 150
        const softCap = p.pixels * 100;
        const hardCap = p.pixels * 150;

        if (p.troops < softCap) {
          p.troops += Math.round(p.troops * p.interestRate);
        } else if (p.troops < hardCap) {
          // Diminishing interest near hard cap
          const ratio = (hardCap - p.troops) / (hardCap - softCap);
          p.troops += Math.round(p.troops * p.interestRate * ratio * 0.4);
        }
      }
    }

    // B. Land Income every 50 ticks (5.0s)
    const incomeTick = room.tickCount % 50;
    room.incomeCycleProgress = Math.round((incomeTick / 50) * 100);

    if (incomeTick === 0) {
      for (const p of room.players) {
        if (!p.isAlive) continue;
        p.troops += p.pixels; // +1 troop per 1 pixel of land
      }
    }

    // 2. Advance Active Attack Waves (BFS/Frontier expansion)
    this.processAttackWaves(room);

    // 3. Advance Active Naval Boats
    this.processNavalBoats(room);

    // 4. Run Bot AI Decisions
    this.processBotAI(room);

    // 5. Update Territory Centroids & Player Stats
    if (room.tickCount % 10 === 0) {
      this.updateCentroidsAndPixelCounts(room);
      this.checkVictoryCondition(room);
    }

    // 6. Broadcast Tick Deltas to Room
    this.io.to(`kapstorial:${room.roomCode}`).emit("kapstorial:tick", {
      tick: room.tickCount,
      incomeCycleProgress: room.incomeCycleProgress,
      deltas: room.lastDeltaChanges,
      players: room.players.map((p) => ({
        id: p.id,
        troops: p.troops,
        pixels: p.pixels,
        isAlive: p.isAlive,
        interestRate: p.interestRate,
        centroidX: p.centroidX,
        centroidY: p.centroidY
      })),
      boats: room.boats.map((b) => ({
        id: b.id,
        ownerId: b.ownerId,
        troops: b.troops,
        x: Math.round(b.x * 10) / 10,
        y: Math.round(b.y * 10) / 10,
        targetX: b.targetX,
        targetY: b.targetY
      })),
      emojis: room.emojis.filter((e) => e.expiresAt > Date.now())
    });
  }

  /**
   * Processes active attack waves across borders using BFS Frontier
   */
  private processAttackWaves(room: KapstorialRoomState) {
    if (room.attackWaves.length === 0) return;

    const remainingWaves: AttackWave[] = [];

    for (const wave of room.attackWaves) {
      const attacker = room.players.find((p) => p.id === wave.attackerId);
      if (!attacker || !attacker.isAlive || wave.remainingTroops <= 2 || wave.frontierPixels.length === 0) {
        continue;
      }

      const nextFrontier: number[] = [];
      const expansionBatchSize = Math.max(4, Math.min(25, Math.ceil(wave.remainingTroops * 0.08)));
      let expansionsDone = 0;

      // Shuffle or sort frontier for organic expansion
      for (const curPixel of wave.frontierPixels) {
        if (expansionsDone >= expansionBatchSize || wave.remainingTroops <= 2) break;

        const cx = curPixel % MAP_WIDTH;
        const cy = Math.floor(curPixel / MAP_WIDTH);

        // 4-way neighbors
        const neighbors = [
          { x: cx, y: cy - 1 },
          { x: cx, y: cy + 1 },
          { x: cx - 1, y: cy },
          { x: cx + 1, y: cy }
        ];

        for (const n of neighbors) {
          if (n.x < 0 || n.x >= MAP_WIDTH || n.y < 0 || n.y >= MAP_HEIGHT) continue;
          const nIdx = n.y * MAP_WIDTH + n.x;

          if (room.terrain[nIdx] !== 1) continue; // Only conquerable land (no water, no mountains)
          if (wave.visitedPixels.has(nIdx)) continue;
          wave.visitedPixels.add(nIdx);

          const curOwner = room.owners[nIdx];
          if (curOwner === wave.attackerId) continue; // Already owned by attacker

          // Check if target matches (Neutral 0 or specific enemy)
          if (wave.targetId === 0 && curOwner !== 0) continue; // Only attacking neutral
          if (wave.targetId !== 0 && curOwner !== wave.targetId) continue; // Only attacking targeted enemy

          // Check Truce / Team Friendly Fire
          if (curOwner !== 0) {
            const defender = room.players.find((p) => p.id === curOwner);
            if (defender) {
              if (attacker.team > 0 && attacker.team === defender.team) continue; // No friendly fire in teams
              const truceKey = `${Math.min(attacker.id, defender.id)}_${Math.max(attacker.id, defender.id)}`;
              if (room.truces.has(truceKey)) {
                // Attacking an ally breaks truce!
                room.truces.delete(truceKey);
                this.io.to(`kapstorial:${room.roomCode}`).emit("kapstorial:truce_broken", {
                  attackerId: attacker.id,
                  defenderId: defender.id
                });
              }
            }
          }

          // Combat resolution:
          if (curOwner === 0) {
            // Neutral Land: 2 troops per pixel
            const cost = 2;
            if (wave.remainingTroops >= cost) {
              wave.remainingTroops -= cost;
              room.owners[nIdx] = wave.attackerId;
              room.lastDeltaChanges.push(nIdx, wave.attackerId);
              attacker.pixels++;
              nextFrontier.push(nIdx);
              expansionsDone++;
            }
          } else {
            // Enemy Land: Base cost + density
            const defender = room.players.find((p) => p.id === curOwner);
            if (defender && defender.isAlive) {
              const defDensity = defender.pixels > 0 ? (defender.troops / defender.pixels) : 1;
              const attackCost = Math.max(3, Math.round(2 + defDensity * 1.8));
              const defDamage = Math.max(2, Math.round(1 + defDensity * 1.2));

              if (wave.remainingTroops >= attackCost) {
                wave.remainingTroops -= attackCost;
                defender.troops = Math.max(0, defender.troops - defDamage);
                room.owners[nIdx] = wave.attackerId;
                room.lastDeltaChanges.push(nIdx, wave.attackerId);
                attacker.pixels++;
                defender.pixels = Math.max(0, defender.pixels - 1);
                nextFrontier.push(nIdx);
                expansionsDone++;

                if (defender.pixels <= 0) {
                  defender.isAlive = false;
                  defender.troops = 0;
                  this.io.to(`kapstorial:${room.roomCode}`).emit("kapstorial:player_eliminated", {
                    victimId: defender.id,
                    killerId: attacker.id
                  });
                }
              } else {
                // Wave exhausted against defender armor
                wave.remainingTroops = 0;
                break;
              }
            }
          }
        }
      }

      if (wave.remainingTroops > 2 && (nextFrontier.length > 0 || wave.frontierPixels.length > 0)) {
        wave.frontierPixels = nextFrontier.length > 0 ? nextFrontier : wave.frontierPixels;
        remainingWaves.push(wave);
      }
    }

    room.attackWaves = remainingWaves;
  }

  /**
   * Processes naval landing craft gliding across ocean water
   */
  private processNavalBoats(room: KapstorialRoomState) {
    if (room.boats.length === 0) return;

    const remainingBoats: NavalBoat[] = [];

    for (const boat of room.boats) {
      boat.x += boat.vx;
      boat.y += boat.vy;

      const curX = Math.round(boat.x);
      const curY = Math.round(boat.y);

      // Check distance to target
      const distToTarget = Math.hypot(boat.x - boat.targetX, boat.y - boat.targetY);

      if (distToTarget <= 3 || curX < 0 || curX >= MAP_WIDTH || curY < 0 || curY >= MAP_HEIGHT) {
        // Boat reaches coast or target: Naval Landing Beachhead!
        const landPixel = Math.max(0, Math.min(TOTAL_PIXELS - 1, boat.targetPixel));
        const attacker = room.players.find((p) => p.id === boat.ownerId);

        if (attacker && attacker.isAlive && room.terrain[landPixel] === 1) {
          // Convert beachhead pixel
          room.owners[landPixel] = attacker.id;
          room.lastDeltaChanges.push(landPixel, attacker.id);
          attacker.pixels++;

          // Spawn an attack wave right from beachhead
          room.attackWaves.push({
            id: `wave_naval_${Date.now()}_${Math.random()}`,
            attackerId: attacker.id,
            targetId: 0, // Expand into surrounding land
            remainingTroops: boat.troops,
            frontierPixels: [landPixel],
            visitedPixels: new Set([landPixel])
          });
        }
      } else {
        remainingBoats.push(boat);
      }
    }

    room.boats = remainingBoats;
  }

  /**
   * Smart Bot AI Engine
   */
  private processBotAI(room: KapstorialRoomState) {
    for (const bot of room.players) {
      if (!bot.isBot || !bot.isAlive) continue;

      bot.botTimer = (bot.botTimer || 0) + 1;

      // Decision interval: Easy = every 4s, Normal = every 2.5s, Hard = every 1.5s
      const interval = bot.botDifficulty === 'easy' ? 40 : (bot.botDifficulty === 'hard' ? 15 : 25);
      if (bot.botTimer % interval !== 0) continue;

      // Early Game: If neutral territory is abundant, expand into empty land
      const neutralAdjacent = this.findBorderPixelsAdjacentTo(room, bot.id, 0);

      if (neutralAdjacent.length > 0) {
        // Expand into neutral
        const pct = bot.botDifficulty === 'hard' ? 0.35 : (bot.botDifficulty === 'easy' ? 0.18 : 0.25);
        const sentTroops = Math.round(bot.troops * pct);
        if (sentTroops > 10) {
          bot.troops -= sentTroops;
          room.attackWaves.push({
            id: `bot_wave_${bot.id}_${Date.now()}`,
            attackerId: bot.id,
            targetId: 0,
            remainingTroops: sentTroops,
            frontierPixels: neutralAdjacent.slice(0, 30),
            visitedPixels: new Set(neutralAdjacent)
          });
        }
      } else {
        // Mid / Late Game: Find adjacent enemy borders
        const enemyNeighbors = this.findEnemyNeighbors(room, bot.id);
        if (enemyNeighbors.length === 0) continue;

        // Hard bot: Crown targeting (if leader owns > 35% of land, target leader!)
        const leader = [...room.players]
          .filter((p) => p.isAlive && p.id !== bot.id && (bot.team === 0 || p.team !== bot.team))
          .sort((a, b) => b.pixels - a.pixels)[0];

        let targetEnemy = enemyNeighbors[0];
        if (bot.botDifficulty === 'hard' && leader && leader.pixels / room.totalConquerablePixels > 0.35) {
          const leaderNeighbor = enemyNeighbors.find((n) => n.targetId === leader.id);
          if (leaderNeighbor) targetEnemy = leaderNeighbor;
        }

        // Weakness targeting: prioritize neighbors with fewer troops
        if (!targetEnemy) {
          enemyNeighbors.sort((a, b) => {
            const defA = room.players.find((p) => p.id === a.targetId)?.troops || 0;
            const defB = room.players.find((p) => p.id === b.targetId)?.troops || 0;
            return defA - defB;
          });
          targetEnemy = enemyNeighbors[0];
        }

        if (targetEnemy) {
          const defender = room.players.find((p) => p.id === targetEnemy.targetId);
          if (defender && defender.isAlive) {
            // Check Truce
            const truceKey = `${Math.min(bot.id, defender.id)}_${Math.max(bot.id, defender.id)}`;
            if (room.truces.has(truceKey) && bot.botDifficulty !== 'hard') {
              continue; // Respect truce
            }

            // Only attack if bot has reasonable balance
            if (bot.troops > defender.troops * 0.45 || bot.botDifficulty === 'hard') {
              const attackPct = bot.botDifficulty === 'hard' ? 0.45 : 0.30;
              const sentTroops = Math.round(bot.troops * attackPct);
              if (sentTroops > 20) {
                bot.troops -= sentTroops;
                room.attackWaves.push({
                  id: `bot_atk_${bot.id}_${Date.now()}`,
                  attackerId: bot.id,
                  targetId: defender.id,
                  remainingTroops: sentTroops,
                  frontierPixels: targetEnemy.borderPixels.slice(0, 35),
                  visitedPixels: new Set(targetEnemy.borderPixels)
                });
              }
            }
          }
        }
      }
    }
  }

  private findBorderPixelsAdjacentTo(room: KapstorialRoomState, ownerId: number, targetOwnerId: number): number[] {
    const borders: number[] = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        const idx = y * MAP_WIDTH + x;
        if (room.owners[idx] === ownerId) {
          // Check 4 neighbors
          const up = (y - 1) * MAP_WIDTH + x;
          const down = (y + 1) * MAP_WIDTH + x;
          const left = y * MAP_WIDTH + (x - 1);
          const right = y * MAP_WIDTH + (x + 1);

          if (
            (room.owners[up] === targetOwnerId && room.terrain[up] === 1) ||
            (room.owners[down] === targetOwnerId && room.terrain[down] === 1) ||
            (room.owners[left] === targetOwnerId && room.terrain[left] === 1) ||
            (room.owners[right] === targetOwnerId && room.terrain[right] === 1)
          ) {
            borders.push(idx);
          }
        }
      }
    }
    return borders;
  }

  private findEnemyNeighbors(room: KapstorialRoomState, botId: number): Array<{ targetId: number; borderPixels: number[] }> {
    const neighborMap = new Map<number, number[]>();

    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        const idx = y * MAP_WIDTH + x;
        if (room.owners[idx] === botId) {
          const adj = [
            (y - 1) * MAP_WIDTH + x,
            (y + 1) * MAP_WIDTH + x,
            y * MAP_WIDTH + (x - 1),
            y * MAP_WIDTH + (x + 1)
          ];
          for (const a of adj) {
            const o = room.owners[a];
            if (o > 0 && o !== botId && room.terrain[a] === 1) {
              if (!neighborMap.has(o)) neighborMap.set(o, []);
              neighborMap.get(o)!.push(idx);
            }
          }
        }
      }
    }

    const res: Array<{ targetId: number; borderPixels: number[] }> = [];
    neighborMap.forEach((borderPixels, targetId) => {
      res.push({ targetId, borderPixels });
    });
    return res;
  }

  /**
   * Recalculates centroids and exact pixel counts
   */
  private updateCentroidsAndPixelCounts(room: KapstorialRoomState) {
    const pixelCounts = new Map<number, number>();
    const sumX = new Map<number, number>();
    const sumY = new Map<number, number>();

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const o = room.owners[y * MAP_WIDTH + x];
        if (o > 0) {
          pixelCounts.set(o, (pixelCounts.get(o) || 0) + 1);
          sumX.set(o, (sumX.get(o) || 0) + x);
          sumY.set(o, (sumY.get(o) || 0) + y);
        }
      }
    }

    for (const p of room.players) {
      const cnt = pixelCounts.get(p.id) || 0;
      p.pixels = cnt;
      if (cnt > 0) {
        p.centroidX = Math.round(sumX.get(p.id)! / cnt);
        p.centroidY = Math.round(sumY.get(p.id)! / cnt);
      } else if (room.status === 'running') {
        p.isAlive = false;
        p.troops = 0;
      }
    }
  }

  /**
   * Checks for 85% territory victory or elimination of all opponents
   */
  private checkVictoryCondition(room: KapstorialRoomState) {
    if (room.status !== 'running') return;

    const alivePlayers = room.players.filter((p) => p.isAlive);

    // FFA Victory Check
    if (room.gameMode === 'ffa') {
      if (alivePlayers.length === 1) {
        this.declareWinner(room, alivePlayers[0].id, null, `${alivePlayers[0].username} tüm rakiplerini eledi ve haritayı fethetti! 🏆`);
        return;
      }

      for (const p of alivePlayers) {
        const pct = room.totalConquerablePixels > 0 ? (p.pixels / room.totalConquerablePixels) : 0;
        if (pct >= 0.85) {
          this.declareWinner(room, p.id, null, `${p.username} haritanın %85'inden fazlasını kontrol ederek ezici bir zafer kazandı! 👑`);
          return;
        }
      }
    } else {
      // Teams Victory Check
      const aliveTeams = new Set(alivePlayers.map((p) => p.team));
      if (aliveTeams.size === 1) {
        const winningTeam = Array.from(aliveTeams)[0];
        this.declareWinner(room, null, winningTeam, `${winningTeam}. Takım tüm düşmanları alt etti ve savaşı kazandı! 🏆`);
        return;
      }
    }
  }

  private declareWinner(room: KapstorialRoomState, winnerPlayerId: number | null, winnerTeam: number | null, reason: string) {
    room.status = 'game_over';
    room.winnerPlayerId = winnerPlayerId;
    room.winnerTeam = winnerTeam;
    room.winnerReason = reason;

    if (room.gameTimerInterval) clearInterval(room.gameTimerInterval);

    // Award Pot to Winner
    if (room.pot > 0 && this.client) {
      if (winnerPlayerId) {
        const w = room.players.find((p) => p.id === winnerPlayerId);
        if (w && !w.isBot) {
          this.client.execute({
            sql: "UPDATE users SET chips = COALESCE(chips, 1000) + ?, kapstorial_wins = COALESCE(kapstorial_wins, 0) + 1 WHERE id = ?",
            args: [room.pot, w.userId]
          }).catch(() => {});
        }
      } else if (winnerTeam) {
        const teamHumans = room.players.filter((p) => !p.isBot && p.team === winnerTeam);
        if (teamHumans.length > 0) {
          const split = Math.floor(room.pot / teamHumans.length);
          for (const th of teamHumans) {
            this.client.execute({
              sql: "UPDATE users SET chips = COALESCE(chips, 1000) + ?, kapstorial_wins = COALESCE(kapstorial_wins, 0) + 1 WHERE id = ?",
              args: [split, th.userId]
            }).catch(() => {});
          }
        }
      }
    }

    this.broadcastRoom(room);
    this.io.to(`kapstorial:${room.roomCode}`).emit("kapstorial:game_over", {
      winnerPlayerId,
      winnerTeam,
      reason,
      pot: room.pot
    });
  }

  // ==========================================
  // SOCKET INTERACTION HANDLERS
  // ==========================================

  public handleSocketEvents(socket: Socket, user: any) {
    const userIdNum = Number(user.id);

    // 1. Get Room List
    socket.on("kapstorial:get_rooms", (cb?: (rooms: any[]) => void) => {
      const rooms = this.getActiveRoomsList();
      if (cb) cb(rooms);
    });

    // 2. Create Room
    socket.on("kapstorial:create_room", (options: any, cb?: (res: any) => void) => {
      try {
        const u = {
          id: userIdNum,
          username: user.username || "Oyuncu",
          avatar: user.avatar || null,
          color: user.color || PLAYER_COLORS[0]
        };
        const room = this.createRoom(u, options || {});
        socket.join(`kapstorial:${room.roomCode}`);
        socket.data.currentKapstorialRoom = room.roomCode;
        if (cb) cb({ success: true, room: this.getPublicRoomState(room) });
      } catch (err: any) {
        if (cb) cb({ success: false, error: err.message || "Oda oluşturulamadı." });
      }
    });

    // 3. Join Room
    socket.on("kapstorial:join_room", (data: { roomCode: string }, cb?: (res: any) => void) => {
      try {
        const u = {
          id: userIdNum,
          username: user.username || "Oyuncu",
          avatar: user.avatar || null,
          color: user.color || PLAYER_COLORS[0],
          socketId: socket.id
        };
        const res = this.joinRoom(data.roomCode, u);
        if (res.success && res.room) {
          socket.join(`kapstorial:${data.roomCode}`);
          socket.data.currentKapstorialRoom = data.roomCode;
          if (cb) cb({ success: true, room: this.getPublicRoomState(res.room) });
        } else {
          if (cb) cb({ success: false, error: res.error });
        }
      } catch (err: any) {
        if (cb) cb({ success: false, error: err.message || "Odaya katılınamadı." });
      }
    });

    // 4. Leave Room
    socket.on("kapstorial:leave_room", (cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (code) {
        this.leaveRoom(code, userIdNum);
        socket.leave(`kapstorial:${code}`);
        delete socket.data.currentKapstorialRoom;
      }
      if (cb) cb({ success: true });
    });

    // 5. Select Spawn Pixel (Spawn Phase)
    socket.on("kapstorial:set_spawn", (data: { pixelIndex: number }, cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return cb && cb({ success: false });
      const room = this.rooms.get(code);
      if (!room || room.status !== 'spawn_phase') return cb && cb({ success: false });

      const player = room.players.find((p) => p.userId === userIdNum);
      if (!player) return cb && cb({ success: false });

      const idx = Number(data.pixelIndex);
      if (idx >= 0 && idx < TOTAL_PIXELS && room.terrain[idx] === 1) {
        player.spawnPixel = idx;
        player.centroidX = idx % MAP_WIDTH;
        player.centroidY = Math.floor(idx / MAP_WIDTH);
        this.io.to(`kapstorial:${code}`).emit("kapstorial:spawn_selected", {
          playerId: player.id,
          pixelIndex: idx,
          x: player.centroidX,
          y: player.centroidY
        });
        if (cb) cb({ success: true });
      } else {
        if (cb) cb({ success: false, error: "Geçersiz spawn konumu (Sadece karaya yerleşebilirsiniz)." });
      }
    });

    // 6. Set Attack Percentage Slider
    socket.on("kapstorial:set_attack_percentage", (data: { percentage: number }) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return;
      const room = this.rooms.get(code);
      if (!room) return;
      const player = room.players.find((p) => p.userId === userIdNum);
      if (player) {
        player.attackPercentage = Math.max(1, Math.min(100, Number(data.percentage) || 20));
      }
    });

    // 7. Attack or Expand Action (Click on map)
    socket.on("kapstorial:attack", (data: { targetPixel: number; percentage?: number }, cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return cb && cb({ success: false });
      const room = this.rooms.get(code);
      if (!room || room.status !== 'running') return cb && cb({ success: false });

      const attacker = room.players.find((p) => p.userId === userIdNum);
      if (!attacker || !attacker.isAlive || attacker.troops <= 10) return cb && cb({ success: false });

      const targetPixel = Number(data.targetPixel);
      if (targetPixel < 0 || targetPixel >= TOTAL_PIXELS) return cb && cb({ success: false });

      const targetTerrain = room.terrain[targetPixel];
      const targetOwner = room.owners[targetPixel];

      const pct = data.percentage ? Math.max(1, Math.min(100, Number(data.percentage))) : attacker.attackPercentage;
      const sendTroops = Math.round(attacker.troops * (pct / 100));

      if (sendTroops <= 5) return cb && cb({ success: false, error: "Yetersiz asker." });

      // Check if user clicked on ocean -> Launch Naval Invasion Boat!
      if (targetTerrain === 0) {
        // Find nearest coastal border pixel of attacker
        const tx = targetPixel % MAP_WIDTH;
        const ty = Math.floor(targetPixel / MAP_WIDTH);
        const borders = this.findBorderPixelsAdjacentTo(room, attacker.id, 0); // border with water

        if (borders.length === 0) {
          return cb && cb({ success: false, error: "Denize kıyınız bulunmuyor!" });
        }

        // Find closest coast pixel to target
        let bestBorder = borders[0];
        let minDist = 999999;
        for (const b of borders) {
          const bx = b % MAP_WIDTH;
          const by = Math.floor(b / MAP_WIDTH);
          const d = Math.hypot(bx - tx, by - ty);
          if (d < minDist) {
            minDist = d;
            bestBorder = b;
          }
        }

        const startX = bestBorder % MAP_WIDTH;
        const startY = Math.floor(bestBorder / MAP_WIDTH);
        const dist = Math.hypot(tx - startX, ty - startY);
        const speed = 2.2;
        const vx = dist > 0 ? ((tx - startX) / dist) * speed : 0;
        const vy = dist > 0 ? ((ty - startY) / dist) * speed : 0;

        attacker.troops -= sendTroops;

        room.boats.push({
          id: `boat_${Date.now()}_${Math.random()}`,
          ownerId: attacker.id,
          troops: sendTroops,
          x: startX,
          y: startY,
          targetX: tx,
          targetY: ty,
          targetPixel,
          vx,
          vy
        });

        if (cb) cb({ success: true, mode: 'naval' });
        return;
      }

      // Land Attack / Expansion:
      // Deduct troops from main balance
      attacker.troops -= sendTroops;

      // Find frontier pixels of attacker adjacent to target
      const frontier = this.findBorderPixelsAdjacentTo(room, attacker.id, targetOwner);
      const startingPixels = frontier.length > 0 ? frontier : [targetPixel];

      room.attackWaves.push({
        id: `wave_${attacker.id}_${Date.now()}`,
        attackerId: attacker.id,
        targetId: targetOwner,
        remainingTroops: sendTroops,
        frontierPixels: startingPixels,
        visitedPixels: new Set(startingPixels)
      });

      if (cb) cb({ success: true, mode: 'land' });
    });

    // 8. Diplomacy: Propose Truce / NAP
    socket.on("kapstorial:propose_truce", (data: { targetPlayerId: number }, cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return cb && cb({ success: false });
      const room = this.rooms.get(code);
      if (!room || room.status !== 'running') return cb && cb({ success: false });

      const sender = room.players.find((p) => p.userId === userIdNum);
      const target = room.players.find((p) => p.id === Number(data.targetPlayerId));
      if (!sender || !target || !sender.isAlive || !target.isAlive) return cb && cb({ success: false });

      if (target.isBot) {
        // Bot auto-evaluates truce based on power ratio
        if (sender.troops >= target.troops * 0.7) {
          const key = `${Math.min(sender.id, target.id)}_${Math.max(sender.id, target.id)}`;
          room.truces.add(key);
          this.io.to(`kapstorial:${code}`).emit("kapstorial:truce_formed", {
            playerA: sender.id,
            playerB: target.id
          });
          if (cb) cb({ success: true, accepted: true });
        } else {
          if (cb) cb({ success: true, accepted: false, reason: "Bot teklifi reddetti!" });
        }
        return;
      }

      // Forward proposal to human target
      const targetSocket = this.io.sockets.sockets.get(target.socketId || "");
      if (targetSocket) {
        targetSocket.emit("kapstorial:truce_offered", {
          offererId: sender.id,
          offererName: sender.username
        });
      }
      if (cb) cb({ success: true, pending: true });
    });

    // 9. Diplomacy: Accept Truce
    socket.on("kapstorial:accept_truce", (data: { offererPlayerId: number }, cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return cb && cb({ success: false });
      const room = this.rooms.get(code);
      if (!room || room.status !== 'running') return cb && cb({ success: false });

      const receiver = room.players.find((p) => p.userId === userIdNum);
      const offerer = room.players.find((p) => p.id === Number(data.offererPlayerId));
      if (!receiver || !offerer) return cb && cb({ success: false });

      const key = `${Math.min(receiver.id, offerer.id)}_${Math.max(receiver.id, offerer.id)}`;
      room.truces.add(key);

      this.io.to(`kapstorial:${code}`).emit("kapstorial:truce_formed", {
        playerA: receiver.id,
        playerB: offerer.id
      });
      if (cb) cb({ success: true });
    });

    // 10. Diplomacy: Donate Troops (10% transfer tax)
    socket.on("kapstorial:donate_troops", (data: { targetPlayerId: number; percentage?: number }, cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return cb && cb({ success: false });
      const room = this.rooms.get(code);
      if (!room || room.status !== 'running') return cb && cb({ success: false });

      const donor = room.players.find((p) => p.userId === userIdNum);
      const recipient = room.players.find((p) => p.id === Number(data.targetPlayerId));
      if (!donor || !recipient || !donor.isAlive || !recipient.isAlive) return cb && cb({ success: false });

      const pct = data.percentage ? Math.max(1, Math.min(100, Number(data.percentage))) : 20;
      const amount = Math.round(donor.troops * (pct / 100));

      if (amount <= 10) return cb && cb({ success: false, error: "Yetersiz asker." });

      donor.troops -= amount;
      const receivedAmount = Math.round(amount * 0.9); // 10% tax
      recipient.troops += receivedAmount;

      this.io.to(`kapstorial:${code}`).emit("kapstorial:troops_donated", {
        donorId: donor.id,
        recipientId: recipient.id,
        amount: receivedAmount
      });

      if (cb) cb({ success: true, sent: receivedAmount });
    });

    // 11. Send Floating Emoji
    socket.on("kapstorial:send_emoji", (data: { emoji: string }) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return;
      const room = this.rooms.get(code);
      if (!room) return;

      const player = room.players.find((p) => p.userId === userIdNum);
      if (!player) return;

      const emojiStr = String(data.emoji || '👍').slice(0, 4);
      const now = Date.now();

      const newEmoji: FloatingEmoji = {
        id: `emoji_${Date.now()}_${Math.random()}`,
        ownerId: player.id,
        emoji: emojiStr,
        x: player.centroidX,
        y: player.centroidY,
        createdAt: now,
        expiresAt: now + 3000
      };

      room.emojis.push(newEmoji);
      this.io.to(`kapstorial:${code}`).emit("kapstorial:emoji_shown", newEmoji);
    });

    // 12. Change Color / Team (in Lobby)
    socket.on("kapstorial:set_player_settings", (data: { color?: string; team?: number }, cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return cb && cb({ success: false });
      const room = this.rooms.get(code);
      if (!room || room.status !== 'waiting') return cb && cb({ success: false });

      const player = room.players.find((p) => p.userId === userIdNum);
      if (!player) return cb && cb({ success: false });

      if (data.color && PLAYER_COLORS.includes(data.color)) {
        player.color = data.color;
      }
      if (typeof data.team === 'number') {
        player.team = data.team;
      }

      this.broadcastRoom(room);
      if (cb) cb({ success: true });
    });

    // 13. Toggle Ready
    socket.on("kapstorial:toggle_ready", (cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return cb && cb({ success: false });
      const room = this.rooms.get(code);
      if (!room || room.status !== 'waiting') return cb && cb({ success: false });

      const player = room.players.find((p) => p.userId === userIdNum);
      if (!player) return cb && cb({ success: false });

      player.isReady = !player.isReady;
      this.broadcastRoom(room);
      if (cb) cb({ success: true, isReady: player.isReady });
    });

    // 14. Host Starts Spawn Phase
    socket.on("kapstorial:start_game", (cb?: (res: any) => void) => {
      const code = socket.data.currentKapstorialRoom;
      if (!code) return cb && cb({ success: false });
      const res = this.startSpawnPhase(code, userIdNum);
      if (cb) cb(res);
    });

    // 15. Disconnect handling
    socket.on("disconnect", () => {
      const code = socket.data.currentKapstorialRoom;
      if (code) {
        this.leaveRoom(code, userIdNum);
      }
    });
  }
}
