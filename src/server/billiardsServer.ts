import { Server, Socket } from "socket.io";
import {
  Ball,
  createInitialBalls,
  evaluateWpa8BallRules,
  ShotResultContext,
  BallGroupType,
  PLAY_MIN_X,
  PLAY_MAX_X,
  PLAY_MIN_Y,
  PLAY_MAX_Y,
  BALL_RADIUS
} from "../utils/billiardsEngine";

export interface BilliardsPlayer {
  id: number;
  username: string;
  avatar: string | null;
  color?: string | null;
  socketId: string;
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

export class BilliardsManager {
  private io: Server;
  private client: any;
  private rooms: Map<string, BilliardsRoomState> = new Map();
  private turnTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(io: Server, client: any) {
    this.io = io;
    this.client = client;
  }

  public getActiveRoomsList() {
    const list: any[] = [];
    this.rooms.forEach((r) => {
      list.push({
        roomCode: r.roomCode,
        name: r.name,
        hostName: r.player1.username,
        playerCount: (r.player1 ? 1 : 0) + (r.player2 ? 1 : 0),
        spectatorCount: r.spectators.length,
        status: r.status
      });
    });
    return list;
  }

  public getUnifiedTables(): any[] {
    const list: any[] = [];
    this.rooms.forEach((r) => {
      list.push({
        id: r.roomCode,
        gameType: "billiards",
        title: r.name || `KapsPool 8-Ball ${r.roomCode}`,
        hostId: r.hostId,
        hostName: r.player1?.username || "Bilinmiyor",
        hostAvatar: r.player1?.avatar || null,
        playerCount: (r.player1 ? 1 : 0) + (r.player2 ? 1 : 0),
        maxPlayers: 2,
        botCount: 0,
        status: r.status === 'playing' ? 'Oyunda' : (r.status === 'finished' ? 'Bitti' : 'Lobi Bekliyor'),
        isPrivate: false,
        gameMode: '8ball',
        createdAt: 'Bugün',
        updatedAt: Date.now()
      });
    });
    return list;
  }

  private broadcastRooms() {
    this.io.emit("billiards:rooms_list", this.getActiveRoomsList());
  }

  private broadcastRoom(room: BilliardsRoomState) {
    this.io.to(`billiards:${room.roomCode}`).emit("billiards:game_state", room);
    this.broadcastRooms();
  }

  private startTimer(room: BilliardsRoomState) {
    const code = room.roomCode;
    if (this.turnTimers.has(code)) {
      clearInterval(this.turnTimers.get(code)!);
      this.turnTimers.delete(code);
    }

    room.turnTimeRemaining = 30;

    const timer = setInterval(() => {
      const currentRoom = this.rooms.get(code);
      if (!currentRoom || currentRoom.status !== 'playing') {
        clearInterval(timer);
        this.turnTimers.delete(code);
        return;
      }

      if (currentRoom.isSimulating) {
        return; // Pause countdown while shot is animating
      }

      currentRoom.turnTimeRemaining -= 1;
      this.io.to(`billiards:${code}`).emit("billiards:timer_tick", {
        timeRemaining: currentRoom.turnTimeRemaining
      });

      if (currentRoom.turnTimeRemaining <= 0) {
        // Time expired: Timeout Foul!
        this.handleTimeoutFoul(currentRoom);
      }
    }, 1000);

    this.turnTimers.set(code, timer);
  }

  private handleTimeoutFoul(room: BilliardsRoomState) {
    if (!room.player2) return;
    const opponentId = room.currentTurnPlayerId === room.player1.id ? room.player2.id : room.player1.id;

    room.foulMessage = 'Süre doldu! Sıra rakibe geçti, top serbest (Ball-in-Hand).';
    room.currentTurnPlayerId = opponentId;
    room.cueBallInHand = true;
    room.inHandPlayerId = opponentId;
    room.turnTimeRemaining = 30;

    this.broadcastRoom(room);
  }

