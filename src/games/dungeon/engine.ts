import {
  Actor,
  Hero,
  HeroClass,
  Run,
  Enemy,
  EnemyKind,
  EffectKind,
  Intent,
  Point,
  Item,
  Zone,
  Difficulty,
} from "./types";
import { CLASSES, DIFFICULTIES, ENEMIES, SIGNALS } from "./definitions";
import {
  generateFloor,
  validateFloor,
  tile,
  walkable,
  line,
  path,
  distance,
} from "./generation";
export function makeHero(
  id: number,
  name: string,
  hero: HeroClass = "warrior",
): Hero {
  const c = CLASSES[hero];
  return {
    id,
    name: name.slice(0, 32),
    hero,
    x: 0,
    y: 0,
    hp: c.hp,
    maxHp: c.hp,
    armor: c.armor,
    mana: c.mana,
    maxMana: c.mana,
    effects: [],
    shield: 0,
    shieldUntil: 0,
    connected: true,
    ready: false,
    cooldowns: [0, 0, 0, 0, 0],
    moveAt: 0,
    seq: 0,
    downUntil: 0,
    dead: false,
    downs: 0,
    invulnerableUntil: 0,
    equipment: {},
    inventory: [],
    potions: 3,
    stats: { damage: 0, healing: 0, kills: 0, revives: 0 },
    pingAt: 0,
    title: "Yeni Kaşif",
  };
}
export function random(r: Run) {
  r.rng = (Math.imul(r.rng, 1664525) + 1013904223) >>> 0;
  return r.rng / 4294967296;
}
export function note(r: Run, text: string) {
  r.log.push({ id: ++r.serial, text, tick: r.tick });
  if (r.log.length > 30) r.log.shift();
}
export function createRun(
  id: string,
  seed: number,
  difficulty: Difficulty,
  players: Hero[],
): Run {
  const floor = generateFloor(seed, 1);
  if (!validateFloor(floor)) throw Error("Zindan bağlantısı doğrulanamadı.");
  const r: Run = {
    id,
    seed,
    version: 1,
    tick: 0,
    depth: 1,
    difficulty,
    partySize: players.length,
    status: "playing",
    floor,
    players: players.map((p) => ({
      ...makeHero(p.id, p.name, p.hero),
      connected: p.connected,
      title: p.title,
    })),
    enemies: [],
    zones: [],
    projectiles: [],
    loot: [],
    log: [],
    serial: 0,
    rng: (seed ^ 0x9e3779b9) >>> 0,
    transitionAt: 0,
    rewardState: "none",
    kills: 0,
  };
  placeParty(r);
  note(
    r,
    "Birlikte ilerleyin. Odaları temizleyin, mührü açın ve kat muhafızını yenin.",
  );
  reveal(r);
  return r;
}
function placeParty(r: Run) {
  r.players.forEach((p, i) => {
    p.x = r.floor.spawn.x + (i % 2);
    p.y = r.floor.spawn.y + Math.floor(i / 2);
    p.revive = undefined;
  });
}
export function alive(p: Hero) {
  return !p.dead && p.hp > 0;
}
function active(r: Run) {
  return r.players.filter((p) => alive(p) && p.connected);
}
export function has(a: Actor, kind: EffectKind, tick: number) {
  return a.effects.some((e) => e.kind === kind && e.until > tick);
}
export function effect(
  r: Run,
  a: Actor,
  kind: EffectKind,
  duration: number,
  power: number,
  source: number,
) {
  if ((kind === "stun" || kind === "freeze") && "kind" in a) {
    const e = a as Enemy;
    if (r.tick < e.ccUntil) return;
    if (e.boss) duration = Math.min(5, duration);
    e.ccUntil = r.tick + duration + 35;
    if (!e.boss && e.cast) {
      r.zones = r.zones.filter((z) => z.id !== e.cast);
      e.cast = undefined;
    }
  }
  const old = a.effects.find((e) => e.kind === kind);
  if (old) {
    old.until = Math.max(old.until, r.tick + duration);
    old.power = Math.max(old.power, power);
    old.source = source;
  } else
    a.effects.push({
      kind,
      until: r.tick + duration,
      next: r.tick + 10,
      power,
      source,
    });
}
export function heal(r: Run, p: Hero, amount: number, source?: Hero) {
  if (!alive(p)) return 0;
  const gained = Math.min(p.maxHp - p.hp, Math.max(0, amount));
  p.hp += gained;
  if (source) source.stats.healing += gained;
  return gained;
}
export function damage(r: Run, a: Actor, raw: number, source?: Hero) {
  if (a.hp <= 0) return 0;
  if ("invulnerableUntil" in a && (a as Hero).invulnerableUntil > r.tick)
    return 0;
  let amount = Math.max(
    1,
    Math.round((Math.max(0, raw) * 100) / (100 + Math.max(0, a.armor))),
  );
  if (has(a, "guard", r.tick)) amount = Math.ceil(amount * 0.5);
  if (has(a, "vulnerable", r.tick)) amount = Math.ceil(amount * 1.25);
  if (a.shieldUntil <= r.tick) a.shield = 0;
  const blocked = Math.min(a.shield, amount);
  a.shield -= blocked;
  amount -= blocked;
  const dealt = Math.min(a.hp, amount);
  a.hp -= dealt;
  if (source) source.stats.damage += dealt;
  if ("hero" in a) {
    const p = a as Hero;
    if (dealt > 0) p.revive = undefined;
    if (p.hp === 0) {
      p.downs++;
      p.downUntil = r.tick + Math.max(100, 300 - p.downs * 30);
      p.effects = [];
      note(r, `${p.name} yere düştü! Yanında E / Etkileşim ile canlandır.`);
    }
  } else if (a.hp === 0) {
    const e = a as Enemy;
    r.kills++;
    if (source) source.stats.kills++;
    r.zones = r.zones.filter((z) => z.source !== -e.id);
    r.projectiles = r.projectiles.filter((p) => p.source !== -e.id);
    if (e.boss) {
      for (const child of r.enemies)
        if (child.room === e.room && child.summoned) child.hp = 0;
      note(r, `${ENEMIES[e.kind].name} yenildi!`);
    }
  }
  return dealt;
}
function enemyAt(r: Run, p: Point) {
  return r.enemies.some((e) => e.hp > 0 && e.x === p.x && e.y === p.y);
}
function visible(r: Run, a: Point, b: Point, range: number) {
  return distance(a, b) <= range && line(r.floor, a, b);
}
function roomAt(r: Run, p: Point) {
  return r.floor.rooms.find(
    (c) => p.x >= c.x && p.y >= c.y && p.x < c.x + c.w && p.y < c.y + c.h,
  );
}
export function spawnEnemy(
  r: Run,
  kind: EnemyKind,
  pos: Point,
  room: number,
  summoned = false,
) {
  if (
    r.enemies.filter((e) => e.hp > 0).length >= 64 ||
    !walkable(r.floor, pos.x, pos.y) ||
    enemyAt(r, pos) ||
    r.players.some((p) => distance(p, pos) < 1)
  )
    return;
  const d = ENEMIES[kind],
    boss = ["king", "golem", "warden"].includes(kind),
    hp = Math.round(
      d.hp *
        DIFFICULTIES[r.difficulty].hp *
        (1 + (r.partySize - 2) * 0.42) *
        (1 + (r.depth - 1) * 0.12),
    );
  const e: Enemy = {
    ...pos,
    id: ++r.serial,
    kind,
    room,
    boss,
    hp,
    maxHp: hp,
    armor: d.armor,
    effects: [],
    shield: 0,
    shieldUntil: 0,
    phase: 1,
    next: r.tick + 15,
    moveAt: r.tick + 5,
    tauntUntil: 0,
    ccUntil: 0,
    summonAt: r.tick + 60,
    summoned,
    state: "idle",
  };
  r.enemies.push(e);
  return e;
}
function enterRooms(r: Run) {
  for (const c of r.floor.rooms) {
    if (c.entered || !active(r).some((p) => roomAt(r, p)?.id === c.id))
      continue;
    c.entered = true;
    note(
      r,
      `${c.id + 1}. oda: ${{ combat: "Muhafızlar", swarm: "Sürü", elite: "Seçkin nöbet", trap: "Tuzak geçidi", shrine: "Dinlenme", puzzle: "Kayıp mühür", upgrade: "Kadim sunak", boss: "Kat muhafızı", treasure: "Hazine", start: "Giriş" }[c.kind]}`,
    );
    if (["shrine", "upgrade", "treasure", "start"].includes(c.kind)) {
      c.cleared = true;
      continue;
    }
    if (c.kind === "puzzle") continue;
    const count =
      c.kind === "boss"
        ? 1
        : Math.min(
            9,
            2 +
              (r.partySize - 2) +
              DIFFICULTIES[r.difficulty].extra +
              (c.kind === "swarm" ? 2 : 0),
          );
    const pools: EnemyKind[][] = [
      ["skeleton", "archer", "necromancer"],
      ["spider", "assassin", "archer"],
      ["guardian", "assassin", "necromancer"],
    ];
    for (let i = 0; i < count; i++) {
      const kind: EnemyKind =
        c.kind === "boss"
          ? (["king", "golem", "warden"] as EnemyKind[])[r.depth - 1]
          : c.kind === "elite" && i === 0
            ? "guardian"
            : pools[r.depth - 1][Math.floor(random(r) * 3)];
      for (let attempt = 0; attempt < 60; attempt++) {
        const pos = {
          x: c.x + 2 + Math.floor(random(r) * (c.w - 4)),
          y: c.y + 2 + Math.floor(random(r) * (c.h - 4)),
        };
        if (
          r.players.every((p) => distance(p, pos) > 3) &&
          spawnEnemy(r, kind, pos, c.id)
        )
          break;
      }
    }
  }
}
function reveal(r: Run) {
  for (const p of active(r))
    for (
      let y = Math.max(0, p.y - 8);
      y <= Math.min(r.floor.height - 1, p.y + 8);
      y++
    )
      for (
        let x = Math.max(0, p.x - 8);
        x <= Math.min(r.floor.width - 1, p.x + 8);
        x++
      )
        if (distance(p, { x, y }) <= 8) {
          if (
            walkable(r.floor, x, y)
              ? line(r.floor, p, { x, y })
              : [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                ].some(([dx, dy]) => line(r.floor, p, { x: x + dx, y: y + dy }))
          )
            r.floor.explored[y * r.floor.width + x] = 1;
        }
}
function power(p: Hero) {
  return 1 + (p.equipment.weapon?.power || 0) * 0.08;
}
function cooldown(p: Hero, base: number) {
  return Math.max(
    3,
    Math.round(
      base * (1 - Math.min(0.3, (p.equipment.charm?.power || 0) * 0.025)),
    ),
  );
}
function zone(
  r: Run,
  p: Point,
  kind: Zone["kind"],
  radius: number,
  delay: number,
  duration: number,
  damageValue: number,
  source: number,
  owner: Zone["owner"],
  room = -1,
) {
  const z: Zone = {
    ...p,
    id: ++r.serial,
    kind,
    radius,
    at: r.tick + delay,
    until: r.tick + delay + duration,
    damage: damageValue,
    source,
    owner,
    room,
  };
  r.zones.push(z);
  return z;
}
function bolt(
  r: Run,
  a: Point,
  b: Point,
  damageValue: number,
  source: number,
  owner: "hero" | "enemy",
  kind: "bolt" | "poison" = "bolt",
) {
  r.projectiles.push({
    ...a,
    id: ++r.serial,
    tx: b.x,
    ty: b.y,
    ox: a.x,
    oy: a.y,
    progress: 0,
    source,
    owner,
    damage: damageValue,
    kind,
    next: r.tick + 1,
    steps: 12,
  });
}
function targets(r: Run, p: Point, radius: number) {
  return r.enemies.filter((e) => e.hp > 0 && visible(r, p, e, radius));
}
export function cast(
  r: Run,
  p: Hero,
  slot: number,
  target: Point,
  allyId?: number,
): string | undefined {
  const def = CLASSES[p.hero],
    skill = def.skills[slot];
  if (!skill) return "Bilinmeyen yetenek.";
  if (p.cooldowns[slot] > r.tick) return "Yetenek bekleme süresinde.";
  if (p.mana < skill.cost) return "Yeterli kaynak yok.";
  const ally = r.players.find((a) => a.id === allyId) || p;
  let selected = targets(r, p, slot === 0 ? def.range : 7).sort(
    (a, b) => distance(a, target) - distance(b, target),
  )[0];
  if (slot === 0 || (p.hero === "warrior" && slot === 1)) {
    if (
      !selected ||
      distance(selected, target) > 2 ||
      !visible(r, p, selected, p.hero === "warrior" ? 1.5 : def.range)
    )
      return "Menzilde ve görüşte bir düşman seç.";
  }
  if (
    p.hero === "mage" &&
    (slot === 2 || slot === 4) &&
    !visible(r, p, target, 7)
  )
    return "Hedef görüş alanı dışında.";
  if (
    p.hero === "mage" &&
    slot === 3 &&
    (!visible(r, p, target, 4) || enemyAt(r, target) || distance(p, target) < 1)
  )
    return "Geçerli bir sıçrama noktası seç.";
  if (
    p.hero === "healer" &&
    (slot === 1 || slot === 2) &&
    (!alive(ally) || !ally.connected || !visible(r, p, ally, 6))
  )
    return "Dost menzil veya görüş dışında.";
  if (p.hero === "healer" && slot === 1 && ally.hp === ally.maxHp)
    return "Dostunun canı zaten dolu.";
  if (p.hero === "healer" && slot === 4 && !visible(r, p, target, 6))
    return "Sığınak için yakın bir nokta seç.";
  p.mana -= skill.cost;
  p.cooldowns[slot] = r.tick + cooldown(p, skill.cooldown);
  p.revive = undefined;
  const hit = (e: Enemy, n: number) => {
    const crit = random(r) < 0.1;
    damage(r, e, n * power(p) * (crit ? 1.5 : 1), p);
    if (crit && p.equipment.relic?.effect === "vampire")
      p.mana = Math.min(p.maxMana, p.mana + 4);
  };
  if (slot === 0) {
    if (p.hero === "warrior") {
      for (const e of targets(r, p, 1.5)) hit(e, def.damage);
    } else bolt(r, p, selected, def.damage * power(p), p.id, "hero");
    return;
  }
  if (p.hero === "warrior") {
    if (slot === 1) {
      hit(selected, 28);
      effect(r, selected, "stun", 20, 1, p.id);
    }
    if (slot === 2) effect(r, p, "guard", 60, 1, p.id);
    if (slot === 3)
      for (const e of targets(r, p, 6)) {
        e.target = p.id;
        e.tauntUntil = r.tick + (e.boss ? 20 : 50);
      }
    if (slot === 4)
      for (const a of r.players.filter(
        (a) => alive(a) && visible(r, p, a, 4),
      )) {
        effect(r, a, "guard", 80, 1, p.id);
        a.shield = Math.max(a.shield, 45);
        a.shieldUntil = r.tick + 80;
      }
  } else if (p.hero === "mage") {
    if (slot === 1) {
      for (const e of targets(r, p, 3)) {
        hit(e, 14);
        effect(r, e, "freeze", 25, 1, p.id);
      }
      if (p.equipment.relic?.effect === "icefield")
        zone(r, p, "ice", 3, 0, 60, 0, p.id, "hero");
    }
    if (slot === 2) {
      for (const e of targets(r, target, 2)) {
        hit(e, 32);
        effect(r, e, "burn", 40, 4, p.id);
      }
      if (p.equipment.relic?.effect === "echo")
        zone(r, target, "meteor", 1, 8, 1, 18, p.id, "hero");
    }
    if (slot === 3) {
      p.x = target.x;
      p.y = target.y;
    }
    if (slot === 4)
      zone(r, target, "meteor", 3, 10, 1, 85 * power(p), p.id, "hero");
  } else {
    if (slot === 1) heal(r, ally, 38 + (p.equipment.weapon?.power || 0) * 2, p);
    if (slot === 2) {
      ally.shield = Math.max(ally.shield, 45);
      ally.shieldUntil = r.tick + 80;
    }
    if (slot === 3)
      for (const a of r.players.filter((a) => visible(r, p, a, 4)))
        a.effects = a.effects.filter(
          (e) => !["burn", "poison", "slow"].includes(e.kind),
        );
    if (slot === 4) zone(r, target, "heal", 3, 0, 80, 7, p.id, "hero");
  }
  note(r, `${p.name}: ${skill.name}`);
}
function itemFor(r: Run, p: Hero, relic = false): Item {
  const roll = random(r),
    rarity =
      roll < 0.45 ? 0 : roll < 0.73 ? 1 : roll < 0.9 ? 2 : roll < 0.98 ? 3 : 4;
  const slot: Item["slot"] = relic
    ? "relic"
    : (["weapon", "armor", "charm"] as const)[Math.floor(random(r) * 3)];
  const effects: Item["effect"][] = ["icefield", "echo", "lifeline", "vampire"];
  const effectName = effects[Math.floor(random(r) * effects.length)]!;
  return {
    id: `${r.id}-${++r.serial}`,
    name: relic
      ? {
          icefield: "Kışın İzi",
          echo: "Köz Yankısı",
          lifeline: "Yaşam Bağı",
          vampire: "Arkan Nabız",
        }[effectName]
      : {
          weapon:
            p.hero === "warrior"
              ? "Muhafız Kılıcı"
              : p.hero === "mage"
                ? "Kristal Asa"
                : "Işık Odağı",
          armor: "Gezgin Zırhı",
          charm: "Zaman Tılsımı",
          relic: "Kadim Kalıntı",
        }[slot],
    slot,
    rarity,
    power: 1 + rarity + r.depth,
    hero: p.hero,
    ...(relic ? { effect: effectName } : {}),
  };
}
function giveLoot(r: Run, pos: Point, relic = false) {
  for (const p of r.players.filter((p) => !p.dead))
    r.loot.push({
      ...pos,
      id: `drop-${++r.serial}`,
      owner: p.id,
      item: itemFor(r, p, relic),
    });
}
function interact(r: Run, p: Hero): string | undefined {
  const down = r.players.find(
    (a) =>
      a.id !== p.id &&
      !a.dead &&
      a.hp === 0 &&
      a.connected &&
      distance(a, p) <= 1.5,
  );
  if (down) {
    if (!p.revive)
      p.revive = {
        target: down.id,
        until: r.tick + (p.hero === "healer" ? 25 : 40),
      };
    return;
  }
  const loot = r.loot.find((l) => l.owner === p.id && distance(p, l) <= 1.5);
  if (loot) {
    if (p.inventory.length >= 8)
      return "Çanta dolu; bir eşyayı kuşan veya değiştir.";
    p.inventory.push(loot.item);
    r.loot = r.loot.filter((l) => l !== loot);
    note(r, `${p.name}: ${loot.item.name} aldı.`);
    return;
  }
  const neighbors = [
    { x: p.x, y: p.y },
    ...[
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })),
  ];
  for (const pos of neighbors) {
    const t = tile(r.floor, pos.x, pos.y),
      idx = pos.y * r.floor.width + pos.x;
    if (t === "C" || t === "U") {
      if (r.enemies.some((e) => e.hp > 0 && e.room === roomAt(r, pos)?.id))
        return "Önce odadaki düşmanları yenin.";
      giveLoot(r, pos, t === "U");
      r.floor.tiles[idx] = ".";
      note(r, "Her oyuncuya ayrı ganimet bırakıldı. E / Etkileşim ile al.");
      return;
    }
    if (t === "H" || t === "M") {
      for (const a of r.players.filter(
        (a) => alive(a) && visible(r, pos, a, 5),
      )) {
        if (t === "H") heal(r, a, a.maxHp * 0.45);
        else a.mana = Math.min(a.maxMana, a.mana + 50);
      }
      r.floor.tiles[idx] = ".";
      note(r, "Sunak yakınındaki ekibe güç verdi; bu sunak tükendi.");
      return;
    }
    if (t === "S" || t === "K") {
      const c = roomAt(r, pos);
      if (c) c.cleared = true;
      for (let i = 0; i < r.floor.tiles.length; i++)
        if (r.floor.tiles[i] === "D") r.floor.tiles[i] = "+";
      r.floor.tiles[idx] = ".";
      if (c)
        for (let yy = c.y; yy < c.y + c.h; yy++)
          for (let xx = c.x; xx < c.x + c.w; xx++)
            if (["K", "S"].includes(tile(r.floor, xx, yy)))
              r.floor.tiles[yy * r.floor.width + xx] = ".";
      note(r, "Kadim mühür açıldı.");
      return;
    }
    if (t === ">") {
      if (!r.floor.rooms.every((c) => c.cleared || c.optional))
        return "Önce bütün odaları tamamlayın ve mührü açın.";
      if (active(r).some((a) => distance(a, r.floor.exit) > 5))
        return "Canlı ekip üyeleri çıkışın 5 kare yakınına gelmeli.";
      if (r.players.some((a) => a.hp === 0 && !a.dead))
        return "Yerdeki arkadaşını canlandır ya da süreyi bekle.";
      if (!r.transitionAt) {
        r.transitionAt = r.tick + 30;
        note(r, "Çıkış açıldı: 3 saniye sonra ilerliyoruz.");
      }
      return;
    }
  }
  return "Yakında etkileşim yok.";
}
export function applyIntent(
  r: Run,
  id: number,
  input: Intent,
): string | undefined {
  if (
    !input ||
    typeof input !== "object" ||
    !Number.isSafeInteger(input.seq) ||
    input.seq < 1 ||
    input.seq > Number.MAX_SAFE_INTEGER - 1
  )
    return "Geçersiz komut.";
  const p = r.players.find((p) => p.id === id);
  if (!p || !p.connected) return "Aktif oyuncu bulunamadı.";
  if (input.seq <= p.seq) return "Eski veya tekrarlanan komut.";
  p.seq = input.seq;
  if (r.status !== "playing" || input.floor !== r.depth)
    return "Sefer veya kat değişti.";
  if (!alive(p)) return "Şu anda hareket edemezsin.";
  if (has(p, "stun", r.tick) || has(p, "freeze", r.tick))
    return "Sersemlemiş durumdasın.";
  if (input.action === "move") {
    const { dx, dy } = input;
    if (
      typeof dx !== "number" ||
      typeof dy !== "number" ||
      !Number.isInteger(dx) ||
      !Number.isInteger(dy) ||
      Math.abs(dx) + Math.abs(dy) !== 1
    )
      return "Geçersiz yön.";
    if (r.tick < p.moveAt) return "Hareket bekleniyor.";
    const pos = { x: p.x + dx, y: p.y + dy };
    if (!walkable(r.floor, pos.x, pos.y) || enemyAt(r, pos))
      return "Yol kapalı.";
    p.x = pos.x;
    p.y = pos.y;
    p.moveAt =
      r.tick + (has(p, "slow", r.tick) || has(p, "guard", r.tick) ? 4 : 2);
    p.revive = undefined;
    return;
  }
  if (input.action === "cast") {
    if (
      typeof input.slot !== "number" ||
      typeof input.x !== "number" ||
      typeof input.y !== "number" ||
      !Number.isInteger(input.slot) ||
      input.slot < 0 ||
      input.slot > 4 ||
      !Number.isInteger(input.x) ||
      !Number.isInteger(input.y) ||
      input.x < 0 ||
      input.y < 0 ||
      input.x >= r.floor.width ||
      input.y >= r.floor.height
    )
      return "Geçersiz hedef.";
    return cast(r, p, input.slot, { x: input.x, y: input.y }, input.target);
  }
  if (input.action === "interact") return interact(r, p);
  if (input.action === "potion") {
    if (p.potions <= 0) return "İksirin kalmadı.";
    if (p.hp === p.maxHp) return "Canın dolu.";
    p.potions--;
    heal(r, p, p.maxHp * 0.5, p);
    return;
  }
  if (input.action === "discard") {
    const i = p.inventory.findIndex((a) => a.id === input.item);
    if (i < 0) return "Eşya bulunamadı.";
    p.inventory.splice(i, 1);
    return;
  }
  if (input.action === "equip") {
    const i = p.inventory.findIndex((a) => a.id === input.item);
    if (i < 0) return "Eşya bulunamadı.";
    const item = p.inventory[i];
    if (item.hero !== p.hero) return "Sınıfına uygun değil.";
    const old = p.equipment[item.slot];
    p.inventory.splice(i, 1);
    p.equipment[item.slot] = item;
    if (old) p.inventory.push(old);
    p.maxHp = CLASSES[p.hero].hp + (p.equipment.armor?.power || 0) * 8;
    p.armor = CLASSES[p.hero].armor + (p.equipment.armor?.power || 0) * 3;
    p.hp = Math.min(p.hp, p.maxHp);
    return;
  }
  if (input.action === "ping") {
    if (
      typeof input.signal !== "number" ||
      !Number.isInteger(input.signal) ||
      !SIGNALS[input.signal]
    )
      return "Geçersiz işaret.";
    if (r.tick < p.pingAt) return "İşaret bekleme süresinde.";
    p.pingAt = r.tick + 30;
    p.ping = { text: SIGNALS[input.signal], until: r.tick + 40 };
    note(r, `${p.name}: ${p.ping.text}`);
    return;
  }
  return "Bilinmeyen komut.";
}
function processEffects(r: Run, a: Actor) {
  a.effects = a.effects.filter((e) => e.until > r.tick);
  if (a.shieldUntil <= r.tick) a.shield = 0;
  for (const e of a.effects) {
    if (e.next > r.tick) continue;
    e.next = r.tick + 10;
    const source = r.players.find((p) => p.id === e.source);
    if (e.kind === "burn" || e.kind === "poison") damage(r, a, e.power, source);
    if (e.kind === "regen" && "hero" in a) heal(r, a as Hero, e.power, source);
  }
}
function moveEnemy(r: Run, e: Enemy, target: Hero, retreat = false) {
  if (r.tick < e.moveAt) return;
  const occupied = new Set(
    r.enemies
      .filter((a) => a !== e && a.hp > 0)
      .map((a) => a.y * r.floor.width + a.x),
  );
  let step: Point | undefined;
  if (retreat) {
    step = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy }))
      .filter(
        (p) =>
          walkable(r.floor, p.x, p.y) &&
          !occupied.has(p.y * r.floor.width + p.x) &&
          !r.players.some((a) => alive(a) && distance(a, p) < 1),
      )
      .sort((a, b) => distance(b, target) - distance(a, target))[0];
    if (step && distance(step, target) <= distance(e, target)) step = undefined;
  } else step = path(r.floor, e, target, occupied)[0];
  if (
    step &&
    !r.players.some((p) => alive(p) && p.x === step.x && p.y === step.y) &&
    !occupied.has(step.y * r.floor.width + step.x)
  ) {
    e.x = step.x;
    e.y = step.y;
  }
  e.moveAt = r.tick + ENEMIES[e.kind].speed * (has(e, "slow", r.tick) ? 2 : 1);
}
function summon(r: Run, e: Enemy) {
  if (
    r.tick < e.summonAt ||
    r.enemies.filter((a) => a.summoned && a.hp > 0 && a.room === e.room)
      .length >= 3
  )
    return;
  e.summonAt = r.tick + (e.boss ? 90 : 120);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    if (spawnEnemy(r, "skeleton", { x: e.x + dx, y: e.y + dy }, e.room, true))
      break;
}
function enemyTick(r: Run, e: Enemy) {
  if (e.hp <= 0) return;
  processEffects(r, e);
  if (e.hp <= 0) return;
  if (has(e, "stun", r.tick) || has(e, "freeze", r.tick)) {
    e.state = "stunned";
    return;
  }
  if (e.boss && e.hp <= e.maxHp * 0.5 && e.phase === 1) {
    e.phase = 2;
    note(r, `${ENEMIES[e.kind].name}: ikinci evre!`);
    if (e.kind === "golem") {
      e.shield = 70;
      e.shieldUntil = r.tick + 40;
      effect(r, e, "guard", 40, 1, -e.id);
    }
  }
  const candidates = active(r);
  let target = candidates.find(
    (p) => p.id === e.target && e.tauntUntil > r.tick && visible(r, e, p, 12),
  );
  if (!target)
    target = candidates
      .filter(
        (p) =>
          visible(r, e, p, e.boss ? 20 : 10) ||
          (p.id === e.target && distance(p, e) < 16),
      )
      .sort(
        (a, b) =>
          (e.kind === "assassin"
            ? (a.hero === "warrior" ? 6 : 0) + (a.hp / a.maxHp) * 3
            : 0) +
          distance(e, a) -
          ((e.kind === "assassin"
            ? (b.hero === "warrior" ? 6 : 0) + (b.hp / b.maxHp) * 3
            : 0) +
            distance(e, b)),
      )[0];
  if (!target) {
    e.state = "idle";
    e.target = undefined;
    return;
  }
  e.target = target.id;
  if (
    e.kind === "necromancer" ||
    e.kind === "king" ||
    (e.kind === "warden" && e.phase === 2)
  )
    summon(r, e);
  if (e.cast && r.zones.some((z) => z.id === e.cast)) {
    e.state = "cast";
    return;
  }
  e.cast = undefined;
  const range = ENEMIES[e.kind].range,
    dist = distance(e, target);
  if ((e.kind === "archer" || e.kind === "necromancer") && dist < 3)
    moveEnemy(r, e, target, true);
  else if (dist > range || !line(r.floor, e, target)) {
    e.state = "chase";
    moveEnemy(r, e, target);
    return;
  }
  if (r.tick < e.next) {
    e.state = "recover";
    return;
  }
  e.next =
    r.tick +
    (e.boss ? (e.phase === 2 ? 42 : 50) : e.kind === "guardian" ? 35 : 22);
  const amount = ENEMIES[e.kind].damage * DIFFICULTIES[r.difficulty].damage;
  if (e.kind === "archer" || e.kind === "necromancer") {
    bolt(r, e, target, amount, -e.id, "enemy");
    return;
  }
  const radius = e.boss
    ? e.kind === "golem"
      ? 2.5
      : 2
    : e.kind === "guardian"
      ? 1.5
      : 0.7;
  e.cast = zone(
    r,
    target,
    "danger",
    radius,
    e.boss ? 12 : e.kind === "assassin" ? 10 : 7,
    1,
    amount,
    -e.id,
    "enemy",
    e.room,
  ).id;
  e.state = "cast";
  if (e.kind === "spider") {
    zone(r, target, "ice", 1, 7, 40, 0, -e.id, "enemy", e.room);
  }
  if (e.kind === "warden") {
    zone(r, target, "fire", 1, 15, 30, 5, -e.id, "enemy", e.room);
    if (e.phase === 2)
      for (const d of [
        [4, 0],
        [-4, 0],
        [0, 4],
        [0, -4],
      ])
        bolt(
          r,
          e,
          { x: e.x + d[0], y: e.y + d[1] },
          amount * 0.6,
          -e.id,
          "enemy",
        );
  }
  if (e.kind === "golem" && e.phase === 2) {
    const horizontal = Math.abs(target.x - e.x) > Math.abs(target.y - e.y);
    for (let i = -3; i <= 3; i++)
      if (i !== 0)
        zone(
          r,
          {
            x: target.x + (horizontal ? 0 : i),
            y: target.y + (horizontal ? i : 0),
          },
          "danger",
          0.6,
          15,
          1,
          amount * 0.6,
          -e.id,
          "enemy",
          e.room,
        );
  }
}
function zonesTick(r: Run) {
  for (const z of r.zones) {
    if (r.tick < z.at || r.tick >= z.until) continue;
    if (z.until - z.at > 1 && (r.tick - z.at) % 10 !== 0) continue;
    const source = r.players.find((p) => p.id === z.source);
    if (z.owner === "hero" && (!source || !alive(source))) continue;
    if (
      z.owner === "enemy" &&
      !r.enemies.some((e) => e.hp > 0 && -e.id === z.source)
    )
      continue;
    if (z.kind === "heal") {
      for (const p of active(r).filter((p) => visible(r, z, p, z.radius))) {
        heal(r, p, z.damage, source);
        effect(r, p, "guard", 12, 1, z.source);
      }
    } else if (z.kind === "ice") {
      for (const a of z.owner === "hero"
        ? r.enemies.filter((e) => e.hp > 0)
        : active(r))
        if (visible(r, z, a, z.radius)) effect(r, a, "slow", 15, 1, z.source);
    } else if (z.owner === "hero") {
      for (const e of targets(r, z, z.radius)) damage(r, e, z.damage, source);
    } else {
      for (const p of r.players.filter(
        (p) => alive(p) && visible(r, z, p, z.radius),
      )) {
        damage(r, p, z.damage);
        const e = r.enemies.find((e) => -e.id === z.source);
        if (e?.kind === "spider") effect(r, p, "poison", 40, 2, z.source);
      }
    }
  }
  r.zones = r.zones.filter((z) => z.until > r.tick);
}
function projectilesTick(r: Run) {
  r.projectiles = r.projectiles.filter((b) => {
    if (
      b.owner === "enemy" &&
      !r.enemies.some((e) => e.hp > 0 && -e.id === b.source)
    )
      return false;
    if (r.tick < b.next) return true;
    b.next = r.tick + 1;
    if (--b.steps < 0) return false;
    const dx = b.tx - b.x,
      dy = b.ty - b.y;
    if (dx === 0 && dy === 0) return false;
    const length = Math.max(Math.abs(b.tx - b.ox), Math.abs(b.ty - b.oy));
    b.progress++;
    const nx = Math.round(b.ox + ((b.tx - b.ox) * b.progress) / length),
      ny = Math.round(b.oy + ((b.ty - b.oy) * b.progress) / length);
    if (!walkable(r.floor, nx, ny) || !line(r.floor, b, { x: nx, y: ny }))
      return false;
    b.x = nx;
    b.y = ny;
    const a =
      b.owner === "hero"
        ? r.enemies.find((e) => e.hp > 0 && e.x === nx && e.y === ny)
        : r.players.find((p) => alive(p) && p.x === nx && p.y === ny);
    if (a) {
      damage(
        r,
        a,
        b.damage,
        r.players.find((p) => p.id === b.source),
      );
      return false;
    }
    return nx !== b.tx || ny !== b.ty;
  });
}
function completeRooms(r: Run) {
  for (const c of r.floor.rooms) {
    if (
      c.entered &&
      !c.cleared &&
      !["puzzle"].includes(c.kind) &&
      !r.enemies.some((e) => e.room === c.id && e.hp > 0 && !e.summoned)
    ) {
      c.cleared = true;
      for (const e of r.enemies) if (e.room === c.id && e.summoned) e.hp = 0;
      for (const p of r.players)
        if (alive(p)) {
          p.mana = Math.min(p.maxMana, p.mana + 12);
        }
      note(r, `${c.id + 1}. oda tamamlandı.`);
      if (c.kind === "boss") giveLoot(r, { x: c.x + 2, y: c.y + 2 }, true);
    }
  }
  r.enemies = r.enemies.filter((e) => e.hp > 0);
}
export function step(r: Run) {
  if (r.status !== "playing") return;
  r.tick++;
  enterRooms(r);
  for (const p of r.players) {
    processEffects(r, p);
    if (p.hp === 0 && !p.dead && r.tick >= p.downUntil) {
      p.dead = true;
      p.revive = undefined;
      note(r, `${p.name} bu katta düştü; sonraki katta dönebilir.`);
    }
    if (
      alive(p) &&
      r.tick % 10 === 0 &&
      (p.hero === "warrior" ||
        r.enemies.some((e) => e.hp > 0 && visible(r, p, e, 10)))
    )
      p.mana = Math.min(p.maxMana, p.mana + (p.hero === "warrior" ? 4 : 1.5));
    if (p.revive) {
      const revive = p.revive;
      const ally = r.players.find((a) => a.id === revive.target);
      if (
        !alive(p) ||
        !p.connected ||
        has(p, "stun", r.tick) ||
        has(p, "freeze", r.tick) ||
        !ally ||
        ally.dead ||
        ally.hp > 0 ||
        !ally.connected ||
        distance(p, ally) > 1.5
      )
        p.revive = undefined;
      else if (r.tick >= p.revive.until) {
        ally.hp = Math.round(ally.maxHp * 0.35);
        ally.invulnerableUntil = r.tick + 20;
        ally.downUntil = 0;
        p.stats.revives++;
        p.revive = undefined;
        if (p.equipment.relic?.effect === "lifeline") {
          effect(r, p, "guard", 50, 1, p.id);
          effect(r, ally, "guard", 50, 1, p.id);
        }
        note(r, `${p.name}, ${ally.name} adlı dostunu canlandırdı.`);
      }
    }
    if (alive(p)) {
      const t = tile(r.floor, p.x, p.y);
      if (t === "~") effect(r, p, "slow", 12, 1, 0);
      if ((t === "!" || t === "^") && r.tick % 20 === 0)
        damage(r, p, t === "!" ? 7 : 10);
    }
  }
  for (const e of [...r.enemies]) enemyTick(r, e);
  zonesTick(r);
  projectilesTick(r);
  completeRooms(r);
  // A simultaneous boss kill and team wipe is a defeat; extraction still requires a living party.
  if (!r.players.some((p) => alive(p))) {
    r.status = "lost";
    r.transitionAt = 0;
    note(r, "Sefer sona erdi. Ekipte ayakta kalan yok.");
    return;
  }
  if (r.transitionAt && r.tick >= r.transitionAt) {
    if (
      !active(r).length ||
      active(r).some((p) => distance(p, r.floor.exit) > 5)
    ) {
      r.transitionAt = 0;
      note(r, "Ekip çıkıştan ayrıldı; geçiş iptal edildi.");
      return;
    }
    if (r.depth === 3) {
      r.status = "won";
      note(r, "Zindan Kuşatması tamamlandı!");
      return;
    }
    r.depth++;
    r.floor = generateFloor(r.seed, r.depth);
    r.enemies = [];
    r.zones = [];
    r.projectiles = [];
    r.loot = [];
    r.transitionAt = 0;
    for (const p of r.players) {
      if (p.connected) {
        p.dead = false;
        p.downUntil = 0;
        p.hp = Math.max(p.hp, Math.round(p.maxHp * 0.5));
        p.mana = Math.min(p.maxMana, p.mana + 30);
        p.potions = Math.min(3, p.potions + 1);
      }
      p.effects = [];
      p.shield = 0;
    }
    placeParty(r);
    note(r, `${r.depth}. kat: ${r.floor.theme}`);
  }
  if (r.tick % 2 === 0) reveal(r);
}
