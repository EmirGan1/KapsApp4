import React from "react";
import { Socket } from "socket.io-client";

interface StrikeInventoryAdminProps {
  socket?: Socket | null;
}

export default function StrikeInventoryAdmin({ socket }: StrikeInventoryAdminProps) {
  return (
    <div className="p-4 bg-slate-900/90 rounded-2xl border border-amber-600/40 text-slate-100 max-w-md w-full">
      <h3 className="text-sm font-bold text-amber-400 mb-2">Kozmetik Yönetimi (Admin)</h3>
      <p className="text-xs text-slate-400">Özel kaplama tanımlama ve dağıtım paneli.</p>
    </div>
  );
}
