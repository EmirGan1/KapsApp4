import {nearestSupply} from './world';
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
  Vec3,
  StrikeWorld,
  CombatEvent,
  StrikeSnapshot,
  PlayerSnapshot,
  StrikeTeam,
} from "./types";
import { MAPS } from "./maps";
import {touchControls,currentInputDevice} from '../../utils/gameInput';
import { createTraining, simulate } from "./combat";
import { PHYSICS as C, WEAPONS, WEAPON_ORDER, ownsWeapon } from "./config";
import { clamp, fits } from "./physics";

export interface StrikeHUD {
  inventory?:WeaponId[];
  world?: StrikeWorld;
  position?: Vec3;
  yaw?: number;
  radar?: {x:number;z:number;team:StrikeTeam}[];
  supplyPrompt?: string;
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
  hurt?: { direction: number; until: number; damage?: number };
  ads?: boolean;
  dead: boolean;
  respawn: number;
  protection: number;
  tick: number;
  dropped: number;
  activeMeshes: number;
  ping?: number;
  jitter?: number;
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
  onLoadingStage?: (stage:string) => void;
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
  private shotSounds = new Map<string,number>();
  private dropped = 0;
  private correction={x:0,y:0,z:0};
  private pendingInteract=false;
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
  private jitter = 0;
  private snapshotArrival = 0;
  private receivedInitialState = false;
  private notifiedReady = false;
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
  get isTouchDevice(){return touchControls(this.settings.controlMode);}
  private get usesPointerLock(){return typeof this.canvas.requestPointerLock==='function'&&!currentInputDevice().nativeTouch;}
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
    this.settings={...settings};
    this.bindings = cleanBindings(settings.bindings);
    this.callbacks = mpOptions;
    this.isMultiplayer = !!mpOptions?.isMultiplayer;
    this.socket = mpOptions?.socket;
    this.roomCode = mpOptions?.roomCode;
    this.localUserId = mpOptions?.userId;
    this.localTeam = mpOptions?.team || "none";

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

