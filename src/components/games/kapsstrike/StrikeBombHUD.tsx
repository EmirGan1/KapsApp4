import React, {useEffect, useRef, useState} from 'react';
import type {Socket} from 'socket.io-client';
import {BOMB_RULES, BOMB_SHOP, type BombMatch} from '../../../games/kapsstrike/bomb';
import {bindingFromEvent, label} from '../../../games/kapsstrike/controls';
import type {NetworkPlayer, StrikeSnapshot} from '../../../games/kapsstrike/types';
import {WEAPONS} from '../../../games/kapsstrike/config';

type Item = keyof typeof BOMB_SHOP;
const categories: {name:string;items:Item[]}[] = [
  {name:'Ekipman',items:['armor','kit']}, {name:'Tabancalar',items:['pistol']},
  {name:'Hafif silahlar',items:['smg','shotgun']}, {name:'Tüfekler',items:['rifle','sniper']},
];
const names=(item:Item)=>item==='armor'?'Balistik zırh':item==='kit'?'Çözme kiti':WEAPONS[item].name;
const phases={buy:'Hazırlık ve satın alma',active:'Raund devam ediyor',planted:'BOMBA KURULDU',result:'Raund sonucu',finished:'Maç tamamlandı'};

export default function StrikeBombHUD({socket,players,interactKey,onShopChange,touch,onEquipBomb}:{socket?:Socket|null;players:NetworkPlayer[];interactKey:string;onShopChange:(open:boolean)=>void;touch:boolean;onEquipBomb:()=>void}){
  const [bomb,setBomb]=useState<BombMatch|null>(null),[now,setNow]=useState(0),[shop,setShop]=useState(false),[message,setMessage]=useState(''),[pending,setPending]=useState(false);
  const holding=useRef(false),shopRef=useRef(false),bombRef=useRef<BombMatch|null>(null),changeRef=useRef(onShopChange),dialog=useRef<HTMLDivElement>(null);
  const equipRef=useRef(onEquipBomb);equipRef.current=onEquipBomb;
  changeRef.current=onShopChange;
  const release=()=>{holding.current=false;socket?.emit('strike:bomb_action',{kind:'hold',held:false});};
  const changeShop=(open:boolean)=>{release();shopRef.current=open;setShop(open);setMessage('');changeRef.current(open);};
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
      if(e.code==='KeyG'&&!e.repeat){socket.emit('strike:bomb_action',{kind:'drop'});return;}
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
  const buy=(item:Item)=>{
    if(!socket||pending)return;setPending(true);setMessage('Satın alınıyor…');
    socket.timeout(4000).emit('strike:bomb_action',{kind:'buy',item},(err:Error|null,result?:{success:boolean;error?:string})=>{
      setPending(false);setMessage(err?'Sunucu yanıt vermedi; envanterini kontrol edip tekrar dene.':result?.success?`${names(item)} alındı.`:result?.error||'Satın alma başarısız.');
    });
  };
  const cards=(team:'T'|'CT')=><div className={`ks-bomb-team ks-bomb-team-${team}`} aria-label={`${team} takımı`}>{Object.values(bomb.players).filter(p=>p.team===team).map(p=>{
    const profile=players.find(n=>n.id===p.id),name=profile?.username||'Oyuncu';
    return <div key={p.id} title={name} className={`ks-bomb-player ${p.alive?'':'is-dead'} ${p.id===socket?.id?'is-self':''}`}>
      {profile?.avatar?<img src={profile.avatar} alt={name} referrerPolicy="no-referrer"/>:<span className="ks-bomb-avatar">{name.slice(0,2).toUpperCase()}</span>}
      {!p.alive&&<b className="ks-bomb-dead" aria-label="Ölü">×</b>}<small>{name}</small>{bomb.carrier===p.id&&<i title="Bomba taşıyıcı">◆</i>}
    </div>;
  })}</div>;
  return <>
    <header className="ks-tactical-bar">{cards('CT')}<div className="ks-bomb-score"><div><b>CT {bomb.scores.CT}</b><strong>{Math.max(0,Math.ceil(bomb.deadline-now))}<small>sn</small></strong><b>{bomb.scores.T} T</b></div><small>RAUND {bomb.round} · {phases[bomb.phase]}</small></div>{cards('T')}</header>
    <aside className={`ks-bomb-objective ${touch?'is-touch':'is-desktop'}`}>
      <span>{me?.team==='CT'?'CT · Savunma':'T · Saldırı'} · ${me?.money||0} · Zırh {Math.ceil(me?.armor||0)}</span>
      {bomb.carrier===socket?.id&&<strong>Bomba sende · A veya B bölgesine ilerle</strong>}
      {bomb.phase==='buy'&&me?.alive&&(touch?<button onClick={()=>changeShop(true)}>Satın al <kbd>B</kbd></button>:<span>B · Satın alma menüsü</span>)}
      {me?.alive&&(bomb.phase==='active'||bomb.phase==='planted')&&(touch?<div className="ks-bomb-touch-actions">
        <button onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);holding.current=true;socket?.emit('strike:bomb_action',{kind:'hold',held:true});}} onPointerUp={release} onPointerCancel={release}>Basılı tut: {me.team==='CT'?'Çöz':'Kur / Al'} <kbd>{label(interactKey)}</kbd></button>
        {bomb.carrier===socket?.id&&<button onClick={onEquipBomb}>Bombayı ele al</button>}
        {bomb.carrier===socket?.id&&<button onClick={()=>socket?.emit('strike:bomb_action',{kind:'drop'})}>Bombayı bırak</button>}
      </div>:<span>{label(interactKey)} basılı tut · Kur / Çöz / Al{bomb.carrier===socket?.id?' · 7: Bombayı ele al · G: Bırak':''}</span>)}
      {bomb.action&&<label>{bomb.action.kind==='plant'?'Bomba kuruluyor':'Bomba çözülüyor'}<progress max={bomb.action.kind==='plant'?BOMB_RULES.plant:me?.kit?BOMB_RULES.kitDefuse:BOMB_RULES.defuse} value={Math.max(0,now-bomb.action.started)}/></label>}
      {bomb.phase==='planted'&&<strong role="alert">Bomba {bomb.site} bölgesine kuruldu!</strong>}
      {bomb.reason&&<strong role="status">{bomb.winner} kazandı · {bomb.reason}</strong>}
      {!me?.alive&&<span>Elendin · Yeni raundda yeniden doğacaksın.</span>}
    </aside>
    {shop&&bomb.phase==='buy'&&<div className="ks-buy-scrim"><div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="ks-buy-title" className="ks-buy-menu" onKeyDown={e=>{
      if(e.key!=='Tab')return;const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }}>
      <header><div><small>KAPSSTRIKE · {me?.team}</small><h2 id="ks-buy-title">Satın alma</h2><p>{Math.max(0,Math.ceil(bomb.deadline-now))} saniye kaldı · Raund {bomb.round}</p></div><strong>${me?.money||0}</strong><button aria-label="Satın alma menüsünü kapat" onClick={()=>changeShop(false)}>Oyuna dön · ESC</button></header>
      <div className="ks-buy-columns">{categories.map(category=><section key={category.name}><h3>{category.name}</h3>{category.items.filter(item=>item!=='kit'||me?.team==='CT').map(item=>{
        const owned=item==='kit'?me?.kit:item==='armor'?(me?.armor||0)>=100:me?.weapons.includes(item),affordable=(me?.money||0)>=BOMB_SHOP[item];
        return <button key={item} disabled={pending||owned||!affordable} className={owned?'is-owned':''} onClick={()=>buy(item)}><span className="ks-buy-symbol" aria-hidden="true"><svg viewBox="0 0 120 40" width="110" height="38" fill="currentColor">{item==='armor'?<path d="M44 2 35 9v16l25 13 25-13V9L76 2 68 9H52z"/>:item==='kit'?<path d="M35 6h50v29H35zM50 0h20v5H50zm7 12v6h-6v6h6v6h6v-6h6v-6h-6v-6z" fillRule="evenodd"/>:item==='pistol'?<path d="M20 8h65v10H54l-5 19H34l5-19H20z"/>:item==='sniper'?<path d="M3 13h90v4h24v3H72l-8 11H52l2-11H30L9 29H3zm42-9h30v7H45z"/>:item==='shotgun'?<path d="M4 12h108v5H55v7H39v-6L8 29H3z"/>:item==='smg'?<path d="M15 10h65v5h22v5H66v16H55V21H41l-3 14H25l4-16H15z"/>:<path d="M3 9h16v5h55v-4h9v4h32v5H74l-7 15H53l4-15H40l-4 12H24l4-14L3 27z"/>}</svg></span><b>{names(item)}</b><span>${BOMB_SHOP[item]}</span><small>{owned?'ENVANTERDE':!affordable?'YETERSİZ BAKİYE':'SATIN AL'}</small></button>;
      })}</section>)}</div>
      <footer role="status">{message||'Ekipman bu maç içindir. Kozmetik envanterin değişmez.'}</footer>
    </div></div>}
  </>;
}
