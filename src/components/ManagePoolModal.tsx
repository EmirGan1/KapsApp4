import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  UserPlus,
  UserMinus,
  Crown,
  Users,
  Check,
  AlertTriangle
} from 'lucide-react';
import Avatar from './Avatar';
import { PredictedPoolUser } from '../utils/predictedUtils';

interface CandidateUser {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  inPool: boolean;
}

interface ManagePoolModalProps {
  currentPoolUsers: PredictedPoolUser[];
  onClose: () => void;
  onPoolChanged: () => void;
}

export default function ManagePoolModal({
  currentPoolUsers,
  onClose,
  onPoolChanged
}: ManagePoolModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<CandidateUser[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Search platform users
  const searchUsers = async (q: string) => {
    setLoadingSearch(true);
    try {
      const token = localStorage.getItem('lan_token');
      const res = await fetch(`/api/predicted/search-candidates?q=${encodeURIComponent(q)}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'x-username': 'emirgan'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (e) {
      console.error('Candidate search error:', e);
    } finally {
      setLoadingSearch(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Add user to pool
  const handleAddToPool = async (user: CandidateUser) => {
    setActionLoadingId(user.id);
    try {
      const token = localStorage.getItem('lan_token');
      const res = await fetch('/api/predicted/pool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
          'x-username': 'emirgan'
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (res.ok) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === user.id ? { ...c, inPool: true } : c))
        );
        onPoolChanged();
      }
    } catch (e) {
      alert('Kullanıcı eklenemedi.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Remove user from pool
  const handleRemoveFromPool = async (userId: number) => {
    if (!window.confirm('Bu kullanıcıyı Predicted havuzundan çıkarmak istediğinize emin misiniz?')) {
      return;
    }

    setActionLoadingId(userId);
    try {
      const token = localStorage.getItem('lan_token');
      const res = await fetch(`/api/predicted/pool/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'x-username': 'emirgan'
        }
      });

      if (res.ok) {
        setCandidates((prev) =>
          prev.map((c) => (c.id === userId ? { ...c, inPool: false } : c))
        );
        onPoolChanged();
      }
    } catch (e) {
      alert('Kullanıcı çıkarılamadı.');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 animate-in zoom-in-95"
      >
        {/* HEADER */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
              <Crown size={20} />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                IB Predicted Üye Havuzu Yönetimi
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Yalnızca burada yetki verilen üyeler Predicted alanını görebilir ve puanlanabilir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* SEARCH BOX */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Kullanıcı ara (ad veya ID)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>
        </div>

        {/* BODY (LISTS) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} />
              <span>Arama Sonuçları & Site Üyeleri</span>
            </span>
            <span className="text-[11px] font-bold text-amber-500">
              Havuzda: {currentPoolUsers.length} Kişi
            </span>
          </div>

          {loadingSearch ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Kullanıcılar aranıyor...
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Kriterlere uygun kullanıcı bulunamadı.
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map((u) => {
                const isLoading = actionLoadingId === u.id;
                const isEmirganUser = u.username.toLowerCase() === 'emirgan';

                return (
                  <div
                    key={u.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        url={u.avatar}
                        name={u.username}
                        color={u.color}
                        size={8}
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate block">
                          {u.username}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: #{u.id} {isEmirganUser ? '• Root Admin' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {u.inPool ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-xl text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                            <Check size={12} /> Havuzda
                          </span>
                          {!isEmirganUser && (
                            <button
                              onClick={() => handleRemoveFromPool(u.id)}
                              disabled={isLoading}
                              className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <UserMinus size={12} />
                              <span>Çıkar</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToPool(u)}
                          disabled={isLoading}
                          className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 active:scale-95 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <UserPlus size={13} />
                          <span>Havuza Ekle</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            Tamamla
          </button>
        </div>
      </div>
    </div>
  );
}
