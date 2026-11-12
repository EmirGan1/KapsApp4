import { grenadeEffect, grenadeLaunch, isGrenade, stepGrenade } from "../games/kapsstrike/grenades";
import { monitorEventLoopDelay } from "node:perf_hooks";
import {advanceReload} from '../games/kapsstrike/reload';
import {dropBombWeapon,pickupBombWeapon} from '../games/kapsstrike/bombWeapons';
import {safeSpawn,spreadSpawn} from "../games/kapsstrike/spawns";
import {tracePlayer} from '../games/kapsstrike/hitboxes';
import {BOMB_RULES,bombView,bombPurchaseError,createBombMatch,stepBomb,bombInteract,dropBomb,buyBombEquipment,refundBombEquipment,bombWinTarget,isBombPrimary,type BombMatch} from "../games/kapsstrike/bomb";
import {createWorld,advanceWorld,claimSupply,dropInventory} from '../games/kapsstrike/world';
import { randomBytes } from "node:crypto";
import { StrikeInventory } from "./strikeInventory";
import { StrikeProfiles } from "./strikeProfiles";
import { SkinId } from "../games/kapsstrike/skins";
import { Server, Socket } from "socket.io";
import { Client as LibsqlClient } from "@libsql/client";
import {
  StrikeWorld,
  MapId,
  WeaponId,
  Vec3,
  InputCommand,
  MovementState,
  WeaponState,
  PlayerState,
  CombatEvent,
  StrikeGameMode,
  StrikeTeam,
  StrikeRoomStatus,
  NetworkPlayer,
  PlayerSnapshot,
  StrikeSnapshot,
  KillFeedEntry,
  StrikeRoomState,
  StrikeRoomSummary,
  MatchStats,
} from "../games/kapsstrike/types";
import { MAPS } from "../games/kapsstrike/maps";
import { PHYSICS as C, ownsWeapon, WEAPONS, WEAPON_ORDER, TARGET_HITBOXES } from "../games/kapsstrike/config";
import { newMovement, move, fits, clamp, raySolid, rayBox, collisionSolids } from "../games/kapsstrike/physics";
import { aimDirection, eye, fireDelay, spreadFor, weaponDamage, shotDirection } from "../games/kapsstrike/combat";

function clonePlayerState(s: PlayerState): PlayerState {
  return {
    ...s,
    movement: {
      ...s.movement,
      position: { ...s.movement.position },
      velocity: { ...s.movement.velocity },
      spawnPosition: s.movement.spawnPosition ? { ...s.movement.spawnPosition } : undefined,
      lastSafePosition: s.movement.lastSafePosition ? { ...s.movement.lastSafePosition } : undefined,
    },
    weapon: {
      ...s.weapon,
      ammo: { ...s.weapon.ammo },
      inventory: s.weapon.inventory ? [...s.weapon.inventory] : undefined,
    },
  };
}

function cloneWorld(w: StrikeWorld): StrikeWorld {
  return {
    ...w,
    pickups: w.pickups.map((p) => ({
      ...p,
      position: { ...p.position },
      weapons: p.weapons ? [...p.weapons] : undefined,
    })),
    drop: w.drop ? { ...w.drop, position: { ...w.drop.position } } : undefined,
    respawns: w.respawns
      ? w.respawns.map((r) => ({
          at: r.at,
          pickup: { ...r.pickup, position: { ...r.pickup.position }, weapons: r.pickup.weapons ? [...r.pickup.weapons] : undefined },
        }))
      : undefined,
  };
}

export interface ServerLoopDiagnostics {
  serverLoopMaxMs?: number;
  serverLoopP50Ms?: number;
  serverLoopP95Ms?: number;
  serverCpuPercent?: number;
  serverTickP95Ms?: number;
  serverTickMaxMs?: number;
}

let loopDelay: ReturnType<typeof monitorEventLoopDelay> | undefined;
let lastWindowDiagnostics: { maxMs?: number; p50Ms?: number; p95Ms?: number } = {};
let lastCpuUsage = process.cpuUsage();
let lastCpuSampleAt = performance.now();
let recentCpuPercent = 0;
const recentTickDurationsMs: number[] = [];

function recordTickDurationMs(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  recentTickDurationsMs.push(ms);
  if (recentTickDurationsMs.length > 240) recentTickDurationsMs.shift();
}

export function gameLoopDiagnostics(): ServerLoopDiagnostics {
  if (!loopDelay) {
    const histogram = monitorEventLoopDelay({ resolution: 10 });
    histogram.enable();
    loopDelay = histogram;
    setInterval(() => {
      if (histogram.count > 0) {
        lastWindowDiagnostics = {
          maxMs: Math.max(0, Math.round(histogram.max / 1e6 - 10)),
          p50Ms: Math.max(0, Math.round(histogram.percentile(50) / 1e6 - 10)),
          p95Ms: Math.max(0, Math.round(histogram.percentile(95) / 1e6 - 10)),
        };
      }
      histogram.reset();
    }, 5000).unref();
  }

  const now = performance.now();
  const elapsedMs = now - lastCpuSampleAt;
  if (elapsedMs >= 500) {
    const diff = process.cpuUsage(lastCpuUsage);
    lastCpuUsage = process.cpuUsage();
    lastCpuSampleAt = now;
    const totalCpuMs = (diff.user + diff.system) / 1000;
    recentCpuPercent = Math.min(1000, Math.round((totalCpuMs / elapsedMs) * 1000) / 10);
  }

  const liveCount = loopDelay.count;
  const serverLoopMaxMs = liveCount > 0
    ? Math.max(0, Math.round(loopDelay.max / 1e6 - 10), lastWindowDiagnostics.maxMs ?? 0)
    : lastWindowDiagnostics.maxMs;
  const serverLoopP50Ms = liveCount > 0
    ? Math.max(0, Math.round(loopDelay.percentile(50) / 1e6 - 10))
    : lastWindowDiagnostics.p50Ms;
  const serverLoopP95Ms = liveCount > 0
    ? Math.max(0, Math.round(loopDelay.percentile(95) / 1e6 - 10), lastWindowDiagnostics.p95Ms ?? 0)
    : lastWindowDiagnostics.p95Ms;

  let serverTickP95Ms: number | undefined;
  let serverTickMaxMs: number | undefined;
  if (recentTickDurationsMs.length > 0) {
    const sorted = [...recentTickDurationsMs].sort((a, b) => a - b);
    serverTickP95Ms = Math.round(sorted[Math.floor(sorted.length * 0.95)] * 100) / 100;
    serverTickMaxMs = Math.round(sorted[sorted.length - 1] * 100) / 100;
  }

  return {
    serverLoopMaxMs,
    serverLoopP50Ms,
    serverLoopP95Ms,
    serverCpuPercent: recentCpuPercent,
    serverTickP95Ms,
    serverTickMaxMs,
  };
}

function gameLoopDelayMs(): number | undefined {
  return gameLoopDiagnostics().serverLoopMaxMs;
}

export interface StrikeServerConfig {
  tickRate: number; // Poll at the 120 Hz physics cadence; no extra simulation steps.
  snapshotRate: number; // 30 Hz, independent of 120 Hz physics
  maxLagCompTicks: number; // 60 shared physics ticks = 500ms
}

export const SERVER_CONFIG: StrikeServerConfig = {
  tickRate: 120,
  snapshotRate: 30,
  maxLagCompTicks: 60,
};

interface HistoricalPosition {
  tick: number;
  time: number;
  position: Vec3;
  stance: "stand" | "crouch" | "slide";
  height: number;
  hp: number;
  yaw:number;pitch:number;
}

export class StrikeServerPlayer {
  skin: SkinId = "classic";
  cosmeticLoadout:import("../games/kapsstrike/cosmetics").Inventory["equipped"]={};
  id: string; // Socket ID
  userId: number;
  username: string;
  avatar: string | null;
  color: string;
  team: StrikeTeam;
  originalTeam: StrikeTeam = "none";
  isHost: boolean;
  ready: boolean;
  isDisconnected = false;
  disconnectedAt?: number;
  state: PlayerState;
  damageCredits = new Map<string,{amount:number;tick:number}>();
  kills = 0;
  deaths = 0;
  assists = 0;
  score = 0;
  damage = 0;
  headshots = 0;
  ping = 0;
  lastPingTime = 0;
  lastSequence = -1;
  lastQueuedSequence = -1;
  lastInputTick = 0;
  heldInput?: InputCommand;
  inputQueue: InputCommand[] = [];
  history: HistoricalPosition[] = [];
  receivedInputs=new Map<number,{receivedAt:number;receivedTick:number}>();
  pendingFire?:{weapon:WeaponId;index:number;until:number;command:InputCommand;received?:{receivedAt:number;receivedTick:number}};
  activeCommand?:InputCommand;
  activeReceive?:{receivedAt:number;receivedTick:number};
  isSpeaking = false;
  isMuted = false;

  constructor(
    socketId: string,
    userId: number,
    username: string,
    avatar: string | null,
    color: string,
    team: StrikeTeam,
    spawnPos: Vec3,
    isHost = false
  ) {
    this.id = socketId;
    this.userId = userId;
    this.username = username;
    this.avatar = avatar;
    this.color = color;
    this.team = team;
    this.originalTeam = team;
    this.isHost = isHost;
    this.ready = isHost; // Host starts ready

    const ammo = Object.fromEntries(
      WEAPON_ORDER.map((k) => [k, WEAPONS[k].capacity])
    ) as Record<WeaponId, number>;

    this.state = {
      id: socketId,
      movement: newMovement(spawnPos),
      weapon: {
        selected: "rifle",
        ammo,
        nextFire: 0,
        reloadUntil: 0,
        switchUntil: 0,
        triggerHeld: false,
        shotIndex: 0,
      },
      hp: 100,
      armor:0,
      deadUntil: 0,
      protectedUntil: C.protectionTicks,
      yaw: 0,
      pitch: 0,
    };
  }

  recordHistory(tick: number, time: number) {
    if(this.history.at(-1)?.tick===tick)this.history.pop();
    this.history.push({
      tick,
      time,
      position: { ...this.state.movement.position },
      yaw:this.state.yaw,pitch:this.state.pitch,
      stance: this.state.movement.stance,
      height: this.state.movement.height,
      hp: this.state.hp,
    });
    if (this.history.length > 60) {
      this.history.shift();
    }
  }

  getHistoricalPosition(targetTick:number):{position:Vec3;height:number;hp:number;yaw:number;pitch:number}{
    const live={position:{...this.state.movement.position},height:this.state.movement.height,hp:this.state.hp,yaw:this.state.yaw,pitch:this.state.pitch};
    if(!this.history.length)return live;
    const frames=this.history;
    if(targetTick<=frames[0].tick)return {...frames[0],position:{...frames[0].position}};
    for(let i=frames.length-1;i>=0;i--){const a=frames[i],b=frames[i+1];if(a.tick<=targetTick){
      if(!b||a.hp<=0||b.hp<=0||Math.hypot(b.position.x-a.position.x,b.position.y-a.position.y,b.position.z-a.position.z)>3)return {...a,position:{...a.position}};
      const t=clamp((targetTick-a.tick)/(b.tick-a.tick),0,1),angle=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
      return {position:{x:a.position.x+(b.position.x-a.position.x)*t,y:a.position.y+(b.position.y-a.position.y)*t,z:a.position.z+(b.position.z-a.position.z)*t},height:a.height+(b.height-a.height)*t,hp:a.hp,yaw:a.yaw+angle*t,pitch:a.pitch+(b.pitch-a.pitch)*t};
    }}return live;
  }

}

export class StrikeRoom {
  bomb?:BombMatch;
  rewardMatchId=randomBytes(12).toString('hex');
  world: StrikeWorld;
  roomCode: string;
  name: string;
  map: MapId;
  mode: StrikeGameMode;
  status: StrikeRoomStatus = "lobby";
  maxPlayers: number;
  scoreLimit: number = 30;
  timeLimit: number = 300;
  bombRounds?: number;
  timeLeft: number;
  hostId: number;
  password?: string;
  players: Map<string, StrikeServerPlayer> = new Map();
  teamScores: { red: number; blue: number } = { red: 0, blue: 0 };
  killFeed: KillFeedEntry[] = [];
  events: CombatEvent[] = [];
  eventId = 0;
  tick = 0;
  loopInterval: any = null;
  createdAt = Date.now();
  winner?: {
    team?: StrikeTeam;
    userId?: number;
    username?: string;
    reason: string;
  };

  constructor(
    roomCode: string,
    name: string,
    map: MapId,
    mode: StrikeGameMode,
    maxPlayers: number,
    hostId: number,
    timeLimit = 300,
    scoreLimit = 30,
    password?: string
  ) {
    this.world = createWorld(MAPS[map]);
    this.roomCode = roomCode;
    this.name = name;
    this.map = map;
    this.mode = mode;
    this.maxPlayers = Math.max(2, Math.min(10, maxPlayers));
    this.hostId = hostId;
    this.scoreLimit = scoreLimit;
    this.timeLimit = timeLimit;
    this.timeLeft = timeLimit;
    this.password = typeof password === "string" && password.trim().length > 0 ? password.trim() : undefined;
  }

