import React, { useState } from "react";
import { TouchLayout, loadTouchLayout, saveTouchLayout } from "../../../games/kapsstrike/touchLayout";

export interface StrikeTouchCustomizerProps {
  layout?: TouchLayout;
  onChange?: (newLayout: TouchLayout) => void;
  onSave?: (newLayout: TouchLayout) => void;
  onClose: () => void;
}

export default function StrikeTouchCustomizer({
  layout: initialLayout,
  onChange,
  onSave,
  onClose
}: StrikeTouchCustomizerProps) {
  const [layout, setLayout] = useState<TouchLayout>(() => initialLayout || loadTouchLayout());

  const handleSave = () => {
    saveTouchLayout(layout);
    onChange?.(layout);
    onSave?.(layout);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-between p-6 text-white pointer-events-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-black text-amber-400">Dokunmatik Kontrol Özelleştirici</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-md"
          >
            Kaydet & Kapat
          </button>
        </div>
      </div>
      <div className="text-center text-xs text-slate-400">
        Butonları sürükleyerek veya boyutlarını ayarlayarak tablet ve telefonunuza en uygun ergonomiyi sağlayabilirsiniz.
      </div>
      <div className="h-10" />
    </div>
  );
}
