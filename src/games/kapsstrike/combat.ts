import {createWorld,advanceWorld,claimSupply,dropInventory} from './world';
import { MELEE } from "./config";
import {
  TrainingState,
  PlayerState,
  InputCommand,
  CombatEvent,
  Vec3,
  WeaponId,
} from "./types";
import { PHYSICS as C, ownsWeapon, WEAPONS, WEAPON_ORDER, TARGET_HITBOXES } from "./config";
import { MAPS } from "./maps";
import { newMovement, move, clamp, rayBox, raySolid, fits } from "./physics";
export function createTraining(
  map: TrainingState["map"],
  id = "local-player",
): TrainingState {
  const ammo = Object.fromEntries(
    WEAPON_ORDER.map((k) => [k, WEAPONS[k].capacity]),
  ) as Record<WeaponId, number>;
  const player: PlayerState = {
    id,
    movement: newMovement(MAPS[map].spawns[0]),
    weapon: {
      selected: "rifle",
      ammo,
      nextFire: 0,
      reloadUntil: 0,
      switchUntil: 0,
      triggerHeld: false,
      shotIndex: 0,
    },
    hp: 100,
    deadUntil: 0,
    protectedUntil: C.protectionTicks,
    yaw: 0,
    pitch: 0,
  };
  return {
    world: createWorld(MAPS[map]),
    tick: 0,
    map,
    player,
    targets: MAPS[map].targets.map((t) => ({
      id: t.id,
      position: { ...t.position },
      hp: 100,
      respawnAt: 0,
    })),
    score: 0,
    damage: 0,
    firstHit: -1,
    lastDamageTick: -10000,
    events: [],
    eventId: 0,
    returnFire: false,
    lastSequence: -1,
  };
}
function event(
  s: TrainingState,
  data: Omit<CombatEvent, "id" | "tick" | "actor">,
) {
  s.events.push({ id: ++s.eventId, tick: s.tick, actor: s.player.id, ...data });
  if (s.events.length > 128) s.events.shift();
}
export function takeDamage(s: TrainingState, amount: number, from: Vec3) {
  const p = s.player;
  if (
    p.hp <= 0 ||
    s.tick < p.protectedUntil ||
    !Number.isFinite(amount) ||
    amount <= 0
  )
    return;
  p.hp = Math.max(0, p.hp - amount);
  s.lastDamageTick = s.tick;
  event(s, {
    kind: "damage",
    damage: amount,
    direction:
      Math.atan2(
        from.x - p.movement.position.x,
        from.z - p.movement.position.z,
      ) - p.yaw,
  });
  if (!p.hp) {
    if(s.world)dropInventory(s.world,p,s.tick);
    p.deadUntil = s.tick + C.respawnTicks;
    p.weapon.reloadUntil = 0;
    event(s, { kind: "death" });
  }
}
export function aimDirection(yaw: number, pitch: number): Vec3 {
  return {
    x: Math.sin(yaw) * Math.cos(pitch),
    y: -Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  };
}
export function eye(p: PlayerState): Vec3 {
  const pos = p.movement.position;
  return {
    ...pos,
    y: pos.y + (p.movement.stance === "stand" ? C.eye : C.crouchEye),
  };
}
function random(index: number) {
  let x = (index ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}

export function fireDelay(id:WeaponId, ads:boolean) {
  return (id === "knife" ? (ads ? MELEE.heavyCooldown : MELEE.cooldown) : 60 / WEAPONS[id].rpm) / C.dt;
}
export function spreadFor(player:PlayerState,ads:boolean) {
  const d=WEAPONS[player.weapon.selected];
  return d.spread*(ads?d.ads:1)*(player.movement.grounded?1:2)*(Math.hypot(player.movement.velocity.x,player.movement.velocity.z)>5?1.5:1);
}
export function weaponDamage(id:WeaponId,distance:number,head:boolean,ads:boolean) {
  if(id === "knife")return ads?MELEE.heavyDamage:MELEE.damage;
  const d=WEAPONS[id],falloff=id==="shotgun"?clamp(1-distance/45,.2,1):clamp(1-distance/(d.range*3),.7,1);
  return d.damage/d.pellets*(head?2:1)*falloff;
}

export function shoot(s: TrainingState, ads: boolean) {
  const p = s.player,
    w = p.weapon,
    def = WEAPONS[w.selected];
  if (
    p.hp <= 0 ||
    s.tick < w.nextFire ||
    s.tick < w.switchUntil ||
    w.reloadUntil ||
    w.ammo[w.selected] <= 0
  )
    return false;
  if (w.selected !== "knife") w.ammo[w.selected]--;
  w.nextFire = Math.max(w.nextFire, s.tick - 1) + fireDelay(w.selected,ads);
  const origin = eye(p);
  w.shotIndex++;
  const spread = spreadFor(p,ads);
  for (let pellet = 0; pellet < def.pellets; pellet++) {
    const n = w.shotIndex * 31 + pellet * 7;
    const yaw = p.yaw + (random(n) - 0.5) * spread * 2,
      pitch = p.pitch + (random(n + 17) - 0.5) * spread * 2,
      dir = aimDirection(yaw, pitch);
    let nearest = def.range;
    for (const solid of MAPS[s.map].solids)
      if (!solid.detail)
        nearest = Math.min(nearest, raySolid(origin, dir, solid, def.range));
    let hit: TrainingState["targets"][number] | undefined,
      head = false;
    for (const t of s.targets) {
      if (t.hp <= 0) continue;
      const pos = t.position;
      for (const region of ["body", "head"]) {
        const {
          radius: r,
          min: low,
          max: high,
        } = TARGET_HITBOXES[region as keyof typeof TARGET_HITBOXES];
        const distance = rayBox(
          origin,
          dir,
          { x: pos.x - r, y: pos.y + low, z: pos.z - r },
          { x: pos.x + r, y: pos.y + high, z: pos.z + r },
          def.range,
        );
        if (distance < nearest) {
          nearest = distance;
          hit = t;
          head = region === "head";
        }
      }
    }
    const to = {
      x: origin.x + dir.x * nearest,
      y: origin.y + dir.y * nearest,
      z: origin.z + dir.z * nearest,
    };
    event(s, { kind: "shot", weapon: w.selected, from: origin, to });
    if (hit) {
      const dmg = Math.min(hit.hp,weaponDamage(w.selected,nearest,head,ads));
      hit.hp -= dmg;
      s.damage += dmg;
      if (s.firstHit < 0) s.firstHit = s.tick;
      event(s, {
        kind: "hit",
        weapon: w.selected,
        target: hit.id,
        damage: dmg,
        head,
        to,
      });
      if (hit.hp <= 0) {
        hit.respawnAt = s.tick + 360;
        s.score++;
      }
    }
  }
  return true;
}
export function simulate(s: TrainingState, input: InputCommand, training = true) {
  if (
    !input ||
    (input.interact!==undefined&&typeof input.interact!=="boolean") ||
    !Number.isSafeInteger(input.sequence) ||
    input.sequence <= s.lastSequence ||
    input.tick !== s.tick ||
    ![input.yaw, input.pitch, input.moveX, input.moveZ].every(
      Number.isFinite,
    ) ||
    [
      input.jump,
      input.sprint,
      input.crouch,
      input.fire,
      input.ads,
      input.reload,
    ].some((v) => typeof v !== "boolean")
  )
    return false;
  s.lastSequence = input.sequence;
  s.tick++;
  if(training&&s.world)advanceWorld(s.world,MAPS[s.map],s.tick);
  s.player.yaw = input.yaw;
  s.player.pitch = clamp(input.pitch, -1.48, 1.48);
  const p = s.player,
    w = p.weapon;
  if (p.hp <= 0) {
    if (training && s.tick >= p.deadUntil) {
      const score = s.score,
        damage = s.damage,
        serial = s.eventId,
        sequence = s.lastSequence,
        fresh = createTraining(s.map, p.id);
      s.player = fresh.player;
      s.player.protectedUntil = s.tick + C.protectionTicks;
      s.eventId = serial;
      s.score = score;
      s.damage = damage;
      s.lastSequence = sequence;
      event(s, { kind: "respawn" });
    }
    return true;
  }
  if(training&&input.interact&&s.world)claimSupply(s.world,MAPS[s.map],p,s.tick);
  for (const t of s.targets) {
    const def = MAPS[s.map].targets.find((d) => d.id === t.id)!;
    if (t.hp <= 0 && s.tick >= t.respawnAt) {
      t.hp = 100;
      t.respawnAt = 0;
    }
    if (def.moving) {
      const next = {
        ...t.position,
        x: def.position.x + Math.sin(s.tick * C.dt) * 3,
      };
      if (fits(MAPS[s.map], next, TARGET_HITBOXES.head.max))
        t.position.x = next.x;
    }
  }
  if (
    input.weapon &&
    Object.hasOwn(WEAPONS, input.weapon) && ownsWeapon(w,input.weapon) &&
    input.weapon !== w.selected
  ) {
    w.selected = input.weapon;
    w.reloadUntil = 0;
    w.switchUntil = s.tick + 24;
    w.triggerHeld = input.fire;
  }
  if (w.reloadUntil && s.tick >= w.reloadUntil) {
    w.ammo[w.selected] = WEAPONS[w.selected].capacity;
    w.reloadUntil = 0;
  }
  if (
    input.reload &&
    !w.reloadUntil &&
    w.ammo[w.selected] < WEAPONS[w.selected].capacity
  ) {
    w.reloadUntil = s.tick + Math.ceil(WEAPONS[w.selected].reload / C.dt);
    event(s, { kind: "reload", weapon: w.selected });
  }
  move(p.movement, { ...input, weapon: w.selected }, MAPS[s.map], s.tick);
  const d = WEAPONS[w.selected];
  if (input.fire && (d.automatic || !w.triggerHeld)) shoot(s, input.ads);
  w.triggerHeld = input.fire;
  const hazard = MAPS[s.map].hazard,
    pos = p.movement.position;
  if (
    training && Math.hypot(pos.x - hazard.x, pos.z - hazard.z) < hazard.r &&
    s.tick % 30 === 0
  )
    takeDamage(s, 12, { x: hazard.x, y: 0, z: hazard.z });
  if (training && s.returnFire && s.tick % 120 === 0) {
    const t = s.targets.find(
      (t) =>
        t.hp > 0 && Math.hypot(t.position.x - pos.x, t.position.z - pos.z) < 35,
    );
    if (t) {
      const from = { ...t.position, y: t.position.y + 1.6 },
        to = eye(p),
        len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z),
        dir = {
          x: (to.x - from.x) / len,
          y: (to.y - from.y) / len,
          z: (to.z - from.z) / len,
        };
      if (
        !MAPS[s.map].solids.some(
          (g) => !g.detail && raySolid(from, dir, g, len) < len,
        )
      )
        takeDamage(s, 14, from);
    }
  }
  return true;
}
