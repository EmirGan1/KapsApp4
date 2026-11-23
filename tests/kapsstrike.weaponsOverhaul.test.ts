import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { EngineStore } from "@babylonjs/core/Engines/engineStore";
import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { DEFAULT_SETTINGS, WEAPON_ORDER } from "../src/games/kapsstrike/config";
import { MAPS } from "../src/games/kapsstrike/maps";
import { COSMETICS, CASES } from "../src/games/kapsstrike/cosmetics";
import { finishAppearance, finishTextureUrl } from "../src/games/kapsstrike/finishAppearance";
import { WEAPON_PBR_ASSETS, WEAPON_PRESENTATION } from "../src/games/kapsstrike/weaponAssets";
import {
  buildWeaponModel,
  buildSculptedStraightKnives,
  buildStandaloneSpecialKnife,
} from "../src/games/kapsstrike/weaponModels";
import {
  getWeaponRoleMaterial,
  resolveFinishMaterial,
} from "../src/games/kapsstrike/weaponMaterials";
import { createRemoteWeaponRig } from "../src/games/kapsstrike/remoteWeapon";
import { StrikeRenderer } from "../src/games/kapsstrike/renderer";
import { createTraining } from "../src/games/kapsstrike/combat";
import { createBombMatch } from "../src/games/kapsstrike/bomb";
import {
  dropBombWeapon,
  pickupBombWeapon,
  resolveActiveWeaponSkin,
} from "../src/games/kapsstrike/bombWeapons";
import {
  advanceWorld,
  claimSupply,
  createWorld,
  dropInventory,
  nearestSupply,
} from "../src/games/kapsstrike/world";
import { support } from "../src/games/kapsstrike/physics";
import type { PlayerState, WeaponId } from "../src/games/kapsstrike/types";

const FIREARMS: WeaponId[] = [
  "rifle",
  "carbine",
  "smg",
  "sniper",
  "shotgun",
  "pistol",
  "lmg",
  "railgun",
];

function makePlayer(id: string, x: number, y: number, z: number, selected: WeaponId = "rifle"): PlayerState {
  const st = createTraining("dust2v2");
  const p = st.player;
  p.id = id;
  p.movement.position = { x, y, z };
  p.yaw = 0.6;
  p.weapon.selected = selected;
  p.weapon.inventory = ["knife", "pistol", selected];
  p.weapon.ammo[selected] = 24;
  return p;
}

