import { useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { 
  Bell, MessageSquare, UserPlus, UserCheck, Heart, MessageCircle, Users, CheckCheck, Sparkles, Layers 
} from "lucide-react";
import { AppNotification } from "../types";
import { PasswordResetActions } from "./PasswordResetRequests";

function resetMetadata(value?: string | null) {
  try { return JSON.parse(value || "null"); } catch { return null; }
}

interface StackedNotification {
  key: string;
  type: string;
  sender_id?: number;
  target_id?: number;
  count: number;
  unreadCount: number;
  items: AppNotification[];
  latestItem: AppNotification;
  title: string;
  preview?: string;
  created_at: string;
}

export default function Notifications({
  socket,
  onNotificationClick,
}: {
  socket: Socket | null;
  onNotificationClick?: (notif: AppNotification) => void;
}) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    if (!socket) return;
    socket.emit("get_notifications", (data: AppNotification[]) => {
      // Filter out any legacy approval notifications so they never pollute the general notifications UI
      const regularNotifs = (data || []).filter(n => n.type !== 'user_approval_request');
      setNotifications(regularNotifs);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (!socket) return;

    fetchNotifications();

    const onNewNotification = (notif: AppNotification) => {
      if (notif.type === 'user_approval_request') return; // Ignore in general notifications
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
    };

    const onNotificationsUpdated = () => {
      fetchNotifications();
    };

    socket.on("new_notification", onNewNotification);
    socket.on("notifications_updated", onNotificationsUpdated);

    return () => {
      socket.off("new_notification", onNewNotification);
      socket.off("notifications_updated", onNotificationsUpdated);
    };
  }, [socket]);

  const handleMarkAllRead = () => {
    if (!socket) return;
    socket.emit("mark_notifications_read");
    setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
  };

  // Notification Stacking: Group notifications by type + sender/target
  const stackedNotifications = useMemo(() => {
    const stackMap = new Map<string, StackedNotification>();

    for (const notif of notifications) {
      let groupKey = `${notif.type}_${notif.id}`;
      
      if (notif.type === "new_message" || notif.type === "dm") {
        groupKey = `dm_${notif.sender_id || 'unknown'}`;
      } else if (notif.type === "like" && notif.target_id) {
        groupKey = `like_${notif.target_id}`;
      } else if (notif.type === "comment" && notif.target_id) {
        groupKey = `comment_${notif.target_id}`;
      } else if (notif.type === "new_group_message" && notif.target_id) {
        groupKey = `grp_msg_${notif.target_id}`;
      }

      const existing = stackMap.get(groupKey);
      if (existing) {
        existing.count += 1;
        if (!notif.read) existing.unreadCount += 1;
        existing.items.push(notif);
        // keep newest as latestItem
        if (new Date(notif.created_at).getTime() > new Date(existing.latestItem.created_at).getTime()) {
          existing.latestItem = notif;
          existing.created_at = notif.created_at;
        }
      } else {
        stackMap.set(groupKey, {
          key: groupKey,
          type: notif.type,
          sender_id: notif.sender_id ?? undefined,
          target_id: notif.target_id ?? undefined,
          count: 1,
          unreadCount: notif.read ? 0 : 1,
          items: [notif],
          latestItem: notif,
          title: notif.content,
          created_at: notif.created_at,
        });
      }
    }

    // Format display title & previews for stacked items
    return Array.from(stackMap.values()).map(stack => {
      const { type, count, latestItem, items } = stack;
      
      if (type === "new_message" || type === "dm") {
        const colonIdx = latestItem.content.indexOf(":");
        const senderName = colonIdx !== -1 ? latestItem.content.substring(0, colonIdx).trim() : "Bir kullanıcı";
        const preview = colonIdx !== -1 ? latestItem.content.substring(colonIdx + 1).trim() : latestItem.content;
        
        if (count > 1) {
          stack.title = `${senderName} sana ${count} yeni mesaj gönderdi`;
          stack.preview = `Son mesaj: "${preview}"`;
        } else {
          stack.title = latestItem.content;
          stack.preview = undefined;
        }
      } else if (type === "like") {
        const firstColon = latestItem.content.indexOf(" ");
        const firstSender = firstColon !== -1 ? latestItem.content.substring(0, firstColon) : "Bir kullanıcı";
        if (count > 1) {
          stack.title = `${firstSender} ve ${count - 1} kişi daha gönderini beğendi`;
          stack.preview = "Gönderin kullanıcılar arasında etkileşim alıyor";
        } else {
          stack.title = latestItem.content;
          stack.preview = undefined;
        }
      } else if (type === "comment") {
        const firstColon = latestItem.content.indexOf(" ");
        const firstSender = firstColon !== -1 ? latestItem.content.substring(0, firstColon) : "Bir kullanıcı";
        if (count > 1) {
          stack.title = `${firstSender} gönderine ${count} yorum yaptı`;
          stack.preview = `Son yorum: "${latestItem.content}"`;
        } else {
          stack.title = latestItem.content;
          stack.preview = undefined;
        }
      }

      return stack;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [notifications]);

  const handleStackedItemClick = (stack: StackedNotification) => {
    // Mark all items in the stack as read
    if (socket) {
      stack.items.forEach(item => {
        if (!item.read) {
          socket.emit("mark_single_notification_read", item.id);
        }
      });
    }

    setNotifications((prev) =>
      prev.map((n) => stack.items.some(i => i.id === n.id) ? { ...n, read: 1 } : n)
    );

    if (onNotificationClick) {
      onNotificationClick(stack.latestItem);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "new_message":
      case "dm":
        return (
          <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl shrink-0 shadow-xs">
            <MessageSquare size={18} />
          </div>
        );
      case "like":
        return (
          <div className="p-2.5 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl shrink-0 shadow-xs">
            <Heart size={18} className="fill-rose-500 text-rose-500" />
          </div>
        );
      case "comment":
        return (
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl shrink-0 shadow-xs">
            <MessageCircle size={18} />
          </div>
        );
      case "follow":
      case "friend_request":
        return (
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0 shadow-xs">
            <UserPlus size={18} />
          </div>
        );
      case "friend_accept":
        return (
          <div className="p-2.5 bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 rounded-xl shrink-0 shadow-xs">
            <UserCheck size={18} />
          </div>
        );
      case "new_group_message":
      case "group_invite":
        return (
          <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl shrink-0 shadow-xs">
            <Users size={18} />
          </div>
        );
      default:
        return (
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl shrink-0 shadow-xs">
            <Bell size={18} />
          </div>
        );
    }
  };

  const [categoryFilter, setCategoryFilter] = useState<"all" | "messages" | "social" | "system">("all");

  const unreadCount = notifications.filter((n) => !n.read).length;

  const filteredStacks = useMemo(() => {
    if (categoryFilter === "all") return stackedNotifications;
    if (categoryFilter === "messages") {
      return stackedNotifications.filter(s => s.type === "new_message" || s.type === "dm" || s.type === "new_group_message");
    }
    if (categoryFilter === "social") {
      return stackedNotifications.filter(s => s.type === "like" || s.type === "comment" || s.type === "follow" || s.type === "friend_request" || s.type === "friend_accept");
    }
    if (categoryFilter === "system") {
      return stackedNotifications.filter(s => s.type === "PASSWORD_RESET_REQUEST" || s.type === "system" || (s.type !== "new_message" && s.type !== "dm" && s.type !== "like" && s.type !== "comment" && s.type !== "friend_request"));
    }
    return stackedNotifications;
  }, [stackedNotifications, categoryFilter]);

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs z-10 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Bell size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                  Bildirimler
                </h2>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  · {unreadCount > 0 ? `${unreadCount} yeni` : "Tümü okundu"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mesajlar, etkileşimler ve hesap güncellemeleri
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer shrink-0"
            >
              <CheckCheck size={15} />
              <span>Tümünü Okundu Say</span>
            </button>
          )}
        </div>

        {/* Filter Sub-Tabs */}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "Tümü" },
            { id: "messages", label: "Mesajlar" },
            { id: "social", label: "Beğeni & Yorum" },
            { id: "system", label: "Sistem & Güvenlik" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === tab.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-2.5 max-w-3xl mx-auto w-full touch-pan-y overscroll-y-contain">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Bildirimler yükleniyor...</p>
          </div>
        ) : filteredStacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <div className="w-14 h-14 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl flex items-center justify-center shadow-xs">
              <Sparkles size={24} className="text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {categoryFilter === "all" ? "Henüz bildirim yok" : "Bu kategoride bildirim bulunmuyor"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Arkadaşlık istekleri, mesajlar ve beğeniler anlık olarak burada görünür.
              </p>
            </div>
          </div>
        ) : (
          filteredStacks.map((stack) => (
            <div
              key={stack.key}
              onClick={() => handleStackedItemClick(stack)}
              className={`p-3.5 sm:p-4 rounded-3xl border transition-all cursor-pointer flex items-start gap-3.5 shadow-xs hover:shadow-md relative ${
                stack.unreadCount > 0
                  ? "bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/50 ring-1 ring-blue-500/20"
                  : "bg-white dark:bg-slate-900/70 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              {getIcon(stack.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className={`text-sm ${stack.unreadCount > 0 ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'} leading-snug truncate`}>
                      {stack.title}
                    </p>
                    {stack.count > 1 && (
                      <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 shrink-0 tabular-nums">
                        · {stack.count}x
                      </span>
                    )}
                  </div>
                  {stack.unreadCount > 0 && (
                    <span className="w-2 h-2 bg-blue-600 rounded-full shrink-0 shadow-xs"></span>
                  )}
                </div>

                {stack.type === 'PASSWORD_RESET_REQUEST' && resetMetadata(stack.latestItem.metadata)?.requestId && (
                  <PasswordResetActions requestId={resetMetadata(stack.latestItem.metadata).requestId}
                    status={resetMetadata(stack.latestItem.metadata).status} onDone={fetchNotifications} />
                )}

                {stack.preview && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 italic">
                    {stack.preview}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-slate-500">
                  <span className="tabular-nums text-[11px]">
                    {new Date(stack.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span>·</span>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">
                    Görüntüle →
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
