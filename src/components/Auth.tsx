import { useState } from "react";
import { ShieldCheck, FileText, CheckCircle2, MapPin, Sparkles, Eye, EyeOff, ChevronDown } from "lucide-react";
import { safeFetchJson } from "../utils/api";
import KvkkModal from "./KvkkModal";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { readResetTicket } from "../utils/passwordReset";
import { isAiStudioDemoEnvironment } from "../utils/authDemoGate";

interface AuthProps {
  onAuthSuccess: (token: string, username: string, avatar: string | null, id: number, color?: string) => void;
  onNavigateToReset?: (token: string) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showMobileAbout, setShowMobileAbout] = useState(false);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStatus, setResetStatus] = useState<"PENDING" | "APPROVED" | undefined>();
  const [approvedResetToken, setApprovedResetToken] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!isLogin && !kvkkAccepted) {
      setError("Devam etmek için Kullanım Koşulları ve KVKK Aydınlatma Metni'ni onaylamanız zorunludur.");
      return;
    }

    setIsLoading(true);
    const url = isLogin ? "/api/login" : "/api/register";
    try {
      const data = await safeFetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          ...(isLogin && readResetTicket(username) ? { requesterKey: readResetTicket(username)!.requesterKey } : {}),
          ...(isLogin ? {} : { locationConsent, kvkkAccepted, termsAccepted: kvkkAccepted })
        }),
      });
      
      if (isLogin && (data.requirePasswordReset || data.status === "PENDING")) {
        setResetStatus(data.requirePasswordReset ? "APPROVED" : "PENDING");
        setApprovedResetToken(data.resetToken);
        setShowForgotPassword(true);
        return;
      }
      if (!isLogin) {
        setSuccessMessage(data.messageTr || "Kaydınız başarıyla alındı. Hesabınız yönetici (emirgan) tarafından onaylandıktan sonra giriş yapabilirsiniz.");
        setIsLogin(true);
        setPassword("");
      } else {
        localStorage.setItem("lan_account_role", data.role || "user");
        onAuthSuccess(data.token, data.username, data.avatar || null, data.id, data.color);
      }
    } catch (err: any) {
      console.error(`[Auth ${isLogin ? "Login" : "Register"} Error]:`, err);
      if (err.message?.includes("ACCOUNT_PENDING") || err.message?.includes("onaylanmadı")) {
        setError("Hesabınız henüz onaylanmadı. Yönetici (emirgan) onayı bekleniyor.");
      } else {
        setError(err.message || "Giriş veya kayıt işlemi gerçekleştirilemedi. Lütfen bağlantınızı kontrol edin.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const showAiStudioDemoButton = isAiStudioDemoEnvironment(
    Boolean((import.meta as any).env?.DEV),
    typeof window !== "undefined" ? window : null,
    typeof document !== "undefined" ? document : null
  );

  const handleDemoLogin = () => {
    if (!showAiStudioDemoButton) return;
    const demoToken = "demo-preview-token-" + Date.now();
    const demoUsername = "Önizleme Kullanıcı";
    const demoId = -1;
    const demoColor = "#2563eb";
    try {
      localStorage.setItem("lan_is_demo", "true");
      localStorage.setItem("lan_account_role", "demo");
      localStorage.setItem("lan_user_roles", JSON.stringify(["demo"]));
      localStorage.setItem("lan_token", demoToken);
      localStorage.setItem("lan_username", demoUsername);
      localStorage.setItem("lan_user_id", String(demoId));
      localStorage.setItem("lan_color", demoColor);
    } catch {}
    onAuthSuccess(demoToken, demoUsername, null, demoId, demoColor);
  };

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start lg:justify-center px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8 md:p-12 transition-colors gap-5 sm:gap-8 lg:gap-12 w-full overflow-y-auto">
      
      {/* Dynamic SEO Header / Logo */}
      <header className="text-center max-w-2xl mt-1 sm:mt-4">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center justify-center gap-2.5 sm:gap-3">
          <img src="/brand/kapsapp-mark.png" alt="" width={192} height={192} className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl shrink-0 shadow-sm" />
          <span>KapsApp</span>
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1.5 sm:mt-2 font-medium leading-relaxed max-w-md mx-auto">
          Sesli Sohbet Odaları, Gizlilik Odaklı Canlı Harita, İnteraktif Ders Klasörleri ve Sosyal Oyunlar
        </p>
      </header>

      <div className="flex flex-col lg:flex-row items-start justify-center gap-5 sm:gap-8 lg:gap-12 w-full max-w-5xl">
        {/* Auth form card */}
        <div className="bg-white dark:bg-slate-900 w-full max-w-md mx-auto rounded-3xl shadow-xl p-5 sm:p-8 border border-slate-200/80 dark:border-slate-800 transition-all shrink-0">
          <div className="text-center mb-5 sm:mb-6">
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-blue-600 text-white items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-500/30">
              <ShieldCheck size={26} />
            </div>
            {/* Mobile-first segmented switcher */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 mb-4">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(""); }}
                className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isLogin
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(""); }}
                className={`min-h-[40px] rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  !isLogin
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                Kayıt Ol
              </button>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {isLogin ? "Tekrar Hoş Geldiniz" : "Hesap Oluştur"}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              {isLogin ? "Hesabınıza giriş yaparak devam edin" : "Hızlıca kaydolun ve topluluğa katılın"}
            </p>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-username" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Kullanıcı Adı
            </label>
            <input
              id="auth-username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="kullanici_adi"
              className="w-full min-h-[46px] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Şifre
              </label>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => { setResetStatus(undefined); setApprovedResetToken(undefined); setShowForgotPassword(true); }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer py-1"
                >
                  Şifremi Unuttum?
                </button>
              )}
            </div>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                required={!isLogin}
                autoComplete={isLogin ? "current-password" : "new-password"}
                enterKeyHint="go"
                placeholder="••••••••"
                className="w-full min-h-[46px] pl-4 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-colors text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-3 pt-1">
              {/* Mandatory KVKK Consent */}
              <label className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
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

              {/* Optional Location Consent for Live Map */}
              <label className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40">
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
          )}
          
          {successMessage && (
            <div className="text-emerald-700 dark:text-emerald-300 text-xs text-center font-medium bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 p-3 rounded-xl mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div role="alert" className="text-red-600 dark:text-red-400 text-xs text-center font-medium bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || (!isLogin && !kvkkAccepted)}
            className="w-full min-h-[48px] bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 mt-2 cursor-pointer text-sm flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isLogin ? (
              "Giriş Yap"
            ) : (
              "Kayıt Ol ve Başla"
            )}
          </button>
        </form>

        {/* Demo / Önizleme Girişi Button: STRICTLY visible inside AI Studio dev iframe only */}
        {showAiStudioDemoButton && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full min-h-[46px] bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-[0.99] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md shadow-amber-500/25 text-sm flex items-center justify-center gap-2 cursor-pointer border border-amber-400/40"
            >
              <Sparkles size={16} className="text-amber-100" />
              <span>Demo / Önizleme Girişi</span>
              <span className="text-[10px] bg-black/25 text-white font-mono px-2 py-0.5 rounded-full font-bold">
                AI Studio
              </span>
            </button>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-2 leading-relaxed">
              Yalnızca AI Studio önizleme çerçevesi içinde yerel arayüz önizlemesi sunar; sunucu verilerine erişmez.
            </p>
          </div>
        )}

        {/* Legal & Notice Link in Auth Card Footer */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            type="button"
            onClick={() => setShowKvkkModal(true)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <FileText size={13} />
            <span>5651 & KVKK Bilgilendirmesi</span>
          </button>
        </div>
      </div>

      {/* GEO / LLM Semantic Description Block (Collapsible on mobile, expanded on desktop) */}
      <article className="w-full max-w-md lg:max-w-xl mx-auto lg:mx-0 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm lg:shadow-md">
        <button
          type="button"
          onClick={() => setShowMobileAbout((v) => !v)}
          className="lg:hidden w-full min-h-[44px] flex items-center justify-between gap-2 text-left cursor-pointer"
          aria-expanded={showMobileAbout}
        >
          <span className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-emerald-500">💡</span> KapsApp Hakkında
          </span>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform duration-200 ${showMobileAbout ? "rotate-180" : ""}`}
          />
        </button>

        <div className={`${showMobileAbout ? "block mt-4" : "hidden"} lg:block space-y-5 lg:space-y-6`}>
          <div>
            <h2 className="hidden lg:flex text-xl font-black text-slate-900 dark:text-white tracking-tight items-center gap-2 mb-3">
              <span className="text-emerald-500 text-lg">💡</span> KapsApp Nedir?
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed">
              <strong>KapsApp</strong>, modern toplulukların ve öğrencilerin dijital iş birliği, gerçek zamanlı iletişim ve sosyal eğlence ihtiyaçlarını tek bir çatı altında karşılayan yenilikçi bir <strong>web platformudur</strong>. Arkadaşlarınızla güvenli bir ortamda etkileşime girmeniz için tasarlanmış dört temel sütun üzerine kurulmuştur.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <section className="bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                📍 Canlı GPS Haritası
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Dünya üzerindeki konumunuzu arkadaşlarınızla anlık olarak paylaşın. 50-150 metre jeodezik gizlilik hata payı (fuzzing) sayesinde net ev adresiniz asla sızdırılmaz.
              </p>
            </section>

            <section className="bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                🎙️ Kesintisiz Sesli Sohbet
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Düşük gecikmeli, yüksek kaliteli WebRTC ses kanalları ile kesintisiz iletişim kurun. Arkadaş ortamınızla eş zamanlı ekran paylaşımı yapın.
              </p>
            </section>

            <section className="bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                📚 İnteraktif Ders Klasörleri
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Ortak ders notlarınızı, PDF&#39;lerinizi ve faydalı web kaynaklarını klasörler halinde düzenleyip paylaşın, akademik çalışmalarınızı tek tıkla organize edin.
              </p>
            </section>

            <section className="bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-1.5">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                🃏 Çok Oyunculu Sosyal Oyunlar
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                Yapay zeka (bot) veya gerçek oyuncular eşliğinde Blackjack 21, İhaleli Batak, Koz Maça, UNO, Okey ve Gartic/Çizim oyunlarıyla kalıcı çiplerle yarışın.
              </p>
            </section>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>🛡️ Kişisel Verileriniz KVKK ile Korunur</span>
            <span>🌐 Tarayıcı Tabanlıdır, İndirme Gerekmez</span>
          </div>
        </div>
      </article>

      </div>

      {/* KVKK and Terms Modal */}
      <KvkkModal
        isOpen={showKvkkModal}
        onClose={() => setShowKvkkModal(false)}
        onAccept={() => setKvkkAccepted(true)}
        showAcceptButton={!isLogin}
      />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialUsername={username}
        initialStatus={resetStatus}
        initialResetToken={approvedResetToken}
      />
    </div>
  );
}

