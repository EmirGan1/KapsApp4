import { getScreenShareProfile, OPUS_MAX_BITRATE, SCREEN_SHARE_MAX_BITRATE } from "./webrtcConfig";

/** Per-connection adaptation: voice retains priority over both video tracks. */
export interface LinkSample {available:number;loss:number;rtt:number;cpu?:boolean}
export function chooseVideoBudget(sample:LinkSample,peers:number,sharing:boolean){
 const ceiling=14_000_000/Math.max(1,peers);
 let budget=Math.max(180_000,Math.min(ceiling,sample.available*.85)-OPUS_MAX_BITRATE);
 if(sample.loss>.08||sample.rtt>.7)budget=Math.min(budget,600_000);
 else if(sample.loss>.03||sample.rtt>.35)budget=Math.min(budget,1_800_000);
 const level=budget<500_000?0:budget<1_200_000?1:budget<3_000_000?2:3;
 const screen = Math.min(SCREEN_SHARE_MAX_BITRATE, Math.floor(budget * 0.8));
 return {camera:Math.round(budget*(sharing?.2:1)),screen,scale:Math.max(sample.cpu?2:1,[3,2,1,1][level]),fps:sample.cpu?30:60,cameraFps:sample.cpu?20:30};
}
export async function tuneConnection(pc:RTCPeerConnection,camera:RTCRtpSender|undefined,screen:RTCRtpSender|undefined,peers:number,state:{budget?:number;good?:number;quality?:number}){
 const stats=await pc.getStats();let available=6_000_000,loss=0,rtt=0,cpu=false;
 stats.forEach(s=>{if(s.type==='outbound-rtp'&&s.qualityLimitationReason==='cpu')cpu=true;if(s.type==='candidate-pair'&&s.state==='succeeded'&&(s.nominated||s.selected)){if(s.availableOutgoingBitrate>0)available=s.availableOutgoingBitrate;rtt=Math.max(rtt,s.currentRoundTripTime||0)}if(s.type==='remote-inbound-rtp'){loss=Math.max(loss,s.fractionLost||0);rtt=Math.max(rtt,s.roundTripTime||0)}});
 const target=chooseVideoBudget({available,loss,rtt,cpu},peers,!!screen?.track);
 const profile = screen?.track ? getScreenShareProfile(screen.track) : undefined;
 const screenBitrate = profile ? Math.min(target.screen, profile.maxBitrate) : 0;
 const total = target.camera + screenBitrate;
 const quality=target.fps/target.scale;
 if((state.budget&&total>state.budget)||(state.quality&&quality>state.quality)){state.good=(state.good||0)+1;if(state.good<3)return}else state.good=0;
 state.budget=total;state.quality=quality;
 for(const [sender,bitrate]of [[camera,target.camera],[screen,screenBitrate]]as const){
  if(!sender?.track)continue;
  const isScreen = sender === screen;
  try{
   const p=sender.getParameters();
   if(!p.encodings?.length)continue;
   const scale = isScreen ? 1 : target.scale;
   const fps = isScreen && profile ? Math.min(target.fps, profile.maxFramerate) : target.cameraFps;
   for(const e of p.encodings){
    e.maxBitrate=bitrate;
    e.maxFramerate=fps;
    e.scaleResolutionDownBy=scale;
    e.priority=isScreen?'high':'medium';
    e.networkPriority=isScreen?'high':'medium';
   }
   p.degradationPreference=isScreen && profile ? profile.degradationPreference : 'balanced';
   await sender.setParameters(p);
  }catch{/* Native WebRTC controls remain active */}
 }
 for(const sender of pc.getSenders().filter(s=>s.track?.kind==='audio')){try{const p=sender.getParameters();if(!p.encodings?.length)continue;if(p.encodings.every(e=>e.maxBitrate===OPUS_MAX_BITRATE&&e.priority==='high'&&e.networkPriority==='high'))continue;for(const e of p.encodings){e.maxBitrate=OPUS_MAX_BITRATE;e.priority='high';e.networkPriority='high'}await sender.setParameters(p)}catch{}}
}
