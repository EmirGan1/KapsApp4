export function uploadErrorMessage(status: number, body: unknown): string {
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  if (typeof error === "string" && error.trim()) return error;
  if (status === 413) {
    return "Yükleme isteği ağ geçidinin boyut sınırına takıldı (HTTP 413). Bu sınır dosya başına uygulanan sınırdan farklı olabilir. Birden fazla dosya seçtiysen ayrı ayrı yüklemeyi dene.";
  }
  return `Dosya yüklenemedi (HTTP ${status}).`;
}

export async function getUploadError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return uploadErrorMessage(response.status, body);
}
