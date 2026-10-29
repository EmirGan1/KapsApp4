import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@libsql/client';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { createCharacter } from '../src/games/kapsstrike/character';
import { SKINS } from '../src/games/kapsstrike/skins';
import { StrikeProfiles } from '../src/server/strikeProfiles';
test('eight original character geometries share body/head geometry and dispose owned materials',()=>{
 const engine=new NullEngine();const scene=new Scene(engine);const variants=new Set<string>();
 for (const id of Object.keys(SKINS)) {
  const model=createCharacter(scene,'test',id,'blue',true,'#ff315d');
  variants.add(model.gearRoot.getChildMeshes().map(m=>m.name).sort().join(','));
  const shells=scene.meshes.filter(m=>m.name.endsWith('-outline'));
  assert.equal(shells.length,2);
  assert.ok(shells.every(m=>(m.material as any).emissiveColor.toHexString().toLowerCase()==='#ff315d'));
  assert.equal(model.body.getBoundingInfo().boundingBox.extendSize.x,.34);
  assert.equal(model.head.getBoundingInfo().boundingBox.extendSize.x,.22);
  model.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.materials.filter(m=>!['default material','lineShader'].includes(m.name)).length,0);
 }
 assert.equal(variants.size,8);scene.dispose();engine.dispose();
});
test('profile migration is idempotent and persists a skin per authenticated user identity',async()=>{
 const db=createClient({url:'file::memory:'});
 try {
  const a=new StrikeProfiles(db),b=new StrikeProfiles(db);
  assert.equal(await a.get(1),'classic');
  for(const skin of Object.keys(SKINS)) assert.equal(await a.set(1,skin),skin);
  assert.equal(await b.get(1),'street');assert.equal(await b.get(2),'classic');
  await assert.rejects(()=>a.set(1,'not-a-skin'));
  await a.set(2,'cyber');assert.equal(await a.get(1),'street');assert.equal(await b.get(2),'cyber');
 } finally {db.close();}
});
