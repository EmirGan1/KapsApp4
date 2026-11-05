import React from "react";
import { Socket } from "socket.io-client";

interface StrikeInventoryProps {
  socket?: Socket | null;
  initialSkin?: string;
  onSkin?: (skin: string) => void;
  onChange?: (state: { equipped: any }) => void;
}

export default function StrikeInventory({
  socket,
  initialSkin,
  onSkin,
  onChange
}: StrikeInventoryProps) {
  return (
    <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 text-slate-100 max-w-md w-full">
      <h3 className="text-sm font-bold text-amber-400 mb-2">Envanter & Kozmetikler</h3>
      <p className="text-xs text-slate-400">Silah kaplamaları ve karakter donanımları burada listelenir.</p>
    </div>
  );
}
