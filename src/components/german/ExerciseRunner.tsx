import { QuestionVocabularyProvider, GermanWordText } from './WordHelp';
import { AnswerExplanation } from './AnswerExplanation';
import { useSessionPreparation } from './SessionPreparation';
import { taskHelpPolicy } from '../../shared/germanTaskHelp';
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  Flag,
  HelpCircle,
  RefreshCw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import {
  activityLabel,
  directionLabelTr,
  oppositeStudyDirection,
  type CefrLevel,
} from "../../shared/germanActivities";
import ActivityInput from "./ActivityInput";
import { CefrTag, MasteryPips } from "./MasteryPips";
import { GermanSpeakButtons, PronunciationGuideBox } from "./PronunciationGuideBox";
import {
  checkTaskAnswer,
  createPersonalizedReinforcement,
  explainMistake,
  fetchSession,
  reportQuestion,
  requestSessionReview,
  retrySessionGrading,
  reviewSatzbauSentence,
  reviewSchreiben,
  saveSessionDraft,
  startReinforcementSession,
  submitSession,
} from "./api";
import type {
  ActiveSession,
  GermanTask,
  MasteryRecord,
  MistakeExplanationResponse,
  SatzbauReviewResult,
  SchreibenEvaluationResult,
  SessionPerformanceReview,
  TaskResult,
} from "./types";

