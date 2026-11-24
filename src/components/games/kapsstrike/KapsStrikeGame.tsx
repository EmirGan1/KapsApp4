import UserProfileLink from "../../UserProfileLink";
import { GRENADE_NAMES } from "../../../games/kapsstrike/grenades";
import {
  getTouchCombatButtonState,
  getTopRightEquipmentSlots,
  getReadOnlyInventoryContents,
} from "../../../games/kapsstrike/hudEquipment";
import { BOMB_WIN_TARGETS } from "../../../games/kapsstrike/bomb";
import { Maximize, Minimize } from "lucide-react";
import StrikeDamageFeedback from "./StrikeDamageFeedback";
import StrikeBombHUD from "./StrikeBombHUD";
import StrikeInventory from "./StrikeInventory";
import StrikeInventoryAdmin from "./StrikeInventoryAdmin";
import StrikeMinimap from './StrikeMinimap';
import StrikeGraphicsSettings from './StrikeGraphicsSettings';
import StrikeInputSettings from './StrikeInputSettings';
import StrikeTouchCustomizer from './StrikeTouchCustomizer';
import { loadTouchLayout, TouchLayout } from "../../../games/kapsstrike/touchLayout";
import {touchControls,currentInputDevice} from '../../../utils/gameInput';
import {useGameGyroscope} from '../../../hooks/useGameGyroscope';
import StrikeSkins from "./StrikeSkins";
import StrikeControls from "./StrikeControls";
import { cleanBindings,label } from "../../../games/kapsstrike/controls";
import React, { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import {
  StrikeController,
  StrikeHUD,
} from "../../../games/kapsstrike/controller";
import {
  DEFAULT_SETTINGS,
  cleanSettings,
  WEAPONS,
  WEAPON_ORDER,
  STARTER_WEAPONS,
} from "../../../games/kapsstrike/config";
import {
  MapId,
  StrikeSettings,
  StrikeRoomSummary,
  StrikeRoomState,
  KillFeedEntry,
  MatchStats,
  StrikeTeam,
  StrikeSnapshot,
  WeaponId,
} from "../../../games/kapsstrike/types";
import { BOMB_MAPS, MAPS } from "../../../games/kapsstrike/maps";
import { StrikeVoiceManager } from "../../../games/kapsstrike/voice";
interface KapsStrikeGameProps {
  onBack: () => void;
  socket?: Socket | null;
  currentUserId?: number;
  username?: string;
  avatar?: string | null;
  color?: string | null;
  targetRoomId?: string | null;
}

export default function KapsStrikeGame({
  onBack,
  socket,
  currentUserId = 1,
  username = "KapsOyuncu",
  avatar = null,
  color = "#3b82f6",
  targetRoomId = null,
}: KapsStrikeGameProps) {
  const gameRoot = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<StrikeController | null>(null);
  const voice = useRef<StrikeVoiceManager | null>(null);

  const activeRoom = useRef<string | null>(null);
  const launch = useRef<(room: StrikeRoomState, initialSnapshot?: StrikeSnapshot) => void>(() => {});
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const launchRaf = useRef<number | null>(null);
  const launchToken = useRef(0);
  const busyAction = useRef(false);
  const refreshInFlight = useRef(false);
  const rejoinInFlight = useRef(false);
  const lastInventoryUserRef = useRef<number | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [socketConnected, setSocketConnected] = useState(() => !!socket?.connected);
  const [connectionNotice, setConnectionNotice] = useState("");
  const [loadStage, setLoadStage] = useState("");

  // General state
  const [modeTab, setModeTab] = useState<"multiplayer" | "training">("multiplayer");
  const [map, setMap] = useState<MapId>("warehouse");
  const [settings, setSettings] = useState<StrikeSettings>(() => {
    try {
      return cleanSettings(
        JSON.parse(localStorage.getItem("kapsstrike-settings") || "{}")
      );
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });
  const [view, setView] = useState<"menu" | "lobby" | "loading" | "play" | "pause" | "match_end">("menu");
  const [panel, setPanel] = useState<"weapons" | "settings" | "controls" | "skins" | "inventory" | "inventory_admin" | "input" | "create_room" | "touch_layout" | null>(null);
  const [touchLayout, setTouchLayout] = useState<TouchLayout>(() => loadTouchLayout());
  const [hud, setHUD] = useState<StrikeHUD | null>(null);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(!!gameRoot.current && document.fullscreenElement === gameRoot.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  const toggleFullscreen = async () => {
    const element = gameRoot.current;
    if (!element) return;
    try {
      if (document.fullscreenElement === element) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      setError("Tarayıcı tam ekran isteğini kabul etmedi.");
    }
  };
  const fullscreenLabel = fullscreen ? "Tam ekrandan çık" : "Tam ekran";
  const [returnFire, setReturnFire] = useState(false);
  const [supported, setSupported] = useState(true);
  const [inventoryAdmin,setInventoryAdmin]=useState(false);
  useEffect(()=>{if(!socket?.connected)return;const check=()=>socket.timeout(4000).emit('strike:inventory_admin_check',(e:any,r:any)=>setInventoryAdmin(!e&&r?.success&&r.allowed===true));check();socket.on('connect',check);return()=>{socket.off('connect',check);};},[socket]);

  // Mobile / Touch state
  const [isMobile, setIsMobile] = useState(()=>touchControls(settings.controlMode));
  const [isPortrait, setIsPortrait] = useState(false);
  const [joystickThumb, setJoystickThumb] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchId = useRef<number | null>(null);
  const lookLastPos = useRef<{ x: number; y: number } | null>(null);
  const [touchAdsActive, setTouchAdsActive] = useState(false);
  const [weaponMenuOpen, setWeaponMenuOpen] = useState(false);
  const gyro = useGameGyroscope(settings.gyroMode !== undefined && settings.gyroMode !== 'off', delta => {
    if(view === 'play')game.current?.addGyroDelta(delta.yaw,delta.pitch);
  });
  useEffect(()=>{gyro.recenter();},[view,hud?.dead]);
  const panelOpener=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    if(!panel)return;
    panelOpener.current=document.activeElement as HTMLElement;
    const close=(e:KeyboardEvent)=>{
      if(document.querySelector('[data-binding-capture="true"]'))return;
      if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();setPanel(null);}
      if(e.code==='Tab'){
        const dialog=document.querySelector('.ks-feature-card');
        const items=Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')||[]).filter(el=>el.getClientRects().length);
        const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    };
    window.addEventListener('keydown',close,true);
    return ()=>{window.removeEventListener('keydown',close,true);panelOpener.current?.focus();};
  },[panel]);

  // Multiplayer Room State
  const [rooms, setRooms] = useState<StrikeRoomSummary[]>([]);
  const [currentRoom, setCurrentRoom] = useState<StrikeRoomState | null>(null);
  const currentRoomRef = useRef<StrikeRoomState | null>(null);
  const lastStoredRoomCodeRef = useRef<string | null>(null);
  const updateCurrentRoom = useCallback((r: StrikeRoomState | null) => {
    currentRoomRef.current = r;
    setCurrentRoom(r);
    const nextCode = r?.roomCode || null;
    if (nextCode && nextCode !== lastStoredRoomCodeRef.current) {
      lastStoredRoomCodeRef.current = nextCode;
      try { sessionStorage.setItem("kapsstrike_active_room", nextCode); } catch {}
    }
  }, []);
  const [roomFilter, setRoomFilter] = useState("");
  const [roomModeFilter, setRoomModeFilter] = useState<"all" | "ffa" | "tdm" | "bomb">("all");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordModalRoomId, setPasswordModalRoomId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isStartingMatch, setIsStartingMatch] = useState(false);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
    if (view !== "lobby") {
      setIsStartingMatch(false);
    }
  }, [view]);

  // Create Room Form
  const [createName, setCreateName] = useState(`${username}'in Odası`);
  const [createBombMap, setCreateBombMap] = useState<MapId>("district");
  const [createMap, setCreateMap] = useState<MapId>("warehouse");
  const [createCategory, setCreateCategory] = useState<"kill" | "bomb" | null>(null);
  const [createMode, setCreateMode] = useState<"ffa" | "tdm">("tdm");
  const [createBombRounds, setCreateBombRounds] = useState(7);
  const isBombRoom = currentRoom?.mode === "bomb";
  const [createMaxPlayers, setCreateMaxPlayers] = useState(8);
  const [createDuration, setCreateDuration] = useState(300);
  const [createScoreLimit, setCreateScoreLimit] = useState(30);
  const [createPassword, setCreatePassword] = useState("");

  // In-Game Live Multiplayer State
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [isVoiceMuted, setIsVoiceMuted] = useState(true);
  const [speakingUsers, setSpeakingUsers] = useState<Map<number, boolean>>(new Map());
  const [playerVolumes, setPlayerVolumes] = useState<Record<number, number>>({});

  useEffect(() => {
    try { localStorage.setItem("kapsstrike-settings", JSON.stringify(settings)); } catch {}
    game.current?.updateSettings(settings);
  }, [settings]);

  useEffect(() => {if(typeof hud?.ads === "boolean")setTouchAdsActive(hud.ads);},[hud?.ads]);

  useEffect(() => {
    let frame = 0;
    let portrait: boolean | undefined;
    const orientation = screen.orientation;
    const portraitQuery = window.matchMedia("(orientation: portrait)");
    const releaseTouches = () => {
      lookTouchId.current = joystickTouchId.current = null;
      lookLastPos.current = null;
      game.current?.releaseTouchControls();
      setJoystickThumb({ x: 0, y: 0 });
      setTouchAdsActive(false);
      gyro.recenter();
    };
    const measure = () => {
      const root = gameRoot.current;
      const next = root?.clientWidth && root.clientHeight
        ? root.clientHeight > root.clientWidth : portraitQuery.matches;
      if (portrait !== undefined && next !== portrait) releaseTouches();
      portrait = next;
      setIsPortrait(next);
      setIsMobile(touchControls(settings.controlMode));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const rotate = () => {
      if (touchControls(settings.controlMode)) releaseTouches();
      schedule();
    };
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", rotate);
    orientation?.addEventListener("change", rotate);
    portraitQuery.addEventListener?.("change", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    if (gameRoot.current) observer?.observe(gameRoot.current);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", rotate);
      orientation?.removeEventListener("change", rotate);
      portraitQuery.removeEventListener?.("change", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [settings.controlMode]);

  // WebGL & PointerLock Check
  useEffect(() => {
    const c = document.createElement("canvas");
    const probe = c.getContext("webgl2") || c.getContext("webgl");
    setSupported(!!probe);

    return () => {
      launchToken.current++;
      if (launchRaf.current !== null) {
        cancelAnimationFrame(launchRaf.current);
        launchRaf.current = null;
      }
      clearTimeout(loadTimer.current);
      activeRoom.current = null;
      game.current?.dispose();
      game.current = null;
      voice.current?.dispose();
      voice.current = null;
    };
  }, []);

  // Voice manager initialization
  useEffect(() => {
    if (!voice.current && socket) {
      voice.current = new StrikeVoiceManager(socket, currentUserId, username);
      voice.current.onSpeakingChange((map) => {
        setSpeakingUsers(new Map(map));
      });
    }
    return () => {
      voice.current?.dispose();
      voice.current = null;
    };
  }, [socket, currentUserId, username]);

  const emitWithAck = useCallback(
    <T = any>(
      event: string,
      payload?: unknown,
      timeoutMs = 8000
    ): Promise<{ ok: true; data: T } | { ok: false; error: string }> => {
      return new Promise((resolve) => {
        if (!socket) {
          resolve({ ok: false, error: "Sunucu bağlantısı hazırlanıyor…" });
          return;
        }
        if (!socket.connected) {
          resolve({ ok: false, error: "Sunucuya bağlanılıyor, lütfen birkaç saniye bekle." });
          return;
        }
        const cb = (err: Error | null, res: T) => {
          if (err) {
            resolve({
              ok: false,
              error: "Sunucu zamanında yanıt vermedi. Bağlantını kontrol edip tekrar dene.",
            });
            return;
          }
          resolve({ ok: true, data: res });
        };
        if (payload === undefined) {
          socket.timeout(timeoutMs).emit(event, cb);
        } else {
          socket.timeout(timeoutMs).emit(event, payload, cb);
        }
      });
    },
    [socket]
  );

  // Request room list (single deduplicated call with timeout)
  const refreshRooms = useCallback(() => {
    if (!socket || !socket.connected || refreshInFlight.current) return;
    refreshInFlight.current = true;
    socket.timeout(4000).emit("strike:get_rooms", (err: Error | null, res: StrikeRoomSummary[]) => {
      refreshInFlight.current = false;
      if (!err && Array.isArray(res)) setRooms(res);
    });
  }, [socket]);

  // Handle socket rooms and events
  useEffect(() => {
    if (!socket) {
      setSocketConnected(false);
      return;
    }

    setSocketConnected(socket.connected);
    if (!socket.connected) {
      setConnectionNotice("Sunucuya bağlanılıyor…");
    } else {
      setConnectionNotice("");
    }

    const attemptRoomAttach = (roomCode: string, isSavedSession: boolean) => {
      if (!socket.connected || !roomCode || rejoinInFlight.current) return;
      rejoinInFlight.current = true;
      setConnectionNotice("Odaya bağlanılıyor…");
      socket.timeout(8000).emit(
        "strike:join_room",
        { roomCode, roomId: roomCode, code: roomCode },
        (err: Error | null, res: any) => {
          rejoinInFlight.current = false;
          if (err) {
            setConnectionNotice("Bağlantı zaman aşımına uğradı, tekrar deneniyor…");
            return;
          }
          if (res?.success && res.room) {
            setConnectionNotice("");
            setError("");
            updateCurrentRoom(res.room);
            try {
              sessionStorage.setItem("kapsstrike_active_room", res.room.roomCode);
            } catch {}
            if (res.room.status === "in_progress") {
              launch.current(res.room, res.snapshot);
            } else {
              setView("lobby");
            }
          } else {
            setConnectionNotice("");
            if (isSavedSession && !targetRoomId) {
              try {
                sessionStorage.removeItem("kapsstrike_active_room");
              } catch {}
              if (currentRoomRef.current?.roomCode === roomCode) {
                activeRoom.current = null;
                updateCurrentRoom(null);
                setView("menu");
                if (res?.error) setError(res.error);
              }
            } else if (res?.error) {
              setError(res.error);
            }
          }
        }
      );
    };

    const onSocketConnect = () => {
      setSocketConnected(true);
      if (viewRef.current === "menu") {
        setConnectionNotice("");
        refreshRooms();
      }
      // If a StrikeController is already active for a match, its own connect handler runs strike:request_sync.
      // Otherwise, automatically restore lobby / pending room / saved session on connect or reconnect.
      if (!game.current) {
        const existingCode = currentRoomRef.current?.roomCode;
        const savedRoom = (() => {
          try {
            return sessionStorage.getItem("kapsstrike_active_room");
          } catch {
            return null;
          }
        })();
        const roomToJoin = existingCode || targetRoomId || savedRoom;
        if (roomToJoin) {
          attemptRoomAttach(roomToJoin, !targetRoomId && roomToJoin === savedRoom);
        } else {
          setConnectionNotice("");
        }
      }
    };

    const onSocketDisconnect = () => {
      setSocketConnected(false);
      if (!game.current) {
        setConnectionNotice("Sunucu bağlantısı koptu, yeniden bağlanılıyor…");
      }
    };

    const onSocketConnectError = () => {
      setSocketConnected(false);
      setConnectionNotice("Sunucuya bağlanılıyor…");
    };

    refreshRooms();
    const interval = setInterval(() => {
      if (viewRef.current === "menu" && socket.connected) {
        refreshRooms();
      }
    }, 3500);

    let lastScoresAt=0;
    const onScores=(snapshot:StrikeSnapshot)=>{
      const room=currentRoomRef.current;
      if(!room || room.status!=="in_progress" || (snapshot.roomCode && snapshot.roomCode!==room.roomCode) || !Array.isArray(snapshot.players) || performance.now()-lastScoresAt<500)return;
      lastScoresAt=performance.now();
      const updated: StrikeRoomState = {
        ...room,
        timeLeft: snapshot.timeLeft,
        teamScores: snapshot.teamScores || room.teamScores,
        players: room.players.map(player => {
          const current = snapshot.players.find(p => p.userId === player.userId);
          return current ? { ...player, ...current, isAlive: current.hp > 0 } : player;
        }),
      };
      currentRoomRef.current = updated;
      // Avoid 4 Hz full-tree React re-renders during active 3D gameplay unless scoreboard/pause is open
      // or team scores / integer seconds / alive counts actually changed.
      const prevScores = room.teamScores;
      const nextScores = updated.teamScores;
      const summaryChanged =
        Math.floor(room.timeLeft ?? 0) !== Math.floor(updated.timeLeft ?? 0) ||
        prevScores?.red !== nextScores?.red ||
        prevScores?.blue !== nextScores?.blue ||
        room.players.some((p, idx) => p.isAlive !== updated.players[idx]?.isAlive || p.kills !== updated.players[idx]?.kills || p.deaths !== updated.players[idx]?.deaths);
      if (viewRef.current !== "play" || summaryChanged) {
        setCurrentRoom(updated);
      }
    };
    const onRoomsList = (list: StrikeRoomSummary[]) => {
      if (Array.isArray(list)) {
        setRooms(list);
      }
    };

    const onRoomState = (state: StrikeRoomState) => {
      updateCurrentRoom(state);
      if (state.status === "in_progress") {
        launch.current(state);
      } else if (state.status === "lobby" && !game.current) {
        setView("lobby");
      }
    };

    const onMatchStarted = (data: any) => {
      if (data && typeof data === "object") {
        if (data.map) setMap(data.map);
        if (data.roomCode) {
          updateCurrentRoom(data);
        }
        launch.current(data, data.snapshot);
      }
    };

    const onMatchReset = (state: StrikeRoomState) => {
      setKillFeed([]);
      updateCurrentRoom(state);
      launchToken.current++;
      if (launchRaf.current !== null) {
        cancelAnimationFrame(launchRaf.current);
        launchRaf.current = null;
      }
      activeRoom.current = null;
      clearTimeout(loadTimer.current);
      game.current?.dispose();
      game.current = null;
      setConnectionNotice("");
      setView("lobby");
    };

    const pushFeed = (entry: KillFeedEntry, connection = false) => {
      if (viewRef.current !== "play" && viewRef.current !== "pause") return;
      const timestamp = Date.now();
      setKillFeed(prev => {
        const rest = prev.filter(item => item.id !== entry.id);
        if (!connection && rest.length !== prev.length) return prev;
        return [{ ...entry, timestamp }, ...rest].slice(0, 4);
      });
    };
    const onKill = (entry: KillFeedEntry) => pushFeed(entry);
    const feedTimer = window.setInterval(() => {
      const now = Date.now();
      setKillFeed(prev => {
        const active = prev.filter(entry => now - entry.timestamp < (entry.id.startsWith("connection-") ? 2200 : 3400));
        return active.length === prev.length ? prev : active;
      });
    }, 250);

    const onMatchEnded = (payload: any) => {
      setKillFeed([]);
      launchToken.current++;
      if (launchRaf.current !== null) {
        cancelAnimationFrame(launchRaf.current);
        launchRaf.current = null;
      }
      activeRoom.current = null;
      clearTimeout(loadTimer.current);
      setConnectionNotice("");
      let stats: MatchStats;
      if (payload && Array.isArray(payload.players)) {
        const roomState = payload as StrikeRoomState;
        updateCurrentRoom(roomState);
        const me = roomState.players.find((p) => p.userId === currentUserId);
        const sorted = [...roomState.players].sort((a, b) => b.kills - a.kills || b.damage - a.damage);
        const top = sorted[0];
        const isWin =
          (roomState.mode !== "ffa" && me?.team === roomState.winner?.team && roomState.winner?.team !== "none") ||
          (roomState.mode === "ffa" && me?.userId === roomState.winner?.userId);
        stats = {
          kills: me?.kills || 0,
          deaths: me?.deaths || 0,
          headshots: me?.headshots || 0,
          damage: me?.damage || 0,
          score: me?.score || 0,
          won: isWin,
          mode: roomState.mode,
          winnerTeam: roomState.winner?.team,
          winnerName: roomState.winner?.username,
          mvp: top ? { userId: top.userId, username: top.username, kills: top.kills, damage: top.damage } : undefined,
        };
      } else if (payload && typeof payload === "object") {
        stats = payload as MatchStats;
      } else {
        stats = {
          kills: 0,
          deaths: 0,
          headshots: 0,
          damage: 0,
          score: 0,
          won: false,
          mode: "ffa",
        };
      }
      setMatchStats(stats);
      setView("match_end");
      game.current?.dispose();
      game.current = null;
    };

    const onError = (data: { message?: string; error?: string }) => {
      setError(data.message || data.error || "Ağ hatası oluştu.");
    };

    type ConnectionNotice = { userId: number; username: string; team: StrikeTeam };
    const onConnectionNotice = (data: ConnectionNotice, reconnected: boolean) => {
      const killerId = `u-${data.userId}`;
      const entry: KillFeedEntry = {
        id: `connection-${killerId}`,
        tick: 0,
        killerId,
        killerName: data.username,
        killerTeam: data.team,
        victimId: reconnected ? "reconnect" : "disconnect",
        victimName: reconnected ? "Yeniden bağlandı" : "Bağlantısı koptu",
        victimTeam: "none",
        weapon: "pistol",
        headshot: false,
        timestamp: Date.now(),
      };
      pushFeed(entry, true);
    };
    const onPlayerDisconnected = (data: ConnectionNotice) => onConnectionNotice(data, false);
    const onPlayerReconnected = (data: ConnectionNotice) => onConnectionNotice(data, true);

    socket.on("connect", onSocketConnect);
    socket.on("disconnect", onSocketDisconnect);
    socket.on("connect_error", onSocketConnectError);
    socket.on("strike:snapshot",onScores);
    socket.on("strike:rooms_list", onRoomsList);
    socket.on("strike:room_list", onRoomsList);
    socket.on("strike:room_state", onRoomState);
    socket.on("strike:match_started", onMatchStarted);
    socket.on("strike:match_reset_to_lobby", onMatchReset);
    socket.on("strike:kill", onKill);
    socket.on("strike:kill_feed", onKill);
    socket.on("strike:match_ended", onMatchEnded);
    socket.on("strike:game_over", onMatchEnded);
    socket.on("strike:player_disconnected", onPlayerDisconnected);
    socket.on("strike:player_reconnected", onPlayerReconnected);
    socket.on("strike:error", onError);

    // Direct room join or seamless session reconnect (if already connected; otherwise onSocketConnect triggers it)
    const savedRoom = (() => {
      try {
        return sessionStorage.getItem("kapsstrike_active_room");
      } catch {
        return null;
      }
    })();
    const roomToJoin = targetRoomId || savedRoom;
    if (roomToJoin && socket.connected) {
      attemptRoomAttach(roomToJoin, !targetRoomId && roomToJoin === savedRoom);
    }

    return () => {
      clearInterval(interval);
      clearInterval(feedTimer);
      socket.off("connect", onSocketConnect);
      socket.off("disconnect", onSocketDisconnect);
      socket.off("connect_error", onSocketConnectError);
      socket.off("strike:snapshot",onScores);
      socket.off("strike:rooms_list", onRoomsList);
      socket.off("strike:room_list", onRoomsList);
      socket.off("strike:room_state", onRoomState);
      socket.off("strike:match_started", onMatchStarted);
      socket.off("strike:match_reset_to_lobby", onMatchReset);
      socket.off("strike:kill", onKill);
      socket.off("strike:kill_feed", onKill);
      socket.off("strike:match_ended", onMatchEnded);
      socket.off("strike:game_over", onMatchEnded);
      socket.off("strike:player_disconnected", onPlayerDisconnected);
      socket.off("strike:player_reconnected", onPlayerReconnected);
      socket.off("strike:error", onError);
    };
  }, [socket, currentUserId, targetRoomId, refreshRooms, updateCurrentRoom]);

  // Launch Local Offline Training
  const startTraining = () => {
    setPanel(null);
    setError("");
    try {
      localStorage.setItem("kapsstrike-settings", JSON.stringify(settings));
    } catch {}

    try {
      game.current?.dispose();
      game.current = new StrikeController(
        canvas.current!,
        map,
        settings,
        setHUD,
        (reason) => {
          setView("pause");
          if (reason) setError(reason);
        }
      );
      game.current.setReturnFire(returnFire);
      setView("play");
      game.current.start();
    } catch (e) {
      game.current?.dispose();
      game.current = null;
      setView("menu");
      setError(e instanceof Error ? e.message : "WebGL başlatılamadı.");
    }
  };

  // Launch Online Multiplayer Match
  const startMultiplayerGame = (roomOrMap?: any, initialSnapshot?: StrikeSnapshot) => {
    const code = roomOrMap?.roomCode || currentRoomRef.current?.roomCode;
    if (!code || activeRoom.current === code) return;
    activeRoom.current = code;
    const myToken = ++launchToken.current;
    if (launchRaf.current !== null) {
      cancelAnimationFrame(launchRaf.current);
      launchRaf.current = null;
    }

    setView("loading");
    setLoadStage(
      socket?.connected ? "Harita ve silahlar hazırlanıyor…" : "Sunucuya bağlanılıyor…"
    );
    setConnectionNotice("");
    setPanel(null);
    setError("");
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      if (launchToken.current !== myToken || activeRoom.current !== code) return;
      activeRoom.current = null;
      game.current?.dispose();
      game.current = null;
      setView("lobby");
      setError("Maç 20 saniyede hazır hale gelmedi. Bağlantını kontrol edip yeniden bağlanabilirsin.");
    }, 20000);

    try {
      localStorage.setItem("kapsstrike-settings", JSON.stringify(settings));
    } catch {}

    const targetRoom: StrikeRoomState | null =
      roomOrMap && typeof roomOrMap === "object" && roomOrMap.roomCode
        ? (roomOrMap as StrikeRoomState)
        : currentRoomRef.current || currentRoom;

    const gameMap: MapId =
      roomOrMap && typeof roomOrMap === "object" && roomOrMap.map
        ? roomOrMap.map
        : typeof roomOrMap === "string"
        ? (roomOrMap as MapId)
        : targetRoom?.map || map || "warehouse";

    const activeRoomCode = targetRoom?.roomCode || code;
    const myTeam: StrikeTeam =
      targetRoom?.players?.find((p) => p.userId === currentUserId)?.team || "none";

    // Defer heavy WebGL scene construction by one animation frame so the loading UI
    // paints immediately before main-thread shader/mesh compilation begins.
    launchRaf.current = requestAnimationFrame(() => {
      launchRaf.current = null;
      if (launchToken.current !== myToken || activeRoom.current !== code) return;
      if (!canvas.current) {
        activeRoom.current = null;
        clearTimeout(loadTimer.current);
        setView("lobby");
        setError("Oyun alanı hazırlanamadı. Lütfen tekrar dene.");
        return;
      }

      try {
        game.current?.dispose();
        game.current = new StrikeController(
          canvas.current,
          gameMap,
          settings,
          setHUD,
          (reason) => {
            setView("pause");
            if (reason) setError(reason);
          },
          undefined,
          {
            socket,
            roomCode: activeRoomCode,
            userId: currentUserId,
            username,
            team: myTeam,
            isMultiplayer: true,
            initialSnapshot,
            onLoadingStage: setLoadStage,
            onConnectionStateChange: (state) => {
              setSocketConnected(state.connected);
              setConnectionNotice(state.reconnecting ? (state.message || "Yeniden bağlanılıyor…") : "");
            },
            onRoomLost: (reason) => {
              if (launchToken.current !== myToken) return;
              clearTimeout(loadTimer.current);
              activeRoom.current = null;
              game.current?.dispose();
              game.current = null;
              setConnectionNotice("");
              if (currentRoomRef.current && currentRoomRef.current.status === "lobby") {
                setView("lobby");
              } else {
                try {
                  sessionStorage.removeItem("kapsstrike_active_room");
                } catch {}
                updateCurrentRoom(null);
                setView("menu");
              }
              if (reason) setError(reason);
            },
            onSynchronized: () => {
              if (launchToken.current !== myToken) return;
              clearTimeout(loadTimer.current);
              setConnectionNotice("");
              setError("");
              setView(game.current?.isTouchDevice ? "play" : "pause");
            },
            onScoreboardToggle: (open) => setScoreboardOpen(open),
            onPttChange: (active) => voice.current?.setPttActive(active),
          }
        );
        setLoadStage(
          initialSnapshot
            ? "Grafikler hazırlanıyor…"
            : "Sunucu durumu senkronize ediliyor…"
        );
        game.current.start(false);

        // Connect voice room with other players
        if (voice.current && targetRoom) {
          voice.current.joinRoomVoice(
            targetRoom.roomCode,
            targetRoom.players.map((p) => p.userId)
          );
        }
      } catch (e) {
        game.current?.dispose();
        game.current = null;
        clearTimeout(loadTimer.current);
        activeRoom.current = null;
        setView("lobby");
        setError(e instanceof Error ? e.message : "Oyun başlatılamadı.");
      }
    });
  };

  launch.current = startMultiplayerGame;

  const resume = () => {
    setError("");
    setPanel(null);
    setView("play");
    game.current?.start();
  };

  const exit = () => {
    try {
      sessionStorage.removeItem("kapsstrike_active_room");
      sessionStorage.removeItem("pending_join_strike");
    } catch {}
    launchToken.current++;
    if (launchRaf.current !== null) {
      cancelAnimationFrame(launchRaf.current);
      launchRaf.current = null;
    }
    activeRoom.current = null;
    clearTimeout(loadTimer.current);
    game.current?.dispose();
    game.current = null;
    voice.current?.leaveVoice();
    setHUD(null);
    setConnectionNotice("");
    if ((currentRoom || currentRoomRef.current) && socket?.connected) {
      socket.emit("strike:leave_room");
    }
    updateCurrentRoom(null);
    setView("menu");
    setPanel(null);
    refreshRooms();
  };

  const runGuardedAction = async (fn: () => Promise<void>) => {
    if (busyAction.current) return;
    busyAction.current = true;
    setActionBusy(true);
    try {
      await fn();
    } finally {
      busyAction.current = false;
      setActionBusy(false);
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createCategory) return;
    setError("");
    void runGuardedAction(async () => {
      const result = await emitWithAck<{ success: boolean; room?: StrikeRoomState; error?: string }>(
        "strike:create_room",
        {
          name: createName,
          map: createCategory === "bomb" ? createBombMap : createMap,
          mode: createCategory === "bomb" ? "bomb" : createMode,
          bombRounds: createCategory === "bomb" ? createBombRounds : undefined,
          maxPlayers: createMaxPlayers,
          timeLimit: createDuration,
          scoreLimit: createScoreLimit,
          password: createPassword,
        }
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const res = result.data;
      if (res?.success && res.room) {
        updateCurrentRoom(res.room);
        setPanel(null);
        setView("lobby");
        refreshRooms();
      } else {
        setError(res?.error || "Oda kurulamadı.");
      }
    });
  };

  const handleQuickMatch = () => {
    setError("");
    void runGuardedAction(async () => {
      const result = await emitWithAck<{
        success: boolean;
        room?: StrikeRoomState;
        snapshot?: StrikeSnapshot;
        error?: string;
      }>("strike:quick_match", {});
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const res = result.data;
      if (res?.success && res.room) {
        updateCurrentRoom(res.room);
        if (res.room.status === "in_progress") {
          startMultiplayerGame(res.room, res.snapshot);
        } else {
          setView("lobby");
        }
      } else {
        setError(res?.error || "Hızlı maç bulunamadı.");
      }
    });
  };

  const handleJoinRoom = (roomId: string, hasPass = false) => {
    if (hasPass) {
      setPasswordModalRoomId(roomId);
      return;
    }
    setError("");
    void runGuardedAction(async () => {
      const result = await emitWithAck<{
        success: boolean;
        room?: StrikeRoomState;
        snapshot?: StrikeSnapshot;
        error?: string;
      }>("strike:join_room", { roomCode: roomId, roomId, code: roomId });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const res = result.data;
      if (res?.success && res.room) {
        updateCurrentRoom(res.room);
        if (res.room.status === "in_progress") {
          startMultiplayerGame(res.room, res.snapshot);
        } else {
          setView("lobby");
        }
      } else {
        setError(res?.error || "Odaya katılınamadı.");
      }
    });
  };

  const handleJoinWithPassword = () => {
    if (!passwordModalRoomId) return;
    setError("");
    void runGuardedAction(async () => {
      const result = await emitWithAck<{
        success: boolean;
        room?: StrikeRoomState;
        snapshot?: StrikeSnapshot;
        error?: string;
      }>("strike:join_room", {
        roomCode: passwordModalRoomId,
        roomId: passwordModalRoomId,
        code: passwordModalRoomId,
        password: passwordInput,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const res = result.data;
      if (res?.success && res.room) {
        updateCurrentRoom(res.room);
        setPasswordModalRoomId(null);
        setPasswordInput("");
        if (res.room.status === "in_progress") {
          startMultiplayerGame(res.room, res.snapshot);
        } else {
          setView("lobby");
        }
      } else {
        setError(res?.error || "Hatalı oda şifresi.");
      }
    });
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput) return;
    const clean = joinCodeInput.trim().toUpperCase();
    setError("");

    const matched = rooms.find(
      (r) =>
        r.roomCode.toUpperCase() === clean ||
        r.roomCode.toUpperCase() === `KS-${clean}` ||
        r.roomCode.toUpperCase().replace(/[^A-Z0-9]/g, "") === clean.replace(/[^A-Z0-9]/g, "")
    );

    if (matched && matched.hasPassword) {
      handleJoinRoom(matched.roomCode, true);
      return;
    }

    void runGuardedAction(async () => {
      const result = await emitWithAck<{
        success: boolean;
        room?: StrikeRoomState;
        snapshot?: StrikeSnapshot;
        error?: string;
      }>("strike:join_room", { roomCode: clean, roomId: clean, code: clean });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const res = result.data;
      if (res?.success && res.room) {
        updateCurrentRoom(res.room);
        if (res.room.status === "in_progress") {
          startMultiplayerGame(res.room, res.snapshot);
        } else {
          setView("lobby");
        }
      } else {
        setError(res?.error || "Oda kodu bulunamadı.");
      }
    });
  };

  const toggleReady = () => {
    if (!socket?.connected || !currentRoom) return;
    const me = currentRoom.players.find((p) => p.userId === currentUserId);
    const nextReady = !me?.ready;
    // Optimistic UI update
    updateCurrentRoom({
      ...currentRoom,
      players: currentRoom.players.map((p) =>
        p.userId === currentUserId ? { ...p, ready: nextReady } : p
      ),
    });
    socket.emit("strike:set_ready", { ready: nextReady });
  };

  const teamSwitchPending = useRef(false);
  const switchTeam = (team: StrikeTeam) => {
    if (!socket?.connected || !currentRoom || teamSwitchPending.current) return;
    const roomCode = currentRoom.roomCode;
    teamSwitchPending.current = true;
    setError("");
    socket.timeout(4000).emit("strike:switch_team", { team },
      (err: Error | null, result?: { success: boolean; room?: StrikeRoomState; error?: string }) => {
        teamSwitchPending.current = false;
        if (currentRoomRef.current?.roomCode !== roomCode) return;
        if (err || !result?.success) {
          setError(err ? "Sunucu yanıt vermedi. Tekrar dene." : result?.error || "Takım değiştirilemedi.");
          return;
        }
        if (result.room && currentRoomRef.current.status === "lobby") updateCurrentRoom(result.room);
      });
  };

  const startMatchAsHost = () => {
    if (!currentRoom || isStartingMatch) return;
    setError("");
    setIsStartingMatch(true);
    const needBot = currentRoom.mode === "bomb" && currentRoom.players.length < 2;
    void (async () => {
      const result = await emitWithAck<{ success: boolean; error?: string }>(
        "strike:start_game",
        needBot ? { fillBot: true } : {},
        8000
      );
      if (!result.ok) {
        setIsStartingMatch(false);
        setError(result.error);
        return;
      }
      if (result.data && !result.data.success) {
        setIsStartingMatch(false);
        if (result.data.error) setError(result.data.error);
      }
    })();
  };

  const returnToLobbyAsHost = () => {
    if (!socket?.connected || !currentRoom) return;
    socket.emit("strike:return_to_lobby");
  };

  const toggleVoice = async () => {
    if (!voice.current) return;
    if (isVoiceMuted) {
      const res = await voice.current.initMicrophone();
      if (!res.success && res.error) {
        setError(res.error);
        return;
      }
      voice.current.setMute(false);
      setIsVoiceMuted(false);
    } else {
      voice.current.setMute(true);
      setIsVoiceMuted(true);
    }
  };

  const handleCopyInvite = () => {
    if (!currentRoom) return;
    const link = `${window.location.origin}/?oyun=kapsstrike&room=${currentRoom.roomCode}`;
    const text = `🎯 KapsStrike 3D FPS Maç Daveti!\nOda: ${currentRoom.name}\nKod: ${currentRoom.roomCode}\nKatıl: ${link}`;
    navigator.clipboard?.writeText(text);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  useEffect(() => {
    let active = true;
    if (lastInventoryUserRef.current !== currentUserId) {
      lastInventoryUserRef.current = currentUserId;
      setSettings((old) => ({ ...old, cosmeticLoadout: {}, hiddenWeapons: [] }));
    }
    const sync = () => {
      socket?.timeout(6000).emit("strike:inventory_get", {}, (err: any, r: any) => {
        if (active && !err && r?.success) {
          setSettings((old) => ({
            ...old,
            cosmeticLoadout: r.state.equipped,
            hiddenWeapons: r.state.hiddenWeapons || [],
          }));
        }
      });
    };
    if (socket?.connected) sync();
    socket?.on("connect", sync);
    return () => {
      active = false;
      socket?.off("connect", sync);
    };
  }, [socket, currentUserId]);
  useEffect(()=>{
    const open=(e:KeyboardEvent)=>{if(e.code!=='KeyB'||e.repeat||view!=='play'||isBombRoom||(e.target instanceof HTMLElement&&/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)))return;e.preventDefault();game.current?.pause();setPanel('weapons');};
    window.addEventListener('keydown',open);return()=>window.removeEventListener('keydown',open);
  },[view,isBombRoom]);
  const [loadoutBusy,setLoadoutBusy]=useState(false);
  const [loadoutError,setLoadoutError]=useState('');
  const toggleWeapon=(id:WeaponId)=>{
    if(loadoutBusy||!socket?.connected)return;
    const hidden=settings.hiddenWeapons||[];const next=hidden.includes(id)?hidden.filter(w=>w!==id):[...hidden,id];setLoadoutBusy(true);setLoadoutError('');
    socket.timeout(6000).emit('strike:inventory_preferences',{hiddenWeapons:next},(err:any,r:any)=>{setLoadoutBusy(false);if(err||!r?.success){setLoadoutError(r?.error||'Tercih kaydedilemedi.');return;}setSettings(old=>({...old,hiddenWeapons:r.state.hiddenWeapons||[]}));});
  };
  const setting = (patch: Partial<StrikeSettings>) =>
    setSettings((old) => cleanSettings({ ...old, ...patch }));

  const isHost = currentRoom?.hostId === currentUserId;
  const filteredRooms = rooms.filter((r) => {
    const matchQuery = r.name.toLowerCase().includes(roomFilter.toLowerCase());
    const matchMode = roomModeFilter === "all" || r.mode === roomModeFilter;
    return matchQuery && matchMode;
  });

  return (
    <section ref={gameRoot} className={`ks-root ks-experience ${isMobile?'ks-touch-layout':''} ks-view-${view} ${hud?.ads&&(hud.weapon==='sniper'||hud.weapon==='railgun')?'ks-scoped':''}`} aria-label="KapsStrike 3D FPS">
      <canvas
        ref={canvas}
        className="ks-canvas"
        aria-label="KapsStrike 3D oyun alanı"
        tabIndex={-1}
      />

      {view === "loading" && (
        <div className="ks-overlay" role="status" aria-live="polite">
          <div className="ks-menu">
            <div className="ks-eyebrow">
              {currentRoom ? `${MAPS[currentRoom.map]?.name || currentRoom.map} · ${currentRoom.roomCode}` : "KAPSSTRIKE"}
            </div>
            <h2>Maç hazırlanıyor</h2>
            <p>{connectionNotice || loadStage || "Sunucu durumu senkronize ediliyor…"}</p>
            <button onClick={exit}>Lobiye / menüye dön</button>
          </div>
        </div>
      )}
      {connectionNotice && view !== "loading" && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-amber-500/90 text-slate-950 text-xs font-bold shadow-lg border border-amber-300/60"
          role="status"
          aria-live="polite"
        >
          {connectionNotice}
        </div>
      )}
      {error && view !== "menu" && <p className="ks-network-error" role="alert">{error}</p>}

      {/* MOBILE PORTRAIT ORIENTATION BANNER */}
      {view === "play" && isMobile && isPortrait && currentRoom?.mode!=="bomb" && (
        <div className="ks-landscape-banner">
          📱 En iyi 3D FPS kontrolü ve geniş görüş için telefonunuzu yatay çeviriniz!
        </div>
      )}

      {/* TOP RIGHT PAUSE GEAR BUTTON */}
      {view === "play" && (
        <button
          type="button"
          className="ks-pause-gear-btn"
          onClick={() => {
            game.current?.pause();
            setView("pause");
          }}
          title="Ayarlar & Duraklat"
        >
          ⚙️
        </button>
      )}

      {view === "play" && canFullscreen && (
        <button type="button" className="ks-pause-gear-btn ks-fullscreen-btn" aria-label={fullscreenLabel}
          title={fullscreenLabel} onClick={() => void toggleFullscreen()}>
          {fullscreen ? <Minimize size={19} aria-hidden="true" /> : <Maximize size={19} aria-hidden="true" />}
        </button>
      )}

      {/* TOP LEFT MINIMALIST VOICE MIC BUTTON */}
      {view === "play" && (
        <div className="ks-top-left-bar">
          <button
            type="button"
            onClick={toggleVoice}
            className="ks-mini-mic-btn"
            style={{
              borderColor: isVoiceMuted ? "rgba(239, 68, 68, 0.6)" : "rgba(34, 197, 94, 0.6)",
              background: isVoiceMuted ? "rgba(239, 68, 68, 0.25)" : "rgba(34, 197, 94, 0.25)",
            }}
            title={isVoiceMuted ? "Mikrofon Kapalı" : "Mikrofon Açık"}
          >
            {isVoiceMuted ? "🔇" : "🎙️"}
          </button>
        </div>
      )}

      {/* MOBILE ERGONOMIC HUD OVERLAY (PUBG STİLİ DİNAMİK TUŞ DÜZENİ) */}
      {view === "play" && isMobile && !panel && !(hud?.dead&&currentRoom?.mode==='bomb') && (
        <div className="ks-touch-overlay">
          {/* Virtual Joystick Zone */}
          <div
            className="ks-touch-joystick-zone"
            style={{
              position: "absolute",
              left: `${touchLayout.joystick.x}%`,
              top: `${touchLayout.joystick.y}%`,
              transform: `translate(-50%, -50%) scale(${touchLayout.joystick.size})`,
              opacity: touchLayout.joystick.opacity,
            }}
            onTouchStart={(e) => {
              if (joystickTouchId.current !== null) return;
              const touch = e.changedTouches[0];
              joystickTouchId.current = touch.identifier;
              const rect = e.currentTarget.getBoundingClientRect();
              joystickCenter.current = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              };
            }}
            onTouchMove={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joystickTouchId.current) {
                  const dx = touch.clientX - joystickCenter.current.x;
                  const dy = touch.clientY - joystickCenter.current.y;
                  const maxRadius = 45;
                  const dist = Math.hypot(dx, dy);
                  const clampedDist = Math.min(dist, maxRadius);
                  const angle = Math.atan2(dy, dx);
                  const thumbX = Math.cos(angle) * clampedDist;
                  const thumbY = Math.sin(angle) * clampedDist;

                  setJoystickThumb({ x: thumbX, y: thumbY });
                  game.current?.setTouchMovement(thumbX / maxRadius, -thumbY / maxRadius);
                  break;
                }
              }
            }}
            onTouchEnd={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joystickTouchId.current) {
                  joystickTouchId.current = null;
                  setJoystickThumb({ x: 0, y: 0 });
                  game.current?.setTouchMovement(0, 0);
                  break;
                }
              }
            }}
            onTouchCancel={() => {
              joystickTouchId.current = null;
              setJoystickThumb({ x: 0, y: 0 });
              game.current?.setTouchMovement(0, 0);
            }}
          >
            <div
              className="ks-touch-joystick-thumb"
              style={{
                transform: `translate(${joystickThumb.x}px, ${joystickThumb.y}px)`,
              }}
            />
          </div>

          {/* Touch Look Area (Right Screen Half) */}
          <div
            className="ks-touch-look-zone"
            onTouchStart={(e) => {
              if (lookTouchId.current !== null) return; // Keep current looking finger active
              const touch = e.changedTouches[0];
              lookTouchId.current = touch.identifier;
              lookLastPos.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchMove={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === lookTouchId.current) {
                  if (!lookLastPos.current) {
                    lookLastPos.current = { x: touch.clientX, y: touch.clientY };
                    break;
                  }
                  const deltaX = touch.clientX - lookLastPos.current.x;
                  const deltaY = touch.clientY - lookLastPos.current.y;
                  lookLastPos.current = { x: touch.clientX, y: touch.clientY };
                  game.current?.addTouchLook(deltaX, deltaY);
                  break;
                }
              }
            }}
            onTouchEnd={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookTouchId.current) {
                  lookTouchId.current = null;
                  lookLastPos.current = null;
                  break;
                }
              }
            }}
            onTouchCancel={() => {
              lookTouchId.current = null;
              lookLastPos.current = null;
            }}
          />

          {(() => {
            const touchCombat = getTouchCombatButtonState(hud);
            const equipData = getTopRightEquipmentSlots(
              hud,
              settings.hiddenWeapons || [],
              isBombRoom
            );
            const readOnlyInv = getReadOnlyInventoryContents({
              weapons: hud?.inventory,
              utility: hud?.utilityInventory,
              armor: hud?.armor,
              isCarrier: hud?.isBombCarrier,
            });

            return (
              <>
                {/* Read-Only Inventory Box on Top-Left (when not in Bomb mode; Bomb mode renders its own read-only .ks-bomb-objective) */}
                {currentRoom?.mode !== "bomb" && (
                  <aside
                    className="ks-readonly-inventory-card"
                    aria-label="Envanter İçeriği"
                  >
                    <span className="ks-inv-header">ENVANTER İÇERİĞİ</span>
                    <div className="ks-inv-readonly-list">
                      {readOnlyInv.weaponNames.length > 0 && (
                        <span className="ks-inv-readonly-item">
                          Silahlar: <b>{readOnlyInv.weaponNames.slice(0, 3).join(" · ")}</b>
                        </span>
                      )}
                      {readOnlyInv.grenadeItems.length > 0 && (
                        <span className="ks-inv-readonly-item">
                          Bombalar:{" "}
                          {readOnlyInv.grenadeItems.map((g) => (
                            <b key={g.kind} className="ks-inv-grenade-badge">
                              {g.label} ×{g.count}
                            </b>
                          ))}
                        </span>
                      )}
                    </div>
                  </aside>
                )}

                {/* TOP-RIGHT WEAPON & EQUIPMENT SWITCHER */}
                <div
                  className="ks-topright-equip"
                  aria-label="Sağ Üst Silah ve Ekipman Değiştirici"
                >
                  <div className="ks-topright-equip-header">
                    <button
                      type="button"
                      data-testid="ks-topright-equip-btn"
                      className={`ks-topright-equip-btn ${
                        equipData.activeSummary.isGrenade ? "is-grenade" : ""
                      }`}
                      onClick={() => setWeaponMenuOpen((prev) => !prev)}
                      title="Silah / Ekipman Değiştir"
                    >
                      <span
                        className="ks-topright-equip-dot"
                        style={{ backgroundColor: equipData.activeSummary.badgeColor }}
                      />
                      <div className="ks-topright-equip-info">
                        <span className="ks-topright-equip-title">
                          {equipData.activeSummary.isGrenade ? "💣 " : "🔫 "}
                          {equipData.activeSummary.title}
                        </span>
                        <span className="ks-topright-equip-sub">
                          {equipData.activeSummary.subtitle}
                        </span>
                      </div>
                      <span className="ks-topright-equip-badge">
                        Ekipman {weaponMenuOpen ? "▲" : "▼"}
                      </span>
                    </button>

                    {/* 1-Tap Quick Weapon Cycle Button */}
                    <button
                      type="button"
                      className="ks-topright-cycle-btn"
                      title="Hızlı Silah Değiştir"
                      aria-label="Hızlı Silah Değiştir"
                      onClick={() => {
                        const wList = equipData.weapons;
                        if (wList.length === 0) return;
                        const curIdx = wList.findIndex((w) => w.id === hud?.weapon);
                        const nextW = wList[(curIdx + 1) % wList.length];
                        if (nextW) {
                          game.current?.selectWeapon(nextW.id);
                        }
                      }}
                    >
                      🔄
                    </button>
                  </div>

                  {/* Quick 1-Tap Grenade & Weapon Pills under Top-Right Switcher */}
                  <div className="ks-topright-quick-pills">
                    {equipData.weapons.slice(0, 3).map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        className={`ks-topright-pill ${w.active ? "active" : ""}`}
                        onClick={() => {
                          game.current?.selectWeapon(w.id);
                          setWeaponMenuOpen(false);
                        }}
                      >
                        {w.label.split(" ")[0]}
                      </button>
                    ))}
                    {equipData.grenades.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        data-testid={`ks-equip-grenade-${g.id}`}
                        className={`ks-topright-pill is-grenade ${g.active ? "active" : ""}`}
                        onClick={() => {
                          game.current?.selectUtility(g.active ? undefined : g.id);
                          setWeaponMenuOpen(false);
                        }}
                      >
                        💣 {g.label.split(" ")[0]} ×{g.count}
                      </button>
                    ))}
                    {equipData.bombSlot && (
                      <button
                        type="button"
                        className={`ks-topright-pill is-bomb ${equipData.bombSlot.active ? "active" : ""}`}
                        onClick={() => {
                          game.current?.equipBomb();
                          setWeaponMenuOpen(false);
                        }}
                      >
                        📟 C4
                      </button>
                    )}
                  </div>

                  {/* Expanded Top-Right Equipment Selection Tray */}
                  {weaponMenuOpen && (
                    <div
                      className="ks-topright-equip-tray"
                      role="dialog"
                      aria-label="Silah ve Ekipman Seçim Menüsü"
                    >
                      <div className="ks-equip-tray-section">
                        <span className="ks-equip-tray-label">SİLAHLAR</span>
                        <div className="ks-equip-tray-grid">
                          {equipData.weapons.map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              className={`ks-weapon-wheel-btn ${w.active ? "active" : ""}`}
                              onClick={() => {
                                game.current?.selectWeapon(w.id);
                                setWeaponMenuOpen(false);
                              }}
                            >
                              <span className="font-bold">{w.label}</span>
                              <span className="text-[10px] opacity-75">{w.sublabel}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {(equipData.grenades.length > 0 || equipData.bombSlot) && (
                        <div className="ks-equip-tray-section">
                          <span className="ks-equip-tray-label">BOMBALAR & GÖREV EKİPMANI</span>
                          <div className="ks-equip-tray-grid">
                            {equipData.grenades.map((g) => (
                              <button
                                key={g.id}
                                type="button"
                                className={`ks-weapon-wheel-btn is-grenade-slot ${
                                  g.active ? "active" : ""
                                }`}
                                onClick={() => {
                                  game.current?.selectUtility(g.active ? undefined : g.id);
                                  setWeaponMenuOpen(false);
                                }}
                              >
                                <span className="font-bold">💣 {g.label}</span>
                                <span className="text-[10px] opacity-80">
                                  Adet: ×{g.count} · {g.active ? "Elde" : "Ele Al"}
                                </span>
                              </button>
                            ))}
                            {equipData.bombSlot && (
                              <button
                                type="button"
                                className={`ks-weapon-wheel-btn is-bomb-slot ${
                                  equipData.bombSlot.active ? "active" : ""
                                }`}
                                onClick={() => {
                                  game.current?.equipBomb();
                                  setWeaponMenuOpen(false);
                                }}
                              >
                                <span className="font-bold">📟 {equipData.bombSlot.label}</span>
                                <span className="text-[10px] opacity-80">
                                  {equipData.bombSlot.sublabel}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* COMBAT ACTION BUTTONS:
                    When holding a weapon -> Show normal Attack (ATEŞ), ADS (DÜRBÜN), Reload (YENİLE).
                    When holding a grenade -> Hide Attack button completely and show ONLY "UZAĞA AT" & "YAKINA AT"! */}
                {touchCombat.showAttackButton && (
                  <>
                    {/* Main Fire Button */}
                    <button
                      type="button"
                      data-testid="ks-touch-fire-btn"
                      className="ks-touch-btn-custom ks-touch-fire-btn"
                      style={{
                        left: `${touchLayout.fire.x}%`,
                        top: `${touchLayout.fire.y}%`,
                        transform: `translate(-50%, -50%) scale(${touchLayout.fire.size})`,
                        opacity: touchLayout.fire.opacity,
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        game.current?.setTouchFire(true);
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        game.current?.setTouchFire(false);
                      }}
                      onTouchCancel={() => game.current?.setTouchFire(false)}
                    >
                      <span className="text-base leading-none">💥</span>
                      <span>ATEŞ</span>
                    </button>

                    {/* ADS / Dürbün Button */}
                    <button
                      type="button"
                      className="ks-touch-btn-custom ks-touch-ads-btn"
                      style={{
                        left: `${touchLayout.ads.x}%`,
                        top: `${touchLayout.ads.y}%`,
                        transform: `translate(-50%, -50%) scale(${touchLayout.ads.size})`,
                        opacity: touchLayout.ads.opacity,
                        background: touchAdsActive ? "rgba(236, 193, 123, 0.45)" : undefined,
                        borderColor: touchAdsActive ? "#ecc17b" : undefined,
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        const next = hud?.weapon === "knife" ? true : !touchAdsActive;
                        setTouchAdsActive(next);
                        game.current?.setTouchAds(next);
                      }}
                      onTouchEnd={() => {
                        if (hud?.weapon === "knife") {
                          setTouchAdsActive(false);
                          game.current?.setTouchAds(false);
                        }
                      }}
                      onTouchCancel={() => {
                        setTouchAdsActive(false);
                        game.current?.setTouchAds(false);
                      }}
                    >
                      <span className="text-base leading-none">🎯</span>
                      <span>{hud?.weapon === "knife" ? "GÜÇLÜ" : "DÜRBÜN"}</span>
                    </button>

                    {/* Şarjör Değiştir (Reload) Button */}
                    <button
                      type="button"
                      className="ks-touch-btn-custom ks-touch-reload-btn"
                      style={{
                        left: `${touchLayout.reload.x}%`,
                        top: `${touchLayout.reload.y}%`,
                        transform: `translate(-50%, -50%) scale(${touchLayout.reload.size})`,
                        opacity: touchLayout.reload.opacity,
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        game.current?.triggerReload();
                      }}
                    >
                      <span className="text-base leading-none">🔄</span>
                      <span>YENİLE</span>
                    </button>
                  </>
                )}

                {touchCombat.showGrenadeThrowButtons && (
                  <div
                    className="ks-touch-grenade-throw-group"
                    aria-label={`${touchCombat.activeGrenadeName || "Bomba"} Atış Tuşları`}
                  >
                    {/* UZAĞA AT Button (replaces Attack button position) */}
                    <button
                      type="button"
                      data-testid="ks-touch-throw-far"
                      className="ks-touch-btn-custom ks-touch-throw-far-btn"
                      style={{
                        left: `${touchLayout.fire.x}%`,
                        top: `${touchLayout.fire.y}%`,
                        transform: `translate(-50%, -50%) scale(${touchLayout.fire.size})`,
                      }}
                      onClick={() => game.current?.throwUtility(false)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        game.current?.throwUtility(false);
                      }}
                    >
                      <span className="text-base leading-none">🎯</span>
                      <span>UZAĞA AT</span>
                    </button>

                    {/* YAKINA AT Button (stacked cleanly above UZAĞA AT, never overlapping KAY) */}
                    <button
                      type="button"
                      data-testid="ks-touch-throw-near"
                      className="ks-touch-btn-custom ks-touch-throw-near-btn"
                      style={{
                        left: `${touchLayout.fire.x}%`,
                        top: `${Math.max(46, touchLayout.fire.y - 16)}%`,
                        transform: `translate(-50%, -50%) scale(${touchLayout.fire.size})`,
                      }}
                      onClick={() => game.current?.throwUtility(true)}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        game.current?.throwUtility(true);
                      }}
                    >
                      <span className="text-base leading-none">🤏</span>
                      <span>YAKINA AT</span>
                    </button>
                  </div>
                )}

                {/* Zıpla (Jump) Button */}
                <button
                  type="button"
                  aria-label="Zıpla"
                  className="ks-touch-btn-custom ks-touch-jump-btn"
                  style={{
                    left: `${touchLayout.jump.x}%`,
                    top: `${touchLayout.jump.y}%`,
                    transform: `translate(-50%, -50%) scale(${touchLayout.jump.size})`,
                    opacity: touchLayout.jump.opacity,
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    game.current?.setTouchJump(true);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    game.current?.setTouchJump(false);
                  }}
                  onTouchCancel={() => game.current?.setTouchJump(false)}
                >
                  <span className="text-base leading-none">🦘</span>
                  <span>ZIPLA</span>
                </button>

                {/* Çömel / Kay (Crouch) Button */}
                <button
                  type="button"
                  className="ks-touch-btn-custom ks-touch-crouch-btn"
                  style={{
                    left: `${touchLayout.crouch.x}%`,
                    top: `${touchLayout.crouch.y}%`,
                    transform: `translate(-50%, -50%) scale(${touchLayout.crouch.size})`,
                    opacity: touchLayout.crouch.opacity,
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    game.current?.setTouchCrouch(true);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    game.current?.setTouchCrouch(false);
                  }}
                  onTouchCancel={() => game.current?.setTouchCrouch(false)}
                >
                  <span className="text-base leading-none">🔻</span>
                  <span>KAY</span>
                </button>

                {/* Silahı İncele (Inspect) Button */}
                {!touchCombat.showGrenadeThrowButtons && (
                  <button
                    type="button"
                    className="ks-touch-btn-custom ks-touch-inspect-btn"
                    style={{
                      left: `${touchLayout.inspect.x}%`,
                      top: `${touchLayout.inspect.y}%`,
                      transform: `translate(-50%, -50%) scale(${touchLayout.inspect.size})`,
                      opacity: touchLayout.inspect.opacity,
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      game.current?.triggerInspect();
                    }}
                  >
                    <span className="text-base leading-none">👁️</span>
                    <span>İNCELE</span>
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* KILL FEED */}
      {view === "play" && killFeed.length > 0 && (
        <div className="ks-killfeed" aria-live="polite">
          {killFeed.map((k) => (
            <div key={k.id} className="ks-kill-item">
              <span className={`ks-kill-killer ${k.killerTeam || ""}`}>
                {k.killerName}
              </span>
              {!k.id.startsWith("connection-") && <span className="ks-kill-weapon">
                ⚡ {k.utility === "frag" ? "El bombası" : WEAPONS[k.weapon as WeaponId]?.name || k.weapon}
              </span>}
              {k.headshot && <span className="ks-kill-head">KAFA</span>}
              <span className={`ks-kill-victim ${k.victimTeam || ""}`}>
                {k.victimName}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* SCOREBOARD (TAB KEY) */}
      {view === "play" && (scoreboardOpen || hud?.scoreboardOpen) && currentRoom && (
        <div className="ks-scoreboard-overlay">
          <div className="ks-scoreboard-card">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-xl font-black text-amber-400">
                  {currentRoom.name}
                </h3>
                <span className="text-xs text-slate-400">
                  {MAPS[currentRoom.map]?.name} ·{" "}
                  {currentRoom.mode === "bomb" ? "Bomba Kurma" : currentRoom.mode !== "ffa" ? "Takım Savaşı (TDM)" : "Herkes Tek (FFA)"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono font-bold text-slate-300">
                  {hud?.ping !== undefined && hud.ping > 0
                    ? `${Math.round(hud.ping)} ms`
                    : hud?.networkSample?.status === "disconnected"
                    ? "bağlantı yok"
                    : hud?.networkSample?.status === "timeout"
                    ? "zaman aşımı"
                    : "ölçülüyor"}
                </span>
                <span className="text-xs block text-slate-500">TAB ile kapat</span>
              </div>
            </div>

            <table className="ks-score-table">
              <thead>
                <tr>
                  <th>Oyuncu</th>
                  <th>Takım</th>
                  <th>K / D</th>
                  <th>Hasar</th>
                  <th>Ses Seviyesi</th>
                  <th>Ping</th>
                </tr>
              </thead>
              <tbody>
                {currentRoom.players.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      p.team === "red"
                        ? "red-row"
                        : p.team === "blue"
                        ? "blue-row"
                        : ""
                    }
                  >
                    <td className="flex items-center gap-2">
                      <span
                        className={`ks-voice-indicator ${
                          speakingUsers.get(p.userId) ? "speaking" : ""
                        }`}
                      />
                      <span className="font-bold">
                        <UserProfileLink username={p.username} user={p} /> {p.userId === currentUserId ? "(Sen)" : ""}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`ks-badge ${
                          p.team === "red"
                            ? "bg-red-500/20 text-red-400"
                            : p.team === "blue"
                            ? "bg-blue-500/20 text-blue-400"
                            : "bg-slate-700 text-slate-300"
                        }`}
                      >
                        {p.team === "red"
                          ? "Kırmızı"
                          : p.team === "blue"
                          ? "Mavi"
                          : "FFA"}
                      </span>
                    </td>
                    <td className="font-mono">
                      {p.kills} / {p.deaths}
                    </td>
                    <td className="font-mono">{Math.round(p.damage)}</td>
                    <td>
                      {p.userId !== currentUserId && (
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.05"
                          value={playerVolumes[p.userId] ?? 1.0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPlayerVolumes((prev) => ({ ...prev, [p.userId]: val }));
                            voice.current?.setPlayerVolume(p.userId, val);
                          }}
                          className="w-20"
                        />
                      )}
                    </td>
                    <td className="font-mono text-xs text-slate-400">
                      {p.userId === currentUserId && hud?.ping !== undefined && hud.ping > 0
                        ? `${Math.round(hud.ping)} ms`
                        : p.ping && p.ping > 0
                        ? `${Math.round(p.ping)} ms`
                        : "ölçülüyor"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IN-GAME HUD */}
      {view === "play" && hud && (
        <div className="ks-hud" aria-live="off">
          <div className="ks-top" style={(currentRoom?.mode==='bomb' || isMobile)?{visibility:'hidden'}:undefined}>
            <div>
              <strong><span className="text-slate-100">KAPS</span><span className="text-amber-400">STRIKE</span> 3D</strong>
              <span>
                {MAPS[map]?.name || map} ·{" "}
                {hud.isMultiplayer
                  ? currentRoom?.mode !== "ffa"
                    ? "TAKIM SAVAŞI (TDM)"
                    : "HERKES TEK (FFA)"
                  : "ANTRENMAN"}
              </span>
            </div>
            <div>
              {hud.isMultiplayer && currentRoom?.mode !== "ffa" ? (
                <div className="flex items-center gap-3">
                  <span className="text-red-400 font-black text-lg">
                    {hud.redScore ?? 0}
                  </span>
                  <b className="text-amber-400">
                    {Math.floor((hud.timeLeft ?? 0) / 60)}:
                    {String(Math.floor(hud.timeLeft ?? 0) % 60).padStart(2, "0")}
                  </b>
                  <span className="text-blue-400 font-black text-lg">
                    {hud.blueScore ?? 0}
                  </span>
                </div>
              ) : (
                <b>
                  {Math.floor(hud.seconds / 60)}:
                  {String(Math.floor(hud.seconds) % 60).padStart(2, "0")}
                </b>
              )}
              <span>
                {hud.score} skor · {Math.round(hud.dps)} DPS ·{" "}
                {Math.round(hud.damage)} hasar
              </span>
              {!hud.isMultiplayer && (
                <button
                  type="button"
                  onClick={() => game.current?.triggerDemoBomb()}
                  className="mt-1 px-2.5 py-1 rounded bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold border border-red-400/50 shadow pointer-events-auto"
                >
                  💣 [7] C4 Kur & Patlat (Test)
                </button>
              )}
            </div>
          </div>

          <div className="ks-crosshair">
            <i />
            <i />
            {hud.hit && hud.hit.until > hud.tick && (
              <span className={hud.hit.head ? "head" : ""}>
                ✕
                <b>
                  {hud.hit.head ? "KAFA · " : ""}
                  {Math.round(hud.hit.damage)}
                </b>
              </span>
            )}
          </div>

          <div className="ks-bottom">
            <div className="ks-health">
              <small>CAN {hud.protection > 0 ? "· KORUMA" : ""}</small>
              <strong>
                {Math.ceil(hud.hp)} <span>/ 100</span>
              </strong>
              <meter min={0} max={100} value={hud.hp} aria-label="Can" />
              <div className="ks-shield"><small>ZIRH · {Math.ceil(hud.armor||0)} / 100</small><meter min={0} max={100} value={hud.armor||0} aria-label="Zırh"/></div>
              <span>
                {hud.speed.toFixed(1)} m/s ·{" "}
                {hud.stance === "slide"
                  ? "KAYMA"
                  : hud.stance === "crouch"
                  ? "ÇÖMELME"
                  : "AYAKTA"}
              </span>
            </div>
            {!isMobile && (
              <div className="ks-ammo">
                <small>{hud.utilityEquipped?GRENADE_NAMES[hud.utilityEquipped]:hud.bombEquipped?"BOMBA · G ile bırak":WEAPONS[hud.weapon]?.name}</small>
                <strong>
                  {hud.utilityEquipped ? hud.utilityCount : hud.weapon === "knife" ? "∞" : <>{hud.ammo} <span>/ {hud.capacity}</span></>}
                </strong>
                <span>
                  {hud.utilityEquipped ? "Sol tık · At | Sağ tık · Yakına at" : hud.reload > 0
                    ? `ŞARJÖR · ${hud.reload.toFixed(1)} sn`
                    : `${label(settings.bindings?.reload||'KeyR')} · Yenile | ${label(settings.bindings?.inspect||'KeyF')} · İncele | ${label(settings.bindings?.interact||'KeyE')} · Al`}
                </span>
              </div>
            )}
          </div>

          {(!isMobile || settings.showDebugStats) && (
            <div className="ks-perf">
              {Math.round(hud.fps)} FPS · {hud.drawCalls} çizim ·{" "}
              {hud.activeMeshes}/{hud.meshes} mesh ·{" "}
              {hud.isMultiplayer
                ? `Multiplayer (${hud.remotePlayerCount || 0} oyuncu) · Ping: ${
                    hud.ping !== undefined && hud.ping > 0
                      ? `${Math.round(hud.ping)} ms`
                      : hud.networkSample?.status === "disconnected"
                      ? "bağlantı yok"
                      : hud.networkSample?.status === "timeout"
                      ? "zaman aşımı"
                      : "ölçülüyor"
                  } · TAB Skor`
                : "Yerel antrenman"}
              {settings.showDebugStats && hud.networkSample && (
                <span>
                  {" · Endpoint: "}{(socket?.io as unknown as { uri?: string } | undefined)?.uri || (typeof window !== "undefined" ? window.location.origin : "unknown")}
                  {" · Transport: "}{hud.networkSample.transport}
                  {" · Ham RTT: "}{hud.networkSample.rawRttMs !== undefined ? `${hud.networkSample.rawRttMs} ms` : "—"}
                  {" · Filtreli RTT: "}{hud.networkSample.filteredRttMs !== undefined ? `${hud.networkSample.filteredRttMs} ms` : "—"}
                  {" · Son örnek: "}{hud.networkSample.lastSampleAgeMs !== undefined ? `${hud.networkSample.lastSampleAgeMs} ms önce` : "yok"}
                  {" · Timeout: "}{hud.networkSample.timeoutCount}
                  {" · Kare aralığı (maks.): "}{hud.networkSample.frameGapMaxMs} ms
                  {hud.networkSample.serverLoopMaxMs !== undefined &&
                    ` · Sunucu döngü (p95/maks.): ${hud.networkSample.serverLoopP95Ms ?? 0}/${hud.networkSample.serverLoopMaxMs} ms`}
                  {hud.networkSample.serverTickP95Ms !== undefined &&
                    ` · Tick (p95): ${hud.networkSample.serverTickP95Ms} ms`}
                  {hud.networkSample.serverCpuPercent !== undefined &&
                    ` · Sunucu CPU: %${hud.networkSample.serverCpuPercent}`}
                </span>
              )}
              {" · ESC Menü"}
            </div>
          )}

          {hud.dead && currentRoom?.mode==='bomb' && <div className="ks-bomb-spectator" role="group" aria-label="Takım arkadaşını izle">
            <b role="status">{hud.spectating?`İzleniyor: ${hud.spectating} (${hud.spectatorNumber}/${hud.spectatorCount})`:'İzlenebilecek yaşayan takım arkadaşın yok.'}</b>
            <span>Yalnızca kendi takımını izleyebilirsin. Yeni turda yeniden doğacaksın.</span>
            {!!hud.spectating&&<><div className="ks-spectator-buttons">
              <button disabled={(hud.spectatorCount||0)<2} onClick={()=>game.current?.cycleSpectator(-1)}>Önceki takım arkadaşı</button>
              <button disabled={(hud.spectatorCount||0)<2} onClick={()=>game.current?.cycleSpectator(1)}>Sonraki takım arkadaşı</button>
            </div>{!isMobile&&<span>← / → · Sol / sağ tık · Fare tekerleği</span>}</>}
          </div>}
          {(!currentInputDevice().phone||currentRoom?.mode==='bomb') && <StrikeMinimap map={MAPS[currentRoom?.map||map]} hud={hud}/>}
          {hud.ads && !hud.dead && (hud.weapon==='sniper'||hud.weapon==='railgun') && <div className="ks-scope" aria-label="Dürbün açık"><div className="ks-scope-lens"><i/><b/><span>{hud.weapon==='railgun'?'5×':'3.5×'} / UFUK OPTICS</span></div></div>}
          {hud.lootNotice&&!hud.dead&&<div className="ks-loot-notice" role="status">{hud.lootNotice}</div>}
          {hud.supplyPrompt && !hud.dead && <button className="ks-supply-prompt" onClick={()=>game.current?.interact()}>{isMobile?'Dokun':label(settings.bindings?.interact||'KeyE')} · {hud.supplyPrompt}</button>}
          {(currentRoom?.map||map)!=='bolluca' && (currentRoom?.map||map)!=='bollucav2' && (currentRoom?.map||map)!=='dust2v2' && hud.world?.drop && <div className="ks-drop-warning" role="status">İKMAL UÇAĞI YAKLAŞIYOR · {Math.max(0,Math.ceil((hud.world.drop.landing-hud.tick)/120))} sn<br/><small>Kırmızı dumanı takip et · 3 özel silahtan biri</small></div>}
          <StrikeDamageFeedback hp={hud.hp} dead={hud.dead} tick={hud.tick} hurt={hud.hurt}/>
          {hud.hp > 0 && hud.hp <= 25 && <span className="ks-low-health" role="status">KRİTİK CAN</span>}
          {hud.hurt && hud.hurt.until > hud.tick && (
            <div
              className="ks-hurt"
              style={{ transform: `rotate(${hud.hurt.direction}rad)` }}
            >
              ▲
            </div>
          )}

          {hud.dead && currentRoom?.mode!=='bomb' && (
            <div className="ks-death">
              <h2>Yeniden hazırlan.</h2>
              <p>{hud.respawn.toFixed(1)} saniye sonra doğacaksın.</p>
              <span>{hud.isMultiplayer ? "Güvenli doğma koruması devrede." : "ESC ile duraklatabilirsin."}</span>
            </div>
          )}
        </div>
      )}

      {/* MATCH END MODAL */}
      {view === "match_end" && matchStats && (
        <div className="ks-match-end-overlay">
          <div className="ks-match-end-card">
            <div className="ks-winner-title">
              {matchStats.winnerTeam === "none" ? "BERABERE!" : matchStats.winnerTeam === "red"
                ? "KIRMIZI TAKIM KAZANDI!"
                : matchStats.winnerTeam === "blue"
                ? "MAVİ TAKIM KAZANDI!"
                : `${matchStats.winnerName || "ŞAMPİYON"} KAZANDI!`}
            </div>
            <p className="text-slate-300 mb-6">
              Maç tamamlandı. Aşağıda bu maçın istatistikleri gösteriliyor.
            </p>

            {matchStats.mvp && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-6 inline-block">
                <span className="text-xs uppercase font-bold text-amber-400 block">
                  Maçın En Değerli Oyuncusu (MVP)
                </span>
                <span className="text-lg font-black text-amber-200">
                  👑 <UserProfileLink username={matchStats.mvp.username} user={matchStats.mvp} /> ({matchStats.mvp.kills} Öldürme ·{" "}
                  {Math.round(matchStats.mvp.damage)} Hasar)
                </span>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                className="ks-primary"
                onClick={() => {
                  setView("lobby");
                  setMatchStats(null);
                }}
              >
                Lobiye Dön
              </button>
              <button onClick={exit}>Ana Menü</button>
            </div>
          </div>
        </div>
      )}

      {view === "lobby" && error && currentRoom?.status === "in_progress" && (
        <button className="ks-retry" onClick={() => startMultiplayerGame(currentRoom)}>Maça yeniden bağlan</button>
      )}
      {/* ROOM LOBBY VIEW */}
      {view === "lobby" && currentRoom && (
        <div className="ks-overlay" inert={!!panel}>
          <div className="ks-menu">
            <div className="ks-lobby-container">
              <div className="ks-lobby-header">
                <div>
                  <div className="ks-eyebrow">KAPSSTRIKE · ODA LOBİSİ</div>
                  <h1 style={{ fontSize: "36px", margin: "4px 0" }}>
                    {currentRoom.name}
                  </h1>
                  <span className="text-xs text-slate-400">
                    Harita: <b>{MAPS[currentRoom.map]?.name}</b> · Mod:{" "}
                    <b>{currentRoom.mode === "bomb" ? "Bomba Kurma" : currentRoom.mode !== "ffa" ? "Takım Savaşı" : "Herkes Tek"}</b> · {currentRoom.mode === "bomb" ? "Hedef: " : "Süre: "}
                    <b>{currentRoom.mode === "bomb" ? `İlk ${currentRoom.bombRounds ?? 7} galibiyet` : `${Math.round(currentRoom.timeLimit / 60)} dk`}</b>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="ks-lobby-code" title="Oda Kodu">
                    {currentRoom.roomCode}
                  </div>
                  <button onClick={handleCopyInvite}>
                    {inviteCopied ? "✓ Kopyalandı!" : "👥 Davet Et"}
                  </button>
                  <button onClick={exit}>Ayrıl</button>
                </div>
              </div>

              <div className="ks-feature-shortcuts ks-lobby-shortcuts" aria-label="Oyun ayarları">
                <button type="button" onClick={() => setPanel("input")}>Mobil Kontroller / Jiroskop</button>
                <button type="button" onClick={() => setPanel("touch_layout")}>🎮 Tuş Düzeni (PUBG)</button>
                <button type="button" onClick={() => setPanel("inventory")}>Envanter / Kasalar</button><button type="button" onClick={() => setPanel("skins")}>Karakter / Skin</button>
                <button type="button" onClick={() => setPanel("controls")}>Kontroller</button>
              </div>

              {/* TDM TEAMS OR FFA LIST */}
              {currentRoom.mode !== "ffa" ? (
                <div className="ks-teams-grid">
                  <div className="ks-team-col red">
                    <div className="ks-team-header red">
                      <span>{currentRoom.mode==='bomb'?'T · SALDIRI':'KIRMIZI TAKIM'} ({currentRoom.players.filter((p) => p.team === "red").length})</span>
                      <button
                        onClick={() => switchTeam("red")}
                        style={{ padding: "4px 10px", minHeight: "auto", fontSize: "11px" }}
                      >
                        {currentRoom.mode==='bomb'?'T · Saldırı':'Kırmızıya Geç'}
                      </button>
                    </div>
                    {currentRoom.players
                      .filter((p) => p.team === "red")
                      .map((p) => (
                        <div key={p.id} className="ks-player-item">
                          <div className="ks-player-info">
                            <span className="font-bold text-red-400">
                              <UserProfileLink username={p.username} user={p} /> {p.userId === currentUserId ? "(Sen)" : ""}
                            </span>
                            {p.userId === currentRoom.hostId && (
                              <span className="text-amber-400 text-xs font-bold">👑 Host</span>
                            )}
                          </div>
                          <span className={p.ready ? "text-emerald-400 text-xs font-bold" : "text-slate-500 text-xs"}>
                            {p.ready ? "✓ HAZIR" : "BEKLİYOR"}
                          </span>
                        </div>
                      ))}
                  </div>

                  <div className="ks-team-col blue">
                    <div className="ks-team-header blue">
                      <span>{currentRoom.mode==='bomb'?'CT · SAVUNMA':'MAVİ TAKIM'} ({currentRoom.players.filter((p) => p.team === "blue").length})</span>
                      <button
                        onClick={() => switchTeam("blue")}
                        style={{ padding: "4px 10px", minHeight: "auto", fontSize: "11px" }}
                      >
                        {currentRoom.mode==='bomb'?'CT · Savunma':'Maviye Geç'}
                      </button>
                    </div>
                    {currentRoom.players
                      .filter((p) => p.team === "blue")
                      .map((p) => (
                        <div key={p.id} className="ks-player-item">
                          <div className="ks-player-info">
                            <span className="font-bold text-blue-400">
                              <UserProfileLink username={p.username} user={p} /> {p.userId === currentUserId ? "(Sen)" : ""}
                            </span>
                            {p.userId === currentRoom.hostId && (
                              <span className="text-amber-400 text-xs font-bold">👑 Host</span>
                            )}
                          </div>
                          <span className={p.ready ? "text-emerald-400 text-xs font-bold" : "text-slate-500 text-xs"}>
                            {p.ready ? "✓ HAZIR" : "BEKLİYOR"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-amber-400 text-sm">
                      OYUNCULAR ({currentRoom.players.length}/{currentRoom.maxPlayers})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentRoom.players.map((p) => (
                      <div key={p.id} className="ks-player-item">
                        <div className="ks-player-info">
                          <span className="font-bold">
                            <UserProfileLink username={p.username} user={p} /> {p.userId === currentUserId ? "(Sen)" : ""}
                          </span>
                          {p.userId === currentRoom.hostId && (
                            <span className="text-amber-400 text-xs font-bold">👑 Host</span>
                          )}
                        </div>
                        <span className={p.ready ? "text-emerald-400 text-xs font-bold" : "text-slate-500 text-xs"}>
                          {p.ready ? "✓ HAZIR" : "BEKLİYOR"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LOBBY CONTROLS */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800 flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleReady}
                    className={
                      currentRoom.players.find((p) => p.userId === currentUserId)?.ready
                        ? "ks-primary"
                        : ""
                    }
                  >
                    {currentRoom.players.find((p) => p.userId === currentUserId)?.ready
                      ? "✓ HAZIR (İptal)"
                      : "HAZIR OL"}
                  </button>
                  <button onClick={toggleVoice}>
                    {isVoiceMuted ? "🎤 Mikrofonu Aç" : "🎙️ Mikrofon Açık"}
                  </button>
                </div>

                {isHost && (
                  <button
                    className="ks-btn-quick"
                    onClick={startMatchAsHost}
                    disabled={currentRoom.players.length < 1 || isStartingMatch}
                  >
                    {isStartingMatch ? "⏳ BAŞLATILIYOR…" : "⚡ MAÇI BAŞLAT"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN MENU & BROWSER */}
      {view === "menu" && (
        <div className="ks-overlay ks-home-overlay" inert={!!panel&&panel!=="create_room"}>
          <div className="ks-menu ks-home">
            <header className="flex flex-col items-center text-center">
              <div className="ks-eyebrow">KAPSAPP · RESMİ 3D MULTIPLAYER FPS</div>
              
              {/* Small theme logo */}
              <div className="my-1.5 flex justify-center items-center">
                {/* Light theme: Black logo */}
                <img
                  src="/assets/aistudio/KS_GO_Tactical_Soldier_Logo_206d63af.png"
                  alt="KapsStrike Tactical Logo"
                  className="h-10 sm:h-12 max-w-full object-contain dark:hidden opacity-90"
                />
                {/* Dark theme: Yellow logo */}
                <img
                  src="/assets/aistudio/ChatGPT_Image_Oct_29__2026__06_27_13_PM_065d4212.png"
                  alt="KapsStrike Tactical Logo"
                  className="h-10 sm:h-12 max-w-full object-contain hidden dark:block filter drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]"
                />
              </div>

              {/* Large KAPSSTRIKE title with KAPS and STRIKE in distinct colors */}
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight my-1 uppercase">
                <span className="text-slate-900 dark:text-slate-100">KAPS</span>
                <span className="text-amber-500 dark:text-amber-400">STRIKE</span>
              </h1>

              <p>
                Üç farklı bölge. Tek bir hedef. Takımını kur, sokağa çık ve maça katıl.
              </p>

              {/* TABS: Multiplayer vs Training */}
              <div className="ks-mp-tabs">
                <button
                  type="button"
                  className={`ks-mp-tab ${modeTab === "multiplayer" ? "active" : ""}`}
                  onClick={() => {setPanel(null);setModeTab("multiplayer");}}
                >
                  🎯 Çok Oyunculu (Multiplayer)
                </button>
                <button
                  type="button"
                  className={`ks-mp-tab ${modeTab === "training" ? "active" : ""}`}
                  onClick={() => {setPanel(null);setModeTab("training");}}
                >
                  🏹 Tek Oyunculu Antrenman (Offline)
                </button>
              </div>
              <div className="ks-feature-shortcuts" aria-label="Oyun özelleştirmeleri">
                <button type="button" onClick={() => setPanel("inventory")}>Envanter / Kasalar</button><button type="button" onClick={() => setPanel("skins")}>Karakterini seç</button>
                <button type="button" onClick={() => setPanel("controls")}>Kontrolleri düzenle</button>
                <button type="button" onClick={() => setPanel("input")}>Mobil Kontroller / Jiroskop</button>
                <button type="button" onClick={() => setPanel("touch_layout")}>🎮 Tuş Düzeni (PUBG)</button>
              </div>
              <p className="ks-visibility-note">Rakiplerde ince kırmızı hat; özgün karakter görünümleri korunur.</p>
            </header>

            {error && (
              <p className="ks-error" role="alert">
                {error}
              </p>
            )}

            {!supported && (
              <p className="ks-error">
                Bu oyun WebGL destekli modern bir tarayıcı gerektiriyor.
              </p>
            )}

            {/* MULTIPLAYER SECTION */}
            {modeTab === "multiplayer" && !panel && (
              <>
                <div className="ks-mp-actions">
                  <button className="ks-btn-quick" onClick={handleQuickMatch} disabled={actionBusy || !socketConnected}>
                    {actionBusy ? "⏳ Bağlanıyor…" : "⚡ Hızlı Maç Bul"}
                  </button>
                  <button
                    onClick={() => { setCreateCategory(null); setError(""); setPanel("create_room"); }}
                    className="ks-primary"
                    disabled={actionBusy || !socketConnected}
                  >
                    + Masa aç
                  </button>
                  <form onSubmit={handleJoinByCode} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Oda kodu"
                      maxLength={32}
                      value={joinCodeInput}
                      onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                      className="ks-filter-input"
                      style={{ width: "120px", minWidth: "100px", textTransform: "uppercase" }}
                    />
                    <button type="submit" disabled={actionBusy || !socketConnected || joinCodeInput.trim().length < 4}>
                      Koda Katıl
                    </button>
                  </form>
                </div>

                <div className="ks-rooms-header">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-300">
                      Aktif Odalar ({filteredRooms.length})
                    </span>
                    <button
                      onClick={refreshRooms}
                      style={{ padding: "4px 8px", minHeight: "auto", fontSize: "12px" }}
                    >
                      🔄 Yenile
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Oda ara..."
                      value={roomFilter}
                      onChange={(e) => setRoomFilter(e.target.value)}
                      className="ks-filter-input"
                    />
                    <select
                      value={roomModeFilter}
                      onChange={(e) => setRoomModeFilter(e.target.value as any)}
                      className="ks-filter-select"
                    >
                      <option value="all">Tüm Modlar</option>
                      <option value="bomb">Bomba Kurma (T / CT)</option><option value="tdm">Takım Savaşı (TDM)</option>
                      <option value="ffa">Herkes Tek (FFA)</option>
                    </select>
                  </div>
                </div>

                <div className="ks-rooms-grid">
                  {filteredRooms.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
                      Şu an açık oda yok. Hemen "Oda Oluştur" veya "Hızlı Maç" ile oyunu başlat!
                    </div>
                  ) : (
                    filteredRooms.map((r) => (
                      <div key={r.id} className="ks-room-card">
                        <div>
                          <div className="ks-room-top">
                            <span className="ks-room-title">{r.name}</span>
                            <span
                              className={`ks-badge ${
                                r.status === "in_progress"
                                  ? "ks-badge-playing"
                                  : "ks-badge-waiting"
                              }`}
                            >
                              {r.status === "in_progress" ? "Savaşta" : "Lobi"}
                            </span>
                          </div>
                          <div className="ks-room-meta mt-2">
                            <span>🗺️ {MAPS[r.map]?.name}</span>
                            <span
                              className={`ks-badge ${
                                r.mode === "tdm" ? "ks-badge-tdm" : "ks-badge-ffa"
                              }`}
                            >
                              {r.mode === "bomb" ? "BOMBA" : r.mode === "tdm" ? "TDM" : "FFA"}
                            </span>
                            <span>
                              👥 {r.playerCount}/{r.maxPlayers}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                          <span className="text-xs text-slate-500">
                            Host: {r.hostName} {r.hasPassword ? "🔒" : ""}
                          </span>
                          <button
                            onClick={() => handleJoinRoom(r.roomCode, r.hasPassword)}
                            disabled={actionBusy || !socketConnected || r.playerCount >= r.maxPlayers}
                            style={{ padding: "6px 14px", minHeight: "auto", fontSize: "12px" }}
                          >
                            {r.hasPassword ? "Şifreyle Gir" : "Katıl"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* PASSWORD MODAL */}
            {passwordModalRoomId && (
              <div className="ks-settings">
                <h2>Oda Şifresi Gerekiyor</h2>
                <input
                  type="password"
                  placeholder="Şifreyi giriniz"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="ks-filter-input"
                  autoFocus
                />
                <div className="flex gap-2 mt-4">
                  <button className="ks-primary" onClick={handleJoinWithPassword}>
                    Onayla ve Gir
                  </button>
                  <button
                    onClick={() => {
                      setPasswordModalRoomId(null);
                      setPasswordInput("");
                    }}
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}

            {/* CREATE ROOM PANEL */}
            {panel === "create_room" && (
              <form onSubmit={handleCreateRoom} className="ks-room-builder">
                <header>
                  <div><h2>Masa aç</h2><p>Modu seç, ardından aynı ekranda masanın kurallarını belirle.</p></div>
                  <button type="button" onClick={() => { setPanel(null); setError(""); }}>İptal</button>
                </header>
                <div className="ks-room-mode-cards" aria-label="Oyun modu">
                  <button type="button" aria-pressed={createCategory === "bomb"} onClick={() => setCreateCategory("bomb")}>
                    <small>TAKTİK · T / CT</small><strong>Bomba Kurma</strong><span>Dust II, Dust II V2 veya Bolluca’da bomba bölgelerini savun ya da ele geçir.</span>
                  </button>
                  <button type="button" aria-pressed={createCategory === "kill"} onClick={() => setCreateCategory("kill")}>
                    <small>HIZLI MAÇ · FFA / TDM</small><strong>Kill Yarışı</strong><span>Haritayı seç ve süre dolmadan skor hedefine ulaş.</span>
                  </button>
                </div>
                {createCategory && <>
                  <div className="ks-room-builder-fields">
                    <label>Masa adı<input required maxLength={32} value={createName} onChange={e => setCreateName(e.target.value)} /></label>
                    <label>Oyuncu sınırı<select value={createMaxPlayers} onChange={e => setCreateMaxPlayers(Number(e.target.value))}>
                      {Array.from({ length: 9 }, (_, i) => i + 2).map(count => <option key={count} value={count}>{count} oyuncu</option>)}
                    </select></label>
                    {createCategory === "bomb" ? <>
                      <label>Harita<select aria-label="Harita" value={createBombMap} onChange={e => setCreateBombMap(e.target.value as MapId)}>
                        {BOMB_MAPS.map(m => <option key={m.id} value={m.id}>{m.name.split(" · ")[0]}</option>)}
                      </select></label>
                      <label>Kazanmak için gereken raund<select value={createBombRounds} onChange={e => setCreateBombRounds(Number(e.target.value))}>
                        {BOMB_WIN_TARGETS.map(target => <option key={target} value={target}>İlk {target} galibiyet</option>)}
                      </select></label>
                    </> : <>
                      <label>Harita<select aria-label="Harita" value={createMap} onChange={e => setCreateMap(e.target.value as MapId)}>
                        {Object.values(MAPS).filter(m => !m.bombSites).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select></label>
                      <label>Takım düzeni<select value={createMode} onChange={e => setCreateMode(e.target.value === "ffa" ? "ffa" : "tdm")}>
                        <option value="tdm">Takım savaşı</option><option value="ffa">Herkes tek</option>
                      </select></label>
                      <label>Maç süresi<select value={createDuration} onChange={e => setCreateDuration(Number(e.target.value))}>
                        {[3, 5, 10, 15].map(minutes => <option key={minutes} value={minutes * 60}>{minutes} dakika</option>)}
                      </select></label>
                      <label>Skor hedefi<select value={createScoreLimit} onChange={e => setCreateScoreLimit(Number(e.target.value))}>
                        {[10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map(score => <option key={score} value={score}>{score} skor</option>)}
                      </select></label>
                    </>}
                    <label>Masa şifresi <input type="password" placeholder="İsteğe bağlı" value={createPassword} onChange={e => setCreatePassword(e.target.value)} /></label>
                  </div>
                  <button type="submit" className="ks-primary" disabled={actionBusy || !socketConnected}>
                    {actionBusy ? "Masa oluşturuluyor…" : "Masayı oluştur"}
                  </button>
                </>}
              </form>
            )}

            {/* TRAINING SECTION */}
            {modeTab === "training" && !panel && (
              <>
                <div className="ks-maps">
                  {Object.values(MAPS).filter(m => m.id !== "bolluca").map((m) => (
                    <button
                      key={m.id}
                      className={map === m.id ? "selected" : ""}
                      onClick={() => setMap(m.id)}
                    >
                      <span className={`ks-map-art ${m.id}`}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <b>{m.name}</b>
                      <small>{m.subtitle}</small>
                    </button>
                  ))}
                </div>
                <label className="ks-check">
                  <input
                    type="checkbox"
                    checked={returnFire}
                    onChange={(e) => setReturnFire(e.target.checked)}
                  />{" "}
                  Kuklalar karşı ateş açsın · canlandırma ve yönsel hasar antrenmanı
                </label>
                <p className="ks-hint">
                  Turuncu kuklaları vur. Kırmızı zemin tehlike bölgesidir. Kuklalar 3 saniye sonra geri gelir.
                </p>
                <button
                  className="ks-primary"
                  disabled={!supported}
                  onClick={startTraining}
                >
                  Antrenmanı Başlat
                </button>
              </>
            )}

            {/* SETTINGS PANEL */}

            <footer>
              {inventoryAdmin&&<button onClick={()=>setPanel('inventory_admin')}>KapsStrike yönetimi</button>}
              <button onClick={() => setPanel("touch_layout")}>🎮 Tuş Düzeni</button>
              <button onClick={() => setPanel(panel === "skins" ? null : "skins")}>Karakter / Skin</button>
              <button
                onClick={() =>
                  setPanel(panel === "settings" ? null : "settings")
                }
              >
                Ayarlar
              </button>
              <button
                onClick={() =>
                  setPanel(panel === "controls" ? null : "controls")
                }
              >
                Kontroller
              </button>
              {canFullscreen && <button type="button" onClick={() => void toggleFullscreen()}>{fullscreenLabel}</button>}
              <button
                onClick={() => {
                  exit();
                  onBack();
                }}
              >
                Oyundan çık
              </button>
            </footer>
          </div>
        </div>
      )}

      {currentRoom?.mode==='bomb'&&view==='play'&&<StrikeBombHUD utility={hud?.utilityEquipped} onSelectUtility={item=>game.current?.selectUtility(item)} onThrowUtility={short=>game.current?.throwUtility(short)} touch={isMobile} onEquipBomb={()=>game.current?.equipBomb()} socket={socket} players={currentRoom.players} interactKey={settings.bindings?.interact||"KeyE"} onShopChange={open=>game.current?.setMenuOverlay(open)}/>}
      {/* Pause has one clear primary action; detailed settings live in dismissible panels. */}
      {view === "pause" && !panel && (
        <div className="ks-overlay ks-pause-overlay"><div className="ks-menu ks-pause-card">
          <div className="ks-eyebrow">KAPSSTRIKE / MENÜ</div><h2>Kısa bir mola.</h2>
          <p>{game.current?.isMultiplayer?"Maç devam ediyor. Hazır olduğunda geri dön.":"Antrenman duraklatıldı."}</p>
          <button className="ks-primary ks-resume" onClick={()=>{setPanel(null);resume();}}>▶ Oyuna Devam Et</button>
          <nav className="ks-pause-options" aria-label="Duraklatma seçenekleri">
            <button aria-label="Görüntü ve ses" onClick={()=>setPanel('settings')}>Görüntü ve ses<small>Kalite, FOV, ses düzeyleri</small></button>
            <button aria-label="Kontroller" onClick={()=>setPanel('controls')}>Kontroller<small>Tuş atamaları ve silah inceleme</small></button>
            <button onClick={()=>setPanel('input')}>Mobil Kontroller / Jiroskop<small>Dokunma, hassasiyet ve sensör</small></button>
            <button onClick={()=>setPanel('touch_layout')}>🎮 PUBG Tuş Düzeni<small>Tuşları ekranda serbestçe taşı & boyutlandır</small></button>
            <button onClick={()=>setPanel('inventory')}>Envanter / Kasalar<small>Kaplamalarını seç</small></button>{!isBombRoom&&<button onClick={()=>setPanel('weapons')}>Silah düzeni · B<small>Gizle veya geri al</small></button>}<button aria-label="Karakter" onClick={()=>setPanel('skins')}>Karakter<small>Görünümünü seç</small></button>
          </nav>
          <button className="ks-mic-toggle" onClick={toggleVoice}>{isVoiceMuted?'Mikrofonu aç':'Mikrofonu sustur'}</button>
          <button className="ks-leave" onClick={()=>{setPanel(null);exit();}}>Menüye / Lobiye Dön</button>
        </div></div>
      )}
      {panel && panel !== 'create_room' && panel !== 'touch_layout' && ['menu','lobby','pause'].includes(view) && (
        <div className="ks-overlay ks-feature-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null);}}>
          <div className="ks-menu ks-feature-card" role="dialog" aria-modal="true" aria-label={{weapons:'Silah düzeni',inventory_admin:'Yönetici envanteri',inventory:'Envanter ve kasalar',skins:'Karakter seçimi',controls:'Kontroller',settings:'Görüntü ve ses',input:'Mobil kontroller'}[panel]}>
            <div className="ks-panel-bar"><span>KAPSSTRIKE / {{weapons:'SİLAH DÜZENİ',inventory_admin:'YÖNETİM',inventory:'ENVANTER',skins:'KARAKTER',controls:'KONTROLLER',settings:'AYARLAR',input:'MOBİL KONTROLLER'}[panel]}</span><button autoFocus onClick={()=>setPanel(null)} aria-label="Paneli kapat">Geri dön <span aria-hidden="true">×</span></button></div>
            <div className="ks-panel-content">
              {panel==='weapons'&&<div><h2>Kill Yarışı · Silah düzeni</h2><p>Gizlenen silahlar tekerlek ve hızlı seçimde atlanır. Eşyaların silinmez; istediğin zaman geri alabilirsin. Bıçak her zaman kullanılabilir.</p><div className="ks-loadout-grid">{WEAPON_ORDER.filter(w=>w!=='knife').map(w=><button key={w} disabled={loadoutBusy} aria-pressed={!settings.hiddenWeapons?.includes(w)} onClick={()=>toggleWeapon(w)}><b>{WEAPONS[w].name}</b><span>{STARTER_WEAPONS.includes(w)?"Başlangıç silahı":"Ganimet silahı"}</span><small>{settings.hiddenWeapons?.includes(w)?'Gizli · Geri al':'Etkin · Gizle'}</small></button>)}</div><p role="status">{loadoutError||'Tercihler hesabına kaydedilir.'}</p></div>}
              {panel==='inventory'&&<StrikeInventory socket={socket} initialSkin={settings.selectedSkin} onSkin={skin=>setting({selectedSkin:skin})} onChange={state=>setting({cosmeticLoadout:state.equipped})}/>}
              {panel==='inventory_admin'&&<StrikeInventoryAdmin socket={socket}/>}
              {panel==='skins'&&<StrikeSkins socket={socket} initialSkin={settings.selectedSkin} onSaved={skin=>setting({selectedSkin:skin})}/>}
              {panel==='controls'&&<div className="ks-controls"><h2>Kontroller</h2><p>{label(settings.bindings?.inspect||'KeyF')} · Silahı incele. {label(settings.bindings?.interact||'KeyE')} · Sandığı aç / silahı al. {label(settings.bindings?.ads||'Mouse2')} · Nişan.</p><StrikeControls value={cleanBindings(settings.bindings)} onChange={bindings=>setting({bindings})}/></div>}
              {panel==='settings'&&<StrikeGraphicsSettings settings={settings} onChange={setting}/>}
              {panel==='input'&&<StrikeInputSettings settings={settings} onChange={setting} gyro={gyro} onOpenTouchCustomizer={()=>setPanel('touch_layout')}/>}
            </div>
            <button className="ks-primary ks-panel-done" onClick={()=>setPanel(null)}>Kaydet ve Dön</button>
          </div>
        </div>
      )}

      {/* PUBG-STYLE TOUCH CONTROLS CUSTOMIZER MODAL */}
      {panel === "touch_layout" && (
        <StrikeTouchCustomizer
          onClose={() => setPanel(null)}
          onSave={(newLayout) => {
            setTouchLayout(newLayout);
            setPanel(null);
          }}
        />
      )}

    </section>
  );
}
