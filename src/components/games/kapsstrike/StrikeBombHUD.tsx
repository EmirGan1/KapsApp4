import React from "react";
import { Socket } from "socket.io-client";

interface StrikeBombHUDProps {
  touch?: boolean;
  onEquipBomb?: () => void;
  socket?: Socket | null;
  players?: any[];
  interactKey?: string;
  onShopChange?: (open: boolean) => void;
}

export default function StrikeBombHUD({
  touch,
  onEquipBomb,
  interactKey = "KeyE",
  onShopChange
}: StrikeBombHUDProps) {
  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-3">
      <div className="px-3 py-1.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs font-black shadow-lg flex items-center gap-2">
        <span>💣 BOMBA GÖREVİ</span>
        {touch && onEquipBomb && (
          <button
            type="button"
            onClick={onEquipBomb}
            className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px]"
          >
            Kur / Al
          </button>
        )}
      </div>
    </div>
  );
}
