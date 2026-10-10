import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Socket } from "socket.io-client";
import { Globe, Send, ArrowRight, CheckCircle2 } from "lucide-react";
import Avatar from "./Avatar";

export interface MiniChatMessage {
  id: number | string;
  sender?: number | string;
  sender_name?: string;
  username?: string;
  sender_avatar?: string | null;
  avatar?: string | null;
  sender_color?: string;
  color?: string;
  content: string;
  created_at?: string;
  timestamp?: number | string;
}

interface MiniChatWidgetProps {
  socket: Socket | null;
  currentUserId?: number;
  currentUsername?: string;
  onNavigateChat?: () => void;
  className?: string;
}

export default function MiniChatWidget({
  socket,
  currentUserId,
  currentUsername,
  onNavigateChat,
  className = ""
}: MiniChatWidgetProps) {
  const [messages, setMessages] = useState<MiniChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  useEffect(() => {
    if (!socket) return;

    // 1. Join standard rooms (both 'general' and 'global' for full parity)
    socket.emit("join_room", "general");
    socket.emit("join_room", "global");

    // 2. Fetch initial messages
    socket.emit("get_global_messages", (initialMsgs: any[]) => {
      if (Array.isArray(initialMsgs)) {
        setMessages(initialMsgs.slice(-5));
        setTimeout(scrollToBottom, 100);
      }
    });

    // 3. New message listener (supporting both 'new_global_message', 'chat:message', 'global_message')
    const handleNewMessage = (msg: any) => {
      if (!msg || !msg.content) return;

      setMessages((prev) => {
        // Prevent duplicate messages
        const msgId = String(msg.id || `${msg.sender}_${msg.created_at || Date.now()}`);
        if (prev.some((m) => String(m.id) === msgId)) {
          return prev;
        }
        const updated = [...prev, msg].slice(-10); // Keep last few in memory, displaying son 2-3
        return updated;
      });

      // Increment unread count if message is from another user
      const isFromMe = (currentUserId && Number(msg.sender) === currentUserId) || 
                       (currentUsername && (msg.sender_name === currentUsername || msg.username === currentUsername));
      
      if (!isFromMe) {
        setUnreadCount((c) => c + 1);
      }

      setTimeout(scrollToBottom, 50);
    };

    socket.on("new_global_message", handleNewMessage);
    socket.on("chat:message", handleNewMessage);
    socket.on("global_message", handleNewMessage);

    return () => {
      socket.off("new_global_message", handleNewMessage);
      socket.off("chat:message", handleNewMessage);
      socket.off("global_message", handleNewMessage);
    };
  }, [socket, currentUserId, currentUsername]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || isSending) return;

    const text = inputText.trim();
    setIsSending(true);

    const payload = {
      type: "text",
      content: text,
      client_id: Date.now().toString(),
      timestamp: Date.now()
    };

    // Emit via standard events
    socket.emit("send_global_message", payload, () => {
      setIsSending(false);
      setInputText("");
      setTimeout(scrollToBottom, 50);
    });

    // Fallback timer if callback not triggered
    setTimeout(() => {
      setIsSending(false);
      setInputText("");
    }, 600);
  };

  const handleGoToChat = () => {
    setUnreadCount(0);
    onNavigateChat?.();
  };

  // Only display the last 2-3 messages
  const visibleMessages = messages.slice(-3);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between ${className}`}>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Globe size={17} />
            </div>
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                Genel Sohbet
              </h2>
              {/* Dinamik Senkron Rozet: +X Yeni Mesaj */}
              {unreadCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black tracking-wider shadow-xs animate-pulse">
                  +{unreadCount} Yeni Mesaj
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                  Canlı
                </span>
              )}
            </div>
          </div>

          <Link
            to="/sohbetler"
            onClick={handleGoToChat}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Sohbete Git</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        {/* Mesaj Akışı (Sadece Son 2-3 Mesaj, max-h-[160px], auto scroll) */}
        <div 
          ref={chatScrollRef}
          className="space-y-2 max-h-[160px] overflow-y-auto no-scrollbar my-1 pr-1"
        >
          {visibleMessages.length > 0 ? (
            visibleMessages.map((msg, i) => {
              const name = msg.sender_name || msg.username || "Kullanıcı";
              const avatar = msg.sender_avatar || msg.avatar || null;
              const color = msg.sender_color || msg.color;
              const timeStr = msg.created_at 
                ? new Date(msg.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                : msg.timestamp 
                ? new Date(msg.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
                : "Şimdi";

              return (
                <div
                  key={msg.id || i}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5 transition-all hover:bg-slate-100/70 dark:hover:bg-slate-800/70 animate-fade-in"
                >
                  <Avatar 
                    url={avatar} 
                    name={name} 
                    color={color} 
                    size={7} 
                    className="shrink-0 mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                        {name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                        {timeStr}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 break-words line-clamp-1">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-5 text-center text-slate-400 text-xs">
              Sohbet odası sessiz, ilk mesajı sen yazabilirsin!
            </div>
          )}
        </div>
      </div>

      {/* Hızlı Yanıt Kutusu */}
      <form onSubmit={handleSendMessage} className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onFocus={() => setUnreadCount(0)}
            placeholder="Genel sohbete anında yaz..."
            className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold transition-colors cursor-pointer shrink-0"
            title="Gönder"
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
