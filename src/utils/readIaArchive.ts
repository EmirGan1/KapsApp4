import JSZip from "jszip";
import { RESOURCE_FILE_LIMIT_MB } from "./subjectResources";

const MB = 1024 * 1024;
const MAX_TOTAL = 160 * MB;

interface ZipByteStream {
  on(event: "data", callback: (chunk: Uint8Array) => void): ZipByteStream;
  on(event: "error", callback: (error: Error) => void): ZipByteStream;
  on(event: "end", callback: () => void): ZipByteStream;
  pause(): ZipByteStream;
  resume(): ZipByteStream;
}

export async function readIaArchive(archive: File) {
  if (archive.size > MAX_TOTAL) throw new Error("ZIP en fazla 160 MB olabilir.");
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  const entries = Object.values(zip.files).filter(entry => !entry.dir && /\.pdf$/i.test(entry.name));
  if (!entries.length || entries.length > 100) throw new Error("ZIP içinde 1–100 PDF olmalı.");
  let total = 0;
  const documents = [];
  for (const entry of entries) {
    const original = entry.unsafeOriginalName ?? entry.name;
    const parts = original.split("/");
    if (parts.length > 12 || parts.some(part => !part || part.trim() !== part || part.length > 240 || part === "." || part === ".." || /[\\\x00-\x1f\x7f]/.test(part))) {
      throw new Error("ZIP içinde geçersiz bir dosya veya klasör yolu var.");
    }
    const name = parts.pop()!;
    const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
      const chunks: Uint8Array[] = [];
      let size = 0;
      const stream = (entry as typeof entry & { internalStream(type: "uint8array"): ZipByteStream }).internalStream("uint8array");
      stream.on("data", chunk => {
        size += chunk.byteLength;
        total += chunk.byteLength;
        if (size > RESOURCE_FILE_LIMIT_MB * MB || total > MAX_TOTAL) {
          stream.pause();
          reject(new Error("PDF veya toplam arşiv boyutu sınırı aşıldı."));
          return;
        }
        chunks.push(chunk);
      }).on("error", reject).on("end", () => {
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        resolve(bytes);
      }).resume();
    });
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error(`Geçersiz PDF: ${name}`);
    documents.push({ name, folders: parts, bytes });
  }
  return documents;
}
