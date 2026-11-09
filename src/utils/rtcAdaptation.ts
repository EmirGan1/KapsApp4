import { getCameraSendProfile, getScreenShareProfile, type CameraResolutionMode, OPUS_MAX_BITRATE, SCREEN_SHARE_MAX_BITRATE } from "./webrtcConfig";

/** Per-connection adaptation: voice retains priority over both video tracks. */
export interface LinkSample {available:number;loss:number;rtt:number;cpu?:boolean}
export function chooseVideoBudget(sample:LinkSample,peers:number,sharing:boolean){
 const ceiling = 12_000_000 / Math.max(1, peers);
 const budget = Math.max(180_000, Math.min(ceiling, sample.available * 0.9) - OPUS_MAX_BITRATE);
 // Let the browser react to packet loss, RTT and encoder pressure on each stream.
 const screen = Math.min(SCREEN_SHARE_MAX_BITRATE, Math.floor(budget * 0.7));
 return { camera: Math.round(sharing ? budget - screen : budget), screen,
   scale: 1, fps: 60, cameraFps: 30 };
}
export async function tuneConnection(pc:RTCPeerConnection,camera:RTCRtpSender|undefined,screen:RTCRtpSender|undefined,peers:number,state:{budget?:number;good?:number}, resolution: CameraResolutionMode = 'auto'){
 const stats = await pc.getStats();
 let available = Infinity;
 stats.forEach(report => {
  if (report.type !== 'transport' || !report.selectedCandidatePairId) return;
  const estimate = stats.get(report.selectedCandidatePairId)?.availableOutgoingBitrate;
  if (typeof estimate === 'number' && Number.isFinite(estimate) && estimate > 0) {
   available = Math.min(available, estimate);
  }
 });
 const target=chooseVideoBudget({available,loss:0,rtt:0},peers,!!screen?.track);
 const profile = screen?.track ? getScreenShareProfile(screen.track) : undefined;
 const screenBudget = camera?.track?.enabled === false || !camera?.track ? target.screen + target.camera : target.screen;
 const screenBitrate = profile ? Math.min(screenBudget, profile.maxBitrate) : 0;
 const cameraProfile = getCameraSendProfile(resolution, peers + 1);
 const cameraBitrate = Math.min(cameraProfile.maxBitrate, Math.max(0, target.camera + (profile ? target.screen - screenBitrate : 0)));
 const total = (camera?.track ? cameraBitrate : 0) + screenBitrate;
 if (state.budget && total > state.budget * 1.15) {
  state.good = (state.good ?? 0) + 1;
  if (state.good < 3) return;
 }
 state.good = 0;
 state.budget = total;
 for(const [sender,bitrate]of [[camera,cameraBitrate],[screen,screenBitrate]]as const){
  if(!sender?.track || bitrate <= 0)continue;
  const isScreen = sender === screen;
  try{
   const p=sender.getParameters();
   if(!p.encodings?.length)continue;
   const scale = 1;
   const fps = isScreen && profile ? Math.min(target.fps, profile.maxFramerate) : cameraProfile.maxFramerate;
   const preference = isScreen && profile ? profile.degradationPreference : 'balanced';
   if (p.degradationPreference === preference && p.encodings.every(encoding =>
     encoding.maxBitrate === bitrate && encoding.maxFramerate === fps &&
     encoding.scaleResolutionDownBy === scale
   )) continue;
   for(const e of p.encodings){
    e.maxBitrate=bitrate;
    e.maxFramerate=fps;
    e.scaleResolutionDownBy=scale;
    e.priority=isScreen?'high':'medium';
    e.networkPriority=isScreen?'high':'medium';
   }
   p.degradationPreference = preference;
   await sender.setParameters(p);
  }catch{/* Native WebRTC controls remain active */}
 }
 for(const sender of pc.getSenders().filter(s=>s.track?.kind==='audio')){try{const p=sender.getParameters();if(!p.encodings?.length)continue;if(p.encodings.every(e=>e.maxBitrate===OPUS_MAX_BITRATE&&e.priority==='high'&&e.networkPriority==='high'))continue;for(const e of p.encodings){e.maxBitrate=OPUS_MAX_BITRATE;e.priority='high';e.networkPriority='high'}await sender.setParameters(p)}catch{}}
}
