import { GRENADE_KEYS, GRENADE_NAMES, isGrenade, type GrenadeKind } from "../../../games/kapsstrike/grenades";
import React, {useEffect, useRef, useState} from 'react';
import type {Socket} from 'socket.io-client';
import {BOMB_RULES, BOMB_SHOP, bombRefundPrice, hasBombPrimary, MAX_GRENADES, totalUtility, type BombMatch} from '../../../games/kapsstrike/bomb';
import {bindingFromEvent, label} from '../../../games/kapsstrike/controls';
import type {NetworkPlayer, StrikeSnapshot} from '../../../games/kapsstrike/types';
import {WEAPONS} from '../../../games/kapsstrike/config';

type Item = keyof typeof BOMB_SHOP;
const categories: {name:string;items:Item[]}[] = [
  {name:'Bombalar',items:GRENADE_KEYS}, {name:'Ekipman',items:['halfArmor','armor','kit']}, {name:'Tabancalar',items:['pistol']},
  {name:'Hafif silahlar',items:['smg','shotgun','carbine']}, {name:'Tüfekler',items:['rifle','sniper','lmg','railgun']},
];
const names=(item:Item)=>isGrenade(item)?GRENADE_NAMES[item]:item==='halfArmor'?'Yarım zırh · +50':item==='armor'?'Tam zırh · +100':item==='kit'?'Çözme kiti':WEAPONS[item].name;
function GrenadeIcon({kind}:{kind:GrenadeKind}) {
  if(kind==='frag')return <g stroke="#b7d58c" strokeWidth="2"><path d="M54 11h13l3 6 4 7-3 9-9 5-12-5-4-9 3-7z" fill="#46623c"/><path d="M51 20h20M50 26h22M54 15l-2 16m11-16 3 17M57 11V5h13l3 4" fill="none"/><circle cx="74" cy="8" r="4" fill="none"/></g>;
  const smoke=kind==='smoke';
  return <g><rect x="50" y="10" width="20" height="27" rx={smoke?3:6} fill={smoke?'#526f5f':'#526e88'} stroke={smoke?'#a9e7c4':'#b9e4ff'} strokeWidth="2"/><path d="M54 10V5h14l4 8" fill="none" stroke="#e2e8f0" strokeWidth="2"/><circle cx="72" cy="6" r="4" fill="none" stroke="#e2e8f0" strokeWidth="2"/>
    {smoke?<path d="M51 18h18v5H51zm0 10h18v4H51z" fill="#a9e7c4"/>:<g fill="#c6eaff"><circle cx="56" cy="18" r="2"/><circle cx="64" cy="18" r="2"/><circle cx="56" cy="27" r="2"/><circle cx="64" cy="27" r="2"/></g>}</g>;
}
const phases={buy:'Hazırlık ve satın alma',active:'Raund devam ediyor',planted:'BOMBA KURULDU',result:'Raund sonucu',finished:'Maç tamamlandı'};

