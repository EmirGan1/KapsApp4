import { isGrenade, type Grenade, type GrenadeKind } from "./grenades";
import type {BombSite,Vec3,WeaponId} from './types';
export type BombSide='T'|'CT';
export type BombPhase='buy'|'active'|'planted'|'result'|'finished';
export const BOMB_RULES={buy:15,round:105,plant:3.2,explode:30,defuse:10,kitDefuse:5,transition:5,blastRadius:18,maxMoney:16000,startMoney:800,winReward:3250,lossReward:1400,lossStep:500,killReward:300,objectiveReward:300,plantLossBonus:300};
export const BOMB_SITES=[{id:'A',x:34.42208,y:3.2,z:37.9984,radius:4},{id:'B',x:-33.75232,y:2.4,z:42.69232,radius:4}] as const;
export const BOMB_SHOP={pistol:200,smg:1200,rifle:2700,shotgun:1800,sniper:4500,carbine:2200,lmg:3400,railgun:5000,halfArmor:650,armor:1200,kit:400,flash:200,frag:300,smoke:300} as const;
export const BOMB_WIN_TARGETS = [5, 7, 8, 10, 13] as const;
export function bombWinTarget(value: unknown): number {
 return typeof value === "number" && BOMB_WIN_TARGETS.some(target => target === value) ? value : 7;
}
export interface BombPlayer {id:string;team:BombSide;alive:boolean;position:Vec3;money:number;armor:number;kit:boolean;weapons:WeaponId[];plants:number;defuses:number;holdUntil:number;purchase?:{weapon:WeaponId;price:number};armorPurchase?:{item:"armor"|"halfArmor";previous:number;price:number};kitPurchase?:boolean;utility?:Partial<Record<GrenadeKind, boolean>>;flashedUntil?:number}
export interface BombMatch {sites?: readonly BombSite[];grenades?:Grenade[];explosion?:{position:Vec3;at:number;radius:number};phase:BombPhase;round:number;deadline:number;scores:{T:number;CT:number};carrier?:string;position?:Vec3;site?:string;action?:{player:string;kind:'plant'|'defuse';started:number;position:Vec3};winner?:BombSide;reason?:string;target:number;half:number;firstToTarget?:boolean;swapped:boolean;loss:{T:number;CT:number};players:Record<string,BombPlayer>}
const near=(a:Vec3,b:Vec3,r:number)=>Math.hypot(a.x-b.x,a.z-b.z)<=r&&Math.abs(a.y-b.y)<2;
export function createBombMatch(players:{id:string;team:BombSide;position:Vec3}[],now:number,rounds:number|boolean=false,sites:readonly BombSite[]=BOMB_SITES):BombMatch{
 if(players.length<2||players.length>10||!players.some(p=>p.team==='T')||!players.some(p=>p.team==='CT')||['T','CT'].some(t=>players.filter(p=>p.team===t).length>5))throw new Error('Maç için her takımda 1–5 oyuncu gerekli.');
 const target=rounds===true?13:bombWinTarget(rounds);
 const match:BombMatch={sites,phase:'buy',round:1,deadline:now+BOMB_RULES.buy,scores:{T:0,CT:0},target,half:target-1,firstToTarget:typeof rounds==="number",swapped:false,loss:{T:0,CT:0},players:{}};
 for(const p of players)match.players[p.id]={...p,alive:true,money:BOMB_RULES.startMoney,armor:0,kit:false,weapons:['pistol','knife'],plants:0,defuses:0,holdUntil:0};
 match.carrier=players.find(p=>p.team==='T')!.id;return match;
}
export const isBombPrimary = (weapon: WeaponId) => weapon !== "pistol" && weapon !== "knife";
export const hasBombPrimary = (weapons: WeaponId[]) => weapons.some(isBombPrimary);

