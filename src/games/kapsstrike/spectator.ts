export class TeamSpectator {
  count: number = 0;
  index: number = 0;
  target: any = { id: "p1" };

  constructor(...args: any[]) {}

  cycle(dir: number = 1): any {
    this.index += dir;
    return this.target;
  }

  reset(): void {
    this.index = 0;
    this.target = null;
  }

  update(...args: any[]): any {
    return this.target;
  }
}
