import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { InvitePlayer } from '../ActivityInvites';

type Room = {
  id: string; name: string; members: { id: number; name: string }[];
  round?: { mode: 'mole' | 'dilemma'; isMole?: boolean; clue?: string; options?: string[]; voted: boolean; voteCount: number;
    result?: { mole?: number; word?: string; votes: [number, number][] } };
};
const button = 'rounded-xl border px-4 py-2 font-semibold hover:border-emerald-500 disabled:opacity-50';

export default function TripGames({ socket, userId }: { socket: Socket | null; userId: number }) {
  const [params, setParams] = useSearchParams();
  const inviteRoom = params.get('room');
  const [room, setRoom] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState(inviteRoom ?? '');
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!socket) return;
    const refresh = () => socket.emit('trip-game:state');
    socket.on('trip-game:state', setRoom);
    socket.on('connect', refresh);
    if (socket.connected) refresh();
    return () => { socket.off('trip-game:state', setRoom); socket.off('connect', refresh); };
  }, [socket]);
  useEffect(() => { if (inviteRoom) setCode(inviteRoom); }, [inviteRoom]);

  const action = (action: string, value?: string | number) => {
    if (!socket?.connected) { setStatus('Sunucuya bağlanmayı bekle.'); return; }
    setStatus('');
    socket.timeout(5000).emit('trip-game:action', { action, value }, (error: Error | null, result?: { success: boolean; error?: string }) => {
      if (error || !result?.success) setStatus(error ? 'Sunucu yanıt vermedi.' : result?.error ?? 'İşlem tamamlanamadı.');
      else if (action === 'join' && inviteRoom) setParams(previous => {
        const next = new URLSearchParams(previous);
        next.delete('room');
        return next;
      }, { replace: true });
    });
  };
  const host = room?.members[0]?.id === userId;
  const round = room?.round;
  const playerName = (id: number) => room?.members.find(member => member.id === id)?.name;
  const moleVotes = round?.result?.votes.filter(([, choice]) => choice === round.result?.mole).length ?? 0;
  return <section className="space-y-5 rounded-3xl border p-5 dark:border-slate-700 sm:p-7">
    <header><h2 className="text-2xl font-black">Gezi oyunları</h2><p className="mt-2 text-sm">Otobüste veya molada arkadaşlarınla oyna. Oyuncuların özel kartları yalnızca kendi ekranlarında görünür.</p></header>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-950"><strong>Köstebek · 3–8 kişi</strong><p className="text-sm">Herkes aynı kelimeyi, köstebek ise bir ipucu alır. Sırayla kelimeyi söylemeden tarif et ve kimin köstebek olduğunu oyla.</p></div>
      <div className="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-950"><strong>İkilem · 2–8 kişi</strong><p className="text-sm">İki seçenekten birini gizlice seç. Herkes oy verdikten sonra kimin hangi tarafta olduğu ortaya çıkar.</p></div>
    </div>
    {status && <p role="alert" className="text-red-600 dark:text-red-300">{status}</p>}
    {!room ? <div className="flex flex-wrap gap-2">
      <input className={button} aria-label="Oda adı" placeholder="Oda adı (isteğe bağlı)" maxLength={48} value={name} onChange={event => setName(event.target.value)} />
      <button className={button} onClick={() => action('create', name)}>Oda kur</button>
      <input className={button} aria-label="Oda kodu" placeholder="Oda kodu" value={code} onChange={event => setCode(event.target.value)} />
      <button className={button} disabled={!code.trim()} onClick={() => action('join', code.trim())}>Odaya katıl</button>
    </div> : <>
      <div className="flex flex-wrap items-center gap-3"><h3 className="text-xl font-bold">{room.name}</h3>
        <button className={button} onClick={() => action('leave')}>Odadan ayrıl</button>
      </div>
      <p>{room.members.map(member => member.name).join(' · ')} · {room.members.length}/8</p>
      {!round && <div className="flex flex-wrap items-start gap-2">
        <InvitePlayer socket={socket} activity="ayvalik-games" userId={userId} />
        <button className={button} onClick={async () => {
          try { await navigator.clipboard.writeText(room.id); setStatus('Oda kodu kopyalandı.'); }
          catch { setStatus(`Oda kodu: ${room.id}`); }
        }}>Oda kodunu kopyala</button>
      </div>}
      {host && (!round || round.result) && <div className="flex flex-wrap gap-2">
        <button className={button} disabled={room.members.length < 3} onClick={() => action('start', 'mole')}>Köstebek başlat</button>
        <button className={button} disabled={room.members.length < 2} onClick={() => action('start', 'dilemma')}>İkilem başlat</button>
      </div>}
      {host && round && <button className={button} onClick={() => action('lobby')}>{round.result ? 'Lobiye dön' : 'Turu bitir ve lobiye dön'}</button>}
      {round && <div className="space-y-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
        {round.mode === 'mole' && <p><strong>{round.isMole ? 'Köstebeksin · İpucun' : 'Gizli kelimen'}</strong> · {round.clue}</p>}
        {!round.result && !round.voted && <div className="flex flex-wrap gap-2">
          {round.mode === 'mole' ? room.members.filter(member => member.id !== userId).map(member => <button key={member.id} className={button} onClick={() => action('vote', member.id)}>{member.name} köstebek</button>)
            : round.options?.map((option, index) => <button key={option} className={button} onClick={() => action('vote', index)}>{option}</button>)}
        </div>}
        <p role="status">{round.voteCount}/{room.members.length} oy</p>
        {round.result && <div className="space-y-2">
          {round.mode === 'mole' && <p><strong>{moleVotes > (room.members.length - 1) / 2 ? 'Grup köstebeği buldu!' : 'Köstebek saklanmayı başardı!'}</strong> Köstebek: {playerName(round.result.mole ?? 0)} · Kelime: {round.result.word}</p>}
          <ul>{round.result.votes.map(([id, vote]) => <li key={id}>{playerName(id)} → {round.mode === 'mole' ? playerName(vote) : round.options?.[vote]}</li>)}</ul>
        </div>}
      </div>}
    </>}
  </section>;
}
