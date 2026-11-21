import type { Client } from "@libsql/client";
import type { Task } from "./learning";
import { buildAICacheKey, runGermanAI } from "./provider";

export interface DiffSegment {
  type: "equal" | "removed" | "added";
  text: string;
}

export interface SchreibenCriterionEvaluation {
  band: "gut" | "solide" | "ausbaufähig";
  noteTr: string;
  evidence?: string;
}

export interface SchreibenEvaluationResult {
  score: number;
  confidence: number;
  unofficialPracticeEstimate: true;
  disclaimerTr: string;
  cefrLevel: string;
  taskPart: number;
  feedback: string;
  overallEvaluationTr: string;
  strengths: string[];
  grammarMistakes: Array<{
    original: string;
    correction: string;
    explanationTr: string;
    category: string;
  }>;
  vocabularyImprovements: Array<{
    original: string;
    better: string;
    reasonTr: string;
  }>;
  missedRequirements: string[];
  correctedVersion: string;
  suggestedAnswer: string;
  tips: string[];
  criteria: {
    aufgabenerfuellung: SchreibenCriterionEvaluation;
    kohaerenz: SchreibenCriterionEvaluation;
    wortschatz: SchreibenCriterionEvaluation;
    strukturen: SchreibenCriterionEvaluation;
  };
  diffSegments: DiffSegment[];
  errorTypes: string[];
  originalSubmission: string;
  provider?: string;
  model?: string;
  pending: false;
  unofficial: true;
}

/**
 * Deterministic token-level LCS diff between original student submission and AI-corrected text
 * so "Hatalarımı Göster" never mutates the user's original answer.
 */
export function computeWordDiff(original: string, corrected: string): DiffSegment[] {
  const a = original.trim().split(/(\s+)/u).filter(Boolean);
  const b = corrected.trim().split(/(\s+)/u).filter(Boolean);

  if (a.length === 0) {
    return b.length ? [{ type: "added", text: corrected.trim() }] : [];
  }
  if (b.length === 0) {
    return [{ type: "removed", text: original.trim() }];
  }

  // Cap matrix size defensively for extremely long essays
  if (a.length * b.length > 90000) {
    return [
      { type: "removed", text: original.trim() },
      { type: "added", text: corrected.trim() },
    ];
  }

  const m = a.length;
  const n = b.length;
  const dp: Uint16Array[] = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const raw: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ type: "equal", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      raw.push({ type: "removed", text: a[i] });
      i++;
    } else {
      raw.push({ type: "added", text: b[j] });
      j++;
    }
  }
  while (i < m) raw.push({ type: "removed", text: a[i++] });
  while (j < n) raw.push({ type: "added", text: b[j++] });

  const merged: DiffSegment[] = [];
  for (const seg of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === seg.type) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

function validateCriterion(raw: any): SchreibenCriterionEvaluation | null {
  if (!raw || typeof raw !== "object") return null;
  const band = ["gut", "solide", "ausbaufähig"].includes(raw.band)
    ? (raw.band as SchreibenCriterionEvaluation["band"])
    : "solide";
  const noteTr = typeof raw.noteTr === "string" ? raw.noteTr.trim() : "";
  if (!noteTr) return null;
  return {
    band,
    noteTr: noteTr.slice(0, 400),
    evidence: typeof raw.evidence === "string" ? raw.evidence.slice(0, 260) : undefined,
  };
}