export function bombPurchaseError(m:BombMatch,id:string,item:string,now:number):string|undefined {
 const p=m.players[id];
 if(!p||!p.alive)return 'Satın almak için hayatta olmalısın.';
 if(m.phase!=='buy'||now>=m.deadline)return 'Satın alma süresi sona erdi.';
 if(!Object.hasOwn(BOMB_SHOP,item))return 'Geçersiz ekipman.';
 if(item==='kit'&&p.team!=='CT')return 'Çözme kiti yalnızca CT için.';
 if(item==='kit'?p.kit:item==='armor'?p.armor>=100:item==='halfArmor'?p.armor>=50:isGrenade(item)?p.utility?.[item]:p.weapons.includes(item as WeaponId))return 'Bu ekipmana zaten sahipsin.';
 if(!isGrenade(item)&&item!=='kit'&&item!=='armor'&&item!=='halfArmor'&&item!=='pistol'&&hasBombPrimary(p.weapons))return 'Zaten ana silahın var.';
 if(p.money<BOMB_SHOP[item as keyof typeof BOMB_SHOP])return 'Yeterli paran yok.';
}
export function buyBombEquipment(m:BombMatch,id:string,item:string,now:number){
 if(bombPurchaseError(m,id,item,now))return false;
 const p=m.players[id];
 if(isGrenade(item))(p.utility??={})[item]=true;
 else if(item==='kit'){p.kit=true;p.kitPurchase=true;}
 else if(item==='armor'||item==='halfArmor'){
  p.armorPurchase={item,previous:p.armorPurchase?.previous??p.armor,price:(p.armorPurchase?.price??0)+BOMB_SHOP[item]};
  p.armor=item==='armor'?100:50;
 }
 else {
  const weapon=item as WeaponId;
  p.weapons.push(weapon);
  if(isBombPrimary(weapon))p.purchase={weapon,price:BOMB_SHOP[item as keyof typeof BOMB_SHOP]};
 }
 p.money-=BOMB_SHOP[item as keyof typeof BOMB_SHOP];return true;
}
export function bombRefundPrice(player:BombPlayer|undefined,item:string):number {
 if(!player?.alive)return 0;
 if(isGrenade(item))return player.utility?.[item]?BOMB_SHOP[item]:0;
 if(item==='kit')return player.kit&&player.kitPurchase?BOMB_SHOP.kit:0;
 if(player.armorPurchase?.item===item)return player.armorPurchase.price;
 return player.purchase?.weapon===item&&player.weapons.includes(player.purchase.weapon)?player.purchase.price:0;
}
export function refundBombEquipment(m:BombMatch,id:string,item:string,now:number):boolean {
 const player=m.players[id];
 const price=bombRefundPrice(player,item);
 if(!price||m.phase!=='buy'||now>=m.deadline)return false;
 if(isGrenade(item))delete player.utility![item];
 else if(item==='kit'){player.kit=false;delete player.kitPurchase;}
 else if(item==='armor'||item==='halfArmor'){player.armor=player.armorPurchase!.previous;delete player.armorPurchase;}
 else {player.weapons=player.weapons.filter(weapon=>weapon!==item);delete player.purchase;}
 player.money=Math.min(BOMB_RULES.maxMoney,player.money+price);
 return true;
}
/** A client never receives another player's economy, loadout or objective action. */
export function bombView(m:BombMatch,id:string):BombMatch {
 const me = Object.hasOwn(m.players, id) ? m.players[id] : undefined;
 const v: BombMatch = { ...m, scores: { ...m.scores }, loss: { ...m.loss }, players: Object.create(null) };
 for (const [playerId, player] of Object.entries(m.players)) {
  if (playerId === id) {
   v.players[playerId] = { ...player, position: { ...player.position }, weapons: [...player.weapons] };
   if (player.utility) v.players[playerId].utility = { ...player.utility };
   if (player.armorPurchase) v.players[playerId].armorPurchase = { ...player.armorPurchase };
   if (player.purchase) v.players[playerId].purchase = { ...player.purchase };
  } else {
   v.players[playerId] = {
    id: player.id, team: player.team, alive: player.alive, plants: player.plants, defuses: player.defuses,
    money: 0, armor: 0, kit: false, weapons: [], holdUntil: 0, position: { x: 0, y: 0, z: 0 },
   };
  }
 }
 if (me?.team !== 'T' && v.phase !== 'planted' && v.phase !== 'result' && v.phase !== 'finished') {
  delete v.carrier;
  delete v.position;
 } else if (m.position) {
  v.position = { ...m.position };
 }
 if (m.action?.player === id) v.action = { ...m.action, position: { ...m.action.position } };
 else delete v.action;
 if (m.explosion) v.explosion = { ...m.explosion, position: { ...m.explosion.position } };
 return v;
}
export function dropBomb(m:BombMatch,id:string){if(m.carrier!==id||m.phase!=='active')return false;m.position={...m.players[id].position};delete m.carrier;delete m.action;return true;}
export function bombInteract(m:BombMatch,id:string,held:boolean,now:number){const p=m.players[id];if(!p||!p.alive)return false;p.holdUntil=held?now+.3:0;if(!held){if(m.action?.player===id)delete m.action;return true;}if(m.phase==='active'&&p.team==='T'){
 if(m.position&&!m.carrier&&near(p.position,m.position,2)){m.carrier=id;delete m.position;return true;}
 if(m.carrier===id){const site=(m.sites??BOMB_SITES).find(s=>near(p.position,{x:s.x,y:s.y,z:s.z},s.radius));if(site&&!m.action)m.action={player:id,kind:'plant',started:now,position:{...p.position}};return !!site;}
 }if(m.phase==='planted'&&p.team==='CT'&&m.position&&near(p.position,m.position,2)&&!m.action){m.action={player:id,kind:'defuse',started:now,position:{...p.position}};return true;}return false;}
