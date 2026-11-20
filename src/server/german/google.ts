import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import type { Client } from "@libsql/client";
export const DOCUMENT = "1-1DJxTHV2ebDKB0GpI49XEl-rqfxbLvGo-pFJOD_UvU";
function key() {
  const b = Buffer.from(process.env.KAPS_GERMAN_TOKEN_KEY || "", "base64");
  if (b.length !== 32)
    throw new Error(
      "Google bağlantısı için sunucuda 32 baytlık şifreleme anahtarı gerekli.",
    );
  return b;
}
export function encrypt(value: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(), iv);
  const content = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), content]).toString("base64");
}
function decrypt(value: string) {
  const bytes = Buffer.from(value, "base64"),
    d = createDecipheriv("aes-256-gcm", key(), bytes.subarray(0, 12));
  d.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([d.update(bytes.subarray(28)), d.final()]).toString();
}
export async function googleToken(db: Client, code?: string) {
  const row = await db.execute(
    "SELECT value FROM german_settings WHERE key='google_token'",
  );
  const saved = row.rows[0]
    ? JSON.parse(decrypt(String(row.rows[0].value)))
    : {};
  const params = new URLSearchParams({
    client_id: process.env.KAPS_GERMAN_GOOGLE_CLIENT_ID || "",
    client_secret: process.env.KAPS_GERMAN_GOOGLE_CLIENT_SECRET || "",
    ...(code
      ? {
          code,
          redirect_uri: process.env.KAPS_GERMAN_GOOGLE_REDIRECT_URI || "",
          grant_type: "authorization_code",
        }
      : {
          refresh_token: saved.refresh_token || "",
          grant_type: "refresh_token",
        }),
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: params,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw new Error(
      "Google yetkisi yenilenemedi. Google bağlantısını tekrar kur.",
    );
  const token = await res.json();
  if (typeof token.access_token !== "string")
    throw new Error("Google yanıtı geçersiz.");
  await db.execute({
    sql: "INSERT INTO german_settings(key,value) VALUES('google_token',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    args: [encrypt(JSON.stringify({ ...saved, ...token }))],
  });
  return token.access_token as string;
}
export async function getDocument(db: Client) {
  const token = await googleToken(db);
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(
      "https://docs.googleapis.com/v1/documents/" +
        DOCUMENT +
        "?includeTabsContent=true&suggestionsViewMode=PREVIEW_SUGGESTIONS_ACCEPTED",
      {
        headers: { Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(20000),
      },
    );
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw new Error("Google Docs okunamadı. Son başarılı kelimeler korunuyor.");
}
