import { useEffect, useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { safeFetchJson } from '../utils/api';
import { createResetTicket, readResetTicket, clearResetTicket, type ResetTicket } from '../utils/passwordReset';
import ResetPasswordView from './ResetPasswordView';

type AuthView = 'FORGOT_REQUEST' | 'WAITING_APPROVAL' | 'SET_NEW_PASSWORD';
export default function ForgotPasswordModal({ isOpen, onClose, initialUsername = '', initialStatus, initialResetToken }: {
  isOpen: boolean; onClose: () => void; initialUsername?: string; initialStatus?: 'PENDING' | 'APPROVED'; initialResetToken?: string;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [view, setView] = useState<AuthView>('FORGOT_REQUEST');
  const [ticket, setTicket] = useState<ResetTicket | null>(null);
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setUsername(initialUsername); setError(''); setNotice('');
    setTicket(readResetTicket(initialUsername)); setToken(initialResetToken || '');
    setView(initialStatus === 'APPROVED' && initialResetToken ? 'SET_NEW_PASSWORD' : initialStatus === 'PENDING' ? 'WAITING_APPROVAL' : 'FORGOT_REQUEST');
  }, [isOpen, initialUsername, initialStatus, initialResetToken]);
  useEffect(() => {
    if (!isOpen || view !== 'WAITING_APPROVAL' || !ticket) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await safeFetchJson(`/api/auth/password-reset-status/${encodeURIComponent(ticket.username)}`, { headers: { 'X-Password-Reset-Key': ticket.requesterKey } });
        if (cancelled) return;
        setError('');
        if (result.status === 'APPROVED' && result.resetToken) { setToken(result.resetToken); setView('SET_NEW_PASSWORD'); return; }
        if (['REJECTED', 'EXPIRED', 'CANCELLED', 'COMPLETED'].includes(result.status)) {
          clearResetTicket(ticket.username); setView('FORGOT_REQUEST');
          setError(result.status === 'REJECTED' ? 'Şifre sıfırlama talebiniz yönetici tarafından reddedildi.' : 'Talep kapanmış veya süresi dolmuş. Gerekirse yeni talep gönderin.'); return;
        }
      } catch (err: any) { if (!cancelled) setError(err.message || 'Durum alınamadı. Yeniden deneniyor.'); }
      if (!cancelled) timer = setTimeout(poll, 3000);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [isOpen, view, ticket]);
  if (!isOpen) return null;
  if (view === 'SET_NEW_PASSWORD' && token && ticket) return <ResetPasswordView token={token} username={ticket.username} requesterKey={ticket.requesterKey}
    onCancel={onClose} onSuccess={() => { clearResetTicket(ticket.username); setToken(''); setView('FORGOT_REQUEST'); setNotice('Şifreniz güncellendi. Giriş ekranından yeni şifrenizle giriş yapın.'); }} />;
  return <div role="dialog" aria-modal="true" aria-labelledby="reset-heading" className="mobile-window fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto p-4 bg-slate-950/80 backdrop-blur-xs">
    <div className="my-auto w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100">
      <h2 id="reset-heading" className="flex items-center gap-2 font-bold text-lg"><KeyRound size={22} />Şifremi Unuttum</h2>
      {view === 'WAITING_APPROVAL' ? <div role="status" className="rounded-2xl p-4 border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 space-y-3">
        <Loader2 className="animate-spin" /><h3 className="font-bold">Şifre Sıfırlama Talebi Gönderildi — Onay Bekleniyor</h3>
        <p className="text-sm leading-relaxed">Talebiniz yöneticiye (emirgan) iletildi. Onaylandığında bu ekran otomatik olarak yeni şifre belirleme ekranına geçer. Sayfadan ayrılırsanız aynı tarayıcıdan geri dönüp giriş ekranında kullanıcı adınızı yazarak devam edebilirsiniz. Tarayıcı verilerinizi silmeyin; başka cihazdan devam etmek için yöneticiyle iletişime geçin.</p>
      </div> : !notice && <form onSubmit={async e => {
        e.preventDefault(); if (busy) return; setBusy(true); setError('');
        try {
          const next = createResetTicket(username); setTicket(next);
          const result = await safeFetchJson('/api/auth/request-password-reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
          if (result.status === 'APPROVED' && result.resetToken) { setToken(result.resetToken); setView('SET_NEW_PASSWORD'); } else setView('WAITING_APPROVAL');
        } catch (err: any) { setError(err.message || 'Talep gönderilemedi.'); } finally { setBusy(false); }
      }} className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">Kullanıcı adınızı girin. Şifreniz, yönetici talebinizi onayladıktan sonra değiştirilebilir.</p>
        <label htmlFor="reset-username" className="block text-sm font-semibold">Kullanıcı Adı</label>
        <input id="reset-username" autoComplete="username" required maxLength={255} value={username} onChange={e => setUsername(e.target.value)} disabled={busy}
          className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 p-3 text-base outline-none focus:ring-2 focus:ring-blue-500" />
        <button disabled={busy || !username.trim()} className="w-full min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white p-3 font-semibold disabled:opacity-50">{busy ? 'Gönderiliyor…' : 'Sıfırlama Talebi Gönder'}</button>
      </form>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300 break-words">{error}</p>}
      <button type="button" onClick={onClose} className="w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 p-3 font-semibold">Giriş Ekranına Dön</button>
    </div>
  </div>;
}
