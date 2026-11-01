import {Scene} from '@babylonjs/core/scene';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder';
import {StandardMaterial} from '@babylonjs/core/Materials/standardMaterial';
import {Color3} from '@babylonjs/core/Maths/math.color';
import {Vector3} from '@babylonjs/core/Maths/math.vector';
import {playerHitboxes,type HitPose} from './hitboxes';
/** Development-only visualization; no socket request can enable server diagnostics. */
export class CombatDebug {
 private groups=new Map<string,TransformNode>();
 private rays:ReturnType<typeof MeshBuilder.CreateLines>[]=[];
 private materials:StandardMaterial[]=[];
 constructor(private scene:Scene){}
 poses(poses:(HitPose&{id:string})[],authority=false){
  const prefix=authority?'rewound:':'rendered:',active=new Set<string>();
  for(const p of poses){const key=prefix+p.id;active.add(key);let root=this.groups.get(key);
   if(!root){root=new TransformNode(key,this.scene);this.groups.set(key,root);const index=authority?1:0;let mat=this.materials[index];if(!mat){mat=new StandardMaterial(prefix+'wire',this.scene);mat.emissiveColor=Color3.FromHexString(authority?'#ffb347':'#31d8ff');mat.disableLighting=true;mat.wireframe=true;this.materials[index]=mat;}
    for(const b of playerHitboxes(p.height)){const m=MeshBuilder.CreateBox(key+b.part,{size:1},this.scene);m.parent=root;m.material=mat;m.isPickable=false;m.metadata={part:b.part};}
   }
   root.position.set(p.position.x,p.position.y,p.position.z);root.rotation.y=p.yaw||0;
   const bounds=playerHitboxes(p.height);for(const m of root.getChildMeshes()){const b=bounds.find(b=>b.part===m.metadata.part)!;m.position.set((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2);m.scaling.set(b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z);m.rotation.x=b.part==='head'?p.pitch||0:0;}
  }
  for(const [id,node] of this.groups)if(id.startsWith(prefix)&&!active.has(id)){node.dispose();this.groups.delete(id);}
 }
 shot(value:any){this.poses(value.targets||[],true);for(const r of value.rays||[]){const m=MeshBuilder.CreateLines('authoritative-ray',{points:[new Vector3(r.from.x,r.from.y,r.from.z),new Vector3(r.to.x,r.to.y,r.to.z)]},this.scene);m.color=Color3.FromHexString(value.outcome==='hit'?'#6dff84':'#ffb347');m.isPickable=false;this.rays.push(m);while(this.rays.length>32)this.rays.shift()!.dispose();}}
 dispose(){for(const n of this.groups.values())n.dispose();for(const r of this.rays)r.dispose();for(const m of this.materials)m?.dispose();this.groups.clear();this.rays=[];this.materials=[];}
}
