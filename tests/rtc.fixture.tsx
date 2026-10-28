import React from 'react';import {createRoot} from 'react-dom/client';import {io} from 'socket.io-client';import {useWebRTC} from '../src/hooks/useWebRTC';
const socket=io({transports:['websocket']});(window as any).sock=socket;
// A deterministic screen source tests transport and lifecycle without an OS picker.
navigator.mediaDevices.getDisplayMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=360;setInterval(()=>{const ctx=c.getContext('2d')!;ctx.fillStyle='blue';ctx.fillRect(0,0,640,360)},16);return c.captureStream(60)};
function App(){const rtc=useWebRTC({socket,currentUserId:1,roomId:'test',participantCount:2});(window as any).rtc=rtc;return <div>RTC fixture</div>};createRoot(document.getElementById('root')!).render(<App/>);
