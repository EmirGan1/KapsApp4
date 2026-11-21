import { getApiUrl, getAuthHeaders } from "../../utils/api";
import type { CefrLevel, StudyDirection } from "../../shared/germanActivities";
import type {
  ActiveSession,
  CheckTaskResponse,
  MistakeExplanationResponse,
  OverviewResponse,
  PronunciationGuide,
  QuestionAuditItem,
  QuestionReportItem,
  SchreibenEvaluationResult,
  SessionPerformanceReview,
  VocabularyCardDetail,
  VocabularyResponse,
} from "./types";

export async function germanRequest<T = any>(
  path: string,
  data?: unknown,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  let response: Response;
  const timeoutSignal = AbortSignal.timeout(options?.timeoutMs ?? 45000);
  const signal = options?.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  try {
    response = await fetch(getApiUrl("/api/kaps-german" + path), {
      method: data === undefined ? "GET" : "POST",
      headers: getAuthHeaders(
        data === undefined ? undefined : { "Content-Type": "application/json" },
      ),
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: "no-store",
      keepalive: data !== undefined,
      signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw err;
    }
    throw new Error("Bağlantı kurulamadı. Taslağın güvende, birazdan tekrar dene.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error ??
        (response.status === 403
          ? "Kaps German modülüne erişim iznin bulunmuyor."
          : "İşlem tamamlanamadı. Oturumunu kontrol edip tekrar dene."),
    );
  }
  return response.json();
}

export function fetchAccess(): Promise<{ admin: boolean }> {
  return germanRequest("/access");
}

export function fetchOverview(compact = true): Promise<OverviewResponse> {
  return germanRequest(`/overview${compact ? "?compact=1" : ""}`);
}

export function fetchVocabulary(params: {
  level?: string;
  status?: string;
  topic?: string;
  q?: string;
  mistakesOnly?: boolean;
  page?: number;
  limit?: number;
}): Promise<VocabularyResponse> {
  const qs = new URLSearchParams();
  if (params.level) qs.set("level", params.level);
  if (params.status) qs.set("status", params.status);
  if (params.topic) qs.set("topic", params.topic);
  if (params.q) qs.set("q", params.q);
  if (params.mistakesOnly) qs.set("mistakesOnly", "1");
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return germanRequest(`/vocabulary?${qs.toString()}`);
}

export function saveStudyPreferences(prefs: {
  selectedLevels?: CefrLevel[];
  preferredDirection?: StudyDirection;
  dailyGoalXp?: number;
  showTurkishPronunciation?: boolean;
  autoSessionReview?: boolean;
}): Promise<{ ok: boolean }> {
  return germanRequest("/preferences", prefs);
}

export function startStudySession(payload: {
  module?: string;
  mode?: "practice" | "exam";
  activity?: string;
  direction?: StudyDirection;
  levels?: CefrLevel[];
  topic?: string;
  wordIds?: string[];
  reviewMode?: boolean;
}): Promise<{ id: string }> {
  return germanRequest("/sessions", payload);
}

export function fetchSession(sessionId: string): Promise<ActiveSession> {
  return germanRequest(`/sessions/${encodeURIComponent(sessionId)}`);
}

export function saveSessionDraft(
  sessionId: string,
  payload: {
    taskId: string;
    answer: string;
    version: number;
    positionTaskId?: string;
    draft?: boolean;
  },
): Promise<{ ok: boolean; version: number }> {
  return germanRequest(`/sessions/${encodeURIComponent(sessionId)}/answer`, {
    ...payload,
    draft: payload.draft ?? true,
  });
}

export function checkTaskAnswer(
  sessionId: string,
  payload: {
    taskId: string;
    answer: string;
    positionTaskId?: string;
    skip?: boolean;
  },
): Promise<CheckTaskResponse> {
  return germanRequest(`/sessions/${encodeURIComponent(sessionId)}/check`, payload);
}

export function submitSession(sessionId: string): Promise<{ ok: boolean }> {
  return germanRequest(`/sessions/${encodeURIComponent(sessionId)}/submit`, {});
}

export function retrySessionGrading(sessionId: string): Promise<{ ok: boolean }> {
  return germanRequest(`/sessions/${encodeURIComponent(sessionId)}/retry`, {});
}

export function startReinforcementSession(sessionId: string): Promise<{
  id: string;
  existing?: boolean;
  alreadyCompleted?: boolean;
  reinforcementDirection: StudyDirection;
}> {
  return germanRequest(`/sessions/${encodeURIComponent(sessionId)}/reinforce`, {});
}

export function resetGermanProgress(): Promise<{ ok: boolean }> {
  return germanRequest("/progress/reset", { confirm: "RESET_MY_PROGRESS" });
}

// ==================== NEW AI & STUDY CARD ENDPOINTS ====================

export function explainMistake(payload: {
  sessionId: string;
  taskId: string;
  answer?: string;
  isCorrect?: boolean;
  detailed?: boolean;
}): Promise<MistakeExplanationResponse> {
  return germanRequest("/ai/explain", payload, { timeoutMs: 45000 });
}

export function requestSessionReview(payload: {
  sessionId: string;
  forceRefresh?: boolean;
}): Promise<SessionPerformanceReview> {
  return germanRequest("/ai/session-review", payload, { timeoutMs: 45000 });
}

export function createPersonalizedReinforcement(payload: {
  levels: CefrLevel[];
  direction?: StudyDirection;
  includeMasteredReview?: boolean;
  parentSessionId?: string;
}): Promise<{
  sessionId: string;
  taskCount: number;
  aiGeneratedCount: number;
  fallbackUsed: boolean;
  focusSummaryTr: string;
}> {
  return germanRequest("/ai/reinforcement", payload, { timeoutMs: 50000 });
}

export function reviewSchreiben(payload: {
  sessionId?: string;
  taskId?: string;
  level?: string;
  part?: number;
  prompt?: string;
  passage?: string;
  text: string;
  bypassCache?: boolean;
}): Promise<SchreibenEvaluationResult> {
  return germanRequest("/ai/schreiben-review", payload, { timeoutMs: 55000 });
}

export function fetchVocabularyCard(wordId: string): Promise<VocabularyCardDetail> {
  return germanRequest(`/vocabulary/${encodeURIComponent(wordId)}/card`);
}

export function requestAnotherWordExample(wordId: string): Promise<VocabularyCardDetail> {
  return germanRequest(`/vocabulary/${encodeURIComponent(wordId)}/card/example`, {});
}

export function suggestWordPronunciation(wordId: string): Promise<PronunciationGuide> {
  return germanRequest(`/vocabulary/${encodeURIComponent(wordId)}/pronunciation/suggest`, {});
}

export function reportQuestion(payload: {
  sessionId: string;
  taskId: string;
  reason: string;
  comment?: string;
  studentAnswer?: string;
}): Promise<{ id: string; deduplicated: boolean; messageTr: string }> {
  return germanRequest("/questions/report", payload);
}

export function fetchMyReports(): Promise<
  Array<{
    id: string;
    task_id: string;
    level: string;
    exercise_type: string;
    reason: string;
    comment: string;
    status: string;
    admin_note: string | null;
    created_at: string;
    reviewed_at: string | null;
  }>
> {
  return germanRequest("/questions/reports");
}

export function fetchGermanAIStatus(): Promise<{
  groqConfigured: boolean;
  groqModel: string;
  ollamaConfigured: boolean;
  ollamaModel: string | null;
  ollamaLastHealthy: boolean | null;
  queues: Record<string, { active: number; queued: number; maxConcurrent: number }>;
}> {
  return germanRequest("/admin/ai-status");
}

export function fetchAdminReports(status: "open" | "resolved" | "all" = "open"): Promise<QuestionReportItem[]> {
  return germanRequest(`/admin/reports?status=${encodeURIComponent(status)}`);
}

export function resolveAdminReport(
  reportId: string,
  payload: {
    action: "approve_correction" | "disable" | "reject";
    adminNote?: string;
    correctedAnswer?: string;
    correctedPrompt?: string;
    correctedOptions?: string[];
    correctedExplanation?: string;
    regradeWrongAttempts?: boolean;
  },
): Promise<{ ok: boolean; status: string; regradedCount: number }> {
  return germanRequest(`/admin/reports/${encodeURIComponent(reportId)}/resolve`, payload);
}

export function fetchAdminAudits(): Promise<{
  summary: Record<string, number>;
  items: QuestionAuditItem[];
}> {
  return germanRequest("/admin/questions/audit");
}

export function runAdminQualityScan(payload?: {
  limit?: number;
  useAI?: boolean;
  includeGeneratedSample?: boolean;
}): Promise<{
  scannedCount: number;
  summary: Record<string, number>;
}> {
  return germanRequest("/admin/questions/audit", payload ?? {}, { timeoutMs: 60000 });
}

export function resolveAdminAudit(payload: {
  taskFingerprint: string;
  action: "approve_correction" | "disable" | "reject";
  adminNote?: string;
  correctedAnswer?: string;
  correctedPrompt?: string;
  correctedOptions?: string[];
  correctedExplanation?: string;
}): Promise<{ ok: boolean; status: string; regradedCount: number }> {
  return germanRequest("/admin/questions/audit/resolve", payload);
}

// ==================== STRICT NATIVE GERMAN TTS ENGINE ====================

export interface GermanVoiceStatus {
  supported: boolean;
  status: "ready" | "loading" | "no-german-voice" | "unsupported";
  voiceName?: string;
  lang?: string;
}

export interface SpeakGermanResult {
  ok: boolean;
  reason?: "unsupported" | "no-german-voice" | "empty" | "error";
  voiceName?: string;
  lang?: string;
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/**
 * Strictly selects ONLY native German speech voices (de-DE, de-AT, de-CH, or de).
 * NEVER falls back to Turkish (tr-*), English (en-*), or default browser language!
 */
export function selectGermanVoice<
  T extends { lang?: string; name?: string; localService?: boolean; default?: boolean },
>(voices: readonly T[]): T | null {
  if (!Array.isArray(voices) || voices.length === 0) return null;
  const germanVoices = voices.filter((v) => {
    const lang = String(v?.lang ?? "").trim().toLowerCase();
    return lang === "de" || lang.startsWith("de-") || lang.startsWith("de_");
  });
  if (germanVoices.length === 0) return null;

  const scoreVoice = (v: T): number => {
    const lang = String(v.lang ?? "").trim().toLowerCase();
    const name = String(v.name ?? "").toLowerCase();
    let score = 0;
    if (lang === "de-de" || lang === "de_de") score += 40;
    else if (lang === "de") score += 28;
    else if (lang === "de-at" || lang === "de-ch") score += 20;
    if (/natural|neural|google|microsoft|anna|helena|petra|yannick|markus|katja/.test(name)) {
      score += 25;
    }
    if (!/compact|espeak/.test(name)) score += 6;
    if (v.localService) score += 3;
    return score;
  };

  return [...germanVoices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

const voiceListeners = new Set<() => void>();
let voiceRegistryReady = false;
let voicesInitializedAt = 0;

function ensureVoiceListener() {
  if (voiceRegistryReady || !isSpeechSupported()) return;
  voiceRegistryReady = true;
  voicesInitializedAt = Date.now();
  try {
    const synth = window.speechSynthesis;
    const notify = () => {
      voiceListeners.forEach((cb) => {
        try {
          cb();
        } catch {}
      });
    };
    if (typeof synth.addEventListener === "function") {
      synth.addEventListener("voiceschanged", notify);
    } else if ("onvoiceschanged" in synth) {
      synth.onvoiceschanged = notify;
    }
  } catch {}
}

export function subscribeGermanVoiceStatus(listener: () => void): () => void {
  ensureVoiceListener();
  voiceListeners.add(listener);
  return () => {
    voiceListeners.delete(listener);
  };
}

export function getGermanVoiceStatus(): GermanVoiceStatus {
  if (!isSpeechSupported()) {
    return { supported: false, status: "unsupported" };
  }
  ensureVoiceListener();
  try {
    const voices = window.speechSynthesis.getVoices();
    const deVoice = selectGermanVoice(voices);
    if (deVoice) {
      return {
        supported: true,
        status: "ready",
        voiceName: deVoice.name,
        lang: deVoice.lang,
      };
    }
    if (voices.length === 0 && Date.now() - voicesInitializedAt < 1200) {
      return { supported: true, status: "loading" };
    }
    return { supported: true, status: "no-german-voice" };
  } catch {
    return { supported: false, status: "unsupported" };
  }
}

export function stopGermanSpeech(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}

export function speakGermanWithStatus(
  text: string,
  options?: number | { rate?: number; onEnd?: () => void; onError?: (reason: string) => void },
): SpeakGermanResult {
  const clean = text.trim();
  if (!clean) return { ok: false, reason: "empty" };
  if (!isSpeechSupported()) {
    if (typeof options === "object") options.onError?.("unsupported");
    return { ok: false, reason: "unsupported" };
  }
  ensureVoiceListener();
  const rate =
    typeof options === "number"
      ? options
      : Math.max(0.5, Math.min(1.3, options?.rate ?? 0.95));

  try {
    const voices = window.speechSynthesis.getVoices();
    const deVoice = selectGermanVoice(voices);

    // CRITICAL: If browser reports loaded voices and NONE of them is German (de-*),
    // NEVER allow browser to read German text using Turkish/English default voice!
    if (voices.length > 0 && !deVoice) {
      if (typeof options === "object") options.onError?.("no-german-voice");
      return { ok: false, reason: "no-german-voice" };
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = deVoice?.lang || "de-DE";
    utterance.rate = rate;
    utterance.pitch = 1.0;
    if (deVoice) {
      utterance.voice = deVoice;
    }
    if (typeof options === "object") {
      if (options.onEnd) utterance.onend = options.onEnd;
      utterance.onerror = () => options.onError?.("error");
    }
    window.speechSynthesis.speak(utterance);
    return {
      ok: true,
      voiceName: deVoice?.name,
      lang: utterance.lang,
    };
  } catch {
    if (typeof options === "object") options.onError?.("error");
    return { ok: false, reason: "error" };
  }
}

export function speakGerman(
  text: string,
  options?: number | { rate?: number; onEnd?: () => void; onError?: (reason: string) => void },
): boolean {
  return speakGermanWithStatus(text, options).ok;
}