test("all 8 sculpted firearms and all 4 knife styles build rich non-box geometry with valid vertices and UVs", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    for (const detail of ["fp", "world"] as const) {
      for (const weapon of FIREARMS) {
        const root = buildWeaponModel(scene, weapon, { detail, quality: "high" });
        const meshes = root.getChildMeshes();
        assert.ok(
          meshes.length >= 6,
          `${weapon} (${detail}) should consist of multiple sculpted components (got ${meshes.length})`,
        );

        let totalVerts = 0;
        let skinnableCount = 0;
        let hardwareCount = 0;
        for (const m of meshes) {
          const pos = m.getVerticesData(VertexBuffer.PositionKind);
          const nrm = m.getVerticesData(VertexBuffer.NormalKind);
          const uvs = m.getVerticesData(VertexBuffer.UVKind);
          assert.ok(pos && pos.length > 0, `${weapon}/${m.name} missing positions`);
          assert.ok(nrm && nrm.length === pos.length, `${weapon}/${m.name} invalid normals`);
          assert.ok(uvs && uvs.length === (pos.length / 3) * 2, `${weapon}/${m.name} missing UVs`);
          for (let i = 0; i < pos.length; i++) {
            assert.ok(Number.isFinite(pos[i]), `${weapon}/${m.name} has non-finite vertex`);
          }
          // Verify no inside-out winding on custom lofted/curved/blade parts
          let cx = 0, cy = 0, cz = 0;
          const vCount = pos.length / 3;
          for (let i = 0; i < pos.length; i += 3) {
            cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2];
          }
          cx /= vCount; cy /= vCount; cz /= vCount;
          let outwardDot = 0;
          for (let i = 0; i < pos.length; i += 3) {
            outwardDot += (pos[i] - cx) * nrm[i] + (pos[i + 1] - cy) * nrm[i + 1] + (pos[i + 2] - cz) * nrm[i + 2];
          }
          assert.ok(outwardDot >= -0.001, `${weapon}/${m.name} has inverted inside-out winding (outwardDot=${outwardDot.toFixed(3)})`);
          totalVerts += vCount;
          if (m.metadata?.skinnable) skinnableCount++;
          else hardwareCount++;
        }
        assert.ok(totalVerts >= 150, `${weapon} (${detail}) vertex count too low (${totalVerts})`);
        assert.ok(skinnableCount >= 2, `${weapon} (${detail}) needs skinnable main surfaces`);
        assert.ok(hardwareCount >= 1, `${weapon} (${detail}) needs contrasting hardware/furniture surfaces`);
      }
    }

    // Straight knives (default + tanto)
    const knifeRoot = new TransformNode("test-knife-straight", scene);
    buildSculptedStraightKnives(scene, knifeRoot, "knife-", "high", 0, true);
    const defaultMeshes = knifeRoot.getChildMeshes().filter((m) => m.metadata?.knifeStyle === "default");
    const tantoMeshes = knifeRoot.getChildMeshes().filter((m) => m.metadata?.knifeStyle === "tanto");
    assert.ok(defaultMeshes.length >= 4, "default combat knife has sculpted blade + guard + grip + pommel");
    assert.ok(tantoMeshes.length >= 4, "tanto knife has sculpted blade + tsuba + wrap + pommel");
    assert.ok(defaultMeshes.some((m) => m.metadata?.knifePart === "blade"));
    assert.ok(tantoMeshes.some((m) => m.metadata?.knifePart === "blade"));

    // Standalone special knives (karambit + butterfly) for world/preview
    for (const style of ["karambit", "butterfly"] as const) {
      const specialRoot = new TransformNode(`test-knife-${style}`, scene);
      buildStandaloneSpecialKnife(scene, specialRoot, style, `special-${style}-`, "high");
      const children = specialRoot.getChildMeshes();
      assert.ok(children.length >= 3, `${style} standalone model built`);
      assert.ok(children.some((m) => m.metadata?.knifePart === "blade"));
    }
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test("cosmetics catalog (267 items / 9 cases), PBR asset manifest, and shared finish resolver stay intact", () => {
  assert.equal(COSMETICS.length, 267, "all 267 existing cosmetic IDs preserved");
  assert.equal(CASES.length, 9, "all 9 cases preserved");
  assert.equal(Object.keys(WEAPON_PBR_ASSETS).length, 7, "7 CC0 Poly Haven PBR material sets registered");
  for (const w of WEAPON_ORDER) {
    assert.ok(WEAPON_PRESENTATION[w], `presentation metadata exists for ${w}`);
    assert.ok(WEAPON_PRESENTATION[w].previewRadius > 0);
    assert.ok(WEAPON_PRESENTATION[w].groundY > 0);
  }

  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const urls = new Set<string>();
    for (const item of COSMETICS) {
      const ap = finishAppearance(item);
      assert.ok(ap.pbrSet in WEAPON_PBR_ASSETS, `${item.id} references valid CC0 PBR set`);
      assert.ok(ap.specularPower >= 24 && ap.specularPower <= 160);
      const url = finishTextureUrl(item);
      assert.ok(url.startsWith("data:image/svg+xml"), `${item.id} has valid finish atlas`);
      if (item.id.includes("-prism-")) urls.add(url);

      const mat = resolveFinishMaterial(scene, item, "high");
      assert.equal(mat.name, `finish-${item.id}`);
      assert.ok(mat.emissiveColor.r >= ap.glow - 0.001);
      assert.equal(resolveFinishMaterial(scene, item, "high"), mat);
    }
    assert.equal(urls.size, 144, "all 144 prism collector skins remain distinct");

    const steelA = getWeaponRoleMaterial(scene, "steel", "high");
    const steelB = getWeaponRoleMaterial(scene, "steel", "high");
    assert.equal(steelA, steelB, "role material is cached per scene");
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test("remote third-person weapon rig uses sculpted models and applies exact shared skins", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const handAnchor = new TransformNode("hand-anchor", scene);
    const fallbackMat = new StandardMaterial("fallback", scene);
    const rig = createRemoteWeaponRig(scene, "remote-1", handAnchor, () => fallbackMat);
    const akSkin = COSMETICS.find((c) => c.id === "rifle-1")!;
    rig.update("rifle", undefined, akSkin.id, false, 0);

    const rifleMeshes = handAnchor.getChildMeshes().filter((m) => m.isEnabled(true));
    assert.ok(rifleMeshes.length >= 6);
    assert.ok(
      rifleMeshes.some((m) => m.material?.name === `finish-${akSkin.id}`),
      "remote AK-47 displays exact equipped skin",
    );

    // Clearing skin reverts to stock PBR base material
    rig.update("rifle", undefined, undefined, false, 0);
    const stockMeshes = handAnchor.getChildMeshes().filter((m) => m.isEnabled(true));
    assert.ok(
      stockMeshes.every((m) => !m.material?.name.startsWith("finish-")),
      "remote AK-47 reverts cleanly to stock materials",
    );

    // Switching to karambit knife
    const karambitSkin = COSMETICS.find((c) => c.knife === "karambit")!;
    rig.update("knife", undefined, karambitSkin.id, false, 0);
    const activeKnife = handAnchor.getChildMeshes().filter((m) => m.isEnabled(true));
    assert.ok(activeKnife.length > 0);
    assert.ok(activeKnife.every((m) => m.metadata?.knifeStyle === "karambit"));
    assert.ok(activeKnife.some((m) => m.material?.name === `finish-${karambitSkin.id}`));
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test("dropped weapons preserve skinId, yaw, and grounded floor height across bomb maps including dust2v2/bollucav2", () => {
  for (const mapId of ["dust2v2", "bollucav2", "bolluca", "district", "warehouse"] as const) {
    const map = MAPS[mapId];
    const world = createWorld(map);
    const spawn = map.spawns[0];
    const bomb = createBombMatch(
      [
        { id: "p1", team: "T", position: { ...spawn } },
        { id: "p2", team: "CT", position: { ...spawn } },
      ],
      100,
    );
    bomb.phase = "active";
    bomb.players.p1.weapons = ["knife", "pistol", "rifle"];
    bomb.players.p2.weapons = ["knife", "pistol"];

    const p1 = makePlayer("p1", spawn.x, spawn.y, spawn.z, "rifle");
    const p2 = makePlayer("p2", spawn.x, spawn.y, spawn.z, "pistol");
    p2.weapon.inventory = ["knife", "pistol"];

    const loadoutP1: Partial<Record<WeaponId, string>> = { rifle: "rifle-3" };
    const loadoutP2: Partial<Record<WeaponId, string>> = { rifle: "rifle-1" };

    // P1 drops skinned AK-47
    const dropped = dropBombWeapon(bomb, world, p1, 10, false, loadoutP1, map);
    assert.equal(dropped, true, `drop works on ${mapId}`);
    const pickup = world.pickups.find((pk) => pk.kind === "dropped" && pk.weapon === "rifle");
    assert.ok(pickup, `dropped pickup exists on ${mapId}`);
    assert.equal(pickup.skinId, "rifle-3", "dropped weapon stores dropper skinId");
    assert.equal(pickup.yaw, p1.yaw, "dropped weapon stores yaw");
    const expectedFloor = support(map, pickup.position, spawn.y + 0.65);
    assert.ok(Math.abs(pickup.position.y - expectedFloor) < 0.05, `dropped weapon sits on floor on ${mapId}`);

    // Advancing world on bolluca/bollucav2/dust2v2 must NOT wipe dropped weapons
    advanceWorld(world, map, 20);
    assert.ok(
      world.pickups.some((pk) => pk.id === pickup.id && !pk.opened),
      `dropped weapon survives advanceWorld on ${mapId}`,
    );

    // P2 moves to dropped weapon and picks it up -> inherits P1's skin ("rifle-3"), NOT P2's loadout ("rifle-1")
    p2.movement.position = { ...pickup.position };
    const found = nearestSupply(world, map, p2);
    assert.equal(found?.id, pickup.id, `nearestSupply finds dropped weapon on ${mapId}`);
    const picked = pickupBombWeapon(bomb, world, map, p2, 25, loadoutP2);
    assert.equal(picked, true, `pickupBombWeapon succeeds on ${mapId}`);
    assert.equal(resolveActiveWeaponSkin(p2, "rifle", loadoutP2), "rifle-3", "picked-up gun retains dropper's skin");

    // Re-dropping by P2 keeps P1's original skin ("rifle-3")
    const redropped = dropBombWeapon(bomb, world, p2, 30, false, loadoutP2, map);
    assert.equal(redropped, true);
    const secondPickup = world.pickups.find((pk) => pk.kind === "dropped" && !pk.opened && pk.weapon === "rifle");
    assert.equal(secondPickup?.skinId, "rifle-3", "re-dropped weapon preserves original skin");
  }
});

test("stock dropped weapon explicitly overrides picker's equipped skin with stock finish", () => {
  const map = MAPS.dust2v2;
  const world = createWorld(map);
  const spawn = map.spawns[0];
  const bomb = createBombMatch(
    [
      { id: "p1", team: "T", position: { ...spawn } },
      { id: "p2", team: "CT", position: { ...spawn } },
    ],
    100,
  );
  bomb.phase = "active";
  bomb.players.p1.weapons = ["knife", "pistol", "sniper"];
  bomb.players.p2.weapons = ["knife", "pistol"];

  const p1 = makePlayer("p1", spawn.x, spawn.y, spawn.z, "sniper");
  const p2 = makePlayer("p2", spawn.x, spawn.y, spawn.z, "pistol");
  p2.weapon.inventory = ["knife", "pistol"];

  // P1 has NO sniper skin (stock AWP); P2 owns sniper-1
  assert.equal(dropBombWeapon(bomb, world, p1, 10, false, {}, map), true);
  const dropped = world.pickups.find((pk) => pk.kind === "dropped")!;
  assert.equal(dropped.skinId, undefined);

  p2.movement.position = { ...dropped.position };
  assert.equal(pickupBombWeapon(bomb, world, map, p2, 15, { sniper: "sniper-1" }), true);
  assert.equal(
    resolveActiveWeaponSkin(p2, "sniper", { sniper: "sniper-1" }),
    undefined,
    "picked-up stock AWP remains stock even when picker owns a sniper skin",
  );
});

test("death drop (dropInventory) & claimSupply preserve skinId and renderer displays skinned dropped weapons in bomb mode", () => {
  const map = MAPS.warehouse;
  const world = createWorld(map);
  const spawn = map.spawns[0];
  const p1 = makePlayer("p1", spawn.x, spawn.y, spawn.z, "carbine");
  const p2 = makePlayer("p2", spawn.x, spawn.y, spawn.z, "pistol");
  p2.weapon.inventory = ["knife", "pistol"];

  dropInventory(world, p1, 100, map, { carbine: "carbine-2" });
  const dropped = world.pickups.find((pk) => pk.kind === "dropped" && pk.weapon === "carbine");
  assert.ok(dropped);
  assert.equal(dropped.skinId, "carbine-2");

  // Renderer renders dropped 3D weapon with matching skin even in bomb mode on dust2v2
  const before = EngineStore.Instances.length;
  const engine = new NullEngine();
  const renderer = new StrikeRenderer(
    {} as HTMLCanvasElement,
    MAPS.dust2v2,
    { ...DEFAULT_SETTINGS, quality: "high", cosmeticLoadout: { rifle: "rifle-1" } },
    engine,
  );
  try {
    const state = createTraining("dust2v2");
    state.bomb = createBombMatch(
      [
        { id: state.player.id, team: "T", position: { ...state.player.movement.position } },
        { id: "ct-bot", team: "CT", position: { ...state.player.movement.position } },
      ],
      0,
    );
    state.world = world;
    renderer.render(state, 0, 0, false, 1, state.player.movement.position, 1 / 60);
    const droppedNode = renderer.scene.getTransformNodeByName(dropped.id);
    assert.ok(droppedNode, "3D dropped weapon TransformNode created in bomb mode");
    const skinnedMesh = droppedNode
      .getChildMeshes()
      .find((m) => m.material?.name === "finish-carbine-2");
    assert.ok(skinnedMesh, "3D dropped weapon carries exact dropper skin finish-carbine-2");

    // Picked-up skin updates FP viewmodel dynamically
    claimSupply(world, map, p2, 110);
    assert.equal(p2.weapon.pickedSkins?.carbine, "carbine-2");
    state.player.weapon.selected = "carbine";
    state.player.weapon.pickedSkins = { carbine: "carbine-2" };
    renderer.render(state, 0, 0, false, 1, state.player.movement.position, 1 / 60);
    const fpCarbine = renderer.scene.getTransformNodeByName("carbine")!;
    assert.ok(
      fpCarbine.getChildMeshes().some((m) => m.material?.name === "finish-carbine-2"),
      "first-person viewmodel displays picked-up weapon skin",
    );
  } finally {
    renderer.dispose();
  }
  assert.equal(EngineStore.Instances.length, before, "zero leaked Babylon engines");
});
