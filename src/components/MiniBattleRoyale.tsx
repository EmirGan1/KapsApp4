import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Trophy, Users, Bot, Crown, ArrowLeft, RefreshCw, Plus, Play, Shield, 
  Flame, Crosshair, Volume2, VolumeX, Maximize2, Minimize2, 
  Smartphone, Keyboard, AlertTriangle, Zap, Skull,
  HelpCircle, MousePointer, Info, CheckCircle2, Move, Clock, Swords,
  Sparkles, RotateCcw, Award, ChevronRight, Eye
} from 'lucide-react';
import Avatar from './Avatar';
import { WEAPON_CONFIGS, MAP_SIZE } from '../server/battleRoyaleServer';

interface MiniBattleRoyaleProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  targetTableId?: string | null;
  onBackToHub: () => void;
}

interface RoomItem {
  id: string;
  title: string;
  hostId: number;
  hostName: string;
  hostAvatar: string | null;
  playerCount: number;
  capacity: number;
  mode: 'royale' | 'deathmatch';
  duration: number;
  status: 'lobby' | 'countdown' | 'playing' | 'gameover';
  createdAt: number;
}

interface PlayerState {
  id: string;
  userId: number;
  username: string;
  avatar: string | null;
  color: string;
  isBot: boolean;
  isHost: boolean;
  ready?: boolean;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  activeWeapon: string;
  activeWeaponSlot: number;
  weapons: string[];
  ammo: Record<string, number>;
  reserveAmmo: Record<string, number>;
  isReloading: boolean;
  isAlive: boolean;
  kills: number;
  deaths: number;
  spectating: boolean;
  respawnAt: number | null;
  spawnShieldEndTime: number;
  speedBuffEndTime: number;
  rageBuffEndTime: number;
}

interface GameState {
  id: string;
  status: 'lobby' | 'countdown' | 'playing' | 'gameover';
  mode: 'royale' | 'deathmatch';
  matchTimeRemaining: number;
  duration: number;
  players: PlayerState[];
  bullets: Array<{
    id: string;
    shooterId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    color: string;
    radius: number;
    isAoE?: boolean;
    isRage?: boolean;
  }>;
  crates: Array<{
    id: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    tier: 'normal' | 'rare';
    lootType: string;
  }>;
  loot: Array<{
    id: string;
    type: string;
    x: number;
    y: number;
  }>;
  obstacles: Array<{
    id: string;
    type: 'rock' | 'bush';
    x: number;
    y: number;
    radius: number;
  }>;
  zone: {
    currentX: number;
    currentY: number;
    currentRadius: number;
    targetX: number;
    targetY: number;
    targetRadius: number;
    isShrinking: boolean;
    phase: number;
  };
  damagePopups: Array<{
    id: string;
    x: number;
    y: number;
    damage: number;
    color: string;
    createdAt: number;
  }>;
  killfeed: Array<{
    id: string;
    killer: string;
    victim: string;
    weapon: string;
    time: number;
  }>;
  winner: {
    id: string;
    userId: number;
    username: string;
    avatar: string | null;
    kills: number;
  } | null;
}

interface LeaderboardUser {
  rank: number;
  id: number;
  username: string;
  avatar: string | null;
  color: string;
  wins: number;
  kills: number;
  matches: number;
}

