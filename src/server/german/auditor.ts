import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";
import { isCefrLevel, MASTERY_TARGET, masteryStatusFromStreak } from "../../shared/germanActivities";
import { buildActivities } from "./activities";
import { evaluateMatchingPairs, gradeAnswer, normalizeText } from "./cefr";
import { applyMasteryAttempt, fingerprint, masteryToMemory, newMastery, validateTask, type MasteryRecord, type Task, type Vocabulary } from "./learning";
import { buildAICacheKey, runGermanAI } from "./provider";
import { loadDeduplicatedWordsWithMastery } from "./store";

export const REPORT_REASONS = [
  { id: "correct_answer_wrong", labelTr: "Doğru cevap olarak işaretlenen seçenek yanlış" },
  { id: "multiple_answers_possible", labelTr: "Birden fazla seçenek doğru olabilir" },
  { id: "question_grammar_wrong", labelTr: "Soru cümlesi veya dilbilgisi hatalı" },
  { id: "turkish_translation_wrong", labelTr: "Türkçe çeviri hatalı veya eksik" },
  { id: "out_of_cefr_level", labelTr: "Soru seçili CEFR seviyesinin üzerinde" },
  { id: "unclear_or_nonsensical", labelTr: "Soru anlaşılmaz veya anlamsız" },
  { id: "other", labelTr: "Diğer" },
] as const;

export type ReportReasonId = (typeof REPORT_REASONS)[number]["id"];

export interface DeterministicAuditIssue {
  code: string;
  severity: "reject" | "review";
  messageTr: string;
}

export interface AuditVerdict {
  taskFingerprint: string;
  taskId: string;
  module: string;
  level: string;
  auditStatus: "approved" | "needs_review" | "rejected";
  deterministicIssues: DeterministicAuditIssue[];
  aiReview: {
    verdict: "approved" | "needs_review" | "rejected";
    summaryTr: string;
    detectedProblems: string[];
    suggestedFix?: {
      prompt?: string;
      answer?: string;
      options?: string[];
      explanation?: string;
    } | null;
  } | null;
  provider: string;
  model: string;
}

const BARE_OPTION_LABEL_RE = /^(?:\(?[A-E]\)[.:]?|[A-E][.)]?|[1-5][.)]?)$/iu;
const CORRUPT_PLACEHOLDER_RE = /\b(?:undefined|null|NaN|TODO|FIXME)\b|\[object Object\]/iu;

