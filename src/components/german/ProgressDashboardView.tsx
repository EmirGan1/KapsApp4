import { useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import type { CefrLevel } from "../../shared/germanActivities";
import { resetGermanProgress } from "./api";
import { CefrTag } from "./MasteryPips";
import type { OverviewResponse } from "./types";

export function ProgressDashboardView({
  overview,
  onStartLevel,
  onProgressReset,
  busy,
}: {
  overview: OverviewResponse;
  onStartLevel: (level: CefrLevel) => void;
  onProgressReset: () => void;
  busy: boolean;
}) {
  const [confirmStep, setConfirmStep] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const handleReset = async () => {
    setResetBusy(true);
    setMsg("");
    try {
      await resetGermanProgress();
      setConfirmStep(false);
      setMsg("Tüm CEFR ilerlemen ve kelimelerin ustalık kayıtları sıfırlandı.");
      onProgressReset();
    } catch (e: any) {
      setMsg(e?.message || "Sıfırlama yapılamadı.");
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="kg-container">
      {/* Overall Mastery Summary */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="kg-section-head">
          <div>
            <h1 className="kg-section-title" style={{ fontSize: 22 }}>
              CEFR İlerleme Takibi
            </h1>
            <p className="kg-section-sub">
              Her seviye (A1–C1) kendi benzersiz ve doğrulanmış kelime havuzuna göre bağımsız hesaplanır.
            </p>
          </div>
          <span
            className="tabular-nums"
            style={{
              fontFamily: "var(--font-display, sans-serif)",
              fontSize: 28,
              fontWeight: 800,
              color: "var(--kg-green-ink)",
            }}
          >
            %{overview.overall.percent}
          </span>
        </div>

        <div className="kg-progress-track">
          <div
            className="kg-progress-fill"
            style={{ width: `${overview.overall.percent}%` }}
          />
        </div>

        <div className="kg-stats-column" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">Tam Öğrenilen (5/5)</span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.overall.totalMastered} / {overview.overall.totalValidated}
            </span>
          </div>
          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">Öğreniliyor (1–4/5)</span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.overall.totalLearning + overview.overall.totalAlmostMastered}
            </span>
          </div>
          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">Hatalı / Tekrar Bekleyen</span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.overall.totalMistakeWords}
            </span>
          </div>
          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">Genel Doğruluk</span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.overall.accuracy !== null ? `%${overview.overall.accuracy}` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* 5 Independent CEFR Cards */}
      <div className="kg-cefr-grid">
        {overview.progressByLevel.map((lvl) => (
          <section key={lvl.level} className="kg-cefr-card" aria-label={`${lvl.level} ilerleme kartı`}>
            <div className="kg-cefr-card-top">
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CefrTag level={lvl.level} size="md" />
                  <h2 style={{ fontSize: 17, fontWeight: 800 }}>{lvl.trName}</h2>
                </div>
                <span className="kg-section-sub">{lvl.subtitle}</span>
              </div>
              <span
                className="kg-cefr-card-pct tabular-nums"
                style={{ color: lvl.accent }}
              >
                %{lvl.percent}
              </span>
            </div>

            <div className="kg-progress-track">
              <div
                className="kg-progress-fill"
                style={{ width: `${lvl.percent}%`, background: lvl.accent }}
              />
            </div>

            <div className="kg-cefr-card-metrics tabular-nums">
              <span>
                Tamamlanan: <strong>{lvl.mastered}</strong> / {lvl.total}
              </span>
              <span>· Kalan: {lvl.remaining}</span>
              <span>· Öğreniliyor: {lvl.learning + lvl.almostMastered}</span>
              <span>· Durum: {lvl.statusText}</span>
            </div>

            <button
              type="button"
              disabled={busy || lvl.total === 0}
              className="kg-btn kg-btn-sm"
              style={{ width: "100%" }}
              onClick={() => onStartLevel(lvl.level)}
            >
              <Play size={15} /> {lvl.level} Seviyesini Çalış
            </button>
          </section>
        ))}
      </div>

      {/* Explicit Reset Progress Section */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="kg-section-head">
          <div>
            <h2 className="kg-section-title">İlerleme Yönetimi</h2>
            <p className="kg-section-sub">
              Kaps German ilerlemen kullanıcı hesabına özel tutulur; sıfırlama yalnızca senin
              onayınla çalışır.
            </p>
          </div>
          {!confirmStep && (
            <button
              type="button"
              className="kg-btn kg-btn-sm"
              onClick={() => {
                setConfirmStep(true);
                setMsg("");
              }}
            >
              <RotateCcw size={15} /> İlerlememi Sıfırla
            </button>
          )}
        </div>

        {msg && (
          <div className="kg-alert is-success" role="status">
            <span>{msg}</span>
          </div>
        )}

        {confirmStep && (
          <div className="kg-alert" role="alert" style={{ flexWrap: "wrap" }}>
            <span>
              Emin misin? Tüm 5/5 ustalık kayıtların, günlük XP ve seri bilgilerin kalıcı olarak sıfırlanacak.
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                disabled={resetBusy}
                className="kg-btn kg-btn-danger kg-btn-sm"
                onClick={() => void handleReset()}
              >
                {resetBusy ? "Sıfırlanıyor…" : "Evet, İlerlemeyi Sıfırla"}
              </button>
              <button
                type="button"
                disabled={resetBusy}
                className="kg-btn kg-btn-sm"
                onClick={() => setConfirmStep(false)}
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
