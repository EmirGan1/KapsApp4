import { createHash, randomUUID } from "node:crypto";
import type { Client, Transaction } from "@libsql/client";
import {
  MASTERY_TARGET,
  masteryStatusFromStreak,
  type MasteryStatus,
} from "../../shared/germanActivities";
import type {
  PersonalCefrLevel,
  PersonalCefrSummary,
  PersonalMasterySnapshot,
  PersonalSourceSummary,
  PersonalSourceType,
  PersonalSyncStatus,
  PersonalVocabItemDTO,
} from "../../shared/germanPersonal";
import { canonicalWordKey, normalizeText } from "./cefr";
import { masteryToMemory } from "./learning";

export function canonicalPersonalKey(de: string): string {
  return canonicalWordKey(
    de
      .normalize("NFC")
      .replace(/^(?:der|die|das)\s+/iu, "")
      .replace(/\s*\((?:pl\.?|plural)[^)]*\)/giu, "")
      .replace(/\|/gu, "")
      .trim(),
  );
}

export function normalizeMeaningRoot(tr: string): string {
  const first = tr
    .normalize("NFC")
    .split(/\s*[;,/]\s*/u)[0]
    ?.replace(/\([^)]*\)/gu, "")
    .trim()
    .toLocaleLowerCase("tr");
  return (first || tr.normalize("NFC").trim().toLocaleLowerCase("tr"))
    .replace(/[.!?]+$/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Stable identity key that merges surface capitalization/article variants of the same word + meaning,
 * while preserving distinct senses of homographs (e.g. "das Schloss — kale" vs "das Schloss — kilit").
 */
export function buildPersonalSenseKey(de: string, tr: string): string {
  const ck = canonicalPersonalKey(de);
  const trRoot = normalizeMeaningRoot(tr);
  return `${ck}::${trRoot}`;
}

export function stablePersonalVocabId(userId: number, senseKey: string): string {
  const hash = createHash("sha256")
    .update(`pv:${userId}:${senseKey.normalize("NFC")}`)
    .digest("hex")
    .slice(0, 24);
  return `pv_${hash}`;
}

export function sha256Text(text: string): string {
  return createHash("sha256").update(text.normalize("NFC")).digest("hex");
}

async function safeAlter(db: Client, sql: string) {
  try {
    await db.execute(sql);
  } catch (err: any) {
    const msg = String(err?.message ?? "");
    if (!/duplicate column|already exists/iu.test(msg)) {
      throw err;
    }
  }
}

export async function initPersonalGermanSchema(db: Client): Promise<void> {
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS german_personal_sources(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL,
        raw_text TEXT NOT NULL DEFAULT '',
        file_name TEXT,
        file_mime TEXT,
        file_size INTEGER NOT NULL DEFAULT 0,
        gdoc_id TEXT,
        gdoc_url TEXT,
        gdoc_revision_id TEXT,
        content_hash TEXT NOT NULL DEFAULT '',
        auto_sync_enabled INTEGER NOT NULL DEFAULT 0,
        sync_interval_min INTEGER NOT NULL DEFAULT 15,
        sync_status TEXT NOT NULL DEFAULT 'idle',
        sync_error TEXT,
        sync_retry_count INTEGER NOT NULL DEFAULT 0,
        next_sync_at TEXT,
        last_synced_at TEXT,
        cefr_summary_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      "CREATE INDEX IF NOT EXISTS german_personal_sources_user ON german_personal_sources(user_id, deleted_at, updated_at)",
      "CREATE INDEX IF NOT EXISTS german_personal_sources_sync ON german_personal_sources(source_type, auto_sync_enabled, deleted_at, next_sync_at)",
      `CREATE TABLE IF NOT EXISTS german_personal_source_versions(
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        revision_id TEXT,
        content_hash TEXT NOT NULL,
        added_count INTEGER NOT NULL DEFAULT 0,
        updated_count INTEGER NOT NULL DEFAULT 0,
        removed_count INTEGER NOT NULL DEFAULT 0,
        total_active INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS german_personal_versions_source ON german_personal_source_versions(source_id, created_at)",
      `CREATE TABLE IF NOT EXISTS german_personal_vocab(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        canonical_key TEXT NOT NULL,
        sense_key TEXT NOT NULL,
        de TEXT NOT NULL,
        tr TEXT NOT NULL,
        alternatives_json TEXT NOT NULL DEFAULT '[]',
        article TEXT NOT NULL DEFAULT '',
        plural TEXT NOT NULL DEFAULT '',
        part_of_speech TEXT NOT NULL DEFAULT '',
        reflexive INTEGER NOT NULL DEFAULT 0,
        separable INTEGER NOT NULL DEFAULT 0,
        preposition TEXT NOT NULL DEFAULT '',
        required_case TEXT NOT NULL DEFAULT '',
        example_de TEXT NOT NULL DEFAULT '',
        example_tr TEXT NOT NULL DEFAULT '',
        cefr_level TEXT NOT NULL DEFAULT 'UNKNOWN',
        cefr_confidence REAL NOT NULL DEFAULT 0.5,
        cefr_source TEXT NOT NULL DEFAULT 'heuristic',
        category TEXT NOT NULL DEFAULT 'Genel',
        notes TEXT NOT NULL DEFAULT '',
        uncertain INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, sense_key)
      )`,
      "CREATE INDEX IF NOT EXISTS german_personal_vocab_user_ck ON german_personal_vocab(user_id, canonical_key)",
      `CREATE TABLE IF NOT EXISTS german_personal_source_items(
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        vocab_id TEXT NOT NULL,
        original_excerpt TEXT NOT NULL DEFAULT '',
        line_number INTEGER NOT NULL DEFAULT 0,
        excluded INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(source_id, vocab_id)
      )`,
      "CREATE INDEX IF NOT EXISTS german_personal_items_source ON german_personal_source_items(source_id, user_id, active, excluded)",
      "CREATE INDEX IF NOT EXISTS german_personal_items_vocab ON german_personal_source_items(vocab_id, user_id, active)",
      `CREATE TABLE IF NOT EXISTS german_personal_mastery_meta(
        user_id INTEGER NOT NULL,
        vocab_id TEXT NOT NULL,
        needs_review INTEGER NOT NULL DEFAULT 0,
        next_review_at TEXT,
        last_mode TEXT,
        last_prompt_fingerprint TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(user_id, vocab_id)
      )`,
      `CREATE TABLE IF NOT EXISTS german_personal_google_tokens(
        user_id INTEGER PRIMARY KEY,
        email TEXT NOT NULL DEFAULT '',
        encrypted_tokens TEXT NOT NULL,
        scope TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'connected',
        last_error TEXT,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS german_personal_sessions(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        mode TEXT NOT NULL,
        direction TEXT NOT NULL DEFAULT 'mixed',
        source_ids_json TEXT NOT NULL DEFAULT '[]',
        filters_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active',
        total_targets INTEGER NOT NULL DEFAULT 0,
        covered_vocab_ids_json TEXT NOT NULL DEFAULT '[]',
        current_batch INTEGER NOT NULL DEFAULT 1,
        total_batches INTEGER NOT NULL DEFAULT 1,
        batch_size INTEGER NOT NULL DEFAULT 50,
        extended_mode INTEGER NOT NULL DEFAULT 0,
        state_json TEXT NOT NULL DEFAULT '{}',
        results_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      )`,
      "CREATE INDEX IF NOT EXISTS german_personal_sessions_user ON german_personal_sessions(user_id, status, updated_at)",
      `CREATE TABLE IF NOT EXISTS german_personal_attempts(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        vocab_id TEXT NOT NULL,
        idempotency_key TEXT UNIQUE NOT NULL,
        mode TEXT NOT NULL,
        direction TEXT NOT NULL,
        prompt_fingerprint TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        user_answer TEXT NOT NULL,
        expected_answer TEXT NOT NULL,
        is_correct INTEGER NOT NULL,
        self_assessed INTEGER NOT NULL DEFAULT 0,
        credit_granted INTEGER NOT NULL DEFAULT 0,
        explanation_json TEXT NOT NULL DEFAULT '{}',
        streak_before INTEGER NOT NULL DEFAULT 0,
        streak_after INTEGER NOT NULL DEFAULT 0,
        mastered_now INTEGER NOT NULL DEFAULT 0,
        reported INTEGER NOT NULL DEFAULT 0,
        report_note TEXT,
        created_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS german_personal_attempts_vocab ON german_personal_attempts(user_id, vocab_id, created_at)",
      `CREATE TABLE IF NOT EXISTS german_personal_question_history(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        vocab_id TEXT NOT NULL,
        mode TEXT NOT NULL,
        direction TEXT NOT NULL,
        context_tag TEXT NOT NULL DEFAULT '',
        fingerprint TEXT NOT NULL,
        prompt_text TEXT NOT NULL,
        distractors_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS german_personal_qhist_user ON german_personal_question_history(user_id, vocab_id, created_at)",
    ],
    "write",
  );

  // Additive columns on german_oauth so the existing Google callback safely supports per-user personal OAuth
  await safeAlter(db, "ALTER TABLE german_oauth ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1");
  await safeAlter(db, "ALTER TABLE german_oauth ADD COLUMN flow_type TEXT NOT NULL DEFAULT 'admin'");
}

export function emptyMasterySnapshot(wordId: string): PersonalMasterySnapshot {
  return {
    wordId,
    consecutiveCorrect: 0,
    totalCorrect: 0,
    totalIncorrect: 0,
    masteryStatus: "not_learned",
    needsReview: false,
    lastPracticedAt: null,
    masteredAt: null,
    nextReviewAt: null,
  };
}

/**
 * Computes next spaced-review timestamp based on streak & correctness.
 */
export function computeNextReviewIso(
  streak: number,
  isCorrect: boolean,
  mastered: boolean,
  now = new Date(),
): string {
  const hours = !isCorrect
    ? 4
    : mastered
      ? 24 * 14
      : streak === 1
        ? 12
        : streak === 2
          ? 24
          : streak === 3
            ? 48
            : 72;
  return new Date(now.getTime() + hours * 3600 * 1000).toISOString();
}

/**
 * Synchronizes a user's mastery update between a standard KapsGerman word and any matching
 * personal vocabulary item (same user + same canonical key + compatible meaning), and vice versa.
 */
export async function syncCanonicalMasteryAcrossModulesTx(
  tx: Transaction,
  input: {
    userId: number;
    sourceWordId: string;
    canonicalKey: string;
    tr: string;
    consecutiveCorrect: number;
    totalCorrect: number;
    totalIncorrect: number;
    masteryStatus: MasteryStatus;
    lastPracticedAt: string | null;
    masteredAt: string | null;
  },
): Promise<void> {
  if (!input.canonicalKey) return;
  const targetTrRoot = normalizeMeaningRoot(input.tr);
  const mirrorIds = new Set<string>();

  // 1. Find matching personal vocab items for this user
  const pvRows = await tx.execute({
    sql: "SELECT id, tr, cefr_level FROM german_personal_vocab WHERE user_id=? AND canonical_key=?",
    args: [input.userId, input.canonicalKey],
  });
  for (const r of pvRows.rows) {
    const id = String(r.id);
    if (id === input.sourceWordId) continue;
    const rowTrRoot = normalizeMeaningRoot(String(r.tr ?? ""));
    if (rowTrRoot === targetTrRoot || rowTrRoot.includes(targetTrRoot) || targetTrRoot.includes(rowTrRoot)) {
      mirrorIds.add(id);
    }
  }

  // 2. Find matching standard german_words entries
  const gwRows = await tx.execute({
    sql: "SELECT id, data, cefr_level FROM german_words WHERE active=1 AND (canonical_key=? OR canonical_key LIKE ?)",
    args: [input.canonicalKey, `% ${input.canonicalKey}`],
  });
  for (const r of gwRows.rows) {
    const id = String(r.id);
    if (id === input.sourceWordId) continue;
    try {
      const parsed = JSON.parse(String(r.data ?? "{}"));
      const gwCk = canonicalPersonalKey(String(parsed.de ?? ""));
      if (gwCk !== input.canonicalKey) continue;
      const gwTrRoot = normalizeMeaningRoot(String(parsed.tr ?? ""));
      if (gwTrRoot === targetTrRoot || gwTrRoot.includes(targetTrRoot) || targetTrRoot.includes(gwTrRoot)) {
        mirrorIds.add(id);
      }
    } catch {}
  }

  for (const mirrorId of mirrorIds) {
    await tx.execute({
      sql: `INSERT INTO german_mastery(
              user_id, word_id, cefr_level, consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at
            ) VALUES(?, ?, 'UNCLASSIFIED', ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, word_id) DO UPDATE SET
              consecutive_correct=excluded.consecutive_correct,
              total_correct=MAX(german_mastery.total_correct, excluded.total_correct),
              total_incorrect=MAX(german_mastery.total_incorrect, excluded.total_incorrect),
              mastery_status=excluded.mastery_status,
              last_practiced_at=excluded.last_practiced_at,
              mastered_at=COALESCE(german_mastery.mastered_at, excluded.mastered_at)`,
      args: [
        input.userId,
        mirrorId,
        input.consecutiveCorrect,
        input.totalCorrect,
        input.totalIncorrect,
        input.masteryStatus,
        input.lastPracticedAt,
        input.masteredAt,
      ],
    });
  }
}

/**
 * Atomic, idempotent global 5-consecutive-correct mastery engine for Personalized Learning.
 * Enforces:
 * - Idempotency key prevents duplicate credit from double clicks / concurrent submissions.
 * - Identical immediate prompt fingerprint cannot grant consecutive credit twice in a row.
 * - creditEligible=false (e.g., flashcard view/flip/skip) NEVER grants mastery credit.
 * - Incorrect answer resets consecutive_correct to 0 (preserving totalCorrect/totalIncorrect history
 *   and marking needs_review=1) while leaving other words untouched.
 * - Synchronizes mastery with standard KapsGerman german_mastery for shared canonical terms.
 */
export async function applyPersonalMasteryAttemptTx(
  tx: Transaction,
  input: {
    userId: number;
    sessionId: string;
    vocabId: string;
    canonicalKey: string;
    tr: string;
    cefrLevel: PersonalCefrLevel;
    idempotencyKey: string;
    mode: string;
    direction: string;
    promptFingerprint: string;
    promptText: string;
    userAnswer: string;
    expectedAnswer: string;
    isCorrect: boolean;
    selfAssessed?: boolean;
    creditEligible?: boolean;
    isMasteredReview?: boolean;
    explanation?: Record<string, unknown>;
    now?: Date;
  },
): Promise<{
  attemptId: string;
  alreadyApplied: boolean;
  creditGranted: boolean;
  streakBefore: number;
  streakAfter: number;
  masteredNow: boolean;
  mastery: PersonalMasterySnapshot;
}> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  // Check idempotency first
  const existingAttempt = await tx.execute({
    sql: "SELECT id, credit_granted, streak_before, streak_after, mastered_now FROM german_personal_attempts WHERE idempotency_key=?",
    args: [input.idempotencyKey],
  });

  const masteryRow = await tx.execute({
    sql: "SELECT consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at FROM german_mastery WHERE user_id=? AND word_id=?",
    args: [input.userId, input.vocabId],
  });
  const metaRow = await tx.execute({
    sql: "SELECT needs_review, next_review_at, last_prompt_fingerprint FROM german_personal_mastery_meta WHERE user_id=? AND vocab_id=?",
    args: [input.userId, input.vocabId],
  });

  const currentMastery: PersonalMasterySnapshot = masteryRow.rows[0]
    ? {
        wordId: input.vocabId,
        consecutiveCorrect: Number(masteryRow.rows[0].consecutive_correct ?? 0),
        totalCorrect: Number(masteryRow.rows[0].total_correct ?? 0),
        totalIncorrect: Number(masteryRow.rows[0].total_incorrect ?? 0),
        masteryStatus: String(masteryRow.rows[0].mastery_status ?? "not_learned") as MasteryStatus,
        needsReview: Number(metaRow.rows[0]?.needs_review ?? 0) === 1,
        lastPracticedAt: masteryRow.rows[0].last_practiced_at
          ? String(masteryRow.rows[0].last_practiced_at)
          : null,
        masteredAt: masteryRow.rows[0].mastered_at
          ? String(masteryRow.rows[0].mastered_at)
          : null,
        nextReviewAt: metaRow.rows[0]?.next_review_at
          ? String(metaRow.rows[0].next_review_at)
          : null,
      }
    : emptyMasterySnapshot(input.vocabId);

  if (existingAttempt.rows[0]) {
    const row = existingAttempt.rows[0];
    return {
      attemptId: String(row.id),
      alreadyApplied: true,
      creditGranted: Number(row.credit_granted ?? 0) === 1,
      streakBefore: Number(row.streak_before ?? currentMastery.consecutiveCorrect),
      streakAfter: Number(row.streak_after ?? currentMastery.consecutiveCorrect),
      masteredNow: Number(row.mastered_now ?? 0) === 1,
      mastery: currentMastery,
    };
  }

  const lastFp = metaRow.rows[0]?.last_prompt_fingerprint
    ? String(metaRow.rows[0].last_prompt_fingerprint)
    : "";
  const isImmediateDuplicatePrompt =
    input.isCorrect && Boolean(input.promptFingerprint) && lastFp === input.promptFingerprint;

  const creditEligible = input.creditEligible !== false;
  const streakBefore = currentMastery.consecutiveCorrect;
  const wasMastered =
    currentMastery.masteryStatus === "mastered" || currentMastery.masteredAt !== null;

  let nextConsecutive = streakBefore;
  let nextTotalCorrect = currentMastery.totalCorrect;
  let nextTotalIncorrect = currentMastery.totalIncorrect;
  let nextMasteryStatus: MasteryStatus = currentMastery.masteryStatus;
  let nextMasteredAt = currentMastery.masteredAt;
  let nextNeedsReview = currentMastery.needsReview;
  let creditGranted = false;
  let masteredNow = false;

  if (creditEligible) {
    if (input.isCorrect) {
      nextTotalCorrect += 1;
      if (!isImmediateDuplicatePrompt) {
        creditGranted = true;
        nextConsecutive = Math.min(MASTERY_TARGET, streakBefore + 1);
      }
      const becomesMastered = wasMastered || nextConsecutive >= MASTERY_TARGET;
      masteredNow = !wasMastered && becomesMastered;
      nextMasteryStatus = masteryStatusFromStreak(nextConsecutive, becomesMastered);
      if (becomesMastered) {
        nextConsecutive = MASTERY_TARGET;
        nextMasteredAt = nextMasteredAt ?? nowIso;
      }
      nextNeedsReview = false;
    } else {
      nextTotalIncorrect += 1;
      nextNeedsReview = true;
      if (input.isMasteredReview && wasMastered) {
        // Mastered review keeps permanent mastered record while flagging for review
        nextConsecutive = MASTERY_TARGET;
        nextMasteryStatus = "mastered";
      } else {
        // Strict rule: wrong answer resets consecutive streak to 0 (preserving attempt history)
        nextConsecutive = 0;
        nextMasteryStatus = wasMastered ? "mastered" : "not_learned";
      }
    }
  }

  const nextReviewAt = computeNextReviewIso(
    nextConsecutive,
    input.isCorrect,
    nextMasteryStatus === "mastered",
    now,
  );

  const attemptId = randomUUID();
  await tx.execute({
    sql: `INSERT INTO german_personal_attempts(
            id, user_id, session_id, vocab_id, idempotency_key, mode, direction,
            prompt_fingerprint, prompt_text, user_answer, expected_answer,
            is_correct, self_assessed, credit_granted, explanation_json,
            streak_before, streak_after, mastered_now, created_at
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      attemptId,
      input.userId,
      input.sessionId,
      input.vocabId,
      input.idempotencyKey,
      input.mode,
      input.direction,
      input.promptFingerprint,
      input.promptText.slice(0, 2000),
      input.userAnswer.slice(0, 2000),
      input.expectedAnswer.slice(0, 2000),
      input.isCorrect ? 1 : 0,
      input.selfAssessed ? 1 : 0,
      creditGranted ? 1 : 0,
      JSON.stringify(input.explanation ?? {}),
      streakBefore,
      nextConsecutive,
      masteredNow ? 1 : 0,
      nowIso,
    ],
  });

  if (creditEligible) {
    const storedCefr =
      input.cefrLevel === "UNKNOWN" || input.cefrLevel === "C2"
        ? "UNCLASSIFIED"
        : input.cefrLevel;
    await tx.execute({
      sql: `INSERT INTO german_mastery(
              user_id, word_id, cefr_level, consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at
            ) VALUES(?,?,?,?,?,?,?,?,?)
            ON CONFLICT(user_id, word_id) DO UPDATE SET
              consecutive_correct=excluded.consecutive_correct,
              total_correct=excluded.total_correct,
              total_incorrect=excluded.total_incorrect,
              mastery_status=excluded.mastery_status,
              last_practiced_at=excluded.last_practiced_at,
              mastered_at=excluded.mastered_at`,
      args: [
        input.userId,
        input.vocabId,
        storedCefr,
        nextConsecutive,
        nextTotalCorrect,
        nextTotalIncorrect,
        nextMasteryStatus,
        nowIso,
        nextMasteredAt,
      ],
    });

    await tx.execute({
      sql: `INSERT INTO german_memory(user_id, word_id, data) VALUES(?,?,?)
            ON CONFLICT(user_id, word_id) DO UPDATE SET data=excluded.data`,
      args: [
        input.userId,
        input.vocabId,
        JSON.stringify(
          masteryToMemory({
            wordId: input.vocabId,
            cefrLevel: storedCefr as any,
            consecutiveCorrect: nextConsecutive,
            totalCorrect: nextTotalCorrect,
            totalIncorrect: nextTotalIncorrect,
            masteryStatus: nextMasteryStatus,
            lastPracticedAt: nowIso,
            masteredAt: nextMasteredAt,
          }),
        ),
      ],
    });

    await tx.execute({
      sql: `INSERT INTO german_personal_mastery_meta(
              user_id, vocab_id, needs_review, next_review_at, last_mode, last_prompt_fingerprint, updated_at
            ) VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(user_id, vocab_id) DO UPDATE SET
              needs_review=excluded.needs_review,
              next_review_at=excluded.next_review_at,
              last_mode=excluded.last_mode,
              last_prompt_fingerprint=excluded.last_prompt_fingerprint,
              updated_at=excluded.updated_at`,
      args: [
        input.userId,
        input.vocabId,
        nextNeedsReview ? 1 : 0,
        nextReviewAt,
        input.mode,
        input.promptFingerprint,
        nowIso,
      ],
    });

    // Keep shared global mastery synchronized with any standard KapsGerman word with same canonical key + meaning
    await syncCanonicalMasteryAcrossModulesTx(tx, {
      userId: input.userId,
      sourceWordId: input.vocabId,
      canonicalKey: input.canonicalKey,
      tr: input.tr,
      consecutiveCorrect: nextConsecutive,
      totalCorrect: nextTotalCorrect,
      totalIncorrect: nextTotalIncorrect,
      masteryStatus: nextMasteryStatus,
      lastPracticedAt: nowIso,
      masteredAt: nextMasteredAt,
    });
  }

  const updatedSnapshot: PersonalMasterySnapshot = {
    wordId: input.vocabId,
    consecutiveCorrect: nextConsecutive,
    totalCorrect: nextTotalCorrect,
    totalIncorrect: nextTotalIncorrect,
    masteryStatus: nextMasteryStatus,
    needsReview: nextNeedsReview,
    lastPracticedAt: creditEligible ? nowIso : currentMastery.lastPracticedAt,
    masteredAt: nextMasteredAt,
    nextReviewAt: creditEligible ? nextReviewAt : currentMastery.nextReviewAt,
  };

  return {
    attemptId,
    alreadyApplied: false,
    creditGranted,
    streakBefore,
    streakAfter: nextConsecutive,
    masteredNow,
    mastery: updatedSnapshot,
  };
}

/**
 * Loads all personal vocabulary items for a user along with global mastery and source memberships.
 * Also inherits existing mastery from standard KapsGerman `german_mastery` if the user already
 * mastered the exact canonical word+meaning in standard mode!
 */
export async function loadUserPersonalVocab(
  db: Client,
  userId: number,
  options: { sourceIds?: string[]; activeOnly?: boolean; includeExcluded?: boolean } = {},
): Promise<PersonalVocabItemDTO[]> {
  const [vocabRes, itemsRes, sourcesRes, masteryRes, metaRes, stdWordsRes] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM german_personal_vocab WHERE user_id=? ORDER BY updated_at DESC",
      args: [userId],
    }),
    db.execute({
      sql: `SELECT si.*, s.title AS source_title, s.deleted_at
            FROM german_personal_source_items si
            JOIN german_personal_sources s ON s.id = si.source_id
            WHERE si.user_id=? AND s.deleted_at IS NULL`,
      args: [userId],
    }),
    db.execute({
      sql: "SELECT id, title FROM german_personal_sources WHERE user_id=? AND deleted_at IS NULL",
      args: [userId],
    }),
    db.execute({
      sql: "SELECT word_id, consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at FROM german_mastery WHERE user_id=?",
      args: [userId],
    }),
    db.execute({
      sql: "SELECT vocab_id, needs_review, next_review_at FROM german_personal_mastery_meta WHERE user_id=?",
      args: [userId],
    }),
    db.execute("SELECT id, data, canonical_key FROM german_words WHERE active=1"),
  ]);

  const sourceTitleMap = new Map(sourcesRes.rows.map((r) => [String(r.id), String(r.title)]));
  const masteryByWordId = new Map<string, PersonalMasterySnapshot>();
  for (const r of masteryRes.rows) {
    const wid = String(r.word_id);
    masteryByWordId.set(wid, {
      wordId: wid,
      consecutiveCorrect: Number(r.consecutive_correct ?? 0),
      totalCorrect: Number(r.total_correct ?? 0),
      totalIncorrect: Number(r.total_incorrect ?? 0),
      masteryStatus: String(r.mastery_status ?? "not_learned") as MasteryStatus,
      needsReview: false,
      lastPracticedAt: r.last_practiced_at ? String(r.last_practiced_at) : null,
      masteredAt: r.mastered_at ? String(r.mastered_at) : null,
      nextReviewAt: null,
    });
  }
  for (const r of metaRes.rows) {
    const wid = String(r.vocab_id);
    const existing = masteryByWordId.get(wid) ?? emptyMasterySnapshot(wid);
    existing.needsReview = Number(r.needs_review ?? 0) === 1;
    existing.nextReviewAt = r.next_review_at ? String(r.next_review_at) : null;
    masteryByWordId.set(wid, existing);
  }

  // Index standard KapsGerman mastered/in-progress records by canonical key + meaning root
  const stdMasteryBySense = new Map<string, PersonalMasterySnapshot>();
  for (const r of stdWordsRes.rows) {
    const wid = String(r.id);
    const m = masteryByWordId.get(wid);
    if (!m || (m.consecutiveCorrect === 0 && m.totalCorrect === 0 && m.totalIncorrect === 0)) continue;
    try {
      const parsed = JSON.parse(String(r.data ?? "{}"));
      const sk = buildPersonalSenseKey(String(parsed.de ?? ""), String(parsed.tr ?? ""));
      const prev = stdMasteryBySense.get(sk);
      if (!prev || m.consecutiveCorrect > prev.consecutiveCorrect) {
        stdMasteryBySense.set(sk, m);
      }
    } catch {}
  }

  // Group source memberships per vocab_id
  const filterSourceSet = options.sourceIds?.length ? new Set(options.sourceIds) : null;
  const memberships = new Map<
    string,
    Array<{
      id: string;
      sourceId: string;
      sourceTitle: string;
      originalExcerpt: string;
      excluded: boolean;
      active: boolean;
    }>
  >();

  for (const r of itemsRes.rows) {
    const vid = String(r.vocab_id);
    const sid = String(r.source_id);
    const list = memberships.get(vid) ?? [];
    list.push({
      id: String(r.id),
      sourceId: sid,
      sourceTitle: sourceTitleMap.get(sid) ?? String(r.source_title ?? ""),
      originalExcerpt: String(r.original_excerpt ?? ""),
      excluded: Number(r.excluded ?? 0) === 1,
      active: Number(r.active ?? 1) === 1,
    });
    memberships.set(vid, list);
  }

  const out: PersonalVocabItemDTO[] = [];
  for (const r of vocabRes.rows) {
    const id = String(r.id);
    const mems = memberships.get(id) ?? [];
    const scopedMems = filterSourceSet
      ? mems.filter((m) => filterSourceSet.has(m.sourceId))
      : mems;

    if (filterSourceSet && scopedMems.length === 0) continue;
    if (options.activeOnly) {
      const hasActive = scopedMems.some(
        (m) => m.active && (options.includeExcluded || !m.excluded),
      );
      if (!hasActive) continue;
    }

    const directMastery = masteryByWordId.get(id);
    const senseKey = String(r.sense_key);
    const inherited = stdMasteryBySense.get(senseKey);

    let resolvedMastery: PersonalMasterySnapshot = directMastery ?? emptyMasterySnapshot(id);
    if (inherited) {
      const mergedMastered =
        resolvedMastery.masteryStatus === "mastered" || inherited.masteryStatus === "mastered";
      const mergedStreak = mergedMastered
        ? MASTERY_TARGET
        : Math.max(resolvedMastery.consecutiveCorrect, inherited.consecutiveCorrect);
      resolvedMastery = {
        ...resolvedMastery,
        wordId: id,
        consecutiveCorrect: mergedStreak,
        totalCorrect: Math.max(resolvedMastery.totalCorrect, inherited.totalCorrect),
        totalIncorrect: Math.max(resolvedMastery.totalIncorrect, inherited.totalIncorrect),
        masteryStatus: masteryStatusFromStreak(mergedStreak, mergedMastered),
        masteredAt: resolvedMastery.masteredAt ?? inherited.masteredAt,
        lastPracticedAt: resolvedMastery.lastPracticedAt ?? inherited.lastPracticedAt,
      };
    }

    let alternatives: string[] = [];
    try {
      const parsedAlt = JSON.parse(String(r.alternatives_json ?? "[]"));
      if (Array.isArray(parsedAlt)) alternatives = parsedAlt.map(String);
    } catch {}

    const primaryMem = scopedMems[0] ?? mems[0];
    const activeSources = mems.filter((m) => m.active);

    out.push({
      id,
      sourceItemId: primaryMem?.id,
      canonicalKey: String(r.canonical_key),
      senseKey,
      de: String(r.de),
      tr: String(r.tr),
      alternatives,
      article: String(r.article ?? ""),
      plural: String(r.plural ?? ""),
      partOfSpeech: String(r.part_of_speech ?? ""),
      reflexive: Number(r.reflexive ?? 0) === 1,
      separable: Number(r.separable ?? 0) === 1,
      preposition: String(r.preposition ?? ""),
      requiredCase: String(r.required_case ?? ""),
      exampleDe: String(r.example_de ?? ""),
      exampleTr: String(r.example_tr ?? ""),
      cefrLevel: (String(r.cefr_level ?? "UNKNOWN") as PersonalCefrLevel) || "UNKNOWN",
      cefrConfidence: Number(r.cefr_confidence ?? 0.5),
      cefrSource: String(r.cefr_source ?? "heuristic"),
      category: String(r.category ?? "Genel"),
      notes: String(r.notes ?? ""),
      uncertain: Number(r.uncertain ?? 0) === 1,
      excluded: primaryMem ? primaryMem.excluded : false,
      active: primaryMem ? primaryMem.active : false,
      originalExcerpt: primaryMem?.originalExcerpt ?? "",
      sourceIds: [...new Set(activeSources.map((m) => m.sourceId))],
      sourceTitles: [...new Set(activeSources.map((m) => m.sourceTitle))],
      mastery: resolvedMastery,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    });
  }

  return out;
}

