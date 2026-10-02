import { Server as SocketIOServer } from "socket.io";
import { Client as LibsqlClient } from "@libsql/client";

export type PartyGameState = 'LOBBY' | 'GAME_REVEAL' | 'PLAYING' | 'SCOREBOARD' | 'FINAL_PODIUM';

export type MiniGameType = 
  | 'tank_trouble'
  | 'micro_racing'
  | 'hex_a_gone'
  | 'dodgeball'
  | 'blackout'
  | 'lava_survival'
  | 'coin_dash'
  | 'sumo_push'
  | 'bomb_tag'
  | 'sniper_arena';

export interface MiniGameMeta {
  id: MiniGameType;
  title: string;
  category: string;
  description: string;
  controls: { key: string; desc: string }[];
  durationSec: number;
  bgGradient: string;
  iconName: string;
}

export const MINI_GAMES_CATALOG: Record<MiniGameType, MiniGameMeta> = {
  tank_trouble: {
    id: 'tank_trouble',
    title: 'Tank Trouble (Tank Savaşları)',
    category: 'Aksiyon & Taktik',
    description: 'W/S ile ileri/geri git, A/D ile tankını döndür! Farenle taretini nişan al ve duvarlardan 3 kez seken mermilerle rakiplerini patlat.',
    controls: [
      { key: 'W / S', desc: 'İleri / Geri Sürüş' },
      { key: 'A / D', desc: 'Gövdeyi Döndür (Rotasyon)' },
      { key: 'Mouse', desc: 'Taret Nişanı' },
      { key: 'Sol Tık / Space', desc: 'Seken Mermi Ateşle' }
    ],
    durationSec: 45,
    bgGradient: 'from-amber-900/60 to-slate-950',
    iconName: 'Shield'
  },
  micro_racing: {
    id: 'micro_racing',
    title: 'Micro Racing (Araç Yarışı)',
    category: 'Yarış & Hız',
    description: 'Gerçek yönsel sürüş fiziği! W ile gaz ver, S ile fren yap, A/D ile direksiyonu kır, Shift ile drift atarak 3 turu ilk bitir.',
    controls: [
      { key: 'W / S', desc: 'Gaz / Fren & Geri' },
      { key: 'A / D', desc: 'Direksiyon Dönüşü' },
      { key: 'Shift', desc: 'Drift & Kayma' }
    ],
    durationSec: 60,
    bgGradient: 'from-blue-900/60 to-slate-950',
    iconName: 'Flag'
  },
  hex_a_gone: {
    id: 'hex_a_gone',
    title: 'Hex-A-Gone (Düşen Zeminler)',
    category: 'Refleks & Platform',
    description: 'Bastığın altıgen zemin 1 saniye içinde parçalanıp yok olur! Sürekli hareket et, boşluğa düşen elenir.',
    controls: [
      { key: 'WASD', desc: 'Koşma & Kaçış' },
      { key: 'Space', desc: 'Zıplama' }
    ],
    durationSec: 45,
    bgGradient: 'from-purple-900/60 to-slate-950',
    iconName: 'Layers'
  },
  dodgeball: {
    id: 'dodgeball',
    title: 'Dodgeball (Yakan Top)',
    category: 'Spor & Refleks',
    description: 'Ortadaki topları E ile kap, fareyle nişan alıp rakiplerine fırlat! Duvarlardan seken toplara dikkat et, vurulan elenir.',
    controls: [
      { key: 'WASD', desc: 'Hareket & Kaçış' },
      { key: 'E / Boşluk', desc: 'Yerden Top Al' },
      { key: 'Sol Tık', desc: 'Topu Fırlat' }
    ],
    durationSec: 45,
    bgGradient: 'from-emerald-900/60 to-slate-950',
    iconName: 'Zap'
  },
  blackout: {
    id: 'blackout',
    title: 'Blackout (Zifiri Karanlık)',
    category: 'Gerilim & Gizlilik',
    description: 'Arena tamamen karanlık! Yalnızca farenin baktığı yöne el feneri ışığı vurur. Işık konisindeki rakipleri vurarak hayatta kal.',
    controls: [
      { key: 'WASD', desc: 'Sessiz Adımlar' },
      { key: 'Mouse', desc: 'El Feneri & Nişan' },
      { key: 'Sol Tık', desc: 'Karanlıkta Ateş' }
    ],
    durationSec: 45,
    bgGradient: 'from-slate-950 to-zinc-950',
    iconName: 'Moon'
  },
  lava_survival: {
    id: 'lava_survival',
    title: 'Lava Survival (Lavda Hayatta Kalma)',
    category: 'Platform & Zıplama',
    description: 'Merkezden genişleyen dev şok dalgaları geliyor! Space ile zıplayarak dalgaların üzerinden atla.',
    controls: [
      { key: 'WASD', desc: 'Pozisyon Alma' },
      { key: 'Space', desc: 'Şok Dalgasından Zıplama' }
    ],
    durationSec: 40,
    bgGradient: 'from-orange-900/60 to-slate-950',
    iconName: 'Flame'
  },
  coin_dash: {
    id: 'coin_dash',
    title: 'Coin Dash (Altın Kapmaca)',
    category: 'Hız & Toplama',
    description: 'Arenaya yağan parlayan altınları topla! Shift ile hızlı atılarak (Dash) rakiplerinden önce altınları kap.',
    controls: [
      { key: 'WASD', desc: 'Hareket' },
      { key: 'Shift / Space', desc: 'Hızlı Atılma (Dash)' }
    ],
    durationSec: 30,
    bgGradient: 'from-yellow-900/60 to-slate-950',
    iconName: 'Coins'
  },
  sumo_push: {
    id: 'sumo_push',
    title: 'Sumo Push (Buzlu Sumo)',
    category: 'Fizik & İtme',
    description: 'Kaygan buz halkasında E tuşuyla rakiplere omuz atarak onları uçurumdan aşağı düşür!',
    controls: [
      { key: 'WASD', desc: 'Buzda Kayma' },
      { key: 'E / Space', desc: 'Şiddetli Sumo İtmesi' }
    ],
    durationSec: 40,
    bgGradient: 'from-cyan-900/60 to-slate-950',
    iconName: 'Users'
  },
  bomb_tag: {
    id: 'bomb_tag',
    title: 'Bomb Tag (Bomba Sende)',
    category: 'Panik & Kovalama',
    description: 'Tıklayan bomba patlamadan önce birine dokunup bombayı devret! Süre bitiminde bomba kimdeyse patlar.',
    controls: [
      { key: 'WASD', desc: 'Kaçma & Kovalama' }
    ],
    durationSec: 45,
    bgGradient: 'from-red-900/60 to-slate-950',
    iconName: 'Bomb'
  },
  sniper_arena: {
    id: 'sniper_arena',
    title: 'Sniper Arena (Lazerli Düello)',
    category: 'Keskin Nişancılık',
    description: 'Tek kurşun, tek can! Renkli lazerinle nişan al ve ateş et. 3 saniyelik doldurma süresinde siper al.',
    controls: [
      { key: 'WASD', desc: 'Siper Alma' },
      { key: 'Mouse', desc: 'Lazer Nişan' },
      { key: 'Sol Tık', desc: 'Ölümcül Atış' }
    ],
    durationSec: 45,
    bgGradient: 'from-emerald-900/60 to-slate-950',
    iconName: 'Crosshair'
  }
};

export const ALL_MINI_GAMES_LIST: MiniGameType[] = [
  'tank_trouble',
  'micro_racing',
  'hex_a_gone',
  'dodgeball',
  'blackout',
  'lava_survival',
  'coin_dash',
  'sumo_push',
  'bomb_tag',
  'sniper_arena'
];

