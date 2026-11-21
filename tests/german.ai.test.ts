import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { once } from "node:events";
import { createClient } from "@libsql/client";
import {
  getGermanAIStatus,
  resetGermanAIStateForTests,
  runGermanAI,
  setGermanAITransportForTests,
} from "../src/server/german/provider";
import { registerGerman, seedBuiltinCurriculum } from "../src/server/german";
import {
  explainAttemptWithAI,
  generatePersonalizedReinforcement,
  generateSessionPerformanceReview,
  getOrEnrichVocabularyCard,
} from "../src/server/german/aiFeatures";
import {
  auditTaskDeterministically,
  auditTaskWithAI,
  resolveReportOrAudit,
  submitQuestionReport,
} from "../src/server/german/auditor";
import { computeWordDiff, evaluateGoetheSchreibenWithAI } from "../src/server/german/schreiben";
import { BUILTIN_CURRICULUM } from "../src/server/german/curriculum";
import { canonicalWordKey } from "../src/server/german/cefr";
import type { Task, Vocabulary } from "../src/server/german/learning";

function makeWord(partial: Partial<Vocabulary> & { id: string; de: string; tr: string }): Vocabulary {
  return {
    canonicalKey: canonicalWordKey(partial.de),
    raw: `${partial.de} — ${partial.tr}`,
    topic: "Genel",
    level: "A1",
    cefrSource: "builtin",
    article: "",
    plural: "",
    pos: "noun",
    grammar: "",
    alternatives: [],
    ...partial,
  };
}

async function setupAppDb() {
  const db = createClient({ url: "file::memory:" });
  const app = express();
  await db.execute("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT)");
  await db.execute("INSERT INTO users VALUES(1,'Emirgan'),(2,'Student')");
  registerGerman(
    app,
    db,
    async (req) => {
      const id = Number(req.headers.authorization?.replace("Bearer ", ""));
      return Number.isSafeInteger(id) && id > 0 ? { id } : null;
    },
    (_q, _s, n) => n(),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = `http://127.0.0.1:${addr.port}/api/kaps-german`;
  const ask = (path: string, user = 1, body?: unknown) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${user}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  await seedBuiltinCurriculum(db);
  await db.execute("INSERT OR IGNORE INTO german_permissions VALUES(2, 1)");

  return {
    db,
    ask,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      db.close();
    },
  };
}

test("AI Provider: request coalescing, SQLite cache versioning, retry & JSON schema rejection", async () => {
  const { db, close } = await setupAppDb();
  resetGermanAIStateForTests();
  let calls = 0;

  try {
    // 1. In-flight coalescing + SQLite persistence
    setGermanAITransportForTests(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 25));
      return { text: JSON.stringify({ headlineTr: "Birleşik Yanıt", score: 1 }), tokens: 42 };
    });

    const [a, b] = await Promise.all([
      runGermanAI<{ headlineTr: string }>("test", { id: 1 }, {
        queue: "explain",
        cacheKey: "coalesce-key-1",
        contentVersion: "v1",
        promptVersion: "v1",
        db,
        validate: (r: any) => (r?.headlineTr ? r : null),
      }),
      runGermanAI<{ headlineTr: string }>("test", { id: 1 }, {
        queue: "explain",
        cacheKey: "coalesce-key-1",
        contentVersion: "v1",
        promptVersion: "v1",
        db,
        validate: (r: any) => (r?.headlineTr ? r : null),
      }),
    ]);

    assert.equal(calls, 1, "Identical concurrent requests must coalesce to 1 provider call");
    assert.equal(a.value.headlineTr, "Birleşik Yanıt");
    assert.equal(b.value.headlineTr, "Birleşik Yanıt");

    // 2. Subsequent call hits SQLite cache
    const cachedHit = await runGermanAI<{ headlineTr: string }>("test", { id: 1 }, {
      queue: "explain",
      cacheKey: "coalesce-key-1",
      contentVersion: "v1",
      promptVersion: "v1",
      db,
      validate: (r: any) => (r?.headlineTr ? r : null),
    });
    assert.equal(cachedHit.cached, true);
    assert.equal(calls, 1);

    // 3. Changing promptVersion invalidates cache & calls transport again
    const busted = await runGermanAI<{ headlineTr: string }>("test", { id: 1 }, {
      queue: "explain",
      cacheKey: "coalesce-key-1",
      contentVersion: "v1",
      promptVersion: "v2",
      db,
      validate: (r: any) => (r?.headlineTr ? r : null),
    });
    assert.equal(busted.cached, false);
    assert.equal(calls, 2);

    // 4. Retry on transient timeout then succeed
    let transientCalls = 0;
    setGermanAITransportForTests(async () => {
      transientCalls++;
      if (transientCalls === 1) throw new Error("fetch failed timeout");
      return { text: JSON.stringify({ ok: true }) };
    });
    const retried = await runGermanAI("retry-test", { id: 2 }, { retries: 1 });
    assert.equal(transientCalls, 2);
    assert.deepEqual(retried.value, { ok: true });

    // 5. Rejects malformed / non-matching JSON schema
    setGermanAITransportForTests(async () => ({ text: "{not valid json" }));
    await assert.rejects(() =>
      runGermanAI("bad-json", { id: 3 }, { retries: 0 }),
    );

    const status = await getGermanAIStatus();
    assert.ok(typeof status.groqModel === "string");
    assert.ok(status.queues.explain && status.queues.schreiben);
  } finally {
    setGermanAITransportForTests(null);
    resetGermanAIStateForTests();
    await close();
  }
});

