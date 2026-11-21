import { useCall } from '../context/CallContext';
import { Volume2 } from 'lucide-react';
export default function CallAudioOutput() {
  const { audioOutputs, audioOutputId, audioOutputLabel, selectAudioOutput, toggleAudioOutput } = useCall();
  return <div className="flex flex-col gap-1 max-w-48 text-xs text-slate-200">
    <button type="button" onClick={() => void toggleAudioOutput()} className="p-3 rounded-2xl border border-slate-700 bg-slate-900 flex items-center gap-2"><Volume2 size={20} /><span>Ses çıkışı seç</span></button>
    <span aria-live="polite" className="truncate">{audioOutputLabel}</span>
    {audioOutputs.length > 0 && <select aria-label="Arama ses çıkışı" value={audioOutputId} onChange={e => void selectAudioOutput(e.target.value)} className="bg-slate-900 rounded p-1 max-w-full">
      <option value="">Sistem varsayılanı</option>{audioOutputs.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Ses cihazı ${index + 1}`}</option>)}
    </select>}
  </div>;
}
