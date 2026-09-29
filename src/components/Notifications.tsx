import { useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { 
  Bell, MessageSquare, UserPlus, UserCheck, Heart, MessageCircle, Users, CheckCheck, Sparkles, Layers 
} from "lucide-react";
import { AppNotification } from "../types";

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-blue-600 dark:text-blue-400" />
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100">Bildirimler</h2>
          {unreadCount > 0 && (
            <span className="text-xs font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full shadow-xs">
              {unreadCount} yeni
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-3 py-1.5 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
          >
            <CheckCheck size={15} />
            <span>Tümünü Okundu Say</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5 max-w-3xl mx-auto w-full touch-pan-y overscroll-y-contain">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs">Bildirimler yükleniyor...</p>
          </div>
        ) : stackedNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <div className="w-14 h-14 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
              <Sparkles size={24} className="text-slate-300 dark:text-slate-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Henüz bildirim yok</p>
              <p className="text-xs text-slate-400 mt-0.5">Arkadaşlık istekleri, mesajlar ve beğeniler burada görünür.</p>
            </div>
          </div>
        ) : (
          stackedNotifications.map((stack) => (
            <div
              key={stack.key}
              onClick={() => handleStackedItemClick(stack)}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 shadow-xs hover:shadow-md relative ${
                stack.unreadCount > 0
                  ? "bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-900/50 ring-1 ring-blue-500/20"
                  : "bg-white/80 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800/80 hover:bg-white dark:hover:bg-slate-900"
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
                      <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-full shrink-0 flex items-center gap-1">
                        <Layers size={11} />
                        {stack.count}
                      </span>
                    )}
                  </div>
                  {stack.unreadCount > 0 && (
                    <span className="w-2.5 h-2.5 bg-blue-600 rounded-full shrink-0 shadow-sm shadow-blue-500/50"></span>
                  )}
                </div>

                {stack.preview && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1 italic">
                    {stack.preview}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(stack.created_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline">
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
