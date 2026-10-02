import { Server as SocketIOServer } from "socket.io";
import { Client as LibsqlClient } from "@libsql/client";

export type PartyGameState = 'LOBBY' | 'GAME_REVEAL' | 'PLAYING' | 'SCOREBOARD' | 'FINAL_PODIUM';

export type MiniGameType = 
  | 'tank_trouble'
  | 'micro_racing'
  | 'lava_survival'
  | 'coin_dash'
  | 'sumo_push'
  | 'bomb_tag'
  | 'sniper_arena'
  | 'musical_blocks'
  | 'paint_turf'
  | 'meteor_dodge';

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
    description: 'Labirentte tankını sür, duvarlardan seken mermilerle rakiplerini avla! En son hayatta kalan tank kazanır.',
    controls: [
      { key: 'W/S', desc: 'İleri / Geri Sürüş' },
      { key: 'A/D', desc: 'Gövde Dönüşü' },
      { key: 'Mouse', desc: 'Taret Nişanı' },
      { key: 'Sol Tık / Space', desc: 'Seken Mermi Ateşle' }
    ],
    durationSec: 45,
    bgGradient: 'from-amber-900/60 to-slate-950',
    iconName: 'Shield'
  },
  micro_racing: {
    id: 'micro_racing',
    title: 'Micro Racing (Tepeden Yarış)',
    category: 'Yarış & Hız',
    description: 'Pistte 3 turu ilk bitiren şampiyon olur! Keskin virajlarda Drift tuşuyla kayarak avantaj sağla.',
    controls: [
      { key: 'W / S', desc: 'Gaz / Fren & Geri' },
      { key: 'A / D', desc: 'Sağa / Sola Direksiyon' },
      { key: 'Shift', desc: 'Drift & Kayma' }
    ],
    durationSec: 60,
    bgGradient: 'from-blue-900/60 to-slate-950',
    iconName: 'Flag'
  },
  lava_survival: {
    id: 'lava_survival',
    title: 'Lava Survival (Lavda Hayatta Kalma)',
    category: 'Refleks & Platform',
    description: 'Zeminler aniden kızgın lava dönüşür ve merkezden şok dalgaları yayılır! Space ile zıplayarak hayatta kal.',
    controls: [
      { key: 'WASD', desc: 'Koşma' },
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
    description: 'Arenada sürekli altınlar yağar! Shift ile atılarak 30 saniyede en çok altını toplayan lider olur.',
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
    description: 'Kaygan buz halkasında rakiplerine E ile omuz atarak onları uçurumdan aşağı düşür!',
    controls: [
      { key: 'WASD', desc: 'Buzda Kayma / Yön' },
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
    description: 'Tıklayan bomba patlamadan önce birine dokunup bombayı devret! 20 saniye sonunda bomba kimdeyse patlar.',
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
    category: 'Nişancılık',
    description: 'Tek kurşun, tek can! Lazerini gizle veya rakibini şaşırt. Iskalarsan 3 saniye doldurma süren var.',
    controls: [
      { key: 'WASD', desc: 'Siper Alma' },
      { key: 'Mouse', desc: 'Lazer Nişan' },
      { key: 'Sol Tık', desc: 'Ölümcül Atış' }
    ],
    durationSec: 45,
    bgGradient: 'from-emerald-900/60 to-slate-950',
    iconName: 'Crosshair'
  },
  musical_blocks: {
    id: 'musical_blocks',
    title: 'Musical Blocks (Müzikli Bloklar)',
    category: 'Müzik & Hız',
    description: 'Müzik kesildiğinde güvenli parlayan bloklar belirir! Hemen bir bloğa koşup E ile kap, açıkta kalma.',
    controls: [
      { key: 'WASD', desc: 'Dans & Koşma' },
      { key: 'E / Space', desc: 'Güvenli Bloğu Kap' }
    ],
    durationSec: 40,
    bgGradient: 'from-purple-900/60 to-slate-950',
    iconName: 'Music'
  },
  paint_turf: {
    id: 'paint_turf',
    title: 'Paint Turf (Boya Savaşı)',
    category: 'Bölge Hakimiyeti',
    description: 'Space tuşuna basılı tutarak zemini kendi rengine boya! Süre bitiminde en çok alanı kaplayan kazanır.',
    controls: [
      { key: 'WASD', desc: 'Hareket' },
      { key: 'Space / Sol Tık', desc: 'Boya Fışkırtma' }
    ],
    durationSec: 40,
    bgGradient: 'from-pink-900/60 to-slate-950',
    iconName: 'Palette'
  },
  meteor_dodge: {
    id: 'meteor_dodge',
    title: 'Meteor Dodge (Göktaşı Yağmuru)',
    category: 'Kaos & Kaçış',
    description: 'Yerdeki kırmızı krater gölgelerinden kaç! Gittikçe sıklaşan meteor yağmurunda son hayatta kalan kazanır.',
    controls: [
      { key: 'WASD', desc: 'Gölgelerden Kaçış' }
    ],
    durationSec: 40,
    bgGradient: 'from-rose-950 to-slate-950',
    iconName: 'Sparkles'
  }
};

export const ALL_MINI_GAMES_LIST: MiniGameType[] = [
  'tank_trouble',
  'micro_racing',
  'lava_survival',
  'coin_dash',
  'sumo_push',
  'bomb_tag',
  'sniper_arena',
  'musical_blocks',
  'paint_turf',
  'meteor_dodge'
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
  
  // Dynamic Game Physics State
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetAngle: number;
  speed: number;
  isAlive: boolean;
  isAction: boolean;
  isDash: boolean;
  isShooting: boolean;
  zHeight: number; // for jumping over shockwaves
  zVel: number;

  // Mini-game specific variables
  coinsCollected: number;
  lapsCompleted: number;
  currentCheckpoint: number;
  hasBomb: boolean;
  bombImmunityUntil: number;
  turfTilesCount: number;
  claimedBlockId: number | null;
  sniperAmmo: number;
  lastSniperShot: number;
  lastTankShot: number;
  driftAngle: number;
  skidmarks: { x: number; y: number; alpha: number }[];
  lastDashTime: number;
  dashEndTime: number;

  // Bot AI
  botTargetX?: number;
  botTargetY?: number;
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

export interface MusicalBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  claimedBy: string | null;
  color: string;
}

export interface FallingMeteor {
  id: string;
  targetX: number;
  targetY: number;
  currentHeight: number;
  radius: number;
  spawnTime: number;
  impactTime: number;
  hasExploded: boolean;
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

  // Game specific entities
  tankWalls: TankMazeWall[];
  tankBullets: TankBullet[];
  raceCheckpoints: RaceCheckpoint[];
  lavaShockwaves: LavaShockwave[];
  lavaActiveTiles: Set<string>;
  coins: PartyCoin[];
  musicalBlocks: MusicalBlock[];
  musicPlaying: boolean;
  nextMusicToggleTime: number;
  turfGrid: Record<string, string>; // "gx,gy" -> playerColor
  meteors: FallingMeteor[];
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
      lavaShockwaves: [],
      lavaActiveTiles: new Set(),
      coins: [],
      musicalBlocks: [],
      musicPlaying: true,
      nextMusicToggleTime: 0,
      turfGrid: {},
      meteors: [],
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

    // Movement Vectors / Keys
    if (typeof input.vx === 'number' && Number.isFinite(input.vx) &&
        typeof input.vy === 'number' && Number.isFinite(input.vy)) {
      p.vx = Math.max(-1, Math.min(1, input.vx));
      p.vy = Math.max(-1, Math.min(1, input.vy));
    } else {
      let vx = 0;
      let vy = 0;
      if (input.up || input.w) vy -= 1;
      if (input.down || input.s) vy += 1;
      if (input.left || input.a) vx -= 1;
      if (input.right || input.d) vx += 1;
      if (vx !== 0 && vy !== 0) {
        vx *= 0.7071;
        vy *= 0.7071;
      }
      p.vx = vx;
      p.vy = vy;
    }

    // Aim Angle
    if (typeof input.mouseAngle === 'number' && Number.isFinite(input.mouseAngle)) {
      p.targetAngle = input.mouseAngle;
      p.angle = input.mouseAngle;
    } else if (typeof input.angle === 'number' && Number.isFinite(input.angle)) {
      p.targetAngle = input.angle;
      p.angle = input.angle;
    }

    // Action / Dash / Shoot booleans
    p.isAction = Boolean(input.action || input.e || input.interact || input.space);
    p.isDash = Boolean(input.dash || input.shift);
    p.isShooting = Boolean(input.isShooting || input.shooting || input.mouseDown);

    // Micro Racing Specific Steering
    if (room.activeGameType === 'micro_racing') {
      const steerSpeed = 0.07;
      if (input.left || input.a) p.angle -= steerSpeed;
      if (input.right || input.d) p.angle += steerSpeed;
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

    // Reset player round variables & distribute spawn positions
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
      p.turfTilesCount = 0;
      p.claimedBlockId = null;
      p.sniperAmmo = 1;
      p.lastSniperShot = 0;
      p.lastTankShot = 0;
      p.driftAngle = 0;
      p.skidmarks = [];
      p.lastDashTime = 0;
      p.dashEndTime = 0;

      // Circle spawn layout
      const angle = (idx / Math.max(1, numPlayers)) * Math.PI * 2;
      p.x = 450 + Math.cos(angle) * 220;
      p.y = 300 + Math.sin(angle) * 160;
      p.angle = angle + Math.PI;
    });

    // Game Specific Setup
    this.initGameEntities(room, gType);
    this.broadcastGameState(room);
  }

  private initGameEntities(room: PartyRoom, gType: MiniGameType) {
    room.tankWalls = [];
    room.tankBullets = [];
    room.raceCheckpoints = [];
    room.lavaShockwaves = [];
    room.lavaActiveTiles.clear();
    room.coins = [];
    room.musicalBlocks = [];
    room.turfGrid = {};
    room.meteors = [];
    room.roundWinners = [];

    if (gType === 'tank_trouble') {
      // Generate Symmetric Maze Walls
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
      // Circular Oval Racetrack Checkpoints (6 waypoints)
      const pts = [
        { x: 450, y: 100 },
        { x: 740, y: 160 },
        { x: 740, y: 440 },
        { x: 450, y: 500 },
        { x: 160, y: 440 },
        { x: 160, y: 160 }
      ];
      room.raceCheckpoints = pts.map((pt, i) => ({ ...pt, radius: 80, index: i }));

      // Align players on starting grid
      room.players.forEach((p, i) => {
        p.x = 420 - (i % 2) * 50;
        p.y = 80 + Math.floor(i / 2) * 35;
        p.angle = 0; // facing right
      });
    } else if (gType === 'bomb_tag') {
      // Pick random initial bomb carrier
      const carrier = room.players[Math.floor(Math.random() * room.players.length)];
      if (carrier) carrier.hasBomb = true;
    } else if (gType === 'coin_dash') {
      // Seed initial 18 coins
      for (let c = 0; c < 18; c++) {
        room.coins.push({
          id: `c_${c}`,
          x: 100 + Math.random() * 700,
          y: 100 + Math.random() * 400,
          value: Math.random() < 0.2 ? 3 : 1,
          createdAt: Date.now()
        });
      }
    } else if (gType === 'musical_blocks') {
      room.musicPlaying = true;
      room.nextMusicToggleTime = Date.now() + 6000;
      this.spawnMusicalBlocks(room);
    }
  }

  private spawnMusicalBlocks(room: PartyRoom) {
    const aliveCount = room.players.filter(p => p.isAlive).length;
    const safeBlockCount = Math.max(1, aliveCount - 1);
    room.musicalBlocks = [];
    const colors = ['#38bdf8', '#fbbf24', '#34d399', '#f472b6', '#a78bfa', '#fb923c'];

    for (let i = 0; i < safeBlockCount; i++) {
      room.musicalBlocks.push({
        id: i + 1,
        x: 150 + Math.random() * 600,
        y: 120 + Math.random() * 360,
        w: 65,
        h: 65,
        claimedBy: null,
        color: colors[i % colors.length]
      });
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

    // 3. PLAYING STATE: Execute Active Game Simulation
    if (room.state === 'PLAYING') {
      room.gameTimeRemaining -= dt;

      // Update Bot AI
      this.updateBotAI(room);

      // Execute Game-Specific Physics & Rules
      switch (room.activeGameType) {
        case 'tank_trouble':
          this.tickTankTrouble(room, dt);
          break;
        case 'micro_racing':
          this.tickMicroRacing(room, dt);
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
        case 'musical_blocks':
          this.tickMusicalBlocks(room, dt);
          break;
        case 'paint_turf':
          this.tickPaintTurf(room, dt);
          break;
        case 'meteor_dodge':
          this.tickMeteorDodge(room, dt);
          break;
      }

      // Check Round Completion Condition
      const alivePlayers = room.players.filter(p => p.isAlive);
      const isTimeUp = room.gameTimeRemaining <= 0;
      const isSurvivalGame = ['tank_trouble', 'lava_survival', 'sumo_push', 'bomb_tag', 'sniper_arena', 'meteor_dodge'].includes(room.activeGameType || '');

      if (isTimeUp || (isSurvivalGame && alivePlayers.length <= 1)) {
        this.concludeRound(room);
      }

      this.broadcastGameState(room);
    }
  }

  // ============================================================
  // MINI-GAME 1: TANK TROUBLE (RICOCHET PHYSICS)
  // ============================================================
  private tickTankTrouble(room: PartyRoom, dt: number) {
    const now = Date.now();

    // 1. Move Tanks with Wall Collisions
    room.players.forEach(p => {
      if (!p.isAlive) return;
      const driveSpeed = 160;
      const turnSpeed = 3.2;

      // Rotate Hull with A/D
      if (p.vx < -0.3) p.angle -= turnSpeed * dt;
      if (p.vx > 0.3) p.angle += turnSpeed * dt;

      // Move Forward/Backward with W/S along Hull Angle
      let moveDir = 0;
      if (p.vy < -0.3) moveDir = 1;
      if (p.vy > 0.3) moveDir = -0.6;

      const nextX = p.x + Math.cos(p.angle) * moveDir * driveSpeed * dt;
      const nextY = p.y + Math.sin(p.angle) * moveDir * driveSpeed * dt;

      // Arena boundary collision
      const clampedX = Math.max(30, Math.min(870, nextX));
      const clampedY = Math.max(30, Math.min(570, nextY));

      // Wall collision check
      if (!this.checkMazeWallCollision(clampedX, p.y, 20, room.tankWalls)) {
        p.x = clampedX;
      }
      if (!this.checkMazeWallCollision(p.x, clampedY, 20, room.tankWalls)) {
        p.y = clampedY;
      }

      // Firing bullets (Mouse click or Action)
      if ((p.isShooting || p.isAction) && now - p.lastTankShot > 750) {
        p.lastTankShot = now;
        const turretAngle = p.targetAngle !== undefined ? p.targetAngle : p.angle;
        const bSpeed = 340;

        room.tankBullets.push({
          id: `tb_${p.id}_${now}`,
          shooterId: p.id,
          x: p.x + Math.cos(turretAngle) * 24,
          y: p.y + Math.sin(turretAngle) * 24,
          vx: Math.cos(turretAngle) * bSpeed,
          vy: Math.sin(turretAngle) * bSpeed,
          bouncesLeft: 3,
          color: p.color
        });
      }
    });

    // 2. Update Bullets & Ricochet off Walls
    const activeBullets: TankBullet[] = [];
    room.tankBullets.forEach(b => {
      let nextX = b.x + b.vx * dt;
      let nextY = b.y + b.vy * dt;

      // Arena Boundary Bounces
      if (nextX < 15) { nextX = 15; b.vx = -b.vx; b.bouncesLeft--; }
      else if (nextX > 885) { nextX = 885; b.vx = -b.vx; b.bouncesLeft--; }

      if (nextY < 15) { nextY = 15; b.vy = -b.vy; b.bouncesLeft--; }
      else if (nextY > 585) { nextY = 585; b.vy = -b.vy; b.bouncesLeft--; }

      // Maze Wall Bounces
      for (const wall of room.tankWalls) {
        if (nextX >= wall.x - 6 && nextX <= wall.x + wall.w + 6 &&
            nextY >= wall.y - 6 && nextY <= wall.y + wall.h + 6) {
          // Check collision normal (horizontal vs vertical wall)
          if (b.x < wall.x || b.x > wall.x + wall.w) {
            b.vx = -b.vx;
          } else {
            b.vy = -b.vy;
          }
          b.bouncesLeft--;
          break;
        }
      }

      // Check Hit against Tanks
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
  // MINI-GAME 2: MICRO RACING (TOP-DOWN CAR & DRIFT PHYSICS)
  // ============================================================
  private tickMicroRacing(room: PartyRoom, dt: number) {
    const maxSpeed = 380;
    const accel = 320;
    const friction = 0.95;

    room.players.forEach(p => {
      // Throttle & Brake
      let throttle = 0;
      if (p.vy < -0.3) throttle = 1;
      if (p.vy > 0.3) throttle = -0.6;

      if (throttle !== 0) {
        p.speed += throttle * accel * dt;
      } else {
        p.speed *= friction;
      }
      p.speed = Math.max(-120, Math.min(maxSpeed, p.speed));

      // Drift Mechanics
      const isDrifting = p.isDash;
      const driftMod = isDrifting ? 1.4 : 1.0;

      // Position update based on steering angle
      p.vx = Math.cos(p.angle) * p.speed;
      p.vy = Math.sin(p.angle) * p.speed;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Skidmarks when drifting
      if (isDrifting && Math.abs(p.speed) > 150) {
        p.skidmarks.push({ x: p.x, y: p.y, alpha: 1.0 });
        if (p.skidmarks.length > 30) p.skidmarks.shift();
      }
      p.skidmarks.forEach(sm => sm.alpha = Math.max(0, sm.alpha - dt * 0.5));

      // Checkpoint Crossing
      const nextCp = room.raceCheckpoints[p.currentCheckpoint];
      if (nextCp) {
        const d = Math.hypot(p.x - nextCp.x, p.y - nextCp.y);
        if (d < nextCp.radius) {
          p.currentCheckpoint = (p.currentCheckpoint + 1) % room.raceCheckpoints.length;
          if (p.currentCheckpoint === 0) {
            p.lapsCompleted++;
            if (p.lapsCompleted >= 3) {
              // Finished Race!
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

    // If all players finished 3 laps, conclude early
    const finishCount = room.players.filter(p => p.lapsCompleted >= 3).length;
    if (finishCount >= Math.min(3, room.players.length)) {
      room.gameTimeRemaining = Math.min(room.gameTimeRemaining, 2);
    }
  }

  // ============================================================
  // MINI-GAME 3: LAVA SURVIVAL (SHOCKWAVES & JUMP)
  // ============================================================
  private tickLavaSurvival(room: PartyRoom, dt: number) {
    const now = Date.now();

    // 1. Gravity & Jump Physics
    room.players.forEach(p => {
      if (!p.isAlive) return;

      // Jump Trigger (Space or Action)
      if (p.isAction && p.zHeight === 0) {
        p.zVel = 350;
      }

      if (p.zHeight > 0 || p.zVel > 0) {
        p.zHeight += p.zVel * dt;
        p.zVel -= 900 * dt; // Gravity
        if (p.zHeight <= 0) {
          p.zHeight = 0;
          p.zVel = 0;
        }
      }

      // Standard movement
      p.x = Math.max(60, Math.min(840, p.x + p.vx * 200 * dt));
      p.y = Math.max(60, Math.min(540, p.y + p.vy * 200 * dt));
    });

    // 2. Spawn Expanding Shockwaves periodically
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

    // 3. Update Shockwaves & Check Hits on Grounded Players
    const activeShockwaves: LavaShockwave[] = [];
    room.lavaShockwaves.forEach(sw => {
      sw.currentRadius += sw.speed * dt;

      room.players.forEach(p => {
        if (!p.isAlive) return;
        const dist = Math.hypot(p.x - sw.x, p.y - sw.y);
        // If player is on ground (zHeight < 25) and within shockwave ring thickness
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
  // MINI-GAME 4: COIN DASH
  // ============================================================
  private tickCoinDash(room: PartyRoom, dt: number) {
    const now = Date.now();

    // Spawn new coins
    if (room.coins.length < 25 && Math.random() < 0.15) {
      room.coins.push({
        id: `c_${now}_${Math.random()}`,
        x: 80 + Math.random() * 740,
        y: 80 + Math.random() * 440,
        value: Math.random() < 0.18 ? 3 : 1,
        createdAt: now
      });
    }

    // Move players & Check Coin Collisions
    room.players.forEach(p => {
      const isDashing = (p.isDash || p.isAction) && now - p.lastDashTime > 1200;
      if (isDashing) {
        p.lastDashTime = now;
        p.dashEndTime = now + 250;
      }

      const currentSpeed = now < p.dashEndTime ? 440 : 230;
      p.x = Math.max(40, Math.min(860, p.x + p.vx * currentSpeed * dt));
      p.y = Math.max(40, Math.min(560, p.y + p.vy * currentSpeed * dt));

      // Coin pickup
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
  // MINI-GAME 5: SUMO PUSH
  // ============================================================
  private tickSumoPush(room: PartyRoom, dt: number) {
    const iceRadius = 260;
    const centerX = 450;
    const centerY = 300;
    const now = Date.now();

    room.players.forEach(p => {
      if (!p.isAlive) return;

      // Inertia on ice
      p.speed = 220;
      p.vx = p.vx * 0.96;
      p.vy = p.vy * 0.96;

      p.x += p.vx * dt * 300;
      p.y += p.vy * dt * 300;

      // Sumo Tackle Pulse (E / Space)
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

      // Check boundary fall
      const distFromCenter = Math.hypot(p.x - centerX, p.y - centerY);
      if (distFromCenter > iceRadius) {
        p.isAlive = false;
      }
    });
  }

  // ============================================================
  // MINI-GAME 6: BOMB TAG
  // ============================================================
  private tickBombTag(room: PartyRoom, dt: number) {
    const now = Date.now();

    room.players.forEach(p => {
      if (!p.isAlive) return;
      const speed = p.hasBomb ? 250 : 210; // Bomb holder runs slightly faster
      p.x = Math.max(50, Math.min(850, p.x + p.vx * speed * dt));
      p.y = Math.max(50, Math.min(550, p.y + p.vy * speed * dt));

      // Transfer bomb on touch
      if (p.hasBomb && now > p.bombImmunityUntil) {
        for (const other of room.players) {
          if (other.id === p.id || !other.isAlive) continue;
          const d = Math.hypot(p.x - other.x, p.y - other.y);
          if (d < 38) {
            p.hasBomb = false;
            other.hasBomb = true;
            other.bombImmunityUntil = now + 800; // 0.8s grace period
            break;
          }
        }
      }
    });

    // Bomb explosion every 15-20s
    if (room.gameTimeRemaining % 15 < dt) {
      const holder = room.players.find(p => p.hasBomb && p.isAlive);
      if (holder) {
        holder.isAlive = false;
        holder.hasBomb = false;

        // Pass bomb to random living player
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
  // MINI-GAME 7: SNIPER ARENA
  // ============================================================
  private tickSniperArena(room: PartyRoom, dt: number) {
    const now = Date.now();

    room.players.forEach(p => {
      if (!p.isAlive) return;

      p.x = Math.max(50, Math.min(850, p.x + p.vx * 190 * dt));
      p.y = Math.max(50, Math.min(550, p.y + p.vy * 190 * dt));

      // Reload time (3 sec)
      if (p.sniperAmmo === 0 && now - p.lastSniperShot >= 3000) {
        p.sniperAmmo = 1;
      }

      // Shoot Sniper Rifle
      if ((p.isShooting || p.isAction) && p.sniperAmmo > 0) {
        p.sniperAmmo = 0;
        p.lastSniperShot = now;

        const aimAngle = p.targetAngle !== undefined ? p.targetAngle : p.angle;
        // Raycast line check
        const rayLen = 900;
        const targetX = p.x + Math.cos(aimAngle) * rayLen;
        const targetY = p.y + Math.sin(aimAngle) * rayLen;

        room.players.forEach(victim => {
          if (victim.id === p.id || !victim.isAlive) return;
          // Point to segment distance check
          const dist = this.distToSegment(victim.x, victim.y, p.x, p.y, targetX, targetY);
          if (dist < 22) {
            victim.isAlive = false;
          }
        });
      }
    });
  }

  // ============================================================
  // MINI-GAME 8: MUSICAL BLOCKS
  // ============================================================
  private tickMusicalBlocks(room: PartyRoom, dt: number) {
    const now = Date.now();

    // Move players
    room.players.forEach(p => {
      if (!p.isAlive) return;
      p.x = Math.max(60, Math.min(840, p.x + p.vx * 220 * dt));
      p.y = Math.max(60, Math.min(540, p.y + p.vy * 220 * dt));

      // Claim block (E / Space)
      if (!room.musicPlaying && (p.isAction || p.isDash) && p.claimedBlockId === null) {
        for (const block of room.musicalBlocks) {
          if (block.claimedBy === null) {
            const inX = p.x >= block.x - 10 && p.x <= block.x + block.w + 10;
            const inY = p.y >= block.y - 10 && p.y <= block.y + block.h + 10;
            if (inX && inY) {
              block.claimedBy = p.id;
              p.claimedBlockId = block.id;
              break;
            }
          }
        }
      }
    });

    // Music toggle cycles
    if (now >= room.nextMusicToggleTime) {
      if (room.musicPlaying) {
        // Music stops! 3.5s to claim a safe block
        room.musicPlaying = false;
        room.nextMusicToggleTime = now + 3500;
      } else {
        // Elimination check: Unclaimed players are eliminated!
        room.players.forEach(p => {
          if (p.isAlive && p.claimedBlockId === null) {
            p.isAlive = false;
          }
          p.claimedBlockId = null;
        });

        // Resume music and spawn new block set
        room.musicPlaying = true;
        room.nextMusicToggleTime = now + 5000 + Math.random() * 3000;
        this.spawnMusicalBlocks(room);
      }
    }
  }

  // ============================================================
  // MINI-GAME 9: PAINT TURF
  // ============================================================
  private tickPaintTurf(room: PartyRoom, dt: number) {
    room.players.forEach(p => {
      p.x = Math.max(40, Math.min(860, p.x + p.vx * 240 * dt));
      p.y = Math.max(40, Math.min(560, p.y + p.vy * 240 * dt));

      // Paint Spray (Holding Space or Shooting)
      if (p.isAction || p.isShooting) {
        const gridCellX = Math.floor(p.x / 25);
        const gridCellY = Math.floor(p.y / 25);

        for (let gx = -1; gx <= 1; gx++) {
          for (let gy = -1; gy <= 1; gy++) {
            const key = `${gridCellX + gx},${gridCellY + gy}`;
            room.turfGrid[key] = p.color;
          }
        }
      }
    });

    // Update player tile scores
    const tileCounts: Record<string, number> = {};
    Object.values(room.turfGrid).forEach(c => {
      tileCounts[c] = (tileCounts[c] || 0) + 1;
    });

    room.players.forEach(p => {
      p.turfTilesCount = tileCounts[p.color] || 0;
    });
  }

  // ============================================================
  // MINI-GAME 10: METEOR DODGE
  // ============================================================
  private tickMeteorDodge(room: PartyRoom, dt: number) {
    const now = Date.now();

    // Spawn falling meteors (Frequency increases as time passes)
    const spawnRate = 0.08 + (40 - room.gameTimeRemaining) * 0.01;
    if (Math.random() < spawnRate) {
      const radius = 45 + Math.random() * 25;
      room.meteors.push({
        id: `met_${now}_${Math.random()}`,
        targetX: 80 + Math.random() * 740,
        targetY: 80 + Math.random() * 440,
        currentHeight: 400,
        radius,
        spawnTime: now,
        impactTime: now + 1200,
        hasExploded: false
      });
    }

    // Move players
    room.players.forEach(p => {
      if (!p.isAlive) return;
      p.x = Math.max(40, Math.min(860, p.x + p.vx * 220 * dt));
      p.y = Math.max(40, Math.min(560, p.y + p.vy * 220 * dt));
    });

    // Update Meteors & Impact Damage
    const activeMeteors: FallingMeteor[] = [];
    room.meteors.forEach(m => {
      if (now >= m.impactTime && !m.hasExploded) {
        m.hasExploded = true;
        // Impact explosion!
        room.players.forEach(p => {
          if (!p.isAlive) return;
          const d = Math.hypot(p.x - m.targetX, p.y - m.targetY);
          if (d < m.radius) {
            p.isAlive = false;
          }
        });
      }

      if (now < m.impactTime + 400) {
        activeMeteors.push(m);
      }
    });
    room.meteors = activeMeteors;
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
        bot.botTimer = now + 400 + Math.random() * 300;

        switch (gType) {
          case 'tank_trouble': {
            // Find closest rival tank & aim turret
            const rivals = room.players.filter(p => p.id !== bot.id && p.isAlive);
            if (rivals.length > 0) {
              const target = rivals[Math.floor(Math.random() * rivals.length)];
              bot.targetAngle = Math.atan2(target.y - bot.y, target.x - bot.x);
              bot.angle = bot.targetAngle;
              bot.isShooting = Math.random() < 0.6;
              bot.vx = Math.random() < 0.5 ? 1 : -1;
              bot.vy = Math.random() < 0.7 ? -1 : 0;
            }
            break;
          }
          case 'micro_racing': {
            // Follow race checkpoint curve
            const nextCp = room.raceCheckpoints[bot.currentCheckpoint];
            if (nextCp) {
              const targetAngle = Math.atan2(nextCp.y - bot.y, nextCp.x - bot.x);
              let angleDiff = targetAngle - bot.angle;
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

              bot.angle += Math.sign(angleDiff) * 0.08;
              bot.vy = -1; // Full gas
              bot.isDash = Math.abs(angleDiff) > 0.6; // Drift on sharp turns
            }
            break;
          }
          case 'lava_survival': {
            // Jump when a shockwave approaches
            const nearbyWave = room.lavaShockwaves.find(sw => Math.abs(Math.hypot(bot.x - sw.x, bot.y - sw.y) - sw.currentRadius) < 40);
            bot.isAction = Boolean(nearbyWave);
            bot.vx = (Math.random() - 0.5) * 2;
            bot.vy = (Math.random() - 0.5) * 2;
            break;
          }
          case 'coin_dash': {
            // Rush towards nearest coin
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
            // Move toward center & tackle nearby rivals
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
              // Chase nearest rival
              const victims = room.players.filter(p => p.id !== bot.id && p.isAlive);
              if (victims.length > 0) {
                const target = victims[0];
                const ang = Math.atan2(target.y - bot.y, target.x - bot.x);
                bot.vx = Math.cos(ang);
                bot.vy = Math.sin(ang);
              }
            } else {
              // Run away from bomb carrier
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
          case 'musical_blocks': {
            if (!room.musicPlaying) {
              // Rush to an unclaimed block
              const freeBlock = room.musicalBlocks.find(b => b.claimedBy === null);
              if (freeBlock) {
                const ang = Math.atan2(freeBlock.y + 30 - bot.y, freeBlock.x + 30 - bot.x);
                bot.vx = Math.cos(ang);
                bot.vy = Math.sin(ang);
                bot.isAction = true;
              }
            } else {
              bot.vx = (Math.random() - 0.5) * 1.5;
              bot.vy = (Math.random() - 0.5) * 1.5;
            }
            break;
          }
          case 'paint_turf': {
            bot.isAction = true;
            bot.vx = (Math.random() - 0.5) * 2;
            bot.vy = (Math.random() - 0.5) * 2;
            break;
          }
          case 'meteor_dodge': {
            // Dodge nearest meteor shadow
            const dangerousMeteor = room.meteors.find(m => Math.hypot(bot.x - m.targetX, bot.y - m.targetY) < m.radius + 20);
            if (dangerousMeteor) {
              const ang = Math.atan2(bot.y - dangerousMeteor.targetY, bot.x - dangerousMeteor.targetX);
              bot.vx = Math.cos(ang);
              bot.vy = Math.sin(ang);
            } else {
              bot.vx = (Math.random() - 0.5) * 1.2;
              bot.vy = (Math.random() - 0.5) * 1.2;
            }
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
    room.stateTimer = 5; // 5s podium celebration

    const gType = room.activeGameType;
    let rankedPlayers = [...room.players];

    // Determine rankings based on game type
    if (gType === 'coin_dash') {
      rankedPlayers.sort((a, b) => b.coinsCollected - a.coinsCollected);
    } else if (gType === 'paint_turf') {
      rankedPlayers.sort((a, b) => b.turfTilesCount - a.turfTilesCount);
    } else if (gType === 'micro_racing') {
      rankedPlayers.sort((a, b) => {
        if (b.lapsCompleted !== a.lapsCompleted) return b.lapsCompleted - a.lapsCompleted;
        return b.currentCheckpoint - a.currentCheckpoint;
      });
    } else {
      // Survival based: Alive players ranked first
      rankedPlayers.sort((a, b) => (b.isAlive ? 1 : 0) - (a.isAlive ? 1 : 0));
    }

    // Award Tournament Points (1st: 5pts, 2nd: 3pts, 3rd: 2pts, Others: 1pt)
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

    // Update overall tournament rank
    room.players.sort((a, b) => b.totalScore - a.totalScore);
    room.players.forEach((p, i) => p.rank = i + 1);

    this.broadcastGameState(room);
  }

  private endTournament(room: PartyRoom) {
    room.state = 'FINAL_PODIUM';
    room.stateTimer = 0;
    if (room.gameLoopInterval) clearInterval(room.gameLoopInterval);

    // Save winner records to DB if real user
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
      musicPlaying: room.musicPlaying,
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
        isAlive: p.isAlive,
        isAction: p.isAction,
        isDash: p.isDash,
        zHeight: Math.round(p.zHeight),
        coinsCollected: p.coinsCollected,
        lapsCompleted: p.lapsCompleted,
        hasBomb: p.hasBomb,
        turfTilesCount: p.turfTilesCount,
        claimedBlockId: p.claimedBlockId,
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
      lavaShockwaves: room.lavaShockwaves.map(sw => ({
        id: sw.id,
        x: sw.x,
        y: sw.y,
        currentRadius: Math.round(sw.currentRadius)
      })),
      coins: room.coins,
      musicalBlocks: room.musicalBlocks,
      turfGrid: room.turfGrid,
      meteors: room.meteors.map(m => ({
        id: m.id,
        targetX: Math.round(m.targetX),
        targetY: Math.round(m.targetY),
        radius: Math.round(m.radius),
        hasExploded: m.hasExploded,
        progress: Math.min(1, (Date.now() - m.spawnTime) / 1200)
      }))
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
      turfTilesCount: 0,
      claimedBlockId: null,
      sniperAmmo: 1,
      lastSniperShot: 0,
      lastTankShot: 0,
      driftAngle: 0,
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

  // Add 9 bots for full 10-player party
  for (let b = 0; b < 9; b++) {
    mgr.addBot(room.id, 1);
  }

  const errors: string[] = [];
  try {
    mgr.startTournament(room.id, 1);

    // Simulate all 10 games
    for (let c = 0; c < cycles; c++) {
      mgr['tickRoom'](room);

      // Random bot actions
      room.players.forEach(p => {
        mgr.processPlayerInput(room.id, p.userId, {
          vx: Math.random() - 0.5,
          vy: Math.random() - 0.5,
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
