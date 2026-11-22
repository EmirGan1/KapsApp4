import { getApiUrl, getAuthHeaders } from "../../utils/api";
import type {
  PersonalCefrLevel,
  PersonalCefrSummary,
  PersonalDirection,
  PersonalExerciseModeId,
  PersonalQuestionResult,
  PersonalSessionDTO,
  PersonalSourceSummary,
  PersonalVocabItemDTO,
} from "../../shared/germanPersonal";

export interface PersonalGoogleStatus {
  oauthConfigured: boolean;
  connected: boolean;
  status: string;
  email: string;
  scope: string;
  lastError: string | null;
  updatedAt: string | null;
  sharedLinkSupported: boolean;
}

export interface PersonalOverviewResponse {
  sources: PersonalSourceSummary[];
  googleStatus: PersonalGoogleStatus;
  summary: {
    totalSources: number;
    totalUniqueWords: number;
    masteredWords: number;
    almostMasteredWords: number;
    learningWords: number;
    needsReviewWords: number;
    completionPercent: number;
    cefrSummary: PersonalCefrSummary;
  };
  sessions: Array<{
    id: string;
    kind: "practice" | "comprehensive";
    mode: string;
    direction: string;
    sourceIds: string[];
    status: string;
    totalTargets: number;
    coveredCount: number;
    coveragePercent: number;
    currentBatch: number;
    totalBatches: number;
    updatedAt: string;
    completedAt: string | null;
  }>;
}

async function personalFetch<T = any>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    formData?: FormData;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const method = options.method ?? (options.body !== undefined || options.formData ? "POST" : "GET");
  const headers = getAuthHeaders(
    options.formData ? undefined : options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
  );
  const signal = AbortSignal.timeout(options.timeoutMs ?? 45_000);
  let res: Response;
  try {
    res = await fetch(getApiUrl(`/api/kaps-german/personal${path}`), {
      method,
      headers,
      body: options.formData
        ? options.formData
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      cache: "no-store",
      signal,
    });
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      throw new Error("İstek beklenenden uzun sürdü. Lütfen tekrar dene.");
    }
    throw new Error("Sunucuya bağlanılamadı. İnternet bağlantını kontrol et.");
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error || "İşlem tamamlanamadı.");
  }
  return res.json();
}

export function fetchPersonalOverview(): Promise<PersonalOverviewResponse> {
  return personalFetch("/overview");
}

export function createPersonalTextSource(payload: {
  title: string;
  text: string;
  useAI?: boolean;
}): Promise<{
  source: PersonalSourceSummary;
  diff: { added: number; updated: number; removed: number; totalActive: number };
  warnings: string[];
}> {
  return personalFetch("/sources/text", { method: "POST", body: payload, timeoutMs: 60_000 });
}

export function updatePersonalTextSource(
  sourceId: string,
  payload: { title?: string; text: string; useAI?: boolean },
): Promise<{
  source: PersonalSourceSummary;
  diff: { added: number; updated: number; removed: number; totalActive: number };
  warnings: string[];
}> {
  return personalFetch(`/sources/${encodeURIComponent(sourceId)}/text`, {
    method: "PUT",
    body: payload,
    timeoutMs: 60_000,
  });
}

export function uploadPersonalFileSource(payload: {
  file: File;
  title?: string;
  useAI?: boolean;
}): Promise<{
  source: PersonalSourceSummary;
  format: string;
  diff: { added: number; updated: number; removed: number; totalActive: number };
  warnings: string[];
}> {
  const fd = new FormData();
  fd.append("file", payload.file);
  if (payload.title) fd.append("title", payload.title);
  fd.append("useAI", String(payload.useAI !== false));
  return personalFetch("/sources/upload", { method: "POST", formData: fd, timeoutMs: 60_000 });
}

export function fetchPersonalGoogleStatus(): Promise<PersonalGoogleStatus> {
  return personalFetch("/google/status");
}

export function startPersonalGoogleConnect(): Promise<{ url: string }> {
  return personalFetch("/google/start", { method: "POST", body: {} });
}

export function disconnectPersonalGoogle(): Promise<{ ok: boolean }> {
  return personalFetch("/google/disconnect", { method: "POST", body: {} });
}

export function connectPersonalGoogleDoc(payload: {
  url: string;
  title?: string;
  autoSyncEnabled?: boolean;
  syncIntervalMin?: number;
  useAI?: boolean;
}): Promise<{
  source: PersonalSourceSummary;
  accessMethod?: string;
  alreadyConnected?: boolean;
  diff?: { added: number; updated: number; removed: number; totalActive: number };
  warnings?: string[];
}> {
  return personalFetch("/sources/gdoc", { method: "POST", body: payload, timeoutMs: 60_000 });
}

export function syncPersonalGoogleDoc(
  sourceId: string,
  force = false,
): Promise<{
  sync: {
    status: string;
    unchanged: boolean;
    added: number;
    updated: number;
    removed: number;
    totalActive: number;
    error?: string;
  };
  source: PersonalSourceSummary | null;
}> {
  return personalFetch(`/sources/${encodeURIComponent(sourceId)}/sync`, {
    method: "POST",
    body: { force },
    timeoutMs: 60_000,
  });
}

export function fetchPersonalSourceDetail(sourceId: string): Promise<{
  source: PersonalSourceSummary;
  rawText: string;
  items: PersonalVocabItemDTO[];
  versions: Array<{
    id: string;
    revisionId: string | null;
    addedCount: number;
    updatedCount: number;
    removedCount: number;
    totalActive: number;
    createdAt: string;
  }>;
}> {
  return personalFetch(`/sources/${encodeURIComponent(sourceId)}`);
}

