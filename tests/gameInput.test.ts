import test from 'node:test';
import assert from 'node:assert/strict';
import {inputDevice} from '../src/utils/gameInput';
import {OrientationTracker,gyroAvailability,requestOrientationAccess} from '../src/utils/gameGyroscope';
const env={userAgent:'',platform:'',maxTouchPoints:0,coarse:false,touchEvent:false};
for(const [name,patch] of Object.entries({ipadDesktop:{userAgent:'Mozilla Macintosh Safari',platform:'MacIntel',maxTouchPoints:5},ipad:{userAgent:'Mozilla iPad',maxTouchPoints:5},androidTablet:{userAgent:'Mozilla Android 14 SM-X900',maxTouchPoints:10},surface:{userAgent:'Windows NT 10.0',maxTouchPoints:10},largeCoarse:{coarse:true,maxTouchPoints:1}}))test(`${name}: tablet touch defaults have no viewport-width cap`,()=>{
 assert.equal(inputDevice({...env,...patch}).touch,true);
});
test('desktop without touch remains keyboard even if ontouchstart is exposed',()=>assert.equal(inputDevice({...env,userAgent:'Windows NT 10.0 Chrome',touchEvent:true}).touch,false));
test('phones and tablets are classified independently',()=>{
 assert.equal(inputDevice({...env,userAgent:'Android Mobile',maxTouchPoints:5}).tablet,false);
 assert.equal(inputDevice({...env,userAgent:'Android SM-X900',maxTouchPoints:10}).tablet,true);
});
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} versus ${b}`);
test('gyro yaw uses alpha including flat posture and 360-degree wrap without a jump',()=>{
 const t=new OrientationTracker();t.sample({alpha:359,beta:0,gamma:0},0,100);
 near(t.sample({alpha:1,beta:0,gamma:0},0,116)!.yaw,-2*Math.PI/180);
});
test('screen-compensated pitch is consistent in both landscape directions and native landscape tablets',()=>{
 for(const angle of [0,90,180,270]){
  const t=new OrientationTracker();t.sample({alpha:0,beta:0,gamma:0},angle,100);
  const s=angle===90||angle===270?{alpha:0,beta:0,gamma:10}:{alpha:0,beta:10,gamma:0};
  near(Math.abs(t.sample(s,angle,116)!.pitch),10*Math.PI/180);
 }
});
test('upright posture yaw and pitch respond at physical radian scale',()=>{
 const a=new OrientationTracker();a.sample({alpha:0,beta:90,gamma:0},0,100);near(a.sample({alpha:10,beta:90,gamma:0},0,116)!.yaw,-Math.PI/18);
 const b=new OrientationTracker();b.sample({alpha:0,beta:90,gamma:0},0,100);near(b.sample({alpha:0,beta:100,gamma:0},0,116)!.pitch,-Math.PI/18);
});
test('invalid, stale, rotated and discontinuous samples cannot jump the camera',()=>{
 const t=new OrientationTracker();assert.equal(t.sample({alpha:NaN,beta:0,gamma:0},0,100),undefined);
 t.sample({alpha:0,beta:0,gamma:0},0,100);
 assert.equal(t.sample({alpha:0,beta:0,gamma:0},90,116),undefined);
 assert.equal(t.sample({alpha:180,beta:0,gamma:0},90,132),undefined);
 assert.equal(t.sample({alpha:181,beta:0,gamma:0},90,2000),undefined);
 t.reset();assert.equal(t.sample({alpha:182,beta:0,gamma:0},90,2016),undefined);
});
test('iOS permission method is invoked synchronously within the originating gesture',async()=>{
 let called=false;const scope={isSecureContext:true,DeviceOrientationEvent:{requestPermission(){called=true;return Promise.resolve('granted');}}} as unknown as Window;
 assert.equal(gyroAvailability(scope),'permission');const request=requestOrientationAccess(scope);assert.equal(called,true);assert.equal(await request,'granted');
});
test('Android does not require an iOS-only permission API; denial and insecure contexts stay explicit',async()=>{
 assert.equal(await requestOrientationAccess({isSecureContext:true,DeviceOrientationEvent:{}} as unknown as Window),'granted');
 assert.equal(await requestOrientationAccess({isSecureContext:true,DeviceOrientationEvent:{requestPermission:()=>Promise.resolve('denied')}} as unknown as Window),'denied');
 assert.equal(await requestOrientationAccess({isSecureContext:false} as Window),'insecure');
 assert.equal(await requestOrientationAccess({isSecureContext:true} as Window),'unsupported');
});
