import { useState } from "react";
import { Play, Sparkles } from "lucide-react";
import {
  activities,
  SATZBAU_MODE_LABELS,
  type CefrLevel,
  type DistractorDifficulty,
  type SatzbauMode,
  type StudyDirection,
} from "../../shared/germanActivities";
import { CefrLevelSelector } from "./CefrLevelSelector";
import type { OverviewResponse } from "./types";

export function PracticeHubView({
  overview,
  selectedLevels,
  direction,
  difficulty = "adaptive",
  onChangeLevels,
  onChangeDirection,
  onChangeDifficulty,
  onStartSession,
  onStartPersonalizedReinforcement,
  busy,
}: {
  overview: OverviewResponse;
  selectedLevels: CefrLevel[];
  direction: StudyDirection;
  difficulty?: DistractorDifficulty;
  onChangeLevels: (next: CefrLevel[]) => void;
  onChangeDirection: (next: StudyDirection) => void;
  onChangeDifficulty?: (next: DistractorDifficulty) => void;
  onStartSession: (opts: {
    module?: string;
    mode?: "practice" | "exam";
    activity?: string;
    levels?: CefrLevel[];
    categoryId?: string;
    unitId?: string;
    difficulty?: DistractorDifficulty;
    satzbauMode?: SatzbauMode | "mixed";
  }) => void;
  onStartPersonalizedReinforcement?: (opts: {
    levels: CefrLevel[];
    direction: StudyDirection;
    includeMasteredReview: boolean;
  }) => void;
  busy: boolean;
}) {
  const [includeMasteredReview, setIncludeMasteredReview] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [satzbauMode, setSatzbauMode] = useState<SatzbauMode | "mixed">("mixed");

  const selectedTotal = overview.progressByLevel
    .filter((p) => selectedLevels.includes(p.level))
    .reduce((s, p) => s + p.total, 0);

  const availableCategories = (() => {
    const map = new Map<string, string>();
    for (const lvl of selectedLevels) {
      for (const cat of (overview.curriculumHierarchy as any)?.[lvl] ?? []) {
        if (!map.has(cat.categoryId)) {
          map.set(cat.categoryId, `${cat.icon} ${cat.titleTr} (${cat.titleDe})`);
        }
      }
    }
    return [...map.entries()];
  })();

  const startWithFilters = (activity: string) => {
    onStartSession({
      activity,
      levels: selectedLevels,
      categoryId: selectedCategoryId !== "all" ? selectedCategoryId : undefined,
      difficulty,
      satzbauMode: activity === "satzbau" ? satzbauMode : undefined,
    });
  };

  return (
    <div className="kg-container">
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kg-section-head">
          <div>
            <h1 className="kg-section-title" style={{ fontSize: 22 }}>
              Pratik Merkezi
            </h1>
            <p className="kg-section-sub">
              Seviye, konu kategorisi, çeldirici zorluğu ve soru yönünü seç; seçili seviye dışından tek bir kelime bile gelmez.
            </p>
          </div>
          <button
            type="button"
            disabled={busy || selectedTotal === 0}
            className="kg-btn kg-btn-primary"
            onClick={() => startWithFilters("mixed")}
          >
            <Play size={17} /> Karışık Akıllı Ders Başlat
          </button>
        </div>

        <CefrLevelSelector
          selected={selectedLevels}
          onChange={(lvls) => {
            setSelectedCategoryId("all");
            onChangeLevels(lvls);
          }}
          progressByLevel={overview.progressByLevel}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="kg-direction-select" style={{ fontSize: 13, fontWeight: 800 }}>
              Soru yönü:
            </label>
            <select
              id="kg-direction-select"
              aria-label="Soru yönü"
              className="kg-select"
              value={direction}
              onChange={(e) => onChangeDirection(e.target.value as StudyDirection)}
            >
              <option value="tr_de">Türkçe → Almanca</option>
              <option value="de_tr">Almanca → Türkçe</option>
              <option value="mixed">Karışık Çift Yönlü</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="kg-difficulty-select" style={{ fontSize: 13, fontWeight: 800 }}>
              Çeldirici zorluğu:
            </label>
            <select
              id="kg-difficulty-select"
              aria-label="Çeldirici zorluğu"
              className="kg-select"
              value={difficulty}
              onChange={(e) =>
                onChangeDifficulty?.(e.target.value as DistractorDifficulty)
              }
            >
              <option value="adaptive">Adaptif (Ustalığa Göre Otomatik)</option>
              <option value="easy">Kolay (Açık Anlamsal Fark)</option>
              <option value="normal">Normal (Aynı Konu ve Sözcük Türü)</option>
              <option value="challenging">Zorlayıcı (Yakın Bağlam & Gramer)</option>
            </select>
          </div>

          {availableCategories.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="kg-practice-cat-select" style={{ fontSize: 13, fontWeight: 800 }}>
                Konu Kategorisi:
              </label>
              <select
                id="kg-practice-cat-select"
                aria-label="Konu Kategorisi"
                className="kg-select"
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
              >
                <option value="all">Tüm Kategoriler</option>
                {availableCategories.map(([catId, label]) => (
                  <option key={catId} value={catId}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label htmlFor="kg-satzbau-mode-select" style={{ fontSize: 13, fontWeight: 800 }}>
              Cümle Kurma (Satzbau) Modu:
            </label>
            <select
              id="kg-satzbau-mode-select"
              aria-label="Cümle Kurma Modu"
              className="kg-select"
              value={satzbauMode}
              onChange={(e) => setSatzbauMode(e.target.value as SatzbauMode | "mixed")}
            >
              <option value="mixed">Karışık (Seviyeye Uygun 5 Mod)</option>
              {(Object.entries(SATZBAU_MODE_LABELS) as Array<[SatzbauMode, string]>).map(
                ([m, label]) => (
                  <option key={m} value={m}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Personalized AI Reinforcement */}
      {onStartPersonalizedReinforcement && (
        <section className="kg-reinforce-card" style={{ marginTop: 0 }} aria-label="Bana Özel Pekiştirme">
          <div className="kg-reinforce-head">
            <span className="kg-badge-soft">
              <Sparkles size={13} /> Kişiselleştirilmiş AI Pekiştirme
            </span>
            <span className="kg-reinforce-dir tabular-nums">
              Seviyeler: {selectedLevels.join(", ")}
            </span>
          </div>
          <h2>Zayıf kelimelerine ve sık yaptığın hatalara özel çalışma oluştur.</h2>
          <p>
            Yalnızca seçili CEFR seviyelerindeki geçmiş hatalarını, 4/5 ustalaşmaya yakın kelimelerini ve zayıf kaldığın alıştırma türlerini önceliklendirir.
          </p>
          <div className="kg-reinforce-actions" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <label className="kg-toggle-chip">
              <input
                type="checkbox"
                checked={includeMasteredReview}
                onChange={(e) => setIncludeMasteredReview(e.target.checked)}
              />
              <span>5/5 ustalaşılanları da aralıklı tekrara dahil et</span>
            </label>
            <button
              type="button"
              disabled={busy || selectedTotal === 0}
              className="kg-btn kg-btn-blue"
              onClick={() =>
                onStartPersonalizedReinforcement({
                  levels: selectedLevels,
                  direction,
                  includeMasteredReview,
                })
              }
            >
              <Sparkles size={16} /> ✨ Bana Özel Pekiştirme Oluştur
            </button>
          </div>
        </section>
      )}

      {/* 12 Interactive Exercise Types (Including Cümle Kurma — Satzbau) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="kg-section-title">Alıştırma Türleri</h2>
        <div className="kg-practice-grid">
          {activities.map(([type, title, desc, icon]) => {
            const noMistakes =
              type === "mistake_review" && overview.overall.totalMistakeWords === 0;
            return (
              <button
                key={type}
                type="button"
                disabled={busy || selectedTotal === 0 || noMistakes}
                className="kg-practice-card"
                onClick={() => startWithFilters(type)}
              >
                <div className="kg-practice-card-head">
                  <span className="kg-practice-icon" aria-hidden="true">
                    {icon}
                  </span>
                  <h3>{title}</h3>
                </div>
                <p>
                  {noMistakes
                    ? "Hatalı yanıtladığın kelime bulunmuyor."
                    : desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Goethe B1 Exam Modules */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <h2 className="kg-section-title">Goethe Sınav Hazırlık</h2>
          <p className="kg-section-sub">
            Gerçek Goethe formatında okuma, AI ön değerlendirmeli yazma ve konuşma pratiği yapabilirsin.
          </p>
        </div>
        <div className="kg-practice-grid">
          {(["Lesen", "Schreiben", "Sprechen"] as const).map((mod) => (
            <div
              key={mod}
              style={{
                border: "1.5px solid var(--kg-border)",
                borderRadius: 16,
                padding: 15,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "var(--kg-surface-soft)",
              }}
            >
              <div>
                <strong style={{ fontSize: 15.5 }}>{mod}</strong>
                <p className="kg-section-sub">
                  {mod === "Lesen"
                    ? "Metin anlama ve kanıt tabanlı çoktan seçmeli görevler."
                    : mod === "Schreiben"
                      ? "Goethe kriterlerine göre resmî olmayan AI ön değerlendirmesi ve kelime farkı düzeltme görünümü."
                      : "Ortak planlama, sunum ve soru-yanıt diyaloğu."}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={busy}
                  className="kg-btn kg-btn-blue kg-btn-sm"
                  onClick={() => onStartSession({ module: mod, mode: "practice" })}
                >
                  Pratik Yap
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="kg-btn kg-btn-sm"
                  onClick={() => onStartSession({ module: mod, mode: "exam" })}
                >
                  Sınav Modu
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="kg-section-sub" style={{ margin: 0 }}>
          Not: Tam Goethe B1 <strong>Hören</strong> ses paketi henüz yapılandırılmadı; kelime
          düzeyinde dinleme çalışmak için yukarıdaki <strong>Dinleme Alıştırması</strong> kartını kullanabilirsin.
        </p>
      </div>
    </div>
  );
}
