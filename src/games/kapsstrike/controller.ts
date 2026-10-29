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

      const key = e.code;
      if (key === "Escape") {
        e.preventDefault();
        this.pause();
        return;
      }

      // Tab for Scoreboard in multiplayer
      if (key === "Tab") {
        e.preventDefault();
        if (!this.scoreboardOpen) {
          this.scoreboardOpen = true;
          mpOptions?.onScoreboardToggle?.(true);
          this.pushHUD();
        }
        return;
      }

      // V for Push-to-Talk voice
      if (key === "KeyV" && !e.repeat) {
        e.preventDefault();
        this.pttActive = true;
        mpOptions?.onPttChange?.(true);
        if (this.socket && this.roomCode) {
          this.socket.emit("strike:voice_status", { isSpeaking: true });
        }
        this.pushHUD();
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
      const key = e.code;
      this.keys.delete(key);

      if (key === "Tab") {
        e.preventDefault();
        this.scoreboardOpen = false;
        mpOptions?.onScoreboardToggle?.(false);
        this.pushHUD();
        return;
      }

      if (key === "KeyV") {
        e.preventDefault();
        this.pttActive = false;
        mpOptions?.onPttChange?.(false);
        if (this.socket && this.roomCode) {
          this.socket.emit("strike:voice_status", { isSpeaking: false });
        }
        this.pushHUD();
        return;
      }
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
      { passive: false }
    );

    // Setup Multiplayer Socket Handlers
    if (this.isMultiplayer && this.socket) {
      this.setupMultiplayerSocket(this.socket);
    }

    this.pushHUD();
  }

  private setupMultiplayerSocket(socket: Socket) {
    // 1. Authoritative Server Snapshot Handler
    const handleSnapshot = (snapshot: StrikeSnapshot) => {
      if (!snapshot || !Array.isArray(snapshot.players)) return;

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

        // Server reconciliation: if predicted position differs significantly, reconcile
        const currentPos = this.state.player.movement.position;
        const srvPos = myServerState.position;
        const distSq =
          (currentPos.x - srvPos.x) ** 2 +
          (currentPos.y - srvPos.y) ** 2 +
          (currentPos.z - srvPos.z) ** 2;

        if (distSq > 0.04) {
          // Snap to authoritative server position & replay remaining unacknowledged inputs
          this.state.player.movement.position = { ...srvPos };
          this.state.player.movement.velocity = { ...myServerState.velocity };
          const mapDef = MAPS[this.state.map];
          for (const cmd of this.unacknowledgedInputs) {
            simulate(this.state, cmd);
          }
        }
      }

      // Process Combat Events from Server (Remote shots, hits, etc.)
      if (Array.isArray(snapshot.events)) {
        const unseenEvents = snapshot.events.filter((e) => e.id > this.processed);
        this.renderer.process(unseenEvents);
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
        const keyMoveX = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA"));
        const keyMoveZ = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
        const cmd: InputCommand = {
          sequence: ++this.sequence,
          tick: this.state.tick,
          moveX: this.touchMoveX !== 0 ? this.touchMoveX : keyMoveX,
          moveZ: this.touchMoveZ !== 0 ? this.touchMoveZ : keyMoveZ,
          yaw: this.yaw,
          pitch: this.pitch,
          jump: this.touchJump || this.keys.has("Space"),
          sprint: this.touchSprint || this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
          crouch:
            this.touchCrouch ||
            this.keys.has("KeyC") ||
            this.keys.has("ControlLeft") ||
            this.keys.has("ControlRight"),
          fire: this.touchFire || this.mouseFire,
          ads: this.touchAds || this.ads,
          reload: this.pendingReload,
          weapon: this.pendingWeapon,
        };

        // Client prediction: simulate locally
        simulate(this.state, cmd);

        if (this.isMultiplayer && this.socket) {
          this.unacknowledgedInputs.push({ ...cmd });
          this.socket.emit("strike:input", cmd);
        }

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
        this.ads,
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
      if (!this.isTouchDevice && "requestPointerLock" in this.canvas) {
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