export function updatePersonalSourceSettings(
  sourceId: string,
  payload: { title?: string; autoSyncEnabled?: boolean; syncIntervalMin?: number },
): Promise<{ source: PersonalSourceSummary }> {
  return personalFetch(`/sources/${encodeURIComponent(sourceId)}`, {
    method: "PATCH",
    body: payload,
  });
}

export function deletePersonalSource(sourceId: string): Promise<{ ok: boolean }> {
  return personalFetch(`/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
}

export function fetchPersonalVocabulary(params: {
  sourceId?: string;
  cefr?: string;
  status?: string;
  q?: string;
  sort?: string;
  includeExcluded?: boolean;
  page?: number;
  limit?: number;
}): Promise<{
  items: PersonalVocabItemDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const qs = new URLSearchParams();
  if (params.sourceId) qs.set("sourceId", params.sourceId);
  if (params.cefr) qs.set("cefr", params.cefr);
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.sort) qs.set("sort", params.sort);
  if (params.includeExcluded) qs.set("includeExcluded", "1");
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return personalFetch(`/vocabulary?${qs.toString()}`);
}

export function updatePersonalVocabularyItem(
  vocabId: string,
  payload: Partial<{
    de: string;
    tr: string;
    article: string;
    plural: string;
    partOfSpeech: string;
    exampleDe: string;
    exampleTr: string;
    notes: string;
    category: string;
    cefrLevel: PersonalCefrLevel;
    uncertain: boolean;
  }>,
): Promise<{ item: PersonalVocabItemDTO }> {
  return personalFetch(`/vocabulary/${encodeURIComponent(vocabId)}`, {
    method: "PATCH",
    body: payload,
  });
}

export function togglePersonalVocabExclude(
  vocabId: string,
  payload: { sourceId?: string; excluded: boolean },
): Promise<{ ok: boolean; excluded: boolean }> {
  return personalFetch(`/vocabulary/${encodeURIComponent(vocabId)}/exclude`, {
    method: "POST",
    body: payload,
  });
}

export function deletePersonalVocabItem(vocabId: string, sourceId?: string): Promise<{ ok: boolean }> {
  const qs = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : "";
  return personalFetch(`/vocabulary/${encodeURIComponent(vocabId)}${qs}`, { method: "DELETE" });
}

export function fetchPersonalVocabHistory(vocabId: string): Promise<{
  item: PersonalVocabItemDTO;
  attempts: Array<{
    id: string;
    sessionId: string;
    mode: string;
    direction: string;
    promptText: string;
    userAnswer: string;
    expectedAnswer: string;
    isCorrect: boolean;
    selfAssessed: boolean;
    creditGranted: boolean;
    streakBefore: number;
    streakAfter: number;
    masteredNow: boolean;
    reported: boolean;
    createdAt: string;
  }>;
}> {
  return personalFetch(`/vocabulary/${encodeURIComponent(vocabId)}/history`);
}

export function startPersonalPracticeSession(payload: {
  mode: PersonalExerciseModeId | "adaptive";
  direction?: PersonalDirection;
  sourceIds?: string[];
  filterStatus?: string;
  cefrLevels?: PersonalCefrLevel[];
  category?: string;
  vocabIds?: string[];
  sessionLength?: number;
  useAI?: boolean;
}): Promise<PersonalSessionDTO> {
  return personalFetch("/sessions", { method: "POST", body: payload, timeoutMs: 45_000 });
}

export function startPersonalComprehensiveTest(payload: {
  sourceIds: string[];
  batchSize?: number;
  extendedMode?: boolean;
  direction?: PersonalDirection;
}): Promise<PersonalSessionDTO> {
  return personalFetch("/comprehensive", { method: "POST", body: payload, timeoutMs: 45_000 });
}

export function fetchPersonalSession(sessionId: string): Promise<PersonalSessionDTO> {
  return personalFetch(`/sessions/${encodeURIComponent(sessionId)}`);
}

export function submitPersonalAnswer(
  sessionId: string,
  payload: {
    questionId: string;
    answer?: string;
    selfAssessment?: "known" | "unknown" | null;
    skip?: boolean;
    idempotencyKey?: string;
  },
): Promise<{
  alreadyAnswered: boolean;
  result: PersonalQuestionResult;
  session: PersonalSessionDTO;
}> {
  return personalFetch(`/sessions/${encodeURIComponent(sessionId)}/answer`, {
    method: "POST",
    body: payload,
    timeoutMs: 30_000,
  });
}

export function advancePersonalComprehensiveBatch(sessionId: string): Promise<PersonalSessionDTO> {
  return personalFetch(`/sessions/${encodeURIComponent(sessionId)}/next-batch`, {
    method: "POST",
    body: {},
  });
}

export function pausePersonalSession(
  sessionId: string,
  currentIndex: number,
): Promise<PersonalSessionDTO> {
  return personalFetch(`/sessions/${encodeURIComponent(sessionId)}/pause`, {
    method: "POST",
    body: { currentIndex },
  });
}

export function completePersonalSession(sessionId: string): Promise<PersonalSessionDTO> {
  return personalFetch(`/sessions/${encodeURIComponent(sessionId)}/complete`, {
    method: "POST",
    body: {},
  });
}

export function reportPersonalAttempt(
  attemptId: string,
  note?: string,
): Promise<{ ok: boolean; messageTr: string }> {
  return personalFetch(`/attempts/${encodeURIComponent(attemptId)}/report`, {
    method: "POST",
    body: { note },
  });
}
