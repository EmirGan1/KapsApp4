import {useEffect,useRef,useState} from 'react';
import {OrientationTracker,gyroAvailability,requestOrientationAccess,screenAngle,type GyroDelta,type GyroStatus,type OrientationSample} from '../utils/gameGyroscope';
export function useGameGyroscope(enabled:boolean,onDelta:(d:GyroDelta)=>void,onReading?:(s:OrientationSample)=>void){
 const [permission,setPermission]=useState<ReturnType<typeof gyroAvailability>|'denied'|'error'>(()=>typeof window==='undefined'?'unsupported':gyroAvailability());
 const [status,setStatus]=useState<GyroStatus>('off');
 const tracker=useRef(new OrientationTracker());
 const callbacks=useRef({onDelta,onReading});callbacks.current={onDelta,onReading};
 const request=async()=>{
  setStatus('requesting');
  const result=await requestOrientationAccess();setPermission(result);setStatus(result==='granted'?'waiting':result);tracker.current.reset();return result==='granted';
 };
 useEffect(()=>{
  tracker.current.reset();
  if(!enabled){setStatus(permission==='granted'||permission==='permission'?'off':permission);return;}
  if(permission!=='granted'){setStatus(permission);return;}
  setStatus('waiting');let lastData=performance.now(),lastReading=0,source='',standardAt=-Infinity,receiving=false;
  const receive=(e:DeviceOrientationEvent)=>{
   if(document.hidden)return;
   const now=performance.now();
   if(e.type==='deviceorientationabsolute'&&now-standardAt<1000)return;
   if(e.beta===null||e.gamma===null||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma)||(e.alpha!==null&&!Number.isFinite(e.alpha)))return;
   if(e.type==='deviceorientation')standardAt=now;
   if(source&&source!==e.type)tracker.current.reset();source=e.type;lastData=now;
   if(!receiving){receiving=true;setStatus('active');}
   const sample={alpha:e.alpha,beta:e.beta,gamma:e.gamma},d=tracker.current.sample(sample,screenAngle(),now);
   if(now-lastReading>=100){lastReading=now;callbacks.current.onReading?.(sample);}
   if(d)callbacks.current.onDelta(d);
  };
  const reset=()=>{tracker.current.reset();receiving=false;lastData=performance.now();setStatus('waiting');};
  const timer=window.setInterval(()=>{if(document.hidden)return;if(performance.now()-lastData>4000){receiving=false;tracker.current.reset();setStatus('unavailable');}},1000);
  window.addEventListener('deviceorientation',receive);
  window.addEventListener('deviceorientationabsolute',receive as EventListener);
  window.addEventListener('orientationchange',reset);document.addEventListener('visibilitychange',reset);
  return()=>{clearInterval(timer);window.removeEventListener('deviceorientation',receive);window.removeEventListener('deviceorientationabsolute',receive as EventListener);window.removeEventListener('orientationchange',reset);document.removeEventListener('visibilitychange',reset);tracker.current.reset();};
 },[enabled,permission]);
 return {status,request,recenter:()=>tracker.current.reset(),permissionGranted:permission==='granted'};
}
export type GameGyroscope=ReturnType<typeof useGameGyroscope>;
