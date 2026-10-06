import { Express, Request, Response } from "express";
import { SEED_SAT_QUESTIONS } from "./satQuestionsData";
import { SAT_QUESTIONS_500 } from "./satQuestions500Data";
import { SAT_QUESTIONS_BATCH2 } from "./satQuestionsBatch2Data";
import { getOrGenerateQuestions, deduplicateQuestions } from "./satService";

const ALL_SAT_QUESTIONS = [...SEED_SAT_QUESTIONS, ...SAT_QUESTIONS_500, ...SAT_QUESTIONS_BATCH2];

export async function initSatDb(client: any) {
  try {
    // 1. sat_questions
    await client.execute(`CREATE TABLE IF NOT EXISTS sat_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      domain TEXT NOT NULL,
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      question_text TEXT NOT NULL,
      context_passage TEXT,
      question_type TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT NOT NULL
    )`);

    // 2. user_sat_answers
    await client.execute(`CREATE TABLE IF NOT EXISTS user_sat_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      selected_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      time_spent_seconds INTEGER DEFAULT 0,
      mode TEXT DEFAULT 'topic_practice',
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Index on user_sat_answers
    try {
      await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_sat ON user_sat_answers (user_id, question_id)`);
    } catch {}

    // 3. user_sat_sessions
    await client.execute(`CREATE TABLE IF NOT EXISTS user_sat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      test_type TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      total_questions INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Check existing count of sat_questions
    const countRes = await client.execute(`SELECT COUNT(*) as cnt FROM sat_questions`);
    const currentCount = Number(countRes.rows[0]?.cnt || 0);

    if (currentCount < ALL_SAT_QUESTIONS.length) {
      console.log(`[kapSAT] Seeding question bank (${ALL_SAT_QUESTIONS.length} questions)...`);
      const existingRes = await client.execute(`SELECT question_text, context_passage FROM sat_questions`);
      const existingSet = new Set((existingRes.rows || []).map((r: any) =>
        `${String(r.question_text || '').trim()}||${String(r.context_passage || '').trim()}`
      ));

      for (const q of ALL_SAT_QUESTIONS) {
        const key = `${String(q.question_text || '').trim()}||${String(q.context_passage || '').trim()}`;
        if (!existingSet.has(key)) {
          await client.execute({
            sql: `INSERT INTO sat_questions (
              section, domain, topic, difficulty, question_text, 
              context_passage, question_type, options, correct_answer, explanation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          existingSet.add(key);
        }
      }
      console.log(`[kapSAT] Question bank seeded successfully. Total questions available: ${existingSet.size}`);
    }
  } catch (err) {
    console.error("[kapSAT] Database initialization error:", err);
  }
}

// Helper to check answer correctness
export function checkAnswerCorrectness(
  questionType: string,
  selectedAnswer: string,
  correctAnswer: string
): boolean {
  if (!selectedAnswer) return false;
  const sel = selectedAnswer.trim();
  const cor = correctAnswer.trim();

  if (questionType === "multiple_choice") {
    // E.g. 'A', 'B', 'C', 'D' or 'A) ...'
    const selLetter = sel.replace(/[\)\.\s].*$/, "").toUpperCase();
    const corLetter = cor.replace(/[\)\.\s].*$/, "").toUpperCase();
    return selLetter === corLetter || sel.toLowerCase() === cor.toLowerCase();
  }

  // Student-produced response (grid-in / numerical)
  // Exact string match
  if (sel.toLowerCase() === cor.toLowerCase()) return true;

  // Fraction or Decimal parsing: e.g. "14/3" vs 4.666, "1/2" vs "0.5"
  const parseNum = (val: string): number | null => {
    if (val.includes("/")) {
      const parts = val.split("/").map(p => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[1] !== 0) {
        return parts[0] / parts[1];
      }
    }
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
  };

  const selNum = parseNum(sel);
  const corNum = parseNum(cor);
  if (selNum !== null && corNum !== null) {
    return Math.abs(selNum - corNum) < 0.01;
  }

  return false;
}

