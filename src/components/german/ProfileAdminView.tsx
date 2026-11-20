import { useState } from "react";
import { Award, Flame, RefreshCw, Search, ShieldCheck, Sparkles } from "lucide-react";
import { activityLabel } from "../../shared/germanActivities";
import { germanRequest } from "./api";
import type { OverviewResponse } from "./types";

export function ProfileAdminView({
  overview,
  isAdmin,
  dailyGoalXp,
  onChangeDailyGoal,
  onResumeSession,
  onOverviewChanged,
}: {
  overview: OverviewResponse;
  isAdmin: boolean;
  dailyGoalXp: number;
  onChangeDailyGoal: (xp: number) => void;
  onResumeSession: (sessionId: string) => void;
  onOverviewChanged: () => void;
}) {
  const [userQuery, setUserQuery] = useState("");
  const [users, setUsers] = useState<Array<{ id: number; username: string; enabled: number }>>([]);
  const [adminMsg, setAdminMsg] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

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

  return (
    <div className="kg-container">
      {/* Streak, XP & Daily Goal */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h1 className="kg-section-title" style={{ fontSize: 22 }}>
          Profil & Başarımlar
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
                  border: `2px solid ${ach.unlocked ? "var(--kg-gold-dark)" : "var(--kg-border)"}`,
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

      {/* Session History */}
      <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 className="kg-section-title">Son Çalışma Oturumların</h2>
        {overview.sessions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {overview.sessions.slice(0, 12).map((s) => {
              const lvls = s.filters?.levels?.join(", ") || "CEFR";
              const act = s.filters?.activity ? activityLabel(s.filters.activity) : s.module;
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
                    border: "2px solid var(--kg-border)",
                    background: "var(--kg-surface-soft)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 14 }}>
                      {lvls} · {act}
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
        <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck size={20} style={{ color: "var(--kg-green)" }} />
            <h2 className="kg-section-title">Yönetici Araçları</h2>
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
                    border: "2px solid var(--kg-border)",
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
