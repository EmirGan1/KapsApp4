import { generateSatQuestions, GeneratedSatQuestion } from "./aiService";

export interface QuestionQueryOptions {
  section: "math" | "reading_writing" | string;
  domain?: string;
  topic?: string;
  difficulty?: "easy" | "medium" | "hard" | string;
  targetCount: number;
  userId?: string;
  retryIncorrect?: boolean;
}

export interface SatQuestionItem {
  id: number;
  section: string;
  domain: string;
  topic: string;
  difficulty: string;
  question_text: string;
  context_passage: string | null;
  question_type: string;
  options: string[] | null;
  correct_answer?: string;
  explanation: string;
  question_number?: number;
}

/**
 * Universal ID & Text Deduplication Shield.
 * Guarantees no question appears more than once in a test or practice session.
 */
export function deduplicateQuestions<T extends { id?: number | string; question_text?: string; context_passage?: string | null }>(
  list: T[]
): T[] {
  const seenIds = new Set<string>();
  const seenTexts = new Set<string>();

  return (list || []).filter((q) => {
    if (!q) return false;

    // Check ID uniqueness
    if (q.id !== undefined && q.id !== null && q.id !== "") {
      const idKey = String(q.id);
      if (seenIds.has(idKey)) return false;
      seenIds.add(idKey);
    }

    // Check Text & Passage uniqueness
    const textKey = `${String(q.question_text || "").trim().toLowerCase()}||${String(q.context_passage || "").trim().toLowerCase()}`;
    if (textKey.length > 5) {
      if (seenTexts.has(textKey)) return false;
      seenTexts.add(textKey);
    }

    return true;
  });
}

/**
 * Inserts an AI-generated question into the sat_questions table and returns the row with its assigned DB id.
 */
