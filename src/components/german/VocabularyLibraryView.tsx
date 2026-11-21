import { useEffect, useState } from "react";
import {
  BookmarkPlus,
  Check,
  CheckSquare,
  Expand,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { studyLevels, type CefrLevel } from "../../shared/germanActivities";
import {
  fetchVocabulary,
  fetchVocabularyCard,
  germanRequest,
  requestAnotherWordExample,
  suggestWordPronunciation,
} from "./api";
import { CefrTag, MasteryPips } from "./MasteryPips";
import {
  GermanLevelAudioPackCard,
  GermanSpeakButtons,
  PronunciationGuideBox,
} from "./PronunciationGuideBox";
import type { VocabItem, VocabularyCardDetail, VocabularyResponse } from "./types";

const POS_LABELS: Record<string, string> = {
  noun: "İsim",
  verb: "Fiil",
  adj: "Sıfat",
  adv: "Zarf",
  conj: "Bağlaç",
  phrase: "İfade",
};

export function VocabularyLibraryView({
  isAdmin,
  initialLevel = "ALL",
  showTurkishPronunciation = true,
  onTogglePronunciation,
  onPracticeSelected,
  onOverviewChanged,
}: {
  isAdmin: boolean;
  initialLevel?: string;
  showTurkishPronunciation?: boolean;
  onTogglePronunciation?: (next: boolean) => void;
  onPracticeSelected: (wordIds: string[], levels: CefrLevel[]) => void;
  onOverviewChanged: () => void;
}) {
  const [level, setLevel] = useState<string>(initialLevel);
  const [status, setStatus] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [topic, setTopic] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [mistakesOnly, setMistakesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<VocabularyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedWordLevels, setSelectedWordLevels] = useState<Record<string, CefrLevel>>({});

  // Detail card modal state
  const [activeCardItem, setActiveCardItem] = useState<VocabItem | null>(null);
  const [cardDetail, setCardDetail] = useState<VocabularyCardDetail | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardBusyAction, setCardBusyAction] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchVocabulary({
        level,
        status,
        categoryId,
        topic,
        q,
        mistakesOnly,
        page,
        limit: 24,
      });
      setRes(data);
    } catch (e: any) {
      setError(e?.message || "Kelimeler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, 150);
    return () => clearTimeout(t);
  }, [level, status, categoryId, topic, q, mistakesOnly, page]);

  const toggleSelect = (item: VocabItem) => {
    if (!studyLevels.includes(item.level as CefrLevel)) return;
    setSelectedIds((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id],
    );
    setSelectedWordLevels((prev) => ({
      ...prev,
      [item.id]: item.level as CefrLevel,
    }));
  };

  const handleClassify = async (wordId: string, nextLevel: string) => {
    try {
      await germanRequest("/admin/classify", { wordId, level: nextLevel });
      await load();
      onOverviewChanged();
    } catch (e: any) {
      setError(e?.message || "Seviye güncellenemedi.");
    }
  };

  const openCard = async (item: VocabItem) => {
    setActiveCardItem(item);
    setCardDetail(null);
    setCardLoading(true);
    try {
      const detail = await fetchVocabularyCard(item.id);
      setCardDetail(detail);
    } catch {
      setCardDetail({
        id: item.id,
        de: item.de,
        tr: item.tr,
        level: item.level,
        pos: item.pos,
        article: item.article,
        plural: item.plural,
        topic: item.topic,
        grammar: item.grammar ?? "",
        exampleDe: item.exampleDe,
        exampleTr: item.exampleTr,
        pronunciation: item.pronunciation ?? {
          ipa: "",
          turkishApprox: item.de,
          syllables: [item.de],
          stressSyllable: 0,
          notesTr: "Okunuş rehberi yüklenemedi.",
          source: "estimated",
          verified: false,
        },
        enrichedByAI: false,
      });
    } finally {
      setCardLoading(false);
    }
  };

  const handleAnotherExample = async () => {
    if (!activeCardItem || cardBusyAction) return;
    setCardBusyAction(true);
    try {
      const updated = await requestAnotherWordExample(activeCardItem.id);
      setCardDetail(updated);
    } catch (e: any) {
      setError(e?.message || "Yeni örnek üretilemedi.");
    } finally {
      setCardBusyAction(false);
    }
  };

  const handleSuggestPronunciation = async () => {
    if (!activeCardItem || cardBusyAction) return;
    setCardBusyAction(true);
    try {
      const nextPron = await suggestWordPronunciation(activeCardItem.id);
      setCardDetail((prev) => (prev ? { ...prev, pronunciation: nextPron } : prev));
    } catch {
    } finally {
      setCardBusyAction(false);
    }
  };

  return (
    <div className="kg-container">
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kg-section-head">
          <div>
            <h1 className="kg-section-title" style={{ fontSize: 22 }}>
              Kelime Kütüphanesi
            </h1>
            <p className="kg-section-sub">
              Seviye, konu ve 5/5 ustalık durumuna göre filtrele, okunuşu gör, dinle veya seçtiklerini çalış.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {onTogglePronunciation && (
              <label className="kg-toggle-chip">
                <input
                  type="checkbox"
                  checked={showTurkishPronunciation}
                  onChange={(e) => onTogglePronunciation(e.target.checked)}
                />
                <span>Türkçe okunuşları göster</span>
              </label>
            )}
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="kg-btn kg-btn-primary kg-btn-sm"
                onClick={() => {
                  const lvls = [
                    ...new Set(
                      selectedIds
                        .map((id) => selectedWordLevels[id])
                        .filter((l): l is CefrLevel => Boolean(l)),
                    ),
                  ];
                  onPracticeSelected(selectedIds, lvls.length ? lvls : ["A1"]);
                }}
              >
                <Play size={15} /> Seçilileri Çalış ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        {/* CEFR Level Filter Pills */}
        <div className="kg-level-selector" role="group" aria-label="Kelime seviyesi filtresi">
          {[
            ["ALL", "Tümü"],
            ...studyLevels.map((l) => [l, l]),
            ...(isAdmin ? [["UNCLASSIFIED", "Sınıflandırılmamış"]] : []),
          ].map(([code, label]) => (
            <button
              key={code}
              type="button"
              aria-pressed={level === code}
              className={`kg-level-chip ${level === code ? "is-active" : ""}`}
              onClick={() => {
                setLevel(code);
                setCategoryId("all");
                setTopic("all");
                setPage(1);
              }}
            >
              <span className="kg-level-chip-name">{label}</span>
            </button>
          ))}
        </div>

        {/* Search & Secondary Filters */}
        <div className="kg-filters-bar">
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search
              size={16}
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--kg-ink-muted)",
              }}
            />
            <input
              type="search"
              aria-label="Kelime ara"
              className="kg-input"
              style={{ width: "100%", paddingLeft: 36 }}
              placeholder="Almanca, Türkçe veya örnek cümle ara…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <select
            aria-label="Ustalık durumu"
            className="kg-select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tüm Durumlar</option>
            <option value="not_learned">Öğrenilmedi (0/5)</option>
            <option value="learning">Öğreniliyor (1–3/5)</option>
            <option value="almost_mastered">Ustalaşmaya Yakın (4/5)</option>
            <option value="mastered">Tam Öğrenildi (5/5)</option>
          </select>

          <select
            aria-label="Konu kategorisi filtresi"
            className="kg-select"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setTopic("all");
              setPage(1);
            }}
          >
            <option value="all">Tüm Ana Kategoriler</option>
            {(res?.categories ?? []).map((c: any) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.titleTr} ({c.count})
              </option>
            ))}
          </select>

          <select
            aria-label="Alt konu filtresi"
            className="kg-select"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tüm Alt Konular</option>
            {(res?.topics ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            type="button"
            aria-pressed={mistakesOnly}
            className={`kg-btn kg-btn-sm ${mistakesOnly ? "kg-btn-danger" : ""}`}
            onClick={() => {
              setMistakesOnly((m) => !m);
              setPage(1);
            }}
          >
            Sadece Hatalılar
          </button>
        </div>

        <GermanLevelAudioPackCard
          level={studyLevels.includes(level as CefrLevel) ? (level as CefrLevel) : "A1"}
          compact
        />
      </div>

      {error && (
        <div className="kg-alert" role="alert">
          <span>{error}</span>
        </div>
      )}

      {loading && !res ? (
        <div className="kg-card" role="status">
          Kelimeler yükleniyor…
        </div>
      ) : res && res.items.length > 0 ? (
        <>
          <div className="kg-section-head">
            <span className="kg-section-sub tabular-nums">
              {res.total} benzersiz kelime gösteriliyor
            </span>
            {selectedIds.length > 0 && (
              <button
                type="button"
                className="kg-btn kg-btn-ghost kg-btn-sm"
                onClick={() => setSelectedIds([])}
              >
                Seçimi Temizle ({selectedIds.length})
              </button>
            )}
          </div>

          <div className="kg-vocab-grid">
            {res.items.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isClassified = studyLevels.includes(item.level as CefrLevel);
              return (
                <article
                  key={item.id}
                  className={`kg-vocab-card ${isSelected ? "is-selected" : ""}`}
                >
                  <div className="kg-vocab-top">
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <CefrTag level={item.level} />
                        <span className="kg-vocab-meta">
                          {item.topic}
                          {item.pos ? ` · ${POS_LABELS[item.pos] ?? item.pos}` : ""}
                        </span>
                      </div>
                      <h3 className="kg-vocab-word" lang="de" style={{ marginTop: 6 }}>
                        {item.de}
                      </h3>
                      {item.plural && (
                        <span className="kg-vocab-meta" lang="de">
                          Çoğul: {item.plural}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                      <GermanSpeakButtons text={item.de} compact />
                      {isClassified && (
                        <button
                          type="button"
                          className="kg-audio-btn"
                          aria-label={isSelected ? `${item.de} seçimini kaldır` : `${item.de} tekrar listesine ekle`}
                          aria-pressed={isSelected}
                          onClick={() => toggleSelect(item)}
                        >
                          {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="kg-vocab-tr">{item.tr}</div>

                  {item.pronunciation && (
                    <PronunciationGuideBox
                      pronunciation={item.pronunciation}
                      showTurkishPronunciation={showTurkishPronunciation}
                      compact
                    />
                  )}

                  {item.exampleDe && (
                    <div className="kg-vocab-example">
                      <strong lang="de">{item.exampleDe}</strong>
                      {item.exampleTr && <span>{item.exampleTr}</span>}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <MasteryPips
                      streak={item.mastery.consecutiveCorrect}
                      status={item.mastery.masteryStatus}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {item.mastery.totalIncorrect > 0 && (
                        <span className="kg-vocab-meta tabular-nums">
                          Hata: {item.mastery.totalIncorrect}
                        </span>
                      )}
                      <button
                        type="button"
                        className="kg-btn kg-btn-sm"
                        style={{ minHeight: 32, padding: "4px 10px", fontSize: 12 }}
                        onClick={() => void openCard(item)}
                      >
                        <Expand size={13} /> Kartı Aç
                      </button>
                    </div>
                  </div>

                  {isAdmin && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span className="kg-vocab-meta">Seviye düzelt:</span>
                      <select
                        aria-label={`${item.de} CEFR seviyesi`}
                        className="kg-select"
                        style={{ minHeight: 34, padding: "4px 8px", fontSize: 12 }}
                        value={item.level}
                        onChange={(e) => void handleClassify(item.id, e.target.value)}
                      >
                        {studyLevels.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                        <option value="UNCLASSIFIED">UNCLASSIFIED</option>
                      </select>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {res.totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <button
                type="button"
                disabled={page <= 1}
                className="kg-btn kg-btn-sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki
              </button>
              <span className="tabular-nums" style={{ fontSize: 13.5, fontWeight: 800 }}>
                Sayfa {res.page} / {res.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= res.totalPages}
                className="kg-btn kg-btn-sm"
                onClick={() => setPage((p) => Math.min(res.totalPages, p + 1))}
              >
                Sonraki
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="kg-card">
          <strong>Eşleşen kelime bulunamadı.</strong>
          <p className="kg-section-sub">
            Arama terimini temizleyebilir veya farklı bir seviye seçebilirsin.
          </p>
        </div>
      )}

      {/* Word Study Detail Card Modal */}
      {activeCardItem && (
        <div
          className="kg-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kg-vocab-modal-title"
        >
          <div className="kg-modal-card kg-vocab-modal">
            <div className="kg-section-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <CefrTag level={activeCardItem.level} />
                <span className="kg-vocab-meta">
                  {activeCardItem.topic}
                  {activeCardItem.pos ? ` · ${POS_LABELS[activeCardItem.pos] ?? activeCardItem.pos}` : ""}
                </span>
              </div>
              <button
                type="button"
                className="kg-btn kg-btn-ghost kg-btn-sm"
                aria-label="Kartı kapat"
                onClick={() => setActiveCardItem(null)}
              >
                <X size={17} />
              </button>
            </div>

            <div>
              <h2 id="kg-vocab-modal-title" lang="de" style={{ fontSize: 24, fontWeight: 800 }}>
                {activeCardItem.de}
              </h2>
              <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                {activeCardItem.tr}
              </div>
              {(activeCardItem.article || activeCardItem.plural) && (
                <div className="kg-vocab-meta" style={{ marginTop: 4 }} lang="de">
                  {activeCardItem.article ? `Artikel: ${activeCardItem.article}` : ""}
                  {activeCardItem.article && activeCardItem.plural ? " · " : ""}
                  {activeCardItem.plural ? `Çoğul: ${activeCardItem.plural}` : ""}
                </div>
              )}
            </div>

            <GermanSpeakButtons text={activeCardItem.de} />

            {cardLoading ? (
              <div className="kg-section-sub" role="status">
                Kelime kartı detayları yükleniyor…
              </div>
            ) : cardDetail ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <PronunciationGuideBox
                  pronunciation={cardDetail.pronunciation}
                  showTurkishPronunciation={true}
                />

                {!cardDetail.pronunciation.verified && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span className="kg-vocab-meta">
                      Bu özel/ek kelime için henüz doğrulanmış IPA kaydı bulunmuyor.
                    </span>
                    <button
                      type="button"
                      disabled={cardBusyAction}
                      className="kg-btn kg-btn-sm"
                      onClick={() => void handleSuggestPronunciation()}
                    >
                      <Sparkles size={13} /> AI Okunuş Öner
                    </button>
                  </div>
                )}

                {cardDetail.exampleDe && (
                  <div className="kg-vocab-example">
                    <div className="kg-section-head">
                      <span className="kg-vocab-meta">Ana Örnek Cümle</span>
                      <GermanSpeakButtons text={cardDetail.exampleDe} compact />
                    </div>
                    <strong lang="de" style={{ marginTop: 4 }}>{cardDetail.exampleDe}</strong>
                    {cardDetail.exampleTr && <span>{cardDetail.exampleTr}</span>}
                  </div>
                )}

                {cardDetail.extraExample && (
                  <div className="kg-vocab-example">
                    <div className="kg-section-head">
                      <span className="kg-badge-soft">
                        <Sparkles size={12} /> Ek Örnek
                      </span>
                      <GermanSpeakButtons text={cardDetail.extraExample.de} compact />
                    </div>
                    <strong lang="de" style={{ marginTop: 4 }}>{cardDetail.extraExample.de}</strong>
                    <span>{cardDetail.extraExample.tr}</span>
                  </div>
                )}

                {(cardDetail.grammar || cardDetail.grammarNoteTr || cardDetail.conjugationSummaryTr) && (
                  <div className="kg-ai-list-block">
                    <strong>Dilbilgisi ve Çekim Notu</strong>
                    {cardDetail.grammar && <p style={{ margin: "4px 0 0" }}>{cardDetail.grammar}</p>}
                    {cardDetail.conjugationSummaryTr && (
                      <p style={{ margin: "4px 0 0" }}>{cardDetail.conjugationSummaryTr}</p>
                    )}
                    {cardDetail.grammarNoteTr && (
                      <p style={{ margin: "4px 0 0" }}>{cardDetail.grammarNoteTr}</p>
                    )}
                    {cardDetail.usageTipTr && (
                      <p style={{ margin: "4px 0 0" }}>
                        <strong>Kullanım İpucu:</strong> {cardDetail.usageTipTr}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {studyLevels.includes(activeCardItem.level as CefrLevel) && (
                <button
                  type="button"
                  className="kg-btn kg-btn-primary kg-btn-sm"
                  onClick={() => {
                    const lvl = activeCardItem.level as CefrLevel;
                    const wid = activeCardItem.id;
                    setActiveCardItem(null);
                    onPracticeSelected([wid], [lvl]);
                  }}
                >
                  <Play size={14} /> Pratik Yap
                </button>
              )}

              <button
                type="button"
                disabled={cardBusyAction || cardLoading}
                className="kg-btn kg-btn-blue kg-btn-sm"
                onClick={() => void handleAnotherExample()}
              >
                <RefreshCw size={14} /> {cardBusyAction ? "Hazırlanıyor…" : "Başka Örnek Göster"}
              </button>

              {studyLevels.includes(activeCardItem.level as CefrLevel) && (
                <button
                  type="button"
                  className="kg-btn kg-btn-sm"
                  onClick={() => toggleSelect(activeCardItem)}
                >
                  {selectedIds.includes(activeCardItem.id) ? (
                    <>
                      <Check size={14} /> Tekrar Listesinde
                    </>
                  ) : (
                    <>
                      <BookmarkPlus size={14} /> Tekrar Listesine Ekle
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
