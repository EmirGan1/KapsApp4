import React, { useEffect } from 'react';
import { 
  Crown, 
  Coins, 
  ShieldAlert, 
  Percent, 
  Ship, 
  Swords, 
  Sparkles, 
  LogOut, 
  Smile, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { CanvasPlayerInfo } from './KapstorialCanvas';

interface KapstorialHUDProps {
  players: CanvasPlayerInfo[];
  myPlayerId: number | null;
  totalConquerablePixels: number;
  incomeCycleProgress: number; // 0..100
  attackPercentage: number;
  onChangeAttackPercentage: (pct: number) => void;
  onSendEmoji: (emoji: string) => void;
  onSurrender: () => void;
  isSpectator: boolean;
}

export default function KapstorialHUD({
  players,
  myPlayerId,
  totalConquerablePixels,
  incomeCycleProgress,
  attackPercentage,
  onChangeAttackPercentage,
  onSendEmoji,
  onSurrender,
  isSpectator
}: KapstorialHUDProps) {
  const [showLeaderboardDetails, setShowLeaderboardDetails] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);

  // Sorted leaderboard
  const sortedPlayers = [...players]
    .filter(p => p.isAlive || p.pixels > 0)
    .sort((a, b) => b.pixels - a.pixels);

  const myPlayer = players.find(p => p.id === myPlayerId);

  // Keyboard Shortcuts (1-9 for 10%-90%, 0 for 100%)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((document.activeElement?.tagName || '').toLowerCase())) return;

      if (e.key >= '1' && e.key <= '9') {
        const val = Number(e.key) * 10;
        onChangeAttackPercentage(val);
      } else if (e.key === '0') {
        onChangeAttackPercentage(100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onChangeAttackPercentage]);

  const QUICK_PERCENTAGES = [10, 25, 50, 100];
  const EMOJI_LIST = ['🏳️', '🤝', '⚔️', '😂', '😡', '❤️', '👑', '🔥', '💀', '👍'];

  // Troop Formatting Helper
  const formatTroops = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  // Interest Status / Cap Colors
  const softCap = (myPlayer?.pixels || 0) * 100;
  const hardCap = (myPlayer?.pixels || 0) * 150;
  const myTroops = myPlayer?.troops || 0;

  let capStatusColor = 'text-emerald-400';
  let capLabel = 'Verimli Faiz';
  if (myTroops >= hardCap * 0.95) {
    capStatusColor = 'text-rose-500 font-black animate-pulse';
    capLabel = 'Maksimum Kapasite (Kırmızı Faiz)';
  } else if (myTroops >= softCap) {
    capStatusColor = 'text-amber-400 font-bold';
    capLabel = 'Kapasite Doluyor (Düşük Faiz)';
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-4 z-20 overflow-hidden">
      {/* ============================================================ */}
      {/* TOP BAR: LEADERBOARD & STATS & 5S INCOME BAR */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center justify-between gap-2">
          {/* Top Leaderboard Strip */}
          <div className="flex-1 max-w-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded-xl px-3 py-2 shadow-xl">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-300">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Liderlik Sıralaması</span>
              </div>
              <button
                onClick={() => setShowLeaderboardDetails(!showLeaderboardDetails)}
                className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5"
              >
                {showLeaderboardDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showLeaderboardDetails ? 'Daralt' : 'Tümü'}
              </button>
            </div>

            {/* Horizontal Mini Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {sortedPlayers.slice(0, showLeaderboardDetails ? 10 : 4).map((p, idx) => {
                const landPct = totalConquerablePixels > 0 ? (p.pixels / totalConquerablePixels) * 100 : 0;
                const isMe = p.id === myPlayerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs shrink-0 transition-colors ${
                      isMe 
                        ? 'bg-sky-500/20 border border-sky-400/50 text-sky-200' 
                        : 'bg-slate-800/80 border border-slate-700/50 text-slate-300'
                    }`}
                  >
                    <span className="font-black text-[10px] text-slate-400">#{idx + 1}</span>
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: p.color }} 
                    />
                    <span className="font-bold truncate max-w-[70px] sm:max-w-[90px]">{p.username}</span>
                    <span className="font-black text-amber-400 text-[10px]">{landPct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave / Surrender Button */}
          <button
            onClick={onSurrender}
            className="bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 px-3 py-2 rounded-xl text-xs font-bold shadow-lg transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ayrıl</span>
          </button>
        </div>

        {/* 5-Second Income Cycle Progress Bar */}
        <div className="w-full max-w-xl bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-3 py-1.5 shadow-md flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 shrink-0">
            <Coins className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Toprak Geliri (5s)</span>
          </div>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 relative">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-400 transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${incomeCycleProgress}%` }}
            />
          </div>
          <span className="text-[10px] font-black text-emerald-400 shrink-0">
            +{myPlayer?.pixels || 0} Asker
          </span>
        </div>
      </div>

      {/* ============================================================ */}
      {/* BOTTOM CONTROLS: ATTACK SLIDER & QUICK SHORTCUTS */}
      {/* ============================================================ */}
      <div className="flex flex-col gap-2 pointer-events-auto max-w-xl mx-auto w-full">
        {/* Floating Emoji Picker Modal if opened */}
        {showEmojiPicker && (
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 p-2.5 rounded-2xl shadow-2xl flex items-center justify-center gap-2 flex-wrap mb-2">
            {EMOJI_LIST.map((em) => (
              <button
                key={em}
                onClick={() => {
                  onSendEmoji(em);
                  setShowEmojiPicker(false);
                }}
                className="w-10 h-10 text-xl hover:scale-125 transition-transform flex items-center justify-center rounded-xl hover:bg-slate-800"
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {/* Main Action HUD Card */}
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3 sm:p-4 rounded-2xl shadow-2xl flex flex-col gap-3">
          {/* Status Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
                style={{ backgroundColor: myPlayer?.color || '#3b82f6' }}
              />
              <div className="flex flex-col">
                <span className="text-sm font-black text-white flex items-center gap-1.5">
                  {formatTroops(myTroops)} <span className="text-xs font-normal text-slate-400">Asker</span>
                </span>
                <span className={`text-[10px] ${capStatusColor}`}>
                  {capLabel}
                </span>
              </div>
            </div>

            {/* Quick Emoji Button */}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 flex items-center gap-1.5 shadow"
            >
              <Smile className="w-3.5 h-3.5 text-amber-400" />
              <span>Emoji</span>
            </button>
          </div>

          {/* Slider & Percentage */}
          {!isSpectator && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1">
                  <Swords className="w-3.5 h-3.5 text-rose-400" />
                  Saldırı Gücü:
                </span>
                <span className="font-black text-rose-400 text-sm">
                  %{attackPercentage} ({formatTroops(Math.round(myTroops * (attackPercentage / 100)))} Asker)
                </span>
              </div>

              {/* Range Input Slider */}
              <input
                type="range"
                min="1"
                max="100"
                value={attackPercentage}
                onChange={(e) => onChangeAttackPercentage(Number(e.target.value))}
                className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />

              {/* Quick Presets Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {QUICK_PERCENTAGES.map((pct) => (
                  <button
                    key={pct}
                    onClick={() => onChangeAttackPercentage(pct)}
                    className={`py-1 text-xs font-black rounded-lg transition-colors border ${
                      attackPercentage === pct
                        ? 'bg-rose-600 border-rose-400 text-white shadow-md'
                        : 'bg-slate-800/90 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }`}
                  >
                    %{pct}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Spectator Notice */}
          {isSpectator && (
            <div className="text-center py-1 text-xs font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded-xl">
              İzleyici Modundasınız. Oyunu izleyebilir veya yeni maçı bekleyebilirsiniz.
            </div>
          )}

          {/* Help Tip */}
          <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-2">
            <span>💡 İpucu: Boş veya düşman toprağına tıklayarak saldırın; denize tıklayarak gemi çıkarın!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
