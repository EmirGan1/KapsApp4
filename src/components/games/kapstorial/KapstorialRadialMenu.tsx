import React from 'react';
import { Swords, Handshake, Gift, Smile, X, Crown, Shield } from 'lucide-react';
import { CanvasPlayerInfo } from './KapstorialCanvas';

interface KapstorialRadialMenuProps {
  targetPlayer: CanvasPlayerInfo;
  myPlayer: CanvasPlayerInfo;
  isAlly: boolean;
  onAttack: () => void;
  onProposeTruce: () => void;
  onDonate: () => void;
  onSendEmoji: (emoji: string) => void;
  onClose: () => void;
}

export default function KapstorialRadialMenu({
  targetPlayer,
  myPlayer,
  isAlly,
  onAttack,
  onProposeTruce,
  onDonate,
  onSendEmoji,
  onClose
}: KapstorialRadialMenuProps) {
  const [showEmojis, setShowEmojis] = React.useState(false);
  const EMOJIS = ['🤝', '⚔️', '🏳️', '❤️', '😂', '😡', '👑', '🔥'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-white relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Target Header */}
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg shrink-0 border-2 border-white/30"
            style={{ backgroundColor: targetPlayer.color }}
          >
            {targetPlayer.username.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base truncate">{targetPlayer.username}</span>
              {isAlly && (
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/40">
                  MÜTTEFİK
                </span>
              )}
            </div>
            <span className="text-xs text-slate-400 font-semibold">
              Asker: <strong className="text-white">{targetPlayer.troops.toLocaleString()}</strong> • Toprak: <strong className="text-amber-400">{targetPlayer.pixels} piksel</strong>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {!showEmojis ? (
          <div className="grid grid-cols-1 gap-2 pt-1">
            {/* 1. Attack Button */}
            <button
              onClick={() => {
                onAttack();
                onClose();
              }}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white font-bold shadow-lg shadow-rose-900/40 transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center gap-2.5">
                <Swords className="w-5 h-5 text-rose-200" />
                <span>Doğrudan Saldır</span>
              </div>
              <span className="text-xs bg-black/30 px-2 py-0.5 rounded-md">%{myPlayer.attackPercentage} Güç</span>
            </button>

            {/* 2. Truce Button */}
            {!isAlly && (
              <button
                onClick={() => {
                  onProposeTruce();
                  onClose();
                }}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold shadow transition-all hover:scale-[1.02]"
              >
                <div className="flex items-center gap-2.5">
                  <Handshake className="w-5 h-5 text-emerald-400" />
                  <span>Saldırmazlık Paktı (Truce)</span>
                </div>
                <span className="text-xs text-emerald-400">Barış Teklifi</span>
              </button>
            )}

            {/* 3. Donate Troops Button */}
            <button
              onClick={() => {
                onDonate();
                onClose();
              }}
              className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-200 font-bold shadow transition-all hover:scale-[1.02]"
            >
              <div className="flex items-center gap-2.5">
                <Gift className="w-5 h-5 text-amber-400" />
                <span>Asker Yardımı Gönder</span>
              </div>
              <span className="text-xs text-amber-400">%10 Vergi</span>
            </button>

            {/* 4. Emoji Button */}
            <button
              onClick={() => setShowEmojis(true)}
              className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-300 font-semibold text-sm transition-all"
            >
              <div className="flex items-center gap-2.5">
                <Smile className="w-4 h-4 text-sky-400" />
                <span>Emoji / İşaret Gönder</span>
              </div>
              <span className="text-xs text-slate-400">Seç</span>
            </button>
          </div>
        ) : (
          /* Emojis Selector Grid */
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">Haritada Gösterilecek Emoji:</span>
              <button
                onClick={() => setShowEmojis(false)}
                className="text-xs text-sky-400 hover:underline"
              >
                Geri
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {EMOJIS.map((em) => (
                <button
                  key={em}
                  onClick={() => {
                    onSendEmoji(em);
                    onClose();
                  }}
                  className="h-12 text-2xl bg-slate-800 hover:bg-slate-700 rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
