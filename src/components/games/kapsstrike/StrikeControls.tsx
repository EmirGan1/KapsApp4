import React, {useEffect, useState} from "react";
import {ACTIONS, Action, Bindings, DEFAULT_BINDINGS, bindingFromEvent, conflicts, label, validBinding} from "../../../games/kapsstrike/controls";
export default function StrikeControls({value,onChange}:{value:Bindings;onChange:(b:Bindings)=>void}) {
  const [capture,setCapture]=useState<Action|null>(null);
  const [collision,setCollision]=useState<{action:Action;binding:string;others:Action[]}|null>(null);
  useEffect(()=>{
    if (!capture) return;
    const receive=(event:Event)=>{
      const modifier = event instanceof KeyboardEvent && /^(Control|Shift|Alt|Meta)(Left|Right)$/.test(event.code);
      if (event.type === "keyup" && !modifier) return;
      event.preventDefault();event.stopPropagation();
      if (event.type === "keydown" && modifier) return;
      if (event instanceof KeyboardEvent && event.code === "Escape") {setCapture(null);return;}
      if (event instanceof WheelEvent && event.deltaY === 0) return;
      const binding=bindingFromEvent(event as KeyboardEvent);
      if (!validBinding(binding)) return;
      const others=conflicts(value,capture,binding);
      if(others.length) setCollision({action:capture,binding,others});
      else onChange({...value,[capture]:binding});
      setCapture(null);
    };
    for(const name of ["keydown","keyup","mousedown","wheel"]) window.addEventListener(name,receive,{capture:true,passive:false});
    return ()=>{for(const name of ["keydown","keyup","mousedown","wheel"]) window.removeEventListener(name,receive,true);};
  },[capture,value,onChange]);
  return <div className="ks-binding-editor">
    <p>Fiziksel tuş kodları kaydedilir. ESC her zaman menüyü açar; atama sırasında iptal eder. Koşarken çömelme/kayma momentum ile kaydırır.</p>
    {capture && <p role="status">{ACTIONS[capture]}: Yeni tuşa, fare düğmesine veya tekerleğe bas…</p>}
    {collision && <div role="alert"><p>Bu giriş şu kontrollerle çakışıyor: {collision.others.map(a=>ACTIONS[a]).join(", ")}</p>
      <button onClick={()=>{const next={...value,[collision.action]:collision.binding};for(const a of collision.others) next[a]="Unbound";onChange(next);setCollision(null);}}>Ata ve çakışanları kaldır</button>
      <button onClick={()=>setCollision(null)}>İptal</button></div>}
    {(Object.keys(ACTIONS) as Action[]).map(action=><div className="ks-binding-row" key={action}>
      <span>{ACTIONS[action]}</span>
      <button aria-label={`${ACTIONS[action]} tuşunu değiştir`} onClick={()=>{setCollision(null);setCapture(action);}}>{label(value[action])}</button>
      <button aria-label={`${ACTIONS[action]} varsayılan`} onClick={()=>{
        const others=conflicts(value,action,DEFAULT_BINDINGS[action]);
        if(others.length) setCollision({action,binding:DEFAULT_BINDINGS[action],others});else onChange({...value,[action]:DEFAULT_BINDINGS[action]});
      }}>Sıfırla</button>
    </div>)}
    <button onClick={()=>{onChange({...DEFAULT_BINDINGS});setCapture(null);setCollision(null);}}>Tüm kontrolleri sıfırla</button>
  </div>;
}
