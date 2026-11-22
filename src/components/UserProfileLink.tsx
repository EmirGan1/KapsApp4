import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { getApiUrl, getAuthHeaders } from '../utils/api';
import { positiveId, profileNamePath, profilePath } from '../shared/socialNavigation';
import './userProfileLink.css';
const resolved = new Map<string, Promise<number>>();
export function resolveProfile(username: string): Promise<number> {
  const key = `${getAuthHeaders().get('Authorization') || ''}\0${username}`;
  if (!resolved.has(key)) {
    const result = fetch(getApiUrl(`/api/social/users/resolve?username=${encodeURIComponent(username)}`), { headers: getAuthHeaders() }).then(async response => {
      const data = await response.json().catch(() => null);
      const id = positiveId(data?.id); if (!response.ok || !id) throw new Error(data?.error || (response.status === 401 ? 'Oturumunu kontrol edip yeniden dene.' : 'Profil bulunamadı.')); return id;
    }).catch(error => { resolved.delete(key); throw error; });
    resolved.set(key, result);
  }
  return resolved.get(key)!;
}
export function goToProfile(id: number) {
  for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) dialog.close();
  window.dispatchEvent(new CustomEvent('navigate-profile', { detail: id }));
}
export default function UserProfileLink({ username, userId, user, embedded = false, beforeNavigate, newTab = false, children }: {
  username?: unknown; userId?: unknown; user?: unknown; embedded?: boolean; beforeNavigate?: () => void; newTab?: boolean; children?: ReactNode;
}) {
  const label = typeof username === 'string' ? username.trim() : '';
  const name = typeof (user as any)?.username === 'string' ? (user as any).username.trim() : label;
  const id = positiveId(userId) || positiveId((user as any)?.user_id ?? (user as any)?.userId ?? (user as any)?.author_id ?? (user as any)?.sender_id ?? (user as any)?.sender), bot = Boolean((user as any)?.isBot || (user as any)?.is_bot);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (!name || bot || (!user && !id && ['Kullanıcı','Oyuncu','Host','Bilinmiyor','Bir oyuncu','Önceki Oyuncu','Yeni Mesaj'].includes(name))) return <>{children ?? username as ReactNode}</>;
  const href = id ? profilePath(id) : profileNamePath(name);
  const open = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { const targetId = id || await resolveProfile(name); beforeNavigate?.(); goToProfile(targetId); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  const click = (event: MouseEvent) => {
    event.stopPropagation();
    if (newTab) return;
    if (!embedded && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0)) return;
    event.preventDefault(); void open();
  };
  const content = children ?? label;
  const common = { className: 'user-profile-link', title: error || `${name} profilini aç`, 'aria-label': `${name} profilini aç`, 'aria-busy': busy, 'data-profile-name': name };
  return <>{embedded ? <span {...common} role="link" tabIndex={0} onClick={click} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); void open(); } }}>{content}</span> : <a {...common} href={href} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined} onClick={click} onKeyDown={event => event.stopPropagation()}>{content}</a>}{error && <span className="user-profile-error" role="status">{error}</span>}</>;
}
export function UserNamedText({ text, name, userId }: { text: string; name?: string; userId?: number }) {
  const canonical = name?.trim();
  const display = canonical && (text === canonical || text.startsWith(canonical+' ') || text.startsWith(canonical+':')) ? canonical : positiveId(userId) ? text.match(/^(.+?)(?= (?:gönderini|gönderine|sana|seni|ve \d+ kişi))/u)?.[1] : undefined;
  if (!display || !text.startsWith(display)) return <>{text}</>;
  return <><UserProfileLink username={display} userId={userId} />{text.slice(display.length)}</>;
}

const mentionCache = new Map<string, Promise<Array<{start:number;end:number;id:number;username:string}>>>();
export function MentionText({text}: {text:string}) {
  const [snapshot,setSnapshot] = useState<{text:string;ranges:Array<{start:number;end:number;id:number;username:string}>}>({text:'',ranges:[]});
  useEffect(()=>{
    if(!text.includes('@'))return;
    let disposed=false;const key=`${getAuthHeaders().get('Authorization') || ''}\0${text}`;
    if(!mentionCache.has(key)){
      if(mentionCache.size>150)mentionCache.delete(mentionCache.keys().next().value!);
      mentionCache.set(key,fetch(getApiUrl('/api/social/mentions/resolve'),{method:'POST',headers:getAuthHeaders({'Content-Type':'application/json'}),body:JSON.stringify({text})}).then(async response=>{if(!response.ok)throw new Error('Mention lookup failed');return response.json();}).catch(error=>{mentionCache.delete(key);throw error;}));
    }
    void mentionCache.get(key)!.then(ranges=>{if(!disposed)setSnapshot({text,ranges});}).catch(()=>{});return()=>{disposed=true;};
  },[text]);
  if(snapshot.text!==text||!snapshot.ranges.length)return <>{text}</>;
  const nodes:ReactNode[]=[];let cursor=0;
  for(const range of snapshot.ranges){nodes.push(text.slice(cursor,range.start));nodes.push(<UserProfileLink key={range.start} username={range.username} userId={range.id}>{text.slice(range.start,range.end)}</UserProfileLink>);cursor=range.end;}
  nodes.push(text.slice(cursor));return <>{nodes}</>;
}
