import { initPreparationSchema } from './preparation';
import type { Client, Transaction } from "@libsql/client";
import {
  ACHIEVEMENT_DEFS,
  CEFR_META,
  MASTERY_TARGET,
  XP_RULES,
  isCefrLevel,
  studyLevels,
  type CefrLevel,
  type DistractorDifficulty,
  type MasteryStatus,
} from "../../shared/germanActivities";
import { BUILTIN_CURRICULUM } from "./curriculum";
import {
  GERMAN_CURRICULUM_CATEGORIES,
  buildHierarchicalCurriculum,
  classifyWordIntoHierarchy,
  isCorruptedTopicLabel,
  sanitizeLegacyTopic,
} from "./curriculumHierarchy";
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
import {
  lookupCuratedPronunciation,
  resolvePronunciation,
  type PronunciationGuide,
} from "./pronunciation";

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
  await initPreparationSchema(db);
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
      `CREATE TABLE IF NOT EXISTS german_ai_cache(
        cache_key TEXT PRIMARY KEY,
        feature TEXT NOT NULL,
        source_id TEXT NOT NULL DEFAULT '',
        content_version TEXT NOT NULL DEFAULT 'v1',
        prompt_version TEXT NOT NULL DEFAULT 'v1',
        provider TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'ok',
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT
      )`,
      "CREATE INDEX IF NOT EXISTS german_ai_cache_feature ON german_ai_cache(feature, source_id)",
      `CREATE TABLE IF NOT EXISTS german_question_reports(
        id TEXT PRIMARY KEY,
        dedupe_key TEXT NOT NULL,
        task_fingerprint TEXT NOT NULL,
        task_id TEXT NOT NULL,
        word_id TEXT NOT NULL DEFAULT '',
        exercise_type TEXT NOT NULL,
        level TEXT NOT NULL,
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        comment TEXT NOT NULL DEFAULT '',
        task_snapshot TEXT NOT NULL,
        current_answer TEXT NOT NULL,
        student_answer TEXT NOT NULL DEFAULT '',
        content_version TEXT NOT NULL DEFAULT 'v1',
        ai_review_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending_review',
        admin_note TEXT NOT NULL DEFAULT '',
        correction_json TEXT,
        created_at TEXT NOT NULL,
        reviewed_at TEXT,
        reviewed_by INTEGER
      )`,
      "CREATE INDEX IF NOT EXISTS german_reports_dedupe ON german_question_reports(dedupe_key, status)",
      "CREATE INDEX IF NOT EXISTS german_reports_status ON german_question_reports(status, created_at)",
      `CREATE TABLE IF NOT EXISTS german_question_audits(
        task_fingerprint TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        module TEXT NOT NULL,
        level TEXT NOT NULL,
        audit_status TEXT NOT NULL,
        deterministic_issues_json TEXT NOT NULL,
        ai_review_json TEXT,
        suggested_correction_json TEXT,
        task_snapshot TEXT NOT NULL,
        content_version TEXT NOT NULL DEFAULT 'v1',
        provider TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        audited_at TEXT NOT NULL,
        reviewed_by INTEGER,
        reviewed_at TEXT
      )`,
      "CREATE INDEX IF NOT EXISTS german_audits_status ON german_question_audits(audit_status, audited_at)",
      `CREATE TABLE IF NOT EXISTS german_disabled_questions(
        task_fingerprint TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        disabled_by INTEGER NOT NULL,
        disabled_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS german_question_corrections(
        task_fingerprint TEXT PRIMARY KEY,
        corrected_task_json TEXT NOT NULL,
        approved_by INTEGER NOT NULL,
        approved_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS german_regrade_log(
        id TEXT PRIMARY KEY,
        task_fingerprint TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        session_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        old_is_correct INTEGER NOT NULL,
        new_is_correct INTEGER NOT NULL,
        reason TEXT NOT NULL,
        approved_by INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS german_session_reviews(
        session_id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        metrics_snapshot TEXT NOT NULL,
        review_json TEXT NOT NULL,
        limited_evidence INTEGER NOT NULL DEFAULT 0,
        provider TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        content_version TEXT NOT NULL DEFAULT 'v1',
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS german_vocabulary_cards(
        word_id TEXT PRIMARY KEY,
        content_version TEXT NOT NULL DEFAULT 'v1',
        enriched_json TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL DEFAULT '',
        validation_status TEXT NOT NULL DEFAULT 'validated',
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS german_pronunciation(
        word_id TEXT PRIMARY KEY,
        canonical_key TEXT NOT NULL,
        ipa TEXT NOT NULL DEFAULT '',
        turkish_approx TEXT NOT NULL,
        syllables_json TEXT NOT NULL DEFAULT '[]',
        stress_syllable INTEGER NOT NULL DEFAULT 0,
        notes_tr TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT 'curated',
        verified INTEGER NOT NULL DEFAULT 0,
        content_version TEXT NOT NULL DEFAULT 'v1',
        updated_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS german_pronunciation_key ON german_pronunciation(canonical_key)",
      `CREATE TABLE IF NOT EXISTS german_curriculum_categories(
        id TEXT PRIMARY KEY,
        sort_order INTEGER NOT NULL,
        title_tr TEXT NOT NULL,
        title_de TEXT NOT NULL,
        icon TEXT NOT NULL,
        description_tr TEXT NOT NULL,
        objectives_json TEXT NOT NULL DEFAULT '[]',
        levels_json TEXT NOT NULL DEFAULT '[]'
      )`,
      `CREATE TABLE IF NOT EXISTS german_curriculum_units(
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL,
        category_id TEXT NOT NULL,
        unit_number INTEGER NOT NULL,
        title_tr TEXT NOT NULL,
        title_de TEXT NOT NULL,
        objective_tr TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0,
        word_ids_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS german_curriculum_units_lvl_cat ON german_curriculum_units(level, category_id, unit_number)",
      `CREATE TABLE IF NOT EXISTS german_audio_cache(
        audio_hash TEXT PRIMARY KEY,
        normalized_text TEXT NOT NULL,
        rate TEXT NOT NULL,
        voice_version TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        byte_size INTEGER NOT NULL DEFAULT 0,
        engine TEXT NOT NULL DEFAULT 'server',
        is_public INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS german_audio_cache_lookup ON german_audio_cache(normalized_text, rate, is_public)",
    ],
    "write",
  );

  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN cefr_level TEXT NOT NULL DEFAULT 'UNCLASSIFIED'");
  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN canonical_key TEXT NOT NULL DEFAULT ''");
  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN topic TEXT NOT NULL DEFAULT ''");
  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN category_id TEXT NOT NULL DEFAULT ''");
  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN unit_id TEXT NOT NULL DEFAULT ''");
  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN subtopic TEXT NOT NULL DEFAULT ''");
  await safeAlter(db, "ALTER TABLE german_words ADD COLUMN semantic_tags TEXT NOT NULL DEFAULT '[]'");
  await safeAlter(db, "ALTER TABLE german_sessions ADD COLUMN filters TEXT NOT NULL DEFAULT '{}'");
  await safeAlter(db, "ALTER TABLE german_sessions ADD COLUMN parent_session_id TEXT DEFAULT NULL");
  await safeAlter(db, "ALTER TABLE german_sessions ADD COLUMN reinforcement_direction TEXT DEFAULT NULL");
  await safeAlter(db, "ALTER TABLE german_user_stats ADD COLUMN show_turkish_pronunciation INTEGER NOT NULL DEFAULT 1");
  await safeAlter(db, "ALTER TABLE german_user_stats ADD COLUMN auto_session_review INTEGER NOT NULL DEFAULT 0");
  await safeAlter(db, "ALTER TABLE german_user_stats ADD COLUMN distractor_difficulty TEXT NOT NULL DEFAULT 'adaptive'");

  await db.batch(
    [
      "CREATE INDEX IF NOT EXISTS german_words_level_active ON german_words(active, cefr_level)",
      "CREATE INDEX IF NOT EXISTS german_words_canonical ON german_words(canonical_key)",
      "CREATE INDEX IF NOT EXISTS german_words_category ON german_words(active, cefr_level, category_id, unit_id)",
      "CREATE INDEX IF NOT EXISTS german_sessions_parent ON german_sessions(user_id, parent_session_id, state)",
    ],
    "write",
  );

  await migrateLegacyGermanData(db);
}

export async function getRecentSessionWordIds(
  db: Client,
  userId: number,
  limitSessions = 3,
): Promise<Set<string>> {
  const rows = await db.execute({
    sql: "SELECT tasks FROM german_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT ?",
    args: [userId, limitSessions],
  });
  const ids = new Set<string>();
  for (const r of rows.rows) {
    try {
      const tasks = JSON.parse(String(r.tasks ?? "[]")) as Array<{ vocabularyIds?: string[] }>;
      if (!Array.isArray(tasks)) continue;
      for (const t of tasks) {
        for (const wid of t.vocabularyIds ?? []) {
          if (typeof wid === "string" && wid) ids.add(wid);
        }
      }
    } catch {}
  }
  return ids;
}

export async function migrateLegacyGermanData(db: Client) {
  const wordsRows = await db.execute(
    "SELECT id, data, cefr_level, canonical_key, topic, category_id, subtopic FROM german_words",
  );

  const wordLevelMap = new Map<string, string>();
  const tx = await db.transaction("write");
  try {
    // Seed canonical category definitions table
    for (const cat of GERMAN_CURRICULUM_CATEGORIES) {
      await tx.execute({
        sql: `INSERT INTO german_curriculum_categories(id, sort_order, title_tr, title_de, icon, description_tr, objectives_json, levels_json)
              VALUES(?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET
                sort_order=excluded.sort_order,
                title_tr=excluded.title_tr,
                title_de=excluded.title_de,
                icon=excluded.icon,
                description_tr=excluded.description_tr,
                objectives_json=excluded.objectives_json,
                levels_json=excluded.levels_json`,
        args: [
          cat.id,
          cat.order,
          cat.titleTr,
          cat.titleDe,
          cat.icon,
          cat.descriptionTr,
          JSON.stringify(cat.objectivesTr),
          JSON.stringify(cat.levels),
        ],
      });
    }

    for (const r of wordsRows.rows) {
      const id = String(r.id);
      const parsed = JSON.parse(String(r.data)) as Partial<Vocabulary>;
      const de = String(parsed.de ?? "");
      const tr = String(parsed.tr ?? "");
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

      const rawTopic = String(parsed.topic || r.topic || "");
      const hierarchy = classifyWordIntoHierarchy({
        de,
        tr,
        level: nextLevel,
        topic: rawTopic,
        pos: parsed.pos,
        article: parsed.article ?? "",
        grammar: parsed.grammar ?? "",
        exampleDe: parsed.exampleDe,
        exampleTr: parsed.exampleTr,
      });

      const nextTopic = isCorruptedTopicLabel(rawTopic)
        ? hierarchy.cleanTopic
        : rawTopic || hierarchy.cleanTopic;

      wordLevelMap.set(id, nextLevel);

      if (
        String(r.cefr_level) !== nextLevel ||
        String(r.canonical_key) !== cKey ||
        String(r.topic) !== nextTopic ||
        String(r.category_id ?? "") !== hierarchy.categoryId ||
        String(r.subtopic ?? "") !== hierarchy.subtopicTr ||
        parsed.level !== nextLevel ||
        parsed.canonicalKey !== cKey ||
        parsed.cefrSource !== nextSource ||
        parsed.categoryId !== hierarchy.categoryId ||
        parsed.topic !== nextTopic
      ) {
        const updated: Vocabulary = {
          ...(parsed as Vocabulary),
          id,
          de,
          tr,
          raw: parsed.raw || `${de} — ${tr}`,
          article: parsed.article ?? "",
          grammar: parsed.grammar ?? "",
          canonicalKey: cKey,
          level: nextLevel,
          cefrSource: nextSource ?? "unclassified",
          topic: nextTopic,
          categoryId: hierarchy.categoryId,
          subtopic: hierarchy.subtopicTr,
          semanticTags: hierarchy.semanticTags,
          pos: parsed.pos || hierarchy.inferredPos,
        };
        await tx.execute({
          sql: "UPDATE german_words SET data=?, cefr_level=?, canonical_key=?, topic=?, category_id=?, subtopic=?, semantic_tags=? WHERE id=?",
          args: [
            JSON.stringify(updated),
            nextLevel,
            cKey,
            nextTopic,
            hierarchy.categoryId,
            hierarchy.subtopicTr,
            JSON.stringify(hierarchy.semanticTags),
            id,
          ],
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
      const hierarchy = classifyWordIntoHierarchy({
        de: entry.de,
        tr: entry.tr,
        topic: entry.topic,
        pos: entry.pos,
        level: entry.level,
        grammar: entry.grammar,
        exampleDe: entry.exampleDe,
        exampleTr: entry.exampleTr,
      });
      if (!existing) {
        const vocab: Vocabulary = {
          id: entry.id,
          canonicalKey: ck,
          de: entry.de,
          tr: entry.tr,
          alternatives: entry.alternatives,
          raw: `${entry.de} — ${entry.tr}`,
          topic: hierarchy.cleanTopic,
          categoryId: hierarchy.categoryId,
          subtopic: hierarchy.subtopicTr,
          semanticTags: hierarchy.semanticTags,
          level: entry.level,
          cefrSource: "builtin",
          article: entry.article ?? "",
          plural: entry.plural,
          pos: entry.pos,
          grammar: entry.grammar,
          exampleDe: entry.exampleDe,
          exampleTr: entry.exampleTr,
          conjugation: entry.conjugation,
          completion: entry.completion,
        };
        await tx.execute({
          sql: "INSERT OR IGNORE INTO german_words(id, data, active, imported_at, cefr_level, canonical_key, topic, category_id, subtopic, semantic_tags) VALUES(?,?,1,?,?,?,?,?,?,?)",
          args: [
            vocab.id,
            JSON.stringify(vocab),
            nowIso,
            vocab.level,
            ck,
            vocab.topic,
            hierarchy.categoryId,
            hierarchy.subtopicTr,
            JSON.stringify(hierarchy.semanticTags),
          ],
        });
        byCanonical.set(ck, { id: vocab.id, data: vocab });
        inserted++;
      } else {
        // Safely enrich missing metadata / fix unclassified legacy levels without changing existing ID!
        const prev = existing.data;
        const needsUpdate =
          prev.cefrSource === "builtin" ||
          prev.level === "UNCLASSIFIED" ||
          !prev.categoryId ||
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
          const nextTopic =
            prev.topic && prev.topic !== "Genel" ? sanitizeLegacyTopic(prev.topic) : entry.topic;
          const mergedHierarchy = classifyWordIntoHierarchy({
            de: prev.de || entry.de,
            tr: prev.tr || entry.tr,
            topic: nextTopic,
            pos: prev.pos || entry.pos,
            level: nextLevel,
            grammar: prev.grammar || entry.grammar,
            exampleDe: prev.exampleDe || entry.exampleDe,
            exampleTr: prev.exampleTr || entry.exampleTr,
          });
          const updated: Vocabulary = {
            ...prev,
            id: existing.id,
            canonicalKey: ck,
            alternatives: prev.alternatives?.length ? prev.alternatives : entry.alternatives,
            level: nextLevel,
            cefrSource: nextSource,
            topic: mergedHierarchy.cleanTopic,
            categoryId: mergedHierarchy.categoryId,
            subtopic: mergedHierarchy.subtopicTr,
            semanticTags: mergedHierarchy.semanticTags,
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
            sql: "UPDATE german_words SET data=?, cefr_level=?, canonical_key=?, topic=?, category_id=?, subtopic=?, semantic_tags=? WHERE id=?",
            args: [
              JSON.stringify(updated),
              updated.level,
              ck,
              updated.topic,
              mergedHierarchy.categoryId,
              mergedHierarchy.subtopicTr,
              JSON.stringify(mergedHierarchy.semanticTags),
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
  await syncCuratedPronunciations(db);
  return { inserted, enriched };
}

export async function syncCuratedPronunciations(db: Client): Promise<number> {
  const wordsRows = await db.execute("SELECT id, data, canonical_key FROM german_words WHERE active=1");
  const existingRows = await db.execute("SELECT word_id, source FROM german_pronunciation");
  const existingSource = new Map(
    existingRows.rows.map((r) => [String(r.word_id), String(r.source)]),
  );
  const nowIso = new Date().toISOString();
  let synced = 0;

  const tx = await db.transaction("write");
  try {
    for (const r of wordsRows.rows) {
      const id = String(r.id);
      const parsed = JSON.parse(String(r.data)) as Vocabulary;
      const ck = String(r.canonical_key || canonicalWordKey(parsed.de));
      if (existingSource.get(id) === "admin") continue;
      const curated = lookupCuratedPronunciation(parsed.de);
      if (!curated) continue;
      await tx.execute({
        sql: `INSERT INTO german_pronunciation(
                word_id, canonical_key, ipa, turkish_approx, syllables_json, stress_syllable, notes_tr, source, verified, content_version, updated_at
              ) VALUES(?,?,?,?,?,?,?,?,?, 'v1', ?)
              ON CONFLICT(word_id) DO UPDATE SET
                canonical_key=excluded.canonical_key,
                ipa=excluded.ipa,
                turkish_approx=excluded.turkish_approx,
                syllables_json=excluded.syllables_json,
                stress_syllable=excluded.stress_syllable,
                notes_tr=excluded.notes_tr,
                source='curated',
                verified=1,
                updated_at=excluded.updated_at
              WHERE german_pronunciation.source != 'admin'`,
        args: [
          id,
          ck,
          curated.ipa,
          curated.turkishApprox,
          JSON.stringify(curated.syllables),
          curated.stressSyllable,
          curated.notesTr,
          "curated",
          1,
          nowIso,
        ],
      });
      synced++;
    }
    await tx.commit();
  } finally {
    tx.close();
  }
  return synced;
}

export async function getPronunciationMap(db: Client): Promise<Map<string, PronunciationGuide>> {
  const rows = await db.execute("SELECT * FROM german_pronunciation");
  const map = new Map<string, PronunciationGuide>();
  for (const r of rows.rows) {
    let syllables: string[] = [];
    try {
      const s = JSON.parse(String(r.syllables_json ?? "[]"));
      if (Array.isArray(s)) syllables = s.map(String);
    } catch {}
    map.set(String(r.word_id), {
      ipa: String(r.ipa ?? ""),
      turkishApprox: String(r.turkish_approx ?? ""),
      syllables,
      stressSyllable: Number(r.stress_syllable ?? 0),
      notesTr: String(r.notes_tr ?? ""),
      source: String(r.source ?? "curated") as PronunciationGuide["source"],
      verified: Number(r.verified ?? 0) === 1,
    });
  }
  return map;
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
 * Loads active vocabulary deduplicated by canonicalKey so duplicate DB records never inflate progress,
 * and computes deterministic hierarchical Topic Categories + consolidated Learning Units (`Ünite 1..N`).
 */
export async function loadDeduplicatedWordsWithMastery(
  db: Client,
  userId: number,
  includeInactive = false,
): Promise<{
  uniqueWords: WordWithMastery[];
  rawWords: WordWithMastery[];
  unclassifiedCount: number;
  curriculumHierarchy: ReturnType<typeof buildHierarchicalCurriculum>["hierarchyByLevel"];
}> {
  const [wordRes, masteryMap, pronMap] = await Promise.all([
    db.execute(
      includeInactive
        ? "SELECT id, data, active, imported_at FROM german_words ORDER BY imported_at DESC"
        : "SELECT id, data, active, imported_at FROM german_words WHERE active=1 ORDER BY imported_at DESC",
    ),
    getUserMasteryMap(db, userId),
    getPronunciationMap(db),
  ]);

  const rawWords: WordWithMastery[] = [];
  const byCanonical = new Map<string, WordWithMastery>();
  let unclassifiedCount = 0;

  for (const r of wordRes.rows) {
    const id = String(r.id);
    const parsed = JSON.parse(String(r.data)) as Vocabulary;
    const ck = parsed.canonicalKey || canonicalWordKey(parsed.de);
    const mastery = masteryMap.get(id) ?? newMastery(id, parsed.level);
    const pronunciation = resolvePronunciation(parsed.de, pronMap.get(id) ?? null);
    const hierarchy = classifyWordIntoHierarchy({
      de: parsed.de,
      tr: parsed.tr,
      topic: parsed.topic,
      pos: parsed.pos,
      level: parsed.level,
      grammar: parsed.grammar,
      exampleDe: parsed.exampleDe,
      exampleTr: parsed.exampleTr,
    });
    const full: WordWithMastery = {
      ...parsed,
      id,
      canonicalKey: ck,
      topic: hierarchy.cleanTopic,
      categoryId: parsed.categoryId || hierarchy.categoryId,
      subtopic: parsed.subtopic || hierarchy.subtopicTr,
      semanticTags: parsed.semanticTags?.length ? parsed.semanticTags : hierarchy.semanticTags,
      pos: parsed.pos || hierarchy.inferredPos,
      pronunciation,
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

  const uniqueWords = [...byCanonical.values()];
  const hierarchyBuilt = buildHierarchicalCurriculum(uniqueWords);

  for (const w of uniqueWords) {
    const placement = hierarchyBuilt.wordUnitAssignment.get(w.id);
    if (placement) {
      w.categoryId = placement.categoryId;
      w.unitId = placement.unitId;
      w.subtopic = placement.subtopicTr;
      w.semanticTags = placement.semanticTags;
      w.topic = placement.subtopicTr;
    }
  }
  for (const rw of rawWords) {
    const placement = hierarchyBuilt.wordUnitAssignment.get(rw.id);
    if (placement) {
      rw.categoryId = placement.categoryId;
      rw.unitId = placement.unitId;
      rw.subtopic = placement.subtopicTr;
      rw.semanticTags = placement.semanticTags;
      rw.topic = placement.subtopicTr;
    }
  }

  return {
    uniqueWords,
    rawWords,
    unclassifiedCount,
    curriculumHierarchy: hierarchyBuilt.hierarchyByLevel,
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
    pairResults?: boolean[];
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
  let insertedCount = 0;
  let taskXpAwarded = false;
  const newlyMastered: Array<{ wordId: string; de: string; tr: string; level: string }> = [];
  const masteryUpdates: Record<string, MasteryRecord> = {};

  const hasPerPair =
    input.exerciseType === "matching" &&
    Array.isArray(input.pairResults) &&
    input.pairResults.length === input.vocabularyIds.length;

  for (let idx = 0; idx < input.vocabularyIds.length; idx++) {
    const wordId = input.vocabularyIds[idx];
    const itemCorrect = hasPerPair ? Boolean(input.pairResults![idx]) : input.isCorrect;
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
        itemCorrect ? 1 : 0,
        input.isReview ? 1 : 0,
        0,
        nowIso,
      ],
    });

    if (!ins.rows.length) {
      continue;
    }
    insertedCount++;

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
    const nextMastery = applyMasteryAttempt(oldMastery, itemCorrect, {
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

    let itemXp = 0;
    if (input.isCorrect && !taskXpAwarded) {
      itemXp += XP_RULES.CORRECT_ANSWER;
      taskXpAwarded = true;
    }
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

  const alreadyApplied = insertedCount === 0;
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
    ) VALUES(?,?,?,'__lesson_complete','__lesson','lesson','ALL','',1,0,?,?) RETURNING attempt_key`,
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

  const [
    { uniqueWords, rawWords, unclassifiedCount, curriculumHierarchy },
    statsRes,
    dailyRes,
    achRes,
    sessRes,
    jobRes,
  ] = await Promise.all([
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
      sql: "SELECT id, module, mode, state, started_at, deadline, results, filters, parent_session_id, reinforcement_direction FROM german_sessions WHERE user_id=? ORDER BY started_at DESC LIMIT 40",
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

    const levelHierarchy = curriculumHierarchy.find((h) => h.level === lvl);
    const categories = levelHierarchy?.categories ?? [];
    const totalUnits = categories.reduce((s: number, c: any) => s + c.totalUnits, 0);
    const completedUnits = categories.reduce((s: number, c: any) => s + c.completedUnits, 0);

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
      totalCategories: categories.length,
      totalUnits,
      completedUnits,
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
  const rawDifficulty = String(statsRow?.distractor_difficulty ?? "adaptive");
  const distractorDifficulty = (
    ["adaptive", "easy", "normal", "challenging"].includes(rawDifficulty)
      ? rawDifficulty
      : "adaptive"
  ) as "adaptive" | "easy" | "normal" | "challenging";

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
    distractorDifficulty,
    perfectLessons: Number(statsRow?.perfect_lessons ?? 0),
    showTurkishPronunciation:
      statsRow?.show_turkish_pronunciation === undefined || statsRow?.show_turkish_pronunciation === null
        ? true
        : Number(statsRow.show_turkish_pronunciation) === 1,
    autoSessionReview: Number(statsRow?.auto_session_review ?? 0) === 1,
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

  // Build consolidated CEFR Learning Path per level from hierarchical units (never 473 fragmented single-word nodes)
  const learningPath = studyLevels.map((lvl) => {
    const levelHierarchy = curriculumHierarchy.find((h) => h.level === lvl);
    const categories = levelHierarchy?.categories ?? [];
    const nodes: Array<{
      id: string;
      level: CefrLevel;
      order: number;
      topic: string;
      categoryId: string;
      unitId: string;
      totalWords: number;
      masteredWords: number;
      percent: number;
      status: "completed" | "current" | "available" | "review";
    }> = [];
    let order = 1;
    let foundCurrent = false;
    for (const cat of categories) {
      for (const unit of cat.units) {
        let status: "completed" | "current" | "available" | "review" = "available";
        if (unit.status === "completed") {
          status = "completed";
        } else if (!foundCurrent && (unit.status === "current" || order === 1)) {
          status = "current";
          foundCurrent = true;
        } else if (unit.mistakeWords > 0) {
          status = "review";
        }
        nodes.push({
          id: unit.id,
          level: lvl,
          order: order++,
          topic: `${cat.titleTr} • ${unit.titleTr}`,
          categoryId: cat.id,
          unitId: unit.id,
          totalWords: unit.totalWords,
          masteredWords: unit.masteredWords,
          percent: unit.percent,
          status,
        });
      }
    }
    return { level: lvl, nodes };
  });

  return {
    progressByLevel,
    curriculumHierarchy,
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
