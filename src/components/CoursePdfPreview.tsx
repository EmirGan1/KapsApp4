import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function PdfPage({ pdf, pageNumber, width, scrollRoot }: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  scrollRoot: HTMLDivElement;
}) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(210 / 297);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!section.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setNearViewport(entry.isIntersecting);
    }, { root: scrollRoot, rootMargin: "500px 0px" });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!nearViewport || !width) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    setError(false);
    void pdf.getPage(pageNumber).then(page => {
      if (cancelled || !canvas.current) return;
      const target = canvas.current;
      const context = target.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");

      const original = page.getViewport({ scale: 1 });
      setAspectRatio(original.width / original.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: width * ratio / original.width });
      target.width = Math.ceil(viewport.width);
      target.height = Math.ceil(viewport.height);
      task = page.render({ canvasContext: context, viewport });
      return task.promise;
    }).catch(() => {
      if (!cancelled) setError(true);
    });

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, nearViewport, width]);

  return (
    <section ref={section} aria-label={`Sayfa ${pageNumber}`}>
      <div className="mb-1 text-right text-xs text-slate-600 dark:text-slate-300">
        {pageNumber} / {pdf.numPages}
      </div>
      <div style={{ aspectRatio }} className="relative bg-white shadow-sm">
        {nearViewport && <canvas ref={canvas} aria-label={`PDF sayfa ${pageNumber}`}
          className={`absolute inset-0 block h-full w-full ${error ? "invisible" : ""}`} />}
        {error && <p role="status" className="p-3 text-sm text-slate-700">
          Bu sayfa görüntülenemedi. PDF’yi indirerek açabilirsin.
        </p>}
      </div>
    </section>
  );
}

export default function CoursePdfPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [error, setError] = useState(false);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const pages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setPdf(undefined);
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
    const container = pages.current;
    if (!container) return;
    const update = () => setWidth(container.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
        En iyi performans için PDF’yi indirmen önerilir.
      </div>
      <div ref={setScrollRoot} tabIndex={0} role="region" aria-label="PDF sayfaları"
        className="min-h-0 flex-1 overflow-auto overscroll-contain p-3">
        <div ref={pages} className="mx-auto max-w-[1000px] space-y-4">
          {error ? <p role="status">Önizleme açılamadı. PDF’yi indirerek açabilirsin.</p>
            : pdf ? scrollRoot && Array.from({ length: pdf.numPages }, (_, index) => (
              <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} width={width} scrollRoot={scrollRoot} />
            ))
            : <p role="status">PDF yükleniyor…</p>}
        </div>
      </div>
    </div>
  );
}
