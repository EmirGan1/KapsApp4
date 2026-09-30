import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Trophy, Users, Bot, Crown, ArrowLeft, RefreshCw, Plus, Play, Shield, 
  Flame, Crosshair, Volume2, VolumeX, Maximize2, Minimize2, 
  Smartphone, Keyboard, AlertTriangle, Coins, Zap, Skull
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
  buyIn: number;
  pot: number;
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
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  activeWeapon: string;
  weapons: string[];
  ammo: Record<string, number>;
  reserveAmmo: Record<string, number>;
  isReloading: boolean;
  isAlive: boolean;
  kills: number;
  spectating: boolean;
}

interface GameState {
  id: string;
  title: string;
  status: 'lobby' | 'countdown' | 'playing' | 'gameover';
  pot: number;
  countdown: number;
  players: PlayerState[];
  bullets: Array<{ id: string; x: number; y: number; color: string; radius: number }>;
  crates: Array<{ id: string; x: number; y: number; hp: number; maxHp: number }>;
  loot: Array<{ id: string; type: string; x: number; y: number }>;
  obstacles: Array<{ id: string; type: 'rock' | 'bush'; x: number; y: number; radius: number }>;
  zone: {
    currentX: number;
    currentY: number;
    currentRadius: number;
    targetX: number;
    targetY: number;
    targetRadius: number;
    isShrinking: boolean;
    phase: number;
    damage: number;
  };
  killfeed: Array<{ id: string; killer: string; victim: string; weapon: string; time: number }>;
  winner: { id: string; userId: number; username: string; kills: number } | null;
}

export const PLAYER_PALETTE = [
  '#3b82f6', // Neon Blue (Self)
  '#ef4444', // Crimson Red
  '#10b981', // Emerald Green
  '#f59e0b', // Amber / Gold
  '#8b5cf6', // Violet Purple
  '#ec4899', // Hot Pink
  '#06b6d4', // Bright Cyan
  '#84cc16', // Lime Green
  '#f97316', // Vivid Orange
  '#e11d48'  // Rose
];

