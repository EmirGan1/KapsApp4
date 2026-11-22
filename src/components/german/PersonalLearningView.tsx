import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  FileText,
  Link2,
  Upload,
  Plus,
  RefreshCw,
  Trash2,
  Edit3,
  Play,
  ClipboardCheck,
  Sparkles,
  BookOpen,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  PauseCircle,
  SlidersHorizontal,
} from "lucide-react";
import {
  PERSONAL_CEFR_LEVELS,
  PERSONAL_EXERCISE_MODES,
  formatTurkishPercent,
  personalModeLabelTr,
  type PersonalCefrLevel,
  type PersonalDirection,
  type PersonalExerciseModeId,
  type PersonalSessionDTO,
  type PersonalSourceSummary,
} from "../../shared/germanPersonal";
import { PersonalCefrChart } from "./PersonalCefrChart";
import { PersonalExerciseSession } from "./PersonalExerciseSession";
import { PersonalSourceModal } from "./PersonalSourceModal";
import { PersonalVocabManager } from "./PersonalVocabManager";
import {
  deletePersonalSource,
  fetchPersonalOverview,
  fetchPersonalSourceDetail,
  startPersonalComprehensiveTest,
  startPersonalPracticeSession,
  syncPersonalGoogleDoc,
  updatePersonalSourceSettings,
  type PersonalOverviewResponse,
} from "./personalApi";

type PersonalSubTab = "sources" | "modes" | "comprehensive" | "vocab";

function formatDateTr(iso: string | null | undefined): string {
  if (!iso) return "Henüz yok";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Henüz yok";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceTypeLabel(type: PersonalSourceSummary["sourceType"]): string {
  if (type === "gdoc") return "Google Docs";
  if (type === "file") return "Dosya";
  return "Metin Notu";
}

function syncStatusMeta(status: string): { label: string; colorClass: string } {
  switch (status) {
    case "synced":
      return { label: "Senkronize", colorClass: "text-emerald-600 dark:text-emerald-400" };
    case "unchanged":
      return { label: "Değişiklik yok", colorClass: "text-[var(--kg-ink-muted)]" };
    case "syncing":
      return { label: "Senkronize ediliyor…", colorClass: "text-[var(--kg-blue-ink)]" };
    case "auth_required":
      return { label: "Google yetkisi gerekli", colorClass: "text-amber-600 dark:text-amber-400" };
    case "not_found":
      return { label: "Belge bulunamadı", colorClass: "text-rose-600 dark:text-rose-400" };
    case "rate_limited":
      return { label: "Hız sınırı — yeniden denenecek", colorClass: "text-amber-600 dark:text-amber-400" };
    case "error":
      return { label: "Senkronizasyon hatası", colorClass: "text-rose-600 dark:text-rose-400" };
    default:
      return { label: "Hazır", colorClass: "text-[var(--kg-ink-muted)]" };
  }
}

