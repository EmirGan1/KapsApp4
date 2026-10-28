import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import {
  CLASSES,
  DIFFICULTIES,
  RARITIES,
  SIGNALS,
} from "../../../games/dungeon/definitions";
import {
  Lobby,
  Run,
  Floor,
  HeroClass,
  Point,
  Intent,
  Item,
} from "../../../games/dungeon/types";
import DungeonCanvas from "./DungeonCanvas";
import "./dungeon.css";
interface Props {
  socket: Socket | null;
  currentUserId: number;
  onBack: () => void;
}
const effectLabels: Record<string, string> = {
  burn: "Yanma",
  poison: "Zehir",
  freeze: "Donma",
  slow: "Yavaş",
  stun: "Sersem",
  vulnerable: "Kırılgan",
  guard: "Koruma",
  regen: "Yenilenme",
};
const itemText = (i: Item) =>
  i.slot === "weapon"
    ? `Hasar +%${i.power * 8}`
    : i.slot === "armor"
      ? `Can +${i.power * 8}, zırh +${i.power * 3}`
      : i.slot === "charm"
        ? `Bekleme −%${Math.min(30, i.power * 2.5)}`
        : {
            icefield: "Buz Halkası yavaşlatıcı alan bırakır.",
            echo: "Ateş Topu ikinci patlama oluşturur.",
            lifeline: "Canlandırma, iki dosta koruma sağlar.",
            vampire: "Kritik kılıç ve alan darbeleri 4 kaynak kazandırır.",
          }[i.effect!];
