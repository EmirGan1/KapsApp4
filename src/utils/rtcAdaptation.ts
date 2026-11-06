/** Per-connection adaptation: voice retains priority over both video tracks. */
export interface LinkSample {available:number;loss:number;rtt:number;cpu?:boolean}
export function chooseVideoBudget(sample:LinkSample,peers:number,sharing:boolean){
 const ceiling=14_000_000/Math.max(1,peers);
 let budget=Math.max(180_000,Math.min(ceiling,sample.available*.85)-96_000);
 if(sample.loss>.08||sample.rtt>.7)budget=Math.min(budget,600_000);
 else if(sample.loss>.03||sample.rtt>.35)budget=Math.min(budget,1_800_000);
 const level=budget<500_000?0:budget<1_200_000?1:budget<3_000_000?2:3;
 return {camera:Math.round(budget*(sharing?.2:1)),screen:Math.max(6_000_000,Math.round(budget*.9)),scale:Math.max(sample.cpu?2:1,[3,2,1,1][level]),fps:60,cameraFps:sample.cpu?20:30};
}
export async function tuneConnection(pc:RTCPeerConnection,camera:RTCRtpSender|undefined,screen:RTCRtpSender|undefined,peers:number,state:{budget?:number;good?:number;quality?:number}){
 const stats=await pc.getStats();let available=6_000_000,loss=0,rtt=0,cpu=false;
 stats.forEach(s=>{if(s.type==='outbound-rtp'&&s.qualityLimitationReason==='cpu')cpu=true;if(s.type==='candidate-pair'&&s.state==='succeeded'&&(s.nominated||s.selected)){if(s.availableOutgoingBitrate>0)available=s.availableOutgoingBitrate;rtt=Math.max(rtt,s.currentRoundTripTime||0)}if(s.type==='remote-inbound-rtp'){loss=Math.max(loss,s.fractionLost||0);rtt=Math.max(rtt,s.roundTripTime||0)}});
 const target=chooseVideoBudget({available,loss,rtt,cpu},peers,!!screen?.track);
 const total=target.camera+(screen?.track?target.screen:0);
 const quality=target.fps/target.scale;
 if((state.budget&&total>state.budget)||(state.quality&&quality>state.quality)){state.good=(state.good||0)+1;if(state.good<3)return}else state.good=0;
 state.budget=total;state.quality=quality;
 for(const [sender,bitrate]of [[camera,target.camera],[screen,target.screen]]as const){
  if(!sender?.track)continue;
  const isScreen = sender === screen;
  try{
   const p=sender.getParameters();
   if(!p.encodings?.length)continue;
   const scale = isScreen ? 1 : target.scale;
   const fps = isScreen ? 60 : target.cameraFps;
   const br = isScreen ? Math.max(8_000_000, bitrate) : bitrate;
   for(const e of p.encodings){
    e.maxBitrate=br;
    e.maxFramerate=fps;
    e.scaleResolutionDownBy=scale;
    e.priority=isScreen?'high':'medium';
    e.networkPriority=isScreen?'high':'medium';
   }
   p.degradationPreference=isScreen?'maintain-resolution':'balanced';
   await sender.setParameters(p);
  }catch{/* Native WebRTC controls remain active */}
 }
 for(const sender of pc.getSenders().filter(s=>s.track?.kind==='audio')){try{const p=sender.getParameters();if(!p.encodings?.length)continue;if(p.encodings.every(e=>e.maxBitrate===96_000&&e.priority==='high'&&e.networkPriority==='high'))continue;for(const e of p.encodings){e.maxBitrate=96_000;e.priority='high';e.networkPriority='high'}await sender.setParameters(p)}catch{}}
}
