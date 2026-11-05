export class BombEffects {
  age: number = 0;
  constructor(...args: any[]) {}
  update(...args: any[]): { x: number; y: number; z: number } {
    this.age += 0.016;
    return { x: 0, y: 0, z: 0 };
  }
  dispose(): void {}
}
