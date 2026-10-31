import {BOMB_RULES,bombView,bombPurchaseError,createBombMatch,stepBomb,bombInteract,dropBomb,buyBombEquipment,type BombMatch} from "../games/kapsstrike/bomb";
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
import { newMovement, move, fits, clamp, raySolid, rayBox } from "../games/kapsstrike/physics";
import { aimDirection, eye, fireDelay, spreadFor, weaponDamage } from "../games/kapsstrike/combat";

export interface StrikeServerConfig {
  tickRate: number; // 60 Hz
  snapshotRate: number; // 30 Hz, independent of 120 Hz physics
  maxLagCompTicks: number; // 60 shared physics ticks = 500ms
}

export const SERVER_CONFIG: StrikeServerConfig = {
  tickRate: 60,
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
  isHost: boolean;
  ready: boolean;
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
      deadUntil: 0,
      protectedUntil: C.protectionTicks,
      yaw: 0,
      pitch: 0,
    };
  }

  recordHistory(tick: number, time: number) {
    this.history.push({
      tick,
      time,
      position: { ...this.state.movement.position },
      stance: this.state.movement.stance,
      height: this.state.movement.height,
      hp: this.state.hp,
    });
    if (this.history.length > 60) {
      this.history.shift();
    }
  }

  getHistoricalPosition(targetTick: number): { position: Vec3; height: number; hp: number } {
    if (this.history.length === 0) {
      return {
        position: { ...this.state.movement.position },
        height: this.state.movement.height,
        hp: this.state.hp,
      };
    }
    // Find closest historical frame or interpolate
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].tick <= targetTick) {
        return {
          position: { ...this.history[i].position },
          height: this.history[i].height,
          hp: this.history[i].hp,
        };
      }
    }
    return {
      position: { ...this.history[0].position },
      height: this.history[0].height,
      hp: this.history[0].hp,
    };
  }
}

export class StrikeRoom {
  bomb?:BombMatch;
  world: StrikeWorld;
  roomCode: string;
  name: string;
  map: MapId;
  mode: StrikeGameMode;
  status: StrikeRoomStatus = "lobby";
  maxPlayers: number;
  scoreLimit: number = 30;
  timeLimit: number = 300;
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
      position: p.state.movement.position,
      velocity: p.state.movement.velocity,
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
      timeLeft: this.timeLeft,
      hostId: this.hostId,
      hasPassword: !!this.password,
      teamScores: { ...this.teamScores },
      players: playerList,
      killFeed: [...this.killFeed],
      winner: this.winner,
    };
  }

  getSnapshotForPlayer(playerSocketId: string): StrikeSnapshot {
    const targetPlayer = this.players.get(playerSocketId);
    const ackSequence = targetPlayer ? targetPlayer.lastSequence : 0;

    const playerSnapshots: PlayerSnapshot[] = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      userId: p.userId,
      username: p.username,
      skin: p.skin,
      weaponSkin:p.cosmeticLoadout[p.state.weapon.selected],
      team: p.team,
      color: p.color,
      hp: p.state.hp,
      position: p.state.movement.position,
      velocity: p.state.movement.velocity,
      yaw: p.state.yaw,
      pitch: p.state.pitch,
      stance: p.state.movement.stance,
      selectedWeapon: p.state.weapon.selected,
      deadUntil: p.state.deadUntil,
      protectedUntil: p.state.protectedUntil,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score,
      assists:p.assists, damage:p.damage, headshots:p.headshots,
      ping: p.ping,
    }));

    return {
      tick: this.tick,
      roomCode:this.roomCode,
      world: structuredClone(this.world),
      localState: targetPlayer ? structuredClone(targetPlayer.state) : undefined,
      serverTime: Date.now(),
      ackSequence,
      bomb:this.bomb?bombView(this.bomb,playerSocketId):undefined,
      players: playerSnapshots,
      teamScores: this.mode !== "ffa" ? { ...this.teamScores } : undefined,
      timeLeft: this.timeLeft,
      events: [...this.events],
    };
  }

  getSpawnPosition(team: StrikeTeam, playerIndex: number): Vec3 {
    const mapDef = MAPS[this.map];
    if (this.mode !== "ffa") {
      const half = Math.max(1, Math.floor(mapDef.spawns.length / 2));
      const pool = team === "red" ? mapDef.spawns.slice(0, half) : mapDef.spawns.slice(half);
      return pool[playerIndex % pool.length] || mapDef.spawns[0];
    }
    return mapDef.spawns[playerIndex % mapDef.spawns.length] || mapDef.spawns[0];
  }
}

