import { useCallback, useEffect, useRef, useState } from "react";
import { getApiUrl, getAuthHeaders } from "../utils/api";
import { KAPSAPP_AI_CONVERSATIONS_PATH as conversationsPath, KAPSAPP_AI_TURNS_PATH as turnsPath, KAPSAPP_AI_PREFERENCE_PATH, KAPSAPP_AI_DEFAULT_MODEL, KAPSAPP_AI_VISION_MODEL, KAPSAPP_AI_PHOTO_PATH } from "../shared/kapsAppAi";
import type { ChatSource, KapsAiModel, SavedChatSummary, SavedChatTurn } from "../shared/kapsAppAi";

type ActiveTurn = { id: string; conversationId: string };
type ConversationList = { model: KapsAiModel; conversations: SavedChatSummary[]; next: number | null; active: ActiveTurn | null };
type ConversationPage = { title: string; turns: SavedChatTurn[]; next: number | null };
type Submission = { id: string; conversationId: string; question: string; source?: ChatSource; model: KapsAiModel; image?: string[] };

class ChatHttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function chatRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    cache: "no-store",
    ...init,
    headers: getAuthHeaders(init.headers),
  });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ChatHttpError(data?.error || "İstek tamamlanamadı. Tekrar dene.", response.status);
  if (!data) throw new Error("Sunucu yanıtı okunamadı.");
  return data;
}

function isPending(turn: SavedChatTurn) {
  return turn.state === "waiting" || turn.state === "streaming";
}

