export interface StrikeWorld {
  supplies?: any[];
  items?: any[];
  pickups: any[];
  nextDrop: number;
  serial: number;
  seed: number;
  [key: string]: any;
}

export function createWorld(...args: any[]): StrikeWorld {
  return { supplies: [], items: [], pickups: [], nextDrop: 0, serial: 0, seed: 12345 };
}

export function advanceWorld(...args: any[]): void {}

export function claimSupply(...args: any[]): any {
  return null;
}

export function dropInventory(...args: any[]): any {
  return null;
}

export function nearestSupply(...args: any[]): any {
  return null;
}

export function supplyLabel(...args: any[]): string {
  return "";
}
