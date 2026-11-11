import CoursePdfPreview from "./CoursePdfPreview";
import { uploadErrorMessage } from "../utils/uploadErrors";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Eye, FileText, Folder, FolderPlus, Loader2, Pencil, Search, Trash2, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { getApiUrl } from "../utils/api";
import { RESOURCE_FILE_LIMIT_MB, RESOURCE_PREVIEW_TYPES, SUBJECT_IA_MAX, readIaScoreName } from "../utils/subjectResources";
import { SubjectDecor } from "./SubjectDecor";

type Collection = "ia" | "ee";
type Entry = {
  id: number;
  name: string;
  is_folder: number;
  uploader: string;
  mime_type: string | null;
  size: number | null;
  canRename: boolean;
  score: { points: number; maximum: number } | null;
};
type Listing = { defaultMaximum?: number; entries: Entry[]; breadcrumbs: { id: number; name: string; score?: Entry["score"] }[] };
type Preview = { name: string; url: string; mime: string };
const buttonBase = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:opacity-50";
const button = `${buttonBase} border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`;

export function subjectResourcesLink(subject: string, collection?: Collection, folder?: number) {
  const query = new URLSearchParams({ kaynak: collection ?? "sec" });
  if (folder !== undefined) query.set("klasor", String(folder));
  return `/dersler/${encodeURIComponent(subject)}?${query}`;
}

async function request(path: string, options?: RequestInit) {
  const token = localStorage.getItem("lan_token");
  const headers = new Headers(options?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(getApiUrl(path), { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(uploadErrorMessage(response.status, body));
  }
  return response;
}

function jsonName(method: string, name: string, score?: { points: number; maximum: number }): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...score }) };
}

