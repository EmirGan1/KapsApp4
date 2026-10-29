import { cleanBindings, held, Bindings, Action } from "./controls";
import type { Socket } from "socket.io-client";
import { StrikeRenderer } from "./renderer";
import { StrikeAudio } from "./audio";
import {
  MapId,
  StrikeSettings,
  InputCommand,
  WeaponId,
  TrainingState,
  CombatEvent,
  StrikeSnapshot,
  PlayerSnapshot,
  StrikeTeam,
} from "./types";
import { MAPS } from "./maps";
import { createTraining, simulate } from "./combat";
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
  ping?: number;
  isMultiplayer?: boolean;
  team?: StrikeTeam;
  redScore?: number;
  blueScore?: number;
  timeLeft?: number;
  scoreboardOpen?: boolean;
  pttActive?: boolean;
  remotePlayerCount?: number;
}

export interface MultiplayerOptions {
  socket?: Socket | null;
  roomCode?: string;
  userId?: number;
  username?: string;
  team?: StrikeTeam;
  isMultiplayer?: boolean;
  onSynchronized?: () => void;
  onScoreboardToggle?: (open: boolean) => void;
  onPttChange?: (active: boolean) => void;
}

interface BufferedSnapshot {
  time: number;
  players: PlayerSnapshot[];
  teamScores?: { red: number; blue: number };
  timeLeft?: number;
}

export class StrikeController {
  readonly state: TrainingState;
  readonly renderer: StrikeRenderer;
  readonly audio = new StrikeAudio();
  private keys = new Set<string>();
  private bindings: Bindings;
  private callbacks?: MultiplayerOptions;
  private previousWeapon: WeaponId = "rifle";
  private mouseFire = false;
  private ads = false;
  private ignoreInitialMouseMove = false;
  private pendingReload = false;
  private pendingWeapon?: WeaponId;
  private lastWheel = -Infinity;
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

  // Multiplayer fields
  readonly isMultiplayer: boolean;
  private socket?: Socket | null;
  private roomCode?: string;
  private localUserId?: number;
  private ping = 0;
  private lastPingSent = 0;
  private pingInterval: any = null;
  private unacknowledgedInputs: InputCommand[] = [];
  private remoteSnapshots: BufferedSnapshot[] = [];
  private scoreboardOpen = false;
  private pttActive = false;
  private teamScores = { red: 0, blue: 0 };
  private matchTimeLeft = 300;
  private localTeam: StrikeTeam = "none";
  private remotePlayerList: PlayerSnapshot[] = [];

