import React, { useState } from "react";
import { KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowLeft, Send } from "lucide-react";
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
  const [message, setMessage] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const data = await safeFetchJson("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier.trim(), username: identifier.trim() })
      });

      setMessage(data.message || "Şifre sıfırlama bağlantısı oluşturuldu.");
      if (data.resetToken) {
        setGeneratedToken(data.resetToken);
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
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100">
              Şifremi Unuttum
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hesabınıza ait kullanıcı adı veya e-postanızı girin
            </p>
          </div>
        </div>

        {message ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-bold">Bağlantı Oluşturuldu!</p>
                <p className="mt-1">{message}</p>
              </div>
            </div>

            {generatedToken && onNavigateToReset && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToReset(generatedToken);
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Yeni Şifre Belirleme Ekranına Git →
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Giriş Ekranına Dön
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kullanıcı Adı veya E-Posta
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Örn: emirhan veya e-posta"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
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
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Send size={14} />
                    <span>Sıfırla</span>
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