export default function SubjectResources({ subject, collection, folder }: {
  subject: string;
  collection?: Collection;
  folder?: string;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<{ id?: number; name: string; points?: string; maximum?: string } | null>(null);
  const [gradedUpload, setGradedUpload] = useState<{ file: File; points: string; maximum: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<Entry | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const zipInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewDialog = useRef<HTMLDialogElement>(null);
  const base = `/api/courses/${encodeURIComponent(subject)}/resources/${collection}`;
  const scope = folder ? `?parent=${encodeURIComponent(folder)}` : "";

  useEffect(() => {
    if (!collection) return;
    const controller = new AbortController();
    request(base + scope, { signal: controller.signal })
      .then(response => response.json())
      .then(data => { if (!controller.signal.aborted) setListing(data); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [base, collection, scope, revision]);

  useEffect(() => {
    if (!preview) return;
    previewDialog.current?.showModal();
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const actionScope = useRef<AbortController | null>(null);
  useEffect(() => () => actionScope.current?.abort(), []);

  async function run(action: (signal: AbortSignal) => Promise<void>) {
    const controller = new AbortController();
    actionScope.current = controller;
    setBusy(true);
    setError("");
    try {
      await action(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  const defaultMaximum = listing?.defaultMaximum ?? SUBJECT_IA_MAX[subject] ?? "";
  const inheritedScore = listing?.breadcrumbs.map(crumb => crumb.score ?? readIaScoreName(crumb.name)).filter(Boolean).at(-1);
  const displayName = (entry: Entry) => collection === "ia" && !entry.is_folder ? entry.name.replaceAll("_", "/") : entry.name;

  async function sendFile(file: File, params: URLSearchParams, signal: AbortSignal) {
    // Copy bytes before the browser releases the file picker selection.
    const copy = new File([await file.arrayBuffer()], file.name, { type: file.type });
    const body = new FormData();
    body.append("file", copy);
    await request(`${base}/files?${params}`, { method: "POST", body, signal });
  }

  function upload(file: File, score?: { points: string; maximum: string }) {
    if (file.size > RESOURCE_FILE_LIMIT_MB * 1024 * 1024) {
      setError(`Dosya en fazla ${RESOURCE_FILE_LIMIT_MB} MB olabilir.`);
      return;
    }
    if (collection === "ia" && !score) {
      const inherited = inheritedScore;
      setGradedUpload({
        file,
        points: inherited ? String(inherited.points) : "",
        maximum: String(inherited?.maximum ?? listing?.defaultMaximum ?? SUBJECT_IA_MAX[subject] ?? ""),
      });
      return;
    }
    void run(async signal => {
      const params = new URLSearchParams(scope);
      if (score) {
        params.set("points", score.points);
        params.set("maximum", score.maximum);
      }
      await sendFile(file, params, signal);
      setGradedUpload(null);
      setRevision(value => value + 1);
    });
  }

  function importZip(archive: File) {
    void run(async signal => {
      let uploaded = 0;
      try {
        const { readIaArchive } = await import("../utils/readIaArchive");
        const documents = await readIaArchive(archive);
        const listings = new Map<number | null, Listing>();
        const load = async (parent: number | null, refresh = false) => {
          if (!refresh && listings.has(parent)) return listings.get(parent)!;
          const data: Listing = await (await request(base + (parent === null ? "" : `?parent=${parent}`), { signal })).json();
          listings.set(parent, data);
          return data;
        };
        let skipped = 0;
        for (const doc of documents) {
          let parent: number | null = null;
          let score: NonNullable<Entry["score"]> | null = null;
          setImportProgress(`${uploaded + skipped + 1}/${documents.length} · ${doc.name}`);
          for (const segment of doc.folders) {
            score = readIaScoreName(segment) ?? score;
            let current = await load(parent);
            let folderEntry = current.entries.find(entry => entry.is_folder && entry.name === segment);
            if (!folderEntry) {
              const query = parent === null ? "" : `?parent=${parent}`;
              await request(`${base}/folders${query}`, { ...jsonName("POST", segment, score ?? undefined), signal });
              current = await load(parent, true);
              folderEntry = current.entries.find(entry => entry.is_folder && entry.name === segment);
            }
            if (!folderEntry) throw new Error(`Klasör bulunamadı: ${segment}`);
            score = folderEntry.score ?? score;
            parent = folderEntry.id;
          }
          if ((await load(parent)).entries.some(entry => !entry.is_folder && entry.name === doc.name && entry.size === doc.bytes.byteLength)) {
            skipped++;
            continue;
          }
          if (!score) throw new Error(`Klasör adından IA puanı okunamadı: ${doc.name}`);
          const params = new URLSearchParams({ points: String(score.points), maximum: String(score.maximum) });
          if (parent !== null) params.set("parent", String(parent));
          await sendFile(new File([doc.bytes], doc.name, { type: "application/pdf" }), params, signal);
          uploaded++;
        }
        setImportProgress(`${uploaded} PDF yüklendi, ${skipped} mevcut dosya atlandı.`);
      } catch (error) {
        setImportProgress(`${uploaded} PDF yüklendi. Arşivi yeniden seçerek kaldığın yerden devam edebilirsin.`);
        throw error;
      } finally {
        if (!signal.aborted) setRevision(value => value + 1);
      }
    });
  }

  function canPreview(entry: Entry) {
    return RESOURCE_PREVIEW_TYPES.some(type => type === entry.mime_type);
  }

  function openFile(entry: Entry, inline: boolean) {
    void run(async signal => {
      const response = await request(`${base}/${entry.id}/file${inline ? "?preview=1" : ""}`, { signal });
      const blob = await response.blob();
      if (signal.aborted) return;
      const url = URL.createObjectURL(blob);
      if (inline) {
        setPreview({ name: displayName(entry), url, mime: blob.type });
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = entry.name;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  }

  const query = search.trim().toLocaleLowerCase("tr");
  const entries = listing?.entries.filter(entry =>
    `${entry.name} ${displayName(entry)} ${entry.uploader}`.toLocaleLowerCase("tr").includes(query),
  );

  return (
    <div className="relative flex-1 min-h-0 overflow-y-auto bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <SubjectDecor subject={subject} />
      <main className="relative mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-8">
        <header className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-5 dark:border-indigo-800 dark:from-indigo-950 dark:to-slate-900">
          <Link to={`/dersler/${encodeURIComponent(subject)}`} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300"><ArrowLeft size={16} /> {subject} dersine dön</Link>
          <h1 className="mt-2 text-2xl font-black">IA/EE Kaynakları</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Örnek çalışmalar, kılavuzlar ve araştırma dosyaları</p>
        </header>

        <nav aria-label="Kaynak türü" className="grid gap-3 sm:grid-cols-2">
          {(["ia", "ee"] as const).map(kind => (
            <Link key={kind} to={subjectResourcesLink(subject, kind)} aria-current={collection === kind ? "page" : undefined}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 hover:border-indigo-400 ${collection === kind ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
              <span><strong>{kind.toUpperCase()}</strong><span className="ml-2 text-sm text-slate-600 dark:text-slate-400">{kind === "ia" ? "Internal Assessment" : "Extended Essay"}</span></span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </nav>

        {collection && (
          <section aria-label={`${collection.toUpperCase()} dosyaları`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
            <nav aria-label="Klasör yolu" className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <Link className="font-semibold text-indigo-700 dark:text-indigo-300" to={subjectResourcesLink(subject, collection)}>{collection.toUpperCase()} ana klasörü</Link>
              {listing?.breadcrumbs.map(crumb => (
                <span key={crumb.id} className="flex min-w-0 items-center gap-2 break-all">
                  <span aria-hidden="true">/</span>
                  <Link className="hover:underline" to={subjectResourcesLink(subject, collection, crumb.id)}>{crumb.name}</Link>
                </span>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-10 min-w-44 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 dark:border-slate-700">
                <Search size={16} />
                <input aria-label="Dosya veya yükleyen ara" placeholder="Dosya veya yükleyen ara…" className="w-full bg-transparent py-2 text-sm placeholder:text-slate-500 dark:placeholder:text-slate-400" value={search} onChange={event => setSearch(event.target.value)} />
              </label>
              <button type="button" className={button} disabled={busy || !listing} onClick={() => setEditor({ name: "", points: inheritedScore ? String(inheritedScore.points) : "", maximum: String(inheritedScore?.maximum ?? defaultMaximum) })}><FolderPlus size={16} /> Yeni klasör</button>
              <button type="button" className={`${buttonBase} border-blue-700 bg-blue-700 text-white hover:bg-blue-800 dark:border-blue-500 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500`} disabled={busy || !listing} onClick={() => fileInput.current?.click()}><Upload size={16} /> Dosya yükle</button>
              <input ref={fileInput} type="file" hidden onChange={event => {
                const file = event.target.files?.[0];
                if (file) upload(file);
                event.target.value = "";
              }} />
            </div>
            {collection === "ia" && !folder && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" className={button} disabled={busy || !listing} onClick={() => zipInput.current?.click()}>ZIP’ten IA aktar</button>
                <input ref={zipInput} hidden type="file" accept=".zip,application/zip" onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) importZip(file);
                  event.target.value = "";
                }} />
                {importProgress && <span role="status" className="text-sm text-slate-600 dark:text-slate-400">{importProgress}</span>}
              </div>
            )}
            {gradedUpload && (
              <form className="my-3 flex flex-wrap items-end gap-2 rounded-xl border border-indigo-200 p-3 dark:border-indigo-900" onSubmit={event => {
                event.preventDefault();
                upload(gradedUpload.file, gradedUpload);
              }}>
                <p className="w-full break-words text-sm font-semibold">{gradedUpload.file.name}</p>
                <label className="text-xs font-semibold">IA puanı
                  <input autoFocus required type="number" min={0} max={gradedUpload.maximum || 999} step={1} className="mt-1 block w-28 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-950" value={gradedUpload.points} onChange={event => setGradedUpload({ ...gradedUpload, points: event.target.value })} />
                </label>
                <label className="text-xs font-semibold">Maksimum puan
                  <input required type="number" min={1} max={999} step={1} className="mt-1 block w-28 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-950" value={gradedUpload.maximum} onChange={event => setGradedUpload({ ...gradedUpload, maximum: event.target.value })} />
                </label>
                <button className={button} disabled={busy}>Puanla ve yükle</button>
                <button type="button" className={button} disabled={busy} onClick={() => setGradedUpload(null)}>Vazgeç</button>
                {!folder && <p className="w-full text-xs text-slate-500">Dosya bu puana ait klasöre eklenir. Klasör yoksa otomatik oluşturulur.</p>}
              </form>
            )}
            {editor && (
              <form className="my-3 flex flex-wrap items-end gap-2" onSubmit={event => {
                event.preventDefault();
                void run(async signal => {
                  await request(editor.id ? `${base}/${editor.id}` : `${base}/folders${scope}`, {
                    ...jsonName(editor.id ? "PATCH" : "POST", editor.name,
                      !editor.id && editor.points ? { points: Number(editor.points), maximum: Number(editor.maximum) } : undefined), signal,
                  });
                  setEditor(null);
                  setRevision(value => value + 1);
                });
              }}>
                <label className="min-w-44 flex-1 text-xs font-semibold">
                  {editor.id ? "Yeni ad" : "Klasör adı"}
                  <input autoFocus required maxLength={240} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} />
                </label>
                {!editor.id && collection === "ia" && (
                  <>
                    <label className="text-xs font-semibold">Klasör puanı (isteğe bağlı)
                      <input type="number" min={0} max={editor.maximum || 999} step={1} className="mt-1 block w-28 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-950" value={editor.points ?? ""} onChange={event => setEditor({ ...editor, points: event.target.value })} />
                    </label>
                    <label className="text-xs font-semibold">Maksimum puan
                      <input type="number" required={Boolean(editor.points)} min={1} max={999} step={1} className="mt-1 block w-28 rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-950" value={editor.maximum ?? ""} onChange={event => setEditor({ ...editor, maximum: event.target.value })} />
                    </label>
                  </>
                )}
                <button className={button} disabled={busy || !editor.name.trim()}>Kaydet</button>
                <button type="button" className={button} disabled={busy} onClick={() => setEditor(null)}>Vazgeç</button>
              </form>
            )}
            {error && <div role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error} {!listing && <button className="underline" onClick={() => { setError(""); setRevision(value => value + 1); }}>Tekrar dene</button>}</div>}
            {busy && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"><Loader2 size={16} className="animate-spin" /> İşleniyor…</p>}
            {!listing && !error && <p role="status" className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">Kaynaklar yükleniyor…</p>}
            {entries?.length === 0 && <p className="py-10 text-center text-sm text-slate-600 dark:text-slate-400">{query ? "Aramana uygun kaynak bulunamadı." : "Bu klasör boş. Bir klasör oluşturabilir veya ilk dosyayı yükleyebilirsin."}</p>}
            <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-700">
              {entries?.map(entry => (
                <li key={entry.id} className={`flex flex-wrap items-center gap-2 px-2 py-3 ${entry.is_folder && entry.score && entry.score.points === entry.score.maximum ? "rounded-xl bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 ring-1 ring-inset ring-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.3)] dark:from-amber-950 dark:via-yellow-900/50 dark:to-amber-950" : ""}`}>
                  {entry.is_folder ? <Folder size={19} className="text-amber-500" /> : <FileText size={19} className="text-indigo-500" />}
                  <div className="min-w-36 flex-1">
                    {entry.is_folder ? <Link className="block break-words text-sm font-semibold hover:underline" to={subjectResourcesLink(subject, collection, entry.id)}>{entry.name}</Link> : <button type="button" className="block max-w-full break-words text-left text-sm font-semibold text-indigo-700 hover:underline disabled:opacity-50 dark:text-indigo-300" disabled={busy} onClick={() => openFile(entry, canPreview(entry))}>{displayName(entry)}</button>}
                    <p className="break-all text-xs text-slate-500 dark:text-slate-400">{entry.is_folder ? "Oluşturan" : "Yükleyen"} @{entry.uploader}{entry.size != null && ` · ${(entry.size / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} MB`}</p>
                  </div>
                  {entry.score && (
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${entry.score.points === entry.score.maximum ? "bg-amber-200 text-amber-950" : "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200"}`}>
                      {entry.score.points}/{entry.score.maximum}{entry.score.points === entry.score.maximum ? " · Tam puan" : ""}
                    </span>
                  )}
                  {!entry.is_folder && canPreview(entry) && <button className={button} disabled={busy} onClick={() => openFile(entry, true)}><Eye size={16} /> Önizle</button>}
                  {!entry.is_folder && <button className={button} disabled={busy} onClick={() => openFile(entry, false)}><Download size={16} /> İndir</button>}
                  {entry.canRename && <button className={button} disabled={busy} onClick={() => setEditor({ id: entry.id, name: entry.name })}><Pencil size={16} /> Adını değiştir</button>}
                  {entry.canRename && <button type="button" className={button} disabled={busy} onClick={() => setDeleteEntry(entry)}><Trash2 size={16} /> Sil</button>}
        {deleteEntry?.id === entry.id && (
          <div role="alert" className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-red-300 p-4">
            <span className="flex-1 break-all text-sm">{displayName(deleteEntry)}{deleteEntry.is_folder ? " ve tüm içeriği kalıcı olarak silinsin mi?" : " kalıcı olarak silinsin mi?"}</span>
            <button className={button} disabled={busy} onClick={() => setDeleteEntry(null)}>Vazgeç</button>
            <button className={`${button} text-red-600`} disabled={busy} onClick={() => void run(async signal => {
              await request(`${base}/${deleteEntry.id}`, { method: "DELETE", signal });
              setDeleteEntry(null);
              setRevision(value => value + 1);
            })}>Kalıcı olarak sil</button>
          </div>
        )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {preview && (
          <dialog ref={previewDialog} onClose={() => setPreview(null)} className="m-auto w-[min(92vw,64rem)] rounded-2xl bg-white p-4 text-slate-900 backdrop:bg-black/70 dark:bg-slate-900 dark:text-white">
            <header className="mb-3 flex items-center justify-between gap-3"><h2 className="break-all font-semibold">{preview.name}</h2><div className="flex gap-2">{preview.mime === "application/pdf" && <a href={preview.url} download={preview.name} className={button}>İndir</a>}<form method="dialog"><button className={button}>Kapat</button></form></div></header>
            {preview.mime === "application/pdf" ? (
              <div className="h-[72vh]"><CoursePdfPreview key={preview.url} url={preview.url} /></div>
            ) : (
              <img alt={preview.name} src={preview.url} className="mx-auto max-h-[72vh] max-w-full object-contain" />
            )}
          </dialog>
        )}
      </main>
    </div>
  );
}