function finish(m:BombMatch,side:BombSide,reason:string,now:number){if(m.phase==='result'||m.phase==='finished')return;m.phase='result';m.winner=side;m.reason=reason;m.scores[side]++;m.deadline=now+BOMB_RULES.transition;delete m.action;const loser=side==='T'?'CT':'T';m.loss[side]=0;m.loss[loser]++;for(const p of Object.values(m.players))p.money=Math.min(BOMB_RULES.maxMoney,p.money+(p.team===side?BOMB_RULES.winReward:BOMB_RULES.lossReward+Math.min(4,m.loss[loser]-1)*BOMB_RULES.lossStep)+(side==='CT'&&p.team==='T'&&m.site?BOMB_RULES.plantLossBonus:0));}
/** Absolute monotonic server time; explosion wins ties, action results are idempotent. */
export function stepBomb(m:BombMatch,now:number){
 if(m.phase==='finished')return;
 const all=Object.values(m.players);
 if(m.carrier&&!m.players[m.carrier]?.alive)dropBomb(m,m.carrier);
 if(m.action){const a=m.action,p=m.players[a.player];if(!p?.alive||p.holdUntil<now||!near(p.position,a.position,.4)||(a.kind==='plant'&&(!(m.sites??BOMB_SITES).some(s=>near(p.position,{x:s.x,y:s.y,z:s.z},s.radius))||m.carrier!==p.id))||(a.kind==='defuse'&&(!m.position||!near(p.position,m.position,2))))delete m.action;}
 if(m.phase==='planted'&&now>=m.deadline){if(m.position){m.explosion={position:{...m.position},at:now,radius:BOMB_RULES.blastRadius};for(const p of all)if(p.alive&&Math.hypot(p.position.x-m.position.x,p.position.y-m.position.y,p.position.z-m.position.z)<=BOMB_RULES.blastRadius)p.alive=false;}finish(m,'T','Bomba patladı',now);return;}
 if(m.action){const a=m.action,p=m.players[a.player],duration=a.kind==='plant'?BOMB_RULES.plant:p.kit?BOMB_RULES.kitDefuse:BOMB_RULES.defuse;if(now-a.started>=duration){if(a.kind==='plant'&&now<m.deadline){m.phase='planted';m.position={...p.position};m.site=(m.sites??BOMB_SITES).find(s=>near(p.position,{x:s.x,y:s.y,z:s.z},s.radius))?.id;delete m.carrier;m.deadline=now+BOMB_RULES.explode;p.plants++;p.money=Math.min(BOMB_RULES.maxMoney,p.money+BOMB_RULES.objectiveReward);delete m.action;}else if(a.kind==='defuse'){p.defuses++;p.money=Math.min(BOMB_RULES.maxMoney,p.money+BOMB_RULES.objectiveReward);finish(m,'CT','Bomba çözüldü',now);return;}}}
 if(m.phase==='planted'&&!all.some(p=>p.team==='CT'&&p.alive)){finish(m,'T','Savunan takım elendi',now);return;}
 if(m.phase==='active'){if(!all.some(p=>p.team==='T'&&p.alive))finish(m,'CT','Saldıran takım elendi',now);else if(!all.some(p=>p.team==='CT'&&p.alive))finish(m,'T','Savunan takım elendi',now);else if(now>=m.deadline)finish(m,'CT','Raund süresi doldu',now);}
 if(m.phase==='buy'&&now>=m.deadline){m.phase='active';m.deadline=now+BOMB_RULES.round;}
 if(m.phase==='result'&&now>=m.deadline){
  const played=m.scores.T+m.scores.CT;
  // Normal time ends at target; overtime is paired rounds with a two-round lead.
  if(((m.firstToTarget||played<=m.half*2)&&Math.max(m.scores.T,m.scores.CT)>=m.target)||(!m.firstToTarget&&played>m.half*2&&(played-m.half*2)%2===0&&m.scores.T!==m.scores.CT)){m.phase='finished';m.winner=m.scores.T>m.scores.CT?'T':'CT';return;}
  if(played===m.half||(played>=m.half*2)){for(const p of all)p.team=p.team==='T'?'CT':'T';[m.scores.T,m.scores.CT]=[m.scores.CT,m.scores.T];[m.loss.T,m.loss.CT]=[m.loss.CT,m.loss.T];m.swapped=!m.swapped;}
  m.grenades=undefined;
  for(const p of all){if(!p.alive){p.weapons=['pistol','knife'];p.kit=false;p.armor=0;}delete p.purchase;delete p.armorPurchase;delete p.kitPurchase;delete p.utility;delete p.flashedUntil;p.alive=true;p.holdUntil=0;if(played===m.half){p.money=BOMB_RULES.startMoney;p.weapons=['pistol','knife'];p.kit=false;p.armor=0;}}
  m.round++;m.phase='buy';m.deadline=now+BOMB_RULES.buy;m.carrier=all.find(p=>p.team==='T')?.id;delete m.position;delete m.site;delete m.winner;delete m.reason;delete m.explosion;
 }
}
