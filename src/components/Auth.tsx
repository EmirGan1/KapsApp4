import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  MapPin, 
  KeyRound, 
  Loader2, 
  Lock, 
  ArrowLeft, 
  Send, 
  AlertCircle,
  Clock
} from "lucide-react";
import { safeFetchJson } from "../utils/api";
import KvkkModal from "./KvkkModal";

interface AuthProps {
  onAuthSuccess: (token: string, username: string, avatar: string | null, id: number, color?: string) => void;
  onNavigateToReset?: (token: string) => void;
}

export type AuthView = 'LOGIN' | 'FORGOT_REQUEST' | 'WAITING_APPROVAL' | 'SET_NEW_PASSWORD' | 'REGISTER';

export default function Auth({ onAuthSuccess, onNavigateToReset }: AuthProps) {
  const [view, setView] = useState<AuthView>('LOGIN');
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);

  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // =========================================================================
  // CANLI DURUM YOKLAMA (POLLING) - 3 SANİYEDE BİR ONAY/RED KONTROLÜ
  // =========================================================================
  useEffect(() => {
    if (view !== 'WAITING_APPROVAL' || !username.trim()) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/password-reset-status/${encodeURIComponent(username.trim())}`);
        const data = await res.json();

        if (!isMounted) return;

        if (data.status === 'APPROVED' && data.resetToken) {
          clearInterval(interval);
          setResetToken(data.resetToken);
          setError("");
          setView('SET_NEW_PASSWORD');
        } else if (data.status === 'REJECTED') {
          clearInterval(interval);
          setError(data.message || 'Şifre sıfırlama talebiniz yönetici (emirgan) tarafından reddedildi.');
          setView('LOGIN');
        }
      } catch (err) {
        console.error('[PASSWORD RESET] Polling hatası:', err);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [view, username]);

  // 1. LOGIN SUBMIT HANDLER (Şifresiz ve Şifreli Giriş Desteği)
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError("Lütfen kullanıcı adınızı girin.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await safeFetchJson("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: cleanUser,
          password: password // Şifre boş gelebilir, backend interceptor yakalar
        }),
      });

      // KRİTİK KONTROL 1: Yönetici onay vermişse doğrudan yeni şifre belirleme ekranına aktar
      if (data.requirePasswordReset) {
        setResetToken(data.resetToken);
        if (data.username) setUsername(data.username);
        setError("");
        setView('SET_NEW_PASSWORD');
        return;
      }

      // KRİTİK KONTROL 2: Talep PENDING durumdaysa bekleme ekranına al
      if (data.status === 'PENDING') {
        setError("");
        setView('WAITING_APPROVAL');
        return;
      }

      // Standart başarılı giriş
      onAuthSuccess(data.token, data.username, data.avatar || null, data.id, data.color);
    } catch (err: any) {
      console.error("[Auth Login Error]:", err);
      if (err.message?.includes("ACCOUNT_PENDING") || err.message?.includes("onaylanmadı")) {
        setError("Hesabınız henüz onaylanmadı. Yönetici (emirgan) onayı bekleniyor.");
      } else {
        setError(err.message || "Giriş işlemi gerçekleştirilemedi. Lütfen bilgilerinizi kontrol edin.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 2. FORGOT PASSWORD REQUEST SUBMIT HANDLER
  const handleForgotRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError("Lütfen kullanıcı adınızı girin.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await safeFetchJson("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleanUser }),
      });

      if (data.status === 'APPROVED' && data.resetToken) {
        setResetToken(data.resetToken);
        setView('SET_NEW_PASSWORD');
      } else {
        setView('WAITING_APPROVAL');
      }
    } catch (err: any) {
      setError(err.message || "Sıfırlama talebi gönderilirken hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. SET NEW PASSWORD SUBMIT HANDLER
  const handleCompleteResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!newPassword || newPassword.length < 6) {
      setError("Yeni şifreniz en az 6 karakter olmalıdır.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Girdiğiniz şifreler birbiriyle eşleşmiyor.");
      return;
    }
    if (!resetToken) {
      setError("Sıfırlama anahtarı bulunamadı. Lütfen tekrar talep gönderin.");
      setView('FORGOT_REQUEST');
      return;
    }

    setIsLoading(true);
    try {
      const data = await safeFetchJson("/api/auth/complete-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          resetToken,
          newPassword
        }),
      });

      setSuccessMessage(data.message || "Şifreniz başarıyla güncellendi!");
      if (data.token) {
        setTimeout(() => {
          onAuthSuccess(data.token, data.username, data.avatar || null, data.id, data.color);
        }, 1200);
      } else {
        setTimeout(() => {
          setPassword("");
          setView('LOGIN');
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || "Şifre güncellenirken hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  // 4. REGISTER SUBMIT HANDLER
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!kvkkAccepted) {
      setError("Devam etmek için Kullanım Koşulları ve KVKK Aydınlatma Metni'ni onaylamanız zorunludur.");
      return;
    }

    setIsLoading(true);
    try {
      const data = await safeFetchJson("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          locationConsent,
          kvkkAccepted,
          termsAccepted: kvkkAccepted
        }),
      });

      setSuccessMessage(data.messageTr || "Kaydınız başarıyla alındı. Hesabınız yönetici (emirgan) tarafından onaylandıktan sonra giriş yapabilirsiniz.");
      setView('LOGIN');
      setPassword("");
    } catch (err: any) {
      console.error("[Auth Register Error]:", err);
      if (err.message?.includes("ACCOUNT_PENDING") || err.message?.includes("onaylanmadı")) {
        setError("Hesabınız henüz onaylanmadı. Yönetici (emirgan) onayı bekleniyor.");
      } else {
        setError(err.message || "Kayıt işlemi gerçekleştirilemedi.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 transition-colors gap-8 lg:gap-12 w-full">
      
      {/* Header / Logo */}
      <header className="text-center max-w-2xl mt-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-3">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3.5 py-1.5 rounded-2xl shadow-md">K</span>
          <span>KapsApp</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium leading-relaxed">
          Sesli Sohbet Odaları, Gizlilik Odaklı Canlı Harita, İnteraktif Ders Klasörleri ve Sosyal Kart Oyunları Platformu
        </p>
      </header>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-12 w-full max-w-5xl">
        
        {/* Main Card */}
        <div className="bg-white dark:bg-slate-900 w-full max-w-md mx-auto rounded-3xl shadow-xl p-6 sm:p-8 border border-slate-100 dark:border-slate-800 transition-all shrink-0">
          
          {/* ========================================================= */}
          {/* GÖRÜNÜM 1: GİRİŞ (LOGIN)                                   */}
          {/* ========================================================= */}
          {view === 'LOGIN' && (
            <div>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
                  <ShieldCheck size={26} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Tekrar Hoş Geldiniz
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Hesabınıza giriş yaparak devam edin
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="kullanici_adi"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Şifre
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setSuccessMessage("");
                        setView('FORGOT_REQUEST');
                      }}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Şifremi Unuttum?
                    </button>
                  </div>
                  {/* ÖNEMLİ: required KALDIRILDI — Onaylı kullanıcılar şifresiz giriş deneyebilir */}
                  <input
                    type="password"
                    placeholder="•••••••• (Şifrenizi unuttuysanız boş bırakabilirsiniz)"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {successMessage && (
                  <div className="text-emerald-700 dark:text-emerald-300 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-3 rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="text-red-600 dark:text-red-400 text-xs font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 mt-2 cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Giriş Yap"
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccessMessage("");
                    setView('REGISTER');
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                >
                  Hesabın yok mu? Hemen Kayıt Ol
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* GÖRÜNÜM 2: TALEP OLUŞTURMA (FORGOT_REQUEST)                */}
          {/* ========================================================= */}
          {view === 'FORGOT_REQUEST' && (
            <div>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/30">
                  <KeyRound size={26} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Şifre Sıfırlama Talebi
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Kullanıcı adınızı girerek yönetici onaylı sıfırlama talebi gönderin
                </p>
              </div>

              <form onSubmit={handleForgotRequestSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="kullanici_adi"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
                    Güvenlik gereği şifrenizi sıfırlayabilmeniz için yönetici (emirgan) onayı gereklidir.
                  </p>
                </div>

                {error && (
                  <div className="text-red-600 dark:text-red-400 text-xs font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !username.trim()}
                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl transition-all shadow-md shadow-amber-500/20 cursor-pointer text-sm flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin text-slate-950" />
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Sıfırlama Talebi Gönder</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setView('LOGIN');
                    }}
                    className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Giriş Ekranına Dön</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* GÖRÜNÜM 3: ONAY BEKLEME EKRANI (WAITING_APPROVAL)          */}
          {/* ========================================================= */}
          {view === 'WAITING_APPROVAL' && (
            <div className="text-center space-y-5">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping"></div>
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/10">
                  <Loader2 size={32} className="animate-spin text-amber-500" />
                </div>
              </div>

              <div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 inline-flex items-center gap-1.5 mb-2">
                  <Clock size={13} className="animate-spin" />
                  <span>Onay Bekleniyor: @{username}</span>
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  ⏳ Şifre Sıfırlama Talebi Gönderildi
                </h2>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>Yönetici (emirgan) Onayı Bekleniyor</span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  Talebiniz yöneticiye (emirgan) iletildi. Yönetici onayladığında bu ekran otomatik olarak şifre yenileme sayfasına dönüşecektir.
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400/80 leading-relaxed pt-1 border-t border-amber-200/60 dark:border-amber-800/40">
                  💡 <strong>Sayfadan ayrılırsanız:</strong> Onay geldikten sonra giriş ekranında sadece kullanıcı adınızı yazarak giriş yapmayı deneyebilirsiniz; sistem sizi otomatik olarak yeni şifre belirleme ekranına yönlendirecektir.
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>Her 3 saniyede bir onay kontrol ediliyor...</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setView('LOGIN');
                }}
                className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} />
                <span>Giriş Ekranına Dön</span>
              </button>
            </div>
          )}

          {/* ========================================================= */}
          {/* GÖRÜNÜM 4: YENİ ŞİFRE BELİRLEME (SET_NEW_PASSWORD)         */}
          {/* ========================================================= */}
          {view === 'SET_NEW_PASSWORD' && (
            <div>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
                  <Lock size={26} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Yeni Şifre Belirle
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Yönetici onayınız tamamlandı. @{username} hesabı için yeni şifrenizi oluşturun.
                </p>
              </div>

              <form onSubmit={handleCompleteResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Yeni Şifre (En az 6 karakter)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Yeni Şifre (Tekrar)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {successMessage && (
                  <div className="text-emerald-700 dark:text-emerald-300 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-3 rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {error && (
                  <div className="text-red-600 dark:text-red-400 text-xs font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-emerald-500/20 mt-2 cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Şifreyi Güncelle ve Giriş Yap"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ========================================================= */}
          {/* GÖRÜNÜM 5: KAYIT OL (REGISTER)                             */}
          {/* ========================================================= */}
          {view === 'REGISTER' && (
            <div>
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
                  <ShieldCheck size={26} />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Hesap Oluştur
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                  Hızlıca kaydolun ve topluluğa katılın
                </p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="kullanici_adi"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Şifre
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  {/* Zorunlu KVKK Onayı */}
                  <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
                    <input
                      type="checkbox"
                      required
                      checked={kvkkAccepted}
                      onChange={(e) => setKvkkAccepted(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                    />
                    <span className="leading-snug">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowKvkkModal(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 font-bold underline hover:text-blue-700 dark:hover:text-blue-300"
                      >
                        Kullanım Koşulları ve KVKK Aydınlatma Metni
                      </button>
                      'ni okudum, kabul ediyorum. <span className="text-red-500 font-bold">*</span>
                    </span>
                  </label>

                  {/* İsteğe Bağlı Canlı Harita Açık Rızası */}
                  <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40">
                    <input
                      type="checkbox"
                      checked={locationConsent}
                      onChange={(e) => setLocationConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-emerald-300 dark:border-emerald-600 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                    />
                    <span className="leading-snug">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                        <MapPin size={13} className="shrink-0" /> Canlı Harita
                      </span>{" "}
                      özelliği için yaklaşık konum verilerimin işlenmesine ve haritada gösterilmesine{" "}
                      <strong className="text-slate-900 dark:text-white font-bold">Açık Rıza</strong> veriyorum.{" "}
                      <span className="text-slate-400 text-[11px]">(İsteğe bağlı)</span>
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="text-red-600 dark:text-red-400 text-xs font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !kvkkAccepted}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 mt-2 cursor-pointer text-sm flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    "Kayıt Ol ve Başla"
                  )}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setSuccessMessage("");
                    setView('LOGIN');
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline cursor-pointer"
                >
                  Zaten hesabın var mı? Giriş Yap
                </button>
              </div>
            </div>
          )}

          {/* Legal & Notice Link in Auth Card Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={() => setShowKvkkModal(true)}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <FileText size={13} />
              <span>5651 & KVKK Bilgilendirmesi</span>
            </button>
          </div>
        </div>

        {/* Semantic Information Column */}
        <article className="w-full max-w-lg lg:max-w-xl space-y-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mb-3">
              <span className="text-emerald-500 text-lg">💡</span> KapsApp Nedir?
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
              <strong>KapsApp</strong>, modern toplulukların ve öğrencilerin dijital iş birliği, gerçek zamanlı iletişim ve sosyal eğlence ihtiyaçlarını tek bir çatı altında karşılayan yenilikçi bir <strong>web platformudur</strong>. Arkadaşlarınızla güvenli bir ortamda etkileşime girmeniz için tasarlanmış dört temel sütun üzerine kurulmuştur.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <section className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                📍 Canlı GPS Haritası
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Dünya üzerindeki konumunuzu arkadaşlarınızla anlık olarak paylaşın. 50-150 metre jeodezik gizlilik hata payı (fuzzing) sayesinde net ev adresiniz asla sızdırılmaz.
              </p>
            </section>

            <section className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                🎙️ Kesintisiz Sesli Sohbet
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Düşük gecikmeli, yüksek kaliteli WebRTC ses kanalları ile kesintisiz iletişim kurun. Arkadaş ortamınızla eş zamanlı ekran paylaşımı yapın.
              </p>
            </section>

            <section className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                📚 İnteraktif Ders Klasörleri
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Ortak ders notlarınızı, PDF&#39;lerinizi ve faydalı web kaynaklarını klasörler halinde düzenleyip paylaşın, akademik çalışmalarınızı tek tıkla organize edin.
              </p>
            </section>

            <section className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                🃏 Çok Oyunculu Sosyal Oyunlar
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Yapay zeka (bot) veya gerçek oyuncular eşliğinde Blackjack 21, İhaleli Batak, Koz Maça, UNO, Okey ve Gartic/Çizim oyunlarıyla kalıcı çiplerle yarışın.
              </p>
            </section>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>🛡️ Kişisel Verileriniz KVKK ile Korunur</span>
            <span>🌐 Tarayıcı Tabanlıdır, İndirme Gerekmez</span>
          </div>
        </article>

      </div>

      {/* KVKK and Terms Modal */}
      <KvkkModal
        isOpen={showKvkkModal}
        onClose={() => setShowKvkkModal(false)}
        onAccept={() => setKvkkAccepted(true)}
        showAcceptButton={view === 'REGISTER'}
      />
    </div>
  );
}
