import React,{useMemo} from 'react';
import type {MapDefinition} from '../../../games/kapsstrike/types';
import type {StrikeHUD} from '../../../games/kapsstrike/controller';
import { getDust2V2Callout } from '../../../games/kapsstrike/dust2v2';
import { getBollucaV2Callout } from '../../../games/kapsstrike/bollucaV2';
/** North-up tactical overview: self, team and supplies. Never reveals enemies through walls. */
export default function StrikeMinimap({map,hud}:{map:MapDefinition;hud:StrikeHUD}){
 // Walkable decks and overhead roofs must not look like solid building blocks.
 const floor=/raised-floor|catwalk-deck|stair-tread|a-ramp|entrance-ramp|b-doors-ramp|(?:site|apron|core|rear|floor)-infill|bolluca-deck|bolluca-step|bolluca-slope|bollucav2-deck|bollucav2-step|bollucav2-slope|bollucav2-b-site-plinth|dust2v2-deck|dust2v2-slope|dust2v2-b-plat-step|dust2v2-pit-basin/;
 const overhead=/tunnels-roof|tunnel-entrance-roof|tunnel-stairs-roof|drop-bulkhead|long-doors-ceiling|underpass-roof|roof-beam|roof-remnant|lintel|arch-header|bolluca-roof|bollucav2-roof|bollucav2-.*-header|bollucav2-.*-lintel|dust2v2-roof|dust2v2-.*-bulkhead|dust2v2-under-a-arch-beam|dust2v2-a-short-bridge/;
 const buildings=useMemo(()=>map.solids.filter(s=>!s.detail&&!s.hidden&&s.h>1.5&&!floor.test(s.id)&&!overhead.test(s.id)),[map]);
 const terraces=useMemo(()=>map.solids.filter(s=>floor.test(s.id)),[map]);
 const b=map.bounds,p=hud.position;if(!p)return null;
 const callout=map.id==='dust2v2'?getDust2V2Callout(p.x,p.y,p.z):map.id==='bollucav2'?getBollucaV2Callout(p.x,p.y,p.z):null;
 return <aside className="ks-minimap" aria-label="Taktik mini harita"><svg viewBox={`${-b} ${-b} ${b*2} ${b*2}`} role="img" aria-label={`${map.name} mini haritası`}>
 <rect x={-b} y={-b} width={b*2} height={b*2} fill="#0c1b25"/>
 {map.radarFootprint?.map(([west,east,south,north])=><rect key={`${west},${east},${south},${north}`} x={west} y={-north} width={east-west} height={north-south} fill="#405c6b"/>)}
 {!map.radarFootprint&&map.routes?.map(r=><polyline key={r.name} points={r.points.map(p=>`${p.x},${-p.z}`).join(' ')} fill="none" stroke="#304756" strokeWidth="3"/>)}
 {terraces.map(s=><rect key={s.id} x={s.x-s.w/2} y={-s.z-s.d/2} width={s.w} height={s.d} fill="#3b5965"/>)}
 {buildings.map(s=><rect key={s.id} x={s.x-s.w/2} y={-s.z-s.d/2} width={s.w} height={s.d} fill="#69818d"/>)}
 {hud.world?.pickups.filter(s=>!s.opened).map(s=><circle key={s.id} cx={s.position.x} cy={-s.position.z} r="1.7" fill={s.kind==='airdrop'?'#ff536e':'#f1c875'}/>)}
 {map.bombSites?.map(s=><g key={s.id}><circle cx={s.x} cy={-s.z} r={s.radius} fill="#f4ba5144" stroke="#ffca69" strokeWidth="1"/><text x={s.x} y={-s.z+3} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffe0a0">{s.id}</text></g>)}
 {hud.radar?.map((r,i)=><circle key={i} cx={r.x} cy={-r.z} r="1.6" fill="#67d9fc"/>)}
 <path d="M 0 -3 L -2 2 L 0 1 L 2 2 Z" fill="#fff" transform={`translate(${p.x} ${-p.z}) rotate(${(hud.yaw||0)*180/Math.PI})`}/>
 <text x={b-8} y={-b+10} fontSize="6" fill="#d5e5ec">N</text></svg><small>{callout ? `${map.name.split(' · ')[0]} · ${callout}` : map.name.split(' · ')[0]}</small></aside>;
}
