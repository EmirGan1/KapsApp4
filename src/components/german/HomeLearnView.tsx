import { useState } from "react";
import {
  BookOpen,
  Check,
  Flame,
  Layers,
  Play,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { CEFR_META, type CefrLevel } from "../../shared/germanActivities";
import { CefrLevelSelector } from "./CefrLevelSelector";
import { CefrTag } from "./MasteryPips";
import type { OverviewResponse } from "./types";

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
    levels?: CefrLevel[];
    reviewMode?: boolean;
  }) => void;
  onOpenProgress: () => void;
  busy: boolean;
}) {
  const primaryLevel: CefrLevel = selectedLevels[0] ?? "A1";
  const [pathLevel, setPathLevel] = useState<CefrLevel>(primaryLevel);
  const activePathLevel = selectedLevels.includes(pathLevel) ? pathLevel : primaryLevel;

  const activeLevelInfo = overview.progressByLevel.find(
    (p) => p.level === activePathLevel,
  );
  const pathNodes =
    overview.learningPath.find((p) => p.level === activePathLevel)?.nodes ?? [];

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
                Her kelimeyi <strong>5 kez üst üste</strong> doğru yanıtlayarak kalıcı
                olarak ustalaş. Yanlış yanıt verdiğin kelimeler sıfırdan tekrarlanır.
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
            <button
              type="button"
              disabled={busy}
              className="kg-btn kg-hero-cta"
              onClick={() => onStartSession({ activity: "mixed", levels: selectedLevels })}
            >
              <Play size={17} /> Öğrenmeye Devam Et
            </button>
            <button
              type="button"
              className="kg-btn"
              style={{
                background: "rgba(255,255,255,0.16)",
                borderColor: "rgba(255,255,255,0.4)",
                color: "#ffffff",
              }}
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
              Sadece seçtiğin CEFR seviyesindeki kelimeler ve dilbilgisi sorulur.
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
            <span>Seçili seviyeden hızlı anlam soruları</span>
          </div>
        </button>

        <button
          type="button"
          disabled={busy}
          className="kg-quick-btn"
          onClick={() =>
            onStartSession({ activity: "sentence_translation", levels: selectedLevels })
          }
        >
          <span className="kg-quick-icon" style={{ color: "var(--kg-green-ink)" }}>
            <Layers size={18} />
          </span>
          <div>
            <strong>Cümle Pratiği</strong>
            <span>Bağlam içinde Almanca cümle çevirisi</span>
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

      {/* Duolingo-style Interactive Learning Path */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kg-section-head">
          <div>
            <h2 className="kg-section-title">
              Öğrenme Yolu · {activePathLevel} ({CEFR_META[activePathLevel].trName})
            </h2>
            <p className="kg-section-sub">
              Bir konu başlığına dokunarak doğrudan o ünitenin kelimelerini çalış.
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
                  width: `${activeLevelInfo.percent}%`,
                  background: activeLevelInfo.accent,
                }}
              />
            </div>
            <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 800 }}>
              {activeLevelInfo.mastered}/{activeLevelInfo.total}
            </span>
          </div>
        )}

        {pathNodes.length > 0 ? (
          <div className="kg-path-list">
            {pathNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                disabled={busy}
                className={`kg-path-node is-${node.status}`}
                onClick={() =>
                  onStartSession({
                    activity: "mixed",
                    levels: [node.level],
                    topic: node.topic,
                  })
                }
              >
                <span className="kg-path-orb tabular-nums">
                  {node.status === "completed" ? <Check size={20} /> : node.order}
                </span>
                <span className="kg-path-node-body">
                  <strong>{node.topic}</strong>
                  <span className="kg-path-node-meta tabular-nums">
                    {node.masteredWords}/{node.totalWords} tamamlandı · %{node.percent}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="kg-section-sub">
            Bu seviye için henüz ünite eklenmedi. Yönetici panelinden müfredatı yükleyebilirsin.
          </p>
        )}
      </div>
    </div>
  );
}