export default function MiniBattleRoyale({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  targetTableId,
  onBackToHub
}: MiniBattleRoyaleProps) {
  // Navigation & View States
  const [view, setView] = useState<'rooms' | 'lobby' | 'game'>('rooms');
  const [activeTab, setActiveTab] = useState<'rooms' | 'leaderboard'>('rooms');
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  // HUD Tick Interval (100ms for React HUD elements)
  const [, setHudTick] = useState<number>(0);
  useEffect(() => {
    if (view !== 'game') return;
    const interval = setInterval(() => {
      setHudTick(prev => (prev + 1) % 10000);
    }, 100);
    return () => clearInterval(interval);
  }, [view]);

  // Data States
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [currentRoom, setCurrentRoom] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Leaderboard States
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [leaderboardSort, setLeaderboardSort] = useState<'wins' | 'kills'>('wins');
  const [leaderboardLoading, setLeaderboardLoading] = useState<boolean>(false);

  // Create Room Modal State (100% Free)
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>(`${username}'ın Arenası`);
  const [createCapacity, setCreateCapacity] = useState<number>(4);
  const [createMode, setCreateMode] = useState<'royale' | 'deathmatch'>('deathmatch');
  const [createDuration, setCreateDuration] = useState<number>(180); // 180s = 3 minutes

  // Control Mode: 'touch' (Virtual Joystick) vs 'desktop' (WASD + Arrows/Mouse)
  const [controlMode, setControlMode] = useState<'touch' | 'desktop'>(() => {
    const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
    return isMobileOrTablet ? 'touch' : 'desktop';
  });

  // Game UI & Fullscreen
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [zoneWarning, setZoneWarning] = useState<string | null>(null);

  // Canvas Refs & Game Engine
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Input Tracking
  const keysPressed = useRef<Record<string, boolean>>({});
  const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMouseDown = useRef<boolean>(false);
  const isSpaceDown = useRef<boolean>(false);
  const [showControlsModal, setShowControlsModal] = useState<boolean>(false);

  // Virtual Touch Joysticks
  const touchMoveOrigin = useRef<{ x: number; y: number } | null>(null);
  const touchMoveCurrent = useRef<{ x: number; y: number } | null>(null);
  const touchAimOrigin = useRef<{ x: number; y: number } | null>(null);
  const touchAimCurrent = useRef<{ x: number; y: number } | null>(null);
  const isTouchFiring = useRef<boolean>(false);

  // Spectator target
  const [spectateTargetIndex, setSpectateTargetIndex] = useState<number>(0);

  // Fetch Rooms list
  const fetchRooms = useCallback(() => {
    if (!socket) return;
    setLoading(true);
    socket.emit('royale:get_rooms', (roomList: RoomItem[]) => {
      setRooms(roomList || []);
      setLoading(false);
    });
  }, [socket]);

  // Fetch Leaderboard
  const fetchLeaderboard = useCallback((sort: 'wins' | 'kills') => {
    if (!socket) return;
    setLeaderboardLoading(true);
    socket.emit('royale:get_leaderboard', { sortBy: sort }, (rows: LeaderboardUser[]) => {
      setLeaderboard(rows || []);
      setLeaderboardLoading(false);
    });
  }, [socket]);

  // Initial Rooms Load and Socket Listeners
  useEffect(() => {
    if (!socket) return;

    fetchRooms();
    fetchLeaderboard(leaderboardSort);

    const onRoomsList = (list: RoomItem[]) => {
      setRooms(list || []);
    };

    const onRoomState = (room: any) => {
      setCurrentRoom(room);
      if (room.status === 'lobby') {
        setView('lobby');
        setCountdownNum(null);
      }
    };

    const onCountdown = ({ countdown }: { countdown: number }) => {
      setCountdownNum(countdown);
    };

    const onGameStarted = (state: GameState) => {
      gameStateRef.current = state;
      setCurrentRoom((prev: any) => (prev ? { ...prev, status: 'playing' } : prev));
      setCountdownNum(null);
      setView('game');
    };

    const onGameState = (state: GameState) => {
      gameStateRef.current = state;
      if (state && state.status === 'playing' && viewRef.current !== 'game') {
        setView('game');
      }
    };

    const onZoneWarning = ({ message }: { message: string }) => {
      setZoneWarning(message);
      setTimeout(() => setZoneWarning(null), 3500);
    };

    const onGameOver = ({ winner, state }: any) => {
      if (state) gameStateRef.current = state;
      setHudTick(prev => (prev + 1) % 10000);
      fetchLeaderboard(leaderboardSort);
    };

    socket.on('royale:rooms_list', onRoomsList);
    socket.on('royale:room_state', onRoomState);
    socket.on('royale:countdown', onCountdown);
    socket.on('royale:game_started', onGameStarted);
    socket.on('royale:game_state', onGameState);
    socket.on('royale:zone_warning', onZoneWarning);
    socket.on('royale:game_over', onGameOver);

    return () => {
      socket.off('royale:rooms_list', onRoomsList);
      socket.off('royale:room_state', onRoomState);
      socket.off('royale:countdown', onCountdown);
      socket.off('royale:game_started', onGameStarted);
      socket.off('royale:game_state', onGameState);
      socket.off('royale:zone_warning', onZoneWarning);
      socket.off('royale:game_over', onGameOver);
    };
  }, [socket, fetchRooms, fetchLeaderboard, leaderboardSort]);

  // Handle direct table join if targeted
  useEffect(() => {
    if (targetTableId && socket) {
      handleJoinRoom(targetTableId);
    }
  }, [targetTableId, socket]);

  // Create Room Handler
  const handleCreateRoom = () => {
    if (!socket) return;
    setErrorMessage('');

    socket.emit(
      'royale:create_room',
      {
        title: createTitle,
        capacity: createCapacity,
        mode: createMode,
        duration: createDuration
      },
      (res: any) => {
        if (res.error) {
          setErrorMessage(res.error);
        } else if (res.room) {
          setCurrentRoom(res.room);
          setView('lobby');
          setShowCreateModal(false);
        }
      }
    );
  };

  // Join Room Handler
  const handleJoinRoom = (roomId: string) => {
    if (!socket) return;
    setErrorMessage('');

    socket.emit('royale:join_room', { roomId }, (res: any) => {
      if (res.error) {
        setErrorMessage(res.error);
      } else if (res.room) {
        setCurrentRoom(res.room);
        setView('lobby');
      }
    });
  };

  // Leave Room Handler
  const handleLeaveRoom = () => {
    if (!socket) return;
    socket.emit('royale:leave_room', () => {
      setCurrentRoom(null);
      gameStateRef.current = null;
      setView('rooms');
      fetchRooms();
    });
  };

  // Return to Lobby (Play Again / Persistent Room Cycle)
  const handleReturnToLobby = () => {
    if (!socket || !currentRoom) return;
    socket.emit('royale:return_to_lobby', { roomId: currentRoom.id }, (res: any) => {
      if (res?.room) {
        setCurrentRoom(res.room);
        setView('lobby');
      }
    });
  };

  // Add Bot
  const handleAddBot = () => {
    if (!socket || !currentRoom) return;
    socket.emit('royale:add_bot', { roomId: currentRoom.id });
  };

  // Remove Bot
  const handleRemoveBot = (botId: string) => {
    if (!socket || !currentRoom) return;
    socket.emit('royale:remove_bot', { roomId: currentRoom.id, botId });
  };

  // Toggle Ready
  const handleToggleReady = () => {
    if (!socket || !currentRoom) return;
    socket.emit('royale:toggle_ready', { roomId: currentRoom.id });
  };

  // Start Game
  const handleStartGame = () => {
    if (!socket || !currentRoom) return;
    setErrorMessage('');
    socket.emit('royale:start_game', { roomId: currentRoom.id }, (res: any) => {
      if (res?.error) {
        setErrorMessage(res.error);
      }
    });
  };

  // Switch Weapon Slot (0 or 1)
  const handleSwitchWeaponSlot = (slotIdx: number) => {
    if (!socket) return;
    socket.emit('royale:input', { switchWeapon: slotIdx });
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // 30 FPS Client Input Loop (WASD Move + Arrow Keys 8-way Aim & Auto-Shoot + Mouse + Tablet)
  useEffect(() => {
    if (view !== 'game' || !socket) return;

    const inputTimer = setInterval(() => {
      const state = gameStateRef.current;
      if (!state || state.status !== 'playing') return;

      const myPlayer = state.players.find(p => !p.isBot && p.userId === currentUserId);
      if (!myPlayer || !myPlayer.isAlive) return;

      let vx = 0;
      let vy = 0;
      let angle = myPlayer.angle;
      let shooting = false;

      // 1. WASD Movement (Sol El)
      if (
        keysPressed.current['KeyW'] || keysPressed.current['W'] || keysPressed.current['w']
      ) vy -= 1;
      if (
        keysPressed.current['KeyS'] || keysPressed.current['S'] || keysPressed.current['s']
      ) vy += 1;
      if (
        keysPressed.current['KeyA'] || keysPressed.current['A'] || keysPressed.current['a']
      ) vx -= 1;
      if (
        keysPressed.current['KeyD'] || keysPressed.current['D'] || keysPressed.current['d']
      ) vx += 1;

      // Normalize movement direction vector
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx = vx / len;
        vy = vy / len;
      }

      // 2. Arrow Keys: 8-Directional Aim & Auto-Shoot (Sağ El)
      let aimX = 0;
      let aimY = 0;
      if (keysPressed.current['ArrowUp']) aimY -= 1;
      if (keysPressed.current['ArrowDown']) aimY += 1;
      if (keysPressed.current['ArrowLeft']) aimX -= 1;
      if (keysPressed.current['ArrowRight']) aimX += 1;

      const isArrowAiming = aimX !== 0 || aimY !== 0;

      if (isArrowAiming) {
        // Precise 8-way aim angle calculation
        angle = Math.atan2(aimY, aimX);
        shooting = true; // Auto-fire when holding any arrow key
      } else {
        // If not using arrow keys, use Mouse Aim
        if (canvasRef.current && (controlMode === 'desktop' || isMouseDown.current || isSpaceDown.current)) {
          const rect = canvasRef.current.getBoundingClientRect();
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const dx = mousePos.current.x - centerX;
          const dy = mousePos.current.y - centerY;
          if (mousePos.current.x !== 0 || mousePos.current.y !== 0) {
            angle = Math.atan2(dy, dx);
          }
        }
      }

      // Space or Mouse Left Click to Shoot
      if (isMouseDown.current || isSpaceDown.current) {
        shooting = true;
      }

      // 3. Touch Mode Virtual Joystick overrides
      if (touchMoveOrigin.current && touchMoveCurrent.current) {
        const tdx = touchMoveCurrent.current.x - touchMoveOrigin.current.x;
        const tdy = touchMoveCurrent.current.y - touchMoveOrigin.current.y;
        const dist = Math.hypot(tdx, tdy);
        if (dist > 8) {
          vx = (tdx / dist);
          vy = (tdy / dist);
        }
      }

      if (touchAimOrigin.current && touchAimCurrent.current) {
        const adx = touchAimCurrent.current.x - touchAimOrigin.current.x;
        const ady = touchAimCurrent.current.y - touchAimOrigin.current.y;
        const dist = Math.hypot(adx, ady);
        if (dist > 12) {
          angle = Math.atan2(ady, adx);
          shooting = true; // Auto-fire when dragging aim joystick
        }
      }

      if (isTouchFiring.current) {
        shooting = true;
      }

      // 4. Pickup / Swap Trigger
      let pickup = false;
      if (
        keysPressed.current['KeyE'] || keysPressed.current['KeyF'] ||
        keysPressed.current['e'] || keysPressed.current['E'] ||
        keysPressed.current['f'] || keysPressed.current['F']
      ) {
        pickup = true;
      }

      socket.emit('royale:input', {
        vx,
        vy,
        angle,
        shooting,
        pickup
      });
    }, 1000 / 30);

    return () => clearInterval(inputTimer);
  }, [view, socket, currentUserId, controlMode]);

  // Desktop Controls Event Listeners (WASD, Arrows, Space, R, Q, E, F, 1-2, Scroll, Click)
  useEffect(() => {
    if (view !== 'game') return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent browser default scroll for game controls
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }

      keysPressed.current[e.code] = true;
      if (e.key) {
        keysPressed.current[e.key] = true;
        keysPressed.current[e.key.toUpperCase()] = true;
        keysPressed.current[e.key.toLowerCase()] = true;
      }

      // Space to shoot
      if (e.code === 'Space') {
        isSpaceDown.current = true;
      }

      // Reload [R]
      if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
        socket?.emit('royale:input', { reload: true });
      }

      // Pickup / Swap Loot [E] / [F]
      if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E' || e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        socket?.emit('royale:input', { pickup: true, swapWeapon: true });
      }

      // Switch Weapon Slot 1 [1] or Slot 2 [2]
      if (e.code === 'Digit1' || e.code === 'Numpad1' || e.key === '1') {
        socket?.emit('royale:input', { switchWeapon: 0 });
      } else if (e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '2') {
        socket?.emit('royale:input', { switchWeapon: 1 });
      }

      // Quick Cycle Weapon [Q] or [Tab]
      if (e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q' || e.code === 'Tab') {
        socket?.emit('royale:input', { switchWeapon: 'next' });
      }

      // Toggle Controls Guide Modal [H] or [F1]
      if (e.code === 'KeyH' || e.key === 'h' || e.key === 'H' || e.code === 'F1') {
        setShowControlsModal(prev => !prev);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
      if (e.key) {
        keysPressed.current[e.key] = false;
        keysPressed.current[e.key.toUpperCase()] = false;
        keysPressed.current[e.key.toLowerCase()] = false;
      }

      if (e.code === 'Space') {
        isSpaceDown.current = false;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = true;
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isMouseDown.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 4) {
        socket?.emit('royale:input', { switchWeapon: e.deltaY > 0 ? 'next' : 'prev' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
      isMouseDown.current = false;
      isSpaceDown.current = false;
      keysPressed.current = {};
    };
  }, [view, socket]);

  // Touch Virtual Joystick Handlers (Mobile & Tablet)
  const handleTouchStartLeft = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchMoveOrigin.current = { x: touch.clientX, y: touch.clientY };
    touchMoveCurrent.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMoveLeft = (e: React.TouchEvent) => {
    if (!touchMoveOrigin.current) return;
    const touch = e.touches[0];
    touchMoveCurrent.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEndLeft = () => {
    touchMoveOrigin.current = null;
    touchMoveCurrent.current = null;
  };

  const handleTouchStartRight = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchAimOrigin.current = { x: touch.clientX, y: touch.clientY };
    touchAimCurrent.current = { x: touch.clientX, y: touch.clientY };
    isTouchFiring.current = true;
  };

  const handleTouchMoveRight = (e: React.TouchEvent) => {
    if (!touchAimOrigin.current) return;
    const touch = e.touches[0];
    touchAimCurrent.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEndRight = () => {
    touchAimOrigin.current = null;
    touchAimCurrent.current = null;
    isTouchFiring.current = false;
  };

  // 60 FPS HTML5 Canvas Render Loop
  useEffect(() => {
    if (view !== 'game') return;

    let running = true;

    const render = () => {
      if (!running) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const state = gameStateRef.current;
      const rect = canvas.getBoundingClientRect();
      const parentRect = canvas.parentElement?.getBoundingClientRect();
      const rawW = rect.width || parentRect?.width || window.innerWidth || 1280;
      const rawH = rect.height || parentRect?.height || (window.innerHeight - 64) || 720;
      const width = Math.max(320, Math.floor(rawW));
      const height = Math.max(240, Math.floor(rawH));

      // Handle Retina DPI scaling (cap at 2 for performance)
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetCanvasW = Math.floor(width * dpr);
      const targetCanvasH = Math.floor(height * dpr);
      if (canvas.width !== targetCanvasW || canvas.height !== targetCanvasH) {
        canvas.width = targetCanvasW;
        canvas.height = targetCanvasH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep space void background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Find focused player (self or spectate target)
      let focusedPlayer: PlayerState | undefined;
      if (state && Array.isArray(state.players)) {
        focusedPlayer = state.players.find(p => !p.isBot && p.userId === currentUserId);
        const alivePlayers = state.players.filter(p => p.isAlive);
        if (!focusedPlayer || !focusedPlayer.isAlive) {
          focusedPlayer = alivePlayers[spectateTargetIndex % Math.max(1, alivePlayers.length)] || state.players[0];
        }
      }

      let camX = MAP_SIZE / 2;
      let camY = MAP_SIZE / 2;
      if (focusedPlayer && Number.isFinite(focusedPlayer.x) && Number.isFinite(focusedPlayer.y)) {
        camX = focusedPlayer.x;
        camY = focusedPlayer.y;
      }

      // Normalized FOV calculation (1280x720 base viewport)
      const baseViewW = 1280;
      const baseViewH = 720;
      let scale = Math.max(width / baseViewW, height / baseViewH);
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-camX, -camY);

      // 1. ARENA GROUND & TACTICAL GRID
      ctx.fillStyle = '#1e3f20';
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      const tileSize = 120;
      for (let tx = 0; tx < MAP_SIZE; tx += tileSize) {
        for (let ty = 0; ty < MAP_SIZE; ty += tileSize) {
          if ((Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0) {
            ctx.fillStyle = '#244b26';
            ctx.fillRect(tx, ty, tileSize, tileSize);
          }
        }
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1.5;
      for (let gx = 0; gx <= MAP_SIZE; gx += tileSize) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, MAP_SIZE);
        ctx.stroke();
      }
      for (let gy = 0; gy <= MAP_SIZE; gy += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(MAP_SIZE, gy);
        ctx.stroke();
      }

      // Outer Perimeter Hazard Border
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 12;
      ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.setLineDash([24, 16]);
      ctx.strokeRect(6, 6, MAP_SIZE - 12, MAP_SIZE - 12);
      ctx.setLineDash([]);

      if (!state) {
        ctx.restore();
        ctx.restore();
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // 2. STORM ZONE (Battle Royale Mode Only)
      if (state.mode === 'royale' && state.zone && state.zone.currentRadius > 0) {
        const z = state.zone;
        ctx.save();
        ctx.fillStyle = 'rgba(147, 51, 234, 0.32)';
        ctx.beginPath();
        ctx.rect(0, 0, MAP_SIZE, MAP_SIZE);
        ctx.arc(z.currentX, z.currentY, Math.max(0, z.currentRadius), 0, Math.PI * 2, true);
        ctx.fill();

        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(z.currentX, z.currentY, Math.max(0, z.currentRadius), 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        if (z.targetRadius && z.targetRadius < z.currentRadius) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.setLineDash([16, 10]);
          ctx.beginPath();
          ctx.arc(z.targetX, z.targetY, Math.max(0, z.targetRadius), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      // 3. DRAW LOOT ON GROUND
      state.loot?.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);

        // Ground Glow
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.fill();

        if (item.type === 'bandage') {
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.roundRect(-10, -10, 20, 20, 4);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('+25', 0, 3);
        } else if (item.type === 'medkit') {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.roundRect(-13, -13, 26, 26, 4);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-8, -2.5, 16, 5);
          ctx.fillRect(-2.5, -8, 5, 16);
        } else if (item.type === 'shield') {
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.moveTo(0, -14);
          ctx.lineTo(12, -5);
          ctx.lineTo(9, 11);
          ctx.lineTo(0, 16);
          ctx.lineTo(-9, 11);
          ctx.lineTo(-12, -5);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (item.type === 'heavy_shield') {
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.moveTo(0, -16);
          ctx.lineTo(14, -6);
          ctx.lineTo(10, 13);
          ctx.lineTo(0, 18);
          ctx.lineTo(-10, 13);
          ctx.lineTo(-14, -6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (item.type === 'ammo') {
          ctx.fillStyle = '#eab308';
          ctx.fillRect(-11, -8, 22, 16);
          ctx.strokeStyle = '#713f12';
          ctx.lineWidth = 2;
          ctx.strokeRect(-11, -8, 22, 16);
          ctx.fillStyle = '#713f12';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('AMMO', 0, 3);
        } else if (item.type === 'adrenaline') {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⚡', 0, 4);
        } else if (item.type === 'rage') {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(0, 0, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🔥', 0, 4);
        } else if (item.type.startsWith('weapon_')) {
          const wName = item.type.replace('weapon_', '');
          const cfg = WEAPON_CONFIGS[wName] || WEAPON_CONFIGS.pistol;
          ctx.fillStyle = cfg.themeColor;
          ctx.beginPath();
          ctx.roundRect(-22, -9, 44, 18, 5);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(cfg.name.split(' ')[0].toUpperCase(), 0, 3.5);
        }
        ctx.restore();
      });

      // 4. DRAW CRATES (Normal & Rare Golden Crates)
      state.crates?.forEach(c => {
        ctx.save();
        ctx.translate(c.x, c.y);

        const isRare = c.tier === 'rare';
        ctx.fillStyle = isRare ? '#7e22ce' : '#78350f';
        ctx.fillRect(-22, -22, 44, 44);
        ctx.strokeStyle = isRare ? '#eab308' : '#d97706';
        ctx.lineWidth = isRare ? 4 : 3;
        ctx.strokeRect(-20, -20, 40, 40);

        ctx.strokeStyle = isRare ? '#fbbf24' : '#451a03';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-18, -18);
        ctx.lineTo(18, 18);
        ctx.moveTo(18, -18);
        ctx.lineTo(-18, 18);
        ctx.stroke();

        if (isRare) {
          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('★', 0, 5);
        }

        if (c.hp < c.maxHp) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-20, -32, 40, 5);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-20, -32, (c.hp / c.maxHp) * 40, 5);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-20, -32, 40, 5);
        }
        ctx.restore();
      });

      // 5. DRAW SOLID ROCKS
      state.obstacles?.forEach(obs => {
        if (obs.type === 'rock') {
          ctx.save();
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 5;
          ctx.stroke();

          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(obs.x - obs.radius * 0.3, obs.y - obs.radius * 0.3, obs.radius * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      // 6. DRAW BULLETS & TRACERS
      state.bullets?.forEach(b => {
        ctx.save();
        ctx.fillStyle = b.color || '#fbbf24';
        ctx.shadowColor = b.color || '#fbbf24';
        ctx.shadowBlur = b.isAoE ? 14 : 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius || 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 7. DRAW PLAYERS
      const now = Date.now();
      state.players?.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);

        if (!p.isAlive) {
          // Grave marker
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.roundRect(-16, -20, 32, 40, [16, 16, 2, 2]);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✝', 0, -2);
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(p.username, 0, 12);
          ctx.restore();
          return;
        }

        // Bush hiding transparency
        let insideBush = false;
        for (const obs of state.obstacles || []) {
          if (obs.type === 'bush' && Math.hypot(p.x - obs.x, p.y - obs.y) < obs.radius) {
            insideBush = true;
            break;
          }
        }
        if (insideBush) {
          ctx.globalAlpha = p.userId === currentUserId ? 0.6 : 0.2;
        }

        // Spawn Protection Shield Ring (Gold glowing aura)
        if (p.spawnShieldEndTime > now) {
          ctx.save();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(0, 0, 34, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Speed / Rage Aura
        if (p.rageBuffEndTime > now) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 30, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.speedBuffEndTime > now) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 29, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Weapon & Hands Rotation
        ctx.save();
        ctx.rotate(p.angle);

        const wCfg = WEAPON_CONFIGS[p.activeWeapon] || WEAPON_CONFIGS.pistol;
        const wLength = p.activeWeapon === 'sniper' ? 38 : p.activeWeapon === 'rifle' ? 30 : p.activeWeapon === 'plasma' ? 32 : 22;

        // Weapon Barrel
        ctx.fillStyle = wCfg.themeColor;
        ctx.fillRect(8, -4, wLength, 8);
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(8, -4, wLength, 8);

        // Hands
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#713f12';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(15, -11, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(15, 11, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Player Body Circle
        ctx.fillStyle = p.color || '#3b82f6';
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // Local Player Neon Indicator Ring
        if (p.userId === currentUserId) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 28, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Inner tactical vest
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Directional Visor Dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(Math.cos(p.angle) * 12, Math.sin(p.angle) * 12, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Overhead Player Name & Badges
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;

        const isSelf = p.userId === currentUserId;
        const label = isSelf ? `[SEN] ${p.username}` : p.isBot ? `[BOT] ${p.username}` : p.username;
        ctx.fillStyle = isSelf ? '#38bdf8' : p.isBot ? '#fbbf24' : '#ffffff';
        ctx.fillText(label, 0, -38);
        ctx.shadowBlur = 0;

        // Overhead Shield Bar
        const barW = 46;
        const barH = 5;
        if (p.shield > 0) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-barW / 2, -52, barW, 4);
          ctx.fillStyle = '#06b6d4';
          const sW = Math.max(0, Math.min(barW, (p.shield / (p.maxShield || 100)) * barW));
          ctx.fillRect(-barW / 2, -52, sW, 4);
        }

        // Overhead Health Bar
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-barW / 2, -46, barW, barH);
        const hpRatio = Math.max(0, Math.min(1, p.hp / (p.maxHp || 100)));
        ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(-barW / 2, -46, hpRatio * barW, barH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barW / 2, -46, barW, barH);

        ctx.restore();
      });

      // 8. DRAW BUSHES (Foliage on top)
      state.obstacles?.forEach(obs => {
        if (obs.type === 'bush') {
          ctx.save();
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(obs.x - obs.radius * 0.25, obs.y - obs.radius * 0.2, obs.radius * 0.6, 0, Math.PI * 2);
          ctx.arc(obs.x + obs.radius * 0.25, obs.y + obs.radius * 0.15, obs.radius * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      // 9. FLOATING DAMAGE POPUPS
      state.damagePopups?.forEach(dp => {
        const age = now - dp.createdAt;
        const progress = Math.min(1, age / 1000);
        const offsetY = progress * 24;
        const alpha = Math.max(0, 1 - progress);

        ctx.save();
        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = dp.color;
        ctx.globalAlpha = alpha;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        ctx.fillText(`${dp.damage > 0 ? '-' : '+'}${dp.damage}`, dp.x, dp.y - offsetY);
        ctx.restore();
      });

      ctx.restore(); // camera translate restore
      ctx.restore(); // dpr scale restore

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [view, currentUserId, spectateTargetIndex]);

  // Helpers & Active Player Refs
  const myPlayer = gameStateRef.current?.players.find(p => !p.isBot && p.userId === currentUserId);
  const aliveCount = gameStateRef.current?.players.filter(p => p.isAlive).length || 0;
  const totalCount = gameStateRef.current?.players.length || 0;
  const isWinner = gameStateRef.current?.winner?.userId === currentUserId;

  // Nearby Ground Weapon (for manual swap prompt)
  const nearbyGroundWeapon = myPlayer && gameStateRef.current?.loot?.find(l => 
    l.type.startsWith('weapon_') && Math.hypot(l.x - myPlayer.x, l.y - myPlayer.y) < 70
  );

  // Sorted scoreboard for Deathmatch
  const sortedScoreboard = [...(gameStateRef.current?.players || [])].sort((a, b) => {
    if (b.kills !== a.kills) return b.kills - a.kills;
    return a.deaths - b.deaths;
  });

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const m = Math.floor(Math.max(0, sec) / 60);
    const s = Math.max(0, sec) % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden relative"
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
    >
      {/* ========================================================================= */}
      {/* 1. ROOMS BROWSER & LEADERBOARD VIEW */}
      {/* ========================================================================= */}
      {view === 'rooms' && (
        <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={onBackToHub}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Oyun Merkezine Dön"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <Flame className="text-amber-500" size={24} />
                  <span>Mini Battle Royale 2D</span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  %100 Ücretsiz • Hayatta Kalma & Süreli Ölüm Maçı Arenası
                </p>
              </div>
            </div>

            {/* Actions: Refresh & Create Table */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchRooms}
                disabled={loading}
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Yenile"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg shadow-amber-500/25 cursor-pointer"
              >
                <Plus size={18} />
                <span>Yeni Masa Kur (Ücretsiz)</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs (Açık Masalar & Liderlik Tablosu) */}
          <div className="flex items-center gap-2 mt-5 border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('rooms')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'rooms'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Swords size={16} />
              <span>Açık Masalar ({rooms.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('leaderboard');
                fetchLeaderboard(leaderboardSort);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900/60 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trophy size={16} />
              <span>🏆 Liderlik Tablosu</span>
            </button>
          </div>

          {/* TAB 1: OPEN ROOMS LIST */}
          {activeTab === 'rooms' && (
            <div className="mt-5">
              {errorMessage && (
                <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              {rooms.length === 0 ? (
                <div className="py-16 text-center space-y-3 bg-slate-900/40 rounded-3xl border border-slate-800/80 p-8">
                  <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto text-slate-500">
                    <Crosshair size={32} />
                  </div>
                  <h3 className="text-base font-black text-white">Şu Anda Açık Masa Yok</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    İlk masayı sen kurup arkadaşlarınla veya botlarla anında oynamaya başlayabilirsin!
                  </p>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="mt-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    + Ücretsiz Masa Oluştur
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map(room => (
                    <div
                      key={room.id}
                      className="p-5 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-all flex flex-col justify-between gap-4 shadow-lg hover:shadow-amber-500/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            url={room.hostAvatar}
                            name={room.hostName}
                            size={10}
                          />
                          <div>
                            <h3 className="font-extrabold text-sm text-white truncate max-w-[160px]">{room.title}</h3>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Kurucu: <strong className="text-slate-200">{room.hostName}</strong>
                            </span>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          room.mode === 'deathmatch'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}>
                          {room.mode === 'deathmatch' ? 'Ölüm Maçı' : 'Hayatta Kalma'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800/80">
                        <div className="flex items-center gap-3 text-slate-400">
                          <span className="flex items-center gap-1 font-bold">
                            <Users size={14} className="text-amber-400" />
                            <span>{room.playerCount} / {room.capacity}</span>
                          </span>
                          {room.mode === 'deathmatch' && (
                            <span className="flex items-center gap-1 font-bold text-slate-300">
                              <Clock size={13} className="text-cyan-400" />
                              <span>{Math.floor(room.duration / 60)} Dk</span>
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleJoinRoom(room.id)}
                          disabled={room.playerCount >= room.capacity || room.status !== 'lobby'}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            room.status !== 'lobby'
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : room.playerCount >= room.capacity
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 text-slate-950 shadow-md shadow-amber-500/20'
                          }`}
                        >
                          {room.status !== 'lobby' ? 'Oyun Sürüyor' : room.playerCount >= room.capacity ? 'Dolu' : 'Katıl'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WIN & KILL LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="mt-5 space-y-4">
              {/* Leaderboard Filters */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setLeaderboardSort('wins');
                      fetchLeaderboard('wins');
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      leaderboardSort === 'wins'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    👑 En Çok Kazananlar (Wins)
                  </button>
                  <button
                    onClick={() => {
                      setLeaderboardSort('kills');
                      fetchLeaderboard('kills');
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      leaderboardSort === 'kills'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    🎯 En Çok Avlayanlar (Kills)
                  </button>
                </div>

                <span className="text-xs text-slate-400 font-bold hidden sm:inline">
                  Genel İstatistik Sıralaması
                </span>
              </div>

              {leaderboardLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  <span>Sıralama yükleniyor...</span>
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800">
                  Henüz kaydedilmiş maç istatistiği bulunmuyor. İlk maçı kazan ve zirveye yerleş!
                </div>
              ) : (
                <div className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-950/80 text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-3">Sıra</th>
                          <th className="px-5 py-3">Oyuncu</th>
                          <th className="px-5 py-3 text-center">🏆 Zafer (Win)</th>
                          <th className="px-5 py-3 text-center">🎯 Toplam Kill</th>
                          <th className="px-5 py-3 text-center">Oynanan Maç</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-bold">
                        {leaderboard.map((u, idx) => (
                          <tr key={u.id} className={idx < 3 ? 'bg-slate-800/30' : ''}>
                            <td className="px-5 py-3.5 font-black text-sm">
                              {idx === 0 ? (
                                <span className="text-amber-400 flex items-center gap-1">🥇 1</span>
                              ) : idx === 1 ? (
                                <span className="text-slate-300 flex items-center gap-1">🥈 2</span>
                              ) : idx === 2 ? (
                                <span className="text-amber-600 flex items-center gap-1">🥉 3</span>
                              ) : (
                                <span className="text-slate-500 font-mono">#{idx + 1}</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <Avatar url={u.avatar} name={u.username} color={u.color} size={8} />
                                <span className="text-white font-extrabold">{u.username}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-center text-amber-400 font-black text-sm">
                              {u.wins}
                            </td>
                            <td className="px-5 py-3.5 text-center text-red-400 font-black text-sm">
                              {u.kills}
                            </td>
                            <td className="px-5 py-3.5 text-center text-slate-400">
                              {u.matches}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CREATE ROOM MODAL (%100 Ücretsiz - Mod & Süre Seçimli) */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Flame className="text-amber-500" size={20} />
                <span>Yeni Mini Battle Royale Masası</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Masa Adı</label>
              <input
                type="text"
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                maxLength={25}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-bold focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Game Mode Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Oyun Modu</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreateMode('deathmatch')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    createMode === 'deathmatch'
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="font-black text-xs block">⏱️ Süreli Ölüm Maçı</span>
                  <span className="text-[10px] opacity-75 mt-0.5 block">Ölen yeniden doğar, en çok kill alan kazanır.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCreateMode('royale')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    createMode === 'royale'
                      ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="font-black text-xs block">🔥 Hayatta Kalma</span>
                  <span className="text-[10px] opacity-75 mt-0.5 block">Daralan çember, tek can, son kalan kazanır.</span>
                </button>
              </div>
            </div>

            {/* Duration (if Deathmatch) */}
            {createMode === 'deathmatch' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Maç Süresi</label>
                <div className="grid grid-cols-3 gap-2">
                  {[120, 180, 300].map(dur => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setCreateDuration(dur)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        createDuration === dur
                          ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {dur / 60} Dakika
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Capacity Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Kişi Kapasitesi</label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map(cap => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setCreateCapacity(cap)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      createCapacity === cap
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {cap} Kişilik
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCreateRoom}
                className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-xs font-black text-slate-950 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Masayı Oluştur (Ücretsiz)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LOBBY WAITING ROOM VIEW (MASA BEKLEME SALONU) */}
      {/* ========================================================================= */}
      {view === 'lobby' && currentRoom && (
        <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto">
          {/* Lobby Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={handleLeaveRoom}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Masadan Ayrıl"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>{currentRoom.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                    currentRoom.mode === 'deathmatch'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {currentRoom.mode === 'deathmatch' ? 'Ölüm Maçı' : 'Hayatta Kalma'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Masa Sahibi: <strong className="text-amber-400">{currentRoom.hostName}</strong> • Kapasite: {currentRoom.capacity} Kişi
                </p>
              </div>
            </div>

            {/* Mode & Control Switchers */}
            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setControlMode(prev => prev === 'touch' ? 'desktop' : 'touch')}
                className="px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {controlMode === 'touch' ? (
                  <>
                    <Smartphone size={14} className="text-emerald-400" />
                    <span>📱 Dokunmatik Mod</span>
                  </>
                ) : (
                  <>
                    <Keyboard size={14} className="text-blue-400" />
                    <span>⌨️ Klavye & Fare Modu</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowControlsModal(true)}
                className="px-3 py-1.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold text-amber-300 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Klavye ve Fare Kontrolleri Rehberi"
              >
                <Keyboard size={14} className="text-amber-400" />
                <span>⌨️ Tuş Rehberi</span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={15} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Seats Layout (2 to 4 Slots) */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: currentRoom.capacity }).map((_, idx) => {
              const player = currentRoom.players[idx];

              return (
                <div
                  key={idx}
                  className={`p-5 rounded-3xl border flex flex-col items-center justify-center text-center gap-3 relative transition-all min-h-[170px] ${
                    player
                      ? 'bg-slate-900 border-slate-800 shadow-md'
                      : 'bg-slate-900/40 border-dashed border-slate-800'
                  }`}
                >
                  {player ? (
                    <>
                      {player.isHost && (
                        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-slate-950 flex items-center gap-1">
                          <Crown size={11} /> KURUCU
                        </span>
                      )}

                      {player.isBot && currentRoom.hostId === currentUserId && (
                        <button
                          onClick={() => handleRemoveBot(player.id)}
                          className="absolute top-3 right-3 text-[10px] font-bold text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          Çıkar ✕
                        </button>
                      )}

                      <div className="relative mt-2">
                        <Avatar
                          url={player.avatar}
                          name={player.username}
                          color={player.color}
                          size={12}
                        />
                        {player.isBot && (
                          <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full text-[8px] font-black bg-amber-500 text-slate-950">
                            BOT
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 max-w-[120px]">
                        <h4 className="font-extrabold text-sm text-white truncate">{player.username}</h4>
                        <span className={`text-[10px] font-bold block mt-0.5 ${
                          player.ready ? 'text-emerald-400' : 'text-slate-500'
                        }`}>
                          {player.ready ? '✅ Hazır' : '⏳ Bekliyor'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-600 block">Boş Koltuk</span>
                      {currentRoom.hostId === currentUserId && (
                        <button
                          onClick={handleAddBot}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 mx-auto"
                        >
                          <Bot size={13} className="text-amber-400" />
                          <span>+ Bot Ekle</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Keyboard Controls Summary Card in Lobby */}
          <div className="mt-6 p-4 rounded-3xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Keyboard size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <span>🎮 Ok Tuşları & WASD Kontrolleri</span>
                  <span className="text-[10px] text-amber-400 font-mono">Tablet / PC</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Hareket: WASD • <strong>Nişan & Ateş: Ok Tuşları (↑↓←→)</strong> veya Fare • Silah: 1-2 / Q / Scroll • Eşya: E
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowControlsModal(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer self-start md:self-auto"
            >
              <span>Detaylı Tuş Rehberi</span>
              <span className="font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-amber-400">[H]</span>
            </button>
          </div>

          {/* Lobby Bottom Controls */}
          <div className="mt-auto pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              <span>Masa başlatıldığında 3 saniyelik geri sayım devreye girer.</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {currentRoom.hostId === currentUserId ? (
                <button
                  onClick={handleStartGame}
                  disabled={currentRoom.players.length < 2}
                  className={`w-full sm:w-auto px-8 py-3 rounded-2xl font-black text-sm transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                    currentRoom.players.length >= 2
                      ? 'bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:scale-105 text-white shadow-orange-500/25 animate-pulse'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Flame size={18} />
                  <span>🔥 OYUNU BAŞLAT</span>
                </button>
              ) : (
                <button
                  onClick={handleToggleReady}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {currentRoom.players.find((p: any) => p.userId === currentUserId)?.ready ? 'Hazır İptal' : 'Hazırım!'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ACTIVE GAME SCREEN & CANVAS VIEW */}
      {/* ========================================================================= */}
      {view === 'game' && (
        <div className="w-full h-full relative flex flex-col overflow-hidden">
          {/* Canvas Viewport */}
          <canvas
            ref={canvasRef}
            className="w-full h-full block cursor-crosshair touch-none"
            style={{ touchAction: 'none' }}
          />

          {/* HUD LAYER: TOP BAR */}
          <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 pointer-events-none flex items-start justify-between gap-3 z-20">
            {/* Top Left: HP, Shield & Buffs */}
            <div className="pointer-events-auto flex flex-col gap-2 p-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-800/80 shadow-xl min-w-[190px]">
              {/* Shield Bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px] font-mono font-bold text-cyan-400">
                  <span className="flex items-center gap-1"><Shield size={11} /> Zırh</span>
                  <span>{myPlayer?.shield || 0} / 100</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, myPlayer?.shield || 0))}%` }}
                  />
                </div>
              </div>

              {/* Health Bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px] font-mono font-bold text-emerald-400">
                  <span>Can (HP)</span>
                  <span>{myPlayer?.hp || 0} / 100</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      (myPlayer?.hp || 0) > 50 ? 'bg-emerald-500' : (myPlayer?.hp || 0) > 25 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, myPlayer?.hp || 0))}%` }}
                  />
                </div>
              </div>

              {/* Active Buffs (Adrenaline / Rage) */}
              {myPlayer && (myPlayer.speedBuffEndTime > Date.now() || myPlayer.rageBuffEndTime > Date.now()) && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800">
                  {myPlayer.speedBuffEndTime > Date.now() && (
                    <span className="px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-300 font-bold text-[10px] flex items-center gap-1">
                      ⚡ +%35 Hız ({Math.ceil((myPlayer.speedBuffEndTime - Date.now()) / 1000)}s)
                    </span>
                  )}
                  {myPlayer.rageBuffEndTime > Date.now() && (
                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 font-bold text-[10px] flex items-center gap-1">
                      🔥 +%50 Hasar ({Math.ceil((myPlayer.rageBuffEndTime - Date.now()) / 1000)}s)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Top Center: Timer (Deathmatch) or Alive Count (Royale) */}
            <div className="flex flex-col items-center gap-1.5">
              {gameStateRef.current?.mode === 'deathmatch' ? (
                <div className={`px-4 py-1.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl flex items-center gap-2 font-mono font-black text-sm ${
                  (gameStateRef.current?.matchTimeRemaining || 0) <= 30 ? 'text-red-400 border-red-500/50 animate-pulse' : 'text-white'
                }`}>
                  <Clock size={16} className={ (gameStateRef.current?.matchTimeRemaining || 0) <= 30 ? 'text-red-400' : 'text-cyan-400' } />
                  <span>⏱️ {formatTime(gameStateRef.current?.matchTimeRemaining || 0)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-800/80 shadow-xl text-xs font-black">
                  <span className="text-white flex items-center gap-1">
                    <Users size={14} className="text-emerald-400" />
                    <span>Kalan: <strong className="text-emerald-400 font-mono">{aliveCount} / {totalCount}</strong></span>
                  </span>
                </div>
              )}

              {zoneWarning && (
                <div className="px-3.5 py-1 rounded-xl bg-purple-600/90 text-white text-xs font-black animate-bounce shadow-lg shadow-purple-600/30">
                  {zoneWarning}
                </div>
              )}
            </div>

            {/* Top Right: Live Scoreboard, Minimap & Control Buttons */}
            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setControlMode(prev => prev === 'touch' ? 'desktop' : 'touch')}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Kontrol Modu Seç"
                >
                  {controlMode === 'touch' ? '📱 Dokunmatik' : '⌨️ Klavye'}
                </button>

                <button
                  onClick={() => setShowControlsModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-amber-500/40 text-[11px] font-bold text-amber-300 hover:text-amber-100 hover:border-amber-400 transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                  title="Tuş Kılavuzu (H / F1)"
                >
                  <Keyboard size={13} className="text-amber-400" />
                  <span>Tuşlar [H]</span>
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Tam Ekran"
                >
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                <button
                  onClick={handleLeaveRoom}
                  className="p-1.5 rounded-xl bg-red-950/80 border border-red-800 text-red-300 hover:text-red-100 transition-colors cursor-pointer"
                  title="Ayrıl"
                >
                  ✕
                </button>
              </div>

              {/* Deathmatch Live Scoreboard (Leaderboard) */}
              {gameStateRef.current?.mode === 'deathmatch' && (
                <div className="p-2.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-xl min-w-[170px] space-y-1">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-slate-800 pb-1">
                    <span>🏆 Skor Tablosu</span>
                    <span>Kill</span>
                  </div>
                  {sortedScoreboard.slice(0, 4).map((p, rank) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between text-xs font-bold py-0.5 ${
                        p.userId === currentUserId ? 'text-amber-300' : 'text-slate-300'
                      }`}
                    >
                      <span className="truncate max-w-[110px]">
                        {rank + 1}. {p.username}
                      </span>
                      <span className="font-mono font-black text-red-400">{p.kills}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Radar Minimap */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
                {gameStateRef.current?.mode === 'royale' && gameStateRef.current?.zone && (
                  <>
                    <div
                      className="absolute rounded-full border border-purple-400/80 pointer-events-none"
                      style={{
                        left: `${(gameStateRef.current.zone.currentX / MAP_SIZE) * 100}%`,
                        top: `${(gameStateRef.current.zone.currentY / MAP_SIZE) * 100}%`,
                        width: `${(gameStateRef.current.zone.currentRadius * 2 / MAP_SIZE) * 100}%`,
                        height: `${(gameStateRef.current.zone.currentRadius * 2 / MAP_SIZE) * 100}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                    <div
                      className="absolute rounded-full border border-dashed border-white/90 pointer-events-none"
                      style={{
                        left: `${(gameStateRef.current.zone.targetX / MAP_SIZE) * 100}%`,
                        top: `${(gameStateRef.current.zone.targetY / MAP_SIZE) * 100}%`,
                        width: `${(gameStateRef.current.zone.targetRadius * 2 / MAP_SIZE) * 100}%`,
                        height: `${(gameStateRef.current.zone.targetRadius * 2 / MAP_SIZE) * 100}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                  </>
                )}

                {myPlayer && (
                  <div
                    className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-slate-950 absolute pointer-events-none z-10"
                    style={{
                      left: `${(myPlayer.x / MAP_SIZE) * 100}%`,
                      top: `${(myPlayer.y / MAP_SIZE) * 100}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* FLOATING NEARBY LOOT / WEAPON SWAP PROMPT */}
          {nearbyGroundWeapon && myPlayer?.isAlive && myPlayer.weapons.length >= 2 && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-auto z-20 flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-amber-500/80 shadow-2xl text-xs font-bold text-white animate-bounce">
              <button
                onClick={() => socket?.emit('royale:input', { swapWeapon: true })}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black cursor-pointer shadow-md"
              >
                <kbd className="px-1.5 py-0.5 rounded bg-slate-950/20 font-mono text-[10px]">E</kbd>
                <span>Silahı Değiştir: {WEAPON_CONFIGS[nearbyGroundWeapon.type.replace('weapon_', '')]?.name}</span>
              </button>
            </div>
          )}

          {/* HUD LAYER: BOTTOM DUAL WEAPON SLOTS */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto z-20 flex items-center gap-3">
            {/* Slot 1 & Slot 2 Interactive Cards */}
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl">
              {[0, 1].map(slotIdx => {
                const wName = myPlayer?.weapons[slotIdx];
                const isActive = myPlayer?.activeWeaponSlot === slotIdx;
                const cfg = wName ? WEAPON_CONFIGS[wName] : null;

                return (
                  <button
                    key={slotIdx}
                    disabled={!wName}
                    onClick={() => handleSwitchWeaponSlot(slotIdx)}
                    className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2.5 min-w-[130px] cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-105 font-black border border-amber-300'
                        : wName
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 font-bold border border-slate-700'
                        : 'bg-slate-950/40 text-slate-600 border border-dashed border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black ${
                      isActive ? 'bg-slate-950 text-amber-400' : 'bg-slate-700 text-slate-300'
                    }`}>
                      {slotIdx + 1}
                    </span>

                    <div className="text-left flex-1 min-w-0">
                      <span className="text-xs truncate block">
                        {cfg ? cfg.name : 'Boş Slot'}
                      </span>
                      {cfg && wName && (
                        <span className={`text-[10px] font-mono block ${isActive ? 'text-slate-950' : 'text-slate-400'}`}>
                          {myPlayer?.isReloading && isActive ? (
                            'Yenileniyor...'
                          ) : (
                            `${myPlayer?.ammo[wName] ?? 0} / ${myPlayer?.reserveAmmo[wName] ?? 0}`
                          )}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Quick Reload Button */}
              <button
                onClick={() => socket?.emit('royale:input', { reload: true })}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 border border-slate-700"
                title="Şarjör Doldur (R)"
              >
                <kbd className="px-1.5 py-0.5 rounded bg-slate-900 font-mono text-[10px] text-amber-400 font-black">R</kbd>
                <span>Doldur</span>
              </button>
            </div>
          </div>

          {/* DESKTOP KEYBOARD CONTROLS SHORTCUT BAR (CENTER BOTTOM HINT) */}
          {controlMode === 'desktop' && (
            <div className="absolute bottom-18 left-1/2 -translate-x-1/2 pointer-events-auto z-20 hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-[11px] text-slate-300 shadow-xl">
              <span className="text-slate-400"><kbd className="px-1 py-0.2 rounded bg-slate-800 text-white font-mono text-[10px]">WASD</kbd> Hareket</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-bold"><kbd className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">↑↓←→</kbd> Nişan & Ateş</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400"><kbd className="px-1 py-0.2 rounded bg-slate-800 text-white font-mono text-[10px]">1-2 / Q</kbd> Silah</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400"><kbd className="px-1 py-0.2 rounded bg-slate-800 text-white font-mono text-[10px]">E</kbd> Eşya Al</span>
              <span className="text-slate-600">•</span>
              <button
                onClick={() => setShowControlsModal(true)}
                className="text-amber-400 hover:text-amber-300 font-bold ml-1 cursor-pointer"
              >
                [H] Rehber
              </button>
            </div>
          )}

          {/* TOUCH VIRTUAL JOYSTICKS (TOUCH MODE) */}
          {controlMode === 'touch' && (
            <>
              {/* Left Analog Joystick (Movement) */}
              <div
                onTouchStart={handleTouchStartLeft}
                onTouchMove={handleTouchMoveLeft}
                onTouchEnd={handleTouchEndLeft}
                className="absolute bottom-6 left-6 w-32 h-32 rounded-full border-2 border-slate-700/60 bg-slate-900/40 backdrop-blur-sm pointer-events-auto flex items-center justify-center z-20 touch-none"
              >
                <div
                  className="w-12 h-12 rounded-full bg-white/30 border border-white/50 pointer-events-none transition-transform duration-75"
                  style={{
                    transform: touchMoveOrigin.current && touchMoveCurrent.current
                      ? `translate(${Math.max(-36, Math.min(36, touchMoveCurrent.current.x - touchMoveOrigin.current.x))}px, ${Math.max(-36, Math.min(36, touchMoveCurrent.current.y - touchMoveOrigin.current.y))}px)`
                      : 'none'
                  }}
                />
              </div>

              {/* Right Analog Joystick (Aim & Shoot) */}
              <div
                onTouchStart={handleTouchStartRight}
                onTouchMove={handleTouchMoveRight}
                onTouchEnd={handleTouchEndRight}
                className="absolute bottom-6 right-6 w-32 h-32 rounded-full border-2 border-red-500/50 bg-red-950/20 backdrop-blur-sm pointer-events-auto flex items-center justify-center z-20 touch-none"
              >
                <div
                  className="w-12 h-12 rounded-full bg-red-500/40 border border-red-400 pointer-events-none transition-transform duration-75 flex items-center justify-center text-white text-[10px] font-black"
                  style={{
                    transform: touchAimOrigin.current && touchAimCurrent.current
                      ? `translate(${Math.max(-36, Math.min(36, touchAimCurrent.current.x - touchAimOrigin.current.x))}px, ${Math.max(-36, Math.min(36, touchAimCurrent.current.y - touchAimOrigin.current.y))}px)`
                      : 'none'
                  }}
                >
                  ATEŞ
                </div>
              </div>

              {/* Touch Action Buttons: Reload & Pickup */}
              <div className="absolute bottom-40 right-8 pointer-events-auto flex flex-col gap-2 z-20">
                <button
                  onTouchStart={() => socket?.emit('royale:input', { reload: true })}
                  className="w-12 h-12 rounded-2xl bg-amber-500/90 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center active:scale-90 border border-amber-400"
                >
                  R
                </button>
                <button
                  onTouchStart={() => socket?.emit('royale:input', { pickup: true, swapWeapon: true })}
                  className="w-12 h-12 rounded-2xl bg-emerald-500/90 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center active:scale-90 border border-emerald-400"
                >
                  E
                </button>
              </div>
            </>
          )}

          {/* DEATHMATCH RESPAWN COUNTDOWN OVERLAY */}
          {gameStateRef.current?.mode === 'deathmatch' && myPlayer && !myPlayer.isAlive && myPlayer.respawnAt && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
              <div className="text-center space-y-2 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl">
                <Skull className="text-red-500 animate-pulse mx-auto" size={40} />
                <h3 className="text-lg font-black text-white">Vuruldun!</h3>
                <p className="text-sm text-cyan-400 font-bold font-mono">
                  ⚡ {Math.max(1, Math.ceil((myPlayer.respawnAt - Date.now()) / 1000))} saniye içinde yeniden doğuyorsun...
                </p>
              </div>
            </div>
          )}

          {/* SPECTATOR OVERLAY (BATTLE ROYALE WHEN DEAD) */}
          {gameStateRef.current?.mode === 'royale' && myPlayer && !myPlayer.isAlive && gameStateRef.current?.status === 'playing' && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 p-3.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl flex items-center gap-3 z-30 pointer-events-auto">
              <Skull className="text-red-500 animate-pulse" size={20} />
              <div className="text-xs">
                <strong className="text-white block font-black">💀 Elendiniz (İzleyici Modu)</strong>
                <span className="text-slate-400">Hayatta kalanları takip ediyorsunuz</span>
              </div>
              <button
                onClick={() => setSpectateTargetIndex(prev => prev + 1)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
              >
                Sonraki Oyuncu →
              </button>
            </div>
          )}

          {/* 3S COUNTDOWN OVERLAY */}
          {countdownNum !== null && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
              <div className="text-7xl sm:text-8xl font-black font-mono text-amber-400 animate-ping">
                {countdownNum}
              </div>
            </div>
          )}

          {/* GAME OVER MODAL (MAÇ SONU & SKOR TABLOSU) */}
          {gameStateRef.current?.status === 'gameover' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in pointer-events-auto">
              <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto text-2xl font-black shadow-lg shadow-amber-500/30">
                  {isWinner ? '🏆' : '💀'}
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {isWinner ? 'ZAFER SENİN!' : 'MAÇ BİTTİ'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Şampiyon: <strong className="text-amber-400">{gameStateRef.current.winner?.username || 'Bilinmiyor'}</strong>
                  </p>
                </div>

                {/* Final Scoreboard Table */}
                <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden text-left">
                  <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 text-[10px] font-black uppercase text-slate-400 flex justify-between">
                    <span>Oyuncu Sıralaması</span>
                    <span>Kill / Ölüm</span>
                  </div>
                  <div className="divide-y divide-slate-900 text-xs font-bold">
                    {sortedScoreboard.map((p, rank) => (
                      <div
                        key={p.id}
                        className={`px-3 py-2 flex items-center justify-between ${
                          p.userId === currentUserId ? 'bg-amber-500/10 text-amber-300' : 'text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500">#{rank + 1}</span>
                          <span className="font-bold">{p.username}</span>
                        </div>
                        <span className="font-mono">{p.kills} Kill / {p.deaths} Ölüm</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Persistent Room Controls: Masaya Dön & Yeni El */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleLeaveRoom}
                    className="flex-1 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    Masalardan Ayrıl
                  </button>
                  <button
                    onClick={handleReturnToLobby}
                    className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    🔄 Lobiye Dön / Yeni El
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. KEYBOARD & CONTROLS GUIDE MODAL (DETAYLI TUŞ REHBERİ) */}
      {/* ========================================================================= */}
      {showControlsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
                  <Keyboard size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Klavye ve Tablet Kontrolleri Rehberi</h3>
                  <p className="text-[11px] text-slate-400">Mini Battle Royale tuş işlevleri ve kısayolları</p>
                </div>
              </div>
              <button
                onClick={() => setShowControlsModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-3.5 text-xs">
              {/* Movement */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-sm block">Sol El: Karakter Hareketi</span>
                  <p className="text-slate-400 text-[11px]">Karakteri 8 yöne akıcı ve eşit hızda hareket ettirir</p>
                </div>
                <div className="flex items-center gap-1 self-start sm:self-auto">
                  <kbd className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono font-black text-amber-400 shadow-sm text-xs">W</kbd>
                  <kbd className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono font-black text-amber-400 shadow-sm text-xs">A</kbd>
                  <kbd className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono font-black text-amber-400 shadow-sm text-xs">S</kbd>
                  <kbd className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono font-black text-amber-400 shadow-sm text-xs">D</kbd>
                </div>
              </div>

              {/* Arrow Keys Aiming & Auto Shoot */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-300 text-sm block">Sağ El: Ok Tuşlarıyla Nişan & Ateş</span>
                  <p className="text-amber-200/80 text-[11px]">Ok tuşlarına basılı tutarak 8 yöne anında nişan alıp otomatik ateş edebilirsiniz (Tablet ve Klavye için idealdir)</p>
                </div>
                <div className="flex items-center gap-1 self-start sm:self-auto">
                  <kbd className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-mono font-black shadow-sm text-xs">↑</kbd>
                  <kbd className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-mono font-black shadow-sm text-xs">↓</kbd>
                  <kbd className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-mono font-black shadow-sm text-xs">←</kbd>
                  <kbd className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-mono font-black shadow-sm text-xs">→</kbd>
                </div>
              </div>

              {/* Mouse Aim & Shoot */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-sm block">Fare ile Nişan Alma & Ateş</span>
                  <p className="text-slate-400 text-[11px]">İmleçle 360° hassas nişan alma ve Sol Tık / Boşluk ile ateş etme</p>
                </div>
                <div className="flex items-center gap-1 self-start sm:self-auto">
                  <kbd className="px-2 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800/80 font-mono font-black text-cyan-300 shadow-sm text-xs">Fare</kbd>
                  <span className="text-slate-500 mx-1">+</span>
                  <kbd className="px-2 py-1 rounded-lg bg-rose-950/80 border border-rose-800/80 font-mono font-black text-rose-300 shadow-sm text-xs">Sol Tık</kbd>
                </div>
              </div>

              {/* Loot Pickup / Swap */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-sm block">Eşya Alma & Silah Takası</span>
                  <p className="text-slate-400 text-[11px]">Yerdeki eşyaları toplar; iki slot doluyken elinizdeki silahla yerdeki silahı takas eder</p>
                </div>
                <div className="flex items-center gap-1 self-start sm:self-auto">
                  <kbd className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/80 font-mono font-black text-emerald-300 shadow-sm text-xs">E</kbd>
                  <span className="text-slate-500 mx-1">/</span>
                  <kbd className="px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/80 font-mono font-black text-emerald-300 shadow-sm text-xs">F</kbd>
                </div>
              </div>

              {/* Weapon Switching (Slot 1 & 2) */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-sm block">Çift Silah Slot Değişimi</span>
                  <p className="text-slate-400 text-[11px]">1. ve 2. silah yuvaları arasında anında geçiş yapar</p>
                </div>
                <div className="flex items-center gap-1 self-start sm:self-auto">
                  <kbd className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono font-black text-blue-400 shadow-sm text-xs">1</kbd>
                  <kbd className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono font-black text-blue-400 shadow-sm text-xs">2</kbd>
                  <span className="text-slate-500 mx-1">/</span>
                  <kbd className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono font-black text-purple-300 shadow-sm text-xs">Q</kbd>
                </div>
              </div>

              {/* Reload */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-bold text-white text-sm block">Şarjör Doldurma</span>
                  <p className="text-slate-400 text-[11px]">Yedek mermilerden mevcut silaha tam şarjör doldurur</p>
                </div>
                <div className="flex items-center gap-1 self-start sm:self-auto">
                  <kbd className="px-2.5 py-1 rounded-lg bg-amber-950/80 border border-amber-800/80 font-mono font-black text-amber-300 shadow-sm text-xs">R</kbd>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
              <button
                onClick={() => setShowControlsModal(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Anladım, Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
