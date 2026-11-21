import { useEffect, useState } from "react";
import {
  Award,
  CheckCircle2,
  Flag,
  Flame,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { activityLabel } from "../../shared/germanActivities";
import {
  fetchAdminAudits,
  fetchAdminReports,
  fetchGermanAIStatus,
  fetchMyReports,
  germanRequest,
  resolveAdminAudit,
  resolveAdminReport,
  runAdminQualityScan,
} from "./api";
import type { OverviewResponse, QuestionAuditItem, QuestionReportItem } from "./types";

const REPORT_STATUS_LABELS: Record<string, string> = {
  pending_review: "İnceleniyor",
  ai_flagged_issue: "AI Sorun Tespit Etti",
  resolved_corrected: "Düzeltildi",
  resolved_disabled: "Devre Dışı Bırakıldı",
  rejected: "Reddedildi",
};

export function ProfileAdminView({
  overview,
  isAdmin,
  dailyGoalXp,
  showTurkishPronunciation = true,
  autoSessionReview = false,
  onChangeDailyGoal,
  onTogglePronunciation,
  onToggleAutoSessionReview,
  onResumeSession,
  onOverviewChanged,
}: {
  overview: OverviewResponse;
  isAdmin: boolean;
  dailyGoalXp: number;
  showTurkishPronunciation?: boolean;
  autoSessionReview?: boolean;
  onChangeDailyGoal: (xp: number) => void;
  onTogglePronunciation?: (next: boolean) => void;
  onToggleAutoSessionReview?: (next: boolean) => void;
  onResumeSession: (sessionId: string) => void;
  onOverviewChanged: () => void;
}) {
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<Array<{ id: number; username: string; enabled: number }>>([]);
  const [adminMsg, setAdminMsg] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  // User's own reports
  const [myReports, setMyReports] = useState<any[]>([]);

  // Admin AI Status, Reports, Audits
  const [aiStatus, setAiStatus] = useState<any>(null);
  const [reportFilter, setReportFilter] = useState<"open" | "resolved" | "all">("open");
  const [adminReports, setAdminReports] = useState<QuestionReportItem[]>([]);
  const [editReportDrafts, setEditReportDrafts] = useState<
    Record<
      string,
      {
        correctedPrompt: string;
        correctedAnswer: string;
        adminNote: string;
        regradeWrongAttempts: boolean;
      }
    >
  >({});
  const [auditData, setAuditData] = useState<{
    summary: Record<string, number>;
    items: QuestionAuditItem[];
  } | null>(null);

  useEffect(() => {
    void fetchMyReports().then(setMyReports).catch(() => {});
  }, []);

  const loadAdminQueues = async (status: "open" | "resolved" | "all" = reportFilter) => {
    if (!isAdmin) return;
    try {
      const [statusRes, reportsRes, auditsRes] = await Promise.all([
        fetchGermanAIStatus().catch(() => null),
        fetchAdminReports(status).catch(() => []),
        fetchAdminAudits().catch(() => null),
      ]);
      if (statusRes) setAiStatus(statusRes);
      setAdminReports(reportsRes);
      setEditReportDrafts((prev) => {
        const next = { ...prev };
        for (const r of reportsRes) {
          if (!next[r.id]) {
            next[r.id] = {
              correctedPrompt: r.taskSnapshot?.prompt ?? "",
              correctedAnswer: r.aiReview?.aiReview?.suggestedFix?.answer || r.currentAnswer || "",
              adminNote: "",
              regradeWrongAttempts: true,
            };
          }
        }
        return next;
      });
      if (auditsRes) setAuditData(auditsRes);
    } catch {}
  };

  useEffect(() => {
    if (isAdmin) {
      void loadAdminQueues(reportFilter);
    }
  }, [isAdmin, reportFilter]);

  const searchUsers = async () => {
    setAdminBusy(true);
    try {
      const list = await germanRequest("/admin/users?q=" + encodeURIComponent(userQuery));
      setUsers(list);
    } catch (e: any) {
      setAdminMsg(e?.message || "Kullanıcılar yüklenemedi.");
    } finally {
      setAdminBusy(false);
    }
  };

  const toggleUserAccess = async (userId: number, enabled: boolean) => {
    try {
      await germanRequest("/admin/access", { userId, enabled });
      await searchUsers();
    } catch (e: any) {
      setAdminMsg(e?.message || "Yetki güncellenemedi.");
    }
  };

  const seedCurriculum = async () => {
    setAdminBusy(true);
    setAdminMsg("");
    try {
      const res = await germanRequest("/admin/seed-curriculum", {});
      setAdminMsg(
        `Müfredat kontrol edildi: ${res.inserted} yeni kelime eklendi, ${res.enriched} kayıt güncellendi.`,
      );
      onOverviewChanged();
    } catch (e: any) {
      setAdminMsg(e?.message || "Müfredat yüklenemedi.");
    } finally {
      setAdminBusy(false);
    }
  };

  const startGoogleSync = async () => {
    setAdminBusy(true);
    setAdminMsg("");
    try {
      await germanRequest("/admin/sync", {});
      setAdminMsg("Google Docs eşitleme arka planda başlatıldı.");
      onOverviewChanged();
    } catch (e: any) {
      setAdminMsg(e?.message || "Google eşitleme başlatılamadı.");
    } finally {
      setAdminBusy(false);
    }
  };

  const connectGoogleOAuth = async () => {
    try {
      const res = await germanRequest("/admin/google/start", {});
      if (res.url) window.location.assign(res.url);
    } catch (e: any) {
      setAdminMsg(e?.message || "Google OAuth açılamadı.");
    }
  };

  const handleRunQualityScan = async () => {
    setAdminBusy(true);
    setAdminMsg("");
    try {
      const out = await runAdminQualityScan({
        limit: 12,
        useAI: true,
        includeGeneratedSample: true,
      });
      setAdminMsg(
        `Kalite taraması tamamlandı: ${out.scannedCount} soru incelendi (Onaylı: ${out.summary.approved ?? 0}, İnceleme: ${out.summary.needs_review ?? 0}, Reddedilen: ${out.summary.rejected ?? 0}).`,
      );
      await loadAdminQueues(reportFilter);
    } catch (e: any) {
      setAdminMsg(e?.message || "AI soru taraması başlatılamadı.");
    } finally {
      setAdminBusy(false);
    }
  };

  const handleResolveReport = async (
    reportId: string,
    action: "approve_correction" | "disable" | "reject",
  ) => {
    const draft = editReportDrafts[reportId];
    setAdminBusy(true);
    setAdminMsg("");
    try {
      const res = await resolveAdminReport(reportId, {
        action,
        adminNote: draft?.adminNote,
        correctedPrompt: draft?.correctedPrompt,
        correctedAnswer: draft?.correctedAnswer,
        regradeWrongAttempts: Boolean(draft?.regradeWrongAttempts),
      });
      setAdminMsg(
        action === "approve_correction"
          ? `Rapor düzeltmesi onaylandı${res.regradedCount > 0 ? ` (${res.regradedCount} deneme yeniden puanlandı)` : ""}.`
          : action === "disable"
            ? "Soru yeni oturumlardan devre dışı bırakıldı."
            : "Rapor reddedildi.",
      );
      await loadAdminQueues(reportFilter);
    } catch (e: any) {
      setAdminMsg(e?.message || "Rapor çözümlenemedi.");
    } finally {
      setAdminBusy(false);
    }
  };

  const handleResolveAudit = async (
    taskFingerprint: string,
    action: "approve_correction" | "disable",
  ) => {
    setAdminBusy(true);
    setAdminMsg("");
    try {
      await resolveAdminAudit({ taskFingerprint, action });
      setAdminMsg(
        action === "disable"
          ? "Soru devre dışı bırakıldı ve kuyruktan düşürüldü."
          : "Soru onaylandı.",
      );
      await loadAdminQueues(reportFilter);
    } catch (e: any) {
      setAdminMsg(e?.message || "Denetim kararı kaydedilemedi.");
    } finally {
      setAdminBusy(false);
    }
  };

  return (
    <div className="kg-container">
      {/* Streak, XP, Daily Goal & Learning Preferences */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h1 className="kg-section-title" style={{ fontSize: 22 }}>
          Profil & Öğrenme Tercihleri
        </h1>
        <div className="kg-stats-column" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">
              <Flame size={15} style={{ color: "#ea580c" }} /> Mevcut Seri
            </span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.stats.currentStreak} gün
            </span>
            <span className="kg-mini-stat-sub">En uzun: {overview.stats.longestStreak} gün</span>
          </div>
          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">
              <Sparkles size={15} style={{ color: "var(--kg-gold-dark)" }} /> Toplam XP
            </span>
            <span className="kg-mini-stat-val tabular-nums">{overview.stats.totalXp} XP</span>
            <span className="kg-mini-stat-sub">Bugün: +{overview.stats.todayXp} XP</span>
          </div>
          <div className="kg-mini-stat">
            <span className="kg-mini-stat-label">
              <Award size={15} style={{ color: "var(--kg-green)" }} /> Kusursuz Dersler
            </span>
            <span className="kg-mini-stat-val tabular-nums">
              {overview.stats.perfectLessons}
            </span>
            <span className="kg-mini-stat-sub">%100 doğrulukla biten</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>Günlük XP Hedefi:</span>
          {[20, 50, 100, 150].map((goal) => (
            <button
              key={goal}
              type="button"
              aria-pressed={dailyGoalXp === goal}
              className={`kg-btn kg-btn-sm ${dailyGoalXp === goal ? "kg-btn-primary" : ""}`}
              onClick={() => onChangeDailyGoal(goal)}
            >
              {goal} XP
            </button>
          ))}
        </div>

        <div className="kg-pref-toggles">
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
          {onToggleAutoSessionReview && (
            <label className="kg-toggle-chip">
              <input
                type="checkbox"
                checked={autoSessionReview}
                onChange={(e) => onToggleAutoSessionReview(e.target.checked)}
              />
              <span>Oturum bitiminde AI çalışma analizini otomatik aç</span>
            </label>
          )}
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="kg-section-title">Başarımlar</h2>
        <div className="kg-practice-grid">
          {overview.achievements.map((ach) => {
            const pct = Math.min(100, Math.round((ach.current / Math.max(1, ach.target)) * 100));
            return (
              <div
                key={ach.id}
                style={{
                  border: `1.5px solid ${ach.unlocked ? "var(--kg-gold-dark)" : "var(--kg-border)"}`,
                  background: ach.unlocked ? "var(--kg-gold-soft)" : "var(--kg-surface-soft)",
                  borderRadius: 16,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 14.5 }}>{ach.title}</strong>
                  <span className="tabular-nums" style={{ fontSize: 12, fontWeight: 800 }}>
                    {ach.current}/{ach.target}
                  </span>
                </div>
                <p className="kg-section-sub" style={{ margin: 0 }}>
                  {ach.description}
                </p>
                <div className="kg-progress-track" style={{ height: 8 }}>
                  <div
                    className="kg-progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: ach.unlocked ? "var(--kg-gold-dark)" : "var(--kg-blue)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* User's Submitted Reports */}
      {myReports.length > 0 && (
        <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 className="kg-section-title">Bildirdiğim Sorular</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {myReports.slice(0, 10).map((rep) => (
              <div key={rep.id} className="kg-report-row">
                <div>
                  <strong style={{ fontSize: 13.5 }}>
                    {rep.level} · {activityLabel(rep.exercise_type)}
                  </strong>
                  <div className="kg-section-sub" style={{ margin: 0 }}>
                    Neden: {rep.reason} · {new Date(rep.created_at).toLocaleString("tr-TR")}
                  </div>
                  {rep.admin_note && (
                    <div className="kg-vocab-meta" style={{ marginTop: 3 }}>
                      Not: {rep.admin_note}
                    </div>
                  )}
                </div>
                <span className="kg-badge-soft">
                  {REPORT_STATUS_LABELS[rep.status] ?? rep.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="kg-section-title">Son Çalışma Oturumların</h2>
        {overview.sessions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overview.sessions.slice(0, 12).map((s) => {
              const lvls = s.filters?.levels?.join(", ") || "CEFR";
              const act = s.filters?.activity ? activityLabel(s.filters.activity) : s.module;
              const isReinforcement = Boolean(s.parent_session_id || s.filters?.parentSessionId);
              return (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    padding: "11px 13px",
                    borderRadius: 14,
                    border: "1.5px solid var(--kg-border)",
                    background: "var(--kg-surface-soft)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 14 }}>
                      {lvls} · {act}
                      {isReinforcement ? " · Ters Yön Pekiştirmesi" : ""}
                    </strong>
                    <div className="kg-section-sub" style={{ margin: 0 }}>
                      {new Date(s.started_at).toLocaleString("tr-TR")} ·{" "}
                      {s.state === "active" ? "Devam ediyor" : "Tamamlandı"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`kg-btn kg-btn-sm ${s.state === "active" ? "kg-btn-primary" : ""}`}
                    onClick={() => onResumeSession(s.id)}
                  >
                    {s.state === "active" ? "Devam Et" : "Sonuçları Gör"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="kg-section-sub">Henüz kaydedilmiş bir çalışma oturumun yok.</p>
        )}
      </div>

      {/* Admin Controls */}
      {isAdmin && (
        <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="kg-section-head">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={20} style={{ color: "var(--kg-green)" }} />
              <h2 className="kg-section-title">Yönetici Araçları & Kalite Denetimi</h2>
            </div>
            {aiStatus && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="kg-badge-soft">
                  Groq: {aiStatus.groqConfigured ? aiStatus.groqModel : "Tanımsız"}
                </span>
                {aiStatus.ollamaConfigured && (
                  <span className="kg-badge-accent">
                    Ollama: {aiStatus.ollamaModel}
                  </span>
                )}
              </div>
            )}
          </div>

          {adminMsg && (
            <div className="kg-alert is-success" role="status">
              <span>{adminMsg}</span>
            </div>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              disabled={adminBusy}
              className="kg-btn kg-btn-primary kg-btn-sm"
              onClick={() => void seedCurriculum()}
            >
              <RefreshCw size={15} /> Yerleşik A1–C1 Müfredatını Eşitle
            </button>
            <button
              type="button"
              disabled={adminBusy}
              className="kg-btn kg-btn-blue kg-btn-sm"
              onClick={() => void handleRunQualityScan()}
            >
              <Sparkles size={15} /> AI Soru Kalite Taraması
            </button>
            <button
              type="button"
              disabled={adminBusy}
              className="kg-btn kg-btn-sm"
              onClick={() => void startGoogleSync()}
            >
              Google Docs Eşitle
            </button>
            <button
              type="button"
              className="kg-btn kg-btn-sm"
              onClick={() => void connectGoogleOAuth()}
            >
              Google Hesabı Bağla
            </button>
          </div>

          {/* Reported Questions Inbox */}
          <div className="kg-admin-subpanel">
            <div className="kg-section-head">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Flag size={16} style={{ color: "var(--kg-red)" }} />
                <strong style={{ fontSize: 15 }}>Raporlanan Sorular</strong>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["open", "resolved", "all"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`kg-btn kg-btn-sm ${reportFilter === f ? "kg-btn-blue" : ""}`}
                    onClick={() => setReportFilter(f)}
                  >
                    {f === "open" ? "Açık" : f === "resolved" ? "Çözümlenmiş" : "Tümü"}
                  </button>
                ))}
              </div>
            </div>

            {adminReports.length === 0 ? (
              <p className="kg-section-sub" style={{ margin: 0 }}>
                Bu görünümde raporlanmış soru bulunmuyor.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {adminReports.map((rep) => {
                  const draft = editReportDrafts[rep.id] ?? {
                    correctedPrompt: rep.taskSnapshot?.prompt ?? "",
                    correctedAnswer: rep.currentAnswer ?? "",
                    adminNote: "",
                    regradeWrongAttempts: true,
                  };
                  const isOpen =
                    rep.status === "pending_review" || rep.status === "ai_flagged_issue";
                  return (
                    <div key={rep.id} className="kg-admin-report-card">
                      <div className="kg-section-head">
                        <div>
                          <strong style={{ fontSize: 14 }}>
                            {rep.level} · {activityLabel(rep.exerciseType)} ·{" "}
                            <span className="kg-vocab-meta">{rep.username}</span>
                          </strong>
                          <div className="kg-section-sub" style={{ margin: 0 }}>
                            Neden: <strong>{rep.reason}</strong>
                            {rep.comment ? ` — "${rep.comment}"` : ""}
                          </div>
                        </div>
                        <span
                          className={
                            rep.status === "ai_flagged_issue" ? "kg-badge-warn" : "kg-badge-soft"
                          }
                        >
                          {REPORT_STATUS_LABELS[rep.status] ?? rep.status}
                        </span>
                      </div>

                      <div className="kg-vocab-example">
                        <div>
                          <strong>Soru:</strong> {rep.taskSnapshot?.prompt}
                        </div>
                        <div>
                          <strong>Mevcut Cevap:</strong> {rep.currentAnswer || "—"} ·{" "}
                          <strong>Öğrenci Cevabı:</strong> {rep.studentAnswer || "—"}
                        </div>
                        {rep.aiReview?.aiReview?.summaryTr && (
                          <div style={{ marginTop: 4 }}>
                            <strong>AI İncelemesi:</strong> {rep.aiReview.aiReview.summaryTr}
                          </div>
                        )}
                      </div>

                      {isOpen && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <input
                              type="text"
                              className="kg-input"
                              placeholder="Düzeltilmiş soru metni"
                              value={draft.correctedPrompt}
                              onChange={(e) =>
                                setEditReportDrafts((prev) => ({
                                  ...prev,
                                  [rep.id]: { ...draft, correctedPrompt: e.target.value },
                                }))
                              }
                            />
                            <input
                              type="text"
                              className="kg-input"
                              placeholder="Düzeltilmiş doğru cevap"
                              value={draft.correctedAnswer}
                              onChange={(e) =>
                                setEditReportDrafts((prev) => ({
                                  ...prev,
                                  [rep.id]: { ...draft, correctedAnswer: e.target.value },
                                }))
                              }
                            />
                          </div>
                          <input
                            type="text"
                            className="kg-input"
                            placeholder="Yönetici notu (isteğe bağlı)"
                            value={draft.adminNote}
                            onChange={(e) =>
                              setEditReportDrafts((prev) => ({
                                ...prev,
                                [rep.id]: { ...draft, adminNote: e.target.value },
                              }))
                            }
                          />
                          <label className="kg-toggle-chip">
                            <input
                              type="checkbox"
                              checked={draft.regradeWrongAttempts}
                              onChange={(e) =>
                                setEditReportDrafts((prev) => ({
                                  ...prev,
                                  [rep.id]: {
                                    ...draft,
                                    regradeWrongAttempts: e.target.checked,
                                  },
                                }))
                              }
                            />
                            <span>Yanlış işaretlenen denemeleri yeniden puanla</span>
                          </label>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              disabled={adminBusy}
                              className="kg-btn kg-btn-primary kg-btn-sm"
                              onClick={() => void handleResolveReport(rep.id, "approve_correction")}
                            >
                              <CheckCircle2 size={14} /> Düzeltmeyi Onayla
                            </button>
                            <button
                              type="button"
                              disabled={adminBusy}
                              className="kg-btn kg-btn-danger kg-btn-sm"
                              onClick={() => void handleResolveReport(rep.id, "disable")}
                            >
                              <Trash2 size={14} /> Soruyu Devre Dışı Bırak
                            </button>
                            <button
                              type="button"
                              disabled={adminBusy}
                              className="kg-btn kg-btn-sm"
                              onClick={() => void handleResolveReport(rep.id, "reject")}
                            >
                              Raporu Reddet
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quality Audit Queue */}
          {auditData && (
            <div className="kg-admin-subpanel">
              <div className="kg-section-head">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldAlert size={16} style={{ color: "var(--kg-blue)" }} />
                  <strong style={{ fontSize: 15 }}>Soru Kalite Denetimi Özeti</strong>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="kg-badge-accent tabular-nums">
                    Onaylı: {auditData.summary.approved ?? 0}
                  </span>
                  <span className="kg-badge-soft tabular-nums">
                    İnceleme: {auditData.summary.needs_review ?? 0}
                  </span>
                  <span className="kg-badge-warn tabular-nums">
                    Reddedilen: {auditData.summary.rejected ?? 0}
                  </span>
                </div>
              </div>

              {auditData.items
                .filter((a) => a.auditStatus !== "approved")
                .slice(0, 8)
                .map((item) => (
                  <div key={item.taskFingerprint} className="kg-admin-report-card">
                    <div className="kg-section-head">
                      <strong>
                        {item.level} · {item.module} ·{" "}
                        {item.taskSnapshot?.prompt?.slice(0, 80) ?? item.taskId}
                      </strong>
                      <span
                        className={
                          item.auditStatus === "rejected" ? "kg-badge-warn" : "kg-badge-soft"
                        }
                      >
                        {item.auditStatus === "rejected" ? "Sorunlu" : "İnceleme Gerekli"}
                      </span>
                    </div>
                    {item.deterministicIssues.length > 0 && (
                      <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
                        {item.deterministicIssues.map((di, i) => (
                          <li key={i}>{di.messageTr}</li>
                        ))}
                      </ul>
                    )}
                    {item.aiReview?.summaryTr && (
                      <p className="kg-section-sub" style={{ margin: "4px 0 0" }}>
                        {item.aiReview.summaryTr}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <button
                        type="button"
                        disabled={adminBusy}
                        className="kg-btn kg-btn-danger kg-btn-sm"
                        onClick={() => void handleResolveAudit(item.taskFingerprint, "disable")}
                      >
                        Soruyu Devre Dışı Bırak
                      </button>
                      <button
                        type="button"
                        disabled={adminBusy}
                        className="kg-btn kg-btn-sm"
                        onClick={() =>
                          void handleResolveAudit(item.taskFingerprint, "approve_correction")
                        }
                      >
                        Onayla
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* User Permissions */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="search"
              className="kg-input"
              placeholder="Kullanıcı adı ara…"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
            <button
              type="button"
              disabled={adminBusy}
              className="kg-btn kg-btn-sm"
              onClick={() => void searchUsers()}
            >
              <Search size={15} /> Kullanıcıları Listele
            </button>
          </div>

          {users.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {users.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    borderRadius: 12,
                    border: "1.5px solid var(--kg-border)",
                  }}
                >
                  <strong>{u.username}</strong>
                  <button
                    type="button"
                    disabled={u.id === 1}
                    className={`kg-btn kg-btn-sm ${u.enabled ? "kg-btn-primary" : ""}`}
                    onClick={() => void toggleUserAccess(u.id, !u.enabled)}
                  >
                    {u.id === 1 ? "Yönetici" : u.enabled ? "Erişim Açık" : "Erişim Ver"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {overview.jobs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <strong style={{ fontSize: 13 }}>Son Eşitleme Kayıtları</strong>
              {overview.jobs.slice(0, 5).map((j) => (
                <div key={j.id} className="kg-section-sub" style={{ margin: 0 }}>
                  {new Date(j.started_at).toLocaleString("tr-TR")} · {j.status}
                  {j.summary ? ` · ${j.summary}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