export function PersonalLearningView({
  onOverviewChanged,
}: {
  onOverviewChanged?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeSessionId = params.get("psession");

  const [subTab, setSubTab] = useState<PersonalSubTab>("sources");
  const [overview, setOverview] = useState<PersonalOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState<"text" | "gdoc" | "file">("text");
  const [editSource, setEditSource] = useState<{ id: string; title: string; rawText: string } | null>(
    null,
  );

  // Active session cache for smooth immediate launch
  const [initialSession, setInitialSession] = useState<PersonalSessionDTO | null>(null);

  // Vocabulary tab initial source filter
  const [vocabFilterSourceId, setVocabFilterSourceId] = useState<string>("ALL");

  // Practice mode launcher state
  const [selectedMode, setSelectedMode] = useState<PersonalExerciseModeId | "adaptive">("adaptive");
  const [practiceSourceIds, setPracticeSourceIds] = useState<string[]>([]);
  const [practiceStatus, setPracticeStatus] = useState<string>("unmastered");
  const [practiceCefr, setPracticeCefr] = useState<PersonalCefrLevel[]>([]);
  const [practiceDirection, setPracticeDirection] = useState<PersonalDirection>("mixed");
  const [practiceLength, setPracticeLength] = useState<number>(12);

  // Comprehensive test launcher state
  const [compSourceIds, setCompSourceIds] = useState<string[]>([]);
  const [compBatchSize, setCompBatchSize] = useState<number>(50);
  const [compDirection, setCompDirection] = useState<PersonalDirection>("mixed");
  const [compExtended, setCompExtended] = useState<boolean>(false);

  const loadOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchPersonalOverview();
      setOverview(data);
      setCompSourceIds((prev) => {
        if (prev.length > 0) {
          const valid = prev.filter((id) => data.sources.some((s) => s.id === id));
          if (valid.length > 0) return valid;
        }
        return data.sources.length > 0 ? [data.sources[0].id] : [];
      });
    } catch (err: any) {
      setError(err?.message || "Kişisel çalışma verileri yüklenemedi.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  // Handle Google OAuth return query flags
  useEffect(() => {
    const googleFlag = params.get("google");
    const googleErr = params.get("google_error");
    if (googleFlag === "connected") {
      setNotice("Google Docs hesabın başarıyla bağlandı. Şimdi belge bağlantını ekleyebilirsin.");
      setModalInitialTab("gdoc");
      setEditSource(null);
      setModalOpen(true);
      navigate("/dersler/kaps-german?tab=personal", { replace: true });
      void loadOverview(true);
    } else if (googleErr) {
      setError(`Google Docs bağlantısı tamamlanamadı: ${googleErr}`);
      navigate("/dersler/kaps-german?tab=personal", { replace: true });
    }
  }, [params, navigate, loadOverview]);

  const openSession = (session: PersonalSessionDTO) => {
    setInitialSession(session);
    navigate(`/dersler/kaps-german?tab=personal&psession=${encodeURIComponent(session.id)}`);
  };

  const openExistingSession = (sessionId: string) => {
    setInitialSession(null);
    navigate(`/dersler/kaps-german?tab=personal&psession=${encodeURIComponent(sessionId)}`);
  };

  const handleOpenAddModal = (tab: "text" | "gdoc" | "file") => {
    setEditSource(null);
    setModalInitialTab(tab);
    setModalOpen(true);
  };

  const handleEditTextSource = async (sourceId: string) => {
    setBusyAction(true);
    setError("");
    try {
      const detail = await fetchPersonalSourceDetail(sourceId);
      setEditSource({
        id: detail.source.id,
        title: detail.source.title,
        rawText: detail.rawText,
      });
      setModalInitialTab("text");
      setModalOpen(true);
    } catch (err: any) {
      setError(err?.message || "Kaynak içeriği açılamadı.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleSyncSource = async (sourceId: string) => {
    setSyncingSourceId(sourceId);
    setError("");
    setNotice("");
    try {
      const res = await syncPersonalGoogleDoc(sourceId, false);
      if (res.sync.unchanged) {
        setNotice("Google Docs belgesinde yeni değişiklik bulunmadı.");
      } else {
        setNotice(
          `Senkronizasyon tamamlandı: +${res.sync.added} eklendi, ${res.sync.updated} güncellendi, ${res.sync.removed} kaldırıldı.`,
        );
      }
      await loadOverview(true);
      onOverviewChanged?.();
    } catch (err: any) {
      setError(err?.message || "Senkronizasyon başarısız oldu.");
      await loadOverview(true);
    } finally {
      setSyncingSourceId(null);
    }
  };

  const handleToggleAutoSync = async (source: PersonalSourceSummary) => {
    try {
      await updatePersonalSourceSettings(source.id, {
        autoSyncEnabled: !source.autoSyncEnabled,
      });
      await loadOverview(true);
    } catch (err: any) {
      setError(err?.message || "Otomatik senkronizasyon ayarı güncellenemedi.");
    }
  };

  const handleChangeSyncInterval = async (sourceId: string, intervalMin: number) => {
    try {
      await updatePersonalSourceSettings(sourceId, { syncIntervalMin: intervalMin });
      await loadOverview(true);
    } catch (err: any) {
      setError(err?.message || "Senkronizasyon aralığı güncellenemedi.");
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    setBusyAction(true);
    setError("");
    try {
      await deletePersonalSource(sourceId);
      setConfirmDeleteId(null);
      setNotice("Kaynak kaldırıldı. Global kelime öğrenme geçmişin korundu.");
      await loadOverview(true);
      onOverviewChanged?.();
    } catch (err: any) {
      setError(err?.message || "Kaynak silinemedi.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleStartPractice = async (overrides?: {
    mode?: PersonalExerciseModeId | "adaptive";
    sourceIds?: string[];
    vocabIds?: string[];
    filterStatus?: string;
  }) => {
    if (busyAction) return;
    setBusyAction(true);
    setError("");
    try {
      const session = await startPersonalPracticeSession({
        mode: overrides?.mode ?? selectedMode,
        direction: practiceDirection,
        sourceIds:
          overrides?.sourceIds !== undefined
            ? overrides.sourceIds
            : practiceSourceIds.length > 0
              ? practiceSourceIds
              : undefined,
        filterStatus: overrides?.filterStatus ?? practiceStatus,
        cefrLevels: practiceCefr.length > 0 ? practiceCefr : undefined,
        vocabIds: overrides?.vocabIds,
        sessionLength: overrides?.vocabIds ? Math.min(30, overrides.vocabIds.length) : practiceLength,
        useAI: true,
      });
      openSession(session);
    } catch (err: any) {
      setError(err?.message || "Alıştırma oturumu başlatılamadı.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleStartComprehensive = async (sourceIdsOverride?: string[]) => {
    if (busyAction) return;
    const targetIds = sourceIdsOverride ?? compSourceIds;
    if (targetIds.length === 0) {
      setError("Genel Test için en az bir kaynak seçmelisin.");
      return;
    }
    setBusyAction(true);
    setError("");
    try {
      const session = await startPersonalComprehensiveTest({
        sourceIds: targetIds,
        batchSize: compBatchSize,
        extendedMode: compExtended,
        direction: compDirection,
      });
      openSession(session);
    } catch (err: any) {
      setError(err?.message || "Genel Test başlatılamadı.");
    } finally {
      setBusyAction(false);
    }
  };

  // If a personal session is open, render the full exercise runner
  if (activeSessionId) {
    return (
      <PersonalExerciseSession
        sessionId={activeSessionId}
        initialSession={initialSession?.id === activeSessionId ? initialSession : null}
        onExit={() => {
          setInitialSession(null);
          navigate("/dersler/kaps-german?tab=personal");
          void loadOverview(true);
          onOverviewChanged?.();
        }}
        onPracticeWeakWords={(vocabIds) => {
          setInitialSession(null);
          navigate("/dersler/kaps-german?tab=personal");
          void handleStartPractice({
            mode: "adaptive",
            vocabIds,
            filterStatus: "all",
          });
        }}
      />
    );
  }

  const sources = overview?.sources ?? [];
  const summary = overview?.summary;
  const resumableSessions = (overview?.sessions ?? []).filter(
    (s) => s.status === "active" || s.status === "paused",
  );
  const resumableCompSessions = resumableSessions.filter((s) => s.kind === "comprehensive");

  const selectedCompSources = sources.filter((s) => compSourceIds.includes(s.id));
  const selectedCompWordEstimate = selectedCompSources.reduce(
    (acc, s) => acc + s.totalActiveItems,
    0,
  );
  const selectedCompTotalItems = compExtended
    ? selectedCompWordEstimate * 2
    : selectedCompWordEstimate;
  const estimatedBatches = Math.max(1, Math.ceil(selectedCompTotalItems / compBatchSize));

  return (
    <div className="kg-container flex flex-col gap-5 pb-10">
      {/* Top Hero Header */}
      <section className="kg-card flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1 max-w-2xl">
            <h1 className="text-xl sm:text-2xl font-extrabold text-[var(--kg-ink)] m-0 tracking-tight">
              Kişisel Çalışma
            </h1>
            <p className="text-sm text-[var(--kg-ink-muted)] m-0 leading-relaxed">
              Kendi Almanca notlarını, Google Docs belgelerini veya dosyalarını ekle; yapay zekâ destekli
              CEFR analizi, 10 farklı alıştırma modu ve %100 kapsamlı Genel Test ile ustalaş.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenAddModal("text")}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--kg-blue)] text-white font-bold text-sm cursor-pointer inline-flex items-center gap-2 border-0 shadow-sm hover:opacity-95"
            >
              <Plus size={17} /> Kaynak Ekle
            </button>
            {sources.length > 0 && (
              <button
                type="button"
                disabled={busyAction}
                onClick={() => void handleStartPractice({ mode: "adaptive" })}
                className="min-h-[44px] px-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink)] font-bold text-sm cursor-pointer inline-flex items-center gap-2 hover:border-[var(--kg-blue)] disabled:opacity-50"
              >
                {busyAction ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Hızlı Adaptif Pratik
              </button>
            )}
          </div>
        </div>

        {/* Sub-navigation bar */}
        <div
          className="flex flex-wrap gap-2 pt-3 border-t border-[var(--kg-border)]"
          role="tablist"
          aria-label="Kişisel Çalışma bölümleri"
        >
          {(
            [
              { id: "sources", label: `Kaynaklarım (${sources.length})`, icon: Layers },
              { id: "modes", label: "Alıştırma Modları (10)", icon: SlidersHorizontal },
              { id: "comprehensive", label: "Genel Test (Tüm Kelimeler)", icon: ClipboardCheck },
              {
                id: "vocab",
                label: `Kelime Kütüphanesi (${summary?.totalUniqueWords ?? 0})`,
                icon: BookOpen,
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSubTab(t.id)}
                className={`min-h-[42px] px-3.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 cursor-pointer transition-colors border ${
                  active
                    ? "bg-[var(--kg-blue-soft)] border-[var(--kg-blue)] text-[var(--kg-blue-ink)]"
                    : "bg-transparent border-[var(--kg-border)] text-[var(--kg-ink-muted)] hover:text-[var(--kg-ink)]"
                }`}
              >
                <Icon size={15} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Feedback Alerts */}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-3"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="text-xs font-bold underline bg-transparent border-0 text-current cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-xs font-bold underline bg-transparent border-0 text-current cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && !overview ? (
        <div className="kg-card flex items-center gap-3 text-sm text-[var(--kg-ink-muted)]" role="status">
          <Loader2 size={18} className="animate-spin" />
          Kişisel çalışma alanın hazırlanıyor…
        </div>
      ) : null}

      {/* =================================================================== */}
      {/* SUB-TAB 1: KAYNAKLARIM (SOURCES & OVERVIEW)                         */}
      {/* =================================================================== */}
      {overview && subTab === "sources" && (
        <div className="flex flex-col gap-5">
          {/* Resumable Active / Paused Sessions Banner */}
          {resumableSessions.length > 0 && (
            <section className="kg-card border-[var(--kg-blue)]/40 bg-[var(--kg-blue-soft)]/30 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-[var(--kg-ink)] m-0 inline-flex items-center gap-2">
                  <PauseCircle size={16} className="text-[var(--kg-blue)]" />
                  Yarım Kalan Oturumların ({resumableSessions.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {resumableSessions.slice(0, 4).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface)] p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[var(--kg-ink)] truncate">
                        {s.kind === "comprehensive"
                          ? "Genel Test — Tüm Kelimeler"
                          : personalModeLabelTr(s.mode)}
                      </div>
                      <div className="text-xs text-[var(--kg-ink-muted)] tabular-nums mt-0.5">
                        {s.coveredCount} / {s.totalTargets} kelime ({formatTurkishPercent(s.coveragePercent)})
                        {s.totalBatches > 1 ? ` · Bölüm ${s.currentBatch}/${s.totalBatches}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openExistingSession(s.id)}
                      className="min-h-[38px] px-3 rounded-lg bg-[var(--kg-blue)] text-white text-xs font-bold border-0 cursor-pointer inline-flex items-center gap-1 shrink-0"
                    >
                      Devam Et <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* KPI Strip + Overall CEFR Summary */}
          {summary && summary.totalUniqueWords > 0 && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 kg-card flex flex-col justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--kg-ink-muted)]">
                    Genel Öğrenme İlerlemesi (5/5 Kuralı)
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2.5 tabular-nums">
                    <span className="text-3xl font-black text-[var(--kg-ink)]">
                      {formatTurkishPercent(summary.completionPercent)}
                    </span>
                    <span className="text-sm font-semibold text-[var(--kg-ink-muted)]">
                      {summary.masteredWords} / {summary.totalUniqueWords} kelime öğrenildi
                    </span>
                  </div>
                  <div className="mt-2.5 w-full h-2.5 rounded-full bg-[var(--kg-surface-soft)] overflow-hidden border border-[var(--kg-border)]">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, summary.completionPercent)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[var(--kg-border)] tabular-nums">
                  <div>
                    <div className="text-xs text-[var(--kg-ink-muted)]">Öğrenildi (5/5)</div>
                    <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                      {summary.masteredWords}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--kg-ink-muted)]">Neredeyse (4/5)</div>
                    <div className="text-base font-extrabold text-[var(--kg-blue-ink)]">
                      {summary.almostMasteredWords}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--kg-ink-muted)]">Tekrar Gerekli</div>
                    <div className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                      {summary.needsReviewWords}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 kg-card flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-extrabold text-[var(--kg-ink)] m-0">
                    Tüm Kaynakların CEFR Seviye Dağılımı
                  </h2>
                  <span className="text-xs text-[var(--kg-ink-muted)] tabular-nums">
                    {summary.totalUniqueWords} benzersiz kelime
                  </span>
                </div>
                <PersonalCefrChart summary={summary.cefrSummary} />
              </div>
            </section>
          )}

          {/* Empty State / Quick Import Cards */}
          {sources.length === 0 ? (
            <section className="kg-card flex flex-col gap-5 py-8">
              <div className="text-center max-w-lg mx-auto">
                <h2 className="text-lg font-extrabold text-[var(--kg-ink)] m-0">
                  İlk Kişisel Çalışma Kaynağını Ekle
                </h2>
                <p className="text-sm text-[var(--kg-ink-muted)] mt-1.5 mb-0">
                  Kendi kelime listeni yapıştır, Google Docs belgeni bağla veya TXT/MD/DOCX/PDF dosyanı yükle.
                  Kelimelerin yalnızca sana özel olarak saklanır.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <button
                  type="button"
                  onClick={() => handleOpenAddModal("text")}
                  className="text-left p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] hover:border-[var(--kg-blue)] transition-colors cursor-pointer flex flex-col gap-2"
                >
                  <FileText size={22} className="text-[var(--kg-blue)]" />
                  <div className="text-sm font-extrabold text-[var(--kg-ink)]">Metin Yapıştır</div>
                  <div className="text-xs text-[var(--kg-ink-muted)] leading-relaxed">
                    Her formatta Almanca–Türkçe notlarını yapıştır (—, :, =, madde işaretleri, örnek cümleler).
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal("gdoc")}
                  className="text-left p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] hover:border-[var(--kg-blue)] transition-colors cursor-pointer flex flex-col gap-2"
                >
                  <Link2 size={22} className="text-[var(--kg-blue)]" />
                  <div className="text-sm font-extrabold text-[var(--kg-ink)]">Google Docs Bağla</div>
                  <div className="text-xs text-[var(--kg-ink-muted)] leading-relaxed">
                    Google Docs belgeni salt-okunur bağla; değişikliklerin otomatik senkronize edilsin.
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal("file")}
                  className="text-left p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] hover:border-[var(--kg-blue)] transition-colors cursor-pointer flex flex-col gap-2"
                >
                  <Upload size={22} className="text-[var(--kg-blue)]" />
                  <div className="text-sm font-extrabold text-[var(--kg-ink)]">Dosya Yükle</div>
                  <div className="text-xs text-[var(--kg-ink-muted)] leading-relaxed">
                    TXT, Markdown (.md), Word (.docx) veya metin tabanlı PDF (maks. 5 MB) yükle.
                  </div>
                </button>
              </div>
            </section>
          ) : (
            /* Source List */
            <section className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-extrabold text-[var(--kg-ink)] m-0">
                  Kaynakların ({sources.length})
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal("text")}
                    className="min-h-[38px] px-3 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface)] text-xs font-bold text-[var(--kg-ink)] cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FileText size={14} /> Metin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal("gdoc")}
                    className="min-h-[38px] px-3 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface)] text-xs font-bold text-[var(--kg-ink)] cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Link2 size={14} /> Google Docs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddModal("file")}
                    className="min-h-[38px] px-3 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface)] text-xs font-bold text-[var(--kg-ink)] cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload size={14} /> Dosya
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {sources.map((src) => {
                  const statusMeta = syncStatusMeta(src.syncStatus);
                  const isSyncing = syncingSourceId === src.id;
                  const Icon =
                    src.sourceType === "gdoc"
                      ? Link2
                      : src.sourceType === "file"
                        ? Upload
                        : FileText;

                  return (
                    <article
                      key={src.id}
                      className="kg-card flex flex-col gap-4 border border-[var(--kg-border)]"
                    >
                      {/* Header Row */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[var(--kg-surface-soft)] border border-[var(--kg-border)] flex items-center justify-center shrink-0 text-[var(--kg-blue)]">
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-extrabold text-[var(--kg-ink)] m-0 break-words">
                              {src.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--kg-ink-muted)] mt-0.5">
                              <span>{sourceTypeLabel(src.sourceType)}</span>
                              <span className={`font-semibold ${statusMeta.colorClass}`}>
                                {statusMeta.label}
                              </span>
                              {src.lastSyncedAt && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock size={12} /> Son eşitleme: {formatDateTr(src.lastSyncedAt)}
                                </span>
                              )}
                              {src.uncertainCount > 0 && (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                  {src.uncertainCount} belirsiz kayıt
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Secondary Source Actions */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {src.sourceType === "gdoc" && (
                            <button
                              type="button"
                              disabled={isSyncing}
                              onClick={() => void handleSyncSource(src.id)}
                              className="min-h-[38px] px-3 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-xs font-bold text-[var(--kg-ink)] cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <RefreshCw size={13} className={isSyncing ? "animate-spin" : ""} />
                              {isSyncing ? "Senkronize…" : "Şimdi Senkronize Et"}
                            </button>
                          )}
                          {src.sourceType === "text" && (
                            <button
                              type="button"
                              disabled={busyAction}
                              onClick={() => void handleEditTextSource(src.id)}
                              className="min-h-[38px] px-3 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-xs font-bold text-[var(--kg-ink)] cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <Edit3 size={13} /> Düzenle
                            </button>
                          )}
                          {confirmDeleteId === src.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={busyAction}
                                onClick={() => void handleDeleteSource(src.id)}
                                className="min-h-[38px] px-3 rounded-lg bg-rose-600 text-white text-xs font-bold border-0 cursor-pointer"
                              >
                                Silmeyi Onayla
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="min-h-[38px] px-2.5 rounded-lg border border-[var(--kg-border)] bg-transparent text-xs font-semibold text-[var(--kg-ink-muted)] cursor-pointer"
                              >
                                Vazgeç
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`${src.title} kaynağını sil`}
                              onClick={() => setConfirmDeleteId(src.id)}
                              className="min-h-[38px] px-2.5 rounded-lg border border-[var(--kg-border)] bg-transparent text-[var(--kg-ink-muted)] hover:text-rose-600 cursor-pointer inline-flex items-center"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Google Sync Error / Auto-Sync Controls */}
                      {src.lastSyncError && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2">
                          <span>{src.lastSyncError}</span>
                          {src.syncStatus === "auth_required" && (
                            <button
                              type="button"
                              onClick={() => handleOpenAddModal("gdoc")}
                              className="underline font-bold bg-transparent border-0 text-current cursor-pointer"
                            >
                              Google hesabını yeniden bağla
                            </button>
                          )}
                        </div>
                      )}

                      {src.sourceType === "gdoc" && (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--kg-ink-muted)] bg-[var(--kg-surface-soft)] px-3 py-2 rounded-lg border border-[var(--kg-border)]">
                          <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-[var(--kg-ink)]">
                            <input
                              type="checkbox"
                              checked={src.autoSyncEnabled}
                              onChange={() => void handleToggleAutoSync(src)}
                            />
                            Otomatik Senkronizasyon
                          </label>
                          {src.autoSyncEnabled && (
                            <select
                              aria-label="Otomatik senkronizasyon aralığı"
                              value={src.syncIntervalMin}
                              onChange={(e) =>
                                void handleChangeSyncInterval(src.id, Number(e.target.value))
                              }
                              className="rounded-md border border-[var(--kg-border)] bg-[var(--kg-surface)] px-2 py-1 text-xs text-[var(--kg-ink)]"
                            >
                              <option value={5}>Her 5 dakikada</option>
                              <option value={15}>Her 15 dakikada</option>
                              <option value={30}>Her 30 dakikada</option>
                              <option value={60}>Her 60 dakikada</option>
                            </select>
                          )}
                        </div>
                      )}

                      {/* Exact Source Completion Progress (Strict 5/5 Mastered Formula) */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
                          <span className="font-bold text-[var(--kg-ink)]">
                            {src.masteredItems} / {src.totalActiveItems} kelime öğrenildi —{" "}
                            {formatTurkishPercent(src.completionPercent)}
                          </span>
                          <span className="text-xs text-[var(--kg-ink-muted)]">
                            Neredeyse: {src.almostMasteredItems} · Çalışılıyor: {src.learningItems} ·
                            Tekrar: {src.needsReviewItems}
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-[var(--kg-surface-soft)] overflow-hidden border border-[var(--kg-border)]">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${Math.min(100, src.completionPercent)}%` }}
                          />
                        </div>
                      </div>

                      {/* Source CEFR Breakdown */}
                      <div className="pt-1">
                        <PersonalCefrChart summary={src.cefrSummary} compact />
                      </div>

                      {/* Primary Study CTA Row */}
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[var(--kg-border)]">
                        <button
                          type="button"
                          disabled={busyAction || src.totalActiveItems === 0}
                          onClick={() =>
                            void handleStartPractice({
                              mode: "adaptive",
                              sourceIds: [src.id],
                              filterStatus: "unmastered",
                            })
                          }
                          className="min-h-[42px] px-4 rounded-xl bg-[var(--kg-blue)] text-white text-xs font-bold border-0 cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Play size={14} /> Pratik Yap
                        </button>
                        <button
                          type="button"
                          disabled={busyAction || src.totalActiveItems === 0}
                          onClick={() => void handleStartComprehensive([src.id])}
                          className="min-h-[42px] px-4 rounded-xl border border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <ClipboardCheck size={14} /> Genel Test ({src.totalActiveItems} kelime)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setVocabFilterSourceId(src.id);
                            setSubTab("vocab");
                          }}
                          className="min-h-[42px] px-3.5 rounded-xl border border-[var(--kg-border)] bg-transparent text-[var(--kg-ink)] text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <BookOpen size={14} /> Kelimeleri Gör
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 2: ALIŞTIRMA MODLARI (10 MODES + ADAPTIVE)                  */}
      {/* =================================================================== */}
      {overview && subTab === "modes" && (
        <div className="flex flex-col gap-5">
          {sources.length === 0 ? (
            <div className="kg-card text-sm text-[var(--kg-ink-muted)] flex flex-wrap items-center justify-between gap-3">
              <span>Alıştırma başlatmak için önce en az bir kişisel kaynak eklemelisin.</span>
              <button
                type="button"
                onClick={() => handleOpenAddModal("text")}
                className="min-h-[40px] px-4 rounded-xl bg-[var(--kg-blue)] text-white text-xs font-bold border-0 cursor-pointer"
              >
                Kaynak Ekle
              </button>
            </div>
          ) : (
            <>
              {/* Mode Selector Grid */}
              <section className="kg-card flex flex-col gap-4">
                <div>
                  <h2 className="text-base font-extrabold text-[var(--kg-ink)] m-0">
                    Alıştırma Modunu Seç
                  </h2>
                  <p className="text-xs text-[var(--kg-ink-muted)] mt-1 mb-0">
                    Tüm modlarda geçerli doğru yanıtlar global 5/5 ustalık serini ilerletir; yanlış yanıt
                    seriyi sıfırlar ve kelimeyi tekrar kuyruğuna alır.
                  </p>
                </div>

                {/* Smart Adaptive Banner Card */}
                <button
                  type="button"
                  onClick={() => setSelectedMode("adaptive")}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors cursor-pointer flex flex-wrap items-center justify-between gap-3 ${
                    selectedMode === "adaptive"
                      ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)]"
                      : "border-[var(--kg-border)] bg-[var(--kg-surface-soft)] hover:border-[var(--kg-blue)]/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles size={20} className="text-[var(--kg-blue)] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-sm font-extrabold text-[var(--kg-ink)]">
                        Akıllı Adaptif Pratik (Önerilen)
                      </div>
                      <div className="text-xs text-[var(--kg-ink-muted)] mt-0.5">
                        Zayıf kelimelere, yeni eklenenlere ve 4/5 ustalığa yaklaşanlara öncelik vererek
                        modları otomatik harmanlar.
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[var(--kg-blue-ink)]">
                    {selectedMode === "adaptive" ? "Seçili" : "Seç"}
                  </span>
                </button>

                {/* All 10 Dedicated Modes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {PERSONAL_EXERCISE_MODES.map((m) => {
                    const active = selectedMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMode(m.id)}
                        className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex flex-col gap-1 min-h-[76px] ${
                          active
                            ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)]"
                            : "border-[var(--kg-border)] bg-[var(--kg-surface)] hover:border-[var(--kg-blue)]/50"
                        }`}
                      >
                        <div className="text-sm font-extrabold text-[var(--kg-ink)]">
                          {m.labelTr}
                        </div>
                        <div className="text-xs text-[var(--kg-ink-muted)] leading-snug">
                          {m.shortDescTr}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Filters & Start Bar */}
              <section className="kg-card flex flex-col gap-4">
                <h3 className="text-sm font-extrabold text-[var(--kg-ink)] m-0">
                  Oturum Ayarları
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Mastery Status Filter */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="kg-practice-status"
                      className="text-xs font-bold text-[var(--kg-ink-muted)]"
                    >
                      Kelime Durumu
                    </label>
                    <select
                      id="kg-practice-status"
                      value={practiceStatus}
                      onChange={(e) => setPracticeStatus(e.target.value)}
                      className="min-h-[42px] rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] px-3 text-sm text-[var(--kg-ink)]"
                    >
                      <option value="unmastered">Öğrenilmemişler (0–4/5)</option>
                      <option value="all">Tüm Aktif Kelimeler</option>
                      <option value="new">Yeni / Hiç Çalışılmamış</option>
                      <option value="mistakes">Hata Yapılanlar / Tekrar Gerekli</option>
                      <option value="almost_mastered">Neredeyse Öğrenildi (4/5)</option>
                      <option value="mastered_review">Öğrenilenleri Pekiştir (5/5)</option>
                    </select>
                  </div>

                  {/* Direction */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="kg-practice-dir"
                      className="text-xs font-bold text-[var(--kg-ink-muted)]"
                    >
                      Dil Yönü
                    </label>
                    <select
                      id="kg-practice-dir"
                      value={practiceDirection}
                      onChange={(e) => setPracticeDirection(e.target.value as PersonalDirection)}
                      className="min-h-[42px] rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] px-3 text-sm text-[var(--kg-ink)]"
                    >
                      <option value="mixed">Karışık (DE ↔ TR)</option>
                      <option value="de_tr">Almanca → Türkçe</option>
                      <option value="tr_de">Türkçe → Almanca</option>
                    </select>
                  </div>

                  {/* Session Length */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="kg-practice-len"
                      className="text-xs font-bold text-[var(--kg-ink-muted)]"
                    >
                      Soru Sayısı
                    </label>
                    <select
                      id="kg-practice-len"
                      value={practiceLength}
                      onChange={(e) => setPracticeLength(Number(e.target.value))}
                      className="min-h-[42px] rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] px-3 text-sm text-[var(--kg-ink)]"
                    >
                      <option value={8}>8 soru (Hızlı)</option>
                      <option value={12}>12 soru (Standart)</option>
                      <option value={20}>20 soru (Yoğun)</option>
                      <option value={30}>30 soru (Uzun)</option>
                    </select>
                  </div>
                </div>

                {/* Source Multi-Select */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--kg-ink-muted)]">
                    Kaynak Filtresi (boş bırakırsan tüm kaynaklar dahil edilir)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {sources.map((s) => {
                      const checked = practiceSourceIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`min-h-[38px] px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-2 cursor-pointer ${
                            checked
                              ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)]"
                              : "border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setPracticeSourceIds((prev) =>
                                checked ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                              )
                            }
                          />
                          <span>
                            {s.title} ({s.totalActiveItems})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* CEFR Level Multi-Select */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-bold text-[var(--kg-ink-muted)]">
                    CEFR Seviye Filtresi (opsiyonel)
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PERSONAL_CEFR_LEVELS.map((lvl) => {
                      const active = practiceCefr.includes(lvl);
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() =>
                            setPracticeCefr((prev) =>
                              active ? prev.filter((x) => x !== lvl) : [...prev, lvl],
                            )
                          }
                          className={`min-h-[36px] px-3 rounded-lg border text-xs font-bold cursor-pointer ${
                            active
                              ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)]"
                              : "border-[var(--kg-border)] bg-transparent text-[var(--kg-ink-muted)]"
                          }`}
                        >
                          {lvl === "UNKNOWN" ? "Belirsiz" : lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--kg-border)]">
                  <div className="text-xs text-[var(--kg-ink-muted)]">
                    Seçili mod:{" "}
                    <strong className="text-[var(--kg-ink)]">
                      {personalModeLabelTr(selectedMode)}
                    </strong>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleStartPractice()}
                    className="min-h-[46px] px-6 rounded-xl bg-[var(--kg-blue)] text-white text-sm font-extrabold border-0 cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {busyAction ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} />
                    )}
                    Alıştırmayı Başlat
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 3: GENEL TEST — TÜM KELİMELER (%100 KAPSAM)                 */}
      {/* =================================================================== */}
      {overview && subTab === "comprehensive" && (
        <div className="flex flex-col gap-5">
          {sources.length === 0 ? (
            <div className="kg-card text-sm text-[var(--kg-ink-muted)] flex flex-wrap items-center justify-between gap-3">
              <span>Genel Test başlatmak için önce en az bir kişisel kaynak eklemelisin.</span>
              <button
                type="button"
                onClick={() => handleOpenAddModal("text")}
                className="min-h-[40px] px-4 rounded-xl bg-[var(--kg-blue)] text-white text-xs font-bold border-0 cursor-pointer"
              >
                Kaynak Ekle
              </button>
            </div>
          ) : (
            <>
              <section className="kg-card flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-extrabold text-[var(--kg-ink)] m-0">
                    Genel Test — Tüm Kelimeler
                  </h2>
                  <p className="text-sm text-[var(--kg-ink-muted)] mt-1 mb-0 leading-relaxed">
                    Seçtiğin kaynaklardaki <strong>tüm aktif benzersiz kelimeleri (%100 kapsam)</strong>{" "}
                    eksiksiz test eder; soru sayısı sessizce kırpılmaz. Büyük listeler kaldığın yerden
                    devam edebileceğin bölümlere ayrılır ve Test Başarı Oranı, Kaynak Öğrenme % değerinden
                    ayrı raporlanır.
                  </p>
                </div>

                {/* Source Selection */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--kg-ink-muted)]">
                      Test Edilecek Kaynakları Seç
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCompSourceIds(
                          compSourceIds.length === sources.length
                            ? [sources[0].id]
                            : sources.map((s) => s.id),
                        )
                      }
                      className="text-xs font-bold text-[var(--kg-blue-ink)] bg-transparent border-0 cursor-pointer underline"
                    >
                      {compSourceIds.length === sources.length ? "Tek Kaynak Seç" : "Tümünü Seç"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {sources.map((s) => {
                      const checked = compSourceIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`p-3 rounded-xl border cursor-pointer flex items-start justify-between gap-3 ${
                            checked
                              ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)]"
                              : "border-[var(--kg-border)] bg-[var(--kg-surface-soft)]"
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setCompSourceIds((prev) =>
                                  checked ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                                )
                              }
                              className="mt-1"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-[var(--kg-ink)] truncate">
                                {s.title}
                              </div>
                              <div className="text-xs text-[var(--kg-ink-muted)] tabular-nums mt-0.5">
                                {s.totalActiveItems} aktif kelime · {s.masteredItems} öğrenildi (
                                {formatTurkishPercent(s.completionPercent)})
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Comprehensive Test Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="kg-comp-batch"
                      className="text-xs font-bold text-[var(--kg-ink-muted)]"
                    >
                      Bölüm Boyutu
                    </label>
                    <select
                      id="kg-comp-batch"
                      value={compBatchSize}
                      onChange={(e) => setCompBatchSize(Number(e.target.value))}
                      className="min-h-[42px] rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] px-3 text-sm text-[var(--kg-ink)]"
                    >
                      <option value={25}>25 soru / bölüm</option>
                      <option value={50}>50 soru / bölüm (Önerilen)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="kg-comp-dir"
                      className="text-xs font-bold text-[var(--kg-ink-muted)]"
                    >
                      Dil Yönü
                    </label>
                    <select
                      id="kg-comp-dir"
                      value={compDirection}
                      onChange={(e) => setCompDirection(e.target.value as PersonalDirection)}
                      className="min-h-[42px] rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] px-3 text-sm text-[var(--kg-ink)]"
                    >
                      <option value="mixed">Karışık (DE ↔ TR)</option>
                      <option value="de_tr">Almanca → Türkçe</option>
                      <option value="tr_de">Türkçe → Almanca</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] cursor-pointer text-xs text-[var(--kg-ink)]">
                  <input
                    type="checkbox"
                    checked={compExtended}
                    onChange={(e) => setCompExtended(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong>Genişletilmiş Mod (2 Tur):</strong> Her kelime hem Almanca → Türkçe hem de
                    Türkçe → Almanca yönünde toplam 2 kez test edilir.
                  </span>
                </label>

                {/* Coverage Summary & Start */}
                <div className="rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="tabular-nums">
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--kg-ink-muted)]">
                      Kapsam Özeti
                    </div>
                    <div className="text-base font-extrabold text-[var(--kg-ink)] mt-0.5">
                      {selectedCompWordEstimate > 0
                        ? `En fazla ${selectedCompTotalItems} soru · ${estimatedBatches} bölüm (%100 aktif kelime kapsamı)`
                        : "En az bir kaynak seç"}
                    </div>
                    <div className="text-xs text-[var(--kg-ink-muted)] mt-0.5">
                      Ortak kelimeler tekilleştirilir; test tamamlanmadan kapatılırsa kaldığın sorudan devam
                      edebilirsin.
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyAction || compSourceIds.length === 0 || selectedCompWordEstimate === 0}
                    onClick={() => void handleStartComprehensive()}
                    className="min-h-[46px] px-6 rounded-xl bg-[var(--kg-blue)] text-white text-sm font-extrabold border-0 cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {busyAction ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ClipboardCheck size={16} />
                    )}
                    Genel Testi Başlat
                  </button>
                </div>
              </section>

              {/* Resumable Comprehensive Tests */}
              {resumableCompSessions.length > 0 && (
                <section className="kg-card flex flex-col gap-3">
                  <h3 className="text-sm font-extrabold text-[var(--kg-ink)] m-0">
                    Devam Eden Genel Testlerin
                  </h3>
                  <div className="flex flex-col gap-2">
                    {resumableCompSessions.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] p-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="tabular-nums">
                          <div className="text-sm font-bold text-[var(--kg-ink)]">
                            {s.coveredCount} / {s.totalTargets} soru tamamlandı (
                            {formatTurkishPercent(s.coveragePercent)})
                          </div>
                          <div className="text-xs text-[var(--kg-ink-muted)]">
                            Bölüm {s.currentBatch} / {s.totalBatches} · Son güncelleme:{" "}
                            {formatDateTr(s.updatedAt)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openExistingSession(s.id)}
                          className="min-h-[40px] px-4 rounded-xl bg-[var(--kg-blue)] text-white text-xs font-bold border-0 cursor-pointer inline-flex items-center gap-1.5"
                        >
                          Kaldığın Yerden Devam Et <ArrowRight size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SUB-TAB 4: KELİME KÜTÜPHANESİ                                       */}
      {/* =================================================================== */}
      {overview && subTab === "vocab" && (
        <PersonalVocabManager
          sources={sources}
          initialSourceId={vocabFilterSourceId}
          onPracticeVocabIds={(vocabIds) =>
            void handleStartPractice({
              mode: "adaptive",
              vocabIds,
              filterStatus: "all",
            })
          }
          onChanged={() => {
            void loadOverview(true);
            onOverviewChanged?.();
          }}
        />
      )}

      {/* Source Import / Edit Modal */}
      <PersonalSourceModal
        open={modalOpen}
        initialTab={modalInitialTab}
        editSource={editSource}
        googleStatus={overview?.googleStatus ?? null}
        onClose={() => {
          setModalOpen(false);
          setEditSource(null);
        }}
        onSuccess={(_source, messageTr) => {
          setModalOpen(false);
          setEditSource(null);
          setNotice(messageTr);
          setError("");
          void loadOverview(true);
          onOverviewChanged?.();
        }}
        onRefreshGoogle={() => {
          void loadOverview(true);
        }}
      />
    </div>
  );
}
