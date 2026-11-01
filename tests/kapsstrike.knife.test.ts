import test from 'node:test';import assert from 'node:assert/strict';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';import {Scene} from '@babylonjs/core/scene';import {TransformNode} from '@babylonjs/core/Meshes/transformNode';import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {createKnifeRig} from '../src/games/kapsstrike/knifeRig';
function setup(){const engine=new NullEngine(),scene=new Scene(engine),root=new TransformNode('knife',scene),m=new StandardMaterial('steel',scene),rig=createKnifeRig(scene,root,()=>m);return {engine,scene,rig};}
test('balisong blade, complete bite handle and latch stay attached to their hinges at every phase',()=>{const {engine,scene,rig}=setup();try{
 const latch=scene.getMeshByName('butterfly-latch')!,blade=scene.getMeshByName('butterfly-ground-blade')!;assert.equal(latch.parent,rig.bite);assert.equal(blade.parent,rig.blade);assert.equal(rig.bite.parent,rig.blade);
 for(const phase of [0,.1,.28,.5,.7,.85,.99,1]){rig.update('butterfly',phase,-1,1,1/60);for(const node of [rig.bite,rig.blade])node.computeWorldMatrix(true);const hinge=Vector3.TransformCoordinates(rig.bite.position,rig.blade.getWorldMatrix());assert.ok(Vector3.Distance(hinge,rig.bite.getAbsolutePosition())<1e-5);}
 rig.update('butterfly',-1,.2,1,1/60);assert.ok(Math.abs(rig.blade.rotation.x)>1);assert.ok(Math.abs(rig.bite.rotation.x)>1);
 for(let i=0;i<120;i++)rig.update('butterfly',-1,-1,i/60,1/60);assert.ok(Math.abs(rig.blade.rotation.x)<.0001);assert.ok(Math.abs(rig.bite.rotation.x)<.0001);
 }finally{scene.dispose();engine.dispose();}});
test('karambit is a closed tapered blade and lofted grip rotating about the finger ring, not the weapon centre',()=>{const {engine,scene,rig}=setup();try{
 const blade=scene.getMeshByName('karambit-hawkbill')!,grip=scene.getMeshByName('karambit-sculpted-grip')!,ring=scene.getMeshByName('karambit-integrated-ring')!;assert.ok(blade.getTotalVertices()>20);assert.ok(grip.getTotalVertices()>200);
 ring.computeWorldMatrix(true);const center=ring.getAbsolutePosition().clone();rig.update('karambit',-1,.4,1,1/60);ring.computeWorldMatrix(true);assert.ok(Vector3.Distance(center,ring.getAbsolutePosition())<1e-5,'ring centre must remain pinned during finger roll');
 const count=scene.meshes.length;for(let i=0;i<240;i++){rig.update('karambit',-1,-1,i/60,1/60);for(const mesh of [blade,grip,ring]){mesh.computeWorldMatrix(true);assert.ok(mesh.getWorldMatrix().asArray().every(Number.isFinite));}}assert.equal(scene.meshes.length,count);
 }finally{scene.dispose();engine.dispose();}});
