import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUp, Check, ChevronDown, Copy, FileText, LoaderCircle, Plus, RotateCcw, Sparkles, Square } from "lucide-react";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import { getApiUrl, getAuthHeaders } from "../utils/api";
import {
  AI_HISTORY_LIMIT, AI_MESSAGE_LIMIT, AI_SOURCE_TEXT_LIMIT, AI_SOURCE_TITLE_LIMIT,
  KAPSAPP_AI_PATH, KAPSAPP_AI_STATUS_PATH, normalizeMathMarkdown, readJsonLines,
} from "../shared/kapsAppAi";
import type { ChatEvent, ChatMessage, ChatSource, ChatStatusPhase, SourceLabel } from "../shared/kapsAppAi";
import KapsAppAiEquation from "./KapsAppAiEquation";

type Turn = {
  id: number;
  question: string;
  attachedSource?: ChatSource;
  answer: string;
  sources: SourceLabel[];
  state: "waiting" | "streaming" | "done" | "stopped" | "error";
  phase?: ChatStatusPhase;
  requestId?: string;
  queuePosition?: number;
  notice?: string;
};

const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold outline-offset-2 transition-colors";
const secondary = `${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`;
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const MATH_PLUGINS = [remarkMath];

function extractText(children: unknown): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join("");
  return "";
}

const MathMarkdown = memo(function MathMarkdown({
  content,
  streaming = false,
  className,
}: {
  content: string;
  streaming?: boolean;
  className?: string;
}) {
  const normalized = useMemo(() => normalizeMathMarkdown(content, streaming), [content, streaming]);
  return (
    <div className={className}>
      <Markdown
        skipHtml
        remarkPlugins={MATH_PLUGINS}
        components={{
          code: ({ children, className: codeClass }) => {
            const text = extractText(children).replace(/\n$/, "");
            if (codeClass?.split(" ").includes("math-inline") && text) {
              return <KapsAppAiEquation expression={text} />;
            }
            if (codeClass?.split(" ").includes("language-math") && text) {
              return <KapsAppAiEquation expression={text} displayMode />;
            }
            return <code className={codeClass}>{children}</code>;
          },
          pre: ({ node, children }) => {
            const code = node?.children[0];
            if (
              code?.type === "element" &&
              code.tagName === "code" &&
              Array.isArray(code.properties.className) &&
              code.properties.className.includes("language-math")
            ) {
              const raw = code.children
                .map(child => (child.type === "text" ? child.value : ""))
                .join("")
                .trim();
              if (raw) return <KapsAppAiEquation expression={raw} displayMode />;
            }
            return <pre>{children}</pre>;
          },
          img: ({ alt }) => (alt ? <span>{alt}</span> : null),
          a: ({ children }) => <span className="text-indigo-700 dark:text-indigo-300">{children}</span>,
        }}
      >
        {normalized}
      </Markdown>
    </div>
  );
});

const Answer = memo(function Answer({ content, streaming = false }: { content: string; streaming?: boolean }) {
  return (
    <MathMarkdown
      content={content}
      streaming={streaming}
      className="min-w-0 break-words text-[15px] leading-relaxed text-slate-800 dark:text-slate-100 [&_p+p]:mt-3 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-3 [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:list-decimal [&_li]:ml-5 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-3 [&_pre]:text-sm [&_pre]:text-slate-100 [&_p>code]:rounded [&_p>code]:bg-slate-200/70 [&_p>code]:px-1 dark:[&_p>code]:bg-slate-700 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-3"
    />
  );
});

