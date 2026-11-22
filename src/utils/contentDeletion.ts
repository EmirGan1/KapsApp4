import { useCallback, useEffect, useState, type SetStateAction } from 'react';
import { getApiUrl, getAuthHeaders } from './api';
import { positiveId } from '../shared/socialNavigation';
export type ContentKind='global'|'private'|'group'|'post'|'comment';
const removed=new Map<ContentKind,Set<string>>();
const pending=new Map<string,Promise<any>>();
let channel:BroadcastChannel|undefined;
export function wasDeleted(kind:ContentKind,id:unknown){return removed.get(kind)?.has(String(id))||false;}
export function liveRows<T extends {id?:any;reply_to?:any;reply_message?:any}>(kind:ContentKind,rows:T[]):T[]{
 return (Array.isArray(rows)?rows:[]).filter(row=>!wasDeleted(kind,row.id)).map(row=>wasDeleted(kind,row.reply_to)||wasDeleted(kind,row.reply_message?.id)?{...row,reply_to:null,reply_message:null}:row);
}
export function recordDeletion(kind:ContentKind,payload:any,broadcast=true){
 if(!['global','private','group','post','comment'].includes(kind))return;
 const id=positiveId(kind==='comment' ? payload?.commentId??payload?.id??payload : kind==='post' ? payload?.postId??payload?.id??payload : payload?.message_id??payload?.id??payload);if(!id)return;
 let ids=removed.get(kind);if(!ids){ids=new Set();removed.set(kind,ids);}if(ids.has(String(id)))return;
 ids.add(String(id));
 const event={...payload,kind,id};
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('content-deleted',{detail:event}));
 if(broadcast)channel?.postMessage(event);
}
if(typeof window!=='undefined'&&typeof BroadcastChannel!=='undefined'){
 channel=new BroadcastChannel('kapsapp-content-deletions');channel.onmessage=e=>e.data?.clear?recordClear(e.data.kind,false):recordDeletion(e.data?.kind,e.data,false);
}
export function recordClear(kind:ContentKind,broadcast=true){
 if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('content-cleared',{detail:{kind}}));
 if(broadcast)channel?.postMessage({kind,clear:true});
}
export function useDeletionArray<T extends {id?:any;reply_to?:any;reply_message?:any}>(kind:ContentKind,initial:T[]|(()=>T[])){
 const [rows,setRaw]=useState<T[]>(()=>liveRows(kind,typeof initial==='function'?initial():initial));
 const setRows=useCallback((next:SetStateAction<T[]>)=>setRaw(previous=>liveRows(kind,typeof next==='function'?next(previous):next)),[kind]);
 useEffect(()=>{const deleted=(event:Event)=>{if((event as CustomEvent).detail?.kind===kind)setRows(previous=>previous);};const cleared=(event:Event)=>{if((event as CustomEvent).detail?.kind===kind)setRows([]);};window.addEventListener('content-deleted',deleted);window.addEventListener('content-cleared',cleared);setRows(previous=>previous);return()=>{window.removeEventListener('content-deleted',deleted);window.removeEventListener('content-cleared',cleared);};},[kind,setRows]);
 return [rows,setRows] as const;
}
export function deleteContent(kind:ContentKind,raw:unknown){
 const id=positiveId(raw);if(!id)return Promise.reject(new Error('Bu içerik henüz kaydedilmedi. Biraz bekleyip tekrar dene.'));
 const key=`${kind}:${id}`;if(pending.has(key))return pending.get(key)!;
 const path=kind==='post'?`/api/posts/${id}`:kind==='comment'?`/api/comments/${id}`:`/api/messages/${id}?type=${kind}`;
 const work=fetch(getApiUrl(path),{method:'DELETE',headers:getAuthHeaders(),signal:AbortSignal.timeout(15000)}).then(async response=>{
   const data=await response.json().catch(()=>null);if(!response.ok||!data?.success)throw new Error(data?.error||'İçerik silinemedi. Bağlantını kontrol edip tekrar dene.');
   recordDeletion(kind,{...data,id});return data;
 }).finally(()=>pending.delete(key));pending.set(key,work);return work;
}
