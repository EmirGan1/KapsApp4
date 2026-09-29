import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Search, UserPlus, Check, X, Users, Loader2 } from 'lucide-react';
import Avatar from './Avatar';

interface VoiceInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  socket: Socket | null;
  currentUserId: number;
}

interface UserItem {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  isOnline?: boolean;
}

export const VoiceInviteModal: React.FC<VoiceInviteModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomName,
  socket,
  currentUserId
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [invitedMap, setInvitedMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!isOpen || !socket) return;
    setIsLoading(true);
    socket.emit("get_friends", (friendsData: any[]) => {
      if (Array.isArray(friendsData)) {
        const friendUsers = friendsData.map(f => ({
          id: f.id,
          username: f.username,
          avatar: f.avatar,
          color: f.color,
          isOnline: f.isOnline
        }));
        setUsers(friendUsers);
      }
      setIsLoading(false);
    });
  }, [isOpen, socket]);

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim() || !socket) return;
    socket.emit("search_users", q.trim(), (results: any[]) => {
      if (Array.isArray(results)) {
        setUsers(results.filter(u => u.id !== currentUserId));
      }
    });
  };

  const handleInvite = (targetUser: UserItem) => {
    if (!socket || invitedMap[targetUser.id]) return;
    setInvitedMap(prev => ({ ...prev, [targetUser.id]: true }));
    socket.emit("voice:invite_user", {
      targetUserId: targetUser.id,
      roomId,
      roomName
    });
  };

  if (!isOpen) return null;

  const filtered = users.filter(u => 
    u.id !== currentUserId && 
    (u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl max-w-md w-full text-slate-900 dark:text-slate-100 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Kullanıcı Davet Et</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                Oda: {roomName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Box */}
        <div className="pt-4 pb-2">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Kullanıcı adına göre ara..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full min-h-[44px] pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto py-2 space-y-2 min-h-[220px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
              <Loader2 size={24} className="animate-spin text-blue-500" />
              <p className="text-xs">Kullanıcılar yükleniyor...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2 text-center">
              <Users size={32} className="text-slate-300 dark:text-slate-600" />
              <p className="text-xs">Davet edilecek kullanıcı bulunamadı.</p>
            </div>
          ) : (
            filtered.map((u) => {
              const isInvited = !!invitedMap[u.id];
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={u.username} url={u.avatar} size={10} color={u.color || '#3b82f6'} />
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate text-slate-800 dark:text-slate-200">
                        {u.username}
                      </p>
                      {u.isOnline && (
                        <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Çevrimiçi
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleInvite(u)}
                    disabled={isInvited}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 shadow-xs ${
                      isInvited
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 cursor-default'
                        : 'bg-blue-600 hover:bg-blue-500 active:scale-95 text-white shadow-blue-500/20'
                    }`}
                  >
                    {isInvited ? (
                      <>
                        <Check size={14} />
                        <span>Davet Edildi</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} />
                        <span>Davet Gönder</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};

export default VoiceInviteModal;
