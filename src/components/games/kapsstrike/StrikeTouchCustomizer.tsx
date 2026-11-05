import React, { useState, useRef, useEffect } from "react";
import {
  type TouchLayout,
  type TouchControlId,
  type TouchControlItem,
  DEFAULT_TOUCH_LAYOUT,
  loadTouchLayout,
  saveTouchLayout,
  resetTouchLayout,
} from "../../../games/kapsstrike/touchLayout";

interface StrikeTouchCustomizerProps {
  onClose: () => void;
  onSave: (layout: TouchLayout) => void;
}

export default function StrikeTouchCustomizer({
  onClose,
  onSave,
}: StrikeTouchCustomizerProps) {
  const [layout, setLayout] = useState<TouchLayout>(() => loadTouchLayout());
  const [selectedId, setSelectedId] = useState<TouchControlId>("fire");
  const [saveToast, setSaveToast] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<TouchControlId | null>(null);

  const selectedItem = layout[selectedId];

  // Dragging logic via pointer events
  const handlePointerDown = (id: TouchControlId, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    draggingId.current = id;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(5, Math.min(95, Math.round(rawX)));
    const clampedY = Math.max(5, Math.min(95, Math.round(rawY)));

    setLayout((prev) => ({
      ...prev,
      [draggingId.current!]: {
        ...prev[draggingId.current!],
        x: clampedX,
        y: clampedY,
      },
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      draggingId.current = null;
    }
  };

  const updateSize = (newSize: number) => {
    setLayout((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        size: Math.round(newSize * 100) / 100,
      },
    }));
  };

  const updateOpacity = (newOpacity: number) => {
    setLayout((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        opacity: Math.round(newOpacity * 100) / 100,
      },
    }));
  };

  const handleSave = () => {
    saveTouchLayout(layout);
    onSave(layout);
    setSaveToast(true);
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const handleReset = () => {
    const def = resetTouchLayout();
    setLayout({ ...def });
  };

  const applyPreset = (preset: "tablet" | "lefty") => {
    if (preset === "tablet") {
      setLayout({ ...DEFAULT_TOUCH_LAYOUT });
    } else if (preset === "lefty") {
      setLayout({
        ...layout,
        fire: { ...layout.fire, x: 14, y: 76 },
        ads: { ...layout.ads, x: 12, y: 50 },
        joystick: { ...layout.joystick, x: 84, y: 78 },
        reload: { ...layout.reload, x: 25, y: 64 },
        inspect: { ...layout.inspect, x: 33, y: 51 },
        jump: { ...layout.jump, x: 22, y: 45 },
        crouch: { ...layout.crouch, x: 27, y: 82 },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/95 flex flex-col select-none touch-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-lg">
            🎮
          </span>
          <div>
            <h2 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <span>Mobil Tuş Düzeni Özelleştirme</span>
              <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded">
                PUBG STİLİ
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Tuşları ekranda dilediğin yere sürükle, boyutunu ve saydamlığını ayarla
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            <button
              type="button"
              onClick={() => applyPreset("tablet")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700"
            >
              Tablet Düzeni
            </button>
            <button
              type="button"
              onClick={() => applyPreset("lefty")}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700"
            >
              Solak Düzen
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
          >
            Sıfırla
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-colors"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs font-black shadow-md shadow-amber-500/20 transition-all transform active:scale-95"
          >
            {saveToast ? "✓ Kaydedildi!" : "Kaydet ve Çık"}
          </button>
        </div>
      </header>

      {/* Main Touch Canvas Interactive Area */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex-1 relative bg-slate-900/60 overflow-hidden cursor-crosshair"
        style={{
          backgroundImage: `
            radial-gradient(circle at center, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.9) 100%),
            linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        }}
      >
        {/* Subtle Crosshair in center for reference */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-8 h-0.5 bg-amber-400" />
          <div className="h-8 w-0.5 bg-amber-400 absolute" />
        </div>

        {/* Watermark hints */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[11px] text-slate-500/70 font-semibold uppercase tracking-widest pointer-events-none">
          Oyun Ekranı Alanı · Taşımak için tuşu tutup sürükleyin
        </div>

        {/* Render each touch control button as draggable */}
        {(Object.keys(layout) as TouchControlId[]).map((id) => {
          const item = layout[id];
          const isSelected = selectedId === id;

          // Distinct visuals per button
          const isFire = id === "fire";
          const isJoystick = id === "joystick";
          const isWeapon = id === "weapon";
          const isInspect = id === "inspect";

          return (
            <div
              key={id}
              onPointerDown={(e) => handlePointerDown(id, e)}
              className={`absolute cursor-grab active:cursor-grabbing select-none transition-shadow ${
                isSelected
                  ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-950 shadow-2xl z-30"
                  : "z-10 hover:ring-1 hover:ring-white/40"
              }`}
              style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                transform: `translate(-50%, -50%) scale(${item.size})`,
                opacity: item.opacity,
                touchAction: "none",
              }}
            >
              {isJoystick ? (
                // Joystick Mockup
                <div className="w-24 h-24 rounded-full border-2 border-dashed border-amber-400/50 bg-slate-900/60 flex items-center justify-center shadow-lg backdrop-blur-xs">
                  <div className="w-10 h-10 rounded-full bg-amber-500/80 border-2 border-white shadow flex items-center justify-center text-xs font-black text-slate-950">
                    🕹️
                  </div>
                  <span className="absolute -bottom-5 text-[10px] font-black text-amber-300 tracking-wider">
                    JOYSTICK
                  </span>
                </div>
              ) : isWeapon ? (
                // Compact Weapon Card Mockup
                <div className="px-4 py-2 rounded-xl bg-slate-900/90 border border-amber-500/50 shadow-lg flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-black text-white">AK-47 / SİLAH</span>
                  <span className="text-[10px] font-mono text-amber-400">30/90</span>
                </div>
              ) : isFire ? (
                // Big Fire Button Mockup
                <div className="w-20 h-20 rounded-full bg-red-600/90 border-2 border-red-400 shadow-2xl flex flex-col items-center justify-center text-white font-black text-sm tracking-wider">
                  <span>💥</span>
                  <span className="text-[11px] leading-tight">ATEŞ</span>
                </div>
              ) : isInspect ? (
                // Inspect Weapon Button Mockup
                <div className="w-14 h-14 rounded-full bg-slate-800/90 border-2 border-amber-400/60 shadow-xl flex flex-col items-center justify-center text-amber-300 font-extrabold text-xs">
                  <span className="text-sm">👁️</span>
                  <span className="text-[9px] leading-tight font-black">İNCELE</span>
                </div>
              ) : (
                // Standard Arc Action Buttons (ADS, Jump, Crouch, Reload)
                <div className="w-14 h-14 rounded-full bg-slate-800/90 border-2 border-slate-600 shadow-xl flex flex-col items-center justify-center text-white font-extrabold text-xs">
                  <span className="text-sm">{item.icon || "🔘"}</span>
                  <span className="text-[9px] leading-tight">{item.label}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Floating Inspector Control Bar for Selected Button */}
      {selectedItem && (
        <footer className="h-20 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between shrink-0 z-20 gap-4 flex-wrap sm:flex-nowrap">
          {/* Selected Button Identity */}
          <div className="flex items-center gap-3 min-w-[180px]">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-lg shrink-0">
              {selectedItem.icon || "🔘"}
            </div>
            <div>
              <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>{selectedItem.name}</span>
                <span className="text-[10px] text-amber-400 font-mono">
                  ({selectedItem.x}%, {selectedItem.y}%)
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Seçili tuşu parmağınla istediğin yere taşı
              </div>
            </div>
          </div>

          {/* Sliders for Size and Opacity */}
          <div className="flex items-center gap-6 flex-1 max-w-xl">
            {/* Size Slider */}
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Büyüklük (Boyut)</span>
                <span className="text-amber-400 font-mono">
                  {Math.round(selectedItem.size * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={selectedItem.size}
                onChange={(e) => updateSize(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Opacity Slider */}
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs font-bold text-slate-300">
                <span>Saydamlık</span>
                <span className="text-amber-400 font-mono">
                  {Math.round(selectedItem.opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.3"
                max="1.0"
                step="0.05"
                value={selectedItem.opacity}
                onChange={(e) => updateOpacity(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Selection Pills */}
          <div className="hidden lg:flex items-center gap-1 overflow-x-auto">
            {(Object.keys(layout) as TouchControlId[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                  selectedId === id
                    ? "bg-amber-500 text-slate-950 font-black shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {layout[id].label}
              </button>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}