test("Explain My Mistake: structured Turkish explanation, wrong-key ambiguity detection & offline fallback", async () => {
  const { db, close } = await setupAppDb();
  resetGermanAIStateForTests();

  const apfel = makeWord({
    id: BUILTIN_CURRICULUM[0].id,
    de: "der Apfel",
    tr: "elma",
    article: "der",
    level: "A1",
    exampleDe: "Ich esse jeden Tag einen Apfel.",
    exampleTr: "Her gün bir elma yiyorum.",
  });

  const validTask: Task = {
    id: "t-exp-1",
    module: "vocabulary",
    type: "article",
    part: 1,
    level: "A1",
    direction: "de_only",
    prompt: '"Apfel" kelimesinin artikeli hangisidir?',
    passage: "",
    options: ["der", "die", "das"],
    answer: "der",
    alternatives: [],
    explanation: '"Apfel" kelimesinin artikeli der.',
    vocabularyIds: [apfel.id],
    evidence: "",
    fingerprint: "fp-apfel-art",
  };

  try {
    setGermanAITransportForTests(async (req) => {
      const userJson = JSON.parse(req.messages[1].content);
      return {
        text: JSON.stringify({
          headlineTr: "Artikeli 'der' olarak öğrenmelisin",
          whyWrongOrRightTr: `Sen '${userJson.studentAnswer}' seçtin, ancak 'Apfel' eril (maskulin) bir isimdir.`,
          correctMeaningTr: "der Apfel — elma",
          ruleTr: "Meyve isimlerinin çoğu 'die' olsa da 'der Apfel' istisnadır ve 'der' alır.",
          example: { de: "Der Apfel ist rot.", tr: "Elma kırmızıdır." },
          memoryTipTr: "'der rote Apfel' tamlamasını aklında tut.",
          detailedNoteTr: "Çoğulu 'die Äpfel' olur.",
          possibleQuestionIssue: false,
        }),
      };
    });

    const exp = await explainAttemptWithAI(db, {
      userId: 1,
      task: validTask,
      studentAnswer: "die",
      isCorrect: false,
      detailed: true,
      wordMeta: apfel,
    });
    assert.equal(exp.fallbackUsed, false);
    assert.equal(exp.possibleQuestionIssue, false);
    assert.ok(exp.headlineTr.includes("der"));
    assert.ok(exp.detailedNoteTr?.includes("Äpfel"));

    // Ambiguous / broken question detection (even if transport fails -> deterministic fallback flags it!)
    setGermanAITransportForTests(async () => {
      throw new Error("Groq offline");
    });
    const brokenTask: Task = {
      ...validTask,
      id: "t-exp-broken",
      options: ["der", "der", "das"], // Duplicate valid options!
    };
    const brokenExp = await explainAttemptWithAI(db, {
      userId: 1,
      task: brokenTask,
      studentAnswer: "der",
      isCorrect: false,
      wordMeta: apfel,
    });
    assert.equal(brokenExp.fallbackUsed, true);
    assert.equal(brokenExp.possibleQuestionIssue, true);
    assert.ok(brokenExp.headlineTr.includes("tutarsızlık"));
  } finally {
    setGermanAITransportForTests(null);
    resetGermanAIStateForTests();
    await close();
  }
});

