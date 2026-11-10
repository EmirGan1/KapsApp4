import {FootstepTracker,stepSurface} from "./footsteps";
import {touchAimDelta} from './aimAssist';
import {TeamSpectator} from './spectator';
import {nearestSupply,supplyLabel} from './world';
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
  PlayerState,
  StrikeTeam,
} from "./types";
import { MAPS } from "./maps";
import {touchControls,currentInputDevice} from '../../utils/gameInput';
import { createTraining, simulate, shouldAutoReload } from "./combat";
import { PHYSICS as C, WEAPONS, WEAPON_ORDER, ownsWeapon } from "./config";
import { clamp, fits, support } from "./physics";

function cloneLocalState(s: PlayerState): PlayerState {
  return {
    ...s,
    movement: {
      ...s.movement,
      position: { ...s.movement.position },
      velocity: { ...s.movement.velocity },
      spawnPosition: s.movement.spawnPosition ? { ...s.movement.spawnPosition } : undefined,
      lastSafePosition: s.movement.lastSafePosition ? { ...s.movement.lastSafePosition } : undefined,
    },
    weapon: {
      ...s.weapon,
      ammo: { ...s.weapon.ammo },
      inventory: s.weapon.inventory ? [...s.weapon.inventory] : undefined,
    },
  };
}

export interface StrikeNetworkSample {
  transport: string;
  status: "ok" | "measuring" | "timeout" | "disconnected" | "background";
  rawRttMs?: number;
  filteredRttMs?: number;
  probeFrameGapMs?: number;
  frameGapMaxMs: number;
  lastSampleAgeMs?: number;
  timeoutCount: number;
  serverLoopMaxMs?: number;
  serverLoopP50Ms?: number;
  serverLoopP95Ms?: number;
  serverCpuPercent?: number;
  serverTickP95Ms?: number;
  serverTickMaxMs?: number;
}

export interface StrikeHUD {
  bombEquipped?:boolean;
  spectating?:string;
  spectatorCount?:number;
  spectatorNumber?:number;
  inventory?:WeaponId[];
  world?: StrikeWorld;
  position?: Vec3;
  yaw?: number;
  radar?: {x:number;z:number;team:StrikeTeam}[];
  supplyPrompt?: string;
  armor?:number;
  lootNotice?:string;
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
  networkSample?: StrikeNetworkSample;
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
  tick:number;
  time: number;
  players: PlayerSnapshot[];
  playersById: Map<string, PlayerSnapshot>;
  teamScores?: { red: number; blue: number };
  timeLeft?: number;
}

