import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  Volume2,
  X,
  XCircle,
} from "lucide-react";
import {
  activityLabel,
  directionLabelTr,
  oppositeStudyDirection,
} from "../../shared/germanActivities";
import ActivityInput from "./ActivityInput";
import { CefrTag, MasteryPips } from "./MasteryPips";
import {
  checkTaskAnswer,
  fetchSession,
  retrySessionGrading,
  saveSessionDraft,
  speakGerman,
  startReinforcementSession,
  submitSession,
} from "./api";
import type {
  ActiveSession,
  MasteryRecord,
  TaskResult,
} from "./types";

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function ExerciseRunner({
  sessionId,
  onExit,
  onOverviewChanged,
  onRestartSimilar,
  onOpenSession,
}: {
  sessionId: string;
  onExit: () => void;
  onOverviewChanged: () => void;
  onRestartSimilar: (filters: ActiveSession["filters"], module: string) => void;
  onOpenSession?: (sessionId: string) => void;
}) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reinforcing, setReinforcing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [sessionXp, setSessionXp] = useState(0);
  const [lastXpGain, setLastXpGain] = useState(0);
  const [newlyMastered, setNewlyMastered] = useState<
    Array<{ wordId: string; de: string; tr: string; level: string }>
  >([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());

  const versionRef = useRef(1);
  const lastSavedJson = useRef("");
  const saveChain = useRef(Promise.resolve());
  const examExpiredRef = useRef(false);

  // Load session cleanly when sessionId changes (never leaks answers across sessions)
  useEffect(() => {
    let alive = true;
    setSession(null);
    setAnswers({});
    setIndex(0);
    setError("");
    setReinforcing(false);
    setConfirmFinish(false);
    setSessionXp(0);
    setLastXpGain(0);
    setNewlyMastered([]);
    setUnlockedAchievements([]);
    examExpiredRef.current = false;

    const loadInitial = async () => {
      try {
        const s = await fetchSession(sessionId);
        if (!alive) return;
        setSession(s);
        versionRef.current = s.version;
        setClockOffset(Date.parse(s.serverNow) - Date.now());
        setAnswers(s.answers ?? {});
        setIndex(Math.min(Math.max(0, s.position ?? 0), Math.max(0, s.tasks.length - 1)));
        lastSavedJson.current = JSON.stringify({
          answers: s.answers ?? {},
          position: s.position ?? 0,
        });
      } catch (e: any) {
        if (alive) setError(e?.message || "Oturum açılamadı.");
      }
    };

    void loadInitial();

    return () => {
      alive = false;
    };
  }, [sessionId]);

  // Reactive poll ONLY while session is actively grading (prevents stale closure bug)
  useEffect(() => {
    if (session?.state !== "grading") return;
    let alive = true;
    const poll = setInterval(() => {
      if (document.hidden) return;
      void fetchSession(sessionId)
        .then((s) => {
          if (!alive) return;
          setSession(s);
          versionRef.current = s.version;
        })
        .catch(() => {});
    }, 2200);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [sessionId, session?.state]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Non-blocking background draft autosave (never locks out Check / Continue buttons!)
  useEffect(() => {
    if (!session || session.state !== "active") return;
    const currentTask = session.tasks[index];
    if (!currentTask) return;
    const currentAnswer = answers[currentTask.id] ?? "";
    const stateHash = JSON.stringify({
      taskId: currentTask.id,
      answer: currentAnswer,
      position: index,
    });
    if (stateHash === lastSavedJson.current) return;

    const timer = setTimeout(() => {
      saveChain.current = saveChain.current
        .then(async () => {
          const res = await saveSessionDraft(session.id, {
            taskId: currentTask.id,
            answer: currentAnswer,
            version: versionRef.current,
            positionTaskId: currentTask.id,
            draft: true,
          });
          versionRef.current = res.version;
          lastSavedJson.current = stateHash;
        })
        .catch(() => {
          // Draft save conflicts do not block active study; check endpoint resolves authoritatively.
        });
    }, 650);

    return () => clearTimeout(timer);
  }, [session, answers, index]);

  // Exam timer auto-submit ONLY for timed exam mode (never for practice sessions!)
  const remainingMs =
    session && session.mode === "exam"
      ? Date.parse(session.deadline) - (now + clockOffset)
      : 0;

  useEffect(() => {
    if (
      session?.state === "active" &&
      session.mode === "exam" &&
      remainingMs <= 0 &&
      !examExpiredRef.current
    ) {
      examExpiredRef.current = true;
      void submitSession(session.id)
        .then(() => fetchSession(session.id))
        .then((s) => {
          setSession(s);
          onOverviewChanged();
        })
        .catch(() => {});
    }
  }, [session, remainingMs, onOverviewChanged]);

  if (!session) {
    return (
      <div className="kg-container" style={{ maxWidth: 680 }}>
        {error ? (
          <div className="kg-alert" role="alert">
            <span>{error}</span>
            <button type="button" className="kg-btn kg-btn-sm" onClick={onExit}>
              Geri Dön
            </button>
          </div>
        ) : (
          <div className="kg-card" role="status">
            Oturum yükleniyor…
          </div>
        )}
      </div>
    );
  }

  const tasks = session.tasks;
  const task = tasks[index];
  const currentAnswer = task ? answers[task.id] ?? "" : "";
  const currentResult: TaskResult | undefined = task
    ? session.results[task.id]
    : undefined;

  const isChecked =
    Boolean(currentResult) &&
    !currentResult?.skipped &&
    !currentResult?.pending &&
    currentResult?.score !== null;

  const handleCheck = async () => {
    if (!task || busy) return;
    if (!currentAnswer.trim()) {
      setError("Lütfen kontrol etmeden önce bir yanıt seç veya yaz.");
      return;
    }
    setBusy(true);
    setError("");
    setLastXpGain(0);
    try {
      const nextPos = tasks[index]?.id ?? task.id;
      const res = await checkTaskAnswer(session.id, {
        taskId: task.id,
        answer: currentAnswer,
        positionTaskId: nextPos,
      });
      versionRef.current = res.version;
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          version: res.version,
          results: {
            ...prev.results,
            [task.id]: res.result,
          },
          masteryMap: {
            ...prev.masteryMap,
            ...res.masteryUpdates,
          },
        };
      });
      if (res.xpAwarded > 0) {
        setSessionXp((x) => x + res.xpAwarded);
        setLastXpGain(res.xpAwarded);
      }
      if (res.newlyMastered?.length) {
        setNewlyMastered((prev) => {
          const seen = new Set(prev.map((m) => m.wordId));
          const additions = res.newlyMastered.filter((m) => !seen.has(m.wordId));
          return [...prev, ...additions];
        });
      }
      if (res.newlyUnlockedAchievements?.length) {
        setUnlockedAchievements((prev) => [
          ...new Set([...prev, ...res.newlyUnlockedAchievements]),
        ]);
      }
      onOverviewChanged();
    } catch (e: any) {
      setError(e?.message || "Yanıt kontrol edilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (!task || busy) return;
    setBusy(true);
    setError("");
    try {
      const nextIdx = Math.min(index + 1, tasks.length - 1);
      const res = await checkTaskAnswer(session.id, {
        taskId: task.id,
        answer: "",
        positionTaskId: tasks[nextIdx]?.id ?? task.id,
        skip: true,
      });
      versionRef.current = res.version;
      setSession((prev) =>
        prev
          ? {
              ...prev,
              version: res.version,
              results: { ...prev.results, [task.id]: res.result },
            }
          : prev,
      );
      if (index < tasks.length - 1) {
        setIndex(nextIdx);
      } else {
        await handleFinishSession();
      }
    } catch (e: any) {
      setError(e?.message || "Soru atlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handleFinishSession = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const currentTask = tasks[index];
      if (currentTask && answers[currentTask.id] !== undefined) {
        await saveSessionDraft(session.id, {
          taskId: currentTask.id,
          answer: answers[currentTask.id] ?? "",
          version: versionRef.current,
          positionTaskId: currentTask.id,
          draft: true,
        }).catch(() => {});
      }
      await submitSession(session.id);
      const updated = await fetchSession(session.id);
      setSession(updated);
      setConfirmFinish(false);
      onOverviewChanged();
    } catch (e: any) {
      setError(e?.message || "Oturum tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handleNext = async () => {
    setError("");
    setLastXpGain(0);
    if (index < tasks.length - 1) {
      setIndex((i) => i + 1);
    } else {
      await handleFinishSession();
    }
  };

  const handleStartReinforcement = async () => {
    if (!session || reinforcing) return;
    setReinforcing(true);
    setError("");
    try {
      const created = await startReinforcementSession(session.id);
      onOverviewChanged();
      if (onOpenSession) {
        onOpenSession(created.id);
      } else {
        onRestartSimilar(session.filters, session.module);
      }
    } catch (e: any) {
      setError(e?.message || "Ters yön pekiştirme oturumu başlatılamadı.");
    } finally {
      setReinforcing(false);
    }
  };

  // ---------------- Completion Screen (ONLY when session.state === "done") ----------------
  if (session.state === "done") {
    const evaluated = tasks.filter(
      (t) => session.results[t.id] && session.results[t.id].score !== null && !session.results[t.id].skipped,
    );
    const correctCount = evaluated.filter(
      (t) => (session.results[t.id]?.score ?? 0) >= 0.8,
    ).length;
    const skippedCount = tasks.filter((t) => session.results[t.id]?.skipped).length;
    const wrongCount = Math.max(0, evaluated.length - correctCount);
    const accuracy = evaluated.length
      ? Math.round((correctCount / evaluated.length) * 100)
      : 0;
    const hasPending = Object.values(session.results).some((r) => r?.pending);

    const coveredWordCount = new Set(tasks.flatMap((t) => t.vocabularyIds ?? [])).size;
    const parentDirection = session.filters?.direction ?? "tr_de";
    const targetReinforceDir = oppositeStudyDirection(parentDirection);
    const reinforceDirLabel = directionLabelTr(targetReinforceDir);
    const existingChild = session.reinforcementSession;
    const canOfferReinforcement =
      session.module === "vocabulary" && !session.parentSessionId && coveredWordCount > 0;

    return (
      <div className="kg-scroll">
        <div className="kg-container" style={{ maxWidth: 740 }}>
          <div className="kg-card" style={{ textAlign: "center", padding: 28 }}>
            <div className="kg-complete-emblem">
              <Award size={30} />
            </div>
            {session.parentSessionId && (
              <div style={{ marginBottom: 8 }}>
                <span className="kg-badge-soft">
                  <ArrowLeftRight size={13} /> Ters Yön Pekiştirmesi Tamamlandı
                </span>
              </div>
            )}
            <h1 style={{ fontSize: 26, fontWeight: 800 }}>Oturum Tamamlandı!</h1>
            <p className="kg-section-sub" style={{ marginTop: 6 }}>
              {session.module === "vocabulary"
                ? `${(session.filters?.levels ?? []).join(", ") || "Seçili"} seviye çalışman kaydedildi.`
                : `${session.module} oturumu sonuçlandırıldı.`}
            </p>

            <div
              className="kg-stats-column"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", marginTop: 20 }}
            >
              <div className="kg-mini-stat">
                <span className="kg-mini-stat-label">Doğruluk</span>
                <span className="kg-mini-stat-val tabular-nums">%{accuracy}</span>
                <span className="kg-mini-stat-sub">
                  {correctCount} doğru · {wrongCount} yanlış
                </span>
              </div>
              <div className="kg-mini-stat">
                <span className="kg-mini-stat-label">Kazanılan XP</span>
                <span className="kg-mini-stat-val tabular-nums" style={{ color: "var(--kg-gold-ink)" }}>
                  +{sessionXp + 20} XP
                </span>
                <span className="kg-mini-stat-sub">Ders bonusu dahil</span>
              </div>
              <div className="kg-mini-stat">
                <span className="kg-mini-stat-label">Tam Öğrenilen</span>
                <span className="kg-mini-stat-val tabular-nums" style={{ color: "var(--kg-green-ink)" }}>
                  {newlyMastered.length} kelime
                </span>
                <span className="kg-mini-stat-sub">
                  {skippedCount > 0 ? `${skippedCount} atlandı` : "5/5 ustalık"}
                </span>
              </div>
            </div>

            {newlyMastered.length > 0 && (
              <div
                className="kg-alert is-success"
                style={{ marginTop: 16, textAlign: "left", flexDirection: "column", alignItems: "flex-start" }}
              >
                <strong>Yeni 5/5 Tam Öğrenilen Kelimeler:</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {newlyMastered.map((m) => (
                    <span key={m.wordId} style={{ fontSize: 13 }}>
                      <strong lang="de">{m.de}</strong> — {m.tr}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {unlockedAchievements.length > 0 && (
              <div className="kg-alert is-success" style={{ marginTop: 12 }}>
                <Sparkles size={18} />
                <span>Yeni başarım kilidi açıldı! Profil sekmesinden inceleyebilirsin.</span>
              </div>
            )}

            {hasPending && (
              <div className="kg-alert" style={{ marginTop: 14 }}>
                <span>Bazı açık uçlu yanıtlar AI değerlendirmesi bekliyor.</span>
                <button
                  type="button"
                  className="kg-btn kg-btn-sm"
                  onClick={() =>
                    void retrySessionGrading(session.id)
                      .then(() => fetchSession(session.id))
                      .then(setSession)
                  }
                >
                  <RefreshCw size={14} /> Yeniden Dene
                </button>
              </div>
            )}

            {error && (
              <div className="kg-alert" role="alert" style={{ marginTop: 14 }}>
                <span>{error}</span>
              </div>
            )}

            {canOfferReinforcement && (
              <section className="kg-reinforce-card" aria-label="Ters Yön Pekiştirmesi">
                <div className="kg-reinforce-head">
                  <span className="kg-badge-accent">
                    <ArrowLeftRight size={13} /> Önerilen Sonraki Adım
                  </span>
                  <span className="kg-reinforce-dir tabular-nums">
                    {coveredWordCount} kelime · {reinforceDirLabel}
                  </span>
                </div>
                <h2>Bu kelimeleri ters yönde de pekiştir.</h2>
                <p>
                  {existingChild?.state === "done"
                    ? "Bu oturumun ters yön pekiştirmesini tamamladın. Dilersen sonuçlarını yeniden inceleyebilirsin."
                    : existingChild
                      ? "Başlattığın ters yön pekiştirmesi seni bekliyor. Kaldığın yerden devam ederek kalıcılığı artır."
                      : `Az önce çalıştığın ${coveredWordCount} kelimeyi şimdi ${reinforceDirLabel} yönünde tekrar ederek aktif hatırlamayı kalıcılaştır. Zorlandığın kelimeler önceliklendirilir.`}
                </p>
                <div className="kg-reinforce-actions">
                  <button
                    type="button"
                    disabled={reinforcing}
                    className="kg-btn kg-btn-primary"
                    onClick={() => void handleStartReinforcement()}
                  >
                    <ArrowLeftRight size={17} />
                    {reinforcing
                      ? "Pekiştirme Hazırlanıyor…"
                      : existingChild?.state === "done"
                        ? "Ters Yön Sonuçlarını Gör"
                        : existingChild
                          ? "Pekiştirmeye Devam Et"
                          : "Pekiştirmeye Başla"}
                  </button>
                </div>
              </section>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 22 }}>
              <button
                type="button"
                className={`kg-btn ${canOfferReinforcement && !existingChild ? "" : "kg-btn-primary"}`}
                onClick={onExit}
              >
                Öğrenmeye Dön
              </button>
              {session.parentSessionId && onOpenSession && (
                <button
                  type="button"
                  className="kg-btn"
                  onClick={() => onOpenSession(session.parentSessionId!)}
                >
                  Ana Oturumu Gör
                </button>
              )}
              <button
                type="button"
                className="kg-btn kg-btn-blue"
                onClick={() => onRestartSimilar(session.filters, session.module)}
              >
                Yeni Oturum Başlat
              </button>
            </div>
          </div>

          <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 className="kg-section-title">Soru Özeti</h2>
            {tasks.map((t, i) => {
              const r = session.results[t.id];
              const ok = r && r.score !== null && r.score >= 0.8;
              return (
                <div
                  key={t.id}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "2px solid var(--kg-border)",
                    background: "var(--kg-surface-soft)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5 }}>
                      {i + 1}. {t.prompt}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: r?.skipped
                          ? "var(--kg-ink-muted)"
                          : ok
                            ? "var(--kg-green-ink)"
                            : "var(--kg-red-ink)",
                      }}
                    >
                      {r?.skipped ? "Atlandı" : ok ? "Doğru" : "Yanlış"}
                    </span>
                  </div>
                  <div className="kg-section-sub" style={{ margin: 0 }}>
                    Senin yanıtın: <strong>{answers[t.id] || "—"}</strong> · Doğru yanıt:{" "}
                    <strong>{r?.suggestedAnswer || t.answer || "—"}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---------------- Active Session View ----------------
  const primaryWordId = task?.vocabularyIds?.[0];
  const wordMastery: MasteryRecord | undefined =
    primaryWordId && session.module === "vocabulary"
      ? (session.masteryMap?.[primaryWordId] ?? {
          wordId: primaryWordId,
          cefrLevel: (task.level as any) || "A1",
          consecutiveCorrect: 0,
          totalCorrect: 0,
          totalIncorrect: 0,
          masteryStatus: "not_learned",
          lastPracticedAt: null,
          masteredAt: null,
        })
      : undefined;
  const progressPct = tasks.length
    ? Math.round(((index + (isChecked ? 1 : 0)) / tasks.length) * 100)
    : 0;
  const isPractice = session.mode === "practice";
  const rawAudioHint = task?.interaction?.audioText || task?.interaction?.wordMeta?.de;
  const isRecallFromTurkish =
    (task?.direction === "tr_de" ||
      (!task?.direction && Boolean(task?.prompt?.includes("Almanca karşılığı")))) &&
    !task?.passage;
  const audioHint =
    rawAudioHint && (!isRecallFromTurkish || isChecked) ? rawAudioHint : undefined;

  return (
    <div className="kg-runner">
      {/* Compact Session Progress Header */}
      <div className="kg-runner-header">
        <button
          type="button"
          className="kg-btn kg-btn-ghost kg-btn-sm"
          aria-label="Kaydet ve çık"
          onClick={onExit}
        >
          <X size={18} />
          <span className="hidden sm:inline">Çık</span>
        </button>

        <div className="kg-runner-progress-wrap">
          <div className="kg-runner-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="kg-runner-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="tabular-nums" style={{ fontSize: 13, fontWeight: 800, color: "var(--kg-ink-muted)" }}>
            {index + 1}/{tasks.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isPractice ? (
            <span className="kg-stat-chip is-xp tabular-nums">
              +{sessionXp} XP
            </span>
          ) : (
            <span className="kg-stat-chip tabular-nums">
              <Clock size={14} /> {formatClock(remainingMs)}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Stage */}
      <div className="kg-runner-body">
        <div className="kg-runner-stage">
          {error && (
            <div className="kg-alert" role="alert">
              <span>{error}</span>
            </div>
          )}

          {session.state === "grading" && (
            <div className="kg-card" role="status">
              Yanıtların değerlendiriliyor…
            </div>
          )}

          {task && (
            <div className="kg-task-card">
              <div className="kg-task-meta">
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <CefrTag level={task.level} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--kg-ink-muted)" }}>
                    {activityLabel(task.type)}
                    {task.topic ? ` · ${task.topic}` : ""}
                  </span>
                  {session.parentSessionId && (
                    <span className="kg-badge-soft">
                      <ArrowLeftRight size={13} /> Ters Yön Pekiştirmesi
                    </span>
                  )}
                  {task.isMistakeReview && (
                    <span className="kg-badge-warn">Hata Tekrarı</span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {wordMastery && (
                    <MasteryPips
                      streak={wordMastery.consecutiveCorrect}
                      status={wordMastery.masteryStatus}
                      compact
                    />
                  )}
                  {audioHint && task.type !== "listening" && (
                    <button
                      type="button"
                      className="kg-audio-btn"
                      aria-label="Almanca telaffuzu dinle"
                      onClick={() => void speakGerman(audioHint)}
                    >
                      <Volume2 size={17} />
                    </button>
                  )}
                </div>
              </div>

              <h2 className="kg-task-prompt">{task.prompt}</h2>

              {task.passage && (
                <div className="kg-task-passage" lang="de">
                  {task.passage}
                </div>
              )}

              <ActivityInput
                task={task}
                value={currentAnswer}
                disabled={busy || (isPractice && isChecked)}
                result={isPractice ? currentResult : undefined}
                onChange={(val) => {
                  setError("");
                  setAnswers((prev) => ({ ...prev, [task.id]: val }));
                }}
              />
            </div>
          )}

          {!isPractice && confirmFinish && (
            <div className="kg-card" style={{ borderColor: "var(--kg-gold-dark)" }}>
              <strong>Sınav oturumunu bitirmek istediğine emin misin?</strong>
              <p className="kg-section-sub" style={{ marginTop: 4 }}>
                Kaydedilmiş tüm yanıtların değerlendirmeye gönderilecek.
              </p>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  type="button"
                  className="kg-btn kg-btn-primary kg-btn-sm"
                  disabled={busy}
                  onClick={() => void handleFinishSession()}
                >
                  Evet, Bitir
                </button>
                <button
                  type="button"
                  className="kg-btn kg-btn-sm"
                  onClick={() => setConfirmFinish(false)}
                >
                  Devam Et
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Tactile Action & Feedback Bar */}
      {isPractice ? (
        <div
          className={`kg-runner-footer ${
            isChecked
              ? (currentResult?.score ?? 0) >= 0.8
                ? "is-correct"
                : "is-wrong"
              : ""
          }`}
        >
          <div className="kg-runner-footer-inner">
            {isChecked ? (
              <>
                <div className="kg-feedback-copy" role="status" aria-live="polite">
                  <div className="kg-feedback-title">
                    {(currentResult?.score ?? 0) >= 0.8 ? (
                      <>
                        <CheckCircle2 size={20} /> Harika, doğru!
                        {lastXpGain > 0 && (
                          <span style={{ fontSize: 13, marginLeft: 4 }}>
                            +{lastXpGain} XP
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <XCircle size={20} /> Doğru yanıt: {currentResult?.suggestedAnswer}
                      </>
                    )}
                  </div>
                  {currentResult?.feedback && (
                    <div className="kg-feedback-detail">{currentResult.feedback}</div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={busy}
                  className={`kg-btn ${
                    (currentResult?.score ?? 0) >= 0.8 ? "kg-btn-primary" : "kg-btn-danger"
                  }`}
                  onClick={() => void handleNext()}
                >
                  {index < tasks.length - 1 ? (
                    <>
                      Devam Et <ArrowRight size={17} />
                    </>
                  ) : (
                    "Oturumu Tamamla"
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className="kg-btn kg-btn-ghost"
                  onClick={() => void handleSkip()}
                >
                  Atla
                </button>
                <button
                  type="button"
                  disabled={busy || !currentAnswer.trim()}
                  className="kg-btn kg-btn-primary"
                  onClick={() => void handleCheck()}
                >
                  {busy ? "Kontrol ediliyor…" : "Kontrol Et"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="kg-runner-footer">
          <div className="kg-runner-footer-inner">
            <button
              type="button"
              disabled={index === 0}
              className="kg-btn kg-btn-sm"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ArrowLeft size={16} /> Önceki
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {index < tasks.length - 1 ? (
                <button
                  type="button"
                  className="kg-btn kg-btn-blue kg-btn-sm"
                  onClick={() => setIndex((i) => Math.min(tasks.length - 1, i + 1))}
                >
                  Sonraki <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  className="kg-btn kg-btn-primary kg-btn-sm"
                  onClick={() => setConfirmFinish(true)}
                >
                  Oturumu Tamamla
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
