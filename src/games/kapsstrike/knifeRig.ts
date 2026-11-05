export interface KnifeRig {
  mesh?: any;
  animate?: (...args: any[]) => void;
  [key: string]: any;
}

export function createKnifeRig(...args: any[]): KnifeRig {
  return {};
}
