import type { PreparationProgress } from '../../shared/germanPreparation';
import { normalizeOverview } from './overview';
import { getApiUrl, getAuthHeaders } from "../../utils/api";
import type {
  CefrLevel,
  DistractorDifficulty,
  SatzbauMode,
  StudyDirection,
} from "../../shared/germanActivities";
import type {
  ActiveSession,
  CheckTaskResponse,
  LevelAudioPackManifest,
  MistakeExplanationResponse,
  OverviewResponse,
  PronunciationGuide,
  QuestionAuditItem,
  QuestionReportItem,
  SatzbauReviewResult,
  SchreibenEvaluationResult,
  SessionPerformanceReview,
  VocabularyCardDetail,
  VocabularyResponse,
} from "./types";

export async function germanRequest<T = any>(
  path: string,
  data?: unknown,
  options?: { signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string> },
): Promise<T> {
  let response: Response;
  const timeoutSignal = AbortSignal.timeout(options?.timeoutMs ?? 45000);
  const signal = options?.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  const requestHeaders = getAuthHeaders(data === undefined ? undefined : { "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(options?.headers || {})) requestHeaders.set(key, value);
  try {
    response = await fetch(getApiUrl("/api/kaps-german" + path), {
      method: data === undefined ? "GET" : "POST",
      headers: requestHeaders,
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: "no-store",
      keepalive: data !== undefined,
      signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw err;
    }
    if (err?.name === "TimeoutError") throw new Error("Hazırlık beklenenden uzun sürdü. Yeniden başlamadan önce Profil bölümündeki oturumlarını kontrol et.");
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
  return germanRequest<OverviewResponse>(`/overview${compact ? "?compact=1" : ""}`).then(normalizeOverview);
}

export function fetchVocabulary(params: {
  level?: string;
  status?: string;
  topic?: string;
  categoryId?: string;
  unitId?: string;
  q?: string;
  mistakesOnly?: boolean;
  page?: number;
  limit?: number;
}): Promise<VocabularyResponse> {
  const qs = new URLSearchParams();
  if (params.level) qs.set("level", params.level);
  if (params.status) qs.set("status", params.status);
  if (params.topic) qs.set("topic", params.topic);
  if (params.categoryId) qs.set("categoryId", params.categoryId);
  if (params.unitId) qs.set("unitId", params.unitId);
  if (params.q) qs.set("q", params.q);
  if (params.mistakesOnly) qs.set("mistakesOnly", "1");
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return germanRequest(`/vocabulary?${qs.toString()}`);
}

export function saveStudyPreferences(prefs: {
  selectedLevels?: CefrLevel[];
  preferredDirection?: StudyDirection;
  distractorDifficulty?: DistractorDifficulty;
  dailyGoalXp?: number;
  showTurkishPronunciation?: boolean;
  autoSessionReview?: boolean;
}): Promise<{ ok: boolean }> {
  return germanRequest("/preferences", prefs);
}

export type OnPreparationProgress = (progress: PreparationProgress) => void;

async function preparedRequest<T>(path: string, payload: unknown, onProgress?: OnPreparationProgress, timeoutMs = 45000): Promise<T> {
  if (!onProgress) return germanRequest<T>(path, payload, { timeoutMs });
  const id = crypto.randomUUID();
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pollController = new AbortController();
  onProgress({ stage: 'accepted', percent: 0, status: 'working', estimateMs: path === '/ai/reinforcement' ? 40000 : 6000, elapsedMs: 0 });
  const poll = async () => {
    try {
      const progress = await germanRequest<PreparationProgress>(`/preparations/${id}`, undefined, { signal: pollController.signal, timeoutMs: 5000 });
      if (active) onProgress(progress);
    } catch { /* A late or failed status poll must never interrupt session creation. */ }
    if (active) timer = setTimeout(poll, 1200);
  };
  timer = setTimeout(poll, 150);
  try {
    return await germanRequest<T>(path, payload, { timeoutMs, headers: { 'X-German-Preparation-Id': id } });
  } finally {
    active = false;
    clearTimeout(timer);
    pollController.abort();
  }
}

export function startStudySession(payload: {
  module?: string;
  mode?: "practice" | "exam";
  activity?: string;
  direction?: StudyDirection;
  levels?: CefrLevel[];
  topic?: string;
  categoryId?: string;
  unitId?: string;
  difficulty?: DistractorDifficulty;
  satzbauMode?: SatzbauMode;
  wordIds?: string[];
  reviewMode?: boolean;
}, onProgress?: OnPreparationProgress): Promise<{ id: string }> {
  return preparedRequest("/sessions", payload, onProgress);
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

export function startReinforcementSession(sessionId: string, onProgress?: OnPreparationProgress): Promise<{
  id: string;
  existing?: boolean;
  alreadyCompleted?: boolean;
  reinforcementDirection: StudyDirection;
}> {
  return preparedRequest(`/sessions/${encodeURIComponent(sessionId)}/reinforce`, {}, onProgress);
}

export function resetGermanProgress(): Promise<{ ok: boolean }> {
  return germanRequest("/progress/reset", { confirm: "RESET_MY_PROGRESS" });
}

// ==================== NEW AI, SATZBAU & STUDY CARD ENDPOINTS ====================

export function explainMistake(payload: {
  sessionId: string;
  taskId: string;
  answer?: string;
  isCorrect?: boolean;
  detailed?: boolean;
}): Promise<MistakeExplanationResponse> {
  return germanRequest("/ai/explain", payload, { timeoutMs: 45000 });
}

export function reviewSatzbauSentence(payload: {
  sessionId?: string;
  taskId?: string;
  userSentence: string;
  expectedSentence?: string;
  turkishPrompt?: string;
  targetWordDe?: string;
  targetWordTr?: string;
  mode?: SatzbauMode;
  level?: string;
}): Promise<SatzbauReviewResult> {
  return germanRequest("/ai/satzbau-review", payload, { timeoutMs: 30000 });
}

export function fetchLevelAudioPack(level: CefrLevel): Promise<LevelAudioPackManifest> {
  return germanRequest(`/audio/pack?level=${encodeURIComponent(level)}`);
}

export function warmLevelAudioPackOnServer(
  level: CefrLevel,
  limit = 20,
): Promise<{ ok: boolean; level: CefrLevel; warmed: number }> {
  return germanRequest("/audio/warm", { level, limit });
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
}, onProgress?: OnPreparationProgress): Promise<{
  sessionId: string;
  taskCount: number;
  aiGeneratedCount: number;
  fallbackUsed: boolean;
  focusSummaryTr: string;
}> {
  return preparedRequest("/ai/reinforcement", payload, onProgress, 90000);
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

// ==================== LAYERED SERVER-HOSTED + CACHE API GERMAN AUDIO ENGINE ====================

export const GERMAN_AUDIO_CACHE_NAME = "kaps-german-audio-v1";

export interface GermanVoiceStatus {
  supported: boolean;
  status: "ready" | "loading" | "no-german-voice" | "unsupported";
  voiceName?: string;
  lang?: string;
  serverHosted: boolean;
}

export interface SpeakGermanResult {
  ok: boolean;
  reason?: "unsupported" | "no-german-voice" | "empty" | "error";
  voiceName?: string;
  lang?: string;
  source?: "cache_api" | "server_audio" | "browser_de_voice";
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined";
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
let activeHtmlAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;

export function subscribeGermanVoiceStatus(listener: () => void): () => void {
  voiceListeners.add(listener);
  return () => {
    voiceListeners.delete(listener);
  };
}

export function getGermanVoiceStatus(): GermanVoiceStatus {
  // Server-hosted Standard German (`de-DE`) audio is always ready on every device!
  let browserDeName = "KapsApp Sunucu Ses Motoru (de-DE)";
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const deVoice = selectGermanVoice(window.speechSynthesis.getVoices());
      if (deVoice?.name) {
        browserDeName = `Sunucu (de-DE) + ${deVoice.name}`;
      }
    }
  } catch {}
  return {
    supported: true,
    status: "ready",
    voiceName: browserDeName,
    lang: "de-DE",
    serverHosted: true,
  };
}

export function stopGermanSpeech(): void {
  try {
    if (activeHtmlAudio) {
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
      activeHtmlAudio = null;
    }
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  } catch {}
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  } catch {}
}

export function buildServerGermanAudioUrl(text: string, rateMode: "normal" | "slow"): string {
  return getApiUrl(
    `/api/kaps-german/audio?text=${encodeURIComponent(text.trim())}&rate=${rateMode}`,
  );
}

async function resolveGermanAudioBlobUrl(
  text: string,
  rateMode: "normal" | "slow",
): Promise<{ blobUrl: string; source: "cache_api" | "server_audio" }> {
  const url = buildServerGermanAudioUrl(text, rateMode);
  const canUseCache = typeof window !== "undefined" && "caches" in window;

  if (canUseCache) {
    try {
      const cache = await window.caches.open(GERMAN_AUDIO_CACHE_NAME);
      const cachedRes = await cache.match(url);
      if (cachedRes && cachedRes.ok) {
        const blob = await cachedRes.blob();
        if (blob.size > 128) {
          return { blobUrl: URL.createObjectURL(blob), source: "cache_api" };
        }
      }
    } catch {}
  }

  const res = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Sunucu ses dosyası alınamadı.");
  }
  const cloned = res.clone();
  const blob = await res.blob();
  if (blob.size <= 128) {
    throw new Error("Geçersiz ses verisi.");
  }

  if (canUseCache) {
    try {
      const cache = await window.caches.open(GERMAN_AUDIO_CACHE_NAME);
      await cache.put(url, cloned);
    } catch {}
  }

  return { blobUrl: URL.createObjectURL(blob), source: "server_audio" };
}

/**
 * Layered German Speech Player:
 * Layer 1: Persistent Browser Cache API (`kaps-german-audio-v1`)
 * Layer 2: Server-Hosted Standard German (`de-DE`) Audio Endpoint (`/api/kaps-german/audio`)
 * Layer 3: Verified Browser `de-*` SpeechSynthesis voice (ONLY if offline and a real `de-*` voice is installed — NEVER Turkish or English)
 */
export function speakGermanWithStatus(
  text: string,
  options?: number | { rate?: number; onEnd?: () => void; onError?: (reason: string) => void },
): SpeakGermanResult {
  const clean = (text || "").trim();
  if (!clean) return { ok: false, reason: "empty" };

  const numericRate =
    typeof options === "number"
      ? options
      : Math.max(0.5, Math.min(1.3, options?.rate ?? 0.95));
  const rateMode: "normal" | "slow" = numericRate <= 0.78 ? "slow" : "normal";
  const onEnd = typeof options === "object" ? options?.onEnd : undefined;
  const onError = typeof options === "object" ? options?.onError : undefined;

  stopGermanSpeech();

  void (async () => {
    try {
      const { blobUrl } = await resolveGermanAudioBlobUrl(clean, rateMode);
      stopGermanSpeech();
      activeObjectUrl = blobUrl;
      const audio = new Audio(blobUrl);
      activeHtmlAudio = audio;
      audio.onended = () => {
        if (activeObjectUrl === blobUrl) {
          URL.revokeObjectURL(blobUrl);
          activeObjectUrl = null;
        }
        if (activeHtmlAudio === audio) {
          activeHtmlAudio = null;
        }
        onEnd?.();
      };
      audio.onerror = () => {
        if (activeObjectUrl === blobUrl) {
          URL.revokeObjectURL(blobUrl);
          activeObjectUrl = null;
        }
        onError?.("error");
      };
      await audio.play();
    } catch {
      // Offline fallback ONLY if browser has an actual verified German (`de-*`) voice
      try {
        if (
          typeof window !== "undefined" &&
          "speechSynthesis" in window &&
          typeof SpeechSynthesisUtterance !== "undefined"
        ) {
          const voices = window.speechSynthesis.getVoices();
          const deVoice = selectGermanVoice(voices);
          if (deVoice) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(clean);
            utterance.lang = deVoice.lang || "de-DE";
            utterance.voice = deVoice;
            utterance.rate = numericRate;
            if (onEnd) utterance.onend = onEnd;
            utterance.onerror = () => onError?.("error");
            window.speechSynthesis.speak(utterance);
            return;
          }
        }
      } catch {}
      onError?.("error");
    }
  })();

  return {
    ok: true,
    voiceName: "KapsApp Sunucu Ses Motoru (de-DE)",
    lang: "de-DE",
    source: "server_audio",
  };
}

export function speakGerman(
  text: string,
  options?: number | { rate?: number; onEnd?: () => void; onError?: (reason: string) => void },
): boolean {
  return speakGermanWithStatus(text, options).ok;
}

/**
 * Downloads and caches a CEFR level's German audio pack into the browser's persistent Cache API
 * (`kaps-german-audio-v1`) so pronunciation works instantaneously and offline.
 */
export async function downloadLevelAudioPackToBrowserCache(
  level: CefrLevel,
  onProgress?: (progress: { completed: number; total: number; bytesDownloaded: number }) => void,
  signal?: AbortSignal,
): Promise<{ cachedTotal: number; bytesDownloaded: number }> {
  if (typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.persist === "function") {
    try {
      await navigator.storage.persist();
    } catch {}
  }

  const manifest = await fetchLevelAudioPack(level);
  const canUseCache = typeof window !== "undefined" && "caches" in window;
  const cache = canUseCache ? await window.caches.open(GERMAN_AUDIO_CACHE_NAME) : null;

  let completed = 0;
  let cachedTotal = 0;
  let bytesDownloaded = 0;
  const total = manifest.items.length;

  for (const item of manifest.items) {
    if (signal?.aborted) break;
    const fullUrl = getApiUrl(item.normalUrl);
    try {
      if (cache) {
        const existing = await cache.match(fullUrl);
        if (existing && existing.ok && Number(existing.headers.get("Content-Length") || 129) > 128) {
          const b = await existing.blob();
          bytesDownloaded += b.size;
          completed++;
          cachedTotal++;
          onProgress?.({ completed, total, bytesDownloaded });
          continue;
        }
      }
      const res = await fetch(fullUrl, { headers: getAuthHeaders(), signal });
      if (res.ok) {
        const clone = res.clone();
        const blob = await res.blob();
        bytesDownloaded += blob.size;
        if (cache && blob.size > 128) {
          await cache.put(fullUrl, clone);
          cachedTotal++;
        }
      }
    } catch {}
    completed++;
    onProgress?.({ completed, total, bytesDownloaded });
  }

  return { cachedTotal, bytesDownloaded };
}

export async function getBrowserCachedAudioStats(manifest?: LevelAudioPackManifest): Promise<{ entryCount: number }> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return { entryCount: 0 };
  }
  try {
    const cache = await window.caches.open(GERMAN_AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    if (!manifest) return { entryCount: keys.length };
    const urls = new Set(keys.map(key => key.url));
    return { entryCount: manifest.items.filter(item => urls.has(new URL(getApiUrl(item.normalUrl), window.location.href).href)).length };
  } catch {
    return { entryCount: 0 };
  }
}

export async function clearBrowserCachedGermanAudio(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;
  try {
    await window.caches.delete(GERMAN_AUDIO_CACHE_NAME);
  } catch {}
}

