import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Link, useNavigate } from 'react-router-dom';
import { ACTIVITY_NAMES, type Activity, type ActivityInvite } from '../utils/activityInvites';
import { getApiUrl, getAuthHeaders } from '../utils/api';

export function InvitePlayer({ socket, activity, userId }: { socket: Socket | null; activity: Activity; userId: number }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ id: number; username: string }[]>([]);
  const [target, setTarget] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const send = () => {
    if (!socket?.connected) { setStatus('Bağlantı yok.'); return; }
    setBusy(true);
    socket.timeout(5000).emit('activity:invite', { activity, target: Number(target) },
      (error: Error | null, result?: { success: boolean; error?: string }) => {
        setBusy(false);
        setStatus(error ? 'Sunucu yanıt vermedi.' : result?.success ? 'Davet gönderildi.' : result?.error ?? 'Davet gönderilemedi.');
      });
  };
  return <div className="relative flex flex-wrap items-center gap-2 text-sm">
    <button type="button" className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white" onClick={async () => {
      setOpen(!open);
      if (open) return;
      setStatus('Oyuncular yükleniyor…');
      try {
        const response = await fetch(getApiUrl('/api/ayvalik/room-users'), { headers: getAuthHeaders() });
        if (!response.ok) throw Error();
        setUsers((await response.json()).users);
        setStatus('');
      } catch { setStatus('Oyuncular alınamadı.'); }
    }}>{open ? 'Daveti kapat' : 'Oyuncu davet et'}</button>
    {open && <><select aria-label="Davet edilecek oyuncu" className="max-w-full rounded-lg border bg-white p-2 dark:bg-slate-900" value={target} onChange={event => setTarget(event.target.value)}>
      <option value="">Oyuncu seç</option>{users.filter(user => Number(user.id) !== userId).map(user => <option key={user.id} value={user.id}>{user.username}</option>)}
    </select><button type="button" disabled={busy || !target} onClick={send} className="rounded-lg border px-3 py-2 disabled:opacity-50">Gönder</button>
    <span role="status">{status}</span></>}
  </div>;
}

export function IncomingActivityInvites({ socket }: { socket: Socket | null }) {
  const [invites, setInvites] = useState<ActivityInvite[]>([]);
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<{id:string;message:string}>();
  const navigate = useNavigate();
  useEffect(() => {
    const receive = (invite: ActivityInvite) => setInvites(list => [invite, ...list.filter(item => item.id !== invite.id)].slice(0, 5));
    socket?.on('activity:invited', receive);
    return () => { socket?.off('activity:invited', receive); };
  }, [socket]);
  const close = (id: string) => setInvites(list => list.filter(item => item.id !== id));
  const accept = async (invite: ActivityInvite) => {
    if (!socket?.connected || pending) return;
    setPending(invite.id);
    setError(undefined);
    const done = (problem?: string, roomCode?: string) => {
      setPending(undefined);
      if (problem) return setError({id:invite.id,message:problem});
      close(invite.id);
      if (invite.activity === 'kapsstrike') {
        navigate('/oyunlar?' + new URLSearchParams({oyun:'kapsstrike',room:roomCode ?? ''}));
        window.dispatchEvent(new CustomEvent('kaps:join_game',{detail:{game:'kapsstrike',roomId:roomCode}}));
      }
      else navigate('/ayvalik-cas?' + new URLSearchParams({section:invite.activity === 'ayvalik-games' ? 'games' : 'rooms'}));
    };
    if (invite.activity === 'ayvalik-rooms') {
      try {
        const response = await fetch(getApiUrl('/api/ayvalik/rooms/' + encodeURIComponent(invite.room!) + '/join'), {method:'POST',headers:getAuthHeaders()});
        const result = await response.json();
        done(response.ok && result.success ? undefined : result.error ?? 'Odaya katılınamadı.');
      } catch { done('Sunucu yanıt vermedi.'); }
      return;
    }
    const callback = (err: Error | null, result?: {success:boolean;error?:string;roomCode?:string}) =>
      done(err ? 'Sunucu yanıt vermedi.' : result?.success ? undefined : result?.error ?? 'Odaya katılınamadı.',result?.roomCode);
    if (invite.activity === 'kapsstrike') socket.timeout(5000).emit('strike:accept_invite',{id:invite.id},callback);
    else socket.timeout(5000).emit('trip-game:action',{action:'join',value:invite.room},callback);
  };
  return <div className="pointer-events-none fixed right-3 top-3 z-[200] w-[min(22rem,calc(100%-1.5rem))] space-y-2">
    {invites.map(invite => {
      const url = invite.activity === 'ayvalik-games' ? '/ayvalik-cas?' + new URLSearchParams({ section: 'games', room: invite.room ?? '' })
        : invite.activity === 'ayvalik-rooms' ? '/ayvalik-cas?section=rooms' : '/oyunlar?' + new URLSearchParams({ oyun: invite.activity });
      const direct = !!invite.room && ['kapsstrike','ayvalik-games','ayvalik-rooms'].includes(invite.activity);
      return <article key={invite.id} role="status" className="pointer-events-auto rounded-2xl border border-emerald-500 bg-slate-950 p-4 text-white shadow-xl">
        <p><strong>{invite.sender}</strong> seni <strong>{ACTIVITY_NAMES[invite.activity]}</strong> etkinliğine davet etti.{invite.roomName && <> Masa: {invite.roomName}</>}</p>
        {error?.id===invite.id && <p role="alert" className="text-red-200">{error.message}</p>}
        <div className="mt-3 flex gap-3">{direct ? <button type="button" disabled={!!pending} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold disabled:opacity-60" onClick={() => void accept(invite)}>{pending===invite.id?'Katılınıyor…':'Kabul et'}</button> :
          <Link to={url} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold" onClick={() => close(invite.id)}>Aç</Link>}
          <button type="button" onClick={() => close(invite.id)}>Kapat</button></div>
      </article>;
    })}
  </div>;
}
