import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export default function CoursePdfPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setPdf(undefined);
    setPage(1);
    setError(false);
    void import("pdfjs-dist").then(({ getDocument, GlobalWorkerOptions }) => {
      if (cancelled) return;
      GlobalWorkerOptions.workerSrc = workerUrl;
      const task = getDocument({ url, isEvalSupported: false });
      destroy = () => { void task.destroy().catch(() => {}); };
      return task.promise.then(document => { if (!cancelled) setPdf(document); });
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; destroy?.(); };
  }, [url]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let cancelRender: (() => void) | undefined;
    void pdf.getPage(page).then(source => {
      const target = canvas.current;
      const container = viewer.current;
      if (cancelled || !target || !container) return;
      const context = target.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      const original = source.getViewport({ scale: 1 });
      const width = Math.min(1000, Math.max(1, container.clientWidth - 24));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = source.getViewport({ scale: width / original.width * ratio });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      container.scrollTop = 0;
      const render = source.render({ canvasContext: context, viewport });
      cancelRender = () => render.cancel();
      return render.promise;
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; cancelRender?.(); };
  }, [pdf, page]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
        <span>En iyi performans için PDF’yi indirmen önerilir.</span>
        {pdf && !error && <nav aria-label="PDF sayfaları" className="flex items-center gap-2">
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Önceki</button>
          <span aria-live="polite">{page} / {pdf.numPages}</span>
          <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" disabled={page >= pdf.numPages} onClick={() => setPage(p => Math.min(pdf.numPages, p + 1))}>Sonraki</button>
        </nav>}
      </div>
      <div ref={viewer} className="min-h-0 flex-1 overflow-auto p-3">
        {error ? <p role="status">Önizleme açılamadı. PDF’yi indirerek açabilirsin.</p>
          : pdf ? <canvas ref={canvas} aria-label={`PDF sayfa ${page}`} className="mx-auto block h-auto w-full max-w-[1000px] bg-white" />
            : <p role="status">PDF yükleniyor…</p>}
      </div>
    </div>
  );
}