export class KapsStrikeServerManager {
  readonly rooms: Map<string, StrikeRoom> = new Map();
  private userToRoom: Map<number, string> = new Map();
  private socketToRoom: Map<string, string> = new Map();

  readonly profiles: StrikeProfiles;
  readonly inventory: StrikeInventory;
  constructor(
    private io: Server,
    private dbClient?: LibsqlClient
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
      list.push({
        id: r.roomCode,
        gameType: "strike",
        title: r.name || `KapsStrike ${r.roomCode}`,
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
        gameMode: `${r.mode.toUpperCase()} · ${MAPS[r.map]?.name || r.map}`,
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

  private broadcastRoomState(room: StrikeRoom) {
    const state = room.getPublicRoomState();
    this.io.to(`strike:${room.roomCode}`).emit("strike:room_state", state);
    this.broadcastRoomsList();
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
      password?: string;
    }
  ): StrikeRoom {
    this.removePreviousMembership(user.id, socketId);
    // Cryptographically random 64-bit room code; UI also accepts the prefix-free form.
    let roomCode = "";
    do {
      roomCode = "KS-" + randomBytes(8).toString("hex").toUpperCase();
    } while (this.rooms.has(roomCode));

    const mapId: MapId = options.mode === "bomb" ? "district" : options.map && MAPS[options.map] ? options.map : "warehouse";
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

  public joinRoom(
    roomCode: string,
    user: { id: number; username: string; avatar: string | null; color?: string },
    socketId: string,
    password?: string
  ): { success: boolean; room?: StrikeRoom; error?: string } {
    const room = this.findRoomByCode(roomCode);
    if (!room) {
      return { success: false, error: "Oda bulunamadı veya kapatılmış olabilir." };
    }

    roomCode = room.roomCode; // Store canonical codes even when users join without KS-.
    if (room.password && room.password !== (password || "").trim()) {
      return { success: false, error: "Hatalı oda şifresi." };
    }

    // A reconnect replaces the previous controller even when the room is full.
    for (const [sId, p] of room.players.entries()) {
      if (p.userId === user.id) {
        if(sId === socketId) return {success:true,room};
        this.socketToRoom.delete(sId);
        const previous=this.io.sockets?.sockets?.get(sId);
        previous?.emit("strike:session_replaced");previous?.leave(`strike:${roomCode}`);
        p.id = socketId;p.state.id=socketId;p.lastSequence=-1;p.lastQueuedSequence=-1;
        p.inputQueue=[];p.heldInput=undefined;p.lastInputTick=room.tick;p.history=[];p.state.weapon.triggerHeld=false;
        if(room.bomb?.players[sId]){const bp=room.bomb.players[sId];delete room.bomb.players[sId];bp.id=socketId;room.bomb.players[socketId]=bp;if(room.bomb.carrier===sId)room.bomb.carrier=socketId;if(room.bomb.action?.player===sId)delete room.bomb.action;}
        room.players.delete(sId);room.players.set(socketId,p);
        this.socketToRoom.set(socketId,roomCode);this.userToRoom.set(user.id,roomCode);
        this.broadcastRoomState(room);return {success:true,room};
      }
    }
    if(room.mode==='bomb'&&room.status==='in_progress'&&!room.players.has(socketId))return {success:false,error:'Aktif bomba maçına yeni oyuncu alınmıyor.'};
    if (room.players.size >= room.maxPlayers) return {success:false,error:"Oda dolu."};
    this.removePreviousMembership(user.id,socketId);

    let team: StrikeTeam = "none";
    if (room.mode !== "ffa") {
      let redCount = 0;
      let blueCount = 0;
      room.players.forEach((p) => {
        if (p.team === "red") redCount++;
        else if (p.team === "blue") blueCount++;
      });
      team = redCount <= blueCount ? "red" : "blue";
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

    player.skin = this.profiles.cache.get(user.id) || "classic";
    player.cosmeticLoadout=this.inventory.cache.get(user.id)?.equipped||{};
    room.players.set(socketId, player);
    this.userToRoom.set(user.id, roomCode);
    this.socketToRoom.set(socketId, roomCode);

    this.broadcastRoomState(room);
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

  public leaveRoom(socketId: string, userId: number): void {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) return;
    const room = this.rooms.get(roomCode);
    if (!room || room.players.get(socketId)?.userId !== userId) return;

    const wasHost = room.players.get(socketId)?.isHost;
    if(room.bomb){
      dropBomb(room.bomb,socketId);
      if(room.bomb.action?.player===socketId)delete room.bomb.action;
      delete room.bomb.players[socketId];
    }
    room.players.delete(socketId);
    this.socketToRoom.delete(socketId);
    if(this.userToRoom.get(userId)===roomCode)this.userToRoom.delete(userId);

    if (room.players.size === 0) {
      if (room.loopInterval) {
        clearInterval(room.loopInterval);
        room.loopInterval = null;
      }
      this.rooms.delete(roomCode);
      this.broadcastRoomsList();
      return;
    }

    if (wasHost) {
      const nextHost = Array.from(room.players.values())[0];
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
    this.broadcastRoomState(room);
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
    player.color = team === "red" ? "#ef4444" : "#3b82f6";
    this.broadcastRoomState(room);
    return true;
  }

  public startGame(socketId: string): { success: boolean; error?: string } {
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

    if(room.mode==='bomb'&&(room.players.size<2||!['red','blue'].every(t=>[...room.players.values()].some(p=>p.team===t))))return {success:false,error:'Her takımda en az bir oyuncu gerekli.'};
    // Both supported event aliases must never reset an already running round.
    if (room.status === "in_progress") return { success: true };
    if(room.mode==='bomb'&&[...room.players.values()].some(p=>!p.ready))return {success:false,error:'Maç başlamadan önce bütün oyuncular hazır olmalı.'};
    room.status = "in_progress";
    room.timeLeft = room.timeLimit;
    room.teamScores = { red: 0, blue: 0 };
    room.killFeed = [];
    room.events = [];
    room.tick = 0;
    room.world=createWorld(MAPS[room.map]);

    // Reset all players and position them at spawns
    let idx = 0;
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
      p.history = [];

      const spawn = room.getSpawnPosition(p.team, idx++);
      p.state.movement = newMovement(spawn);
      p.state.weapon.inventory=[];p.state.weapon.selected="rifle";
      p.state.yaw=0;p.state.pitch=0;
      p.state.hp = 100;
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
    if(room.mode==='bomb')room.bomb=createBombMatch([...room.players.values()].map(p=>({id:p.id,team:p.team==='red'?'T':'CT',position:{...p.state.movement.position}})),0);
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

    // Security: Input validation
    if (
      !command ||
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
      return;
    }

    // Cap input queue to prevent packet flooding/replay abuse
    if (player.inputQueue.length >= 24) return;
    player.lastQueuedSequence = command.sequence;
    // Whitelist fields; never retain arbitrary objects supplied by clients.
    player.inputQueue.push({ sequence:command.sequence, tick:command.tick,
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
    if(!room.bomb)advanceWorld(room.world,mapDef,room.tick);
    if(room.bomb){const b=room.bomb,round=b.round;
      for(const p of Object.values(b.players)){const live=room.players.get(p.id);p.alive=!!live&&live.state.hp>0;if(live)p.position={...live.state.movement.position};}
      stepBomb(b,room.tick*C.dt);
      room.teamScores={red:b.scores.T,blue:b.scores.CT};
      if(b.phase==='finished'){this.concludeMatch(room,{team:b.winner==='T'?'red':'blue',reason:b.reason||'Bomba maçı sona erdi'});return;}
      if(b.round!==round||room.tick===1){let i=0;for(const p of room.players.values()){const bp=b.players[p.id];if(!bp)continue;p.team=bp.team==='T'?'red':'blue';p.state.movement=newMovement(room.getSpawnPosition(p.team,i++));p.state.hp=100;p.state.deadUntil=0;p.state.protectedUntil=0;p.damageCredits.clear();p.state.weapon.switchUntil=0;p.state.yaw=0;p.state.pitch=0;p.inputQueue=[];p.heldInput=undefined;p.state.weapon.selected='pistol';p.state.weapon.reloadUntil=0;p.state.weapon.nextFire=0;p.state.weapon.triggerHeld=false;for(const w of WEAPON_ORDER)p.state.weapon.ammo[w]=WEAPONS[w].capacity;p.history=[];room.addEvent({actor:p.id,kind:'respawn',from:p.state.movement.position});}}
    }
    const now = Date.now();

    // Sample a consistent start-of-step history before applying any player's input.
    const pendingHits:(()=>void)[]=[];
    room.players.forEach(player=>player.recordHistory(room.tick,now));
    // 1. Process player inputs & movement simulation
    room.players.forEach((player) => {

      if(room.bomb&&(room.bomb.phase==='buy'||room.bomb.phase==='result')){player.inputQueue=[];player.heldInput=undefined;return;}
      // Handle respawn when dead
      if (player.state.hp <= 0) {
        if (!room.bomb && room.tick >= player.state.deadUntil) {
          const spawnPos = room.getSpawnPosition(player.team, Math.floor(Math.random() * 10));
          player.state.movement = newMovement(spawnPos);
          player.damageCredits.clear();
          player.state.yaw=0;player.state.pitch=0;
          player.state.weapon.triggerHeld=false;player.state.weapon.nextFire=0;player.state.weapon.switchUntil=0;
          player.state.hp = 100;
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
        player.inputQueue = [];player.heldInput=undefined;
        return;
      }

      // Process queued inputs
      {
        // One command per fixed physics step: packet volume cannot buy movement time.
        const queued = player.inputQueue.shift();
        const neutral:InputCommand={sequence:player.lastSequence,tick:room.tick,yaw:player.state.yaw,pitch:player.state.pitch,moveX:0,moveZ:0,jump:player.state.movement.jumpHeld,sprint:false,crouch:player.state.movement.stance!=="stand",fire:false,ads:false,reload:false};
        const input:InputCommand=queued || (player.heldInput&&room.tick-player.lastInputTick<12 ? {...player.heldInput,tick:room.tick,fire:false,reload:false,interact:false,weapon:undefined} : neutral);
        if(queued){player.lastSequence=input.sequence;player.lastInputTick=room.tick;player.heldInput={...input};}

        player.state.yaw = input.yaw;
        player.state.pitch = clamp(input.pitch, -1.48, 1.48);

        if(!room.bomb&&input.interact)claimSupply(room.world,mapDef,player.state,room.tick);

        // Handle weapon switch request
        if (input.weapon && (!room.bomb||room.bomb.players[player.id]?.weapons.includes(input.weapon)) && ownsWeapon(player.state.weapon,input.weapon) && input.weapon !== player.state.weapon.selected) {
          { // A new selection restarts the equip delay; it cannot bypass fire cooldown.
            player.state.weapon.reloadUntil = 0;
            player.state.weapon.selected = input.weapon;
            player.state.weapon.switchUntil = room.tick + 24;
          }
        }

        // Handle reload request
        const curWeapon = player.state.weapon.selected;
        const wDef = WEAPONS[curWeapon];
        if (input.reload && !player.state.weapon.reloadUntil) {
          if (player.state.weapon.ammo[curWeapon] < wDef.capacity) {
            player.state.weapon.reloadUntil = room.tick + Math.ceil(wDef.reload / C.dt);
            room.addEvent({
              actor: player.id,
              kind: "reload",
              weapon: curWeapon,
            });
          }
        }

        // Finish active reload if timer reached
        if (player.state.weapon.reloadUntil && room.tick >= player.state.weapon.reloadUntil) {
          player.state.weapon.ammo[curWeapon] = wDef.capacity;
          player.state.weapon.reloadUntil = 0;
        }

        // Apply movement physics using authored map geometry
        move(player.state.movement, { ...input, weapon:curWeapon }, mapDef, room.tick);

        // Authoritative Shoot verification & Lag Compensation
        if (input.fire && (wDef.automatic || !player.state.weapon.triggerHeld)) {
          this.verifyAndExecuteShot(room, player, input.ads, input.tick, pendingHits);
        }
        if (queued) player.state.weapon.triggerHeld = input.fire;
      }
    });

    // Resolve all valid same-step shots after every player has had a chance to fire.
    for(const hit of pendingHits)hit();
    this.checkMatchEndConditions(room);

    // 2. Broadcast snapshots at snapshotRate (30 Hz)
    if (room.tick % Math.round(1 / C.dt / SERVER_CONFIG.snapshotRate) === 0) {
      room.players.forEach((p) => {
        const snapshot = room.getSnapshotForPlayer(p.id);
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
          this.tickSimulation(room);
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

    // Verification: can shooter fire right now?
    if (
      pState.hp <= 0 ||
      room.tick < wState.nextFire ||
      room.tick < wState.switchUntil ||
      wState.reloadUntil > 0 ||
      wState.ammo[weaponId] <= 0
    ) {
      return;
    }

    // Deduct ammo & enforce RPM fire cooldown
    if (weaponId !== "knife") wState.ammo[weaponId]--;
    wState.nextFire = Math.max(wState.nextFire,room.tick-1)+fireDelay(weaponId,ads);
    wState.shotIndex++;

    const origin = eye(pState);

    // Compute lag compensation rewind tick (bounded to maxLagCompTicks)
    const rewindTick = Math.max(
      room.tick - SERVER_CONFIG.maxLagCompTicks,
      Math.min(room.tick, Number(clientShotTick) || room.tick)
    );

    // Pellet spread calculations
    const spread = spreadFor(pState,ads);

    const mapDef = MAPS[room.map];

    for (let pellet = 0; pellet < def.pellets; pellet++) {
      const n = wState.shotIndex * 31 + pellet * 7;
      // Deterministic spread formula
      const r1 = this.seededRandom(n);
      const r2 = this.seededRandom(n + 17);
      const yaw = pState.yaw + (r1 - 0.5) * spread * 2;
      const pitch = pState.pitch + (r2 - 0.5) * spread * 2;
      const dir = aimDirection(yaw, pitch);

      // 1. Raycast against solid map cover
      let nearest = def.range;
      for (const solid of mapDef.solids) {
        if (!solid.detail) {
          nearest = Math.min(nearest, raySolid(origin, dir, solid, def.range));
        }
      }

      // 2. Raycast against other players rewound to client shot tick
      let hitPlayer: StrikeServerPlayer | undefined;
      let isHeadshot = false;

      room.players.forEach((target) => {
        if (target.id === shooter.id || target.state.hp <= 0) return;
        // TDM friendly fire check: teammates take no damage
        if (room.mode !== "ffa" && target.team === shooter.team) return;

        // Spawn protection check
        if (room.tick < target.state.protectedUntil) return;

        const hist = target.getHistoricalPosition(rewindTick);
        const pos = hist.position;

        for (const region of ["body", "head"] as const) {
          const { radius: r, min: rawLow, max: rawHigh } = TARGET_HITBOXES[region];
          const offset = C.standing - hist.height;
          const low = Math.max(0.08, rawLow - offset), high = rawHigh - offset;
          const dist = rayBox(
            origin,
            dir,
            { x: pos.x - r, y: pos.y + low, z: pos.z - r },
            { x: pos.x + r, y: pos.y + high, z: pos.z + r },
            def.range
          );

          if (dist < nearest) {
            nearest = dist;
            hitPlayer = target;
            isHeadshot = region === "head";
          }
        }
      });

      const impactPoint = {
        x: origin.x + dir.x * nearest,
        y: origin.y + dir.y * nearest,
        z: origin.z + dir.z * nearest,
      };

      // Emit shot tracer event
      room.addEvent({
        actor: shooter.id,
        kind: "shot",
        weapon: weaponId,
        from: origin,
        to: impactPoint,
      });

      // Apply damage if target hit
      if (hitPlayer) {
        const victim=hitPlayer;
        const apply=()=>{
          if(victim.state.hp<=0)return;
        const damagePerPellet = weaponDamage(weaponId,nearest,isHeadshot,ads);
        const armor=room.bomb?.players[victim.id];const absorbed=armor?Math.min(armor.armor,damagePerPellet*.35):0;if(armor)armor.armor-=absorbed;
        const finalDamage = Math.min(victim.state.hp, damagePerPellet-absorbed);

        victim.state.hp = Math.max(0, victim.state.hp - finalDamage);
        shooter.damage += finalDamage;
        const credit=victim.damageCredits.get(shooter.id);
        victim.damageCredits.set(shooter.id,{amount:(credit?.amount||0)+finalDamage,tick:room.tick});

        // Register hit event
        room.addEvent({
          actor: shooter.id,
          kind: "hit",
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
  }

  private handlePlayerKill(
    room: StrikeRoom,
    killer: StrikeServerPlayer,
    victim: StrikeServerPlayer,
    weapon: WeaponId,
    headshot: boolean,
    deferEnd = false
  ): void {
    for(const [id,credit] of victim.damageCredits) {
      const helper=room.players.get(id);
      if(id!==killer.id && helper && credit.amount>=20 && room.tick-credit.tick<=8/C.dt){helper.assists++;helper.score+=25;}
    }
    victim.damageCredits.clear();
    dropInventory(room.world,victim.state,room.tick);
    if(room.bomb){room.bomb.players[victim.id].alive=false;dropBomb(room.bomb,victim.id);killer.state.hp=Math.min(100,killer.state.hp);const p=room.bomb.players[killer.id];if(p)p.money=Math.min(BOMB_RULES.maxMoney,p.money+BOMB_RULES.killReward);}
    victim.deaths++;
    victim.state.deadUntil = room.tick + C.respawnTicks;

    killer.kills++;
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

  private seededRandom(index: number): number {
    let x = (index ^ 0x9e3779b9) >>> 0;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
  }

  /**
   * Main Socket.IO connection event registration
   */
  public register(socket: Socket, user: any): void {
    const userIdNum = Number(user.id);
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
        this.io.to(socket.id).emit('strike:snapshot',room.getSnapshotForPlayer(socket.id));reply(success);return;
      }
      if(request.kind==='drop'){reply(dropBomb(b,socket.id));return;}
      if(request.kind==='hold'&&typeof request.held==='boolean'){
        // Objective interaction cannot reach through a wall, even at close range.
        const player=room.players.get(socket.id)!;
        if(request.held&&b.position){
          const from=eye(player.state),to={...b.position,y:b.position.y+.15};
          const distance=Math.hypot(to.x-from.x,to.y-from.y,to.z-from.z);
          const dir={x:(to.x-from.x)/distance,y:(to.y-from.y)/distance,z:(to.z-from.z)/distance};
          if(distance>0&&MAPS[room.map].solids.some(s=>!s.detail&&raySolid(from,dir,s,distance)<distance-.05)){
            bombInteract(b,socket.id,false,now);reply(false,'Bombaya ulaşmak için engelin etrafından geç.');return;
          }
        }
        reply(bombInteract(b,socket.id,request.held,now));return;
      }
      reply(false,'Geçersiz işlem.');
    });
    const applyProfile = (skin: SkinId) => {
      const room = this.rooms.get(this.socketToRoom.get(socket.id) || "");
      const player = room?.players.get(socket.id);
      if (player && room) {player.skin=skin;this.broadcastRoomState(room);}
    };
    void this.profiles.get(userIdNum).then(applyProfile).catch(() => {});
    const applyInventory=(state:import('../games/kapsstrike/cosmetics').Inventory)=>{const room=this.rooms.get(this.socketToRoom.get(socket.id)||'');const player=room?.players.get(socket.id);if(player&&room){player.cosmeticLoadout=state.equipped;this.broadcastRoomState(room);}};
    void this.inventory.get(userIdNum).then(applyInventory).catch(()=>{});
    let inventoryBusy=false, inventoryRequest=0;
    const isInventoryAdmin=String(user.username||'').trim().toLocaleLowerCase('en-US')==='emirgan';
    for(const event of ['get','open','equip'] as const)socket.on('strike:inventory_'+event,async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;
      if(inventoryBusy||(event!=='get'&&Date.now()-inventoryRequest<250)){cb({success:false,error:'Biraz bekle.'});return;}
      inventoryBusy=true;if(event!=='get')inventoryRequest=Date.now();
      try{if(event==='get'){const state=isInventoryAdmin?await this.inventory.grantAll(userIdNum):await this.inventory.get(userIdNum);applyInventory(state);cb({success:true,state});}
      else if(event==='open'){if(typeof data?.caseId!=='string'||data.caseId.length>32)throw new Error('Geçersiz kasa.');cb({success:true,...await this.inventory.open(userIdNum,data.caseId)});}
      else {if(typeof data?.itemId!=='string'||data.itemId.length>64)throw new Error('Geçersiz görünüm.');const state=await this.inventory.equip(userIdNum,data.itemId);applyInventory(state);cb({success:true,state});}}
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Envanter işlemi başarısız.'});}finally{inventoryBusy=false;}
    });
    // Privilege is derived only from the authenticated server-side account name.
    socket.on('strike:inventory_admin_check',(cb:any)=>{if(typeof cb==='function')cb({success:true,allowed:isInventoryAdmin});});
    socket.on('strike:inventory_admin_search',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;if(!isInventoryAdmin){cb({success:false,error:'Yetkin yok.'});return;}
      try{const users=await this.inventory.searchUsers(typeof data?.query==='string'?data.query:'');const results=[];for(const target of users)results.push({...target,inventory:await this.inventory.get(target.id)});cb({success:true,users:results});}
      catch{cb({success:false,error:'Kullanıcılar veya envanterleri yüklenemedi.'});}
    });
    socket.on('strike:inventory_admin_grant_all',async(data:any,cb:any)=>{
      if(typeof cb!=='function')return;if(!isInventoryAdmin){cb({success:false,error:'Yetkin yok.'});return;}
      const targetId=Number(data?.userId);if(!Number.isSafeInteger(targetId)||targetId<=0){cb({success:false,error:'Geçersiz kullanıcı.'});return;}
      try{const target=await this.inventory.getUser(targetId);if(!target)throw new Error('Kullanıcı bulunamadı.');const state=await this.inventory.grantAll(targetId);cb({success:true,user:{...target,inventory:state}});}
      catch(e){cb({success:false,error:e instanceof Error?e.message:'Görünümler eklenemedi.'});}
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

    // 7. Switch Team (TDM)
    socket.on("strike:switch_team", (data: { team: StrikeTeam }, cb?: (res: { success: boolean }) => void) => {
      const ok = this.switchTeam(socket.id, data.team);
      if (cb) cb({ success: ok });
    });

    // 8. Start Game (Host only - supports strike:start_game and strike:start_match)
    const handleStartMatch = (cb?: (res: { success: boolean; error?: string }) => void) => {
      const res = this.startGame(socket.id);
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

    // 11. Ping / RTT Measurement
    socket.on("strike:ping", (ts: number, cb?: (ts: number) => void) => {
      const roomCode = this.socketToRoom.get(socket.id);
      if (roomCode) {
        const room = this.rooms.get(roomCode);
        const p = room?.players.get(socket.id);
        if (p && typeof ts === "number") {
          p.ping = Math.max(1, Math.min(999, Date.now() - ts));
        }
      }
      if (typeof cb === "function") cb(ts);
    });

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
        let delivered=false;
        for(const peer of this.io.sockets.sockets.values())if(Number(peer.data.user?.id)===target){
          peer.emit("strike:invite_received",{targetUserId:target,roomCode:room.roomCode,roomName:room.name,inviterId:userIdNum,inviterName:user.username,inviterAvatar:user.avatar});delivered=true;
        }
        respond(delivered,delivered?undefined:"Arkadaşın şu anda bağlı değil.");
      } catch {respond(false,"Davet gönderilemedi.");}
    });
  }

  public handleDisconnect(socket: Socket, userId: number): void {
    this.leaveRoom(socket.id, userId);
  }
}