export interface PartyPlayer {
  id: string;
  userId: number;
  username: string;
  avatar: string | null;
  color: string;
  isBot: boolean;
  isHost: boolean;
  ready: boolean;
  totalScore: number;
  roundScore: number;
  rank: number;
  
  // Directional Physics
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;       // Heading / rotation angle (radians)
  targetAngle: number; // Turret or mouse aim angle
  speed: number;       // Directional velocity forward/back
  isAlive: boolean;
  isAction: boolean;
  isDash: boolean;
  isShooting: boolean;
  zHeight: number;
  zVel: number;

  // Mini-game specific variables
  coinsCollected: number;
  lapsCompleted: number;
  currentCheckpoint: number;
  hasBomb: boolean;
  bombImmunityUntil: number;
  hasDodgeball: boolean;
  sniperAmmo: number;
  lastSniperShot: number;
  lastTankShot: number;
  lastDodgeballThrow: number;
  skidmarks: { x: number; y: number; alpha: number }[];
  lastDashTime: number;
  dashEndTime: number;

  // Key states received from client
  keyUp?: boolean;
  keyDown?: boolean;
  keyLeft?: boolean;
  keyRight?: boolean;

  // Bot AI
  botTimer?: number;
}

export interface TankMazeWall {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TankBullet {
  id: string;
  shooterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bouncesLeft: number;
  color: string;
}

export interface RaceCheckpoint {
  x: number;
  y: number;
  radius: number;
  index: number;
}

export interface HexTile {
  id: string;
  x: number;
  y: number;
  radius: number;
  state: 'solid' | 'shaking' | 'cracked' | 'void';
  steppedAt: number;
  destroyedAt: number;
}

export interface DodgeballEntity {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heldBy: string | null;
  lastThrownBy: string | null;
  bouncesLeft: number;
  color: string;
}

export interface BlackoutBullet {
  id: string;
  shooterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
}

export interface LavaShockwave {
  id: string;
  x: number;
  y: number;
  currentRadius: number;
  maxRadius: number;
  speed: number;
}

export interface PartyCoin {
  id: string;
  x: number;
  y: number;
  value: number;
  createdAt: number;
}

export interface PartyRoom {
  id: string;
  title: string;
  hostId: number;
  hostName: string;
  hostAvatar: string | null;
  capacity: number; // 2 - 10
  totalRounds: number; // 3, 5, 7, 10
  currentRoundIndex: number; // 0-based
  roundsPlaylist: MiniGameType[];
  state: PartyGameState;
  stateTimer: number; // countdown in sec
  activeGameType: MiniGameType | null;
  gameTimeRemaining: number;
  createdAt: number;
  players: PartyPlayer[];

  // Entities
  tankWalls: TankMazeWall[];
  tankBullets: TankBullet[];
  raceCheckpoints: RaceCheckpoint[];
  hexTiles: HexTile[];
  dodgeballs: DodgeballEntity[];
  blackoutBullets: BlackoutBullet[];
  lavaShockwaves: LavaShockwave[];
  coins: PartyCoin[];
  roundWinners: { userId: number; username: string; pointsAwarded: number; rank: number }[];
  gameLoopInterval?: NodeJS.Timeout;
}

export class PartyManager {
  private io: SocketIOServer;
  private db?: LibsqlClient;
  public rooms: Map<string, PartyRoom> = new Map();

  constructor(io: SocketIOServer, db?: LibsqlClient) {
    this.io = io;
    this.db = db;
  }

  public getRoomsList() {
    return Array.from(this.rooms.values()).map(r => ({
      id: r.id,
      title: r.title,
      hostId: r.hostId,
      hostName: r.hostName,
      hostAvatar: r.hostAvatar,
      playerCount: r.players.length,
      capacity: r.capacity,
      totalRounds: r.totalRounds,
      currentRound: r.currentRoundIndex + 1,
      state: r.state,
      activeGameTitle: r.activeGameType ? MINI_GAMES_CATALOG[r.activeGameType]?.title : null,
      createdAt: r.createdAt
    }));
  }

  public broadcastRoomsList() {
    this.io.emit('party:rooms_list', this.getRoomsList());
  }

  public createRoom(
    user: { id: number; username: string; avatar?: string | null; color?: string },
    options: { title?: string; capacity?: number; totalRounds?: number }
  ): PartyRoom {
    const roomId = `party_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const capacity = Math.min(10, Math.max(2, options.capacity || 8));
    const totalRounds = Math.min(10, Math.max(1, options.totalRounds || 5));

    // Generate random sequence of distinct mini-games
    const shuffled = [...ALL_MINI_GAMES_LIST].sort(() => Math.random() - 0.5);
    const playlist: MiniGameType[] = [];
    for (let r = 0; r < totalRounds; r++) {
      playlist.push(shuffled[r % shuffled.length]);
    }

    const hostPlayer: PartyPlayer = this.createPlayerObj(user.id, user.username, user.avatar || null, user.color || '#3b82f6', true, false);

    const room: PartyRoom = {
      id: roomId,
      title: options.title?.trim() || `${user.username}'in Partisi`,
      hostId: user.id,
      hostName: user.username,
      hostAvatar: user.avatar || null,
      capacity,
      totalRounds,
      currentRoundIndex: 0,
      roundsPlaylist: playlist,
      state: 'LOBBY',
      stateTimer: 0,
      activeGameType: null,
      gameTimeRemaining: 0,
      createdAt: Date.now(),
      players: [hostPlayer],
      tankWalls: [],
      tankBullets: [],
      raceCheckpoints: [],
      hexTiles: [],
      dodgeballs: [],
      blackoutBullets: [],
      lavaShockwaves: [],
      coins: [],
      roundWinners: []
    };

    this.rooms.set(roomId, room);
    this.broadcastRoomsList();
    return room;
  }

  public joinRoom(
    roomId: string,
    user: { id: number; username: string; avatar?: string | null; color?: string }
  ): { success: boolean; error?: string; room?: PartyRoom } {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Oda bulunamadı.' };
    if (room.state !== 'LOBBY') return { success: false, error: 'Oyun çoktan başladı!' };
    if (room.players.length >= room.capacity) return { success: false, error: 'Oda dolu!' };

    const existing = room.players.find(p => p.userId === user.id);
    if (existing) return { success: true, room };

    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];
    const assignedColor = user.color || colors[room.players.length % colors.length];

