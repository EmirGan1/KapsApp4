import React from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import {EngineStore} from '@babylonjs/core/Engines/engineStore';
import KapsStrikeGame from '../src/components/games/kapsstrike/KapsStrikeGame';
import '../src/components/games/kapsstrike/kapsstrike.css';
import MiniBattleRoyale from '../src/components/MiniBattleRoyale';
import {StrikeController} from '../src/games/kapsstrike/controller';
import '../src/index.css';
const root=createRoot(document.getElementById('root')!);
(window as any).engineStore=EngineStore;
const exit=()=>{root.unmount();(window as any).exited=true;};
if(new URLSearchParams(location.search).get('game')==='royale'){
 const socket=io({auth:{test:true},transports:['websocket']});
 (window as any).packets=[];const emit=socket.emit.bind(socket);
 (socket as any).emit=(event:string,...args:any[])=>{if(event==='royale:input')(window as any).packets.push(args[0]);return emit(event,...args);};
 (window as any).socket=socket;
 socket.on('connect',()=>root.render(<><MiniBattleRoyale socket={socket} currentUserId={1} username="Sensor Tester" onBackToHub={exit}/><button style={{position:'fixed',top:0,left:0,zIndex:200}} onClick={e=>{socket.emit('fixture:start');e.currentTarget.remove();}}>Fixture match</button></>));
}else{
 const start=StrikeController.prototype.start;
 StrikeController.prototype.start=function(capture=true){(window as any).strike=this;return start.call(this,capture);};
 root.render(<KapsStrikeGame onBack={exit}/>);
}