export async function insertGeneratedQuestion(
  client: any,
  q: GeneratedSatQuestion
): Promise<SatQuestionItem | null> {
  try {
    const res = await client.execute({
      sql: `INSERT INTO sat_questions (
        section, domain, topic, difficulty, question_text,
        context_passage, question_type, options, correct_answer, explanation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [
        q.section,
        q.domain,
        q.topic,
        q.difficulty,
        q.question_text,
        q.context_passage || null,
        q.question_type,
        q.options ? JSON.stringify(q.options) : null,
        q.correct_answer,
        q.explanation
      ]
    });

    const newId = Number(res.rows?.[0]?.id || res.lastInsertRowid || 0);

    return {
      id: newId,
      section: q.section,
      domain: q.domain,
      topic: q.topic,
      difficulty: q.difficulty,
      question_text: q.question_text,
      context_passage: q.context_passage || null,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation
    };
  } catch (err: any) {
    console.error("[satService] Error inserting generated question into DB:", err?.message || err);
    return null;
  }
}

/**
 * Central "Get from DB or Generate via AI" Engine.
 * Replaces all padding and repetition logic with dynamic AI-backed question synthesis.
 */
export async function getOrGenerateQuestions(
  client: any,
  options: QuestionQueryOptions
): Promise<SatQuestionItem[]> {
  const {
    section,
    domain,
    topic,
    difficulty,
    targetCount,
    userId = "guest",
    retryIncorrect = false
  } = options;

  console.log(
    `[satService] getOrGenerateQuestions initiated -> targetCount: ${targetCount}, section: ${section}, topic: ${topic || "all"}, user: ${userId}`
  );

  // -------------------------------------------------------------------------
  // ADIM 1: Veritabanından Kullanıcının Çözmediği Benzersiz Soruları Çek
  // -------------------------------------------------------------------------
  let whereClauses: string[] = ["section = ?"];
  let args: any[] = [section];

  if (domain && domain !== "all") {
    whereClauses.push("domain = ?");
    args.push(domain);
  }

  if (topic && topic !== "all") {
    whereClauses.push("topic = ?");
    args.push(topic);
  }

  if (difficulty && difficulty !== "all") {
    whereClauses.push("difficulty = ?");
    args.push(difficulty);
  }

  // Answered filtering
  if (userId !== "guest") {
    if (retryIncorrect) {
      whereClauses.push(
        `id IN (SELECT question_id FROM user_sat_answers WHERE user_id = ? AND is_correct = 0)`
      );
      args.push(userId);
    } else {
      whereClauses.push(
        `id NOT IN (SELECT question_id FROM user_sat_answers WHERE user_id = ?)`
      );
      args.push(userId);
    }
  }

  const whereSql = "WHERE " + whereClauses.join(" AND ");
  const dbResult = await client.execute({
    sql: `SELECT DISTINCT id, section, domain, topic, difficulty, question_text, context_passage, question_type, options, explanation
          FROM sat_questions
          ${whereSql}
          ORDER BY RANDOM()
          LIMIT ?`,
    args: [...args, targetCount]
  });

  let rawDbQuestions: SatQuestionItem[] = (dbResult.rows || []).map((row: any) => ({
    id: Number(row.id),
    section: String(row.section),
    domain: String(row.domain),
    topic: String(row.topic),
    difficulty: String(row.difficulty),
    question_text: String(row.question_text),
    context_passage: row.context_passage ? String(row.context_passage) : null,
    question_type: String(row.question_type),
    options: row.options ? JSON.parse(row.options) : null,
    explanation: String(row.explanation || "")
  }));

  // Initial deduplication
  let uniqueQuestions = deduplicateQuestions(rawDbQuestions);

  // -------------------------------------------------------------------------
  // ADIM 2: Eksik Miktarı Hesapla
  // -------------------------------------------------------------------------
  const missingCount = targetCount - uniqueQuestions.length;
  console.log(
    `[satService] Step 1 DB Result: ${uniqueQuestions.length}/${targetCount} questions found. Missing count: ${missingCount}`
  );

  // -------------------------------------------------------------------------
  // ADIM 3: Otomatik AI Tamamlama (Fallback Generation via Gemini)
  // -------------------------------------------------------------------------
  if (missingCount > 0) {
    console.log(
      `[satService] Triggering AI generation for ${missingCount} missing questions (${section} / ${topic || domain || "General"})...`
    );

    try {
      const generated = await generateSatQuestions({
        section,
        domain: domain && domain !== "all" ? domain : undefined,
        topic: topic && topic !== "all" ? topic : undefined,
        difficulty: difficulty && difficulty !== "all" ? difficulty : undefined,
        count: missingCount
      });

      // -----------------------------------------------------------------------
      // ADIM 4: Kalıcı Kayıt ve Birleştirme
      // -----------------------------------------------------------------------
      for (const gq of generated) {
        // Prevent duplicate texts
        const isDuplicateText = uniqueQuestions.some(
          (uq) =>
            uq.question_text.trim().toLowerCase() === gq.question_text.trim().toLowerCase()
        );

        if (!isDuplicateText) {
          const inserted = await insertGeneratedQuestion(client, gq);
          if (inserted) {
            uniqueQuestions.push(inserted);
          }
        }
      }
    } catch (aiErr: any) {
      console.error("[satService] AI generation failed gracefully:", aiErr?.message || aiErr);
    }

    // If still missing after AI generation (e.g. quota limit reached):
    // Fall back to querying existing answered questions from DB, BUT NEVER DUPLICATE ANY QUESTION!
    if (uniqueQuestions.length < targetCount && userId !== "guest" && !retryIncorrect) {
      const stillNeeded = targetCount - uniqueQuestions.length;
      const existingIds = uniqueQuestions.map((q) => q.id);
      const placeholders = existingIds.length > 0 ? existingIds.map(() => "?").join(",") : "0";

      let baseWhere = ["section = ?"];
      let baseArgs: any[] = [section];

      if (domain && domain !== "all") {
        baseWhere.push("domain = ?");
        baseArgs.push(domain);
      }
      if (topic && topic !== "all") {
        baseWhere.push("topic = ?");
        baseArgs.push(topic);
      }
      if (difficulty && difficulty !== "all") {
        baseWhere.push("difficulty = ?");
        baseArgs.push(difficulty);
      }

      baseWhere.push(`id NOT IN (${placeholders})`);
      baseArgs.push(...existingIds);

      const secondaryDbRes = await client.execute({
        sql: `SELECT DISTINCT id, section, domain, topic, difficulty, question_text, context_passage, question_type, options, explanation
              FROM sat_questions
              WHERE ${baseWhere.join(" AND ")}
              ORDER BY RANDOM()
              LIMIT ?`,
        args: [...baseArgs, stillNeeded]
      });

      for (const row of secondaryDbRes.rows) {
        uniqueQuestions.push({
          id: Number(row.id),
          section: String(row.section),
          domain: String(row.domain),
          topic: String(row.topic),
          difficulty: String(row.difficulty),
          question_text: String(row.question_text),
          context_passage: row.context_passage ? String(row.context_passage) : null,
          question_type: String(row.question_type),
          options: row.options ? JSON.parse(row.options) : null,
          explanation: String(row.explanation || "")
        });
      }
    }
  }

  // Final Strict Deduplication Shield
  const finalQuestions = deduplicateQuestions(uniqueQuestions).slice(0, targetCount);

  // Verification Log
  const idSet = new Set(finalQuestions.map((q) => q.id));
  const is100PercentUnique = idSet.size === finalQuestions.length;

  console.log(
    `[satService] Delivering ${finalQuestions.length}/${targetCount} questions. Uniqueness check: ${
      is100PercentUnique ? "PASSED (100% Unique)" : "FAILED (Duplicate Detected)"
    } (Unique IDs: ${idSet.size})`
  );

  return finalQuestions;
}
