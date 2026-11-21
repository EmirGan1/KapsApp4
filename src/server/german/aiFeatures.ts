import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import {
  directionLabelTr,
  isCefrLevel,
  type CefrLevel,
  type StudyDirection,
} from "../../shared/germanActivities";
import { buildActivities } from "./activities";
import { auditTaskDeterministically, getDisabledFingerprints } from "./auditor";
import { gradeAnswer } from "./cefr";
import { validateTask, type Task, type Vocabulary } from "./learning";
import { resolvePronunciation, type PronunciationGuide } from "./pronunciation";
import { buildAICacheKey, runGermanAI } from "./provider";
import { loadDeduplicatedWordsWithMastery, type WordWithMastery } from "./store";

export interface MistakeExplanationResponse {
  headlineTr: string;
  whyWrongOrRightTr: string;
  correctMeaningTr: string;
  ruleTr: string;
  example: { de: string; tr: string };
  memoryTipTr: string;
  detailedNoteTr?: string;
  possibleQuestionIssue: boolean;
  cached: boolean;
  provider: string;
  fallbackUsed: boolean;
}

export async function explainAttemptWithAI(
  db: Client,
  input: {
    userId: number;
    task: Task;
    studentAnswer: string;
    isCorrect: boolean;
    detailed?: boolean;
    wordMeta?: Vocabulary | null;
  },
): Promise<MistakeExplanationResponse> {
  const { task, studentAnswer, isCorrect, detailed = false, wordMeta } = input;
  const level = task.level || wordMeta?.level || "A1";

  // Check if underlying task itself has deterministic issues first so we NEVER falsely lecture the student!
  const deterministicIssues = wordMeta
    ? auditTaskDeterministically(task, [wordMeta])
    : [];
  const hasRejectIssue = deterministicIssues.some((i) => i.severity === "reject");

  const levelTone =
    level === "A1" || level === "A2"
      ? "Keep Turkish explanation very clear, beginner-friendly, and concise (1-2 crisp sentences per section)."
      : `Provide nuanced Turkish explanation suited for CEFR ${level}.`;

  try {
    const res = await runGermanAI<
      Omit<MistakeExplanationResponse, "cached" | "provider" | "fallbackUsed">
    >(
      `Explain this German exercise result to a Turkish learner. ${levelTone} If the question key itself appears ambiguous or flawed against German grammar or the student answer is actually an acceptable synonym, set possibleQuestionIssue=true and state honestly that the question may be faulty instead of saying the learner is wrong. Return ONLY JSON: {"headlineTr":string,"whyWrongOrRightTr":string,"correctMeaningTr":string,"ruleTr":string,"example":{"de":string,"tr":string},"memoryTipTr":string,"detailedNoteTr":string,"possibleQuestionIssue":boolean}. ${detailed ? "Include a deeper grammar comparison and contrast in detailedNoteTr." : ""}`,
      {
        level,
        exerciseType: task.type,
        direction: task.direction,
        isCorrect,
        prompt: task.prompt,
        passage: task.passage,
        options: task.options,
        expectedAnswer: task.answer,
        alternatives: task.alternatives,
        studentAnswer,
        wordMeta: wordMeta
          ? {
              de: wordMeta.de,
              tr: wordMeta.tr,
              article: wordMeta.article,
              plural: wordMeta.plural,
              grammar: wordMeta.grammar,
              exampleDe: wordMeta.exampleDe,
              exampleTr: wordMeta.exampleTr,
            }
          : null,
        deterministicAuditWarnings: deterministicIssues,
      },
      {
        queue: "explain",
        feature: "mistake_explain",
        sourceId: task.id,
        cacheKey: buildAICacheKey({
          op: "explain",
          fp: task.fingerprint,
          prompt: task.prompt,
          expected: task.answer,
          ans: studentAnswer.trim().toLocaleLowerCase("de"),
          isCorrect,
          detailed,
          level,
        }),
        contentVersion: "v1",
        promptVersion: "v1",
        userId: input.userId,
        maxTokens: detailed ? 1400 : 950,
        db,
        validate: (raw: any) => {
          if (!raw || typeof raw !== "object") return null;
          if (
            typeof raw.headlineTr !== "string" ||
            typeof raw.whyWrongOrRightTr !== "string" ||
            typeof raw.correctMeaningTr !== "string" ||
            typeof raw.ruleTr !== "string" ||
            !raw.example ||
            typeof raw.example.de !== "string" ||
            typeof raw.example.tr !== "string" ||
            typeof raw.memoryTipTr !== "string"
          ) {
            return null;
          }
          return {
            headlineTr: raw.headlineTr.trim().slice(0, 180),
            whyWrongOrRightTr: raw.whyWrongOrRightTr.trim().slice(0, 700),
            correctMeaningTr: raw.correctMeaningTr.trim().slice(0, 400),
            ruleTr: raw.ruleTr.trim().slice(0, 600),
            example: {
              de: raw.example.de.trim().slice(0, 260),
              tr: raw.example.tr.trim().slice(0, 260),
            },
            memoryTipTr: raw.memoryTipTr.trim().slice(0, 400),
            detailedNoteTr:
              typeof raw.detailedNoteTr === "string"
                ? raw.detailedNoteTr.trim().slice(0, 900)
                : undefined,
            possibleQuestionIssue: Boolean(raw.possibleQuestionIssue || hasRejectIssue),
          };
        },
      },
    );

    return {
      ...res.value,
      possibleQuestionIssue: Boolean(res.value.possibleQuestionIssue || hasRejectIssue),
      cached: res.cached,
      provider: res.provider,
      fallbackUsed: false,
    };
  } catch {
    // Graceful deterministic educational fallback when AI is offline
    const refDe = wordMeta?.de || task.answer;
    const refTr = wordMeta?.tr || task.answer;
    const rule =
      wordMeta?.grammar ||
      task.explanation ||
      (task.type === "article"
        ? `Bu ismin artikeli "${task.answer}" olarak ezberlenmelidir.`
        : `Doğru kalıp: ${task.answer}`);
    return {
      headlineTr: hasRejectIssue
        ? "Bu soruda tutarsızlık olabilir"
        : isCorrect
          ? "Neden Doğru?"
          : "Kısa Açıklama (Çevrimdışı Özet)",
      whyWrongOrRightTr: hasRejectIssue
        ? "Bu sorunun seçenek veya cevap anahtarında teknik bir tutarsızlık tespit edildi; istersen 'Bu Soruda Hata Var' ile bildirebilirsin."
        : isCorrect
          ? `Verdiğin "${studentAnswer}" yanıtı ${level} seviyesindeki doğru karşılıkla birebir örtüşüyor.`
          : `Senin yanıtın ("${studentAnswer}") yerine beklenen ifade "${task.answer}" idi.`,
      correctMeaningTr: `${refDe} — ${refTr}`,
      ruleTr: rule,
      example: {
        de: wordMeta?.exampleDe || refDe,
        tr: wordMeta?.exampleTr || refTr,
      },
      memoryTipTr: wordMeta?.article
        ? `Artikeli kelimeyle birlikte tek parça hâlinde tekrar et: "${wordMeta.de}".`
        : `Doğru ifadeyi yüksek sesle 2 kez tekrar etmek hatırlamayı hızlandırır.`,
      possibleQuestionIssue: hasRejectIssue,
      cached: false,
      provider: "fallback",
      fallbackUsed: true,
    };
  }
}

