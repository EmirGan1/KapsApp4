import { randomUUID } from "node:crypto";
import express from "express";
import type { Express, Request, RequestHandler } from "express";
import type { Client, Row } from "@libsql/client";
import {
  ENTRY_KINDS,
  TRAVEL_API,
  emptyEntry,
  emptyTrip,
} from "../shared/travel";
import type {
  EntryData,
  EntryKind,
  TravelEntry,
  TravelTrip,
  TripData,
} from "../shared/travel";

type Identity = { id: unknown } | null;
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v,
  );
const integer = (v: unknown, max = 1e10) =>
  Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= max;
const day = (v: string) =>
  v === "" ||
  (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
    v >= "2000-01-01" &&
    v <= "2100-12-31" &&
    Number.isFinite(Date.parse(v + "T00:00:00Z")) &&
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v);
const text = (v: unknown, limit: number): v is string =>
  typeof v === "string" && v.length <= limit && !v.includes("\u0000");
const safeUrl = (v: string) => {
  if (!v) return true;
  try {
    const u = new URL(v);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  } catch {
    return false;
  }
};
function tripData(value: unknown): TripData | null {
  if (!value || typeof value !== "object") return null;
  const v = { ...emptyTrip(), ...value } as TripData;
  if (
    !text(v.name, 100) ||
    !v.name.trim() ||
    !text(v.destination, 150) ||
    !text(v.description, 5000) ||
    !text(v.interests, 300) ||
    !text(v.startDate, 10) ||
    !day(v.startDate) ||
    !text(v.endDate, 10) ||
    !day(v.endDate) ||
    Boolean(v.startDate) !== Boolean(v.endDate) ||
    v.endDate < v.startDate ||
    (v.startDate &&
      (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000 > 365) ||
    !integer(v.budget) ||
    typeof v.archived !== "boolean" ||
    !/^[A-Z]{3}$/.test(v.currency) ||
    !text(v.timezone, 80)
  )
    return null;
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: v.currency });
    new Intl.DateTimeFormat("en", { timeZone: v.timezone });
  } catch {
    return null;
  }
  return Object.fromEntries(
    Object.keys(emptyTrip()).map((key) => [key, v[key as keyof TripData]]),
  ) as TripData;
}
function entryData(
  value: unknown,
  kind: EntryKind,
  memberIds: number[],
): EntryData | null {
  if (!value || typeof value !== "object") return null;
  const v = { ...emptyEntry(), ...value } as EntryData;
  for (const [key, limit] of Object.entries({
    title: 200,
    category: 60,
    tags: 300,
    text: 10000,
    url: 2048,
    date: 10,
    time: 5,
    must: 10,
    address: 300,
    area: 100,
    reference: 200,
    endDate: 10,
    status: 30,
    parentId: 36,
  })) {
    if (!text(v[key as keyof EntryData], limit)) return null;
  }
  if (
    !v.title.trim() ||
    !safeUrl(v.url) ||
    !day(v.date) ||
    !day(v.endDate) ||
    (v.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)) ||
    (v.endDate && (!v.date || v.endDate < v.date)) ||
    !integer(v.duration, 1440) ||
    !integer(v.order, 1000000) ||
    !integer(v.priority, 3) ||
    !integer(v.estimated) ||
    (v.actual !== null && !integer(v.actual)) ||
    typeof v.done !== "boolean" ||
    typeof v.favorite !== "boolean" ||
    !["", "visit", "do"].includes(v.must) ||
    (v.assignee !== null && !memberIds.includes(v.assignee)) ||
    !Array.isArray(v.options) ||
    v.options.length > 8 ||
    v.options.some((o) => !text(o, 100) || !o.trim()) ||
    new Set(v.options).size !== v.options.length ||
    (kind === "decision" && v.options.length < 2) ||
    (kind === "comment" && !uuid(v.parentId)) ||
    (v.parentId && !uuid(v.parentId))
  )
    return null;
  if ((v.lat === null) !== (v.lng === null)) return null;
  if (
    v.lat !== null &&
    (!Number.isFinite(v.lat) ||
      Math.abs(v.lat) > 90 ||
      !Number.isFinite(v.lng) ||
      Math.abs(v.lng!) > 180)
  )
    return null;
  return Object.fromEntries(
    Object.keys(emptyEntry()).map((key) => [key, v[key as keyof EntryData]]),
  ) as EntryData;
}
const toTrip = (r: Row): TravelTrip => ({
  id: String(r.id),
  version: Number(r.version),
  revision: Number(r.revision),
  data: JSON.parse(String(r.data)),
  createdBy: Number(r.created_by),
  updatedBy: Number(r.updated_by),
  updatedAt: String(r.updated_at),
});
const toEntry = (r: Row): TravelEntry => ({
  id: String(r.id),
  version: Number(r.version),
  data: JSON.parse(String(r.data)),
  createdBy: Number(r.created_by),
  updatedBy: Number(r.updated_by),
  updatedAt: String(r.updated_at),
  tripId: String(r.trip_id),
  kind: String(r.kind) as EntryKind,
});

