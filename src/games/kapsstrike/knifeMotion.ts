/** Wrist choreography for the straight tactical blades only. No balisong/ring rig changes. */
export function straightKnifeMotion(style:string,phase:'draw'|'inspect'|'attack',progress:number,heavy=false,combo=0){
 const p=Math.max(0,Math.min(1,progress)),tanto=style==='tanto',envelope=Math.sin(p*Math.PI),settle=(1-p)**2;
 let x=0,y=0,z=0,rx=0,ry=0,rz=0;
 if(phase==='draw'){
  x=(tanto?.14:-.12)*settle;y=-.3*settle+envelope*.035;z=-.16*settle;
  rx=(tanto?-.7:.45)*settle;ry=(tanto?1.35:-1)*settle;rz=(tanto?-.45:1.65)*settle;
 }else if(phase==='inspect'){
  const sweep=Math.sin(p*Math.PI)**2,turn=Math.sin(p*Math.PI*2)*sweep;
  x=-.09*sweep;y=.12*sweep;z=.035*sweep;rx=(tanto?-.38:.25)*sweep;
  ry=(tanto?1.65:-1.1)*sweep+turn*.25;rz=(tanto?.65:-.9)*sweep+turn*.35;
 }else{
  const dir=combo%2?1:-1,wind=Math.sin(Math.min(1,p/.28)*Math.PI),strike=Math.sin(Math.max(0,(p-.15)/.85)*Math.PI);
  if(heavy){z=.44*strike-.07*wind;x=(tanto?-.07:.11)*strike;y=-.08*strike;rx=(tanto?.5:-.35)*strike;ry=(tanto?.12:-.55)*strike;rz=(tanto?-.18:.65)*strike;}
  else{x=dir*(tanto?.23:.33)*envelope;z=.22*envelope;y=(tanto?-.08:.05)*envelope;rx=(tanto?-.2:.4)*envelope;ry=dir*(tanto?.85:.5)*envelope;rz=dir*(tanto?.55:1.05)*envelope;}
 }
 return {x,y,z,rx,ry,rz};
}
