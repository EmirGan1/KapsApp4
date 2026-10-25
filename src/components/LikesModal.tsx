import React, { useState, useEffect } from 'react';
import { 
  X, 
  Heart, 
  Search, 
  User as UserIcon, 
  Sparkles, 
  Loader2, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import Avatar from './Avatar';
import { getApiUrl, getAuthHeaders } from '../utils/api';

export interface LikedUserItem {
  id?: number;
  user_id: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  roles?: string | null;
  is_admin?: boolean;
}

interface LikesModalProps {
  isOpen: boolean;
  onClose: () => void;
  postId: number | string | null;
  initialCount?: number;
  onUserClick?: (userId: number) => void;
}

export const LikesModal: React.FC<LikesModalProps> = ({
  isOpen,
  onClose,
  postId,
  initialCount = 0,
  onUserClick
}) => {
  const [users, setUsers] = useState<LikedUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !postId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setSearchQuery('');

    const fetchLikes = async () => {
      try {
        const res = await fetch(getApiUrl(`/api/posts/${postId}/likes`), {
          headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error("Beğenenler yüklenemedi");
        const data = await res.json();
        if (isMounted) {
          const list = Array.isArray(data) ? data : (data.likes || []);
          const normalized: LikedUserItem[] = list.map((item: any) => ({
            id: item.id,
            user_id: item.user_id || item.id,
            username: item.username || item.name || "Kullanıcı",
            avatar: item.avatar || item.avatarUrl || null,
            color: item.color || null,
            roles: typeof item.roles === "string" ? item.roles : (item.role || (item.roles ? JSON.stringify(item.roles) : null)),
            is_admin: !!item.is_admin
          }));
          setUsers(normalized);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Beğenenler listesi yüklenemedi.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLikes();

    return () => {
      isMounted = false;
    };
  }, [isOpen, postId]);

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) =>
    (u.username || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div 
      className="mobile-window fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-sm sm:max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 dark:text-rose-400 flex items-center justify-center shadow-inner">
              <Heart className="w-4 h-4 fill-rose-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Beğenenler</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 text-[10px] font-black">
                  {loading ? (initialCount || 0) : users.length}
                </span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar (if 4 or more users) */}
        {users.length >= 4 && (
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Beğenenlerde ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-3 overflow-y-auto flex-1 scrollbar-thin space-y-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
              <p className="text-xs font-medium">Beğenenler getiriliyor...</p>
            </div>
          ) : error ? (
            <div className="py-10 text-center text-xs text-rose-500 dark:text-rose-400">
              {error}
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600 mb-1">
                <Heart className="w-6 h-6 stroke-1" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Henüz beğeni yok</p>
              <p className="text-xs max-w-[200px]">Bu gönderiyi ilk beğenen sen olabilirsin!</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              "{searchQuery}" ile eşleşen kullanıcı bulunamadı.
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isEmirgan = user.username?.trim().toLowerCase() === 'emirgan';
              return (
                <div
                  key={user.id || user.user_id}
                  onClick={() => {
                    if (onUserClick) {
                      onUserClick(user.user_id);
                      onClose();
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-2xl transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 group ${
                    onUserClick ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      url={user.avatar || undefined}
                      name={user.username}
                      color={user.color || undefined}
                      size={10}
                      className="shrink-0 ring-1 ring-slate-200/60 dark:ring-slate-700/60"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                          {user.username}
                        </span>
                        {(isEmirgan || user.is_admin) && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-extrabold flex items-center gap-0.5 shrink-0">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            <span>Yönetici</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        {isEmirgan ? "Kurucu & Baş Yönetici" : "KapsApp Öğrencisi"}
                      </p>
                    </div>
                  </div>

                  {onUserClick && (
                    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
          <span>KapsApp Topluluk Etkileşimi</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};

export default LikesModal;
