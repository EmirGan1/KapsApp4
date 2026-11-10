export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export type MapId = "warehouse" | "dust" | "neon" | "district" | "bolluca";
export type WeaponId = "rifle" | "smg" | "sniper" | "shotgun" | "pistol" | "knife" | "carbine" | "lmg" | "railgun";
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
  reverse?: boolean;
  detail?: boolean;
  hidden?: boolean;
  shape?: "cylinder" | "cone";
  surface?: "plaster" | "stone" | "brick" | "metal" | "asphalt" | "concrete" | "wood" | "glass" | "water" | "fabric";
  glow?: boolean;
  label?: string;
}
export interface TargetDefinition {
  id: string;
  position: Vec3;
  moving?: boolean;
}
export interface MapPhotoFrame {
  id: string;
  image: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotationY: number;
}
export interface BombSite extends Vec3 {
  id: "A" | "B";
  radius: number;
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
  routes?: { name: string; points: Vec3[] }[];
  landmarks?: string[];
  photoFrames?: MapPhotoFrame[];
  bombSites?: readonly BombSite[];
  radarFootprint?: readonly (readonly [west: number, east: number, south: number, north: number])[];
}
export interface InputCommand {
  sequence: number;
  /** Tick of the remote pose actually displayed; fractional interpolation is intentional. */
  viewTick?: number;
  /** Predicted shot index used only for acknowledgement correlation, never damage authority. */
  shot?: number;
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
  interact?: boolean;
}
export interface MovementState {
  lastSafePosition?:Vec3;
  spawnPosition?: Vec3;
  position: Vec3;
  velocity: Vec3;
  grounded: boolean;
  stance: "stand" | "crouch" | "slide";
  slideUntil: number;
  height: number;
  jumpHeld: boolean;
  crouchHeld: boolean;
}
export interface WorldPickup {
  id: string; position: Vec3; ammo?:number; weapon: WeaponId; weapons?:WeaponId[]; consumable?:"health"|"armor"; amount?:number; kind: "chest" | "dropped" | "airdrop"; opened: boolean; expires: number;
}
export interface StrikeWorld {
  respawns?: {at:number;pickup:WorldPickup}[]; pickups: WorldPickup[]; nextDrop: number; drop?: {position: Vec3; warning: number; landing: number}; serial: number; seed: number;
}
export interface WeaponState {
  inventory?: WeaponId[];
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
  armor?:number;
  lootNotice?:string;
  lootNoticeUntil?:number;
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
export interface ShotReceipt {
 shotId:string;sequence:number;predictedShot?:number;weapon:WeaponId;serverTick:number;
 accepted:boolean;outcome:'hit'|'world'|'miss'|'rejected'|'buffered';reason?:string;damage:number;head:boolean;
 receivedAt:number;processedAt:number;queueMs:number;
}
export interface CombatEvent {
  id: number;
  tick: number;
  actor: string;
  shotId?:string;
  kind: "shot" | "hit" | "reload" | "death" | "respawn" | "damage" | "defuse";
  weapon?: WeaponId;
  from?: Vec3;
  to?: Vec3;
  target?: string;
  damage?: number;
  head?: boolean;
  direction?: number;
}
export interface TrainingState {
  bomb?:import("./bomb").BombMatch;
  world?: StrikeWorld;
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
  trackpadLook?: boolean;
  hiddenWeapons?: WeaponId[];
  cosmeticLoadout?: import("./cosmetics").Inventory["equipped"];
  bindings?: import("./controls").Bindings;
  selectedSkin?: import("./skins").SkinId;
  quality: "low" | "medium" | "high" | "auto";
  scale: number;
  sensitivity: number;
  mobileSensitivity?: number;
  touchAimAssist?:boolean;
  touchAutoFire?:boolean;
  fov: number;
  volume: number;
  effectsVolume?: number;
  voiceVolume?: number;
  dynamicResolution?: boolean;
  invertY: boolean;
  gyroMode?: "off" | "ads" | "always";
  gyroSensitivity?: number;
  controlMode?: import('../../utils/gameInput').GameControlMode;
  showDebugStats?: boolean;
}

export type StrikeGameMode = "ffa" | "tdm" | "bomb";
export type StrikeTeam = "red" | "blue" | "none";
export type StrikeRoomStatus = "lobby" | "in_progress" | "game_over";

export interface NetworkPlayer {
  skin?: import("./skins").SkinId;
  weaponSkin?:string;
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
  connected?: boolean;
  assists?: number;
  damage?: number;
  headshots?: number;
  skin?: import("./skins").SkinId;
  weaponSkin?:string;
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
  bomb?:import("./bomb").BombMatch;
  world?: StrikeWorld;
  roomCode?: string;
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
  utility?: "frag";
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
  bombRounds?: number;
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
