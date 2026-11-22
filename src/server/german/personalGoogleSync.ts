import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Client } from "@libsql/client";
import type { PersonalSyncStatus } from "../../shared/germanPersonal";
import { extractAndAnalyzePersonalNotes, sanitizeUntrustedText, upsertParsedSourceItemsTx } from "./personalParser";
import { sha256Text } from "./personalStore";

export const GOOGLE_DOCS_SCOPE = "https://www.googleapis.com/auth/documents.readonly";
const VALID_GDOC_ID_RE = /^[a-zA-Z0-9_-]{15,128}$/u;

export interface FetchedGoogleDocPayload {
  docId: string;
  title: string;
  revisionId: string | null;
  text: string;
  accessMethod: "oauth" | "client_bearer" | "shared_link";
}

export class GoogleDocsAccessError extends Error {
  constructor(
    message: string,
    public readonly status: PersonalSyncStatus,
    public readonly httpStatus: number,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export type PersonalGoogleDocFetcher = (input: {
  docId: string;
  accessToken?: string | null;
}) => Promise<FetchedGoogleDocPayload>;

let customFetcherForTests: PersonalGoogleDocFetcher | null = null;
const activeSyncLocks = new Set<string>();
let backgroundSyncTimer: ReturnType<typeof setInterval> | null = null;

export function setPersonalGoogleFetcherForTests(fetcher: PersonalGoogleDocFetcher | null) {
  customFetcherForTests = fetcher;
}

/**
 * Extracts and strictly validates a Google Doc ID from a URL or bare ID.
 * Prevents SSRF by enforcing Google's document ID character set.
 */
export function parseGoogleDocId(urlOrId: string): { docId: string; normalizedUrl: string } | null {
  const trimmed = (urlOrId || "").trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /^https?:\/\/docs\.google\.com\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{15,128})(?:\/|\?|$)/iu,
  );
  const candidate = urlMatch ? urlMatch[1] : trimmed;
  if (!VALID_GDOC_ID_RE.test(candidate)) return null;

  return {
    docId: candidate,
    normalizedUrl: `https://docs.google.com/document/d/${candidate}/edit`,
  };
}

function resolveEncryptionKey(): Buffer {
  const raw = process.env.KAPS_GERMAN_TOKEN_KEY?.trim() || "";
  if (raw) {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  }
  // Never fail in non-OAuth local tests; derive strictly from server-side env secret if available
  const fallbackSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
  if (!fallbackSecret) {
    throw new Error("Google token şifreleme anahtarı (KAPS_GERMAN_TOKEN_KEY) sunucuda yapılandırılmadı.");
  }
  return createHash("sha256").update(`kaps-personal-gdoc:${fallbackSecret}`).digest();
}

function encryptTokenJson(payload: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", resolveEncryptionKey(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

function decryptTokenJson(encoded: string): Record<string, any> {
  const bytes = Buffer.from(encoded, "base64");
  const decipher = createDecipheriv("aes-256-gcm", resolveEncryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  const plain = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
  return JSON.parse(plain);
}

export function isPersonalGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.KAPS_GERMAN_GOOGLE_CLIENT_ID?.trim() &&
      process.env.KAPS_GERMAN_GOOGLE_CLIENT_SECRET?.trim() &&
      (process.env.KAPS_GERMAN_PERSONAL_GOOGLE_REDIRECT_URI?.trim() ||
        process.env.KAPS_GERMAN_GOOGLE_REDIRECT_URI?.trim()),
  );
}

function getPersonalRedirectUri(): string {
  return (
    process.env.KAPS_GERMAN_PERSONAL_GOOGLE_REDIRECT_URI?.trim() ||
    process.env.KAPS_GERMAN_GOOGLE_REDIRECT_URI?.trim() ||
    ""
  );
}

export async function getPersonalGoogleConnectionStatus(db: Client, userId: number) {
  const row = (
    await db.execute({
      sql: "SELECT email, scope, status, last_error, updated_at FROM german_personal_google_tokens WHERE user_id=?",
      args: [userId],
    })
  ).rows[0];

  return {
    oauthConfigured: isPersonalGoogleOAuthConfigured(),
    connected: Boolean(row && String(row.status) === "connected"),
    status: row ? String(row.status) : "disconnected",
    email: row ? String(row.email ?? "") : "",
    scope: row ? String(row.scope ?? "") : "",
    lastError: row?.last_error ? String(row.last_error) : null,
    updatedAt: row?.updated_at ? String(row.updated_at) : null,
    sharedLinkSupported: true,
  };
}

