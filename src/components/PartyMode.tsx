import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Trophy, Users, Play, Plus, Trash2, CheckCircle2, ArrowLeft, 
  Crown, Sparkles, Flame, Shield, Flag, Coins, Crosshair, 
  Music, Palette, RefreshCw, Zap, Volume2, Award, Clock, Gamepad2
} from 'lucide-react';
import Avatar from './Avatar';
import { MINI_GAMES_CATALOG, MiniGameType, MiniGameMeta, PartyGameState } from '../server/partyServer';

interface PartyPlayer {
  id: string;
  userId: number;
  username: string;
  avatar: string | null;
  color: string;
  isBot: boolean;
  isHost: boolean;
  ready: boolean;
  totalScore: number;
  roundScore: number;
  rank: number;
  x: number;
  y: number;
  angle: number;
  targetAngle?: number;
  isAlive: boolean;
  isAction: boolean;
  isDash: boolean;
  zHeight: number;
  coinsCollected: number;
  lapsCompleted: number;
  hasBomb: boolean;
  hasDodgeball?: boolean;
  sniperAmmo: number;
  skidmarks?: { x: number; y: number; alpha: number }[];
}

interface PartyPublicState {
  id: string;
  title?: string;
  capacity?: number;
  state: PartyGameState;
  stateTimer: number;
  currentRound: number;
  totalRounds: number;
  activeGameType: MiniGameType | null;
  activeGameMeta: MiniGameMeta | null;
  gameTimeRemaining: number;
  musicPlaying?: boolean;
  roundWinners: { userId: number; username: string; pointsAwarded: number; rank: number }[];
  players: PartyPlayer[];
  tankWalls?: { x: number; y: number; w: number; h: number }[];
  tankBullets?: { id: string; x: number; y: number; color: string }[];
  raceCheckpoints?: { x: number; y: number; radius: number; index: number }[];
  hexTiles?: { id: string; x: number; y: number; radius: number; state: 'solid' | 'shaking' | 'cracked' | 'void' }[];
  dodgeballs?: { id: string; x: number; y: number; heldBy: string | null; color: string }[];
  blackoutBullets?: { id: string; x: number; y: number; color: string }[];
  lavaShockwaves?: { id: string; x: number; y: number; currentRadius: number }[];
  coins?: { id: string; x: number; y: number; value: number }[];
}

interface RoomItem {
  id: string;
  title: string;
  hostId: number;
  hostName: string;
  hostAvatar: string | null;
  playerCount: number;
  capacity: number;
  totalRounds: number;
  currentRound: number;
  state: PartyGameState;
  activeGameTitle: string | null;
  createdAt: number;
}

interface PartyModeProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  onUserClick?: (id: number) => void;
  onBack: () => void;
}