export function auditTaskDeterministically(
  task: Task,
  words: Vocabulary[],
): DeterministicAuditIssue[] {
  const issues: DeterministicAuditIssue[] = [];
  const push = (
    code: string,
    severity: "reject" | "review",
    messageTr: string,
  ) => issues.push({ code, severity, messageTr });

  if (!task || typeof task !== "object") {
    push("invalid_task", "reject", "Görev nesnesi geçersiz.");
    return issues;
  }

  if (!task.prompt?.trim()) {
    push("empty_prompt", "reject", "Soru metni boş.");
  }
  if (!task.explanation?.trim()) {
    push("empty_explanation", "review", "Açıklama alanı boş.");
  }
  if (
    CORRUPT_PLACEHOLDER_RE.test(task.prompt ?? "") ||
    CORRUPT_PLACEHOLDER_RE.test(task.answer ?? "") ||
    CORRUPT_PLACEHOLDER_RE.test(task.passage ?? "")
  ) {
    push("corrupt_placeholder", "reject", "Soru veya yanıtta bozuk yer tutucu metin var.");
  }

  if (task.module === "vocabulary") {
    if (!task.answer?.trim()) {
      push("missing_answer", "reject", "Beklenen doğru cevap eksik.");
    }
    if (!isCefrLevel(task.level)) {
      push("invalid_cefr_level", "reject", `Geçersiz CEFR seviyesi: ${task.level}`);
    }
    const wordMap = new Map(words.map((w) => [w.id, w]));
    const matchedWords = (task.vocabularyIds ?? [])
      .map((id) => wordMap.get(id))
      .filter((w): w is Vocabulary => Boolean(w));

    if (!task.vocabularyIds?.length || matchedWords.length !== task.vocabularyIds.length) {
      push("missing_vocabulary_ref", "reject", "Sorunun bağlı olduğu kelime kaydı bulunamadı.");
    } else if (
      isCefrLevel(task.level) &&
      matchedWords.some((w) => w.level !== task.level)
    ) {
      push(
        "cefr_level_mismatch",
        "reject",
        "Sorudaki kelime seçili CEFR seviyesiyle uyuşmuyor.",
      );
    }
  }

  if (
    task.answer?.trim() &&
    BARE_OPTION_LABEL_RE.test(task.answer.trim()) &&
    task.type !== "missing"
  ) {
    push(
      "bare_option_label",
      "reject",
      "Cevap metni yerine 'A/B/1' gibi çıplak şık etiketi kullanılmış.",
    );
  }

  if (Array.isArray(task.options) && task.options.length > 0) {
    if (task.options.some((o) => BARE_OPTION_LABEL_RE.test(o.trim()))) {
      push("bare_option_in_choices", "reject", "Seçeneklerden biri yalnızca etiket harfi içeriyor.");
    }
    const normSet = new Set(task.options.map((o) => normalizeText(o)));
    if (normSet.size !== task.options.length) {
      push("duplicate_options", "reject", "Seçenekler arasında yinelenen şık var.");
    }
    if (task.type !== "multi" && !task.options.includes(task.answer)) {
      push("answer_not_in_options", "reject", "Doğru cevap seçenekler listesinde yer almıyor.");
    }
    if (task.type !== "multi" && task.options.length > 1) {
      const matchingOpts = task.options.filter((opt) =>
        gradeAnswer({
          type: task.type,
          answer: task.answer,
          alternatives: task.alternatives,
          hasOptions: true,
          direction: task.direction,
          userAnswer: opt,
        }),
      );
      if (matchingOpts.length > 1) {
        push(
          "multiple_valid_options",
          "reject",
          "Birden fazla seçenek doğru cevapla eşleşiyor.",
        );
      }
    }
  }

  if (
    task.type === "gap" ||
    task.type === "sentence_completion" ||
    task.type === "conjugation"
  ) {
    if (!/(?:_____|＿|___)/u.test(task.prompt)) {
      push("missing_gap_marker", "review", "Boşluk doldurma sorusunda boşluk işareti görünmüyor.");
    }
  }

  if (task.type === "matching") {
    const left = task.interaction?.left ?? [];
    const right = task.interaction?.right ?? [];
    const parsedPairs = evaluateMatchingPairs(task.answer, task.answer);
    if (!left.length || left.length !== right.length || !parsedPairs) {
      push("broken_matching", "reject", "Eşleştirme çiftleri tutarsız.");
    }
  }

  if (task.type === "ordering" || task.type === "sentence_ordering") {
    const tiles = task.interaction?.tiles ?? [];
    const exp = task.answer.trim().split(/\s+/u).filter(Boolean).map(normalizeText).sort();
    const got = tiles.map((t) => normalizeText(String(t))).sort();
    if (exp.length < 2 || exp.length !== got.length || exp.some((v, i) => v !== got[i])) {
      push("broken_ordering_tiles", "reject", "Sıralama taşları doğru cümleyle uyuşmuyor.");
    }
  }

  if (task.type === "listening" && !task.interaction?.audioText?.trim()) {
    push("missing_audio_text", "reject", "Dinleme sorusunda seslendirilecek metin eksik.");
  }

  if (task.module === "Lesen") {
    if (!task.passage?.trim() || !task.evidence?.trim() || !task.passage.includes(task.evidence)) {
      push("lesen_evidence_missing", "reject", "Okuma görevinde kanıt cümlesi metin içinde geçmiyor.");
    }
  }

  if (task.module === "vocabulary" && validateTask(task, words) === null) {
    if (!issues.some((i) => i.severity === "reject")) {
      push("schema_validation_failed", "reject", "Soru temel doğrulama kurallarını geçemedi.");
    }
  }

  return issues;
}