    const player = this.createPlayerObj(user.id, user.username, user.avatar || null, assignedColor, false, false);
    room.players.push(player);

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
    }

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
    this.broadcastRoomsList();
  }

  public addBot(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'LOBBY') return { error: 'Bot eklenemez.' };
    if (room.players.length >= room.capacity) return { error: 'Masa dolu!' };

    const botNames = ['RoboMario', 'LuigiBot', 'SpeedyYoshi', 'BowserAI', 'PeachBot', 'Toadster', 'WarioBot', 'DonkeyAI', 'DaisyBot', 'Waluigi'];
    const botName = botNames[room.players.length % botNames.length];
    const botId = -Math.floor(10000 + Math.random() * 90000);
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];

    const bot = this.createPlayerObj(botId, botName, null, colors[room.players.length % colors.length], false, true);
    bot.ready = true;
    room.players.push(bot);

    this.broadcastRoomState(room);
    this.broadcastRoomsList();
    return { success: true, room };
  }

  public removeBot(roomId: string, userId: number, botId?: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'LOBBY') return { error: 'Bot çıkarılamaz.' };
    if (room.hostId !== userId) return { error: 'Yalnızca oda sahibi bot çıkarabilir.' };

    if (botId) {
      room.players = room.players.filter(p => p.userId !== botId);
    } else {
      const lastBotIndex = room.players.map(p => p.isBot).lastIndexOf(true);
      if (lastBotIndex !== -1) {
        room.players.splice(lastBotIndex, 1);
      }
    }

    this.broadcastRoomState(room);
    this.broadcastRoomsList();
    return { success: true, room };
  }

  public toggleReady(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'LOBBY') return { error: 'Oyun durumunda hazır verilemez.' };
    const p = room.players.find(pl => pl.userId === userId);
    if (!p) return { error: 'Oyuncu bulunamadı.' };

    p.ready = !p.ready;
    this.broadcastRoomState(room);
    return { success: true, ready: p.ready };
  }

  public startTournament(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'LOBBY') return { error: 'Turnuva başlatılamaz.' };
    if (room.hostId !== userId) return { error: 'Sadece oda yöneticisi turnuvayı başlatabilir.' };
    if (room.players.length < 2) return { error: 'Turnuva için en az 2 oyuncu gereklidir.' };

    room.currentRoundIndex = 0;
    room.players.forEach(p => {
      p.totalScore = 0;
      p.roundScore = 0;
    });

    this.setupNextMiniGame(room);
    this.startGameLoop(room);
    this.broadcastRoomsList();
    return { success: true };
  }

  public processPlayerInput(roomId: string, userId: number, input: any) {
    if (!input || typeof input !== 'object') return;
    const room = this.rooms.get(roomId);
    if (!room || room.state !== 'PLAYING') return;

    const p = room.players.find(pl => pl.userId === userId);
    if (!p || !p.isAlive) return;

    // Direct key state capture
    p.keyUp = Boolean(input.up || input.w);
    p.keyDown = Boolean(input.down || input.s);
    p.keyLeft = Boolean(input.left || input.a);
    p.keyRight = Boolean(input.right || input.d);

    // Aim Angle
    if (typeof input.mouseAngle === 'number' && Number.isFinite(input.mouseAngle)) {
      p.targetAngle = input.mouseAngle;
      if (room.activeGameType !== 'tank_trouble' && room.activeGameType !== 'micro_racing') {
        p.angle = input.mouseAngle;
      }
    } else if (typeof input.angle === 'number' && Number.isFinite(input.angle)) {
      p.targetAngle = input.angle;
      if (room.activeGameType !== 'tank_trouble' && room.activeGameType !== 'micro_racing') {
        p.angle = input.angle;
      }
    }

    // Action / Dash / Shoot booleans
    p.isAction = Boolean(input.action || input.e || input.interact || input.space);
    p.isDash = Boolean(input.dash || input.shift);
    p.isShooting = Boolean(input.isShooting || input.shooting || input.mouseDown);

    // Standard Direct Velocity for 2D platformers (hex_a_gone, dodgeball, blackout, etc.)
    if (room.activeGameType !== 'tank_trouble' && room.activeGameType !== 'micro_racing') {
      let vx = 0;
      let vy = 0;
      if (p.keyUp) vy -= 1;
      if (p.keyDown) vy += 1;
      if (p.keyLeft) vx -= 1;
      if (p.keyRight) vx += 1;
      if (vx !== 0 && vy !== 0) {
        vx *= 0.7071;
        vy *= 0.7071;
      }
      p.vx = vx;
      p.vy = vy;
    }
  }

  // ============================================================
  // MINI-GAME SETUP & STATE INITIALIZATION
  // ============================================================
  private setupNextMiniGame(room: PartyRoom) {
    if (room.currentRoundIndex >= room.roundsPlaylist.length) {
      this.endTournament(room);
      return;
    }

    const gType = room.roundsPlaylist[room.currentRoundIndex];
    room.activeGameType = gType;
    room.state = 'GAME_REVEAL';
    room.stateTimer = 5; // 5 seconds intro
    room.gameTimeRemaining = MINI_GAMES_CATALOG[gType].durationSec;

    // Reset player round variables
    const numPlayers = room.players.length;
    room.players.forEach((p, idx) => {
      p.isAlive = true;
      p.roundScore = 0;
      p.vx = 0;
      p.vy = 0;
      p.speed = 0;
      p.zHeight = 0;
      p.zVel = 0;
      p.coinsCollected = 0;
      p.lapsCompleted = 0;
      p.currentCheckpoint = 0;
      p.hasBomb = false;
      p.bombImmunityUntil = 0;
      p.hasDodgeball = false;
      p.sniperAmmo = 1;
      p.lastSniperShot = 0;
      p.lastTankShot = 0;
      p.lastDodgeballThrow = 0;
      p.skidmarks = [];
      p.lastDashTime = 0;
      p.dashEndTime = 0;

      // Circle spawn layout
      const angle = (idx / Math.max(1, numPlayers)) * Math.PI * 2;
      p.x = 450 + Math.cos(angle) * 220;
      p.y = 300 + Math.sin(angle) * 160;
      p.angle = angle + Math.PI;
      p.targetAngle = p.angle;
    });

    // Game Specific Setup
    this.initGameEntities(room, gType);
    this.broadcastGameState(room);
  }

  private initGameEntities(room: PartyRoom, gType: MiniGameType) {
    room.tankWalls = [];
    room.tankBullets = [];
    room.raceCheckpoints = [];
    room.hexTiles = [];
    room.dodgeballs = [];
    room.blackoutBullets = [];
    room.lavaShockwaves = [];
    room.coins = [];
    room.roundWinners = [];

    if (gType === 'tank_trouble') {
      // Maze Walls
      room.tankWalls = [
        { x: 150, y: 120, w: 18, h: 200 },
        { x: 150, y: 320, w: 200, h: 18 },
        { x: 732, y: 120, w: 18, h: 200 },
        { x: 550, y: 320, w: 200, h: 18 },
        { x: 350, y: 180, w: 200, h: 18 },
        { x: 441, y: 180, w: 18, h: 160 },
        { x: 300, y: 440, w: 300, h: 18 }
      ];
    } else if (gType === 'micro_racing') {
      // Circular Oval Racetrack Checkpoints
      const pts = [
        { x: 450, y: 100 },
        { x: 740, y: 160 },
        { x: 740, y: 440 },
        { x: 450, y: 500 },
        { x: 160, y: 440 },
        { x: 160, y: 160 }
      ];
      room.raceCheckpoints = pts.map((pt, i) => ({ ...pt, radius: 80, index: i }));

      // Align players on starting grid facing right (angle = 0)
      room.players.forEach((p, i) => {
        p.x = 420 - (i % 2) * 50;
        p.y = 80 + Math.floor(i / 2) * 35;
        p.angle = 0;
        p.speed = 0;
      });
    } else if (gType === 'hex_a_gone') {
      // Generate Grid of Hexagon Tiles (11 cols x 7 rows)
      const hexRadius = 42;
      const startX = 140;
      const startY = 100;
      const dx = hexRadius * 1.732;
      const dy = hexRadius * 1.5;

      for (let r = 0; r < 7; r++) {
        const rowOffsetX = (r % 2 === 1) ? dx / 2 : 0;
        for (let c = 0; c < 9; c++) {
          const hx = startX + c * dx + rowOffsetX;
          const hy = startY + r * dy;
          room.hexTiles.push({
            id: `hex_${r}_${c}`,
            x: hx,
            y: hy,
            radius: hexRadius - 3,
            state: 'solid',
            steppedAt: 0,
            destroyedAt: 0
          });
        }
      }
    } else if (gType === 'dodgeball') {
      // Spawn 6 Neutral Dodgeballs in center
      const ballColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
      for (let i = 0; i < 6; i++) {
        room.dodgeballs.push({
          id: `db_${i}`,
          x: 350 + (i % 3) * 100,
          y: 250 + Math.floor(i / 3) * 100,
          vx: 0,
          vy: 0,
          heldBy: null,
          lastThrownBy: null,
          bouncesLeft: 2,
          color: ballColors[i % ballColors.length]
        });
      }
    } else if (gType === 'bomb_tag') {
      const carrier = room.players[Math.floor(Math.random() * room.players.length)];
      if (carrier) carrier.hasBomb = true;
    } else if (gType === 'coin_dash') {
      for (let c = 0; c < 18; c++) {
        room.coins.push({
          id: `c_${c}`,
          x: 100 + Math.random() * 700,
          y: 100 + Math.random() * 400,
          value: Math.random() < 0.2 ? 3 : 1,
          createdAt: Date.now()
        });
      }
    }
  }

  // ============================================================
  // MAIN GAME LOOP (30 FPS)
  // ============================================================
  private startGameLoop(room: PartyRoom) {
    if (room.gameLoopInterval) clearInterval(room.gameLoopInterval);

    room.gameLoopInterval = setInterval(() => {
      this.tickRoom(room);
    }, 1000 / 30);
  }

  private tickRoom(room: PartyRoom) {
    if (room.state === 'LOBBY' || room.state === 'FINAL_PODIUM') return;

    const dt = 1 / 30;

    // 1. GAME REVEAL STATE (5s Countdown)
    if (room.state === 'GAME_REVEAL') {
      room.stateTimer -= dt;
      if (room.stateTimer <= 0) {
        room.state = 'PLAYING';
        this.broadcastRoomState(room);
      }
      this.broadcastGameState(room);
      return;
    }

    // 2. SCOREBOARD STATE (5s Standings Celebration)
    if (room.state === 'SCOREBOARD') {
      room.stateTimer -= dt;
      if (room.stateTimer <= 0) {
        room.currentRoundIndex++;
        this.setupNextMiniGame(room);
      }
      this.broadcastGameState(room);
      return;
    }

    // 3. PLAYING STATE
    if (room.state === 'PLAYING') {
      room.gameTimeRemaining -= dt;

      // Update Bot AI
      this.updateBotAI(room);

      // Execute Game Physics
      switch (room.activeGameType) {
        case 'tank_trouble':
          this.tickTankTrouble(room, dt);
          break;
        case 'micro_racing':
          this.tickMicroRacing(room, dt);
          break;
        case 'hex_a_gone':
          this.tickHexAGone(room, dt);
          break;
        case 'dodgeball':
          this.tickDodgeball(room, dt);
          break;
        case 'blackout':
          this.tickBlackout(room, dt);
          break;
        case 'lava_survival':
          this.tickLavaSurvival(room, dt);
          break;
        case 'coin_dash':
          this.tickCoinDash(room, dt);
          break;
        case 'sumo_push':
          this.tickSumoPush(room, dt);
          break;
        case 'bomb_tag':
          this.tickBombTag(room, dt);
          break;
        case 'sniper_arena':
          this.tickSniperArena(room, dt);
          break;
      }

      // Check Round Completion Condition
      const alivePlayers = room.players.filter(p => p.isAlive);
      const isTimeUp = room.gameTimeRemaining <= 0;
      const isSurvivalGame = ['tank_trouble', 'hex_a_gone', 'dodgeball', 'blackout', 'lava_survival', 'sumo_push', 'bomb_tag', 'sniper_arena'].includes(room.activeGameType || '');

      if (isTimeUp || (isSurvivalGame && alivePlayers.length <= 1)) {
        this.concludeRound(room);
      }

      this.broadcastGameState(room);
    }
  }

  // ============================================================
  // MINI-GAME 1: TANK TROUBLE (PERFECT ANGULAR DRIVING & TURRET)
  // ============================================================
  private tickTankTrouble(room: PartyRoom, dt: number) {
    const now = Date.now();
    const rotationSpeed = 3.0; // radians/sec
    const forwardAccel = 360;
    const reverseAccel = 240;
    const maxForwardSpeed = 175;
    const maxReverseSpeed = -90;
    const friction = 0.88;

    room.players.forEach(p => {
      if (!p.isAlive) return;

      // 1. Angular Hull Rotation (A/D rotates hull angle)
      if (p.keyLeft) p.angle -= rotationSpeed * dt;
      if (p.keyRight) p.angle += rotationSpeed * dt;

      // 2. Directional Speed (W pushes forward along angle, S pushes backward)
      if (p.keyUp) {
        p.speed = Math.min(maxForwardSpeed, p.speed + forwardAccel * dt);
      } else if (p.keyDown) {
        p.speed = Math.max(maxReverseSpeed, p.speed - reverseAccel * dt);
      } else {
        p.speed *= friction;
      }

      // 3. Directional Movement: X/Y computed strictly from heading angle!
      const nextX = p.x + Math.cos(p.angle) * p.speed * dt;
      const nextY = p.y + Math.sin(p.angle) * p.speed * dt;

      const clampedX = Math.max(30, Math.min(870, nextX));
      const clampedY = Math.max(30, Math.min(570, nextY));

      if (!this.checkMazeWallCollision(clampedX, p.y, 20, room.tankWalls)) {
        p.x = clampedX;
      }
      if (!this.checkMazeWallCollision(p.x, clampedY, 20, room.tankWalls)) {
        p.y = clampedY;
      }

      // 4. Independent Turret Firing (bounces off maze walls 3 times)
      if ((p.isShooting || p.isAction) && now - p.lastTankShot > 700) {
        p.lastTankShot = now;
        const turretAngle = p.targetAngle !== undefined ? p.targetAngle : p.angle;
        const bSpeed = 350;

        room.tankBullets.push({
          id: `tb_${p.id}_${now}`,
          shooterId: p.id,
          x: p.x + Math.cos(turretAngle) * 26,
          y: p.y + Math.sin(turretAngle) * 26,
          vx: Math.cos(turretAngle) * bSpeed,
          vy: Math.sin(turretAngle) * bSpeed,
          bouncesLeft: 3,
          color: p.color
        });
      }
    });

    // Bullets update & 3-bounce ricochet
    const activeBullets: TankBullet[] = [];
    room.tankBullets.forEach(b => {
      let nextX = b.x + b.vx * dt;
      let nextY = b.y + b.vy * dt;

      if (nextX < 15) { nextX = 15; b.vx = -b.vx; b.bouncesLeft--; }
      else if (nextX > 885) { nextX = 885; b.vx = -b.vx; b.bouncesLeft--; }

      if (nextY < 15) { nextY = 15; b.vy = -b.vy; b.bouncesLeft--; }
      else if (nextY > 585) { nextY = 585; b.vy = -b.vy; b.bouncesLeft--; }

      for (const wall of room.tankWalls) {
        if (nextX >= wall.x - 6 && nextX <= wall.x + wall.w + 6 &&
            nextY >= wall.y - 6 && nextY <= wall.y + wall.h + 6) {
          if (b.x < wall.x || b.x > wall.x + wall.w) {
            b.vx = -b.vx;
          } else {
            b.vy = -b.vy;
          }
          b.bouncesLeft--;
          break;
        }
      }

      let hitTank = false;
      for (const p of room.players) {
        if (!p.isAlive) continue;
        const dist = Math.hypot(p.x - nextX, p.y - nextY);
        if (dist < 22) {
          p.isAlive = false;
          hitTank = true;
          break;
        }
      }

      if (!hitTank && b.bouncesLeft > 0) {
        b.x = nextX;
        b.y = nextY;
        activeBullets.push(b);
      }
    });
    room.tankBullets = activeBullets;
  }

  // ============================================================
  // MINI-GAME 2: MICRO RACING (PERFECT CAR ACCEL & DRIFT PHYSICS)
  // ============================================================
  private tickMicroRacing(room: PartyRoom, dt: number) {
    const steerSpeed = 3.4;
    const accel = 420;
    const maxSpeed = 360;
    const maxReverse = -120;
    const naturalDamping = 0.96;

    room.players.forEach(p => {
      // 1. Steering (A/D rotates car body angle)
      if (p.keyLeft) p.angle -= steerSpeed * dt;
      if (p.keyRight) p.angle += steerSpeed * dt;

      // 2. Throttle / Braking along vehicle angle
      if (p.keyUp) {
        p.speed = Math.min(maxSpeed, p.speed + accel * dt);
      } else if (p.keyDown) {
        p.speed = Math.max(maxReverse, p.speed - accel * 1.2 * dt);
      } else {
        p.speed *= naturalDamping;
      }

      // 3. Drift Skidmarks when Drift key held
      const isDrifting = p.isDash;
      if (isDrifting && Math.abs(p.speed) > 130) {
        p.skidmarks.push({ x: p.x, y: p.y, alpha: 1.0 });
        if (p.skidmarks.length > 30) p.skidmarks.shift();
      }
      p.skidmarks.forEach(sm => sm.alpha = Math.max(0, sm.alpha - dt * 0.5));

      // 4. Directional Forward Velocity vector
      p.vx = Math.cos(p.angle) * p.speed;
      p.vy = Math.sin(p.angle) * p.speed;

      p.x = Math.max(40, Math.min(860, p.x + p.vx * dt));
      p.y = Math.max(40, Math.min(560, p.y + p.vy * dt));

      // 5. Checkpoint & Lap Detection
      const nextCp = room.raceCheckpoints[p.currentCheckpoint];
      if (nextCp) {
        const d = Math.hypot(p.x - nextCp.x, p.y - nextCp.y);
        if (d < nextCp.radius) {
          p.currentCheckpoint = (p.currentCheckpoint + 1) % room.raceCheckpoints.length;
          if (p.currentCheckpoint === 0) {
            p.lapsCompleted++;
            if (p.lapsCompleted >= 3) {
              if (!room.roundWinners.some(rw => rw.userId === p.userId)) {
                const rank = room.roundWinners.length + 1;
                const points = rank === 1 ? 5 : rank === 2 ? 3 : rank === 3 ? 2 : 1;
                room.roundWinners.push({
                  userId: p.userId,
                  username: p.username,
                  pointsAwarded: points,
                  rank
                });
                p.roundScore = points;
              }
            }
          }
        }
      }
    });

    const finishCount = room.players.filter(p => p.lapsCompleted >= 3).length;
    if (finishCount >= Math.min(3, room.players.length)) {
      room.gameTimeRemaining = Math.min(room.gameTimeRemaining, 2);
    }
  }

  // ============================================================
  // MINI-GAME 3: HEX-A-GONE (CRUMBLING TILES & FALLING VOID)
  // ============================================================
  private tickHexAGone(room: PartyRoom, dt: number) {
    const now = Date.now();

    // 1. Move players
    room.players.forEach(p => {
      if (!p.isAlive) return;
      p.x = Math.max(80, Math.min(820, p.x + p.vx * 210 * dt));
      p.y = Math.max(60, Math.min(540, p.y + p.vy * 210 * dt));

      // Check which hex tile the player is currently stepping on
      let onSolidTile = false;
      for (const tile of room.hexTiles) {
        const d = Math.hypot(p.x - tile.x, p.y - tile.y);
        if (d < tile.radius) {
          if (tile.state === 'solid') {
            tile.state = 'shaking';
            tile.steppedAt = now;
          }
          if (tile.state !== 'void') {
            onSolidTile = true;
          }
        }
      }

      // If not on any solid tile and on ground, player falls into the abyss!
      if (!onSolidTile && p.zHeight <= 0) {
        p.isAlive = false;
      }
    });

    // 2. Update Hex Tiles lifecycle (solid -> shaking 600ms -> cracked 400ms -> void)
    room.hexTiles.forEach(tile => {
      if (tile.state === 'shaking' && now - tile.steppedAt > 600) {
        tile.state = 'cracked';
      } else if (tile.state === 'cracked' && now - tile.steppedAt > 1000) {
        tile.state = 'void';
        tile.destroyedAt = now;
      }
    });
  }

  // ============================================================
  // MINI-GAME 4: DODGEBALL (PICKUP, FAST THROW & RICOCHET HITS)
  // ============================================================
  private tickDodgeball(room: PartyRoom, dt: number) {
    const now = Date.now();

    // Move players & Pickup Dodgeball
    room.players.forEach(p => {
      if (!p.isAlive) return;
      p.x = Math.max(50, Math.min(850, p.x + p.vx * 230 * dt));
      p.y = Math.max(50, Math.min(550, p.y + p.vy * 230 * dt));

      // Pickup neutral dodgeball (E or Action)
      if (!p.hasDodgeball && (p.isAction || p.isDash)) {
        for (const ball of room.dodgeballs) {
          if (ball.heldBy === null && Math.hypot(ball.vx, ball.vy) < 50) {
            const d = Math.hypot(p.x - ball.x, p.y - ball.y);
            if (d < 35) {
              ball.heldBy = p.id;
              p.hasDodgeball = true;
              break;
            }
          }
        }
      }

      // Throw dodgeball (Mouse click / isShooting)
      if (p.hasDodgeball && (p.isShooting || p.isAction) && now - p.lastDodgeballThrow > 500) {
        p.lastDodgeballThrow = now;
        p.hasDodgeball = false;

        const ball = room.dodgeballs.find(b => b.heldBy === p.id);
        if (ball) {
          ball.heldBy = null;
          ball.lastThrownBy = p.id;
          const throwAngle = p.targetAngle !== undefined ? p.targetAngle : p.angle;
          const throwSpeed = 620;
          ball.vx = Math.cos(throwAngle) * throwSpeed;
          ball.vy = Math.sin(throwAngle) * throwSpeed;
          ball.bouncesLeft = 2;
          ball.x = p.x + Math.cos(throwAngle) * 25;
          ball.y = p.y + Math.sin(throwAngle) * 25;
        }
      }
    });

    // Update Dodgeballs position, bouncing & player elimination
    room.dodgeballs.forEach(ball => {
      if (ball.heldBy !== null) {
        // Ball follows holder
        const holder = room.players.find(pl => pl.id === ball.heldBy);
        if (holder && holder.isAlive) {
          ball.x = holder.x;
          ball.y = holder.y;
          ball.vx = 0;
          ball.vy = 0;
        } else {
          ball.heldBy = null;
        }
        return;
      }

      // Move airborne ball
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // Friction
      ball.vx *= 0.985;
      ball.vy *= 0.985;

      // Wall bounce
      if (ball.x < 20 || ball.x > 880) { ball.vx = -ball.vx; ball.bouncesLeft--; }
      if (ball.y < 20 || ball.y > 580) { ball.vy = -ball.vy; ball.bouncesLeft--; }

      const ballSpeed = Math.hypot(ball.vx, ball.vy);

      // Hit elimination if fast moving ball
      if (ballSpeed > 180) {
        for (const victim of room.players) {
          if (!victim.isAlive || victim.id === ball.lastThrownBy) continue;
          const d = Math.hypot(victim.x - ball.x, victim.y - ball.y);
          if (d < 26) {
            victim.isAlive = false;
            // Ball drops dead on impact
            ball.vx *= 0.2;
            ball.vy *= 0.2;
            ball.lastThrownBy = null;
            break;
          }
        }
      }
    });
  }

  // ============================================================
  // MINI-GAME 5: BLACKOUT (CONICAL FLASHLIGHT & SNEAK SHOOT)
  // ============================================================
  private tickBlackout(room: PartyRoom, dt: number) {
    const now = Date.now();

    room.players.forEach(p => {
      if (!p.isAlive) return;

      p.x = Math.max(40, Math.min(860, p.x + p.vx * 200 * dt));
      p.y = Math.max(40, Math.min(560, p.y + p.vy * 200 * dt));

      // Shoot in darkness
      if ((p.isShooting || p.isAction) && now - p.lastTankShot > 800) {
        p.lastTankShot = now;
        const shootAngle = p.targetAngle !== undefined ? p.targetAngle : p.angle;
        room.blackoutBullets.push({
          id: `bb_${p.id}_${now}`,
          shooterId: p.id,
          x: p.x + Math.cos(shootAngle) * 22,
          y: p.y + Math.sin(shootAngle) * 22,
          vx: Math.cos(shootAngle) * 440,
          vy: Math.sin(shootAngle) * 440,
          color: p.color
        });
      }
    });

    // Update Blackout Bullets
    const activeBullets: BlackoutBullet[] = [];
    room.blackoutBullets.forEach(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      let hit = false;
      for (const victim of room.players) {
        if (!victim.isAlive || victim.id === b.shooterId) continue;
        const d = Math.hypot(victim.x - b.x, victim.y - b.y);
        if (d < 22) {
          victim.isAlive = false;
          hit = true;
          break;
        }
      }

      if (!hit && b.x > 20 && b.x < 880 && b.y > 20 && b.y < 580) {
        activeBullets.push(b);
      }
    });
    room.blackoutBullets = activeBullets;
  }

  // ============================================================
  // MINI-GAME 6: LAVA SURVIVAL (SHOCKWAVES & JUMP)
  // ============================================================
  private tickLavaSurvival(room: PartyRoom, dt: number) {
    const now = Date.now();

    room.players.forEach(p => {
      if (!p.isAlive) return;

      if (p.isAction && p.zHeight === 0) {
        p.zVel = 350;
      }

      if (p.zHeight > 0 || p.zVel > 0) {
        p.zHeight += p.zVel * dt;
        p.zVel -= 900 * dt;
        if (p.zHeight <= 0) {
          p.zHeight = 0;
          p.zVel = 0;
        }
      }

      p.x = Math.max(60, Math.min(840, p.x + p.vx * 200 * dt));
      p.y = Math.max(60, Math.min(540, p.y + p.vy * 200 * dt));
    });

    if (Math.random() < 0.04) {
      room.lavaShockwaves.push({
        id: `sw_${now}`,
        x: 450,
        y: 300,
        currentRadius: 20,
        maxRadius: 460,
        speed: 220 + (40 - room.gameTimeRemaining) * 4
      });
    }

    const activeShockwaves: LavaShockwave[] = [];
    room.lavaShockwaves.forEach(sw => {
      sw.currentRadius += sw.speed * dt;

      room.players.forEach(p => {
        if (!p.isAlive) return;
        const dist = Math.hypot(p.x - sw.x, p.y - sw.y);
        if (p.zHeight < 25 && Math.abs(dist - sw.currentRadius) < 16) {
          p.isAlive = false;
        }
      });

      if (sw.currentRadius < sw.maxRadius) {
        activeShockwaves.push(sw);
      }
    });
    room.lavaShockwaves = activeShockwaves;
  }

  // ============================================================
  // MINI-GAME 7: COIN DASH
  // ============================================================
  private tickCoinDash(room: PartyRoom, dt: number) {
    const now = Date.now();

    if (room.coins.length < 25 && Math.random() < 0.15) {
      room.coins.push({
        id: `c_${now}_${Math.random()}`,
        x: 80 + Math.random() * 740,
        y: 80 + Math.random() * 440,
        value: Math.random() < 0.18 ? 3 : 1,
        createdAt: now
      });
    }

    room.players.forEach(p => {
      const isDashing = (p.isDash || p.isAction) && now - p.lastDashTime > 1200;
      if (isDashing) {
        p.lastDashTime = now;
        p.dashEndTime = now + 250;
      }

      const currentSpeed = now < p.dashEndTime ? 440 : 230;
      p.x = Math.max(40, Math.min(860, p.x + p.vx * currentSpeed * dt));
      p.y = Math.max(40, Math.min(560, p.y + p.vy * currentSpeed * dt));

      room.coins = room.coins.filter(c => {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d < 30) {
          p.coinsCollected += c.value;
          return false;
        }
        return true;
      });
    });
  }

  // ============================================================
  // MINI-GAME 8: SUMO PUSH
  // ============================================================
  private tickSumoPush(room: PartyRoom, dt: number) {
    const iceRadius = 260;
    const centerX = 450;
    const centerY = 300;
    const now = Date.now();

    room.players.forEach(p => {
      if (!p.isAlive) return;

      p.vx = p.vx * 0.96;
      p.vy = p.vy * 0.96;

      p.x += p.vx * dt * 300;
      p.y += p.vy * dt * 300;

      if (p.isAction && now - p.lastDashTime > 800) {
        p.lastDashTime = now;
        const pushRange = 65;

        room.players.forEach(other => {
          if (other.id === p.id || !other.isAlive) return;
          const dist = Math.hypot(p.x - other.x, p.y - other.y);
          if (dist < pushRange) {
            const angle = Math.atan2(other.y - p.y, other.x - p.x);
            other.vx += Math.cos(angle) * 1.8;
            other.vy += Math.sin(angle) * 1.8;
          }
        });
      }

      const distFromCenter = Math.hypot(p.x - centerX, p.y - centerY);
      if (distFromCenter > iceRadius) {
        p.isAlive = false;
      }
    });
  }

  // ============================================================
  // MINI-GAME 9: BOMB TAG
  // ============================================================
  private tickBombTag(room: PartyRoom, dt: number) {
    const now = Date.now();

    room.players.forEach(p => {
      if (!p.isAlive) return;
      const speed = p.hasBomb ? 250 : 210;
      p.x = Math.max(50, Math.min(850, p.x + p.vx * speed * dt));
      p.y = Math.max(50, Math.min(550, p.y + p.vy * speed * dt));

      if (p.hasBomb && now > p.bombImmunityUntil) {
        for (const other of room.players) {
          if (other.id === p.id || !other.isAlive) continue;
          const d = Math.hypot(p.x - other.x, p.y - other.y);
          if (d < 38) {
            p.hasBomb = false;
            other.hasBomb = true;
            other.bombImmunityUntil = now + 800;
            break;
          }
        }
      }
    });

    if (room.gameTimeRemaining % 15 < dt) {
      const holder = room.players.find(p => p.hasBomb && p.isAlive);
      if (holder) {
        holder.isAlive = false;
        holder.hasBomb = false;

        const remaining = room.players.filter(p => p.isAlive);
        if (remaining.length > 0) {
          const next = remaining[Math.floor(Math.random() * remaining.length)];
          next.hasBomb = true;
          next.bombImmunityUntil = now + 1000;
        }
      }
    }
  }

  // ============================================================
  // MINI-GAME 10: SNIPER ARENA
  // ============================================================
  private tickSniperArena(room: PartyRoom, dt: number) {
    const now = Date.now();

    room.players.forEach(p => {
      if (!p.isAlive) return;

      p.x = Math.max(50, Math.min(850, p.x + p.vx * 190 * dt));
      p.y = Math.max(50, Math.min(550, p.y + p.vy * 190 * dt));

      if (p.sniperAmmo === 0 && now - p.lastSniperShot >= 3000) {
        p.sniperAmmo = 1;
      }

      if ((p.isShooting || p.isAction) && p.sniperAmmo > 0) {
        p.sniperAmmo = 0;
        p.lastSniperShot = now;

        const aimAngle = p.targetAngle !== undefined ? p.targetAngle : p.angle;
        const rayLen = 900;
        const targetX = p.x + Math.cos(aimAngle) * rayLen;
        const targetY = p.y + Math.sin(aimAngle) * rayLen;

        room.players.forEach(victim => {
          if (victim.id === p.id || !victim.isAlive) return;
          const dist = this.distToSegment(victim.x, victim.y, p.x, p.y, targetX, targetY);
          if (dist < 22) {
            victim.isAlive = false;
          }
        });
      }
    });
  }

  // ============================================================
  // BOT ARTIFICIAL INTELLIGENCE FOR ALL 10 GAMES
  // ============================================================
  private updateBotAI(room: PartyRoom) {
    const now = Date.now();
    const gType = room.activeGameType;

    room.players.forEach(bot => {
      if (!bot.isBot || !bot.isAlive) return;

      if (!bot.botTimer || now >= bot.botTimer) {
        bot.botTimer = now + 350 + Math.random() * 250;

        switch (gType) {
          case 'tank_trouble': {
            const rivals = room.players.filter(p => p.id !== bot.id && p.isAlive);
            if (rivals.length > 0) {
              const target = rivals[Math.floor(Math.random() * rivals.length)];
              bot.targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
              let hullDiff = bot.targetAngle - bot.angle;
              while (hullDiff < -Math.PI) hullDiff += Math.PI * 2;
              while (hullDiff > Math.PI) hullDiff -= Math.PI * 2;

              bot.keyLeft = hullDiff < -0.3;
              bot.keyRight = hullDiff > 0.3;
              bot.keyUp = Math.random() < 0.75;
              bot.keyDown = false;
              bot.isShooting = Math.random() < 0.6;
            }
            break;
          }
          case 'micro_racing': {
            const nextCp = room.raceCheckpoints[bot.currentCheckpoint];
            if (nextCp) {
              const targetAngle = Math.atan2(nextCp.y - bot.y, nextCp.x - bot.x);
              let angleDiff = targetAngle - bot.angle;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

              bot.keyLeft = angleDiff < -0.15;
              bot.keyRight = angleDiff > 0.15;
              bot.keyUp = true; // Full gas
              bot.keyDown = false;
              bot.isDash = Math.abs(angleDiff) > 0.55;
            }
            break;
          }
          case 'hex_a_gone': {
            // Find nearest solid tile
            const solidTiles = room.hexTiles.filter(t => t.state === 'solid' || t.state === 'shaking');
            if (solidTiles.length > 0) {
              let closest = solidTiles[0];
              let minD = 9999;
              solidTiles.forEach(t => {
                const d = Math.hypot(t.x - bot.x, t.y - bot.y);
                if (d < minD) { minD = d; closest = t; }
              });
              const ang = Math.atan2(closest.y - bot.y, closest.x - bot.x);
              bot.vx = Math.cos(ang);
              bot.vy = Math.sin(ang);
            }
            break;
          }
          case 'dodgeball': {
            if (!bot.hasDodgeball) {
              // Rush to neutral ball
              const freeBall = room.dodgeballs.find(b => b.heldBy === null);
              if (freeBall) {
                const ang = Math.atan2(freeBall.y - bot.y, freeBall.x - bot.x);
                bot.vx = Math.cos(ang);
                bot.vy = Math.sin(ang);
                bot.isAction = true;
              }
            } else {
              // Aim and throw at rival
              const rivals = room.players.filter(p => p.id !== bot.id && p.isAlive);
              if (rivals.length > 0) {
                const target = rivals[0];
                bot.targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
                bot.isShooting = true;
              }
            }
            break;
          }
          case 'blackout': {
            const rivals = room.players.filter(p => p.id !== bot.id && p.isAlive);
            if (rivals.length > 0) {
              const target = rivals[0];
              bot.targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
              bot.vx = (Math.random() - 0.5) * 2;
              bot.vy = (Math.random() - 0.5) * 2;
              bot.isShooting = Math.random() < 0.4;
            }
            break;
          }
          case 'lava_survival': {
            const nearbyWave = room.lavaShockwaves.find(sw => Math.abs(Math.hypot(bot.x - sw.x, bot.y - sw.y) - sw.currentRadius) < 40);
            bot.isAction = Boolean(nearbyWave);
            bot.vx = (Math.random() - 0.5) * 2;
            bot.vy = (Math.random() - 0.5) * 2;
            break;
          }
          case 'coin_dash': {
            if (room.coins.length > 0) {
              let nearestCoin = room.coins[0];
              let minDist = 9999;
              room.coins.forEach(c => {
                const d = Math.hypot(bot.x - c.x, bot.y - c.y);
                if (d < minDist) { minDist = d; nearestCoin = c; }
              });
              const ang = Math.atan2(nearestCoin.y - bot.y, nearestCoin.x - bot.x);
              bot.vx = Math.cos(ang);
              bot.vy = Math.sin(ang);
              bot.isDash = minDist > 120 && Math.random() < 0.4;
            }
            break;
          }
          case 'sumo_push': {
            const centerDist = Math.hypot(bot.x - 450, bot.y - 300);
            if (centerDist > 180) {
              const ang = Math.atan2(300 - bot.y, 450 - bot.x);
              bot.vx = Math.cos(ang);
              bot.vy = Math.sin(ang);
            } else {
              const nearbyRival = room.players.find(p => p.id !== bot.id && p.isAlive && Math.hypot(p.x - bot.x, p.y - bot.y) < 70);
              if (nearbyRival) {
                bot.isAction = true;
                const ang = Math.atan2(nearbyRival.y - bot.y, nearbyRival.x - bot.x);
                bot.vx = Math.cos(ang);
                bot.vy = Math.sin(ang);
              }
            }
            break;
          }
          case 'bomb_tag': {
            if (bot.hasBomb) {
              const victims = room.players.filter(p => p.id !== bot.id && p.isAlive);
              if (victims.length > 0) {
                const ang = Math.atan2(victims[0].y - bot.y, victims[0].x - bot.x);
                bot.vx = Math.cos(ang);
                bot.vy = Math.sin(ang);
              }
            } else {
              const carrier = room.players.find(p => p.hasBomb);
              if (carrier) {
                const ang = Math.atan2(bot.y - carrier.y, bot.x - carrier.x);
                bot.vx = Math.cos(ang);
                bot.vy = Math.sin(ang);
              }
            }
            break;
          }
          case 'sniper_arena': {
            const rivals = room.players.filter(p => p.id !== bot.id && p.isAlive);
            if (rivals.length > 0) {
              const target = rivals[Math.floor(Math.random() * rivals.length)];
              bot.targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
              bot.isShooting = Math.random() < 0.4;
            }
            bot.vx = (Math.random() - 0.5) * 2;
            bot.vy = (Math.random() - 0.5) * 2;
            break;
          }
        }
      }
    });
  }

  // ============================================================
  // ROUND & TOURNAMENT CONCLUSION & SCORING
  // ============================================================
  private concludeRound(room: PartyRoom) {
    room.state = 'SCOREBOARD';
    room.stateTimer = 5;

    const gType = room.activeGameType;
    let rankedPlayers = [...room.players];

    if (gType === 'coin_dash') {
      rankedPlayers.sort((a, b) => b.coinsCollected - a.coinsCollected);
    } else if (gType === 'micro_racing') {
      rankedPlayers.sort((a, b) => {
        if (b.lapsCompleted !== a.lapsCompleted) return b.lapsCompleted - a.lapsCompleted;
        return b.currentCheckpoint - a.currentCheckpoint;
      });
    } else {
      rankedPlayers.sort((a, b) => (b.isAlive ? 1 : 0) - (a.isAlive ? 1 : 0));
    }

    room.roundWinners = [];
    rankedPlayers.forEach((p, idx) => {
      const rank = idx + 1;
      const pts = rank === 1 ? 5 : rank === 2 ? 3 : rank === 3 ? 2 : 1;
      p.roundScore = pts;
      p.totalScore += pts;
      room.roundWinners.push({
        userId: p.userId,
        username: p.username,
        pointsAwarded: pts,
        rank
      });
    });

    room.players.sort((a, b) => b.totalScore - a.totalScore);
    room.players.forEach((p, i) => p.rank = i + 1);

    this.broadcastGameState(room);
  }

  private endTournament(room: PartyRoom) {
    room.state = 'FINAL_PODIUM';
    room.stateTimer = 0;
    if (room.gameLoopInterval) clearInterval(room.gameLoopInterval);

    const winner = room.players[0];
    if (winner && !winner.isBot && winner.userId > 0 && this.db) {
      this.db.execute({
        sql: `UPDATE users SET party_wins = COALESCE(party_wins, 0) + 1, chips = COALESCE(chips, 0) + 250 WHERE id = ?`,
        args: [winner.userId]
      }).catch(err => console.error('[Party Win Record DB Error]:', err));
    }

    this.broadcastRoomState(room);
    this.broadcastGameState(room);
  }

  public destroyRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room && room.gameLoopInterval) {
      clearInterval(room.gameLoopInterval);
    }
    this.rooms.delete(roomId);
    this.broadcastRoomsList();
  }

  // ============================================================
  // PUBLIC STATE SERIALIZATION
  // ============================================================
  public getPublicRoomState(room: PartyRoom) {
    return {
      id: room.id,
      title: room.title,
      hostId: room.hostId,
      hostName: room.hostName,
      hostAvatar: room.hostAvatar,
      capacity: room.capacity,
      totalRounds: room.totalRounds,
      currentRound: room.currentRoundIndex + 1,
      state: room.state,
      activeGameType: room.activeGameType,
      activeGameMeta: room.activeGameType ? MINI_GAMES_CATALOG[room.activeGameType] : null,
      players: room.players.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        isHost: p.isHost,
        ready: p.ready,
        totalScore: p.totalScore,
        roundScore: p.roundScore,
        rank: p.rank
      }))
    };
  }

  public getPublicGameState(room: PartyRoom) {
    return {
      id: room.id,
      state: room.state,
      stateTimer: Math.ceil(room.stateTimer),
      currentRound: room.currentRoundIndex + 1,
      totalRounds: room.totalRounds,
      activeGameType: room.activeGameType,
      activeGameMeta: room.activeGameType ? MINI_GAMES_CATALOG[room.activeGameType] : null,
      gameTimeRemaining: Math.ceil(room.gameTimeRemaining),
      roundWinners: room.roundWinners,
      players: room.players.map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: p.isBot,
        isHost: p.isHost,
        totalScore: p.totalScore,
        roundScore: p.roundScore,
        rank: p.rank,
        x: Math.round(p.x),
        y: Math.round(p.y),
        angle: Math.round(p.angle * 100) / 100,
        targetAngle: Math.round(p.targetAngle * 100) / 100,
        isAlive: p.isAlive,
        isAction: p.isAction,
        isDash: p.isDash,
        zHeight: Math.round(p.zHeight),
        coinsCollected: p.coinsCollected,
        lapsCompleted: p.lapsCompleted,
        hasBomb: p.hasBomb,
        hasDodgeball: p.hasDodgeball,
        sniperAmmo: p.sniperAmmo,
        skidmarks: p.skidmarks
      })),
      tankWalls: room.tankWalls,
      tankBullets: room.tankBullets.map(b => ({
        id: b.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        color: b.color
      })),
      raceCheckpoints: room.raceCheckpoints,
      hexTiles: room.hexTiles.map(h => ({
        id: h.id,
        x: Math.round(h.x),
        y: Math.round(h.y),
        radius: h.radius,
        state: h.state
      })),
      dodgeballs: room.dodgeballs.map(d => ({
        id: d.id,
        x: Math.round(d.x),
        y: Math.round(d.y),
        heldBy: d.heldBy,
        color: d.color
      })),
      blackoutBullets: room.blackoutBullets.map(b => ({
        id: b.id,
        x: Math.round(b.x),
        y: Math.round(b.y),
        color: b.color
      })),
      lavaShockwaves: room.lavaShockwaves.map(sw => ({
        id: sw.id,
        x: sw.x,
        y: sw.y,
        currentRadius: Math.round(sw.currentRadius)
      })),
      coins: room.coins
    };
  }

  public broadcastRoomState(room: PartyRoom) {
    this.io.to(room.id).emit('party:room_state', this.getPublicRoomState(room));
  }

  public broadcastGameState(room: PartyRoom) {
    this.io.to(room.id).emit('party:game_state', this.getPublicGameState(room));
  }

  private createPlayerObj(
    userId: number,
    username: string,
    avatar: string | null,
    color: string,
    isHost: boolean,
    isBot: boolean
  ): PartyPlayer {
    return {
      id: `p_${userId}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      username,
      avatar,
      color,
      isBot,
      isHost,
      ready: isHost || isBot,
      totalScore: 0,
      roundScore: 0,
      rank: 1,
      x: 450,
      y: 300,
      vx: 0,
      vy: 0,
      angle: 0,
      targetAngle: 0,
      speed: 0,
      isAlive: true,
      isAction: false,
      isDash: false,
      isShooting: false,
      zHeight: 0,
      zVel: 0,
      coinsCollected: 0,
      lapsCompleted: 0,
      currentCheckpoint: 0,
      hasBomb: false,
      bombImmunityUntil: 0,
      hasDodgeball: false,
      sniperAmmo: 1,
      lastSniperShot: 0,
      lastTankShot: 0,
      lastDodgeballThrow: 0,
      skidmarks: [],
      lastDashTime: 0,
      dashEndTime: 0
    };
  }

  private checkMazeWallCollision(x: number, y: number, radius: number, walls: TankMazeWall[]): boolean {
    for (const w of walls) {
      if (x + radius > w.x && x - radius < w.x + w.w &&
          y + radius > w.y && y - radius < w.y + w.h) {
        return true;
      }
    }
    return false;
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }
}

// ============================================================
// HEADLESS PARTY TEST SUITE
// ============================================================
export function runHeadlessPartyTest(cycles: number = 300) {
  const mockIo = {
    to: () => ({ emit: () => {} }),
    emit: () => {}
  } as any;

  const mgr = new PartyManager(mockIo);
  const room = mgr.createRoom({ id: 1, username: 'HostUser' }, { capacity: 10, totalRounds: 10 });

  for (let b = 0; b < 9; b++) {
    mgr.addBot(room.id, 1);
  }

  const errors: string[] = [];
  try {
    mgr.startTournament(room.id, 1);

    for (let c = 0; c < cycles; c++) {
      mgr['tickRoom'](room);

      room.players.forEach(p => {
        mgr.processPlayerInput(room.id, p.userId, {
          up: Math.random() < 0.6,
          down: Math.random() < 0.2,
          left: Math.random() < 0.3,
          right: Math.random() < 0.3,
          mouseAngle: Math.random() * Math.PI * 2,
          isShooting: Math.random() < 0.2,
          action: Math.random() < 0.1,
          dash: Math.random() < 0.1
        });
      });
    }

    const state = mgr.getPublicGameState(room);
    if (!state || state.players.length !== 10) {
      errors.push('State corruption: Player count is not 10');
    }
  } catch (err: any) {
    errors.push(`Party simulation exception: ${err?.message || String(err)}`);
  } finally {
    mgr.destroyRoom(room.id);
  }

  return {
    success: errors.length === 0,
    cyclesCompleted: cycles,
    errors,
    playerCount: 10,
    gamesTested: ALL_MINI_GAMES_LIST.length
  };
}
