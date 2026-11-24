import React, { useEffect, useState } from 'react';
import { Smartphone, Share, PlusSquare, CheckCircle2, BellRing, X, Sparkles, Download } from 'lucide-react';
import { enableDeviceNotifications } from './DeviceNotifications';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('kaps:pwa_prompt_ready'));
  });
}

export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)')?.matches === true ||
    (window.navigator as any)?.standalone === true
  );
}

interface MobileInstallSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileInstallSheet: React.FC<MobileInstallSheetProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [notifStatus, setNotifStatus] = useState<string>('');
  const [notifGranted, setNotifGranted] = useState<boolean>(() =>
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );

  useEffect(() => {
    const syncPrompt = () => setDeferredPrompt(globalDeferredPrompt);
    window.addEventListener('kaps:pwa_prompt_ready', syncPrompt);
    return () => window.removeEventListener('kaps:pwa_prompt_ready', syncPrompt);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        globalDeferredPrompt = null;
        setDeferredPrompt(null);
        onClose();
      }
    } catch {}
  };

  const handleEnableNotifs = async () => {
    const msg = await enableDeviceNotifications();
    if (!msg) {
      setNotifGranted(true);
      setNotifStatus('Arama ve bildirim izinleri başarıyla etkinleştirildi!');
    } else {
      setNotifStatus(msg);
    }
  };

  return (
    <div
      className="mobile-window fixed inset-0 z-[100000] flex flex-col justify-end sm:items-center sm:justify-center bg-slate-950/75 backdrop-blur-xs kaps-backdrop-enter"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="KapsApp Mobil Uygulama Kurulumu"
        data-testid="mobile-install-sheet"
        className="kaps-sheet-enter w-full max-w-md bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[26px] sm:rounded-3xl p-5 sm:p-6 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] shadow-2xl space-y-4 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center sm:hidden -mt-1 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <img
              src="/brand/kapsapp-mark.png"
              alt="KapsApp"
              className="w-12 h-12 rounded-2xl shadow-md border border-slate-200/60 dark:border-slate-700 shrink-0"
            />
            <div>
              <div className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <Sparkles size={12} />
                <span>Mobil Uygulama Deneyimi</span>
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                KapsApp’i Ana Ekrana Ekle
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tam ekran arayüz, sıfır adres çubuğu ve doğrudan gelen arama ekranı
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Install Steps or 1-Tap Android Install */}
        {deferredPrompt ? (
          <button
            type="button"
            onClick={handleNativeInstall}
            className="w-full min-h-[50px] py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-blue-600/25 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Download size={18} />
            <span>Uygulamayı Şimdi Ana Ekrana Yükle</span>
          </button>
        ) : (
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 p-4 space-y-3">
            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Smartphone size={15} className="text-blue-500" />
              <span>{isIOS ? 'iPhone / iPad Kurulum Adımları:' : 'Telefon Ana Ekranına Ekleme:'}</span>
            </div>
            <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-blue-600/15 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center shrink-0">
                  1
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Tarayıcı menüsünden <Share size={14} className="text-blue-500 inline" /> <strong>Paylaş</strong> veya <strong>Menü (⋮)</strong> simgesine dokunun.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-blue-600/15 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center shrink-0">
                  2
                </span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Listeden <PlusSquare size={14} className="text-emerald-500 inline" /> <strong>Ana Ekrana Ekle / Uygulamayı Yükle</strong> seçeneğine dokunun.
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-blue-600/15 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center shrink-0">
                  3
                </span>
                <span>
                  Ana ekranınızdaki <strong>KapsApp</strong> ikonundan açarak tam ekran telefon modunu başlatın.
                </span>
              </li>
            </ol>
          </div>
        )}

        {/* Call & Notification Permission Activation */}
        <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              {notifGranted ? <CheckCircle2 size={18} /> : <BellRing size={18} />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                {notifGranted ? 'Arama & Bildirimler Aktif' : 'Arama & Bildirim İzni'}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {notifGranted
                  ? 'Uygulama kapalıyken gelen aramalar telefonunuzu çaldırır.'
                  : 'Uygulama dışındayken gelen aramaları kaçırmamak için izin verin.'}
              </p>
            </div>
          </div>
          {!notifGranted && (
            <button
              type="button"
              onClick={handleEnableNotifs}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 cursor-pointer"
            >
              İzin Ver
            </button>
          )}
        </div>

        {notifStatus && (
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 px-1">
            {notifStatus}
          </p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[44px] rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
        >
          Tamam
        </button>
      </div>
    </div>
  );
};

export default MobileInstallSheet;
