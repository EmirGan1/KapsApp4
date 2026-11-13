import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { BOMB_SHOP, buyBombEquipment } from "../src/games/kapsstrike/bomb";
import { grenadeLaunch, stepGrenade } from "../src/games/kapsstrike/grenades";
import { fits, newMovement, overlaps } from "../src/games/kapsstrike/physics";
import { MAPS } from "../src/games/kapsstrike/maps";
import { createCharacter } from "../src/games/kapsstrike/character";
import { createRemoteWeaponRig } from "../src/games/kapsstrike/remoteWeapon";
import { cosmetic, type Cosmetic } from "../src/games/kapsstrike/cosmetics";
import { KapsStrikeServerManager } from "../src/server/kapsstrikeServer";
import type { MapDefinition } from "../src/games/kapsstrike/types";

test("grenade shop prices are lowered while keeping full equipment rules", () => {
  assert.equal(BOMB_SHOP.flash, 100);
  assert.equal(BOMB_SHOP.frag, 150);
  assert.equal(BOMB_SHOP.smoke, 150);
});

test("angled wall bank shot reflects off wall normal and preserves forward tangential travel", () => {
  const bankMap: MapDefinition = {
    ...MAPS.district,
    bounds: 60,
    solids: [
      { id: "side-wall", kind: "box", x: 1.5, y: 0, z: 4, w: 0.4, h: 4, d: 12, color: "#777" },
    ],
  };
  // Aim diagonally into the x = 1.3 wall face while moving forward in +Z
  const g = grenadeLaunch(
    "bank",
    "flash",
    "p",
    "T",
    { x: 0, y: 1.5, z: 0 },
    { x: 0.65, y: 0.05, z: 0.76 },
    0,
    false,
    { x: 0, y: 0, z: 0 },
  );
  for (let tick = 1; tick <= 80; tick++) {
    stepGrenade(g, bankMap, 1 / 120, tick / 120);
  }
  // X velocity must reflect negative back off the wall, while Z keeps traveling forward past z=4
  assert.ok(g.velocity.x < -1, `Expected reflected negative X velocity, got ${g.velocity.x}`);
  assert.ok(g.velocity.z > 5, `Expected preserved forward Z velocity, got ${g.velocity.z}`);
  assert.ok(g.position.x < 1.3, `Expected grenade on left side of wall, got ${g.position.x}`);
  assert.ok(g.position.z > 4, `Expected grenade to continue down corridor past z=4, got ${g.position.z}`);
});

test("physics accurately treats cylindrical solids as elliptical instead of square AABB corners", () => {
  const cylMap: MapDefinition = {
    ...MAPS.district,
    bounds: 40,
    solids: [
      { id: "barrel", kind: "box", shape: "cylinder", x: 0, y: 0, z: 0, w: 2, h: 2, d: 2, color: "#555" },
    ],
  };
  const barrel = cylMap.solids[0];
  // Corner at (1.15, 0, 1.15) is inside square AABB expanded by radius 0.34 (1.34)
  // but outside cylinder radius 1.0 + 0.34 = 1.34 since hypot(1.15, 1.15) = 1.626 > 1.34
  const cornerPos = { x: 1.15, y: 0, z: 1.15 };
  assert.equal(overlaps(barrel, cornerPos), false);
  assert.equal(fits(cylMap, cornerPos, 1.75), true);

  // Cardinal point inside cylinder radius + player radius must still collide
  const frontPos = { x: 1.2, y: 0, z: 0 };
  assert.equal(overlaps(barrel, frontPos), true);
  assert.equal(fits(cylMap, frontPos, 1.75), false);
  assert.ok(newMovement(cornerPos).position.x === 1.15);
});

