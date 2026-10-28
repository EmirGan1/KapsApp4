import React, { useState } from 'react';
import { 
  Monitor, 
  Volume2, 
  VolumeX, 
  X, 
  Check, 
  Sparkles, 
  Info,
  Radio
} from 'lucide-react';

interface ScreenShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (withAudio: boolean) => void;
  isStarting?: boolean;
}

export const ScreenShareModal: React.FC<ScreenShareModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isStarting = false
}) => {
  const [shareAudio, setShareAudio] = useState<boolean>(true);

  if (!isOpen) return null;

  return (
    <div className="mobile-window fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Monitor size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Ekran Paylaşımı</h2>
              <p className="text-xs text-slate-400">Görüntü ve ses paylaşım seçenekleri</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isStarting}
            aria-label="Kapat"
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-slate-200">
          
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ses Paylaşım Seçeneği
            </label>
            <p className="text-xs text-slate-400 leading-relaxed">
              Paylaştığınız video, müzik veya oyun seslerini de iletmek ister misiniz? KapsApp aramasının bulunduğu sekmeyi seçmeyin.
            </p>
          </div>

          <div className="space-y-2.5">
            {/* Option 1: Share With Audio */}
            <div
              onClick={() => setShareAudio(true)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                shareAudio
                  ? 'bg-blue-600/15 border-blue-500 text-white ring-2 ring-blue-500/30 shadow-md'
                  : 'bg-slate-800/50 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                shareAudio ? 'bg-blue-600 text-white shadow' : 'bg-slate-700 text-slate-300'
              }`}>
                <Volume2 size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-white">Ekran ve Sesi Birlikte Paylaş</span>
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40">
                      Önerilen
                    </span>
                  </div>
                  {shareAudio && <Check size={16} className="text-blue-400 shrink-0 ml-1" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Paylaşacağınız içeriğin sekmesini veya penceresini seçin. İçerik sesi iletilirken bu aramadaki konuşmaların geri gönderilmesi engellenir.
                </p>
              </div>
            </div>

            {/* Option 2: Share Video Only (Muted) */}
            <div
              onClick={() => setShareAudio(false)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                !shareAudio
                  ? 'bg-blue-600/15 border-blue-500 text-white ring-2 ring-blue-500/30 shadow-md'
                  : 'bg-slate-800/50 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }`}
            >
              <div className={`p-2.5 rounded-lg shrink-0 mt-0.5 ${
                !shareAudio ? 'bg-blue-600 text-white shadow' : 'bg-slate-700 text-slate-300'
              }`}>
                <VolumeX size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-bold text-white">Sadece Görüntüyü Paylaş (Sessiz)</span>
                  {!shareAudio && <Check size={16} className="text-blue-400 shrink-0 ml-1" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  Ekran sesi iletilmez; yalnızca mikrofondaki konuşmanız duyulur.
                </p>
              </div>
            </div>
          </div>

          {/* Browser Helper Tip */}
          {shareAudio && (
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-start gap-2.5 text-amber-300 text-xs animate-in fade-in duration-150">
              <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-snug">
                <span className="font-bold text-amber-200">Tarayıcı Ekran Seçim İpucu:</span>
                <p className="text-[11px] text-amber-300/90">
                  İçeriğin bulunduğu sekmeyi veya pencereyi seçin ve <strong className="text-white">"Sekme sesini paylaş"</strong> seçeneğini açın. Arama sesini dışlayamayan tarayıcılarda tüm sistem sesi sunulmaz; içerik sekmesinin sesi paylaşılabilir.
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            Vazgeç
          </button>

          <button
            type="button"
            onClick={() => onConfirm(shareAudio)}
            disabled={isStarting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isStarting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Başlatılıyor...</span>
              </>
            ) : (
              <>
                {shareAudio ? <Volume2 size={16} /> : <Monitor size={16} />}
                <span>{shareAudio ? 'Ses ile Başlat' : 'Sessiz Başlat'}</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ScreenShareModal;
