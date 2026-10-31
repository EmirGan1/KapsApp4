import type {Vec3,WeaponId} from './types';
export type BombSide='T'|'CT';
export type BombPhase='buy'|'active'|'planted'|'result'|'finished';
export const BOMB_RULES={buy:15,round:105,plant:3.2,explode:40,defuse:10,kitDefuse:5,transition:5,maxMoney:16000,startMoney:800,winReward:3250,lossReward:1400,lossStep:500,killReward:300,objectiveReward:300};
export const BOMB_SITES=[{id:'A',x:-23,z:15,radius:6},{id:'B',x:24,z:17,radius:5}] as const;
export const BOMB_SHOP={pistol:200,smg:1200,rifle:2700,shotgun:1800,sniper:4500,armor:650,kit:400} as const;
export interface BombPlayer {id:string;team:BombSide;alive:boolean;position:Vec3;money:number;armor:number;kit:boolean;weapons:WeaponId[];plants:number;defuses:number;holdUntil:number}
export interface BombMatch {phase:BombPhase;round:number;deadline:number;scores:{T:number;CT:number};carrier?:string;position?:Vec3;site?:string;action?:{player:string;kind:'plant'|'defuse';started:number;position:Vec3};winner?:BombSide;reason?:string;target:number;half:number;swapped:boolean;loss:{T:number;CT:number};players:Record<string,BombPlayer>}
const near=(a:Vec3,b:Vec3,r:number)=>Math.hypot(a.x-b.x,a.z-b.z)<=r&&Math.abs(a.y-b.y)<2;
export function createBombMatch(players:{id:string;team:BombSide;position:Vec3}[],now:number,long=false):BombMatch{
 if(players.length<2||players.length>10||!players.some(p=>p.team==='T')||!players.some(p=>p.team==='CT')||['T','CT'].some(t=>players.filter(p=>p.team===t).length>5))throw new Error('Maç için her takımda 1–5 oyuncu gerekli.');
 const match:BombMatch={phase:'buy',round:1,deadline:now+BOMB_RULES.buy,scores:{T:0,CT:0},target:long?13:7,half:long?12:6,swapped:false,loss:{T:0,CT:0},players:{}};
 for(const p of players)match.players[p.id]={...p,alive:true,money:BOMB_RULES.startMoney,armor:0,kit:false,weapons:['pistol','knife'],plants:0,defuses:0,holdUntil:0};
 match.carrier=players.find(p=>p.team==='T')!.id;return match;
}
export function bombPurchaseError(m:BombMatch,id:string,item:string,now:number):string|undefined {
 const p=m.players[id];
 if(!p||!p.alive)return 'Satın almak için hayatta olmalısın.';
 if(m.phase!=='buy'||now>=m.deadline)return 'Satın alma süresi sona erdi.';
 if(!Object.hasOwn(BOMB_SHOP,item))return 'Geçersiz ekipman.';
 if(item==='kit'&&p.team!=='CT')return 'Çözme kiti yalnızca CT için.';
 if(item==='kit'?p.kit:item==='armor'?p.armor>=100:p.weapons.includes(item as WeaponId))return 'Bu ekipmana zaten sahipsin.';
 if(p.money<BOMB_SHOP[item as keyof typeof BOMB_SHOP])return 'Yeterli paran yok.';
}
export function buyBombEquipment(m:BombMatch,id:string,item:string,now:number){
 if(bombPurchaseError(m,id,item,now))return false;
 const p=m.players[id];
 if(item==='kit')p.kit=true;
 else if(item==='armor')p.armor=100;
 else p.weapons.push(item as WeaponId);
 p.money-=BOMB_SHOP[item as keyof typeof BOMB_SHOP];return true;
}
/** A client never receives another player's economy, loadout or objective action. */
export function bombView(m:BombMatch,id:string):BombMatch {
 const v=structuredClone(m),me=m.players[id];
 for(const p of Object.values(v.players))if(p.id!==id){
  p.money=0;p.armor=0;p.kit=false;p.weapons=[];p.holdUntil=0;p.position={x:0,y:0,z:0};
 }
 if(me?.team!=='T'&&v.phase!=='planted'&&v.phase!=='result'&&v.phase!=='finished'){
  delete v.carrier;delete v.position;
 }
 if(v.action?.player!==id)delete v.action;
 return v;
}
export function dropBomb(m:BombMatch,id:string){if(m.carrier!==id||m.phase!=='active')return false;m.position={...m.players[id].position};delete m.carrier;delete m.action;return true;}
export function bombInteract(m:BombMatch,id:string,held:boolean,now:number){const p=m.players[id];if(!p||!p.alive)return false;p.holdUntil=held?now+.3:0;if(!held){if(m.action?.player===id)delete m.action;return true;}if(m.phase==='active'&&p.team==='T'){
 if(m.position&&!m.carrier&&near(p.position,m.position,2)){m.carrier=id;delete m.position;return true;}
 if(m.carrier===id){const site=BOMB_SITES.find(s=>near(p.position,{x:s.x,y:0,z:s.z},s.radius));if(site&&!m.action)m.action={player:id,kind:'plant',started:now,position:{...p.position}};return !!site;}
 }if(m.phase==='planted'&&p.team==='CT'&&m.position&&near(p.position,m.position,2)&&!m.action){m.action={player:id,kind:'defuse',started:now,position:{...p.position}};return true;}return false;}
