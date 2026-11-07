import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Eye, FileText, Folder, FolderPlus, Loader2, Pencil, Search, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { getApiUrl } from "../utils/api";
import { RESOURCE_FILE_LIMIT_MB, RESOURCE_PREVIEW_TYPES } from "../utils/subjectResources";
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
};
type Listing = { entries: Entry[]; breadcrumbs: { id: number; name: string }[] };
type Preview = { name: string; url: string; mime: string };
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800";

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
    throw new Error(body?.error || "İşlem tamamlanamadı. Tekrar deneyin.");
  }
  return response;
}

function jsonName(method: string, name: string): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) };
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
  const [editor, setEditor] = useState<{ id?: number; name: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
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

  function upload(file: File) {
    if (file.size > RESOURCE_FILE_LIMIT_MB * 1024 * 1024) {
      setError(`Dosya en fazla ${RESOURCE_FILE_LIMIT_MB} MB olabilir.`);
      return;
    }
    void run(async signal => {
      const body = new FormData();
      body.append("file", file);
      await request(`${base}/files${scope}`, { method: "POST", body, signal });
      setRevision(value => value + 1);
    });
  }

  function openFile(entry: Entry, inline: boolean) {
    void run(async signal => {
      const response = await request(`${base}/${entry.id}/file${inline ? "?preview=1" : ""}`, { signal });
      const blob = await response.blob();
      if (signal.aborted) return;
      const url = URL.createObjectURL(blob);
      if (inline) {
        setPreview({ name: entry.name, url, mime: blob.type });
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
    `${entry.name} ${entry.uploader}`.toLocaleLowerCase("tr").includes(query),
  );

  return (
    <div className="relative flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <SubjectDecor subject={subject} />
      <main className="relative mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-8">
        <header className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-5 dark:border-indigo-900 dark:from-indigo-950/60 dark:to-slate-900">
          <Link to={`/dersler/${encodeURIComponent(subject)}`} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300"><ArrowLeft size={16} /> {subject} dersine dön</Link>
          <h1 className="mt-2 text-2xl font-black">IA/EE Kaynakları</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Örnek çalışmalar, kılavuzlar ve araştırma dosyaları</p>
        </header>

        <nav aria-label="Kaynak türü" className="grid gap-3 sm:grid-cols-2">
          {(["ia", "ee"] as const).map(kind => (
            <Link key={kind} to={subjectResourcesLink(subject, kind)} aria-current={collection === kind ? "page" : undefined}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 hover:border-indigo-400 ${collection === kind ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60" : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"}`}>
              <span><strong>{kind.toUpperCase()}</strong><span className="ml-2 text-sm text-slate-500 dark:text-slate-400">{kind === "ia" ? "Internal Assessment" : "Extended Essay"}</span></span>
              <ArrowRight size={16} />
            </Link>
          ))}
        </nav>

        {collection && (
          <section aria-label={`${collection.toUpperCase()} dosyaları`} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
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
                <input aria-label="Dosya veya yükleyen ara" placeholder="Dosya veya yükleyen ara…" className="w-full bg-transparent py-2 text-sm" value={search} onChange={event => setSearch(event.target.value)} />
              </label>
              <button type="button" className={button} disabled={busy || !listing} onClick={() => setEditor({ name: "" })}><FolderPlus size={16} /> Yeni klasör</button>
              <button type="button" className={`${button} border-blue-700 bg-blue-700 text-white hover:bg-blue-800 dark:hover:bg-blue-800`} disabled={busy || !listing} onClick={() => fileInput.current?.click()}><Upload size={16} /> Dosya yükle</button>
              <input ref={fileInput} type="file" hidden onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) upload(file);
              }} />
            </div>
            {editor && (
              <form className="my-3 flex flex-wrap items-end gap-2" onSubmit={event => {
                event.preventDefault();
                void run(async signal => {
                  await request(editor.id ? `${base}/${editor.id}` : `${base}/folders${scope}`, {
                    ...jsonName(editor.id ? "PATCH" : "POST", editor.name), signal,
                  });
                  setEditor(null);
                  setRevision(value => value + 1);
                });
              }}>
                <label className="min-w-44 flex-1 text-xs font-semibold">
                  {editor.id ? "Yeni ad" : "Klasör adı"}
                  <input autoFocus required maxLength={240} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm dark:border-slate-700" value={editor.name} onChange={event => setEditor({ ...editor, name: event.target.value })} />
                </label>
                <button className={button} disabled={busy || !editor.name.trim()}>Kaydet</button>
                <button type="button" className={button} disabled={busy} onClick={() => setEditor(null)}>Vazgeç</button>
              </form>
            )}
            {error && <div role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error} {!listing && <button className="underline" onClick={() => { setError(""); setRevision(value => value + 1); }}>Tekrar dene</button>}</div>}
            {busy && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> İşleniyor…</p>}
            {!listing && !error && <p role="status" className="py-8 text-center text-sm text-slate-500">Kaynaklar yükleniyor…</p>}
            {entries?.length === 0 && <p className="py-10 text-center text-sm text-slate-500">{query ? "Aramana uygun kaynak bulunamadı." : "Bu klasör boş. Bir klasör oluşturabilir veya ilk dosyayı yükleyebilirsin."}</p>}
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {entries?.map(entry => (
                <li key={entry.id} className="flex flex-wrap items-center gap-2 py-3">
                  {entry.is_folder ? <Folder size={19} className="text-amber-500" /> : <FileText size={19} className="text-indigo-500" />}
                  <div className="min-w-36 flex-1">
                    {entry.is_folder ? <Link className="block break-words text-sm font-semibold hover:underline" to={subjectResourcesLink(subject, collection, entry.id)}>{entry.name}</Link> : <p className="break-words text-sm font-semibold">{entry.name}</p>}
                    <p className="break-all text-xs text-slate-500 dark:text-slate-400">{entry.is_folder ? "Oluşturan" : "Yükleyen"} @{entry.uploader}{entry.size != null && ` · ${(entry.size / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} MB`}</p>
                  </div>
                  {!entry.is_folder && RESOURCE_PREVIEW_TYPES.some(type => type === entry.mime_type) && <button className={button} disabled={busy} onClick={() => openFile(entry, true)}><Eye size={16} /> Önizle</button>}
                  {!entry.is_folder && <button className={button} disabled={busy} onClick={() => openFile(entry, false)}><Download size={16} /> İndir</button>}
                  {entry.canRename && <button className={button} disabled={busy} onClick={() => setEditor({ id: entry.id, name: entry.name })}><Pencil size={16} /> Adını değiştir</button>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {preview && (
          <dialog ref={previewDialog} onClose={() => setPreview(null)} className="m-auto w-[min(92vw,64rem)] rounded-2xl bg-white p-4 text-slate-900 backdrop:bg-black/70 dark:bg-slate-900 dark:text-white">
            <header className="mb-3 flex items-center justify-between gap-3"><h2 className="break-all font-semibold">{preview.name}</h2><form method="dialog"><button className={button}>Kapat</button></form></header>
            {preview.mime === "application/pdf" ? (
              <iframe title={preview.name} src={preview.url} className="h-[72vh] w-full rounded-lg" />
            ) : (
              <img alt={preview.name} src={preview.url} className="mx-auto max-h-[72vh] max-w-full object-contain" />
            )}
          </dialog>
        )}
      </main>
    </div>
  );
}
