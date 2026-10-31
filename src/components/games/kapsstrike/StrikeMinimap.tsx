import {BOMB_SITES} from '../../../games/kapsstrike/bomb';
import React,{useMemo} from 'react';
import type {MapDefinition} from '../../../games/kapsstrike/types';
import type {StrikeHUD} from '../../../games/kapsstrike/controller';
/** North-up tactical overview: self, team and supplies. Never reveals enemies through walls. */
export default function StrikeMinimap({map,hud}:{map:MapDefinition;hud:StrikeHUD}){
 const buildings=useMemo(()=>map.solids.filter(s=>!s.detail&&!s.hidden&&s.h>1.5),[map]);
 const b=map.bounds,p=hud.position;if(!p)return null;
 return <aside className="ks-minimap" aria-label="Taktik mini harita"><svg viewBox={`${-b} ${-b} ${b*2} ${b*2}`} role="img" aria-label={`${map.name} mini haritası`}>
 <rect x={-b} y={-b} width={b*2} height={b*2} fill="#0c1b25"/>
 {map.routes?.map(r=><polyline key={r.name} points={r.points.map(p=>`${p.x},${-p.z}`).join(' ')} fill="none" stroke="#304756" strokeWidth="3"/>)}
 {buildings.map(s=><rect key={s.id} x={s.x-s.w/2} y={-s.z-s.d/2} width={s.w} height={s.d} fill="#69818d"/>)}
 {hud.world?.pickups.filter(s=>!s.opened).map(s=><circle key={s.id} cx={s.position.x} cy={-s.position.z} r="1.7" fill={s.kind==='airdrop'?'#ff536e':'#f1c875'}/>)}
 {map.id==='district'&&BOMB_SITES.map(s=><g key={s.id}><circle cx={s.x} cy={-s.z} r={s.radius} fill="#f4ba5144" stroke="#ffca69" strokeWidth="1"/><text x={s.x} y={-s.z+3} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffe0a0">{s.id}</text></g>)}
 {hud.radar?.map((r,i)=><circle key={i} cx={r.x} cy={-r.z} r="1.6" fill="#67d9fc"/>)}
 <path d="M 0 -3 L -2 2 L 0 1 L 2 2 Z" fill="#fff" transform={`translate(${p.x} ${-p.z}) rotate(${(hud.yaw||0)*180/Math.PI})`}/>
 <text x={b-8} y={-b+10} fontSize="6" fill="#d5e5ec">N</text></svg><small>{map.name.split(' · ')[0]}</small></aside>;
}
