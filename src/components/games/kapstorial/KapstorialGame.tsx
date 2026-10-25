import './kapstorial.css';
import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import KapstorialLobby from './KapstorialLobby';
import KapstorialWaitingRoom from './KapstorialWaitingRoom';
import KapstorialCanvas, { CanvasPlayerInfo, CanvasBoatInfo, CanvasEmojiInfo } from './KapstorialCanvas';
import KapstorialHUD from './KapstorialHUD';
import KapstorialRadialMenu from './KapstorialRadialMenu';
import KapstorialVictoryModal from './KapstorialVictoryModal';
import { MAP_WIDTH, TOTAL_PIXELS, generateTerrainMap } from '../../../utils/kapstorialMaps';
import { Handshake, AlertTriangle, ShieldCheck, UserPlus, Swords } from 'lucide-react';

interface KapstorialGameProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  targetRoomCode?: string;
  onBackToHub: () => void;
}

export default function KapstorialGame({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  targetRoomCode,
  onBackToHub
}: KapstorialGameProps) {
  const [view, setView] = useState<'lobby' | 'room'>('lobby');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<any | null>(null);

  // Map Grids in React State for reactive rendering with immediate default map
  const [terrain, setTerrain] = useState<Uint8Array>(() => new Uint8Array(TOTAL_PIXELS));
  const [owners, setOwners] = useState<Uint16Array>(() => new Uint16Array(TOTAL_PIXELS));
  const [gridLoaded, setGridLoaded] = useState(false);

  // Live Entities
  const [players, setPlayers] = useState<CanvasPlayerInfo[]>([]);
  const [boats, setBoats] = useState<CanvasBoatInfo[]>([]);
  const [emojis, setEmojis] = useState<CanvasEmojiInfo[]>([]);
  const [truces, setTruces] = useState<Set<string>>(new Set());

  // Player controls
  const [selectedSpawnPixel, setSelectedSpawnPixel] = useState<number | null>(null);
  const [attackPercentage, setAttackPercentage] = useState<number>(20);
  const [radialTargetPixel, setRadialTargetPixel] = useState(0);
  const [radialTargetPlayer, setRadialTargetPlayer] = useState<CanvasPlayerInfo | null>(null);

  // Notifications / Modals
  const [truceOffer, setTruceOffer] = useState<{ offererId: number; offererName: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [gameOverData, setGameOverData] = useState<any | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<any | null>(null);

  // Auto-join target room if provided
  useEffect(() => {
    if (targetRoomCode && socket) {
      handleJoinRoom(targetRoomCode);
    }
  }, [targetRoomCode, socket]);

  // Join Room Handler
  const handleJoinRoom = (code: string) => {
    if (!socket) return;
    socket.emit("kapstorial:join_room", { roomCode: code }, (res: any) => {
      if (res?.success && res.room) {
        setRoomCode(code);
        setRoomState(res.room);
        setPlayers(res.room.players || []);
        setSelectedSpawnPixel(null);
        setGridLoaded(false);
        socket.emit('kapstorial:sync', (snapshot: any) => {
          if (snapshot?.terrain?.length === TOTAL_PIXELS && snapshot?.owners?.length === TOTAL_PIXELS) {
            setTerrain(new Uint8Array(snapshot.terrain)); setOwners(new Uint16Array(snapshot.owners)); setGridLoaded(true);
          }
        });
        setView('room');
      } else {
        alert(res?.error || "Odaya katılınamadı.");
      }
    });
  };

  useEffect(() => {
    if (!socket || !roomCode) return;
    const reconnect = () => handleJoinRoom(roomCode);
    socket.on('connect', reconnect);
    return () => { socket.off('connect', reconnect); };
  }, [socket, roomCode]);

  // Leave Room Handler
  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit("kapstorial:leave_room");
    }
    setRoomCode(null);
    setRoomState(null);
    setTerrain(generateTerrainMap('world'));
    setOwners(new Uint16Array(TOTAL_PIXELS));
    setGridLoaded(false);
    setSelectedSpawnPixel(null); setPlayers([]); setBoats([]); setEmojis([]); setTruces(new Set());
    setView('lobby');
    setGameOverData(null);
  };

  // Main Socket Listeners
  useEffect(() => {
    if (!socket) return;

    // 1. Room State Updates (Lobby)
    const onRoomState = (state: any) => {
      setRoomState(state);
      if (state.players) {
        setPlayers(state.players);
      }
      if (state.truces) {
        setTruces(new Set(state.truces));
      }
    };

    // 2. Spawn Countdown Tick
    const onSpawnCountdown = (data: { remaining: number }) => {
      setRoomState((prev: any) => prev ? { ...prev, spawnCountdownRemaining: data.remaining } : prev);
    };

    // 3. Game Start (Full Terrain & Owner Matrix sent once)
    const onGameStart = (data: { room: any; terrain: number[]; owners: number[] }) => {
      if (data.terrain?.length !== TOTAL_PIXELS || data.owners?.length !== TOTAL_PIXELS) return;
      setTerrain(new Uint8Array(data.terrain));
      setOwners(new Uint16Array(data.owners));
      setRoomState(data.room);
      setPlayers(data.room.players || []);
      setGridLoaded(true);
      setGameOverData(null);
    };

    // 4. Game Tick (Deltas & Positions every 100ms)
    const onTick = (data: {
      tick: number;
      incomeCycleProgress: number;
      deltas: number[];
      players: any[];
      boats: any[];
      emojis: any[];
    }) => {
      // Apply deltas immutably into owners array
      if (Array.isArray(data.deltas) && data.deltas.length > 0) {
        setOwners((prevOwners) => {
          if (!prevOwners) return prevOwners;
          const nextOwners = new Uint16Array(prevOwners);
          for (let i = 0; i < data.deltas.length; i += 2) {
            const pixelIdx = data.deltas[i];
            const newOwner = data.deltas[i + 1];
            if (pixelIdx >= 0 && pixelIdx < TOTAL_PIXELS) {
              nextOwners[pixelIdx] = newOwner;
            }
          }
          return nextOwners;
        });
      }

      // Update player live stats
      if (Array.isArray(data.players)) {
        setPlayers((prev) => {
          const map = new Map(data.players.map(p => [p.id, p]));
          return prev.map(p => {
            const updated = map.get(p.id);
            return updated ? { ...p, ...updated } : p;
          });
        });
      }

      // Update boats & emojis
      if (Array.isArray(data.boats)) setBoats(data.boats);
      if (Array.isArray(data.emojis)) setEmojis(data.emojis);

      // Update income bar
      setRoomState((prev: any) => prev ? { ...prev, incomeCycleProgress: data.incomeCycleProgress } : prev);
    };

    // 5. Truce Offered
    const onTruceOffered = (data: { offererId: number; offererName: string }) => {
      setTruceOffer(data);
    };

    // 6. Truce Formed
    const onTruceFormed = (data: { playerA: number; playerB: number }) => {
      const key = `${Math.min(data.playerA, data.playerB)}_${Math.max(data.playerA, data.playerB)}`;
      setTruces(prev => new Set(prev).add(key));
      showToast(`🤝 Barış Paktı Kuruldu!`);
    };

    // 7. Truce Broken
    const onTruceBroken = (data: { attackerId: number; defenderId: number }) => {
      const key = `${Math.min(data.attackerId, data.defenderId)}_${Math.max(data.attackerId, data.defenderId)}`;
      setTruces(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      showToast(`⚠️ Barış paktı bozuldu! Bir müttefik diğerine saldırdı.`);
    };

    // 8. Player Eliminated
    const onPlayerEliminated = (data: { victimId: number; killerId: number }) => {
      const victim = players.find(p => p.id === data.victimId)?.username || "Bir oyuncu";
      const killer = players.find(p => p.id === data.killerId)?.username || "rakibi";
      showToast(`⚔️ ${victim}, ${killer} tarafından haritadan silindi!`);
    };

    // 9. Floating Emoji Shown
    const onEmojiShown = (emoji: CanvasEmojiInfo) => {
      setEmojis(prev => [...prev.filter(e => e.id !== emoji.id), emoji]);
    };

    // 10. Game Over
    const onGameOver = (data: any) => {
      setGameOverData(data);
    };

    // 11. Instant In-App Invite Notification
    const onInviteReceived = (invite: any) => {
      setIncomingInvite(invite);
    };

    socket.on("kapstorial:room_state", onRoomState);
    socket.on("kapstorial:spawn_countdown", onSpawnCountdown);
    socket.on("kapstorial:game_start", onGameStart);
    socket.on("kapstorial:tick", onTick);
    socket.on("kapstorial:truce_offered", onTruceOffered);
    socket.on("kapstorial:truce_formed", onTruceFormed);
    socket.on("kapstorial:truce_broken", onTruceBroken);
    socket.on("kapstorial:player_eliminated", onPlayerEliminated);
    socket.on("kapstorial:emoji_shown", onEmojiShown);
    socket.on("kapstorial:game_over", onGameOver);
    socket.on("kapstorial:invite_received", onInviteReceived);

    return () => {
      socket.off("kapstorial:room_state", onRoomState);
      socket.off("kapstorial:spawn_countdown", onSpawnCountdown);
      socket.off("kapstorial:game_start", onGameStart);
      socket.off("kapstorial:tick", onTick);
      socket.off("kapstorial:truce_offered", onTruceOffered);
      socket.off("kapstorial:truce_formed", onTruceFormed);
      socket.off("kapstorial:truce_broken", onTruceBroken);
      socket.off("kapstorial:player_eliminated", onPlayerEliminated);
      socket.off("kapstorial:emoji_shown", onEmojiShown);
      socket.off("kapstorial:game_over", onGameOver);
      socket.off("kapstorial:invite_received", onInviteReceived);
    };
  }, [socket]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const myPlayer = players.find(p => p.userId === currentUserId);
  const myPlayerId = myPlayer?.id || null;

  const handleSelectSpawn = (pixelIndex: number) => {
    if (socket) {
      socket.emit("kapstorial:set_spawn", { pixelIndex }, (res: any) => { if (res?.success) setSelectedSpawnPixel(pixelIndex); else showToast(res?.error || "Bu konum seçilemedi."); });
    }
  };

  const handleMapClick = (pixelIndex: number, ownerId: number, screenX: number, screenY: number) => {
    if (!socket || !myPlayer || !myPlayer.isAlive) return;

    if (ownerId > 0 && ownerId !== myPlayerId) {
      const targetP = players.find(p => p.id === ownerId);
      if (targetP) {
        setRadialTargetPixel(pixelIndex);
        setRadialTargetPlayer(targetP);
        return;
      }
    }

    socket.emit("kapstorial:attack", {
      targetPixel: pixelIndex,
      percentage: attackPercentage
    }, (res: any) => { if (!res?.success && res?.error) showToast(res.error); });
  };

  const handleChangeAttackPercentage = (pct: number) => {
    setAttackPercentage(pct);
    if (socket) {
      socket.emit("kapstorial:set_attack_percentage", { percentage: pct });
    }
  };

  const handleSendEmoji = (emoji: string) => {
    if (socket) {
      socket.emit("kapstorial:send_emoji", { emoji });
    }
  };

  const handleStartGame = () => {
    if (socket) {
      socket.emit("kapstorial:start_game", (res: any) => {
        if (!res?.success) {
          alert(res?.error || "Oyun başlatılamadı.");
        }
      });
    }
  };

  const handleAcceptTruce = () => {
    if (!socket || !truceOffer) return;
    socket.emit("kapstorial:accept_truce", { offererPlayerId: truceOffer.offererId });
    setTruceOffer(null);
  };

  if (view === 'lobby' || !roomState) {
    return (
      <div className="relative w-full h-full flex flex-col">
        <KapstorialLobby
          socket={socket}
          currentUserId={currentUserId}
          currentUsername={username}
          currentUserChips={1000}
          onJoinRoom={handleJoinRoom}
          onBackToHub={onBackToHub}
        />

        {incomingInvite && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-sky-500/50 p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom duration-200 text-white max-w-sm">
            <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center font-black text-white shrink-0">
              <Swords className="w-5 h-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-black text-sky-400 uppercase">Kapstorial Daveti</span>
              <span className="text-xs text-slate-200">
                <strong>{incomingInvite.inviterName}</strong> sizi {incomingInvite.mapName} haritasında maça davet ediyor!
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => {
                  handleJoinRoom(incomingInvite.roomCode);
                  setIncomingInvite(null);
                }}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow"
              >
                Katıl
              </button>
              <button
                onClick={() => setIncomingInvite(null)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1.5"
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (roomState.status === 'waiting') {
    return (
      <KapstorialWaitingRoom
        socket={socket}
        room={roomState}
        currentUserId={currentUserId}
        onLeave={handleLeaveRoom}
        onStartGame={handleStartGame}
      />
    );
  }

  const isSpectator = myPlayer ? !myPlayer.isAlive : true;
  const isTargetAlly = radialTargetPlayer && myPlayerId 
    ? truces.has(`${Math.min(myPlayerId, radialTargetPlayer.id)}_${Math.max(myPlayerId, radialTargetPlayer.id)}`)
    : false;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* 60 FPS Canvas Game Engine (Absolute z-0 behind HUD) */}
      <KapstorialCanvas
        terrain={terrain}
        owners={owners}
        players={players}
        boats={boats}
        emojis={emojis}
        myPlayerId={myPlayerId}
        gameStatus={roomState.status}
        selectedSpawnPixel={selectedSpawnPixel}
        onSelectSpawn={handleSelectSpawn}
        onMapClick={handleMapClick}
      />

      {!gridLoaded && <div role="status" className="absolute inset-0 z-40 grid place-items-center bg-slate-950 text-white">Harita yükleniyor…</div>}
      {/* Heads-Up Display (HUD) (z-25 on top of canvas) */}
      {roomState.status !== 'spawn_phase' && <KapstorialHUD
        players={players}
        myPlayerId={myPlayerId}
        totalConquerablePixels={roomState.totalConquerablePixels || 1}
        incomeCycleProgress={roomState.incomeCycleProgress || 0}
        attackPercentage={attackPercentage}
        onChangeAttackPercentage={handleChangeAttackPercentage}
        onSendEmoji={handleSendEmoji}
        onSurrender={handleLeaveRoom}
        isSpectator={isSpectator}
      />}
      {roomState.status === 'spawn_phase' && <div className="absolute bottom-3 inset-x-3 z-20 flex justify-between items-center text-white text-sm"><span className="rounded-xl bg-slate-900/90 p-3">Başlangıç seçimi: {roomState.spawnCountdownRemaining} sn</span><button className="rounded-xl bg-slate-800 p-3" onClick={handleLeaveRoom}>Ayrıl</button></div>}

      {/* Radial / Context Menu on Enemy/Ally Click */}
      {radialTargetPlayer && myPlayer && (
        <KapstorialRadialMenu
          targetPlayer={radialTargetPlayer}
          myPlayer={myPlayer}
          isAlly={isTargetAlly}
          onAttack={() => {
            if (socket) {
              socket.emit("kapstorial:attack", {
                targetPixel: radialTargetPixel,
                percentage: attackPercentage
              });
            }
          }}
          onProposeTruce={() => {
            if (socket) {
              socket.emit("kapstorial:propose_truce", { targetPlayerId: radialTargetPlayer.id });
              showToast(`${radialTargetPlayer.username} oyuncusuna barış teklifi gönderildi!`);
            }
          }}
          onDonate={() => {
            if (socket) {
              socket.emit("kapstorial:donate_troops", {
                targetPlayerId: radialTargetPlayer.id,
                percentage: attackPercentage
              });
            }
          }}
          onSendEmoji={handleSendEmoji}
          onClose={() => setRadialTargetPlayer(null)}
        />
      )}

      {/* Incoming Truce Proposal Toast Notification */}
      {truceOffer && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 border border-emerald-500/60 p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top text-white max-w-sm">
          <Handshake className="w-8 h-8 text-emerald-400 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-black text-emerald-400">Barış Paktı Teklifi!</span>
            <span className="text-xs text-slate-200">
              <strong>{truceOffer.offererName}</strong> sizinle saldırmazlık paktı kurmak istiyor.
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              onClick={handleAcceptTruce}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow"
            >
              Kabul Et
            </button>
            <button
              onClick={() => setTruceOffer(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs px-2 py-1.5 rounded-xl"
            >
              Reddet
            </button>
          </div>
        </div>
      )}

      {/* In-Game Action Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 border border-slate-700 backdrop-blur-md px-4 py-2 rounded-full shadow-2xl text-xs font-bold text-slate-200 animate-in fade-in duration-200">
          {toastMessage}
        </div>
      )}

      {/* Victory / Game Over Modal */}
      {gameOverData && (
        <KapstorialVictoryModal
          winnerPlayerId={gameOverData.winnerPlayerId}
          winnerTeam={gameOverData.winnerTeam}
          winnerReason={gameOverData.reason}
          pot={gameOverData.pot || 0}
          players={players}
          myPlayerId={myPlayerId}
          onReturnToLobby={handleLeaveRoom}
        />
      )}
    </div>
  );
}
