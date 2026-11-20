import ActivityInput from './ActivityInput';
import { activities, activityLabel, studyLevels, type StudyDirection } from '../../shared/germanActivities';
import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  ArrowLeft,
  Play,
  Settings,
  RefreshCw,
  Check,
  Headphones,
  Mic,
  PenLine,
  Search,
  Loader2,
} from "lucide-react";
import { getApiUrl, getAuthHeaders } from "../../utils/api";
import "./german.css";
async function request(path: string, data?: unknown) {
  let r: Response;
  try {
    r = await fetch(getApiUrl("/api/kaps-german" + path), {
      method: data === undefined ? "GET" : "POST",
      headers: getAuthHeaders(
        data === undefined ? undefined : { "Content-Type": "application/json" },
      ),
      body: data === undefined ? undefined : JSON.stringify(data),
      cache: "no-store",
      keepalive: data !== undefined,
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new Error("Bağlantı kurulamadı. Açık taslağını koruyup tekrar dene.");
  }
  if (!r.ok) {
    const v = await r.json().catch(() => null);
    throw new Error(
      v?.error ??
        (r.status === 403
          ? "Kaps German erişimin bulunmuyor."
          : "İşlem tamamlanamadı; oturumunu kontrol et."),
    );
  }
  return r.json();
}
const tabs = [
  ["overview", "Genel Bakış"],
  ["words", "Kelimeler"],
  ["practice", "Alıştırmalar"],
  ["goethe", "Goethe B1 Hazırlık"],
  ["history", "İstatistikler"],
  ["admin", "Ayarlar"],
];
const states: Record<string, string> = {
  new: "Yeni",
  learning: "Öğreniliyor",
  improving: "Gelişiyor",
  strong: "Güçlü",
  mastered: "Tam öğrenilmiş",
  needs_review: "Tekrar gerekli",
};
export default function KapsGerman() {
  const loc = useLocation(),
    navigate = useNavigate(),
    tab = new URLSearchParams(loc.search).get("tab") || "overview",
    sessionId = new URLSearchParams(loc.search).get("session");
  const [access, setAccess] = useState<{ admin: boolean } | null>(null),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all");
  const [session, setSession] = useState<any>(null),
    [answers, setAnswers] = useState<Record<string, string>>({}),
    [index, setIndex] = useState(0),
    [users, setUsers] = useState<any[]>([]),
    [now, setNow] = useState(Date.now());
  const [speech, setSpeech] = useState(""),
    [feedback, setFeedback] = useState<any>(null);
  const [direction, setDirection] = useState<StudyDirection>("tr_de");
  const [levels, setLevels] = useState<string[]>(["A1", "A2", "B1", "B2", "C1"]);
  const sessionRef = useRef<any>(null);
  const autoSaved = useRef("");
  const answerRef = useRef(answers);
  answerRef.current = answers;
  const expired = useRef("");
  const actionLock = useRef(false);
  const [reloadSession, setReloadSession] = useState(0);
  const [clockOffset, setClockOffset] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const input = useRef<HTMLTextAreaElement>(null),
    saveQueue = useRef(Promise.resolve());
  const refresh = useCallback(async () => {
    const r = await request("/overview");
    setData(r);
  }, []);
  useEffect(() => {
    let alive = true;
    request("/access")
      .then((a) => {
        if (alive) {
          setAccess(a);
          void refresh().catch((e) => setError(e.message));
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      alive = false;
    };
  }, [refresh]);
  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      return;
    }
    let alive = true;
    setSession(null);
    sessionRef.current = null;
    let initial = true;
    const load = () =>
      request("/sessions/" + sessionId)
        .then((s) => {
          if (!alive) return;
          sessionRef.current = s;
          setSession(s);
          setClockOffset(Date.parse(s.serverNow) - Date.now());
          if (initial) { setIndex(s.position ?? 0); initial = false; }
          setAnswers((old) => ({ ...s.answers, ...old }));
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    void load();
    const t = setInterval(() => {
      if (!document.hidden && sessionRef.current?.state !== "active")
        void load();
    }, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sessionId, reloadSession]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const go = (next: string) => {
    setFeedback(null);
    void action(async () => {
      if (session?.state === "active") await save(true);
      navigate("/dersler/kaps-german?tab=" + next);
    });
  };
  const action = async (fn: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const start = (module = "vocabulary", mode = "practice", activity = "mixed") =>
    void action(async () => {
      if (module === "vocabulary" && !levels.length) throw new Error("En az bir seviye seç.");
      const r = await request("/sessions", { module, mode, activity, direction, levels });
      if (session?.state === "active") await save(true);
      setSession(null);
      setAnswers({});
      setFeedback(null);
      setSaveStatus("");
      setReloadSession(n => n + 1);
      navigate(
        "/dersler/kaps-german?tab=" +
          (module === "vocabulary" ? "practice" : "goethe") +
          "&session=" +
          r.id,
      );
    });
  const save = async (draft = false, nextIndex = index) => {
    if (!session || session.state !== "active") return;
    const targetId = session.id, task = session.tasks[index];
    const run = async () => {
      setSaveStatus("Kaydediliyor…");
      const current = sessionRef.current;
      if (!current || current.id !== targetId || current.state !== "active") return;
      const answer = answerRef.current[task.id] ?? "";
      const result = await request("/sessions/" + targetId + "/answer", {
        draft, taskId: task.id, answer, version: current.version,
        positionTaskId: session.tasks[nextIndex]?.id ?? task.id,
      });
      const updated = await request("/sessions/" + targetId);
      if (sessionRef.current?.id !== targetId) return;
      sessionRef.current = updated;
      setSession(updated);
      setSaveStatus("Kaydedildi");
      if (draft && (answerRef.current[task.id] ?? "") !== answer) await run();
      if (!draft) setFeedback(result.feedback ?? updated.results?.[task.id] ?? null);
    };
    const job = saveQueue.current.catch(() => {}).then(run);
    saveQueue.current = job;
    try { await job; } catch (error) { setSaveStatus("Kaydedilemedi. Bağlantını kontrol edip tekrar kaydet."); throw error; }
  };
  useEffect(() => {
    if (
      !session ||
      session.id !== sessionId ||
      session.state !== "active" ||
      busy
    )
      return;
    const task = session.tasks[index];
    if (!task) return;
    const value = answers[task.id];
    const identity = session.id + ":" + task.id + ":" + value;
    if (
      value === undefined ||
      value === session.answers[task.id] ||
      identity === autoSaved.current
    )
      return;
    const timer = setTimeout(() => {
      autoSaved.current = identity;
      void action(() => save(true));
    }, 1000);
    return () => clearTimeout(timer);
  }, [answers, index, session, busy, sessionId]);
  useEffect(() => {
    if (
      !session ||
      session.state !== "active" ||
      session.mode !== "exam" ||
      busy ||
      session.id !== sessionId ||
      Date.parse(session.deadline) > now + clockOffset ||
      expired.current === session.id
    )
      return;
    expired.current = session.id;
    void action(async () => {
      await request("/sessions/" + session.id + "/submit", {});
      setSession(await request("/sessions/" + session.id));
    });
  }, [now, session]);
  const submit = () =>
    void action(async () => {
      if (session.mode === "practice" || Date.parse(session.deadline) > Date.now() + clockOffset) await save(true);
      if (
        !confirm(
          "Bu oturumu tamamlayıp değerlendirmeye göndermek istiyor musun?",
        )
      )
        return;
      await request("/sessions/" + session.id + "/submit", {});
      setSession(await request("/sessions/" + session.id));
      await refresh();
    });
  useEffect(() => {
    const reconnect = () => { autoSaved.current = ""; setReloadSession(n => n + 1); };
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, []);
  useEffect(() => {
    const background = () => {
      if (document.hidden && session?.state === "active") void save(true).catch(() => {});
    };
    document.addEventListener("visibilitychange", background);
    return () => document.removeEventListener("visibilitychange", background);
  }, [session, index]);
  const words = data?.words ?? [],
    sessions = data?.sessions ?? [],
    learned = words.filter((w: any) => w.memory.attempts > 0),
    due = words.filter(
      (w: any) =>
        w.active && w.memory.attempts > 0 && Date.parse(w.memory.due) <= now,
    );
  const done = sessions.filter((s: any) => s.state === "done"),
    results = done
      .filter((s: any) => s.module === "vocabulary")
      .flatMap((s: any) => Object.values(s.results) as any[])
      .filter((r: any) => r.score !== null);
  const count = (status: string) =>
    words.filter((w: any) => w.active && w.memory.state === status).length;
  if (!access)
    return (
      <div className="kg kg-empty">
        <BookOpen />
        <h1>Kaps German</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Erişim doğrulanıyor…"}
        </p>
        <Link to="/dersler">Derslere dön</Link>
      </div>
    );
  return (
    <div className="kg">
      <div className="kg-scroll">
        <header className="kg-header">
          <Link to="/dersler">
            <ArrowLeft size={16} />
            Dersler
          </Link>
          <strong>
            Kaps <em>German</em>
          </strong>
          <span>B1 · kişisel öğrenme</span>
        </header>
        <section className="kg-hero">
          <p>DÜZENLİ ÇALIŞ. KALICI ÖĞREN.</p>
          <h1>
            Almancan, senin
            <br />
            <em>kelimelerinle gelişsin.</em>
          </h1>
          <p>
            Google Docs’taki ders notlarından kişisel tekrarına, tek bir çalışma
            alanı.
          </p>
          <button onClick={() => start()} disabled={busy}>
            <Play size={17} />
            Çalışmaya Başla
          </button>
        </section>
        <nav aria-label="Kaps German bölümleri">
          {tabs
            .filter(([id]) => id !== "admin" || access.admin)
            .map(([id, label]) => (
              <button
                key={id}
                disabled={busy}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => go(id)}
              >
                {label}
              </button>
            ))}
        </nav>
        <main>
          {error && (
            <p className="kg-error" role="alert">
              {error}
            </p>
          )}
          {sessionId && (!session || session.id !== sessionId) ? <section className="kg-card"><p role="status">{error ? "Çalışman açılamadı. Kaydedilmiş yanıtların korunuyor." : "Çalışman yükleniyor…"}</p>{error && <><button disabled={busy} onClick={() => {setError("");setReloadSession(n => n + 1);}}>Tekrar dene</button><button onClick={() => go("practice")}>Alıştırmalara dön</button></>}</section> : session ? (
            <>
              <div className="kg-section">
                <h2>
                  {session.module === "vocabulary"
                    ? "Günlük çalışma"
                    : session.module + " · Goethe tarzı çalışma"}
                </h2>
                <span>
                  {session.mode === "practice" ? "Süresiz çalışma" : Math.max(0, Math.ceil((Date.parse(session.deadline) - now - clockOffset) / 60000)) + " dk"} ·{" "}
                  {session.mode === "exam" ? "Sınav modu" : "Alıştırma modu"}
                </span>
              </div>
              {session.module !== "vocabulary" && (
                <p className="kg-note">
                  AI tarafından üretilmiş alıştırmadır. Resmî Goethe sorusu veya
                  resmî sınav sonucu değildir.
                </p>
              )}
              {session.state === "active" ? (
                <section className="kg-card kg-task">
                  <p>
                    {index + 1} / {session.tasks.length} ·{" "}
                    {activityLabel(session.tasks[index]?.type)}
                  </p>
                  <div className="kg-progress">
                    <i
                      style={{
                        width: ((index + 1) / session.tasks.length) * 100 + "%",
                      }}
                    />
                  </div>
                  <p className="kg-passage" lang="de">
                    {session.tasks[index]?.passage}
                  </p>
                  <h2 lang="de">{session.tasks[index]?.prompt}</h2>
                  <ActivityInput key={session.tasks[index].id} task={session.tasks[index]} value={answers[session.tasks[index].id] ?? ""} disabled={false} onChange={value => { setFeedback(null); setAnswers(a => ({ ...a, [session.tasks[index].id]: value })); }} />
                  {session.module === "Sprechen" && (
                    <>
                      <p className="kg-note">
                        Metin tabanlı konuşma provası. Ses ve telaffuz puanı
                        verilmez. Tarayıcı destekliyorsa Almanca dikteyi
                        kullanabilir, transkripti gönderilmeden önce
                        düzeltebilirsin.
                      </p>
                      <button
                        onClick={() => {
                          const Recognition =
                            (window as any).SpeechRecognition ||
                            (window as any).webkitSpeechRecognition;
                          if (!Recognition) {
                            setSpeech(
                              "Bu tarayıcıda konuşma tanıma desteklenmiyor.",
                            );
                            return;
                          }
                          if (
                            !confirm(
                              "Tarayıcının konuşma tanıma hizmeti sesini işleyebilir. Almanca dikteyi başlat?",
                            )
                          )
                            return;
                          const r = new Recognition();
                          r.lang = "de-DE";
                          r.onresult = (e: any) =>
                            setAnswers((a) => ({
                              ...a,
                              [session.tasks[index].id]:
                                e.results[0][0].transcript,
                            }));
                          r.onerror = () =>
                            setSpeech(
                              "Ses tanınamadı. Metinle devam edebilirsin.",
                            );
                          r.start();
                        }}
                      >
                        <Mic size={16} />
                        Almanca dikte
                      </button>
                      <p role="status">{speech}</p>
                    </>
                  )}
                  <p role="status" aria-live="polite">{saveStatus}</p>
                  <div className="kg-actions">
                    <button disabled={busy} onClick={() => go(session.module === "vocabulary" ? "practice" : "goethe")}>Kaydet ve çık</button>
                    <button disabled={busy} onClick={() => void action(() => save())}>
                      Yanıtı kontrol et
                    </button>
                    <button
                      disabled={busy || index === 0}
                      onClick={() =>
                        void action(async () => {
                          await save(true, Math.max(0, index - 1));
                          setIndex((i) => Math.max(0, i - 1));
                          setFeedback(null);
                        })
                      }
                    >
                      Önceki
                    </button>
                    <button
                      disabled={busy || index === session.tasks.length - 1}
                      onClick={() =>
                        void action(async () => {
                          await save(true, index + 1);
                          setIndex((i) => i + 1);
                          setFeedback(null);
                        })
                      }
                    >
                      Sonraki
                    </button>
                    <button disabled={busy} onClick={submit}>
                      Oturumu tamamla
                    </button>
                  </div>
                  {feedback && session.mode === "practice" && (
                    <p className={`kg-feedback ${feedback.score === 1 ? "kg-success" : ""}`} role="status">
                      <strong>{feedback.score === 1 ? "Harika, doğru! " : "Bir kez daha düşün. "}</strong>{feedback.feedback}
                    </p>
                  )}
                  <p className="kg-note">
                    Yazmayı bıraktıktan sonra, sorudan ayrılırken veya “Yanıtı
                    kaydet” ile sunucuya kaydedilir. Kaydedilmemiş metin bu açık
                    pencerede kalır.
                  </p>
                </section>
              ) : session.state === "grading" ? (
                <section className="kg-card">
                  <Loader2 />
                  <h3>Yanıtların değerlendiriliyor</h3>
                  <p>Bu sayfadan çıksan da kaydedilmiş yanıtlar korunur.</p>
                </section>
              ) : (
                <>
                  <h2>Oturum sonuçları</h2>
                  {session.tasks.map((t: any) => (
                    <section className="kg-card" key={t.id}>
                      <h3>{t.prompt}</h3>
                      <p className="kg-note">Senin yanıtın</p>
                      <p className="kg-passage">
                        {session.answers[t.id] || "Yanıt yok"}
                      </p>
                      <strong>
                        {session.results[t.id]?.score === null
                          ? "Değerlendirme bekliyor"
                          : Math.round(
                              (session.results[t.id]?.score ?? 0) * 100,
                            ) + " / 100"}
                      </strong>
                      <p>{session.results[t.id]?.feedback}</p>
                      <p>{session.results[t.id]?.suggestedAnswer}</p>
                      {session.results[t.id]?.pending && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(async () => {
                              await request(
                                "/sessions/" + session.id + "/retry",
                                {},
                              );
                              setSession(
                                await request("/sessions/" + session.id),
                              );
                            })
                          }
                        >
                          Cevabı Yeniden Değerlendir
                        </button>
                      )}
                      <p className="kg-note">
                        Bu çalışmada kullanılan kelimeler ·{" "}
                        {t.vocabularyIds
                          .map(
                            (id: string) =>
                              words.find((w: any) => w.id === id)?.de,
                          )
                          .filter(Boolean)
                          .join(", ")}
                        . Karşılaşmak, kelimenin tam öğrenildiğini göstermez.
                      </p>
                    </section>
                  ))}
                  <button
                    onClick={() => {
                      setSession(null);
                      navigate("/dersler/kaps-german?tab=history");
                    }}
                  >
                    Geçmişe dön
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {(tab === "overview" || tab === "history") && (
                <>
                  <div className="kg-metrics">
                    {[
                      [
                        "Toplam kelime",
                        words.filter((w: any) => w.active).length,
                      ],
                      ["Çalışılan", learned.length],
                      ["Tam öğrenilmiş", count("mastered")],
                      ["Gelişen", count("improving")],
                      ["Tekrar bekleyen", due.length],
                      [
                        "Kelime doğruluğu",
                        results.length
                          ? Math.round(
                              (results.reduce(
                                (a: number, r: any) => a + r.score,
                                0,
                              ) /
                                results.length) *
                                100,
                            ) + "%"
                          : "Henüz veri yok",
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="kg-grid">
                    <section className="kg-card">
                      <h2>Bugünkü çalışma planın</h2>
                      <p>
                        {due.length} tekrar zamanı gelen kelime. Yeni ifadeler
                        ve zorlandıkların birlikte seçilir.
                      </p>
                      <button onClick={() => start()}>
                        Günlük çalışmayı başlat
                      </button>
                    </section>
                    <section className="kg-card">
                      <h2>Öğrenme dağılımı</h2>
                      {Object.entries(states).map(([id, label]) => (
                        <div className="kg-bar" key={id}>
                          <span>{label}</span>
                          <i
                            style={{
                              width:
                                Math.max(
                                  1,
                                  (count(id) / Math.max(1, words.length)) * 100,
                                ) + "%",
                            }}
                          />
                          <strong>{count(id)}</strong>
                        </div>
                      ))}
                      <p className="kg-note">
                        SM-2’den uyarlanan tekrar aralıkları. Kalibre edilmiş
                        unutma olasılığı veya resmî sınav hazırlık yüzdesi
                        hesaplanmaz.
                      </p>
                    </section>
                  </div>
                </>
              )}
              {tab === "words" && (
                <>
                  <div className="kg-section">
                    <h2>Kelime koleksiyonun</h2>
                    <input
                      aria-label="Kelimelerde ara"
                      placeholder="Almanca, Türkçe veya konu…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <select
                      aria-label="Öğrenme durumu"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">Tüm durumlar</option>
                      {Object.entries(states).map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {words
                    .filter(
                      (w: any) =>
                        (filter === "all" || w.memory.state === filter) &&
                        [w.de, w.tr, w.topic]
                          .join(" ")
                          .toLocaleLowerCase("tr")
                          .includes(query.toLocaleLowerCase("tr")),
                    )
                    .map((w: any) => (
                      <details className="kg-card" key={w.id}>
                        <summary>
                          <strong lang="de">{w.de}</strong>
                          <span>{w.tr}</span>
                          <small>
                            {states[w.memory.state]}
                            {!w.active && " · kaynakta kaldırılmış"}
                          </small>
                        </summary>
                        <p>
                          {w.topic} · {w.level} · {w.grammar}
                        </p>
                        <p>
                          {w.memory.correct}/{w.memory.attempts} doğru · Sonraki
                          tekrar{" "}
                          {w.memory.attempts
                            ? new Date(w.memory.due).toLocaleDateString("tr-TR")
                            : "İlk çalışma bekleniyor"}
                        </p>
                        <p className="kg-note">{w.raw}</p>
                      </details>
                    ))}
                </>
              )}
              {tab === "practice" && (
                <section className="kg-card">
                  <div className="kg-section"><div><p className="kg-note">KENDİ KELİMELERİN. YENİ MEYDAN OKUMALAR.</p><h2>Bugün nasıl öğrenmek istersin?</h2></div><button onClick={() => start()} disabled={busy}>Karışık çalışmaya başla →</button></div>
                  <div className="kg-study-filters">
                    <label>Soru yönü<select aria-label="Soru yönü" value={direction} onChange={e => setDirection(e.target.value as StudyDirection)}><option value="de_tr">Almanca → Türkçe</option><option value="tr_de">Türkçe → Almanca</option><option value="mixed">İki yön karışık</option></select></label>
                    <fieldset><legend>Çalışma seviyeleri · birden fazla seçebilirsin</legend><div className="kg-levels">{studyLevels.map(level => <label key={level}><input type="checkbox" checked={levels.includes(level)} onChange={e => setLevels(old => e.target.checked ? [...old, level] : old.filter(l => l !== level))} />{level}</label>)}</div></fieldset>
                  </div>
                  {!levels.length && <p role="alert">Başlamak için en az bir seviye seç.</p>}
                  <p className="kg-note">Dil yönü anlam kartlarına ve çevirilere uygulanır. Artikel, yazım ve cümle kurma Almanca çalışılır. Seviye seçimi soru kaynağını ve seçenekleri sınırlar. Açık turun varsa mevcut ayarlarıyla devam eder.</p>
                  <p>10 soruluk turlar · İlerlemen kaydedilir · Hız baskısı yok</p>
                  <div className="kg-activity-grid">{activities.map(([id, title, description, icon]) => <button className="kg-activity-card" key={id} disabled={busy} onClick={() => start("vocabulary", "practice", id)}><span className="kg-activity-icon">{icon}</span><strong>{title}</strong><span>{description}</span><small>Çalışmaya başla →</small></button>)}</div>
                  <p className="kg-note">Artikel için artikelli isim, sıralama için en az üç kelimelik ifade, çoklu seçim için / ile ayrılmış birden fazla anlam gerekir. Kart oyunları en az üç farklı kelimeyle açılır. Devam eden turun varsa önce o açılır.</p>
                </section>
              )}
              {tab === "goethe" && (
                <>
                  <div className="kg-section">
                    <h2>Goethe B1 Hazırlık</h2>
                    <span>Bağımsız sınav çalışma geçmişi</span>
                  </div>
                  <p className="kg-note">
                    AI üretimi Goethe tarzı pratik · Resmî soru değildir. Tam
                    deneme ancak doğrulanmış tüm görev türleri mevcutsa açılır.
                  </p>
                  <div className="kg-grid">
                    {[
                      ["Lesen", BookOpen],
                      ["Hören", Headphones],
                      ["Schreiben", PenLine],
                      ["Sprechen", Mic],
                    ].map(([module, Icon]: any) => {
                      const history = done.filter(
                          (s: any) => s.module === module,
                        ),
                        scores = history
                          .flatMap(
                            (s: any) => Object.values(s.results) as any[],
                          )
                          .filter((r: any) => r.score !== null);
                      return (
                        <section className="kg-card kg-exam" key={module}>
                          <Icon size={27} />
                          <h2>{module}</h2>
                          <p>
                            {data?.examStructure[module]?.minutes} dakika ·{" "}
                            {history.length} tamamlanan oturum
                          </p>
                          <strong>
                            {scores.length
                              ? Math.round(
                                  (scores.reduce(
                                    (s: number, r: any) => s + r.score,
                                    0,
                                  ) /
                                    scores.length) *
                                    100,
                                ) + " / 100 çalışma ortalaması"
                              : "Henüz değerlendirilmiş çalışma yok"}
                          </strong>
                          <p className="kg-note">
                            {module === "Hören"
                              ? "Ses sağlayıcısı bekleniyor."
                              : module === "Sprechen"
                                ? "Metin ve desteklenen tarayıcılarda dikte provası."
                                : "Kendi kelimelerinden hazırlanmış görevler."}
                          </p>
                          <div className="kg-actions">
                            <button
                              disabled={busy || module === "Hören"}
                              onClick={() => start(module)}
                            >
                              Bölüm Bazlı Çalış
                            </button>
                            <button
                              disabled={busy || module === "Hören"}
                              onClick={() => start(module, "exam")}
                            >
                              Bölüm denemesi
                            </button>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </>
              )}
              {(tab === "history" ||
                tab === "goethe" ||
                tab === "overview") && (
                <section className="kg-card">
                  <h2>
                    {tab === "goethe"
                      ? "Önceki Goethe çalışmalarım"
                      : "Çalışma geçmişim"}
                  </h2>
                  {sessions
                    .filter(
                      (s: any) => tab !== "goethe" || s.module !== "vocabulary",
                    )
                    .map((s: any) => (
                      <button
                        className="kg-history"
                        key={s.id}
                        onClick={() => {
                          setAnswers({});
                          setIndex(0);
                          navigate(
                            "/dersler/kaps-german?tab=" +
                              (s.module === "vocabulary"
                                ? "practice"
                                : "goethe") +
                              "&session=" +
                              s.id,
                          );
                        }}
                      >
                        <span>
                          {s.module === "vocabulary"
                            ? "Kelime çalışması"
                            : s.module}{" "}
                          · {new Date(s.started_at).toLocaleString("tr-TR")}
                        </span>
                        <strong>
                          {s.state === "done"
                            ? "Sonuçları incele"
                            : s.state === "grading"
                              ? "Değerlendiriliyor"
                              : "Devam et"}
                        </strong>
                      </button>
                    ))}
                  {!sessions.length && (
                    <p>İlk çalışmandan sonra ilerlemen burada görünür.</p>
                  )}
                </section>
              )}
              {tab === "admin" && access.admin && (
                <>
                  <section className="kg-card">
                    <h2>Google Docs bağlantısı</h2>
                    <a
                      href="https://docs.google.com/document/d/1-1DJxTHV2ebDKB0GpI49XEl-rqfxbLvGo-pFJOD_UvU/edit"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Ders belgesini aç ↗
                    </a>
                    <p>
                      Önerilen giriş · der Apfel — elma. İki sütunlu tablolar,
                      konu başlıkları ve A1–C1 seviye başlıkları okunur.
                      Belirsiz satırlar inceleme için korunur.
                    </p>
                    <div className="kg-actions">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            const r = await request("/admin/google/start", {});
                            window.location.assign(r.url);
                          })
                        }
                      >
                        Google’a bağlan
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await request("/admin/sync", {});
                            await refresh();
                          })
                        }
                      >
                        <RefreshCw size={16} />
                        Şimdi Senkronize Et
                      </button>
                    </div>
                    <p className="kg-note">
                      Her gün 03.00 Europe/Istanbul. Google bağlantısı ve AI
                      model ayarları sunucuda yapılandırılır. Fiyat veya
                      ücretsiz kota garantisi verilmez.
                    </p>
                    {data?.jobs.map((j: any) => (
                      <details key={j.id}>
                        <summary>
                          {j.started_at} · {j.status}
                        </summary>
                        <pre>{j.summary}</pre>
                      </details>
                    ))}
                  </section>
                  <section className="kg-card">
                    <h2>Erişim yönetimi</h2>
                    <input
                      aria-label="Kullanıcı ara"
                      placeholder="Kullanıcı adı"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button
                      onClick={() =>
                        void action(async () =>
                          setUsers(
                            await request(
                              "/admin/users?q=" + encodeURIComponent(query),
                            ),
                          ),
                        )
                      }
                    >
                      Ara
                    </button>
                    {users.map((u) => (
                      <label className="kg-history" key={u.id}>
                        {u.username} · ID {u.id}
                        <input
                          aria-label={u.username + " Kaps German erişimi"}
                          type="checkbox"
                          checked={u.id === 1 || !!u.enabled}
                          disabled={u.id === 1 || busy}
                          onChange={(e) =>
                            void action(async () => {
                              await request("/admin/access", {
                                userId: u.id,
                                enabled: e.target.checked,
                              });
                              setUsers(
                                await request(
                                  "/admin/users?q=" + encodeURIComponent(query),
                                ),
                              );
                            })
                          }
                        />
                      </label>
                    ))}
                  </section>
                </>
              )}
              {!words.length && (
                <section className="kg-card kg-empty">
                  <BookOpen size={35} />
                  <h2>Kelimelerinle başlayalım.</h2>
                  <p>
                    Belge henüz boşsa burada örnek öğrenme istatistikleri
                    üretilmez. Google bağlantısından sonra ilk ifadelerini
                    ekleyip eşitle.
                  </p>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