export function registerTravel(
  app: Express,
  db: Client,
  authenticate: (req: Request) => Promise<Identity>,
  deviceGuard: RequestHandler,
  configuredIds = [
    Number(process.env.KAPSAPP_TRAVEL_DIDO_ID),
    Number(process.env.KAPSAPP_TRAVEL_EMIRGAN_ID),
  ],
) {
  const members = configuredIds.map((id, i) => ({
    id,
    name: i === 0 ? "Dido" : "Emirgan",
  }));
  const configured =
    configuredIds.length === 2 &&
    configuredIds.every((id) => Number.isSafeInteger(id) && id > 0) &&
    configuredIds[0] !== configuredIds[1];
  let ready: Promise<unknown> | undefined;
  const initialize = () =>
    (ready ??= db
      .batch(
        [
          "CREATE TABLE IF NOT EXISTS private_travel_trips (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1, created_by INTEGER NOT NULL, updated_by INTEGER NOT NULL, updated_at TEXT NOT NULL)",
          "CREATE TABLE IF NOT EXISTS private_travel_entries (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_by INTEGER NOT NULL, updated_by INTEGER NOT NULL, updated_at TEXT NOT NULL)",
          "CREATE INDEX IF NOT EXISTS private_travel_entries_trip ON private_travel_entries(trip_id)",
          "CREATE TABLE IF NOT EXISTS private_travel_votes (trip_id TEXT NOT NULL, entry_id TEXT NOT NULL, user_id INTEGER NOT NULL, choice TEXT NOT NULL, PRIMARY KEY(entry_id,user_id))",
          "CREATE TABLE IF NOT EXISTS private_travel_changes (id INTEGER PRIMARY KEY AUTOINCREMENT, trip_id TEXT NOT NULL, name TEXT NOT NULL, actor INTEGER NOT NULL, action TEXT NOT NULL, at TEXT NOT NULL)",
          "CREATE INDEX IF NOT EXISTS private_travel_changes_trip ON private_travel_changes(trip_id,id)",
          "CREATE TABLE IF NOT EXISTS private_travel_members (role TEXT PRIMARY KEY, user_id INTEGER UNIQUE NOT NULL)",
        ],
        "write",
      )
      .then(async () => {
        // Pin configured identities once. A later environment change must never grant access to old plans.
        await db.batch(
          members.map((m) => ({
            sql: "INSERT OR IGNORE INTO private_travel_members(role,user_id) VALUES (?,?)",
            args: [m.name, m.id],
          })),
          "write",
        );
        const actual = await db.execute(
          "SELECT role,user_id FROM private_travel_members ORDER BY role",
        );
        if (
          actual.rows.length !== 2 ||
          members.some(
            (m) =>
              !actual.rows.some(
                (r) => r.role === m.name && Number(r.user_id) === m.id,
              ),
          )
        )
          throw new Error("identity_configuration");
      })
      .catch((error) => {
        ready = undefined;
        throw error;
      }));

  const rates = new Map<number, { start: number; count: number }>();
  const guard: RequestHandler = async (req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    });
    try {
      if (!/^Bearer \S{1,512}$/i.test(req.headers.authorization ?? ""))
        return void res.sendStatus(401);
      const user = await authenticate(req);
      if (!user) return void res.sendStatus(401);
      const id = Number(user.id);
      if (!configured || !configuredIds.includes(id))
        return void res.sendStatus(403);
      // Both IDs must resolve to live accounts. Authorization itself never depends on names or admin roles.
      const accounts = await db.execute({
        sql: "SELECT id FROM users WHERE id IN (?,?)",
        args: configuredIds,
      });
      if (accounts.rows.length !== 2) return void res.sendStatus(503);
      await initialize();
      res.locals.travelUser = id;
      if (req.method !== "GET") {
        const now = Date.now();
        const rate = rates.get(id);
        const nextRate =
          !rate || now - rate.start > 60000
            ? { start: now, count: 1 }
            : { ...rate, count: rate.count + 1 };
        rates.set(id, nextRate);
        if (nextRate.count > 90)
          return void res
            .status(429)
            .json({ error: "Çok hızlı işlem yapıldı. Biraz bekle." });
      }
      next();
    } catch {
      res
        .status(503)
        .json({
          error:
            "Gezi planları şu anda açılamıyor. Kimlik yapılandırmasını ve veritabanı bağlantısını kontrol edin.",
        });
    }
  };
  const router = express.Router();
  app.use(TRAVEL_API, deviceGuard, guard, router);
  router.use(express.json({ limit: "32kb", inflate: false }));
  router.get("/access", (_req, res) =>
    res.json({ members, userId: res.locals.travelUser }),
  );
  type Handler = (req: Request, res: express.Response) => Promise<unknown>;
  const route =
    (handler: Handler): RequestHandler =>
    (req, res) => {
      void handler(req, res).catch(() => {
        if (!res.headersSent)
          res
            .status(503)
            .json({
              error:
                "Değişiklik kaydedilemedi. Bağlantını kontrol edip tekrar dene.",
            });
      });
    };
  router.get(
    "/trips",
    route(async (_req, res) => {
      const result = await db.execute(
        "SELECT * FROM private_travel_trips ORDER BY updated_at DESC",
      );
      const counts = await db.execute(`SELECT trip_id,
      SUM(CASE WHEN kind='place' THEN 1 ELSE 0 END) AS places,
      SUM(CASE WHEN kind='place' AND json_extract(data,'$.done')=1 THEN 1 ELSE 0 END) AS visited,
      SUM(CASE WHEN kind='place' AND json_extract(data,'$.date')!='' THEN 1 ELSE 0 END) AS planned,
      SUM(CASE WHEN kind='task' THEN 1 ELSE 0 END) AS tasks,
      SUM(CASE WHEN kind='task' AND json_extract(data,'$.done')=1 THEN 1 ELSE 0 END) AS task_done
      FROM private_travel_entries WHERE kind IN ('place','task') GROUP BY trip_id`);
      res.json({
        trips: result.rows.map((row) => {
          const count = counts.rows.find((c) => c.trip_id === row.id);
          return {
            ...toTrip(row),
            summary: {
              places: Number(count?.places ?? 0),
              visited: Number(count?.visited ?? 0),
              planned: Number(count?.planned ?? 0),
              tasks: Number(count?.tasks ?? 0),
              taskDone: Number(count?.task_done ?? 0),
            },
          };
        }),
      });
    }),
  );
  router.post(
    "/trips",
    route(async (req, res) => {
      const data = tripData(req.body?.data);
      const id = req.body?.id;
      if (!data || !uuid(id))
        return res
          .status(400)
          .json({ error: "Gezi adı, tarihleri ve bütçeyi kontrol et." });
      const now = new Date().toISOString(),
        user = res.locals.travelUser;
      const tx = await db.transaction("write");
      try {
        const count = await tx.execute(
          "SELECT COUNT(*) AS count FROM private_travel_trips",
        );
        if (Number(count.rows[0].count) >= 100)
          return res
            .status(409)
            .json({ error: "En fazla 100 gezi saklanabilir." });
        // Caller-generated ID makes retries after a lost acknowledgment safe.
        await tx.execute({
          sql: "INSERT OR IGNORE INTO private_travel_trips(id,data,created_by,updated_by,updated_at) VALUES (?,?,?,?,?)",
          args: [id, JSON.stringify(data), user, user, now],
        });
        const row = await tx.execute({
          sql: "SELECT * FROM private_travel_trips WHERE id=?",
          args: [id],
        });
        if (String(row.rows[0].data) !== JSON.stringify(data)) {
          return res
            .status(409)
            .json({
              error:
                "Bu gezi önceki denemede kaydedilmiş. Taslağın korundu; kaydedilen geziyi açıp değişikliklerini birleştir.",
            });
        }
        await tx.commit();
        res.status(201).json({ trip: toTrip(row.rows[0]) });
      } finally {
        tx.close();
      }
    }),
  );
  router.get(
    "/trip/:id",
    route(async (req, res) => {
      if (!uuid(req.params.id)) return res.sendStatus(404);
      const tx = await db.transaction("read");
      try {
        const trips = await tx.execute({
          sql: "SELECT * FROM private_travel_trips WHERE id=?",
          args: [req.params.id],
        });
        if (!trips.rows[0]) return res.sendStatus(404);
        const trip = toTrip(trips.rows[0]);
        if (req.query.revision === String(trip.revision))
          return res.json({ unchanged: true });
        const entries = await tx.execute({
          sql: "SELECT * FROM private_travel_entries WHERE trip_id=? ORDER BY updated_at,id",
          args: [trip.id],
        });
        const votes = await tx.execute({
          sql: "SELECT entry_id,user_id,choice FROM private_travel_votes WHERE trip_id=?",
          args: [trip.id],
        });
        const changes = await tx.execute({
          sql: "SELECT * FROM private_travel_changes WHERE trip_id=? ORDER BY id DESC LIMIT 30",
          args: [trip.id],
        });
        res.json({
          trip,
          entries: entries.rows.map(toEntry),
          votes: votes.rows.map((r) => ({
            entryId: String(r.entry_id),
            userId: Number(r.user_id),
            choice: String(r.choice),
          })),
          changes: changes.rows.map((r) => ({
            id: Number(r.id),
            name: String(r.name),
            actor: Number(r.actor),
            action: String(r.action),
            at: String(r.at),
          })),
        });
      } finally {
        tx.close();
      }
    }),
  );
  router.post(
    "/trip/:id/mutate",
    route(async (req, res) => {
      const tripId = req.params.id;
      const {
        operation,
        id,
        kind,
        data: input,
        version,
        choice,
      } = req.body ?? {};
      if (
        !uuid(tripId) ||
        !["trip", "create", "update", "delete", "vote"].includes(operation)
      )
        return res.sendStatus(400);
      if (operation !== "trip" && !uuid(id)) return res.sendStatus(400);
      const tx = await db.transaction("write");
      const user = res.locals.travelUser,
        now = new Date().toISOString();
      try {
        const trip = await tx.execute({
          sql: "SELECT * FROM private_travel_trips WHERE id=?",
          args: [tripId],
        });
        if (!trip.rows[0]) return res.sendStatus(404);
        let title = "",
          action = "";
        if (operation === "trip") {
          const data = tripData(input);
          if (!data || !integer(version))
            return res
              .status(400)
              .json({ error: "Gezi bilgilerini kontrol et." });
          const old = toTrip(trip.rows[0]);
          if (old.version !== version)
            return res
              .status(409)
              .json({
                error:
                  "Gezi bilgileri diğer kullanıcı tarafından değiştirildi. Taslağın korundu; güncel kaydı açıp değişikliklerini birleştir.",
              });
          if (data.currency !== old.data.currency) {
            const costs = await tx.execute({
              sql: "SELECT data FROM private_travel_entries WHERE trip_id=? AND kind IN ('expense','place')",
              args: [tripId],
            });
            if (
              costs.rows.some((r) => {
                const d = JSON.parse(String(r.data));
                return d.estimated || d.actual;
              })
            ) {
              return res
                .status(409)
                .json({
                  error:
                    "Tutar girilmişken para birimi değiştirilemez. Önce tutarları yeni birime dönüştür.",
                });
            }
          }
          await tx.execute({
            sql: "UPDATE private_travel_trips SET data=?,version=version+1 WHERE id=?",
            args: [JSON.stringify(data), tripId],
          });
          title = data.name;
          action = data.archived ? "Gezi arşivlendi" : "Gezi düzenlendi";
        } else {
          const existing = await tx.execute({
            sql: "SELECT * FROM private_travel_entries WHERE id=? AND trip_id=?",
            args: [id, tripId],
          });
          const old = existing.rows[0] ? toEntry(existing.rows[0]) : null;
          if (operation === "create" && old) {
            const submitted = entryData(input, kind, configuredIds);
            if (
              old.kind !== kind ||
              !submitted ||
              JSON.stringify(old.data) !== JSON.stringify(submitted)
            ) {
              return res
                .status(409)
                .json({
                  error:
                    "Bu kayıt önceki denemede kaydedilmiş. Taslağın korundu; güncel kaydı açıp değişikliklerini birleştir.",
                });
            }
            await tx.commit();
            return res.json({ ok: true });
          }
          if (operation !== "create" && !old) return res.sendStatus(404);
          if (operation === "vote") {
            if (old!.kind !== "decision" || !old!.data.options.includes(choice))
              return res.sendStatus(400);
            await tx.execute({
              sql: "INSERT INTO private_travel_votes(trip_id,entry_id,user_id,choice) VALUES (?,?,?,?) ON CONFLICT(entry_id,user_id) DO UPDATE SET choice=excluded.choice",
              args: [tripId, id, user, choice],
            });
            title = old!.data.title;
            action = "Oy verildi";
          } else {
            if (old && (!integer(version) || old.version !== version))
              return res
                .status(409)
                .json({
                  error:
                    "Bu kayıt değiştirildi. Taslağın korundu; güncel kaydı açıp değişikliklerini birleştir.",
                });
            if (old?.kind === "comment" && old.createdBy !== user)
              return res.sendStatus(403);
            if (operation === "delete") {
              await tx.execute({
                sql: "DELETE FROM private_travel_entries WHERE trip_id=? AND (id=? OR (kind='comment' AND json_extract(data,'$.parentId')=?))",
                args: [tripId, id, id],
              });
              await tx.execute({
                sql: "DELETE FROM private_travel_votes WHERE entry_id=?",
                args: [id],
              });
              title = old!.data.title;
              action = "Kayıt silindi";
            } else {
              const actualKind = old?.kind ?? kind;
              if (!ENTRY_KINDS.includes(actualKind)) return res.sendStatus(400);
              const data = entryData(input, actualKind, configuredIds);
              if (!data)
                return res
                  .status(400)
                  .json({
                    error:
                      "Başlık, tarih, bağlantı ve sayısal değerleri kontrol et.",
                  });
              if (data.parentId) {
                const parent = await tx.execute({
                  sql: "SELECT id FROM private_travel_entries WHERE id=? AND trip_id=? AND kind!='comment'",
                  args: [data.parentId, tripId],
                });
                if (!parent.rows[0]) return res.sendStatus(400);
              }
              if (operation === "create") {
                const count = await tx.execute({
                  sql: "SELECT COUNT(*) AS count FROM private_travel_entries WHERE trip_id=?",
                  args: [tripId],
                });
                if (Number(count.rows[0].count) >= 2000)
                  return res
                    .status(409)
                    .json({
                      error: "Bu gezide en fazla 2.000 kayıt saklanabilir.",
                    });
                await tx.execute({
                  sql: "INSERT INTO private_travel_entries(id,trip_id,kind,data,created_by,updated_by,updated_at) VALUES (?,?,?,?,?,?,?)",
                  args: [
                    id,
                    tripId,
                    actualKind,
                    JSON.stringify(data),
                    user,
                    user,
                    now,
                  ],
                });
              } else {
                await tx.execute({
                  sql: "UPDATE private_travel_entries SET data=?,version=version+1,updated_by=?,updated_at=? WHERE id=? AND trip_id=?",
                  args: [JSON.stringify(data), user, now, id, tripId],
                });
                if (actualKind === "decision") {
                  const voteRows = await tx.execute({
                    sql: "SELECT user_id,choice FROM private_travel_votes WHERE entry_id=?",
                    args: [id],
                  });
                  for (const vote of voteRows.rows)
                    if (!data.options.includes(String(vote.choice))) {
                      await tx.execute({
                        sql: "DELETE FROM private_travel_votes WHERE entry_id=? AND user_id=?",
                        args: [id, vote.user_id],
                      });
                    }
                }
              }
              title = data.title;
              action =
                operation === "create" ? "Kayıt eklendi" : "Kayıt düzenlendi";
            }
          }
        }
        await tx.execute({
          sql: "UPDATE private_travel_trips SET revision=revision+1,updated_by=?,updated_at=? WHERE id=?",
          args: [user, now, tripId],
        });
        await tx.execute({
          sql: "INSERT INTO private_travel_changes(trip_id,name,actor,action,at) VALUES (?,?,?,?,?)",
          args: [tripId, title, user, action, now],
        });
        await tx.execute({
          sql: "DELETE FROM private_travel_changes WHERE trip_id=? AND id NOT IN (SELECT id FROM private_travel_changes WHERE trip_id=? ORDER BY id DESC LIMIT 100)",
          args: [tripId, tripId],
        });
        await tx.commit();
        res.json({ ok: true });
      } finally {
        tx.close();
      }
    }),
  );
  router.use((_req, res) => res.sendStatus(404));
  router.use(((error, _req, res, _next) => {
    res
      .status(error.status === 413 ? 413 : 400)
      .json({ error: "Gezi isteği geçersiz veya çok büyük." });
  }) as express.ErrorRequestHandler);
}