export default function PartyMode({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  onUserClick,
  onBack
}: PartyModeProps) {
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [currentRoom, setCurrentRoom] = useState<PartyPublicState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState(`${username}'in Partisi`);
  const [newCapacity, setNewCapacity] = useState(8);
  const [newTotalRounds, setNewTotalRounds] = useState(5);
  const [activeTab, setActiveTab] = useState<'lobby' | 'rules'>('lobby');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<PartyPublicState | null>(null);
  const keysPressed = useRef<Record<string, boolean>>({});
  const mousePos = useRef<{ x: number; y: number }>({ x: 450, y: 300 });
  const isMouseDown = useRef(false);

  // Fetch rooms list
  const fetchRooms = () => {
    if (!socket) return;
    socket.emit('party:get_rooms', (roomList: RoomItem[]) => {
      setRooms(roomList || []);
    });
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 4000);
    return () => clearInterval(interval);
  }, [socket]);

  // Socket Listeners
  useEffect(() => {
    if (!socket) return;

    const onRoomsList = (list: RoomItem[]) => {
      setRooms(list || []);
    };

    const onRoomState = (state: any) => {
      setCurrentRoom(prev => ({
        ...prev,
        ...state,
        players: state.players || prev?.players || []
      }));
      gameStateRef.current = {
        ...gameStateRef.current,
        ...state,
        players: state.players || gameStateRef.current?.players || []
      } as PartyPublicState;
    };

    const onGameState = (state: PartyPublicState) => {
      gameStateRef.current = state;
      setCurrentRoom(state);
    };

    socket.on('party:rooms_list', onRoomsList);
    socket.on('party:room_state', onRoomState);
    socket.on('party:game_state', onGameState);

    return () => {
      socket.off('party:rooms_list', onRoomsList);
      socket.off('party:room_state', onRoomState);
      socket.off('party:game_state', onGameState);
    };
  }, [socket]);

  // Keyboard and Mouse Event Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      keysPressed.current[e.code] = true;
      if (e.key) keysPressed.current[e.key.toLowerCase()] = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
      if (e.key) keysPressed.current[e.key.toLowerCase()] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = 900 / rect.width;
      const scaleY = 600 / rect.height;
      mousePos.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    };

    const onMouseDown = () => { isMouseDown.current = true; };
    const onMouseUp = () => { isMouseDown.current = false; };

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
    };
  }, []);

  // Client Input Emit Loop (30 FPS)
  useEffect(() => {
    if (!socket || !currentRoom || currentRoom.state !== 'PLAYING') return;

    const timer = setInterval(() => {
      const myPlayer = gameStateRef.current?.players?.find(p => p.userId === currentUserId);
      if (!myPlayer || !myPlayer.isAlive) return;

      const up = keysPressed.current['KeyW'] || keysPressed.current['ArrowUp'] || keysPressed.current['w'];
      const down = keysPressed.current['KeyS'] || keysPressed.current['ArrowDown'] || keysPressed.current['s'];
      const left = keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft'] || keysPressed.current['a'];
      const right = keysPressed.current['KeyD'] || keysPressed.current['ArrowRight'] || keysPressed.current['d'];
      const action = keysPressed.current['KeyE'] || keysPressed.current['Space'] || keysPressed.current['e'] || isMouseDown.current;
      const dash = keysPressed.current['ShiftLeft'] || keysPressed.current['ShiftRight'];

      const mouseAngle = Math.atan2(mousePos.current.y - myPlayer.y, mousePos.current.x - myPlayer.x);

      socket.emit('party:input', {
        up: Boolean(up),
        down: Boolean(down),
        left: Boolean(left),
        right: Boolean(right),
        action: Boolean(action),
        dash: Boolean(dash),
        mouseAngle,
        isShooting: isMouseDown.current
      });
    }, 1000 / 30);

    return () => clearInterval(timer);
  }, [socket, currentRoom?.state, currentUserId]);

  // Main Canvas Render Loop (60 FPS)
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      const state = gameStateRef.current;
      if (canvas && state && (state.state === 'PLAYING' || state.state === 'GAME_REVEAL' || state.state === 'SCOREBOARD')) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawPartyGame(ctx, state, currentUserId);
        }
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [currentUserId]);

  // Canvas Drawing Routine
  const drawPartyGame = (ctx: CanvasRenderingContext2D, state: PartyPublicState, myUserId: number) => {
    const W = 900;
    const H = 600;

    // 1. Background clearing
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Subtle Tactical Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    const gType = state.activeGameType;

    // Helper: Draw Hexagon
    const drawHex = (hx: number, hy: number, rad: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + (Math.PI / 6);
        const px = hx + rad * Math.cos(a);
        const py = hy + rad * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    // 2. Specific Game Background Elements
    if (gType === 'tank_trouble' && state.tankWalls) {
      // Maze Walls
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      for (const w of state.tankWalls) {
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      }

      // Ricochet Bullets
      if (state.tankBullets) {
        for (const b of state.tankBullets) {
          ctx.save();
          ctx.fillStyle = b.color || '#facc15';
          ctx.shadowColor = b.color || '#facc15';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    } else if (gType === 'micro_racing') {
      // Top-Down Race Track Outer & Inner Curbs
      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(450, 300, 360, 230, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner Grass / Infield
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.ellipse(450, 300, 200, 110, 0, 0, Math.PI * 2);
      ctx.fill();

      // Start/Finish Line Checker
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(440, 70, 20, 120);
      ctx.fillStyle = '#000000';
      ctx.fillRect(440, 70, 10, 60);
      ctx.fillRect(450, 130, 10, 60);

      // Checkpoints Indicator
      if (state.raceCheckpoints) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.setLineDash([6, 6]);
        for (const cp of state.raceCheckpoints) {
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.restore();
    } else if (gType === 'hex_a_gone' && state.hexTiles) {
      // Hexagonal Falling Platform Tiles
      for (const tile of state.hexTiles) {
        if (tile.state === 'void') continue;
        ctx.save();
        if (tile.state === 'solid') {
          ctx.fillStyle = '#4338ca';
          ctx.strokeStyle = '#818cf8';
        } else if (tile.state === 'shaking') {
          ctx.fillStyle = '#d97706';
          ctx.strokeStyle = '#fbbf24';
        } else {
          ctx.fillStyle = '#dc2626';
          ctx.strokeStyle = '#f87171';
        }
        ctx.lineWidth = 2;
        drawHex(tile.x, tile.y, tile.radius);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (gType === 'dodgeball') {
      // Dodgeball Court
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 4;
      ctx.strokeRect(50, 50, W - 100, H - 100);
      ctx.beginPath();
      ctx.moveTo(W / 2, 50);
      ctx.lineTo(W / 2, H - 50);
      ctx.stroke();
      ctx.restore();

      // Dodgeball items
      if (state.dodgeballs) {
        for (const ball of state.dodgeballs) {
          ctx.save();
          ctx.fillStyle = ball.color || '#f97316';
          ctx.shadowColor = '#f97316';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      }
    } else if (gType === 'blackout') {
      // Blackout Bullets
      if (state.blackoutBullets) {
        for (const b of state.blackoutBullets) {
          ctx.save();
          ctx.fillStyle = b.color || '#38bdf8';
          ctx.shadowColor = b.color || '#38bdf8';
          ctx.shadowBlur = 14;
          ctx.beginPath();
          ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    } else if (gType === 'lava_survival') {
      // Lava floor ambient
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(40, 40, W - 80, H - 80);

      // Shockwaves
      if (state.lavaShockwaves) {
        for (const sw of state.lavaShockwaves) {
          ctx.save();
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 8;
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.currentRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    } else if (gType === 'sumo_push') {
      // Slippery Ice Platform
      ctx.save();
      ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.arc(450, 300, 260, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
    } else if (gType === 'bomb_tag') {
      // Bomb Tag arena border warning
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 12]);
      ctx.strokeRect(40, 40, W - 80, H - 80);
      ctx.restore();
    } else if (gType === 'coin_dash' && state.coins) {
      // Shiny Coins
      for (const c of state.coins) {
        ctx.save();
        ctx.fillStyle = c.value > 1 ? '#fbbf24' : '#f59e0b';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.value > 1 ? 14 : 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', c.x, c.y + 4);
        ctx.restore();
      }
    }

    // 3. Render Players
    state.players.forEach(p => {
      if (!p.isAlive) {
        // Skull marker for eliminated players
        ctx.save();
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💀', p.x, p.y + 6);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(p.username, p.x, p.y + 24);
        ctx.restore();
        return;
      }

      ctx.save();
      const renderY = p.y - (p.zHeight || 0);

      // Render Skidmarks for Micro Racing
      if (p.skidmarks && p.skidmarks.length > 0) {
        for (const sm of p.skidmarks) {
          ctx.fillStyle = `rgba(0, 0, 0, ${sm.alpha * 0.4})`;
          ctx.fillRect(sm.x - 3, sm.y - 3, 6, 6);
        }
      }

      // Draw Vehicle / Tank / Player Body
      if (gType === 'tank_trouble') {
        // Tank Hull
        ctx.translate(p.x, renderY);
        ctx.rotate(p.angle);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-16, -14, 32, 28);
        ctx.fillStyle = p.color;
        ctx.fillRect(-12, -10, 24, 20);

        // Turret facing target angle
        ctx.rotate(-p.angle);
        const turretAngle = typeof p.targetAngle === 'number' ? p.targetAngle : p.angle;
        ctx.rotate(turretAngle);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(0, -3, 18, 6);
      } else if (gType === 'micro_racing') {
        // Race Car Body
        ctx.translate(p.x, renderY);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(-16, -10, 32, 20, [4]);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Windshield & Wheels
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, -7, 6, 14);
        ctx.fillStyle = '#000000';
        ctx.fillRect(-14, -12, 8, 4);
        ctx.fillRect(6, -12, 8, 4);
        ctx.fillRect(-14, 8, 8, 4);
        ctx.fillRect(6, 8, 8, 4);
      } else {
        // Standard Character Circle
        ctx.translate(p.x, renderY);

        // Bomb indicator
        if (p.hasBomb) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(0, 0, 28, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('💣', 0, -22);
        }

        // Dodgeball in hand
        if (p.hasDodgeball) {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(16, -10, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Sniper Laser Line
        if (gType === 'sniper_arena' && p.sniperAmmo > 0) {
          ctx.save();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          const aimAng = typeof p.targetAngle === 'number' ? p.targetAngle : p.angle;
          ctx.lineTo(Math.cos(aimAng) * 800, Math.sin(aimAng) * 800);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Player Name Tag
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.username, p.x, renderY - 22);

      // Score / Lap badges above head
      if (gType === 'coin_dash') {
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`💰 ${p.coinsCollected}`, p.x, renderY - 34);
      } else if (gType === 'micro_racing') {
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`🏁 Tur: ${Math.min(3, p.lapsCompleted + 1)}/3`, p.x, renderY - 34);
      } else if (gType === 'dodgeball' && p.hasDodgeball) {
        ctx.fillStyle = '#f97316';
        ctx.fillText(`🏀 Top Sende`, p.x, renderY - 34);
      }
      ctx.restore();
    });

    // 4. Blackout Lighting Fog of War Overlay
    if (gType === 'blackout') {
      const myPlayer = state.players.find(p => p.userId === myUserId);
      if (myPlayer && myPlayer.isAlive) {
        ctx.save();
        // Create full dark overlay
        const darkCanvas = document.createElement('canvas');
        darkCanvas.width = W;
        darkCanvas.height = H;
        const dCtx = darkCanvas.getContext('2d');
        if (dCtx) {
          dCtx.fillStyle = 'rgba(5, 5, 10, 0.95)';
          dCtx.fillRect(0, 0, W, H);

          // Punch hole for player's immediate radius + flashlight cone
          dCtx.globalCompositeOperation = 'destination-out';
          
          // Immediate personal aura
          dCtx.beginPath();
          dCtx.arc(myPlayer.x, myPlayer.y, 45, 0, Math.PI * 2);
          dCtx.fill();

          // Flashlight Cone
          const aimAngle = typeof myPlayer.targetAngle === 'number' ? myPlayer.targetAngle : myPlayer.angle;
          const coneAngle = Math.PI / 4; // 45 deg cone
          dCtx.beginPath();
          dCtx.moveTo(myPlayer.x, myPlayer.y);
          dCtx.arc(myPlayer.x, myPlayer.y, 320, aimAngle - coneAngle / 2, aimAngle + coneAngle / 2);
          dCtx.closePath();
          dCtx.fill();

          ctx.drawImage(darkCanvas, 0, 0);
        }
        ctx.restore();
      }
    }

    ctx.restore();
  };

  // Actions
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !newTitle.trim()) return;
    socket.emit('party:create_room', {
      title: newTitle.trim(),
      capacity: newCapacity,
      totalRounds: newTotalRounds
    });
    setIsCreating(false);
  };

  const handleJoinRoom = (roomId: string) => {
    if (!socket) return;
    socket.emit('party:join_room', { roomId });
  };

  const handleLeaveRoom = () => {
    if (!socket) return;
    socket.emit('party:leave_room');
    setCurrentRoom(null);
  };

  const handleAddBot = () => {
    if (!socket || !currentRoom) return;
    socket.emit('party:add_bot', { roomId: currentRoom.id });
  };

  const handleRemoveBot = (botId?: number) => {
    if (!socket || !currentRoom) return;
    socket.emit('party:remove_bot', { roomId: currentRoom.id, botId });
  };

  const handleToggleReady = () => {
    if (!socket || !currentRoom) return;
    socket.emit('party:toggle_ready', { roomId: currentRoom.id });
  };

  const handleStartTournament = () => {
    if (!socket || !currentRoom) return;
    socket.emit('party:start_tournament', { roomId: currentRoom.id });
  };

  const myPlayer = currentRoom?.players.find(p => p.userId === currentUserId);
  const isHost = myPlayer?.isHost || false;

  // ============================================================
  // RENDER: LOBBY BROWSER (If not in room)
  // ============================================================
  if (!currentRoom) {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                <h1 className="text-2xl font-black bg-gradient-to-r from-amber-400 via-pink-500 to-indigo-400 bg-clip-text text-transparent">
                  PARTY MODE TURNUVA
                </h1>
              </div>
              <p className="text-xs text-slate-400">2-10 Kişilik Çok Oyunculu Mario & Pummel Party Tarzı Turnuva</p>
            </div>
          </div>

          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Yeni Parti Kur
          </button>
        </div>

        {/* Create Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                Parti Masası Oluştur
              </h2>

              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Parti Başlığı</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                    placeholder="Parti Adı"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Maksimum Oyuncu Kapasitesi ({newCapacity} Kişi)
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={10}
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                    <span>2 Oyuncu</span>
                    <span>6 Oyuncu</span>
                    <span>10 Oyuncu</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Oynanacak Mini Oyun Sayısı ({newTotalRounds} Tur)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 5, 7, 10].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setNewTotalRounds(r)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          newTotalRounds === r
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {r} Tur
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20"
                  >
                    Oluştur ve Katıl
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 10 Mini-Games Showcase Grid */}
        <div className="my-6">
          <h2 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-indigo-400" />
            Turnuva Mini Oyun Havuzu (10 Oyun)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.values(MINI_GAMES_CATALOG).map((game) => (
              <div
                key={game.id}
                className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col justify-between hover:border-slate-700 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                      {game.category}
                    </span>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                    {game.title.split('(')[0]}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                    {game.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Rooms List */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-400" />
              Aktif Parti Masaları ({rooms.length})
            </h2>
            <button
              onClick={fetchRooms}
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg border border-slate-800 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {rooms.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <Sparkles className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-400">Şu an açık parti masası yok.</p>
              <p className="text-xs text-slate-500 mt-1">Yeni bir masa kurup botlarla veya arkadaşlarınla turnuva başlatabilirsin!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map(room => (
                <div
                  key={room.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-200">{room.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        room.state === 'LOBBY' 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      }`}>
                        {room.state === 'LOBBY' ? 'Lobi Bekliyor' : 'Oyunda'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>👑 {room.hostName}</span>
                      <span>🎮 {room.totalRounds} Tur</span>
                      <span>👥 {room.playerCount}/{room.capacity}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={room.state !== 'LOBBY' || room.playerCount >= room.capacity}
                    className={`mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all ${
                      room.state === 'LOBBY' && room.playerCount < room.capacity
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/10'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {room.playerCount >= room.capacity ? 'Masa Dolu' : room.state !== 'LOBBY' ? 'Oyunda' : 'Odaya Katıl'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: LOBBY STATE (Room Setup & Players List)
  // ============================================================
  if (currentRoom.state === 'LOBBY') {
    return (
      <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLeaveRoom}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-100">{currentRoom.title || 'Parti Lobisi'}</h1>
              <p className="text-xs text-slate-400 font-mono">Turnuva Süresi: {currentRoom.totalRounds} Tur</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isHost && (
              <>
                <button
                  onClick={handleAddBot}
                  disabled={currentRoom.players.length >= (currentRoom.capacity || 8)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-colors"
                >
                  + Bot Ekle
                </button>
                {currentRoom.players.some(p => p.isBot) && (
                  <button
                    onClick={() => handleRemoveBot()}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded-xl text-xs font-bold border border-red-800/40 transition-colors"
                  >
                    Bot Çıkar
                  </button>
                )}
                <button
                  onClick={handleStartTournament}
                  disabled={currentRoom.players.length < 2}
                  className={`px-5 py-2 rounded-xl text-xs font-black shadow-lg transition-all ${
                    currentRoom.players.length >= 2
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  Turnuvayı Başlat 🚀
                </button>
              </>
            )}
          </div>
        </div>

        {/* Players Slot Grid (2 - 10 players) */}
        <div className="my-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              Oyuncular ({currentRoom.players.length}/{currentRoom.capacity || 8})
            </h2>
            <span className="text-xs text-slate-500">Hazır Olunduğunda Host Turnuvayı Başlatabilir</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {currentRoom.players.map((p, idx) => (
              <div
                key={p.id || idx}
                className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 flex flex-col items-center text-center relative overflow-hidden"
              >
                <div
                  className="w-1.5 h-full absolute left-0 top-0 bottom-0"
                  style={{ backgroundColor: p.color }}
                />
                
                <div className="relative mb-2">
                  <Avatar
                    url={p.avatar}
                    name={p.username}
                    color={p.color}
                    size={12}
                    className="ring-2 ring-slate-800"
                  />
                  {p.isHost && (
                    <Crown className="w-4 h-4 text-amber-400 absolute -top-1 -right-1" />
                  )}
                </div>

                <span className="text-xs font-bold text-slate-200 truncate w-full">{p.username}</span>
                <span className="text-[10px] text-slate-400">{p.isBot ? '🤖 Yapay Zeka' : 'Gerçek Oyuncu'}</span>

                <div className="mt-2.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    ✓ Hazır
                  </span>
                </div>
              </div>
            ))}

            {/* Empty Slots */}
            {Array.from({ length: Math.max(0, (currentRoom.capacity || 8) - currentRoom.players.length) }).map((_, i) => (
              <div
                key={`empty_${i}`}
                className="bg-slate-900/20 border border-dashed border-slate-800/60 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-600 min-h-[140px]"
              >
                <Users className="w-6 h-6 mb-1 opacity-40" />
                <span className="text-[11px] font-medium">Boş Koltuk</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: GAME REVEAL / PLAYING / SCOREBOARD CANVAS VIEW
  // ============================================================
  const meta = currentRoom.activeGameMeta || (currentRoom.activeGameType ? MINI_GAMES_CATALOG[currentRoom.activeGameType] : null);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden relative select-none">
      {/* Top Game Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black rounded-lg">
            Tur {currentRoom.currentRound}/{currentRoom.totalRounds}
          </span>
          <h2 className="text-sm font-black text-slate-200">{meta?.title || 'Mini Oyun'}</h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-lg text-xs font-mono font-bold text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{currentRoom.gameTimeRemaining}s</span>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="text-xs text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-950/20 rounded border border-red-900/30"
          >
            Ayrıl
          </button>
        </div>
      </div>

      {/* Main Game Stage (Canvas & Overlays) */}
      <div className="flex-1 flex items-center justify-center p-2 relative bg-slate-950">
        <canvas
          ref={canvasRef}
          width={900}
          height={600}
          className="w-full max-w-[900px] aspect-[3/2] bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl shadow-slate-950/50"
        />

        {/* 1. GAME REVEAL OVERLAY (5s Animated Intro) */}
        {currentRoom.state === 'GAME_REVEAL' && meta && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
                <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
                  Sıradaki Oyun • Tur {currentRoom.currentRound}/{currentRoom.totalRounds}
                </span>
              </div>

              <h2 className="text-2xl font-black bg-gradient-to-r from-amber-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                {meta.title}
              </h2>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                {meta.description}
              </p>

              <div>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Kontroller</h3>
                <div className="grid grid-cols-2 gap-2">
                  {meta.controls.map((ctrl: { key: string; desc: string }, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="px-2 py-0.5 bg-slate-800 text-amber-400 font-mono text-[10px] font-black rounded border border-slate-700">
                        {ctrl.key}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-300">{ctrl.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <span className="text-sm font-black text-amber-400 animate-pulse">
                  Başlıyor: {currentRoom.stateTimer}s
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 2. SCOREBOARD OVERLAY (Round Points Celebration) */}
        {currentRoom.state === 'SCOREBOARD' && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 animate-in fade-in duration-300">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400 animate-bounce" />
                <h2 className="text-xl font-black text-slate-100">TUR PUANLARI</h2>
              </div>

              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {currentRoom.players.map((p, i) => (
                  <div
                    key={p.id || i}
                    className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                        i === 0 ? 'bg-amber-400 text-slate-950' : i === 1 ? 'bg-slate-300 text-slate-950' : i === 2 ? 'bg-amber-700 text-slate-100' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-200">{p.username}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-emerald-400">+{p.roundScore} Puan</span>
                      <span className="text-xs font-mono font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {p.totalScore} Toplam
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <span className="text-xs text-slate-500">Sonraki tura geçiliyor: {currentRoom.stateTimer}s</span>
            </div>
          </div>
        )}

        {/* 3. FINAL PODIUM OVERLAY (Grand Champion) */}
        {currentRoom.state === 'FINAL_PODIUM' && (
          <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center z-40 animate-in zoom-in-95 duration-500">
            <div className="w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
              <div>
                <Crown className="w-12 h-12 text-amber-400 mx-auto animate-bounce mb-2" />
                <h2 className="text-3xl font-black bg-gradient-to-r from-amber-300 via-amber-400 to-orange-500 bg-clip-text text-transparent">
                  TURNUVA ŞAMPİYONU!
                </h2>
                <p className="text-xs text-slate-400 mt-1">{currentRoom.totalRounds} Turun Sonunda Kazanan Belli Oldu</p>
              </div>

              {/* 3D Podium Display */}
              <div className="flex items-end justify-center gap-3 pt-4">
                {/* 2nd Place */}
                {currentRoom.players[1] && (
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-xs font-bold text-slate-300 mb-1">{currentRoom.players[1].username}</span>
                    <div className="w-full bg-slate-700/60 border border-slate-600 rounded-t-2xl h-24 flex flex-col items-center justify-center">
                      <span className="text-lg font-black text-slate-300">2</span>
                      <span className="text-[10px] text-slate-400 font-mono">{currentRoom.players[1].totalScore} Puan</span>
                    </div>
                  </div>
                )}

                {/* 1st Place Champion */}
                {currentRoom.players[0] && (
                  <div className="flex flex-col items-center flex-1">
                    <Crown className="w-6 h-6 text-amber-400 mb-1 animate-pulse" />
                    <span className="text-sm font-black text-amber-400 mb-1">{currentRoom.players[0].username}</span>
                    <div className="w-full bg-gradient-to-t from-amber-600 to-amber-500 border border-amber-300 rounded-t-2xl h-36 flex flex-col items-center justify-center shadow-lg shadow-amber-500/30">
                      <span className="text-2xl font-black text-slate-950">1</span>
                      <span className="text-xs text-slate-950 font-black">{currentRoom.players[0].totalScore} Puan</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {currentRoom.players[2] && (
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-xs font-bold text-amber-700 mb-1">{currentRoom.players[2].username}</span>
                    <div className="w-full bg-amber-950/60 border border-amber-800 rounded-t-2xl h-18 flex flex-col items-center justify-center">
                      <span className="text-base font-black text-amber-600">3</span>
                      <span className="text-[10px] text-amber-500/80 font-mono">{currentRoom.players[2].totalScore} Puan</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleLeaveRoom}
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 text-slate-950 font-black rounded-xl text-sm shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
              >
                Lobiye Dön
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
