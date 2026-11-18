import { AI_SOURCE_TEXT_LIMIT } from "../shared/kapsAppAi";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export type PreparedKapsAiPdf = { title: string; text: string; pages: number; truncated: boolean };

// Extract text locally in the browser; neither the original PDF nor its raw bytes
// are persisted or uploaded. Scanned/image-only pages require OCR and are rejected.
export async function prepareKapsAiPdf(file: File): Promise<PreparedKapsAiPdf> {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    throw new Error("Lütfen PDF dosyası seç.");
  }
  if (file.size > 12 * 1024 * 1024) throw new Error("PDF en fazla 12 MB olabilir.");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data, useSystemFonts: true });
  let pdf;
  try {
    pdf = await task.promise;
    const limit = AI_SOURCE_TEXT_LIMIT;
    const sections: string[] = [];
    let characters = 0;
    let truncated = false;
    const inspected = Math.min(pdf.numPages, 50);
    for (let pageNumber = 1; pageNumber <= inspected; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const extracted = content.items.map(item => "str" in item ? item.str : "").join(" ").replace(/\s+/g, " ").trim();
      if (!extracted) continue;
      const block = "[Sayfa " + pageNumber + "] " + extracted + "\n";
      const remaining = limit - characters;
      if (remaining <= 0) { truncated = true; break; }
      const snippet = block.slice(0, remaining);
      sections.push(snippet);
      characters += snippet.length;
      if (snippet.length < block.length) { truncated = true; break; }
    }
    if (pdf.numPages > inspected) truncated = true;
    const text = sections.join("").trim();
    if (text.length < 30) throw new Error("Bu PDF'den okunabilir metin çıkarılamadı. Taranmış PDF için önce OCR gerekir.");
    return { title: file.name.slice(0, 120), text, pages: pdf.numPages, truncated };
  } finally {
    if (pdf) await pdf.destroy().catch(() => {});
    else await task.destroy().catch(() => {});
  }
}