test("server validates heldItem ownership and broadcasts heldItem + weaponSkin in snapshots", () => {
  const io: any = { to: () => ({ emit() {} }), emit() {} };
  const server = new KapsStrikeServerManager(io);
  const room = server.createRoom({ id: 1, username: "alpha", avatar: null }, "a", { mode: "bomb" });
  server.joinRoom(room.roomCode, { id: 2, username: "bravo", avatar: null }, "b");
  server.setReady("b", true);
  assert.equal(server.startGame("a").success, true);
  server.stopRoomSimulationLoop(room);
  server.tickSimulation(room);

  const playerA = room.players.get("a")!;
  const playerB = room.players.get("b")!;
  playerA.cosmeticLoadout.rifle = "rifle-3";
  playerA.cosmeticLoadout.knife = "knife-karambit";
  const bomb = room.bomb!;
  bomb.players[playerA.id].money = 5000;
  assert.ok(buyBombEquipment(bomb, playerA.id, "rifle", 0));
  assert.ok(buyBombEquipment(bomb, playerA.id, "flash", 0));

  // Unowned smoke or bomb during active phase must be rejected
  bomb.phase = "active";
  bomb.deadline = 1000;
  bomb.carrier = playerA.id;

  server.processPlayerInput(playerA.id, {
    sequence: 1,
    tick: room.tick,
    moveX: 0,
    moveZ: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    sprint: false,
    crouch: false,
    fire: false,
    ads: false,
    reload: false,
    weapon: "rifle",
    heldItem: "smoke", // A does not own smoke
  });
  server.tickSimulation(room);
  assert.equal(playerA.heldItem, undefined);
  assert.equal(playerA.state.weapon.selected, "rifle");

  // Owned flash must be accepted and propagated in snapshot
  server.processPlayerInput(playerA.id, {
    sequence: 2,
    tick: room.tick,
    moveX: 0,
    moveZ: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    sprint: false,
    crouch: false,
    fire: false,
    ads: false,
    reload: false,
    heldItem: "flash",
  });
  server.tickSimulation(room);
  assert.equal(playerA.heldItem, "flash");

  // Carrier holding C4 during active phase must be accepted
  server.processPlayerInput(playerA.id, {
    sequence: 3,
    tick: room.tick,
    moveX: 0,
    moveZ: 0,
    yaw: 0,
    pitch: 0,
    jump: false,
    sprint: false,
    crouch: false,
    fire: false,
    ads: false,
    reload: false,
    heldItem: "bomb",
  });
  server.tickSimulation(room);
  assert.equal(playerA.heldItem, "bomb");

  const snap = room.getSnapshotForPlayer(playerB.id);
  const snapA = snap.players.find((p: any) => p.id === playerA.id)!;
  assert.equal(snapA.heldItem, "bomb");
  assert.equal(snapA.weaponSkin, "rifle-3");

  const pubA = room.getPublicRoomState().players.find((p) => p.id === playerA.id)!;
  assert.equal(pubA.weaponSkin, "rifle-3");
});

test("remote weapon rig renders rifles, knives with finishes, grenades, and C4 cleanly on handAnchor", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const mats = new Map<string, StandardMaterial>();
  const material = (color: string) => {
    let m = mats.get(color);
    if (!m) {
      m = new StandardMaterial(`m-${color}`, scene);
      m.diffuseColor = Color3.FromHexString(color);
      mats.set(color, m);
    }
    return m;
  };
  const finishMat = (c: Cosmetic) => material(c.accent);

  const model = createCharacter(scene, "opp", "sas_night", "red", false);
  const rig = createRemoteWeaponRig(scene, "opp", model.handAnchor, material, finishMat);

  try {
    // 1. Rifle with cosmetic skin
    const rifleSkin = cosmetic("rifle-2")!;
    rig.update("rifle", undefined, rifleSkin.id, false, 0.25);
    const rifleNode = scene.getTransformNodeByName("remote-held-opp-rifle")!;
    assert.ok(rifleNode.isEnabled());
    assert.ok(
      rifleNode.getChildMeshes().some((m) => m.material === finishMat(rifleSkin)),
      "Skinned rifle parts should receive finishMaterial",
    );

    // 2. Karambit knife skin
    const karambitSkin = cosmetic("knife-karambit")!;
    rig.update("knife", undefined, karambitSkin.id, true, -0.3);
    assert.equal(rifleNode.isEnabled(), false);
    const knifeNode = scene.getTransformNodeByName("remote-held-opp-knife:karambit")!;
    assert.ok(knifeNode.isEnabled());
    assert.ok(model.handAnchor.position.y < 0.7, "Crouch lowers handAnchor height");
    assert.ok(
      knifeNode.getChildMeshes().some((m) => m.material === finishMat(karambitSkin)),
      "Karambit blades should receive knife cosmetic finish",
    );

    // 3. Flashbang & C4 bomb held items
    rig.update("rifle", "flash", rifleSkin.id, false, 0);
    assert.equal(knifeNode.isEnabled(), false);
    assert.ok(scene.getTransformNodeByName("remote-held-opp-flash")!.isEnabled());

    rig.update("rifle", "bomb", rifleSkin.id, false, 0);
    assert.equal(scene.getTransformNodeByName("remote-held-opp-flash")!.isEnabled(), false);
    assert.ok(scene.getTransformNodeByName("remote-held-opp-bomb")!.isEnabled());
  } finally {
    model.dispose();
    scene.dispose();
    engine.dispose();
  }
});
