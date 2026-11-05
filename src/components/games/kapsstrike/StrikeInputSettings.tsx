import React from "react";

interface StrikeInputSettingsProps {
  settings?: any;
  onChange?: (changes: any) => void;
  gyro?: any;
  onOpenTouchCustomizer?: () => void;
}

export default function StrikeInputSettings({
  settings,
  onChange,
  gyro,
  onOpenTouchCustomizer
}: StrikeInputSettingsProps) {
  return (
    <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 text-slate-100 max-w-md w-full space-y-3">
      <h3 className="text-sm font-bold text-emerald-400">Girdi & Kontrol Ayarları</h3>
      <div className="space-y-2 text-xs">
        {onOpenTouchCustomizer && (
          <button
            type="button"
            onClick={onOpenTouchCustomizer}
            className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all text-xs"
          >
            Dokunmatik Buton Yerleşimini Özelleştir
          </button>
        )}
      </div>
    </div>
  );
}