  public registerSocketEvents(socket: Socket) {
    // 1. Get room list
    socket.on("billiards:get_rooms", (cb?: (list: any[]) => void) => {
      const list = this.getActiveRoomsList();
      if (typeof cb === "function") cb(list);
      else socket.emit("billiards:rooms_list", list);
    });

    // 2. Create room
    socket.on("billiards:create_room", (payload: { roomCode?: string; name?: string; user: BilliardsPlayer }, cb?: (res: any) => void) => {
      try {
        const { user } = payload;
        const code = (payload.roomCode || Math.random().toString(36).substring(2, 8)).toUpperCase();

        if (this.rooms.has(code)) {
          if (cb) cb({ error: "Bu oda kodu zaten kullanımda." });
          return;
        }

        const newRoom: BilliardsRoomState = {
          roomCode: code,
          name: payload.name || `${user.username} Bilardo Masası`,
          hostId: user.id,
          player1: { ...user, socketId: socket.id },
          player2: null,
          spectators: [],
          status: 'waiting',
          currentTurnPlayerId: user.id,
          assignedGroups: null,
          pocketedBalls: [],
          cueBallInHand: false,
          inHandPlayerId: null,
          foulMessage: null,
          winnerId: null,
          loserId: null,
          balls: createInitialBalls(),
          turnTimeRemaining: 30,
          isSimulating: false,
          shotCount: 0
        };

        this.rooms.set(code, newRoom);
        socket.join(`billiards:${code}`);

        if (cb) cb({ success: true, room: newRoom });
        this.broadcastRoom(newRoom);
      } catch (err: any) {
        if (cb) cb({ error: err.message });
      }
    });

    // 3. Join room
    socket.on("billiards:join_room", (payload: { roomCode: string; user: BilliardsPlayer }, cb?: (res: any) => void) => {
      try {
        const code = (payload.roomCode || "").toUpperCase();
        const room = this.rooms.get(code);

        if (!room) {
          if (cb) cb({ error: "Oda bulunamadı." });
          return;
        }

        const user: BilliardsPlayer = { ...payload.user, socketId: socket.id };

        // Check if user is already player1
        if (room.player1.id === user.id) {
          room.player1.socketId = socket.id;
          socket.join(`billiards:${code}`);
          if (cb) cb({ success: true, room, role: 'player1' });
          this.broadcastRoom(room);
          return;
        }

        // Join as Player 2
        if (!room.player2) {
          room.player2 = user;
          room.status = 'playing';
          socket.join(`billiards:${code}`);

          this.startTimer(room);

          if (cb) cb({ success: true, room, role: 'player2' });
          this.broadcastRoom(room);
          return;
        }

        // Check if user is rejoining as player 2
        if (room.player2.id === user.id) {
          room.player2.socketId = socket.id;
          socket.join(`billiards:${code}`);
          if (cb) cb({ success: true, room, role: 'player2' });
          this.broadcastRoom(room);
          return;
        }

        // Otherwise join as spectator
        const existingSpec = room.spectators.find((s) => s.id === user.id);
        if (!existingSpec) {
          room.spectators.push(user);
        } else {
          existingSpec.socketId = socket.id;
        }

        socket.join(`billiards:${code}`);
        if (cb) cb({ success: true, room, role: 'spectator' });
        this.broadcastRoom(room);
      } catch (err: any) {
        if (cb) cb({ error: err.message });
      }
    });

    // 4. Live Aim Sync (for opponent & spectators to see cue stick live)
    socket.on("billiards:aim", (payload: { roomCode: string; angle: number; power: number; spin?: { x: number; y: number } }) => {
      const room = this.rooms.get(payload.roomCode);
      if (!room || room.status !== 'playing') return;
      socket.to(`billiards:${payload.roomCode}`).emit("billiards:aim_update", {
        angle: payload.angle,
        power: payload.power,
        spin: payload.spin
      });
    });

    // 5. Shoot
    socket.on("billiards:shoot", (payload: { roomCode: string; angle: number; power: number; spin?: { x: number; y: number }; cueBallVel: { vx: number; vy: number } }, cb?: (res: any) => void) => {
      const room = this.rooms.get(payload.roomCode);
      if (!room || room.status !== 'playing') {
        if (cb) cb({ error: "Oyun aktif değil." });
        return;
      }

      // Check turn
      const sender = room.player1.socketId === socket.id ? room.player1 : room.player2?.socketId === socket.id ? room.player2 : null;
      if (!sender || sender.id !== room.currentTurnPlayerId) {
        if (cb) cb({ error: "Sıra sizde değil." });
        return;
      }

      if (room.isSimulating) {
        if (cb) cb({ error: "Toplar henüz hareket halinde." });
        return;
      }

      room.isSimulating = true;
      room.foulMessage = null;
      room.shotCount += 1;

      // Broadcast shot to both players to start synchronized physics animation
      this.io.to(`billiards:${payload.roomCode}`).emit("billiards:shot_started", {
        angle: payload.angle,
        power: payload.power,
        spin: payload.spin,
        cueBallVel: payload.cueBallVel
      });

      if (cb) cb({ success: true });
    });

    // 6. Shot finished & Sync result
    socket.on("billiards:shot_finished", (payload: {
      roomCode: string;
      finalBalls: Ball[];
      pocketedThisShot: number[];
      firstContactBallId: number | null;
      cushionHitAfterContact: boolean;
    }, cb?: (res: any) => void) => {
      const room = this.rooms.get(payload.roomCode);
      if (!room || !room.isSimulating) return;

      room.isSimulating = false;
      room.balls = payload.finalBalls;

      // Update pocketed balls list
      payload.pocketedThisShot.forEach((num) => {
        if (!room.pocketedBalls.includes(num)) {
          room.pocketedBalls.push(num);
        }
      });

      // Prepare context for WPA rules evaluation
      const firstBall = payload.firstContactBallId !== null
        ? room.balls.find((b) => b.id === payload.firstContactBallId) || null
        : null;

      const shooterId = room.currentTurnPlayerId;
      const opponentId = room.player1.id === shooterId ? room.player2!.id : room.player1.id;
      const shooterGroup = room.assignedGroups ? room.assignedGroups[shooterId] || null : null;

      const ctx: ShotResultContext = {
        shooterId,
        shooterAssignedGroup: shooterGroup,
        firstContactBall: firstBall,
        cushionHitAfterContact: payload.cushionHitAfterContact,
        pocketedBallsThisShot: payload.pocketedThisShot,
        allBalls: room.balls,
        isBreakShot: room.shotCount === 1
      };

      const evalResult = evaluateWpa8BallRules(ctx, opponentId);

      // Apply group assignment
      if (evalResult.assignedGroupUpdate) {
        room.assignedGroups = evalResult.assignedGroupUpdate;
      }

      // Check game over
      if (evalResult.gameStatusUpdate === 'finished') {
        room.status = 'finished';
        room.winnerId = evalResult.gameWinner;
        room.loserId = evalResult.gameLoser;
        room.foulMessage = evalResult.foulReason;
        if (this.turnTimers.has(room.roomCode)) {
          clearInterval(this.turnTimers.get(room.roomCode)!);
          this.turnTimers.delete(room.roomCode);
        }
        this.broadcastRoom(room);
        if (cb) cb({ success: true, room });
        return;
      }

      // Handle fouls & turn transitions
      if (evalResult.isFoul) {
        room.foulMessage = evalResult.foulReason;
        room.currentTurnPlayerId = opponentId;
        room.cueBallInHand = true;
        room.inHandPlayerId = opponentId;

        // If cue ball was pocketed, respawn it for ball-in-hand
        const cueBall = room.balls.find((b) => b.id === 0);
        if (cueBall) {
          cueBall.isPocketed = false;
          cueBall.x = 230;
          cueBall.y = 225;
          cueBall.vx = 0;
          cueBall.vy = 0;
          cueBall.radius = BALL_RADIUS;
          cueBall.fallAnimation = 0;
        }
      } else {
        room.foulMessage = null;
        room.cueBallInHand = false;
        room.inHandPlayerId = null;

        if (evalResult.keepTurn) {
          // Extra shot granted!
          room.currentTurnPlayerId = shooterId;
        } else {
          // Turn switches
          room.currentTurnPlayerId = opponentId;
        }
      }

      this.startTimer(room);
      this.broadcastRoom(room);
      if (cb) cb({ success: true, room });
    });

    // 7. Place Cue Ball (Ball-in-Hand)
    socket.on("billiards:place_cue_ball", (payload: { roomCode: string; x: number; y: number }, cb?: (res: any) => void) => {
      const room = this.rooms.get(payload.roomCode);
      if (!room || !room.cueBallInHand || room.status !== 'playing') {
        if (cb) cb({ error: "Top yerleştirme hakkı yok." });
        return;
      }

      // Clamp inside play area
      const x = Math.max(PLAY_MIN_X, Math.min(PLAY_MAX_X, payload.x));
      const y = Math.max(PLAY_MIN_Y, Math.min(PLAY_MAX_Y, payload.y));

      const cueBall = room.balls.find((b) => b.id === 0);
      if (cueBall) {
        cueBall.x = x;
        cueBall.y = y;
        cueBall.isPocketed = false;
        cueBall.vx = 0;
        cueBall.vy = 0;
      }

      room.cueBallInHand = false;
      room.inHandPlayerId = null;

      this.broadcastRoom(room);
      if (cb) cb({ success: true });
    });

    // 8. Rematch / Reset Game
    socket.on("billiards:restart_game", (payload: { roomCode: string }, cb?: (res: any) => void) => {
      const room = this.rooms.get(payload.roomCode);
      if (!room) return;

      room.balls = createInitialBalls();
      room.pocketedBalls = [];
      room.assignedGroups = null;
      room.cueBallInHand = false;
      room.inHandPlayerId = null;
      room.foulMessage = null;
      room.winnerId = null;
      room.loserId = null;
      room.status = room.player2 ? 'playing' : 'waiting';
      room.currentTurnPlayerId = room.player1.id;
      room.turnTimeRemaining = 30;
      room.isSimulating = false;
      room.shotCount = 0;

      if (room.status === 'playing') {
        this.startTimer(room);
      }

      this.broadcastRoom(room);
      if (cb) cb({ success: true });
    });

    // 9. Leave room
    socket.on("billiards:leave_room", (payload: { roomCode: string }) => {
      this.handleLeave(socket, payload.roomCode);
    });

    // 10. Disconnect cleanup
    socket.on("disconnect", () => {
      this.rooms.forEach((room, code) => {
        if (room.player1.socketId === socket.id || room.player2?.socketId === socket.id || room.spectators.some((s) => s.socketId === socket.id)) {
          this.handleLeave(socket, code);
        }
      });
    });
  }