export function useKapsAiHistory(active: boolean) {
  const [model, setModel] = useState<KapsAiModel>(KAPSAPP_AI_DEFAULT_MODEL);
  const [modelPending, setModelPending] = useState(false);
  const choosingModel = useRef(false);
  const [conversations, setConversations] = useState<SavedChatSummary[]>([]);
  const [listNext, setListNext] = useState<number | null>(null);
  const [turnNext, setTurnNext] = useState<number | null>(null);
  const [turns, setTurns] = useState<SavedChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeTurn, setActiveTurn] = useState<ActiveTurn | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const [connectionNotice, setConnectionNotice] = useState("");
  const [pendingSubmission, setPendingSubmission] = useState<Submission | null>(null);
  const [acceptedSubmission, setAcceptedSubmission] = useState<Submission | null>(null);
  const selected = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const olderChatsLoaded = useRef(false);
  const viewVersion = useRef(0);
  const operation = useRef(false);
  const sendAttempt = useRef(false);
  const outbox = useRef<Submission | null>(null);
  const [actionPending, setActionPending] = useState(false);

  function focusConversation(id: string | null) {
    selected.current = id;
    setConversationId(id);
  }

  const updateTurn = useCallback((turn: SavedChatTurn) => {
    if (selected.current !== turn.conversationId) return;
    setTurns(previous => {
      const other = previous.find(item => item.id === turn.id);
      if (!other) return [...previous, turn];
      // A response from a poll may predate a submitted stop or a final result.
      if (!isPending(other) && isPending(turn)) return previous;
      return previous.map(item => item.id === turn.id ? turn : item);
    });
  }, []);

  const open = useCallback(async (id: string | null) => {
    const version = ++viewVersion.current;
    focusConversation(id);
    setTurns([]);
    setTurnNext(null);
    setError("");
    setLoading(Boolean(id));
    if (!id) return;
    try {
      const page = await chatRequest<ConversationPage>(`${conversationsPath}/${id}`, { signal: AbortSignal.timeout(12_000) });
      if (viewVersion.current !== version) return;
      setTurns(previous => {
        const latest = new Map(previous.map(turn => [turn.id, turn]));
        return page.turns.map(turn => latest.get(turn.id) ?? turn);
      });
      setTurnNext(page.next);
      const running = page.turns.find(isPending);
      if (running) setActiveTurn(previous => previous ?? running);
    } catch (cause) {
      if (viewVersion.current === version) setError(cause instanceof ChatHttpError ? cause.message : "Sohbet yüklenemedi. Tekrar dene.");
    } finally {
      if (viewVersion.current === version) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    const version = viewVersion.current;
    const list = await chatRequest<ConversationList>(conversationsPath, { signal: AbortSignal.timeout(12_000) });
    setConversations(previous => {
      const firstPage = new Map(list.conversations.map(chat => [chat.id, chat]));
      for (const chat of previous) if (!firstPage.has(chat.id)) firstPage.set(chat.id, chat);
      return [...firstPage.values()];
    });
    if (!olderChatsLoaded.current) setListNext(list.next);
    if (list.active) setActiveTurn(previous => previous ?? list.active);
    if (!initializedRef.current && version === viewVersion.current) {
      initializedRef.current = true;
      setModel(list.model ?? KAPSAPP_AI_DEFAULT_MODEL);
      setInitialized(true);
      await open(list.active?.conversationId ?? list.conversations[0]?.id ?? null);
    }
  }, [open]);

  useEffect(() => {
    if (!active) return;
    const load = () => {
      if (!document.hidden) void refresh().catch(() => {
        if (!initializedRef.current) setError("Sohbet geçmişi yüklenemedi. Bağlantın geri geldiğinde tekrar denenecek.");
      });
    };
    load();
    document.addEventListener("visibilitychange", load);
    window.addEventListener("online", load);
    return () => {
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("online", load);
    };
  }, [active, refresh]);

  useEffect(() => {
    if (!active || !activeTurn) return;
    const item = activeTurn;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    const poll = async () => {
      if (document.hidden || polling || controller.signal.aborted) return;
      polling = true;
      try {
        const turn = await chatRequest<SavedChatTurn>(`${turnsPath}/${item.id}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (controller.signal.aborted) return;
        setConnectionNotice("");
        updateTurn(turn);
        if (!isPending(turn)) {
          setActiveTurn(previous => previous?.id === item.id ? null : previous);
          return;
        }
        timer = setTimeout(poll, 950);
      } catch (cause) {
        if (controller.signal.aborted) return;
        if (cause instanceof ChatHttpError && cause.status === 404) {
          setActiveTurn(previous => previous?.id === item.id ? null : previous);
          return;
        }
        setConnectionNotice("Bağlantı yenileniyor. Kayıtlı istek sunucuda devam eder.");
        timer = setTimeout(poll, 2500);
      } finally {
        polling = false;
      }
    };
    const resume = () => { clearTimeout(timer); void poll(); };
    resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
    };
  }, [active, activeTurn, updateTurn]);

  const submit = useCallback(async (item: Submission) => {
    if (outbox.current !== item || sendAttempt.current) return;
    sendAttempt.current = true;
    try {
      const path = item.image ? `${KAPSAPP_AI_PHOTO_PATH}/${item.conversationId}` : `${conversationsPath}/${item.conversationId}/turns`;
      const turn = await chatRequest<SavedChatTurn>(path, {
        method: "POST", keepalive: !item.image, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, question: item.question, source: item.source, model: item.model, image: item.image }),
      });
      if (outbox.current !== item) return;
      outbox.current = null;
      setPendingSubmission(null);
      setAcceptedSubmission(item);
      setConnectionNotice("");
      updateTurn(turn);
      if (isPending(turn)) setActiveTurn({ id: turn.id, conversationId: turn.conversationId });
      void refresh().catch(() => {});
      return true;
    } catch (cause) {
      if (outbox.current !== item) return;
      if (cause instanceof ChatHttpError && cause.status < 500) {
        outbox.current = null;
        setPendingSubmission(null);
        setConnectionNotice("");
        setError(cause.message);
      } else {
        setConnectionNotice("Gönderim doğrulanıyor. Bağlantı geldiğinde aynı istek yeniden kontrol edilecek.");
      }
      return false;
    } finally {
      sendAttempt.current = false;
    }
  }, [refresh, updateTurn]);

  useEffect(() => {
    if (!pendingSubmission) return;
    const retry = () => { if (!document.hidden) void submit(pendingSubmission); };
    const timer = setInterval(retry, 3500);
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [pendingSubmission, submit]);

  async function send(question: string, source?: ChatSource, image?: string[]) {
    if (!initialized || loading || activeTurn || outbox.current || operation.current || choosingModel.current) return;
    setError("");
    const item = { id: crypto.randomUUID(), conversationId: selected.current ?? crypto.randomUUID(), question, source, image, model: image ? KAPSAPP_AI_VISION_MODEL : model };
    focusConversation(item.conversationId);
    outbox.current = item;
    setPendingSubmission(item);
    return submit(item);
  }

  async function chooseModel(next: KapsAiModel) {
    if (!initialized || choosingModel.current || next === model) return;
    choosingModel.current = true;
    setModelPending(true);
    setError("");
    try {
      const saved = await chatRequest<{ model: KapsAiModel }>(KAPSAPP_AI_PREFERENCE_PATH, {
        method: "PUT", signal: AbortSignal.timeout(10_000), headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: next }),
      });
      setModel(saved.model);
    } catch (cause) {
      setError(cause instanceof ChatHttpError ? cause.message : "Model tercihi kaydedilemedi. Tekrar dene.");
    } finally {
      choosingModel.current = false;
      setModelPending(false);
    }
  }

  async function action(work: () => Promise<void>) {
    if (operation.current || outbox.current) return;
    operation.current = true;
    setActionPending(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof ChatHttpError ? cause.message : "İşlem tamamlanamadı. Tekrar dene.");
    } finally {
      operation.current = false;
      setActionPending(false);
    }
  }

  async function stop(id: string) {
    await action(async () => {
      const turn = await chatRequest<SavedChatTurn>(`${turnsPath}/${id}/stop`, { method: "POST" });
      updateTurn(turn);
      setActiveTurn(previous => previous?.id === id ? null : previous);
      setConnectionNotice("");
    });
  }

  async function retry(id: string) {
    await action(async () => {
      const turn = await chatRequest<SavedChatTurn>(`${turnsPath}/${id}/retry`, { method: "POST" });
      if (selected.current === turn.conversationId) setTurns(previous => previous.map(old => old.id === id ? turn : old));
      if (isPending(turn)) setActiveTurn({ id, conversationId: turn.conversationId });
    });
  }

  async function remove(id: string) {
    await action(async () => {
      await chatRequest(`${conversationsPath}/${id}`, { method: "DELETE" });
      setConversations(previous => previous.filter(chat => chat.id !== id));
      if (selected.current === id) await open(null);
    });
  }

  async function moreChats() {
    if (listNext === null) return;
    await action(async () => {
      const list = await chatRequest<ConversationList>(`${conversationsPath}?before=${listNext}`);
      setConversations(previous => [...previous, ...list.conversations.filter(chat => !previous.some(old => old.id === chat.id))]);
      olderChatsLoaded.current = true;
      setListNext(list.next);
    });
  }

  async function moreTurns() {
    const id = selected.current;
    const version = viewVersion.current;
    if (!id || turnNext === null) return;
    await action(async () => {
      const page = await chatRequest<ConversationPage>(`${conversationsPath}/${id}?before=${turnNext}`);
      if (viewVersion.current !== version) return;
      setTurns(previous => [...page.turns, ...previous]);
      setTurnNext(page.next);
    });
  }

  return { model, modelPending, chooseModel, conversations, listNext, turnNext, turns, conversationId, activeTurn, loading, initialized, error, connectionNotice,
    pendingSubmission, acceptedSubmission, actionPending, open, refresh, send, stop, retry, remove, moreChats, moreTurns };
}
