import { getApiUrl } from "./api";
import { getUploadError } from "./uploadErrors";
import { UPLOAD_CHUNK_BYTES, UPLOAD_FILE_BYTES } from "./uploadLimits";

export async function uploadFile(
  endpoint: string,
  form: FormData,
  auth: HeadersInit,
  onProgress?: (percent: number) => void,
) {
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size <= UPLOAD_CHUNK_BYTES) {
    const response = await fetch(getApiUrl(endpoint), { method: "POST", body: form, credentials: "include", headers: auth });
    if (!response.ok) throw new Error(await getUploadError(response));
    onProgress?.(100);
    return response.json();
  }
  if (file.size > UPLOAD_FILE_BYTES) throw new Error("Bir dosya en fazla 300 MB olabilir.");
  const jsonHeaders = new Headers(auth);
  jsonHeaders.set("Content-Type", "application/json");
  const chunkHeaders = new Headers(auth);
  chunkHeaders.set("Content-Type", "application/octet-stream");
  const stage = getApiUrl("/api/upload/staged");
  const request = async (url: string, init: RequestInit) => {
    const response = await fetch(url, { credentials: "include", ...init });
    if (!response.ok) throw new Error(await getUploadError(response));
    return response;
  };
  const started = await request(stage, {
    method: "POST", headers: jsonHeaders,
    body: JSON.stringify({ filename: (file as File).name, size: file.size, mimetype: file.type || "application/octet-stream" }),
  });
  const { id } = await started.json();
  const session = stage + "/" + encodeURIComponent(id);
  try {
    for (let offset = 0; offset < file.size; offset += UPLOAD_CHUNK_BYTES) {
      const end = Math.min(file.size, offset + UPLOAD_CHUNK_BYTES);
      await request(session + "?offset=" + offset, { method: "PUT", headers: chunkHeaders, body: file.slice(offset, end) });
      onProgress?.(Math.min(99, Math.floor(end * 100 / file.size)));
    }
    const fields = Object.fromEntries([...form].filter(([, value]) => typeof value === "string"));
    const response = await request(getApiUrl(endpoint), {
      method: "POST", headers: jsonHeaders, body: JSON.stringify({ stagedUploadId: id, fields }),
    });
    const data = await response.json();
    onProgress?.(100);
    return data;
  } catch (error) {
    void fetch(session, { method: "DELETE", headers: auth, credentials: "include" }).catch(() => {});
    throw error;
  }
}
