import React from "react";

interface StrikeGraphicsSettingsProps {
  settings?: any;
  onChange?: (changes: any) => void;
}

export default function StrikeGraphicsSettings({ settings, onChange }: StrikeGraphicsSettingsProps) {
  return (
    <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 text-slate-100 max-w-md w-full space-y-3">
      <h3 className="text-sm font-bold text-sky-400">Grafik Ayarları</h3>
      <div className="flex items-center justify-between text-xs">
        <span>Görsel Kalite</span>
        <select
          value={settings?.quality || "high"}
          onChange={(e) => onChange?.({ quality: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-200"
        >
          <option value="low">Düşük (Akıcı)</option>
          <option value="medium">Orta</option>
          <option value="high">Yüksek</option>
        </select>
      </div>
    </div>
  );
}
