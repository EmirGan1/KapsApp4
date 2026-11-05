import React from "react";

interface StrikeMinimapProps {
  map?: any;
  hud?: any;
}

export default function StrikeMinimap({ map, hud }: StrikeMinimapProps) {
  return (
    <div className="absolute top-4 left-4 z-20 w-32 h-32 rounded-2xl bg-black/40 border border-white/20 backdrop-blur-md overflow-hidden p-1 shadow-lg pointer-events-none">
      <div className="w-full h-full border border-dashed border-white/10 rounded-xl flex items-center justify-center text-[10px] text-white/50 font-bold uppercase tracking-wider">
        {map?.name || "RADAR"}
      </div>
    </div>
  );
}
