import React,{useEffect,useState} from 'react';
import type {Socket} from 'socket.io-client';
import {COSMETICS,RARITIES,type Inventory} from '../../../games/kapsstrike/cosmetics';
import {WEAPONS} from '../../../games/kapsstrike/config';
export default function StrikeInventoryAdmin({socket}:{socket?:Socket|null}){
 const [allowed,setAllowed]=useState(false),[query,setQuery]=useState(''),[users,setUsers]=useState<Array<{id:number;username:string;inventory:Inventory}>>([]),[selected,setSelected]=useState<number|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{if(!socket?.connected)return;socket.timeout(5000).emit('strike:inventory_admin_check',(e:any,r:any)=>{setAllowed(!e&&r?.success&&r.allowed===true);});},[socket]);
 const search=()=>{if(!allowed||!socket?.connected||busy)return;setBusy(true);socket.timeout(8000).emit('strike:inventory_admin_search',{query},(e:any,r:any)=>{setBusy(false);if(e||!r?.success){setMessage(r?.error||'Arama başarısız.');return;}setUsers(r.users);setSelected(null);setMessage(`${r.users.length} hesap bulundu.`);});};
 const grant=(id:number)=>{if(!allowed||!socket?.connected||busy)return;setBusy(true);socket.timeout(8000).emit('strike:inventory_admin_grant_all',{userId:id},(e:any,r:any)=>{setBusy(false);if(e||!r?.success){setMessage(r?.error||'Görünümler eklenemedi.');return;}setUsers(old=>old.map(u=>u.id===id?r.user:u));setSelected(id);setMessage(`${r.user.username} hesabına tüm kozmetikler eklendi.`);});};
 if(!allowed)return <section className="ks-inventory"><h2>Yönetici envanteri</h2><p role="status">Bu panel yalnızca yetkili hesaba açıktır.</p></section>;
 const active=users.find(u=>u.id===selected);
 return <section className="ks-inventory ks-inventory-admin"><h2>Emirgan · Envanter Yönetimi</h2><p>Yalnızca kullanıcı adı, KapsStrike kozmetik envanteri ve oyun içi kozmetik işlemleri gösterilir.</p><form onSubmit={e=>{e.preventDefault();search();}}><label>Kullanıcı ara <input value={query} maxLength={40} onChange={e=>setQuery(e.target.value)} placeholder="Kullanıcı adı" /></label><button disabled={busy||!socket?.connected}>Ara</button></form><p role="status">{message}</p>
 <div className="ks-admin-user-list">{users.map(u=><button key={u.id} aria-pressed={selected===u.id} onClick={()=>setSelected(u.id)}><b>@{u.username}</b><small>{Object.values(u.inventory.owned).reduce((n,c)=>n+c,0)} görünüm · {u.inventory.opened} kasa açılışı</small></button>)}</div>
 {active&&<article className="ks-admin-target"><h3>@{active.username} · Envanter</h3><button className="ks-primary" disabled={busy||!socket?.connected} onClick={()=>grant(active.id)}>Tüm silah kaplamalarını ve bıçakları ekle</button><div className="ks-loot-grid">{COSMETICS.filter(c=>active.inventory.owned[c.id]).map(c=><article key={c.id} style={{'--rarity':RARITIES[c.rarity].color} as React.CSSProperties}><b>{c.name}</b><small>{WEAPONS[c.weapon].name} · {RARITIES[c.rarity].name} · ×{active.inventory.owned[c.id]}</small></article>)}</div></article>}
 </section>;
}
