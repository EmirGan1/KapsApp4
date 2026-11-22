import { useCallback, useEffect, useState } from "react";
import {
  Search,
  Volume2,
  Edit3,
  History,
  EyeOff,
  Eye,
  Trash2,
  AlertTriangle,
  X,
  Check,
  Play,
} from "lucide-react";
import {
  PERSONAL_CEFR_LEVELS,
  type PersonalCefrLevel,
  type PersonalSourceSummary,
  type PersonalVocabItemDTO,
} from "../../shared/germanPersonal";
import { speakGerman } from "./api";
import { MasteryPips } from "./MasteryPips";
import {
  deletePersonalVocabItem,
  fetchPersonalVocabHistory,
  fetchPersonalVocabulary,
  togglePersonalVocabExclude,
  updatePersonalVocabularyItem,
} from "./personalApi";

export function PersonalVocabManager({
  sources,
  initialSourceId = "ALL",
  onPracticeVocabIds,
  onChanged,
}: {
  sources: PersonalSourceSummary[];
  initialSourceId?: string;
  onPracticeVocabIds: (vocabIds: string[]) => void;
  onChanged: () => void;
}) {
  const [sourceId, setSourceId] = useState(initialSourceId);
  useEffect(() => {
    setSourceId(initialSourceId);
    setPage(1);
  }, [initialSourceId]);
  const [cefr, setCefr] = useState("ALL");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("updated");
  const [query, setQuery] = useState("");
  const [includeExcluded, setIncludeExcluded] = useState(false);
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<PersonalVocabItemDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState<PersonalVocabItemDTO | null>(null);
  const [editDraft, setEditDraft] = useState({
    de: "",
    tr: "",
    article: "",
    plural: "",
    partOfSpeech: "",
    cefrLevel: "B1" as PersonalCefrLevel,
    category: "",
    exampleDe: "",
    exampleTr: "",
    notes: "",
  });

  const [historyModal, setHistoryModal] = useState<{
    item: PersonalVocabItemDTO;
    attempts: Array<{
      id: string;
      mode: string;
      direction: string;
      promptText: string;
      userAnswer: string;
      expectedAnswer: string;
      isCorrect: boolean;
      selfAssessed: boolean;
      creditGranted: boolean;
      streakBefore: number;
      streakAfter: number;
      masteredNow: boolean;
      createdAt: string;
    }>;
  } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchPersonalVocabulary({
        sourceId,
        cefr,
        status,
        q: query,
        sort,
        includeExcluded,
        page,
        limit: 30,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || "Kelime listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [sourceId, cefr, status, query, sort, includeExcluded, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setSourceId(initialSourceId);
    setPage(1);
  }, [initialSourceId]);

  const openEdit = (w: PersonalVocabItemDTO) => {
    setEditing(w);
    setEditDraft({
      de: w.de,
      tr: w.tr,
      article: w.article,
      plural: w.plural,
      partOfSpeech: w.partOfSpeech,
      cefrLevel: w.cefrLevel,
      category: w.category,
      exampleDe: w.exampleDe,
      exampleTr: w.exampleTr,
      notes: w.notes,
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      await updatePersonalVocabularyItem(editing.id, {
        ...editDraft,
        uncertain: false,
      });
      setEditing(null);
      await loadList();
      onChanged();
    } catch (err: any) {
      setError(err?.message || "Kelime güncellenemedi.");
    }
  };

  const handleToggleExclude = async (w: PersonalVocabItemDTO) => {
    try {
      await togglePersonalVocabExclude(w.id, {
        sourceId: sourceId !== "ALL" ? sourceId : undefined,
        excluded: !w.excluded,
      });
      await loadList();
      onChanged();
    } catch (err: any) {
      setError(err?.message || "Durum güncellenemedi.");
    }
  };

  const handleDelete = async (w: PersonalVocabItemDTO) => {
    try {
      await deletePersonalVocabItem(w.id, sourceId !== "ALL" ? sourceId : undefined);
      await loadList();
      onChanged();
    } catch (err: any) {
      setError(err?.message || "Kelime kaldırılamadı.");
    }
  };

  const handleOpenHistory = async (w: PersonalVocabItemDTO) => {
    try {
      const res = await fetchPersonalVocabHistory(w.id);
      setHistoryModal(res);
    } catch (err: any) {
      setError(err?.message || "Kelime geçmişi alınamadı.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-surface)] flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--kg-ink-muted)]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Almanca, Türkçe, örnek veya kategori ara…"
              className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
            />
          </div>

          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              setPage(1);
            }}
            className="min-h-[42px] px-3 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-xs font-bold text-[var(--kg-ink)]"
            aria-label="Kaynak filtresi"
          >
            <option value="ALL">Tüm Kaynaklar</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.totalActiveItems})
              </option>
            ))}
          </select>

          <select
            value={cefr}
            onChange={(e) => {
              setCefr(e.target.value);
              setPage(1);
            }}
            className="min-h-[42px] px-3 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-xs font-bold text-[var(--kg-ink)]"
            aria-label="CEFR filtresi"
          >
            <option value="ALL">Tüm CEFR</option>
            {PERSONAL_CEFR_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l === "UNKNOWN" ? "Belirsiz" : l}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="min-h-[42px] px-3 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-xs font-bold text-[var(--kg-ink)]"
            aria-label="Ustalık filtresi"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="unmastered">Henüz Öğrenilmemiş</option>
            <option value="not_learned">Yeni (0/5)</option>
            <option value="learning">Öğreniliyor (1–3/5)</option>
            <option value="almost_mastered">Ustalaşmaya Yakın (4/5)</option>
            <option value="mastered">Öğrenildi (5/5)</option>
            <option value="mistakes">Hatalı / Tekrar Gerekli</option>
            <option value="uncertain">Kontrol Bekleyen (Belirsiz)</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="min-h-[42px] px-3 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-xs font-bold text-[var(--kg-ink)]"
            aria-label="Sıralama"
          >
            <option value="updated">Son Güncellenen</option>
            <option value="alpha">Alfabetik (A–Z)</option>
            <option value="streak_asc">En Düşük Seri</option>
            <option value="streak_desc">En Yüksek Seri</option>
            <option value="mistakes">En Çok Hata Yapılan</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-4">
            <span className="font-bold text-[var(--kg-ink-muted)] tabular-nums">
              Toplam {total} kelime
            </span>
            <label className="inline-flex items-center gap-1.5 text-[var(--kg-ink-muted)] cursor-pointer font-semibold">
              <input
                type="checkbox"
                checked={includeExcluded}
                onChange={(e) => setIncludeExcluded(e.target.checked)}
                className="accent-[var(--kg-blue)]"
              />
              <span>Hariç tutulanları göster</span>
            </label>
          </div>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => onPracticeVocabIds([...selectedIds])}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3.5 rounded-xl bg-[var(--kg-blue)] text-white font-bold cursor-pointer"
            >
              <Play size={14} />
              <span>Seçili {selectedIds.size} Kelimeyle Pratik Yap</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-[var(--kg-red)] bg-[var(--kg-red-soft)] text-[var(--kg-red-ink)] text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Table / Responsive Card List */}
      {loading ? (
        <div className="p-8 text-center rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-surface)] text-sm text-[var(--kg-ink-muted)]">
          Kelimeler yükleniyor…
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-surface)] text-sm text-[var(--kg-ink-muted)]">
          Bu filtrelere uygun kelime bulunamadı.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((w) => {
            const isSelected = selectedIds.has(w.id);
            return (
              <div
                key={w.id}
                className={`p-3.5 rounded-xl border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  w.excluded
                    ? "opacity-60 border-dashed border-[var(--kg-border)] bg-[var(--kg-surface-soft)]"
                    : "border-[var(--kg-border)] bg-[var(--kg-surface)]"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      const next = new Set(selectedIds);
                      if (next.has(w.id)) next.delete(w.id);
                      else next.add(w.id);
                      setSelectedIds(next);
                    }}
                    aria-label={`${w.de} seç`}
                    className="mt-1 w-4 h-4 accent-[var(--kg-blue)] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => speakGerman(w.de)}
                        className="w-8 h-8 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] inline-flex items-center justify-center text-[var(--kg-blue)] hover:border-[var(--kg-blue)] cursor-pointer shrink-0"
                        title="Almanca dinle"
                      >
                        <Volume2 size={14} />
                      </button>
                      <span className="text-base font-extrabold text-[var(--kg-ink)] break-words">
                        {w.de}
                      </span>
                      <span className="text-xs font-extrabold px-1.5 py-0.5 rounded bg-[var(--kg-surface-soft)] border border-[var(--kg-border)] text-[var(--kg-ink-muted)]">
                        {w.cefrLevel === "UNKNOWN" ? "Belirsiz" : w.cefrLevel}
                      </span>
                      {w.uncertain && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--kg-gold-ink)]">
                          <AlertTriangle size={13} /> Kontrol önerilir
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-[var(--kg-ink-muted)] mt-1">
                      {w.tr}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--kg-ink-muted)] mt-1">
                      {w.partOfSpeech && <span>{w.partOfSpeech}</span>}
                      {w.plural && <span>Pl. {w.plural}</span>}
                      {w.preposition && (
                        <span>
                          {w.preposition}
                          {w.requiredCase ? ` + ${w.requiredCase}` : ""}
                        </span>
                      )}
                      {w.sourceTitles.length > 0 && (
                        <span>Kaynak: {w.sourceTitles.join(", ")}</span>
                      )}
                    </div>
                    {w.exampleDe && (
                      <div className="text-xs text-[var(--kg-ink-muted)] italic mt-1">
                        „{w.exampleDe}“ {w.exampleTr ? `— ${w.exampleTr}` : ""}
                      </div>
                    )}
                  </div>
                </div>

                {/* Mastery + Actions */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <MasteryPips
                      streak={w.mastery.consecutiveCorrect}
                      status={w.mastery.masteryStatus}
                      compact
                    />
                    <span className="text-[11px] font-semibold text-[var(--kg-ink-muted)] tabular-nums">
                      {w.mastery.totalCorrect}D · {w.mastery.totalIncorrect}Y
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(w)}
                      className="w-9 h-9 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] inline-flex items-center justify-center text-[var(--kg-ink)] hover:border-[var(--kg-blue)] cursor-pointer"
                      title="Düzenle"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleOpenHistory(w)}
                      className="w-9 h-9 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] inline-flex items-center justify-center text-[var(--kg-ink)] hover:border-[var(--kg-blue)] cursor-pointer"
                      title="Geçmiş"
                    >
                      <History size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleExclude(w)}
                      className="w-9 h-9 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] inline-flex items-center justify-center text-[var(--kg-ink)] hover:border-[var(--kg-gold)] cursor-pointer"
                      title={w.excluded ? "Tekrar dahil et" : "Çalışmadan hariç tut"}
                    >
                      {w.excluded ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(w)}
                      className="w-9 h-9 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] inline-flex items-center justify-center text-[var(--kg-red)] hover:border-[var(--kg-red)] cursor-pointer"
                      title="Kaynaktan kaldır"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="kg-btn"
          >
            Önceki
          </button>
          <span className="text-xs font-bold text-[var(--kg-ink-muted)] tabular-nums px-2">
            Sayfa {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="kg-btn"
          >
            Sonraki
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface)] p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[var(--kg-ink)]">Kelimeyi Düzenle</h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="w-9 h-9 rounded-lg border border-[var(--kg-border)] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-bold text-[var(--kg-ink-muted)]">
                Almanca
                <input
                  value={editDraft.de}
                  onChange={(e) => setEditDraft((d) => ({ ...d, de: e.target.value }))}
                  className="min-h-[40px] px-3 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-[var(--kg-ink-muted)]">
                Türkçe Anlam
                <input
                  value={editDraft.tr}
                  onChange={(e) => setEditDraft((d) => ({ ...d, tr: e.target.value }))}
                  className="min-h-[40px] px-3 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-[var(--kg-ink-muted)]">
                Artikel (der/die/das)
                <input
                  value={editDraft.article}
                  onChange={(e) => setEditDraft((d) => ({ ...d, article: e.target.value }))}
                  className="min-h-[40px] px-3 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-[var(--kg-ink-muted)]">
                Çoğul (Plural)
                <input
                  value={editDraft.plural}
                  onChange={(e) => setEditDraft((d) => ({ ...d, plural: e.target.value }))}
                  className="min-h-[40px] px-3 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-[var(--kg-ink-muted)]">
                CEFR Seviyesi
                <select
                  value={editDraft.cefrLevel}
                  onChange={(e) =>
                    setEditDraft((d) => ({ ...d, cefrLevel: e.target.value as PersonalCefrLevel }))
                  }
                  className="min-h-[40px] px-3 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
                >
                  {PERSONAL_CEFR_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l === "UNKNOWN" ? "Belirsiz" : l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-[var(--kg-ink-muted)]">
                Kategori
                <input
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                  className="min-h-[40px] px-3 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-bold text-[var(--kg-ink-muted)]">
              Örnek Cümle (Almanca)
              <input
                value={editDraft.exampleDe}
                onChange={(e) => setEditDraft((d) => ({ ...d, exampleDe: e.target.value }))}
                className="min-h-[40px] px-3 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-[var(--kg-ink-muted)]">
              Örnek Cümle (Türkçe)
              <input
                value={editDraft.exampleTr}
                onChange={(e) => setEditDraft((d) => ({ ...d, exampleTr: e.target.value }))}
                className="min-h-[40px] px-3 rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="kg-btn">
                İptal
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                className="kg-btn"
                style={{ background: "var(--kg-blue)", borderColor: "var(--kg-blue-dark)", color: "#fff" }}
              >
                <Check size={15} /> Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface)] p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold text-[var(--kg-ink)]">
                  {historyModal.item.de}
                </h3>
                <p className="text-sm text-[var(--kg-ink-muted)] m-0">
                  {historyModal.item.tr}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryModal(null)}
                className="w-9 h-9 rounded-lg border border-[var(--kg-border)] flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[var(--kg-surface-soft)] border border-[var(--kg-border)] flex flex-wrap items-center justify-between gap-3">
              <MasteryPips
                streak={historyModal.item.mastery.consecutiveCorrect}
                status={historyModal.item.mastery.masteryStatus}
              />
              <div className="text-xs font-bold text-[var(--kg-ink-muted)] tabular-nums">
                Toplam Doğru: {historyModal.item.mastery.totalCorrect} · Yanlış:{" "}
                {historyModal.item.mastery.totalIncorrect}
              </div>
            </div>

            {historyModal.attempts.length === 0 ? (
              <p className="text-sm text-[var(--kg-ink-muted)] text-center py-4 m-0">
                Bu kelime için henüz alıştırma geçmişi bulunmuyor.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {historyModal.attempts.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] flex flex-col gap-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-extrabold ${
                          a.isCorrect ? "text-[var(--kg-green-ink)]" : "text-[var(--kg-red-ink)]"
                        }`}
                      >
                        {a.isCorrect ? "Doğru" : "Yanlış"} · {a.mode}
                        {a.selfAssessed ? " (Öz Değerlendirme)" : ""}
                      </span>
                      <span className="text-[var(--kg-ink-muted)] tabular-nums">
                        Seri: {a.streakBefore}/5 → {a.streakAfter}/5
                      </span>
                    </div>
                    <div className="text-[var(--kg-ink)]">
                      Yanıtın: <strong>{a.userAnswer || "—"}</strong>
                    </div>
                    <div className="text-[var(--kg-ink-muted)]">
                      {new Date(a.createdAt).toLocaleString("tr-TR")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