test("Report workflow, duplicate dedup, controlled auditable regrading & disable filtering", async () => {
  const { db, ask, close } = await setupAppDb();
  resetGermanAIStateForTests();
  setGermanAITransportForTests(async () => ({
    text: JSON.stringify({
      verdict: "needs_review",
      summaryTr: "Seçenekte düzeltme gerekli.",
      detectedProblems: ["Cevap güncellenebilir."],
      suggestedFix: null,
    }),
  }));

  try {
    // Student starts an A1 choice session and answers wrong on task 0
    const created = await ask("/sessions", 2, {
      module: "vocabulary",
      mode: "practice",
      activity: "choice",
      direction: "tr_de",
      levels: ["A1"],
    }).then((r) => r.json());

    const storedRow = (
      await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [created.id] })
    ).rows[0];
    const tasks = JSON.parse(String(storedRow.tasks)) as Task[];
    const t0 = tasks[0];
    const wrongOption = t0.options.find((o) => o !== t0.answer)!;

    await ask(`/sessions/${created.id}/check`, 2, {
      taskId: t0.id,
      answer: wrongOption,
    });

    // Confirm wrong attempt lowered mastery & recorded attempt row
    const wordId = t0.vocabularyIds[0];
    const beforeMastery = (
      await db.execute({
        sql: "SELECT consecutive_correct, total_incorrect FROM german_mastery WHERE user_id=2 AND word_id=?",
        args: [wordId],
      })
    ).rows[0];
    assert.equal(Number(beforeMastery.consecutive_correct), 0);
    assert.equal(Number(beforeMastery.total_incorrect), 1);

    // Report twice with same reason -> deduplicated
    const rep1 = await ask("/questions/report", 2, {
      sessionId: created.id,
      taskId: t0.id,
      reason: "correct_answer_wrong",
      comment: "Benim seçtiğim cevap da doğru.",
      studentAnswer: wrongOption,
    }).then((r) => r.json());
    assert.equal(rep1.messageTr, "Rapor alındı. Soru incelemeye gönderildi.");
    assert.equal(rep1.deduplicated, false);

    const rep2 = await ask("/questions/report", 2, {
      sessionId: created.id,
      taskId: t0.id,
      reason: "correct_answer_wrong",
      comment: "Ek detay",
      studentAnswer: wrongOption,
    }).then((r) => r.json());
    assert.equal(rep2.id, rep1.id);
    assert.equal(rep2.deduplicated, true);

    // Admin approves correction to student's option AND enables controlled regrading
    const resolved = await ask(`/admin/reports/${rep1.id}/resolve`, 1, {
      action: "approve_correction",
      correctedAnswer: wrongOption,
      adminNote: "Kabul edilebilir karşılık onaylandı.",
      regradeWrongAttempts: true,
    }).then((r) => r.json());
    assert.equal(resolved.ok, true);
    assert.equal(resolved.regradedCount, 1);

    // Verify audit trail & recomputed mastery!
    const regradeLogs = await db.execute("SELECT * FROM german_regrade_log WHERE task_id=?", [t0.id]);
    assert.equal(regradeLogs.rows.length, 1);
    assert.equal(Number(regradeLogs.rows[0].old_is_correct), 0);
    assert.equal(Number(regradeLogs.rows[0].new_is_correct), 1);

    const afterMastery = (
      await db.execute({
        sql: "SELECT consecutive_correct, total_correct, total_incorrect FROM german_mastery WHERE user_id=2 AND word_id=?",
        args: [wordId],
      })
    ).rows[0];
    assert.equal(Number(afterMastery.consecutive_correct), 1);
    assert.equal(Number(afterMastery.total_correct), 1);
    assert.equal(Number(afterMastery.total_incorrect), 0);

    // Complete session & verify disabling task excludes its fingerprint from new sessions
    await ask(`/sessions/${created.id}/submit`, 2, {});
    const t1 = tasks[1];
    await resolveReportOrAudit(db, 1, {
      taskFingerprint: t1.fingerprint,
      action: "disable",
      adminNote: "Test devre dışı",
    });

    const nextSess = await ask("/sessions", 2, {
      module: "vocabulary",
      mode: "practice",
      activity: "choice",
      direction: "tr_de",
      levels: ["A1"],
    }).then((r) => r.json());
    const nextTasks = JSON.parse(
      String((await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [nextSess.id] })).rows[0].tasks),
    ) as Task[];
    assert.equal(
      nextTasks.some((nt) => nt.fingerprint === t1.fingerprint),
      false,
      "Disabled fingerprint must never appear in newly created sessions",
    );
  } finally {
    setGermanAITransportForTests(null);
    resetGermanAIStateForTests();
    await close();
  }
});