export default function DungeonGame({ socket, currentUserId, onBack }: Props) {
  const [room, setRoom] = useState<Lobby | null>(null),
    [map, setMap] = useState<{
      floor: Floor;
      depth: number;
      version: number;
    } | null>(null),
    [rooms, setRooms] = useState<any[]>([]),
    [connected, setConnected] = useState(!!socket?.connected),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [panel, setPanel] = useState<
      "help" | "bag" | "settings" | "profile" | null
    >(null),
    [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState("Dostların Seferi"),
    [capacity, setCapacity] = useState(4),
    [difficulty, setDifficulty] = useState("explorer"),
    [privateRoom, setPrivateRoom] = useState(false),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [target, setTarget] = useState<Point>({ x: 0, y: 0 }),
    [ally, setAlly] = useState(currentUserId),
    [contrast, setContrast] = useState(false),
    [font, setFont] = useState(16),
    [sound, setSound] = useState(false);
  const seq = useRef(0),
    state = useRef<Lobby | null>(null),
    held = useRef<[number, number] | null>(null),
    lastLog = useRef(0),
    audio = useRef<AudioContext | null>(null),
    mounted = useRef(true),
    version = useRef(0),
    replaced = useRef(false);
  const run =
    room?.run &&
    map?.depth === room.run.depth &&
    map.version === version.current
      ? ({
          ...room.run,
          floor: { ...room.run.floor, tiles: map.floor.tiles },
        } as Run)
      : null;
  const me = (run?.players || room?.players || []).find(
    (p) => p.id === currentUserId,
  );
  const call = (event: string, data: any = {}, done?: (r: any) => void) => {
    if (!socket?.connected) {
      setError("Bağlantı yok. Yeniden bağlanmayı bekle.");
      return;
    }
    socket
      .timeout(5000)
      .emit("dungeon:" + event, data, (err: any, result: any) => {
        if (!mounted.current) return;
        setBusy(false);
        if (err)
          setError(
            "Sunucu yanıt vermedi. Bağlantıyı kontrol edip yeniden dene.",
          );
        else if (!result?.ok) setError(result?.error || "İşlem yapılamadı.");
        else {
          setError("");
          done?.(result);
        }
      });
  };
  const input = (action: Intent["action"], data: Partial<Intent> = {}) => {
    const r = state.current?.run;
    if (!r || r.status !== "playing" || !socket?.connected || replaced.current)
      return;
    const payload = { ...data, action, floor: r.depth, seq: ++seq.current };
    socket
      .timeout(3000)
      .emit("dungeon:input", payload, (err: any, result: any) => {
        if (!mounted.current) return;
        if (err) setError("Komut onaylanmadı; bağlantı kontrol ediliyor.");
        else if (!result?.ok && result?.error !== "Hareket bekleniyor.")
          setError(result.error);
        else setError("");
      });
  };
  useEffect(() => {
    mounted.current = true;
    if (!socket) return;
    const refresh = () => {
      setConnected(true);
      replaced.current = false;
      call("resume", {}, (r) => {
        if (r.code) call("join", { code: r.code });
        else {
          const hadRun = !!state.current;
          state.current = null;
          setRoom(null);
          setMap(null);
          held.current = null;
          call("list", {}, (r) => {
            setRooms(r.rooms);
            if (hadRun)
              setError(
                "Önceki oda artık mevcut değil. Geri dönüş süresi dolmuş veya sunucu yeniden başlamış olabilir.",
              );
          });
        }
      });
    };
    const update = (r: any) => {
      if (replaced.current) return;
      version.current = r.mapVersion || 0;
      state.current = r;
      setRoom(r);
      const p = (r.run?.players || r.players).find(
        (a: any) => a.id === currentUserId,
      );
      seq.current = Math.max(seq.current, p?.seq || 0);
    };
    const mapUpdate = (m: any) => {
      setMap((old) => {
        if (!old || old.depth !== m.depth) setTarget(m.floor.spawn);
        return m;
      });
    };
    const disconnected = () => {
      setConnected(false);
      held.current = null;
    };
    const replacedHandler = () => {
      replaced.current = true;
      held.current = null;
      state.current = null;
      setRoom(null);
      setMap(null);
      setError("Bu hesap başka sekmede açıldı. Kontrol o sekmeye geçti.");
    };
    socket.on("dungeon:state", update);
    socket.on("dungeon:map", mapUpdate);
    socket.on("disconnect", disconnected);
    socket.on("connect", refresh);
    socket.on("dungeon:replaced", replacedHandler);
    refresh();
    return () => {
      mounted.current = false;
      held.current = null;
      socket.off("dungeon:state", update);
      socket.off("dungeon:map", mapUpdate);
      socket.off("disconnect", disconnected);
      socket.off("connect", refresh);
      socket.off("dungeon:replaced", replacedHandler);
      audio.current?.close();
      audio.current = null;
    };
  }, [socket, currentUserId]);
  useEffect(() => {
    if (!sound || !run) return;
    const log = run.log.at(-1);
    if (!log || log.id <= lastLog.current) return;
    lastLog.current = log.id;
    try {
      const ctx = audio.current;
      if (!ctx || ctx.state !== "running") return;
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value =
        run.status === "won"
          ? 660
          : run.status === "lost"
            ? 130
            : log.text.includes("yere")
              ? 180
              : 420;
      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  }, [run?.log.at(-1)?.id, sound]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        held.current &&
        !document.hidden &&
        document.getElementById("dungeon-game")?.getClientRects().length
      )
        input("move", { dx: held.current[0], dy: held.current[1] });
    }, 200);
    const stop = () => {
      held.current = null;
    };
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      clearInterval(timer);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [socket]);
  useEffect(() => {
    const keys: Record<string, [number, number]> = {
      w: [0, -1],
      ArrowUp: [0, -1],
      s: [0, 1],
      ArrowDown: [0, 1],
      a: [-1, 0],
      ArrowLeft: [-1, 0],
      d: [1, 0],
      ArrowRight: [1, 0],
    };
    const down = (e: KeyboardEvent) => {
      if (
        !state.current?.run ||
        panel ||
        document.hidden ||
        !document.getElementById("dungeon-game")?.getClientRects().length ||
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,button,[contenteditable="true"]',
        )
      )
        return;
      if (keys[e.key]) {
        e.preventDefault();
        if (!e.repeat) {
          held.current = keys[e.key];
          input("move", { dx: keys[e.key][0], dy: keys[e.key][1] });
        }
      } else if (!e.repeat) {
        if (
          ["0", "1", "2", "3", "4", "r", "e", "p", "Tab", "Escape"].includes(
            e.key,
          )
        )
          e.preventDefault();
        if (/^[0-4]$/.test(e.key))
          input("cast", { slot: Number(e.key), ...target, target: ally });
        if (e.key === "r") input("cast", { slot: 4, ...target, target: ally });
        if (e.key === "e") input("interact");
        if (e.key === "p") input("potion");
        if (e.key === "Tab") setPanel("bag");
        if (e.key === "Escape") setPanel("settings");
      }
    };
    const up = (e: KeyboardEvent) => {
      if (keys[e.key]) held.current = null;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [socket, target, ally, panel]);
  useEffect(() => {
    if (panel) held.current = null;
  }, [panel]);
  useEffect(() => {
    if (!panel) return;
    const overlay = document.querySelector<HTMLElement>(".ds-overlay"),
      before = document.activeElement as HTMLElement | null;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !overlay) return;
      const nodes = Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ),
      );
      const first = nodes[0],
        last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    overlay?.addEventListener("keydown", trap);
    return () => {
      overlay?.removeEventListener("keydown", trap);
      before?.focus();
    };
  }, [panel]);
  const leave = () => {
    held.current = null;
    call("leave", {}, () => {
      state.current = null;
      setRoom(null);
      setMap(null);
      setPanel(null);
      call("list", {}, (r) => setRooms(r.rooms));
    });
  };
  const useSkill = (slot: number) => {
    let pos = target;
    if (slot === 0 && run && me) {
      const e = run.enemies
        .filter(
          (e) => Math.hypot(e.x - me.x, e.y - me.y) <= CLASSES[me.hero].range,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - target.x, a.y - target.y) -
            Math.hypot(b.x - target.x, b.y - target.y),
        )[0];
      if (e) pos = e;
    }
    input("cast", { slot, ...pos, target: ally });
  };
  const openProfile = () => {
    setPanel("profile");
    call("profile", {}, setProfile);
  };
  return (
    <section
      id="dungeon-game"
      className={`ds-root ${run ? "ds-active" : ""} ${contrast ? "ds-contrast" : ""}`}
      style={{ fontSize: font }}
    >
      <header className="ds-header">
        <div>
          <span className="ds-eyebrow">KAPSAPP · CO-OP ROGUELITE</span>
          <h1>Zindan Kuşatması</h1>
        </div>
        <div className="ds-header-actions">
          <span className={connected ? "ds-online" : "ds-offline"}>
            {connected ? "● Bağlı" : "○ Bağlantı kesildi"}
          </span>
          <button onClick={() => setPanel("help")} aria-label="Nasıl oynanır">
            ?
          </button>
          <button
            onClick={() => setPanel("settings")}
            aria-label="Oyun ayarları"
          >
            ⚙
          </button>
          {!room ? (
            <button onClick={onBack}>Oyunlara dön</button>
          ) : (
            <button
              onClick={onBack}
              title="Sefer devam eder; oyun merkezinden geri dönebilirsin"
            >
              Küçült
            </button>
          )}
        </div>
      </header>
      {!connected && (
        <div role="status" className="ds-notice">
          Bağlantı yeniden kuruluyor. Seferdeki karakterin 60 saniye korunur;
          canı ve etkileri sıfırlanmaz.
        </div>
      )}
      {error && (
        <div role="alert" className="ds-error">
          {error}
          <button aria-label="Uyarıyı kapat" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {!room ? (
        <main className="ds-menu">
          <div className="ds-intro">
            <div className="ds-seal">
              W <span>✦</span> M <span>✦</span> H
            </div>
            <p className="ds-eyebrow">BİRLİKTE GİRİN. BİRLİKTE ÇIKIN.</p>
            <h2>
              Karanlıkta en güçlü
              <br />
              silahın, ekibin.
            </h2>
            <p>
              2–4 gerçek oyuncu. Üç sınıf, üç kat ve her seferde değişen bir
              zindan. Muhafızları yenin, dostlarınızı kaldırın, çıkışı birlikte
              bulun.
            </p>
            <div className="ds-tags">
              <span>Sunucu yönetimli savaş</span>
              <span>Oyuncuya özel ganimet</span>
              <span>Dokunmatik kontroller</span>
            </div>
            <button onClick={openProfile}>Sefer geçmişim</button>
            <button onClick={() => setPanel("help")}>Sınıflar ve rehber</button>
          </div>
          <div className="ds-menu-forms">
            <form
              className="ds-card"
              onSubmit={(e) => {
                e.preventDefault();
                setBusy(true);
                call("create", {
                  name,
                  capacity,
                  difficulty,
                  private: privateRoom,
                  password,
                });
              }}
            >
              <h2>Yeni sefer hazırla</h2>
              <label>
                Oda adı
                <input
                  maxLength={40}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div className="ds-row">
                <label>
                  Kapasite
                  <select
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                  >
                    {[2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} oyuncu
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Zorluk
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    {Object.entries(DIFFICULTIES).map(([k, d]) => (
                      <option key={k} value={k}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Oda şifresi (isteğe bağlı)
                <input
                  type="password"
                  autoComplete="new-password"
                  maxLength={64}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="ds-check">
                <input
                  type="checkbox"
                  checked={privateRoom}
                  onChange={(e) => setPrivateRoom(e.target.checked)}
                />{" "}
                Listelemede gizle; kodla katılım
              </label>
              <button className="ds-primary" disabled={!connected || busy}>
                Odayı oluştur
              </button>
            </form>
            <form
              className="ds-card"
              onSubmit={(e) => {
                e.preventDefault();
                call("join", { code: code.trim(), password });
              }}
            >
              <h2>Ekibine katıl</h2>
              <label>
                Oda kodu
                <input
                  maxLength={10}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  placeholder="10 karakterli kod"
                  required
                />
              </label>
              <label>
                Katılım şifresi
                <input
                  type="password"
                  autoComplete="off"
                  maxLength={64}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button disabled={!connected}>Kodla katıl</button>
            </form>
          </div>
          <div className="ds-card ds-public">
            <div className="ds-row">
              <h2>Açık seferler</h2>
              <button
                onClick={() => call("list", {}, (r) => setRooms(r.rooms))}
              >
                Yenile
              </button>
            </div>
            {rooms.length ? (
              rooms.map((r) => (
                <div className="ds-room-row" key={r.code}>
                  <span>
                    {r.name} · {r.players}/{r.capacity} ·{" "}
                    {
                      DIFFICULTIES[r.difficulty as keyof typeof DIFFICULTIES]
                        .name
                    }{" "}
                    {r.locked ? "🔒" : ""}
                  </span>
                  <button
                    onClick={() => {
                      setCode(r.code);
                      if (r.locked)
                        setError(
                          "Oda şifresini Katılım şifresi alanına yazıp Kodla katıl düğmesine bas.",
                        );
                      else call("join", { code: r.code, password: "" });
                    }}
                  >
                    Katıl
                  </button>
                </div>
              ))
            ) : (
              <p>
                Henüz açık oda yok. Bir oda oluşturup kodunu arkadaşlarınla
                paylaş.
              </p>
            )}
          </div>
        </main>
      ) : !room.run ? (
        <main className="ds-wait">
          <div className="ds-card">
            <p className="ds-eyebrow">
              SEFER HAZIRLIĞI · {DIFFICULTIES[room.difficulty].name}
            </p>
            <h2>{room.name}</h2>
            <div className="ds-row">
              <code className="ds-code">{room.code}</code>
              <button
                onClick={() =>
                  navigator.clipboard
                    ?.writeText(room.code)
                    .then(() => setError("Oda kodu kopyalandı."))
                    .catch(() => setError("Kodu seçerek kopyalayabilirsin."))
                }
              >
                Kodu kopyala
              </button>
            </div>
            <p>
              En az 2 kişi gerekir. Aynı sınıf birden fazla seçilebilir; her
              sınıf dostunu canlandırabilir.
            </p>
            <div className="ds-class-grid">
              {Object.entries(CLASSES).map(([k, c]) => (
                <button
                  key={k}
                  className={`ds-class ${me?.hero === k ? "selected" : ""}`}
                  onClick={() => call("class", { hero: k })}
                >
                  <strong style={{ color: c.color }}>
                    {c.symbol} · {c.name}
                  </strong>
                  <span>{c.description}</span>
                  <small>
                    {c.hp} CAN · {c.mana} KAYNAK
                  </small>
                </button>
              ))}
            </div>
            <div className="ds-party-list">
              {room.players.map((p) => (
                <div key={p.id}>
                  <strong>
                    {CLASSES[p.hero].symbol} · {p.name}{" "}
                    {p.id === room.host ? "♛" : ""}
                  </strong>
                  <span>
                    {p.connected
                      ? p.ready
                        ? "Hazır ✓"
                        : "Hazırlanıyor"
                      : "Bağlantı kesildi"}
                  </span>
                </div>
              ))}
            </div>
            <div className="ds-row">
              <button
                className="ds-primary"
                disabled={!connected}
                onClick={() => call("ready", { ready: !me?.ready })}
              >
                {me?.ready ? "Hazır değilim" : "Hazırım"}
              </button>
              {room.host === currentUserId && (
                <button
                  disabled={
                    !connected ||
                    room.players.length < 2 ||
                    !room.players.every((p) => p.ready && p.connected)
                  }
                  onClick={() => call("start")}
                >
                  Seferi başlat
                </button>
              )}
              <button onClick={leave}>Odadan ayrıl</button>
            </div>
          </div>
        </main>
      ) : !run ? (
        <div className="ds-card" role="status">
          Zindan eşitleniyor…{" "}
          <button onClick={() => call("sync")}>Yeniden eşitle</button>
        </div>
      ) : (
        <main className="ds-play">
          <div className="ds-objective">
            <div>
              <b>
                {run.depth}/3 · {run.floor.theme}
              </b>
              <span>
                {run.floor.rooms.filter((r) => r.cleared && !r.optional).length}
                /{run.floor.rooms.filter((r) => !r.optional).length} oda ·{" "}
                {run.transitionAt
                  ? "Çıkış hazırlanıyor…"
                  : "Odaları temizle · ◈ mührü aç · ⇩ çıkışta toplan"}
              </span>
            </div>
            <button onClick={() => setPanel("bag")}>
              Çanta ({me?.inventory.length}/8)
            </button>
          </div>
          <div className="ds-party">
            {run.players.map((p) => (
              <button
                key={p.id}
                className={ally === p.id ? "selected" : ""}
                onClick={() => setAlly(p.id)}
                title="Şifa ve kalkan hedefi seç"
              >
                <span style={{ color: CLASSES[p.hero].color }}>
                  {CLASSES[p.hero].symbol} {p.name}
                  {p.id === currentUserId ? " (sen)" : ""}
                </span>
                <small>
                  {p.dead
                    ? "Bu katta düştü"
                    : p.hp === 0
                      ? `Yerde · ${Math.max(0, Math.ceil((p.downUntil - run.tick) / 10))} sn`
                      : `${Math.ceil(p.hp)}/${p.maxHp} ♥ ${p.shield ? " +" + p.shield + " kalkan" : ""}`}{" "}
                  {!p.connected ? " · Çevrim dışı" : ""}
                </small>
                <meter
                  aria-label={`${p.name} can`}
                  min={0}
                  max={p.maxHp}
                  value={p.hp}
                />
              </button>
            ))}
          </div>
          <div className="ds-viewport">
            <DungeonCanvas
              run={run}
              userId={currentUserId}
              target={target}
              onTarget={(pos) => {
                setTarget(pos);
                const friend = run.players.find(
                  (p) => p.x === pos.x && p.y === pos.y,
                );
                if (friend) setAlly(friend.id);
              }}
              contrast={contrast}
            />
            {me?.hp === 0 && (
              <div className="ds-down">
                {me.dead
                  ? "Bu katta düştün. Ekip sonraki kata ulaşırsa geri dönebilirsin."
                  : "Yere düştün. Bir dostun yanına gelip Etkileşim ile seni kaldırabilir."}
              </div>
            )}
          </div>
          <div className="ds-status">
            <span>
              Kaynak: {Math.floor(me?.mana || 0)}/{me?.maxMana}
            </span>
            <span>
              {me?.effects.map((e) => effectLabels[e.kind]).join(" · ") ||
                "Durum: hazır"}
            </span>
            <span>
              Hedef: {target.x}, {target.y}
            </span>
          </div>
          <div className="ds-controls">
            <div className="ds-dpad">
              {(
                [
                  [0, -1, "↑"],
                  [-1, 0, "←"],
                  [0, 1, "↓"],
                  [1, 0, "→"],
                ] as const
              ).map(([dx, dy, label]) => (
                <button
                  key={label}
                  aria-label={
                    { "↑": "Yukarı", "←": "Sola", "↓": "Aşağı", "→": "Sağa" }[
                      label
                    ]
                  }
                  style={{
                    gridColumn: dx === 0 ? 2 : dx === -1 ? 1 : 3,
                    gridRow: dy === -1 ? 1 : 2,
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    held.current = [dx, dy];
                    input("move", { dx, dy });
                  }}
                  onPointerUp={() => (held.current = null)}
                  onPointerCancel={() => (held.current = null)}
                  onLostPointerCapture={() => (held.current = null)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="ds-hotbar">
              {me &&
                CLASSES[me.hero].skills.map((s, i) => (
                  <button
                    key={s.name}
                    disabled={
                      !connected ||
                      me.hp <= 0 ||
                      me.cooldowns[i] > run.tick ||
                      me.mana < s.cost
                    }
                    title={s.description}
                    onClick={() => useSkill(i)}
                  >
                    <small>
                      {i === 0 ? "0 · SALDIRI" : i === 4 ? "4 / R" : i} ·{" "}
                      {s.cost} kaynak
                    </small>
                    <strong>{s.name}</strong>
                    <span>
                      {me.cooldowns[i] > run.tick
                        ? `${Math.ceil((me.cooldowns[i] - run.tick) / 10)} sn`
                        : i === 0
                          ? "Saldır"
                          : "Hazır"}
                    </span>
                  </button>
                ))}
            </div>
            <div className="ds-utility">
              <select
                aria-label="Dost hedefi"
                value={ally}
                onChange={(e) => setAlly(Number(e.target.value))}
              >
                {run.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {Math.ceil(p.hp)} ♥
                  </option>
                ))}
              </select>
              <button
                onClick={() => input("interact")}
                disabled={!connected || me?.hp === 0}
              >
                {me?.revive
                  ? `Canlandırma ${Math.max(0, Math.ceil((me.revive.until - run.tick) / 10))} sn`
                  : "E · Etkileşim"}
              </button>
              <button
                onClick={() => input("potion")}
                disabled={!connected || !me?.potions || me.hp === 0}
              >
                P · İksir ({me?.potions})
              </button>
            </div>
          </div>
          <details className="ds-log">
            <summary>İşaretler ve savaş günlüğü</summary>
            <div className="ds-row">
              {SIGNALS.map((s, i) => (
                <button key={s} onClick={() => input("ping", { signal: i })}>
                  {s}
                </button>
              ))}
            </div>
            {run.log
              .slice(-8)
              .reverse()
              .map((l) => (
                <p key={l.id}>
                  {Math.floor(l.tick / 10)} sn · {l.text}
                </p>
              ))}
          </details>
          {run.status !== "playing" && (
            <div
              className="ds-result"
              role="dialog"
              aria-modal="true"
              aria-label="Sefer sonucu"
            >
              <div className="ds-card">
                <p className="ds-eyebrow">SEFER TAMAMLANDI</p>
                <h2>
                  {run.status === "won"
                    ? "Karanlık geride kaldı."
                    : "Bu kez zindan kazandı."}
                </h2>
                <p>
                  {DIFFICULTIES[run.difficulty].name} ·{" "}
                  {Math.floor(run.tick / 600)} dk{" "}
                  {Math.floor(run.tick / 10) % 60} sn · {run.kills} düşman ·{" "}
                  {run.depth}/3 kat
                </p>
                <div className="ds-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Oyuncu</th>
                        <th>Hasar</th>
                        <th>Şifa</th>
                        <th>Canlandırma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.players.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td>{Math.round(p.stats.damage)}</td>
                          <td>{Math.round(p.stats.healing)}</td>
                          <td>{p.stats.revives}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>Tohum: {run.seed}</p>
                <p>
                  {!room.persistence
                    ? "Bu sunucuda kalıcı sefer kaydı kullanılamıyor."
                    : run.rewardState === "saved"
                      ? "Sonuç hesap geçmişine kaydedildi."
                      : run.rewardState === "retry"
                        ? "Kayıt geçici olarak başarısız; sunucu yeniden deniyor."
                        : "Sefer sonucu kaydediliyor…"}
                </p>
                <button className="ds-primary" onClick={leave}>
                  Yeni sefere hazırlan
                </button>
              </div>
            </div>
          )}
        </main>
      )}
      {panel && (
        <div
          className="ds-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={
            panel === "help"
              ? "Oyun rehberi"
              : panel === "bag"
                ? "Çanta"
                : panel === "settings"
                  ? "Ayarlar"
                  : "Geçmiş"
          }
          onKeyDown={(e) => {
            if (e.key === "Escape") setPanel(null);
          }}
        >
          <div className="ds-card ds-panel">
            <button
              className="ds-close"
              autoFocus
              onClick={() => setPanel(null)}
            >
              Kapat ×
            </button>
            {panel === "help" ? (
              <>
                <p className="ds-eyebrow">KEŞFET · KORU · BİRLİKTE ÇIK</p>
                <h2>Kısa oyun rehberi</h2>
                <p>
                  WASD / yön tuşları veya yön düğmeleri: hareket. Haritaya
                  dokun: hedef seç. 0: saldırı; 1–3: yetenek; 4 / R: ulti; E:
                  etkileşim; P: iksir.
                </p>
                <p>
                  Şifa için üstteki dost kartını seç. Kırmızı “!” alanlarından
                  saldırı gerçekleşmeden çık. Yere düşen dostunun yanında E’ye
                  bas; hareket etmek, yetenek kullanmak veya hasar almak
                  canlandırmayı keser.
                </p>
                <p>
                  ▤ sandık ve ◇ sunak her oyuncuya ayrı ◆ ganimet bırakır. E ile
                  al, Çanta’dan kuşan. ♥ / ✦ sunakları yakın ekibe bir kez
                  kaynak verir. ◈ / ⚿ mührü açar. Dokuz zorunlu oda tamamlanınca
                  ⇩ çıkışında toplanıp E’ye bas.
                </p>
                <p>
                  Kristal ≈ yavaşlatır; ^ tuzak ve ♨ ateş hasar verir. Her
                  katta bir boss vardır. Doğudaki hazine kolu isteğe bağlıdır.
                  Üçüncü kat çıkışını kullanmak zaferdir. Savaş gerçek
                  zamanlıdır; bu menü oyunu duraklatmaz.
                </p>
                {Object.entries(CLASSES).map(([id, c]) => (
                  <article key={id}>
                    <h3 style={{ color: c.color }}>
                      {c.symbol} · {c.name}
                    </h3>
                    {c.skills.map((s, i) => (
                      <p key={s.name}>
                        <b>
                          {i} · {s.name}
                        </b>{" "}
                        — {s.description} ({s.cost} kaynak, {s.cooldown / 10}{" "}
                        sn)
                      </p>
                    ))}
                  </article>
                ))}
                <p>
                  Sesli sohbet KapsApp’ın mevcut sesli sohbet sekmesinde sürer.
                  Oyun sesini ayrı açıp kapatabilirsin.
                </p>
              </>
            ) : panel === "bag" ? (
              <>
                <h2>Çanta ve kuşanılanlar</h2>
                <p>
                  Eşyalar bu sefere aittir. Değiştirdiğin eşya çantaya döner.
                  Kapasite: 8 eşya, 4 kuşanım yuvası.
                </p>
                <h3>Kuşanılanlar</h3>
                {me &&
                  Object.values(me.equipment).map((i) => (
                    <p key={i.id}>
                      <b>{i.name}</b> · {RARITIES[i.rarity]} · {itemText(i)}
                    </p>
                  ))}
                {!me || !Object.keys(me.equipment).length ? (
                  <p>Henüz eşya kuşanmadın.</p>
                ) : null}
                <h3>Çanta</h3>
                {me?.inventory.length ? (
                  me.inventory.map((i) => (
                    <div className="ds-item" key={i.id}>
                      <div>
                        <strong>
                          {i.name} · {RARITIES[i.rarity]}
                        </strong>
                        <p>{itemText(i)}</p>
                        <small>
                          Şu an:{" "}
                          {me.equipment[i.slot]
                            ? itemText(me.equipment[i.slot]!)
                            : "Boş yuva"}
                        </small>
                      </div>
                      <div>
                        <button onClick={() => input("equip", { item: i.id })}>
                          Kuşan
                        </button>
                        <button
                          onClick={() => input("discard", { item: i.id })}
                        >
                          Bırak
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>
                    Çantan boş. Sandıkları açıp sana ait ◆ ganimetleri topla.
                  </p>
                )}
              </>
            ) : panel === "settings" ? (
              <>
                <h2>Oyun ayarları</h2>
                <label className="ds-check">
                  <input
                    type="checkbox"
                    checked={contrast}
                    onChange={(e) => setContrast(e.target.checked)}
                  />{" "}
                  Yüksek kontrast
                </label>
                <label className="ds-check">
                  <input
                    type="checkbox"
                    checked={sound}
                    onChange={(e) => {
                      setSound(e.target.checked);
                      if (e.target.checked) {
                        audio.current ||= new AudioContext();
                        void audio.current.resume();
                      }
                    }}
                  />{" "}
                  Oyun sesleri (sesli sohbetten bağımsız)
                </label>
                <label>
                  Yazı boyutu
                  <select
                    value={font}
                    onChange={(e) => setFont(Number(e.target.value))}
                  >
                    {[16, 18, 20].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <p>
                  Azaltılmış hareket tercihi cihaz ayarından alınır. Menü
                  açıkken sefer devam eder.
                </p>
                {room && (
                  <>
                    <p>
                      Seferden ayrılmak karakterini düşürür. Geçici bağlantı
                      kesintilerinde 60 saniye geri dönüş süresi vardır.
                    </p>
                    <button onClick={leave}>Odadan ayrıl</button>
                  </>
                )}
              </>
            ) : (
              <>
                <h2>Sefer geçmişim</h2>
                {!profile ? (
                  <p>Yükleniyor…</p>
                ) : !profile.available ? (
                  <p>Bu sunucuda kalıcı kayıt kullanılamıyor.</p>
                ) : (
                  <>
                    <h3>{profile.title}</h3>
                    <p>
                      {profile.runs} sefer · {profile.wins} zafer ·{" "}
                      {profile.kills} son vuruş · {profile.revives} canlandırma
                    </p>
                    <p>
                      İlk zaferde Kuşatma Kahramanı, 10 zaferde Zindan Ustası
                      unvanı. Kalıcı savaş gücü avantajı verilmez.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