export interface SessionPerformanceReview {
  overallSummaryTr: string;
  strongestAreas: string[];
  areasNeedingPractice: string[];
  topActions: string[];
  recommendedFollowUp: {
    titleTr: string;
    reasonTr: string;
    suggestedActivity: string;
    levels: CefrLevel[];
  };
  limitedEvidence: boolean;
  metrics: {
    evaluatedCount: number;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
    accuracy: number;
    weakWords: Array<{ de: string; tr: string }>;
    strongWords: Array<{ de: string; tr: string }>;
    errorTypes: Record<string, number>;
  };
  cached: boolean;
  provider: string;
  fallbackUsed: boolean;
}

export async function generateSessionPerformanceReview(
  db: Client,
  input: {
    userId: number;
    sessionId: string;
    forceRefresh?: boolean;
  },
): Promise<SessionPerformanceReview> {
  if (!input.forceRefresh) {
    const cachedRow = await db.execute({
      sql: "SELECT metrics_snapshot, review_json, limited_evidence, provider FROM german_session_reviews WHERE session_id=? AND user_id=?",
      args: [input.sessionId, input.userId],
    });
    if (cachedRow.rows[0]) {
      const review = JSON.parse(String(cachedRow.rows[0].review_json));
      const metrics = JSON.parse(String(cachedRow.rows[0].metrics_snapshot));
      return {
        ...review,
        metrics,
        limitedEvidence: Number(cachedRow.rows[0].limited_evidence) === 1,
        cached: true,
        provider: String(cachedRow.rows[0].provider || "cache"),
        fallbackUsed: false,
      };
    }
  }

  const sessRes = await db.execute({
    sql: "SELECT * FROM german_sessions WHERE id=? AND user_id=?",
    args: [input.sessionId, input.userId],
  });
  const s = sessRes.rows[0];
  if (!s) throw new Error("Çalışma oturumu bulunamadı.");

  const tasks = JSON.parse(String(s.tasks ?? "[]")) as Task[];
  const results = JSON.parse(String(s.results ?? "{}")) as Record<
    string,
    { score: number | null; skipped?: boolean; pending?: boolean }
  >;
  const filters = JSON.parse(String(s.filters ?? "{}"));
  const { uniqueWords } = await loadDeduplicatedWordsWithMastery(db, input.userId, false);
  const wordById = new Map(uniqueWords.map((w) => [w.id, w]));

  const evaluated = tasks.filter(
    (t) => results[t.id] && results[t.id].score !== null && !results[t.id].skipped,
  );
  const correctTasks = evaluated.filter((t) => (results[t.id]?.score ?? 0) >= 0.8);
  const wrongTasks = evaluated.filter((t) => (results[t.id]?.score ?? 0) < 0.8);
  const skippedCount = tasks.filter((t) => results[t.id]?.skipped).length;
  const accuracy = evaluated.length
    ? Math.round((correctTasks.length / evaluated.length) * 100)
    : 0;

  const weakWords: Array<{ de: string; tr: string }> = [];
  const strongWords: Array<{ de: string; tr: string }> = [];
  const seenWeak = new Set<string>();
  const seenStrong = new Set<string>();
  const errorTypes: Record<string, number> = {};

  for (const t of wrongTasks) {
    errorTypes[t.type] = (errorTypes[t.type] ?? 0) + 1;
    for (const wid of t.vocabularyIds ?? []) {
      const w = wordById.get(wid);
      if (w && !seenWeak.has(w.id)) {
        seenWeak.add(w.id);
        weakWords.push({ de: w.de, tr: w.tr });
      }
    }
  }
  for (const t of correctTasks) {
    for (const wid of t.vocabularyIds ?? []) {
      const w = wordById.get(wid);
      if (w && !seenWeak.has(w.id) && !seenStrong.has(w.id)) {
        seenStrong.add(w.id);
        strongWords.push({ de: w.de, tr: w.tr });
      }
    }
  }

  const metrics = {
    evaluatedCount: evaluated.length,
    correctCount: correctTasks.length,
    wrongCount: wrongTasks.length,
    skippedCount,
    accuracy,
    weakWords: weakWords.slice(0, 8),
    strongWords: strongWords.slice(0, 8),
    errorTypes,
  };

  const limitedEvidence = evaluated.length < 2;
  const sessionLevels: CefrLevel[] =
    Array.isArray(filters.levels) && filters.levels.length
      ? filters.levels.filter((l: unknown): l is CefrLevel => isCefrLevel(l))
      : ["A1"];

  const topWeakType = Object.entries(errorTypes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "mixed";

  const deterministicFallback = (): SessionPerformanceReview => {
    const strongest = strongWords.length
      ? [`Doğru bildiğin kelimeler: ${strongWords.slice(0, 4).map((w) => w.de).join(", ")}`]
      : ["Bu oturumu başlatarak pratik düzenini korudun."];
    const needing = weakWords.length
      ? [
          `Tekrar gerektiren kelimeler: ${weakWords.slice(0, 4).map((w) => w.de).join(", ")}`,
          ...(topWeakType !== "mixed" ? [`En çok hata çıkan soru türü: ${topWeakType}`] : []),
        ]
      : limitedEvidence
        ? ["Daha ayrıntılı analiz için en az 3–5 soruyu değerlendirmiş olman önerilir."]
        : ["Bu oturumdaki değerlendirilen tüm soruları doğru yanıtladın."];

    return {
      overallSummaryTr: limitedEvidence
        ? `Bu oturumda yalnızca ${evaluated.length} değerlendirilmiş soru bulunduğundan sınırlı kanıtla kısa bir değerlendirme üretildi.`
        : `${evaluated.length} soruda %${accuracy} doğruluk (${correctTasks.length} doğru, ${wrongTasks.length} yanlış, ${skippedCount} atlanan) elde ettin.`,
      strongestAreas: strongest,
      areasNeedingPractice: needing,
      topActions: [
        weakWords.length
          ? `Yanıldığın ${weakWords.slice(0, 3).map((w) => w.de).join(", ")} kelimelerini sesli dinleyip pekiştir.`
          : "Öğrendiklerini kalıcılaştırmak için ters yön pekiştirmesini tamamla.",
        topWeakType === "article"
          ? "İsimleri 'der / die / das' artikelleriyle birlikte tek parça hâlinde tekrar et."
          : "Her gün kısa ama düzenli bir pratik oturumu yap.",
        "Hatalı soruları bitirdikten sonra Bana Özel Pekiştirme oluştur.",
      ],
      recommendedFollowUp: {
        titleTr: weakWords.length ? "Hatalara Odaklı Pekiştirme" : "Ters Yön Pekiştirme",
        reasonTr: weakWords.length
          ? "Bu oturumda zorlandığın kelimeleri farklı soru tipleriyle pekiştirir."
          : "Aktif hatırlamayı güçlendirmek için ters dil yönünde alıştırma sunar.",
        suggestedActivity: weakWords.length ? "mistake_review" : "mixed",
        levels: sessionLevels,
      },
      limitedEvidence,
      metrics,
      cached: false,
      provider: "fallback",
      fallbackUsed: true,
    };
  };

  if (evaluated.length === 0) {
    return deterministicFallback();
  }

  try {
    const res = await runGermanAI<
      Pick<
        SessionPerformanceReview,
        "overallSummaryTr" | "strongestAreas" | "areasNeedingPractice" | "topActions" | "recommendedFollowUp"
      >
    >(
      'Analyze ONLY the provided real session metrics in Turkish. Never invent scores, unseen exercises, or fake comparisons. If limitedEvidence is true, explicitly note that the session was very short and evidence is limited. Keep feedback motivating, concrete, and strictly grounded in the JSON metrics. Return ONLY JSON: {"overallSummaryTr":string,"strongestAreas":string[],"areasNeedingPractice":string[],"topActions":string[],"recommendedFollowUp":{"titleTr":string,"reasonTr":string,"suggestedActivity":"mistake_review"|"article"|"conjugation"|"gap"|"sentence_translation"|"mixed","levels":string[]}}.',
      {
        module: s.module,
        levels: sessionLevels,
        direction: filters.direction ?? "tr_de",
        limitedEvidence,
        metrics,
      },
      {
        queue: "explain",
        feature: "session_review",
        sourceId: input.sessionId,
        cacheKey: buildAICacheKey({ op: "session_review", sessionId: input.sessionId, metrics }),
        contentVersion: "v1",
        promptVersion: "v1",
        userId: input.userId,
        bypassCache: input.forceRefresh,
        maxTokens: 1200,
        db,
        validate: (raw: any) => {
          if (!raw || typeof raw !== "object") return null;
          if (typeof raw.overallSummaryTr !== "string" || !raw.overallSummaryTr.trim()) return null;
          if (!Array.isArray(raw.strongestAreas) || !Array.isArray(raw.areasNeedingPractice)) return null;
          if (!Array.isArray(raw.topActions)) return null;
          const rf = raw.recommendedFollowUp ?? {};
          return {
            overallSummaryTr: raw.overallSummaryTr.trim().slice(0, 600),
            strongestAreas: raw.strongestAreas.map(String).slice(0, 4),
            areasNeedingPractice: raw.areasNeedingPractice.map(String).slice(0, 4),
            topActions: raw.topActions.map(String).slice(0, 3),
            recommendedFollowUp: {
              titleTr: String(rf.titleTr || "Kişisel Pekiştirme").slice(0, 120),
              reasonTr: String(rf.reasonTr || "Bu oturumdaki performansa göre önerildi.").slice(0, 280),
              suggestedActivity: String(rf.suggestedActivity || "mixed"),
              levels: sessionLevels,
            },
          };
        },
      },
    );

    const nowIso = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO german_session_reviews(
              session_id, user_id, metrics_snapshot, review_json, limited_evidence,
              provider, model, content_version, created_at
            ) VALUES(?,?,?,?,?,?,?,'v1',?)
            ON CONFLICT(session_id) DO UPDATE SET
              metrics_snapshot=excluded.metrics_snapshot,
              review_json=excluded.review_json,
              limited_evidence=excluded.limited_evidence,
              provider=excluded.provider,
              model=excluded.model,
              created_at=excluded.created_at`,
      args: [
        input.sessionId,
        input.userId,
        JSON.stringify(metrics),
        JSON.stringify(res.value),
        limitedEvidence ? 1 : 0,
        res.provider,
        res.model,
        nowIso,
      ],
    });

    return {
      ...res.value,
      metrics,
      limitedEvidence,
      cached: res.cached,
      provider: res.provider,
      fallbackUsed: false,
    };
  } catch {
    return deterministicFallback();
  }
}

export async function generatePersonalizedReinforcement(
  db: Client,
  input: {
    userId: number;
    levels: CefrLevel[];
    direction?: StudyDirection;
    includeMasteredReview?: boolean;
    parentSessionId?: string;
    limit?: number;
    onProgress?: (stage: string, percent: number) => Promise<void>;
  },
): Promise<{
  sessionId: string;
  taskCount: number;
  aiGeneratedCount: number;
  fallbackUsed: boolean;
  focusSummaryTr: string;
}> {
  const allowedLevels = [...new Set(input.levels.filter((l) => isCefrLevel(l)))];
  const targetLevels: CefrLevel[] = allowedLevels.length ? allowedLevels : ["A1"];
  const targetDir: StudyDirection = input.direction ?? "mixed";
  const limit = Math.min(12, Math.max(6, input.limit ?? 10));

  await input.onProgress?.("loading_vocabulary", 25);
  const [{ uniqueWords }, disabledSet, attRows] = await Promise.all([
    loadDeduplicatedWordsWithMastery(db, input.userId, false),
    getDisabledFingerprints(db),
    db.execute({
      sql: "SELECT word_id, exercise_type, is_correct, created_at FROM german_attempts WHERE user_id=? ORDER BY created_at DESC LIMIT 200",
      args: [input.userId],
    }),
  ]);

  const scopedWords = uniqueWords.filter((w) =>
    targetLevels.includes(w.level as CefrLevel),
  );
  if (!scopedWords.length) {
    throw new Error(`Seçili seviyeler (${targetLevels.join(", ")}) için kelime bulunamadı.`);
  }

  const wordErrors = new Map<string, number>();
  const typeErrors = new Map<string, number>();
  for (const r of attRows.rows) {
    if (Number(r.is_correct) === 0) {
      const wid = String(r.word_id);
      const et = String(r.exercise_type);
      wordErrors.set(wid, (wordErrors.get(wid) ?? 0) + 1);
      typeErrors.set(et, (typeErrors.get(et) ?? 0) + 1);
    }
  }

  // Score priority words strictly inside targetLevels
  const prioritized = [...scopedWords].sort((a, b) => {
    const aScore =
      (wordErrors.get(a.id) ?? 0) * 10 +
      a.mastery.totalIncorrect * 4 +
      (a.mastery.masteryStatus === "almost_mastered" ? 5 : 0) +
      (a.mastery.masteryStatus === "mastered" ? (input.includeMasteredReview ? -2 : -50) : 0);
    const bScore =
      (wordErrors.get(b.id) ?? 0) * 10 +
      b.mastery.totalIncorrect * 4 +
      (b.mastery.masteryStatus === "almost_mastered" ? 5 : 0) +
      (b.mastery.masteryStatus === "mastered" ? (input.includeMasteredReview ? -2 : -50) : 0);
    return bScore - aScore;
  });

  const focusWords = prioritized.slice(0, Math.min(12, prioritized.length));
  const mistakeIds = new Set(
    focusWords
      .filter((w) => w.mastery.totalIncorrect > 0 || (wordErrors.get(w.id) ?? 0) > 0)
      .map((w) => w.id),
  );

  // Build reliable deterministic foundation
  const deterministicPool = buildActivities(focusWords, "mixed", targetDir, {
    mistakeWordIds: mistakeIds,
    distractorWords: scopedWords,
    isMistakeReview: mistakeIds.size > 0,
    limit,
  }).filter((t) => !disabledSet.has(t.fingerprint));

  let aiValidatedTasks: Task[] = [];
  let fallbackUsed = false;

  // Attempt contextual AI reinforcement items for top weak words, validated via 8-step safety pipeline
  try {
    const topTargetWords = focusWords.slice(0, 6);
    const weakTypes = [...typeErrors.entries()]
      .sort((a, b) => b[1] - a[1])
      .map((e) => e[0])
      .slice(0, 3);

    await input.onProgress?.("generating_ai", 45);
    const aiRes = await runGermanAI<{ tasks: any[] }>(
      `Create up to 4 personalized German reinforcement tasks strictly within CEFR ${targetLevels.join(", ")} using ONLY the provided targetWords (exact IDs required). Target direction: ${directionLabelTr(targetDir)}. Prioritize weak exercise types: ${weakTypes.join(", ") || "choice, gap, article, translation"}. Return ONLY JSON: {"tasks":[{"module":"vocabulary","type":"choice"|"gap"|"article"|"translation"|"sentence_translation","part":1,"level":"${targetLevels[0]}","direction":"de_tr"|"tr_de"|"de_only","prompt":string,"passage":string,"options":string[],"answer":string,"alternatives":string[],"explanation":string,"vocabularyIds":[string],"evidence":""}]}. NEVER return bare A/B/1 labels as answer or options. For multiple-choice, options must be unique and contain the exact answer string.`,
      {
        levels: targetLevels,
        direction: targetDir,
        weakTypes,
        targetWords: topTargetWords.map((w) => ({
          id: w.id,
          de: w.de,
          tr: w.tr,
          level: w.level,
          pos: w.pos,
          article: w.article,
          exampleDe: w.exampleDe,
          exampleTr: w.exampleTr,
          totalIncorrect: w.mastery.totalIncorrect,
          streak: w.mastery.consecutiveCorrect,
        })),
      },
      {
        queue: "reinforcement",
        feature: "personalized_reinforcement",
        sourceId: `u${input.userId}:${targetLevels.join(",")}`,
        userId: input.userId,
        maxTokens: 2000,
        bypassCache: true,
        db,
        validate: (raw: any) =>
          raw && typeof raw === "object" && Array.isArray(raw.tasks)
            ? { tasks: raw.tasks }
            : null,
      },
    );

    await input.onProgress?.("validating_questions", 70);
    const seenPrompts = new Set<string>();
    const targetWordMap = new Map(topTargetWords.map((w) => [w.id, w]));

    for (const rawTask of aiRes.value.tasks.slice(0, 6)) {
      // 8-step validation before publishing to learner session:
      // 1. Structure + vocabularyIds belong strictly to allowed targetWords & CEFR levels
      if (!rawTask || typeof rawTask !== "object") continue;
      const vid = Array.isArray(rawTask.vocabularyIds) ? rawTask.vocabularyIds[0] : null;
      const matched = typeof vid === "string" ? targetWordMap.get(vid) : undefined;
      if (!matched || !targetLevels.includes(matched.level as CefrLevel)) continue;

      const normalizedCandidate: any = {
        ...rawTask,
        id: randomUUID(),
        module: "vocabulary",
        part: 1,
        level: matched.level,
        direction:
          rawTask.direction === "de_tr" ||
          rawTask.direction === "tr_de" ||
          rawTask.direction === "de_only"
            ? rawTask.direction
            : targetDir === "mixed"
              ? "de_tr"
              : targetDir,
        prompt: typeof rawTask.prompt === "string" ? rawTask.prompt : "",
        passage: typeof rawTask.passage === "string" ? rawTask.passage : "",
        answer: typeof rawTask.answer === "string" ? rawTask.answer : "",
        explanation: typeof rawTask.explanation === "string" ? rawTask.explanation : "",
        topic: matched.topic,
        evidence: "",
        alternatives: Array.isArray(rawTask.alternatives) ? rawTask.alternatives : [],
        options: Array.isArray(rawTask.options) ? rawTask.options : [],
        vocabularyIds: [matched.id],
        fingerprint: randomUUID(),
        interaction: {
          wordMeta: {
            de: matched.de,
            tr: matched.tr,
            article: matched.article || undefined,
            topic: matched.topic || undefined,
            grammar: matched.grammar || undefined,
            exampleDe: matched.exampleDe || undefined,
            exampleTr: matched.exampleTr || undefined,
            pronunciation: matched.pronunciation,
          },
        },
      };

      // 2-5. Core validateTask + deterministic quality audit
      const valid = validateTask(normalizedCandidate, scopedWords);
      if (!valid) continue;
      if (disabledSet.has(valid.fingerprint)) continue;
      const detIssues = auditTaskDeterministically(valid, scopedWords);
      if (detIssues.some((i) => i.severity === "reject")) continue;

      // 6. Single unambiguous correct option when multiple-choice
      if (valid.options.length > 0) {
        const matchCount = valid.options.filter((opt) =>
          gradeAnswer({
            type: valid.type,
            answer: valid.answer,
            alternatives: valid.alternatives,
            hasOptions: true,
            direction: valid.direction,
            userAnswer: opt,
          }),
        ).length;
        if (matchCount !== 1) continue;
      }

      // 7-8. Deduplicate prompt
      const promptKey = valid.prompt.trim().toLowerCase();
      if (seenPrompts.has(promptKey)) continue;
      seenPrompts.add(promptKey);

      aiValidatedTasks.push(valid);
      if (aiValidatedTasks.length >= 4) break;
    }
  } catch {
    fallbackUsed = true;
  }

  // Merge AI tasks cleanly with deterministic tasks up to limit without duplicate prompts/words overcrowding
  const finalTasks: Task[] = [...aiValidatedTasks];
  const usedPrompts = new Set(aiValidatedTasks.map((t) => t.prompt.trim().toLowerCase()));
  for (const dt of deterministicPool) {
    if (finalTasks.length >= limit) break;
    const pk = dt.prompt.trim().toLowerCase();
    if (usedPrompts.has(pk)) continue;
    usedPrompts.add(pk);
    finalTasks.push(dt);
  }

  if (!finalTasks.length) {
    throw new Error("Kişiselleştirilmiş pekiştirme görevleri oluşturulamadı.");
  }

  const sessionId = randomUUID();
  const start = new Date();
  const filters = {
    levels: targetLevels,
    activity: "personalized_reinforcement",
    direction: targetDir,
    wordIds: [...new Set(finalTasks.flatMap((t) => t.vocabularyIds))],
    reviewMode: Boolean(input.includeMasteredReview && mistakeIds.size === 0),
    aiGeneratedCount: aiValidatedTasks.length,
    parentSessionId: input.parentSessionId ?? undefined,
  };

  await input.onProgress?.("saving_session", 90);
  await db.execute({
    sql: `INSERT INTO german_sessions(
            id, user_id, module, mode, tasks, started_at, deadline, filters, parent_session_id, reinforcement_direction
          ) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    args: [
      sessionId,
      input.userId,
      "vocabulary",
      "practice",
      JSON.stringify(finalTasks),
      start.toISOString(),
      new Date(start.getTime() + 20 * 60000).toISOString(),
      JSON.stringify(filters),
      input.parentSessionId ?? null,
      targetDir,
    ],
  });

  const focusSummaryTr =
    mistakeIds.size > 0
      ? `${targetLevels.join(", ")} seviyesindeki ${mistakeIds.size} hatalı/zorlanılan kelimeye göre hazırlandı.`
      : `${targetLevels.join(", ")} seviyesindeki öncelikli kelimelere göre hazırlandı.`;

  return {
    sessionId,
    taskCount: finalTasks.length,
    aiGeneratedCount: aiValidatedTasks.length,
    fallbackUsed,
    focusSummaryTr,
  };
}