test("AI Session Performance Review: limitedEvidence guard, metric fidelity & persistence", async () => {
  const { db, ask, close } = await setupAppDb();
  resetGermanAIStateForTests();

  try {
    // 1. Short session (1 evaluated task) -> limitedEvidence: true
    const shortStart = await ask("/sessions", 1, {
      module: "vocabulary",
      mode: "practice",
      activity: "choice",
      direction: "tr_de",
      levels: ["A1"],
    }).then((r) => r.json());
    const shortTasks = JSON.parse(
      String((await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [shortStart.id] })).rows[0].tasks),
    ) as Task[];
    await ask(`/sessions/${shortStart.id}/check`, 1, {
      taskId: shortTasks[0].id,
      answer: shortTasks[0].answer,
    });
    await ask(`/sessions/${shortStart.id}/submit`, 1, {});

    setGermanAITransportForTests(async () => ({
      text: JSON.stringify({
        overallSummaryTr: "Tek soruluk kısa oturum başarıyla tamamlandı.",
        strongestAreas: ["A1 temel kelimeler"],
        areasNeedingPractice: ["Sınırlı veri olduğu için birkaç soru daha önerilir."],
        topActions: ["10 soruluk tam set çöz"],
        recommendedFollowUp: {
          titleTr: "Tam A1 Tekrarı",
          reasonTr: "Veriyi genişletmek için.",
          suggestedActivity: "mixed",
          levels: ["A1"],
        },
      }),
    }));

    const shortReview = await generateSessionPerformanceReview(db, {
      userId: 1,
      sessionId: shortStart.id,
    });
    assert.equal(shortReview.limitedEvidence, true);
    assert.equal(shortReview.metrics.evaluatedCount, 1);
    assert.equal(shortReview.metrics.accuracy, 100);

    // Subsequent call loads from german_session_reviews cache
    const cachedShort = await generateSessionPerformanceReview(db, {
      userId: 1,
      sessionId: shortStart.id,
    });
    assert.equal(cachedShort.cached, true);
  } finally {
    setGermanAITransportForTests(null);
    resetGermanAIStateForTests();
    await close();
  }
});

