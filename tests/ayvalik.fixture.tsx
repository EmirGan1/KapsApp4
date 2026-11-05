import {BrowserRouter} from "react-router-dom";
import React from 'react';import {createRoot} from 'react-dom/client';
import AyvalikCasPanel from '../src/components/AyvalikCasPanel';import '../src/index.css';
const id=Number(new URLSearchParams(location.search).get('user')||1);
createRoot(document.getElementById('root')!).render(<BrowserRouter><div className="dark" style={{display:'flex',height:'100vh',width:'100%',minWidth:0}}><AyvalikCasPanel socket={null} currentUserId={id} currentUsername={'Öğrenci '+id} avatar={null}/></div></BrowserRouter>);