export default function StrikeBombHUD({socket,players,interactKey,onShopChange,touch,onEquipBomb,utility,onSelectUtility,onThrowUtility}:{socket?:Socket|null;players:NetworkPlayer[];interactKey:string;onShopChange:(open:boolean)=>void;touch:boolean;onEquipBomb:()=>void;utility?:GrenadeKind;onSelectUtility:(item?:GrenadeKind)=>void;onThrowUtility:(short:boolean)=>void}){
  const [bomb,setBomb]=useState<BombMatch|null>(null),[now,setNow]=useState(0),[shop,setShop]=useState(false),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
  const utilityRef=useRef({utility,onSelectUtility});
  utilityRef.current={utility,onSelectUtility};
  const selectUtility=(value?:GrenadeKind)=>utilityRef.current.onSelectUtility(value);
  const holding=useRef(false),shopRef=useRef(false),bombRef=useRef<BombMatch|null>(null),changeRef=useRef(onShopChange),dialog=useRef<HTMLDivElement>(null);
  const equipRef=useRef(onEquipBomb);equipRef.current=onEquipBomb;
  changeRef.current=onShopChange;
  const release=()=>{holding.current=false;socket?.emit('strike:bomb_action',{kind:'hold',held:false});};
  const changeShop=(open:boolean)=>{release();selectUtility();shopRef.current=open;setShop(open);setMessage('');changeRef.current(open);};
  useEffect(()=>{
    if(!socket)return;
    const snapshot=(s:StrikeSnapshot)=>{
      if(!s.bomb)return;
      bombRef.current=s.bomb;setBomb(s.bomb);setNow(s.tick/120);
      if(s.bomb.phase!=='buy'&&shopRef.current)changeShop(false);
    };
    const timer=setInterval(()=>{if(holding.current)socket.emit('strike:bomb_action',{kind:'hold',held:true});},100);
    const up=()=>release();
    const down=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest('input,textarea,select'))return;
      if(shopRef.current){
        if(e.code==='Escape'||e.code==='KeyB'){e.preventDefault();e.stopImmediatePropagation();changeShop(false);}
        return;
      }
      const slot=['Digit8','Digit9','Digit0'].indexOf(e.code);
      if(slot>=0&&!e.repeat){
        const item=GRENADE_KEYS[slot], state=bombRef.current;
        if(state && ['active','planted'].includes(state.phase) && state.players[socket.id??'']?.utility?.[item]){
          e.preventDefault();e.stopImmediatePropagation();
          selectUtility(utilityRef.current.utility===item?undefined:item);
        }
        return;
      }
      if(e.code==='Escape'&&utilityRef.current.utility)selectUtility();
      if(e.code==='KeyG'&&!e.repeat){socket.emit('strike:bomb_action',{kind:e.shiftKey?'drop':'drop_weapon'});return;}
      if(e.code==='Digit7'&&!e.repeat){equipRef.current();return;}
      if(e.code==='KeyB'&&bombRef.current?.phase==='buy'&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();changeShop(true);}
      else if(bindingFromEvent(e)===interactKey&&!e.repeat){holding.current=true;socket.emit('strike:bomb_action',{kind:'hold',held:true});}
    };
    const keyup=(e:KeyboardEvent)=>{if(e.code===interactKey.split('+').at(-1))up();};
    socket.on('strike:snapshot',snapshot);
    window.addEventListener('keydown',down,true);window.addEventListener('keyup',keyup);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('blur',up);
    return()=>{up();clearInterval(timer);socket.off('strike:snapshot',snapshot);window.removeEventListener('keydown',down,true);window.removeEventListener('keyup',keyup);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',up);if(shopRef.current)changeRef.current(false);};
  },[socket,interactKey]);
  useEffect(()=>{if(shop)dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();},[shop]);
  if(!bomb)return null;
  const me=bomb.players[socket?.id||''];
  const totalOwnedGrenades = totalUtility(me?.utility);
  const buy=(item:Item, refund=false)=>{
    if(!socket||pending)return;setPending(true);setMessage(refund?'İade ediliyor…':'Satın alınıyor…');
    socket.timeout(4000).emit('strike:bomb_action',{kind:refund?'refund':'buy',item},(err:Error|null,result?:{success:boolean;error?:string})=>{
      setPending(false);setMessage(err?'Sunucu yanıt vermedi; envanterini kontrol edip tekrar dene.':result?.success?`${names(item)} ${refund?'iade edildi':'alındı'}.`:result?.error||'İşlem başarısız.');
    });
  };
  const cards=(team:'T'|'CT')=><div className={`ks-bomb-team ks-bomb-team-${team}`} aria-label={`${team} takımı`}>{Object.values(bomb.players).filter(p=>p.team===team).map(p=>{
    const profile=players.find(n=>n.id===p.id),name=profile?.username||'Oyuncu';
    return <div key={p.id} title={name} className={`ks-bomb-player ${p.alive?'':'is-dead'} ${p.id===socket?.id?'is-self':''}`}>
      {profile?.avatar?<img src={profile.avatar} alt={name} referrerPolicy="no-referrer"/>:<span className="ks-bomb-avatar">{name.slice(0,2).toUpperCase()}</span>}
      {!p.alive&&<b className="ks-bomb-dead" aria-label="Ölü">×</b>}<small>{name}</small>{bomb.carrier===p.id&&<i title="Bomba taşıyıcı">◆</i>}
    </div>;
  })}</div>;
  const plantDuration=bomb.action?.kind==='plant'?BOMB_RULES.plant:(me?.kit?BOMB_RULES.kitDefuse:BOMB_RULES.defuse);
  const actionElapsed=bomb.action?Math.max(0,Math.min(plantDuration,now-bomb.action.started)):0;
  const actionRatio=bomb.action?Math.min(1,actionElapsed/plantDuration):0;
  const c4Code='7355608';
  const typedCode=bomb.action?.kind==='plant'?c4Code.slice(0,Math.max(1,Math.ceil(actionRatio*c4Code.length))).padEnd(c4Code.length,'_'):'';
  const soloOrBotMatch=players.filter(p=>!String(p.id).startsWith('bot-')).length<=1;
  return <>
    {(me?.flashedUntil ?? 0)>now && <div className="ks-utility-flash" style={{opacity:Math.min(.94,((me?.flashedUntil ?? 0)-now)/.38)}} aria-hidden="true" />}
    <header className="ks-tactical-bar">{cards('CT')}<div className="ks-bomb-score"><div><b>CT {bomb.scores.CT}</b><strong>{Math.max(0,Math.ceil(bomb.deadline-now))}<small>sn</small></strong><b>{bomb.scores.T} T</b></div><small>RAUND {bomb.round} · {phases[bomb.phase]}</small></div>{cards('T')}</header>
    {(bomb.phase==='result'||bomb.phase==='finished')&&bomb.winner&&<div className={`ks-round-banner ks-round-${bomb.winner}`} role="status"><b>{bomb.explosion?'💥 C4 PATLADI · ':''}{bomb.winner==='CT'?'CT · Savunma':'T · Saldırı'} kazandı</b><span>{bomb.reason}</span><small>{bomb.phase==='finished'?'Maç tamamlandı':`Yeni raund ${Math.max(0,Math.ceil(bomb.deadline-now))} sn içinde`}</small></div>}
    <aside className={`ks-bomb-objective ${touch?'is-touch':'is-desktop'}`}>
      <span>{me?.team==='CT'?'CT · Savunma':'T · Saldırı'} · ${me?.money||0}</span>
      {bomb.carrier===socket?.id&&<strong>Bomba sende · A veya B bölgesine ilerle</strong>}
      {bomb.phase==='buy'&&me?.alive&&(touch?<button onClick={()=>changeShop(true)}>Satın al <kbd>B</kbd></button>:<span>B · Satın alma menüsü</span>)}
      {me?.alive&&(bomb.phase==='active'||bomb.phase==='planted')&&(touch?<div className="ks-bomb-touch-actions">
        <button onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);holding.current=true;socket?.emit('strike:bomb_action',{kind:'hold',held:true});}} onPointerUp={release} onPointerCancel={release}>Basılı tut: {me.team==='CT'?'Çöz':'Kur / Al'} <kbd>{label(interactKey)}</kbd></button>
        {bomb.carrier===socket?.id&&<button onClick={onEquipBomb}>Bombayı ele al</button>}
        <button onClick={()=>socket?.emit('strike:bomb_action',{kind:'pickup_weapon'})}>Yerden silah al</button>
        <button onClick={()=>socket?.emit('strike:bomb_action',{kind:'drop_weapon'})}>Silahı bırak · G</button>
        {bomb.carrier===socket?.id&&<button onClick={()=>socket?.emit('strike:bomb_action',{kind:'drop'})}>Bombayı bırak</button>}
      </div>:<span>{label(interactKey)} basılı tut · Kur / Çöz / Al · G: Silahı bırak{bomb.carrier===socket?.id?' · 7: Bombayı ele al · Shift+G: Bombayı bırak':''}</span>)}
      {me?.alive&&['active','planted'].includes(bomb.phase)&&GRENADE_KEYS.some(item=>me.utility?.[item])&&
        <div className="ks-utility-controls" aria-label={`Bomba envanteri (${totalOwnedGrenades}/${MAX_GRENADES})`}>
          {GRENADE_KEYS.map((item,index)=>{
            const count=me.utility?.[item]??0;
            if(!count)return null;
            return touch
              ? <button key={item} type="button" aria-pressed={utility===item} onClick={()=>selectUtility(utility===item?undefined:item)}>{GRENADE_NAMES[item]} · ×{count}</button>
              : <span key={item}>{[8,9,0][index]} · {GRENADE_NAMES[item]} <b>×{count}</b></span>;
          })}
          {utility&&(touch?<><button type="button" onClick={()=>onThrowUtility(false)}>Uzağa at</button><button type="button" onClick={()=>onThrowUtility(true)}>Yakına at</button></>:<strong>{GRENADE_NAMES[utility]} (×{me.utility?.[utility]??0}) · Sol tık: at · Sağ tık: yakına at</strong>)}
        </div>}
      {!shop && message && <span role="status">{message}</span>}
      {bomb.action&&<label>{bomb.action.kind==='plant'?`Bomba kuruluyor [${typedCode}]`:'Bomba çözülüyor'}<progress max={plantDuration} value={actionElapsed}/></label>}
      {bomb.phase==='planted'&&<strong role="alert">💣 Bomba {bomb.site} bölgesine kuruldu! ({Math.max(0,Math.ceil(bomb.deadline-now))} sn)</strong>}
      {bomb.phase==='planted'&&soloOrBotMatch&&<button type="button" onClick={()=>socket?.emit('strike:bomb_action',{kind:'fast_detonate'})} style={{marginTop:4,padding:'4px 10px',fontSize:12,background:'rgba(239,68,68,0.28)',border:'1px solid rgba(248,113,113,0.6)',borderRadius:6,color:'#fecaca',fontWeight:700}}>💥 Hızlı Patlat (Test)</button>}
      {bomb.reason&&<strong role="status">{bomb.winner} kazandı · {bomb.reason}</strong>}
      {!me?.alive&&<span>Elendin · Yeni raundda yeniden doğacaksın.</span>}
    </aside>
    {shop&&bomb.phase==='buy'&&<div className="ks-buy-scrim"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ks-buy-title" className="ks-buy-menu" onKeyDown={e=>{
      if(e.key!=='Tab')return;const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }}>
      <header><div><small>KAPSSTRIKE · {me?.team}</small><h2 id="ks-buy-title">Satın alma</h2><p>{Math.max(0,Math.ceil(bomb.deadline-now))} saniye kaldı · Raund {bomb.round}</p></div><strong>${me?.money||0}</strong><button aria-label="Satın alma menüsünü kapat" onClick={()=>changeShop(false)}>Oyuna dön · ESC</button></header>
      <div className="ks-buy-columns">{categories.map(category=><section key={category.name}><h3>{category.name==='Bombalar'?`Bombalar (${totalOwnedGrenades}/${MAX_GRENADES})`:category.name}</h3>{category.items.filter(item=>item!=='kit'||me?.team==='CT').map(item=>{
        const armorItem = item === 'armor' || item === 'halfArmor';
        const grenadeCount = isGrenade(item) ? me?.utility?.[item] ?? 0 : 0;
        const grenadeCapReached = isGrenade(item) && totalOwnedGrenades >= MAX_GRENADES;
        const owned = isGrenade(item) ? false : item === 'kit' ? me?.kit : armorItem
          ? (me?.armor ?? 0) >= (item === 'armor' ? 100 : 50)
          : me?.weapons.includes(item);
        const slotTaken = !owned && !isGrenade(item) && !armorItem && item !== 'kit' && item !== 'pistol'
          && hasBombPrimary(me?.weapons ?? []);
        const refundPrice = bombRefundPrice(me, item);
        const affordable = (me?.money ?? 0) >= BOMB_SHOP[item];
        return <div key={item}><button type="button" disabled={pending||owned||slotTaken||grenadeCapReached||!affordable} className={owned?'is-owned':slotTaken||grenadeCapReached?'is-slot-taken':''} onClick={()=>buy(item)}><span className="ks-buy-symbol" aria-hidden="true"><svg viewBox="0 0 120 40" width="110" height="38" fill="currentColor">{isGrenade(item)?<GrenadeIcon kind={item}/>:armorItem?<path d="M44 2 35 9v16l25 13 25-13V9L76 2 68 9H52z"/>:item==='kit'?<path d="M35 6h50v29H35zM50 0h20v5H50zm7 12v6h-6v6h6v6h6v-6h6v-6h-6v-6z" fillRule="evenodd"/>:item==='pistol'?<path d="M20 8h65v10H54l-5 19H34l5-19H20z"/>:item==='sniper'?<path d="M3 13h90v4h24v3H72l-8 11H52l2-11H30L9 29H3zm42-9h30v7H45z"/>:item==='shotgun'?<path d="M4 12h108v5H55v7H39v-6L8 29H3z"/>:item==='smg'?<path d="M15 10h65v5h22v5H66v16H55V21H41l-3 14H25l4-16H15z"/>:<path d="M3 9h16v5h55v-4h9v4h32v5H74l-7 15H53l4-15H40l-4 12H24l4-14L3 27z"/>}</svg></span><b>{names(item)}{grenadeCount > 0 && ` · ×${grenadeCount}`}</b><span>${BOMB_SHOP[item]}</span><small>{owned?'ENVANTERDE':grenadeCapReached?'8 BOMBA DOLU':slotTaken?'ZATEN ANA SİLAHIN VAR':!affordable?'YETERSİZ BAKİYE':'SATIN AL'}</small></button>{refundPrice > 0 && <button type="button" className="ks-refund-button" disabled={pending} onClick={()=>buy(item,true)}>İade et · ${refundPrice}</button>}</div>;
      })}</section>)}</div>
      <footer role="status">{message||'Bu raund satın aldığın ekipmanı satın alma süresi bitmeden iade edebilirsin.'}</footer>
    </div></div>}
  </>;
}
