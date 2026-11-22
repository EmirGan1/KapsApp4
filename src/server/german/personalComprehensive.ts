import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import {
  personalModeLabelTr,
  type PersonalComprehensiveReport,
  type PersonalDirection,
  type PersonalExerciseModeId,
  type PersonalQuestion,
  type PersonalQuestionResult,
  type PersonalSessionDTO,
  type PersonalVocabItemDTO,
} from "../../shared/germanPersonal";
import { deterministicShuffle } from "./distractors";
import {
  buildSingleModeQuestion,
  loadPersonalQuestionHistory,
  recordPersonalQuestionHistory,
} from "./personalExercises";
import { listUserPersonalSources, loadUserPersonalVocab } from "./personalStore";

export const DEFAULT_COMPREHENSIVE_BATCH_SIZE = 50;

const COMPREHENSIVE_MODES: Array<Exclude<PersonalExerciseModeId, "matching" | "flashcards">> = [
  "multiple_choice",
  "true_false",
  "translation_de_tr",
  "translation_tr_de",
  "spelling",
  "fill_blank",
  "sentence_construction",
  "contextual",
];

interface ComprehensiveState {
  targetVocabIds: string[];
  batchTargets: string[][];
  batchQuestions: Record<string, PersonalQuestion[]>;
  currentIndex: number;
  extendedMode: boolean;
  passCount: number;
}

/**
 * Creates a full-coverage Comprehensive Test (`Genel Test — Tüm Kelimeler`) covering 100% of active,
 * non-excluded unique vocabulary items across one or multiple selected personal sources.
 * Large sources (e.g. 100, 200, 400+ words) are split into persistent resumable batches (default 50/batch).
 */
export async function createComprehensiveTestSession(
  db: Client,
  input: {
    userId: number;
    sourceIds: string[];
    batchSize?: number;
    extendedMode?: boolean;
    direction?: PersonalDirection;
  },
): Promise<PersonalSessionDTO> {
  const uniqueSourceIds = [...new Set(input.sourceIds.filter((s) => typeof s === "string" && s.trim()))];
  if (!uniqueSourceIds.length) {
    throw new Error("Genel Test için en az bir kaynak seçmelisin.");
  }

  const activeItems = await loadUserPersonalVocab(db, input.userId, {
    sourceIds: uniqueSourceIds,
    activeOnly: true,
    includeExcluded: false,
  });

  // Deduplicate strictly by canonical vocab id across multi-source selection
  const uniqueMap = new Map<string, PersonalVocabItemDTO>();
  for (const it of activeItems) {
    if (!uniqueMap.has(it.id)) uniqueMap.set(it.id, it);
  }
  const allTargets = [...uniqueMap.values()];
  if (!allTargets.length) {
    throw new Error("Seçilen kaynaklarda aktif kelime bulunamadı.");
  }

  const batchSize = Math.max(10, Math.min(100, Number(input.batchSize ?? DEFAULT_COMPREHENSIVE_BATCH_SIZE) || 50));
  const extendedMode = Boolean(input.extendedMode);
  const direction: PersonalDirection = input.direction ?? "mixed";
  const sessionId = randomUUID();
  const seed = `comp:${sessionId}`;

  // Build ordered target list: 100% of unique active items (or 2 passes if extendedMode=true)
  const shuffledPass1 = deterministicShuffle(allTargets, `${seed}:pass1`);
  const orderedIds = shuffledPass1.map((w) => w.id);
  const targetSequenceIds = extendedMode
    ? [...orderedIds, ...deterministicShuffle(orderedIds, `${seed}:pass2`)]
    : orderedIds;

  const batchTargets: string[][] = [];
  for (let i = 0; i < targetSequenceIds.length; i += batchSize) {
    batchTargets.push(targetSequenceIds.slice(i, i + batchSize));
  }

  const recentMap = await loadPersonalQuestionHistory(db, input.userId, orderedIds);
  const firstBatchQuestions = buildComprehensiveBatchQuestions({
    batchVocabIds: batchTargets[0] ?? [],
    vocabById: uniqueMap,
    pool: allTargets,
    batchNumber: 1,
    direction,
    seed,
    recentMap,
  });

  await recordPersonalQuestionHistory(db, input.userId, firstBatchQuestions);

  const state: ComprehensiveState = {
    targetVocabIds: orderedIds,
    batchTargets,
    batchQuestions: { "1": firstBatchQuestions },
    currentIndex: 0,
    extendedMode,
    passCount: extendedMode ? 2 : 1,
  };

  const nowIso = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO german_personal_sessions(
            id, user_id, kind, mode, direction, source_ids_json, filters_json, status,
            total_targets, covered_vocab_ids_json, current_batch, total_batches, batch_size,
            extended_mode, state_json, results_json, created_at, updated_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      sessionId,
      input.userId,
      "comprehensive",
      "comprehensive",
      direction,
      JSON.stringify(uniqueSourceIds),
      JSON.stringify({ extendedMode, batchSize }),
      "active",
      orderedIds.length,
      "[]",
      1,
      batchTargets.length,
      batchSize,
      extendedMode ? 1 : 0,
      JSON.stringify(state),
      "{}",
      nowIso,
      nowIso,
    ],
  });

  return hydratePersonalSession(db, input.userId, sessionId);
}