export function getPlayerColor(p: PlayerState, currentUserId: number): string {
  if (p.isBot) return '#d97706'; // Metallic amber for bots
  if (p.userId === currentUserId) return '#3b82f6'; // Bright blue for local player
  if (p.color) {
    if (p.color.startsWith('#')) return p.color;
    if (p.color.includes('purple')) return '#a855f7';
    if (p.color.includes('green')) return '#10b981';
    if (p.color.includes('red')) return '#ef4444';
    if (p.color.includes('yellow')) return '#eab308';
    if (p.color.includes('indigo')) return '#6366f1';
    if (p.color.includes('pink')) return '#ec4899';
    if (p.color.includes('cyan')) return '#06b6d4';
  }
  return PLAYER_PALETTE[Math.abs(p.userId) % PLAYER_PALETTE.length];
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
  // Navigation / View State
  const [view, setView] = useState<'rooms' | 'lobby' | 'game'>('rooms');
  const viewRef = useRef<'rooms' | 'lobby' | 'game'>('rooms');
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const [, setHudTick] = useState<number>(0);
  useEffect(() => {
    if (view !== 'game') return;
    const interval = setInterval(() => {
      setHudTick(prev => (prev + 1) % 10000);
    }, 100);
    return () => clearInterval(interval);
  }, [view]);

  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [currentRoom, setCurrentRoom] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Create Room Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createTitle, setCreateTitle] = useState<string>(`${username}'ın Arenası`);
  const [createCapacity, setCreateCapacity] = useState<number>(4);
  const [createBuyIn, setCreateBuyIn] = useState<number>(100);

  // Control Mode: 'touch' (Virtual Joystick) vs 'desktop' (WASD + Mouse)
  const [controlMode, setControlMode] = useState<'touch' | 'desktop'>(() => {
    const isMobileOrTablet = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
    return isMobileOrTablet ? 'touch' : 'desktop';
  });

  // Game UI & Fullscreen
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [countdownNum, setCountdownNum] = useState<number | null>(null);
  const [zoneWarning, setZoneWarning] = useState<string | null>(null);
  const [userChips, setUserChips] = useState<number>(() => {
    const cached = localStorage.getItem('lan_chips');
    return cached ? Number(cached) : 1000;
  });

  // Canvas Refs & Game Engine
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Input Tracking
  const keysPressed = useRef<Record<string, boolean>>({});
  const mousePos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMouseDown = useRef<boolean>(false);

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

  // Initial Rooms Load and Socket Listeners
  useEffect(() => {
    if (!socket) return;

    fetchRooms();

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

    const onGameOver = ({ winner, pot, state }: any) => {
      if (state) gameStateRef.current = state;
      setHudTick(prev => (prev + 1) % 10000);
    };

    const onChipsUpdated = (data: { userId: number; chips: number }) => {
      if (data.userId === currentUserId) {
        setUserChips(data.chips);
        localStorage.setItem('lan_chips', String(data.chips));
      }
    };

    socket.on('royale:rooms_list', onRoomsList);
    socket.on('royale:room_state', onRoomState);
    socket.on('royale:countdown', onCountdown);
    socket.on('royale:game_started', onGameStarted);
    socket.on('royale:game_state', onGameState);
    socket.on('royale:zone_warning', onZoneWarning);
    socket.on('royale:game_over', onGameOver);
    socket.on('chips_updated', onChipsUpdated);

    // Auto-join if targetTableId provided
    if (targetTableId) {
      socket.emit('royale:join_room', { roomId: targetTableId }, (res: any) => {
        if (res?.success && res.room) {
          setCurrentRoom(res.room);
          setView(res.room.status === 'playing' ? 'game' : 'lobby');
        }
      });
    }

    return () => {
      socket.off('royale:rooms_list', onRoomsList);
      socket.off('royale:room_state', onRoomState);
      socket.off('royale:countdown', onCountdown);
      socket.off('royale:game_started', onGameStarted);
      socket.off('royale:game_state', onGameState);
      socket.off('royale:zone_warning', onZoneWarning);
      socket.off('royale:game_over', onGameOver);
      socket.off('chips_updated', onChipsUpdated);
    };
  }, [socket, fetchRooms, targetTableId, currentUserId]);

  // Handle Room Creation
  const handleCreateRoom = () => {
    if (!socket) return;
    setErrorMessage('');
    socket.emit(
      'royale:create_room',
      {
        title: createTitle,
        capacity: createCapacity,
        buyIn: createBuyIn
      },
      (res: any) => {
        if (res?.success && res.room) {
          setCurrentRoom(res.room);
          setShowCreateModal(false);
          setView('lobby');
        } else {
          setErrorMessage(res?.error || 'Masa oluşturulamadı.');
        }
      }
    );
  };

  // Handle Join Room
  const handleJoinRoom = (roomId: string) => {
    if (!socket) return;
    setErrorMessage('');
    socket.emit('royale:join_room', { roomId }, (res: any) => {
      if (res?.success && res.room) {
        setCurrentRoom(res.room);
        setView('lobby');
      } else {
        setErrorMessage(res?.error || 'Masaya katılamadı.');
      }
    });
  };

  // Leave Room
  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('royale:leave_room');
    }
    setCurrentRoom(null);
    gameStateRef.current = null;
    setView('rooms');
    fetchRooms();
  };

  // Host Add Bot
  const handleAddBot = () => {
    if (!socket || !currentRoom) return;
    socket.emit('royale:add_bot', { roomId: currentRoom.id }, (res: any) => {
      if (!res?.success) setErrorMessage(res?.error || 'Bot eklenemedi.');
    });
  };

  // Host Remove Bot
  const handleRemoveBot = (botId?: string) => {
    if (!socket || !currentRoom) return;
    socket.emit('royale:remove_bot', { roomId: currentRoom.id, botId }, (res: any) => {
      if (!res?.success) setErrorMessage(res?.error || 'Bot çıkarılamadı.');
    });
  };

  // Toggle Ready
  const handleToggleReady = () => {
    if (!socket || !currentRoom) return;
    socket.emit('royale:toggle_ready', { roomId: currentRoom.id });
  };

  // Host Start Game
  const handleStartGame = () => {
    if (!socket || !currentRoom) return;
    setErrorMessage('');
    socket.emit('royale:start_game', { roomId: currentRoom.id }, (res: any) => {
      if (!res?.success) {
        setErrorMessage(res?.error || 'Oyun başlatılamadı.');
      }
    });
  };

  // Fullscreen Toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Send input tick to server at 30 FPS
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

      // 1. Keyboard & Mouse Mode (WASD, Arrow Keys, and Case-Insensitive)
      if (
        keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] ||
        keysPressed.current['W'] || keysPressed.current['w']
      ) vy -= 1;
      if (
        keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'] ||
        keysPressed.current['S'] || keysPressed.current['s']
      ) vy += 1;
      if (
        keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft'] ||
        keysPressed.current['A'] || keysPressed.current['a']
      ) vx -= 1;
      if (
        keysPressed.current['KeyD'] || keysPressed.current['ArrowRight'] ||
        keysPressed.current['D'] || keysPressed.current['d']
      ) vx += 1;

      // Normalize movement direction vector so speed is uniform
      const len = Math.hypot(vx, vy);
      if (len > 0) {
        vx = vx / len;
        vy = vy / len;
      }

      // Compute angle from canvas center in Desktop mode
      if (canvasRef.current && (controlMode === 'desktop' || isMouseDown.current)) {
        const rect = canvasRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const dx = mousePos.current.x - centerX;
        const dy = mousePos.current.y - centerY;
        if (mousePos.current.x !== 0 || mousePos.current.y !== 0) {
          angle = Math.atan2(dy, dx);
        }
      }

      if (isMouseDown.current) shooting = true;

      // 2. Touch Mode Virtual Joystick overrides
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

      socket.emit('royale:input', {
        vx,
        vy,
        angle,
        shooting
      });
    }, 1000 / 30);

    return () => clearInterval(inputTimer);
  }, [view, socket, currentUserId, controlMode]);

  // Desktop Controls Event Listeners (WASD, R, 1-4, Click)
  useEffect(() => {
    if (view !== 'game') return;

    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
      if (e.key) {
        keysPressed.current[e.key] = true;
        keysPressed.current[e.key.toUpperCase()] = true;
        keysPressed.current[e.key.toLowerCase()] = true;
      }

      if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
        socket?.emit('royale:input', { reload: true });
      } else if (e.code === 'Digit1' || e.key === '1') {
        socket?.emit('royale:input', { switchWeapon: 'pistol' });
      } else if (e.code === 'Digit2' || e.key === '2') {
        socket?.emit('royale:input', { switchWeapon: 'shotgun' });
      } else if (e.code === 'Digit3' || e.key === '3') {
        socket?.emit('royale:input', { switchWeapon: 'rifle' });
      } else if (e.code === 'Digit4' || e.key === '4') {
        socket?.emit('royale:input', { switchWeapon: 'sniper' });
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
      if (e.key) {
        keysPressed.current[e.key] = false;
        keysPressed.current[e.key.toUpperCase()] = false;
        keysPressed.current[e.key.toLowerCase()] = false;
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

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      isMouseDown.current = false;
      keysPressed.current = {};
    };
  }, [view, socket]);

  // Touch Virtual Joystick Handlers
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
  };

  const handleTouchMoveRight = (e: React.TouchEvent) => {
    if (!touchAimOrigin.current) return;
    const touch = e.touches[0];
    touchAimCurrent.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEndRight = () => {
    touchAimOrigin.current = null;
    touchAimCurrent.current = null;
  };

  // Main 60 FPS HTML5 Canvas Rendering Engine
  useEffect(() => {
    if (view !== 'game') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      const state = gameStateRef.current;
      const rect = canvas.getBoundingClientRect();
      const parentRect = canvas.parentElement?.getBoundingClientRect();
      const rawW = rect.width || parentRect?.width || window.innerWidth || 1280;
      const rawH = rect.height || parentRect?.height || (window.innerHeight - 64) || 720;
      const width = Math.max(320, Math.floor(rawW));
      const height = Math.max(240, Math.floor(rawH));

      // Handle Retina DPI scaling
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetCanvasW = Math.floor(width * dpr);
      const targetCanvasH = Math.floor(height * dpr);
      if (canvas.width !== targetCanvasW || canvas.height !== targetCanvasH) {
        canvas.width = targetCanvasW;
        canvas.height = targetCanvasH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep space void background outside the map
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, height);

      // Find focused player (self, or spectate target)
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
      if (!Number.isFinite(camX)) camX = MAP_SIZE / 2;
      if (!Number.isFinite(camY)) camY = MAP_SIZE / 2;

      // Normalized FOV calculation (1280x720 base viewport)
      const baseViewW = 1280;
      const baseViewH = 720;
      let scale = Math.max(width / baseViewW, height / baseViewH);
      if (!Number.isFinite(scale) || scale <= 0) scale = 1;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(scale, scale);
      ctx.translate(-camX, -camY);

      // ==========================================
      // 1. VIBRANT BATTLE ROYALE ARENA GROUND
      // ==========================================
      // Rich grass base
      ctx.fillStyle = '#1e3f20';
      ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

      // Checkered lush grass tiles (120x120)
      const tileSize = 120;
      for (let tx = 0; tx < MAP_SIZE; tx += tileSize) {
        for (let ty = 0; ty < MAP_SIZE; ty += tileSize) {
          if ((Math.floor(tx / tileSize) + Math.floor(ty / tileSize)) % 2 === 0) {
            ctx.fillStyle = '#244b26';
            ctx.fillRect(tx, ty, tileSize, tileSize);
          }
        }
      }

      // Tactical grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
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

      // Arena Outer Danger Perimeter (Thick hazard barrier)
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 12;
      ctx.strokeRect(0, 0, MAP_SIZE, MAP_SIZE);

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.setLineDash([24, 16]);
      ctx.strokeRect(6, 6, MAP_SIZE - 12, MAP_SIZE - 12);
      ctx.setLineDash([]);

      if (!state) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 8;
        ctx.fillText('⚡ Arena Hazırlanıyor... Sunucu Senkronizasyonu Bekleniyor', MAP_SIZE / 2, MAP_SIZE / 2);
        ctx.restore();
        ctx.restore();
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // 2. Draw Storm Zone
      const z = state.zone;
      if (z && Number.isFinite(z.currentRadius) && z.currentRadius > 0) {
        ctx.save();
        // Toxic gas exterior with pulsing purple haze
        ctx.fillStyle = 'rgba(147, 51, 234, 0.30)';
        ctx.beginPath();
        ctx.rect(0, 0, MAP_SIZE, MAP_SIZE);
        ctx.arc(z.currentX, z.currentY, Math.max(0, z.currentRadius), 0, Math.PI * 2, true);
        ctx.fill();

        // Current Zone Boundary with electrical pulse
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(z.currentX, z.currentY, Math.max(0, z.currentRadius), 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Target Next Safe Zone (White Dashed line)
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

      // 3. Draw Loot Items on Ground
      state.loot?.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);

        // Glowing aura on ground
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.fill();

        if (item.type === 'medkit') {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.roundRect(-12, -12, 24, 24, 4);
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
        } else if (item.type === 'ammo') {
          ctx.fillStyle = '#eab308';
          ctx.fillRect(-10, -7, 20, 14);
          ctx.strokeStyle = '#713f12';
          ctx.lineWidth = 2;
          ctx.strokeRect(-10, -7, 20, 14);
          ctx.fillStyle = '#713f12';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('AMMO', 0, 3);
        } else if (item.type.startsWith('weapon_')) {
          const wName = item.type.replace('weapon_', '');
          const wColor = wName === 'sniper' ? '#ec4899' : wName === 'rifle' ? '#38bdf8' : wName === 'shotgun' ? '#f97316' : '#eab308';
          ctx.fillStyle = wColor;
          ctx.beginPath();
          ctx.roundRect(-20, -8, 40, 16, 4);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(wName.toUpperCase(), 0, 4);
        }
        ctx.restore();
      });

      // 4. Draw Wooden Crates
      state.crates?.forEach(c => {
        ctx.save();
        ctx.translate(c.x, c.y);

        // Wood texture
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-22, -22, 44, 44);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        ctx.strokeRect(-20, -20, 40, 40);

        // Cross braces
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-18, -18);
        ctx.lineTo(18, 18);
        ctx.moveTo(18, -18);
        ctx.lineTo(-18, 18);
        ctx.stroke();

        // Health bar if damaged
        if (c.hp < c.maxHp) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(-20, -30, 40, 5);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(-20, -30, (c.hp / c.maxHp) * 40, 5);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 1;
          ctx.strokeRect(-20, -30, 40, 5);
        }
        ctx.restore();
      });

      // 5. Draw Solid Rocks
      state.obstacles?.forEach(obs => {
        if (obs.type === 'rock') {
          ctx.save();
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
          ctx.fill();

          // 3D stone rim highlight
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 5;
          ctx.stroke();

          // Specular shine
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.arc(obs.x - obs.radius * 0.3, obs.y - obs.radius * 0.3, obs.radius * 0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      // 6. Draw Bullets with glowing tracer trail
      state.bullets?.forEach(b => {
        ctx.save();
        ctx.fillStyle = b.color || '#fbbf24';
        ctx.shadowColor = b.color || '#fbbf24';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius || 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 7. Draw Players (Surviv.io Style with Unique Colors & Badges)
      state.players?.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);

        if (!p.isAlive) {
          // Tombstone / Grave Marker
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

        // Check if hidden in bush
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

        // Hands & Weapon rotated by player angle
        ctx.save();
        ctx.rotate(p.angle);

        const wColor = p.activeWeapon === 'sniper' ? '#ec4899' : p.activeWeapon === 'rifle' ? '#38bdf8' : p.activeWeapon === 'shotgun' ? '#f97316' : '#eab308';
        const wLength = p.activeWeapon === 'sniper' ? 38 : p.activeWeapon === 'rifle' ? 30 : p.activeWeapon === 'shotgun' ? 24 : 20;

        // Weapon Barrel
        ctx.fillStyle = wColor;
        ctx.fillRect(8, -3.5, wLength, 7);
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(8, -3.5, wLength, 7);

        // Dual Hands
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

        ctx.restore(); // restore rotation

        // Character Body (Color-Coded by Player)
        const pColor = getPlayerColor(p, currentUserId);
        ctx.fillStyle = pColor;
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.fill();

        // Dark tactical outline
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // If self: glowing cyan outer pulse ring
        if (p.userId === currentUserId) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, 0, 28, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Inner vest/tactical circle
        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();

        // Directional eye/visor dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(Math.cos(p.angle) * 12, Math.sin(p.angle) * 12, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Overhead Name & Badges
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
          const shieldW = Math.max(0, Math.min(barW, (p.shield / (p.maxShield || 100)) * barW));
          ctx.fillRect(-barW / 2, -52, shieldW, 4);
        }

        // Overhead Health Bar
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-barW / 2, -46, barW, barH);
        const hpRatio = Math.max(0, Math.min(1, p.hp / (p.maxHp || 100)));
        ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
        ctx.fillRect(-barW / 2, -46, hpRatio * barW, barH);

        // Outline for health bar
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barW / 2, -46, barW, barH);

        ctx.restore();
      });

      // 8. Draw Bushes on top (foliage covering players inside)
      state.obstacles?.forEach(obs => {
        if (obs.type === 'bush') {
          ctx.save();
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
          ctx.fill();

          // Inner leaf clusters
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(obs.x - obs.radius * 0.25, obs.y - obs.radius * 0.2, obs.radius * 0.6, 0, Math.PI * 2);
          ctx.arc(obs.x + obs.radius * 0.25, obs.y + obs.radius * 0.15, obs.radius * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
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

  // Active Player Reference for HUD
  const myPlayer = gameStateRef.current?.players.find(p => !p.isBot && p.userId === currentUserId);
  const aliveCount = gameStateRef.current?.players.filter(p => p.isAlive).length || 0;
  const totalCount = gameStateRef.current?.players.length || 0;
  const isWinner = gameStateRef.current?.winner?.userId === currentUserId;

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden relative"
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
    >
      {/* ========================================================================= */}
      {/* 1. ROOMS BROWSER VIEW (AÇIK MASALAR LİSTESİ) */}
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
                  <span>💥 2D Mini Battle Royale</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    CANLI ARENA
                  </span>
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  2-4 Kişilik masa kur, botları ekle, daralan fırtınada hayatta kal ve potu kazan!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {/* User Balance */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400">
                <Coins size={15} />
                <span>Bakiyeniz:</span>
                <span className="font-black font-mono">{userChips.toLocaleString()} Coin</span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={fetchRooms}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Masaları Yenile"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>

              {/* Create Room Button */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} />
                <span>Yeni Masa Kur</span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Rooms Grid */}
          <div className="mt-6">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <Users size={15} className="text-blue-400" />
              <span>Açık Masalar ({rooms.length})</span>
            </h2>

            {rooms.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-3">
                <Flame size={40} className="mx-auto text-slate-600 opacity-50" />
                <p className="text-sm font-semibold">Şu anda açık masa bulunmuyor.</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  İlk Masayı Siz Oluşturun 🔥
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map(room => (
                  <div
                    key={room.id}
                    className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-3 shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          room.status === 'lobby' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {room.status === 'lobby' ? 'Lobi Bekliyor' : 'Oyunda'}
                        </span>

                        <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
                          <Coins size={13} />
                          {room.buyIn === 0 ? 'Ücretsiz' : `${room.buyIn} Coin`}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base text-white truncate">{room.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <span>Yönetici: {room.hostName}</span>
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                        <Users size={14} className="text-slate-400" />
                        <span>{room.playerCount} / {room.capacity} Oyuncu</span>
                      </span>

                      <button
                        onClick={() => handleJoinRoom(room.id)}
                        disabled={room.status !== 'lobby' || room.playerCount >= room.capacity}
                        className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          room.status === 'lobby' && room.playerCount < room.capacity
                            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {room.playerCount >= room.capacity ? 'Masa Dolu' : 'Masaya Katıl'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CREATE ROOM MODAL */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6 space-y-5">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Flame className="text-amber-500" size={20} />
              <span>Yeni Battle Royale Masası Kur</span>
            </h3>

            {/* Title Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Masa Adı</label>
              <input
                type="text"
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                maxLength={30}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Capacity */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Oyuncu Kapasitesi</label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCreateCapacity(num)}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      createCapacity === num
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {num} Kişilik
                  </button>
                ))}
              </div>
            </div>

            {/* Buy-In / Pot Bet */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Giriş Ücreti (Kişi Başı Bahis)</span>
                <span className="text-[11px] text-amber-400 font-mono">Bakiye: {userChips} Coin</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 100, 250, 500, 1000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCreateBuyIn(amt)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                      createBuyIn === amt
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {amt === 0 ? '0' : amt}
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
                Masayı Oluştur
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
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    LOBİ
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Masa Sahibi: <strong className="text-amber-400">{currentRoom.hostName}</strong> • Kapasite: {currentRoom.capacity} Kişi
                </p>
              </div>
            </div>

            {/* Pot info & Control Mode Switcher */}
            <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-400">
                <Coins size={16} />
                <span>Giriş: {currentRoom.buyIn} Coin</span>
                <span>•</span>
                <span className="text-amber-300">Pot: {currentRoom.buyIn * currentRoom.players.length} Coin</span>
              </div>

              {/* Tablet / Mobile Control Mode Switcher */}
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
                  {currentRoom.players.find((p: any) => p.userId === currentUserId)?.ready ? 'Hazır Değilim' : 'Hazırım!'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. GAME PLAYING CANVAS VIEW (SURVIV.IO TARZI 2D TOP-DOWN) */}
      {/* ========================================================================= */}
      {view === 'game' && (
        <div className="flex-1 relative w-full h-full overflow-hidden bg-slate-950">
          {/* Main HTML5 Canvas */}
          <canvas
            ref={canvasRef}
            className={`w-full h-full block ${controlMode === 'desktop' ? 'cursor-crosshair' : ''}`}
          />

          {/* HUD LAYER: TOP BAR */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none z-20">
            {/* Top Left: Player Status */}
            <div className="pointer-events-auto p-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-800/80 shadow-xl space-y-2 min-w-[210px]">
              <div className="flex items-center gap-2.5">
                <Avatar
                  url={avatar}
                  name={username}
                  color={color || undefined}
                  size={9}
                />
                <div className="min-w-0">
                  <span className="font-extrabold text-xs text-white truncate block">{username}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Öldürme: <strong className="text-amber-400">{myPlayer?.kills || 0}</strong>
                  </span>
                </div>
              </div>

              {/* Shield Bar */}
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px] font-mono font-bold text-cyan-400">
                  <span>Zırh</span>
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
            </div>

            {/* Top Center: Alive Count & Pot Badge */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-800/80 shadow-xl text-xs font-black">
                <span className="text-white flex items-center gap-1">
                  <Users size={14} className="text-emerald-400" />
                  <span>Kalan: <strong className="text-emerald-400 font-mono">{aliveCount} / {totalCount}</strong></span>
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-amber-400 flex items-center gap-1 font-mono">
                  <Coins size={14} />
                  <span>Pot: {gameStateRef.current?.pot || 0} Coin</span>
                </span>
              </div>

              {zoneWarning && (
                <div className="px-3.5 py-1 rounded-xl bg-purple-600/90 text-white text-xs font-black animate-bounce shadow-lg shadow-purple-600/30">
                  {zoneWarning}
                </div>
              )}
            </div>

            {/* Top Right: Minimap & Control Mode Selector */}
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

              {/* Radar Minimap */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl relative overflow-hidden">
                {/* Minimap Safe Zone */}
                {gameStateRef.current?.zone && (
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

                {/* Player Dot */}
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

          {/* HUD LAYER: BOTTOM RIGHT WEAPON SLOTS */}
          <div className="absolute bottom-4 right-4 pointer-events-auto flex items-end gap-2 z-20">
            <div className="p-3 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-slate-800/80 shadow-xl space-y-2">
              <div className="flex items-center gap-1.5">
                {['pistol', 'shotgun', 'rifle', 'sniper'].map((wType, idx) => {
                  const hasW = myPlayer?.weapons.includes(wType);
                  const isAct = myPlayer?.activeWeapon === wType;

                  return (
                    <button
                      key={wType}
                      disabled={!hasW}
                      onClick={() => socket?.emit('royale:input', { switchWeapon: wType })}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                        isAct
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 scale-105'
                          : hasW
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          : 'bg-slate-900/50 text-slate-600 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-mono opacity-60 mr-1">{idx + 1}</span>
                      <span>{WEAPON_CONFIGS[wType]?.name.split(' ')[0] || wType}</span>
                    </button>
                  );
                })}
              </div>

              {/* Ammo Counter */}
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300 pt-1 border-t border-slate-800">
                <span className="text-amber-400 font-extrabold uppercase">
                  {WEAPON_CONFIGS[myPlayer?.activeWeapon || 'pistol']?.name}
                </span>
                <span className="text-sm">
                  {myPlayer?.isReloading ? (
                    <span className="text-amber-400 animate-pulse font-sans">Yenileniyor...</span>
                  ) : (
                    <>
                      <strong className="text-white text-base">{myPlayer?.ammo[myPlayer?.activeWeapon || 'pistol'] || 0}</strong>
                      <span className="text-slate-500"> / {myPlayer?.reserveAmmo[myPlayer?.activeWeapon || 'pistol'] || 0}</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* TOUCH CONTROLS (IF TOUCH MODE ACTIVE) */}
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
                className="absolute bottom-6 right-28 w-32 h-32 rounded-full border-2 border-red-500/50 bg-red-950/20 backdrop-blur-sm pointer-events-auto flex items-center justify-center z-20 touch-none"
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

              {/* Big Touch Action Buttons: Reload & Weapon Switch */}
              <div className="absolute bottom-36 right-6 pointer-events-auto flex flex-col gap-2 z-20">
                <button
                  onTouchStart={() => socket?.emit('royale:input', { reload: true })}
                  className="w-13 h-13 rounded-2xl bg-amber-500/80 text-slate-950 font-black text-sm shadow-lg flex items-center justify-center active:scale-90"
                >
                  R
                </button>
              </div>
            </>
          )}

          {/* SPECTATOR OVERLAY (WHEN DEAD) */}
          {myPlayer && !myPlayer.isAlive && gameStateRef.current?.status === 'playing' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 p-3.5 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl flex items-center gap-3 z-30">
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

          {/* COUNTDOWN OVERLAY */}
          {countdownNum !== null && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
              <div className="text-7xl sm:text-8xl font-black font-mono text-amber-400 animate-ping">
                {countdownNum}
              </div>
            </div>
          )}

          {/* GAME OVER & VICTORY ROYALE MODAL */}
          {gameStateRef.current?.status === 'gameover' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-sm bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto text-2xl font-black shadow-lg shadow-amber-500/30">
                  {isWinner ? '🏆' : '💀'}
                </div>

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    {isWinner ? 'ZAFER SENİN!' : 'OYUN BİTTİ'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Kazanan: <strong className="text-amber-400">{gameStateRef.current.winner?.username || 'Bilinmiyor'}</strong>
                  </p>
                </div>

                {isWinner && gameStateRef.current.pot > 0 && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 font-black text-sm">
                    🪙 +{gameStateRef.current.pot} Coin Hesabınıza Eklendi!
                  </div>
                )}

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleLeaveRoom}
                    className="flex-1 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    Masalara Dön
                  </button>
                  <button
                    onClick={() => {
                      if (currentRoom) {
                        setView('lobby');
                      } else {
                        handleLeaveRoom();
                      }
                    }}
                    className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 text-slate-950 text-xs font-black transition-all cursor-pointer"
                  >
                    Lobiye Dön
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
