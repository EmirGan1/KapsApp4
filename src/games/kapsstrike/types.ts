export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export type MapId = "warehouse" | "dust" | "neon";
export type WeaponId = "rifle" | "smg" | "sniper" | "shotgun" | "pistol";
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
  quality: "low" | "medium" | "high";
  scale: number;
  sensitivity: number;
  fov: number;
  volume: number;
  invertY: boolean;
}