  addEvent(eventData: Omit<CombatEvent, "id" | "tick">) {
    this.events.push({
      id: ++this.eventId,
      tick: this.tick,
      ...eventData,
    });
    if (this.events.length > 64) {
      this.events.shift();
    }
  }

  getPublicRoomState(): StrikeRoomState {
    const playerList: NetworkPlayer[] = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.username,
      skin: p.skin,
      weaponSkin:p.cosmeticLoadout[p.state.weapon.selected],
      avatar: p.avatar,
      color: p.color,
      team: p.team,
      isHost: p.isHost,
      ready: p.ready,
      isAlive: p.state.hp > 0,
      hp: p.state.hp,
      position: {...p.state.movement.position},
      velocity: {...p.state.movement.velocity},
      yaw: p.state.yaw,
      pitch: p.state.pitch,
      stance: p.state.movement.stance,
      selectedWeapon: p.state.weapon.selected,
      ammo: p.state.weapon.ammo,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      score: p.score,
      damage: p.damage,
      headshots: p.headshots,
      ping: p.ping,
      isSpeaking: p.isSpeaking,
      isMuted: p.isMuted,
    }));

    return {
      roomCode: this.roomCode,
      name: this.name,
      map: this.map,
      mode: this.mode,
      status: this.status,
      maxPlayers: this.maxPlayers,
      scoreLimit: this.scoreLimit,
      timeLimit: this.timeLimit,
      bombRounds: this.mode === "bomb" ? this.bombRounds : undefined,
      timeLeft: this.timeLeft,
      hostId: this.hostId,
      hasPassword: !!this.password,
      teamScores: { ...this.teamScores },
      players: playerList,
      killFeed: [...this.killFeed],
      winner: this.winner,
    };
  }

  buildSharedSnapshotBase() {
    const playerSnapshots: PlayerSnapshot[] = Array.from(this.players.values()).map((p) => ({
      connected: !p.isDisconnected,
      id: p.id,
      userId: p.userId,
      username: p.username,
      skin: p.skin,
      weaponSkin: p.cosmeticLoadout[p.state.weapon.selected],
      team: p.team,
      color: p.color,
      hp: p.state.hp,
      position: { ...p.state.movement.position },
      velocity: { ...p.state.movement.velocity },
      yaw: p.state.yaw,
      pitch: p.state.pitch,
      stance: p.state.movement.stance,
      selectedWeapon: p.state.weapon.selected,
      deadUntil: p.state.deadUntil,
      protectedUntil: p.state.protectedUntil,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score,
      assists: p.assists,
      damage: p.damage,
      headshots: p.headshots,
      ping: p.ping,
    }));

    return {
      tick: this.tick,
      roomCode: this.roomCode,
      world: this.map === 'bolluca' ? createWorld(MAPS.bolluca) : cloneWorld(this.world),
      serverTime: Date.now(),
      players: playerSnapshots,
      teamScores: this.mode !== "ffa" ? { ...this.teamScores } : undefined,
      timeLeft: this.timeLeft,
      events: [...this.events],
    };
  }

  getSnapshotForPlayer(playerSocketId: string, sharedBase?: ReturnType<StrikeRoom["buildSharedSnapshotBase"]>): StrikeSnapshot {
    const targetPlayer = this.players.get(playerSocketId);
    const ackSequence = targetPlayer ? targetPlayer.lastSequence : 0;
    const base = sharedBase ?? this.buildSharedSnapshotBase();

    return {
      tick: base.tick,
      roomCode: base.roomCode,
      world: base.world,
      localState: targetPlayer ? clonePlayerState(targetPlayer.state) : undefined,
      serverTime: base.serverTime,
      ackSequence,
      bomb: this.bomb ? bombView(this.bomb, playerSocketId) : undefined,
      players: base.players,
      teamScores: base.teamScores ? { ...base.teamScores } : undefined,
      timeLeft: base.timeLeft,
      events: base.events,
    };
  }

  getSpawnPosition(team: StrikeTeam, playerIndex: number, occupied: readonly Vec3[] = [...this.players.values()].filter(p=>p.state.hp>0).map(p=>p.state.movement.position)): Vec3 {
    const mapDef = MAPS[this.map];
    if (this.mode === "bomb") {
      const half = Math.max(1, Math.floor(mapDef.spawns.length / 2));
      const pool = team === "red" ? mapDef.spawns.slice(0, half) : mapDef.spawns.slice(half);
      return safeSpawn(mapDef,pool,playerIndex,occupied);
    }
    return spreadSpawn(mapDef,playerIndex,occupied);
  }
}

export class KapsStrikeServerManager {
  readonly rooms: Map<string, StrikeRoom> = new Map();
  private userToRoom: Map<number, string> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private disconnectedSessions: Map<number, {
    roomCode: string;
    userId: number;
    username: string;
    avatar: string | null;
    color: string;
    team: StrikeTeam;
    originalTeam: StrikeTeam;
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    damage: number;
    headshots: number;
    bombPlayer?: any;
    disconnectedAt: number;
  }> = new Map();

  /** Local developer-only ring buffer; never included in public room/snapshot state. */
  readonly combatDiagnostics:Record<string,unknown>[]=[];
  private diagnostic(value:Record<string,unknown>){if(!this.combatDebug)return;this.combatDiagnostics.push(value);if(this.combatDiagnostics.length>256)this.combatDiagnostics.shift();}
  readonly profiles: StrikeProfiles;
  readonly inventory: StrikeInventory;
  constructor(
    private io: Server,
    private dbClient?: LibsqlClient,
    private combatDebug=process.env.NODE_ENV!=='production'&&process.env.STRIKE_COMBAT_DEBUG==='1'
  ) { this.profiles = new StrikeProfiles(dbClient); this.inventory=new StrikeInventory(dbClient); }

  public getRoomsList(): StrikeRoomSummary[] {
    const list: StrikeRoomSummary[] = [];
    this.rooms.forEach((r) => {
      const host = Array.from(r.players.values()).find((p) => p.userId === r.hostId);
      list.push({
        id: r.roomCode,
        roomCode: r.roomCode,
        name: r.name,
        map: r.map,
        mode: r.mode,
        status: r.status,
        playerCount: r.players.size,
        maxPlayers: r.maxPlayers,
        hostId: r.hostId,
        hostName: host ? host.username : "Oda Yöneticisi",
        hasPassword: !!r.password,
      });
    });
    return list;
  }

  public getUnifiedTables(): any[] {
    const list: any[] = [];
    this.rooms.forEach((r) => {
      const host = Array.from(r.players.values()).find((p) => p.userId === r.hostId);
      const minutes = Math.floor(Math.max(0, r.timeLeft) / 60);
      const seconds = Math.floor(Math.max(0, r.timeLeft) % 60);
      const timeLeftFormatted = `${minutes}:${String(seconds).padStart(2, "0")}`;
      const modeLabel = r.mode === "bomb" ? "BOMBA KURMA" : r.mode === "tdm" ? "TAKIM SAVAŞI (TDM)" : "HERKES TEK (FFA)";
      const mapLabel = MAPS[r.map]?.name || r.map;
      list.push({
        id: r.roomCode,
        gameType: "strike",
        title: r.name || `KapsStrike · ${r.roomCode}`,
        hostId: r.hostId,
        hostName: host ? host.username : "Masa Yöneticisi",
        hostAvatar: host ? host.avatar : null,
        playerCount: r.players.size,
        maxPlayers: r.maxPlayers,
        botCount: 0,
        status: r.status === "in_progress" ? "Oyunda" : "Lobi Bekliyor",
        minBet: 0,
        maxBet: 0,
        isPrivate: !!r.password,
        gameMode: modeLabel,
        mapName: mapLabel,
        timeLeftStr: timeLeftFormatted,
        timeLeft: r.timeLeft,
        strikeMode: r.mode,
        createdAt: "Bugün",
        updatedAt: r.createdAt,
      });
    });
    return list;
  }

  private broadcastRoomsList() {
    const summaries = this.getRoomsList();
    this.io.emit("strike:rooms_list", summaries);
    this.io.emit("strike:room_list", summaries);
    this.io.emit("active_tables_updated", this.getUnifiedTables());
  }

  private broadcastRoomState(room: StrikeRoom, syncRoomsList: boolean = true) {
    const state = room.getPublicRoomState();
    this.io.to(`strike:${room.roomCode}`).emit("strike:room_state", state);
    if (syncRoomsList) {
      this.broadcastRoomsList();
    }
  }

  public findRoomByCode(rawCode: string): StrikeRoom | undefined {
    if (!rawCode || typeof rawCode !== "string") return undefined;
    const clean = rawCode.trim().toUpperCase();
    if (!clean) return undefined;

    // 1. Exact match
    if (this.rooms.has(clean)) return this.rooms.get(clean);

    // 2. Match with "KS-" prefix
    const withPrefix = clean.startsWith("KS-") ? clean : `KS-${clean}`;
    if (this.rooms.has(withPrefix)) return this.rooms.get(withPrefix);

    // 3. Match without "KS-" prefix
    const withoutPrefix = clean.startsWith("KS-") ? clean.slice(3) : clean;
    if (this.rooms.has(withoutPrefix)) return this.rooms.get(withoutPrefix);

    // 4. Match pure alphanumeric characters (e.g. "KS AB12" -> "KSAB12")
    const cleanAlpha = clean.replace(/[^A-Z0-9]/g, "");
    for (const [code, r] of this.rooms.entries()) {
      const codeAlpha = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (codeAlpha === cleanAlpha) return r;
      if (code.toUpperCase() === clean || code.toUpperCase() === withPrefix) return r;
    }
    return undefined;
  }

  public createRoom(
    user: { id: number; username: string; avatar: string | null; color?: string },
    socketId: string,
    options: {
      name?: string;
      map?: MapId;
      mode?: StrikeGameMode;
      maxPlayers?: number;
      timeLimit?: number;
      scoreLimit?: number;
      bombRounds?: number;
      password?: string;
    }
  ): StrikeRoom {
    this.removePreviousMembership(user.id, socketId);
    // Cryptographically random 64-bit room code; UI also accepts the prefix-free form.
    let roomCode = "";
    do {
      roomCode = "KS-" + randomBytes(8).toString("hex").toUpperCase();
    } while (this.rooms.has(roomCode));

    const requestedMap = options.map && Object.hasOwn(MAPS, options.map) ? MAPS[options.map] : undefined;
    const mapId: MapId = options.mode === "bomb"
      ? requestedMap?.bombSites ? requestedMap.id : "district"
      : requestedMap?.id === "bolluca" ? "warehouse" : requestedMap?.id ?? "warehouse";
    const mode: StrikeGameMode = options.mode === "bomb" ? "bomb" : options.mode === "tdm" ? "tdm" : "ffa";
    const maxPlayers = Math.max(2, Math.min(10, Number(options.maxPlayers) || 8));
    const timeLimit = Math.max(60, Math.min(900, Number(options.timeLimit) || 300));
    const scoreLimit = Math.max(10, Math.min(100, Number(options.scoreLimit) || (mode === "tdm" ? 50 : 30)));
    const roomName = (options.name || `${user.username}'in Odası`).trim().slice(0, 32);

    const room = new StrikeRoom(
      roomCode,
      roomName,
      mapId,
      mode,
      maxPlayers,
      user.id,
      timeLimit,
      scoreLimit,
      options.password
    );

    if (options.bombRounds !== undefined) room.bombRounds = bombWinTarget(options.bombRounds);

    const team: StrikeTeam = mode !== "ffa" ? "red" : "none";
    const spawn = room.getSpawnPosition(team, 0);
    const hostPlayer = new StrikeServerPlayer(
      socketId,
      user.id,
      user.username,
      user.avatar,
      user.color || "#3b82f6",
      team,
      spawn,
      true
    );

    hostPlayer.skin = this.profiles.cache.get(user.id) || "classic";
    hostPlayer.cosmeticLoadout=this.inventory.cache.get(user.id)?.equipped||{};
    room.players.set(socketId, hostPlayer);
    this.rooms.set(roomCode, room);
    this.userToRoom.set(user.id, roomCode);
    this.socketToRoom.set(socketId, roomCode);

    this.broadcastRoomsList();
    return room;
  }

  private roomInvites = new Map<string,{target:number;sender:number;roomCode:string;expires:number}>();

