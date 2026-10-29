export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export type MapId = "warehouse" | "dust" | "neon";
export type WeaponId = "rifle" | "smg" | "sniper" | "shotgun" | "pistol" | "knife";
export interface Solid {
  id: string;
  kind: "box" | "ramp";
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  color: string;
  axis?: "x" | "z";
  detail?: boolean;
}
export interface TargetDefinition {
  id: string;
  position: Vec3;
  moving?: boolean;
}
export interface MapDefinition {
  id: MapId;
  name: string;
  subtitle: string;
  bounds: number;
  sky: string;
  floor: string;
  solids: Solid[];
  spawns: Vec3[];
  targets: TargetDefinition[];
  hazard: { x: number; z: number; r: number };
}
export interface InputCommand {
  sequence: number;
  tick: number;
  moveX: number;
  moveZ: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
  fire: boolean;
  ads: boolean;
  reload: boolean;
  weapon?: WeaponId;
}
export interface MovementState {
  position: Vec3;
  velocity: Vec3;
  grounded: boolean;
  stance: "stand" | "crouch" | "slide";
  slideUntil: number;
  height: number;
  jumpHeld: boolean;
  crouchHeld: boolean;
}
export interface WeaponState {
  selected: WeaponId;
  ammo: Record<WeaponId, number>;
  nextFire: number;
  reloadUntil: number;
  switchUntil: number;
  triggerHeld: boolean;
  shotIndex: number;
}
export interface PlayerState {
  id: string;
  movement: MovementState;
  weapon: WeaponState;
  hp: number;
  deadUntil: number;
  protectedUntil: number;
  yaw: number;
  pitch: number;
}
export interface DummyState {
  id: string;
  position: Vec3;
  hp: number;
  respawnAt: number;
}
export interface CombatEvent {
  id: number;
  tick: number;
  actor: string;
  kind: "shot" | "hit" | "reload" | "death" | "respawn" | "damage";
  weapon?: WeaponId;
  from?: Vec3;
  to?: Vec3;
  target?: string;
  damage?: number;
  head?: boolean;
  direction?: number;
}
export interface TrainingState {
  tick: number;
  map: MapId;
  player: PlayerState;
  targets: DummyState[];
  score: number;
  damage: number;
  firstHit: number;
  lastDamageTick: number;
  events: CombatEvent[];
  eventId: number;
  returnFire: boolean;
  lastSequence: number;
}
export interface StrikeSettings {
  bindings?: import("./controls").Bindings;
  quality: "low" | "medium" | "high" | "auto";
  scale: number;
  sensitivity: number;
  mobileSensitivity?: number;
  fov: number;
  volume: number;
  effectsVolume?: number;
  voiceVolume?: number;
  dynamicResolution?: boolean;
  invertY: boolean;
}

export type StrikeGameMode = "ffa" | "tdm";
export type StrikeTeam = "red" | "blue" | "none";
export type StrikeRoomStatus = "lobby" | "in_progress" | "game_over";

export interface NetworkPlayer {
  skin?: import("./skins").SkinId;
  id: string; // Actor / Socket ID
  userId: number; // KapsApp user ID
  username: string;
  avatar: string | null;
  color: string;
  team: StrikeTeam;
  isHost: boolean;
  ready: boolean;
  isAlive: boolean;
  hp: number;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  stance: "stand" | "crouch" | "slide";
  selectedWeapon: WeaponId;
  ammo: Record<WeaponId, number>;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  damage: number;
  headshots: number;
  ping: number;
  isSpeaking?: boolean;
  isMuted?: boolean;
}

export interface PlayerSnapshot {
  skin?: import("./skins").SkinId;
  id: string;
  userId: number;
  username: string;
  team: StrikeTeam;
  color: string;
  hp: number;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  stance: "stand" | "crouch" | "slide";
  selectedWeapon: WeaponId;
  deadUntil: number;
  protectedUntil: number;
  kills: number;
  deaths: number;
  score: number;
  ping: number;
}

export interface StrikeSnapshot {
  localState?: PlayerState;
  tick: number;
  serverTime: number;
  ackSequence: number; // Acknowledged input sequence for the recipient client
  players: PlayerSnapshot[];
  teamScores?: { red: number; blue: number };
  timeLeft: number;
  events: CombatEvent[];
}

export interface KillFeedEntry {
  id: string;
  tick: number;
  killerId: string;
  killerName: string;
  killerTeam: StrikeTeam;
  victimId: string;
  victimName: string;
  victimTeam: StrikeTeam;
  weapon: WeaponId;
  headshot: boolean;
  timestamp: number;
}

export interface StrikeRoomState {
  roomCode: string;
  name: string;
  map: MapId;
  mode: StrikeGameMode;
  status: StrikeRoomStatus;
  maxPlayers: number;
  scoreLimit: number;
  timeLimit: number; // in seconds
  timeLeft: number; // in seconds
  hostId: number;
  hasPassword: boolean;
  teamScores: { red: number; blue: number };
  players: NetworkPlayer[];
  killFeed: KillFeedEntry[];
  winner?: {
    team?: StrikeTeam;
    userId?: number;
    username?: string;
    reason: string;
  };
}

export interface StrikeRoomSummary {
  id: string;
  roomCode: string;
  name: string;
  map: MapId;
  mode: StrikeGameMode;
  status: StrikeRoomStatus;
  playerCount: number;
  maxPlayers: number;
  hostId: number;
  hostName: string;
  hasPassword: boolean;
  ping?: number;
}

export interface MatchStats {
  kills: number;
  deaths: number;
  headshots: number;
  damage: number;
  score: number;
  won: boolean;
  mode: StrikeGameMode;
  winnerTeam?: StrikeTeam;
  winnerName?: string;
  mvp?: {
    userId: number;
    username: string;
    kills: number;
    damage: number;
  };
}
