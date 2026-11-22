import { useDeletionArray, deleteContent, recordDeletion, liveRows, wasDeleted } from "../utils/contentDeletion";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import type { Post, MediaModalData } from '../types';
import PostCard from './PostCard';
import LikesModal from './LikesModal';
import MediaModal from './MediaModal';
import { extractPostMediaItems } from './MultiMediaPostViewer';
import { getApiUrl, getAuthHeaders } from '../utils/api';
export default function PostDetail({ postId, currentUserId, currentUsername, onUserClick, socket }: {
  postId: number; currentUserId: number; currentUsername: string; onUserClick: (id:number)=>void; socket: Socket | null;
}) {
  const [post,setPost]=useState<Post|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [comments,setComments]=useDeletionArray<any>("comment", []),[showComments,setShowComments]=useState(false),[likes,setLikes]=useState(false),[media,setMedia]=useState<MediaModalData|null>(null),[busy,setBusy]=useState(false);
  const request=async(path:string,body?:unknown,method?:string)=>{
    const response=await fetch(getApiUrl(path),{method:method||(body===undefined?'GET':'POST'),headers:getAuthHeaders(body===undefined?undefined:{'Content-Type':'application/json'}),body:body===undefined?undefined:JSON.stringify(body)});
    const data=await response.json().catch(()=>null);if(!response.ok)throw new Error(data?.error||(response.status===404?'Bu gönderi artık mevcut değil.':'Gönderi yüklenemedi.'));return data;
  };
  useEffect(()=>{
    let disposed=false;setPost(null);setLoading(true);setError('');setComments([]);setShowComments(false);setLikes(false);setMedia(null);
    const load=()=>{void request(`/api/social/posts/${postId}`).then(data=>{if(!disposed){if(!wasDeleted("post",data.id))setPost(data);setError('');}}).catch(err=>{if(!disposed){setPost(null);setError(err.message);}}).finally(()=>{if(!disposed)setLoading(false);});};
    load();socket?.on('feed_updated',load);return()=>{disposed=true;socket?.off('feed_updated',load);};
  },[postId,socket]);
  useEffect(()=>{const deleted=(event:Event)=>{const data=(event as CustomEvent).detail;if(data.kind==='post'&&Number(data.id)===postId){setPost(null);setMedia(null);setError('Bu gönderi silindi.');}};window.addEventListener('content-deleted',deleted);return()=>window.removeEventListener('content-deleted',deleted);},[postId]);
  const loadComments=async()=>{const data=await request(`/api/posts/${postId}/comments`);setComments(Array.isArray(data)?data:data.comments||[]);};
  const act=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await fn();}catch(err:any){setError(err.message);}finally{setBusy(false);}};
  const like=()=>{void act(async()=>{await request(`/api/social/posts/${postId}/like`,{});setPost(await request(`/api/social/posts/${postId}`));});};
  const addComment=async(_id:number,content:string)=>{await act(async()=>{await request(`/api/posts/${postId}/comments`,{content});await loadComments();});};
  const openMedia=(p:Post,index=0)=>{const items=extractPostMediaItems(p),item=items[index]||items[0];setMedia({url:item?.url||p.image||'',type:item?.type||p.media_type||'image',items,initialIndex:index,postId:p.id,authorId:p.user_id,authorName:p.username,authorAvatar:p.avatar,authorColor:p.color,caption:p.caption,timestamp:p.created_at});};
  return <section className="mx-auto w-full max-w-3xl px-2 py-5 sm:px-5" aria-label="Gönderi ayrıntısı">
    <Link to="/akis" className="mb-4 inline-block text-sm font-semibold text-blue-600 hover:underline">← Akışa dön</Link>
    <h1 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">Gönderi</h1>
    {loading&&<p role="status">Gönderi yükleniyor…</p>}{error&&<p role="alert" className="mb-4 rounded-xl border border-amber-300 p-4">{error}</p>}
    {post&&<div aria-busy={busy} data-post-id={post.id}><PostCard post={post} currentUserId={currentUserId} currentUsername={currentUsername} isCommentsOpen={showComments} comments={comments} onLike={like} onOpenLikes={()=>setLikes(true)} onToggleComments={()=>{setShowComments(!showComments);if(!showComments)void act(loadComments);}} onOpenModal={openMedia} onDeletePost={()=>{void act(async()=>{await deleteContent("post",postId);setPost(null);setMedia(null);setError('Bu gönderi silindi.');});}} onCommentSubmit={addComment} onDeleteComment={(commentId)=>{void act(async()=>{await deleteContent("comment",commentId);await loadComments();});}} onUserClick={onUserClick}/></div>}
    <LikesModal isOpen={likes} onClose={()=>setLikes(false)} postId={postId} initialCount={post?.likes_count} onUserClick={onUserClick}/>
    {media&&<MediaModal data={media} onClose={()=>setMedia(null)} onUserClick={onUserClick}/>}
  </section>;
}