  public joinRoom(
    roomCode: string,
    user: { id: number; username: string; avatar: string | null; color?: string },
    socketId: string,
    password?: string,
    invited = false
  ): { success: boolean; room?: StrikeRoom; error?: string } {
    const room = this.findRoomByCode(roomCode);
    if (!room) {
      return { success: false, error: "Oda bulunamadı veya kapatılmış olabilir." };
    }

    roomCode = room.roomCode; // Store canonical codes even when users join without KS-.
    if (!invited && room.players.get(socketId)?.userId !== user.id && room.password && room.password !== (password || "").trim()) {
      return { success: false, error: "Hatalı oda şifresi." };
    }

    // A reconnect replaces the previous controller even when the room is full.
    const savedSession = this.disconnectedSessions.get(user.id);
    for (const [sId, p] of room.players.entries()) {
      if (p.userId === user.id) {
        if(sId === socketId) return {success:true,room};
        this.socketToRoom.delete(sId);
        const previous=this.io.sockets?.sockets?.get(sId);
        previous?.emit("strike:session_replaced");previous?.leave(`strike:${roomCode}`);
        p.id = socketId;p.state.id=socketId;p.isDisconnected=false;delete p.disconnectedAt;
        p.lastSequence=-1;p.lastQueuedSequence=-1;
        p.inputQueue=[];p.receivedInputs.clear();p.heldInput=undefined;p.lastInputTick=room.tick;p.history=[];p.state.weapon.triggerHeld=false;
        // Guarantee player returns to their exact original team
        if (p.originalTeam) {
          const side=room.bomb?.players[sId]?.team;
          p.team = side ? (side==='T'?'red':'blue') : p.originalTeam;
          p.originalTeam=p.team;
          p.color = p.team === "red" ? "#ef4444" : p.team === "blue" ? "#3b82f6" : "#10b981";
        }
        if(room.bomb?.players[sId]){
          const bp=room.bomb.players[sId];
          delete room.bomb.players[sId];
          bp.id=socketId;
          room.bomb.players[socketId]=bp;
          if(room.bomb.carrier===sId)room.bomb.carrier=socketId;
          if(room.bomb.action?.player===sId)delete room.bomb.action;
        } else if (room.bomb && savedSession?.bombPlayer) {
          room.bomb.players[socketId] = { ...savedSession.bombPlayer, id: socketId };
        }
        room.players.delete(sId);room.players.set(socketId,p);
        this.socketToRoom.set(socketId,roomCode);this.userToRoom.set(user.id,roomCode);
        this.disconnectedSessions.delete(user.id);
        const newSock = this.io.sockets?.sockets?.get(socketId);
        newSock?.join(`strike:${roomCode}`);
        this.broadcastRoomState(room);
        this.io.to(`strike:${room.roomCode}`).emit("strike:player_reconnected", {
          userId: user.id,
          username: p.username,
          team: p.team
        });
        return {success:true,room};
      }
    }

    const isReconnecting = savedSession?.roomCode === room.roomCode;
    if (room.players.size >= room.maxPlayers && !isReconnecting) return {success:false,error:"Oda dolu."};
    this.removePreviousMembership(user.id,socketId);

    let team: StrikeTeam = "none";
    if (isReconnecting && savedSession) {
      // Reconnect to exact prior team (Red/Blue in TDM or T/CT in Bomb)
      team = savedSession.team;
    } else if (room.mode !== "ffa") {
      let redCount = 0;
      let blueCount = 0;
      room.players.forEach((p) => {
        if (p.team === "red") redCount++;
        else if (p.team === "blue") blueCount++;
      });
      team = redCount === blueCount ? (room.status === "lobby" || Math.random() < .5 ? "red" : "blue") : redCount < blueCount ? "red" : "blue";
    }

    const spawn = room.getSpawnPosition(team, room.players.size);
    const player = new StrikeServerPlayer(
      socketId,
      user.id,
      user.username,
      user.avatar,
      user.color || (team === "red" ? "#ef4444" : team === "blue" ? "#3b82f6" : "#10b981"),
      team,
      spawn,
      false
    );

    if (isReconnecting && savedSession) {
      player.kills = savedSession.kills;
      player.deaths = savedSession.deaths;
      player.assists = savedSession.assists;
      player.score = savedSession.score;
      player.damage = savedSession.damage;
      player.headshots = savedSession.headshots;
      player.originalTeam = savedSession.originalTeam || savedSession.team;
      if (room.bomb && savedSession.bombPlayer) {
        room.bomb.players[socketId] = { ...savedSession.bombPlayer, id: socketId };
      }
      this.disconnectedSessions.delete(user.id);
    }

    if (room.status === "in_progress") {
      player.state.protectedUntil = room.tick + C.protectionTicks;
      if (room.bomb && !room.bomb.players[socketId]) {
        const alive = room.bomb.phase === "buy";
        room.bomb.players[socketId] = {
          id: socketId, team: team === "red" ? "T" : "CT", alive, position: { ...spawn },
          money: BOMB_RULES.startMoney, armor: 0, kit: false, weapons: ["pistol", "knife"], plants: 0, defuses: 0, holdUntil: 0,
        };
        player.state.weapon.inventory = ["pistol", "knife"];
        player.state.weapon.selected = "pistol";
        player.state.hp = alive ? 100 : 0;
      } else if (room.bomb?.players[socketId]) {
        const member = room.bomb.players[socketId];
        player.state.hp = member.alive ? 100 : 0;
        player.state.armor = member.armor;
        player.state.weapon.inventory = [...member.weapons];
        player.state.weapon.selected = member.weapons.find(isBombPrimary) ?? "pistol";
      }
    }

    player.skin = this.profiles.cache.get(user.id) || "classic";
    player.cosmeticLoadout=this.inventory.cache.get(user.id)?.equipped||{};
    room.players.set(socketId, player);
    this.userToRoom.set(user.id, roomCode);
    this.socketToRoom.set(socketId, roomCode);

    const newSock = this.io.sockets?.sockets?.get(socketId);
    newSock?.join(`strike:${roomCode}`);

    this.broadcastRoomState(room);
    if (isReconnecting) {
      this.io.to(`strike:${room.roomCode}`).emit("strike:player_reconnected", {
        userId: user.id,
        username: player.username,
        team: player.team
      });
    }
    return { success: true, room };
  }

  public quickMatch(
    user: { id: number; username: string; avatar: string | null; color?: string },
    socketId: string
  ): { success: boolean; room: StrikeRoom } {
    // Look for an available public room (lobby or running with space)
    for (const room of this.rooms.values()) {
      if (!room.password && room.players.size < room.maxPlayers) {
        const joinRes = this.joinRoom(room.roomCode, user, socketId);
        if (joinRes.success && joinRes.room) {
          return { success: true, room: joinRes.room };
        }
      }
    }
    // No suitable room found -> create an open room
    const created = this.createRoom(user, socketId, {
      name: `${user.username} Hızlı Maç`,
      mode: "tdm",
      maxPlayers: 8,
    });
    return { success: true, room: created };
  }

  private removePreviousMembership(userId:number, socketId:string) {
    const previousCode=this.userToRoom.get(userId) || this.socketToRoom.get(socketId);
    const previous=previousCode ? this.rooms.get(previousCode) : undefined;
    if(!previous)return;
    for(const [id,p] of previous.players)if(p.userId===userId){
      const old=this.io.sockets?.sockets?.get(id);
      old?.leave(`strike:${previous.roomCode}`);
      if(id!==socketId)old?.emit("strike:session_replaced");
      this.leaveRoom(id,userId);break;
    }
  }

  public leaveRoom(socketId: string, userId: number, force = false): void {
    const roomCode = this.socketToRoom.get(socketId) || this.userToRoom.get(userId);
    if (!roomCode) return;
    const room = this.rooms.get(roomCode);
    if (!room) return;
    const player = room.players.get(socketId) || Array.from(room.players.values()).find(p => p.userId === userId);
    if (!player || player.userId !== userId) return;

    const actualSocketId = player.id;
    const wasHost = player.isHost;

    if(room.bomb){
      dropBomb(room.bomb,actualSocketId);
      if(room.bomb.action?.player===actualSocketId)delete room.bomb.action;
      delete room.bomb.players[actualSocketId];
    }
    room.players.delete(actualSocketId);
    this.socketToRoom.delete(actualSocketId);
    if(this.userToRoom.get(userId)===roomCode)this.userToRoom.delete(userId);
    this.disconnectedSessions.delete(userId);

    const hasHuman = [...room.players.values()].some((p) => !p.id.startsWith("bot-") && !p.isDisconnected);
    if (room.players.size === 0 || !hasHuman) {
      if (room.loopInterval) {
        clearInterval(room.loopInterval);
        room.loopInterval = null;
      }
      this.rooms.delete(roomCode);
      this.broadcastRoomsList();
      return;
    }

    if (wasHost) {
      const nextHost = Array.from(room.players.values()).find(p => !p.id.startsWith("bot-") && !p.isDisconnected) || Array.from(room.players.values())[0];
      if (nextHost) {
        nextHost.isHost = true;
        nextHost.ready = true;
        room.hostId = nextHost.userId;
      }
    }

    this.broadcastRoomState(room);
  }

  public setReady(socketId: string, ready: boolean): boolean {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return false;
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== "lobby") return false;

    const player = room.players.get(socketId);
    if (!player) return false;