/**
 * Initiates a per-user Google OAuth2 authorization URL with PKCE S256 & read-only Docs scope.
 */
export async function startPersonalGoogleOAuth(db: Client, userId: number): Promise<{ url: string }> {
  if (!isPersonalGoogleOAuthConfigured()) {
    throw new Error(
      "Google hesabı bağlantısı için sunucuda KAPS_GERMAN_GOOGLE_CLIENT_ID ve yönlendirme ayarları gerekli. Paylaşılan Google Docs bağlantısını doğrudan yapıştırarak yine de içe aktarabilirsin.",
    );
  }
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  await db.execute({
    sql: "INSERT INTO german_oauth(state, verifier, expires_at, user_id, flow_type) VALUES(?,?,?,?, 'personal')",
    args: [state, verifier, Date.now() + 600_000, userId],
  });

  const params = new URLSearchParams({
    client_id: process.env.KAPS_GERMAN_GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: getPersonalRedirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_DOCS_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
}

/**
 * Completes per-user Google OAuth2 callback, encrypting access + refresh tokens strictly for that userId.
 */
export async function completePersonalGoogleOAuth(
  db: Client,
  input: { userId: number; code: string; verifier: string },
): Promise<void> {
  const params = new URLSearchParams({
    client_id: process.env.KAPS_GERMAN_GOOGLE_CLIENT_ID?.trim() || "",
    client_secret: process.env.KAPS_GERMAN_GOOGLE_CLIENT_SECRET?.trim() || "",
    code: input.code,
    redirect_uri: getPersonalRedirectUri(),
    grant_type: "authorization_code",
    ...(input.verifier ? { code_verifier: input.verifier } : {}),
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new Error("Google yetkilendirme kodu doğrulanamadı.");
  }
  const tokenPayload = (await res.json()) as Record<string, any>;
  if (typeof tokenPayload.access_token !== "string") {
    throw new Error("Google erişim belirteci alınamadı.");
  }

  const expiresAt = Date.now() + Math.max(60, Number(tokenPayload.expires_in ?? 3500)) * 1000;
  const storedObj = {
    access_token: tokenPayload.access_token,
    refresh_token: tokenPayload.refresh_token || "",
    expires_at: expiresAt,
    scope: tokenPayload.scope || GOOGLE_DOCS_SCOPE,
  };

  await db.execute({
    sql: `INSERT INTO german_personal_google_tokens(user_id, email, encrypted_tokens, scope, status, last_error, updated_at)
          VALUES(?, '', ?, ?, 'connected', NULL, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            encrypted_tokens=excluded.encrypted_tokens,
            scope=excluded.scope,
            status='connected',
            last_error=NULL,
            updated_at=excluded.updated_at`,
    args: [
      input.userId,
      encryptTokenJson(storedObj),
      String(storedObj.scope),
      new Date().toISOString(),
    ],
  });
}

export async function disconnectPersonalGoogleOAuth(db: Client, userId: number): Promise<void> {
  const row = (
    await db.execute({
      sql: "SELECT encrypted_tokens FROM german_personal_google_tokens WHERE user_id=?",
      args: [userId],
    })
  ).rows[0];

  if (row?.encrypted_tokens) {
    try {
      const tokens = decryptTokenJson(String(row.encrypted_tokens));
      const revokeToken = tokens.refresh_token || tokens.access_token;
      if (revokeToken) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(revokeToken)}`, {
          method: "POST",
          signal: AbortSignal.timeout(5000),
        }).catch(() => {});
      }
    } catch {}
  }

  await db.execute({
    sql: "DELETE FROM german_personal_google_tokens WHERE user_id=?",
    args: [userId],
  });
}

async function resolveUserGoogleAccessToken(db: Client, userId: number): Promise<string | null> {
  const row = (
    await db.execute({
      sql: "SELECT encrypted_tokens, status FROM german_personal_google_tokens WHERE user_id=?",
      args: [userId],
    })
  ).rows[0];
  if (!row || String(row.status) !== "connected") return null;

  const saved = decryptTokenJson(String(row.encrypted_tokens));
  if (typeof saved.access_token === "string" && Number(saved.expires_at ?? 0) > Date.now() + 60_000) {
    return saved.access_token;
  }
  if (!saved.refresh_token || !isPersonalGoogleOAuthConfigured()) {
    return typeof saved.access_token === "string" ? saved.access_token : null;
  }

  const params = new URLSearchParams({
    client_id: process.env.KAPS_GERMAN_GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.KAPS_GERMAN_GOOGLE_CLIENT_SECRET!.trim(),
    refresh_token: saved.refresh_token,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    await db.execute({
      sql: "UPDATE german_personal_google_tokens SET status='auth_required', last_error=?, updated_at=? WHERE user_id=?",
      args: [
        "Google erişim izni sona erdi veya iptal edildi. Hesabını yeniden bağla.",
        new Date().toISOString(),
        userId,
      ],
    });
    throw new GoogleDocsAccessError(
      "Google erişim izni sona erdi veya iptal edildi. Lütfen Google hesabını yeniden bağla.",
      "auth_required",
      401,
      false,
    );
  }
  const refreshed = (await res.json()) as Record<string, any>;
  if (typeof refreshed.access_token !== "string") {
    throw new GoogleDocsAccessError("Google erişim belirteci yenilenemedi.", "auth_required", 401, false);
  }

  const updated = {
    ...saved,
    access_token: refreshed.access_token,
    expires_at: Date.now() + Math.max(60, Number(refreshed.expires_in ?? 3500)) * 1000,
  };
  await db.execute({
    sql: "UPDATE german_personal_google_tokens SET encrypted_tokens=?, status='connected', last_error=NULL, updated_at=? WHERE user_id=?",
    args: [encryptTokenJson(updated), new Date().toISOString(), userId],
  });
  return refreshed.access_token;
}

/**
 * Extracts structured text from Google Docs API v1 JSON (tabs, childTabs, paragraphs, tables).
 */
export function extractTextFromGoogleDocJson(doc: any): { title: string; revisionId: string | null; text: string } {
  const lines: string[] = [];

  function walkContent(content: any[]) {
    for (const block of content ?? []) {
      if (block.paragraph) {
        const txt = (block.paragraph.elements ?? [])
          .map((e: any) => e.textRun?.content ?? "")
          .join("")
          .trim();
        if (txt) lines.push(txt);
      } else if (block.table) {
        for (const row of block.table.tableRows ?? []) {
          const cells = (row.tableCells ?? [])
            .map((cell: any) =>
              (cell.content ?? [])
                .map((p: any) =>
                  (p.paragraph?.elements ?? [])
                    .map((e: any) => e.textRun?.content ?? "")
                    .join(""),
                )
                .join(" ")
                .replace(/\s+/gu, " ")
                .trim(),
            )
            .filter(Boolean);
          if (cells.length === 2) {
            lines.push(`${cells[0]} — ${cells[1]}`);
          } else if (cells.length > 0) {
            lines.push(cells.join(" | "));
          }
        }
      }
    }
  }

  function walkTabs(tabs: any[]) {
    for (const tab of tabs ?? []) {
      const tabTitle = String(tab.tabProperties?.title ?? "").trim();
      if (tabTitle) lines.push(tabTitle);
      walkContent(tab.documentTab?.body?.content);
      walkTabs(tab.childTabs);
    }
  }

  if (Array.isArray(doc?.tabs) && doc.tabs.length > 0) {
    walkTabs(doc.tabs);
  } else {
    walkContent(doc?.body?.content);
  }

  return {
    title: typeof doc?.title === "string" && doc.title.trim() ? doc.title.trim() : "Google Docs Belgesi",
    revisionId: typeof doc?.revisionId === "string" ? doc.revisionId : null,
    text: sanitizeUntrustedText(lines.join("\n")),
  };
}

async function fetchGoogleDocViaApi(
  docId: string,
  accessToken: string,
  accessMethod: "oauth" | "client_bearer",
): Promise<FetchedGoogleDocPayload> {
  const url = `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}?includeTabsContent=true&suggestionsViewMode=PREVIEW_SUGGESTIONS_ACCEPTED`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const json = await res.json();
      const extracted = extractTextFromGoogleDocJson(json);
      return {
        docId,
        title: extracted.title,
        revisionId: extracted.revisionId,
        text: extracted.text,
        accessMethod,
      };
    }
    if (res.status === 401 || res.status === 403) {
      throw new GoogleDocsAccessError(
        "Bu Google Docs belgesine erişim iznin yok veya izin iptal edildi. Google hesabını yeniden bağla ya da paylaşım ayarlarını kontrol et.",
        "auth_required",
        res.status,
        false,
      );
    }
    if (res.status === 404) {
      throw new GoogleDocsAccessError(
        "Google Docs belgesi bulunamadı veya silinmiş.",
        "not_found",
        404,
        false,
      );
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * 2 ** attempt));
        continue;
      }
      throw new GoogleDocsAccessError(
        "Google Docs geçici olarak yoğun (rate limit). Otomatik olarak yeniden denenecek.",
        "rate_limited",
        res.status,
        true,
      );
    }
    throw new GoogleDocsAccessError(
      `Google Docs okunamadı (HTTP ${res.status}).`,
      "error",
      res.status,
      false,
    );
  }
  throw new GoogleDocsAccessError("Google Docs okunamadı.", "error", 503, true);
}

/**
 * Fetches a publicly shared Google Doc ("Anyone with the link") in read-only text format.
 */
async function fetchGoogleDocViaSharedLink(docId: string): Promise<FetchedGoogleDocPayload> {
  const exportUrl = `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=txt`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(exportUrl, {
      redirect: "follow",
      headers: { "User-Agent": "KapsApp-German-Sync/1.0" },
      signal: AbortSignal.timeout(18_000),
    });

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const finalUrl = res.url || "";
    if (res.status === 401 || res.status === 403 || finalUrl.includes("accounts.google.com")) {
      throw new GoogleDocsAccessError(
        "Bu Google Docs belgesi gizli. Okumak için Google hesabını bağla veya belge paylaşımını 'Bağlantıya sahip olan herkes görüntüleyebilir' yap.",
        "auth_required",
        403,
        false,
      );
    }
    if (res.status === 404) {
      throw new GoogleDocsAccessError(
        "Google Docs belgesi bulunamadı veya silinmiş.",
        "not_found",
        404,
        false,
      );
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }
      throw new GoogleDocsAccessError(
        "Google Docs geçici olarak yanıt veremedi; kısa süre sonra tekrar denenecek.",
        "rate_limited",
        res.status,
        true,
      );
    }
    if (!res.ok) {
      throw new GoogleDocsAccessError("Google Docs belgesi okunamadı.", "error", res.status, false);
    }
    if (contentType.includes("text/html")) {
      throw new GoogleDocsAccessError(
        "Bu belgeye erişmek için Google hesabını bağlaman veya bağlantı paylaşımını açman gerekiyor.",
        "auth_required",
        403,
        false,
      );
    }

    const rawText = sanitizeUntrustedText((await res.text()).replace(/^\uFEFF/u, ""));
    let title = "Google Docs Belgesi";
    const disposition = res.headers.get("content-disposition") || "";
    const utf8Title = disposition.match(/filename\*=UTF-8''([^;]+)/iu);
    const plainTitle = disposition.match(/filename="([^"]+)"/iu);
    const decodedTitle = utf8Title
      ? decodeURIComponent(utf8Title[1])
      : plainTitle
        ? plainTitle[1]
        : "";
    if (decodedTitle) {
      title = decodedTitle.replace(/\.txt$/iu, "").trim() || title;
    }

    return {
      docId,
      title,
      revisionId: null,
      text: rawText,
      accessMethod: "shared_link",
    };
  }
  throw new GoogleDocsAccessError("Google Docs bağlantısı başarısız.", "error", 503, true);
}

export async function fetchPersonalGoogleDoc(
  db: Client,
  input: { userId: number; docId: string; clientAccessToken?: string | null },
): Promise<FetchedGoogleDocPayload> {
  const userOAuthToken = input.clientAccessToken
    ? null
    : await resolveUserGoogleAccessToken(db, input.userId).catch((err) => {
        if (err instanceof GoogleDocsAccessError) throw err;
        return null;
      });
  const effectiveToken = input.clientAccessToken?.trim() || userOAuthToken;

  if (customFetcherForTests) {
    return customFetcherForTests({ docId: input.docId, accessToken: effectiveToken });
  }

  if (effectiveToken) {
    try {
      return await fetchGoogleDocViaApi(
        input.docId,
        effectiveToken,
        input.clientAccessToken ? "client_bearer" : "oauth",
      );
    } catch (err) {
      // If user's token lacked access to a public link-shared doc, try shared link before failing
      if (err instanceof GoogleDocsAccessError && err.status === "auth_required") {
        try {
          return await fetchGoogleDocViaSharedLink(input.docId);
        } catch {
          throw err;
        }
      }
      throw err;
    }
  }

  return fetchGoogleDocViaSharedLink(input.docId);
}

/**
 * Synchronizes a single Google Docs personal source idempotently:
 * - Compares revisionId and SHA-256 content hash to skip unnecessary AI re-extraction
 * - Preserves all mastered vocabulary progress when items are modified or removed
 * - Handles retries with exponential backoff and clear sync status reporting
 */
export async function syncPersonalGoogleDocSource(
  db: Client,
  input: {
    userId: number;
    sourceId: string;
    clientAccessToken?: string | null;
    force?: boolean;
    useAI?: boolean;
  },
): Promise<{
  status: PersonalSyncStatus;
  unchanged: boolean;
  added: number;
  updated: number;
  removed: number;
  totalActive: number;
  title: string;
  error?: string;
}> {
  if (activeSyncLocks.has(input.sourceId)) {
    return {
      status: "syncing",
      unchanged: true,
      added: 0,
      updated: 0,
      removed: 0,
      totalActive: 0,
      title: "",
    };
  }

  activeSyncLocks.add(input.sourceId);
  try {
    const srcRes = await db.execute({
      sql: "SELECT * FROM german_personal_sources WHERE id=? AND user_id=? AND deleted_at IS NULL",
      args: [input.sourceId, input.userId],
    });
    const src = srcRes.rows[0];
    if (!src || String(src.source_type) !== "gdoc" || !src.gdoc_id) {
      throw new Error("Senkronize edilecek Google Docs kaynağı bulunamadı.");
    }

    const docId = String(src.gdoc_id);
    const prevHash = String(src.content_hash ?? "");
    const prevRev = src.gdoc_revision_id ? String(src.gdoc_revision_id) : null;
    const intervalMin = Math.max(5, Math.min(1440, Number(src.sync_interval_min ?? 15)));
    const autoSync = Number(src.auto_sync_enabled ?? 0) === 1;

    await db.execute({
      sql: "UPDATE german_personal_sources SET sync_status='syncing', sync_error=NULL WHERE id=? AND user_id=?",
      args: [input.sourceId, input.userId],
    });

    try {
      const doc = await fetchPersonalGoogleDoc(db, {
        userId: input.userId,
        docId,
        clientAccessToken: input.clientAccessToken,
      });
      const contentHash = sha256Text(doc.text);
      const now = new Date();
      const nowIso = now.toISOString();
      const nextSyncAt = autoSync ? new Date(now.getTime() + intervalMin * 60_000).toISOString() : null;

      const isUnchanged =
        !input.force &&
        ((doc.revisionId && prevRev && doc.revisionId === prevRev) ||
          (contentHash && prevHash && contentHash === prevHash));

      if (isUnchanged) {
        const countRes = await db.execute({
          sql: "SELECT COUNT(*) AS c FROM german_personal_source_items WHERE source_id=? AND user_id=? AND active=1 AND excluded=0",
          args: [input.sourceId, input.userId],
        });
        await db.execute({
          sql: `UPDATE german_personal_sources
                SET sync_status='unchanged', sync_error=NULL, sync_retry_count=0,
                    last_synced_at=?, next_sync_at=?, updated_at=?
                WHERE id=? AND user_id=?`,
          args: [nowIso, nextSyncAt, nowIso, input.sourceId, input.userId],
        });
        return {
          status: "unchanged",
          unchanged: true,
          added: 0,
          updated: 0,
          removed: 0,
          totalActive: Number(countRes.rows[0]?.c ?? 0),
          title: String(src.title || doc.title),
        };
      }

      const analyzed = await extractAndAnalyzePersonalNotes(db, {
        userId: input.userId,
        rawText: doc.text,
        useAI: input.useAI,
      });

      const tx = await db.transaction("write");
      let diff = { added: 0, updated: 0, removed: 0, totalActive: 0 };
      try {
        diff = await upsertParsedSourceItemsTx(tx, {
          userId: input.userId,
          sourceId: input.sourceId,
          items: analyzed.items,
          revisionId: doc.revisionId,
          contentHash,
          cefrSummary: analyzed.cefrSummary,
          nowIso,
        });
        await tx.execute({
          sql: `UPDATE german_personal_sources
                SET title=CASE WHEN title='' OR title='Google Docs Belgesi' THEN ? ELSE title END,
                    raw_text=?, gdoc_revision_id=?, content_hash=?,
                    sync_status='synced', sync_error=NULL, sync_retry_count=0,
                    last_synced_at=?, next_sync_at=?, updated_at=?
                WHERE id=? AND user_id=?`,
          args: [
            doc.title,
            doc.text.slice(0, 350_000),
            doc.revisionId,
            contentHash,
            nowIso,
            nextSyncAt,
            nowIso,
            input.sourceId,
            input.userId,
          ],
        });
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      } finally {
        tx.close();
      }

      return {
        status: "synced",
        unchanged: false,
        ...diff,
        title: String(src.title && src.title !== "Google Docs Belgesi" ? src.title : doc.title),
      };
    } catch (err: any) {
      const now = new Date();
      const nowIso = now.toISOString();
      const retryCount = Number(src.sync_retry_count ?? 0) + 1;
      const syncStatus: PersonalSyncStatus =
        err instanceof GoogleDocsAccessError ? err.status : "error";
      const retryable = err instanceof GoogleDocsAccessError ? err.retryable : true;
      const backoffMin = retryable && retryCount <= 5 ? Math.min(60, 2 ** retryCount) : null;
      const nextSyncAt =
        autoSync && backoffMin !== null
          ? new Date(now.getTime() + backoffMin * 60_000).toISOString()
          : null;
      const errMsg =
        err instanceof Error
          ? err.message
          : "Google Docs senkronizasyonu sırasında beklenmeyen bir hata oluştu.";

      await db.execute({
        sql: `UPDATE german_personal_sources
              SET sync_status=?, sync_error=?, sync_retry_count=?,
                  auto_sync_enabled=CASE WHEN ? IN ('auth_required','not_found') THEN 0 ELSE auto_sync_enabled END,
                  next_sync_at=?, updated_at=?
              WHERE id=? AND user_id=?`,
        args: [syncStatus, errMsg.slice(0, 500), retryCount, syncStatus, nextSyncAt, nowIso, input.sourceId, input.userId],
      });

      return {
        status: syncStatus,
        unchanged: true,
        added: 0,
        updated: 0,
        removed: 0,
        totalActive: 0,
        title: String(src.title ?? ""),
        error: errMsg,
      };
    }
  } finally {
    activeSyncLocks.delete(input.sourceId);
  }
}

/**
 * Checks for due auto-sync Google Docs sources and synchronizes them safely.
 */
export async function runDuePersonalGoogleSyncs(db: Client): Promise<number> {
  const nowIso = new Date().toISOString();
  const due = await db.execute({
    sql: `SELECT id, user_id FROM german_personal_sources
          WHERE source_type='gdoc' AND auto_sync_enabled=1 AND deleted_at IS NULL
            AND (next_sync_at IS NULL OR next_sync_at <= ?)
          ORDER BY next_sync_at ASC LIMIT 8`,
    args: [nowIso],
  });

  let processed = 0;
  for (const row of due.rows) {
    try {
      await syncPersonalGoogleDocSource(db, {
        userId: Number(row.user_id),
        sourceId: String(row.id),
      });
      processed++;
    } catch {
      // Per-source error is already recorded on the source row
    }
  }
  return processed;
}

export function startPersonalGoogleSyncWorker(db: Client): () => void {
  if (backgroundSyncTimer) {
    clearInterval(backgroundSyncTimer);
  }
  backgroundSyncTimer = setInterval(() => {
    void runDuePersonalGoogleSyncs(db).catch(() => {});
  }, 60_000);
  backgroundSyncTimer.unref?.();
  return () => {
    if (backgroundSyncTimer) {
      clearInterval(backgroundSyncTimer);
      backgroundSyncTimer = null;
    }
  };
}
