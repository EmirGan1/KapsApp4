export type GameControlMode='auto'|'touch'|'keyboard';
export interface InputEnvironment {userAgent:string;platform:string;maxTouchPoints:number;coarse:boolean;touchEvent:boolean;}
/** iPadOS desktop UA and large Android tablets must not depend on CSS viewport width. */
export function inputDevice(e:InputEnvironment){
 const ipad=/iPad/i.test(e.userAgent)||(/Mac/.test(e.platform)&&e.maxTouchPoints>1);
 const phone=/iPhone|iPod|Android.*Mobile|Windows Phone/i.test(e.userAgent);
 const tablet=ipad||(/Android/i.test(e.userAgent)&&!phone)||/Tablet|Silk|Kindle|PlayBook/i.test(e.userAgent)||(!phone&&e.maxTouchPoints>1);
 const touch=ipad||tablet||phone||e.coarse||e.maxTouchPoints>0;
 return {touch,tablet,phone,nativeTouch:phone||ipad||/Android|Tablet|Silk|Kindle|PlayBook/i.test(e.userAgent)};
}
export function currentInputDevice(){
 if(typeof window==='undefined')return {touch:false,tablet:false,phone:false,nativeTouch:false};
 return inputDevice({userAgent:navigator.userAgent||'',platform:navigator.platform||'',maxTouchPoints:navigator.maxTouchPoints||0,coarse:window.matchMedia?.('(pointer: coarse)').matches||false,touchEvent:'ontouchstart' in window});
}
export function touchControls(mode:GameControlMode='auto'){return mode==='touch'||mode!=='keyboard'&&currentInputDevice().touch;}