export function setupSatRoutes(
  app: Express,
  client: any,
  authenticateToken: (req: any) => Promise<any>
) {
  // -------------------------------------------------------------------------
  // 1. STATS: Overall user performance, daily goal, topic breakdown
  // -------------------------------------------------------------------------
  app.get("/api/sat/stats", async (req: Request, res: Response) => {
    try {
      const authUser = await authenticateToken(req);
      const userId = authUser ? String(authUser.id) : "guest";

      // Total pool questions
      const poolRes = await client.execute(`SELECT COUNT(*) as total_pool FROM sat_questions`);
      const totalPool = Number(poolRes.rows[0]?.total_pool || 0);

      // Section counts in pool
      const sectionCountsRes = await client.execute(`
        SELECT section, COUNT(*) as count 
        FROM sat_questions 
        GROUP BY section
      `);
      const poolBySection: Record<string, number> = { math: 0, reading_writing: 0 };
      for (const row of sectionCountsRes.rows) {
        poolBySection[String(row.section)] = Number(row.count);
      }

      if (userId === "guest") {
        return res.json({
          total_pool: totalPool,
          pool_by_section: poolBySection,
          total_answered: 0,
          total_correct: 0,
          accuracy: 0,
          today_answered: 0,
          today_correct: 0,
          topics_breakdown: [],
          recent_sessions: []
        });
      }

      // Total user answers
      const totalUserRes = await client.execute({
        sql: `SELECT 
                COUNT(*) as total_answered,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as total_correct,
                AVG(time_spent_seconds) as avg_time
              FROM user_sat_answers 
              WHERE user_id = ?`,
        args: [userId]
      });
      const totalAnswered = Number(totalUserRes.rows[0]?.total_answered || 0);
      const totalCorrect = Number(totalUserRes.rows[0]?.total_correct || 0);
      const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
      const avgTime = Math.round(Number(totalUserRes.rows[0]?.avg_time || 0));

      // Today's answered
      const todayRes = await client.execute({
        sql: `SELECT 
                COUNT(*) as today_answered,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as today_correct
              FROM user_sat_answers 
              WHERE user_id = ? AND date(answered_at) = date('now')`,
        args: [userId]
      });
      const todayAnswered = Number(todayRes.rows[0]?.today_answered || 0);
      const todayCorrect = Number(todayRes.rows[0]?.today_correct || 0);

      // Breakdown by domain & topic
      const breakdownRes = await client.execute({
        sql: `
          SELECT 
            q.section,
            q.domain,
            q.topic,
            COUNT(DISTINCT q.id) as total_questions,
            COUNT(DISTINCT a.question_id) as answered_count,
            SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_count
          FROM sat_questions q
          LEFT JOIN user_sat_answers a 
            ON q.id = a.question_id AND a.user_id = ?
          GROUP BY q.section, q.domain, q.topic
          ORDER BY q.section, q.domain, q.topic
        `,
        args: [userId]
      });

      const topicsBreakdown = breakdownRes.rows.map((r: any) => ({
        section: String(r.section),
        domain: String(r.domain),
        topic: String(r.topic),
        total_questions: Number(r.total_questions),
        answered_count: Number(r.answered_count || 0),
        correct_count: Number(r.correct_count || 0),
        accuracy: Number(r.answered_count) > 0 
          ? Math.round((Number(r.correct_count) / Number(r.answered_count)) * 100) 
          : 0
      }));

      // Recent completed sessions
      const sessionsRes = await client.execute({
        sql: `SELECT id, test_type, score, total_questions, completed, created_at 
              FROM user_sat_sessions 
              WHERE user_id = ? 
              ORDER BY created_at DESC 
              LIMIT 5`,
        args: [userId]
      });

      res.json({
        total_pool: totalPool,
        pool_by_section: poolBySection,
        total_answered: totalAnswered,
        total_correct: totalCorrect,
        accuracy,
        avg_time: avgTime,
        today_answered: todayAnswered,
        today_correct: todayCorrect,
        topics_breakdown: topicsBreakdown,
        recent_sessions: sessionsRes.rows
      });
    } catch (err: any) {
      console.error("[kapSAT] /api/sat/stats error:", err);
      res.status(500).json({ error: "İstatistikler yüklenirken bir hata oluştu." });
    }
  });

  // -------------------------------------------------------------------------
  // 2. TOPICS: Catalog of sections, domains, and topics
  // -------------------------------------------------------------------------
  app.get("/api/sat/topics", async (req: Request, res: Response) => {
    try {
      const authUser = await authenticateToken(req);
      const userId = authUser ? String(authUser.id) : "guest";

      const query = `
        SELECT 
          q.section,
          q.domain,
          q.topic,
          COUNT(DISTINCT q.id) as total_count,
          COUNT(DISTINCT a.question_id) as answered_count,
          SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_count
        FROM sat_questions q
        LEFT JOIN user_sat_answers a 
          ON q.id = a.question_id AND a.user_id = ?
        GROUP BY q.section, q.domain, q.topic
        ORDER BY q.section, q.domain, q.topic
      `;

      const result = await client.execute({ sql: query, args: [userId] });
      res.json({ topics: result.rows });
    } catch (err: any) {
      console.error("[kapSAT] /api/sat/topics error:", err);
      res.status(500).json({ error: "Konular yüklenemedi." });
    }
  });

  // -------------------------------------------------------------------------
  // 3. PRACTICE: Topic-based practice (Central Engine + AI Auto-generation)
  // -------------------------------------------------------------------------
  app.get("/api/sat/practice", async (req: Request, res: Response) => {
    try {
      const authUser = await authenticateToken(req);
      const userId = authUser ? String(authUser.id) : "guest";

      const section = (req.query.section as string) || "reading_writing";
      const domain = req.query.domain as string;
      const topic = req.query.topic as string;
      const difficulty = req.query.difficulty as string;
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || 15), 10)));
      const retryIncorrect = req.query.retry_incorrect === "true";

      const questions = await getOrGenerateQuestions(client, {
        section,
        domain,
        topic,
        difficulty,
        targetCount: limit,
        userId,
        retryIncorrect
      });

      // Category count queries
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
      const countWhere = "WHERE " + whereClauses.join(" AND ");

      const totalInCategoryRes = await client.execute({
        sql: `SELECT COUNT(*) as count FROM sat_questions ${countWhere}`,
        args: [...args]
      });
      const totalInCategory = Number(totalInCategoryRes.rows[0]?.count || 0);

      let answeredCount = 0;
      if (userId !== "guest") {
        const answeredRes = await client.execute({
          sql: `SELECT COUNT(DISTINCT a.question_id) as answered 
                FROM user_sat_answers a 
                JOIN sat_questions q ON a.question_id = q.id 
                WHERE a.user_id = ? AND ${whereClauses.join(" AND ")}`,
          args: [userId, ...args]
        });
        answeredCount = Number(answeredRes.rows[0]?.answered || 0);
      }

      const allCompleted = questions.length === 0 && totalInCategory > 0 && answeredCount >= totalInCategory;

      res.json({
        questions,
        total_in_category: totalInCategory,
        answered_in_category: answeredCount,
        all_completed: allCompleted,
        retry_mode: retryIncorrect
      });
    } catch (err: any) {
      console.error("[kapSAT] /api/sat/practice error:", err);
      res.status(500).json({ error: "Alıştırma soruları alınırken bir hata oluştu." });
    }
  });

  // -------------------------------------------------------------------------
  // 4. MINI TEST: 30 Questions (15 R&W + 15 Math), 35 Minutes
  // -------------------------------------------------------------------------
  app.get("/api/sat/mini-test", async (req: Request, res: Response) => {
    try {
      const authUser = await authenticateToken(req);
      const userId = authUser ? String(authUser.id) : "guest";
      const sessionId = `mini_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // 1. Get 15 Reading & Writing questions via central engine
      const rwQuestions = await getOrGenerateQuestions(client, {
        section: "reading_writing",
        targetCount: 15,
        userId
      });

      // 2. Get 15 Math questions via central engine
      const mathQuestions = await getOrGenerateQuestions(client, {
        section: "math",
        targetCount: 15,
        userId
      });

      // Combine: Section 1 = R&W (1-15), Section 2 = Math (16-30)
      const combined = deduplicateQuestions([...rwQuestions, ...mathQuestions]).map((row: any, idx: number) => ({
        ...row,
        question_number: idx + 1
      }));

      // Record session in DB
      if (userId !== "guest") {
        await client.execute({
          sql: `INSERT INTO user_sat_sessions (id, user_id, test_type, score, total_questions, completed)
                VALUES (?, ?, 'mini', 0, ?, 0)`,
          args: [sessionId, userId, combined.length]
        });
      }

      res.json({
        session_id: sessionId,
        title: "kapSAT Mini Deneme Sınavı",
        test_type: "mini",
        time_limit_seconds: 2100, // 35 minutes
        total_questions: combined.length,
        modules: [
          { name: "Reading and Writing", start_index: 0, count: rwQuestions.length },
          { name: "Math", start_index: rwQuestions.length, count: mathQuestions.length }
        ],
        questions: combined
      });
    } catch (err: any) {
      console.error("[kapSAT] /api/sat/mini-test error:", err);
      res.status(500).json({ error: "Mini deneme oluşturulurken bir hata oluştu." });
    }
  });

  // -------------------------------------------------------------------------
  // 5. FULL TEST: Comprehensive Digital SAT Simulation (54 R&W + 44 Math)
  // -------------------------------------------------------------------------
  app.get("/api/sat/full-test", async (req: Request, res: Response) => {
    try {
      const authUser = await authenticateToken(req);
      const userId = authUser ? String(authUser.id) : "guest";
      const sessionId = `full_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // 1. Get 54 Reading & Writing questions via central engine
      const rwQuestions = await getOrGenerateQuestions(client, {
        section: "reading_writing",
        targetCount: 54,
        userId
      });

      // 2. Get 44 Math questions via central engine
      const mathQuestions = await getOrGenerateQuestions(client, {
        section: "math",
        targetCount: 44,
        userId
      });

      const combined = deduplicateQuestions([...rwQuestions, ...mathQuestions]).map((row: any, idx: number) => ({
        ...row,
        question_number: idx + 1
      }));

      if (userId !== "guest") {
        await client.execute({
          sql: `INSERT INTO user_sat_sessions (id, user_id, test_type, score, total_questions, completed)
                VALUES (?, ?, 'full', 0, ?, 0)`,
          args: [sessionId, userId, combined.length]
        });
      }

      res.json({
        session_id: sessionId,
        title: "kapSAT Komple Digital SAT Deneme Sınavı",
        test_type: "full",
        time_limit_seconds: 4000, // ~66 minutes
        total_questions: combined.length,
        modules: [
          { name: "Reading and Writing", start_index: 0, count: rwQuestions.length },
          { name: "Math", start_index: rwQuestions.length, count: mathQuestions.length }
        ],
        questions: combined
      });
    } catch (err: any) {
      console.error("[kapSAT] /api/sat/full-test error:", err);
      res.status(500).json({ error: "Komple deneme oluşturulamadı." });
    }
  });

  // -------------------------------------------------------------------------
  // 6. SUBMIT SINGLE ANSWER: Practice mode instant check & recording
  // -------------------------------------------------------------------------
  app.post("/api/sat/submit-answer", async (req: Request, res: Response) => {
    try {
      const authUser = await authenticateToken(req);
      const userId = authUser ? String(authUser.id) : "guest";

      const { question_id, selected_answer, time_spent_seconds = 0, mode = "topic_practice" } = req.body;
      if (!question_id) {
        return res.status(400).json({ error: "Soru ID'si gereklidir." });
      }

      const qRes = await client.execute({
        sql: `SELECT id, question_type, correct_answer, explanation FROM sat_questions WHERE id = ?`,
        args: [question_id]
      });

      if (qRes.rows.length === 0) {
        return res.status(404).json({ error: "Soru bulunamadı." });
      }

      const question = qRes.rows[0];
      const isCorrect = checkAnswerCorrectness(
        question.question_type,
        String(selected_answer || ""),
        String(question.correct_answer || "")
      );

      // Record in user_sat_answers if user is logged in
      if (userId !== "guest") {
        await client.execute({
          sql: `INSERT INTO user_sat_answers (
            user_id, question_id, selected_answer, is_correct, time_spent_seconds, mode
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            userId,
            question_id,
            String(selected_answer || ""),
            isCorrect ? 1 : 0,
            time_spent_seconds,
            mode
          ]
        });
      }

      res.json({
        question_id,
        is_correct: isCorrect,
        correct_answer: question.correct_answer,
        explanation: question.explanation
      });
    } catch (err: any) {
      console.error("[kapSAT] /api/sat/submit-answer error:", err);
      res.status(500).json({ error: "Cevap işlenirken bir hata oluştu." });
    }
  });

  // -------------------------------------------------------------------------
  // 7. SUBMIT SESSION: Complete a mini or full test, calculate score & report
  // -------------------------------------------------------------------------
  app.post("/api/sat/submit-session", async (req: Request, res: Response) => {
    try {
      const authUser = await authenticateToken(req);
      const userId = authUser ? String(authUser.id) : "guest";

      const { session_id, test_type = "mini", answers = [], time_spent_total = 0 } = req.body;
      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ error: "Cevap listesi boş olamaz." });
      }

      // Fetch all relevant questions
      const qIds = answers.map((a: any) => a.question_id);
      const placeholders = qIds.map(() => "?").join(",");
      const questionsRes = await client.execute({
        sql: `SELECT id, section, domain, topic, question_type, correct_answer, explanation 
              FROM sat_questions 
              WHERE id IN (${placeholders})`,
        args: qIds
      });

      const questionMap: Record<number, any> = {};
      for (const q of questionsRes.rows) {
        questionMap[Number(q.id)] = q;
      }

      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;
      const gradedAnswers: any[] = [];

      for (const a of answers) {
        const q = questionMap[Number(a.question_id)];
        if (!q) continue;

        const sel = a.selected_answer ? String(a.selected_answer).trim() : "";
        if (!sel) {
          unansweredCount++;
          gradedAnswers.push({
            question_id: a.question_id,
            selected_answer: "",
            correct_answer: q.correct_answer,
            is_correct: false,
            explanation: q.explanation,
            time_spent_seconds: a.time_spent_seconds || 0,
            section: q.section,
            topic: q.topic
          });
          continue;
        }

        const isCorrect = checkAnswerCorrectness(q.question_type, sel, q.correct_answer);
        if (isCorrect) correctCount++;
        else incorrectCount++;

        gradedAnswers.push({
          question_id: a.question_id,
          selected_answer: sel,
          correct_answer: q.correct_answer,
          is_correct: isCorrect,
          explanation: q.explanation,
          time_spent_seconds: a.time_spent_seconds || 0,
          section: q.section,
          topic: q.topic
        });

        // Record into user_sat_answers
        if (userId !== "guest") {
          await client.execute({
            sql: `INSERT INTO user_sat_answers (
              user_id, question_id, selected_answer, is_correct, time_spent_seconds, mode
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
              userId,
              a.question_id,
              sel,
              isCorrect ? 1 : 0,
              a.time_spent_seconds || 0,
              test_type === "mini" ? "mini_test" : "full_practice"
            ]
          });
        }
      }

      // Compute estimated SAT scale score (out of 1600 or 800)
      const totalGraded = answers.length;
      const rawPct = totalGraded > 0 ? correctCount / totalGraded : 0;
      // Scaled approximation: 400 minimum up to 1600
      const scaledScore = Math.round(400 + rawPct * 1200);

      // Record / update session
      if (userId !== "guest" && session_id) {
        try {
          await client.execute({
            sql: `UPDATE user_sat_sessions 
                  SET score = ?, total_questions = ?, completed = 1 
                  WHERE id = ? AND user_id = ?`,
            args: [scaledScore, totalGraded, session_id, userId]
          });
        } catch {}
      }

      res.json({
        session_id,
        test_type,
        total_questions: totalGraded,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        unanswered_count: unansweredCount,
        accuracy_percent: totalGraded > 0 ? Math.round((correctCount / totalGraded) * 100) : 0,
        scaled_score: scaledScore,
        time_spent_total,
        graded_answers: gradedAnswers
      });
    } catch (err: any) {
      console.error("[kapSAT] /api/sat/submit-session error:", err);
      res.status(500).json({ error: "Sınav oturumu kaydedilirken bir hata oluştu." });
    }
  });

  // -------------------------------------------------------------------------
  // 8. RESET ANSWERS: Allow user to reset answered questions for topic/section
  // -------------------------------------------------------------------------
  app.post("/api/sat/reset-answers", async (req: Request, res: Response) => {
    try {
      const authUser = await authenticateToken(req);
      if (!authUser) {
        return res.status(401).json({ error: "Oturum açmanız gerekmektedir." });
      }

      const userId = String(authUser.id);
      const { section, domain, topic, only_incorrect } = req.body;

      let where = `WHERE user_id = ?`;
      let args: any[] = [userId];

      if (only_incorrect) {
        where += ` AND is_correct = 0`;
      }

      if (topic && topic !== "all") {
        where += ` AND question_id IN (SELECT id FROM sat_questions WHERE topic = ?)`;
        args.push(topic);
      } else if (domain && domain !== "all") {
        where += ` AND question_id IN (SELECT id FROM sat_questions WHERE domain = ?)`;
        args.push(domain);
      } else if (section && section !== "all") {
        where += ` AND question_id IN (SELECT id FROM sat_questions WHERE section = ?)`;
        args.push(section);
      }

      await client.execute({
        sql: `DELETE FROM user_sat_answers ${where}`,
        args
      });

      res.json({ success: true, message: "İlerlemeniz sıfırlandı. Sorular tekrar havuzda!" });
    } catch (err: any) {
      console.error("[kapSAT] /api/sat/reset-answers error:", err);
      res.status(500).json({ error: "Sıfırlama sırasında bir hata oluştu." });
    }
  });
}