test("Personalized Reinforcement: rejects off-level / bare A-B candidates & merges with deterministic pool", async () => {
  const { db, close } = await setupAppDb();
  resetGermanAIStateForTests();

  const a1Word = BUILTIN_CURRICULUM.find((w) => w.level === "A1")!;
  const b2Word = BUILTIN_CURRICULUM.find((w) => w.level === "B2")!;

  try {
    setGermanAITransportForTests(async (req) => {
      const input = JSON.parse(req.messages[1].content);
      const validId = input.targetWords[0].id;
      const validDe = input.targetWords[0].de;
      const validTr = input.targetWords[0].tr;
      return {
        text: JSON.stringify({
          tasks: [
            // Invalid 1: Bare label answer "A" -> must be REJECTED
            {
              type: "choice",
              direction: "de_tr",
              prompt: `"${validDe}" anlamı nedir?`,
              options: ["A", "B", "C", "D"],
              answer: "A",
              explanation: "Bozuk",
              vocabularyIds: [validId],
            },
            // Invalid 2: Foreign CEFR B2 word ID not in targetWords -> must be REJECTED
            {
              type: "choice",
              direction: "de_tr",
              prompt: `"${b2Word.de}" anlamı nedir?`,
              options: [b2Word.tr, "yanlış 1", "yanlış 2"],
              answer: b2Word.tr,
              explanation: "Yanlış seviye",
              vocabularyIds: [b2Word.id],
            },
            // Valid A1 item -> must be ACCEPTED
            {
              type: "choice",
              direction: "de_tr",
              prompt: `"${validDe}" kelimesinin Türkçe anlamını seç:`,
              options: [validTr, "sandalye", "pencere", "kütüphane"],
              answer: validTr,
              explanation: `${validDe} = ${validTr}`,
              vocabularyIds: [validId],
            },
          ],
        }),
      };
    });

    const created = await generatePersonalizedReinforcement(db, {
      userId: 1,
      levels: ["A1"],
      direction: "de_tr",
      limit: 8,
    });
    assert.equal(created.aiGeneratedCount, 1, "Only the 1 valid A1 task may pass 8-step validation");
    assert.ok(created.taskCount >= 6);

    const row = (
      await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [created.sessionId] })
    ).rows[0];
    const tasks = JSON.parse(String(row.tasks)) as Task[];
    assert.ok(tasks.every((t) => t.level === "A1"));
    assert.ok(tasks.every((t) => t.answer !== "A"));

    // Offline fallback still creates deterministic personalized reinforcement smoothly
    setGermanAITransportForTests(async () => {
      throw new Error("Offline");
    });
    const offlineCreated = await generatePersonalizedReinforcement(db, {
      userId: 1,
      levels: ["A1"],
      direction: "tr_de",
    });
    assert.equal(offlineCreated.fallbackUsed, true);
    assert.equal(offlineCreated.aiGeneratedCount, 0);
    assert.ok(offlineCreated.taskCount >= 6);
  } finally {
    setGermanAITransportForTests(null);
    resetGermanAIStateForTests();
    await close();
  }
});

test("AI Question Auditor: deterministic reject always overrides AI approved verdict", async () => {
  const { db, close } = await setupAppDb();
  resetGermanAIStateForTests();

  const a1Word = makeWord({ id: "w-aud-1", de: "der Tisch", tr: "masa", level: "A1" });
  const badTask: Task = {
    id: "t-aud-bad",
    module: "vocabulary",
    type: "choice",
    part: 1,
    level: "B1", // Mismatch! Word is A1!
    direction: "tr_de",
    prompt: '"masa" ne demek?',
    passage: "",
    options: ["A", "B", "C", "D"],
    answer: "A", // Bare option label!
    alternatives: [],
    explanation: "",
    vocabularyIds: [a1Word.id],
    evidence: "",
    fingerprint: "fp-aud-bad",
  };

  try {
    setGermanAITransportForTests(async () => ({
      text: JSON.stringify({
        verdict: "approved", // Over-optimistic AI must be overridden!
        summaryTr: "Sorun görünmüyor.",
        detectedProblems: [],
        suggestedFix: null,
      }),
    }));

    const det = auditTaskDeterministically(badTask, [a1Word]);
    assert.ok(det.some((d) => d.code === "cefr_level_mismatch"));
    assert.ok(det.some((d) => d.code === "bare_option_label"));

    const verdict = await auditTaskWithAI(db, badTask, [a1Word], { useAI: true, forceRefresh: true });
    assert.equal(verdict.auditStatus, "rejected", "Deterministic rejection must override AI approved");
  } finally {
    setGermanAITransportForTests(null);
    resetGermanAIStateForTests();
    await close();
  }
});