function buildComprehensiveBatchQuestions(input: {
  batchVocabIds: string[];
  vocabById: Map<string, PersonalVocabItemDTO>;
  pool: PersonalVocabItemDTO[];
  batchNumber: number;
  direction: PersonalDirection;
  seed: string;
  recentMap: Map<string, any[]>;
}): PersonalQuestion[] {
  const questions: PersonalQuestion[] = [];
  for (let i = 0; i < input.batchVocabIds.length; i++) {
    const vid = input.batchVocabIds[i];
    const item = input.vocabById.get(vid);
    if (!item) continue;
    const globalSlot = (input.batchNumber - 1) * 50 + i;
    const mode = COMPREHENSIVE_MODES[globalSlot % COMPREHENSIVE_MODES.length];
    const q = buildSingleModeQuestion({
      item,
      pool: input.pool,
      mode,
      direction: input.direction,
      seed: `${input.seed}:b${input.batchNumber}`,
      recentHistory: input.recentMap.get(vid) ?? [],
      aiContext: null,
      slotIndex: globalSlot,
    });
    questions.push(q);
  }
  return questions;
}

/**
 * Advances a comprehensive test session to the next batch (generating it deterministically on demand).
 */
export async function advanceComprehensiveBatch(
  db: Client,
  userId: number,
  sessionId: string,
): Promise<PersonalSessionDTO> {
  const row = (
    await db.execute({
      sql: "SELECT * FROM german_personal_sessions WHERE id=? AND user_id=?",
      args: [sessionId, userId],
    })
  ).rows[0];
  if (!row) throw new Error("Oturum bulunamadı.");
  if (String(row.kind) !== "comprehensive") {
    throw new Error("Bu işlem yalnızca Genel Test oturumları için geçerlidir.");
  }

  const state = JSON.parse(String(row.state_json || "{}")) as ComprehensiveState;
  const currentBatch = Number(row.current_batch ?? 1);
  const totalBatches = Number(row.total_batches ?? 1);
  const results = JSON.parse(String(row.results_json || "{}")) as Record<string, PersonalQuestionResult>;

  const curBatchQs = state.batchQuestions[String(currentBatch)] ?? [];
  const unansweredInBatch = curBatchQs.filter((q) => !results[q.id]);
  if (unansweredInBatch.length > 0) {
    throw new Error(
      `Sonraki bölüme geçmeden önce bu bölümdeki kalan ${unansweredInBatch.length} soruyu yanıtlamalısın.`,
    );
  }

  if (currentBatch >= totalBatches) {
    return hydratePersonalSession(db, userId, sessionId);
  }

  const nextBatch = currentBatch + 1;
  if (!state.batchQuestions[String(nextBatch)]) {
    const sourceIds = JSON.parse(String(row.source_ids_json || "[]")) as string[];
    const allVocab = await loadUserPersonalVocab(db, userId, {
      sourceIds,
      activeOnly: false,
      includeExcluded: true,
    });
    const vocabById = new Map(allVocab.map((v) => [v.id, v]));
    const nextIds = state.batchTargets[nextBatch - 1] ?? [];
    const recentMap = await loadPersonalQuestionHistory(db, userId, nextIds);
    const nextQs = buildComprehensiveBatchQuestions({
      batchVocabIds: nextIds,
      vocabById,
      pool: allVocab,
      batchNumber: nextBatch,
      direction: (String(row.direction) as PersonalDirection) || "mixed",
      seed: `comp:${sessionId}`,
      recentMap,
    });
    state.batchQuestions[String(nextBatch)] = nextQs;
    await recordPersonalQuestionHistory(db, userId, nextQs);
  }

  state.currentIndex = 0;
  await db.execute({
    sql: "UPDATE german_personal_sessions SET current_batch=?, state_json=?, status='active', updated_at=? WHERE id=? AND user_id=?",
    args: [nextBatch, JSON.stringify(state), new Date().toISOString(), sessionId, userId],
  });

  return hydratePersonalSession(db, userId, sessionId);
}