const STANDARD_REPORT_REASONS = [
  { id: "correct_answer_wrong", labelTr: "Doğru cevap olarak işaretlenen seçenek yanlış" },
  { id: "multiple_answers_possible", labelTr: "Birden fazla seçenek doğru olabilir" },
  { id: "question_grammar_wrong", labelTr: "Soru cümlesi veya dilbilgisi hatalı" },
  { id: "turkish_translation_wrong", labelTr: "Türkçe çeviri hatalı veya eksik" },
  { id: "out_of_cefr_level", labelTr: "Soru seçili CEFR seviyesinin üzerinde" },
  { id: "unclear_or_nonsensical", labelTr: "Soru anlaşılmaz veya anlamsız" },
  { id: "other", labelTr: "Diğer" },
] as const;

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function SchreibenEvaluationCard({
  result,
  studentText,
}: {
  result: TaskResult;
  studentText: string;
}) {
  const [showDiff, setShowDiff] = useState(false);
  const [showCorrected, setShowCorrected] = useState(false);

  const criteriaList = result.criteria
    ? [
        { key: "Aufgabenerfüllung", data: result.criteria.aufgabenerfuellung },
        { key: "Kohärenz", data: result.criteria.kohaerenz },
        { key: "Wortschatz", data: result.criteria.wortschatz },
        { key: "Strukturen", data: result.criteria.strukturen },
      ].filter((item) => item.data)
    : [];

  return (
    <div className="kg-schreiben-card">
      <div className="kg-schreiben-head">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="kg-badge-soft">
            <FileCheck2 size={13} /> Resmî Olmayan Pratik Tahmini
          </span>
          {result.score !== null && result.score !== undefined && (
            <span className="kg-badge-accent tabular-nums">
              Tahmini Uyum: %{Math.round(result.score * 100)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {result.diffSegments && result.diffSegments.length > 0 && (
            <button
              type="button"
              aria-pressed={showDiff}
              className={`kg-btn kg-btn-sm ${showDiff ? "kg-btn-blue" : ""}`}
              onClick={() => setShowDiff((v) => !v)}
            >
              <Eye size={14} /> Hatalarımı Göster
            </button>
          )}
          {(result.correctedVersion || result.suggestedAnswer) && (
            <button
              type="button"
              aria-pressed={showCorrected}
              className={`kg-btn kg-btn-sm ${showCorrected ? "kg-btn-primary" : ""}`}
              onClick={() => setShowCorrected((v) => !v)}
            >
              Düzeltilmiş Metni Göster
            </button>
          )}
        </div>
      </div>

      {result.disclaimerTr && (
        <p className="kg-section-sub" style={{ margin: 0 }}>
          {result.disclaimerTr}
        </p>
      )}

      {result.overallEvaluationTr && (
        <p className="kg-ai-summary">{result.overallEvaluationTr}</p>
      )}

      {/* Keep original submission untouched */}
      <div className="kg-schreiben-original">
        <span className="kg-vocab-meta">Senin Gönderdiğin Metin (Değiştirilmedi):</span>
        <div lang="de" className="kg-schreiben-text">
          {result.originalSubmission || studentText || "—"}
        </div>
      </div>

      {showDiff && result.diffSegments && result.diffSegments.length > 0 && (
        <div className="kg-diff-box" aria-label="Metin karşılaştırma farkları">
          <div className="kg-diff-legend">
            <span className="kg-diff-tag is-removed">Çıkarılan / Hatalı</span>
            <span className="kg-diff-tag is-added">Eklenen / Düzeltilmiş</span>
          </div>
          <div className="kg-diff-body" lang="de">
            {result.diffSegments.map((seg, i) => (
              <span
                key={i}
                className={
                  seg.type === "removed"
                    ? "kg-diff-removed"
                    : seg.type === "added"
                      ? "kg-diff-added"
                      : ""
                }
              >
                {seg.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {showCorrected && (result.correctedVersion || result.suggestedAnswer) && (
        <div className="kg-corrected-box">
          <div className="kg-section-head">
            <strong style={{ fontSize: 13.5 }}>Düzeltilmiş Doğal Metin</strong>
            <GermanSpeakButtons
              text={result.correctedVersion || result.suggestedAnswer || ""}
              compact
            />
          </div>
          <p lang="de" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {result.correctedVersion || result.suggestedAnswer}
          </p>
        </div>
      )}

      {criteriaList.length > 0 && (
        <div className="kg-criteria-grid">
          {criteriaList.map(({ key, data }) => (
            <div key={key} className="kg-criterion-box">
              <div className="kg-criterion-top">
                <strong>{key}</strong>
                <span className={`kg-band-pill is-${data!.band}`}>
                  {data!.band === "gut"
                    ? "İyi"
                    : data!.band === "solide"
                      ? "Yeterli"
                      : "Geliştirilebilir"}
                </span>
              </div>
              <p className="kg-section-sub" style={{ margin: 0 }}>
                {data!.noteTr}
              </p>
            </div>
          ))}
        </div>
      )}

      {result.strengths && result.strengths.length > 0 && (
        <div className="kg-ai-list-block">
          <strong>Güçlü Yönlerin</strong>
          <ul>
            {result.strengths.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {result.grammarMistakes && result.grammarMistakes.length > 0 && (
        <div className="kg-ai-list-block">
          <strong>Dilbilgisi Düzeltmeleri</strong>
          <ul>
            {result.grammarMistakes.map((m, idx) => (
              <li key={idx}>
                <span className="kg-diff-removed" lang="de">{m.original}</span> →{" "}
                <strong className="kg-diff-added" lang="de">{m.correction}</strong>{" "}
                <span className="kg-vocab-meta">({m.category})</span>: {m.explanationTr}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.vocabularyImprovements && result.vocabularyImprovements.length > 0 && (
        <div className="kg-ai-list-block">
          <strong>Kelime ve İfade Önerileri</strong>
          <ul>
            {result.vocabularyImprovements.map((v, idx) => (
              <li key={idx}>
                <span lang="de">{v.original}</span> → <strong lang="de">{v.better}</strong>:{" "}
                {v.reasonTr}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.missedRequirements && result.missedRequirements.length > 0 && (
        <div className="kg-ai-list-block">
          <strong>Eksik Kalan Görev Maddeleri</strong>
          <ul>
            {result.missedRequirements.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {result.tips && result.tips.length > 0 && (
        <div className="kg-ai-list-block">
          <strong>Sonraki Deneme İçin İpuçları</strong>
          <ul>
            {result.tips.map((t, idx) => (
              <li key={idx}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ExerciseRunner({
  sessionId,
  showTurkishPronunciation = true,
  autoSessionReview = false,
  onExit,
  onOverviewChanged,
  onRestartSimilar,
  onOpenSession,
}: {
  sessionId: string;
  showTurkishPronunciation?: boolean;
  autoSessionReview?: boolean;
  onExit: () => void;
  onOverviewChanged: () => void;
  onRestartSimilar: (filters: ActiveSession["filters"], module: string) => void;
  onOpenSession?: (sessionId: string) => void;
}) {
  const preparation = useSessionPreparation();
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reinforcing, setReinforcing] = useState(false);
  const [aiReinforcing, setAiReinforcing] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [sessionXp, setSessionXp] = useState(0);
  const [lastXpGain, setLastXpGain] = useState(0);
  const [newlyMastered, setNewlyMastered] = useState<
    Array<{ wordId: string; de: string; tr: string; level: string }>
  >([]);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());

  // AI Explain & Session Review & Report states
  const [explanations, setExplanations] = useState<Record<string, MistakeExplanationResponse>>({});
  const [explainBusy, setExplainBusy] = useState<string | null>(null);
  const [sessionReview, setSessionReview] = useState<SessionPerformanceReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [liveSchreibenEval, setLiveSchreibenEval] = useState<Record<string, SchreibenEvaluationResult>>({});
  const [schreibenBusy, setSchreibenBusy] = useState(false);
  const [satzbauReviews, setSatzbauReviews] = useState<Record<string, SatzbauReviewResult>>({});
  const [satzbauBusy, setSatzbauBusy] = useState<string | null>(null);

  const [reportTask, setReportTask] = useState<GermanTask | null>(null);
  const [reportReason, setReportReason] = useState<string>("correct_answer_wrong");
  const [reportComment, setReportComment] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportBanner, setReportBanner] = useState("");

  const versionRef = useRef(1);
  const lastSavedJson = useRef("");
  const saveChain = useRef(Promise.resolve());
  const examExpiredRef = useRef(false);
  const autoReviewTriggeredRef = useRef(false);

  useEffect(() => {
    let alive = true;
    setSession(null);
    setAnswers({});
    setIndex(0);
    setError("");
    setReinforcing(false);
    setAiReinforcing(false);
    setConfirmFinish(false);
    setSessionXp(0);
    setLastXpGain(0);
    setNewlyMastered([]);
    setUnlockedAchievements([]);
    setExplanations({});
    setExplainBusy(null);
    setSessionReview(null);
    setReviewLoading(false);
    setLiveSchreibenEval({});
    setSatzbauReviews({});
    setSatzbauBusy(null);
    setReportTask(null);
    setReportBanner("");
    examExpiredRef.current = false;
    autoReviewTriggeredRef.current = false;

    const loadInitial = async () => {
      try {
        const s = await fetchSession(sessionId);
        if (!alive) return;
        setSession(s);
        setSessionReview(s.sessionReview ?? null);
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

  // Auto-run session review if preference enabled and session completed without cached review
  useEffect(() => {
    if (
      autoSessionReview &&
      session?.state === "done" &&
      !sessionReview &&
      !reviewLoading &&
      !autoReviewTriggeredRef.current
    ) {
      autoReviewTriggeredRef.current = true;
      setReviewLoading(true);
      void requestSessionReview({ sessionId: session.id })
        .then(setSessionReview)
        .catch(() => {})
        .finally(() => setReviewLoading(false));
    }
  }, [autoSessionReview, session?.id, session?.state, sessionReview, reviewLoading]);

  // Reactive poll ONLY while session is actively grading
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

  // Non-blocking background draft autosave
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
        .catch(() => {});
    }, 650);

    return () => clearTimeout(timer);
  }, [session, answers, index]);

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
    if (!session || reinforcing || preparation.active) return;
    setReinforcing(true);
    setError("");
    try {
      const created = await preparation.run(progress => startReinforcementSession(session.id, progress));
      if (!created) return;
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

  const handleStartPersonalizedReinforcement = async () => {
    if (!session || aiReinforcing || preparation.active) return;
    setAiReinforcing(true);
    setError("");
    try {
      const lvls = (session.filters?.levels?.length ? session.filters.levels : ["A1"]) as CefrLevel[];
      const targetDir = oppositeStudyDirection(session.filters?.direction ?? "tr_de");
      const created = await preparation.run(progress => createPersonalizedReinforcement({
        levels: lvls,
        direction: targetDir,
        parentSessionId: session.id,
      }, progress), "ai");
      if (!created) return;
      onOverviewChanged();
      if (onOpenSession) {
        onOpenSession(created.sessionId);
      }
    } catch (e: any) {
      setError(e?.message || "Kişiselleştirilmiş pekiştirme oluşturulamadı.");
    } finally {
      setAiReinforcing(false);
    }
  };

  const handleExplainTask = async (t: GermanTask, detailed = false) => {
    if (explainBusy === t.id) return;
    setExplainBusy(t.id);
    setError("");
    try {
      const r = session.results[t.id];
      const isOk = Boolean(r && r.score !== null && r.score >= 0.8);
      const exp = await explainMistake({
        sessionId: session.id,
        taskId: t.id,
        answer: answers[t.id] ?? "",
        isCorrect: isOk,
        detailed,
      });
      setExplanations((prev) => ({ ...prev, [t.id]: exp }));
    } catch (e: any) {
      setError(e?.message || "Açıklama şu an hazırlanamadı.");
    } finally {
      setExplainBusy(null);
    }
  };

  const handleLoadSessionReview = async (forceRefresh = false) => {
    if (reviewLoading) return;
    setReviewLoading(true);
    setError("");
    try {
      const rev = await requestSessionReview({
        sessionId: session.id,
        forceRefresh,
      });
      setSessionReview(rev);
    } catch (e: any) {
      setError(e?.message || "Çalışma analizi hazırlanamadı.");
    } finally {
      setReviewLoading(false);
    }
  };

  const handleLiveSchreibenReview = async () => {
    if (!task || schreibenBusy || !currentAnswer.trim()) return;
    setSchreibenBusy(true);
    setError("");
    try {
      const evalRes = await reviewSchreiben({
        sessionId: session.id,
        taskId: task.id,
        level: task.level,
        part: task.part,
        prompt: task.prompt,
        passage: task.passage,
        text: currentAnswer,
      });
      setLiveSchreibenEval((prev) => ({ ...prev, [task.id]: evalRes }));
    } catch (e: any) {
      setError(e?.message || "Yazma ön değerlendirmesi tamamlanamadı.");
    } finally {
      setSchreibenBusy(false);
    }
  };

  const handleSatzbauReview = async (t: GermanTask) => {
    const ans = (answers[t.id] ?? "").trim();
    if (!ans || satzbauBusy === t.id) return;
    setSatzbauBusy(t.id);
    setError("");
    try {
      const res = await reviewSatzbauSentence({
        sessionId: session.id,
        taskId: t.id,
        userSentence: ans,
      });
      setSatzbauReviews((prev) => ({ ...prev, [t.id]: res }));
    } catch (e: any) {
      setError(e?.message || "Cümle incelemesi şu an hazırlanamadı.");
    } finally {
      setSatzbauBusy(null);
    }
  };

  const handleSubmitReport = async () => {
    if (!reportTask || reportBusy) return;
    setReportBusy(true);
    setError("");
    try {
      const res = await reportQuestion({
        sessionId: session.id,
        taskId: reportTask.id,
        reason: reportReason,
        comment: reportComment,
        studentAnswer: answers[reportTask.id] ?? "",
      });
      setReportTask(null);
      setReportComment("");
      setReportBanner(res.messageTr || "Rapor alındı. Soru incelemeye gönderildi.");
    } catch (e: any) {
      setError(e?.message || "Hata raporu gönderilemedi.");
    } finally {
      setReportBusy(false);
    }
  };

  const renderReportModal = () =>
    reportTask ? (
      <div
        className="kg-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kg-report-title"
      >
        <div className="kg-modal-card">
          <div className="kg-section-head">
            <h2 id="kg-report-title" className="kg-section-title">
              Soruda Hata Bildir
            </h2>
            <button
              type="button"
              className="kg-btn kg-btn-ghost kg-btn-sm"
              aria-label="Kapat"
              onClick={() => setReportTask(null)}
            >
              <X size={16} />
            </button>
          </div>
          <p className="kg-section-sub" style={{ margin: 0 }}>
            <strong>Soru:</strong> {reportTask.prompt}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="kg-report-reason" style={{ fontSize: 13, fontWeight: 800 }}>
              Hata nedeni seç:
            </label>
            <select
              id="kg-report-reason"
              className="kg-select"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            >
              {STANDARD_REPORT_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.labelTr}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="kg-report-comment" style={{ fontSize: 13, fontWeight: 800 }}>
              Ek not (isteğe bağlı):
            </label>
            <textarea
              id="kg-report-comment"
              rows={3}
              maxLength={600}
              className="kg-textarea"
              placeholder="Örneğin: 'Birden fazla seçenek doğru görünüyor veya Türkçe çevirisi farklı…'"
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              className="kg-btn kg-btn-sm"
              onClick={() => setReportTask(null)}
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={reportBusy}
              className="kg-btn kg-btn-danger kg-btn-sm"
              onClick={() => void handleSubmitReport()}
            >
              {reportBusy ? "Gönderiliyor…" : "Raporu Gönder"}
            </button>
          </div>
        </div>
      </div>
    ) : null;

  // ---------------- Completion Screen ----------------
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
        <div className="kg-container" style={{ maxWidth: 760 }}>
          {reportBanner && (
            <div className="kg-alert is-success" role="status">
              <span>{reportBanner}</span>
              <button type="button" className="kg-btn kg-btn-ghost kg-btn-sm" onClick={() => setReportBanner("")}>
                <X size={14} />
              </button>
            </div>
          )}

          <div className="kg-card" style={{ textAlign: "center", padding: 26 }}>
            <div className="kg-complete-emblem">
              <Award size={30} />
            </div>
            {session.parentSessionId && (
              <div style={{ marginBottom: 8 }}>
                <span className="kg-badge-soft">
                  <ArrowLeftRight size={13} /> Pekiştirme Oturumu Tamamlandı
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

            {/* AI Session Review Trigger & Display */}
            <div className="kg-session-review-box">
              {!sessionReview ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ textAlign: "left" }}>
                    <strong style={{ fontSize: 15 }}>Kişisel Performans Değerlendirmesi</strong>
                    <p className="kg-section-sub" style={{ margin: 0 }}>
                      Gerçek oturum verilerine dayalı güçlü yönlerini ve odaklanman gereken alanları gör.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={reviewLoading}
                    className="kg-btn kg-btn-blue kg-btn-sm"
                    onClick={() => void handleLoadSessionReview(false)}
                  >
                    <Sparkles size={15} />
                    {reviewLoading ? "Analiz Hazırlanıyor…" : "✨ AI Çalışma Analizi"}
                  </button>
                </div>
              ) : (
                <div className="kg-ai-review-content">
                  <div className="kg-section-head">
                    <span className="kg-badge-soft">
                      <Sparkles size={13} /> AI Çalışma Analizi
                    </span>
                    <button
                      type="button"
                      disabled={reviewLoading}
                      className="kg-btn kg-btn-ghost kg-btn-sm"
                      onClick={() => void handleLoadSessionReview(true)}
                    >
                      <RefreshCw size={13} /> Yenile
                    </button>
                  </div>

                  {sessionReview.limitedEvidence && (
                    <div className="kg-voice-notice">
                      Sınırlı veri: Bu oturum çok kısa olduğu için analiz az sayıdaki soruya dayanmaktadır.
                    </div>
                  )}

                  <p className="kg-ai-summary">{sessionReview.overallSummaryTr}</p>

                  <div className="kg-ai-two-col">
                    <div className="kg-ai-list-block">
                      <strong>Güçlü Alanların</strong>
                      <ul>
                        {sessionReview.strongestAreas.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="kg-ai-list-block">
                      <strong>Pratik Gerektiren Alanlar</strong>
                      <ul>
                        {sessionReview.areasNeedingPractice.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {sessionReview.topActions.length > 0 && (
                    <div className="kg-ai-list-block">
                      <strong>Öncelikli 3 Adım</strong>
                      <ul>
                        {sessionReview.topActions.map((act, i) => (
                          <li key={i}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {canOfferReinforcement && (
              <section className="kg-reinforce-card" aria-label="Pekiştirme Seçenekleri">
                <div className="kg-reinforce-head">
                  <span className="kg-badge-accent">
                    <ArrowLeftRight size={13} /> Önerilen Sonraki Adım
                  </span>
                  <span className="kg-reinforce-dir tabular-nums">
                    {coveredWordCount} kelime · {reinforceDirLabel}
                  </span>
                </div>
                <h2>Bu kelimeleri ters yönde veya AI ile pekiştir.</h2>
                <p>
                  {existingChild?.state === "done"
                    ? "Bu oturumun ters yön pekiştirmesini tamamladın. Dilersen sonuçlarını yeniden inceleyebilir veya sana özel yeni bir set oluşturabilirsin."
                    : existingChild
                      ? "Başlattığın ters yön pekiştirmesi seni bekliyor. Kaldığın yerden devam ederek kalıcılığı artır."
                      : `Az önce çalıştığın ${coveredWordCount} kelimeyi şimdi ${reinforceDirLabel} yönünde tekrar ederek aktif hatırlamayı kalıcılaştır.`}
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

                  <button
                    type="button"
                    disabled={aiReinforcing}
                    className="kg-btn kg-btn-blue"
                    onClick={() => void handleStartPersonalizedReinforcement()}
                  >
                    <Sparkles size={16} />
                    {aiReinforcing ? "Oluşturuluyor…" : "✨ Bana Özel Pekiştirme Oluştur"}
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

          <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 className="kg-section-title">Soru Özeti</h2>
            {tasks.map((t, i) => {
              const r = session.results[t.id];
              const ok = r && r.score !== null && r.score >= 0.8;
              const exp = explanations[t.id];
              const isSchreiben = t.module === "Schreiben";

              return (
                <div
                  key={t.id}
                  style={{
                    padding: "14px",
                    borderRadius: 14,
                    border: "1.5px solid var(--kg-border)",
                    background: "var(--kg-surface-soft)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 13.5 }}>
                      {i + 1}. {t.prompt}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: r?.skipped
                            ? "var(--kg-ink-muted)"
                            : r?.pending
                              ? "var(--kg-gold-ink)"
                              : ok
                                ? "var(--kg-green-ink)"
                                : "var(--kg-red-ink)",
                        }}
                      >
                        {r?.skipped
                          ? "Atlandı"
                          : r?.pending
                            ? "AI Bekliyor"
                            : ok
                              ? "Doğru"
                              : "Yanlış"}
                      </span>
                      <button
                        type="button"
                        className="kg-btn kg-btn-ghost kg-btn-sm"
                        style={{ minHeight: 30, padding: "2px 8px", fontSize: 11.5 }}
                        onClick={() => setReportTask(t)}
                      >
                        <Flag size={12} /> Hata Bildir
                      </button>
                    </div>
                  </div>

                  {!isSchreiben && (
                    <div className="kg-section-sub" style={{ margin: 0 }}>
                      Senin yanıtın: <strong>{answers[t.id] || "—"}</strong> · Doğru yanıt:{" "}
                      <strong>{r?.suggestedAnswer || t.answer || "—"}</strong>
                    </div>
                  )}

                  {isSchreiben && r && !r.pending && (
                    <SchreibenEvaluationCard result={r} studentText={answers[t.id] ?? ""} />
                  )}

                  {!isSchreiben && r && !r.skipped && !r.pending && r.score !== null && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={explainBusy === t.id}
                        className="kg-btn kg-btn-sm"
                        onClick={() => void handleExplainTask(t, false)}
                      >
                        <Sparkles size={13} />
                        {explainBusy === t.id
                          ? "Açıklanıyor…"
                          : ok
                            ? "Neden doğru?"
                            : "✨ AI ile Hatamı Açıkla"}
                      </button>
                    </div>
                  )}

                  {exp && <AnswerExplanation explanation={exp} />}
                </div>
              );
            })}
          </div>
        </div>
        {renderReportModal()}
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
  const help = taskHelpPolicy(task, Boolean(isPractice && isChecked));
  const audioHint = help.audioText;
  const canShowWordPronunciation = help.wordPronunciation && showTurkishPronunciation &&
    Boolean(task?.interaction?.wordMeta?.pronunciation);
  const currentExplanation = task ? explanations[task.id] : undefined;
  const currentLiveSchreiben = task ? liveSchreibenEval[task.id] : undefined;

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
          <div
            className="kg-runner-track"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
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
          {reportBanner && (
            <div className="kg-alert is-success" role="status">
              <span>{reportBanner}</span>
              <button type="button" className="kg-btn kg-btn-ghost kg-btn-sm" onClick={() => setReportBanner("")}>
                <X size={14} />
              </button>
            </div>
          )}

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

          {session.filters.freshness && index === 0 && <div className="kg-session-freshness"><Sparkles size={14} /><span>{session.filters.freshness.newQuestions} yeni soru · {session.filters.freshness.total} soruluk çalışma</span>{session.filters.freshness.aiQuestions > 0 && <span className="kg-badge-soft">Yeni bağlamlar</span>}</div>}
          {task && (
            <QuestionVocabularyProvider key={task.id} task={task} sessionId={session.id} reviewed={Boolean(isPractice && isChecked)} enabled={isPractice} explanation={currentExplanation} onExplain={() => void handleExplainTask(task, Boolean(currentExplanation))} loading={explainBusy === task.id}>
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

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {wordMastery && (
                    <MasteryPips
                      streak={wordMastery.consecutiveCorrect}
                      status={wordMastery.masteryStatus}
                      compact
                    />
                  )}
                  {audioHint && task.type !== "listening" && (
                    <GermanSpeakButtons text={audioHint} compact />
                  )}
                  <button
                    type="button"
                    className="kg-btn kg-btn-ghost kg-btn-sm"
                    style={{ minHeight: 34, padding: "0 9px", fontSize: 12 }}
                    aria-label="Bu soruda hata bildir"
                    onClick={() => setReportTask(task)}
                  >
                    <Flag size={13} /> Hata Var
                  </button>
                </div>
              </div>

              <h2 className="kg-task-prompt"><GermanWordText text={task.prompt} /></h2>

              {canShowWordPronunciation && task.interaction?.wordMeta?.pronunciation && (
                <PronunciationGuideBox
                  pronunciation={task.interaction.wordMeta.pronunciation}
                  showTurkishPronunciation={showTurkishPronunciation}
                  compact
                />
              )}

              {task.passage && (
                <div className="kg-task-passage" lang={task.direction === "tr_de" ? "tr" : "de"}>
                  <GermanWordText text={task.passage} />
                </div>
              )}

              <ActivityInput
                task={task}
                value={currentAnswer}
                disabled={busy || (isPractice && isChecked)}
                result={isPractice ? currentResult : undefined}
                showTurkishPronunciation={showTurkishPronunciation}
                onChange={(val) => {
                  setError("");
                  setAnswers((prev) => ({ ...prev, [task.id]: val }));
                }}
              />

              {currentResult?.pending && <div className="kg-voice-notice" role="status">
                <p>{currentResult.feedback}</p>
                <button type="button" className="kg-btn kg-btn-sm" disabled={busy} onClick={() => void handleNext()}>Yanıtım kaydedildi, devam et</button>
              </div>}

              {/* Live AI Preliminary Check for Goethe Schreiben in Practice Mode */}
              {isPractice && task.module === "Schreiben" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={schreibenBusy || currentAnswer.trim().length < 3}
                      className="kg-btn kg-btn-blue kg-btn-sm"
                      onClick={() => void handleLiveSchreibenReview()}
                    >
                      <Sparkles size={15} />
                      {schreibenBusy ? "Değerlendiriliyor…" : "✨ AI Schreiben Değerlendirmesi"}
                    </button>
                  </div>
                  {currentLiveSchreiben && (
                    <SchreibenEvaluationCard
                      result={currentLiveSchreiben}
                      studentText={currentAnswer}
                    />
                  )}
                </div>
              )}

              {/* Satzbau (Sentence Building) AI Grammar & Word-Order Review */}
              {task.type === "satzbau" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      disabled={satzbauBusy === task.id || currentAnswer.trim().length < 2}
                      className="kg-btn kg-btn-blue kg-btn-sm"
                      onClick={() => void handleSatzbauReview(task)}
                    >
                      <Sparkles size={15} />
                      {satzbauBusy === task.id
                        ? "AI İnceliyor…"
                        : "✨ Cümlemi AI ile İncele"}
                    </button>
                    {isChecked && task.answer && (
                      <GermanSpeakButtons text={task.answer} compact />
                    )}
                  </div>

                  {satzbauReviews[task.id] && (
                    <div className="kg-satzbau-ai-card" role="region" aria-label="AI Cümle İncelemesi">
                      <div className="kg-section-head">
                        <span className="kg-badge-soft">
                          <Sparkles size={13} /> AI Cümle Kurma (Satzbau) İncelemesi
                        </span>
                        <span
                          className={
                            satzbauReviews[task.id].isCorrect
                              ? "kg-badge-accent"
                              : "kg-badge-warn"
                          }
                        >
                          {satzbauReviews[task.id].needsReview
                            ? "Değerlendirme Bekliyor"
                            : satzbauReviews[task.id].isCorrect
                            ? "Dilbilgisi Uygun"
                            : "Düzeltme Önerisi Var"}
                        </span>
                      </div>

                      <p className="kg-ai-summary">
                        {satzbauReviews[task.id].feedbackTr}
                      </p>

                      <div className="kg-corrected-box">
                        <div className="kg-section-head">
                          <strong style={{ fontSize: 13 }}>Önerilen Doğru Almanca Cümle:</strong>
                          <GermanSpeakButtons
                            text={satzbauReviews[task.id].correctedDe || satzbauReviews[task.id].correctedSentenceDe || ""}
                            compact
                          />
                        </div>
                        <p lang="de" style={{ margin: 0, fontWeight: 800 }}>
                          {satzbauReviews[task.id].correctedDe || satzbauReviews[task.id].correctedSentenceDe || ""}
                        </p>
                      </div>

                      {satzbauReviews[task.id].alternativeDe && (
                        <div className="kg-corrected-box">
                          <div className="kg-section-head">
                            <strong style={{ fontSize: 13 }}>Alternatif Doğal Sözdizimi:</strong>
                            <GermanSpeakButtons
                              text={satzbauReviews[task.id].alternativeDe!}
                              compact
                            />
                          </div>
                          <p lang="de" style={{ margin: 0, fontWeight: 700 }}>
                            {satzbauReviews[task.id].alternativeDe}
                          </p>
                        </div>
                      )}

                      <p style={{ margin: 0, fontSize: 13 }}>
                        <strong>Dilbilgisi Notu:</strong> {satzbauReviews[task.id].grammarExplanationTr}
                      </p>
                      <p style={{ margin: 0, fontSize: 13 }}>
                        <strong>Kural:</strong> {satzbauReviews[task.id].ruleTipTr}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentExplanation && <AnswerExplanation explanation={currentExplanation} />}
            </div>
            </QuestionVocabularyProvider>
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

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {task && task.module === "vocabulary" && (
                    <button
                      type="button"
                      disabled={explainBusy === task.id}
                      className="kg-btn kg-btn-sm"
                      onClick={() => void handleExplainTask(task, false)}
                    >
                      {(currentResult?.score ?? 0) >= 0.8 ? (
                        <>
                          <HelpCircle size={15} /> {explainBusy === task.id ? "Açıklanıyor…" : "Neden doğru?"}
                        </>
                      ) : (
                        <>
                          <Sparkles size={15} />{" "}
                          {explainBusy === task.id ? "Açıklanıyor…" : "✨ AI ile Hatamı Açıkla"}
                        </>
                      )}
                    </button>
                  )}

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
                </div>
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

      {renderReportModal()}
    </div>
  );
}
