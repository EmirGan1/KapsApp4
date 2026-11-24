import React, { useEffect, useState } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import type { Socket } from "socket.io-client";

interface MobileConnectivityBannerProps {
  socket: Socket | null;
  token: string | null;
}

export default function MobileConnectivityBanner({ socket, token }: MobileConnectivityBannerProps) {
  const isDemo = Boolean(token && (token.startsWith("demo-") || token.startsWith("mock-")));
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  const [socketDisconnected, setSocketDisconnected] = useState(false);
  const [justRestored, setJustRestored] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setJustRestored(true);
    };
    const onOffline = () => {
      setIsOnline(false);
      setJustRestored(false);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!socket || isDemo) {
      setSocketDisconnected(false);
      return;
    }

    let disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleConnect = () => {
      if (disconnectGraceTimer) {
        clearTimeout(disconnectGraceTimer);
        disconnectGraceTimer = null;
      }
      setSocketDisconnected((wasDown) => {
        if (wasDown) setJustRestored(true);
        return false;
      });
    };

    const handleDisconnect = () => {
      if (disconnectGraceTimer) clearTimeout(disconnectGraceTimer);
      disconnectGraceTimer = setTimeout(() => {
        if (!socket.connected) setSocketDisconnected(true);
      }, 1800);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);

    return () => {
      if (disconnectGraceTimer) clearTimeout(disconnectGraceTimer);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
    };
  }, [socket, isDemo]);

  useEffect(() => {
    if (!justRestored) return;
    const timer = setTimeout(() => setJustRestored(false), 2600);
    return () => clearTimeout(timer);
  }, [justRestored]);

  if (isDemo) return null;

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="shrink-0 px-3 py-2 bg-rose-600 text-white text-xs font-semibold flex items-center justify-between gap-2 z-30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <WifiOff size={14} className="shrink-0" />
          <span className="truncate">İnternet bağlantısı yok · Çevrimdışı görünüm</span>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold shrink-0 cursor-pointer"
        >
          Yenile
        </button>
      </div>
    );
  }

  if (socketDisconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="shrink-0 px-3 py-1.5 bg-amber-500/95 dark:bg-amber-600/95 text-slate-950 dark:text-white text-xs font-semibold flex items-center justify-between gap-2 z-30"
      >
        <div className="flex items-center gap-2 min-w-0">
          <RefreshCw size={13} className="shrink-0 animate-spin" />
          <span className="truncate">Canlı bağlantı yeniden kuruluyor…</span>
        </div>
        <button
          type="button"
          onClick={() => {
            try {
              socket?.connect();
            } catch {}
          }}
          className="px-2.5 py-1 rounded-lg bg-black/15 dark:bg-white/15 text-[11px] font-bold shrink-0 cursor-pointer"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (justRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="shrink-0 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 z-30"
      >
        <CheckCircle2 size={14} className="shrink-0" />
        <span>Bağlantı yeniden kuruldu</span>
      </div>
    );
  }

  return null;
}
