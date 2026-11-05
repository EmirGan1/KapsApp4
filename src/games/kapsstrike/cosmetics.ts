export interface Cosmetic {
  id: string;
  name?: string;
  color?: string;
  metal?: number;
  roughness?: number;
  texture?: string;
  [key: string]: any;
}

export interface Inventory {
  equipped: Record<string, string>;
  items?: Cosmetic[];
}

export const COSMETICS: any = [];

export function cleanLoadout(loadout?: any): Record<string, string> {
  return loadout && typeof loadout === "object" ? loadout : {};
}

export function cosmetic(id?: string): Cosmetic | null {
  return id ? { id, name: id } : null;
}
