import React from 'react';
import { 
  X, 
  Sparkles, 
  Video, 
  Mic, 
  Sliders, 
  Tv, 
  Smartphone, 
  Maximize2, 
  Minimize2, 
  Volume2, 
  ShieldCheck, 
  Check, 
  Gauge,
  SwitchCamera,
  ZoomIn
} from 'lucide-react';
import { 
  CameraResolutionMode, 
  NoiseSuppressionMode, 
  VideoAspectRatioMode, 
  VideoFitMode 
} from '../utils/webrtcConfig';

interface MediaSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  resolution: CameraResolutionMode;
  onChangeResolution: (res: CameraResolutionMode) => void;
  noiseSuppressionLevel: NoiseSuppressionMode;
  onChangeNoiseSuppression: (level: NoiseSuppressionMode) => void;
  aspectRatioMode: VideoAspectRatioMode;
  onChangeAspectRatio: (mode: VideoAspectRatioMode) => void;
  fitMode: VideoFitMode;
  onChangeFitMode: (mode: VideoFitMode) => void;
  cameraFacingMode?: 'user' | 'environment';
  onToggleCameraFacingMode?: () => void;
  cameraZoom?: number;
  cameraZoomRange?: { min: number; max: number; step: number };
  onChangeCameraZoom?: (zoom: number) => void;
}

