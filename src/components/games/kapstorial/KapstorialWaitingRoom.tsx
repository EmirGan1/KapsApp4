import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Users, 
  Play, 
  Check, 
  Bot, 
  MapPin, 
  UserPlus, 
  LogOut, 
  Coins, 
  Shield, 
  Sparkles,
  X,
  Search
} from 'lucide-react';
import { PLAYER_COLORS } from '../../../server/kapstorialServer';
import { MAP_PRESETS, MapType } from '../../../utils/kapstorialMaps';
import Avatar from '../../Avatar';

interface WaitingRoomProps {
  socket: Socket | null;
  room: any;
  currentUserId: number;
  onLeave: () => void;
  onStartGame: () => void;
}

export default function KapstorialWaitingRoom({
  socket,
  room,
  currentUserId,
  onLeave,
  onStartGame
}: WaitingRoomProps) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [searchFriend, setSearchFriend] = useState('');
  const [invitedUserIds, setInvitedUserIds] = useState<Set<number>>(new Set());

  const myPlayer = (room.players || []).find((p: any) => p.userId === currentUserId);
  const isHost = myPlayer?.isHost;
  const currentMap = MAP_PRESETS[room.mapType as MapType] || MAP_PRESETS.world;

  // Fetch friends / online users for invites
  useEffect(() => {
    if (!showInviteModal || !socket) return;
    socket.emit("get_friends", (res: any[]) => {
      if (Array.isArray(res)) setFriendsList(res);
    });
  }, [showInviteModal, socket]);

  const handleSelectColor = (hex: string) => {
    if (!socket) return;
    socket.emit("kapstorial:set_player_settings", { color: hex });
  };

  const handleSelectTeam = (teamId: number) => {
    if (!socket) return;
    socket.emit("kapstorial:set_player_settings", { team: teamId });
  };

  const handleToggleReady = () => {
    if (!socket) return;
    socket.emit("kapstorial:toggle_ready");
  };

  const handleSendInvite = (targetUserId: number) => {
    if (!socket) return;
    socket.emit("kapstorial:send_invite", {
      targetUserId,
      roomCode: room.roomCode,
      mapName: currentMap.name,
      bet: room.buyIn
    });
    setInvitedUserIds(prev => new Set(prev).add(targetUserId));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-6 flex flex-col items-center">
      <div className="max-w-4xl w-full flex flex-col gap-6">
        {/* Top Header Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="bg-sky-500/20 text-sky-400 text-xs font-black px-2.5 py-1 rounded-full border border-sky-500/30">
                KOD: {room.roomCode}
              </span>
              <span className="bg-amber-500/20 text-amber-300 text-xs font-black px-2.5 py-1 rounded-full border border-amber-500/30 flex items-center gap-1">
                <Coins className="w-3 h-3" />
                {room.buyIn > 0 ? `${room.buyIn} 🪙 Giriş` : 'Ücretsiz'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{room.name}</h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Harita: <strong className="text-slate-200">{currentMap.name}</strong> • Mod:{' '}
              <strong className="text-slate-200">
                {room.gameMode === 'ffa' ? 'Herkes Tek (FFA)' : (room.gameMode === 'teams_2' ? '2 Takım' : '4 Takım')}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4 text-sky-400" />
              <span>Arkadaşını Davet Et</span>
            </button>
            <button
              onClick={onLeave}
              className="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>Ayrıl</span>
            </button>
          </div>
        </div>

        {/* Color & Team Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Toprak Renginizi Seçin</span>
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {PLAYER_COLORS.map((hex) => {
              const isSelected = myPlayer?.color === hex;
              const isOccupied = (room.players || []).some((p: any) => p.color === hex && p.id !== myPlayer?.id);
              return (
                <button
                  key={hex}
                  onClick={() => !isOccupied && handleSelectColor(hex)}
                  disabled={isOccupied}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl transition-all flex items-center justify-center shadow-lg relative ${
                    isSelected ? 'ring-4 ring-white scale-110' : (isOccupied ? 'opacity-30 cursor-not-allowed' : 'hover:scale-105')
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {isSelected && <Check className="w-5 h-5 text-white stroke-[3]" />}
                </button>
              );
            })}
          </div>

          {/* Team selector if in team mode */}
          {room.gameMode !== 'ffa' && (
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <span className="text-xs font-bold text-slate-400">Takımınızı Seçin:</span>
              <div className="flex gap-2">
                {(room.gameMode === 'teams_2' ? [1, 2] : [1, 2, 3, 4]).map((tId) => (
                  <button
                    key={tId}
                    onClick={() => handleSelectTeam(tId)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      myPlayer?.team === tId
                        ? 'bg-sky-600 border-sky-400 text-white shadow-lg'
                        : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {tId}. Takım
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Players List Grid */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Bekleme Odasındaki Oyuncular ({(room.players || []).length} / {room.maxPlayers})</span>
            </h2>
            <span className="text-xs font-bold text-slate-400">
              +{room.botCount} Yapay Zeka Botu eklenecek ({room.botDifficulty})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(room.players || []).map((p: any) => {
              const isMe = p.userId === currentUserId;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isMe 
                      ? 'bg-sky-950/30 border-sky-500/50 shadow-md' 
                      : 'bg-slate-800/60 border-slate-700/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow shrink-0 border border-white/20"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.username.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm truncate max-w-[120px]">{p.username}</span>
                        {p.isHost && (
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 font-black px-1.5 py-0.5 rounded border border-amber-500/40">
                            HOST
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        {room.gameMode !== 'ffa' ? `${p.team}. Takım` : 'Bireysel (FFA)'}
                      </span>
                    </div>
                  </div>

                  <div>
                    {p.isReady ? (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-1 rounded-lg">
                        Hazır
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                        Bekliyor
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Start / Ready Buttons Footer */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {!isHost ? (
            <button
              onClick={handleToggleReady}
              className={`px-8 py-3.5 rounded-2xl font-black text-sm transition-all shadow-xl ${
                myPlayer?.isReady
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200'
              }`}
            >
              {myPlayer?.isReady ? '✓ Hazırsınız' : 'Hazır Ver'}
            </button>
          ) : (
            <button
              onClick={onStartGame}
              className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white px-8 py-4 rounded-2xl font-black text-base shadow-2xl transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Oyunu Başlat (10s Spawn Aşaması)</span>
            </button>
          )}
        </div>
      </div>

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-400" />
                <span>Arkadaşlarını Masaya Davet Et</span>
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Arkadaş ara..."
                value={searchFriend}
                onChange={(e) => setSearchFriend(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Friends list */}
            <div className="max-h-60 overflow-y-auto flex flex-col gap-2">
              {friendsList
                .filter(f => (f.username || '').toLowerCase().includes(searchFriend.toLowerCase()))
                .map((f) => {
                  const isInvited = invitedUserIds.has(f.id);
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar url={f.avatar} name={f.username} color={f.color} size={8} />
                        <span className="font-bold text-xs">{f.username}</span>
                      </div>
                      <button
                        onClick={() => handleSendInvite(f.id)}
                        disabled={isInvited}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          isInvited
                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                            : 'bg-sky-600 hover:bg-sky-500 text-white shadow'
                        }`}
                      >
                        {isInvited ? 'Davet Edildi ✓' : 'Davet Et'}
                      </button>
                    </div>
                  );
                })}

              {friendsList.length === 0 && (
                <div className="text-center py-6 text-xs text-slate-400">
                  Henüz arkadaş listenizde kimse görünmüyor.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
