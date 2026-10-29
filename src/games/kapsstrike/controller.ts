import { StrikeRenderer } from "./renderer";
import { StrikeAudio } from "./audio";
import {
  MapId,
  StrikeSettings,
  InputCommand,
  WeaponId,
  TrainingState,
  CombatEvent,
} from "./types";
import { MAPS } from "./maps";
import { createTraining, simulate, takeDamage } from "./combat";
import { PHYSICS as C, WEAPONS, WEAPON_ORDER } from "./config";
import { clamp } from "./physics";
export interface StrikeHUD {
  hp: number;
  ammo: number;
  capacity: number;
  weapon: WeaponId;
  reload: number;
  seconds: number;
  score: number;
  damage: number;
  dps: number;
  speed: number;
  stance: string;
  fps: number;
  drawCalls: number;
  meshes: number;
  hit?: { damage: number; head: boolean; until: number };
  hurt?: { direction: number; until: number };
  dead: boolean;
  respawn: number;
  protection: number;
  tick: number;
  dropped: number;
  activeMeshes: number;
}
export class StrikeController {
  readonly state: TrainingState;
  readonly renderer: StrikeRenderer;
  readonly audio = new StrikeAudio();
  private keys = new Set<string>();
  private mouseFire = false;
  private ads = false;
  private ignoreInitialMouseMove = false;
  private pendingReload = false;
  private pendingWeapon?: WeaponId;
  private yaw = 0;
  private pitch = 0;
  private sequence = 0;
  private active = false;
  private disposed = false;
  private last = 0;
  private accumulator = 0;
  private lastHUD = 0;
  private processed = 0;
  private lastShotTick = -1;
  private dropped = 0;
  private previous = { x: 0, y: 0, z: 0 };
  private lastHit?: StrikeHUD["hit"];
  private lastHurt?: StrikeHUD["hurt"];
  private removers: (() => void)[] = [];
  constructor(
    readonly canvas: HTMLCanvasElement,
    map: MapId,
    readonly settings: StrikeSettings,
    private onHUD: (s: StrikeHUD) => void,
    private onPause: (reason?: string) => void,
    renderer?: StrikeRenderer,
  ) {
    this.state = createTraining(
      map,
      globalThis.crypto?.randomUUID?.() ||
        `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    this.renderer = renderer || new StrikeRenderer(canvas, MAPS[map], settings);
    this.audio.volume = settings.volume;
    this.previous = { ...this.state.player.movement.position };
    const listen = (
      target: EventTarget,
      type: string,
      fn: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, fn, options);
      this.removers.push(() => target.removeEventListener(type, fn, options));
    };
    listen(document, "pointerlockchange", () => {
      if (document.pointerLockElement === canvas)
        this.ignoreInitialMouseMove = true;
      else if (this.active) this.pause();
    });
    listen(document, "pointerlockerror", () =>
      this.pause("Fare kilitlenemedi. Oyuna dön düğmesine yeniden bas."),
    );
    listen(window, "blur", () => this.pause());
    listen(document, "visibilitychange", () => {
      if (document.hidden) this.pause();
    });
    listen(canvas, "strike-context-lost", () =>
      this.pause("WebGL bağlantısı kesildi. Menüden haritayı yeniden başlat."),
    );
    listen(window, "keydown", ((e: KeyboardEvent) => {
      if (
        !this.active ||
        document.pointerLockElement !== canvas ||
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      const key = e.code;
      if (key === "Escape") {
        e.preventDefault();
        this.pause();
        return;
      }
      if (
        [
          "Space",
          "ControlLeft",
          "ControlRight",
          "ShiftLeft",
          "ShiftRight",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "KeyC",
          "KeyR",
          "Digit1",
          "Digit2",
          "Digit3",
          "Digit4",
          "Digit5",
        ].includes(key)
      )
        e.preventDefault();
      this.keys.add(key);
      if (key === "KeyR" && !e.repeat) this.pendingReload = true;
      if (/^Digit[1-5]$/.test(key) && !e.repeat)
        this.pendingWeapon = WEAPON_ORDER[Number(key.at(-1)) - 1];
    }) as EventListener);
    listen(window, "keyup", ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
    }) as EventListener);
    listen(window, "mousemove", ((e: MouseEvent) => {
      if (!this.active || document.pointerLockElement !== canvas) return;
      if (this.ignoreInitialMouseMove) {
        this.ignoreInitialMouseMove = false;
        return;
      }
      this.yaw +=
        clamp(e.movementX, -200, 200) * 0.002 * this.settings.sensitivity;
      this.pitch = clamp(
        this.pitch +
          clamp(e.movementY, -200, 200) *
            0.002 *
            this.settings.sensitivity *
            (this.settings.invertY ? -1 : 1),
        -1.48,
        1.48,
      );
    }) as EventListener);
    listen(canvas, "mousedown", ((e: MouseEvent) => {
      if (!this.active || document.pointerLockElement !== canvas) return;
      e.preventDefault();
      if (e.button === 0) this.mouseFire = true;
      if (e.button === 2) this.ads = true;
    }) as EventListener);
    listen(window, "mouseup", ((e: MouseEvent) => {
      if (e.button === 0) this.mouseFire = false;
      if (e.button === 2) this.ads = false;
    }) as EventListener);
    listen(canvas, "contextmenu", (e) => e.preventDefault());
    listen(
      canvas,
      "wheel",
      ((e: WheelEvent) => {
        if (!this.active) return;
        e.preventDefault();
        const id = this.pendingWeapon || this.state.player.weapon.selected;
        this.pendingWeapon =
          WEAPON_ORDER[
            (WEAPON_ORDER.indexOf(id) + (e.deltaY > 0 ? 1 : -1) + 5) % 5
          ];
      }) as EventListener,
      { passive: false },
    );
    this.pushHUD();
  }
  private loop = () => {
    if (!this.active || this.disposed) return;
    if (!this.canvas.getClientRects().length) {
      this.pause();
      return;
    }
    try {
      const now = performance.now(),
        elapsed = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.accumulator += elapsed;
      let steps = 0;
      while (this.accumulator >= C.dt && steps < 8) {
        this.previous = { ...this.state.player.movement.position };
        const cmd: InputCommand = {
          sequence: ++this.sequence,
          tick: this.state.tick,
          moveX: Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")),
          moveZ: Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS")),
          yaw: this.yaw,
          pitch: this.pitch,
          jump: this.keys.has("Space"),
          sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
          crouch:
            this.keys.has("KeyC") ||
            this.keys.has("ControlLeft") ||
            this.keys.has("ControlRight"),
          fire: this.mouseFire,
          ads: this.ads,
          reload: this.pendingReload,
          weapon: this.pendingWeapon,
        };
        simulate(this.state, cmd);
        this.pendingReload = false;
        this.pendingWeapon = undefined;
        this.accumulator -= C.dt;
        steps++;
      }
      if (this.accumulator >= C.dt) {
        this.dropped += Math.floor(this.accumulator / C.dt);
        this.accumulator %= C.dt;
      }
      const events = this.state.events.filter((e) => e.id > this.processed);
      this.renderer.process(events);
      for (const e of events) this.feedback(e);
      this.renderer.render(
        this.state,
        this.yaw,
        this.pitch,
        this.ads,
        this.accumulator / C.dt,
        this.previous,
        elapsed,
      );
      if (now - this.lastHUD > 100) {
        this.lastHUD = now;
        this.pushHUD();
      }
    } catch (error) {
      this.pause(
        error instanceof Error
          ? error.message
          : "Oyun durduruldu. Menüden yeniden başlatabilirsin.",
      );
    }
  };
  private feedback(e: CombatEvent) {
    this.processed = e.id;
    if (e.kind === "shot") {
      if (e.tick === this.lastShotTick) return;
      this.lastShotTick = e.tick;
      if (
        e.weapon === "shotgun" &&
        e.id > 1 &&
        this.state.events.some(
          (a) => a.id === e.id - 1 && a.tick === e.tick && a.kind === "shot",
        )
      )
        return;
      this.audio.play(e.weapon!);
      this.pitch = clamp(this.pitch - WEAPONS[e.weapon!].recoil, -1.48, 1.48);
    }
    if (e.kind === "hit") {
      const sameShot = this.lastHit?.until === e.tick + 36;
      this.lastHit = {
        damage: (sameShot ? this.lastHit!.damage : 0) + (e.damage || 0),
        head: !!e.head || (sameShot && !!this.lastHit?.head),
        until: e.tick + 36,
      };
      if (!sameShot) this.audio.play("hit");
    }
    if (e.kind === "reload") this.audio.play("reload");
    if (e.kind === "damage") {
      this.lastHurt = {
        direction: e.direction || 0,
        until: this.state.tick + 60,
      };
      this.audio.play("damage");
    }
    if (e.kind === "respawn") {
      this.yaw = 0;
      this.pitch = 0;
      this.previous = { ...this.state.player.movement.position };
      this.clearInput();
    }
  }
  private pushHUD() {
    const s = this.state,
      p = s.player,
      w = p.weapon,
      stats = this.renderer.stats();
    this.onHUD({
      hp: p.hp,
      ammo: w.ammo[w.selected],
      capacity: WEAPONS[w.selected].capacity,
      weapon: w.selected,
      reload: Math.max(0, (w.reloadUntil - s.tick) * C.dt),
      seconds: s.tick * C.dt,
      score: s.score,
      damage: s.damage,
      dps:
        s.firstHit < 0
          ? 0
          : s.damage / Math.max(1, (s.tick - s.firstHit) * C.dt),
      speed: Math.hypot(p.movement.velocity.x, p.movement.velocity.z),
      stance: p.movement.stance,
      ...stats,
      hit: this.lastHit,
      hurt: this.lastHurt,
      dead: p.hp <= 0,
      respawn: Math.max(0, (p.deadUntil - s.tick) * C.dt),
      protection: Math.max(0, (p.protectedUntil - s.tick) * C.dt),
      tick: s.tick,
      dropped: this.dropped,
    });
  }
  private clearInput() {
    this.keys.clear();
    this.mouseFire = false;
    this.ads = false;
    this.pendingReload = false;
    this.pendingWeapon = undefined;
  }
  start() {
    if (this.disposed) return;
    this.ignoreInitialMouseMove = true;
    this.canvas.focus();
    this.audio.unlock();
    this.last = performance.now();
    this.accumulator = 0;
    this.active = true;
    try {
      const promise = this.canvas.requestPointerLock();
      if (promise)
        promise.catch(() => this.pause("Fare kilidi reddedildi. Tekrar dene."));
      this.renderer.engine.runRenderLoop(this.loop);
    } catch {
      this.pause("Bu tarayıcı fare kilidini desteklemiyor.");
    }
  }
  pause(reason?: string) {
    if (!this.active) return;
    this.active = false;
    this.clearInput();
    this.renderer.engine.stopRenderLoop(this.loop);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.onPause(reason);
  }
  setReturnFire(enabled: boolean) {
    this.state.returnFire = enabled;
  }
  dispose() {
    if (this.disposed) return;
    this.active = false;
    this.disposed = true;
    this.clearInput();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.removers.splice(0).forEach((f) => f());
    this.audio.dispose();
    this.renderer.dispose();
  }
}
