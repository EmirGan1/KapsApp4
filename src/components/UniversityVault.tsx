import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Folder,
  FolderPlus,
  Plus,
  FileText,
  Upload,
  Download,
  Search,
  X,
  GraduationCap,
  Loader2,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { getApiUrl, getAuthHeaders } from "../utils/api";
import {
  CV_FIELDS,
  UNIVERSITY_API as API,
  UNIVERSITY_SECTIONS as SECTIONS,
  UNIVERSITY_STATUSES as STATUSES,
  emptyUniversityData,
} from "../shared/university";
import type { UniversityData, UniversityItem } from "../shared/university";
import "./university.css";

export async function universityRequest<T>(
  path: string,
  body?: unknown,
  form?: FormData,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(getApiUrl(API + path), {
      method: body !== undefined || form ? "POST" : "GET",
      headers: getAuthHeaders(
        form
          ? undefined
          : body !== undefined
            ? { "Content-Type": "application/json" }
            : undefined,
      ),
      body: form ?? (body === undefined ? undefined : JSON.stringify(body)),
      cache: "no-store",
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    throw new Error("Bağlantı kurulamadı. Açık taslağın korundu; tekrar dene.");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(
      data?.error ??
        (res.status === 403
          ? "Bu alan yalnızca Emirgan hesabına açıktır."
          : "İşlem tamamlanamadı. Oturumunu ve bağlantını kontrol et."),
    );
  }
  return res.json();
}
export default function UniversityVault() {
  const [items, setItems] = useState<UniversityItem[]>([]),
    [category, setCategory] = useState("all"),
    [parent, setParent] = useState<string | null>(null);
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("recent"),
    [error, setError] = useState(""),
    [allowed, setAllowed] = useState(false);
  const [busy, setBusy] = useState(false),
    [editor, setEditor] = useState<{
      id: string;
      kind: "folder" | "record";
      version?: number;
      data: UniversityData;
      parentId: string | null;
    } | null>(null);
  const [draftError, setDraftError] = useState(""),
    [file, setFile] = useState<File | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    const result = await universityRequest<{ items: UniversityItem[] }>(
      "/items",
    );
    setItems(result.items);
  }, []);
  useEffect(() => {
    let stopped = false;
    universityRequest("/access")
      .then(async () => {
        if (!stopped) {
          setAllowed(true);
          await refresh();
        }
      })
      .catch((e) => {
        if (!stopped) setError(e.message);
      });
    return () => {
      stopped = true;
    };
  }, [refresh]);
  useEffect(() => {
    if (editor) dialog.current?.showModal();
  }, [editor?.id]);
  useEffect(() => {
    if (!allowed) return;
    const sync = () => {
      if (!document.hidden) void refresh().catch(() => {});
    };
    const timer = setInterval(sync, 10000);
    window.addEventListener("online", sync);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", sync);
    };
  }, [allowed, refresh]);
  const open = (
    item?: UniversityItem,
    kind: "record" | "folder" = "record",
  ) => {
    setDraftError("");
    setFile(null);
    setEditor(
      item
        ? { ...item }
        : {
            id: crypto.randomUUID(),
            kind,
            parentId: parent,
            data: {
              ...emptyUniversityData(),
              category: category === "all" ? "other" : category,
            },
          },
    );
  };
  const set = (key: keyof UniversityData, value: unknown) =>
    setEditor((e) => (e ? { ...e, data: { ...e.data, [key]: value } } : null));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setDraftError("");
    try {
      let version = editor.version;
      const saved = await universityRequest<{ version: number }>(
        "/items",
        editor,
      );
      version = saved.version;
      setEditor((e) => (e ? { ...e, version } : null));
      if (file) {
        const form = new FormData();
        form.append("version", String(version));
        form.append("file", file);
        await universityRequest(
          "/items/" + editor.id + "/file",
          undefined,
          form,
        );
      }
      await refresh();
      setEditor(null);
    } catch (e) {
      setDraftError((e as Error).message);
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  };
  const remove = async (item: UniversityItem) => {
    if (
      !confirm("“" + item.data.title + "” kaydı ve bağlı dosyası silinsin mi?")
    )
      return;
    setBusy(true);
    try {
      await universityRequest("/items/" + item.id + "/delete", {
        version: item.version,
      });
      await refresh();
      setEditor(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const download = async (item: UniversityItem) => {
    setBusy(true);
    try {
      const res = await fetch(getApiUrl(API + "/items/" + item.id + "/file"), {
        headers: getAuthHeaders(),
        cache: "no-store",
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) throw new Error("Dosya indirilemedi.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = item.file!.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const exportCV = () => {
    if (!editor) return;
    const escape = (s: string) =>
      s.replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c]!,
      );
    const html =
      '<!doctype html><html lang="tr"><meta charset="utf-8"><title>' +
      escape(editor.data.title) +
      "</title><style>body{font:15px/1.6 system-ui;max-width:780px;margin:50px auto;padding:0 25px;color:#172b31}h1{font-size:34px}h2{font-size:16px;margin-top:25px;border-bottom:1px solid #ddd}p{white-space:pre-wrap}@media print{body{margin:0}}</style><h1>" +
      escape(editor.data.title) +
      "</h1>" +
      Object.entries(CV_FIELDS)
        .filter(([k]) => editor.data.cv[k])
        .map(
          ([k, title]) =>
            "<h2>" + title + "</h2><p>" + escape(editor.data.cv[k]) + "</p>",
        )
        .join("") +
      "</html>";
    const url = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "cv.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const list = items
    .filter(
      (i) =>
        (query || i.parentId === parent) &&
        (category === "all" || i.data.category === category) &&
        (!query ||
          [
            i.data.title,
            i.data.institution,
            i.data.tags,
            i.data.text,
            i.data.program,
          ]
            .join(" ")
            .toLocaleLowerCase("tr")
            .includes(query.toLocaleLowerCase("tr"))),
    )
    .sort((a, b) =>
      a.kind !== b.kind
        ? a.kind === "folder"
          ? -1
          : 1
        : sort === "name"
          ? a.data.title.localeCompare(b.data.title, "tr")
          : sort === "deadline"
            ? (a.data.deadline || "9999").localeCompare(
                b.data.deadline || "9999",
              )
            : b.updatedAt.localeCompare(a.updatedAt),
    );
  const records = items.filter((i) => i.kind === "record"),
    ready = records.filter((i) =>
      ["ready", "submitted", "accepted"].includes(i.data.status),
    ).length;
  const trail: UniversityItem[] = [];
  let current = items.find((i) => i.id === parent);
  while (current && trail.length < items.length) {
    trail.unshift(current);
    current = items.find((i) => i.id === current!.parentId);
  }
  if (!allowed)
    return (
      <div className="uni">
        <p role="status">{error || "Özel arşiv doğrulanıyor…"}</p>
      </div>
    );
  return (
    <div className="uni">
      <header className="uni-hero">
        <span>
          <GraduationCap size={30} />
        </span>
        <div>
          <p>EMİRGAN · KİŞİSEL BAŞVURU ARŞİVİ</p>
          <h2>Üniversite belgeleri & hazırlık</h2>
          <p>
            Geçmişini derle. Belgelerini tamamla. Bir sonraki adımına hazırlan.
          </p>
        </div>
      </header>
      {error && (
        <div className="uni-error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Hata mesajını kapat">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="uni-metrics">
        <div>
          <strong>{records.length}</strong>
          <span>Kayıt</span>
        </div>
        <div>
          <strong>{ready}</strong>
          <span>Hazır / gönderilmiş</span>
        </div>
        <div>
          <strong>{records.filter((i) => i.file).length}</strong>
          <span>Dosyalı belge</span>
        </div>
        <div>
          <strong>
            {Math.round(
              items.reduce((s, i) => s + (i.file?.size ?? 0), 0) / 1048576,
            )}{" "}
            / 512 MB
          </strong>
          <span>Özel depolama</span>
        </div>
      </div>
      <nav className="uni-tabs" aria-label="Başvuru belge kategorileri">
        <button
          className={category === "all" ? "active" : ""}
          onClick={() => {
            setCategory("all");
            setParent(null);
          }}
        >
          Tüm arşiv
        </button>
        {Object.entries(SECTIONS).map(([id, name]) => (
          <button
            key={id}
            className={category === id ? "active" : ""}
            onClick={() => {
              setCategory(id);
              setParent(null);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      <div className="uni-toolbar">
        <label>
          <Search size={17} />
          <input
            aria-label="Başvuru arşivinde ara"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Belge, kurum, program veya etiket…"
          />
        </label>
        <select
          aria-label="Kayıtları sırala"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Son güncellenen</option>
          <option value="name">Ada göre</option>
          <option value="deadline">Son tarihe göre</option>
        </select>
        <button onClick={() => open(undefined, "folder")}>
          <FolderPlus size={16} /> Klasör aç
        </button>
        <button className="primary" onClick={() => open()}>
          <Plus size={16} /> Kayıt / belge ekle
        </button>
      </div>
      <div className="uni-crumbs">
        <button onClick={() => setParent(null)}>Arşiv</button>
        {trail.map((t) => (
          <Fragment key={t.id}>
            <span>/</span>
            <button onClick={() => setParent(t.id)}>{t.data.title}</button>
          </Fragment>
        ))}
      </div>
      <div className="uni-list">
        {list.map((i) => (
          <article key={i.id}>
            <div className="uni-file-icon">
              {i.kind === "folder" ? (
                <Folder size={24} />
              ) : (
                <FileText size={24} />
              )}
            </div>
            <button
              className="uni-title"
              onClick={() => (i.kind === "folder" ? setParent(i.id) : open(i))}
            >
              <strong>{i.data.title}</strong>
              <span>
                {SECTIONS[i.data.category]}
                {i.data.institution && " · " + i.data.institution}
                {i.file && " · " + i.file.name}
              </span>
            </button>
            <span className="uni-status">{STATUSES[i.data.status]}</span>
            {/^https?:\/\//i.test(i.data.url) && (
              <a
                href={i.data.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={i.data.title + " bağlantısını aç"}
                style={{ color: "#a1d8c7", fontSize: 11 }}
              >
                Bağlantı ↗
              </a>
            )}
            {i.data.deadline && <time>{i.data.deadline}</time>}
            <button
              aria-label={i.data.title + " düzenle"}
              onClick={() => open(i)}
            >
              Düzenle
            </button>
            {i.file && (
              <button
                disabled={busy}
                aria-label={i.data.title + " indir"}
                onClick={() => void download(i)}
              >
                <Download size={17} />
              </button>
            )}
          </article>
        ))}
      </div>
      {!list.length && (
        <div className="uni-empty">
          <FolderPlus size={34} />
          <h3>Başvurunun yapı taşlarını burada biriktir.</h3>
          <p>
            CV sürümleri, sertifikalar, projeler, etkinlikler ve okul belgeleri
            için kayıt oluştur. Her kayda bir dosya ekleyebilir, klasörleyebilir
            ve başvurulara bağlayabilirsin.
          </p>
          <button className="primary" onClick={() => open()}>
            İlk kaydı oluştur
          </button>
        </div>
      )}
      {category === "applications" && (
        <p className="uni-hint">
          Her üniversite / program için ayrı kayıt aç. Gereken belgeleri
          bağlayıp hazır olup olmadıklarını takip et. Son tarihleri
          üniversitenin güncel sayfasından doğrulayarak gir.
        </p>
      )}
      <aside className="uni-research">
        <h3>Başvuru hazırlık rehberi</h3>
        <p>
          Ortak belgelerini tek arşivde tut; her başvuru için farklı CV ve niyet
          mektubu sürümü oluştur. Gereken belgeler programa göre değişir.
        </p>
        <a
          href="https://www.uni-assist.de/en/how-to-apply/apply-online/uploading-documents/"
          target="_blank"
          rel="noopener noreferrer"
        >
          uni-assist · belge yükleme <ArrowUpRight size={14} />
        </a>
        <a
          href="https://www.uni-assist.de/en/how-to-apply/plan-your-application/other-documents/"
          target="_blank"
          rel="noopener noreferrer"
        >
          CV, referans ve diğer belgeler <ArrowUpRight size={14} />
        </a>
      </aside>
      {editor && (
        <dialog
          ref={dialog}
          className="uni-dialog"
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) setEditor(null);
          }}
        >
          <header>
            <h3>
              {editor.kind === "folder" ? "Klasör bilgileri" : "Başvuru kaydı"}
            </h3>
            <button
              disabled={busy}
              aria-label="Düzenleyiciyi kapat"
              onClick={() => setEditor(null)}
            >
              <X size={20} />
            </button>
          </header>
          <form onSubmit={save}>
            <label>
              Ad / başlık
              <input
                autoFocus
                required
                maxLength={160}
                value={editor.data.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </label>
            <label>
              Kategori
              <select
                aria-label="Kategori"
                value={editor.data.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {Object.entries(SECTIONS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Üst klasör
              <select
                aria-label="Üst klasör"
                value={editor.parentId ?? ""}
                onChange={(e) =>
                  setEditor((v) =>
                    v ? { ...v, parentId: e.target.value || null } : null,
                  )
                }
              >
                <option value="">Arşivin kökü</option>
                {items
                  .filter((i) => i.kind === "folder" && i.id !== editor.id)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.data.title}
                    </option>
                  ))}
              </select>
            </label>
            {editor.kind === "record" && (
              <>
                <label>
                  Kurum / üniversite
                  <input
                    maxLength={200}
                    value={editor.data.institution}
                    onChange={(e) => set("institution", e.target.value)}
                  />
                </label>
                <label>
                  Durum
                  <select
                    aria-label="Durum"
                    value={editor.data.status}
                    onChange={(e) => set("status", e.target.value)}
                  >
                    {Object.entries(STATUSES).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Tarih
                  <input
                    type="date"
                    value={editor.data.date}
                    onChange={(e) => set("date", e.target.value)}
                  />
                </label>
                <label>
                  Son tarih / geçerlilik
                  <input
                    type="date"
                    value={editor.data.deadline}
                    onChange={(e) => set("deadline", e.target.value)}
                  />
                </label>
                <label>
                  Dil / sürüm
                  <input
                    maxLength={80}
                    value={editor.data.language}
                    onChange={(e) => set("language", e.target.value)}
                    placeholder="İngilizce · 2027 başvurusu"
                  />
                </label>
                <label>
                  Etiketler
                  <input
                    maxLength={500}
                    value={editor.data.tags}
                    onChange={(e) => set("tags", e.target.value)}
                  />
                </label>
                {editor.data.category === "applications" && (
                  <>
                    <label>
                      Program
                      <input
                        maxLength={200}
                        value={editor.data.program}
                        onChange={(e) => set("program", e.target.value)}
                      />
                    </label>
                    <label>
                      Ülke
                      <input
                        maxLength={100}
                        value={editor.data.country}
                        onChange={(e) => set("country", e.target.value)}
                      />
                    </label>
                    <fieldset>
                      <legend>Bu başvuruda kullanılacak kayıtlar</legend>
                      {records
                        .filter(
                          (i) =>
                            i.id !== editor.id &&
                            i.data.category !== "applications",
                        )
                        .map((i) => (
                          <label className="uni-check" key={i.id}>
                            <input
                              type="checkbox"
                              checked={editor.data.requirementIds.includes(
                                i.id,
                              )}
                              onChange={(e) =>
                                set(
                                  "requirementIds",
                                  e.target.checked
                                    ? [...editor.data.requirementIds, i.id]
                                    : editor.data.requirementIds.filter(
                                        (id) => id !== i.id,
                                      ),
                                )
                              }
                            />
                            {i.data.title} · {STATUSES[i.data.status]}
                            {i.file ? " · dosya var" : " · dosya yok"}
                          </label>
                        ))}
                    </fieldset>
                  </>
                )}
                {editor.data.category === "cv" && (
                  <fieldset>
                    <legend>CV oluşturucu</legend>
                    {Object.entries(CV_FIELDS).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        <textarea
                          rows={3}
                          maxLength={6000}
                          value={editor.data.cv[key]}
                          onChange={(e) =>
                            set("cv", {
                              ...editor.data.cv,
                              [key]: e.target.value,
                            })
                          }
                        />
                      </label>
                    ))}
                    <button type="button" onClick={exportCV}>
                      <Download size={16} /> CV indir · HTML
                    </button>
                    <p className="uni-hint">
                      İndirdiğin CV’yi tarayıcıda açıp Yazdır → PDF olarak
                      kaydet seçeneğini kullanabilirsin. İndirme açık taslağı
                      içerir; arşive almak için ayrıca kaydet.
                    </p>
                  </fieldset>
                )}
                <label className="wide">
                  Resmî bağlantı / portfolyo
                  <input
                    type="url"
                    maxLength={2048}
                    value={editor.data.url}
                    onChange={(e) => set("url", e.target.value)}
                  />
                </label>
                <label className="wide">
                  {editor.data.category === "activities"
                    ? "Rolüm, yaptıklarım, sonuçlar ve kazanımlar"
                    : "Notlar / metin / başvuru şartları"}
                  <textarea
                    rows={6}
                    maxLength={40000}
                    value={editor.data.text}
                    onChange={(e) => set("text", e.target.value)}
                  />
                </label>
                <label className="wide uni-upload">
                  <Upload size={22} /> Belge ekle veya mevcut dosyayı değiştir
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.odt,.txt"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <small>
                    En fazla 8 MB ·{" "}
                    {file?.name ??
                      items.find((i) => i.id === editor.id)?.file?.name ??
                      "Dosya seçilmedi"}
                  </small>
                </label>
              </>
            )}
            {draftError && (
              <p className="uni-error wide" role="alert">
                {draftError}
              </p>
            )}
            <footer>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? <Loader2 size={17} /> : <CheckCircle2 size={17} />}{" "}
                Kaydet
              </button>
              {editor.version && (
                <button
                  className="danger"
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    void remove({
                      ...items.find((i) => i.id === editor.id)!,
                      version: editor.version!,
                    })
                  }
                >
                  <Trash2 size={16} /> Sil
                </button>
              )}
            </footer>
          </form>
        </dialog>
      )}
    </div>
  );
}
