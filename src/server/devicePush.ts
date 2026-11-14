import webpush from "web-push";
import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";

export function pushSession(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function validSubscription(value: unknown): value is webpush.PushSubscription {
  if (!value || typeof value !== "object") return false;
  const { endpoint, keys } = value as Partial<webpush.PushSubscription>;
  if (typeof endpoint !== "string" || endpoint.length > 2048 || !keys ||
      !/^[\w-]{87}$/.test(keys.p256dh) || !/^[\w-]{22}$/.test(keys.auth)) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && !url.username && !url.password &&
      !url.hash && /^\/(?!\/).+/.test(url.pathname) &&
      (url.hostname === "fcm.googleapis.com" || url.hostname === "updates.push.services.mozilla.com" ||
       url.hostname === "web.push.apple.com" || url.hostname.endsWith(".push.apple.com") ||
       url.hostname.endsWith(".notify.windows.com"));
  } catch { return false; }
}

export type PushAlert = {
  title: string; body: string; tag: string; url: string;
  avatar?: string; expiresAt: number;
};

export function createDevicePush(db: Client) {
  let keys: Promise<webpush.VapidKeys> | undefined;
  function initialize() {
    return keys ??= (async () => {
      await db.execute("CREATE TABLE IF NOT EXISTS device_push_keys (id INTEGER PRIMARY KEY CHECK (id = 1), public_key TEXT NOT NULL, private_key TEXT NOT NULL)");
      await db.execute("CREATE TABLE IF NOT EXISTS device_push_subscriptions (endpoint TEXT PRIMARY KEY, user_id INTEGER NOT NULL, session_hash TEXT NOT NULL, payload TEXT NOT NULL)");
      await db.execute("CREATE INDEX IF NOT EXISTS device_push_user ON device_push_subscriptions(user_id)");
      const found = await db.execute("SELECT public_key, private_key FROM device_push_keys WHERE id = 1");
      if (!found.rows.length) {
        const generated = webpush.generateVAPIDKeys();
        await db.execute({ sql: "INSERT OR IGNORE INTO device_push_keys VALUES (1, ?, ?)", args: [generated.publicKey, generated.privateKey] });
      }
      const row = (await db.execute("SELECT public_key, private_key FROM device_push_keys WHERE id = 1")).rows[0];
      return { publicKey: String(row.public_key), privateKey: String(row.private_key) };
    })().catch(error => { keys = undefined; throw error; });
  }

  return {
    async publicKey() { return (await initialize()).publicKey; },
    async subscribe(userId: number, token: string, subscription: webpush.PushSubscription) {
      if (!validSubscription(subscription)) throw new Error("Invalid push subscription");
      await initialize();
      const payload = { endpoint: subscription.endpoint, keys: subscription.keys };
      await db.execute({
        sql: "INSERT INTO device_push_subscriptions VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, session_hash=excluded.session_hash, payload=excluded.payload",
        args: [subscription.endpoint, userId, pushSession(token), JSON.stringify(payload)],
      });
    },
    async unsubscribeSession(token: string) {
      await initialize();
      await db.execute({ sql: "DELETE FROM device_push_subscriptions WHERE session_hash=?", args: [pushSession(token)] });
    },
    async endpoints(userId: number) {
      await initialize();
      return (await db.execute({ sql: "SELECT endpoint, payload FROM device_push_subscriptions WHERE user_id=?", args: [userId] })).rows;
    },
    async deliver(userId: number, alert: PushAlert) {
      const ttl = Math.floor((alert.expiresAt - Date.now()) / 1000);
      if (ttl < 1) return;
      const vapidDetails = { subject: "https://kapsapp.online", ...(await initialize()) };
      const rows = await this.endpoints(userId);
      await Promise.allSettled(rows.map(async row => {
        const subscription: unknown = JSON.parse(String(row.payload));
        if (!validSubscription(subscription)) return;
        try {
          await webpush.sendNotification(subscription, JSON.stringify(alert), {
            TTL: ttl, urgency: "high", timeout: 5000, vapidDetails,
          });
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.execute({ sql: "DELETE FROM device_push_subscriptions WHERE endpoint=? AND user_id=? AND payload=?", args: [String(row.endpoint), userId, String(row.payload)] });
          } else {
            console.warn("Web Push delivery failed", status ?? "network");
          }
        }
      }));
    },
  };
}
