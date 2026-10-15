import React, { useState, useEffect } from "react";
import { KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Send, Clock } from "lucide-react";
import { safeFetchJson } from "../utils/api";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToReset?: (token: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onNavigateToReset
}) => {
  const [identifier, setIdentifier] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(false);
  const [approvedToken, setApprovedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 3-Saniyelik Canlı Polling: Yönetici onayını bekle
  useEffect(() => {
    if (!isOpen || !isWaitingApproval || !identifier.trim()) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/password-reset-status/${encodeURIComponent(identifier.trim())}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.status === 'APPROVED' && data.resetToken) {
          clearInterval(interval);
          setApprovedToken(data.resetToken);
          setIsWaitingApproval(false);
          if (onNavigateToReset) {
            onClose();
            onNavigateToReset(data.resetToken);
          }
        } else if (data.status === 'REJECTED') {
          clearInterval(interval);
          setIsWaitingApproval(false);
          setError(data.message || 'Şifre sıfırlama talebiniz yönetici (emirgan) tarafından reddedildi.');
        }
      } catch (err) {
        console.error('Polling hatası:', err);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, isWaitingApproval, identifier, onNavigateToReset, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await safeFetchJson("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanId })
      });

      if (data.status === 'APPROVED' && data.resetToken) {
        setApprovedToken(data.resetToken);
        if (onNavigateToReset) {
          onClose();
          onNavigateToReset(data.resetToken);
        }
      } else {
        setIsWaitingApproval(true);
      }
    } catch (err: any) {
      setError(err.message || "İşlem sırasında bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100">
              Şifremi Unuttum
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Yönetici onaylı şifre sıfırlama sistemi
            </p>
          </div>
        </div>

        {isWaitingApproval ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                <Loader2 size={16} className="animate-spin text-amber-600 shrink-0" />
                <span>⏳ Şifre Sıfırlama Talebi Gönderildi — Onay Bekleniyor</span>
              </div>
              <p>
                Şifre sıfırlama talebiniz yöneticiye (emirgan) iletildi ve onay bekliyor. Bu ekranda bekleyebilirsiniz; onaylandığında otomatik olarak yeni şifre belirleme sayfasına yönlendirileceksiniz.
              </p>
              <p className="pt-1 border-t border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-700 dark:text-amber-400">
                💡 Eğer sayfadan çıkarsanız, onaylandıktan sonra giriş ekranında sadece kullanıcı adınızı yazıp giriş yapmayı deneyerek şifre yenileme ekranına ulaşabilirsiniz.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
              <span>Canlı onay durumu yoklanıyor...</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsWaitingApproval(false);
                onClose();
              }}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Kapat ve Giriş Ekranına Dön
            </button>
          </div>
        ) : approvedToken ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-bold">Yönetici Onayı Alındı!</p>
                <p className="mt-1">Şifrenizi hemen şimdi yenileyebilirsiniz.</p>
              </div>
            </div>

            {onNavigateToReset && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToReset(approvedToken);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                Yeni Şifre Belirleme Ekranına Git →
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kullanıcı Adı
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Örn: kullanici_adi"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Talebiniz yönetici (emirgan) onayına sunulacaktır.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                İptal
              </button>

              <button
                type="submit"
                disabled={isLoading || !identifier.trim()}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin text-slate-950" />
                ) : (
                  <>
                    <Send size={14} />
                    <span>Talep Gönder</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default ForgotPasswordModal;
