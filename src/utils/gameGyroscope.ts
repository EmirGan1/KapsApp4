export type GyroStatus='off'|'permission'|'requesting'|'waiting'|'active'|'denied'|'unsupported'|'insecure'|'unavailable'|'error';
export const GYRO_STATUS:Record<GyroStatus,string>={off:'Jiroskop kapalı.',permission:'Hareket ve yön sensörü izni gerekiyor. Etkinleştir düğmesine dokun.',requesting:'Sensör izni isteniyor…',waiting:'Sensör bekleniyor. Cihazı hafifçe döndür.',active:'Sensör aktif.',denied:'Sensör izni reddedildi. Tarayıcının bu site için hareket/yön iznini kontrol edip tekrar dene.',unsupported:'Bu tarayıcı yön sensörü API’sini desteklemiyor.',insecure:'Sensörler güvenli bağlantı gerektirir. Siteyi HTTPS üzerinden aç.',unavailable:'Sensör verisi gelmiyor. Site iznini veya uygulama içi tarayıcıyı kontrol et; Safari/Chrome ile yeniden dene.',error:'Sensör izni alınamadı. Tekrar deneyebilirsin.'};
export interface OrientationSample {alpha:number|null;beta:number|null;gamma:number|null;}
export interface GyroDelta {yaw:number;pitch:number;roll:number;}
type Q=[number,number,number,number];
const rad=Math.PI/180;
const mul=(a:Q,b:Q):Q=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const inverse=(q:Q):Q=>[-q[0],-q[1],-q[2],q[3]];
/** W3C Z(alpha), X(beta), Y(gamma), followed by screen rotation compensation. */
function orientation(s:OrientationSample,angle:number):Q{
 const a=(s.alpha||0)*rad/2,b=s.beta!*rad/2,g=s.gamma!*rad/2,r=-angle*rad/2;
 return mul(mul(mul([0,0,Math.sin(a),Math.cos(a)],[Math.sin(b),0,0,Math.cos(b)]),[0,Math.sin(g),0,Math.cos(g)]),[0,0,Math.sin(r),Math.cos(r)]);
}
export function screenAngle(){
 const angle=window.screen?.orientation?.angle ?? (window as any).orientation ?? 0;
 return typeof angle==='number'&&Number.isFinite(angle)?((angle%360)+360)%360:0;
}
export class OrientationTracker {
 private last?:{q:Q;angle:number;time:number;alpha:boolean};
 reset(){this.last=undefined;}
 sample(s:OrientationSample,angle:number,time:number):GyroDelta|undefined{
  if(typeof s.beta!=='number'||typeof s.gamma!=='number'||!Number.isFinite(s.beta)||!Number.isFinite(s.gamma)||(s.alpha!==null&&!Number.isFinite(s.alpha)))return;
  const q=orientation(s,angle),prev=this.last,hasAlpha=s.alpha!==null;
  this.last={q,angle,time,alpha:hasAlpha};
  if(!prev||prev.angle!==angle||time-prev.time>500||time<=prev.time||prev.alpha!==hasAlpha)return;
  let d=mul(inverse(prev.q),q);if(d[3]<0)d=d.map(v=>-v) as Q;
  const magnitude=Math.hypot(d[0],d[1],d[2]);if(magnitude<1e-8)return {yaw:0,pitch:0,roll:0};
  const rotation=2*Math.atan2(magnitude,Math.max(0,d[3]));
  // Recalibration/compass jumps are baselined rather than teleported into the camera.
  if(rotation>Math.PI/4)return;
  const vector:Q=[d[0]*rotation/magnitude,d[1]*rotation/magnitude,d[2]*rotation/magnitude,0];
  const world=mul(mul(prev.q,vector),inverse(prev.q));
  return {yaw:hasAlpha?-world[2]:-vector[1],pitch:-vector[0],roll:-vector[2]};
 }
}
export function gyroAvailability(scope:Window=window):'permission'|'granted'|'unsupported'|'insecure'{
 if(!scope.isSecureContext)return 'insecure';
 if(!('DeviceOrientationEvent' in scope))return 'unsupported';
 return typeof (scope as any).DeviceOrientationEvent?.requestPermission==='function'?'permission':'granted';
}
/** Call directly from a click/tap handler; no timer or preceding await loses iOS activation. */
export async function requestOrientationAccess(scope:Window=window):Promise<'granted'|'denied'|'unsupported'|'insecure'|'error'>{
 const available=gyroAvailability(scope);if(available!=='permission')return available;
 try{return await (scope as any).DeviceOrientationEvent.requestPermission()==='granted'?'granted':'denied';}catch{return 'error';}
}
