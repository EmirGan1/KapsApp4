import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { safeFetchJson } from '../utils/api';

type ResetRequest = { id: string; user_id: number; username: string; requested_at: string; status: string };
export function PasswordResetActions({ requestId, status = 'PENDING', onDone }: { requestId: string; status?: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(status);
  const [error, setError] = useState('');
  useEffect(() => setResult(status), [status]);
  const decide = async (decision: 'APPROVE' | 'REJECT') => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const data = await safeFetchJson('/api/admin/password-reset/decide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId, decision }) });
      setResult(data.status); onDone?.();
    } catch (err: any) { setError(err.message || 'Karar kaydedilemedi.'); onDone?.(); } finally { setBusy(false); }
  };
  return <div onClick={e => e.stopPropagation()} className="space-y-2 mt-3">
    {result === 'PENDING' ? <>
      <p className="text-xs text-slate-600 dark:text-slate-300">Onaylamadan önce talebi gönderen kişinin hesap sahibi olduğunu uygulama dışından doğrulayın.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => decide('APPROVE')} className="min-h-11 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50">Onayla</button>
        <button type="button" disabled={busy} onClick={() => decide('REJECT')} className="min-h-11 px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-semibold text-sm disabled:opacity-50">Reddet</button>
      </div>
    </> : <p role="status" className="text-sm font-semibold text-slate-700 dark:text-slate-200">{result === 'APPROVED' ? '✅ Onaylandı' : result === 'REJECTED' ? '❌ Reddedildi' : 'Talep kapandı'}</p>}
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  </div>;
}
export default function PasswordResetRequests({ socket }: { socket: Socket | null }) {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [error, setError] = useState('');
  const fetchRequests = useCallback(async () => {
    try { const data = await safeFetchJson('/api/admin/password-reset/requests'); setRequests(data.requests); setError(''); }
    catch (err: any) { setError(err.message || 'Talepler yüklenemedi.'); }
  }, []);
  useEffect(() => {
    void fetchRequests();
    const timer = setInterval(() => { void fetchRequests(); }, 15000);
    socket?.on('password_reset_updated', fetchRequests);
    return () => { clearInterval(timer); socket?.off('password_reset_updated', fetchRequests); };
  }, [socket, fetchRequests]);
  return <section aria-label="Bekleyen Şifre Sıfırlama Talepleri" className="rounded-2xl p-4 sm:p-5 border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 space-y-3">
    <h2 className="font-bold text-base">🔑 Bekleyen Şifre Sıfırlama Talepleri ({requests.length})</h2>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    {!requests.length && !error && <p className="text-sm text-slate-500 dark:text-slate-400">Bekleyen talep yok.</p>}
    {requests.map(request => <div key={request.id} className="border-t border-slate-200 dark:border-slate-700 pt-3 break-words">
      <p className="font-semibold">@{request.username}</p><time className="text-xs text-slate-500 dark:text-slate-400">{new Date(request.requested_at).toLocaleString('tr-TR')}</time>
      <PasswordResetActions requestId={request.id} status={request.status} onDone={fetchRequests} />
    </div>)}
  </section>;
}
