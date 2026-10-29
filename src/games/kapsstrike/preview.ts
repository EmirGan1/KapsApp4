import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
/** CPU projection of the exact game meshes. A menu preview needs no second WebGL context. */
export function drawCharacterPreview(root:TransformNode,ctx:CanvasRenderingContext2D,width:number,height:number){
 const triangles:{points:{x:number;y:number}[];depth:number;color:string}[]=[];
 root.computeWorldMatrix(true);
 for(const mesh of root.getChildMeshes()){
  const vertices=mesh.getVerticesData('position'),normals=mesh.getVerticesData('normal'),indices=mesh.getIndices();if(!vertices||!indices||!normals)continue;
  const matrix=mesh.computeWorldMatrix(true),m=mesh.material as StandardMaterial;
  for(let i=0;i<indices.length;i+=3){
   const points=[indices[i],indices[i+1],indices[i+2]].map(j=>Vector3.TransformCoordinates(Vector3.FromArray(vertices,j*3),matrix));
   const normal=Vector3.TransformNormal(Vector3.FromArray(normals,indices[i]*3),matrix).normalize();
   const center=points[0].add(points[1]).add(points[2]).scale(1/3);
   if(Vector3.Dot(normal,new Vector3(-center.x,1-center.y,4-center.z))<=0)continue;
   const light=.5+.5*Math.max(0,Vector3.Dot(normal,new Vector3(.25,.8,.55).normalize()));
   const rgb=m.diffuseColor.scale(light);triangles.push({depth:4-center.z,color:`rgb(${Math.round(rgb.r*255)} ${Math.round(rgb.g*255)} ${Math.round(rgb.b*255)})`,points:points.map(v=>({x:width/2+v.x*height*1.5/(4-v.z),y:height*.52-(v.y-1)*height*1.5/(4-v.z)}))});
  }
 }
 ctx.fillStyle='#101923';ctx.fillRect(0,0,width,height);
 triangles.sort((a,b)=>b.depth-a.depth);
 for(const t of triangles){ctx.beginPath();ctx.moveTo(t.points[0].x,t.points[0].y);for(const p of t.points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle=t.color;ctx.fill();}
}
