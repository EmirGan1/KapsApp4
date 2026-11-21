import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Layers,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { CEFR_META, type CefrLevel } from "../../shared/germanActivities";
import { CefrLevelSelector } from "./CefrLevelSelector";
import { CefrTag } from "./MasteryPips";
import { GermanLevelAudioPackCard } from "./PronunciationGuideBox";
import type {
  CurriculumCategoryNode,
  CurriculumUnitNode,
  OverviewResponse,
} from "./types";

type StatusFilter = "all" | "in_progress" | "completed" | "not_started";

export function HomeLearnView({
  overview,
  selectedLevels,
  onChangeLevels,
  onStartSession,
  onOpenProgress,
  busy,
}: {
  overview: OverviewResponse;
  selectedLevels: CefrLevel[];
  onChangeLevels: (next: CefrLevel[]) => void;
  onStartSession: (opts: {
    activity?: string;
    topic?: string;
    categoryId?: string;
    unitId?: string;
    levels?: CefrLevel[];
    reviewMode?: boolean;
  }) => void;
  onOpenProgress: () => void;
  busy: boolean;
}) {
  const primaryLevel: CefrLevel = selectedLevels[0] ?? "A1";
  const [pathLevel, setPathLevel] = useState<CefrLevel>(primaryLevel);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const activePathLevel = selectedLevels.includes(pathLevel) ? pathLevel : primaryLevel;

  useEffect(() => {
    setSelectedCategoryId(null);
  }, [activePathLevel]);

  const activeLevelInfo = overview.progressByLevel.find(
    (p) => p.level === activePathLevel,
  );

  const levelCategories: CurriculumCategoryNode[] = useMemo(() => {
    return overview.curriculumHierarchy?.[activePathLevel] ?? [];
  }, [overview.curriculumHierarchy, activePathLevel]);

  const activeCategory: CurriculumCategoryNode | null = useMemo(() => {
    if (!selectedCategoryId) return null;
    return levelCategories.find((c) => c.id === selectedCategoryId) ?? null;
  }, [levelCategories, selectedCategoryId]);

  const recommendedUnit: {
    category: CurriculumCategoryNode;
    unit: CurriculumUnitNode;
  } | null = useMemo(() => {
    for (const cat of levelCategories) {
      for (const u of cat.units) {
        if (u.status === "in_progress") return { category: cat, unit: u };
      }
    }
    for (const cat of levelCategories) {
      for (const u of cat.units) {
        if (u.status === "not_started") return { category: cat, unit: u };
      }
    }
    if (levelCategories[0]?.units[0]) {
      return { category: levelCategories[0], unit: levelCategories[0].units[0] };
    }
    return null;
  }, [levelCategories]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase("tr");
    return levelCategories.filter((cat) => {
      if (statusFilter !== "all" && cat.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${cat.titleTr} ${cat.titleDe} ${cat.descriptionTr}`.toLocaleLowerCase("tr");
      return hay.includes(q);
    });
  }, [levelCategories, searchQuery, statusFilter]);

  const filteredUnits = useMemo(() => {
    if (!activeCategory) return [];
    const q = searchQuery.trim().toLocaleLowerCase("tr");
    return activeCategory.units.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${u.titleTr} ${u.titleDe} ${u.objectiveTr}`.toLocaleLowerCase("tr");
      return hay.includes(q);
    });
  }, [activeCategory, searchQuery, statusFilter]);

  const dailyPct = Math.min(
    100,
    Math.round(
      (overview.stats.todayXp / Math.max(10, overview.stats.dailyGoalXp)) * 100,
    ),
  );

  const selectedMastered = overview.progressByLevel
    .filter((p) => selectedLevels.includes(p.level))
    .reduce((s, p) => s + p.mastered, 0);
  const selectedTotal = overview.progressByLevel
    .filter((p) => selectedLevels.includes(p.level))
    .reduce((s, p) => s + p.total, 0);
  const selectedPct =
    selectedTotal > 0 ? Math.round((selectedMastered / selectedTotal) * 1000) / 10 : 0;

  return (
    <div className="kg-container">
      {/* Hero + Real Daily Stats */}
      <div className="kg-hero-grid">
        <section className="kg-learn-hero">
          <div className="kg-learn-hero-top">
            <div>
              <span className="kg-learn-eyebrow">
                Seçili Seviye · {selectedLevels.join(" + ")}
              </span>
              <h1>
                {selectedTotal > 0
                  ? `${CEFR_META[primaryLevel].trName} yolculuğuna devam et`
                  : "Almanca öğrenmeye başla"}
              </h1>
              <p>
                Konu kategorilerine ayrılmış yapılandırılmış ünitelerle ilerle. Her kelimeyi{" "}
                <strong>5 kez üst üste</strong> doğru yanıtlayarak kalıcı olarak ustalaş.
              </p>
            </div>
          </div>

          <div className="kg-learn-hero-progress">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 800 }}>
              <span>Seçili Seviye Ustalığı</span>
              <span className="tabular-nums">
                {selectedMastered} / {selectedTotal} kelime (%{selectedPct})
              </span>
            </div>
            <div className="kg-progress-track" style={{ background: "rgba(0,0,0,0.18)", borderColor: "transparent" }}>
              <div
                className="kg-progress-fill"
                style={{ width: `${selectedPct}%`, background: "#ffffff" }}
              />
            </div>
          </div>

          <div className="kg-learn-hero-actions">
            {recommendedUnit ? (
              <button
                type="button"
                disabled={busy}
                className="kg-btn kg-hero-cta"
                onClick={() =>
                  onStartSession({
                    activity: "mixed",
                    levels: [activePathLevel],
                    categoryId: recommendedUnit.category.id,
                    unitId: recommendedUnit.unit.id,
                  })
                }
              >
                <Play size={17} /> {recommendedUnit.category.titleTr} · Ünite{" "}
                {recommendedUnit.unit.unitNumber} Devam Et
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="kg-btn kg-hero-cta"
                onClick={() => onStartSession({ activity: "mixed", levels: selectedLevels })}
              >
                <Play size={17} /> Öğrenmeye Devam Et
              </button>
            )}

            <button
              type="button"
              disabled={busy}
              className="kg-btn kg-hero-secondary"
              onClick={() =>
                onStartSession({
                  activity: "satzbau",
                  levels: selectedLevels,
                })
              }
            >
              <Wand2 size={16} /> Cümle Kurma (Satzbau)
            </button>

            <button
              type="button"
              className="kg-btn kg-hero-secondary"
              onClick={onOpenProgress}
            >
              Tüm Seviyeler (A1–C1)
            </button>
          </div>
        </section>

        {/* Real Stats Grid */}
        <div className="kg-stats-column">
          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">
              <Target size={15} /> Günlük Hedef
            </span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.stats.todayXp} / {overview.stats.dailyGoalXp} XP
            </span>
            <div className="kg-progress-track" style={{ height: 8 }}>
              <div className="kg-progress-fill" style={{ width: `${dailyPct}%` }} />
            </div>
          </div>

          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">
              <Flame size={15} style={{ color: "#ea580c" }} /> Günlük Seri
            </span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.stats.currentStreak} gün
            </span>
            <span className="kg-mini-stat-sub">
              En uzun: {overview.stats.longestStreak} gün
            </span>
          </div>

          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">
              <Check size={15} style={{ color: "var(--kg-green)" }} /> Bugün Tamamlanan
            </span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.stats.todayWordsMastered} kelime
            </span>
            <span className="kg-mini-stat-sub">
              {overview.stats.todayExercises} oturum tamamlandı
            </span>
          </div>

          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">
              <Sparkles size={15} style={{ color: "var(--kg-gold-dark)" }} /> Genel Doğruluk
            </span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.overall.accuracy !== null ? `%${overview.overall.accuracy}` : "—"}
            </span>
            <span className="kg-mini-stat-sub">
              Toplam {overview.overall.totalMastered} kalıcı kelime
            </span>
          </div>
        </div>
      </div>

      {/* Active Study Level Switcher */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="kg-section-head">
          <div>
            <h2 className="kg-section-title">Çalışma Seviyen</h2>
            <p className="kg-section-sub">
              Sadece seçtiğin CEFR seviyesindeki konu kategorileri, üniteler ve dilbilgisi sorulur.
            </p>
          </div>
          <span className="kg-section-sub tabular-nums">
            Toplam {overview.overall.totalValidated} doğrulanmış kelime
          </span>
        </div>

        <CefrLevelSelector
          selected={selectedLevels}
          onChange={(next) => {
            onChangeLevels(next);
            if (!next.includes(pathLevel)) setPathLevel(next[0]);
          }}
          progressByLevel={overview.progressByLevel}
        />

        <GermanLevelAudioPackCard level={activePathLevel} compact />
      </div>

      {/* Quick Practice Actions */}
      <div className="kg-quick-grid">
        <button
          type="button"
          disabled={busy}
          className="kg-quick-btn"
          onClick={() => onStartSession({ activity: "choice", levels: selectedLevels })}
        >
          <span className="kg-quick-icon">
            <BookOpen size={18} />
          </span>
          <div>
            <strong>Kelime Pratiği</strong>
            <span>Bağlam duyarlı çoktan seçmeli sorular</span>
          </div>
        </button>

        <button
          type="button"
          disabled={busy}
          className="kg-quick-btn"
          onClick={() =>
            onStartSession({ activity: "satzbau", levels: selectedLevels })
          }
        >
          <span className="kg-quick-icon" style={{ color: "var(--kg-green-ink)" }}>
            <Layers size={18} />
          </span>
          <div>
            <strong>Cümle Kurma — Satzbau</strong>
            <span>5 modlu AI destekli Almanca cümle inşası</span>
          </div>
        </button>

        <button
          type="button"
          disabled={busy || overview.overall.totalMistakeWords === 0}
          className="kg-quick-btn"
          onClick={() =>
            onStartSession({ activity: "mistake_review", levels: selectedLevels })
          }
        >
          <span className="kg-quick-icon" style={{ color: "var(--kg-red-ink)" }}>
            <RotateCcw size={18} />
          </span>
          <div>
            <strong>Hataları Tekrarla</strong>
            <span>
              {overview.overall.totalMistakeWords > 0
                ? `${overview.overall.totalMistakeWords} kelime tekrar bekliyor`
                : "Henüz hatalı kelime yok"}
            </span>
          </div>
        </button>

        <button
          type="button"
          disabled={busy || overview.overall.totalMastered === 0}
          className="kg-quick-btn"
          onClick={() =>
            onStartSession({
              activity: "mixed",
              levels: selectedLevels,
              reviewMode: true,
            })
          }
        >
          <span className="kg-quick-icon" style={{ color: "var(--kg-gold-ink)" }}>
            <Sparkles size={18} />
          </span>
          <div>
            <strong>Öğrenilenleri Pekiştir</strong>
            <span>
              {overview.overall.totalMastered > 0
                ? "5/5 ustalaşılanlar korunur, silinmez"
                : "Önce 5/5 kelime tamamla"}
            </span>
          </div>
        </button>
      </div>

      {/* Hierarchical Curriculum Explorer: CEFR Level -> Topic Categories -> Learning Units */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="kg-section-head">
          <div>
            {activeCategory ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="kg-btn kg-btn-sm"
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setSearchQuery("");
                  }}
                >
                  <ArrowLeft size={15} /> Tüm Kategoriler
                </button>
                <h2 className="kg-section-title" style={{ margin: 0 }}>
                  {activeCategory.titleTr}{" "}
                  <span style={{ fontWeight: 600, opacity: 0.75, fontSize: 15 }}>
                    ({activeCategory.titleDe})
                  </span>
                </h2>
              </div>
            ) : (
              <h2 className="kg-section-title">
                Müfredat Kategorileri · {activePathLevel} ({CEFR_META[activePathLevel].trName})
              </h2>
            )}
            <p className="kg-section-sub" style={{ marginTop: 4 }}>
              {activeCategory
                ? `${activeCategory.descriptionTr} • ${activeCategory.totalUnits} yapılandırılmış ünite (${activeCategory.totalWords} kelime)`
                : `${levelCategories.length} konu kategorisi • ${
                    activeLevelInfo?.totalUnits ??
                    levelCategories.reduce((s, c) => s + c.totalUnits, 0)
                  } öğrenme ünitesi • Dağınık tek kelimelik listeler yerine dengeli ders yapısı`}
            </p>
          </div>

          {selectedLevels.length > 1 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {selectedLevels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  className={`kg-btn kg-btn-sm ${activePathLevel === lvl ? "kg-btn-blue" : ""}`}
                  onClick={() => setPathLevel(lvl)}
                >
                  {lvl}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeLevelInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CefrTag level={activeLevelInfo.level} />
            <div className="kg-progress-track" style={{ flex: 1 }}>
              <div
                className="kg-progress-fill"
                style={{
                  width: `${activeCategory ? activeCategory.percent : activeLevelInfo.percent}%`,
                  background: activeCategory ? activeCategory.accentColor : activeLevelInfo.accent,
                }}
              />
            </div>
            <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 800 }}>
              {activeCategory
                ? `${activeCategory.masteredWords}/${activeCategory.totalWords} kelime (%${activeCategory.percent})`
                : `${activeLevelInfo.mastered}/${activeLevelInfo.total} kelime (%${activeLevelInfo.percent})`}
            </span>
          </div>
        )}

        {/* Search & Completion Status Filter Bar */}
        <div className="kg-curriculum-toolbar">
          <div className="kg-search-box">
            <Search size={15} />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeCategory
                  ? "Ünite veya kazanım ara..."
                  : "Konu kategorisi ara (örn. Yeme & İçme, Seyahat, İş)..."
              }
              aria-label="Müfredat içinde ara"
            />
          </div>

          <div className="kg-filter-pills" role="tablist" aria-label="Tamamlanma durumu filtresi">
            {(
              [
                ["all", "Tümü"],
                ["in_progress", "Devam Edenler"],
                ["completed", "Tamamlananlar"],
                ["not_started", "Başlanmamış"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`kg-btn kg-btn-sm ${statusFilter === id ? "kg-btn-blue" : ""}`}
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Grid or Unit Detail List */}
        {!activeCategory ? (
          filteredCategories.length > 0 ? (
            <div className="kg-category-grid">
              {filteredCategories.map((cat) => {
                const statusLabel =
                  cat.status === "completed"
                    ? "Tamamlandı"
                    : cat.status === "in_progress"
                      ? "Devam Ediyor"
                      : "Başlamaya Hazır";
                return (
                  <div
                    key={cat.id}
                    className={`kg-category-card is-${cat.status}`}
                    style={{ "--kg-cat-accent": cat.accentColor } as React.CSSProperties}
                  >
                    <div className="kg-category-card-top">
                      <span
                        className="kg-category-badge"
                        style={{ background: `${cat.accentColor}15`, color: cat.accentColor }}
                      >
                        Kategori {cat.order} · {cat.totalUnits} Ünite
                      </span>
                      <span className={`kg-status-chip is-${cat.status}`}>
                        {cat.status === "completed" && <CheckCircle2 size={13} />}
                        {statusLabel}
                      </span>
                    </div>

                    <div
                      className="kg-category-card-main"
                      role="button"
                      tabIndex={0}
                      onClick={() => { setSelectedCategoryId(cat.id); setSearchQuery(""); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedCategoryId(cat.id);
                          setSearchQuery("");
                        }
                      }}
                    >
                      <h3 className="kg-category-title">{cat.titleTr}</h3>
                      <span className="kg-category-subtitle-de">{cat.titleDe}</span>
                      <p className="kg-category-desc">{cat.descriptionTr}</p>
                    </div>

                    <div className="kg-category-progress">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <span className="tabular-nums">
                          {cat.masteredWords} / {cat.totalWords} kelime
                        </span>
                        <span className="tabular-nums">
                          {cat.completedUnits}/{cat.totalUnits} ünite · %{cat.percent}
                        </span>
                      </div>
                      <div className="kg-progress-track" style={{ height: 7 }}>
                        <div
                          className="kg-progress-fill"
                          style={{ width: `${cat.percent}%`, background: cat.accentColor }}
                        />
                      </div>
                    </div>

                    <div className="kg-category-actions">
                      <button
                        type="button"
                        className="kg-btn kg-btn-sm kg-btn-blue"
                        onClick={() => { setSelectedCategoryId(cat.id); setSearchQuery(""); }}
                      >
                        Üniteleri Aç ({cat.totalUnits})
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="kg-btn kg-btn-sm"
                        onClick={() =>
                          onStartSession({
                            activity: "mixed",
                            levels: [cat.level],
                            categoryId: cat.id,
                          })
                        }
                      >
                        <Play size={14} /> Hızlı Başla
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="kg-section-sub">
              Arama veya durum filtresine uygun kategori bulunamadı.
            </p>
          )
        ) : filteredUnits.length > 0 ? (
          <div className="kg-unit-list">
            {filteredUnits.map((unit) => {
              const statusLabel =
                unit.status === "completed"
                  ? "Tamamlandı"
                  : unit.status === "in_progress"
                    ? "Devam Ediyor"
                    : "Başlanmadı";
              return (
                <div key={unit.id} className={`kg-unit-card is-${unit.status}`}>
                  <div className="kg-unit-card-header">
                    <div className="kg-unit-number-orb tabular-nums">
                      {unit.status === "completed" ? <Check size={18} /> : unit.unitNumber}
                    </div>
                    <div className="kg-unit-title-group">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong>{unit.titleTr}</strong>
                        <span className="kg-unit-de-label">{unit.titleDe}</span>
                        <span className={`kg-status-chip is-${unit.status}`}>{statusLabel}</span>
                      </div>
                      <p className="kg-unit-objective">{unit.objectiveTr}</p>
                      <div className="kg-unit-meta-row tabular-nums">
                        <span>
                          <BookOpen size={13} /> {unit.masteredWords}/{unit.totalWords} kelime (%{unit.percent})
                        </span>
                        <span>
                          <Clock size={13} /> ~{unit.estimatedMinutes} dk çalışma
                        </span>
                        {unit.mistakeWords > 0 && (
                          <span style={{ color: "var(--kg-red-ink)", fontWeight: 700 }}>
                            {unit.mistakeWords} hatalı kelime
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="kg-progress-track" style={{ height: 6 }}>
                    <div
                      className="kg-progress-fill"
                      style={{
                        width: `${unit.percent}%`,
                        background: activeCategory.accentColor,
                      }}
                    />
                  </div>

                  <div className="kg-unit-actions">
                    <button
                      type="button"
                      disabled={busy}
                      className="kg-btn kg-btn-sm kg-btn-blue"
                      onClick={() =>
                        onStartSession({
                          activity: "mixed",
                          levels: [unit.level],
                          categoryId: unit.categoryId,
                          unitId: unit.id,
                        })
                      }
                    >
                      <Play size={14} />{" "}
                      {unit.status === "in_progress" ? "Devam Et" : "Üniteyi Çalış"}
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      className="kg-btn kg-btn-sm"
                      onClick={() =>
                        onStartSession({
                          activity: "satzbau",
                          levels: [unit.level],
                          categoryId: unit.categoryId,
                          unitId: unit.id,
                        })
                      }
                    >
                      <Wand2 size={14} /> Cümle Kur (Satzbau)
                    </button>

                    {unit.masteredWords > 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        className="kg-btn kg-btn-sm"
                        onClick={() =>
                          onStartSession({
                            activity: "mixed",
                            levels: [unit.level],
                            categoryId: unit.categoryId,
                            unitId: unit.id,
                            reviewMode: true,
                          })
                        }
                      >
                        <RotateCcw size={14} /> Tekrar Et
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="kg-section-sub">Bu filtreye uygun ünite bulunamadı.</p>
        )}
      </div>
    </div>
  );
}
