import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { Link } from 'react-router-dom';
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
  useEffect(() => {
    const receive = (invite: ActivityInvite) => setInvites(list => [invite, ...list.filter(item => item.id !== invite.id)].slice(0, 5));
    socket?.on('activity:invited', receive);
    return () => { socket?.off('activity:invited', receive); };
  }, [socket]);
  const close = (id: string) => setInvites(list => list.filter(item => item.id !== id));
  return <div className="pointer-events-none fixed right-3 top-3 z-[200] w-[min(22rem,calc(100%-1.5rem))] space-y-2">
    {invites.map(invite => {
      const url = invite.activity === 'ayvalik-games' ? '/ayvalik-cas?' + new URLSearchParams({ section: 'games', room: invite.room ?? '' })
        : invite.activity === 'ayvalik-rooms' ? '/ayvalik-cas?section=rooms' : '/oyunlar?' + new URLSearchParams({ oyun: invite.activity });
      return <article key={invite.id} role="status" className="pointer-events-auto rounded-2xl border border-emerald-500 bg-slate-950 p-4 text-white shadow-xl">
        <p><strong>{invite.sender}</strong> seni <strong>{ACTIVITY_NAMES[invite.activity]}</strong> etkinliğine davet etti.</p>
        <div className="mt-3 flex gap-3"><Link to={url} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold" onClick={() => close(invite.id)}>Aç</Link>
          <button type="button" onClick={() => close(invite.id)}>Kapat</button></div>
      </article>;
    })}
  </div>;
}
