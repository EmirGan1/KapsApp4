import UserProfileLink from "./UserProfileLink";
import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Search, PhoneCall, Check, X, Users, Loader2 } from 'lucide-react';
import Avatar from './Avatar';
import { callSoundEngine } from '../utils/callSoundEngine';

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
  const [invitedMap, setInvitedMap] = useState<Record<number, 'ringing' | 'accepted' | 'rejected'>>({});

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

    const handleResponse = (data: { accepted: boolean; roomId: string; responder?: { id: number; username: string } }) => {
      if (data?.responder?.id) {
        setInvitedMap(prev => ({
          ...prev,
          [data.responder!.id]: data.accepted ? 'accepted' : 'rejected'
        }));
      }
    };

    socket.on("voice:invite_response", handleResponse);
    return () => {
      socket.off("voice:invite_response", handleResponse);
    };
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

  const handleRingUser = (targetUser: UserItem) => {
    if (!socket || invitedMap[targetUser.id] === 'ringing') return;
    setInvitedMap(prev => ({ ...prev, [targetUser.id]: 'ringing' }));
    callSoundEngine.playConnectTone();
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
    <div className="mobile-window fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl max-w-md w-full text-slate-900 dark:text-slate-100 flex flex-col max-h-[85dvh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <PhoneCall size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Odaya Davet Et / Çaldır
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                {roomName} • Telefona arama gönderir
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
              placeholder="Çaldırmak istediğin arkadaşı ara..."
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
              <p className="text-xs">Aranacak kullanıcı bulunamadı.</p>
            </div>
          ) : (
            filtered.map((u) => {
              const status = invitedMap[u.id];
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={u.username} url={u.avatar} size={10} color={u.color || '#3b82f6'} />
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate text-slate-800 dark:text-slate-200">
                        <UserProfileLink beforeNavigate={onClose} username={u.username} user={u} />
                      </p>
                      {u.isOnline ? (
                        <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Çevrimiçi
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">
                          Uygulama dışı (Telefonu çaldırılır)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid={`voice-ring-user-${u.id}`}
                    onClick={() => handleRingUser(u)}
                    disabled={status === 'ringing' || status === 'accepted'}
                    className={`min-h-[40px] px-3.5 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                      status === 'accepted'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 cursor-default'
                        : status === 'ringing'
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 cursor-default animate-pulse'
                        : status === 'rejected'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-600/20'
                    }`}
                  >
                    {status === 'accepted' ? (
                      <>
                        <Check size={14} />
                        <span>Katıldı</span>
                      </>
                    ) : status === 'ringing' ? (
                      <>
                        <PhoneCall size={14} className="animate-bounce" />
                        <span>Çaldırılıyor...</span>
                      </>
                    ) : status === 'rejected' ? (
                      <>
                        <PhoneCall size={14} />
                        <span>Tekrar Çaldır</span>
                      </>
                    ) : (
                      <>
                        <PhoneCall size={14} />
                        <span>Çaldır</span>
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
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};

export default VoiceInviteModal;
