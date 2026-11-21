import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { io } from 'socket.io-client';
import Chats from '../src/components/Chats';
import { CallProvider } from '../src/context/CallContext';
import '../src/index.css';
const id = Number(new URLSearchParams(location.search).get('user')) || 1;
const socket = io({ auth: { id }, transports: ['websocket'] });
localStorage.setItem('lan_user_id', String(id));
let foreground = true;
Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => foreground ? 'visible' : 'hidden' });
document.hasFocus = () => foreground;
(window as any).dm = { socket, foreground: (value: boolean) => { foreground = value; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event(value ? 'focus' : 'blur')); } };
function Fixture() {
  const [target, setTarget] = useState<number | null>(id === 1 ? 2 : 1);
  const handled = useCallback(() => setTarget(null), []);
  return <BrowserRouter><CallProvider socket={socket} currentUserId={id}><div className="h-dvh flex"><Chats socket={socket} currentUserId={id} currentUsername={`user${id}`} onlineUsers={[1,2]} targetUserId={target} onTargetUserHandled={handled} /></div></CallProvider></BrowserRouter>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
