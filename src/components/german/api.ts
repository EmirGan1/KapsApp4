import { getApiUrl, getAuthHeaders } from "../../utils/api";
import type { CefrLevel, StudyDirection } from "../../shared/germanActivities";
import type {
  ActiveSession,
  CheckTaskResponse,
  OverviewResponse,
  VocabularyResponse,
} from "./types";

export async function germanRequest<T = any>(
  path: string,
  data?: unknown,
  options?: { signal?: AbortSignal; timeoutMs?: number },
): Promise<T> {
  let response: Response;
  const timeoutSignal = AbortSignal.timeout(options?.timeoutMs ?? 35000);
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

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakGerman(text: string, rate = 0.95): boolean {
  if (!isSpeechSupported() || !text.trim()) return false;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "de-DE";
    utterance.rate = rate;
    const voices = window.speechSynthesis.getVoices();
    const deVoice = voices.find((v) => v.lang.toLowerCase().startsWith("de"));
    if (deVoice) utterance.voice = deVoice;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
