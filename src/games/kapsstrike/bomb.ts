export interface BombMatch {
  planted?: boolean;
  defused?: boolean;
  exploded?: boolean;
  site?: string;
  planter?: string;
  defuser?: string;
  plantTimer?: number;
  defuseTimer?: number;
  countdown?: number;
  [key: string]: any;
}

export const BOMB_SITES = [
  { id: "A", x: 20, y: 0, z: 20, radius: 4 },
  { id: "B", x: -20, y: 0, z: -20, radius: 4 }
];

export const BOMB_RULES = {
  plantTime: 3.5,
  defuseTime: 5.0,
  detonateTime: 40.0,
  maxMoney: 16000,
  killReward: 300
};

export function bombView(match?: any, socketId?: any): any {
  return match;
}

export function bombPurchaseError(...args: any[]): any {
  return null;
}

export function createBombMatch(...args: any[]): BombMatch {
  return { planted: false, defused: false, exploded: false };
}

export function stepBomb(match: any, delta?: number): void {}

export function bombInteract(...args: any[]): any {
  return null;
}

export function dropBomb(...args: any[]): any {
  return null;
}

export function buyBombEquipment(...args: any[]): any {
  return null;
}