export const MediaSettingsModal: React.FC<MediaSettingsModalProps> = ({
  isOpen,
  onClose,
  resolution,
  onChangeResolution,
  noiseSuppressionLevel,
  onChangeNoiseSuppression,
  aspectRatioMode,
  onChangeAspectRatio,
  fitMode,
  onChangeFitMode,
  cameraFacingMode = 'user',
  onToggleCameraFacingMode,
  cameraZoom = 1,
  cameraZoomRange = { min: 1, max: 5, step: 0.1 },
  onChangeCameraZoom
}) => {
  if (!isOpen) return null;

  return (
    <div className="mobile-window fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Medya ve Kamera Ayarları</h2>
              <p className="text-xs text-slate-400">Görüntü kalitesi, ekran yerleşimi ve gürültü filtreleme</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-6 overflow-y-auto text-slate-200 divide-y divide-slate-800/80">
          
          {/* Section 1: Dynamic Aspect Ratio */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Tv size={14} className="text-blue-400" />
                <span>Kamera En/Boy Oranı (Aspect Ratio)</span>
              </label>
              <span className="text-[11px] font-semibold text-blue-400">
                {aspectRatioMode === 'auto' ? 'Otomatik (Dinamik)' : aspectRatioMode === 'landscape' ? 'Yatay 16:9' : 'Dikey 9:16'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onChangeAspectRatio('auto')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  aspectRatioMode === 'auto'
                    ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Maximize2 size={16} className={aspectRatioMode === 'auto' ? 'text-blue-400' : 'text-slate-400'} />
                  {aspectRatioMode === 'auto' && <Check size={14} className="text-blue-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold">Otomatik</div>
                  <div className="text-[10px] text-slate-400">Ekranı tam doldurur</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onChangeAspectRatio('landscape')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  aspectRatioMode === 'landscape'
                    ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Tv size={16} className={aspectRatioMode === 'landscape' ? 'text-blue-400' : 'text-slate-400'} />
                  {aspectRatioMode === 'landscape' && <Check size={14} className="text-blue-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold">Yatay (16:9)</div>
                  <div className="text-[10px] text-slate-400">Geniş açı masaüstü</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onChangeAspectRatio('portrait')}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  aspectRatioMode === 'portrait'
                    ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1.5">
                  <Smartphone size={16} className={aspectRatioMode === 'portrait' ? 'text-blue-400' : 'text-slate-400'} />
                  {aspectRatioMode === 'portrait' && <Check size={14} className="text-blue-400" />}
                </div>
                <div>
                  <div className="text-xs font-bold">Dikey (9:16)</div>
                  <div className="text-[10px] text-slate-400">Mobil kamera düzeni</div>
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Fit Mode (Crop to fill vs Contain whole image) */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Maximize2 size={14} className="text-emerald-400" />
                <span>Kamera Kırpma / Doldurma Modu</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeFitMode('cover')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  fitMode === 'cover'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">Ekranı Doldur (Cover)</div>
                  <div className="text-[10px] text-slate-400">Siyah kenarları sıfırlar</div>
                </div>
                {fitMode === 'cover' && <Check size={16} className="text-emerald-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => onChangeFitMode('contain')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  fitMode === 'contain'
                    ? 'bg-emerald-600/20 border-emerald-500 text-white ring-2 ring-emerald-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div>
                  <div className="text-xs font-bold">Orijinal Boyut (Contain)</div>
                  <div className="text-[10px] text-slate-400">Kırpma yapmadan sığdırır</div>
                </div>
                {fitMode === 'contain' && <Check size={16} className="text-emerald-400 shrink-0" />}
              </button>
            </div>
          </div>

          {/* Section: Camera Direction (Front/Back) & Zoom */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <SwitchCamera size={14} className="text-blue-400" />
                <span>Kamera Yönü ve Yakınlaştırma (Zoom)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {onToggleCameraFacingMode && (
                <button
                  type="button"
                  onClick={onToggleCameraFacingMode}
                  className="p-3 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 text-slate-200 flex items-center justify-between transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                      <SwitchCamera size={16} />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-bold">Kamera Değiştir</div>
                      <div className="text-[10px] text-slate-400">
                        {cameraFacingMode === 'user' ? 'Ön Kamera Aktif' : 'Arka Kamera Aktif'}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-400 bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-500/30">
                    Çevir
                  </span>
                </button>
              )}

              {onChangeCameraZoom && cameraZoomRange && (
                <div className="p-3 rounded-xl border border-slate-700/80 bg-slate-800/60 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ZoomIn size={14} className="text-emerald-400" />
                      <span>Zoom: {cameraZoom || 1}x</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Maks {cameraZoomRange.max || 5}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={cameraZoomRange.min || 1}
                    max={cameraZoomRange.max || 5}
                    step={cameraZoomRange.step || 0.1}
                    value={cameraZoom || 1}
                    onChange={(e) => onChangeCameraZoom(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Camera Resolution Selector */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Video size={14} className="text-purple-400" />
                <span>Kamera Çözünürlüğü ve Bant Genişliği</span>
              </label>
              <span className="text-[11px] font-semibold text-purple-400">
                {resolution.toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => onChangeResolution('auto')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  resolution === 'auto'
                    ? 'bg-purple-600/20 border-purple-500 text-white ring-2 ring-purple-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Auto</span>
                  {resolution === 'auto' && <Check size={12} className="text-purple-400" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Adaptif Hız</div>
              </button>

              <button
                type="button"
                onClick={() => onChangeResolution('1080p')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  resolution === '1080p'
                    ? 'bg-purple-600/20 border-purple-500 text-white ring-2 ring-purple-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>1080p FHD</span>
                  {resolution === '1080p' && <Check size={12} className="text-purple-400" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Maksimum</div>
              </button>

              <button
                type="button"
                onClick={() => onChangeResolution('720p')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  resolution === '720p'
                    ? 'bg-purple-600/20 border-purple-500 text-white ring-2 ring-purple-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>720p HD</span>
                  {resolution === '720p' && <Check size={12} className="text-purple-400" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Dengeli</div>
              </button>

              <button
                type="button"
                onClick={() => onChangeResolution('480p')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  resolution === '480p'
                    ? 'bg-purple-600/20 border-purple-500 text-white ring-2 ring-purple-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>480p SD</span>
                  {resolution === '480p' && <Check size={12} className="text-purple-400" />}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Performans</div>
              </button>
            </div>
          </div>

          {/* Section 4: Microphone AI Noise Suppression */}
          <div className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sparkles size={14} className="text-amber-400" />
                <span>Mikrofon Gürültü Engelleme (Noise Suppression)</span>
              </label>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                noiseSuppressionLevel === 'high'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : noiseSuppressionLevel === 'standard'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {noiseSuppressionLevel === 'high' ? 'Yüksek (AI Filtre)' : noiseSuppressionLevel === 'standard' ? 'Standart' : 'Kapalı'}
              </span>
            </div>

            <div className="space-y-2">
              {/* High Option */}
              <button
                type="button"
                onClick={() => onChangeNoiseSuppression('high')}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                  noiseSuppressionLevel === 'high'
                    ? 'bg-amber-500/15 border-amber-500/80 text-white ring-2 ring-amber-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  noiseSuppressionLevel === 'high' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-700 text-slate-300'
                }`}>
                  <Sparkles size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Yüksek / AI Destekli Gürültü Filtresi</span>
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-500/30">
                        Önerilen
                      </span>
                    </span>
                    {noiseSuppressionLevel === 'high' && <Check size={16} className="text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Web Audio API filtreleme zinciri ile arka plan uğultusunu, fan sesini, nefesi ve mekanik klavye seslerini minimuma indirir.
                  </p>
                </div>
              </button>

              {/* Standard Option */}
              <button
                type="button"
                onClick={() => onChangeNoiseSuppression('standard')}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                  noiseSuppressionLevel === 'standard'
                    ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  noiseSuppressionLevel === 'standard' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  <ShieldCheck size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Standart Tarayıcı Filtresi</span>
                    {noiseSuppressionLevel === 'standard' && <Check size={16} className="text-blue-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Donanım tabanlı standart yankı ve gürültü önleme (Echo cancellation & AGC).
                  </p>
                </div>
              </button>

              {/* Off Option */}
              <button
                type="button"
                onClick={() => onChangeNoiseSuppression('off')}
                className={`w-full p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                  noiseSuppressionLevel === 'off'
                    ? 'bg-rose-600/20 border-rose-500 text-white ring-2 ring-rose-500/30'
                    : 'bg-slate-800/60 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  noiseSuppressionLevel === 'off' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}>
                  <Mic size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Kapalı (Ham Mikrofon Sesi)</span>
                    {noiseSuppressionLevel === 'off' && <Check size={16} className="text-rose-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    Tüm yazılımsal filtreleri kapatır; stüdyo mikrofonları veya müzik aleti paylaşımı için uygundur.
                  </p>
                </div>
              </button>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Tamam
          </button>
        </div>

      </div>
    </div>
  );
};

export default MediaSettingsModal;
