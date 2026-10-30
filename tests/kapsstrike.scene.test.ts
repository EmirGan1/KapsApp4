import test from "node:test";
import assert from "node:assert/strict";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { EngineStore } from "@babylonjs/core/Engines/engineStore";
import { StrikeRenderer } from "../src/games/kapsstrike/renderer";
import { createTraining, shoot } from "../src/games/kapsstrike/combat";
import { MAPS } from "../src/games/kapsstrike/maps";
import { DEFAULT_SETTINGS, WEAPON_ORDER } from "../src/games/kapsstrike/config";
for (const map of Object.values(MAPS))
  for (const quality of ["low", "medium", "high"] as const)
    test(`Babylon scene ${map.id}/${quality}: geometry, viewmodels, pools, frame and disposal`, () => {
      const before = EngineStore.Instances.length,
        engine = new NullEngine({
          renderWidth: 960,
          renderHeight: 600,
          textureSize: 512,
          deterministicLockstep: false,
          lockstepMaxSteps: 4,
        }),
        renderer = new StrikeRenderer(
          {} as HTMLCanvasElement,
          map,
          { ...DEFAULT_SETTINGS, quality },
          engine,
        );
      const state = createTraining(map.id);
      renderer.render(state,0,0,false,1,state.player.movement.position,1/60);
      const count = renderer.scene.meshes.length;
      assert.ok(count > 120);
      assert.ok(renderer.scene.activeCamera);
      for (const id of WEAPON_ORDER) {
        state.player.weapon.selected = id;
        state.player.weapon.nextFire = 0;
        shoot(state, false);
        renderer.process(state.events);
        renderer.render(
          state,
          0,
          0,
          true,
          1,
          state.player.movement.position,
          1 / 60,
        );
        assert.equal(renderer.scene.meshes.length, count);
      }
      assert.equal(
        renderer.scene
          .getTransformNodeByName(state.player.weapon.selected)
          ?.isEnabled(false),
        true,
      );
      renderer.dispose();
      assert.ok(engine.isDisposed);
      assert.equal(engine.scenes.length, 0);
      assert.equal(EngineStore.Instances.length, before);
    });
test("20 repeated load/dispose cycles keep the engine registry stable", () => {
  const before = EngineStore.Instances.length;
  for (let i = 0; i < 20; i++) {
    const engine = new NullEngine(),
      renderer = new StrikeRenderer(
        {} as HTMLCanvasElement,
        MAPS.warehouse,
        { ...DEFAULT_SETTINGS, quality: "low" },
        engine,
      );
    renderer.dispose();
  }
  assert.equal(EngineStore.Instances.length, before);
});
test("failed scene construction releases its engine and partial scene", () => {
  const before = EngineStore.Instances.length,
    engine = new NullEngine();
  assert.throws(
    () =>
      new StrikeRenderer(
        {} as HTMLCanvasElement,
        { ...MAPS.warehouse, targets: null as any },
        { ...DEFAULT_SETTINGS, quality: "low" },
        engine,
      ),
  );
  assert.ok(engine.isDisposed);
  assert.equal(EngineStore.Instances.length, before);
});
test('cosmetic knife models switch safely, preserve gameplay and dispose owned materials',()=>{
 const engine=new NullEngine();const renderer=new StrikeRenderer({} as HTMLCanvasElement,MAPS.dust,{...DEFAULT_SETTINGS},engine);
 const state=createTraining('dust');state.player.weapon.selected='knife';
 for(const style of ['butterfly','karambit','tanto']){
  renderer.updateSettings({...DEFAULT_SETTINGS,cosmeticLoadout:{knife:'knife-'+style,rifle:'rifle-3'}});
  const meshes=renderer.scene.getTransformNodeByName('knife')!.getChildMeshes();
  const active=meshes.filter(m=>m.isEnabled(false));assert.ok(active.length>0);assert.ok(active.every(m=>m.metadata.knifeStyle===style));
  renderer.inspect();renderer.render(state,0,0,false,1,state.player.movement.position,1/60);
  assert.equal(state.player.hp,100);
 }
 renderer.dispose();assert.ok(engine.isDisposed);
});