export async function auditTaskWithAI(
  db: Client,
  task: Task,
  words: Vocabulary[],
  options: { useAI?: boolean; forceRefresh?: boolean; userId?: number } = {},
): Promise<AuditVerdict> {
  const deterministicIssues = auditTaskDeterministically(task, words);
  const hasReject = deterministicIssues.some((i) => i.severity === "reject");
  const hasReview = deterministicIssues.some((i) => i.severity === "review");
  const fp = task.fingerprint || fingerprint(normalizeText(task.prompt + "|" + task.answer));

  let aiReview: AuditVerdict["aiReview"] = null;
  let provider = "deterministic";
  let model = "rules-v1";

  if (options.useAI !== false) {
    try {
      const linkedVocab = words.filter((w) => task.vocabularyIds?.includes(w.id));
      const res = await runGermanAI<NonNullable<AuditVerdict["aiReview"]>>(
        'Independently audit this German exercise for accuracy, single unambiguous correct answer, Turkish translation precision, grammatical correctness, distractor plausibility, and strict CEFR level suitability. Return ONLY JSON: {"verdict":"approved"|"needs_review"|"rejected","summaryTr":string,"detectedProblems":string[],"suggestedFix":null|{"prompt":string,"answer":string,"options":string[],"explanation":string}}. Do not invent probabilities. Mark "rejected" if answer key is wrong or multiple options are right.',
        {
          task: {
            module: task.module,
            type: task.type,
            level: task.level,
            direction: task.direction,
            prompt: task.prompt,
            passage: task.passage,
            options: task.options,
            answer: task.answer,
            alternatives: task.alternatives,
            explanation: task.explanation,
          },
          linkedVocabulary: linkedVocab.map((v) => ({
            id: v.id,
            de: v.de,
            tr: v.tr,
            level: v.level,
            pos: v.pos,
            exampleDe: v.exampleDe,
            exampleTr: v.exampleTr,
          })),
        },
        {
          queue: "audit",
          feature: "question_audit",
          sourceId: fp,
          cacheKey: buildAICacheKey({ op: "audit", fp, prompt: task.prompt, answer: task.answer, options: task.options }),
          contentVersion: "v1",
          promptVersion: "v1",
          bypassCache: options.forceRefresh,
          userId: options.userId,
          db,
          validate: (raw: any) => {
            if (!raw || typeof raw !== "object") return null;
            if (!["approved", "needs_review", "rejected"].includes(raw.verdict)) return null;
            if (typeof raw.summaryTr !== "string" || !raw.summaryTr.trim()) return null;
            return {
              verdict: raw.verdict,
              summaryTr: raw.summaryTr.slice(0, 800),
              detectedProblems: Array.isArray(raw.detectedProblems)
                ? raw.detectedProblems.map(String).slice(0, 8)
                : [],
              suggestedFix:
                raw.suggestedFix && typeof raw.suggestedFix === "object"
                  ? raw.suggestedFix
                  : null,
            };
          },
        },
      );
      aiReview = res.value;
      provider = res.provider;
      model = res.model;
    } catch {
      aiReview = null;
    }
  }

  // Deterministic reject/review ALWAYS takes precedence over AI optimism
  let auditStatus: AuditVerdict["auditStatus"] = "approved";
  if (hasReject || aiReview?.verdict === "rejected") {
    auditStatus = "rejected";
  } else if (hasReview || aiReview?.verdict === "needs_review") {
    auditStatus = "needs_review";
  }

  await db.execute({
    sql: `INSERT INTO german_question_audits(
            task_fingerprint, task_id, module, level, audit_status,
            deterministic_issues_json, ai_review_json, suggested_correction_json,
            task_snapshot, content_version, provider, model, audited_at
          ) VALUES(?,?,?,?,?,?,?,?,?,'v1',?,?,?)
          ON CONFLICT(task_fingerprint) DO UPDATE SET
            audit_status=excluded.audit_status,
            deterministic_issues_json=excluded.deterministic_issues_json,
            ai_review_json=excluded.ai_review_json,
            suggested_correction_json=excluded.suggested_correction_json,
            task_snapshot=excluded.task_snapshot,
            provider=excluded.provider,
            model=excluded.model,
            audited_at=excluded.audited_at`,
    args: [
      fp,
      task.id,
      task.module,
      task.level,
      auditStatus,
      JSON.stringify(deterministicIssues),
      aiReview ? JSON.stringify(aiReview) : null,
      aiReview?.suggestedFix ? JSON.stringify(aiReview.suggestedFix) : null,
      JSON.stringify(task),
      provider,
      model,
      new Date().toISOString(),
    ],
  });

  return {
    taskFingerprint: fp,
    taskId: task.id,
    module: task.module,
    level: task.level,
    auditStatus,
    deterministicIssues,
    aiReview,
    provider,
    model,
  };
}