/**
 * Computes the detailed final report for a Comprehensive Test (or regular practice session),
 * keeping Test Accuracy strictly separate from Source Mastery %.
 */
export async function buildComprehensiveReport(
  db: Client,
  userId: number,
  sessionRow: Record<string, any>,
): Promise<PersonalComprehensiveReport> {
  const sourceIds = JSON.parse(String(sessionRow.source_ids_json || "[]")) as string[];
  const state = JSON.parse(String(sessionRow.state_json || "{}")) as ComprehensiveState & {
    questions?: PersonalQuestion[];
  };
  const results = JSON.parse(String(sessionRow.results_json || "{}")) as Record<
    string,
    PersonalQuestionResult
  >;
  const coveredIds = new Set<string>(
    JSON.parse(String(sessionRow.covered_vocab_ids_json || "[]")) as string[],
  );

  const allQuestions: PersonalQuestion[] =
    String(sessionRow.kind) === "comprehensive"
      ? Object.values(state.batchQuestions ?? {}).flat()
      : Array.isArray(state.questions)
        ? state.questions
        : [];

  const [allVocab, allSources] = await Promise.all([
    loadUserPersonalVocab(db, userId, { activeOnly: false, includeExcluded: true }),
    listUserPersonalSources(db, userId),
  ]);
  const vocabById = new Map(allVocab.map((v) => [v.id, v]));

  let answeredCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  const newlyMasteredMap = new Map<string, { vocabId: string; de: string; tr: string }>();
  const wrongByVocab = new Map<string, number>();
  const modeStats = new Map<PersonalExerciseModeId, { total: number; correct: number }>();

  for (const q of allQuestions) {
    const r = results[q.id];
    if (!r || r.skipped) continue;
    answeredCount++;
    if (r.isCorrect) correctCount++;
    else incorrectCount++;

    const m = modeStats.get(q.mode) ?? { total: 0, correct: 0 };
    m.total++;
    if (r.isCorrect) m.correct++;
    modeStats.set(q.mode, m);

    if (r.masteredNow) {
      const v = vocabById.get(q.vocabId);
      if (v) newlyMasteredMap.set(v.id, { vocabId: v.id, de: v.de, tr: v.tr });
    }
    if (!r.isCorrect) {
      wrongByVocab.set(q.vocabId, (wrongByVocab.get(q.vocabId) ?? 0) + 1);
    }
  }

  const totalTargets = Math.max(
    Number(sessionRow.total_targets ?? 0),
    state.targetVocabIds?.length ?? 0,
  );
  const coveredTargets = coveredIds.size;
  const coveragePercent =
    totalTargets > 0 ? Math.min(100, Math.round((coveredTargets / totalTargets) * 1000) / 10) : 0;
  const testAccuracyPercent =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 1000) / 10 : 0;

  const targetIds = state.targetVocabIds?.length
    ? state.targetVocabIds
    : [...new Set(allQuestions.flatMap((q) => q.vocabIds))];

  const stillLearning: Array<{ vocabId: string; de: string; tr: string; streak: number }> = [];
  for (const vid of targetIds) {
    const v = vocabById.get(vid);
    if (!v) continue;
    if (v.mastery.masteryStatus !== "mastered") {
      stillLearning.push({
        vocabId: v.id,
        de: v.de,
        tr: v.tr,
        streak: v.mastery.consecutiveCorrect,
      });
    }
  }

  const weakestWords = [...wrongByVocab.entries()]
    .map(([vid, cnt]) => {
      const v = vocabById.get(vid);
      return v
        ? {
            vocabId: vid,
            de: v.de,
            tr: v.tr,
            incorrectCount: cnt,
            streak: v.mastery.consecutiveCorrect,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => b.incorrectCount - a.incorrectCount || a.streak - b.streak)
    .slice(0, 15);

  const byMode = [...modeStats.entries()].map(([mode, st]) => ({
    mode,
    labelTr: personalModeLabelTr(mode),
    total: st.total,
    correct: st.correct,
    accuracyPercent: st.total > 0 ? Math.round((st.correct / st.total) * 1000) / 10 : 0,
  }));

  const sourceSet = new Set(sourceIds);
  const sourceMasterySnapshots = allSources
    .filter((s) => sourceSet.has(s.id))
    .map((s) => ({
      sourceId: s.id,
      title: s.title,
      masteredItems: s.masteredItems,
      totalActiveItems: s.totalActiveItems,
      completionPercent: s.completionPercent,
    }));

  let recommendedNextTr =
    "Tüm hedefleri tamamladın! Öğrendiklerini pekiştirmek için yeni bir adaptif pratik oturumu açabilirsin.";
  if (weakestWords.length > 0) {
    recommendedNextTr = `Yanlış yapılan ${weakestWords.length} kelime için Yazım & Aktif Hatırlama veya Bilgi Kartları ile hedefli tekrar yapmanı öneriyoruz.`;
  } else if (stillLearning.length > 0) {
    recommendedNextTr = `Henüz 5/5 ustalaşmamış ${stillLearning.length} kelime kaldı; serilerini tamamlamak için Adaptif Pratik başlatabilirsin.`;
  }

  return {
    totalTargets,
    coveredTargets,
    coveragePercent,
    answeredCount,
    correctCount,
    incorrectCount,
    testAccuracyPercent,
    newlyMastered: [...newlyMasteredMap.values()],
    stillLearning: stillLearning.slice(0, 40),
    weakestWords,
    byMode,
    sourceMasterySnapshots,
    recommendedNextTr,
  };
}

/**
 * Hydrates any personal session (practice or comprehensive) cleanly for resume/rendering.
 */
export async function hydratePersonalSession(
  db: Client,
  userId: number,
  sessionId: string,
): Promise<PersonalSessionDTO> {
  const row = (
    await db.execute({
      sql: "SELECT * FROM german_personal_sessions WHERE id=? AND user_id=?",
      args: [sessionId, userId],
    })
  ).rows[0];
  if (!row) {
    throw new Error("Oturum bulunamadı.");
  }

  const kind = String(row.kind) as "practice" | "comprehensive";
  const currentBatch = Number(row.current_batch ?? 1);
  const state = JSON.parse(String(row.state_json || "{}")) as ComprehensiveState & {
    questions?: PersonalQuestion[];
  };
  const results = JSON.parse(String(row.results_json || "{}")) as Record<
    string,
    PersonalQuestionResult
  >;
  const coveredIds = JSON.parse(String(row.covered_vocab_ids_json || "[]")) as string[];
  const sourceIds = JSON.parse(String(row.source_ids_json || "[]")) as string[];

  const activeQuestions: PersonalQuestion[] =
    kind === "comprehensive"
      ? state.batchQuestions?.[String(currentBatch)] ?? []
      : state.questions ?? [];

  const allVocab = await loadUserPersonalVocab(db, userId, {
    activeOnly: false,
    includeExcluded: true,
  });
  const masteryMap: Record<string, PersonalVocabItemDTO["mastery"]> = {};
  const relevantIds = new Set(activeQuestions.flatMap((q) => q.vocabIds));
  for (const v of allVocab) {
    if (relevantIds.has(v.id)) {
      masteryMap[v.id] = v.mastery;
    }
  }

  const totalTargets = Number(row.total_targets ?? activeQuestions.length);
  const coveredCount = coveredIds.length;
  const coveragePercent =
    totalTargets > 0 ? Math.min(100, Math.round((coveredCount / totalTargets) * 1000) / 10) : 0;

  const status = String(row.status) as PersonalSessionDTO["status"];
  const report =
    status === "completed" ? await buildComprehensiveReport(db, userId, row) : null;

  // Mask expected answers on unanswered questions? Keep flashcard flip support & matching display intact,
  // while server always grades authoritatively from DB-stored question JSON!
  return {
    id: String(row.id),
    kind,
    mode: String(row.mode) as PersonalSessionDTO["mode"],
    direction: String(row.direction) as PersonalDirection,
    sourceIds,
    status,
    totalTargets,
    coveredCount,
    coveragePercent,
    currentBatch,
    totalBatches: Number(row.total_batches ?? 1),
    batchSize: Number(row.batch_size ?? 50),
    extendedMode: Number(row.extended_mode ?? 0) === 1,
    currentIndex: Number(state.currentIndex ?? 0),
    questions: activeQuestions,
    results,
    masteryMap,
    report,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}