export interface VocabularyCardDetail {
  id: string;
  de: string;
  tr: string;
  level: string;
  pos?: string;
  article?: string;
  plural?: string;
  topic: string;
  grammar: string;
  exampleDe?: string;
  exampleTr?: string;
  extraExample?: { de: string; tr: string } | null;
  grammarNoteTr?: string;
  usageTipTr?: string;
  conjugationSummaryTr?: string;
  pronunciation: PronunciationGuide;
  enrichedByAI: boolean;
}

export async function getOrEnrichVocabularyCard(
  db: Client,
  input: {
    userId: number;
    word: WordWithMastery;
    requestAnotherExample?: boolean;
  },
): Promise<VocabularyCardDetail> {
  const { word } = input;
  const basePronunciation = word.pronunciation ?? resolvePronunciation(word.de);
  const needsEnrichment =
    Boolean(input.requestAnotherExample) ||
    !word.exampleDe ||
    !word.exampleTr ||
    !word.grammar;

  const base: VocabularyCardDetail = {
    id: word.id,
    de: word.de,
    tr: word.tr,
    level: word.level,
    pos: word.pos,
    article: word.article || undefined,
    plural: word.plural || undefined,
    topic: word.topic,
    grammar: word.grammar,
    exampleDe: word.exampleDe,
    exampleTr: word.exampleTr,
    pronunciation: basePronunciation,
    extraExample: null,
    enrichedByAI: false,
  };

  if (!needsEnrichment && !input.requestAnotherExample) {
    const cached = await db.execute({
      sql: "SELECT enriched_json FROM german_vocabulary_cards WHERE word_id=?",
      args: [word.id],
    });
    if (cached.rows[0]) {
      try {
        const parsed = JSON.parse(String(cached.rows[0].enriched_json));
        return {
          ...base,
          extraExample: parsed.extraExample ?? null,
          grammarNoteTr: parsed.grammarNoteTr ?? undefined,
          usageTipTr: parsed.usageTipTr ?? undefined,
          conjugationSummaryTr: parsed.conjugationSummaryTr ?? undefined,
          enrichedByAI: true,
        };
      } catch {}
    }
    return base;
  }

  // Only enrich missing fields or generate a fresh extra example; NEVER overwrite verified word fields!
  try {
    const res = await runGermanAI<{
      extraExample: { de: string; tr: string };
      grammarNoteTr: string;
      usageTipTr: string;
      conjugationSummaryTr?: string;
    }>(
      `Provide helpful CEFR ${word.level} study card enrichment in Turkish for this German vocabulary item. Never change the headword, Turkish meaning, article, or CEFR level. Return ONLY JSON: {"extraExample":{"de":string,"tr":string},"grammarNoteTr":string,"usageTipTr":string,"conjugationSummaryTr":string}. Keep example sentence strictly within CEFR ${word.level}.`,
      {
        de: word.de,
        tr: word.tr,
        level: word.level,
        pos: word.pos,
        existingExampleDe: word.exampleDe,
        differentFromExisting: Boolean(input.requestAnotherExample),
      },
      {
        queue: "card",
        feature: "vocab_card",
        sourceId: word.id,
        cacheKey: buildAICacheKey({
          op: "vocab_card",
          id: word.id,
          de: word.de,
          variant: input.requestAnotherExample ? "alt" : "base",
        }),
        contentVersion: "v1",
        promptVersion: "v1",
        userId: input.userId,
        bypassCache: Boolean(input.requestAnotherExample),
        maxTokens: 700,
        db,
        validate: (raw: any) => {
          if (!raw || typeof raw !== "object") return null;
          if (!raw.extraExample || typeof raw.extraExample.de !== "string" || typeof raw.extraExample.tr !== "string") {
            return null;
          }
          return {
            extraExample: {
              de: raw.extraExample.de.trim().slice(0, 260),
              tr: raw.extraExample.tr.trim().slice(0, 260),
            },
            grammarNoteTr: String(raw.grammarNoteTr ?? "").trim().slice(0, 320),
            usageTipTr: String(raw.usageTipTr ?? "").trim().slice(0, 280),
            conjugationSummaryTr:
              typeof raw.conjugationSummaryTr === "string" && raw.conjugationSummaryTr.trim()
                ? raw.conjugationSummaryTr.trim().slice(0, 240)
                : undefined,
          };
        },
      },
    );

    const payload = res.value;
    await db.execute({
      sql: `INSERT INTO german_vocabulary_cards(word_id, content_version, enriched_json, provider, model, validation_status, updated_at)
            VALUES(?, 'v1', ?, ?, ?, 'validated', ?)
            ON CONFLICT(word_id) DO UPDATE SET
              enriched_json=excluded.enriched_json,
              provider=excluded.provider,
              model=excluded.model,
              updated_at=excluded.updated_at`,
      args: [word.id, JSON.stringify(payload), res.provider, res.model, new Date().toISOString()],
    });

    return {
      ...base,
      exampleDe: base.exampleDe || payload.extraExample.de,
      exampleTr: base.exampleTr || payload.extraExample.tr,
      extraExample: payload.extraExample,
      grammarNoteTr: payload.grammarNoteTr || undefined,
      usageTipTr: payload.usageTipTr || undefined,
      conjugationSummaryTr: payload.conjugationSummaryTr,
      enrichedByAI: true,
    };
  } catch {
    return base;
  }
}
