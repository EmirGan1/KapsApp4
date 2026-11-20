import type { Client, Transaction } from "@libsql/client";
import {
  ACHIEVEMENT_DEFS,
  CEFR_META,
  MASTERY_TARGET,
  XP_RULES,
  isCefrLevel,
  studyLevels,
  type CefrLevel,
  type MasteryStatus,
} from "../../shared/germanActivities";
import { BUILTIN_CURRICULUM } from "./curriculum";
import {
  canonicalWordKey,
  classifyVocabularyEntry,
  lookupReferenceCefr,
  normalizeText,
} from "./cefr";
import {
  applyMasteryAttempt,
  masteryToMemory,
  memoryToMastery,
  newMastery,
  type MasteryRecord,
  type Vocabulary,
} from "./learning";

export function localDayKey(date = new Date(), timeZone = "Europe/Istanbul"): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
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

export async function initGermanSchema(db: Client) {
  await db.batch(
    [
      "CREATE TABLE IF NOT EXISTS german_permissions(user_id INTEGER PRIMARY KEY,enabled INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS german_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS german_words(id TEXT PRIMARY KEY,data TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,imported_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS german_tasks(id TEXT PRIMARY KEY,data TEXT NOT NULL,fingerprint TEXT UNIQUE NOT NULL,created_at TEXT NOT NULL)",
      "CREATE TABLE IF NOT EXISTS german_memory(user_id INTEGER NOT NULL,word_id TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(user_id,word_id))",
      "CREATE TABLE IF NOT EXISTS german_sessions(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,module TEXT NOT NULL,mode TEXT NOT NULL,tasks TEXT NOT NULL,answers TEXT NOT NULL DEFAULT '{}',results TEXT NOT NULL DEFAULT '{}',started_at TEXT NOT NULL,deadline TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'active',version INTEGER NOT NULL DEFAULT 1)",
      "CREATE INDEX IF NOT EXISTS german_sessions_owner ON german_sessions(user_id,started_at)",
      "CREATE TABLE IF NOT EXISTS german_jobs(id TEXT PRIMARY KEY,started_at TEXT NOT NULL,finished_at TEXT,status TEXT NOT NULL,summary TEXT)",
      "CREATE TABLE IF NOT EXISTS german_lock(id INTEGER PRIMARY KEY,token TEXT NOT NULL,expires_at INTEGER NOT NULL)",
      "CREATE TABLE IF NOT EXISTS german_oauth(state TEXT PRIMARY KEY,verifier TEXT NOT NULL,expires_at INTEGER NOT NULL)",
      `CREATE TABLE IF NOT EXISTS german_mastery(
        user_id INTEGER NOT NULL,
        word_id TEXT NOT NULL,
        cefr_level TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
        consecutive_correct INTEGER NOT NULL DEFAULT 0,
        total_correct INTEGER NOT NULL DEFAULT 0,
        total_incorrect INTEGER NOT NULL DEFAULT 0,
        mastery_status TEXT NOT NULL DEFAULT 'not_learned',
        last_practiced_at TEXT,
        mastered_at TEXT,
        PRIMARY KEY(user_id, word_id)
      )`,
      "CREATE INDEX IF NOT EXISTS german_mastery_user_level ON german_mastery(user_id, cefr_level, mastery_status)",
      `CREATE TABLE IF NOT EXISTS german_attempts(
        attempt_key TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        word_id TEXT NOT NULL,
        exercise_type TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        user_answer TEXT NOT NULL,
        is_correct INTEGER NOT NULL,
        is_review INTEGER NOT NULL DEFAULT 0,
        xp_awarded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS german_attempts_user_date ON german_attempts(user_id, created_at)",
      `CREATE TABLE IF NOT EXISTS german_user_stats(
        user_id INTEGER PRIMARY KEY,
        total_xp INTEGER NOT NULL DEFAULT 0,
        current_streak INTEGER NOT NULL DEFAULT 0,
        longest_streak INTEGER NOT NULL DEFAULT 0,
        last_active_day TEXT,
        daily_goal_xp INTEGER NOT NULL DEFAULT 50,
        selected_levels TEXT NOT NULL DEFAULT '["A1"]',
        preferred_direction TEXT NOT NULL DEFAULT 'tr_de',
        perfect_lessons INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS german_daily_activity(
        user_id INTEGER NOT NULL,
        day_key TEXT NOT NULL,
        xp_earned INTEGER NOT NULL DEFAULT 0,
        exercises_completed INTEGER NOT NULL DEFAULT 0,
        answers_correct INTEGER NOT NULL DEFAULT 0,
        answers_total INTEGER NOT NULL DEFAULT 0,
        words_mastered INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(user_id, day_key)
      )`,
      `CREATE TABLE IF NOT EXISTS german_achievements(
        user_id INTEGER NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        PRIMARY KEY(user_id, achievement_id)
      )`,
    ],
    "write",
  );

  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN cefr_level TEXT NOT NULL DEFAULT 'UNCLASSIFIED'");
  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN canonical_key TEXT NOT NULL DEFAULT ''");
  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN topic TEXT NOT NULL DEFAULT ''");
  await safeAlter(db, "ALTER TABLE german_sessions ADD COLUMN filters TEXT NOT NULL DEFAULT '{}'");

  await db.batch(
    [
      "CREATE INDEX IF NOT EXISTS german_words_level_active ON german_words(active, cefr_level)",
      "CREATE INDEX IF NOT EXISTS german_words_canonical ON german_words(canonical_key)",
    ],
    "write",
  );

  await migrateLegacyGermanData(db);
}

export async function migrateLegacyGermanData(db: Client) {
  const wordsRows = await db.execute(
    "SELECT id, data, cefr_level, canonical_key, topic FROM german_words",
  );

  const wordLevelMap = new Map<string, string>();
  const tx = await db.transaction("write");
  try {
    for (const r of wordsRows.rows) {
      const id = String(r.id);
      const parsed = JSON.parse(String(r.data)) as Partial<Vocabulary>;
      const de = String(parsed.de ?? "");
      const cKey = parsed.canonicalKey || canonicalWordKey(de);
      const existingSource = parsed.cefrSource;

      // Reclassify legacy rows where old parser defaulted silently to B1 without source metadata
      let nextLevel = parsed.level ?? "UNCLASSIFIED";
      let nextSource = existingSource;
      if (!existingSource) {
        const ref = lookupReferenceCefr(de);
        if (ref) {
          nextLevel = ref;
          nextSource = "reference";
        } else if (isCefrLevel(parsed.level) && parsed.level !== "B1") {
          nextLevel = parsed.level;
          nextSource = "heading";
        } else {
          // Legacy B1 with no heading proof -> isolate until classified
          nextLevel = "UNCLASSIFIED";
          nextSource = "unclassified";
        }
      } else {
        const res = classifyVocabularyEntry({
          de,
          existingLevel: parsed.level,
          existingSource,
        });
        nextLevel = res.level;
        nextSource = res.source;
      }

      const nextTopic = String(parsed.topic || r.topic || "Genel");
      wordLevelMap.set(id, nextLevel);

      if (
        String(r.cefr_level) !== nextLevel ||
        String(r.canonical_key) !== cKey ||
        String(r.topic) !== nextTopic ||
        parsed.level !== nextLevel ||
        parsed.canonicalKey !== cKey ||
        parsed.cefrSource !== nextSource
      ) {
        const updated = {
          ...parsed,
          id,
          canonicalKey: cKey,
          level: nextLevel,
          cefrSource: nextSource,
          topic: nextTopic,
        };
        await tx.execute({
          sql: "UPDATE german_words SET data=?, cefr_level=?, canonical_key=?, topic=? WHERE id=?",
          args: [JSON.stringify(updated), nextLevel, cKey, nextTopic, id],
        });
      }
    }

    // Backfill german_mastery from existing german_memory rows without overwriting already-migrated mastery rows
    const memRows = await tx.execute("SELECT user_id, word_id, data FROM german_memory");
    const existingMastery = await tx.execute("SELECT user_id, word_id FROM german_mastery");
    const hasMastery = new Set(
      existingMastery.rows.map((r) => `${r.user_id}:${r.word_id}`),
    );

    for (const r of memRows.rows) {
      const uid = Number(r.user_id);
      const wid = String(r.word_id);
      if (hasMastery.has(`${uid}:${wid}`)) continue;
      const rawMem = JSON.parse(String(r.data));
      const lvl = (wordLevelMap.get(wid) ?? "UNCLASSIFIED") as any;
      const m = memoryToMastery(rawMem, wid, lvl);
      await tx.execute({
        sql: `INSERT OR IGNORE INTO german_mastery(
          user_id, word_id, cefr_level, consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at
        ) VALUES(?,?,?,?,?,?,?,?,?)`,
        args: [
          uid,
          wid,
          m.cefrLevel,
          m.consecutiveCorrect,
          m.totalCorrect,
          m.totalIncorrect,
          m.masteryStatus,
          m.lastPracticedAt,
          m.masteredAt,
        ],
      });
    }

    await tx.commit();
  } finally {
    tx.close();
  }
}

export async function seedBuiltinCurriculum(db: Client): Promise<{ inserted: number; enriched: number }> {
  const existingRows = await db.execute("SELECT id, data, canonical_key FROM german_words");
  const byCanonical = new Map<string, { id: string; data: Vocabulary }>();
  for (const r of existingRows.rows) {
    const parsed = JSON.parse(String(r.data)) as Vocabulary;
    const ck = String(r.canonical_key || parsed.canonicalKey || canonicalWordKey(parsed.de));
    if (!byCanonical.has(ck)) {
      byCanonical.set(ck, { id: String(r.id), data: parsed });
    }
  }

  let inserted = 0;
  let enriched = 0;
  const nowIso = new Date().toISOString();
  const tx = await db.transaction("write");
  try {
    for (const entry of BUILTIN_CURRICULUM) {
      const ck = canonicalWordKey(entry.de);
      const existing = byCanonical.get(ck);
      if (!existing) {
        const vocab: Vocabulary = {
          id: entry.id,
          canonicalKey: ck,
          de: entry.de,
          tr: entry.tr,
          alternatives: entry.alternatives,
          raw: `${entry.de} — ${entry.tr}`,
          topic: entry.topic,
          level: entry.level,
          cefrSource: "builtin",
          article: entry.article,
          plural: entry.plural,
          pos: entry.pos,
          grammar: entry.grammar,
          exampleDe: entry.exampleDe,
          exampleTr: entry.exampleTr,
          conjugation: entry.conjugation,
          completion: entry.completion,
        };
        await tx.execute({
          sql: "INSERT OR IGNORE INTO german_words(id, data, active, imported_at, cefr_level, canonical_key, topic) VALUES(?,?,1,?,?,?,?)",
          args: [vocab.id, JSON.stringify(vocab), nowIso, vocab.level, ck, vocab.topic],
        });
        byCanonical.set(ck, { id: vocab.id, data: vocab });
        inserted++;
      } else {
        // Safely enrich missing metadata / fix unclassified legacy levels without changing existing ID!
        const prev = existing.data;
        const needsUpdate =
          prev.cefrSource === "builtin" ||
          prev.level === "UNCLASSIFIED" ||
          !prev.exampleDe ||
          (entry.conjugation && !prev.conjugation) ||
          (entry.completion && !prev.completion);
        if (needsUpdate) {
          const nextLevel =
            prev.cefrSource === "manual" || prev.cefrSource === "heading"
              ? prev.level
              : entry.level;
          const nextSource =
            prev.cefrSource === "manual" || prev.cefrSource === "heading"
              ? prev.cefrSource
              : "builtin";
          const updated: Vocabulary = {
            ...prev,
            id: existing.id,
            canonicalKey: ck,
            alternatives: prev.alternatives?.length ? prev.alternatives : entry.alternatives,
            level: nextLevel,
            cefrSource: nextSource,
            topic: prev.topic && prev.topic !== "Genel" ? prev.topic : entry.topic,
            article: prev.article || entry.article,
            plural: prev.plural || entry.plural,
            pos: prev.pos || entry.pos,
            grammar: prev.grammar || entry.grammar,
            exampleDe: prev.exampleDe || entry.exampleDe,
            exampleTr: prev.exampleTr || entry.exampleTr,
            conjugation: prev.conjugation || entry.conjugation,
            completion: prev.completion || entry.completion,
          };
          await tx.execute({
            sql: "UPDATE german_words SET data=?, cefr_level=?, canonical_key=?, topic=? WHERE id=?",
            args: [
              JSON.stringify(updated),
              updated.level,
              ck,
              updated.topic,
              existing.id,
            ],
          });
          enriched++;
        }
      }
    }
    await tx.commit();
  } finally {
    tx.close();
  }
  return { inserted, enriched };
}

export async function getUserMasteryMap(
  db: Client | Transaction,
  userId: number,
): Promise<Map<string, MasteryRecord>> {
  const rows = await db.execute({
    sql: "SELECT word_id, cefr_level, consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at FROM german_mastery WHERE user_id=?",
    args: [userId],
  });
  const map = new Map<string, MasteryRecord>();
  for (const r of rows.rows) {
    const wid = String(r.word_id);
    map.set(wid, {
      wordId: wid,
      cefrLevel: String(r.cefr_level) as any,
      consecutiveCorrect: Number(r.consecutive_correct ?? 0),
      totalCorrect: Number(r.total_correct ?? 0),
      totalIncorrect: Number(r.total_incorrect ?? 0),
      masteryStatus: String(r.mastery_status ?? "not_learned") as MasteryStatus,
      lastPracticedAt: r.last_practiced_at ? String(r.last_practiced_at) : null,
      masteredAt: r.mastered_at ? String(r.mastered_at) : null,
    });
  }
  return map;
}

export interface WordWithMastery extends Vocabulary {
  active: boolean;
  importedAt: string;
  mastery: MasteryRecord;
  memory: ReturnType<typeof masteryToMemory>;
}

/**
 * Loads active vocabulary deduplicated by canonicalKey so duplicate DB records never inflate progress.
 */
export async function loadDeduplicatedWordsWithMastery(
  db: Client,
  userId: number,
  includeInactive = false,
): Promise<{
  uniqueWords: WordWithMastery[];
  rawWords: WordWithMastery[];
  unclassifiedCount: number;
}> {
  const [wordRes, masteryMap] = await Promise.all([
    db.execute(
      includeInactive
        ? "SELECT id, data, active, imported_at FROM german_words ORDER BY imported_at DESC"
        : "SELECT id, data, active, imported_at FROM german_words WHERE active=1 ORDER BY imported_at DESC",
    ),
    getUserMasteryMap(db, userId),
  ]);

  const rawWords: WordWithMastery[] = [];
  const byCanonical = new Map<string, WordWithMastery>();
  let unclassifiedCount = 0;

  for (const r of wordRes.rows) {
    const id = String(r.id);
    const parsed = JSON.parse(String(r.data)) as Vocabulary;
    const ck = parsed.canonicalKey || canonicalWordKey(parsed.de);
    const mastery = masteryMap.get(id) ?? newMastery(id, parsed.level);
    const full: WordWithMastery = {
      ...parsed,
      id,
      canonicalKey: ck,
      active: !!r.active,
      importedAt: String(r.imported_at),
      mastery: { ...mastery, wordId: id, cefrLevel: parsed.level },
      memory: masteryToMemory({ ...mastery, wordId: id, cefrLevel: parsed.level }),
    };
    rawWords.push(full);

    if (!full.active) continue;
    if (!isCefrLevel(full.level)) {
      unclassifiedCount++;
      continue;
    }

    const dedupeId = `${full.level}::${ck}`;
    const prev = byCanonical.get(dedupeId);
    if (!prev) {
      byCanonical.set(dedupeId, full);
    } else {
      // Merge mastery defensively so whichever duplicate ID was practiced counts once!
      const mergedMastered =
        prev.mastery.masteryStatus === "mastered" ||
        full.mastery.masteryStatus === "mastered";
      const bestStreak = Math.max(
        prev.mastery.consecutiveCorrect,
        full.mastery.consecutiveCorrect,
      );
      const merged: MasteryRecord = {
        wordId: prev.id,
        cefrLevel: prev.level,
        consecutiveCorrect: mergedMastered ? MASTERY_TARGET : bestStreak,
        totalCorrect: Math.max(prev.mastery.totalCorrect, full.mastery.totalCorrect),
        totalIncorrect: Math.max(prev.mastery.totalIncorrect, full.mastery.totalIncorrect),
        masteryStatus: mergedMastered
          ? "mastered"
          : bestStreak >= 4
            ? "almost_mastered"
            : bestStreak >= 1
              ? "learning"
              : "not_learned",
        lastPracticedAt:
          prev.mastery.lastPracticedAt && full.mastery.lastPracticedAt
            ? prev.mastery.lastPracticedAt > full.mastery.lastPracticedAt
              ? prev.mastery.lastPracticedAt
              : full.mastery.lastPracticedAt
            : prev.mastery.lastPracticedAt ?? full.mastery.lastPracticedAt,
        masteredAt: prev.mastery.masteredAt ?? full.mastery.masteredAt,
      };
      byCanonical.set(dedupeId, {
        ...prev,
        mastery: merged,
        memory: masteryToMemory(merged),
      });
    }
  }

  return {
    uniqueWords: [...byCanonical.values()],
    rawWords,
    unclassifiedCount,
  };
}

export async function recordAttemptAndApplyMastery(
  tx: Transaction,
  input: {
    userId: number;
    sessionId: string;
    taskId: string;
    exerciseType: string;
    vocabularyIds: string[];
    userAnswer: string;
    isCorrect: boolean;
    isReview: boolean;
    wordLevels: Map<string, Vocabulary>;
    now?: Date;
  },
): Promise<{
  xpAwarded: number;
  newlyMastered: Array<{ wordId: string; de: string; tr: string; level: string }>;
  masteryUpdates: Record<string, MasteryRecord>;
  alreadyApplied: boolean;
}> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const day = localDayKey(now);
  let xpAwarded = 0;
  let alreadyApplied = false;
  const newlyMastered: Array<{ wordId: string; de: string; tr: string; level: string }> = [];
  const masteryUpdates: Record<string, MasteryRecord> = {};

  for (const wordId of input.vocabularyIds) {
    const attemptKey = `${input.userId}:${input.sessionId}:${input.taskId}:${wordId}`;
    const w = input.wordLevels.get(wordId);
    const level = w?.level ?? "UNCLASSIFIED";

    const ins = await tx.execute({
      sql: `INSERT OR IGNORE INTO german_attempts(
        attempt_key, user_id, session_id, task_id, word_id, exercise_type, cefr_level, user_answer, is_correct, is_review, xp_awarded, created_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) RETURNING attempt_key`,
      args: [
        attemptKey,
        input.userId,
        input.sessionId,
        input.taskId,
        wordId,
        input.exerciseType,
        level,
        input.userAnswer.slice(0, 2000),
        input.isCorrect ? 1 : 0,
        input.isReview ? 1 : 0,
        0,
        nowIso,
      ],
    });

    if (!ins.rows.length) {
      alreadyApplied = true;
      continue;
    }

    // Load authoritative current mastery
    const oldRow = await tx.execute({
      sql: "SELECT consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at FROM german_mastery WHERE user_id=? AND word_id=?",
      args: [input.userId, wordId],
    });
    const oldMastery: MasteryRecord = oldRow.rows[0]
      ? {
          wordId,
          cefrLevel: level as any,
          consecutiveCorrect: Number(oldRow.rows[0].consecutive_correct ?? 0),
          totalCorrect: Number(oldRow.rows[0].total_correct ?? 0),
          totalIncorrect: Number(oldRow.rows[0].total_incorrect ?? 0),
          masteryStatus: String(oldRow.rows[0].mastery_status) as MasteryStatus,
          lastPracticedAt: oldRow.rows[0].last_practiced_at
            ? String(oldRow.rows[0].last_practiced_at)
            : null,
          masteredAt: oldRow.rows[0].mastered_at
            ? String(oldRow.rows[0].mastered_at)
            : null,
        }
      : newMastery(wordId, level as any);

    const wasMastered = oldMastery.masteryStatus === "mastered";
    const nextMastery = applyMasteryAttempt(oldMastery, input.isCorrect, {
      isReview: input.isReview,
      now,
    });
    const becameMasteredNow = !wasMastered && nextMastery.masteryStatus === "mastered";

    await tx.execute({
      sql: `INSERT INTO german_mastery(
        user_id, word_id, cefr_level, consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at
      ) VALUES(?,?,?,?,?,?,?,?,?)
      ON CONFLICT(user_id, word_id) DO UPDATE SET
        cefr_level=excluded.cefr_level,
        consecutive_correct=excluded.consecutive_correct,
        total_correct=excluded.total_correct,
        total_incorrect=excluded.total_incorrect,
        mastery_status=excluded.mastery_status,
        last_practiced_at=excluded.last_practiced_at,
        mastered_at=excluded.mastered_at`,
      args: [
        input.userId,
        wordId,
        nextMastery.cefrLevel,
        nextMastery.consecutiveCorrect,
        nextMastery.totalCorrect,
        nextMastery.totalIncorrect,
        nextMastery.masteryStatus,
        nextMastery.lastPracticedAt,
        nextMastery.masteredAt,
      ],
    });

    // Keep legacy german_memory synchronized
    await tx.execute({
      sql: "INSERT INTO german_memory VALUES(?,?,?) ON CONFLICT(user_id,word_id) DO UPDATE SET data=excluded.data",
      args: [input.userId, wordId, JSON.stringify(masteryToMemory(nextMastery))],
    });

    masteryUpdates[wordId] = nextMastery;

    let itemXp = input.isCorrect ? XP_RULES.CORRECT_ANSWER : 0;
    if (becameMasteredNow) {
      itemXp += XP_RULES.NEW_MASTERY;
      newlyMastered.push({
        wordId,
        de: w?.de ?? "",
        tr: w?.tr ?? "",
        level,
      });
    }
    xpAwarded += itemXp;

    await tx.execute({
      sql: "UPDATE german_attempts SET xp_awarded=? WHERE attempt_key=?",
      args: [itemXp, attemptKey],
    });
  }

  if (!alreadyApplied) {
    // Update user daily activity and streak cleanly inside the same transaction
    await tx.execute({
      sql: `INSERT INTO german_daily_activity(user_id, day_key, xp_earned, exercises_completed, answers_correct, answers_total, words_mastered)
            VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(user_id, day_key) DO UPDATE SET
              xp_earned=german_daily_activity.xp_earned+excluded.xp_earned,
              answers_correct=german_daily_activity.answers_correct+excluded.answers_correct,
              answers_total=german_daily_activity.answers_total+excluded.answers_total,
              words_mastered=german_daily_activity.words_mastered+excluded.words_mastered`,
      args: [
        input.userId,
        day,
        xpAwarded,
        0,
        input.isCorrect ? 1 : 0,
        1,
        newlyMastered.length,
      ],
    });

    const statsRes = await tx.execute({
      sql: "SELECT total_xp, current_streak, longest_streak, last_active_day FROM german_user_stats WHERE user_id=?",
      args: [input.userId],
    });
    const prevStats = statsRes.rows[0];
    const lastDay = prevStats?.last_active_day ? String(prevStats.last_active_day) : null;
    const prevStreak = Number(prevStats?.current_streak ?? 0);
    const prevLongest = Number(prevStats?.longest_streak ?? 0);
    const yesterday = previousDayKey(day);

    let nextStreak = prevStreak;
    if (!lastDay) {
      nextStreak = 1;
    } else if (lastDay === day) {
      nextStreak = Math.max(1, prevStreak);
    } else if (lastDay === yesterday) {
      nextStreak = prevStreak + 1;
    } else {
      nextStreak = 1;
    }
    const nextLongest = Math.max(prevLongest, nextStreak);

    await tx.execute({
      sql: `INSERT INTO german_user_stats(user_id, total_xp, current_streak, longest_streak, last_active_day)
            VALUES(?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
              total_xp=german_user_stats.total_xp+excluded.total_xp,
              current_streak=excluded.current_streak,
              longest_streak=excluded.longest_streak,
              last_active_day=excluded.last_active_day`,
      args: [input.userId, xpAwarded, nextStreak, nextLongest, day],
    });
  }

  return { xpAwarded, newlyMastered, masteryUpdates, alreadyApplied };
}

export async function awardLessonCompletionAndAchievements(
  tx: Transaction,
  userId: number,
  sessionId: string,
  perfect: boolean,
  now = new Date(),
): Promise<{ lessonXp: number; unlocked: string[] }> {
  const day = localDayKey(now);
  const nowIso = now.toISOString();
  const completionKey = `${userId}:${sessionId}:__lesson_complete`;

  const ins = await tx.execute({
    sql: `INSERT OR IGNORE INTO german_attempts(
      attempt_key, user_id, session_id, task_id, word_id, exercise_type, cefr_level, user_answer, is_correct, is_review, xp_awarded, created_at
    ) VALUES(?,?,'__session','__lesson_complete','__lesson','lesson','ALL','',1,0,?,?) RETURNING attempt_key`,
    args: [completionKey, userId, sessionId, XP_RULES.COMPLETED_LESSON, nowIso],
  });

  let lessonXp = 0;
  if (ins.rows.length) {
    lessonXp = XP_RULES.COMPLETED_LESSON;
    await tx.execute({
      sql: `INSERT INTO german_daily_activity(user_id, day_key, xp_earned, exercises_completed, answers_correct, answers_total, words_mastered)
            VALUES(?,?,?,?,0,0,0)
            ON CONFLICT(user_id, day_key) DO UPDATE SET
              xp_earned=german_daily_activity.xp_earned+excluded.xp_earned,
              exercises_completed=german_daily_activity.exercises_completed+1`,
      args: [userId, day, lessonXp, 1],
    });

    const statsRes = await tx.execute({
      sql: "SELECT current_streak, longest_streak, last_active_day FROM german_user_stats WHERE user_id=?",
      args: [userId],
    });
    const prev = statsRes.rows[0];
    const lastDay = prev?.last_active_day ? String(prev.last_active_day) : null;
    const prevStreak = Number(prev?.current_streak ?? 0);
    const yesterday = previousDayKey(day);
    const nextStreak =
      !lastDay || (lastDay !== day && lastDay !== yesterday)
        ? 1
        : lastDay === yesterday
          ? prevStreak + 1
          : Math.max(1, prevStreak);
    const nextLongest = Math.max(Number(prev?.longest_streak ?? 0), nextStreak);

    await tx.execute({
      sql: `INSERT INTO german_user_stats(user_id, total_xp, current_streak, longest_streak, last_active_day, perfect_lessons)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET
              total_xp=german_user_stats.total_xp+excluded.total_xp,
              current_streak=excluded.current_streak,
              longest_streak=excluded.longest_streak,
              last_active_day=excluded.last_active_day,
              perfect_lessons=german_user_stats.perfect_lessons+excluded.perfect_lessons`,
      args: [userId, lessonXp, nextStreak, nextLongest, day, perfect ? 1 : 0],
    });
  }

  const unlocked = await syncAchievementsTx(tx, userId, nowIso);
  return { lessonXp, unlocked };
}

export async function syncAchievementsTx(
  tx: Transaction,
  userId: number,
  nowIso = new Date().toISOString(),
): Promise<string[]> {
  const [masteredRows, a1TotalRows, a1MasteredRows, statsRow, alreadyUnlockedRows] =
    await Promise.all([
      tx.execute({
        sql: `SELECT COUNT(DISTINCT CASE WHEN w.canonical_key != '' THEN w.canonical_key ELSE m.word_id END) AS c
              FROM german_mastery m
              JOIN german_words w ON w.id = m.word_id
              WHERE m.user_id=? AND m.mastery_status='mastered' AND w.active=1 AND w.cefr_level IN ('A1','A2','B1','B2','C1')`,
        args: [userId],
      }),
      tx.execute(
        "SELECT COUNT(DISTINCT CASE WHEN canonical_key != '' THEN canonical_key ELSE id END) AS c FROM german_words WHERE active=1 AND cefr_level='A1'",
      ),
      tx.execute({
        sql: `SELECT COUNT(DISTINCT CASE WHEN w.canonical_key != '' THEN w.canonical_key ELSE m.word_id END) AS c
              FROM german_mastery m
              JOIN german_words w ON w.id = m.word_id
              WHERE m.user_id=? AND m.mastery_status='mastered' AND w.active=1 AND w.cefr_level='A1'`,
        args: [userId],
      }),
      tx.execute({
        sql: "SELECT current_streak, perfect_lessons FROM german_user_stats WHERE user_id=?",
        args: [userId],
      }),
      tx.execute({
        sql: "SELECT achievement_id FROM german_achievements WHERE user_id=?",
        args: [userId],
      }),
    ]);

  const masteredTotal = Number(masteredRows.rows[0]?.c ?? 0);
  const a1Total = Number(a1TotalRows.rows[0]?.c ?? 0);
  const a1Mastered = Number(a1MasteredRows.rows[0]?.c ?? 0);
  const a1Percent = a1Total > 0 ? Math.round((a1Mastered / a1Total) * 100) : 0;
  const streak = Number(statsRow.rows[0]?.current_streak ?? 0);
  const perfectLessons = Number(statsRow.rows[0]?.perfect_lessons ?? 0);
  const existing = new Set(alreadyUnlockedRows.rows.map((r) => String(r.achievement_id)));

  const metrics: Record<string, number> = {
    mastered_total: masteredTotal,
    a1_percent: a1Percent,
    streak,
    perfect_lessons: perfectLessons,
  };

  const newlyUnlocked: string[] = [];
  for (const def of ACHIEVEMENT_DEFS) {
    if (existing.has(def.id)) continue;
    const val = metrics[def.metric] ?? 0;
    if (val >= def.target) {
      await tx.execute({
        sql: "INSERT OR IGNORE INTO german_achievements(user_id, achievement_id, unlocked_at) VALUES(?,?,?)",
        args: [userId, def.id, nowIso],
      });
      newlyUnlocked.push(def.id);
    }
  }
  return newlyUnlocked;
}

export async function buildDashboardSummary(db: Client, userId: number, includeWords = true) {
  const today = localDayKey();
  const yesterday = previousDayKey(today);

  const [{ uniqueWords, rawWords, unclassifiedCount }, statsRes, dailyRes, achRes, sessRes, jobRes] =
    await Promise.all([
      loadDeduplicatedWordsWithMastery(db, userId, true),
      db.execute({
        sql: "SELECT * FROM german_user_stats WHERE user_id=?",
        args: [userId],
      }),
      db.execute({
        sql: "SELECT * FROM german_daily_activity WHERE user_id=? AND day_key=?",
        args: [userId, today],
      }),
      db.execute({
        sql: "SELECT achievement_id, unlocked_at FROM german_achievements WHERE user_id=?",
        args: [userId],
      }),
      db.execute({
        sql: "SELECT id, module, mode, state, started_at, deadline, results, filters FROM german_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 40",
        args: [userId],
      }),
      db.execute("SELECT * FROM german_jobs ORDER BY started_at DESC LIMIT 10"),
    ]);

  const progressByLevel = studyLevels.map((lvl) => {
    const items = uniqueWords.filter((w) => w.level === lvl);
    const total = items.length;
    const mastered = items.filter((w) => w.mastery.masteryStatus === "mastered").length;
    const almostMastered = items.filter((w) => w.mastery.masteryStatus === "almost_mastered").length;
    const learning = items.filter((w) => w.mastery.masteryStatus === "learning").length;
    const notLearned = items.filter((w) => w.mastery.masteryStatus === "not_learned").length;
    const mistakes = items.filter(
      (w) => w.mastery.totalIncorrect > 0 && w.mastery.masteryStatus !== "mastered",
    ).length;
    const remaining = Math.max(0, total - mastered);
    const percent = total > 0 ? Math.round((mastered / total) * 1000) / 10 : 0;

    let statusText = "Henüz kelime yok";
    if (total > 0) {
      if (mastered === total) statusText = "Tamamlandı";
      else if (mastered > 0 || learning > 0 || almostMastered > 0) statusText = "Devam ediyor";
      else statusText = "Başlamaya hazır";
    }

    return {
      level: lvl,
      trName: CEFR_META[lvl].trName,
      enName: CEFR_META[lvl].enName,
      subtitle: CEFR_META[lvl].subtitle,
      accent: CEFR_META[lvl].accent,
      total,
      mastered,
      almostMastered,
      learning,
      notLearned,
      mistakes,
      remaining,
      percent,
      statusText,
    };
  });

  const totalValidated = uniqueWords.length;
  const totalMastered = uniqueWords.filter((w) => w.mastery.masteryStatus === "mastered").length;
  const totalAlmost = uniqueWords.filter((w) => w.mastery.masteryStatus === "almost_mastered").length;
  const totalLearning = uniqueWords.filter((w) => w.mastery.masteryStatus === "learning").length;
  const totalMistakeWords = uniqueWords.filter(
    (w) => w.mastery.totalIncorrect > 0 && w.mastery.masteryStatus !== "mastered",
  ).length;
  const totalCorrectAnswers = uniqueWords.reduce((s, w) => s + w.mastery.totalCorrect, 0);
  const totalIncorrectAnswers = uniqueWords.reduce((s, w) => s + w.mastery.totalIncorrect, 0);
  const totalAttemptCount = totalCorrectAnswers + totalIncorrectAnswers;

  const statsRow = statsRes.rows[0];
  const lastActiveDay = statsRow?.last_active_day ? String(statsRow.last_active_day) : null;
  const rawStreak = Number(statsRow?.current_streak ?? 0);
  const effectiveStreak =
    lastActiveDay === today || lastActiveDay === yesterday ? rawStreak : 0;

  let selectedLevels: CefrLevel[] = ["A1"];
  try {
    const parsed = JSON.parse(String(statsRow?.selected_levels ?? '["A1"]'));
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((l) => isCefrLevel(l))) {
      selectedLevels = parsed;
    }
  } catch {}

  const dailyRow = dailyRes.rows[0];
  const stats = {
    totalXp: Number(statsRow?.total_xp ?? 0),
    currentStreak: effectiveStreak,
    longestStreak: Number(statsRow?.longest_streak ?? 0),
    lastActiveDay,
    dailyGoalXp: Number(statsRow?.daily_goal_xp ?? 50),
    todayXp: Number(dailyRow?.xp_earned ?? 0),
    todayWordsMastered: Number(dailyRow?.words_mastered ?? 0),
    todayExercises: Number(dailyRow?.exercises_completed ?? 0),
    todayCorrect: Number(dailyRow?.answers_correct ?? 0),
    todayTotal: Number(dailyRow?.answers_total ?? 0),
    selectedLevels,
    preferredDirection: String(statsRow?.preferred_direction ?? "tr_de"),
    perfectLessons: Number(statsRow?.perfect_lessons ?? 0),
  };

  const a1Summary = progressByLevel.find((p) => p.level === "A1");
  const unlockedMap = new Map(
    achRes.rows.map((r) => [String(r.achievement_id), String(r.unlocked_at)]),
  );
  const metricValues: Record<string, number> = {
    mastered_total: totalMastered,
    a1_percent: Math.floor(a1Summary?.percent ?? 0),
    streak: effectiveStreak,
    perfect_lessons: stats.perfectLessons,
  };

  const achievements = ACHIEVEMENT_DEFS.map((def) => {
    const current = Math.min(def.target, metricValues[def.metric] ?? 0);
    const unlockedAt = unlockedMap.get(def.id) ?? null;
    return {
      ...def,
      current,
      unlocked: unlockedAt !== null || current >= def.target,
      unlockedAt,
    };
  });

  // Build interactive Duolingo-style Learning Path per CEFR level & topic
  const learningPath = studyLevels.map((lvl) => {
    const lvlWords = uniqueWords.filter((w) => w.level === lvl);
    const topicsMap = new Map<string, WordWithMastery[]>();
    for (const w of lvlWords) {
      const t = w.topic || "Temel Kelimeler";
      topicsMap.set(t, [...(topicsMap.get(t) ?? []), w]);
    }
    let foundCurrent = false;
    const nodes = [...topicsMap.entries()].map(([topic, items], idx) => {
      const total = items.length;
      const mastered = items.filter((i) => i.mastery.masteryStatus === "mastered").length;
      const inProgress = items.some((i) => i.mastery.totalCorrect > 0 || i.mastery.totalIncorrect > 0);
      let status: "completed" | "current" | "available" | "review" = "available";
      if (total > 0 && mastered === total) {
        status = "completed";
      } else if (!foundCurrent && (inProgress || idx === 0)) {
        status = "current";
        foundCurrent = true;
      } else if (items.some((i) => i.mastery.totalIncorrect > 0)) {
        status = "review";
      }
      return {
        id: `${lvl}:${normalizeText(topic)}`,
        level: lvl,
        order: idx + 1,
        topic,
        totalWords: total,
        masteredWords: mastered,
        percent: total > 0 ? Math.round((mastered / total) * 100) : 0,
        status,
      };
    });
    return { level: lvl, nodes };
  });

  return {
    progressByLevel,
    overall: {
      totalValidated,
      totalMastered,
      totalAlmostMastered: totalAlmost,
      totalLearning,
      totalNotLearned: Math.max(0, totalValidated - totalMastered - totalAlmost - totalLearning),
      totalMistakeWords,
      unclassifiedCount,
      percent: totalValidated > 0 ? Math.round((totalMastered / totalValidated) * 1000) / 10 : 0,
      accuracy:
        totalAttemptCount > 0
          ? Math.round((totalCorrectAnswers / totalAttemptCount) * 100)
          : null,
    },
    stats,
    achievements,
    learningPath,
    sessions: sessRes.rows.map((r) => ({
      ...r,
      results: JSON.parse(String(r.results ?? "{}")),
      filters: JSON.parse(String(r.filters ?? "{}")),
    })),
    jobs: jobRes.rows,
    ...(includeWords ? { words: rawWords.slice(0, 250) } : {}),
  };
}
