import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import {
  Users,
  Trophy,
  Volume2,
  VolumeX,
  ArrowLeft,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Play,
  RotateCcw,
  Shield,
  Eye,
  Crosshair,
  Sparkles,
  HelpCircle,
  Clock,
  Layers,
  CircleDot
} from 'lucide-react';
import {
  Ball,
  BALL_RADIUS,
  TABLE_WIDTH,
  TABLE_HEIGHT,
  CUSHION_WIDTH,
  PLAY_MIN_X,
  PLAY_MAX_X,
  PLAY_MIN_Y,
  PLAY_MAX_Y,
  POCKETS,
  BALL_COLORS,
  Vector2D,
  stepPhysics,
  calculateAimTrajectory,
  AimTrajectory,
  BallGroupType,
  dist
} from '../utils/billiardsEngine';
import { billiardsAudio } from '../utils/billiardsAudio';
import Avatar from './Avatar';

export interface BilliardsPlayer {
  id: number;
  username: string;
  avatar: string | null;
  color?: string | null;
  socketId?: string;
}

export interface BilliardsRoomState {
  roomCode: string;
  name: string;
  hostId: number;
  player1: BilliardsPlayer;
  player2: BilliardsPlayer | null;
  spectators: BilliardsPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  currentTurnPlayerId: number;
  assignedGroups: { [userId: number]: BallGroupType } | null;
  pocketedBalls: number[];
  cueBallInHand: boolean;
  inHandPlayerId: number | null;
  foulMessage: string | null;
  winnerId: number | null;
  loserId: number | null;
  balls: Ball[];
  turnTimeRemaining: number;
  isSimulating: boolean;
  shotCount: number;
}

interface BilliardsGameProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  onBack: () => void;
}

