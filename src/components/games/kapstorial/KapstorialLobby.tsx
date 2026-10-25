import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Plus, 
  Users, 
  MapPin, 
  Bot, 
  Coins, 
  ArrowLeft, 
  Sparkles, 
  RefreshCw, 
  X, 
  Swords, 
  ShieldCheck,
  Search
} from 'lucide-react';
import { MAP_PRESETS, MapType } from '../../../utils/kapstorialMaps';

interface KapstorialLobbyProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername: string;
  currentUserChips: number;
  onJoinRoom: (roomCode: string) => void;
  onBackToHub: () => void;
}

export default function KapstorialLobby({
  socket,
  currentUserId,
  currentUsername,
  currentUserChips,
  onJoinRoom,
  onBackToHub
}: KapstorialLobbyProps) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');

  // Create Table Form States
  const [tableName, setTableName] = useState(`${currentUsername}'ın Kapstorial Masası`);
  const [selectedMap, setSelectedMap] = useState<MapType>('world');
  const [selectedMode, setSelectedMode] = useState<'ffa' | 'teams_2' | 'teams_4'>('ffa');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [botCount, setBotCount] = useState(15);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'normal' | 'hard'>('normal');
  const [buyIn, setBuyIn] = useState(0);

  const fetchRooms = () => {
    if (!socket) return;
    setLoading(true);
    socket.emit("kapstorial:get_rooms", (res: any[]) => {
      if (Array.isArray(res)) setRooms(res);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchRooms();
    if (!socket) return;
    socket.on("kapstorial:rooms_list", (list: any[]) => {
      if (Array.isArray(list)) setRooms(list);
    });
    return () => {
      socket.off("kapstorial:rooms_list");
    };
  }, [socket]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;

    if (buyIn > currentUserChips) {
      alert("Bu masa için yeterli çipiniz bulunmuyor!");
      return;
    }

    socket.emit("kapstorial:create_room", {
      name: tableName.trim() || `${currentUsername}'ın Masası`,
      mapType: selectedMap,
      gameMode: selectedMode,
      maxPlayers,
      botCount,
      botDifficulty,
      buyIn
    }, (res: any) => {
      if (res?.success && res.room) {
        setShowCreateModal(false);
        onJoinRoom(res.room.roomCode);
      } else {
        alert(res?.error || "Masa oluşturulamadı.");
      }
    });
  };

  const handleDirectCodeJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCodeInput.trim().toUpperCase();
    if (clean.length < 4) {
      alert("Lütfen geçerli bir 6 haneli oda kodu girin.");
      return;
    }
    onJoinRoom(clean);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-4 sm:p-8 flex flex-col items-center">
      <div className="max-w-5xl w-full flex flex-col gap-6">
        {/* Navigation & Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl">🗺️</span>
                <h1 className="text-2xl font-black text-white">Kapstorial</h1>
                <span className="bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full">
                  TERRITORIAL STRATEJİ
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Toprak fethet, ordunu büyüt, faiz döngülerini yönet ve dünyayı ele geçir!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={fetchRooms}
              className="p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-all shadow"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 sm:flex-initial bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black px-5 py-3 rounded-2xl shadow-xl shadow-sky-900/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            >
              <Plus className="w-5 h-5" />
              <span>Yeni Masa Kur</span>
            </button>
          </div>
        </div>

        {/* Quick Join Code Bar */}
        <div className="bg-slate-900 border border-slate-800/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5 text-xs font-bold text-slate-300">
            <Search className="w-4 h-4 text-sky-400" />
            <span>Özel Masa Koduna Sahip misin?</span>
          </div>
          <form onSubmit={handleDirectCodeJoin} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="ODA KODU (örn: 9X4K2L)"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              maxLength={8}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono uppercase font-black text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-full sm:w-44 text-center tracking-widest"
            />
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 py-2 rounded-xl text-xs shadow transition-all shrink-0"
            >
              Katıl
            </button>
          </form>
        </div>

        {/* Active Tables List */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Açık Kapstorial Masaları ({rooms.length})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map((r) => {
              const mapMeta = MAP_PRESETS[r.mapType as MapType] || MAP_PRESETS.world;
              return (
                <div
                  key={r.roomCode}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl flex flex-col justify-between gap-4 transition-all hover:scale-[1.01]"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-black text-sky-400 bg-sky-950/60 border border-sky-500/30 px-2 py-0.5 rounded-lg">
                        {r.roomCode}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        r.status === 'Oyunda' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    <h3 className="font-black text-base text-white truncate">{r.name}</h3>

                    <div className="flex flex-col gap-1 text-xs text-slate-400">
                      <span>Kurucu: <strong className="text-slate-200">{r.hostName}</strong></span>
                      <span>Harita: <strong className="text-slate-200">{mapMeta.name}</strong></span>
                      <span>Mod: <strong className="text-slate-200">
                        {r.gameMode === 'ffa' ? 'Herkes Tek (FFA)' : (r.gameMode === 'teams_2' ? '2 Takım' : '4 Takım')}
                      </strong></span>
                      <span>Oyuncular: <strong className="text-sky-300">{r.playerCount} / {r.maxPlayers}</strong> (+{r.botCount} Bot)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      {r.buyIn > 0 ? `${r.buyIn} 🪙 Giriş` : 'Ücretsiz'}
                    </span>
                    <button
                      onClick={() => onJoinRoom(r.roomCode)}
                      disabled={r.status === 'Oyunda'}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                        r.status === 'Oyunda'
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg'
                      }`}
                    >
                      {r.status === 'Oyunda' ? 'Devam Ediyor' : 'Masaya Gir'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {rooms.length === 0 && !loading && (
            <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-10 text-center flex flex-col items-center gap-3">
              <span className="text-4xl">🏰</span>
              <h3 className="font-bold text-white text-base">Henüz Açık Kapstorial Masası Yok</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                İlk masayı siz açın, arkadaşlarınızı veya botları davet ederek kıyasıya strateji savaşını başlatın!
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-2 bg-sky-600 hover:bg-sky-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-lg transition-all"
              >
                Yeni Masa Kur
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl flex flex-col gap-5 text-white my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-sky-400" />
                <h3 className="font-black text-lg">Yeni Kapstorial Masası Oluştur</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="flex flex-col gap-4">
              {/* Table Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">Masa Başlığı:</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  maxLength={40}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-semibold"
                />
              </div>

              {/* Map Presets Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-300">Harita Seçimi:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(MAP_PRESETS) as MapType[]).map((key) => {
                    const preset = MAP_PRESETS[key];
                    const isSelected = selectedMap === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedMap(key)}
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                          isSelected
                            ? 'bg-sky-950/40 border-sky-500 shadow-md ring-2 ring-sky-500/20'
                            : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div 
                          className="w-full h-8 rounded-lg mb-1 flex items-center justify-center font-bold text-[10px] text-white/90 shadow-inner"
                          style={{ backgroundColor: preset.previewThumbnailColor }}
                        >
                          {preset.landPercentage}% Kara
                        </div>
                        <span className="font-bold text-xs text-white truncate">{preset.name}</span>
                        <span className="text-[10px] text-slate-400 line-clamp-1">{preset.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Game Mode */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300">Oyun Modu:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'ffa', label: 'Herkes Tek (FFA)' },
                    { id: 'teams_2', label: '2 Takım (Kırmızı vs Mavi)' },
                    { id: 'teams_4', label: '4 Takımlı Savaş' }
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMode(m.id as any)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                        selectedMode === m.id
                          ? 'bg-sky-600 border-sky-400 text-white shadow'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot Count & Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-bold text-slate-300">
                    <span>Bot Sayısı:</span>
                    <span className="text-sky-400 font-black">{botCount} Bot</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="60"
                    step="5"
                    value={botCount}
                    onChange={(e) => setBotCount(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-300">Bot Zorluğu:</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'easy', label: 'Kolay' },
                      { id: 'normal', label: 'Normal' },
                      { id: 'hard', label: 'Zor (Acımasız)' }
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setBotDifficulty(d.id as any)}
                        className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          botDifficulty === d.id
                            ? 'bg-rose-600 border-rose-400 text-white shadow'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Buy-In / Chips Entry Fee */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>Giriş Ücreti (Kazanan Potu Alır):</span>
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[0, 50, 100, 250, 500, 1000, 5000].map((fee) => (
                    <button
                      key={fee}
                      type="button"
                      onClick={() => setBuyIn(fee)}
                      className={`py-1.5 rounded-xl text-xs font-black border transition-all ${
                        buyIn === fee
                          ? 'bg-amber-500 border-amber-300 text-slate-950 shadow'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {fee === 0 ? 'Ücretsiz' : `${fee} 🪙`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm shadow-xl transition-all"
                >
                  Masayı Kur ve Bekleme Odasına Geç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
