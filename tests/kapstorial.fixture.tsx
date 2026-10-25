import React from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import KapstorialGame from '../src/components/games/kapstorial/KapstorialGame';
import '../src/index.css';
const socket=io({transports:['websocket']});
const code=new URLSearchParams(location.search).get('room')!;
createRoot(document.getElementById('root')!).render(<div style={{position:'relative',width:'100vw',height:'100dvh'}}><KapstorialGame socket={socket} currentUserId={1} username="Test" targetRoomCode={code} onBackToHub={()=>{}} /></div>);
