import { Server, Socket } from "socket.io";
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { Lobby, HeroClass, Intent, Run } from "../games/dungeon/types";
import { CLASSES, DIFFICULTIES } from "../games/dungeon/definitions";
import {
  makeHero,
  createRun,
  applyIntent,
  step,
  alive,
  note,
} from "../games/dungeon/engine";
import { distance, line } from "../games/dungeon/generation";
interface Room extends Lobby {
  passwordHash: string;
  salt: string;
  sessions: Map<number, string>;
  gone: Map<number, number>;
  updated: number;
  lastMap: string;
  mapVersion: number;
  rewardBusy: boolean;
  rewardEligible?: number[];
}
type User = { id: number; username: string };
type DB = { execute: (q: any) => Promise<any> };
export class DungeonManager {
  rooms = new Map<string, Room>();
  membership = new Map<number, string>();
  joinAttempts = new Map<number, { at: number; count: number }>();
  timer: ReturnType<typeof setInterval>;
  dbReady = false;
  constructor(
    private io: Server,
    private db: DB | null,
  ) {
    this.timer = setInterval(() => this.tick(), 100);
    this.timer.unref?.();
  }
  async initialize() {
    if (!this.db) return;
    await this.db.execute(
      `CREATE TABLE IF NOT EXISTS dungeon_results (run_id TEXT NOT NULL, user_id INTEGER NOT NULL, won INTEGER NOT NULL, difficulty TEXT NOT NULL, ticks INTEGER NOT NULL, kills INTEGER NOT NULL, damage INTEGER NOT NULL, healing INTEGER NOT NULL, revives INTEGER NOT NULL, seed INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(run_id,user_id))`,
    );
    this.dbReady = true;
  }
  destroy() {
    clearInterval(this.timer);
    this.rooms.clear();
    this.membership.clear();
    this.joinAttempts.clear();
  }
  private hash(password: string, salt: string) {
    return createHash("sha256")
      .update(salt + "\0" + password)
      .digest("hex");
  }
  private assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw Error(message);
  }
  private get(socket: Socket, user: User) {
    const code = this.membership.get(user.id),
      r = code && this.rooms.get(code);
    this.assert(
      r && r.sessions.get(user.id) === socket.id,
      "Aktif oda oturumu bulunamadı.",
    );
    return r;
  }
  private publicRoom(r: Room) {
    const {
      code,
      name,
      host,
      capacity,
      private: priv,
      locked,
      difficulty,
      players,
    } = r;
    return {
      code,
      name,
      host,
      capacity,
      private: priv,
      locked,
      difficulty,
      players,
      persistence: this.dbReady,
      run: r.run ? this.snapshot(r.run) : undefined,
    };
  }
  private snapshot(run: Run) {
    const { floor, ...rest } = run;
    const visible = run.enemies.filter((e) =>
      run.players.some(
        (p) =>
          p.connected && alive(p) && distance(p, e) <= 9 && line(floor, p, e),
      ),
    );
    return {
      ...rest,
      enemies: visible,
      floor: {
        width: floor.width,
        height: floor.height,
        spawn: floor.spawn,
        exit: floor.exit,
        theme: floor.theme,
        rooms: floor.rooms,
        explored: floor.explored,
      },
    };
  }
  private map(r: Room) {
    if (!r.run) return;
    const encoded = r.run.depth + ":" + r.run.floor.tiles.join("");
    if (encoded === r.lastMap) return;
    r.lastMap = encoded;
    r.mapVersion++;
    this.io.to("dungeon:" + r.code).emit("dungeon:map", {
      depth: r.run.depth,
      version: r.mapVersion,
      floor: r.run.floor,
    });
  }
  private emit(r: Room) {
    this.map(r);
    this.io.to("dungeon:" + r.code).emit("dungeon:state", {
      ...this.publicRoom(r),
      mapVersion: r.mapVersion,
    });
  }
  private sync(socket: Socket, r: Room) {
    if (r.run)
      socket.emit("dungeon:map", {
        depth: r.run.depth,
        version: r.mapVersion,
        floor: r.run.floor,
      });
    socket.emit("dungeon:state", {
      ...this.publicRoom(r),
      mapVersion: r.mapVersion,
    });
  }
  private leave(socket: Socket, user: User, explicit: boolean) {
    const code = this.membership.get(user.id),
      r = code && this.rooms.get(code);
    if (!r || r.sessions.get(user.id) !== socket.id) return;
    socket.leave("dungeon:" + r.code);
    r.sessions.delete(user.id);
    const p = r.players.find((p) => p.id === user.id);
    if (p) {
      p.connected = false;
      p.ready = false;
      p.revive = undefined;
    }
    r.updated = Date.now();
    if (!r.run || r.run.status !== "playing") {
      r.players = r.players.filter((p) => p.id !== user.id);
      this.membership.delete(user.id);
    } else {
      r.gone.set(user.id, Date.now() + (explicit ? 0 : 60000));
      if (explicit && p) {
        p.dead = true;
        p.hp = 0;
        this.membership.delete(user.id);
        note(r.run, `${p.name} seferden ayrıldı.`);
      }
    }
    if (r.host === user.id)
      r.host = r.players.find((p) => p.connected)?.id || r.players[0]?.id || 0;
    if (
      !r.players.length &&
      (!r.run || !this.dbReady || r.run.rewardState === "saved")
    ) {
      this.rooms.delete(r.code);
    } else this.emit(r);
  }
  register(socket: Socket, user: User) {
    if (!Number.isSafeInteger(Number(user?.id)) || Number(user.id) <= 0) return;
    user = { id: Number(user.id), username: String(user.username || "Kaşif") };
    let windowAt = Date.now(),
      count = 0;
    const on = (name: string, handler: (data: any) => any) =>
      socket.on("dungeon:" + name, async (data: any, ack?: Function) => {
        const reply = typeof ack === "function" ? ack : () => {};
        try {
          const now = Date.now();
          if (now - windowAt > 1000) {
            windowAt = now;
            count = 0;
          }
          this.assert(++count <= 25, "Çok hızlı işlem yapıyorsun.");
          this.assert(
            data === undefined ||
              (data !== null &&
                typeof data === "object" &&
                !Array.isArray(data)),
            "Geçersiz istek.",
          );
          if (data)
            this.assert(
              JSON.stringify(data).length <= 1024,
              "İstek çok büyük.",
            );
          const result = await handler(data || {});
          reply({ ok: true, ...result });
        } catch (e) {
          reply({
            ok: false,
            error: e instanceof Error ? e.message : "İşlem yapılamadı.",
          });
        }
      });
    on("list", () => ({
      rooms: [...this.rooms.values()]
        .filter((r) => !r.private && !r.run)
        .map((r) => ({
          code: r.code,
          name: r.name,
          players: r.players.length,
          capacity: r.capacity,
          difficulty: r.difficulty,
          locked: r.locked,
        })),
    }));
    on("create", (d) => {
      this.assert(!this.membership.has(user.id), "Önce mevcut odadan ayrıl.");
      this.assert(this.rooms.size < 100, "Sunucu oda kapasitesine ulaştı.");
      this.assert([2, 3, 4].includes(d.capacity), "Kapasite 2–4 olmalı.");
      this.assert(
        Object.hasOwn(DIFFICULTIES, d.difficulty),
        "Geçersiz zorluk.",
      );
      this.assert(
        typeof d.name === "string" &&
          d.name.trim().length > 0 &&
          d.name.length <= 40,
        "Oda adı 1–40 karakter olmalı.",
      );
      this.assert(
        typeof d.password === "string" && d.password.length <= 64,
        "Şifre en fazla 64 karakter olmalı.",
      );
      let code = "";
      do {
        code = randomBytes(5).toString("hex").toUpperCase();
      } while (this.rooms.has(code));
      const salt = randomBytes(16).toString("hex");
      const r: Room = {
        code,
        name: d.name.trim(),
        host: user.id,
        capacity: d.capacity,
        private: !!d.private,
        locked: !!d.password,
        difficulty: d.difficulty,
        players: [makeHero(user.id, user.username)],
        passwordHash: this.hash(d.password, salt),
        salt,
        sessions: new Map([[user.id, socket.id]]),
        gone: new Map(),
        updated: Date.now(),
        lastMap: "",
        mapVersion: 0,
        rewardBusy: false,
      };
      this.rooms.set(code, r);
      this.membership.set(user.id, code);
      socket.join("dungeon:" + code);
      this.sync(socket, r);
      return { code };
    });
    on("join", (d) => {
      this.assert(
        typeof d.code === "string" && /^[A-F0-9]{10}$/i.test(d.code),
        "Geçersiz oda kodu.",
      );
      const r = this.rooms.get(d.code.toUpperCase());
      this.assert(
        r,
        "Oda bulunamadı; sunucu yeniden başlamış veya oda kapanmış olabilir.",
      );
      const old = this.membership.get(user.id);
      this.assert(!old || old === r.code, "Önce mevcut odadan ayrıl.");
      let p = r.players.find((p) => p.id === user.id);
      if (p) {
        this.assert(
          !p.dead || r.run?.status !== "playing" || old === r.code,
          "Bu seferden ayrıldın.",
        );
        const previous = r.sessions.get(user.id);
        if (previous && previous !== socket.id) {
          const oldSocket = this.io.sockets.sockets.get(previous);
          oldSocket?.leave("dungeon:" + r.code);
          oldSocket?.emit("dungeon:replaced");
        }
        p.connected = true;
        r.gone.delete(user.id);
      } else {
        this.assert(!r.run, "Başlayan sefere yeni oyuncu alınmıyor.");
        this.assert(r.players.length < r.capacity, "Oda dolu.");
        const attempts = this.joinAttempts.get(user.id);
        const budget =
          attempts && Date.now() - attempts.at < 60000
            ? attempts
            : { at: Date.now(), count: 0 };
        this.joinAttempts.set(user.id, budget);
        this.assert(
          ++budget.count <= 10,
          "Çok fazla katılım denemesi. Bir dakika bekleyin.",
        );
        if (r.locked) {
          this.assert(
            typeof d.password === "string" && d.password.length <= 64,
            "Şifre gerekli.",
          );
          this.assert(
            timingSafeEqual(
              Buffer.from(this.hash(d.password, r.salt)),
              Buffer.from(r.passwordHash),
            ),
            "Oda şifresi yanlış.",
          );
        }
        p = makeHero(user.id, user.username);
        r.players.push(p);
      }
      r.sessions.set(user.id, socket.id);
      this.membership.set(user.id, r.code);
      socket.join("dungeon:" + r.code);
      r.updated = Date.now();
      this.emit(r);
      this.sync(socket, r);
      return { code: r.code };
    });
    on("resume", () => {
      const code = this.membership.get(user.id);
      if (!code) return { code: null };
      return { code };
    });
    on("sync", () => {
      this.sync(socket, this.get(socket, user));
      return {};
    });
    on("class", (d) => {
      const r = this.get(socket, user);
      this.assert(!r.run, "Sefer sırasında sınıf değişmez.");
      this.assert(Object.hasOwn(CLASSES, d.hero), "Geçersiz sınıf.");
      const i = r.players.findIndex((p) => p.id === user.id);
      r.players[i] = makeHero(user.id, user.username, d.hero as HeroClass);
      this.emit(r);
      return {};
    });
    on("ready", (d) => {
      const r = this.get(socket, user);
      this.assert(!r.run, "Sefer zaten başladı.");
      r.players.find((p) => p.id === user.id)!.ready = d.ready === true;
      this.emit(r);
      return {};
    });
    on("start", () => {
      const r = this.get(socket, user);
      this.assert(r.host === user.id, "Yalnızca oda sahibi başlatabilir.");
      this.assert(!r.run, "Sefer zaten başladı.");
      this.assert(
        r.players.length >= 2 && r.players.every((p) => p.ready && p.connected),
        "En az iki oyuncu bağlı ve herkes hazır olmalı.",
      );
      r.run = createRun(
        randomUUID(),
        randomBytes(4).readUInt32LE(),
        r.difficulty,
        r.players,
      );
      r.players = r.run.players;
      this.emit(r);
      return {};
    });
    on("input", (d) => {
      const r = this.get(socket, user);
      this.assert(r.run, "Sefer başlamadı.");
      const error = applyIntent(r.run, user.id, d as Intent);
      this.assert(!error, error || "");
      return { seq: d.seq };
    });
    on("leave", () => {
      this.leave(socket, user, true);
      return {};
    });
    on("profile", async () => {
      if (!this.dbReady) return { available: false };
      const result = await this.db!.execute({
        sql: "SELECT COUNT(*) AS runs, COALESCE(SUM(won),0) AS wins, COALESCE(SUM(kills),0) AS kills, COALESCE(SUM(revives),0) AS revives FROM dungeon_results WHERE user_id = ?",
        args: [user.id],
      });
      const stats = result.rows[0];
      return {
        available: true,
        ...stats,
        title:
          Number(stats.wins) >= 10
            ? "Zindan Ustası"
            : Number(stats.wins) >= 1
              ? "Kuşatma Kahramanı"
              : "Yeni Kaşif",
      };
    });
    socket.on("disconnect", () => this.leave(socket, user, false));
  }
  async persist(r: Room) {
    if (
      !this.dbReady ||
      !r.run ||
      r.run.status === "playing" ||
      r.run.rewardState === "saved" ||
      r.rewardBusy
    )
      return;
    r.rewardBusy = true;
    r.run.rewardState = "saving";
    const run = r.run;
    r.rewardEligible ??= run.players
      .filter((p) => this.membership.get(p.id) === r.code)
      .map((p) => p.id);
    try {
      for (const p of run.players) {
        await this.db!.execute({
          sql: "INSERT OR IGNORE INTO dungeon_results (run_id,user_id,won,difficulty,ticks,kills,damage,healing,revives,seed,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          args: [
            run.id,
            p.id,
            run.status === "won" && r.rewardEligible.includes(p.id) ? 1 : 0,
            run.difficulty,
            run.tick,
            p.stats.kills,
            Math.round(p.stats.damage),
            Math.round(p.stats.healing),
            p.stats.revives,
            run.seed,
            new Date().toISOString(),
          ],
        });
      }
      run.rewardState = "saved";
    } catch {
      run.rewardState = "retry";
    } finally {
      r.rewardBusy = false;
    }
  }
  tick() {
    const now = Date.now();
    for (const [id, budget] of this.joinAttempts)
      if (now - budget.at >= 60000) this.joinAttempts.delete(id);
    for (const r of this.rooms.values()) {
      for (const [id, expiry] of r.gone) {
        if (now < expiry) continue;
        const p = r.players.find((p) => p.id === id);
        if (p && !p.connected) {
          p.dead = true;
          p.hp = 0;
          r.gone.delete(id);
          if (this.membership.get(id) === r.code) this.membership.delete(id);
        }
      }
      if (r.run && r.run.status === "playing") {
        step(r.run);
        if (r.run.status !== "playing")
          void this.persist(r).then(() => this.emit(r));
        this.emit(r);
      }
      if (
        r.run &&
        r.run.status !== "playing" &&
        r.run.rewardState !== "saved" &&
        now % 5000 < 110
      )
        void this.persist(r).then(() => this.emit(r));
      if (!r.players.some((p) => p.connected) && now - r.updated > 120000) {
        if (r.run && this.dbReady && r.run.rewardState !== "saved") {
          void this.persist(r);
          continue;
        }
        this.rooms.delete(r.code);
        for (const p of r.players)
          if (this.membership.get(p.id) === r.code)
            this.membership.delete(p.id);
      }
    }
  }
}
