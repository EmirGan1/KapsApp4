import React,{useEffect,useState} from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,useLocation,useNavigate,Link}from'react-router-dom';
import Notifications from '../src/components/Notifications';import ToastContainer from '../src/components/ToastContainer';import PostDetail from '../src/components/PostDetail';import UserProfileLink,{resolveProfile,MentionText}from '../src/components/UserProfileLink';import{notificationPostPath,postIdFromPath}from'../src/shared/socialNavigation';import'../src/index.css';
localStorage.setItem('lan_token','test-token');
const notification={id:1,type:'like',sender_id:2,sender_username:'Ali Can',target_id:7,content:'Ali Can gönderini beğendi.',read:0,created_at:'2026-11-22T10:00:00Z'};
const socket:any={connected:true,on:()=>{},off:()=>{},emit:(event:string,...args:any[])=>{if(event==='get_notifications')args[0]([notification,{...notification,id:2}]);}};
function App(){const location=useLocation(),navigate=useNavigate(),[selected,setSelected]=useState(0),[error,setError]=useState('');
 useEffect(()=>{const listener=(e:any)=>navigate(`/profil/${e.detail}`);window.addEventListener('navigate-profile',listener);return()=>window.removeEventListener('navigate-profile',listener);},[navigate]);
 useEffect(()=>{const name=new URLSearchParams(location.search).get('username');if(location.pathname==='/profil'&&name)void resolveProfile(name).then(id=>navigate(`/profil/${id}`,{replace:true})).catch(e=>setError(e.message));},[location.pathname,location.search]);
 const click=(n:any)=>{const path=notificationPostPath(n);if(path)navigate(path);};const id=postIdFromPath(location.pathname);
 return <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white"><nav className="p-4 flex gap-4"><Link to="/bildirimler">Bildirimler</Link><Link to="/toast">Toast</Link><Link to="/names">Adlar</Link></nav><output data-path>{location.pathname}{location.search}</output>
 {location.pathname==='/bildirimler'&&<Notifications socket={socket} onNotificationClick={click}/>}
 {location.pathname==='/toast'&&<ToastContainer toasts={[{id:'like-toast',type:'like',title:'Yeni Beğeni',target_id:7,senderId:2,senderName:'Ali Can',lastMessage:'Ali Can gönderini beğendi.',messages:[],unreadCount:1,timestamp:Date.now()},{id:'second-like-toast',type:'like',title:'Yeni Beğeni',target_id:8,senderId:2,senderName:'Ali Can',lastMessage:'Ali Can ikinci gönderini beğendi.',messages:[],unreadCount:1,timestamp:Date.now()}]} onClick={click} onDismiss={()=>{}}/>}
 {id&&<PostDetail key={id} postId={id} currentUserId={1} currentUsername="Owner" onUserClick={id=>navigate(`/profil/${id}`)} socket={null}/>}
 {location.pathname==='/names'&&<div className="p-5 space-y-5"><div><UserProfileLink username="Ali Can"/></div><button type="button" onClick={()=>setSelected(v=>v+1)}><UserProfileLink username="Ali Can" embedded/> seç</button><output data-selected>{selected}</output><div><UserProfileLink username="Missing User"/></div><UserProfileLink username="Bot Ada" user={{isBot:true}}/><div data-explicit-mentions><MentionText text="@Ali Can ve @Ali a@Ali.com"/></div></div>}
 {location.pathname.startsWith('/profil')&&<h1>Profil {location.pathname.split('/')[2]}{error}</h1>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><App/></BrowserRouter>);