function finish(m:BombMatch,side:BombSide,reason:string,now:number){if(m.phase==='result'||m.phase==='finished')return;m.phase='result';m.winner=side;m.reason=reason;m.scores[side]++;m.deadline=now+BOMB_RULES.transition;delete m.action;const loser=side==='T'?'CT':'T';m.loss[side]=0;m.loss[loser]++;for(const p of Object.values(m.players))p.money=Math.min(BOMB_RULES.maxMoney,p.money+(p.team===side?BOMB_RULES.winReward:BOMB_RULES.lossReward+Math.min(4,m.loss[loser]-1)*BOMB_RULES.lossStep));}
/** Absolute monotonic server time; explosion wins ties, action results are idempotent. */
export function stepBomb(m:BombMatch,now:number){
 if(m.phase==='finished')return;
 const all=Object.values(m.players);
 if(m.carrier&&!m.players[m.carrier]?.alive)dropBomb(m,m.carrier);
 if(m.action){const a=m.action,p=m.players[a.player];if(!p?.alive||p.holdUntil<now||!near(p.position,a.position,.4)||(a.kind==='plant'&&(!BOMB_SITES.some(s=>near(p.position,{x:s.x,y:0,z:s.z},s.radius))||m.carrier!==p.id))||(a.kind==='defuse'&&(!m.position||!near(p.position,m.position,2))))delete m.action;}
 if(m.phase==='planted'&&now>=m.deadline){finish(m,'T','Bomba patladı',now);return;}
 if(m.action){const a=m.action,p=m.players[a.player],duration=a.kind==='plant'?BOMB_RULES.plant:p.kit?BOMB_RULES.kitDefuse:BOMB_RULES.defuse;if(now-a.started>=duration){if(a.kind==='plant'&&now<m.deadline){m.phase='planted';m.position={...p.position};m.site=BOMB_SITES.find(s=>near(p.position,{x:s.x,y:0,z:s.z},s.radius))?.id;delete m.carrier;m.deadline=now+BOMB_RULES.explode;p.plants++;p.money=Math.min(BOMB_RULES.maxMoney,p.money+BOMB_RULES.objectiveReward);delete m.action;}else if(a.kind==='defuse'){p.defuses++;p.money=Math.min(BOMB_RULES.maxMoney,p.money+BOMB_RULES.objectiveReward);finish(m,'CT','Bomba çözüldü',now);return;}}}
 if(m.phase==='active'){if(!all.some(p=>p.team==='T'&&p.alive))finish(m,'CT','Saldıran takım elendi',now);else if(!all.some(p=>p.team==='CT'&&p.alive))finish(m,'T','Savunan takım elendi',now);else if(now>=m.deadline)finish(m,'CT','Raund süresi doldu',now);}
 if(m.phase==='buy'&&now>=m.deadline){m.phase='active';m.deadline=now+BOMB_RULES.round;}
 if(m.phase==='result'&&now>=m.deadline){
  const played=m.scores.T+m.scores.CT;
  // Normal time ends at target; overtime is paired rounds with a two-round lead.
  if((played<=m.half*2&&Math.max(m.scores.T,m.scores.CT)>=m.target)||(played>m.half*2&&(played-m.half*2)%2===0&&m.scores.T!==m.scores.CT)){m.phase='finished';m.winner=m.scores.T>m.scores.CT?'T':'CT';return;}
  if(played===m.half||(played>=m.half*2)){for(const p of all)p.team=p.team==='T'?'CT':'T';[m.scores.T,m.scores.CT]=[m.scores.CT,m.scores.T];[m.loss.T,m.loss.CT]=[m.loss.CT,m.loss.T];m.swapped=!m.swapped;}
  for(const p of all){if(!p.alive){p.weapons=['pistol','knife'];p.kit=false;p.armor=0;}p.alive=true;p.holdUntil=0;if(played===m.half){p.money=BOMB_RULES.startMoney;p.weapons=['pistol','knife'];p.kit=false;p.armor=0;}}
  m.round++;m.phase='buy';m.deadline=now+BOMB_RULES.buy;m.carrier=all.find(p=>p.team==='T')?.id;delete m.position;delete m.site;delete m.winner;delete m.reason;
 }
}
