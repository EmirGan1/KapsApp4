import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {io} from 'socket.io-client';
import StrikeInventory from '../src/components/games/kapsstrike/StrikeInventory';
import '../src/components/games/kapsstrike/kapsstrike.css';
const socket=io();function App(){const[ready,setReady]=useState(socket.connected);socket.once('connect',()=>setReady(true));return <section className="ks-root" style={{position:'relative',overflow:'auto',minHeight:'100vh',padding:12,background:'#080f1c',color:'white'}}>{ready&&<StrikeInventory socket={socket} onChange={s=>{(window as any).inventory=s;}}/>}</section>};createRoot(document.getElementById('root')!).render(<App/>);
