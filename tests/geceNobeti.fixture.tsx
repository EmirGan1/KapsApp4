import React from 'react';import {createRoot} from 'react-dom/client';import Games from '../src/components/Games';import '../src/index.css';
createRoot(document.getElementById('root')!).render(<div className="dark flex h-dvh w-full min-w-0"><Games socket={null} currentUserId={1} username="Test"/></div>);