  private handleLeave(socket: Socket, roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    // If host leaves
    if (room.player1.socketId === socket.id) {
      if (room.player2) {
        // Player 2 wins or becomes host
        if (room.status === 'playing') {
          room.winnerId = room.player2.id;
          room.loserId = room.player1.id;
          room.foulMessage = `${room.player1.username} oyundan ayrıldı (Hükmen Galibiyet)!`;
          room.status = 'finished';
        }
        room.player1 = room.player2;
        room.player2 = null;
      } else {
        // Room empty, delete
        if (this.turnTimers.has(roomCode)) {
          clearInterval(this.turnTimers.get(roomCode)!);
          this.turnTimers.delete(roomCode);
        }
        this.rooms.delete(roomCode);
        this.broadcastRooms();
        return;
      }
    } else if (room.player2 && room.player2.socketId === socket.id) {
      if (room.status === 'playing') {
        room.winnerId = room.player1.id;
        room.loserId = room.player2.id;
        room.foulMessage = `${room.player2.username} oyundan ayrıldı (Hükmen Galibiyet)!`;
        room.status = 'finished';
      }
      room.player2 = null;
    } else {
      // Spectator leaves
      room.spectators = room.spectators.filter((s) => s.socketId !== socket.id);
    }

    socket.leave(`billiards:${roomCode}`);
    this.broadcastRoom(room);
  }
}