    player.ready = ready;
    this.broadcastRoomState(room, false);
    return true;
  }

  public switchTeam(socketId: string, team: StrikeTeam): boolean {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return false;
    const room = this.rooms.get(roomCode);
    if (!room || room.mode === "ffa" || room.status !== "lobby") return false;

    const player = room.players.get(socketId);
    if (!player) return false;

    if(team!=='red'&&team!=='blue')return false;
    if(room.mode==='bomb'&&[...room.players.values()].filter(p=>p.team===team&&p.id!==socketId).length>=5)return false;
    player.team = team;
    player.originalTeam = team;
    player.color = team === "red" ? "#ef4444" : "#3b82f6";
    this.broadcastRoomState(room, false);
    return true;
  }

  public startGame(socketId: string, options?: { fillBot?: boolean }): { success: boolean; error?: string } {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return { success: false, error: "Oda bulunamadı." };
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false, error: "Oda bulunamadı." };

    const player = room.players.get(socketId);
    if (!player || !player.isHost) {
      return { success: false, error: "Yalnızca oda kurucusu maçı başlatabilir." };
    }

    if (room.players.size < 1) {
      return { success: false, error: "Odada en az 1 oyuncu olmalıdır." };
    }

    if (options?.fillBot && room.mode === "bomb") {
      const hasRed = [...room.players.values()].some((p) => p.team === "red");
      const hasBlue = [...room.players.values()].some((p) => p.team === "blue");
      if (!hasRed || !hasBlue) {
        const botTeam: StrikeTeam = !hasBlue ? "blue" : "red";
        const botId = `bot-${room.roomCode}`;
        const botSpawn = room.getSpawnPosition(botTeam, 0);
        const botPlayer = new StrikeServerPlayer(
          botId,
          999999,
          botTeam === "blue" ? "KapsBot [CT]" : "KapsBot [T]",
          null,
          botTeam === "blue" ? "#3b82f6" : "#ef4444",
          botTeam,
          botSpawn,
          false
        );
        botPlayer.ready = true;
        room.players.set(botId, botPlayer);
      }
    }

    if(room.mode==='bomb'&&(room.players.size<2||!['red','blue'].every(t=>[...room.players.values()].some(p=>p.team===t))))return {success:false,error:'Her takımda en az bir oyuncu gerekli.'};
    // Both supported event aliases must never reset an already running round.
    if (room.status === "in_progress") return { success: true };
    if(room.mode==='bomb'&&[...room.players.values()].some(p=>!p.ready))return {success:false,error:'Maç başlamadan önce bütün oyuncular hazır olmalı.'};
    room.status = "in_progress";room.rewardMatchId=randomBytes(12).toString('hex');
    room.timeLeft = room.timeLimit;
    room.teamScores = { red: 0, blue: 0 };
    room.killFeed = [];
    room.events = [];
    room.tick = 0;
    room.world=createWorld(MAPS[room.map]);

    // Reset all players and position them at spawns
    const spawnCounts={red:0,blue:0,none:0};
    const occupiedSpawns:Vec3[]=[];
    room.players.forEach((p) => {
      p.damageCredits.clear();
      p.kills = 0;
      p.deaths = 0;
      p.assists = 0;
      p.score = 0;
      p.damage = 0;
      p.headshots = 0;
      p.lastSequence = -1;
      p.lastQueuedSequence = -1;
      p.inputQueue = [];p.heldInput=undefined;p.lastInputTick=0;
      p.history = [];p.pendingFire=undefined;

      const spawn = room.getSpawnPosition(p.team, spawnCounts[p.team]++,occupiedSpawns);
      occupiedSpawns.push(spawn);
      p.state.movement = newMovement(spawn);
      p.state.weapon.inventory=[];p.state.weapon.selected="rifle";
      p.state.yaw=0;p.state.pitch=0;
      p.state.hp = 100;p.state.armor=0;
      p.state.deadUntil = 0;
      p.state.protectedUntil = room.tick + C.protectionTicks;

      // Refill ammo
      WEAPON_ORDER.forEach((wId) => {
        p.state.weapon.ammo[wId] = WEAPONS[wId].capacity;
      });
      p.state.weapon.reloadUntil = 0;
      p.state.weapon.nextFire = 0;p.state.weapon.switchUntil=0;p.state.weapon.triggerHeld=false;p.state.weapon.shotIndex=0;
    });

    room.bomb=undefined;
    if(room.mode==='bomb')room.bomb=createBombMatch([...room.players.values()].map(p=>({id:p.id,team:p.team==='red'?'T':'CT',position:{...p.state.movement.position}})),0,room.bombRounds,MAPS[room.map].bombSites);
    this.startRoomSimulationLoop(room);
    this.broadcastRoomState(room);
    this.io.to(`strike:${room.roomCode}`).emit("strike:match_started", room.getPublicRoomState());

    return { success: true };
  }

  public returnToLobby(socketId: string): boolean {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return false;
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const player = room.players.get(socketId);
    if (!player || !player.isHost) return false;

    if (room.loopInterval) {
      clearInterval(room.loopInterval);
      room.loopInterval = null;
    }

    room.status = "lobby";
    room.bomb=undefined;
    room.winner = undefined;
    room.timeLeft = room.timeLimit;

    this.broadcastRoomState(room);
    this.io.to(`strike:${room.roomCode}`).emit("strike:match_reset_to_lobby", room.getPublicRoomState());
    return true;
  }

  public processPlayerInput(socketId: string, command: InputCommand, clientTime?: number): void {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return;
    const room = this.rooms.get(roomCode);
    if (!room || room.status !== "in_progress") return;

    const player = room.players.get(socketId);
    if (!player) return;

    const reject=(reason:string)=>{if(!command?.fire)return;const sequence=Number.isSafeInteger(command.sequence)?command.sequence:-1;const shot=Number.isSafeInteger(command.shot)&&command.shot!>0?command.shot:undefined;this.diagnostic({kind:'input-rejected',sequence,reason});if(shot)this.io.to(socketId).emit('strike:shot_ack',{shotId:`rejected:${sequence}`,sequence,predictedShot:shot,weapon:player.state.weapon.selected,serverTick:room.tick,accepted:false,outcome:'rejected',reason,damage:0,head:false,receivedAt:Date.now(),processedAt:Date.now(),queueMs:0});};
    // Security: Input validation
    if (
      !command ||
      (command.viewTick!==undefined&&(!Number.isFinite(command.viewTick)||command.viewTick<0)) ||
      (command.shot!==undefined&&(!Number.isSafeInteger(command.shot)||command.shot<1)) ||
      (command.interact !== undefined && typeof command.interact !== "boolean") ||
      !Number.isSafeInteger(command.sequence) ||
      command.sequence < 0 ||
      command.sequence <= Math.max(player.lastSequence, player.lastQueuedSequence) ||
      !Number.isSafeInteger(command.tick) || command.tick < 0 ||
      Math.abs(command.moveX) > 1 || Math.abs(command.moveZ) > 1 ||
      (command.weapon !== undefined && !WEAPON_ORDER.includes(command.weapon)) ||
      ![command.yaw, command.pitch, command.moveX, command.moveZ].every(Number.isFinite) ||
      [command.jump, command.sprint, command.crouch, command.fire, command.ads, command.reload].some(
        (v) => typeof v !== "boolean"
      )
    ) {
      reject('invalid-or-duplicate-input');return;
    }

    if(player.state.hp<=0){reject('dead');return;}
    if(room.bomb&&!['buy','active','planted','result'].includes(room.bomb.phase)){reject('round-frozen');return;}
    // Cap input queue to prevent packet flooding/replay abuse
    if (player.inputQueue.length >= 24){reject('input-queue-full');return;}
    player.lastQueuedSequence = command.sequence;
    player.receivedInputs.set(command.sequence,{receivedAt:Date.now(),receivedTick:room.tick});
    if(player.receivedInputs.size>64)player.receivedInputs.delete(player.receivedInputs.keys().next().value!);
    // Whitelist fields; never retain arbitrary objects supplied by clients.
    player.inputQueue.push({ sequence:command.sequence, tick:command.tick,viewTick:command.viewTick,shot:command.shot,
      yaw:command.yaw, pitch:command.pitch, moveX:command.moveX, moveZ:command.moveZ,
      jump:command.jump, sprint:command.sprint, crouch:command.crouch,
      fire:command.fire, ads:command.ads, reload:command.reload, weapon:command.weapon, interact:command.interact });
  }

  /**
   * Authoritative Game Tick Loop (60 Hz)
   */
  /**
   * Authoritative Game Tick Loop (60 Hz)
   */
  public tickSimulation(room: StrikeRoom): void {
    const mapDef = MAPS[room.map];
    room.tick++;
    if(mapDef.id==='bolluca')advanceWorld(room.world,mapDef,room.tick);
    else if(!room.bomb)advanceWorld(room.world,mapDef,room.tick);
    else room.world.pickups=room.world.pickups.filter(p=>!p.opened&&p.expires>room.tick);
    if(room.bomb){const b=room.bomb,round=b.round,phase=b.phase,explosion=b.explosion;
      for(const p of Object.values(b.players)){const live=room.players.get(p.id);p.alive=!!live&&live.state.hp>0;if(live)p.position={...live.state.movement.position};}
      stepBomb(b,room.tick*C.dt);
      if(b.explosion&&b.explosion!==explosion)for(const p of room.players.values())if(!b.players[p.id]?.alive&&p.state.hp>0){p.state.hp=0;p.state.deadUntil=room.tick+C.respawnTicks;p.deaths++;p.pendingFire=undefined;p.inputQueue=[];room.addEvent({actor:p.id,kind:'death'});}
      if(b.phase==='result'&&phase!=='result')for(const p of room.players.values())if(b.players[p.id]?.team===b.winner)this.creditReward(p.userId,`${room.rewardMatchId}:round:${round}`,'round');
      room.teamScores={red:b.scores.T,blue:b.scores.CT};
      if(b.phase==='finished'){this.concludeMatch(room,{team:b.winner==='T'?'red':'blue',reason:b.reason||'Bomba maçı sona erdi'});return;}
      if(b.round!==round||room.tick===1){room.world.pickups=[];
        const counts={red:0,blue:0,none:0},occupied:Vec3[]=[];
        for(const p of room.players.values()){
          const bp=b.players[p.id];if(!bp)continue;
          p.team=bp.team==='T'?'red':'blue';p.originalTeam=p.team;p.color=p.team==='red'?'#ef4444':'#3b82f6';
          const spawn=room.getSpawnPosition(p.team,counts[p.team]++,occupied);occupied.push(spawn);
          p.state.movement=newMovement(spawn);bp.position={...spawn};
          p.state.hp=100;p.state.armor=bp.armor;p.state.deadUntil=0;p.state.protectedUntil=room.tick+C.protectionTicks;p.damageCredits.clear();
          p.state.weapon.inventory=[...bp.weapons];p.state.weapon.switchUntil=0;
          p.state.yaw=p.team==='blue'?Math.PI:0;p.state.pitch=0;
          p.inputQueue=[];p.receivedInputs.clear();p.heldInput=undefined;p.lastInputTick=room.tick;
          p.state.weapon.selected=bp.weapons.find(w=>w!=='knife'&&w!=='pistol')||(bp.weapons.includes('pistol')?'pistol':'knife');p.state.weapon.reloadUntil=0;p.state.weapon.nextFire=0;p.state.weapon.triggerHeld=false;
          for(const w of WEAPON_ORDER)p.state.weapon.ammo[w]=WEAPONS[w].capacity;
          p.history=[];p.pendingFire=undefined;room.addEvent({actor:p.id,kind:'respawn',from:spawn});
        }
      }
    }
    const now = Date.now();

    // Sample a consistent start-of-step history before applying any player's input.
    const pendingHits:(()=>void)[]=[];
    room.players.forEach(player=>player.recordHistory(room.tick,now));
    // 1. Process player inputs & movement simulation
    room.players.forEach((player) => {

      if(room.bomb&&room.bomb.phase==='buy'){
        const owned=room.bomb.players[player.id]?.weapons||['pistol','knife'];
        player.state.weapon.inventory=[...owned];
        for(const command of player.inputQueue){
          player.state.yaw=command.yaw;player.state.pitch=clamp(command.pitch,-1.48,1.48);
          if(command.weapon&&owned.includes(command.weapon))player.state.weapon.selected=command.weapon;
          player.lastSequence=command.sequence;player.receivedInputs.delete(command.sequence);
        }
        player.inputQueue=[];player.heldInput=undefined;player.pendingFire=undefined;return;
      }
      // Handle respawn when dead
      if (player.state.hp <= 0) {
        if (!room.bomb && room.tick >= player.state.deadUntil) {
          const spawnPos = room.getSpawnPosition(player.team, Math.floor(Math.random() * 100000));
          player.state.movement = newMovement(spawnPos);
          player.damageCredits.clear();
          player.state.yaw=0;player.state.pitch=0;
          player.state.weapon.triggerHeld=false;player.state.weapon.nextFire=0;player.state.weapon.switchUntil=0;
          player.state.hp = 100;player.state.armor=0;
          player.state.protectedUntil = room.tick + C.protectionTicks;
          player.state.deadUntil = 0;
          player.state.weapon.reloadUntil = 0;
          WEAPON_ORDER.forEach((w) => {
            player.state.weapon.ammo[w] = WEAPONS[w].capacity;
          });
          room.addEvent({
            actor: player.id,
            kind: "respawn",
            from: spawnPos,
          });
        }
        player.inputQueue = [];player.heldInput=undefined;player.pendingFire=undefined;
        return;
      }

      // Process queued inputs
      {
        // One command per fixed physics step: packet volume cannot buy movement time.
        const queued = player.inputQueue.shift();
        const neutral:InputCommand={sequence:player.lastSequence,tick:room.tick,yaw:player.state.yaw,pitch:player.state.pitch,moveX:0,moveZ:0,jump:player.state.movement.jumpHeld,sprint:false,crouch:player.state.movement.stance!=="stand",fire:false,ads:false,reload:false};
        const input:InputCommand=queued || (player.heldInput&&room.tick-player.lastInputTick<Math.min(36,12+Math.ceil(player.ping/1000/C.dt)) ? {...player.heldInput,tick:room.tick,shot:undefined,fire:WEAPONS[player.state.weapon.selected].automatic&&player.heldInput.fire,reload:false,interact:false,weapon:undefined} : neutral);
        if(room.bomb?.phase==='result'){input.fire=false;input.reload=false;input.interact=false;input.shot=undefined;player.pendingFire=undefined;}
        player.activeCommand=input;
        player.activeReceive=queued?player.receivedInputs.get(input.sequence):undefined;
        if(queued)player.receivedInputs.delete(input.sequence);
        if(queued){player.lastSequence=input.sequence;player.lastInputTick=room.tick;player.heldInput={...input};}

        player.state.yaw = input.yaw;
        player.state.pitch = clamp(input.pitch, -1.48, 1.48);

        if(input.interact){if(room.bomb)pickupBombWeapon(room.bomb,room.world,mapDef,player.state,room.tick);else claimSupply(room.world,mapDef,player.state,room.tick);}

        // Handle weapon switch request
        if (input.weapon && (!room.bomb||room.bomb.players[player.id]?.weapons.includes(input.weapon)) && ownsWeapon(player.state.weapon,input.weapon) && input.weapon !== player.state.weapon.selected) {
          { // A new selection restarts the equip delay; it cannot bypass fire cooldown.
            player.state.weapon.reloadUntil = 0;
            player.pendingFire=undefined;
            player.state.weapon.selected = input.weapon;
            player.state.weapon.switchUntil = room.tick + 24;
          }
        }

        // Shared prediction/authority timing, including empty magazines and bot weapons.
        const curWeapon=player.state.weapon.selected,wDef=WEAPONS[curWeapon];
        const allowReload=!room.bomb||['active','planted'].includes(room.bomb.phase);
        if(advanceReload(player.state.weapon,room.tick,input.reload,allowReload)){
          room.addEvent({actor:player.id,kind:'reload',weapon:curWeapon,from:{...player.state.movement.position}});
        }

        // Apply movement physics using authored map geometry
        move(player.state.movement, { ...input, weapon:curWeapon }, mapDef, room.tick);

        // A predicted shot arriving just before the authoritative cooldown must not disappear.
        // At most two paced shots can be owed; never allow an arbitrary client counter to buy fire rate.
        const weaponState=player.state.weapon;
        if(input.shot&&input.shot>weaponState.shotIndex)player.pendingFire={weapon:curWeapon,index:Math.min(input.shot,weaponState.shotIndex+2),until:room.tick+36,command:{...input},received:player.activeReceive};
        const pending=player.pendingFire;
        if(pending&&(pending.weapon!==curWeapon||pending.until<room.tick||pending.index<=weaponState.shotIndex))player.pendingFire=undefined;
        const buffered=player.pendingFire;
        if ((input.fire && (wDef.automatic || !weaponState.triggerHeld)) || buffered) {
          const originalCommand=player.activeCommand,originalReceive=player.activeReceive,yaw=player.state.yaw,pitch=player.state.pitch;
          // After trigger release, finish only an already requested shot with its original aim.
          if(buffered&&!input.fire){player.activeCommand=buffered.command;player.activeReceive=buffered.received;player.state.yaw=buffered.command.yaw;player.state.pitch=clamp(buffered.command.pitch,-1.48,1.48);}
          const shotCommand=player.activeCommand!;
          this.verifyAndExecuteShot(room,player,shotCommand.ads,shotCommand.viewTick??shotCommand.tick,pendingHits);
          player.activeCommand=originalCommand;player.activeReceive=originalReceive;player.state.yaw=yaw;player.state.pitch=pitch;
          if(buffered&&weaponState.shotIndex>=buffered.index)player.pendingFire=undefined;
        }
        // Begin after the last accepted shot, without rewriting the firing command as manual reload.
        if(advanceReload(weaponState,room.tick,false,allowReload)){
          room.addEvent({actor:player.id,kind:'reload',weapon:curWeapon,from:{...player.state.movement.position}});
        }
        if (queued) player.state.weapon.triggerHeld = input.fire;
      }
    });

    // Resolve all valid same-step shots after every player has had a chance to fire.
    for(const hit of pendingHits)hit();
    const bomb = room.bomb;
    if (bomb?.grenades && (bomb.phase === "active" || bomb.phase === "planted")) {
      const now = room.tick * C.dt;
      bomb.grenades = bomb.grenades.filter(g => g.expires === undefined || g.expires > now);
      for (const grenade of bomb.grenades) {
        if (!stepGrenade(grenade,mapDef,C.dt,now) || grenade.kind === "smoke") continue;
        const thrower = room.players.get(grenade.actor);
        for (const target of room.players.values()) {
          const member = bomb.players[target.id];
          if (!member || target.state.hp <= 0 || room.tick < target.state.protectedUntil) continue;
          const facing = aimDirection(target.state.yaw,target.state.pitch);
          const effect = grenadeEffect(grenade.kind,mapDef,grenade.position,eye(target.state),facing);
          if (!effect) continue;
          if (grenade.kind === "flash") {
            member.flashedUntil = Math.max(member.flashedUntil ?? 0,now + effect);
          } else if (thrower && member.team !== grenade.team) {
            const absorbed = Math.min(target.state.armor ?? 0, Math.floor(effect * .35));
            const health = Math.min(target.state.hp, effect - absorbed);
            target.state.armor = (target.state.armor ?? 0) - absorbed;
            member.armor = target.state.armor;
            target.state.hp -= health;
            thrower.damage += health + absorbed;
            room.addEvent({actor:target.id,kind:"damage",damage:health+absorbed,
              direction:Math.atan2(grenade.position.x-target.state.movement.position.x,grenade.position.z-target.state.movement.position.z)-target.state.yaw});
            if (target.state.hp === 0) this.handlePlayerKill(room,thrower,target,"knife",false,true,"frag");
          }
        }
      }
    }
    this.checkMatchEndConditions(room);

    // 2. Broadcast snapshots at snapshotRate (30 Hz) using shared precomputed room base
    if (room.tick % Math.round(1 / C.dt / SERVER_CONFIG.snapshotRate) === 0) {
      let sharedBase: ReturnType<StrikeRoom["buildSharedSnapshotBase"]> | undefined;
      room.players.forEach((p) => {
        if (p.isDisconnected || p.id.startsWith("bot-")) return;
        sharedBase ??= room.buildSharedSnapshotBase();
        const snapshot = room.getSnapshotForPlayer(p.id, sharedBase);
        this.io.to(p.id).emit("strike:snapshot", snapshot);
      });
      if (room.events.length > 32) {
        room.events = room.events.slice(-16);
      }
    }

    // 3. Match Timer Countdown & Win Condition Checks (Every second = 60 ticks)
    if (room.tick % Math.round(1 / C.dt) === 0) {
      room.timeLeft = room.bomb?Math.max(0,room.bomb.deadline-room.tick*C.dt):Math.max(0, room.timeLeft - 1);
      this.checkMatchEndConditions(room);
    }
  }

  private startRoomSimulationLoop(room: StrikeRoom): void {
    if (room.loopInterval) {
      clearInterval(room.loopInterval);
    }

    let last = performance.now();
    let accumulator = 0;
    room.loopInterval = setInterval(() => {
      try {
        const now = performance.now();
        accumulator += Math.min(0.15, (now - last) / 1000);
        last = now;
        let steps = 0;
        while (accumulator >= C.dt && steps++ < 18 && room.status === "in_progress") {
          const tickStart = performance.now();
          this.tickSimulation(room);
          recordTickDurationMs(performance.now() - tickStart);
          accumulator -= C.dt;
        }
      } catch (err) {
        console.error(`[Strike Simulation Error in room ${room.roomCode}]:`, err);
      }
    }, 1000 / SERVER_CONFIG.tickRate);
  }

  public stopRoomSimulationLoop(room: StrikeRoom): void {
    if (room.loopInterval) {
      clearInterval(room.loopInterval);
      room.loopInterval = null;
    }
  }

  /**
   * Server-authoritative raycast hit detection with lag compensation rewind
   */
  private verifyAndExecuteShot(
    room: StrikeRoom,
    shooter: StrikeServerPlayer,
    ads: boolean,
    clientShotTick: number,
    pendingHits?: (()=>void)[]
  ): void {
    const pState = shooter.state;
    const wState = pState.weapon;
    const weaponId = wState.selected;
    const def = WEAPONS[weaponId];

    const command=shooter.activeCommand,received=shooter.activeReceive,processedAt=Date.now();
    const sequence=command?.sequence??shooter.lastSequence;
    const reject=command?.viewTick!==undefined&&(command.viewTick<room.tick-SERVER_CONFIG.maxLagCompTicks||command.viewTick>room.tick+8)?'stale-or-future-view':pState.hp<=0?'dead':room.bomb&&!['active','planted'].includes(room.bomb.phase)?'round-frozen':room.bomb?.action?.player===shooter.id?'objective-action':room.tick<wState.nextFire?'cooldown':room.tick<wState.switchUntil?'equipping':wState.reloadUntil>0?'reloading':wState.ammo[weaponId]<=0?'empty':undefined;
    if(reject){if(command?.shot&&(!shooter.pendingFire||command!==shooter.pendingFire.command)){const receipt={shotId:`rejected:${room.tick}:${sequence}`,sequence,predictedShot:command.shot,weapon:weaponId,serverTick:room.tick,accepted:false,outcome:reject==='cooldown'&&shooter.pendingFire?'buffered':'rejected',reason:reject==='cooldown'&&shooter.pendingFire?'cooldown-buffered':reject,damage:0,head:false,receivedAt:received?.receivedAt??processedAt,processedAt,queueMs:received?Math.max(0,processedAt-received.receivedAt):0};this.io.to(shooter.id).emit('strike:shot_ack',receipt);this.diagnostic(receipt);}return;}
    const receipt:import('../games/kapsstrike/types').ShotReceipt={shotId:`${shooter.id}:${room.tick}:${wState.shotIndex+1}`,sequence,predictedShot:command?.shot,weapon:weaponId,serverTick:room.tick,accepted:true,outcome:'miss',damage:0,head:false,receivedAt:received?.receivedAt??processedAt,processedAt,queueMs:received?Math.max(0,processedAt-received.receivedAt):0};
    // Deduct ammo & enforce RPM fire cooldown
    if (weaponId !== "knife") wState.ammo[weaponId]--;
    wState.nextFire = Math.max(wState.nextFire,room.tick-1)+fireDelay(weaponId,ads);
    wState.shotIndex++;

    const origin = eye(pState),shotYaw=pState.yaw,shotPitch=pState.pitch;

    // Compute lag compensation rewind tick (bounded to maxLagCompTicks)
    const allowed=command?.viewTick===undefined?SERVER_CONFIG.maxLagCompTicks:Math.min(SERVER_CONFIG.maxLagCompTicks,Math.ceil((Math.min(shooter.ping,400)/2+150)/1000/C.dt)+4+(received?Math.min(24,room.tick-received.receivedTick):0));
    const rewindTick=clamp(Number.isFinite(clientShotTick)?clientShotTick:room.tick,Math.max(0,room.tick-allowed),room.tick);
    const debugTargets:unknown[]=[],debugRays:unknown[]=[],debugPellets:unknown[]=[];
    const spreadSeed=wState.shotIndex*31;
    // Pellet spread calculations

    const mapDef = MAPS[room.map];

    for (let pellet = 0; pellet < def.pellets; pellet++) {
      const dir=shotDirection(pState,wState.shotIndex,pellet,ads);
      // 1. Raycast against solid map cover (pre-filtered collisionSolids skips decorative facades)
      let nearest = def.range,blockedBy:string|undefined;
      for (const solid of collisionSolids(mapDef)) {
        const distance=raySolid(origin,dir,solid,def.range);if(distance<nearest){nearest=distance;blockedBy=solid.id;}
      }

      if(nearest<def.range&&receipt.outcome==='miss')receipt.outcome='world';
      // 2. Raycast against the pose actually drawn, including body yaw and head pitch.
      let hitPlayer: StrikeServerPlayer | undefined;
      let isHeadshot = false,bodyPart:string|undefined;

      room.players.forEach((target) => {
        if (target.id === shooter.id || target.state.hp <= 0) return;
        // TDM friendly fire check: teammates take no damage
        if (room.mode !== "ffa" && target.team === shooter.team) return;

        // Spawn protection check
        if (room.tick < target.state.protectedUntil) return;

        const hist = target.getHistoricalPosition(rewindTick);
        if(hist.hp<=0)return;
        if(this.combatDebug&&pellet===0)debugTargets.push({id:target.id,...hist});
        const hit=tracePlayer(origin,dir,hist,nearest);
        if(hit){nearest=hit.distance;hitPlayer=target;bodyPart=hit.part;isHeadshot=hit.part==='head';}
      });

      const impactPoint = {
        x: origin.x + dir.x * nearest,
        y: origin.y + dir.y * nearest,
        z: origin.z + dir.z * nearest,
      };

      const trace:Record<string,unknown>|undefined=this.combatDebug?{pellet,dir,to:impactPoint,obstacle:hitPlayer?undefined:blockedBy,target:hitPlayer?.id,bodyPart,rawDamage:0,absorbed:0,damage:0}:undefined;
      if(trace)debugPellets.push(trace);
      if(this.combatDebug)debugRays.push({from:origin,to:impactPoint});
      // Emit shot tracer event
      room.addEvent({
        actor: shooter.id,
        kind: "shot",
        shotId:receipt.shotId,
        weapon: weaponId,
        from: origin,
        to: impactPoint,
      });

      // Apply damage if target hit
      if (hitPlayer) {
        const victim=hitPlayer;
        const apply=()=>{
          if(victim.state.hp<=0){if(trace)trace.reason='target-already-dead';return;}
        const damagePerPellet = weaponDamage(weaponId,nearest,isHeadshot,ads);
        const absorbed = weaponId === "railgun" ? 0 : Math.min(victim.state.armor || 0, damagePerPellet);
        victim.state.armor = (victim.state.armor || 0) - absorbed;
        const armor = room.bomb?.players[victim.id];
        if (armor) armor.armor = victim.state.armor;
        const healthDamage=Math.min(victim.state.hp,damagePerPellet-absorbed);
        const finalDamage=healthDamage+absorbed;

        if(trace){trace.rawDamage=damagePerPellet;trace.absorbed=absorbed;trace.damage=finalDamage;}
        receipt.outcome='hit';receipt.damage+=finalDamage;receipt.head ||= isHeadshot;
        victim.state.hp = Math.max(0, victim.state.hp - healthDamage);
        shooter.damage += finalDamage;
        const credit=victim.damageCredits.get(shooter.id);
        victim.damageCredits.set(shooter.id,{amount:(credit?.amount||0)+finalDamage,tick:room.tick});

        // Register hit event
        room.addEvent({
          actor: shooter.id,
          kind: "hit",
          shotId:receipt.shotId,
          target: victim.id,
          damage: finalDamage,
          head: isHeadshot,
          weapon: weaponId,
          to: impactPoint,
        });

        // Register damage event for victim (shows directional red indicator)
        const hitDirection =
          Math.atan2(origin.x - victim.state.movement.position.x, origin.z - victim.state.movement.position.z) -
          victim.state.yaw;

        room.addEvent({
          actor: victim.id,
          kind: "damage",
          damage: finalDamage,
          direction: hitDirection,
        });

        // Kill check
        if (victim.state.hp <= 0) {
          this.handlePlayerKill(room, shooter, victim, weaponId, isHeadshot, !!pendingHits);
        }
        };
        if(pendingHits)pendingHits.push(apply);else apply();
      }
    }
    const acknowledge=()=>{this.io.to(shooter.id).emit('strike:shot_ack',receipt);const debug={...receipt,origin,yaw:shotYaw,pitch:shotPitch,spreadSeed,rewindTick,targets:debugTargets,rays:debugRays,pellets:debugPellets};this.diagnostic(debug);if(this.combatDebug)this.io.to(shooter.id).emit('strike:combat_debug',debug);};
    if(pendingHits)pendingHits.push(acknowledge);else acknowledge();
  }

  private rewardTasks=new Set<Promise<void>>();
  private creditReward(userId:number,eventId:string,reason:'kill'|'round'){
    if(!this.inventory.persistent)return;
    const task=(async()=>{for(let attempt=0;attempt<3;attempt++)try{const state=await this.inventory.reward(userId,eventId,reason);this.io.to(`strike-wallet:${userId}`).emit('strike:wallet',{credits:state.credits,reason});return;}catch(error){if(attempt===2)console.error('[StrikeCredits] Reward failed',eventId,error);else await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));}})();
    this.rewardTasks.add(task);void task.finally(()=>this.rewardTasks.delete(task));
  }
  private handlePlayerKill(
    room: StrikeRoom,
    killer: StrikeServerPlayer,
    victim: StrikeServerPlayer,
    weapon: WeaponId,
    headshot: boolean,
    deferEnd = false,
    utility?: "frag"
  ): void {
    for(const [id,credit] of victim.damageCredits) {
      const helper=room.players.get(id);
      if(id!==killer.id && helper && credit.amount>=20 && room.tick-credit.tick<=8/C.dt){helper.assists++;helper.score+=25;}
    }
    victim.damageCredits.clear();
    if(room.bomb&&room.map!=='bolluca')dropBombWeapon(room.bomb,room.world,victim.state,room.tick,true);
    dropInventory(room.world,victim.state,room.tick,MAPS[room.map]);
    if(room.bomb){room.bomb.players[victim.id].alive=false;dropBomb(room.bomb,victim.id);killer.state.hp=Math.min(100,killer.state.hp);const p=room.bomb.players[killer.id];if(p)p.money=Math.min(BOMB_RULES.maxMoney,p.money+BOMB_RULES.killReward);}
    victim.deaths++;
    victim.state.deadUntil = room.tick + C.respawnTicks;

    killer.kills++;
    if(killer.userId!==victim.userId)this.creditReward(killer.userId,`${room.rewardMatchId}:kill:${victim.userId}:${victim.deaths}`,'kill');
    killer.score += headshot ? 150 : 100;
    if (headshot) killer.headshots++;

    if (room.mode === "tdm") {
      if (killer.team === "red") room.teamScores.red++;
      else if (killer.team === "blue") room.teamScores.blue++;
    }

    room.addEvent({
      actor: victim.id,
      kind: "death",
    });

    const feedEntry: KillFeedEntry = {
      id: `kill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tick: room.tick,
      killerId: killer.id,
      killerName: killer.username,
      killerTeam: killer.team,
      victimId: victim.id,
      victimName: victim.username,
      victimTeam: victim.team,
      weapon,
      utility,
      headshot,
      timestamp: Date.now(),
    };

    room.killFeed.unshift(feedEntry);
    if (room.killFeed.length > 8) {
      room.killFeed.pop();
    }

    this.io.to(`strike:${room.roomCode}`).emit("strike:kill_feed", feedEntry);
    this.io.to(`strike:${room.roomCode}`).emit("strike:kill", feedEntry);
    if(!deferEnd)this.checkMatchEndConditions(room);
  }

  private checkMatchEndConditions(room: StrikeRoom): void {
    if (room.status !== "in_progress"||room.bomb) return;

    let matchEnded = false;
    let winnerTeam: StrikeTeam | undefined;
    let winnerUserId: number | undefined;
    let winnerUsername: string | undefined;
    let winReason = "";

    // Evaluate score limits after the full combat step, including trades.
    if (room.mode !== "ffa" && Math.max(room.teamScores.red,room.teamScores.blue)>=room.scoreLimit) {
      matchEnded=true;
      winnerTeam=room.teamScores.red===room.teamScores.blue ? "none" : room.teamScores.red>room.teamScores.blue ? "red":"blue";
      winReason=winnerTeam==="none"?"Skor sınırında beraberlik!":`${winnerTeam==="red"?"Kırmızı":"Mavi"} Takım skor sınırına ulaştı!`;
    } else if(room.mode === "ffa") {
      const reached=[...room.players.values()].filter(p=>p.kills>=room.scoreLimit).sort((a,b)=>b.score-a.score);
      if(reached.length){matchEnded=true;
        if(reached.length>1 && reached[0].score===reached[1].score){winnerTeam="none";winReason="Skor sınırında beraberlik!";}
        else {winnerUserId=reached[0].userId;winnerUsername=reached[0].username;winReason=`${winnerUsername} öldürme hedefine ulaştı!`;}
      }
    }

    // 2. Time limit expired
    if (!matchEnded && room.timeLeft <= 0) {
      matchEnded = true;
      if (room.mode !== "ffa") {
        if (room.teamScores.red > room.teamScores.blue) {
          winnerTeam = "red";
          winReason = "Süre bitti. Kırmızı Takım galip!";
        } else if (room.teamScores.blue > room.teamScores.red) {
          winnerTeam = "blue";
          winReason = "Süre bitti. Mavi Takım galip!";
        } else {
          winnerTeam = "none";
          winReason = "Süre bitti. Maç berabere tamamlandı!";
        }
      } else {
        const sorted = Array.from(room.players.values()).sort((a, b) => b.score - a.score);
        if (sorted.length > 1 && sorted[0].score === sorted[1].score) {winnerTeam="none";winReason="Süre bitti. Maç berabere tamamlandı!";}
        else if (sorted.length > 0) {
          winnerUserId = sorted[0].userId;
          winnerUsername = sorted[0].username;
          winReason = `Süre bitti. En yüksek skora sahip ${sorted[0].username} kazandı!`;
        }
      }
    }

    if (matchEnded) {
      this.concludeMatch(room, {
        team: winnerTeam,
        userId: winnerUserId,
        username: winnerUsername,
        reason: winReason,
      });
    }
  }

  private concludeMatch(
    room: StrikeRoom,
    winner: { team?: StrikeTeam; userId?: number; username?: string; reason: string }
  ): void {
    if (room.loopInterval) {
      clearInterval(room.loopInterval);
      room.loopInterval = null;
    }

    room.status = "game_over";
    room.winner = winner;

    // Persist stats into SQLite users table
    if (this.dbClient) {
      room.players.forEach(async (p) => {
        try {
          const isWin =
            (room.mode !== "ffa" && p.team === winner.team && winner.team !== "none") ||
            (room.mode === "ffa" && p.userId === winner.userId);

          await this.dbClient!.execute({
            sql: `UPDATE users SET 
                    strike_kills = COALESCE(strike_kills, 0) + ?,
                    strike_deaths = COALESCE(strike_deaths, 0) + ?,
                    strike_wins = COALESCE(strike_wins, 0) + ?,
                    strike_matches = COALESCE(strike_matches, 0) + 1,
                    strike_headshots = COALESCE(strike_headshots, 0) + ?
                  WHERE id = ?`,
            args: [p.kills, p.deaths, isWin ? 1 : 0, p.headshots, p.userId],
          });
        } catch (dbErr) {
          console.error(`Error saving strike stats for user ${p.userId}:`, dbErr);
        }
      });
    }

    const state = room.getPublicRoomState();
    this.io.to(`strike:${room.roomCode}`).emit("strike:game_over", state);
    this.io.to(`strike:${room.roomCode}`).emit("strike:match_ended", state);

    // Also emit per-player MatchStats directly to each player
    const sortedPlayers = Array.from(room.players.values()).sort(
      (a, b) => b.kills - a.kills || b.damage - a.damage
    );
    const topPlayer = sortedPlayers[0];

    room.players.forEach((p) => {
      const isWin =
        (room.mode !== "ffa" && p.team === winner.team && winner.team !== "none") ||
        (room.mode === "ffa" && p.userId === winner.userId);

      const pStats = {
        kills: p.kills,
        deaths: p.deaths,
        headshots: p.headshots,
        damage: p.damage,
        score: p.score,
        won: isWin,
        mode: room.mode,
        winnerTeam: winner.team,
        winnerName: winner.username || (winner.team === "none" ? "Berabere" : winner.team ? `${winner.team === "red" ? "Kırmızı" : "Mavi"} Takım` : undefined),
        mvp: topPlayer
          ? {
              userId: topPlayer.userId,
              username: topPlayer.username,
              kills: topPlayer.kills,
              damage: topPlayer.damage,
            }
          : undefined,
      };
      this.io.to(p.id).emit("strike:match_ended", pStats);
    });

    this.broadcastRoomsList();
  }

  /**
   * Main Socket.IO connection event registration
   */
  public register(socket: Socket, user: any): void {
    const userIdNum = Number(user.id);
    void socket.join(`strike-wallet:${userIdNum}`);
    let bombWindow=0,bombRequests=0;
    socket.on('strike:bomb_action',(data:unknown,callback?:unknown)=>{
      const reply=(success:boolean,error?:string)=>{if(typeof callback==='function')callback({success,error});};
      const clock=Date.now();if(clock-bombWindow>1000){bombWindow=clock;bombRequests=0;}
      if(++bombRequests>25){reply(false,'Çok hızlı işlem yapıyorsun.');return;}
      const room=this.rooms.get(this.socketToRoom.get(socket.id)||''),b=room?.bomb;
      if(!room||!b||room.status!=='in_progress'||!b.players[socket.id]){reply(false,'Aktif bomba maçında değilsin.');return;}
      if(!data||typeof data!=='object'){reply(false,'Geçersiz işlem.');return;}
      const request=data as {kind?:unknown;item?:unknown;held?:unknown},now=room.tick*C.dt;
      if(request.kind==='buy'&&typeof request.item==='string'){
        const error=bombPurchaseError(b,socket.id,request.item,now);
        if(error){reply(false,error);return;}
        const success=buyBombEquipment(b,socket.id,request.item,now);
        if(success){const player=room.players.get(socket.id)!;
          player.state.weapon.inventory=[...b.players[socket.id].weapons];
          player.state.armor=b.players[socket.id].armor;
          if(Object.hasOwn(WEAPONS,request.item)){
            const weapon=request.item as WeaponId;player.state.weapon.selected=weapon;
            player.state.weapon.ammo[weapon]=WEAPONS[weapon].capacity;player.state.weapon.reloadUntil=0;player.state.weapon.switchUntil=room.tick+24;player.pendingFire=undefined;
          }
        }
        this.io.to(socket.id).emit('strike:snapshot',room.getSnapshotForPlayer(socket.id));reply(success);return;
      }
      if(request.kind==='refund'&&typeof request.item==='string'){
        if(!refundBombEquipment(b,socket.id,request.item,now)){reply(false,'Bu ekipman artık iade edilemez.');return;}
        const player=room.players.get(socket.id)!;
        const weapon=player.state.weapon;
        weapon.inventory=[...b.players[socket.id].weapons];
        if(weapon.selected===request.item){
          weapon.selected='pistol';
          weapon.reloadUntil=0;
          weapon.switchUntil=room.tick+24;
          weapon.triggerHeld=false;
        }
        player.state.armor=b.players[socket.id].armor;
        if(Object.hasOwn(WEAPONS,request.item)){
          weapon.ammo[request.item as WeaponId]=0;
          player.pendingFire=undefined;
        }
        this.io.to(socket.id).emit('strike:snapshot',room.getSnapshotForPlayer(socket.id));reply(true);return;
      }
      if(request.kind==='throw_utility'&&isGrenade(request.item)){
        const player=room.players.get(socket.id)!;
        const member=b.players[socket.id];
        if(!member.utility?.[request.item]||player.state.hp<=0||!['active','planted'].includes(b.phase)||(b.grenades?.length??0)>=30){
          reply(false,'Bu bomba şu anda kullanılamaz.');return;
        }
        const short=(data as {short?:unknown}).short;
        if(typeof short!=='boolean'){reply(false,'Geçersiz atış.');return;}
        const remaining = member.utility[request.item]! - 1;
        if (remaining > 0) member.utility[request.item] = remaining;
        else delete member.utility[request.item];
        const { movement, yaw, pitch } = player.state;
        const origin = short ? { ...movement.position, y: movement.position.y + 0.65 } : eye(player.state);
        (b.grenades ??= []).push(grenadeLaunch(
          randomBytes(8).toString('hex'), request.item, socket.id, member.team,
          origin, aimDirection(yaw, pitch), now, short, movement.velocity,
        ));
        reply(true);return;
      }
      if(request.kind==='pickup_weapon'){const player=room.players.get(socket.id)!;reply(pickupBombWeapon(b,room.world,MAPS[room.map],player.state,room.tick));return;}
      if(request.kind==='drop_weapon'){const player=room.players.get(socket.id)!;const success=room.map!=='bolluca'&&dropBombWeapon(b,room.world,player.state,room.tick);if(success)player.pendingFire=undefined;reply(success,success?undefined:'Bu silah bırakılamaz.');return;}
      if(request.kind==='drop'){reply(dropBomb(b,socket.id));return;}
      if(request.kind==='fast_detonate'){
        // The UI hiding this test shortcut is not an authorization boundary.
        if([...room.players.values()].filter(p=>!p.id.startsWith('bot-')).length!==1){reply(false,'Hızlı patlatma yalnızca tek oyunculu test maçında kullanılabilir.');return;}
        if(b.phase==='planted'){
          b.deadline=Math.min(b.deadline,now+2.2);
          reply(true);
          return;
        }
        reply(false,'Önce bombayı kurmalısın.');
        return;
      }
      if(request.kind==='hold'&&typeof request.held==='boolean'){
        // Objective interaction cannot reach through a wall, even at close range.
        const player=room.players.get(socket.id)!;
        if(request.held&&b.position){
          const from=eye(player.state),to={...b.position,y:b.position.y+.15};
          const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
          const dir={x:(to.x-from.x)/distance,y:(to.y-from.y)/distance,z:(to.z-from.z)/distance};
          if(distance>0&&collisionSolids(MAPS[room.map]).some(s=>raySolid(from,dir,s,distance)<distance-.05)){
            bombInteract(b,socket.id,false,now);reply(false,'Bombaya ulaşmak için engelin etrafından geç.');return;
          }
        }
        const wasDefusing = b.action?.kind === 'defuse';
        const ok = bombInteract(b,socket.id,request.held,now);
        if (ok && !wasDefusing && b.action?.kind === 'defuse') {
          room.addEvent({
            actor: socket.id,
            kind: 'defuse',
            from: b.position ? { ...b.position } : { ...player.state.movement.position },
          });
        }
        reply(ok);return;
      }
      reply(false,'Geçersiz işlem.');
    });
    const applyProfile = (skin: SkinId) => {
      const room = this.rooms.get(this.socketToRoom.get(socket.id) || "");
      const player = room?.players.get(socket.id);
      if (player && room && player.skin !== skin) {player.skin=skin;this.broadcastRoomState(room);}
    };
    void this.profiles.get(userIdNum).then(applyProfile).catch(() => {});
    const applyInventory=(state:import('../games/kapsstrike/cosmetics').Inventory)=>{
      const room=this.rooms.get(this.socketToRoom.get(socket.id)||'');
      const player=room?.players.get(socket.id);
      if(player&&room){
        const prev=JSON.stringify(player.cosmeticLoadout||{});
        const next=JSON.stringify(state.equipped||{});
        player.cosmeticLoadout=state.equipped;
        if(prev!==next)this.broadcastRoomState(room);
      }
    };
    const isEmirgan = String(user.username || '').trim().toLowerCase() === 'emirgan';
    if (isEmirgan) {
      void this.inventory.grantAll(userIdNum).then(s => applyInventory(s)).catch(() => {});
    } else {
      void this.inventory.get(userIdNum).then(applyInventory).catch(() => {});
    }
    let inventoryBusy=false, inventoryRequest=0;
    const verifyAdmin = async () => {
      return this.inventory.isAuthorizedAdmin(userIdNum, user.username);
    };
    for(const event of ['get','open','equip','preferences'] as const)socket.on('strike:inventory_'+event,async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(inventoryBusy||(event!=='get'&&Date.now()-inventoryRequest<250)){cb({success:false,error:'Biraz bekle.'});return;}
      inventoryBusy=true;if(event!=='get')inventoryRequest=Date.now();
      try{if(event==='get'){
        if(isEmirgan) await this.inventory.grantAll(userIdNum);
        const state=await this.inventory.get(userIdNum);applyInventory(state);cb({success:true,state});}
      else if(event==='preferences'){const state=await this.inventory.setHiddenWeapons(userIdNum,data?.hiddenWeapons);cb({success:true,state});}
      else if(event==='open'){if(typeof data?.caseId!=='string'||data.caseId.length>32)throw new Error('Geçersiz kasa.');cb({success:true,...await this.inventory.open(userIdNum,data.caseId)});}
      else {if(typeof data?.itemId!=='string'||data.itemId.length>64)throw new Error('Geçersiz görünüm.');const state=await this.inventory.equip(userIdNum,data.itemId);applyInventory(state);cb({success:true,state});}}
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Envanter işlemi başarısız.'});}finally{inventoryBusy=false;}
    });
    // Privilege is verified server-side against authenticated database account
    socket.on('strike:inventory_admin_credits',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(!(await verifyAdmin())){cb({success:false,error:'Yetkisiz işlem.'});return;}
      try{const targetId=Number(data?.userId);if(!Number.isSafeInteger(targetId)||targetId<=0||!['set','add'].includes(data?.mode)||!Number.isSafeInteger(data?.amount))throw new Error('Geçersiz işlem.');const target=await this.inventory.getUser(targetId);if(!target)throw new Error('Kullanıcı bulunamadı.');const state=await this.inventory.adjustCredits(targetId,data.amount,data.mode,userIdNum);cb({success:true,user:{...target,inventory:state}});this.io.to(`strike-wallet:${targetId}`).emit('strike:wallet',{credits:state.credits,reason:'admin'});}
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Bakiye güncellenemedi.'});}
    });
    socket.on('strike:inventory_admin_check' ,async(cb:any)=>{
      if(typeof cb!=='function')return;
      const ok = await verifyAdmin();
      cb({success:true,allowed:ok});
    });
    socket.on('strike:inventory_admin_search',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(!(await verifyAdmin())){cb({success:false,error:'Yetkisiz işlem: Bu yetki sadece emirgan hesabına aittir.'});return;}
      try{const users=await this.inventory.searchUsers(typeof data?.query==='string'?data.query:'');const results=[];for(const target of users)results.push({...target,inventory:await this.inventory.get(target.id)});cb({success:true,users:results});}
      catch{cb({success:false,error:'Kullanıcılar veya envanterleri yüklenemedi.'});}
    });
    socket.on('strike:inventory_admin_grant_item',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(!(await verifyAdmin())){cb({success:false,error:'Yetkisiz işlem: Bu yetki sadece emirgan hesabına aittir.'});return;}
      const targetId=Number(data?.userId), itemId=String(data?.itemId||'');
      if(!Number.isSafeInteger(targetId)||targetId<=0||!itemId){cb({success:false,error:'Geçersiz parametreler.'});return;}
      try{
        const target=await this.inventory.getUser(targetId);
        if(!target)throw new Error('Kullanıcı bulunamadı.');
        const result=await this.inventory.grantItem(targetId, itemId, userIdNum, user.username);
        cb({success:true,user:{...target,inventory:result.state},item:result.item});
      }
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Görünüm eklenemedi.'});}
    });
    socket.on('strike:inventory_admin_grant_batch',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(!(await verifyAdmin())){cb({success:false,error:'Yetkisiz işlem: Bu yetki sadece emirgan hesabına aittir.'});return;}
      const targetId=Number(data?.userId), itemIds=Array.isArray(data?.itemIds)?data.itemIds:[];
      if(!Number.isSafeInteger(targetId)||targetId<=0||!itemIds.length){cb({success:false,error:'Geçersiz parametreler.'});return;}
      try{
        const target=await this.inventory.getUser(targetId);
        if(!target)throw new Error('Kullanıcı bulunamadı.');
        const result=await this.inventory.grantBatch(targetId, itemIds, userIdNum, user.username);
        cb({success:true,user:{...target,inventory:result.state},count:result.count});
      }
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Görünümler eklenemedi.'});}
    });
    socket.on('strike:inventory_admin_revoke_item',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(!(await verifyAdmin())){cb({success:false,error:'Yetkisiz işlem: Bu yetki sadece emirgan hesabına aittir.'});return;}
      const targetId=Number(data?.userId), itemId=String(data?.itemId||'');
      if(!Number.isSafeInteger(targetId)||targetId<=0||!itemId){cb({success:false,error:'Geçersiz parametreler.'});return;}
      try{
        const target=await this.inventory.getUser(targetId);
        if(!target)throw new Error('Kullanıcı bulunamadı.');
        const result=await this.inventory.revokeItem(targetId, itemId, userIdNum, user.username);
        cb({success:true,user:{...target,inventory:result.state},item:result.item});
      }
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Görünüm kaldırılamadı.'});}
    });
    socket.on('strike:inventory_admin_grant_all',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(!(await verifyAdmin())){cb({success:false,error:'Yetkisiz işlem: Bu yetki sadece emirgan hesabına aittir.'});return;}
      const targetId=Number(data?.userId);if(!Number.isSafeInteger(targetId)||targetId<=0){cb({success:false,error:'Geçersiz kullanıcı.'});return;}
      try{
        const target=await this.inventory.getUser(targetId);
        if(!target)throw new Error('Kullanıcı bulunamadı.');
        const state=await this.inventory.grantAll(targetId);
        console.info(`[StrikeAdminAudit] Full Skin Bundle granted to user #${targetId} by ${user.username}(#${userIdNum})`);
        cb({success:true,user:{...target,inventory:state}});
      }
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Görünümler eklenemedi.'});}
    });
    socket.on('strike:inventory_admin_revoke_all',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(!(await verifyAdmin())){cb({success:false,error:'Yetkisiz işlem: Bu yetki sadece emirgan hesabına aittir.'});return;}
      const targetId=Number(data?.userId);if(!Number.isSafeInteger(targetId)||targetId<=0){cb({success:false,error:'Geçersiz kullanıcı.'});return;}
      try{
        const target=await this.inventory.getUser(targetId);
        if(!target)throw new Error('Kullanıcı bulunamadı.');
        const state=await this.inventory.revokeAll(targetId, userIdNum, user.username);
        console.info(`[StrikeAdminAudit] All Skins Revoked from user #${targetId} by ${user.username}(#${userIdNum})`);
        cb({success:true,user:{...target,inventory:state}});
      }
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Görünümler kaldırılamadı.'});}
    });
    let lastProfileGet = 0, lastProfileSet = 0;
    socket.on("strike:profile_get", async (cb) => {
      if(Date.now()-lastProfileGet<1000 && this.profiles.cache.has(userIdNum)){if(typeof cb === "function")cb({success:true,skin:this.profiles.cache.get(userIdNum),saved:this.profiles.persisted.has(userIdNum)});return;}lastProfileGet=Date.now();
      try { const skin = await this.profiles.get(userIdNum); if(typeof cb === "function") cb({success:true,skin,saved:this.profiles.persisted.has(userIdNum)}); }
      catch { if(typeof cb === "function") cb({success:false,error:"Karakter profili yüklenemedi."}); }
    });
    socket.on("strike:profile_set", async (data, cb) => {
      if(Date.now()-lastProfileSet<1000){if(typeof cb === "function")cb({success:false,error:"Bir saniye bekle."});return;}lastProfileSet=Date.now();
      try {
        const skin = await this.profiles.set(userIdNum,data?.skin);
        const room = this.rooms.get(this.socketToRoom.get(socket.id) || "");
        const player = room?.players.get(socket.id);
        if(player && room) { player.skin=skin; this.broadcastRoomState(room); }
        if(typeof cb === "function") cb({success:true,skin});
      } catch(e) { if(typeof cb === "function") cb({success:false,error:e instanceof Error?e.message:"Karakter kaydedilemedi."}); }
    });
    const u = {
      id: userIdNum,
      username: user.username || "Oyuncu",
      avatar: user.avatar || null,
      color: user.color || "#3b82f6",
    };

    // 1. Get Room List (supports both strike:get_rooms and strike:list_rooms)
    const sendRooms = (cb?: (rooms: StrikeRoomSummary[]) => void) => {
      const summaries = this.getRoomsList();
      if (typeof cb === "function") {
        cb(summaries);
      } else {
        socket.emit("strike:rooms_list", summaries);
        socket.emit("strike:room_list", summaries);
      }
    };
    socket.on("strike:get_rooms", sendRooms);
    socket.on("strike:list_rooms", sendRooms);

    // 2. Create Room
    socket.on(
      "strike:create_room",
      (options: any, cb?: (res: { success: boolean; room?: StrikeRoomState; error?: string }) => void) => {
        try {
          const room = this.createRoom(u, socket.id, options || {});
          socket.join(`strike:${room.roomCode}`);
          if (cb) cb({ success: true, room: room.getPublicRoomState() });
        } catch (e: any) {
          if (cb) cb({ success: false, error: e.message || "Oda oluşturulamadı." });
        }
      }
    );

    // 3. Join Room (robust: accepts roomCode, roomId, or code)
    socket.on(
      "strike:join_room",
      (
        data: { roomCode?: string; roomId?: string; code?: string; password?: string },
        cb?: (res: { success: boolean; room?: StrikeRoomState; error?: string }) => void
      ) => {
        try {
          const rawCode = (data?.roomCode || data?.roomId || data?.code || "").trim();
          if (!rawCode) {
            if (cb) cb({ success: false, error: "Lütfen bir oda kodu girin." });
            return;
          }
          const res = this.joinRoom(rawCode, u, socket.id, data.password);
          if (res.success && res.room) {
            socket.join(`strike:${res.room.roomCode}`);
            if (cb) cb({ success: true, room: res.room.getPublicRoomState() });
          } else {
            if (cb) cb({ success: false, error: res.error || "Odaya katılınamadı." });
          }
        } catch (e: any) {
          if (cb) cb({ success: false, error: e.message || "Odaya katılınamadı." });
        }
      }
    );

    // 4. Quick Match
    socket.on(
      "strike:quick_match",
      (cb?: (res: { success: boolean; room?: StrikeRoomState; error?: string }) => void) => {
        try {
          const res = this.quickMatch(u, socket.id);
          if (res.success && res.room) {
            socket.join(`strike:${res.room.roomCode}`);
            if (cb) cb({ success: true, room: res.room.getPublicRoomState() });
          }
        } catch (e: any) {
          if (cb) cb({ success: false, error: e.message || "Hızlı maça girilemedi." });
        }
      }
    );

    // 5. Leave Room
    socket.on("strike:leave_room", (cb?: () => void) => {
      const roomCode = this.socketToRoom.get(socket.id);
      if (roomCode) {
        socket.leave(`strike:${roomCode}`);
        this.leaveRoom(socket.id, userIdNum);
      }
      if (cb) cb();
    });

    // 6. Set Ready
    socket.on("strike:set_ready", (data: { ready: boolean }, cb?: (res: { success: boolean }) => void) => {
      const ok = this.setReady(socket.id, !!data.ready);
      if (cb) cb({ success: ok });
    });

    socket.on("strike:switch_team", (data: { team?: StrikeTeam } | null, cb?: (res: { success: boolean; room?: StrikeRoomState; error?: string }) => void) => {
      const room = this.rooms.get(this.socketToRoom.get(socket.id) || "");
      const team = data?.team;
      if (team !== "red" && team !== "blue") {
        cb?.({ success: false, error: "Geçersiz takım." });
      } else if (!room || room.status !== "lobby" || room.mode === "ffa") {
        cb?.({ success: false, error: "Takım yalnızca takım modunun lobisinde değiştirilebilir." });
      } else if (!this.switchTeam(socket.id, team)) {
        cb?.({ success: false, error: "Takım dolu veya oyuncu odada bulunamadı." });
      } else {
        cb?.({ success: true, room: room.getPublicRoomState() });
      }
    });

    // 8. Start Game (Host only - supports strike:start_game and strike:start_match)
    const handleStartMatch = (arg1?: any, arg2?: any) => {
      const cb = typeof arg1 === "function" ? arg1 : typeof arg2 === "function" ? arg2 : undefined;
      const opts = arg1 && typeof arg1 === "object" ? arg1 : undefined;
      const res = this.startGame(socket.id, opts);
      if (cb) cb(res);
    };
    socket.on("strike:start_game", handleStartMatch);
    socket.on("strike:start_match", handleStartMatch);

    // 9. Return To Lobby (Host only)
    socket.on("strike:return_to_lobby", (cb?: (res: { success: boolean }) => void) => {
      const ok = this.returnToLobby(socket.id);
      if (cb) cb({ success: ok });
    });

    // 10. Gameplay Input (Client -> Server)
    socket.on("strike:input", (input: InputCommand) => {
      this.processPlayerInput(socket.id, input);
    });

    socket.on("strike:input_batch", (commands: unknown) => {
      if (!Array.isArray(commands) || commands.length < 1 || commands.length > 8) return;
      let prevSeq = -1;
      for (const command of commands) {
        if (!command || typeof command !== "object") continue;
        const seq = (command as InputCommand).sequence;
        if (!Number.isSafeInteger(seq) || seq <= prevSeq) continue;
        prevSeq = seq;
        this.processPlayerInput(socket.id, command as InputCommand);
      }
    });

    let rttPending = false;
    const rttTimer = setInterval(() => {
      const current = this.rooms.get(this.socketToRoom.get(socket.id) || "");
      if (current?.status !== "in_progress" || rttPending) return;
      rttPending = true;
      const start = performance.now();
      socket.timeout(2500).emit("strike:rtt", (error: unknown) => {
        rttPending = false;
        if (error) return;
        const room = this.rooms.get(this.socketToRoom.get(socket.id) || "");
        const p = room?.players.get(socket.id);
        if (!p) return;
        const sample = clamp(Math.round(performance.now() - start), 1, 999);
        // Smooth out single-frame client shader/scene stalls while preserving responsive RTT authority
        if (p.ping > 0) {
          const cappedSample = sample > p.ping * 3 && p.ping < 60 ? Math.round(p.ping * 1.5 + sample * 0.25) : sample;
          p.ping = clamp(Math.round(p.ping * 0.65 + cappedSample * 0.35), 1, 999);
        } else {
          p.ping = sample;
        }
        p.lastPingTime = Date.now();
      });
    }, 2000);
    rttTimer.unref?.();
    socket.once("disconnect", () => clearInterval(rttTimer));

    // 11. Client HUD RTT echo; authority uses its own challenge timer for lag compensation.
    socket.on(
      "strike:ping",
      (
        ts: number,
        cb?: (
          ts: number,
          details?: ServerLoopDiagnostics & { inputBatch: boolean; serverTime: number }
        ) => void
      ) => {
        if (typeof cb !== "function" || !Number.isFinite(ts)) return;
        const diag = gameLoopDiagnostics();
        cb(ts, {
          inputBatch: true,
          ...diag,
          serverLoopMaxMs: diag.serverLoopMaxMs,
          serverTime: Date.now(),
        });
      }
    );

    // 12. Voice chat speaking indicator sync
    socket.on("strike:voice_status", (data: { isSpeaking?: boolean; isMuted?: boolean }) => {
      const roomCode = this.socketToRoom.get(socket.id);
      if (!roomCode) return;
      const room = this.rooms.get(roomCode);
      const p = room?.players.get(socket.id);
      if (p) {
        if (typeof data.isSpeaking === "boolean") p.isSpeaking = data.isSpeaking;
        if (typeof data.isMuted === "boolean") p.isMuted = data.isMuted;
        socket.to(`strike:${roomCode}`).emit("strike:player_voice_update", {
          playerId: socket.id,
          isSpeaking: p.isSpeaking,
          isMuted: p.isMuted,
        });
      }
    });

    // 13. WebRTC Voice Signaling Relay (Offers, Answers, Candidates)
    socket.on(
      "strike:voice_signal",
      (payload: { targetUserId?: number; data?: any; speaking?: boolean }) => {
        const roomCode = this.socketToRoom.get(socket.id);
        if (!roomCode) return;
        const room = this.rooms.get(roomCode);
        if (!room) return;

        if (typeof payload?.targetUserId === "number") {
          for (const [pSockId, p] of room.players.entries()) {
            if (p.userId === payload.targetUserId && pSockId !== socket.id) {
              this.io.to(pSockId).emit("strike:voice_signal", {
                fromUserId: user.id,
                fromSocketId: socket.id,
                data: payload.data,
                speaking: payload.speaking,
              });
              break;
            }
          }
        } else {
          socket.to(`strike:${roomCode}`).emit("strike:voice_signal", {
            fromUserId: user.id,
            fromSocketId: socket.id,
            data: payload?.data,
            speaking: payload?.speaking,
          });
        }
      }
    );

    socket.on("strike:accept_invite",(data: { id?: string }, cb?: (reply: {success:boolean; roomCode?:string; error?:string})=>void)=>{
      if(typeof cb !== "function")return;
      const id = data?.id;
      const invite = typeof id === "string" ? this.roomInvites.get(id) : undefined;
      if(!invite || invite.target !== userIdNum || invite.expires <= Date.now())return cb({success:false,error:"Davetin süresi dolmuş."});
      const room = this.rooms.get(invite.roomCode);
      if(!room || ![...room.players.values()].some(p=>p.userId===invite.sender && !p.isDisconnected))return cb({success:false,error:"Davet artık geçerli değil."});
      const result = this.joinRoom(invite.roomCode,u,socket.id,undefined,true);
      if(!result.success)return cb({success:false,error:result.error});
      this.roomInvites.delete(id!);
      cb({success:true,roomCode:invite.roomCode});
    });

    let inviteWindow=0,inviteCount=0;
    socket.on("strike:send_invite",async(data,cb)=>{
      const respond=(success:boolean,error?:string)=>{if(typeof cb === "function")cb({success,error});};
      const room=this.rooms.get(this.socketToRoom.get(socket.id)||"");
      const target=Number(data?.targetUserId);
      if(!room || !room.players.has(socket.id) || !Number.isSafeInteger(target) || target<=0 || target===userIdNum){respond(false,"Davet yetkisi yok.");return;}
      if(Date.now()-inviteWindow>10000){inviteWindow=Date.now();inviteCount=0;}
      if(++inviteCount>3){respond(false,"Davet göndermeden önce biraz bekle.");return;}
      if(!this.dbClient){respond(false,"Arkadaş doğrulaması yapılandırılmamış.");return;}
      try {
        const friends=await this.dbClient.execute({sql:"SELECT id FROM friends WHERE status=1 AND ((user1=? AND user2=?) OR (user1=? AND user2=?)) LIMIT 1",args:[userIdNum,target,target,userIdNum]});
        if(!friends.rows.length){respond(false,"Yalnızca arkadaşlarına davet gönderebilirsin.");return;}
        const now=Date.now();
        for(const [key,invite] of this.roomInvites)if(invite.expires<=now || (invite.target===target && invite.roomCode===room.roomCode))this.roomInvites.delete(key);
        if(this.roomInvites.size>=1024){respond(false,"Davet kuyruğu dolu.");return;}
        const id=randomBytes(18).toString("hex");
        let delivered=false;
        for(const peer of this.io.sockets.sockets.values())if(Number(peer.data.user?.id)===target){
          this.roomInvites.set(id,{target,sender:userIdNum,roomCode:room.roomCode,expires:now+120000});
          peer.emit("activity:invited",{id,activity:"kapsstrike",sender:user.username,room:room.roomCode,roomName:room.name});delivered=true;
        }
        respond(delivered,delivered?undefined:"Arkadaşın şu anda bağlı değil.");
      } catch {respond(false,"Davet gönderilemedi.");}
    });
  }

  public handleDisconnect(socket: Socket, userId: number): void {
    // A replaced socket has no membership: its late disconnect must not remove
    // the current socket for the same user from either the lobby or the match.
    const roomCode = this.socketToRoom.get(socket.id);
    if (!roomCode) return;
    const room = this.rooms.get(roomCode);
    if (!room) {
      this.socketToRoom.delete(socket.id);
      return;
    }

    const player = room.players.get(socket.id);
    if(!player||player.userId!==userId)return;
    if (room.status === "in_progress" && player) {
      // Save disconnected session for seamless reconnect to same team
      this.disconnectedSessions.set(userId, {
        roomCode,
        userId,
        username: player.username,
        avatar: player.avatar,
        color: player.color,
        team: player.team,
        originalTeam: player.originalTeam || player.team,
        score: player.score,
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        damage: player.damage,
        headshots: player.headshots,
        bombPlayer: room.bomb?.players[socket.id] ? { ...room.bomb.players[socket.id] } : undefined,
        disconnectedAt: Date.now()
      });

      player.isDisconnected = true;
      player.disconnectedAt = Date.now();
      const disconnectedAt=player.disconnectedAt;
      player.inputQueue=[];player.heldInput=undefined;player.pendingFire=undefined;
      if(player.isHost){
        const successor=[...room.players.values()].find(p=>p.id!==player.id&&!p.isDisconnected&&!p.id.startsWith('bot-'));
        if(successor){player.isHost=false;successor.isHost=true;successor.ready=true;room.hostId=successor.userId;}
      }
      if (room.bomb) {
        dropBomb(room.bomb, socket.id);
        if (room.bomb.action?.player === socket.id) delete room.bomb.action;
      }
      this.socketToRoom.delete(socket.id);
      this.broadcastRoomState(room);
      this.io.to(`strike:${roomCode}`).emit("strike:player_disconnected", {
        userId,
        username: player.username,
        team: player.team
      });

      // 90 seconds reconnect grace period
      setTimeout(() => {
        const curRoom = this.rooms.get(roomCode);
        if (!curRoom) return;
        const p = curRoom.players.get(socket.id);
        if (p && p.isDisconnected && p.userId === userId && p.disconnectedAt===disconnectedAt) {
          this.leaveRoom(socket.id, userId, true);
        }
      }, 90000).unref();
      return;
    }

    this.leaveRoom(socket.id, userId);
  }
}