export async function runAdminQualityScanBatch(
  db: Client,
  options: { limit?: number; useAI?: boolean; includeGeneratedSample?: boolean; userId?: number } = {},
) {
  const limit = Math.min(30, Math.max(1, options.limit ?? 15));
  const { uniqueWords } = await loadDeduplicatedWordsWithMastery(db, 1, false);
  const storedRows = await db.execute({
    sql: `SELECT t.data, t.fingerprint
          FROM german_tasks t
          LEFT JOIN german_question_audits a ON a.task_fingerprint = t.fingerprint
          WHERE a.task_fingerprint IS NULL
          ORDER BY t.created_at DESC LIMIT ?`,
    args: [limit],
  });

  const candidates: Task[] = storedRows.rows.map((r) => JSON.parse(String(r.data)) as Task);

  if (options.includeGeneratedSample && candidates.length < limit) {
    const sample = buildActivities(uniqueWords, "mixed", "mixed", {
      limit: limit - candidates.length,
    });
    candidates.push(...sample);
  }

  const verdicts: AuditVerdict[] = [];
  for (const task of candidates.slice(0, limit)) {
    const v = await auditTaskWithAI(db, task, uniqueWords, {
      useAI: options.useAI,
      userId: options.userId,
    });
    verdicts.push(v);
  }

  const counts = await db.execute(
    "SELECT audit_status, COUNT(*) AS c FROM german_question_audits GROUP BY audit_status",
  );
  const summary: Record<string, number> = { approved: 0, needs_review: 0, rejected: 0 };
  for (const r of counts.rows) {
    summary[String(r.audit_status)] = Number(r.c ?? 0);
  }

  return {
    scannedCount: verdicts.length,
    verdicts,
    summary,
  };
}