export class StrikeController {
  readonly state: TrainingState;
  readonly renderer: StrikeRenderer;
  readonly audio = new StrikeAudio();
  private footsteps = new FootstepTracker();
  private audioReloadWeapon?:WeaponId;
  private keys = new Set<string>();
  private bindings: Bindings;
  private callbacks?: MultiplayerOptions;
  private previousWeapon: WeaponId = "rifle";
  private mouseFire = false;
  private ads = false;
  private pointerLockIgnoreUntil = 0;
  private pendingReload = false;
  private pendingWeapon?: WeaponId;
  private lastWheel = -Infinity;
  public readonly shotReceipts:import('./types').ShotReceipt[]=[];
  public readonly shotAckLatency:number[]=[];
  private sentCommands=new Map<number,number>();
  private confirmedHits=new Set<string>();
  private lastHitShot?:string|number;
  private viewTick?:number;
  private yaw = 0;
  private pitch = 0;
  private sequence = 0;
  private active = false;
  private menuOverlay=false;
  private spectator?:{id:string;username:string;position:Vec3;yaw:number;pitch:number;stance:string};
  private teamSpectator=new TeamSpectator();
  private get watchingTeam(){return !!this.state.bomb&&this.state.bomb.phase!=='finished'&&this.state.player.hp<=0;}
  cycleSpectator(direction=1){
    if(!this.watchingTeam)return;
    this.refreshSpectator();this.teamSpectator.cycle(direction);this.refreshSpectator();this.pushHUD();
  }
  private refreshSpectator(rendered?:{id:string;position:Vec3;yaw:number;pitch:number;stance:string}[]){
    const target=this.teamSpectator.update(this.state.bomb,this.socket?.id||this.state.player.id,this.localTeam,this.state.player.hp,this.remotePlayerList);
    const pose=target&&rendered?.find(p=>p.id===target.id);
    this.spectator=target?{...target,...(pose||{})}:undefined;
  }
  private disposed = false;
  private last = 0;
  private accumulator = 0;
  private lastHUD = 0;
  private processed = 0;
  private shotSounds = new Map<string,number>();
  private dropped = 0;
  private correction={x:0,y:0,z:0};
  private pendingInteract=false;
  private nextBombBeep=0;
  private lastExplosionKey="";
  private bombEquipped=false;
  private lastDefuseAudioTick=0;
  private lastActionKind?: 'plant' | 'defuse';
  equipBomb(){this.bombEquipped=!this.bombEquipped;this.clearInput();}
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
  private supportsInputBatch = false;
  private lastPingSampleAt = -Infinity;
  private pingTimeoutCount = 0;
  private lastPingTimedOut = false;
  private probeInFlight = false;
  private probeFrameGapMaxMs = 0;
  private frameGapMaxMs = 0;
  private networkSample?: StrikeNetworkSample;
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
        this.pointerLockIgnoreUntil = performance.now() + 150;
      else if (this.active && !this.menuOverlay && !this.isTouchDevice && this.usesPointerLock) this.pause();
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
        !this.active || this.menuOverlay ||
        (!this.isTouchDevice && this.usesPointerLock && document.pointerLockElement !== canvas) ||
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]'
        )
      )
        return;

      if (e.code === "Escape") { e.preventDefault(); this.pause(); return; }
      if(this.watchingTeam&&(e.code==='ArrowLeft'||e.code==='ArrowRight')){
        e.preventDefault();if(!e.repeat)this.cycleSpectator(e.code==='ArrowLeft'?-1:1);return;
      }
      if (!this.isMultiplayer && e.code === "Digit7" && !e.repeat) {
        e.preventDefault();
        this.triggerDemoBomb();
        return;
      }
      this.keys.add(e.code);
      if (this.handleActions(e.repeat)) e.preventDefault();
    }) as EventListener);

    listen(window, "keyup", ((e: KeyboardEvent) => {
      this.keys.delete(e.code);
      if (this.active) this.updateHeldActions();
    }) as EventListener);

    listen(window, "mousemove", ((e: MouseEvent) => {
      if (!this.active || (document.pointerLockElement !== canvas && !(!this.usesPointerLock&&e.target===canvas&&e.buttons>0))) return;
      if (performance.now() < this.pointerLockIgnoreUntil) return;
      // Discard synthetic cursor-wrap/centering spikes from browser pointerlock
      if(!Number.isFinite(e.movementX)||!Number.isFinite(e.movementY))return;
      const motionScale=Math.min(1,240/Math.max(1,Math.hypot(e.movementX,e.movementY)));
      const dx=e.movementX*motionScale,dy=e.movementY*motionScale;
      this.yaw += dx * 0.002 * this.settings.sensitivity;
      this.pitch = clamp(
        this.pitch +
          dy *
            0.002 *
            this.settings.sensitivity *
            (this.settings.invertY ? -1 : 1),
        -1.48,
        1.48
      );
    }) as EventListener);

    listen(canvas, "mousedown", ((e: MouseEvent) => {
      if (!this.active || this.menuOverlay || (!this.isTouchDevice && this.usesPointerLock && document.pointerLockElement !== canvas)) return;
      e.preventDefault();
      if(this.watchingTeam&&(e.button===0||e.button===2)){this.cycleSpectator(e.button===0?1:-1);return;}
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
        if(this.settings.trackpadLook&&!this.menuOverlay){
          if(!Number.isFinite(e.deltaX)||!Number.isFinite(e.deltaY)||e.ctrlKey)return;
          const unit=e.deltaMode===1?16:e.deltaMode===2?120:1;
          this.yaw+=clamp(e.deltaX*unit,-120,120)*.002*this.settings.sensitivity;
          this.pitch=clamp(this.pitch+clamp(e.deltaY*unit,-120,120)*.002*this.settings.sensitivity*(this.settings.invertY?-1:1),-1.48,1.48);return;
        }
        if (e.deltaY === 0 || performance.now() - this.lastWheel < 140) return;
        this.lastWheel = performance.now();
        if(this.watchingTeam){this.cycleSpectator(e.deltaY>0?1:-1);return;}
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
    if(!this.state.bomb && next.hiddenWeapons?.includes(this.pendingWeapon || this.state.player.weapon.selected)) this.pendingWeapon="knife";
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
    if(this.watchingTeam){
      if(!repeat&&(this.down('next')||this.down('previous')))this.cycleSpectator(this.down('next')?1:-1);
      return true;
    }
    if (!repeat) {
      if(this.down("inspect"))this.renderer.inspect();
      if(this.down("interact"))this.pendingInteract=true;
      if (this.down("reload")) this.pendingReload = true;
      const bombWeapons=this.state.bomb?.players[this.socket?.id||'']?.weapons;
      const available=WEAPON_ORDER.filter(w=>bombWeapons?bombWeapons.includes(w):ownsWeapon(this.state.player.weapon,w)&&!this.settings.hiddenWeapons?.includes(w));
      const current = this.pendingWeapon || this.state.player.weapon.selected;
      let weapon: WeaponId | undefined = available.find(w => w in this.bindings && this.down(w as Action));
      if (this.down("next") || this.down("previous")) {
        weapon = available[(available.indexOf(current) + (this.down("next") ? 1 : -1) + available.length) % available.length];
      }
      if (this.down("last")&&available.includes(this.previousWeapon)) weapon = this.previousWeapon;
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
    const receipt=(r:import('./types').ShotReceipt)=>{if(!r||typeof r.shotId!=='string')return;this.shotReceipts.push(r);if(this.shotReceipts.length>128)this.shotReceipts.shift();
      const sent=this.sentCommands.get(r.sequence);if(sent!==undefined){this.shotAckLatency.push(performance.now()-sent);if(this.shotAckLatency.length>128)this.shotAckLatency.shift();}
      if(r.accepted&&r.damage>0&&!this.confirmedHits.has(r.shotId)){this.feedback({id:0,tick:r.serverTick,actor:this.state.player.id,kind:'hit',weapon:r.weapon,shotId:r.shotId,damage:r.damage,head:r.head});this.confirmedHits.add(r.shotId);if(this.confirmedHits.size>128)this.confirmedHits.delete(this.confirmedHits.values().next().value!);}
    };
    const rtt=(reply?:()=>void)=>{if(typeof reply==='function')reply();};
    const debug=(value:any)=>{if((import.meta as any).env?.DEV)this.renderer.debugCombat(value);};
    socket.on('strike:combat_debug',debug);
    socket.on('strike:shot_ack',receipt);socket.on('strike:rtt',rtt);
    this.removers.push(()=>{socket.off('strike:shot_ack',receipt);socket.off('strike:rtt',rtt);socket.off('strike:combat_debug',debug);});
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
        tick:snapshot.tick,
        time: arrival,
        players: snapshot.players,
        playersById: new Map(snapshot.players.map(player => [player.id, player])),
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
        const respawned=(this.state.player.hp<=0&&myServerState.hp>0)||(snapshot.bomb?.round!==this.state.bomb?.round);
        const died=this.state.player.hp>0&&myServerState.hp<=0;
        if(died){this.clearInput();this.unacknowledgedInputs=[];}
        const frozen=!!snapshot.bomb&&!["active","planted","result"].includes(snapshot.bomb.phase);
        if(frozen)this.unacknowledgedInputs=[];
        const oldPosition={...this.state.player.movement.position};
        const oldBomb=this.state.bomb;
        this.state.bomb=snapshot.bomb;
        if(snapshot.bomb?.phase==='planted'&&oldBomb?.phase!=='planted'){
          this.audio.play('bombPlant', 0, snapshot.bomb.position);
          this.audio.announce('Bomba kuruldu');
        }
        if(snapshot.bomb?.reason==='Bomba patladı'&&oldBomb?.reason!=='Bomba patladı'){
          this.audio.play('bombExplode', 0, snapshot.bomb.position || snapshot.bomb.explosion?.position);
        }
        if(snapshot.bomb?.reason==='Bomba çözüldü'&&oldBomb?.reason!=='Bomba çözüldü'){
          this.audio.play('bombDefused', 0, snapshot.bomb.position);
          this.audio.announce('Bomba çözüldü');
        }
        // Track defusal progress sounds
        if(snapshot.bomb?.action?.kind==='defuse'){
          if(this.lastActionKind!=='defuse'){
            this.audio.play('bombDefuseStart', 0, snapshot.bomb.position || snapshot.bomb.action.position);
          }
          const nowMs=performance.now();
          if(nowMs-this.lastDefuseAudioTick>380){
            this.lastDefuseAudioTick=nowMs;
            this.audio.play('bombDefuseTick', 0, snapshot.bomb.position || snapshot.bomb.action.position);
          }
        }
        this.lastActionKind=snapshot.bomb?.action?.kind;
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
          if(this.state.player.weapon.selected!==snapshot.localState.weapon.selected)this.bombEquipped=false;
          this.state.player = cloneLocalState(snapshot.localState);
          this.state.tick = snapshot.tick;
          this.state.lastSequence = ackSeq;
          for (const cmd of this.unacknowledgedInputs) {
            if (this.state.player.hp > 0&&!respawned&&!frozen) simulate(this.state, {...cmd,tick:this.state.tick}, false);
          }
          const position=this.state.player.movement.position;
          const dx=oldPosition.x-position.x,dy=oldPosition.y-position.y,dz=oldPosition.z-position.z;
          // Simulation snaps to truth immediately; only its visual correction eases out.
          if(!respawned&&Math.hypot(dx,dy,dz)<3){this.correction.x+=dx;this.correction.y+=dy;this.correction.z+=dz;}
          else this.correction={x:0,y:0,z:0};
          this.previous={...position};
          if(respawned){this.unacknowledgedInputs=[];this.remoteSnapshots=[];this.viewTick=undefined;this.resetView();}
        } else {
          this.state.player.movement.position = { ...myServerState.position };
          this.state.player.movement.velocity = { ...myServerState.velocity };
        }

      }
      this.refreshSpectator();

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

    let probeSeq = 0;
    const getTransportName = (): string => {
      try {
        return socket.io?.engine?.transport?.name || (socket.connected ? "websocket" : "disconnected");
      } catch {
        return "unknown";
      }
    };

    const measurePing = () => {
      if (this.disposed) return;
      if (typeof document !== "undefined" && document.hidden) {
        if (this.networkSample) {
          this.networkSample = { ...this.networkSample, status: "background", transport: getTransportName() };
        }
        return;
      }
      if (!socket.connected) {
        this.probeInFlight = false;
        this.networkSample = {
          ...(this.networkSample || { frameGapMaxMs: Math.round(this.frameGapMaxMs), timeoutCount: this.pingTimeoutCount }),
          transport: getTransportName(),
          status: "disconnected",
        };
        return;
      }
      if (this.probeInFlight) return;

      const currentProbeId = ++probeSeq;
      const start = performance.now();
      this.probeInFlight = true;
      this.probeFrameGapMaxMs = 0;

      // Never use .volatile for RTT probes with ack callbacks: if Engine.IO is flushing
      // a packet batch, .volatile silently drops the probe and forces a false 1800ms timeout.
      socket.timeout(1800).emit(
        "strike:ping",
        start,
        (
          error: Error | null,
          echoed: number,
          details?: {
            inputBatch?: boolean;
            serverLoopMaxMs?: number;
            serverLoopP50Ms?: number;
            serverLoopP95Ms?: number;
            serverCpuPercent?: number;
            serverTickP95Ms?: number;
            serverTickMaxMs?: number;
          }
        ) => {
          if (currentProbeId === probeSeq) {
            this.probeInFlight = false;
          }
          if (this.disposed) return;
          const now = performance.now();
          const transport = getTransportName();

          if (error || echoed !== start) {
            this.pingTimeoutCount++;
            this.lastPingTimedOut = true;
            const ageMs = Number.isFinite(this.lastPingSampleAt) ? Math.max(0, Math.round(now - this.lastPingSampleAt)) : undefined;
            this.networkSample = {
              transport,
              status: socket.connected ? "timeout" : "disconnected",
              rawRttMs: this.networkSample?.rawRttMs,
              filteredRttMs: undefined,
              probeFrameGapMs: Math.round(this.probeFrameGapMaxMs),
              frameGapMaxMs: Math.round(this.frameGapMaxMs),
              lastSampleAgeMs: ageMs,
              timeoutCount: this.pingTimeoutCount,
              serverLoopMaxMs: this.networkSample?.serverLoopMaxMs,
              serverLoopP50Ms: this.networkSample?.serverLoopP50Ms,
              serverLoopP95Ms: this.networkSample?.serverLoopP95Ms,
              serverCpuPercent: this.networkSample?.serverCpuPercent,
              serverTickP95Ms: this.networkSample?.serverTickP95Ms,
              serverTickMaxMs: this.networkSample?.serverTickMaxMs,
            };
            return;
          }

          if (typeof document !== "undefined" && document.hidden) return;

          const rawRtt = Math.max(0.5, now - start);
          const probeFrameGap = this.probeFrameGapMaxMs;
          // Isolate client main-thread frame stalls (e.g. shader compilation or heavy frame > 24ms)
          // so main-thread rendering blocks do not masquerade as network RTT in the filtered ping,
          // while keeping rawRttMs and frameGapMaxMs completely unadjusted for diagnostics.
          const clientStallPenalty = probeFrameGap > 24 ? Math.max(0, probeFrameGap - 16.7) : 0;
          const adjustedSample = Math.max(1, rawRtt - Math.min(rawRtt * 0.75, clientStallPenalty));

          const fresh = now - this.lastPingSampleAt < 3500 && !this.lastPingTimedOut && this.ping > 0;
          if (!fresh) {
            this.ping = adjustedSample;
          } else if (adjustedSample < this.ping) {
            // Recover quickly from transient spikes
            this.ping = this.ping * 0.55 + adjustedSample * 0.45;
          } else {
            this.ping = this.ping * 0.7 + adjustedSample * 0.3;
          }

          this.lastPingTimedOut = false;
          this.lastPingSampleAt = now;
          if (details?.inputBatch !== undefined) {
            this.supportsInputBatch = details.inputBatch === true;
          }
          this.networkSample = {
            transport,
            status: "ok",
            rawRttMs: Math.round(rawRtt),
            filteredRttMs: Math.round(this.ping),
            probeFrameGapMs: Math.round(probeFrameGap),
            frameGapMaxMs: Math.round(Math.max(this.frameGapMaxMs, probeFrameGap)),
            lastSampleAgeMs: 0,
            timeoutCount: this.pingTimeoutCount,
            serverLoopMaxMs: details?.serverLoopMaxMs,
            serverLoopP50Ms: details?.serverLoopP50Ms,
            serverLoopP95Ms: details?.serverLoopP95Ms,
            serverCpuPercent: details?.serverCpuPercent,
            serverTickP95Ms: details?.serverTickP95Ms,
            serverTickMaxMs: details?.serverTickMaxMs,
          };
          this.frameGapMaxMs = 0;
        }
      );
    };

    // Defer initial ping probe until after synchronous scene/shader construction finishes
    // so main-thread initialization does not artificially inflate the first RTT sample to ~120ms+.
    const initialProbeTimer = setTimeout(() => {
      if (!this.disposed) measurePing();
    }, 120);
    this.removers.push(() => clearTimeout(initialProbeTimer));

    // Keep measuring RTT whenever the socket is connected and tab is visible (including pause/scoreboard overlay).
    this.pingInterval = setInterval(() => {
      measurePing();
    }, 1000);
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
      const frameGapMs = now - this.last;
      this.frameGapMaxMs = Math.max(this.frameGapMaxMs, frameGapMs);
      if (this.probeInFlight) {
        this.probeFrameGapMaxMs = Math.max(this.probeFrameGapMaxMs, frameGapMs);
      }
      const elapsed = Math.min(0.1, frameGapMs / 1000);
      this.last = now;
      this.accumulator += elapsed;
      let steps = 0;
      const inputBatch: InputCommand[] = [];
      const sendInput = (command: InputCommand) => {
        if (!this.socket?.connected) return;
        if (this.supportsInputBatch) inputBatch.push(command);
        else this.socket.emit("strike:input", command);
      };

      while (this.accumulator >= C.dt && steps < 8) {
        this.previous = { ...this.state.player.movement.position };
        const keyMoveX = Number(this.down("right")) - Number(this.down("left"));
        const keyMoveZ = Number(this.down("forward")) - Number(this.down("backward"));
        const cmd: InputCommand = {
          sequence: ++this.sequence,
          tick: this.state.tick,
          viewTick:this.viewTick,
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
          reload: this.pendingReload || shouldAutoReload(this.state.player.weapon, this.state.tick),
          weapon: this.pendingWeapon,
          interact:this.pendingInteract,
        };

        const frozen=!!this.state.bomb&&!["active","planted","result"].includes(this.state.bomb.phase);
        if(this.menuOverlay){cmd.moveX=0;cmd.moveZ=0;cmd.fire=false;cmd.reload=false;cmd.jump=false;cmd.interact=false;cmd.weapon=undefined;}
        const owned=this.state.bomb?.players[this.socket?.id||'']?.weapons;
        // Plant/drop/death removes ownership. Do not leave an invisible bomb
        // selection suppressing the firearm after the held model disappears.
        if(cmd.weapon||this.bombEquipped&&this.state.bomb?.carrier!==this.socket?.id)this.bombEquipped=false;
        if(this.bombEquipped){cmd.fire=false;cmd.reload=false;cmd.ads=false;}
        if(this.state.bomb?.phase==='result'){cmd.fire=false;cmd.reload=false;cmd.interact=false;}
        if(owned&&cmd.weapon&&!owned.includes(cmd.weapon))cmd.weapon=undefined;
        if(frozen&&this.state.bomb?.phase==='buy'){
          cmd.moveX=0;cmd.moveZ=0;cmd.fire=false;cmd.reload=false;cmd.jump=false;cmd.interact=false;
          if(cmd.weapon&&owned?.includes(cmd.weapon))this.state.player.weapon.selected=cmd.weapon;
          if(this.isMultiplayer&&this.socket&&this.state.player.hp>0)sendInput(cmd);
        }
        // Client prediction uses the same round gate as the authoritative server.
        const beforeEvent=this.state.eventId;
        const beforeShot=this.state.player.weapon.shotIndex;
        if (!frozen&&(!this.isMultiplayer || this.state.player.hp > 0)) simulate(this.state, cmd, !this.isMultiplayer);

        if (!frozen&&this.isMultiplayer && this.socket && this.state.player.hp>0) {
          if (this.state.eventId !== beforeEvent) {
            const immediate = this.state.events.filter(event =>
              event.id > beforeEvent && (event.kind === "shot" || event.kind === "reload"));
            this.renderer.process(immediate, this.state.player.id, true);
            for (const event of immediate) this.feedback(event, true);
          }
          if(this.state.player.weapon.shotIndex>beforeShot)cmd.shot=this.state.player.weapon.shotIndex;
          this.unacknowledgedInputs.push({ ...cmd });
          if (this.unacknowledgedInputs.length > 240) this.unacknowledgedInputs.shift();
          this.sentCommands.set(cmd.sequence,performance.now());if(this.sentCommands.size>256)this.sentCommands.delete(this.sentCommands.keys().next().value!);
          sendInput(cmd);
        }

        this.keys.delete("WheelUp");
        this.keys.delete("WheelDown");
        this.pendingInteract=false;
        this.pendingReload = false;
        this.pendingWeapon = undefined;
        this.accumulator -= C.dt;
        steps++;
      }

      if (inputBatch.length && this.socket?.connected) {
        this.socket.emit("strike:input_batch", inputBatch);
      }

      if (this.accumulator >= C.dt) {
        this.dropped += Math.floor(this.accumulator / C.dt);
        this.accumulator %= C.dt;
      }

      // Offline mode local events feedback
      if (!this.isMultiplayer && this.state.eventId > this.processed) {
        const events = this.state.events.filter((e) => e.id > this.processed);
        this.renderer.process(events);
        for (const e of events) this.feedback(e);
      }

      // Interpolate and render remote players if in multiplayer
      if (this.isMultiplayer) {
        this.updateAndRenderRemotePlayers(now);
      }

      if (!this.isMultiplayer && this.state.bomb) {
        const b = this.state.bomb;
        const nowSec = this.state.tick * C.dt;
        if (b.phase === "active" && b.action?.kind === "plant" && nowSec >= b.action.started + 1.4) {
          b.action = undefined;
          b.phase = "planted";
          b.carrier = undefined;
          b.deadline = nowSec + 4.5;
          this.bombEquipped = false;
          this.audio.play("bombPlant");
          this.audio.announce("Bomba kuruldu");
        } else if (b.phase === "planted" && nowSec >= b.deadline) {
          b.phase = "result";
          b.winner = "T";
          b.reason = "Bomba patladı";
          b.explosion = { at: nowSec, radius: 18, position: { ...(b.position || this.state.player.movement.position) } };
          b.deadline = nowSec + 3.4;
          this.audio.play("bombExplode");
          this.audio.announce("Bomba patladı");
        } else if (b.phase === "result" && nowSec >= b.deadline) {
          this.state.bomb = undefined;
        }
      }

      const bomb=this.state.bomb;
      if(bomb?.explosion){
        const expKey=`${bomb.explosion.at}:${bomb.explosion.position.x}:${bomb.explosion.position.z}`;
        if(expKey!==this.lastExplosionKey){
          this.lastExplosionKey=expKey;
          this.audio.play("bombExplode", 0, bomb.explosion.position);
        }
      }
      if(bomb?.phase==='planted'&&now>=this.nextBombBeep){
        const left=Math.max(0,bomb.deadline-this.state.tick*C.dt);
        const urgency=clamp(1-left/40,0,1);
        this.audio.play('bombTick',urgency,bomb.position);
        this.nextBombBeep=now+(left>20?950:left>10?540:left>5?280:left>2?140:75);
      }
      // Update 360 audio listener position & yaw
      this.audio.updateListener(this.spectator?.position||this.state.player.movement.position, this.spectator?.yaw??this.yaw);
      const player=this.state.player,movement=player.movement;
      if(!this.menuOverlay&&player.hp>0&&!this.spectator){
        const level=this.footsteps.step('local',movement.position,movement.grounded,movement.stance,now);
        if(level)this.audio.footstep(stepSurface(MAPS[this.state.map],movement.position),level);
      }else this.footsteps.reset('local');
      if(this.audioReloadWeapon&&(this.menuOverlay||player.hp<=0||player.weapon.selected!==this.audioReloadWeapon||player.weapon.reloadUntil<=this.state.tick)){
        this.audio.cancelReload();this.audioReloadWeapon=undefined;
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
        this.correction,
        this.spectator,
        this.bombEquipped&&(this.state.bomb?.carrier===this.socket?.id||(!this.isMultiplayer&&this.state.bomb?.carrier===this.state.player.id))
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
  private updateAndRenderRemotePlayers(now: number) {
    if (this.remoteSnapshots.length === 0) return;

    const myId = this.socket?.id;
    // Adaptive low-latency interpolation buffer (scales down to ~42ms on low jitter instead of rigid 70ms floor)
    const baseDelay = this.ping > 0 ? clamp(this.ping * 0.45, 38, 62) : 45;
    const renderTime = now - clamp(baseDelay + this.jitter * 1.6, 38, 135);

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

    const extrapolation = clamp((renderTime - newer.time) / 1000, 0, .05);
    this.viewTick=older.tick+(newer.tick-older.tick)*alpha+extrapolation/C.dt;
    const interpolatedPlayers = older.players.map((p1) => {
      const p2 = newer!.playersById.get(p1.id) || p1;
      return {
        id: p1.id,
        username: p1.username,
        team: p1.team,
        color: p1.color,
        skin: p2.skin,
        weaponSkin:p2.weaponSkin,
        hp: p2.hp,
        protectedUntil:p2.protectedUntil,
        velocity:p2.velocity,
        stance: p2.stance,
        selectedWeapon: p2.selectedWeapon,
        yaw: p1.yaw + Math.atan2(Math.sin(p2.yaw-p1.yaw),Math.cos(p2.yaw-p1.yaw)) * alpha,
        pitch: p1.pitch + (p2.pitch - p1.pitch) * alpha,
        position: (()=>{
          const base={x:p1.position.x+(p2.position.x-p1.position.x)*alpha,y:p1.position.y+(p2.position.y-p1.position.y)*alpha,z:p1.position.z+(p2.position.z-p1.position.z)*alpha};
          const dt = extrapolation;
          if(!dt || p2.hp<=0)return base;
          const next={x:base.x+p2.velocity.x*dt,y:base.y+p2.velocity.y*dt,z:base.z+p2.velocity.z*dt};
          return fits(MAPS[this.state.map],next,p2.stance==="stand"?C.standing:C.crouching)?next:base;
        })(),
      };
    });

    this.refreshSpectator(interpolatedPlayers);
    if(!this.menuOverlay){
      const map=MAPS[this.state.map];
      const listener = this.audioListenerPosition();
      for(const p of interpolatedPlayers){
        if(p.id===myId||p.hp<=0||now-newer!.time>350||Math.hypot(p.position.x-listener.x,p.position.z-listener.z)>=28){this.footsteps.reset(p.id);continue;}
        const grounded=Math.abs(p.position.y-support(map,p.position,p.position.y+.12))<.16&&Math.abs(p.velocity.y)<1;
        const level=this.footsteps.step(p.id,p.position,grounded,p.stance,now);
        if(level)
          this.audio.footstep(stepSurface(map,p.position),level,p.id===this.spectator?.id?undefined:p.position);
      }
    }
    this.renderer.renderRemotePlayers(interpolatedPlayers, myId, this.localTeam, this.spectator?.id);
  }

  private audioListenerPosition(){return this.spectator?.position||this.state.player.movement.position;}

  private feedback(e: CombatEvent, predicted=false) {
    if (!predicted) this.processed = Math.max(this.processed, e.id);
    if (
      this.isMultiplayer &&
      e.actor !== this.state.player.id &&
      e.kind !== "shot" &&
      e.kind !== "reload" &&
      e.kind !== "defuse"
    )
      return;
    if (e.kind === "defuse") {
      this.audio.play("bombDefuseStart", 0, e.from || this.state.bomb?.position);
      return;
    }
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
      // 360 audio: If shooter is local player, pass undefined for direct crisp 2D center;
      // if remote shooter, pass e.from so sound is panned and distance-attenuated 360 degrees!
      const isLocal = !this.isMultiplayer || e.actor === this.state.player.id;
      const soundSource = isLocal ? undefined : e.from;
      this.audio.play(e.weapon!, 0, soundSource);
      if (isLocal)
        this.pitch = clamp(this.pitch - WEAPONS[e.weapon!].recoil, -1.48, 1.48);
    }
    if (e.kind === "hit") {
      if(e.shotId&&this.confirmedHits.has(e.shotId))return;
      const key=e.shotId??e.tick;
      const sameShot = this.lastHitShot===key;
      this.lastHitShot=key;
      this.lastHit = {
        damage: (sameShot ? this.lastHit!.damage : 0) + (e.damage || 0),
        head: !!e.head || (sameShot && !!this.lastHit?.head),
        until: this.state.tick + 36,
      };
      if (!sameShot) this.audio.play(e.head ? "headshot" : "hit");
    }
    if (e.kind === "reload") {
      const isLocal = !this.isMultiplayer || e.actor === this.state.player.id;
      if(isLocal){
        const weapon=e.weapon||this.state.player.weapon.selected;
        this.audioReloadWeapon=weapon;
        this.audio.reload(weapon,WEAPONS[weapon].reload);
      } else if (e.from) {
        this.audio.play("reload", 0, e.from);
      }
    }
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
    this.teamSpectator.reset();this.spectator=undefined;
    this.bombEquipped=false;
    this.yaw=this.state.bomb&&this.localTeam==='blue'?Math.PI:0;this.pitch=0;this.correction={x:0,y:0,z:0};
    this.state.player.yaw=this.yaw;this.state.player.pitch=0;
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

    const nowMs = performance.now();
    const sampleAgeMs = Number.isFinite(this.lastPingSampleAt)
      ? Math.max(0, Math.round(nowMs - this.lastPingSampleAt))
      : undefined;
    const isFreshSample =
      this.isMultiplayer &&
      !!this.socket?.connected &&
      !this.lastPingTimedOut &&
      sampleAgeMs !== undefined &&
      sampleAgeMs < 3500 &&
      this.ping > 0;
    const transportName = (() => {
      try {
        return this.socket?.io?.engine?.transport?.name || (this.socket?.connected ? "websocket" : "disconnected");
      } catch {
        return "unknown";
      }
    })();
    const liveNetworkSample: StrikeNetworkSample | undefined = this.isMultiplayer
      ? {
          transport: this.networkSample?.transport || transportName,
          status: !this.socket?.connected
            ? "disconnected"
            : this.lastPingTimedOut
            ? "timeout"
            : isFreshSample
            ? "ok"
            : "measuring",
          rawRttMs: this.networkSample?.rawRttMs,
          filteredRttMs: isFreshSample ? Math.round(this.ping) : undefined,
          probeFrameGapMs: this.networkSample?.probeFrameGapMs,
          frameGapMaxMs: this.networkSample?.frameGapMaxMs ?? Math.round(this.frameGapMaxMs),
          lastSampleAgeMs: sampleAgeMs,
          timeoutCount: this.pingTimeoutCount,
          serverLoopMaxMs: this.networkSample?.serverLoopMaxMs,
          serverLoopP50Ms: this.networkSample?.serverLoopP50Ms,
          serverLoopP95Ms: this.networkSample?.serverLoopP95Ms,
          serverCpuPercent: this.networkSample?.serverCpuPercent,
          serverTickP95Ms: this.networkSample?.serverTickP95Ms,
          serverTickMaxMs: this.networkSample?.serverTickMaxMs,
        }
      : undefined;

    this.onHUD({
      bombEquipped:this.bombEquipped&&s.bomb?.carrier===this.socket?.id,
      spectating:this.spectator?.username,
      spectatorCount:this.teamSpectator.count,
      spectatorNumber:this.teamSpectator.index+1,
      inventory:s.bomb?.players[this.socket?.id||'']?.weapons||WEAPON_ORDER.filter(w=>ownsWeapon(p.weapon,w)),
      world:s.bomb?undefined:s.world, position:{...(this.spectator?.position||p.movement.position)}, yaw:this.spectator?.yaw??this.yaw,
      radar:this.remotePlayerList.filter(r=>r.hp>0&&r.id!==p.id&&this.localTeam!=="none"&&r.team===this.localTeam).map(r=>({...r.position,team:r.team})),
      armor:p.armor||0,
      lootNotice:p.lootNoticeUntil&&p.lootNoticeUntil>s.tick?p.lootNotice:undefined,
      supplyPrompt:s.world?(()=>{const supply=nearestSupply(s.world,MAPS[s.map],p);return supply?`${supply.kind==="dropped"?"Al":"Aç"} · ${supplyLabel(supply,p)}`:undefined;})():undefined,
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
      ping: isFreshSample ? this.ping : undefined,
      networkSample: liveNetworkSample,
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
    this.pointerLockIgnoreUntil = performance.now() + 250;
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
    if (!this.active || this.menuOverlay || !this.isTouchDevice || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    // Discard multitouch jumps or coordinate teleporting.
    if (Math.hypot(deltaX, deltaY) > 75) return;
    const sensitivity = (this.settings.mobileSensitivity || this.settings.sensitivity) * .003;
    let delta = {
      yaw: clamp(deltaX, -30, 30) * sensitivity,
      pitch: clamp(deltaY, -30, 30) * sensitivity * (this.settings.invertY ? -1 : 1),
    };
    const player = this.state.player;
    if (this.settings.touchAimAssist !== false && player.hp > 0 && player.weapon.selected !== 'knife' && (delta.yaw || delta.pitch)) {
      const movement = player.movement;
      const eye = { ...movement.position, y: movement.position.y + (movement.stance === 'stand' ? C.eye : C.crouchEye) };
      const targets = this.isMultiplayer
        ? this.remotePlayerList
          .filter(remote => remote.connected !== false && remote.id !== player.id && remote.id !== this.socket?.id)
          .map(remote => ({
            position: remote.position,
            hp: remote.hp,
            crouched: remote.stance !== 'stand',
            friendly: this.localTeam !== 'none' && remote.team === this.localTeam,
          }))
        : this.state.targets;
      delta = touchAimDelta(eye, this.yaw, this.pitch, delta, targets, MAPS[this.state.map], this.touchAds || this.ads);
    }
    this.yaw += delta.yaw;
    this.pitch = clamp(this.pitch + delta.pitch, -1.48, 1.48);
  }

  public addGyroDelta(deltaYaw: number, deltaPitch: number) {
    if (!this.active || !Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) return;
    const mode = this.settings.gyroMode || "off";
    if (mode === "off") return;
    if (mode === "ads" && !this.touchAds && !this.ads) return;

    // Deltas are radians from the shared sensor tracker. Clamp safely against orientation jumps.
    const sens = this.settings.gyroSensitivity ?? 1.0;
    this.yaw += clamp(deltaYaw, -0.15, 0.15) * sens;
    this.pitch = clamp(
      this.pitch + clamp(deltaPitch, -0.15, 0.15) * sens * (this.settings.invertY ? -1 : 1),
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
  public triggerInspect() { this.renderer.inspect(); }
  public selectWeapon(w: WeaponId) { if(this.state.bomb||!this.settings.hiddenWeapons?.includes(w)) this.pendingWeapon = w; }
  public triggerDemoBomb() {
    if (this.isMultiplayer) {
      this.socket?.emit("strike:bomb_action", { kind: "fast_detonate" });
      return;
    }
    const p = this.state.player;
    const nowSec = this.state.tick * C.dt;
    const fx = p.movement.position.x + Math.sin(this.yaw) * 3.2;
    const fz = p.movement.position.z + Math.cos(this.yaw) * 3.2;
    const bombPos = { x: fx, y: p.movement.position.y, z: fz };
    this.state.bomb = {
      round: 1,
      target: 7,
      half: 6,
      swapped: false,
      phase: "active",
      deadline: nowSec + 60,
      scores: { T: 0, CT: 0 },
      loss: { T: 0, CT: 0 },
      carrier: p.id,
      position: bombPos,
      site: "A",
      action: {
        kind: "plant",
        player: p.id,
        started: nowSec,
        position: bombPos,
      },
      players: {
        [p.id]: {
          id: p.id,
          team: "T",
          alive: true,
          money: 800,
          kit: false,
          armor: 0,
          weapons: ["rifle", "pistol", "knife"],
          plants: 0,
          defuses: 0,
          holdUntil: 0,
          position: { ...p.movement.position },
        },
      },
    };
    this.bombEquipped = true;
    this.nextBombBeep = 0;
    this.audio.play("bombPlant");
  }

  setMenuOverlay(open:boolean){
    this.menuOverlay=open;this.clearInput();if(open){this.audio.cancelReload();this.footsteps.reset();}
    if(open&&document.pointerLockElement===this.canvas)document.exitPointerLock();
    if(!open&&this.active&&!this.isTouchDevice)this.start();
  }

  pause(reason?: string) {
    if (!this.active) return;
    this.active = false;
    this.audio.cancelReload();this.footsteps.reset();
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
