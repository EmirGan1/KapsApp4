import { useEffect, useState, useRef } from "react";
import {
  FileText,
  Upload,
  Link2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { PersonalSourceSummary } from "../../shared/germanPersonal";
import {
  connectPersonalGoogleDoc,
  createPersonalTextSource,
  disconnectPersonalGoogle,
  startPersonalGoogleConnect,
  updatePersonalTextSource,
  uploadPersonalFileSource,
  type PersonalGoogleStatus,
} from "./personalApi";

type ModalTab = "text" | "gdoc" | "file";

export function PersonalSourceModal({
  open,
  initialTab = "text",
  editSource,
  googleStatus,
  onClose,
  onSuccess,
  onRefreshGoogle,
}: {
  open: boolean;
  initialTab?: ModalTab;
  editSource?: { id: string; title: string; rawText: string } | null;
  googleStatus: PersonalGoogleStatus | null;
  onClose: () => void;
  onSuccess: (source: PersonalSourceSummary, messageTr: string) => void;
  onRefreshGoogle: () => void;
}) {
  const [tab, setTab] = useState<ModalTab>(editSource ? "text" : initialTab);
  const [title, setTitle] = useState(editSource?.title ?? "");
  const [text, setText] = useState(editSource?.rawText ?? "");
  const [gdocUrl, setGdocUrl] = useState("");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncIntervalMin, setSyncIntervalMin] = useState(15);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [useAI, setUseAI] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTab(editSource ? "text" : initialTab);
    setTitle(editSource?.title ?? "");
    setText(editSource?.rawText ?? "");
    setGdocUrl("");
    setSelectedFile(null);
    setError("");
  }, [open, initialTab, editSource]);

  if (!open) return null;

  const handleSubmitText = async () => {
    if (!text.trim()) {
      setError("Lütfen Almanca kelime notlarını yapıştır.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (editSource) {
        const res = await updatePersonalTextSource(editSource.id, {
          title: title.trim() || editSource.title,
          text,
          useAI,
        });
        onSuccess(
          res.source,
          `Kaynak güncellendi: +${res.diff.added} eklendi, ${res.diff.updated} güncellendi, ${res.diff.removed} kaldırıldı.`,
        );
      } else {
        const res = await createPersonalTextSource({
          title: title.trim() || "Kişisel Metin Notu",
          text,
          useAI,
        });
        onSuccess(
          res.source,
          `Metin analiz edildi: ${res.diff.totalActive} benzersiz kelime eklendi.`,
        );
      }
    } catch (err: any) {
      setError(err?.message || "Metin işlenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleConnectGoogleAccount = async () => {
    setBusy(true);
    setError("");
    try {
      const { url } = await startPersonalGoogleConnect();
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || "Google bağlantısı başlatılamadı.");
      setBusy(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await disconnectPersonalGoogle();
      onRefreshGoogle();
    } catch (err: any) {
      setError(err?.message || "Google bağlantısı kesilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleConnectGoogleDoc = async () => {
    if (!gdocUrl.trim()) {
      setError("Lütfen bir Google Docs bağlantısı yapıştır.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await connectPersonalGoogleDoc({
        url: gdocUrl.trim(),
        title: title.trim() || undefined,
        autoSyncEnabled,
        syncIntervalMin,
        useAI,
      });
      onSuccess(
        res.source,
        res.alreadyConnected
          ? "Bu Google Docs belgesi zaten bağlıydı ve şimdi yeniden senkronize edildi."
          : `Google Docs bağlandı: ${res.source.totalActiveItems} benzersiz kelime içe aktarıldı.`,
      );
    } catch (err: any) {
      setError(err?.message || "Google Docs belgesi okunamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      setError("Lütfen TXT, MD, DOCX veya PDF formatında bir dosya seç.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await uploadPersonalFileSource({
        file: selectedFile,
        title: title.trim() || undefined,
        useAI,
      });
      onSuccess(
        res.source,
        `${selectedFile.name} işlendi: ${res.diff.totalActive} benzersiz kelime çıkarıldı.`,
      );
    } catch (err: any) {
      setError(err?.message || "Dosya işlenemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kg-personal-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface)] text-[var(--kg-ink)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--kg-border)]">
          <div>
            <h2 id="kg-personal-modal-title" className="text-lg font-extrabold text-[var(--kg-ink)]">
              {editSource ? "Metin Kaynağını Düzenle ve Yeniden Analiz Et" : "Yeni Kişisel Çalışma Kaynağı Ekle"}
            </h2>
            <p className="text-xs text-[var(--kg-ink-muted)] mt-0.5 mb-0">
              Yalnızca sana özeldir. Mevcut 5/5 ustalık ilerlemen hiçbir zaman sıfırlanmaz.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-10 h-10 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] flex items-center justify-center text-[var(--kg-ink)] hover:border-[var(--kg-border-strong)] cursor-pointer"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        {/* Source Input Method Tabs */}
        {!editSource && (
          <div className="grid grid-cols-3 gap-2 px-5 pt-4">
            <button
              type="button"
              onClick={() => {
                setTab("text");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${
                tab === "text"
                  ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)]"
                  : "border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink-muted)]"
              }`}
            >
              <FileText size={16} />
              <span>Metin Yapıştır</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("gdoc");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${
                tab === "gdoc"
                  ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)]"
                  : "border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink-muted)]"
              }`}
            >
              <Link2 size={16} />
              <span>Google Docs</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("file");
                setError("");
              }}
              className={`flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${
                tab === "file"
                  ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)]"
                  : "border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink-muted)]"
              }`}
            >
              <Upload size={16} />
              <span>Dosya Yükle</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {error && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--kg-red)] bg-[var(--kg-red-soft)] text-[var(--kg-red-ink)] text-sm font-semibold"
              role="alert"
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Optional Source Title */}
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--kg-ink-muted)]">
              Kaynak Başlığı {tab !== "text" ? "(Opsiyonel)" : ""}
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                tab === "text"
                  ? "Örn: B1 Ders Notlarım — İş Hayatı"
                  : tab === "gdoc"
                    ? "Boş bırakırsan Google Docs başlığı kullanılır"
                    : "Boş bırakırsan dosya adı kullanılır"
              }
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink)] text-sm focus:outline-none focus:border-[var(--kg-blue)]"
            />
          </label>

          {/* TAB 1: PASTE TEXT */}
          {tab === "text" && (
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--kg-ink-muted)]">
                  Almanca Notların veya Kelime Listen
                </span>
                <textarea
                  rows={9}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`Her satıra bir kelime veya karışık notlarını yapıştır:\nder Termin — randevu\nErfahrung = deneyim\nsich freuen auf + Akk. = dört gözle beklemek\ndie Entscheidung (Pl. die Entscheidungen): karar\nDE: Ich freue mich auf das Wochenende.\nTR: Hafta sonunu dört gözle bekliyorum.`}
                  className="w-full p-3.5 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink)] text-sm font-mono leading-relaxed focus:outline-none focus:border-[var(--kg-blue)]"
                />
              </label>
              <p className="text-xs text-[var(--kg-ink-muted)] m-0">
                Desteklenen ayırıcılar: <code>—</code>, <code>-</code>, <code>:</code>, <code>=</code>, <code>-&gt;</code>, <code>|</code>, sekme, madde işaretli/numaralı listeler ve serbest paragraflar.
              </p>
            </div>
          )}

          {/* TAB 2: GOOGLE DOCS */}
          {tab === "gdoc" && (
            <div className="flex flex-col gap-4">
              {/* Account Connection Card */}
              <div className="p-3.5 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {googleStatus?.connected ? (
                    <CheckCircle2 size={18} className="text-[var(--kg-green)] shrink-0 mt-0.5" />
                  ) : (
                    <Link2 size={18} className="text-[var(--kg-blue)] shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs">
                    <div className="font-bold text-sm text-[var(--kg-ink)]">
                      {googleStatus?.connected
                        ? "Google Hesabın Bağlı (Salt Okunur)"
                        : "Google Docs Erişimi"}
                    </div>
                    <p className="text-[var(--kg-ink-muted)] m-0 mt-0.5">
                      {googleStatus?.connected
                        ? "Özel ve paylaşılan Google Docs belgelerini güvenle senkronize edebilirsin."
                        : "Özel belgeler için Google hesabını bağlayabilir ya da 'Bağlantıya sahip olan herkes görüntüleyebilir' iznine sahip belge bağlantısını doğrudan yapıştırabilirsin."}
                    </p>
                  </div>
                </div>
                {googleStatus?.connected ? (
                  <button
                    type="button"
                    onClick={handleDisconnectGoogle}
                    disabled={busy}
                    className="min-h-[40px] px-3.5 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface)] text-xs font-bold text-[var(--kg-ink)] hover:border-[var(--kg-red)] cursor-pointer shrink-0"
                  >
                    Bağlantıyı Kes
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectGoogleAccount}
                    disabled={busy || !googleStatus?.oauthConfigured}
                    title={
                      googleStatus?.oauthConfigured
                        ? "Google hesabını salt okunur izinle bağla"
                        : "Sunucu OAuth ayarları henüz aktif değil; paylaşılan bağlantı ile devam edebilirsin"
                    }
                    className="inline-flex items-center justify-center gap-2.5 min-h-[40px] px-4 rounded-lg border border-[#747775] bg-white text-[#1f1f1f] text-sm font-semibold hover:bg-[#f8f9fa] disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
                      />
                      <path
                        fill="#34A853"
                        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"
                      />
                      <path
                        fill="#EA4335"
                        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
                      />
                    </svg>
                    <span>Google ile Bağlan</span>
                  </button>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-[var(--kg-ink-muted)]">
                  Google Docs Belge Bağlantısı (URL)
                </span>
                <input
                  type="url"
                  value={gdocUrl}
                  onChange={(e) => setGdocUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/.../edit"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink)] text-sm focus:outline-none focus:border-[var(--kg-blue)]"
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)]">
                <label className="flex items-center gap-2.5 text-sm font-semibold text-[var(--kg-ink)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[var(--kg-blue)]"
                  />
                  <RefreshCw size={15} />
                  <span>Otomatik Senkronizasyon</span>
                </label>

                {autoSyncEnabled && (
                  <label className="flex items-center gap-2 text-xs font-bold text-[var(--kg-ink-muted)]">
                    <span>Sıklık:</span>
                    <select
                      value={syncIntervalMin}
                      onChange={(e) => setSyncIntervalMin(Number(e.target.value))}
                      className="min-h-[36px] px-2.5 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface)] text-[var(--kg-ink)] text-xs font-bold"
                    >
                      <option value={5}>Her 5 dk</option>
                      <option value={15}>Her 15 dk (Önerilen)</option>
                      <option value={30}>Her 30 dk</option>
                      <option value={60}>Her 60 dk</option>
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FILE UPLOAD */}
          {tab === "file" && (
            <div className="flex flex-col gap-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--kg-border-strong)] rounded-2xl p-6 text-center bg-[var(--kg-surface-soft)] hover:border-[var(--kg-blue)] cursor-pointer transition-colors"
              >
                <Upload size={28} className="mx-auto text-[var(--kg-blue)] mb-2" />
                <div className="text-sm font-bold text-[var(--kg-ink)]">
                  {selectedFile ? selectedFile.name : "Dosya seçmek için tıkla"}
                </div>
                <p className="text-xs text-[var(--kg-ink-muted)] mt-1 mb-0">
                  Desteklenen türler: <strong>TXT, MD, DOCX, PDF</strong> (en fazla 5 MB)
                </p>
                {selectedFile && (
                  <p className="text-xs font-bold text-[var(--kg-green-ink)] mt-1.5 mb-0 tabular-nums">
                    {(selectedFile.size / 1024).toFixed(1)} KB seçildi
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setSelectedFile(f);
                    setError("");
                  }}
                />
              </div>
            </div>
          )}

          {/* AI enrichment toggle */}
          <label className="flex items-center gap-2.5 text-xs font-semibold text-[var(--kg-ink-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
              className="w-4 h-4 accent-[var(--kg-blue)]"
            />
            <span>
              Yapay zekâ ile serbest notlardan kelime çıkarımı, artikel/çoğul tespiti ve CEFR seviye analizini zenginleştir (çevrimdışıysa yerel ayrıştırıcı kullanılır)
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[var(--kg-border)] bg-[var(--kg-surface-soft)]">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="kg-btn"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={
              tab === "text"
                ? handleSubmitText
                : tab === "gdoc"
                  ? handleConnectGoogleDoc
                  : handleUploadFile
            }
            className="kg-btn"
            style={{
              background: "var(--kg-blue)",
              borderColor: "var(--kg-blue-dark)",
              color: "#ffffff",
            }}
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            <span>
              {busy
                ? "Analiz ediliyor…"
                : editSource
                  ? "Kaydet ve Yeniden Analiz Et"
                  : tab === "text"
                    ? "Metni Analiz Et ve Kaydet"
                    : tab === "gdoc"
                      ? "Belgeyi Bağla ve İçe Aktar"
                      : "Dosyayı Yükle ve Analiz Et"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