    this.renderer = renderer || new StrikeRenderer(canvas, MAPS[map], this.settings);
    this.audio.volume = settings.volume*(settings.effectsVolume??.8);
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
      else if (this.active && !this.isTouchDevice && this.usesPointerLock) this.pause();
    });

    listen(document, "pointerlockerror", () => {
      if (!this.isTouchDevice && this.usesPointerLock) {
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
        (!this.isTouchDevice && this.usesPointerLock && document.pointerLockElement !== canvas) ||
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
      if (!this.active || (document.pointerLockElement !== canvas && !(!this.usesPointerLock&&e.target===canvas&&e.buttons>0))) return;
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
      if (!this.active || (!this.isTouchDevice && this.usesPointerLock && document.pointerLockElement !== canvas)) return;
      e.preventDefault();
      this.keys.add(`Mouse${e.button}`);
      this.handleActions(false);
    }) as EventListener);

    listen(window, "mouseup", ((e: MouseEvent) => {
      this.keys.delete(`Mouse${e.button}`);
      this.updateHeldActions();
    }) as EventListener);

    listen(canvas,"auxclick",e=>{if(this.active)e.preventDefault();});
    listen(canvas, "contextmenu", (e) => e.preventDefault());

    listen(
      canvas,
      "wheel",
      ((e: WheelEvent) => {
        if (!this.active || (!this.isTouchDevice && this.usesPointerLock && document.pointerLockElement !== canvas)) return;
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

  updateSettings(next:StrikeSettings){
    const wasTouch=this.isTouchDevice;
    const changed=JSON.stringify(next.bindings)!==JSON.stringify(this.settings.bindings);
    Object.assign(this.settings,next);
    if(changed)this.setBindings(cleanBindings(next.bindings));
    this.audio.volume=next.volume*(next.effectsVolume??.8);
    this.renderer.updateSettings(next);
    if(wasTouch!==this.isTouchDevice){
      this.clearInput();
      if(this.isTouchDevice&&document.pointerLockElement===this.canvas)document.exitPointerLock();
      if(this.active&&!this.isTouchDevice)this.pause('Klavye/fare kontrolüne geçildi. Oyuna devam et düğmesine bas.');
    }
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
      if(this.down("inspect"))this.renderer.inspect();
      if(this.down("interact"))this.pendingInteract=true;
      if (this.down("reload")) this.pendingReload = true;
      const available=WEAPON_ORDER.filter(w=>ownsWeapon(this.state.player.weapon,w));
      const current = this.pendingWeapon || this.state.player.weapon.selected;
      let weapon: WeaponId | undefined = available.find(w => w in this.bindings && this.down(w as Action));
      if (this.down("next") || this.down("previous")) {
        weapon = available[(available.indexOf(current) + (this.down("next") ? 1 : -1) + available.length) % available.length];
      }
      if (this.down("last")&&ownsWeapon(this.state.player.weapon,this.previousWeapon)) weapon = this.previousWeapon;
      if (weapon && current !== weapon) { this.previousWeapon = current; this.pendingWeapon = weapon; }
    }
    return (Object.keys(this.bindings) as Action[]).some(a => this.down(a));
  }

  private setupMultiplayerSocket(socket: Socket, onSynchronized?: () => void) {
    const disconnected = () => this.pause("Bağlantı kesildi. Menüye dönüp odaya yeniden katılabilirsin.");
    socket.on("disconnect", disconnected);
    this.removers.push(() => socket.off("disconnect", disconnected));
    const replaced = () => this.pause("Bu hesap başka bir sekmede oyuna katıldı. Menüden tekrar katılabilirsin.");
    socket.on("strike:session_replaced",replaced);
    this.removers.push(()=>socket.off("strike:session_replaced",replaced));
    let synchronized = false;
    let lastSnapshotTick = -1;
    // 1. Authoritative Server Snapshot Handler
    const handleSnapshot = (snapshot: StrikeSnapshot) => {
      if (!snapshot || (snapshot.roomCode && snapshot.roomCode !== this.roomCode) || !Array.isArray(snapshot.players) || snapshot.tick <= lastSnapshotTick) return;
      lastSnapshotTick = snapshot.tick;
      const arrival=performance.now();
      if(this.snapshotArrival)this.jitter += .15*(Math.abs(arrival-this.snapshotArrival-1000/30)-this.jitter);
      this.snapshotArrival=arrival;

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
          this.receivedInitialState = true;
          this.callbacks?.onLoadingStage?.("Grafikler hazırlanıyor…");
        }
        const respawned=this.state.player.hp<=0&&myServerState.hp>0;
        const oldPosition={...this.state.player.movement.position};
        this.state.bomb=snapshot.bomb;
        if(snapshot.world)this.state.world=snapshot.world;
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
            if (this.state.player.hp > 0&&!respawned) simulate(this.state, {...cmd,tick:this.state.tick}, false);
          }
          const position=this.state.player.movement.position;
          const dx=oldPosition.x-position.x,dy=oldPosition.y-position.y,dz=oldPosition.z-position.z;
          // Simulation snaps to truth immediately; only its visual correction eases out.
          if(!respawned&&Math.hypot(dx,dy,dz)<3){this.correction.x+=dx;this.correction.y+=dy;this.correction.z+=dz;}
          else this.correction={x:0,y:0,z:0};
          this.previous={...position};
          if(respawned){this.unacknowledgedInputs=[];this.resetView();}
        } else {
          this.state.player.movement.position = { ...myServerState.position };
          this.state.player.movement.velocity = { ...myServerState.velocity };
        }

      }

      // Process Combat Events from Server (Remote shots, hits, etc.)
      if (Array.isArray(snapshot.events)) {
        const unseenEvents = snapshot.events.filter((e) => e.id > this.processed);
        for(const e of unseenEvents)this.processed=Math.max(this.processed,e.id);
        const effects=unseenEvents.filter(e=>!(e.actor===this.state.player.id && (e.kind==="shot" || e.kind==="reload")));
        this.renderer.process(effects, this.state.player.id);
        for (const e of effects) {
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
          fire: this.touchFire || this.mouseFire || this.down("fire") || (this.state.player.weapon.selected === "knife" && (this.touchAds || this.ads || this.down("ads"))),
          ads: this.touchAds || this.ads || this.down("ads"),
          reload: this.pendingReload,
          weapon: this.pendingWeapon,
          interact:this.pendingInteract,
        };

        // Client prediction: simulate locally
        const beforeEvent=this.state.eventId;
        if (!this.isMultiplayer || this.state.player.hp > 0) simulate(this.state, cmd, !this.isMultiplayer);

        if (this.isMultiplayer && this.socket && this.state.player.hp>0) {
          const immediate=this.state.events.filter(e=>e.id>beforeEvent && (e.kind==="shot" || e.kind==="reload"));
          this.renderer.process(immediate,this.state.player.id,true);
          for(const e of immediate)this.feedback(e,true);
          this.unacknowledgedInputs.push({ ...cmd });
          if (this.unacknowledgedInputs.length > 240) this.unacknowledgedInputs.shift();
          this.socket.emit("strike:input", cmd);
        }

        this.keys.delete("WheelUp");
        this.keys.delete("WheelDown");
        this.pendingInteract=false;
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

      const decay=Math.exp(-elapsed*16);
      for(const axis of ["x","y","z"] as const)this.correction[axis]*=decay;
      this.renderer.render(
        this.state,
        this.yaw,
        this.pitch,
        this.touchAds || this.ads || this.down("ads"),
        this.accumulator / C.dt,
        this.previous,
        elapsed,
        this.correction
      );

      if(this.receivedInitialState && !this.notifiedReady && this.renderer.scene.isReady()){
        this.notifiedReady=true;this.callbacks?.onSynchronized?.();
      }
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
    const renderTime = now - clamp(70+this.jitter*2,70,150);

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
        skin: p2.skin,
        weaponSkin:p2.weaponSkin,
        hp: p2.hp,
        stance: p2.stance,
        selectedWeapon: p2.selectedWeapon,
        yaw: p1.yaw + (p2.yaw - p1.yaw) * alpha,
        pitch: p1.pitch + (p2.pitch - p1.pitch) * alpha,
        position: (()=>{
          const base={x:p1.position.x+(p2.position.x-p1.position.x)*alpha,y:p1.position.y+(p2.position.y-p1.position.y)*alpha,z:p1.position.z+(p2.position.z-p1.position.z)*alpha};
          const dt=clamp((renderTime-newer!.time)/1000,0,.05);
          if(!dt || p2.hp<=0)return base;
          const next={x:base.x+p2.velocity.x*dt,y:base.y+p2.velocity.y*dt,z:base.z+p2.velocity.z*dt};
          return fits(MAPS[this.state.map],next,p2.stance==="stand"?C.standing:C.crouching)?next:base;
        })(),
      };
    });

    this.renderer.renderRemotePlayers(interpolatedPlayers, myId, this.localTeam);
  }

  private feedback(e: CombatEvent, predicted=false) {
    if(!predicted)this.processed = Math.max(this.processed,e.id);
    if (this.isMultiplayer && e.actor !== this.state.player.id && e.kind !== "shot") return;
    if (e.kind === "shot") {
      if (this.shotSounds.get(e.actor) === e.tick) return;
      this.shotSounds.set(e.actor,e.tick);
      if(this.shotSounds.size>64)this.shotSounds.delete(this.shotSounds.keys().next().value!);
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
      this.state.lastDamageTick = this.state.tick;
      this.lastHurt = {
        damage: Math.min(100, (this.lastHurt && this.lastHurt.until > this.state.tick ? this.lastHurt.damage || 0 : 0) + (e.damage || 0)),
        direction: e.direction || 0,
        until: this.state.tick + 60,
      };
      this.audio.play("damage");
    }
    if (e.kind === "respawn") {
      this.resetView();
    }
  }

  private resetView(){
    this.yaw=0;this.pitch=0;this.correction={x:0,y:0,z:0};
    this.state.player.yaw=0;this.state.player.pitch=0;
    this.previous={...this.state.player.movement.position};
    this.lastHurt=undefined;this.lastHit=undefined;this.state.lastDamageTick=-10000;
    this.clearInput();this.pendingInteract=false;this.renderer.resetView();
  }
  interact(){if(this.active)this.pendingInteract=true;}

  private pushHUD() {
    const s = this.state,
      p = s.player,
      w = p.weapon,
      stats = this.renderer.stats();

    this.onHUD({
      inventory:WEAPON_ORDER.filter(w=>ownsWeapon(p.weapon,w)),
      world:s.world, position:{...p.movement.position}, yaw:this.yaw,
      radar:this.remotePlayerList.filter(r=>r.hp>0&&r.id!==p.id&&this.localTeam!=="none"&&r.team===this.localTeam).map(r=>({...r.position,team:r.team})),
      supplyPrompt:s.world?(()=>{const supply=nearestSupply(s.world,MAPS[s.map],p);return supply?`${supply.kind==="dropped"?"Al":"Aç"} · ${WEAPONS[supply.weapon].name}`:undefined;})():undefined,
      hp: p.hp,
      ads: this.touchAds || this.ads || this.down("ads"),
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
      jitter: this.jitter,
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
    this.pendingInteract=false;
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
    if(this.canvas.tabIndex<0)this.canvas.tabIndex=0;
    this.canvas.focus();
    this.audio.unlock();
    this.last = performance.now();
    this.accumulator = 0;
    this.active = true;
    try {
      if (capturePointer && !this.isTouchDevice && this.usesPointerLock) {
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

  public addGyroDelta(deltaYaw: number, deltaPitch: number) {
    if (!this.active || !Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) return;
    const mode = this.settings.gyroMode || "off";
    if (mode === "off") return;
    if (mode === "ads" && !this.touchAds && !this.ads) return;

    // Deltas are radians from the shared sensor tracker. Apply user sensitivity once.
    const sens = this.settings.gyroSensitivity ?? 1.0;
    this.yaw += clamp(deltaYaw,-.35,.35) * sens;
    this.pitch = clamp(
      this.pitch + clamp(deltaPitch,-.35,.35) * sens * (this.settings.invertY ? -1 : 1),
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
    this.shotSounds.clear();
  }
}