export async function submitQuestionReport(
  db: Client,
  input: {
    userId: number;
    sessionId: string;
    task: Task;
    reason: ReportReasonId;
    comment?: string;
    studentAnswer?: string;
  },
) {
  const taskFp =
    input.task.fingerprint ||
    fingerprint(normalizeText(input.task.prompt + "|" + input.task.answer));
  const dedupeKey = `${taskFp}::${input.reason}`;
  const nowIso = new Date().toISOString();
  const cleanComment = (input.comment ?? "").trim().slice(0, 600);

  // Deduplicate open reports sharing the exact question fingerprint + reason
  const existing = await db.execute({
    sql: "SELECT id, comment, status FROM german_question_reports WHERE dedupe_key=? AND status IN ('pending_review','ai_flagged_issue') ORDER BY created_at DESC LIMIT 1",
    args: [dedupeKey],
  });

  let reportId: string;
  let deduplicated = false;
  if (existing.rows[0]) {
    deduplicated = true;
    reportId = String(existing.rows[0].id);
    if (cleanComment && !String(existing.rows[0].comment ?? "").includes(cleanComment)) {
      const merged = [String(existing.rows[0].comment ?? "").trim(), cleanComment]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 1000);
      await db.execute({
        sql: "UPDATE german_question_reports SET comment=? WHERE id=?",
        args: [merged, reportId],
      });
    }
  } else {
    reportId = randomUUID();
    await db.execute({
      sql: `INSERT INTO german_question_reports(
              id, dedupe_key, task_fingerprint, task_id, word_id, exercise_type,
              level, session_id, user_id, reason, comment, task_snapshot,
              current_answer, student_answer, content_version, status, created_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'v1', 'pending_review', ?)`,
      args: [
        reportId,
        dedupeKey,
        taskFp,
        input.task.id,
        input.task.vocabularyIds?.[0] ?? "",
        input.task.type,
        input.task.level,
        input.sessionId,
        input.userId,
        input.reason,
        cleanComment,
        JSON.stringify(input.task),
        input.task.answer ?? "",
        (input.studentAnswer ?? "").slice(0, 1000),
        nowIso,
      ],
    });
  }

  // Trigger independent AI review in background (never blocks user response!)
  void (async () => {
    try {
      const { uniqueWords } = await loadDeduplicatedWordsWithMastery(db, 1, false);
      const audit = await auditTaskWithAI(db, input.task, uniqueWords, {
        useAI: true,
        userId: input.userId,
      });
      const nextStatus =
        audit.auditStatus === "rejected" || audit.auditStatus === "needs_review"
          ? "ai_flagged_issue"
          : "pending_review";
      await db.execute({
        sql: "UPDATE german_question_reports SET ai_review_json=?, status=CASE WHEN status='pending_review' THEN ? ELSE status END WHERE id=?",
        args: [
          JSON.stringify({
            auditStatus: audit.auditStatus,
            deterministicIssues: audit.deterministicIssues,
            aiReview: audit.aiReview,
          }),
          nextStatus,
          reportId,
        ],
      });
    } catch {}
  })();

  return {
    id: reportId,
    deduplicated,
    messageTr: "Rapor alındı. Soru incelemeye gönderildi.",
  };
}

export async function getDisabledFingerprints(db: Client): Promise<Set<string>> {
  const rows = await db.execute("SELECT task_fingerprint FROM german_disabled_questions");
  return new Set(rows.rows.map((r) => String(r.task_fingerprint)));
}

