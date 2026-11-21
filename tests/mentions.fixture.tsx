import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MentionInput,MentionTextarea,MentionHighlight,MentionTargetPreview} from '../src/components/Mentions';
import '../src/index.css';
const user=new URLSearchParams(location.search).get('user')||'1';localStorage.setItem('lan_token',user);
let foreground=true;Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>foreground?'visible':'hidden'});document.hasFocus=()=>foreground;
(window as any).foreground=(value:boolean)=>{foreground=value;document.dispatchEvent(new Event('visibilitychange'));};
function Fixture(){const [text,setText]=useState(''),[post,setPost]=useState('');return <div style={{padding:16}}><h1>Mentions QA</h1><form onSubmit={e=>{e.preventDefault();(window as any).submitted=text;}}><MentionInput aria-label="Mesaj yaz" value={text} onChange={e=>setText(e.target.value)} /><button>Gönder</button></form><MentionTextarea kind="post" aria-label="Gönderi yaz" value={post} onChange={e=>setPost(e.target.value)}/><div style={{height:1500}}>Scroll area</div><MentionHighlight kind="global" target={10}><p>@Ayşe burada</p></MentionHighlight><MentionTargetPreview/></div>}
createRoot(document.getElementById('root')!).render(<Fixture/>);
