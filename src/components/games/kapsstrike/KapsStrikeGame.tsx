import StrikeBombHUD from "./StrikeBombHUD";
import StrikeInventory from "./StrikeInventory";
import StrikeInventoryAdmin from "./StrikeInventoryAdmin";
import StrikeMinimap from './StrikeMinimap';
import StrikeGraphicsSettings from './StrikeGraphicsSettings';
import StrikeInputSettings from './StrikeInputSettings';
import {touchControls,currentInputDevice} from '../../../utils/gameInput';
import {useGameGyroscope} from '../../../hooks/useGameGyroscope';
import StrikeSkins from "./StrikeSkins";
import StrikeControls from "./StrikeControls";
import { cleanBindings } from "../../../games/kapsstrike/controls";
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
} from "../../../games/kapsstrike/config";
import {
  MapId,
  StrikeSettings,
  StrikeRoomSummary,
  StrikeRoomState,
  KillFeedEntry,
  MatchStats,
  StrikeTeam,
  StrikeGameMode,
  StrikeSnapshot,
  WeaponId,
} from "../../../games/kapsstrike/types";
import { MAPS } from "../../../games/kapsstrike/maps";
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
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<StrikeController | null>(null);
  const voice = useRef<StrikeVoiceManager | null>(null);

  const activeRoom = useRef<string | null>(null);
  const launch = useRef<(room: StrikeRoomState) => void>(() => {});
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [loadStage, setLoadStage] = useState("");

  // General state
  const [category,setCategory]=useState<"kill"|"bomb"|null>(null);
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
  const [panel, setPanel] = useState<"settings" | "controls" | "skins" | "inventory" | "inventory_admin" | "input" | "create_room" | null>(null);
  const [hud, setHUD] = useState<StrikeHUD | null>(null);
  const [error, setError] = useState("");
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
  const lookLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
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
  const updateCurrentRoom = useCallback((r: StrikeRoomState | null) => {
    currentRoomRef.current = r;
    setCurrentRoom(r);
  }, []);
  const [roomFilter, setRoomFilter] = useState("");
  const [roomModeFilter, setRoomModeFilter] = useState<"all" | "ffa" | "tdm" | "bomb">("all");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordModalRoomId, setPasswordModalRoomId] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Create Room Form
  const [createName, setCreateName] = useState(`${username}'in Odası`);
  const [createMap, setCreateMap] = useState<MapId>("warehouse");
  const [createMode, setCreateMode] = useState<StrikeGameMode>("tdm");
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

  // Mobile detection & Orientation check
  useEffect(() => {
    const checkMobile = () => {
      const mobile = touchControls(settings.controlMode);
      setIsMobile(mobile);
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    window.addEventListener("orientationchange", checkMobile);
    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("orientationchange", checkMobile);
    };
  }, [settings.controlMode]);

  // WebGL & PointerLock Check
  useEffect(() => {
    const c = document.createElement("canvas");
    const probe = c.getContext("webgl2") || c.getContext("webgl");
    setSupported(!!probe);
    probe?.getExtension("WEBGL_lose_context")?.loseContext();

    return () => {
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

  // Request room list (supports both strike:get_rooms and strike:list_rooms)
  const refreshRooms = useCallback(() => {
    if (!socket || !socket.connected) return;
    socket.emit("strike:get_rooms", (res: StrikeRoomSummary[]) => {
      if (Array.isArray(res)) setRooms(res);
    });
    socket.emit("strike:list_rooms", (res: StrikeRoomSummary[]) => {
      if (Array.isArray(res)) setRooms(res);
    });
  }, [socket]);

  // Handle socket rooms and events
  useEffect(() => {
    if (!socket) return;

    refreshRooms();
    const interval = setInterval(refreshRooms, 3000);

    let lastScoresAt=0;
    const onScores=(snapshot:StrikeSnapshot)=>{
      const room=currentRoomRef.current;
      if(!room || room.status!=="in_progress" || (snapshot.roomCode && snapshot.roomCode!==room.roomCode) || !Array.isArray(snapshot.players) || performance.now()-lastScoresAt<250)return;
      lastScoresAt=performance.now();
      updateCurrentRoom({...room,timeLeft:snapshot.timeLeft,teamScores:snapshot.teamScores || room.teamScores,players:room.players.map(player=>{
        const current=snapshot.players.find(p=>p.userId===player.userId);
        return current ? {...player,...current,isAlive:current.hp>0} : player;
      })});
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
        launch.current(data);
      }
    };

    const onMatchReset = (state: StrikeRoomState) => {
      updateCurrentRoom(state);
      activeRoom.current = null;
      clearTimeout(loadTimer.current);
      game.current?.dispose();
      game.current = null;
      setView("lobby");
    };

    const onKill = (kill: KillFeedEntry) => {
      setKillFeed((prev) => [kill, ...prev.filter(k => k.id !== kill.id)].slice(0, 6));
      setTimeout(() => {
        setKillFeed((prev) => prev.filter((k) => k.id !== kill.id));
      }, 5000);
    };

    const onMatchEnded = (payload: any) => {
      activeRoom.current = null;
      clearTimeout(loadTimer.current);
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
    socket.on("strike:error", onError);

    // Direct room join via targetRoomId prop
    if (targetRoomId) {
      socket.emit("strike:join_room", { roomCode: targetRoomId, roomId: targetRoomId, code: targetRoomId }, (res: any) => {
        if (res?.success && res.room) {
          updateCurrentRoom(res.room);
          if (res.room.status === "in_progress") {
            startMultiplayerGame(res.room);
          } else {
            setView("lobby");
          }
        }
      });
    }

    return () => {
      clearInterval(interval);
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
      socket.off("strike:error", onError);
    };
  }, [socket, currentUserId, targetRoomId, refreshRooms]);

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
  const startMultiplayerGame = (roomOrMap?: any) => {
    const code = roomOrMap?.roomCode || currentRoomRef.current?.roomCode;
    if (!code || activeRoom.current === code) return;
    activeRoom.current = code;
    setView("loading");
    setLoadStage("Harita yükleniyor…");
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      if (activeRoom.current !== code) return;
      activeRoom.current = null;
      game.current?.dispose();
      game.current = null;
      setView("lobby");
      setError("Oyun durumu 12 saniyede alınamadı. Bağlantını kontrol edip yeniden deneyebilirsin.");
    }, 12000);
    setPanel(null);
    setError("");
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

    const activeRoomCode = targetRoom?.roomCode;
    const myTeam: StrikeTeam =
      targetRoom?.players?.find((p) => p.userId === currentUserId)?.team || "none";

    try {
      game.current?.dispose();
      game.current = new StrikeController(
        canvas.current!,
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
          onLoadingStage: setLoadStage,
          onSynchronized: () => {
            clearTimeout(loadTimer.current);
            setView(game.current?.isTouchDevice ? "play" : "pause");
          },
          onScoreboardToggle: (open) => setScoreboardOpen(open),
          onPttChange: (active) => voice.current?.setPttActive(active),
        }
      );
      setLoadStage("Oyun durumu senkronize ediliyor…");
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
  };

  launch.current = startMultiplayerGame;

  const resume = () => {
    setError("");
    setPanel(null);
    setView("play");
    game.current?.start();
  };

  const exit = () => {
    activeRoom.current = null;
    clearTimeout(loadTimer.current);
    game.current?.dispose();
    game.current = null;
    voice.current?.leaveVoice();
    setHUD(null);
    if ((currentRoom || currentRoomRef.current) && socket) {
      socket.emit("strike:leave_room");
      updateCurrentRoom(null);
    }
    setView("menu");
    setPanel(null);
    refreshRooms();
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    setError("");

    socket.emit(
      "strike:create_room",
      {
        name: createName,
        map: category==='bomb'?'district':createMap,
        mode: category==='bomb'?'bomb':createMode,
        maxPlayers: createMaxPlayers,
        timeLimit: createDuration,
        scoreLimit: createScoreLimit,
        password: createPassword,
      },
      (res: { success: boolean; room?: StrikeRoomState; error?: string }) => {
        if (res.success && res.room) {
          updateCurrentRoom(res.room);
          setPanel(null);
          setView("lobby");
          refreshRooms();
        } else {
          setError(res.error || "Oda kurulamadı.");
        }
      }
    );
  };

  const handleQuickMatch = () => {
    if(category==='bomb'){setPanel('create_room');return;}
    if (!socket) return;
    setError("");
    socket.emit(
      "strike:quick_match",
      {},
      (res: { success: boolean; room?: StrikeRoomState; error?: string }) => {
        if (res.success && res.room) {
          updateCurrentRoom(res.room);
          if (res.room.status === "in_progress") {
            startMultiplayerGame(res.room);
          } else {
            setView("lobby");
          }
        } else {
          setError(res.error || "Hızlı maç bulunamadı.");
        }
      }
    );
  };

  const handleJoinRoom = (roomId: string, hasPass = false) => {
    if (!socket) return;
    if (hasPass) {
      setPasswordModalRoomId(roomId);
      return;
    }
    setError("");
    socket.emit(
      "strike:join_room",
      { roomCode: roomId, roomId, code: roomId },
      (res: { success: boolean; room?: StrikeRoomState; error?: string }) => {
        if (res.success && res.room) {
          updateCurrentRoom(res.room);
          if (res.room.status === "in_progress") {
            startMultiplayerGame(res.room);
          } else {
            setView("lobby");
          }
        } else {
          setError(res.error || "Odaya katılınamadı.");
        }
      }
    );
  };

  const handleJoinWithPassword = () => {
    if (!socket || !passwordModalRoomId) return;
    setError("");
    socket.emit(
      "strike:join_room",
      {
        roomCode: passwordModalRoomId,
        roomId: passwordModalRoomId,
        code: passwordModalRoomId,
        password: passwordInput,
      },
      (res: { success: boolean; room?: StrikeRoomState; error?: string }) => {
        if (res.success && res.room) {
          updateCurrentRoom(res.room);
          setPasswordModalRoomId(null);
          setPasswordInput("");
          if (res.room.status === "in_progress") {
            startMultiplayerGame(res.room);
          } else {
            setView("lobby");
          }
        } else {
          setError(res.error || "Hatalı oda şifresi.");
        }
      }
    );
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !joinCodeInput) return;
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

    socket.emit(
      "strike:join_room",
      { roomCode: clean, roomId: clean, code: clean },
      (res: { success: boolean; room?: StrikeRoomState; error?: string }) => {
        if (res.success && res.room) {
          updateCurrentRoom(res.room);
          if (res.room.status === "in_progress") {
            startMultiplayerGame(res.room);
          } else {
            setView("lobby");
          }
        } else {
          setError(res.error || "Oda kodu bulunamadı.");
        }
      }
    );
  };

  const toggleReady = () => {
    if (!socket || !currentRoom) return;
    const me = currentRoom.players.find((p) => p.userId === currentUserId);
    socket.emit("strike:set_ready", { ready: !me?.ready });
  };

  const switchTeam = (team: StrikeTeam) => {
    if (!socket || !currentRoom) return;
    socket.emit("strike:switch_team", { team });
  };

  const startMatchAsHost = () => {
    if (!socket || !currentRoom) return;
    setError("");
    socket.emit("strike:start_game", (res?: { success: boolean; error?: string }) => {
      if (res && !res.success && res.error) {
        setError(res.error);
      }
    });

  };

  const returnToLobbyAsHost = () => {
    if (!socket || !currentRoom) return;
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

  useEffect(()=>{
    let active=true;
    const sync=()=>{setSettings(old=>({...old,cosmeticLoadout:{}}));socket?.timeout(6000).emit('strike:inventory_get',{},(err:any,r:any)=>{if(active&&!err&&r?.success)setSettings(old=>({...old,cosmeticLoadout:r.state.equipped}));});};
    if(socket?.connected)sync();socket?.on('connect',sync);
    return()=>{active=false;socket?.off('connect',sync);};
  },[socket,currentUserId]);
  const setting = (patch: Partial<StrikeSettings>) =>
    setSettings((old) => cleanSettings({ ...old, ...patch }));

  const isHost = currentRoom?.hostId === currentUserId;
  const filteredRooms = rooms.filter((r) => {
    if((r.mode==='bomb')!==(category==='bomb'))return false;
    const matchQuery = r.name.toLowerCase().includes(roomFilter.toLowerCase());
    const matchMode = roomModeFilter === "all" || r.mode === roomModeFilter;
    return matchQuery && matchMode;
  });

  return (
    <section className={`ks-root ks-experience ks-view-${view} ${hud?.ads&&(hud.weapon==='sniper'||hud.weapon==='railgun')?'ks-scoped':''}`} aria-label="KapsStrike 3D FPS">
      <canvas
        ref={canvas}
        className="ks-canvas"
        aria-label="KapsStrike 3D oyun alanı"
        tabIndex={-1}
      />

      {view === "loading" && (
        <div className="ks-overlay" role="status">
          <div className="ks-menu"><h2>Maç hazırlanıyor</h2><p>{loadStage}</p>
            <button onClick={exit}>Lobiye / menüye dön</button>
          </div>
        </div>
      )}
      {error && view !== "menu" && <p className="ks-network-error" role="alert">{error}</p>}

      {/* MOBILE PORTRAIT ORIENTATION BANNER */}
      {view === "play" && isMobile && isPortrait && (
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

      {/* MOBILE ERGONOMIC HUD OVERLAY */}
      {view === "play" && isMobile && (
        <div className="ks-touch-overlay">
          {/* Virtual Joystick Zone (Bottom-Left) */}
          <div
            className="ks-touch-joystick-zone"
            onTouchStart={(e) => {
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
              const touch = e.changedTouches[0];
              lookTouchId.current = touch.identifier;
              lookLastPos.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchMove={(e) => {
              for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === lookTouchId.current) {
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
                  break;
                }
              }
            }}
            onTouchCancel={() => {
              lookTouchId.current = null;
            }}
          />

          {/* Ergonomic Arc Action Buttons Around Main Fire Button */}
          <div className="ks-touch-arc-container">
            {/* Main Fire Button */}
            <button
              type="button"
              className="ks-touch-btn-fire-main"
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
              ATEŞ
            </button>

            {/* Arc Action Button: ADS / Dürbün */}
            <button
              type="button"
              className="ks-touch-arc-btn"
              style={{
                bottom: "105px",
                right: "15px",
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
              {hud?.weapon === "knife" ? "GÜÇLÜ" : "ADS"}
            </button>

            {/* Arc Action Button: Şarjör (Reload) */}
            <button
              type="button"
              className="ks-touch-arc-btn"
              style={{ bottom: "88px", right: "75px" }}
              onTouchStart={(e) => {
                e.preventDefault();
                game.current?.triggerReload();
              }}
            >
              R
            </button>

            {/* Arc Action Button: Çömel / Kay */}
            <button
              type="button"
              className="ks-touch-arc-btn"
              style={{ bottom: "45px", right: "98px" }}
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
              KAY
            </button>

            {/* Arc Action Button: Zıpla */}
            <button
              type="button"
              className="ks-touch-arc-btn"
              style={{ bottom: "-8px", right: "88px" }}
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
              ZIPLA
            </button>
          </div>

          {/* Quick Weapon Selector Wheel Popup Menu */}
          {weaponMenuOpen && (
            <div className="ks-weapon-wheel">
              {(hud?.inventory||WEAPON_ORDER.slice(0,6)).map((wId) => (
                <button
                  key={wId}
                  type="button"
                  className={`ks-weapon-wheel-btn ${hud?.weapon === wId ? "active" : ""}`}
                  onClick={() => {
                    game.current?.selectWeapon(wId);
                    setWeaponMenuOpen(false);
                  }}
                >
                  <span className="font-bold">{WEAPONS[wId].name.split(" ")[0]}</span>
                  <span className="text-[10px] opacity-75">
                    {wId === "knife" ? "Sınırsız" : `${WEAPONS[wId].capacity} Mermi`}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Single Compact Active Weapon Card */}
          <div
            className="ks-compact-weapon-card"
            onClick={() => setWeaponMenuOpen((prev) => !prev)}
            title="Silah Değiştir"
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: WEAPONS[hud?.weapon || "rifle"]?.color || "#ecc17b" }}
            />
            <div className="flex flex-col">
              <span className="font-bold text-xs text-slate-100">
                {WEAPONS[hud?.weapon || "rifle"]?.name || "Silah"}
              </span>
              <span className="text-[11px] font-mono text-amber-400">
                {hud?.weapon === "knife" ? "Taktik Bıçak" : `${hud?.ammo || 0} / ${hud?.capacity || 0}`}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-bold ml-1">
              {weaponMenuOpen ? "▲" : "▼"}
            </span>
          </div>
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
              <span className="ks-kill-weapon">
                ⚡ {WEAPONS[k.weapon as WeaponId]?.name || k.weapon}
              </span>
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
                  {hud?.ping ? `${Math.round(hud.ping)} ms` : "0 ms"}
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
                        {p.username} {p.userId === currentUserId ? "(Sen)" : ""}
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
                      {p.ping || 0} ms
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
          <div className="ks-top" style={currentRoom?.mode==='bomb'?{visibility:'hidden'}:undefined}>
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
                <small>{WEAPONS[hud.weapon]?.name}</small>
                <strong>
                  {hud.weapon === "knife" ? "∞" : <>{hud.ammo} <span>/ {hud.capacity}</span></>}
                </strong>
                <span>
                  {hud.reload > 0
                    ? `ŞARJÖR · ${hud.reload.toFixed(1)} sn`
                    : "R · Yenile | F · İncele | E · Al"}
                </span>
              </div>
            )}
          </div>

          {(!isMobile || settings.showDebugStats) && (
            <div className="ks-perf">
              {Math.round(hud.fps)} FPS · {hud.drawCalls} çizim ·{" "}
              {hud.activeMeshes}/{hud.meshes} mesh ·{" "}
              {hud.isMultiplayer
                ? `Multiplayer (${hud.remotePlayerCount || 0} oyuncu) · Ping: ${Math.round(
                    hud.ping || 0
                  )} ms · TAB Skor`
                : "Yerel antrenman"}
              {" · ESC Menü"}
            </div>
          )}

          {hud.dead && currentRoom?.mode==='bomb' && <div className="ks-bomb-spectator"><b>{hud.spectating?`İzleniyor: ${hud.spectating}`:'Takımın elendi'}</b><span>Sonraki raundda yeniden doğacaksın.</span>{hud.spectating&&<button onClick={()=>game.current?.cycleSpectator()}>Sonraki takım arkadaşı</button>}</div>}
          {!currentInputDevice().phone && <StrikeMinimap map={MAPS[currentRoom?.map||map]} hud={hud}/>}
          {hud.ads && !hud.dead && (hud.weapon==='sniper'||hud.weapon==='railgun') && <div className="ks-scope" aria-label="Dürbün açık"><div className="ks-scope-lens"><i/><b/><span>{hud.weapon==='railgun'?'5×':'3.5×'} / UFUK OPTICS</span></div></div>}
          {hud.supplyPrompt && !hud.dead && <button className="ks-supply-prompt" onClick={()=>game.current?.interact()}>{isMobile?'Dokun':'E'} · {hud.supplyPrompt}</button>}
          {hud.world?.drop && <div className="ks-drop-warning" role="status">İKMAL UÇAĞI YAKLAŞIYOR · {Math.max(0,Math.ceil((hud.world.drop.landing-hud.tick)/120))} sn<br/><small>Kırmızı dumanı takip et · RX-3 Şimşek</small></div>}
          {hud.hurt && hud.hurt.until > hud.tick && <div className="ks-hurt-vignette" style={{opacity: Math.min(.85, .2 + (hud.hurt.damage || 10) / 110)}} />}
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
                  👑 {matchStats.mvp.username} ({matchStats.mvp.kills} Öldürme ·{" "}
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
                    <b>{currentRoom.mode === "bomb" ? "Bomba Kurma · MR6" : currentRoom.mode !== "ffa" ? "Takım Savaşı" : "Herkes Tek"}</b> · Süre:{" "}
                    <b>{Math.round(currentRoom.timeLimit / 60)} dk</b>
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
                              {p.username} {p.userId === currentUserId ? "(Sen)" : ""}
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
                              {p.username} {p.userId === currentUserId ? "(Sen)" : ""}
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
                            {p.username} {p.userId === currentUserId ? "(Sen)" : ""}
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
                    disabled={currentRoom.players.length < 1}
                  >
                    ⚡ MAÇI BAŞLAT
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
                  <button className="ks-btn-quick" onClick={handleQuickMatch}>
                    ⚡ Hızlı Maç Bul
                  </button>
                  <button
                    onClick={() => setPanel("create_room")}
                    className="ks-primary"
                  >
                    + Oda Oluştur
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
                    <button type="submit" disabled={joinCodeInput.trim().length < 4}>
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
                      {category==='bomb'&&<option value="bomb">Bomba Kurma (T / CT)</option>}<option value="tdm">Takım Savaşı (TDM)</option>
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
                            disabled={r.playerCount >= r.maxPlayers}
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
              <form onSubmit={handleCreateRoom} className="ks-settings">
                <h2>Yeni Çok Oyunculu Oda Kur</h2>
                <label>
                  Oda Adı
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Harita
                  <select
                    value={createMap}
                    disabled={category==='bomb'}
                    onChange={(e) => setCreateMap(e.target.value as MapId)}
                  >
                    {Object.values(MAPS).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.subtitle})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Oyun Modu
                  <select
                    value={createMode}
                    disabled={category==='bomb'}
                    onChange={(e) => setCreateMode(e.target.value as StrikeGameMode)}
                  >
                    {category==='bomb'&&<option value="bomb">Bomba Kurma (T / CT)</option>}<option value="tdm">Takım Savaşı (TDM - Red vs Blue)</option>
                    <option value="ffa">Herkes Tek (FFA - Deathmatch)</option>
                  </select>
                </label>
                <label>
                  Maksimum Oyuncu ({createMaxPlayers})
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="1"
                    value={createMaxPlayers}
                    onChange={(e) => setCreateMaxPlayers(Number(e.target.value))}
                  />
                </label>
                <label>
                  Maç Süresi
                  <select
                    value={createDuration}
                    disabled={category==='bomb'}
                    onChange={(e) => setCreateDuration(Number(e.target.value))}
                  >
                    <option value={180}>3 Dakika</option>
                    <option value={300}>5 Dakika</option>
                    <option value={600}>10 Dakika</option>
                  </select>
                </label>
                <label>
                  Skor Limiti ({createScoreLimit} Kill)
                  <input
                    type="range"
                    min="10"
                    max="60"
                    step="5"
                    value={createScoreLimit}
                    disabled={category==='bomb'}
                    onChange={(e) => setCreateScoreLimit(Number(e.target.value))}
                  />
                </label>
                <label>
                  Oda Şifresi (İsteğe Bağlı)
                  <input
                    type="text"
                    placeholder="Şifresiz için boş bırakın"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                </label>
                <div className="flex gap-3 mt-4">
                  <button type="submit" className="ks-primary">
                    Odayı Oluştur
                  </button>
                  <button type="button" onClick={() => setPanel(null)}>
                    İptal
                  </button>
                </div>
              </form>
            )}

            {/* TRAINING SECTION */}
            {modeTab === "training" && !panel && (
              <>
                <div className="ks-maps">
                  {Object.values(MAPS).map((m) => (
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
              <button
                onClick={() => {
                  if (document.fullscreenElement)
                    void document.exitFullscreen();
                  else
                    void document
                      .querySelector(".ks-root")
                      ?.requestFullscreen()
                      .catch(() => setError("Tam ekran açılamadı."));
                }}
              >
                Tam ekran
              </button>
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

      {currentRoom?.mode==='bomb'&&view==='play'&&<StrikeBombHUD socket={socket} players={currentRoom.players} interactKey={settings.bindings?.interact||"KeyE"} onShopChange={open=>game.current?.setMenuOverlay(open)}/>}
      {view==='menu'&&<button className="ks-mode-back" onClick={()=>setCategory(null)}>Oyun modu seçimi</button>}
      {view==='menu'&&category===null&&<div className="ks-mode-gate"><h1>KapsStrike · Oyununu seç</h1><div><button onClick={()=>{setCategory('kill');setCreateMode('tdm');setCreateMap('warehouse');}}>KILL YARIŞI<small>Mevcut FFA ve takım savaşı · Haritalar, kasalar ve envanter</small></button><button onClick={()=>{setCategory('bomb');setModeTab('multiplayer');setCreateMode('bomb');setCreateMap('district');}}>BOMBA KURMA<small>Takımını seç, bomba bölgelerini savun veya bombayı kur. Raundları kazan ve zafere ulaş.</small></button></div></div>}
      {/* Pause has one clear primary action; detailed settings live in dismissible panels. */}
      {view === "pause" && (
        <div className="ks-overlay ks-pause-overlay" inert={!!panel}><div className="ks-menu ks-pause-card">
          <div className="ks-eyebrow">KAPSSTRIKE / MENÜ</div><h2>Kısa bir mola.</h2>
          <p>{game.current?.isMultiplayer?"Maç devam ediyor. Hazır olduğunda geri dön.":"Antrenman duraklatıldı."}</p>
          <button className="ks-primary ks-resume" onClick={()=>{setPanel(null);resume();}}>▶ Oyuna Devam Et</button>
          <nav className="ks-pause-options" aria-label="Duraklatma seçenekleri">
            <button aria-label="Görüntü ve ses" onClick={()=>setPanel('settings')}>Görüntü ve ses<small>Kalite, FOV, ses düzeyleri</small></button>
            <button aria-label="Kontroller" onClick={()=>setPanel('controls')}>Kontroller<small>Tuş atamaları ve silah inceleme</small></button>
            <button onClick={()=>setPanel('input')}>Mobil Kontroller / Jiroskop<small>Dokunma, hassasiyet ve sensör</small></button>
            <button onClick={()=>setPanel('inventory')}>Envanter / Kasalar<small>Kaplamalarını seç</small></button><button aria-label="Karakter" onClick={()=>setPanel('skins')}>Karakter<small>Görünümünü seç</small></button>
          </nav>
          <button className="ks-mic-toggle" onClick={toggleVoice}>{isVoiceMuted?'Mikrofonu aç':'Mikrofonu sustur'}</button>
          <button className="ks-leave" onClick={()=>{setPanel(null);exit();}}>Menüye / Lobiye Dön</button>
        </div></div>
      )}
      {panel && panel !== 'create_room' && ['menu','lobby','pause'].includes(view) && (
        <div className="ks-overlay ks-feature-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null);}}>
          <div className="ks-menu ks-feature-card" role="dialog" aria-modal="true" aria-label={{inventory_admin:'Yönetici envanteri',inventory:'Envanter ve kasalar',skins:'Karakter seçimi',controls:'Kontroller',settings:'Görüntü ve ses',input:'Mobil kontroller'}[panel]}>
            <div className="ks-panel-bar"><span>KAPSSTRIKE / {{inventory_admin:'YÖNETİM',inventory:'ENVANTER',skins:'KARAKTER',controls:'KONTROLLER',settings:'AYARLAR',input:'MOBİL KONTROLLER'}[panel]}</span><button autoFocus onClick={()=>setPanel(null)} aria-label="Paneli kapat">Geri dön <span aria-hidden="true">×</span></button></div>
            <div className="ks-panel-content">
              {panel==='inventory'&&<StrikeInventory socket={socket} initialSkin={settings.selectedSkin} onSkin={skin=>setting({selectedSkin:skin})} onChange={state=>setting({cosmeticLoadout:state.equipped})}/>}
              {panel==='inventory_admin'&&<StrikeInventoryAdmin socket={socket}/>}
              {panel==='skins'&&<StrikeSkins socket={socket} initialSkin={settings.selectedSkin} onSaved={skin=>setting({selectedSkin:skin})}/>}
              {panel==='controls'&&<div className="ks-controls"><h2>Kontroller</h2><p>F · Silahı incele. E · Sandığı aç / silahı al. Dürbünlü silahta sağ tık · Nişan.</p><StrikeControls value={cleanBindings(settings.bindings)} onChange={bindings=>setting({bindings})}/></div>}
              {panel==='settings'&&<StrikeGraphicsSettings settings={settings} onChange={setting}/>}
              {panel==='input'&&<StrikeInputSettings settings={settings} onChange={setting} gyro={gyro}/>}
            </div>
            <button className="ks-primary ks-panel-done" onClick={()=>setPanel(null)}>Kaydet ve Dön</button>
          </div>
        </div>
      )}

    </section>
  );
}