export default function BilliardsGame({
  socket,
  currentUserId,
  username,
  avatar = null,
  color = null,
  onBack
}: BilliardsGameProps) {
  // Lobby state
  const [view, setView] = useState<'lobby' | 'game'>('lobby');
  const [roomList, setRoomList] = useState<any[]>([]);
  const [loadingRooms, setLoadingRooms] = useState<boolean>(false);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [roomNameInput, setRoomNameInput] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [feltColor, setFeltColor] = useState<'green' | 'blue' | 'burgundy'>('green');
  const [isMuted, setIsMuted] = useState<boolean>(billiardsAudio.getMuted());
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  // Active Game State
  const [room, setRoom] = useState<BilliardsRoomState | null>(null);
  const [myRole, setMyRole] = useState<'player1' | 'player2' | 'spectator'>('spectator');
  const [balls, setBalls] = useState<Ball[]>([]);

  // Cue Stick, Aim & Power
  const [aimAngle, setAimAngle] = useState<number>(0);
  const [isAiming, setIsAiming] = useState<boolean>(false);
  const [pullBackPower, setPullBackPower] = useState<number>(0); // 0 to 1
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [ballSpin, setBallSpin] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // -1 to 1

  // Ball-in-hand placement
  const [isDraggingCueBall, setIsDraggingCueBall] = useState<boolean>(false);

  // Local physics simulation refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isSimulatingRef = useRef<boolean>(false);
  const ballsRef = useRef<Ball[]>([]);
  const firstContactRef = useRef<Ball | null>(null);
  const cushionHitRef = useRef<boolean>(false);
  const pocketedThisShotRef = useRef<number[]>([]);
  const lastSyncAngleRef = useRef<number>(0);

  // Sound toggle
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    billiardsAudio.setMuted(next);
  };

  // Keep ballsRef in sync
  useEffect(() => {
    ballsRef.current = balls;
  }, [balls]);

  // Request room list on mount
  const refreshRooms = useCallback(() => {
    if (!socket) return;
    setLoadingRooms(true);
    socket.emit('billiards:get_rooms', (list: any[]) => {
      setRoomList(list || []);
      setLoadingRooms(false);
    });
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    refreshRooms();

    const onRoomList = (list: any[]) => {
      setRoomList(list || []);
      setLoadingRooms(false);
    };

    socket.on('billiards:rooms_list', onRoomList);
    return () => {
      socket.off('billiards:rooms_list', onRoomList);
    };
  }, [socket, refreshRooms]);

  // Handle Socket Events for Active Game
  useEffect(() => {
    if (!socket) return;

    const onGameState = (updatedRoom: BilliardsRoomState) => {
      setRoom(updatedRoom);
      if (!isSimulatingRef.current) {
        setBalls(updatedRoom.balls);
        ballsRef.current = updatedRoom.balls;
      }

      // Determine role
      if (updatedRoom.player1.id === currentUserId) {
        setMyRole('player1');
      } else if (updatedRoom.player2 && updatedRoom.player2.id === currentUserId) {
        setMyRole('player2');
      } else {
        setMyRole('spectator');
      }

      // Play audio on win/foul
      if (updatedRoom.status === 'finished' && updatedRoom.winnerId) {
        if (updatedRoom.winnerId === currentUserId) {
          billiardsAudio.playWin();
        } else {
          billiardsAudio.playFoul();
        }
      } else if (updatedRoom.foulMessage) {
        billiardsAudio.playFoul();
      }
    };

    const onShotStarted = (data: {
      angle: number;
      power: number;
      spin?: { x: number; y: number };
      cueBallVel: { vx: number; vy: number };
    }) => {
      billiardsAudio.playCueHit(data.power);

      // Apply initial impulse to cue ball
      const cue = ballsRef.current.find((b) => b.id === 0);
      if (cue && !cue.isPocketed) {
        cue.vx = data.cueBallVel.vx;
        cue.vy = data.cueBallVel.vy;
      }

      // Start local physics loop
      startPhysicsSimulation();
    };

    const onAimUpdate = (data: { angle: number; power: number }) => {
      // If someone else is aiming, update the visual
      if (room && room.currentTurnPlayerId !== currentUserId) {
        setAimAngle(data.angle);
        setPullBackPower(data.power);
      }
    };

    const onTimerTick = (data: { timeRemaining: number }) => {
      setRoom((prev) => (prev ? { ...prev, turnTimeRemaining: data.timeRemaining } : null));
    };

    socket.on('billiards:game_state', onGameState);
    socket.on('billiards:shot_started', onShotStarted);
    socket.on('billiards:aim_update', onAimUpdate);
    socket.on('billiards:timer_tick', onTimerTick);

    return () => {
      socket.off('billiards:game_state', onGameState);
      socket.off('billiards:shot_started', onShotStarted);
      socket.off('billiards:aim_update', onAimUpdate);
      socket.off('billiards:timer_tick', onTimerTick);
    };
  }, [socket, currentUserId, room]);

  // Create Room
  const handleCreateRoom = () => {
    if (!socket) return;
    const player: BilliardsPlayer = {
      id: currentUserId,
      username,
      avatar,
      color
    };

    socket.emit(
      'billiards:create_room',
      {
        name: roomNameInput.trim() || undefined,
        user: player
      },
      (res: any) => {
        if (res.error) {
          alert(res.error);
          return;
        }
        setRoom(res.room);
        setBalls(res.room.balls);
        setMyRole('player1');
        setView('game');
      }
    );
  };

  // Join Room
  const handleJoinRoom = (codeToJoin?: string) => {
    if (!socket) return;
    const code = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!code) {
      alert('Lütfen geçerli bir oda kodu girin.');
      return;
    }

    const player: BilliardsPlayer = {
      id: currentUserId,
      username,
      avatar,
      color
    };

    socket.emit(
      'billiards:join_room',
      {
        roomCode: code,
        user: player
      },
      (res: any) => {
        if (res.error) {
          alert(res.error);
          return;
        }
        setRoom(res.room);
        setBalls(res.room.balls);
        setMyRole(res.role || 'spectator');
        setView('game');
      }
    );
  };

  // Leave Game
  const handleLeaveRoom = () => {
    if (!socket || !room) return;
    socket.emit('billiards:leave_room', { roomCode: room.roomCode });
    setRoom(null);
    setView('lobby');
    refreshRooms();
  };

  // Restart / Rematch
  const handleRestartGame = () => {
    if (!socket || !room) return;
    socket.emit('billiards:restart_game', { roomCode: room.roomCode });
  };

  // Copy Room Code
  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // --------------------------------------------------------------------------
  // PHYSICS SIMULATION LOOP (RUNS UPON SHOT EXECUTION)
  // --------------------------------------------------------------------------
  const startPhysicsSimulation = () => {
    isSimulatingRef.current = true;
    firstContactRef.current = null;
    cushionHitRef.current = false;
    pocketedThisShotRef.current = [];

    const loop = () => {
      const step = stepPhysics(ballsRef.current, firstContactRef, cushionHitRef);

      // Play audio events
      step.events.forEach((ev) => {
        if (ev.type === 'ball_hit') {
          billiardsAudio.playBallCollision(ev.speed || 5);
        } else if (ev.type === 'cushion_hit') {
          billiardsAudio.playCushionHit(ev.speed || 5);
        } else if (ev.type === 'pocket_drop') {
          billiardsAudio.playPocketDrop();
        }
      });

      // Track pocketed
      step.pocketedThisTick.forEach((num) => {
        if (!pocketedThisShotRef.current.includes(num)) {
          pocketedThisShotRef.current.push(num);
        }
      });

      // Force canvas redraw
      drawTable();

      if (step.allStopped) {
        isSimulatingRef.current = false;
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

        // Only the current player or host emits the finished shot
        if (
          socket &&
          room &&
          (room.currentTurnPlayerId === currentUserId ||
            (!room.player2 && room.player1.id === currentUserId))
        ) {
          socket.emit('billiards:shot_finished', {
            roomCode: room.roomCode,
            finalBalls: ballsRef.current,
            pocketedThisShot: pocketedThisShotRef.current,
            firstContactBallId: firstContactRef.current ? firstContactRef.current.id : null,
            cushionHitAfterContact: cushionHitRef.current
          });
        }
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  // --------------------------------------------------------------------------
  // SHOOT ACTION
  // --------------------------------------------------------------------------
  const executeShot = () => {
    if (!socket || !room || room.status !== 'playing') return;
    if (room.currentTurnPlayerId !== currentUserId) return;
    if (isSimulatingRef.current) return;
    if (pullBackPower <= 0.03) {
      setPullBackPower(0);
      setIsAiming(false);
      return;
    }

    const cueBall = ballsRef.current.find((b) => b.id === 0);
    if (!cueBall || cueBall.isPocketed) return;

    // Shot velocity vector based on aim angle and power
    const maxSpeed = 38; // px/frame
    const speed = pullBackPower * maxSpeed;
    const dirX = Math.cos(aimAngle);
    const dirY = Math.sin(aimAngle);

    // Apply spin deflection slightly
    const spinEffect = 0.15;
    const finalVx = dirX * speed + ballSpin.x * speed * spinEffect;
    const finalVy = dirY * speed + ballSpin.y * speed * spinEffect;

    socket.emit(
      'billiards:shoot',
      {
        roomCode: room.roomCode,
        angle: aimAngle,
        power: pullBackPower,
        spin: ballSpin,
        cueBallVel: { vx: finalVx, vy: finalVy }
      },
      (res: any) => {
        if (res && res.error) {
          alert(res.error);
        }
      }
    );

    // Reset pull back
    setPullBackPower(0);
    setIsAiming(false);
    setDragStartPos(null);
  };

  // --------------------------------------------------------------------------
  // BALL-IN-HAND DRAG & DROP
  // --------------------------------------------------------------------------
  const handlePlaceCueBall = (x: number, y: number) => {
    if (!socket || !room || !room.cueBallInHand) return;
    if (room.inHandPlayerId !== currentUserId) return;

    // Check collision with other balls to ensure non-overlapping spot
    const testPoint = { x, y };
    const overlaps = ballsRef.current.some((b) => {
      if (b.id === 0 || b.isPocketed) return false;
      return dist(testPoint, b) < BALL_RADIUS * 2 + 2;
    });

    if (overlaps) {
      // Overlaps another ball, cannot place here
      return;
    }

    socket.emit('billiards:place_cue_ball', {
      roomCode: room.roomCode,
      x,
      y
    });
    setIsDraggingCueBall(false);
  };

  // --------------------------------------------------------------------------
  // CANVAS MOUSE & TOUCH INTERACTION
  // --------------------------------------------------------------------------
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!room || room.status !== 'playing' || isSimulatingRef.current) return;
    const coords = getCanvasCoords(e);
    const cueBall = ballsRef.current.find((b) => b.id === 0);
    if (!cueBall) return;

    // Ball-in-hand placement
    if (room.cueBallInHand && room.inHandPlayerId === currentUserId) {
      setIsDraggingCueBall(true);
      handlePlaceCueBall(coords.x, coords.y);
      return;
    }

    if (room.currentTurnPlayerId !== currentUserId) return;

    // Start aiming / pulling cue stick
    setIsAiming(true);
    setDragStartPos(coords);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!room || room.status !== 'playing' || isSimulatingRef.current) return;
    const coords = getCanvasCoords(e);
    const cueBall = ballsRef.current.find((b) => b.id === 0);
    if (!cueBall || cueBall.isPocketed) return;

    // Ball-in-hand drag
    if (isDraggingCueBall && room.cueBallInHand && room.inHandPlayerId === currentUserId) {
      cueBall.x = Math.max(PLAY_MIN_X, Math.min(PLAY_MAX_X, coords.x));
      cueBall.y = Math.max(PLAY_MIN_Y, Math.min(PLAY_MAX_Y, coords.y));
      drawTable();
      return;
    }

    if (room.currentTurnPlayerId !== currentUserId) return;

    if (isAiming && dragStartPos) {
      // Calculate pull-back distance
      const pullDist = Math.hypot(coords.x - dragStartPos.x, coords.y - dragStartPos.y);
      const maxPull = 140; // Max drag distance
      const powerRatio = Math.min(1, Math.max(0, pullDist / maxPull));
      setPullBackPower(powerRatio);

      // Angle points away from drag direction towards cue ball, or simply from cue ball to target
      const angle = Math.atan2(coords.y - cueBall.y, coords.x - cueBall.x);
      setAimAngle(angle);

      // Throttled socket aim sync
      if (socket && Math.abs(angle - lastSyncAngleRef.current) > 0.04) {
        lastSyncAngleRef.current = angle;
        socket.emit('billiards:aim', {
          roomCode: room.roomCode,
          angle,
          power: powerRatio,
          spin: ballSpin
        });
      }
    } else {
      // Passive aiming (mouse hover calculates angle from cue ball to mouse)
      const angle = Math.atan2(coords.y - cueBall.y, coords.x - cueBall.x);
      setAimAngle(angle);
    }
  };

  const handlePointerUp = () => {
    if (isDraggingCueBall) {
      const cueBall = ballsRef.current.find((b) => b.id === 0);
      if (cueBall) {
        handlePlaceCueBall(cueBall.x, cueBall.y);
      }
      return;
    }

    if (isAiming) {
      if (pullBackPower > 0.04) {
        executeShot();
      } else {
        setPullBackPower(0);
        setIsAiming(false);
        setDragStartPos(null);
      }
    }
  };

  // --------------------------------------------------------------------------
  // CANVAS DRAWING ENGINE (WOOD FRAME, FELT, POCKETS, BALLS, CUE, TRAJECTORY)
  // --------------------------------------------------------------------------
  const drawTable = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // Felt colors palette
    const feltGradients = {
      green: { main: '#0d5c36', dark: '#083d23', inner: '#116d41', border: '#062d1a' },
      blue: { main: '#1e3a8a', dark: '#172554', inner: '#2563eb', border: '#0f172a' },
      burgundy: { main: '#881337', dark: '#4c0519', inner: '#9f1239', border: '#30030f' }
    };
    const fTheme = feltGradients[feltColor];

    // 1. OUTER WOODEN FRAME (BEVEL & TEXTURE)
    const woodGrad = ctx.createLinearGradient(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
    woodGrad.addColorStop(0, '#542d13');
    woodGrad.addColorStop(0.3, '#78350f');
    woodGrad.addColorStop(0.7, '#451a03');
    woodGrad.addColorStop(1, '#270e02');

    ctx.fillStyle = woodGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT, 24);
    ctx.fill();

    // Wood inlays / metallic dots (sight points)
    ctx.fillStyle = '#fde68a';
    const sightsX = [TABLE_WIDTH * 0.25, TABLE_WIDTH * 0.5, TABLE_WIDTH * 0.75];
    sightsX.forEach((sx) => {
      ctx.beginPath();
      ctx.arc(sx, CUSHION_WIDTH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx, TABLE_HEIGHT - CUSHION_WIDTH / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    const sightsY = [TABLE_HEIGHT * 0.33, TABLE_HEIGHT * 0.67];
    sightsY.forEach((sy) => {
      ctx.beginPath();
      ctx.arc(CUSHION_WIDTH / 2, sy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(TABLE_WIDTH - CUSHION_WIDTH / 2, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. INNER RUBBER CUSHIONS & CUSHION SHADOWS
    ctx.fillStyle = fTheme.border;
    ctx.fillRect(
      CUSHION_WIDTH - 6,
      CUSHION_WIDTH - 6,
      TABLE_WIDTH - (CUSHION_WIDTH - 6) * 2,
      TABLE_HEIGHT - (CUSHION_WIDTH - 6) * 2
    );

    // 3. TABLE PLAYING FELT (CLOTH)
    const feltGrad = ctx.createRadialGradient(
      TABLE_WIDTH / 2,
      TABLE_HEIGHT / 2,
      80,
      TABLE_WIDTH / 2,
      TABLE_HEIGHT / 2,
      TABLE_WIDTH / 2
    );
    feltGrad.addColorStop(0, fTheme.inner);
    feltGrad.addColorStop(0.7, fTheme.main);
    feltGrad.addColorStop(1, fTheme.dark);

    ctx.fillStyle = feltGrad;
    ctx.fillRect(CUSHION_WIDTH, CUSHION_WIDTH, TABLE_WIDTH - CUSHION_WIDTH * 2, TABLE_HEIGHT - CUSHION_WIDTH * 2);

    // Head string line & head spot (break line indicator)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(230, CUSHION_WIDTH);
    ctx.lineTo(230, TABLE_HEIGHT - CUSHION_WIDTH);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(230, TABLE_HEIGHT / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Foot spot (rack apex)
    ctx.beginPath();
    ctx.arc(670, TABLE_HEIGHT / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // 4. SIX POCKETS (INNER DEPTH & SHADOWS)
    POCKETS.forEach((pocket) => {
      // Outer drop rim
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius + 2, 0, Math.PI * 2);
      ctx.fill();

      // Inner pocket black hole
      const pGrad = ctx.createRadialGradient(pocket.x, pocket.y, 4, pocket.x, pocket.y, pocket.radius);
      pGrad.addColorStop(0, '#000000');
      pGrad.addColorStop(0.8, '#09090b');
      pGrad.addColorStop(1, '#27272a');

      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    const cueBall = ballsRef.current.find((b) => b.id === 0);

    // 5. LASER AIMING & TRAJECTORY PREDICTION (IF TURN IS ACTIVE AND NOT SIMULATING)
    const isMyTurn =
      room &&
      room.status === 'playing' &&
      room.currentTurnPlayerId === currentUserId &&
      !room.cueBallInHand &&
      !isSimulatingRef.current;

    if (isMyTurn && cueBall && !cueBall.isPocketed) {
      const traj: AimTrajectory = calculateAimTrajectory(cueBall, aimAngle, ballsRef.current);

      // A. Primary Cue Ball Line (Dashed laser guide)
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(traj.cueBallStart.x, traj.cueBallStart.y);
      ctx.lineTo(traj.cueBallTarget.x, traj.cueBallTarget.y);
      ctx.stroke();
      ctx.restore();

      // Ghost cue ball at impact point
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(traj.cueBallTarget.x, traj.cueBallTarget.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // B. Target Ball Trajectory (if a ball is hit)
      if (traj.hitBall && traj.targetBallTrajectory) {
        ctx.save();
        ctx.strokeStyle = '#22c55e'; // Green direction indicator
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(traj.hitBall.x, traj.hitBall.y);
        ctx.lineTo(traj.targetBallTrajectory.x, traj.targetBallTrajectory.y);
        ctx.stroke();

        // Arrow head on target ball
        const endAngle = Math.atan2(
          traj.targetBallTrajectory.y - traj.hitBall.y,
          traj.targetBallTrajectory.x - traj.hitBall.x
        );
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(traj.targetBallTrajectory.x, traj.targetBallTrajectory.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // C. Cue Ball Deflection Line
        if (traj.cueBallDeflection) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(traj.cueBallTarget.x, traj.cueBallTarget.y);
          ctx.lineTo(traj.cueBallDeflection.x, traj.cueBallDeflection.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      // D. Cushion Reflection guide (if pointing towards cushion without hitting a ball)
      if (traj.cushionReflectionPoint) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(traj.cueBallTarget.x, traj.cueBallTarget.y);
        ctx.lineTo(traj.cushionReflectionPoint.x, traj.cushionReflectionPoint.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. DRAW ALL BALLS (WITH SHADOWS, SHINE, NUMBERS & STRIPES)
    ballsRef.current.forEach((b) => {
      if (b.isPocketed) return;

      const r = b.radius;
      const x = b.x;
      const y = b.y;

      // Ball shadow on felt
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 3, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();

      if (b.type === 'cue') {
        // Pure White Cue Ball with specular gradient
        const cueGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        cueGrad.addColorStop(0, '#ffffff');
        cueGrad.addColorStop(0.7, '#f8fafc');
        cueGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = cueGrad;
        ctx.fill();

        // Red dot on cue ball for spin feedback
        if (ballSpin.x !== 0 || ballSpin.y !== 0) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(x + ballSpin.x * (r * 0.6), y + ballSpin.y * (r * 0.6), 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (b.type === 'solid' || b.type === '8ball') {
        // Solid Ball
        const color = BALL_COLORS[b.number] || '#333';
        const ballGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        ballGrad.addColorStop(0, '#ffffff');
        ballGrad.addColorStop(0.2, color);
        ballGrad.addColorStop(1, '#000000');
        ctx.fillStyle = ballGrad;
        ctx.fill();

        // White circle in the center for number
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
        ctx.fill();

        // Number Text
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.round(r * 0.65)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.number), x, y + 0.5);
      } else if (b.type === 'stripe') {
        // Stripe Ball (White base + colorful thick band across)
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        const color = BALL_COLORS[b.number] || '#333';
        ctx.fillStyle = color;
        ctx.fillRect(x - r, y - r * 0.52, r * 2, r * 1.04);

        // Center white circle for number
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.48, 0, Math.PI * 2);
        ctx.fill();

        // Number text
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.round(r * 0.65)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.number), x, y + 0.5);

        // Outer spherical shading
        const sphereShade = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        sphereShade.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        sphereShade.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
        sphereShade.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = sphereShade;
        ctx.fill();
      }

      ctx.restore();
    });

    // 7. CUE BALL IN HAND GLOW & RING (BALL-IN-HAND INDICATOR)
    if (room && room.cueBallInHand && room.inHandPlayerId === currentUserId && cueBall) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cueBall.x, cueBall.y, BALL_RADIUS + 7, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.beginPath();
      ctx.arc(cueBall.x, cueBall.y, BALL_RADIUS + 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 8. CUE STICK RENDERING
    if (cueBall && !cueBall.isPocketed && !isSimulatingRef.current) {
      const activeShooter = room?.currentTurnPlayerId;
      const isVisibleStick =
        room?.status === 'playing' &&
        !room?.cueBallInHand &&
        (activeShooter === currentUserId || room?.player2 !== null);

      if (isVisibleStick) {
        ctx.save();
        ctx.translate(cueBall.x, cueBall.y);
        ctx.rotate(aimAngle);

        // Pull back offset based on power
        const baseOffset = BALL_RADIUS + 8;
        const pullOffset = pullBackPower * 90;
        const stickStart = -(baseOffset + pullOffset);
        const stickLength = 320;

        // Cue Stick Tapered Body
        const cueStickGrad = ctx.createLinearGradient(stickStart - stickLength, 0, stickStart, 0);
        cueStickGrad.addColorStop(0, '#1e293b'); // Dark carbon grip
        cueStickGrad.addColorStop(0.3, '#78350f'); // Wood handle
        cueStickGrad.addColorStop(0.75, '#d97706'); // Maple wood
        cueStickGrad.addColorStop(0.96, '#fde68a'); // Tip ferrule
        cueStickGrad.addColorStop(1, '#0284c7'); // Blue chalk tip

        ctx.fillStyle = cueStickGrad;
        ctx.beginPath();
        ctx.moveTo(stickStart, -2);
        ctx.lineTo(stickStart, 2);
        ctx.lineTo(stickStart - stickLength, 5);
        ctx.lineTo(stickStart - stickLength, -5);
        ctx.closePath();
        ctx.fill();

        // Tip Chalk Glow
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(stickStart - 3, -2, 3, 4);

        ctx.restore();
      }
    }
  }, [feltColor, aimAngle, pullBackPower, ballSpin, currentUserId, room]);

  // Redraw when state updates
  useEffect(() => {
    drawTable();
  }, [drawTable, balls]);

  // Window resize listener to trigger crisp canvas render
  useEffect(() => {
    drawTable();
  }, [drawTable]);

  // --------------------------------------------------------------------------
  // LOBBY VIEW
  // --------------------------------------------------------------------------
  if (view === 'lobby') {
    return (
      <div className="min-h-[85vh] p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start max-w-6xl mx-auto space-y-6 animate-in fade-in">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Oyunlar Menüsü</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRulesModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 text-xs font-bold cursor-pointer hover:bg-purple-100 transition-all"
            >
              <HelpCircle size={15} />
              <span>WPA Kuralları</span>
            </button>

            <button
              onClick={toggleSound}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <div className="w-full relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-800/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 text-white">
          <div className="space-y-2 text-center sm:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black tracking-wide uppercase">
              <Sparkles size={13} />
              <span>Gerçek Zamanlı 2 Kişilik 8-Ball</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white flex items-center justify-center sm:justify-start gap-3">
              <span>🎱 KapsPool Bilardo</span>
            </h1>
            <p className="text-sm text-slate-300 max-w-md leading-relaxed">
              Katı WPA kuralları, 2D elastik fizik motoru, lazer nişan çizgisi ve ıstaka falsosu ile gerçekçi bilardo
              deneyimi.
            </p>
          </div>

          {/* Quick Create Action */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto z-10">
            <input
              type="text"
              placeholder="Masa Adı (İsteğe bağlı)"
              value={roomNameInput}
              onChange={(e) => setRoomNameInput(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 w-full sm:w-56"
            />
            <button
              onClick={handleCreateRoom}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play size={16} fill="currentColor" />
              <span>Masa Kur</span>
            </button>
          </div>
        </div>

        {/* Join by Code Card */}
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
              <Crosshair size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Oda Koduyla Katıl</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Arkadaşının paylaştığı 6 haneli kodu girerek hemen masaya otur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              maxLength={6}
              placeholder="Örn: 8X7K2P"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              className="px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 w-36 text-center"
            />
            <button
              onClick={() => handleJoinRoom()}
              disabled={!joinCodeInput.trim()}
              className="px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold text-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              Katıl
            </button>
          </div>
        </div>

        {/* Active Tables List */}
        <div className="w-full space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-emerald-500" />
                <span>Açık Bilardo Masaları</span>
              </h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-500">
                {roomList.length}
              </span>
            </div>

            <button
              onClick={refreshRooms}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white font-semibold cursor-pointer"
            >
              <RefreshCw size={13} className={loadingRooms ? 'animate-spin' : ''} />
              <span>Yenile</span>
            </button>
          </div>

          {roomList.length === 0 ? (
            <div className="w-full bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                <CircleDot size={24} />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Şu anda açık masa bulunmuyor.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Yukarıdaki butona tıklayarak hemen yeni bir masa kurabilir ve arkadaşını davet edebilirsin!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roomList.map((r) => (
                <div
                  key={r.roomCode}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:border-emerald-500/50 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.name}</h4>
                      <p className="text-xs text-slate-500">Kuran: {r.hostName}</p>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        r.status === 'playing'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {r.status === 'playing' ? 'Oyunda' : 'Oyuncu Bekliyor'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{r.roomCode}</span>
                    <span className="flex items-center gap-1">
                      <Users size={13} />
                      {r.playerCount}/2
                      {r.spectatorCount > 0 && ` (${r.spectatorCount} izleyici)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {r.playerCount < 2 ? (
                      <button
                        onClick={() => handleJoinRoom(r.roomCode)}
                        className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer"
                      >
                        Masaya Otur
                      </button>
                    ) : (
                      <button
                        onClick={() => handleJoinRoom(r.roomCode)}
                        className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Eye size={14} />
                        <span>İzle</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WPA Rules Modal */}
        {showRulesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield size={18} className="text-emerald-500" />
                  <span>Resmi WPA 8-Ball Bilardo Kuralları</span>
                </h3>
                <button
                  onClick={() => setShowRulesModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed max-h-96 overflow-y-auto pr-1">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">1. Gruplar (Düzler & Çizgililer)</h4>
                  <p>
                    Açılıştan sonra cebe giren ilk yasal top grubunuzu belirler (1-7 Düzler, 9-15 Çizgililer). Kendi
                    toplarınızı bitirmeden 8 numaraya vuramazsınız.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">2. Fauller & Top Serbest (Ball-in-Hand)</h4>
                  <p>
                    Beyaz topun cebe girmesi (Scratch), ilk temasın rakip topa veya 8 numaraya yapılması ya da vuruş
                    sonrası hiçbir topun banta çarpmaması fauldür. Rakip beyaz topu istediği yere koyar.
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">3. 8 Numaralı Siyah Top</h4>
                  <p>
                    Kendi 7 topunu bitirdikten sonra 8 numarayı yasal sokan kazanır! Kendi topları bitmeden sokan veya 8
                    numarayı sokarken beyaz topu cebe düşüren oyuncu anında kaybeder.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowRulesModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-bold text-xs cursor-pointer"
              >
                Anladım
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // ACTIVE GAME VIEW
  // --------------------------------------------------------------------------
  const isMyTurn = room?.status === 'playing' && room?.currentTurnPlayerId === currentUserId;
  const p1Group = room?.assignedGroups ? room.assignedGroups[room.player1.id] : null;
  const p2Group = room?.player2 && room?.assignedGroups ? room.assignedGroups[room.player2.id] : null;

  // Pocketed balls categorized
  const pocketedSolids = (room?.pocketedBalls || []).filter((n) => n >= 1 && n <= 7);
  const pocketedStripes = (room?.pocketedBalls || []).filter((n) => n >= 9 && n <= 15);

  return (
    <div className="min-h-[90vh] p-2 sm:p-4 lg:p-6 flex flex-col items-center justify-between max-w-6xl mx-auto space-y-4 select-none">
      {/* Top Status & Players Bar */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-3 text-white">
        {/* Left: Player 1 (Host) */}
        <div
          className={`flex items-center gap-3 px-3 py-1.5 rounded-2xl transition-all ${
            room?.currentTurnPlayerId === room?.player1.id
              ? 'bg-emerald-500/20 border border-emerald-500/50 shadow-md shadow-emerald-500/10'
              : 'opacity-70'
          }`}
        >
          <div className="relative">
            <Avatar
              url={room?.player1.avatar}
              name={room?.player1.username}
              color={room?.player1.color || undefined}
              size={9}
            />
            {room?.currentTurnPlayerId === room?.player1.id && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">{room?.player1.username}</span>
              {room?.player1.id === currentUserId && (
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-semibold">Sen</span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-300">
              <span>{p1Group ? (p1Group === 'solids' ? '🟡 Düzler (1-7)' : '🔵 Çizgililer (9-15)') : 'Nötr'}</span>
            </div>
          </div>
        </div>

        {/* Center: Turn Timer & Status */}
        <div className="flex flex-col items-center justify-center space-y-1">
          <div className="flex items-center gap-2">
            <Clock size={16} className={isMyTurn ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
            <span
              className={`text-lg font-black font-mono ${
                (room?.turnTimeRemaining || 0) <= 5 ? 'text-rose-500 animate-ping' : 'text-emerald-400'
              }`}
            >
              {room?.turnTimeRemaining || 30}s
            </span>
          </div>
          <span className="text-[11px] font-semibold text-slate-300">
            {room?.status === 'waiting'
              ? '2. Oyuncu Bekleniyor...'
              : isMyTurn
              ? '🎯 Sıra Sende!'
              : `⏳ Sıra: ${
                  room?.currentTurnPlayerId === room?.player1.id
                    ? room?.player1.username
                    : room?.player2?.username || 'Rakip'
                }`}
          </span>
        </div>

        {/* Right: Player 2 */}
        <div
          className={`flex items-center gap-3 px-3 py-1.5 rounded-2xl transition-all ${
            room?.player2 && room?.currentTurnPlayerId === room?.player2.id
              ? 'bg-emerald-500/20 border border-emerald-500/50 shadow-md shadow-emerald-500/10'
              : 'opacity-70'
          }`}
        >
          {room?.player2 ? (
            <>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  {room?.player2.id === currentUserId && (
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-semibold">
                      Sen
                    </span>
                  )}
                  <span className="text-xs font-bold text-white">{room?.player2.username}</span>
                </div>
                <div className="flex items-center justify-end gap-1 text-[11px] text-slate-300">
                  <span>{p2Group ? (p2Group === 'solids' ? '🟡 Düzler (1-7)' : '🔵 Çizgililer (9-15)') : 'Nötr'}</span>
                </div>
              </div>
              <div className="relative">
                <Avatar
                  url={room?.player2.avatar}
                  name={room?.player2.username}
                  color={room?.player2.color || undefined}
                  size={9}
                />
                {room?.currentTurnPlayerId === room?.player2.id && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold px-2 py-1 bg-slate-800/60 rounded-xl border border-dashed border-slate-700">
              <Users size={15} />
              <span>Rakip Bekleniyor...</span>
            </div>
          )}
        </div>
      </div>

      {/* Foul / Info Banner */}
      {room?.foulMessage && (
        <div className="w-full bg-rose-500/15 border border-rose-500/40 rounded-2xl p-2.5 text-center text-rose-300 text-xs font-bold flex items-center justify-center gap-2 animate-bounce">
          <AlertCircle size={16} />
          <span>{room.foulMessage}</span>
        </div>
      )}

      {/* Cue Ball In Hand Notice */}
      {room?.cueBallInHand && room?.inHandPlayerId === currentUserId && (
        <div className="w-full bg-sky-500/20 border border-sky-500/50 rounded-2xl p-2.5 text-center text-sky-300 text-xs font-black flex items-center justify-center gap-2">
          <Sparkles size={16} />
          <span>BALL-IN-HAND: Beyaz topu masada istediğin noktaya tıklayarak serbestçe yerleştir!</span>
        </div>
      )}

      {/* MAIN BILLIARDS CANVAS BOARD */}
      <div className="relative w-full max-w-4xl aspect-[2/1] rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-950/70 bg-slate-950 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={TABLE_WIDTH}
          height={TABLE_HEIGHT}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="w-full h-full object-contain cursor-crosshair touch-none"
        />

        {/* Dynamic Power Bar Overlay (Visible when pulling back cue stick) */}
        {isMyTurn && pullBackPower > 0.01 && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-48 bg-slate-950/80 backdrop-blur-md rounded-full border border-white/20 p-1 flex flex-col justify-end overflow-hidden shadow-xl pointer-events-none">
            <div
              className={`w-full rounded-full transition-all duration-75 ${
                pullBackPower > 0.8
                  ? 'bg-rose-500'
                  : pullBackPower > 0.5
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ height: `${Math.round(pullBackPower * 100)}%` }}
            />
            <span className="absolute inset-x-0 bottom-2 text-center text-[9px] font-black text-white">
              %{Math.round(pullBackPower * 100)}
            </span>
          </div>
        )}

        {/* Finished Game Overlay */}
        {room?.status === 'finished' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center shadow-lg border border-amber-500/30">
              <Trophy size={36} />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {room.winnerId === currentUserId ? '🏆 TEBRİKLER, KAZANDIN!' : 'KAYBETTİN!'}
              </h2>
              <p className="text-sm text-slate-300 max-w-sm">
                {room.winnerId === room.player1.id ? room.player1.username : room.player2?.username} maçı kazandı!
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleRestartGame}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                <RotateCcw size={16} />
                <span>Tekrar Oyna</span>
              </button>
              <button
                onClick={handleLeaveRoom}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm cursor-pointer"
              >
                Lobiye Dön
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pocketed Balls Tracker & Bottom Controls */}
      <div className="w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-3xl p-3 sm:p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 text-white">
        {/* Left: Pocketed Solids / Stripes */}
        <div className="flex items-center gap-4 text-xs">
          {/* Solids Pocketed */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Düzler (1-7):</span>
            <div className="flex items-center gap-1 h-5">
              {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                const inPocket = pocketedSolids.includes(num);
                return (
                  <span
                    key={num}
                    className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center border ${
                      inPocket
                        ? 'opacity-30 border-slate-700 bg-slate-800 text-slate-500'
                        : 'border-white/30 text-slate-950 font-black'
                    }`}
                    style={{ backgroundColor: inPocket ? undefined : BALL_COLORS[num] }}
                  >
                    {num}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Stripes Pocketed */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Çizgililer (9-15):</span>
            <div className="flex items-center gap-1 h-5">
              {[9, 10, 11, 12, 13, 14, 15].map((num) => {
                const inPocket = pocketedStripes.includes(num);
                return (
                  <span
                    key={num}
                    className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center border ${
                      inPocket
                        ? 'opacity-30 border-slate-700 bg-slate-800 text-slate-500'
                        : 'border-white/30 text-slate-950 font-black'
                    }`}
                    style={{ backgroundColor: inPocket ? undefined : BALL_COLORS[num] }}
                  >
                    {num}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spin Selector (Interactive Cue Ball Strike Spot) */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 mb-1">Top Falsosu</span>
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left - 18;
                const clickY = e.clientY - rect.top - 18;
                const maxR = 14;
                const nx = Math.max(-1, Math.min(1, clickX / maxR));
                const ny = Math.max(-1, Math.min(1, clickY / maxR));
                setBallSpin({ x: nx, y: ny });
              }}
              className="relative w-9 h-9 rounded-full bg-white border-2 border-slate-600 shadow-inner cursor-pointer flex items-center justify-center"
              title="Vuruş noktasını seç (üst/alt/falso)"
            >
              <div
                className="w-2 h-2 rounded-full bg-rose-500 absolute"
                style={{
                  transform: `translate(${ballSpin.x * 12}px, ${ballSpin.y * 12}px)`
                }}
              />
            </div>
          </div>

          {/* Felt Color Selector */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-slate-400 mb-1">Çuha Rengi</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFeltColor('green')}
                className={`w-6 h-6 rounded-full bg-emerald-700 border-2 cursor-pointer ${
                  feltColor === 'green' ? 'border-white scale-110' : 'border-transparent'
                }`}
              />
              <button
                onClick={() => setFeltColor('blue')}
                className={`w-6 h-6 rounded-full bg-blue-700 border-2 cursor-pointer ${
                  feltColor === 'blue' ? 'border-white scale-110' : 'border-transparent'
                }`}
              />
              <button
                onClick={() => setFeltColor('burgundy')}
                className={`w-6 h-6 rounded-full bg-rose-900 border-2 cursor-pointer ${
                  feltColor === 'burgundy' ? 'border-white scale-110' : 'border-transparent'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Room Code with Copy */}
          {room && (
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-mono font-bold text-slate-300 transition-all cursor-pointer"
              title="Oda Kodunu Kopyala"
            >
              <span>{room.roomCode}</span>
              {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          )}

          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          <button
            onClick={handleLeaveRoom}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer"
          >
            Masadan Ayrıl
          </button>
        </div>
      </div>
    </div>
  );
}
