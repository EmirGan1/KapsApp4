import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { User, Friend } from "../types";
import { 
  Search, UserPlus, Check, Clock, UserRound, UserX, AlertTriangle, 
  Shield, Globe, Phone, MessageSquare, Users, UserCheck, X, Sparkles 
} from "lucide-react";
import { useCall } from "../context/CallContext";
import RoleBadges from "./RoleBadges";
import Avatar from "./Avatar";

interface FriendsProps {
  socket: Socket | null;
  onlineUsers: number[];
  currentUsername: string;
  onUserClick?: (id: number) => void;
  onOpenChat?: (id: number) => void;
}

export default function Friends({ 
  socket, 
  onlineUsers, 
  currentUsername, 
  onUserClick,
  onOpenChat
}: FriendsProps) {
  const { startCall, callState } = useCall();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"all" | "online" | "requests" | "search">("all");

  // Admin delete modal
  const [userToDelete, setUserToDelete] = useState<{ id: number; username: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isEmirgan = currentUsername?.trim().toLowerCase() === "emirgan";

  useEffect(() => {
    if (!socket) return;
    
    const loadFriends = () => {
      socket.emit("get_friends", (data: Friend[]) => setFriends(data || []));
    };

    loadFriends();
    socket.on("friends_updated", loadFriends);
    return () => { socket.off("friends_updated", loadFriends); };
  }, [socket]);

  useEffect(() => {
    if (!socket || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      socket.emit("search_users", searchQuery.trim(), (results: User[]) => {
        setSearchResults((results || []).filter(r => r.username.toLowerCase() !== currentUsername.toLowerCase()));
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, socket, currentUsername]);

  const handleAddFriend = (id: number) => {
    socket?.emit("add_friend", id, () => {
      socket.emit("get_friends", (data: Friend[]) => setFriends(data || []));
      setSearchQuery("");
    });
  };

  const handleAccept = (id: number) => {
    socket?.emit("accept_friend", id, () => {
      socket.emit("get_friends", (data: Friend[]) => setFriends(data || []));
    });
  };

  const handleConfirmDeleteUser = () => {
    if (!userToDelete || !socket) return;
    setIsDeleting(true);
    socket.emit("admin_delete_user", { userId: userToDelete.id }, (res: any) => {
      setIsDeleting(false);
      if (res?.error) {
        alert(res.error);
      } else {
        alert("Kullanıcı başarıyla silindi.");
        setSearchResults(prev => prev.filter(u => u.id !== userToDelete.id));
        setFriends(prev => prev.filter(f => f.id !== userToDelete.id));
        setUserToDelete(null);
      }
    });
  };

  const pendingRequests = friends.filter(f => f.status === 0 && !f.is_sender);
  const sentRequests = friends.filter(f => f.status === 0 && f.is_sender);
  const acceptedFriends = friends.filter(f => f.status === 1);
  const onlineFriends = acceptedFriends.filter(f => onlineUsers.includes(f.id));

  // Determine list to show
  const filteredFriends = activeSubTab === "online" 
    ? onlineFriends 
    : acceptedFriends;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50 dark:bg-slate-950 transition-colors duration-200 touch-pan-y overscroll-y-contain">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Top Header & Search Box */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-colors duration-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <span>Arkadaşlar</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Arkadaşlarını yönet, yeni kişiler ekle ve doğrudan iletişime geç.
              </p>
            </div>

            {/* Quick Stats Badges */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-3 py-1 bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{onlineFriends.length} Çevrimiçi</span>
              </span>
              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 rounded-full text-xs font-bold">
                {acceptedFriends.length} Arkadaş
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Kullanıcı adı yazarak yeni arkadaş ara veya filtrele..."
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                if (e.target.value.trim() && activeSubTab !== "search") {
                  setActiveSubTab("search");
                }
              }}
              className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-2xl border border-slate-200 dark:border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 shadow-inner transition-colors text-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setActiveSubTab("all");
                }}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-bold pt-1">
            <button
              onClick={() => setActiveSubTab("all")}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSubTab === "all"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                  : "bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Users size={14} />
              <span>Tümü ({acceptedFriends.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("online")}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeSubTab === "online"
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/25"
                  : "bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Çevrimiçi ({onlineFriends.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab("requests")}
              className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 relative ${
                activeSubTab === "requests"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                  : "bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              <UserCheck size={14} />
              <span>İstekler</span>
              {pendingRequests.length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </button>

            {searchQuery && (
              <button
                onClick={() => setActiveSubTab("search")}
                className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeSubTab === "search"
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                    : "bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <Search size={14} />
                <span>Arama Sonuçları ({searchResults.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Results Dropdown/Card */}
        {searchQuery.trim() && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between px-1">
              <span>Arama Sonuçları ("{searchQuery}")</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                {searchResults.length} kişi bulundu
              </span>
            </h3>

            {searchResults.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400 text-sm">
                "{searchQuery}" adında bir kullanıcı bulunamadı.
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden transition-colors">
                {searchResults.map(user => {
                  const friendRecord = friends.find(f => f.id === user.id);
                  const isAlreadyFriend = friendRecord?.status === 1;
                  const isRequestPending = friendRecord?.status === 0;

                  return (
                    <div 
                      key={user.id} 
                      className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                    >
                      <div 
                        className="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1" 
                        onClick={() => onUserClick && onUserClick(user.id)}
                      >
                        <Avatar 
                          url={user.avatar} 
                          name={user.username} 
                          color={user.color} 
                          size={11} 
                          className="border border-slate-200 dark:border-slate-700 shadow-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                              {user.username}
                            </span>
                            <RoleBadges roles={user.roles} size="sm" />
                          </div>
                          {isEmirgan && (user.last_ip || user.signup_ip) && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              <Globe size={11} className="text-blue-500 shrink-0" />
                              <span>IP: {user.last_ip || user.signup_ip}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isAlreadyFriend ? (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-full border border-emerald-200 dark:border-emerald-900/60">
                            Arkadaş
                          </span>
                        ) : isRequestPending ? (
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 rounded-full border border-amber-200 dark:border-amber-900/60 flex items-center gap-1">
                            <Clock size={12} />
                            <span>İstek Bekliyor</span>
                          </span>
                        ) : (
                          <button 
                            onClick={() => handleAddFriend(user.id)} 
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-blue-500/20 active:scale-95 cursor-pointer"
                          >
                            <UserPlus size={14} />
                            <span>Arkadaş Ekle</span>
                          </button>
                        )}

                        {onOpenChat && (
                          <button
                            onClick={() => onOpenChat(user.id)}
                            className="p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                            title="Mesaj Gönder"
                          >
                            <MessageSquare size={16} />
                          </button>
                        )}

                        {isEmirgan && (
                          <button
                            onClick={() => setUserToDelete({ id: user.id, username: user.username })}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                            title="Kullanıcıyı Sil / Banla (Yönetici)"
                          >
                            <UserX size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Requests Section (Shown when Requests tab is active or whenever pending exist) */}
        {(activeSubTab === "requests" || (pendingRequests.length > 0 && activeSubTab === "all")) && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2 px-1">
              <UserCheck size={16} className="text-indigo-500" />
              <span>Gelen Arkadaşlık İstekleri</span>
              {pendingRequests.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {pendingRequests.length}
                </span>
              )}
            </h3>

            {pendingRequests.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400 text-sm">
                Bekleyen gelen istek bulunmuyor.
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden transition-colors">
                {pendingRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <div 
                      className="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1"
                      onClick={() => onUserClick && onUserClick(req.id)}
                    >
                      <Avatar 
                        url={req.avatar} 
                        name={req.username} 
                        color={req.color} 
                        size={11} 
                        className="border border-slate-200 dark:border-slate-700 shadow-xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{req.username}</span>
                          <RoleBadges roles={req.roles} size="sm" />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Sana arkadaşlık isteği gönderdi</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button 
                        onClick={() => handleAccept(req.id)} 
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-emerald-500/20 active:scale-95 cursor-pointer"
                      >
                        <Check size={15} /> Kabul Et
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sent Requests (if in requests tab) */}
        {activeSubTab === "requests" && sentRequests.length > 0 && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2 px-1">
              <Clock size={16} className="text-amber-500" />
              <span>Gönderilen İstekler (Yanıt Bekleniyor)</span>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {sentRequests.length}
              </span>
            </h3>

            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 overflow-hidden transition-colors">
              {sentRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <div 
                    className="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1"
                    onClick={() => onUserClick && onUserClick(req.id)}
                  >
                    <Avatar 
                      url={req.avatar} 
                      name={req.username} 
                      color={req.color} 
                      size={11} 
                      className="border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{req.username}</span>
                        <RoleBadges roles={req.roles} size="sm" />
                      </div>
                      <span className="text-xs text-amber-600 dark:text-amber-400">İstek gönderildi, onay bekleniyor</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends Grid List (All or Online) */}
        {(activeSubTab === "all" || activeSubTab === "online") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>{activeSubTab === "online" ? "Çevrimiçi Arkadaşlar" : "Arkadaş Listen"}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {filteredFriends.length} Kişi
                </span>
              </h3>
            </div>

            {filteredFriends.length === 0 ? (
              <div className="text-center p-12 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3 shadow-sm transition-colors">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                  <Users size={28} />
                </div>
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {activeSubTab === "online" ? "Şu an çevrimiçi arkadaşın yok" : "Henüz arkadaş eklemedin"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Yukarıdaki arama çubuğunu kullanarak sınıf arkadaşlarını arayıp arkadaşlık isteği gönderebilirsin.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredFriends.map(friend => {
                  const isOnline = onlineUsers.includes(friend.id);
                  return (
                    <div 
                      key={friend.id} 
                      className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200"
                    >
                      <div 
                        className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0" 
                        onClick={() => onUserClick && onUserClick(friend.id)}
                      >
                        <div className="relative shrink-0">
                          <Avatar 
                            url={friend.avatar} 
                            name={friend.username} 
                            color={friend.color} 
                            size={12} 
                            className="border border-slate-200 dark:border-slate-700 shadow-xs"
                          />
                          {isOnline ? (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-xs"></div>
                          ) : (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-slate-400 dark:bg-slate-600 border-2 border-white dark:border-slate-900 rounded-full shadow-xs"></div>
                          )}
                        </div>

                        <div className="truncate min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate">
                              {friend.username}
                            </h4>
                            <RoleBadges roles={friend.roles} size="sm" />
                          </div>
                          
                          <p className={`text-[11px] font-medium flex items-center gap-1 mt-0.5 ${
                            isOnline ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'}`}></span>
                            <span>{isOnline ? "Çevrimiçi" : "Çevrimdışı"}</span>
                          </p>

                          {isEmirgan && (friend.last_ip || friend.signup_ip) && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              <Globe size={10} className="text-blue-500 shrink-0" />
                              <span className="truncate">IP: {friend.last_ip || friend.signup_ip}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {onOpenChat && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenChat(friend.id);
                            }}
                            className="p-2 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-all cursor-pointer active:scale-95"
                            title="Mesaj Gönder"
                          >
                            <MessageSquare size={17} />
                          </button>
                        )}

                        {isOnline && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startCall(friend.id);
                            }}
                            disabled={callState !== 'idle'}
                            className={`p-2 rounded-xl transition-all cursor-pointer ${
                              callState !== 'idle'
                                ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:scale-95'
                            }`}
                            title="Hemen Sesli Ara"
                          >
                            <Phone size={17} />
                          </button>
                        )}

                        {isEmirgan && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserToDelete({ id: friend.id, username: friend.username });
                            }}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer shrink-0"
                            title="Kullanıcıyı Sil / Banla (Yönetici)"
                          >
                            <UserX size={17} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Admin Delete User Modal in Friends */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 rounded-2xl shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Kullanıcıyı Sil / Banla</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Yönetici Yetkisi (emirgan)</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-900 dark:text-white font-bold">"{userToDelete.username}"</strong> adlı kullanıcının hesabını ve tüm verilerini kalıcı olarak silmek üzeresiniz. Bu işlem geri alınamaz!
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDeleteUser}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold transition-colors cursor-pointer shadow-md shadow-rose-600/25"
              >
                {isDeleting ? "Siliniyor..." : "Evet, Kalıcı Olarak Sil"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