export async function resolveReportOrAudit(
  db: Client,
  adminUserId: number,
  input: {
    reportId?: string;
    taskFingerprint?: string;
    action: "approve_correction" | "disable" | "reject";
    adminNote?: string;
    correctedAnswer?: string;
    correctedPrompt?: string;
    correctedOptions?: string[];
    correctedExplanation?: string;
    regradeWrongAttempts?: boolean;
  },
) {
  let taskFp = input.taskFingerprint ?? "";
  let taskSnapshot: Task | null = null;
  if (input.reportId) {
    const r = await db.execute({
      sql: "SELECT * FROM german_question_reports WHERE id=?",
      args: [input.reportId],
    });
    const row = r.rows[0];
    if (!row) throw new Error("Rapor kaydı bulunamadı.");
    taskFp = String(row.task_fingerprint);
    try {
      taskSnapshot = JSON.parse(String(row.task_snapshot)) as Task;
    } catch {}
  } else if (taskFp) {
    const a = await db.execute({
      sql: "SELECT task_snapshot FROM german_question_audits WHERE task_fingerprint=?",
      args: [taskFp],
    });
    if (a.rows[0]) {
      try {
        taskSnapshot = JSON.parse(String(a.rows[0].task_snapshot)) as Task;
      } catch {}
    }
  }

  if (!taskFp) throw new Error("Geçerli bir soru parmak izi bulunamadı.");

  const nowIso = new Date().toISOString();
  const note = (input.adminNote ?? "").trim().slice(0, 600);
  let regradedCount = 0;

  const tx = await db.transaction("write");
  try {
    if (input.action === "disable") {
      await tx.execute({
        sql: "INSERT INTO german_disabled_questions(task_fingerprint, reason, disabled_by, disabled_at) VALUES(?,?,?,?) ON CONFLICT(task_fingerprint) DO UPDATE SET reason=excluded.reason, disabled_by=excluded.disabled_by, disabled_at=excluded.disabled_at",
        args: [taskFp, note || "Yönetici tarafından devre dışı bırakıldı.", adminUserId, nowIso],
      });
      await tx.execute({
        sql: "UPDATE german_audits SET audit_status='rejected', reviewed_by=?, reviewed_at=? WHERE task_fingerprint=?",
        args: [adminUserId, nowIso, taskFp],
      }).catch(() => {});
      await tx.execute({
        sql: "UPDATE german_question_audits SET audit_status='rejected', reviewed_by=?, reviewed_at=? WHERE task_fingerprint=?",
        args: [adminUserId, nowIso, taskFp],
      });
      await tx.execute({
        sql: "DELETE FROM german_tasks WHERE fingerprint=?",
        args: [taskFp],
      });
    } else if (input.action === "approve_correction" && taskSnapshot) {
      const updatedTask: Task = {
        ...taskSnapshot,
        prompt: input.correctedPrompt?.trim() || taskSnapshot.prompt,
        answer: input.correctedAnswer?.trim() || taskSnapshot.answer,
        options:
          Array.isArray(input.correctedOptions) && input.correctedOptions.length > 0
            ? input.correctedOptions
            : taskSnapshot.options,
        explanation: input.correctedExplanation?.trim() || taskSnapshot.explanation,
      };
      await tx.execute({
        sql: "INSERT INTO german_question_corrections(task_fingerprint, corrected_task_json, approved_by, approved_at) VALUES(?,?,?,?) ON CONFLICT(task_fingerprint) DO UPDATE SET corrected_task_json=excluded.corrected_task_json, approved_by=excluded.approved_by, approved_at=excluded.approved_at",
        args: [taskFp, JSON.stringify(updatedTask), adminUserId, nowIso],
      });
      await tx.execute({
        sql: "UPDATE german_tasks SET data=? WHERE fingerprint=?",
        args: [JSON.stringify(updatedTask), taskFp],
      });
      await tx.execute({
        sql: "UPDATE german_question_audits SET audit_status='approved', task_snapshot=?, reviewed_by=?, reviewed_at=? WHERE task_fingerprint=?",
        args: [JSON.stringify(updatedTask), adminUserId, nowIso, taskFp],
      });

      // Controlled auditable regrading: preserves attempt history & re-evaluates recorded answers against corrected answer
      if (input.regradeWrongAttempts) {
        const repRows = await tx.execute({
          sql: "SELECT DISTINCT session_id, task_id FROM german_question_reports WHERE task_fingerprint=?",
          args: [taskFp],
        });
        const targetPairs = repRows.rows.map((rr) => ({
          sessionId: String(rr.session_id),
          taskId: String(rr.task_id),
        }));
        for (const pair of targetPairs) {
          const attRows = await tx.execute({
            sql: "SELECT attempt_key, user_id, word_id, user_answer, is_correct FROM german_attempts WHERE session_id=? AND task_id=?",
            args: [pair.sessionId, pair.taskId],
          });
          for (const ar of attRows.rows) {
            const oldCorrect = Number(ar.is_correct) === 1;
            const newCorrect = gradeAnswer({
              type: updatedTask.type,
              answer: updatedTask.answer,
              alternatives: updatedTask.alternatives,
              hasOptions: updatedTask.options.length > 0,
              hasInteraction: Boolean(updatedTask.interaction?.tiles || updatedTask.interaction?.left),
              direction: updatedTask.direction,
              userAnswer: String(ar.user_answer ?? ""),
            });
            if (oldCorrect !== newCorrect) {
              await tx.execute({
                sql: "INSERT INTO german_regrade_log(id, task_fingerprint, user_id, session_id, task_id, old_is_correct, new_is_correct, reason, approved_by, created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                args: [
                  randomUUID(),
                  taskFp,
                  Number(ar.user_id),
                  pair.sessionId,
                  pair.taskId,
                  oldCorrect ? 1 : 0,
                  newCorrect ? 1 : 0,
                  note || "Yönetici düzeltmesi sonrası yeniden puanlama",
                  adminUserId,
                  nowIso,
                ],
              });
              await tx.execute({
                sql: "UPDATE german_attempts SET is_correct=? WHERE attempt_key=?",
                args: [newCorrect ? 1 : 0, String(ar.attempt_key)],
              });

              // Recalculate authoritative mastery cleanly from attempts chronology
              const wordAtt = await tx.execute({
                sql: "SELECT is_correct, is_review, cefr_level, created_at FROM german_attempts WHERE user_id=? AND word_id=? ORDER BY created_at ASC",
                args: [Number(ar.user_id), String(ar.word_id)],
              });
              const lvl = String(wordAtt.rows[0]?.cefr_level ?? updatedTask.level ?? "A1") as any;
              let rec: MasteryRecord = newMastery(String(ar.word_id), lvl);
              for (const row of wordAtt.rows) {
                rec = applyMasteryAttempt(rec, Number(row.is_correct) === 1, {
                  isReview: Number(row.is_review) === 1,
                  now: new Date(String(row.created_at)),
                });
              }
              await tx.execute({
                sql: `INSERT INTO german_mastery(user_id, word_id, cefr_level, consecutive_correct, total_correct, total_incorrect, mastery_status, last_practiced_at, mastered_at)
                      VALUES(?,?,?,?,?,?,?,?,?)
                      ON CONFLICT(user_id, word_id) DO UPDATE SET
                        consecutive_correct=excluded.consecutive_correct,
                        total_correct=excluded.total_correct,
                        total_incorrect=excluded.total_incorrect,
                        mastery_status=excluded.mastery_status,
                        last_practiced_at=excluded.last_practiced_at,
                        mastered_at=excluded.mastered_at`,
                args: [
                  Number(ar.user_id),
                  String(ar.word_id),
                  rec.cefrLevel,
                  Math.min(MASTERY_TARGET, rec.consecutiveCorrect),
                  rec.totalCorrect,
                  rec.totalIncorrect,
                  masteryStatusFromStreak(rec.consecutiveCorrect, rec.masteryStatus === "mastered"),
                  rec.lastPracticedAt,
                  rec.masteredAt,
                ],
              });
              await tx.execute({
                sql: "INSERT INTO german_memory VALUES(?,?,?) ON CONFLICT(user_id,word_id) DO UPDATE SET data=excluded.data",
                args: [Number(ar.user_id), String(ar.word_id), JSON.stringify(masteryToMemory(rec))],
              });
              regradedCount++;
            }
          }
        }
      }
    }

    const repStatus =
      input.action === "approve_correction"
        ? "resolved_corrected"
        : input.action === "disable"
          ? "resolved_disabled"
          : "rejected";

    if (input.reportId) {
      await tx.execute({
        sql: "UPDATE german_question_reports SET status=?, admin_note=?, reviewed_at=?, reviewed_by=? WHERE id=?",
        args: [repStatus, note, nowIso, adminUserId, input.reportId],
      });
    } else {
      await tx.execute({
        sql: "UPDATE german_question_reports SET status=?, admin_note=?, reviewed_at=?, reviewed_by=? WHERE task_fingerprint=? AND status IN ('pending_review','ai_flagged_issue')",
        args: [repStatus, note, nowIso, adminUserId, taskFp],
      });
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  } finally {
    tx.close();
  }

  return { ok: true, status: input.action, regradedCount };
}
