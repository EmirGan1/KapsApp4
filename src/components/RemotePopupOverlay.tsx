import React, { useState, useEffect } from "react";
import { Socket } from "socket.io-client";
import { 
  X, 
  Crown, 
  Megaphone, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Check, 
  ExternalLink,
  Sparkles,
  AlertCircle
} from "lucide-react";

export interface CustomPopupPayload {
  id: string;
  targetUserId?: number | string | "all";
  title: string;
  message: string;
  mediaType?: "image" | "video" | "none";
  mediaUrl?: string | null;
  theme?: "dark" | "urgent" | "gold" | "neon" | "cyber" | string;
  senderName?: string;
  createdAt?: string;
}

interface RemotePopupOverlayProps {
  socket: Socket | null;
  currentUserId?: number;
}

export default function RemotePopupOverlay({ socket, currentUserId }: RemotePopupOverlayProps) {
  const [activePopup, setActivePopup] = useState<CustomPopupPayload | null>(null);
  const [isMediaZoomed, setIsMediaZoomed] = useState<boolean>(false);

  // Pleasant notification chime when custom popup arrives
  const playPopupChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.24); // D6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);
    } catch {}
  };

  useEffect(() => {
    const handleRemotePopup = (payload: CustomPopupPayload) => {
      if (!payload) return;
      const target = payload.targetUserId;
      const myId = Number(currentUserId);

      // Check if target is 'all' or matches this specific logged in user
      if (target === "all" || target === undefined || target === null || (myId > 0 && Number(target) === myId)) {
        setActivePopup(payload);
        setIsMediaZoomed(false);
        playPopupChime();
      }
    };

    const handleLocalTest = (e: any) => {
      if (e?.detail) {
        setActivePopup(e.detail);
        setIsMediaZoomed(false);
        playPopupChime();
      }
    };

    if (socket) {
      socket.on("global:custom_popup", handleRemotePopup);
      socket.on("custom_popup:trigger", handleRemotePopup);
    }

    window.addEventListener("kaps:test_custom_popup", handleLocalTest);

    return () => {
      if (socket) {
        socket.off("global:custom_popup", handleRemotePopup);
        socket.off("custom_popup:trigger", handleRemotePopup);
      }
      window.removeEventListener("kaps:test_custom_popup", handleLocalTest);
    };
  }, [socket, currentUserId]);

  if (!activePopup) return null;

  const theme = activePopup.theme || "dark";
  const mediaType = activePopup.mediaType || "none";
  const mediaUrl = activePopup.mediaUrl;

  // Theme styling configurations
  const getThemeConfig = () => {
    switch (theme) {
      case "urgent":
        return {
          headerBg: "bg-gradient-to-r from-red-600 to-rose-700",
          border: "border-red-500/50 shadow-red-500/20",
          badgeBg: "bg-red-500/20 text-red-200 border-red-400/40",
          accentColor: "text-red-400",
          buttonBg: "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30",
          icon: <AlertCircle className="w-5 h-5 text-red-300" />
        };
      case "gold":
        return {
          headerBg: "bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700",
          border: "border-amber-500/50 shadow-amber-500/20",
          badgeBg: "bg-amber-500/20 text-amber-200 border-amber-400/40",
          accentColor: "text-amber-400",
          buttonBg: "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black shadow-amber-500/30",
          icon: <Crown className="w-5 h-5 text-amber-300" />
        };
      case "neon":
      case "cyber":
        return {
          headerBg: "bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700",
          border: "border-cyan-500/50 shadow-cyan-500/20",
          badgeBg: "bg-cyan-500/20 text-cyan-200 border-cyan-400/40",
          accentColor: "text-cyan-400",
          buttonBg: "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-cyan-500/30",
          icon: <Sparkles className="w-5 h-5 text-cyan-300" />
        };
      default: // dark modern
        return {
          headerBg: "bg-gradient-to-r from-slate-800 to-slate-900",
          border: "border-slate-700 shadow-sky-500/10",
          badgeBg: "bg-blue-500/20 text-blue-300 border-blue-400/30",
          accentColor: "text-sky-400",
          buttonBg: "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30",
          icon: <Megaphone className="w-5 h-5 text-sky-400" />
        };
    }
  };

  const themeConfig = getThemeConfig();

  return (
    <div 
      className="fixed inset-0 z-[9999999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => {
        // Keeps staying on screen per user instruction unless user clicks close button
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-slate-900 border ${themeConfig.border} text-slate-100 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden pb-safe animate-in zoom-in-95 duration-150`}
      >
        {/* Header Bar */}
        <div className={`px-5 py-4 ${themeConfig.headerBg} flex items-center justify-between gap-3 text-white shrink-0 shadow-md`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {themeConfig.icon}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/25 backdrop-blur-xs border border-white/20">
                  {activePopup.senderName ? `${activePopup.senderName}'den Bildirim` : "Yönetici Özel Pop-up"}
                </span>
                <span className="text-[10px] opacity-75 hidden sm:inline">
                  {activePopup.createdAt ? new Date(activePopup.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black truncate mt-0.5">
                {activePopup.title || "Özel Bildirim"}
              </h2>
            </div>
          </div>

          {/* Close 'X' Button - explicit close required */}
          <button
            type="button"
            onClick={() => setActivePopup(null)}
            className="p-2 text-white/80 hover:text-white rounded-xl bg-black/20 hover:bg-black/40 transition-colors cursor-pointer shrink-0"
            title="Kapat (X)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* Media Display (Image or Video) */}
          {mediaUrl && (
            <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner flex items-center justify-center">
              {mediaType === "video" || /\.(mp4|webm|mov|mkv|avi)$/i.test(mediaUrl) ? (
                <div className="w-full relative aspect-video bg-black flex items-center justify-center">
                  <video 
                    src={mediaUrl} 
                    controls 
                    autoPlay 
                    playsInline 
                    className="w-full h-full max-h-[360px] object-contain"
                  />
                </div>
              ) : (
                <div className="relative group w-full flex items-center justify-center bg-black/40 cursor-pointer">
                  <img 
                    src={mediaUrl} 
                    alt="Pop-up Görseli" 
                    className="w-full max-h-[380px] object-contain rounded-2xl transition-transform"
                    onClick={() => setIsMediaZoomed(true)}
                  />
                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/70 text-[11px] text-white flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink size={12} />
                    <span>Büyüt</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text Message Content */}
          {activePopup.message && (
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-slate-200 text-sm sm:text-base leading-relaxed whitespace-pre-line font-medium break-words">
              {activePopup.message}
            </div>
          )}
        </div>

        {/* Footer Action Strip */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            Bu pop-up çarpıya veya kapat tuşuna basılana kadar ekranda kalır.
          </span>
          <button
            type="button"
            onClick={() => setActivePopup(null)}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shrink-0 ${themeConfig.buttonBg}`}
          >
            <Check size={16} />
            <span>Kapat / Okudum</span>
          </button>
        </div>
      </div>

      {/* Lightbox / Zoomed Image Modal */}
      {isMediaZoomed && mediaUrl && (
        <div 
          className="fixed inset-0 z-[99999999] bg-black/95 flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsMediaZoomed(false)}
        >
          <img 
            src={mediaUrl} 
            alt="Büyütülmüş Görsel" 
            className="max-w-full max-h-[92vh] object-contain rounded-xl shadow-2xl" 
          />
          <button
            type="button"
            onClick={() => setIsMediaZoomed(false)}
            className="absolute top-4 right-4 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white cursor-pointer border border-slate-700"
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