  // Mobile / Touch controls
  readonly isTouchDevice: boolean;
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private touchFire = false;
  private touchAds = false;
  private touchJump = false;
  private touchCrouch = false;
  private touchSprint = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    map: MapId,
    readonly settings: StrikeSettings,
    private onHUD: (s: StrikeHUD) => void,
    private onPause: (reason?: string) => void,
    renderer?: StrikeRenderer,
    mpOptions?: MultiplayerOptions
  ) {
    this.bindings = cleanBindings(settings.bindings);
    this.callbacks = mpOptions;
    this.isMultiplayer = !!mpOptions?.isMultiplayer;
    this.socket = mpOptions?.socket;
    this.roomCode = mpOptions?.roomCode;
    this.localUserId = mpOptions?.userId;
    this.localTeam = mpOptions?.team || "none";
    this.isTouchDevice =
      typeof window !== "undefined" &&
      (("ontouchstart" in window) || navigator.maxTouchPoints > 0) &&
      window.innerWidth < 1024;

    this.state = createTraining(
      map,
      this.isMultiplayer && this.socket
        ? this.socket.id || `player-${Date.now()}`
        : globalThis.crypto?.randomUUID?.() ||
            `practice-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    // If multiplayer, clear offline practice dummies from state
    if (this.isMultiplayer) {
      this.state.targets = [];
    }

    this.renderer = renderer || new StrikeRenderer(canvas, MAPS[map], settings);
    this.audio.volume = settings.volume;
    this.previous = { ...this.state.player.movement.position };

    const listen = (
      target: EventTarget,
      type: string,
      fn: EventListener,
      options?: AddEventListenerOptions
    ) => {
      target.addEventListener(type, fn, options);
      this.removers.push(() => target.removeEventListener(type, fn, options));
    };

    listen(document, "pointerlockchange", () => {
      if (document.pointerLockElement === canvas)
        this.ignoreInitialMouseMove = true;
      else if (this.active && !this.isTouchDevice) this.pause();
    });

    listen(document, "pointerlockerror", () => {
      if (!this.isTouchDevice) {
        this.pause("Fare kilitlenemedi. Oyuna dön düğmesine yeniden bas.");
      }
    });

    listen(window, "blur", () => {
      if (!this.isTouchDevice) this.pause();
    });
    listen(document, "visibilitychange", () => {
      if (document.hidden) this.pause();
    });

    listen(canvas, "strike-context-lost", () =>
      this.pause("WebGL bağlantısı kesildi. Menüden haritayı yeniden başlat.")
    );

    listen(window, "keydown", ((e: KeyboardEvent) => {
      if (
        !this.active ||
        (!this.isTouchDevice && document.pointerLockElement !== canvas) ||
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]'
        )
      )
        return;

      if (e.code === "Escape") { e.preventDefault(); this.pause(); return; }
      this.keys.add(e.code);
      if (this.handleActions(e.repeat)) e.preventDefault();
    }) as EventListener);

    listen(window, "keyup", ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
      if (this.active) this.updateHeldActions();
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
        1.48
      );
    }) as EventListener);

    listen(canvas, "mousedown", ((e: MouseEvent) => {
      if (!this.active || document.pointerLockElement !== canvas) return;
      e.preventDefault();
      this.keys.add(`Mouse${e.button}`);
      this.handleActions(false);
    }) as EventListener);

    listen(window, "mouseup", ((e: MouseEvent) => {
      this.keys.delete(`Mouse${e.button}`);
      this.updateHeldActions();
    }) as EventListener);

    listen(canvas, "contextmenu", (e) => e.preventDefault());

    listen(
      canvas,
      "wheel",
      ((e: WheelEvent) => {
        if (!this.active || (!this.isTouchDevice && document.pointerLockElement !== canvas)) return;
        e.preventDefault();
        if (e.deltaY === 0 || performance.now() - this.lastWheel < 140) return;
        this.lastWheel = performance.now();
        const code = e.deltaY > 0 ? "WheelDown" : "WheelUp";
        this.keys.add(code);
        this.handleActions(false);

      }) as EventListener,
      { passive: false }
    );

    // Setup Multiplayer Socket Handlers
    if (this.isMultiplayer && this.socket) {
      this.setupMultiplayerSocket(this.socket, mpOptions?.onSynchronized);
    }

    this.pushHUD();
  }

  private down(action: Action) { return held(this.bindings[action], this.keys); }

  setBindings(value: Bindings) {
    this.bindings = cleanBindings(value);
    this.clearInput();
  }

  private updateHeldActions() {
    const scoreboard = this.active && this.down("scoreboard");
    const ptt = this.active && this.down("ptt");
    if (scoreboard !== this.scoreboardOpen) {
      this.scoreboardOpen = scoreboard;
      this.callbacks?.onScoreboardToggle?.(scoreboard);
    }
    if (ptt !== this.pttActive) {
      this.pttActive = ptt;
      this.callbacks?.onPttChange?.(ptt);
    }
  }

  private handleActions(repeat: boolean): boolean {
    this.updateHeldActions();
    if (this.down("menu")) { this.pause(); return true; }
    if (!repeat) {
      if (this.down("reload")) this.pendingReload = true;
      const current = this.pendingWeapon || this.state.player.weapon.selected;
      let weapon: WeaponId | undefined = WEAPON_ORDER.find(w => this.down(w));
      if (this.down("next") || this.down("previous")) {
        weapon = WEAPON_ORDER[(WEAPON_ORDER.indexOf(current) + (this.down("next") ? 1 : -1) + WEAPON_ORDER.length) % WEAPON_ORDER.length];
      }
      if (this.down("last")) weapon = this.previousWeapon;
      if (weapon && current !== weapon) { this.previousWeapon = current; this.pendingWeapon = weapon; }
    }
    return (Object.keys(this.bindings) as Action[]).some(a => this.down(a));
  }

  private setupMultiplayerSocket(socket: Socket, onSynchronized?: () => void) {
    const disconnected = () => this.pause("Bağlantı kesildi. Menüye dönüp odaya yeniden katılabilirsin.");
    socket.on("disconnect", disconnected);
    this.removers.push(() => socket.off("disconnect", disconnected));
    let synchronized = false;
    let lastSnapshotTick = -1;
    // 1. Authoritative Server Snapshot Handler
    const handleSnapshot = (snapshot: StrikeSnapshot) => {
      if (!snapshot || !Array.isArray(snapshot.players) || snapshot.tick <= lastSnapshotTick) return;
      lastSnapshotTick = snapshot.tick;

      if (snapshot.teamScores) {
        this.teamScores = snapshot.teamScores;
      }
      if (typeof snapshot.timeLeft === "number") {
        this.matchTimeLeft = snapshot.timeLeft;
      }

      this.remotePlayerList = snapshot.players;

      // Buffer snapshot for smooth remote player interpolation
      this.remoteSnapshots.push({
        time: performance.now(),
        players: snapshot.players,
        teamScores: snapshot.teamScores,
        timeLeft: snapshot.timeLeft,
      });

      if (this.remoteSnapshots.length > 15) {
        this.remoteSnapshots.shift();
      }

      // Reconcile local player
      const myId = socket.id;
      const myServerState = snapshot.players.find(
        (p) => p.id === myId || (this.localUserId && p.userId === this.localUserId)
      );

      if (myServerState) {
        if (!synchronized) {
          synchronized = true;
          onSynchronized?.();
        }
        this.state.player.hp = myServerState.hp;
        this.state.score = myServerState.score;
        this.state.player.deadUntil = myServerState.deadUntil;
        this.state.player.protectedUntil = myServerState.protectedUntil;
        this.localTeam = myServerState.team;

        // Discard inputs that server has acknowledged
        const ackSeq = snapshot.ackSequence;
        this.unacknowledgedInputs = this.unacknowledgedInputs.filter(
          (cmd) => cmd.sequence > ackSeq
        );

        // Restore all authoritative timers/stance/weapon state, then replay only
        // unacknowledged commands. Replaying with the old lastSequence rejects every input.
        if (snapshot.localState) {
          this.state.player = structuredClone(snapshot.localState);
          this.state.tick = snapshot.tick;
          this.state.lastSequence = ackSeq;
          for (const cmd of this.unacknowledgedInputs) {
            if (this.state.player.hp > 0) simulate(this.state, cmd, !this.isMultiplayer);
          }
          this.previous = { ...this.state.player.movement.position };
        } else {
          this.state.player.movement.position = { ...myServerState.position };
          this.state.player.movement.velocity = { ...myServerState.velocity };
        }

      }

      // Process Combat Events from Server (Remote shots, hits, etc.)
      if (Array.isArray(snapshot.events)) {
        const unseenEvents = snapshot.events.filter((e) => e.id > this.processed);
        this.renderer.process(unseenEvents, this.state.player.id);
        for (const e of unseenEvents) {
          this.feedback(e);
        }
      }
    };

    socket.on("strike:snapshot", handleSnapshot);
    this.removers.push(() => socket.off("strike:snapshot", handleSnapshot));

    // 2. Ping-pong RTT tracking
    this.pingInterval = setInterval(() => {
      if (this.active && socket.connected) {
        const start = Date.now();
        this.lastPingSent = start;
        socket.emit("strike:ping", start, (ackTs: number) => {
          this.ping = Math.max(1, Date.now() - ackTs);
        });
      }
    }, 2000);
    this.removers.push(() => clearInterval(this.pingInterval));
  }

  private loop = () => {
    if (!this.active || this.disposed) return;
    if (!this.canvas.getClientRects().length) {
      this.pause();
      return;
    }
    try {
      const now = performance.now();
      const elapsed = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.accumulator += elapsed;
      let steps = 0;

      while (this.accumulator >= C.dt && steps < 8) {
        this.previous = { ...this.state.player.movement.position };
        const keyMoveX = Number(this.down("right")) - Number(this.down("left"));
        const keyMoveZ = Number(this.down("forward")) - Number(this.down("backward"));
        const cmd: InputCommand = {
          sequence: ++this.sequence,
          tick: this.state.tick,
          moveX: this.touchMoveX !== 0 ? this.touchMoveX : keyMoveX,
          moveZ: this.touchMoveZ !== 0 ? this.touchMoveZ : keyMoveZ,
          yaw: this.yaw,
          pitch: this.pitch,
          jump: this.touchJump || this.down("jump"),
          sprint: this.touchSprint || this.down("sprint"),
          crouch:
            this.touchCrouch ||
            this.down("crouch") || this.down("slide"),
          fire: this.touchFire || this.mouseFire || this.down("fire"),
          ads: this.touchAds || this.ads || this.down("ads"),
          reload: this.pendingReload,
          weapon: this.pendingWeapon,
        };

        // Client prediction: simulate locally
        if (!this.isMultiplayer || this.state.player.hp > 0) simulate(this.state, cmd, !this.isMultiplayer);

        if (this.isMultiplayer && this.socket) {
          this.unacknowledgedInputs.push({ ...cmd });
          if (this.unacknowledgedInputs.length > 240) this.unacknowledgedInputs.shift();
          this.socket.emit("strike:input", cmd);
        }

        this.keys.delete("WheelUp");
        this.keys.delete("WheelDown");
        this.pendingReload = false;
        this.pendingWeapon = undefined;
        this.accumulator -= C.dt;
        steps++;
      }

      if (this.accumulator >= C.dt) {
        this.dropped += Math.floor(this.accumulator / C.dt);
        this.accumulator %= C.dt;
      }

      // Offline mode local events feedback
      if (!this.isMultiplayer) {
        const events = this.state.events.filter((e) => e.id > this.processed);
        this.renderer.process(events);
        for (const e of events) this.feedback(e);
      }

      // Interpolate and render remote players if in multiplayer
      if (this.isMultiplayer) {
        this.updateAndRenderRemotePlayers();
      }

      this.renderer.render(
        this.state,
        this.yaw,
        this.pitch,
        this.touchAds || this.ads || this.down("ads"),
        this.accumulator / C.dt,
        this.previous,
        elapsed
      );

      if (now - this.lastHUD > 100) {
        this.lastHUD = now;
        this.pushHUD();
      }
    } catch (error) {
      this.pause(
        error instanceof Error
          ? error.message
          : "Oyun durduruldu. Menüden yeniden başlatabilirsin."
      );
    }
  };

  /**
   * Smooth snapshot interpolation for remote players (~70ms interpolation delay)
   */
  private updateAndRenderRemotePlayers() {
    if (this.remoteSnapshots.length === 0) return;

    const myId = this.socket?.id;
    const now = performance.now();
    const renderTime = now - 70; // 70ms buffer

    // Find two snapshots surrounding renderTime
    let older: BufferedSnapshot | null = null;
    let newer: BufferedSnapshot | null = null;

    for (let i = this.remoteSnapshots.length - 1; i >= 0; i--) {
      const snap = this.remoteSnapshots[i];
      if (snap.time <= renderTime) {
        older = snap;
        newer = this.remoteSnapshots[i + 1] || older;
        break;
      }
    }

    if (!older) {
      older = this.remoteSnapshots[0];
      newer = this.remoteSnapshots[1] || older;
    }

    if (!older || !newer) return;

    const timeDiff = newer.time - older.time;
    const alpha = timeDiff > 0 ? clamp((renderTime - older.time) / timeDiff, 0, 1) : 1;

    const interpolatedPlayers = older.players.map((p1) => {
      const p2 = newer!.players.find((p) => p.id === p1.id) || p1;
      return {
        id: p1.id,
        username: p1.username,
        team: p1.team,
        color: p1.color,
        hp: p2.hp,
        stance: p2.stance,
        selectedWeapon: p2.selectedWeapon,
        yaw: p1.yaw + (p2.yaw - p1.yaw) * alpha,
        pitch: p1.pitch + (p2.pitch - p1.pitch) * alpha,
        position: {
          x: p1.position.x + (p2.position.x - p1.position.x) * alpha,
          y: p1.position.y + (p2.position.y - p1.position.y) * alpha,
          z: p1.position.z + (p2.position.z - p1.position.z) * alpha,
        },
      };
    });

    this.renderer.renderRemotePlayers(interpolatedPlayers, myId);
  }

  private feedback(e: CombatEvent) {
    this.processed = e.id;
    if (this.isMultiplayer && e.actor !== this.state.player.id && e.kind !== "shot") return;
    if (e.kind === "shot") {
      if (e.tick === this.lastShotTick) return;
      this.lastShotTick = e.tick;
      if (
        e.weapon === "shotgun" &&
        e.id > 1 &&
        this.state.events.some(
          (a) => a.id === e.id - 1 && a.tick === e.tick && a.kind === "shot"
        )
      )
        return;
      this.audio.play(e.weapon!);
      if (!this.isMultiplayer || e.actor === this.state.player.id)
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
      seconds: this.isMultiplayer ? this.matchTimeLeft : s.tick * C.dt,
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
      ping: this.ping,
      isMultiplayer: this.isMultiplayer,
      team: this.localTeam,
      redScore: this.teamScores.red,
      blueScore: this.teamScores.blue,
      timeLeft: this.matchTimeLeft,
      scoreboardOpen: this.scoreboardOpen,
      pttActive: this.pttActive,
      remotePlayerCount: this.remotePlayerList.length,
    });
  }

  private clearInput() {
    this.keys.clear();
    this.mouseFire = false;
    this.ads = false;
    this.pendingReload = false;
    this.pendingWeapon = undefined;
    this.scoreboardOpen = false;
    this.pttActive = false;
    this.callbacks?.onPttChange?.(false);
    this.callbacks?.onScoreboardToggle?.(false);
    this.touchMoveX = this.touchMoveZ = 0;
    this.touchFire = this.touchAds = this.touchJump = this.touchCrouch = this.touchSprint = false;
  }

  start(capturePointer = true) {
    if (this.disposed) return;
    if (this.isMultiplayer && !this.socket?.connected) {
      this.onPause("Sunucu bağlantısı yok. Menüden odaya yeniden katıl.");
      return;
    }
    this.ignoreInitialMouseMove = true;
    this.canvas.focus();
    this.audio.unlock();
    this.last = performance.now();
    this.accumulator = 0;
    this.active = true;
    try {
      if (capturePointer && !this.isTouchDevice && "requestPointerLock" in this.canvas) {
        const promise = this.canvas.requestPointerLock();
        if (promise) {
          promise.catch(() => {});
        }
      }
      this.renderer.engine.runRenderLoop(this.loop);
    } catch {
      this.renderer.engine.runRenderLoop(this.loop);
    }
  }

  // Public Touch Controls API
  public setTouchMovement(x: number, z: number) {
    this.touchMoveX = clamp(x, -1, 1);
    this.touchMoveZ = clamp(z, -1, 1);
  }

  public addTouchLook(deltaX: number, deltaY: number) {
    const sens = (this.settings.mobileSensitivity || this.settings.sensitivity) * 0.003;
    this.yaw += deltaX * sens;
    this.pitch = clamp(
      this.pitch + deltaY * sens * (this.settings.invertY ? -1 : 1),
      -1.48,
      1.48
    );
  }

  public setTouchFire(fire: boolean) { this.touchFire = fire; }
  public setTouchAds(ads: boolean) { this.touchAds = ads; }
  public setTouchJump(jump: boolean) { this.touchJump = jump; }
  public setTouchCrouch(crouch: boolean) { this.touchCrouch = crouch; }
  public setTouchSprint(sprint: boolean) { this.touchSprint = sprint; }
  public triggerReload() { this.pendingReload = true; }
  public selectWeapon(w: WeaponId) { this.pendingWeapon = w; }

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
    this.unacknowledgedInputs = [];
    this.remoteSnapshots = [];
  }
}
