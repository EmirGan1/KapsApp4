import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import type {Socket} from 'socket.io-client';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine';
import {drawCharacterPreview} from '../../../games/kapsstrike/preview';
import {Scene} from '@babylonjs/core/scene';
import {createCharacter} from '../../../games/kapsstrike/character';
import {SKINS,SkinId,cleanSkin} from '../../../games/kapsstrike/skins';
class PreviewScene extends Scene { override attachControl():void{} }
export default function StrikeSkins({socket}:{socket?:Socket|null}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 const sceneRef=useRef<Scene|null>(null);
 const modelRef=useRef<ReturnType<typeof createCharacter>|null>(null);
 const [skin,setSkin]=useState<SkinId>('classic');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!socket?.connected){setMessage('Hesaba kaydetmek için sunucu bağlantısı gerekiyor.');return;}
  let current=true;
  socket.timeout(5000).emit('strike:profile_get',(err:any,res:any)=>{if(!current)return;if(err||!res?.success)setMessage(res?.error||'Profil yüklenemedi.');else setSkin(cleanSkin(res.skin));});
  return()=>{current=false;};
 },[socket]);
 useLayoutEffect(()=>{
  const c=canvas.current;if(!c)return;
  let engine:NullEngine|undefined;
  let cleanup=()=>{};
  try {
   const ctx=c.getContext("2d");if(!ctx)throw new Error("Canvas unavailable");
   engine=new NullEngine({renderWidth:512,renderHeight:300,textureSize:256,deterministicLockstep:false,lockstepMaxSteps:4});
   const scene=new PreviewScene(engine);
   sceneRef.current=scene;
   let drag:number|null=null,lastX=0,lastFrame=0;
   const down=(e:PointerEvent)=>{drag=e.pointerId;lastX=e.clientX;c.setPointerCapture(e.pointerId);};
   const move=(e:PointerEvent)=>{if(drag!==e.pointerId)return;if(modelRef.current)modelRef.current.root.rotation.y+=(e.clientX-lastX)*.012;lastX=e.clientX;};
   const up=(e:PointerEvent)=>{if(drag===e.pointerId)drag=null;if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);};
   c.addEventListener('pointerdown',down);c.addEventListener('pointermove',move);c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
   const resizeCanvas=()=>{c.width=Math.max(1,Math.round(c.clientWidth));c.height=Math.max(1,Math.round(c.clientHeight));};
   const resize=new ResizeObserver(resizeCanvas);resize.observe(c);resizeCanvas();
   engine.runRenderLoop(()=>{const now=performance.now();if(now-lastFrame<33||document.hidden)return;lastFrame=now;if(modelRef.current)drawCharacterPreview(modelRef.current.root,ctx,c.width,c.height);});
   cleanup=()=>{engine?.stopRenderLoop();resize.disconnect();c.removeEventListener('pointerdown',down);c.removeEventListener('pointermove',move);c.removeEventListener('pointerup',up);c.removeEventListener('pointercancel',up);modelRef.current=null;sceneRef.current=null;scene.dispose();};
  } catch {setMessage('3D önizleme bu cihazda başlatılamadı.');}
  return()=>{cleanup();engine?.dispose();};
 },[]);
 useLayoutEffect(()=>{
  const scene=sceneRef.current;if(!scene)return;
  const angle=modelRef.current?.root.rotation.y ?? .3;
  modelRef.current?.dispose();
  modelRef.current=createCharacter(scene,'preview',skin,'none',false);
  modelRef.current.root.rotation.y=angle;
 },[skin]);
 const save=()=>{
  if(!socket?.connected||busy)return;
  setBusy(true);setMessage('Kaydediliyor…');
  socket.timeout(5000).emit('strike:profile_set',{skin},(err:any,res:any)=>{setBusy(false);setMessage(err?'Sunucu yanıt vermedi.':res?.success?'Karakter hesabına kaydedildi.':res?.error||'Kayıt başarısız.');});
 };
 return <div className="ks-skins"><h2>Karakter / Skin</h2><p>Görünümler aynı hitbox, can ve hareket kurallarını kullanır. Önizlemeyi sürükleyerek döndür.</p>
  <canvas ref={canvas} className="ks-skin-preview" aria-label={`${SKINS[skin].name} 3D karakter önizleme`} />
  <div className="ks-skin-grid">{(Object.keys(SKINS) as SkinId[]).map(id=><button key={id} aria-pressed={skin===id} onClick={()=>setSkin(id)} style={{borderColor:SKINS[id].trim}}>{SKINS[id].name}</button>)}</div>
  <button className="ks-primary" disabled={!socket?.connected||busy} onClick={save}>Karakteri Kaydet</button><p role="status">{message}</p>
 </div>;
}