test("Goethe Schreiben AI evaluation, token-level diff & Vocabulary Card enrichment", async () => {
  const { db, close } = await setupAppDb();
  resetGermanAIStateForTests();

  try {
    const diff = computeWordDiff("Ich gehen heute nach Berlin.", "Ich gehe heute nach Berlin.");
    assert.equal(diff.some((d) => d.type === "removed" && d.text === "gehen"), true);
    assert.equal(diff.some((d) => d.type === "added" && d.text === "gehe"), true);

    const originalStudentText =
      "Liebe Anna, danke für deine E-Mail. Ich kommen am Samstag mit dem Zug nach Hamburg.";

    setGermanAITransportForTests(async () => ({
      text: JSON.stringify({
        score: 0.84,
        confidence: 0.91,
        overallEvaluationTr: "Samimi ton ve iletişim görevi başarılı; yalnızca fiil çekiminde küçük bir düzeltme var.",
        feedback: "Görev maddeleri karşılanmış.",
        strengths: ["Doğal selamlama"],
        grammarMistakes: [
          {
            original: "Ich kommen",
            correction: "Ich komme",
            explanationTr: "'ich' öznesinde fiil '-e' eki alır.",
            category: "Fiil Çekimi",
          },
        ],
        vocabularyImprovements: [],
        missedRequirements: [],
        correctedVersion:
          "Liebe Anna, danke für deine E-Mail. Ich komme am Samstag mit dem Zug nach Hamburg.",
        tips: ["'ich' çekimlerini kontrol et."],
        errorTypes: ["konjugation"],
        criteria: {
          aufgabenerfuellung: { band: "gut", noteTr: "Tüm noktalar açık." },
          kohaerenz: { band: "gut", noteTr: "Bağlantı akıcı." },
          wortschatz: { band: "solide", noteTr: "B1 seviyesine uygun." },
          strukturen: { band: "solide", noteTr: "Küçük çekim hatası dışında sağlam." },
        },
      }),
    }));

    const evaluation = await evaluateGoetheSchreibenWithAI(db, {
      task: {
        id: "schreiben-b1-1",
        level: "B1",
        part: 1,
        type: "schreiben",
        prompt: "Freundin Anna'ya gezi planını yaz.",
        passage: "",
      },
      studentText: originalStudentText,
      userId: 1,
    });

    assert.equal(evaluation.unofficialPracticeEstimate, true);
    assert.equal(evaluation.originalSubmission, originalStudentText, "Original submission must never be mutated");
    assert.ok(evaluation.diffSegments.some((d) => d.type === "removed" && d.text === "kommen"));
    assert.ok(evaluation.diffSegments.some((d) => d.type === "added" && d.text === "komme"));
    assert.equal(evaluation.criteria.aufgabenerfuellung.band, "gut");

    // Vocabulary Card enrichment preserves headword & meaning
    const apfel = makeWord({
      id: BUILTIN_CURRICULUM[0].id,
      de: "der Apfel",
      tr: "elma",
      article: "der",
      plural: "die Äpfel",
      level: "A1",
      exampleDe: "Der Apfel ist süß.",
      exampleTr: "Elma tatlıdır.",
    });
    setGermanAITransportForTests(async () => ({
      text: JSON.stringify({
        extraExample: { de: "Möchtest du einen grünen Apfel?", tr: "Yeşil bir elma ister misin?" },
        grammarNoteTr: "Akusativ tekilde 'einen Apfel' olur.",
        usageTipTr: "Çoğulda umlaut alır: die Äpfel.",
      }),
    }));
    const card = await getOrEnrichVocabularyCard(db, {
      userId: 1,
      word: apfel as any,
      requestAnotherExample: true,
    });
    assert.equal(card.de, "der Apfel");
    assert.equal(card.tr, "elma");
    assert.equal(card.enrichedByAI, true);
    assert.ok(card.extraExample?.de.includes("Apfel"));
  } finally {
    setGermanAITransportForTests(null);
    resetGermanAIStateForTests();
    await close();
  }
});
