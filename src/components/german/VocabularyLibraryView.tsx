import { useEffect, useState } from "react";
import { CheckSquare, Play, Search, Square, Volume2 } from "lucide-react";
import { studyLevels, type CefrLevel } from "../../shared/germanActivities";
import { fetchVocabulary, germanRequest, speakGerman } from "./api";
import { CefrTag, MasteryPips } from "./MasteryPips";
import type { VocabItem, VocabularyResponse } from "./types";

export function VocabularyLibraryView({
  isAdmin,
  initialLevel = "ALL",
  onPracticeSelected,
  onOverviewChanged,
}: {
  isAdmin: boolean;
  initialLevel?: string;
  onPracticeSelected: (wordIds: string[], levels: CefrLevel[]) => void;
  onOverviewChanged: () => void;
}) {
  const [level, setLevel] = useState<string>(initialLevel);
  const [status, setStatus] = useState<string>("all");
  const [topic, setTopic] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [mistakesOnly, setMistakesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<VocabularyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedWordLevels, setSelectedWordLevels] = useState<Record<string, CefrLevel>>({});

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchVocabulary({
        level,
        status,
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
  }, [level, status, topic, q, mistakesOnly, page]);

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

  return (
    <div className="kg-container">
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kg-section-head">
          <div>
            <h1 className="kg-section-title" style={{ fontSize: 22 }}>
              Kelime Kütüphanesi
            </h1>
            <p className="kg-section-sub">
              Seviye, konu ve 5/5 ustalık durumuna göre filtrele, dinle veya seçtiklerini çalış.
            </p>
          </div>
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
            aria-label="Konu filtresi"
            className="kg-select"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tüm Konular</option>
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
                Seçimi Temizle
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
                          {item.pos
                            ? ` · ${{
                                noun: "İsim",
                                verb: "Fiil",
                                adj: "Sıfat",
                                adv: "Zarf",
                                conj: "Bağlaç",
                                phrase: "İfade",
                              }[item.pos] ?? item.pos}`
                            : ""}
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

                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="kg-audio-btn"
                        aria-label={`${item.de} telaffuzunu dinle`}
                        onClick={() => void speakGerman(item.de)}
                      >
                        <Volume2 size={17} />
                      </button>
                      {isClassified && (
                        <button
                          type="button"
                          className="kg-audio-btn"
                          aria-label={isSelected ? `${item.de} seçimini kaldır` : `${item.de} kelimesini çalışmak için seç`}
                          aria-pressed={isSelected}
                          onClick={() => toggleSelect(item)}
                        >
                          {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="kg-vocab-tr">{item.tr}</div>

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
                    {item.mastery.totalIncorrect > 0 && (
                      <span className="kg-vocab-meta tabular-nums">
                        Hata: {item.mastery.totalIncorrect}
                      </span>
                    )}
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
    </div>
  );
}
