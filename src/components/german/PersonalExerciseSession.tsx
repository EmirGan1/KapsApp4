import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Volume2,
  Pause,
  Flag,
  RotateCcw,
  Award,
  Sparkles,
  Loader2,
  SkipForward,
} from "lucide-react";
import {
  formatTurkishPercent,
  personalModeLabelTr,
  type PersonalQuestion,
  type PersonalQuestionResult,
  type PersonalSessionDTO,
} from "../../shared/germanPersonal";
import { speakGerman } from "./api";
import { MasteryPips } from "./MasteryPips";
import {
  advancePersonalComprehensiveBatch,
  completePersonalSession,
  fetchPersonalSession,
  pausePersonalSession,
  reportPersonalAttempt,
  submitPersonalAnswer,
} from "./personalApi";

const GERMAN_CHARS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];

export function PersonalExerciseSession({
  sessionId,
  initialSession,
  onExit,
  onPracticeWeakWords,
}: {
  sessionId: string;
  initialSession?: PersonalSessionDTO | null;
  onExit: () => void;
  onPracticeWeakWords?: (vocabIds: string[]) => void;
}) {
  const [session, setSession] = useState<PersonalSessionDTO | null>(initialSession ?? null);
  const [loading, setLoading] = useState(!initialSession);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(initialSession?.currentIndex ?? 0);

  // Interactive inputs
  const [textInput, setTextInput] = useState("");
  const [selectedOption, setSelectedOption] = useState("");
  const [tileAnswer, setTileAnswer] = useState<number[]>([]);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [matchSelectedLeft, setMatchSelectedLeft] = useState<number | null>(null);
  const [matchPairs, setMatchPairs] = useState<Record<number, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [reportNotice, setReportNotice] = useState("");
  const touchStartX = useRef<number | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await fetchPersonalSession(sessionId);
      setSession(s);
      // Resume at first unanswered question in active batch
      const firstUnanswered = s.questions.findIndex((q) => !s.results[q.id]);
      setIndex(firstUnanswered >= 0 ? firstUnanswered : Math.min(s.currentIndex, Math.max(0, s.questions.length - 1)));
    } catch (err: any) {
      setError(err?.message || "Oturum yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!initialSession || initialSession.id !== sessionId) {
      void loadSession();
    }
  }, [sessionId, initialSession, loadSession]);

  const currentQuestion: PersonalQuestion | undefined = session?.questions[index];
  const currentResult: PersonalQuestionResult | undefined = currentQuestion
    ? session?.results[currentQuestion.id]
    : undefined;

  // Reset per-question draft inputs when question changes
  useEffect(() => {
    setTextInput("");
    setSelectedOption("");
    setTileAnswer([]);
    setCardFlipped(false);
    setMatchSelectedLeft(null);
    setMatchPairs({});
    setReportNotice("");
  }, [currentQuestion?.id]);

  const handleSubmit = useCallback(
    async (opts?: {
      answer?: string;
      selfAssessment?: "known" | "unknown";
      skip?: boolean;
    }) => {
      if (!session || !currentQuestion || submitting || currentResult) return;

      let finalAnswer = opts?.answer ?? "";
      if (!opts?.skip && !opts?.selfAssessment) {
        if (currentQuestion.mode === "matching") {
          const leftCount = currentQuestion.matchingLeft?.length ?? 0;
          if (Object.keys(matchPairs).length < leftCount) {
            setError("Lütfen tüm kelimeleri eşleştir.");
            return;
          }
          const arr = Array.from({ length: leftCount }, (_, i) => matchPairs[i] ?? "");
          finalAnswer = JSON.stringify(arr);
        } else if (currentQuestion.mode === "sentence_construction") {
          const tiles = currentQuestion.tiles ?? [];
          finalAnswer = tileAnswer.map((idx) => tiles[idx]).join(" ").trim();
        } else if (currentQuestion.options?.length) {
          finalAnswer = opts?.answer ?? selectedOption;
        } else {
          finalAnswer = textInput.trim();
        }

        if (!finalAnswer) {
          setError("Lütfen önce bir yanıt gir veya seç.");
          return;
        }
      }

      setSubmitting(true);
      setError("");
      try {
        const res = await submitPersonalAnswer(session.id, {
          questionId: currentQuestion.id,
          answer: finalAnswer,
          selfAssessment: opts?.selfAssessment ?? null,
          skip: opts?.skip,
          idempotencyKey: `${session.id}:${currentQuestion.id}`,
        });
        setSession(res.session);
      } catch (err: any) {
        setError(err?.message || "Yanıt gönderilemedi.");
      } finally {
        setSubmitting(false);
      }
    },
    [session, currentQuestion, submitting, currentResult, matchPairs, tileAnswer, selectedOption, textInput],
  );

  const handleNextOrFinish = useCallback(async () => {
    if (!session) return;
    setError("");
    if (index + 1 < session.questions.length) {
      setIndex((i) => i + 1);
      return;
    }

    // End of current batch / question set
    const unansweredIdx = session.questions.findIndex((q) => !session.results[q.id]);
    if (unansweredIdx >= 0) {
      setIndex(unansweredIdx);
      setError("Devam etmeden önce yanıtlanmamış soruyu tamamla.");
      return;
    }

    setSubmitting(true);
    try {
      if (session.kind === "comprehensive" && session.currentBatch < session.totalBatches) {
        const nextSess = await advancePersonalComprehensiveBatch(session.id);
        setSession(nextSess);
        setIndex(0);
      } else {
        const completed = await completePersonalSession(session.id);
        setSession(completed);
      }
    } catch (err: any) {
      setError(err?.message || "Oturum ilerletilemedi.");
    } finally {
      setSubmitting(false);
    }
  }, [session, index]);

  const handlePauseAndExit = async () => {
    if (!session) {
      onExit();
      return;
    }
    try {
      await pausePersonalSession(session.id, index);
    } catch {}
    onExit();
  };

  const handleReport = async () => {
    if (!currentResult?.attemptId) return;
    try {
      const res = await reportPersonalAttempt(currentResult.attemptId, "Değerlendirme kontrol talebi");
      setReportNotice(res.messageTr);
      if (session && currentQuestion) {
        setSession({
          ...session,
          results: {
            ...session.results,
            [currentQuestion.id]: { ...currentResult, reported: true },
          },
        });
      }
    } catch (err: any) {
      setError(err?.message || "Bildirim kaydedilemedi.");
    }
  };

  // Desktop keyboard shortcuts for flashcards & next navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!currentQuestion || session?.status === "completed") return;
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";

      if (currentResult && e.key === "Enter" && !inInput) {
        e.preventDefault();
        void handleNextOrFinish();
        return;
      }

      if (currentQuestion.mode === "flashcards" && !currentResult && !inInput) {
        if (e.code === "Space") {
          e.preventDefault();
          setCardFlipped((f) => !f);
        } else if (cardFlipped && e.key === "1") {
          e.preventDefault();
          void handleSubmit({ selfAssessment: "unknown" });
        } else if (cardFlipped && e.key === "2") {
          e.preventDefault();
          void handleSubmit({ selfAssessment: "known" });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentQuestion, currentResult, cardFlipped, session?.status, handleNextOrFinish, handleSubmit]);

  if (loading) {
    return (
      <div className="kg-container">
        <div className="p-8 rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-surface)] flex items-center justify-center gap-3 text-sm font-bold text-[var(--kg-ink-muted)]">
          <Loader2 size={18} className="animate-spin" />
          <span>Kişisel çalışma oturumu hazırlanıyor…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="kg-container">
        <div className="p-6 rounded-2xl border border-[var(--kg-red)] bg-[var(--kg-red-soft)] text-[var(--kg-red-ink)] flex flex-col gap-3">
          <p className="font-bold m-0">{error || "Oturum bulunamadı."}</p>
          <div>
            <button type="button" onClick={onExit} className="kg-btn">
              <ArrowLeft size={16} /> Kişisel Çalışmaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== COMPLETED REPORT VIEW ====================
  if (session.status === "completed" && session.report) {
    const rep = session.report;
    return (
      <div className="kg-container">
        <div className="p-6 rounded-2xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface)] flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--kg-green-ink)]">
                {session.kind === "comprehensive" ? "Genel Test Tamamlandı" : "Pratik Oturumu Tamamlandı"}
              </div>
              <h2 className="text-2xl font-extrabold text-[var(--kg-ink)] mt-0.5">
                {personalModeLabelTr(session.mode)}
              </h2>
            </div>
            <button type="button" onClick={onExit} className="kg-btn">
              <ArrowLeft size={16} /> Kişisel Çalışmaya Dön
            </button>
          </div>

          {/* Primary Metrics — Test Accuracy explicitly separated from Source Mastery */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)]">
              <div className="text-xs font-bold text-[var(--kg-ink-muted)]">Kapsanan Kelime</div>
              <div className="text-2xl font-extrabold text-[var(--kg-ink)] tabular-nums mt-1">
                {rep.coveredTargets} / {rep.totalTargets}
              </div>
              <div className="text-xs font-semibold text-[var(--kg-green-ink)] tabular-nums">
                {formatTurkishPercent(rep.coveragePercent)} kapsam
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)]">
              <div className="text-xs font-bold text-[var(--kg-ink-muted)]">Test Doğruluğu</div>
              <div className="text-2xl font-extrabold text-[var(--kg-blue-ink)] tabular-nums mt-1">
                {formatTurkishPercent(rep.testAccuracyPercent)}
              </div>
              <div className="text-xs font-semibold text-[var(--kg-ink-muted)] tabular-nums">
                {rep.correctCount}D · {rep.incorrectCount}Y
              </div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)]">
              <div className="text-xs font-bold text-[var(--kg-ink-muted)]">Yeni Öğrenilen (5/5)</div>
              <div className="text-2xl font-extrabold text-[var(--kg-green-ink)] tabular-nums mt-1">
                {rep.newlyMastered.length}
              </div>
              <div className="text-xs font-semibold text-[var(--kg-ink-muted)]">Kalıcı ustalık</div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)]">
              <div className="text-xs font-bold text-[var(--kg-ink-muted)]">Hâlâ Çalışılan</div>
              <div className="text-2xl font-extrabold text-[var(--kg-gold-ink)] tabular-nums mt-1">
                {rep.stillLearning.length}
              </div>
              <div className="text-xs font-semibold text-[var(--kg-ink-muted)]">5/5 hedefi sürüyor</div>
            </div>
          </div>

          {/* Separate Source Mastery % (NEVER conflated with test accuracy) */}
          {rep.sourceMasterySnapshots.length > 0 && (
            <div className="p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] flex flex-col gap-2.5">
              <div className="text-xs font-extrabold uppercase tracking-wide text-[var(--kg-ink-muted)]">
                Kaynak Bazlı Kalıcı Ustalık İlerlemesi (5/5 Kuralı)
              </div>
              {rep.sourceMasterySnapshots.map((src) => (
                <div key={src.sourceId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm font-bold text-[var(--kg-ink)]">
                    <span>{src.title}</span>
                    <span className="tabular-nums">
                      {src.masteredItems} / {src.totalActiveItems} kelime öğrenildi —{" "}
                      {formatTurkishPercent(src.completionPercent)}
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[var(--kg-surface)] overflow-hidden border border-[var(--kg-border)]">
                    <div
                      className="h-full bg-[var(--kg-green)] transition-all"
                      style={{ width: `${src.completionPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mode Breakdown */}
          {rep.byMode.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-extrabold text-[var(--kg-ink)]">Alıştırma Türüne Göre Performans</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {rep.byMode.map((m) => (
                  <div
                    key={m.mode}
                    className="p-3 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-[var(--kg-ink)]">{m.labelTr}</span>
                    <span className="font-extrabold tabular-nums text-[var(--kg-blue-ink)]">
                      {m.correct}/{m.total} ({formatTurkishPercent(m.accuracyPercent)})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weakest Words */}
          {rep.weakestWords.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[var(--kg-ink)]">Tekrar Gerektiren Kelimeler</h3>
                {onPracticeWeakWords && (
                  <button
                    type="button"
                    onClick={() => onPracticeWeakWords(rep.weakestWords.map((w) => w.vocabId))}
                    className="kg-btn"
                    style={{ background: "var(--kg-blue)", borderColor: "var(--kg-blue-dark)", color: "#fff" }}
                  >
                    <RotateCcw size={15} /> Bu Kelimeleri Tekrar Çalış
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {rep.weakestWords.map((w) => (
                  <div
                    key={w.vocabId}
                    className="p-3 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-[var(--kg-ink)] truncate">{w.de}</div>
                      <div className="text-xs text-[var(--kg-ink-muted)] truncate">{w.tr}</div>
                    </div>
                    <MasteryPips streak={w.streak} compact />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className="p-4 rounded-xl border border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)] text-sm font-semibold flex items-start gap-2.5">
            <Sparkles size={18} className="shrink-0 mt-0.5" />
            <span>{rep.recommendedNextTr}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="kg-container">
        <div className="p-6 rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-surface)] flex flex-col gap-3">
          <p className="text-sm text-[var(--kg-ink-muted)] m-0">Bu oturumda gösterilecek soru kalmadı.</p>
          <button type="button" onClick={onExit} className="kg-btn self-start">
            <ArrowLeft size={16} /> Geri Dön
          </button>
        </div>
      </div>
    );
  }

  const answeredInBatch = session.questions.filter((q) => Boolean(session.results[q.id])).length;
  const currentWordMastery = session.masteryMap[currentQuestion.vocabId];

  return (
    <div className="kg-container">
      {/* Top Session HUD */}
      <div className="p-4 rounded-2xl border border-[var(--kg-border)] bg-[var(--kg-surface)] flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handlePauseAndExit()}
              className="min-h-[38px] px-3 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-xs font-bold text-[var(--kg-ink)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Pause size={14} /> Kaydet ve Duraklat
            </button>
            <div>
              <div className="text-sm font-extrabold text-[var(--kg-ink)]">
                {personalModeLabelTr(session.mode)}
              </div>
              <div className="text-xs font-semibold text-[var(--kg-ink-muted)] tabular-nums">
                {session.kind === "comprehensive"
                  ? `Bölüm ${session.currentBatch}/${session.totalBatches} · Toplam Kapsam: ${session.coveredCount}/${session.totalTargets} kelime (${formatTurkishPercent(session.coveragePercent)})`
                  : `Soru ${index + 1} / ${session.questions.length} · ${answeredInBatch} yanıtlandı`}
              </div>
            </div>
          </div>

          {currentWordMastery && (
            <MasteryPips
              streak={currentWordMastery.consecutiveCorrect}
              status={currentWordMastery.masteryStatus}
            />
          )}
        </div>

        {/* Batch progress bar */}
        <div className="w-full h-2 rounded-full bg-[var(--kg-surface-soft)] overflow-hidden">
          <div
            className="h-full bg-[var(--kg-blue)] transition-all"
            style={{
              width: `${Math.round(((index + (currentResult ? 1 : 0)) / Math.max(1, session.questions.length)) * 100)}%`,
            }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-[var(--kg-red)] bg-[var(--kg-red-soft)] text-[var(--kg-red-ink)] text-sm font-semibold" role="alert">
          {error}
        </div>
      )}

      {/* Main Question Stage */}
      <div className="p-5 sm:p-6 rounded-2xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface)] flex flex-col gap-5">
        {/* Mode + CEFR meta row */}
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-[var(--kg-ink-muted)]">
          <span>
            {personalModeLabelTr(currentQuestion.mode)} · CEFR{" "}
            {currentQuestion.cefrLevel === "UNKNOWN" ? "Belirsiz" : currentQuestion.cefrLevel}
          </span>
          {currentQuestion.displayMeta.audioText && currentQuestion.direction !== "tr_de" && (
            <button
              type="button"
              onClick={() => speakGerman(currentQuestion.displayMeta.audioText!)}
              className="inline-flex items-center gap-1.5 min-h-[34px] px-3 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-[var(--kg-blue)] font-bold cursor-pointer"
            >
              <Volume2 size={14} /> Dinle
            </button>
          )}
        </div>

        {/* Contextual Dialogue Passage (Mode J) */}
        {currentQuestion.contextPassage && (
          <div className="p-4 rounded-xl border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] whitespace-pre-line text-sm leading-relaxed font-medium text-[var(--kg-ink)]">
            {currentQuestion.contextPassage}
          </div>
        )}

        {/* ==================== MODE A: FLASHCARDS ==================== */}
        {currentQuestion.mode === "flashcards" ? (
          <div
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null || !cardFlipped || currentResult) return;
              const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
              touchStartX.current = null;
              if (dx > 75) void handleSubmit({ selfAssessment: "known" });
              else if (dx < -75) void handleSubmit({ selfAssessment: "unknown" });
            }}
            className="flex flex-col gap-4"
          >
            <div
              onClick={() => setCardFlipped((f) => !f)}
              className="min-h-[210px] p-6 rounded-2xl border-2 border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] flex flex-col items-center justify-center text-center gap-3 cursor-pointer select-none"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--kg-ink-muted)]">
                {cardFlipped ? "Arka Yüz (Cevap)" : "Ön Yüz — Çevirmek için tıkla veya Boşluk tuşuna bas"}
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-[var(--kg-ink)]">
                {cardFlipped ? currentQuestion.expectedAnswer : currentQuestion.prompt}
              </div>
              {cardFlipped && (
                <div className="flex flex-col gap-1 text-xs text-[var(--kg-ink-muted)] max-w-md">
                  {(currentQuestion.displayMeta.article || currentQuestion.displayMeta.plural || currentQuestion.displayMeta.grammar) && (
                    <div className="font-bold text-[var(--kg-ink)]">
                      {[
                        currentQuestion.displayMeta.article ? `Artikel: ${currentQuestion.displayMeta.article}` : "",
                        currentQuestion.displayMeta.plural ? `Çoğul: ${currentQuestion.displayMeta.plural}` : "",
                        currentQuestion.displayMeta.grammar || "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                  {currentQuestion.displayMeta.exampleDe && (
                    <div className="italic">
                      „{currentQuestion.displayMeta.exampleDe}“
                      {currentQuestion.displayMeta.exampleTr ? ` — ${currentQuestion.displayMeta.exampleTr}` : ""}
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  speakGerman(currentQuestion.displayMeta.audioText || currentQuestion.displayMeta.de);
                }}
                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface)] text-xs font-bold text-[var(--kg-blue)] cursor-pointer"
              >
                <Volume2 size={14} /> Almanca Seslendir
              </button>
            </div>

            {!currentResult && (
              <div className="flex flex-col gap-3">
                {/* Explicit typed recall option */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && textInput.trim()) {
                        e.preventDefault();
                        void handleSubmit();
                      }
                    }}
                    placeholder="Aktif hatırlama için cevabı yazarak kontrol et…"
                    className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm text-[var(--kg-ink)]"
                  />
                  <button
                    type="button"
                    disabled={submitting || !textInput.trim()}
                    onClick={() => void handleSubmit()}
                    className="kg-btn"
                    style={{ background: "var(--kg-blue)", borderColor: "var(--kg-blue-dark)", color: "#fff" }}
                  >
                    Yazılı Kontrol Et
                  </button>
                </div>

                {/* Explicit self-assessment controls (only active after reveal; flipping alone never gives credit!) */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={submitting || !cardFlipped}
                    onClick={() => void handleSubmit({ selfAssessment: "unknown" })}
                    className="min-h-[46px] px-4 rounded-xl border border-[var(--kg-red)] bg-[var(--kg-red-soft)] text-[var(--kg-red-ink)] text-sm font-extrabold disabled:opacity-45 cursor-pointer"
                  >
                    1 · Tekrar Çalış (Seri 0)
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !cardFlipped}
                    onClick={() => void handleSubmit({ selfAssessment: "known" })}
                    className="min-h-[46px] px-4 rounded-xl border border-[var(--kg-green)] bg-[var(--kg-green-soft)] text-[var(--kg-green-ink)] text-sm font-extrabold disabled:opacity-45 cursor-pointer"
                  >
                    2 · Biliyordum (+1 Seri)
                  </button>
                </div>
                <p className="text-[11px] text-[var(--kg-ink-muted)] text-center m-0">
                  Kartı yalnızca çevirmek ustalık puanı vermez. Yazılı kontrol veya açık öz değerlendirme seçmelisin.
                </p>
              </div>
            )}
          </div>
        ) : currentQuestion.mode === "matching" ? (
          /* ==================== MODE B: MATCHING ==================== */
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-lg font-extrabold text-[var(--kg-ink)]">{currentQuestion.prompt}</h3>
              {currentQuestion.subPrompt && (
                <p className="text-xs text-[var(--kg-ink-muted)] mt-1 mb-0">{currentQuestion.subPrompt}</p>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Left German column */}
              <div className="flex flex-col gap-2">
                {(currentQuestion.matchingLeft ?? []).map((leftText, lIdx) => {
                  const isActive = matchSelectedLeft === lIdx;
                  const paired = matchPairs[lIdx];
                  const pairStatus = currentResult?.pairResults?.[lIdx];
                  return (
                    <button
                      key={lIdx}
                      type="button"
                      disabled={Boolean(currentResult)}
                      onClick={() => setMatchSelectedLeft(lIdx)}
                      className={`min-h-[48px] px-3.5 py-2 rounded-xl border text-left text-sm font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        pairStatus === true
                          ? "border-[var(--kg-green)] bg-[var(--kg-green-soft)] text-[var(--kg-green-ink)]"
                          : pairStatus === false
                            ? "border-[var(--kg-red)] bg-[var(--kg-red-soft)] text-[var(--kg-red-ink)]"
                            : isActive
                              ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)]"
                              : paired
                                ? "border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink)]"
                                : "border-[var(--kg-border)] bg-[var(--kg-surface)] text-[var(--kg-ink)]"
                      }`}
                    >
                      <span>{leftText}</span>
                      {paired && (
                        <span className="text-xs font-semibold text-[var(--kg-blue-ink)] truncate max-w-[45%]">
                          → {paired}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right Turkish column */}
              <div className="flex flex-col gap-2">
                {(currentQuestion.matchingRight ?? []).map((rightText, rIdx) => {
                  const usedByIdx = Object.entries(matchPairs).find(([, v]) => v === rightText)?.[0];
                  return (
                    <button
                      key={rIdx}
                      type="button"
                      disabled={Boolean(currentResult)}
                      onClick={() => {
                        if (matchSelectedLeft === null) return;
                        const next = { ...matchPairs };
                        // Free if already assigned elsewhere
                        for (const [k, v] of Object.entries(next)) {
                          if (v === rightText) delete next[Number(k)];
                        }
                        next[matchSelectedLeft] = rightText;
                        setMatchPairs(next);
                        // Advance selection to next unpaired left item
                        const totalLeft = currentQuestion.matchingLeft?.length ?? 0;
                        let nextLeft: number | null = null;
                        for (let i = 0; i < totalLeft; i++) {
                          if (next[i] === undefined) {
                            nextLeft = i;
                            break;
                          }
                        }
                        setMatchSelectedLeft(nextLeft);
                      }}
                      className={`min-h-[48px] px-3.5 py-2 rounded-xl border text-left text-sm font-semibold cursor-pointer transition-colors ${
                        usedByIdx !== undefined
                          ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)]"
                          : "border-[var(--kg-border)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink)] hover:border-[var(--kg-blue)]"
                      }`}
                    >
                      {rightText}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* ==================== MODES C–J ==================== */
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[var(--kg-ink)] leading-snug">
                {currentQuestion.prompt}
              </h3>
              {currentQuestion.subPrompt && (
                <p className="text-xs sm:text-sm font-medium text-[var(--kg-ink-muted)] mt-1.5 mb-0">
                  {currentQuestion.subPrompt}
                </p>
              )}
            </div>

            {/* Multiple Choice / True-False / Choice Fill-Blank / Contextual */}
            {currentQuestion.options && currentQuestion.options.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentQuestion.options.map((opt) => {
                  const isSelected = selectedOption === opt;
                  const isCorrectOpt = currentResult && opt === currentQuestion.expectedAnswer;
                  const isWrongPicked =
                    currentResult && !currentResult.isCorrect && currentResult.userAnswer === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={Boolean(currentResult) || submitting}
                      onClick={() => setSelectedOption(opt)}
                      className={`min-h-[52px] px-4 py-3 rounded-xl border text-left text-sm font-bold cursor-pointer transition-colors ${
                        isCorrectOpt
                          ? "border-[var(--kg-green)] bg-[var(--kg-green-soft)] text-[var(--kg-green-ink)]"
                          : isWrongPicked
                            ? "border-[var(--kg-red)] bg-[var(--kg-red-soft)] text-[var(--kg-red-ink)]"
                            : isSelected
                              ? "border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)]"
                              : "border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-[var(--kg-ink)] hover:border-[var(--kg-blue)]"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : currentQuestion.tiles && currentQuestion.tiles.length > 0 ? (
              /* Sentence Construction Interactive Tiles */
              <div className="flex flex-col gap-3">
                <div className="min-h-[58px] p-3 rounded-xl border-2 border-dashed border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] flex flex-wrap gap-2 items-center">
                  {tileAnswer.length === 0 ? (
                    <span className="text-xs font-semibold text-[var(--kg-ink-muted)]">
                      Aşağıdaki kelimelere sırayla dokunarak cümleyi oluştur…
                    </span>
                  ) : (
                    tileAnswer.map((tileIdx, pos) => (
                      <button
                        key={`${tileIdx}-${pos}`}
                        type="button"
                        disabled={Boolean(currentResult)}
                        onClick={() => setTileAnswer((prev) => prev.filter((_, i) => i !== pos))}
                        className="min-h-[38px] px-3 rounded-lg border border-[var(--kg-blue)] bg-[var(--kg-blue-soft)] text-[var(--kg-blue-ink)] text-sm font-bold cursor-pointer"
                      >
                        {currentQuestion.tiles![tileIdx]}
                      </button>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {currentQuestion.tiles.map((tok, tIdx) => {
                    const used = tileAnswer.includes(tIdx);
                    return (
                      <button
                        key={`${tok}-${tIdx}`}
                        type="button"
                        disabled={used || Boolean(currentResult)}
                        onClick={() => setTileAnswer((prev) => [...prev, tIdx])}
                        className={`min-h-[40px] px-3.5 rounded-xl border text-sm font-bold cursor-pointer ${
                          used
                            ? "opacity-35 border-[var(--kg-border)] bg-[var(--kg-surface-soft)]"
                            : "border-[var(--kg-border-strong)] bg-[var(--kg-surface)] text-[var(--kg-ink)] hover:border-[var(--kg-blue)]"
                        }`}
                      >
                        {tok}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Typed Translation / Strict Spelling / Typed Fill-Blank */
              <div className="flex flex-col gap-2.5">
                <input
                  type="text"
                  value={textInput}
                  disabled={Boolean(currentResult) || submitting}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !currentResult && textInput.trim()) {
                      e.preventDefault();
                      void handleSubmit();
                    }
                  }}
                  placeholder={
                    currentQuestion.direction === "de_tr"
                      ? "Türkçe çevirini yaz…"
                      : "Almanca yanıtını yaz…"
                  }
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full min-h-[48px] px-4 rounded-xl border-2 border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-base font-semibold text-[var(--kg-ink)] focus:outline-none focus:border-[var(--kg-blue)]"
                />
                {currentQuestion.direction !== "de_tr" && !currentResult && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[var(--kg-ink-muted)] mr-1">
                      Özel harfler:
                    </span>
                    {GERMAN_CHARS.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => setTextInput((prev) => prev + ch)}
                        className="min-w-[34px] min-h-[34px] rounded-lg border border-[var(--kg-border-strong)] bg-[var(--kg-surface-soft)] text-sm font-bold text-[var(--kg-ink)] hover:border-[var(--kg-blue)] cursor-pointer"
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Result Feedback Banner */}
        {currentResult && (
          <div
            className={`p-4 rounded-xl border flex flex-col gap-2.5 ${
              currentResult.isCorrect
                ? "border-[var(--kg-green)] bg-[var(--kg-green-soft)] text-[var(--kg-green-ink)]"
                : "border-[var(--kg-red)] bg-[var(--kg-red-soft)] text-[var(--kg-red-ink)]"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-extrabold text-sm">
                {currentResult.isCorrect ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <span>
                  {currentResult.skipped
                    ? "Atlandı (Seri değişmedi)"
                    : currentResult.isCorrect
                      ? "Doğru Yanıt!"
                      : "Yanlış Yanıt"}
                </span>
                {currentResult.masteredNow && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--kg-surface)] text-[var(--kg-green-ink)] text-xs font-extrabold">
                    <Award size={14} /> 5/5 Öğrenildi!
                  </span>
                )}
              </div>
              <span className="text-xs font-extrabold tabular-nums">
                Seri: {currentResult.streakBefore}/5 → {currentResult.streakAfter}/5
              </span>
            </div>

            <p className="text-sm font-semibold m-0">{currentResult.feedbackTr}</p>

            {currentResult.naturalAlternative && (
              <p className="text-xs font-semibold m-0">
                Doğal alternatif: <strong>{currentResult.naturalAlternative}</strong>
              </p>
            )}

            {currentResult.wordBreakdown && currentResult.wordBreakdown.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {currentResult.wordBreakdown.map((wb, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-lg bg-[var(--kg-surface)] text-[var(--kg-ink)] text-xs font-semibold"
                  >
                    <strong>{wb.token}</strong>: {wb.noteTr}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {currentResult.attemptId && !currentResult.reported ? (
                <button
                  type="button"
                  onClick={() => void handleReport()}
                  className="inline-flex items-center gap-1.5 text-xs font-bold underline cursor-pointer bg-transparent border-0 text-current p-0"
                >
                  <Flag size={13} /> Değerlendirmeyi Bildir / İtiraz Et
                </button>
              ) : (
                <span className="text-xs font-semibold">
                  {reportNotice || (currentResult.reported ? "Bildirim kaydedildi." : "")}
                </span>
              )}
              {currentResult.aiEvaluated && (
                <span className="text-[11px] font-bold opacity-80">Yapay zekâ anlam değerlendirmesi</span>
              )}
            </div>
          </div>
        )}

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[var(--kg-border)]">
          {!currentResult ? (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit({ skip: true })}
                className="kg-btn"
              >
                <SkipForward size={15} /> Atla (Puan Yok)
              </button>

              {currentQuestion.mode !== "flashcards" && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                  className="kg-btn"
                  style={{ background: "var(--kg-blue)", borderColor: "var(--kg-blue-dark)", color: "#fff" }}
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  <span>Kontrol Et</span>
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleNextOrFinish()}
                className="kg-btn"
                style={{ background: "var(--kg-green)", borderColor: "var(--kg-green-dark)", color: "#fff" }}
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                <span>
                  {index + 1 < session.questions.length
                    ? "Sonraki Soru"
                    : session.kind === "comprehensive" && session.currentBatch < session.totalBatches
                      ? `Sonraki Bölüme Geç (${session.currentBatch + 1}/${session.totalBatches})`
                      : "Oturumu Tamamla ve Sonucu Gör"}
                </span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
