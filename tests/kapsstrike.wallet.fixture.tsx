import '../src/index.css';
import React from 'react';import {createRoot} from 'react-dom/client';import {io} from 'socket.io-client';
import StrikeInventory from '../src/components/games/kapsstrike/StrikeInventory';import StrikeInventoryAdmin from '../src/components/games/kapsstrike/StrikeInventoryAdmin';import '../src/components/games/kapsstrike/kapsstrike.css';
const q=new URLSearchParams(location.search),socket=io({auth:{testUser:Number(q.get('user')||2)},transports:['websocket']});(window as any).socket=socket;
socket.on('connect',()=>{if((window as any).mounted)return;(window as any).mounted=true;createRoot(document.getElementById('root')!).render(<main className="ks-root" style={{position:'relative',minHeight:'100dvh',overflow:'auto',padding:16,background:'#0b1724',color:'white'}}>{q.has('admin')?<StrikeInventoryAdmin socket={socket}/>:<StrikeInventory socket={socket} onChange={s=>{(window as any).inventory=s;}}/>}</main>);});