export async function evaluateGoetheSchreibenWithAI(
  db: Client,
  input: {
    task: Pick<Task, "id" | "level" | "part" | "type" | "prompt" | "passage">;
    studentText: string;
    userId?: number;
    bypassCache?: boolean;
  },
): Promise<SchreibenEvaluationResult> {
  const cleanText = input.studentText.trim();
  if (!cleanText || cleanText.length < 3) {
    throw new Error("Değerlendirme için en az kısa bir Almanca metin yazmalısın.");
  }

  const level = input.task.level || "B1";
  const part = input.task.part || 1;
  const rubricHint =
    level === "A1"
      ? "Goethe A1 level: short simple message/form (~30 words). Be encouraging and keep grammar explanations very simple in Turkish."
      : level === "A2"
        ? "Goethe A2 level: short everyday SMS/email (~30-50 words). Check all bullet points, greetings/closings, and basic word order/Perfekt."
        : level === "B2" || level === "C1"
          ? `Goethe ${level} level: structured argumentation, register, cohesion, nuanced vocabulary, complex syntax.`
          : part === 1
            ? "Goethe B1 Teil 1: Personal email (~80 words), address all 3 points cleanly with appropriate du/ihr register."
            : part === 2
              ? "Goethe B1 Teil 2: Forum opinion (~80 words), clear stance, reasons, examples, cohesive connectors."
              : "Goethe B1 Teil 3: Formal email (~40 words), polite Sie register, clear apology/request/reason.";

  const aiRes = await runGermanAI<Omit<SchreibenEvaluationResult, "diffSegments" | "originalSubmission" | "suggestedAnswer" | "unofficialPracticeEstimate" | "disclaimerTr" | "cefrLevel" | "taskPart" | "provider" | "model" | "pending" | "unofficial">>(
    `Evaluate the student's German writing for Goethe ${level} (${rubricHint}). Do NOT invent official Goethe point scales or pretend this is an official certificate score. Label feedback in Turkish clearly and constructively. Preserve the student's intended meaning in correctedVersion. Return ONLY JSON: {"score":number 0..1,"confidence":number 0.8..1,"overallEvaluationTr":string,"feedback":string,"strengths":string[],"grammarMistakes":[{"original":string,"correction":string,"explanationTr":string,"category":string}],"vocabularyImprovements":[{"original":string,"better":string,"reasonTr":string}],"missedRequirements":string[],"correctedVersion":string,"tips":string[],"errorTypes":string[],"criteria":{"aufgabenerfuellung":{"band":"gut"|"solide"|"ausbaufähig","noteTr":string,"evidence":string},"kohaerenz":{"band":"gut"|"solide"|"ausbaufähig","noteTr":string,"evidence":string},"wortschatz":{"band":"gut"|"solide"|"ausbaufähig","noteTr":string,"evidence":string},"strukturen":{"band":"gut"|"solide"|"ausbaufähig","noteTr":string,"evidence":string}}}.`,
    {
      taskPrompt: input.task.prompt,
      taskContext: input.task.passage,
      cefrLevel: level,
      part,
      taskType: input.task.type,
      studentText: cleanText,
    },
    {
      queue: "schreiben",
      feature: "schreiben_review",
      sourceId: input.task.id,
      cacheKey: buildAICacheKey({
        op: "schreiben",
        prompt: input.task.prompt,
        level,
        part,
        text: cleanText,
      }),
      contentVersion: "v1",
      promptVersion: "v1",
      userId: input.userId,
      bypassCache: input.bypassCache,
      maxTokens: 2800,
      db,
      validate: (raw: any) => {
        if (!raw || typeof raw !== "object") return null;
        if (!Number.isFinite(raw.score) || raw.score < 0 || raw.score > 1) return null;
        if (typeof raw.overallEvaluationTr !== "string" || !raw.overallEvaluationTr.trim()) return null;
        if (typeof raw.correctedVersion !== "string" || !raw.correctedVersion.trim()) return null;
        const c = raw.criteria ?? {};
        const c1 = validateCriterion(c.aufgabenerfuellung);
        const c2 = validateCriterion(c.kohaerenz);
        const c3 = validateCriterion(c.wortschatz);
        const c4 = validateCriterion(c.strukturen);
        if (!c1 || !c2 || !c3 || !c4) return null;

        return {
          score: Math.max(0, Math.min(1, Number(raw.score))),
          confidence: Number.isFinite(raw.confidence)
            ? Math.max(0.8, Math.min(1, Number(raw.confidence)))
            : 0.85,
          overallEvaluationTr: raw.overallEvaluationTr.trim().slice(0, 1400),
          feedback:
            typeof raw.feedback === "string" && raw.feedback.trim()
              ? raw.feedback.trim().slice(0, 1000)
              : raw.overallEvaluationTr.trim().slice(0, 1000),
          strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String).slice(0, 6) : [],
          grammarMistakes: Array.isArray(raw.grammarMistakes)
            ? raw.grammarMistakes
                .filter((m: any) => m && typeof m.original === "string" && typeof m.correction === "string")
                .slice(0, 10)
                .map((m: any) => ({
                  original: String(m.original).slice(0, 220),
                  correction: String(m.correction).slice(0, 220),
                  explanationTr: String(m.explanationTr ?? "").slice(0, 320),
                  category: String(m.category ?? "Dilbilgisi").slice(0, 60),
                }))
            : [],
          vocabularyImprovements: Array.isArray(raw.vocabularyImprovements)
            ? raw.vocabularyImprovements
                .filter((v: any) => v && typeof v.original === "string" && typeof v.better === "string")
                .slice(0, 8)
                .map((v: any) => ({
                  original: String(v.original).slice(0, 160),
                  better: String(v.better).slice(0, 160),
                  reasonTr: String(v.reasonTr ?? "").slice(0, 260),
                }))
            : [],
          missedRequirements: Array.isArray(raw.missedRequirements)
            ? raw.missedRequirements.map(String).slice(0, 6)
            : [],
          correctedVersion: raw.correctedVersion.trim().slice(0, 4000),
          tips: Array.isArray(raw.tips) ? raw.tips.map(String).slice(0, 6) : [],
          errorTypes: Array.isArray(raw.errorTypes) ? raw.errorTypes.map(String).slice(0, 8) : [],
          criteria: {
            aufgabenerfuellung: c1,
            kohaerenz: c2,
            wortschatz: c3,
            strukturen: c4,
          },
        };
      },
    },
  );

  const val = aiRes.value;
  return {
    ...val,
    unofficialPracticeEstimate: true,
    disclaimerTr:
      "Bu değerlendirme resmi Goethe sınav puanı değildir; pratik amaçlı yapay zekâ destekli ön incelemedir.",
    cefrLevel: level,
    taskPart: part,
    suggestedAnswer: val.correctedVersion,
    diffSegments: computeWordDiff(cleanText, val.correctedVersion),
    originalSubmission: cleanText,
    provider: aiRes.provider,
    model: aiRes.model,
    pending: false,
    unofficial: true,
  };
}
