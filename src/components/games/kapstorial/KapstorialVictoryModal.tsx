import React from 'react';
import { Trophy, Crown, Coins, Flame, ArrowRight, RotateCcw, Award } from 'lucide-react';

interface VictoryModalProps {
  winnerPlayerId: number | null;
  winnerTeam: number | null;
  winnerReason: string | null;
  pot: number;
  players: any[];
  myPlayerId: number | null;
  onReturnToLobby: () => void;
}

export default function KapstorialVictoryModal({
  winnerPlayerId,
  winnerTeam,
  winnerReason,
  pot,
  players,
  myPlayerId,
  onReturnToLobby
}: VictoryModalProps) {
  const winnerPlayer = players.find(p => p.id === winnerPlayerId);
  const isMeWinner = winnerPlayer && winnerPlayer.id === myPlayerId;
  const isMyTeamWinner = winnerTeam && players.find(p => p.id === myPlayerId)?.team === winnerTeam;
  const won = isMeWinner || isMyTeamWinner;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl flex flex-col items-center text-center gap-5 relative overflow-hidden">
        {/* Glow Background Gradient */}
        <div 
          className={`absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl opacity-30 ${
            won ? 'bg-amber-500' : 'bg-slate-600'
          }`} 
        />

        {/* Victory Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-2xl shadow-amber-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Trophy className="w-10 h-10 text-amber-400 animate-bounce" />
            </div>
          </div>
          <Crown className="w-7 h-7 text-amber-400 absolute -top-3.5 -right-2 rotate-12 drop-shadow" />
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-black uppercase tracking-widest text-amber-400">
            {won ? '🎉 TEBRİKLER! ZAFER KAZANDINIZ' : 'OYUN SONA ERDİ'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            {winnerPlayer ? winnerPlayer.username : `${winnerTeam}. Takım Kazandı!`}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-sm mt-1">
            {winnerReason || 'Tüm rakipler haritadan silindi ve topraklar ele geçirildi.'}
          </p>
        </div>

        {/* Pot Awarded Banner */}
        {pot > 0 && (
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold text-slate-300">Ödül Havuzu:</span>
            </div>
            <span className="text-base font-black text-amber-300">+{pot.toLocaleString()} 🪙 Çip</span>
          </div>
        )}

        {/* Top 3 Stats Podiums */}
        <div className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-2">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider text-left">
            Son Sıralama:
          </span>
          <div className="flex flex-col gap-1.5">
            {[...players]
              .sort((a, b) => b.pixels - a.pixels)
              .slice(0, 3)
              .map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-900 border border-slate-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-400">#{idx + 1}</span>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="font-bold text-white truncate max-w-[140px]">{p.username}</span>
                  </div>
                  <span className="font-bold text-slate-300">{p.pixels} Toprak ({p.troops.toLocaleString()} Asker)</span>
                </div>
              ))}
          </div>
        </div>

        {/* Actions Button */}
        <button
          onClick={onReturnToLobby}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Lobiye Geri Dön</span>
        </button>
      </div>
    </div>
  );
}
