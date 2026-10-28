export type HeroClass = "warrior" | "mage" | "healer";
export type Difficulty = "explorer" | "adventurer" | "nightmare";
export type Point = { x: number; y: number };
export type EffectKind =
  | "burn"
  | "poison"
  | "freeze"
  | "slow"
  | "stun"
  | "vulnerable"
  | "guard"
  | "regen";
export interface Effect {
  kind: EffectKind;
  source: number;
  until: number;
  next: number;
  power: number;
}
export interface Actor extends Point {
  hp: number;
  maxHp: number;
  armor: number;
  effects: Effect[];
  shield: number;
  shieldUntil: number;
}
export interface Item {
  id: string;
  name: string;
  slot: "weapon" | "armor" | "charm" | "relic";
  rarity: number;
  power: number;
  hero: HeroClass;
  effect?: "icefield" | "echo" | "lifeline" | "vampire";
}
export interface Hero extends Actor {
  id: number;
  name: string;
  hero: HeroClass;
  connected: boolean;
  ready: boolean;
  mana: number;
  maxMana: number;
  cooldowns: number[];
  moveAt: number;
  seq: number;
  downUntil: number;
  dead: boolean;
  downs: number;
  invulnerableUntil: number;
  revive?: { target: number; until: number };
  equipment: Partial<Record<Item["slot"], Item>>;
  inventory: Item[];
  potions: number;
  stats: { damage: number; healing: number; kills: number; revives: number };
  ping?: { text: string; until: number };
  pingAt: number;
  title: string;
}
export type EnemyKind =
  | "skeleton"
  | "archer"
  | "spider"
  | "necromancer"
  | "guardian"
  | "assassin"
  | "king"
  | "golem"
  | "warden";
export interface Enemy extends Actor {
  id: number;
  kind: EnemyKind;
  room: number;
  boss: boolean;
  phase: number;
  next: number;
  moveAt: number;
  cast?: number;
  target?: number;
  tauntUntil: number;
  ccUntil: number;
  summonAt: number;
  summoned: boolean;
  state: "idle" | "chase" | "cast" | "recover" | "stunned";
}
export type Tile =
  | "#"
  | "."
  | "+"
  | "D"
  | ">"
  | "C"
  | "H"
  | "M"
  | "^"
  | "~"
  | "!"
  | "S"
  | "U"
  | "K";
export interface Chamber extends Point {
  id: number;
  w: number;
  h: number;
  kind:
    | "start"
    | "combat"
    | "swarm"
    | "elite"
    | "treasure"
    | "trap"
    | "shrine"
    | "upgrade"
    | "puzzle"
    | "boss";
  entered: boolean;
  cleared: boolean;
  optional?: boolean;
}
export interface Floor {
  width: number;
  height: number;
  tiles: Tile[];
  rooms: Chamber[];
  spawn: Point;
  exit: Point;
  theme: string;
  explored: number[];
}
export interface Zone extends Point {
  id: number;
  radius: number;
  at: number;
  until: number;
  kind: "danger" | "fire" | "heal" | "meteor" | "ice";
  source: number;
  damage: number;
  owner: "hero" | "enemy";
  room: number;
}
export interface Projectile extends Point {
  id: number;
  tx: number;
  ty: number;
  ox: number;
  oy: number;
  progress: number;
  source: number;
  owner: "hero" | "enemy";
  damage: number;
  kind: "bolt" | "poison";
  next: number;
  steps: number;
}
export interface Loot extends Point {
  id: string;
  owner: number;
  item: Item;
}
export interface Run {
  id: string;
  seed: number;
  version: number;
  tick: number;
  depth: number;
  difficulty: Difficulty;
  partySize: number;
  status: "playing" | "won" | "lost";
  floor: Floor;
  players: Hero[];
  enemies: Enemy[];
  zones: Zone[];
  projectiles: Projectile[];
  loot: Loot[];
  log: { id: number; text: string; tick: number }[];
  serial: number;
  rng: number;
  transitionAt: number;
  rewardState: "none" | "saving" | "saved" | "retry";
  kills: number;
}
export type Intent = {
  seq: number;
  floor: number;
  action:
    | "move"
    | "cast"
    | "interact"
    | "potion"
    | "equip"
    | "discard"
    | "ping";
  dx?: number;
  dy?: number;
  slot?: number;
  x?: number;
  y?: number;
  target?: number;
  item?: string;
  signal?: number;
};
export interface Lobby {
  persistence?: boolean;
  code: string;
  name: string;
  host: number;
  capacity: number;
  private: boolean;
  locked: boolean;
  difficulty: Difficulty;
  players: Hero[];
  run?: Run;
}