/**
 * Computes exact source summaries using the strict Source Completion Percentage formula:
 * (Mastered active non-excluded unique items in source ÷ Total active non-excluded unique items in source) × 100
 */
export async function listUserPersonalSources(
  db: Client,
  userId: number,
): Promise<PersonalSourceSummary[]> {
  const [srcRes, allItemsRes, allVocab] = await Promise.all([
    db.execute({
      sql: "SELECT * FROM german_personal_sources WHERE user_id=? AND deleted_at IS NULL ORDER BY updated_at DESC",
      args: [userId],
    }),
    db.execute({
      sql: "SELECT source_id, vocab_id, active, excluded FROM german_personal_source_items WHERE user_id=?",
      args: [userId],
    }),
    loadUserPersonalVocab(db, userId, { activeOnly: false, includeExcluded: true }),
  ]);

  const vocabById = new Map(allVocab.map((v) => [v.id, v]));
  const itemsBySource = new Map<
    string,
    Array<{ vocabId: string; active: boolean; excluded: boolean }>
  >();

  for (const r of allItemsRes.rows) {
    const sid = String(r.source_id);
    const list = itemsBySource.get(sid) ?? [];
    list.push({
      vocabId: String(r.vocab_id),
      active: Number(r.active ?? 1) === 1,
      excluded: Number(r.excluded ?? 0) === 1,
    });
    itemsBySource.set(sid, list);
  }

  return srcRes.rows.map((r) => {
    const sid = String(r.id);
    const rows = itemsBySource.get(sid) ?? [];
    const activeUniqueIds = new Set<string>();
    let excludedCount = 0;

    for (const row of rows) {
      if (!row.active) continue;
      if (row.excluded) {
        excludedCount++;
        continue;
      }
      activeUniqueIds.add(row.vocabId);
    }

    let mastered = 0;
    let almostMastered = 0;
    let learning = 0;
    let uncertain = 0;
    for (const vid of activeUniqueIds) {
      const v = vocabById.get(vid);
      if (!v) continue;
      if (v.uncertain) uncertain++;
      if (v.mastery.masteryStatus === "mastered") mastered++;
      else if (v.mastery.masteryStatus === "almost_mastered") almostMastered++;
      else if (v.mastery.masteryStatus === "learning") learning++;
    }

    const totalActive = activeUniqueIds.size;
    const completionPercent =
      totalActive > 0 ? Math.round((mastered / totalActive) * 1000) / 10 : 0;

    let cefrSummary: PersonalCefrSummary = {
      total: totalActive,
      breakdown: [],
      dominantLevels: [],
      summaryTr: "Henüz analiz edilmiş kelime bulunmuyor.",
    };
    try {
      const parsed = JSON.parse(String(r.cefr_summary_json ?? "{}"));
      if (parsed && Array.isArray(parsed.breakdown)) {
        cefrSummary = parsed;
      }
    } catch {}

    return {
      id: sid,
      title: String(r.title),
      sourceType: String(r.source_type) as PersonalSourceType,
      fileName: r.file_name ? String(r.file_name) : null,
      gdocId: r.gdoc_id ? String(r.gdoc_id) : null,
      gdocUrl: r.gdoc_url ? String(r.gdoc_url) : null,
      autoSyncEnabled: Number(r.auto_sync_enabled ?? 0) === 1,
      syncIntervalMin: Number(r.sync_interval_min ?? 15),
      syncStatus: String(r.sync_status ?? "idle") as PersonalSyncStatus,
      syncError: r.sync_error ? String(r.sync_error) : null,
      lastSyncedAt: r.last_synced_at ? String(r.last_synced_at) : null,
      nextSyncAt: r.next_sync_at ? String(r.next_sync_at) : null,
      totalActiveItems: totalActive,
      masteredItems: mastered,
      almostMasteredItems: almostMastered,
      learningItems: learning,
      uncertainItems: uncertain,
      excludedItems: excludedCount,
      completionPercent,
      cefrSummary,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    };
  });
}

export function normalizeForDuplicateCheck(text: string): string {
  return normalizeText(text).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/gu, " ").trim();
}