const UserQuestion = memo(function UserQuestion({ content }: { content: string }) {
  const hasMathOrMarkdown = /[$\\`*_#\[~]/.test(content);
  if (!hasMathOrMarkdown) {
    return (
      <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-indigo-50 px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:bg-indigo-950/70 dark:text-white">
        {content}
      </p>
    );
  }
  return (
    <MathMarkdown
      content={content}
      className="min-w-0 break-words rounded-2xl rounded-tr-md bg-indigo-50 px-4 py-3 text-[15px] leading-relaxed text-slate-900 dark:bg-indigo-950/70 dark:text-white [&_p+p]:mt-2.5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-2.5 [&_pre]:text-xs [&_pre]:text-slate-100 [&_.katex-display]:my-1.5 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden"
    />
  );
});

function WaitingStatus({ phase, queuePosition }: { phase?: ChatStatusPhase; queuePosition?: number }) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  let stageTitle = "İstek alındı";
  let stageDetail = "Yanıt hazırlanıyor…";
  if (phase === "queued") {
    stageTitle = queuePosition && queuePosition > 1 ? `Sırada bekleniyor (${queuePosition}. sıra)` : "Sırada bekleniyor";
    stageDetail = "Önceki işlem tamamlandığında yanıt hazırlanıyor…";
  } else if (phase === "loading_model") {
    stageTitle = "Model hazırlanıyor";
    stageDetail = "Yerel model belleğe yükleniyor, yanıt hazırlanıyor…";
  } else if (phase === "processing_prompt") {
    stageTitle = "Sorunuz işleniyor";
    stageDetail = "Matematiksel adımlar ve bağlam inceleniyor, yanıt hazırlanıyor…";
  }

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-1.5 py-0.5 text-sm text-slate-600 dark:text-slate-300">
      <div className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
        <LoaderCircle size={16} className="shrink-0 animate-spin text-indigo-600 dark:text-indigo-400" />
        <span>{stageTitle}</span>
        {elapsedSec >= 3 && (
          <span className="text-xs font-normal tabular-nums text-slate-500 dark:text-slate-400">
            · {elapsedSec} sn
          </span>
        )}
      </div>
      <p className="pl-6 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {stageDetail}
      </p>
    </div>
  );
}

function CopyMessage({ content, label }: { content: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const timeout = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timeout);
  }, [state]);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" aria-label={label} title={label} className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-700" onClick={async () => {
        try {
          await navigator.clipboard.writeText(content);
          setState("copied");
        } catch {
          setState("failed");
        }
      }}>
        {state === "copied" ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <span role="status" className="text-xs text-slate-500 dark:text-slate-400">
        {state === "copied" ? "Kopyalandı" : state === "failed" ? "Kopyalanamadı" : ""}
      </span>
    </div>
  );
}

export default function KapsAppAi({ active = true }: { active?: boolean } = {}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [source, setSource] = useState<ChatSource>({ title: "", text: "" });
  const [jumpVisible, setJumpVisible] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const activeRequest = useRef<{ controller: AbortController; id: number } | null>(null);
  const lastId = useRef(0);
  const current = turns.at(-1);
  const running = current?.state === "waiting" || current?.state === "streaming";
  const hasSource = Boolean(source.title.trim() || source.text.trim());
  const sourceValid = !hasSource || Boolean(source.title.trim() && source.text.trim());

  useEffect(() => () => {
    activeRequest.current?.controller.abort();
    activeRequest.current = null;
  }, []);

  function scrollToBottom() {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }

  useLayoutEffect(() => {
    if (active && stickToBottom.current) scrollToBottom();
  }, [turns, sourceOpen, active]);

  useEffect(() => {
    if (!scroller.current) return;
    const observer = new ResizeObserver(() => {
      if (stickToBottom.current) scrollToBottom();
    });
    observer.observe(scroller.current);
    return () => observer.disconnect();
  }, []);

  function updateTurn(id: number, update: Partial<Turn>) {
    setTurns(previous => previous.map(turn => (turn.id === id ? { ...turn, ...update } : turn)));
  }

  function stop() {
    const request = activeRequest.current;
    if (!request) return;
    activeRequest.current = null;
    request.controller.abort();
    updateTurn(request.id, { state: "stopped", notice: "Yanıt durduruldu." });
  }

  function reset() {
    stop();
    stickToBottom.current = true;
    setTurns([]);
    setDraft("");
    setSource({ title: "", text: "" });
    setSourceOpen(false);
    setJumpVisible(false);
  }

  async function tryRecoverStatus(requestId: string | undefined): Promise<{ answer?: string; done?: boolean; truncated?: boolean; error?: string } | null> {
    if (!requestId) return null;
    try {
      const res = await fetch(getApiUrl(`${KAPSAPP_AI_STATUS_PATH}?requestId=${encodeURIComponent(requestId)}`), {
        headers: getAuthHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.status) return null;
      return {
        answer: typeof data.status.answer === "string" ? data.status.answer : undefined,
        done: data.status.phase === "done",
        truncated: Boolean(data.status.truncated),
        error: typeof data.status.error === "string" ? data.status.error : undefined,
      };
    } catch {
      return null;
    }
  }

  async function executePrompt(question: string, attached: ChatSource | undefined, retryTurnId?: number) {
    if (!question || activeRequest.current) return;

    const id = retryTurnId ?? ++lastId.current;
    const controller = new AbortController();
    activeRequest.current = { id, controller };

    const priorTurns = retryTurnId
      ? turns.slice(0, turns.findIndex(t => t.id === retryTurnId))
      : turns;
    const history = priorTurns.filter(turn => turn.state === "done").slice(-AI_HISTORY_LIMIT / 2);
    const messages: ChatMessage[] = history.flatMap(turn => [
      { role: "user", content: turn.question },
      { role: "assistant", content: turn.answer.slice(0, 6000) },
    ]);
    messages.push({ role: "user", content: question });

    stickToBottom.current = true;
    setJumpVisible(false);
    if (retryTurnId) {
      updateTurn(id, {
        answer: "",
        sources: [],
        state: "waiting",
        phase: "accepted",
        notice: undefined,
      });
    } else {
      setTurns(previous => [
        ...previous,
        { id, question, attachedSource: attached, answer: "", sources: [], state: "waiting", phase: "accepted" },
      ]);
    }

    let answer = "";
    let trackedRequestId: string | undefined;
    let frame = 0;
    let timedOut = false;
    const onTimeout = () => {
      timedOut = true;
      controller.abort();
    };
    // Initial connection + first frame timeout; refreshed by heartbeats and token deltas.
    let timeout = setTimeout(onTimeout, 240_000);
    try {
      const response = await fetch(getApiUrl(KAPSAPP_AI_PATH), {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ messages, source: attached }),
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || data.error || "KapsAI şu anda kullanılamıyor. Tekrar dene.");
      }
      const headerRequestId = response.headers.get("X-KapsAI-Request-Id") ?? undefined;
      if (headerRequestId) trackedRequestId = headerRequestId;
      if (!response.body || !response.headers.get("Content-Type")?.includes("application/x-ndjson")) {
        throw new Error("Sohbet bağlantısı başlatılamadı. Tekrar dene.");
      }
      for await (const event of readJsonLines<ChatEvent>(response.body)) {
        if (controller.signal.aborted) break;
        // Heartbeats keep the transport alive. The server separately watches model stages and tokens.
        clearTimeout(timeout);
        timeout = setTimeout(onTimeout, 45_000);

        if (event.type === "status") {
          if (event.requestId) trackedRequestId = event.requestId;
          // Heartbeat keeps transport alive without overriding the current model stage or faking token output.
          if (event.phase && event.phase !== "heartbeat") {
            updateTurn(id, {
              phase: event.phase,
              requestId: trackedRequestId,
              queuePosition: event.queuePosition,
            });
          }
        }
        if (event.type === "sources") updateTurn(id, { sources: event.sources });
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "delta") {
          answer += event.text;
          if (!frame) {
            frame = requestAnimationFrame(() => {
              frame = 0;
              if (!controller.signal.aborted) updateTurn(id, { answer, state: "streaming" });
            });
          }
        }
        if (event.type === "done") {
          updateTurn(id, {
            answer,
            state: "done",
            notice: event.truncated ? "Model burada durdu. Devam etmesini isteyebilirsin." : undefined,
          });
          return;
        }
      }
      throw new Error("Bağlantı yanıt tamamlanmadan kesildi. Tekrar dene.");
    } catch (error) {
      if (timedOut || !controller.signal.aborted) {
        // Attempt status recovery if the stream dropped mid-flight after server accepted the request.
        if (!timedOut && trackedRequestId) {
          const recovered = await tryRecoverStatus(trackedRequestId);
          if (recovered?.answer && recovered.answer.length > answer.length) {
            answer = recovered.answer;
          }
          if (recovered?.done && answer) {
            updateTurn(id, {
              answer,
              state: "done",
              notice: recovered.truncated ? "Model burada durdu. Devam etmesini isteyebilirsin." : undefined,
            });
            return;
          }
        }

        let notice = "Sohbet bağlantısı kesildi. Tekrar dene.";
        if (error instanceof Error && !(error instanceof TypeError || error instanceof SyntaxError)) notice = error.message;
        if (timedOut) notice = "Sohbet bağlantısı zaman aşımına uğradı. Tekrar dene.";
        updateTurn(id, { answer, state: "error", notice });
        if (!answer && !retryTurnId) {
          setDraft(previous => previous || question);
          if (attached) {
            setSource(previous => (previous.title || previous.text ? previous : attached));
            setSourceOpen(true);
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      cancelAnimationFrame(frame);
      if (activeRequest.current?.id === id) activeRequest.current = null;
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const question = draft.trim();
    if (!question || !sourceValid || activeRequest.current) return;
    const attached = hasSource ? { title: source.title.trim(), text: source.text.trim() } : undefined;
    setDraft("");
    setSource({ title: "", text: "" });
    setSourceOpen(false);
    await executePrompt(question, attached);
  }

  return (
    <section hidden={!active} aria-label="KapsAI" className="relative isolate flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-slate-950">
      <header className="shrink-0 border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-3 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><Sparkles size={18} /></span>
            <div className="min-w-0">
              <h2 className="sr-only truncate text-sm font-bold text-slate-900 lg:not-sr-only dark:text-white">KapsAI</h2>
              <p className="truncate text-xs font-semibold text-slate-600 lg:font-normal dark:text-slate-400">Llama 3.2 · Yerel model</p>
            </div>
          </div>
          <button type="button" className={`${secondary} shrink-0`} onClick={reset}>
            <Plus size={16} /> Yeni sohbet
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div ref={scroller} aria-label="Sohbet mesajları" tabIndex={0} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain outline-offset-[-2px] [overflow-anchor:none]" onScroll={event => {
          const el = event.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setJumpVisible(!stickToBottom.current);
        }}>
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-3 py-5 sm:px-6 sm:py-8">
            {!turns.length && (
              <div className="m-auto max-w-sm text-center">
                <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><Sparkles size={28} /></span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Bugün ne konuşalım?</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">İnternet araması kapalı. Soruna ilgili bir kaynak metni veya LaTeX matematik ifadeleri ekleyebilirsin.</p>
              </div>
            )}
            {turns.map(turn => (
              <div key={turn.id} className="mb-5 flex min-w-0 flex-col gap-2.5 sm:mb-7">
                <article aria-label="Senin mesajın" className="min-w-0 max-w-[92%] self-end sm:max-w-[80%]">
                  <UserQuestion content={turn.question} />
                  <div className="flex justify-end"><CopyMessage content={turn.question} label="Mesajı kopyala" /></div>
                </article>
                <article aria-label="KapsAI yanıtı" className="flex min-w-0 items-start gap-2 sm:gap-3">
                  <span className="mt-1 grid size-8 shrink-0 place-items-center rounded-xl border border-indigo-100 text-indigo-700 dark:border-indigo-900 dark:text-indigo-300"><Sparkles size={16} /></span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-4">
                    {turn.state === "waiting" && (
                      <WaitingStatus phase={turn.phase} queuePosition={turn.queuePosition} />
                    )}
                    {turn.answer && <Answer content={turn.answer} streaming={turn.state === "streaming"} />}
                    {turn.notice && <p role={turn.state === "error" ? "alert" : "status"} className={`text-sm ${turn.answer ? "mt-2" : ""} ${turn.state === "error" ? "text-rose-700 dark:text-rose-300" : "text-slate-500 dark:text-slate-400"}`}>{turn.notice}</p>}
                    {turn.sources.length > 0 && (
                      <div className="mt-3 break-words border-t border-slate-200 pt-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                        <p className="font-semibold">Eklediğin kaynak</p>
                        <ul className="mt-1">{turn.sources.map(item => <li key={item.id}>[{item.id}] {item.title}</li>)}</ul>
                      </div>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {turn.answer && turn.state !== "streaming" && <CopyMessage content={turn.answer} label="Yanıtı kopyala" />}
                      {(turn.state === "error" || turn.state === "stopped") && !running && (
                        <button
                          type="button"
                          aria-label="Yanıtı yeniden dene"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          onClick={() => void executePrompt(turn.question, turn.attachedSource, turn.id)}
                        >
                          <RotateCcw size={13} /> Yeniden dene
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
        {jumpVisible && <button type="button" className={`${secondary} absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap shadow-sm`} onClick={() => {
          stickToBottom.current = true;
          scrollToBottom();
          setJumpVisible(false);
        }}><ChevronDown size={16} /> En alta git</button>}
      </div>

      <form onSubmit={send} className="kaps-chat-composer shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto w-full max-w-4xl px-3 pb-2 pt-2 sm:px-6 sm:py-3">
          {sourceOpen && (
            <div id="kaps-ai-source" className="mb-2 max-h-[28dvh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-950">
              <input className={field} data-chat-composer aria-label="Kaynak başlığı" placeholder="Kaynak başlığı" maxLength={AI_SOURCE_TITLE_LIMIT} value={source.title} onChange={event => setSource({ ...source, title: event.target.value })} />
              <textarea className={`${field} block resize-none`} aria-label="Kaynak metni" placeholder="İlgili kaynak metnini yapıştır" rows={2} maxLength={AI_SOURCE_TEXT_LIMIT} value={source.text} onChange={event => setSource({ ...source, text: event.target.value })} />
            </div>
          )}
          <div className="flex items-end gap-2">
            <button type="button" aria-expanded={sourceOpen} aria-controls={sourceOpen ? "kaps-ai-source" : undefined} aria-label="Kaynak ekle" title="Kaynak ekle" className={`${secondary} size-11 shrink-0 !px-0 ${hasSource ? "border-indigo-500 text-indigo-700 dark:text-indigo-300" : ""}`} onClick={() => setSourceOpen(open => !open)}>
              <FileText size={19} />
            </button>
            <textarea data-chat-composer aria-label="Mesaj yaz" className={`${field} max-h-40 min-h-11 resize-none overflow-y-auto leading-6`}
              rows={Math.min(5, Math.max(1, draft.split("\n").length))}
              maxLength={AI_MESSAGE_LIMIT}
              enterKeyHint="send"
              placeholder="Mesaj veya matematik sorusu yaz…"
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => {
                if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                event.preventDefault();
                void send();
              }}
            />
            {running ? (
              <button type="button" className={`${secondary} size-11 shrink-0 !px-0`} onClick={stop} aria-label="Yanıtı durdur" title="Yanıtı durdur"><Square size={17} fill="currentColor" /></button>
            ) : (
              <button type="submit" className={`${button} size-11 shrink-0 !px-0 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-45`} disabled={!draft.trim() || !sourceValid} aria-label="Mesajı gönder" title="Mesajı gönder"><ArrowUp size={21} /></button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            {sourceValid ? "Sohbet bu oturumda geçicidir; LaTeX ($...$, $$...$$, \\(...\\), \\[...\\]) desteklenir." : "Kaynak için hem başlık hem metin gir."}
          </p>
        </div>
      </form>
    </section>
  );
}
