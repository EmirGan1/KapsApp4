import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { X, Volume2, Flame, AlertTriangle } from "lucide-react";

interface KapscareOverlayProps {
  socket: Socket | null;
  currentUserId?: number;
}

interface KapscareEventPayload {
  targetUserId?: number | string | "all";
  senderName?: string;
  timestamp: number;
}

export default function KapscareOverlay({ socket, currentUserId }: KapscareOverlayProps) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const videoSrc = "/assets/aistudio/Ads_z_tasar_m_cc5bf91b.mp4";

  // Trigger high-intensity screen jumpscare
  const triggerJumpscare = () => {
    // Clear any previous timer
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    setHasError(false);
    setIsActive(true);

    // Screen Shake on body for extra chaotic punch
    document.body.classList.add("kap-shake-active");

    // Audio boost: Play sudden loud jumpscare screech using Web Audio API in case video audio is muted or low
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const now = ctx.currentTime;

        // Oscillators for intense horror screech
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sawtooth";
        osc1.frequency.setValueAtTime(320, now);
        osc1.frequency.exponentialRampToValueAtTime(1600, now + 0.15);
        osc1.frequency.exponentialRampToValueAtTime(220, now + 0.8);

        osc2.type = "square";
        osc2.frequency.setValueAtTime(140, now);
        osc2.frequency.linearRampToValueAtTime(880, now + 0.3);

        // High loud volume gain
        gain.gain.setValueAtTime(0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.8);
        osc2.stop(now + 1.8);
      }
    } catch (e) {
      // Audio autoplay policy fallback
    }

    // Play video with maximum volume
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.volume = 1.0;
        videoRef.current.muted = false;
        
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn("[Kapscare] Autoplay with sound restricted, attempting unmuted retry:", err);
            // If browser blocked unmuted autoplay, retry with muted=true then unmute
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().then(() => {
                if (videoRef.current) videoRef.current.muted = false;
              }).catch(() => {
                setHasError(true);
              });
            }
          });
        }
      }
    }, 50);

    // Auto-close after video finishes (~2.5 - 3 seconds)
    autoCloseTimerRef.current = setTimeout(() => {
      closeJumpscare();
    }, 3200);
  };

  const closeJumpscare = () => {
    setIsActive(false);
    document.body.classList.remove("kap-shake-active");
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch (e) {}
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close().catch(() => {});
      } catch (e) {}
      audioContextRef.current = null;
    }
  };

  // Socket listener & local test event listener
  useEffect(() => {
    const handleRemoteKapscare = (payload: KapscareEventPayload) => {
      if (!payload) return;
      const target = payload.targetUserId;
      const myId = Number(currentUserId);

      // Check if event targets everyone ('all') or this specific user
      if (target === "all" || target === undefined || target === null || (myId > 0 && Number(target) === myId)) {
        triggerJumpscare();
      }
    };

    const handleLocalTest = () => {
      triggerJumpscare();
    };

    if (socket) {
      socket.on("global:kapscare", handleRemoteKapscare);
      socket.on("kapscare:trigger", handleRemoteKapscare);
    }

    window.addEventListener("kaps:test_kapscare", handleLocalTest);

    return () => {
      if (socket) {
        socket.off("global:kapscare", handleRemoteKapscare);
        socket.off("kapscare:trigger", handleRemoteKapscare);
      }
      window.removeEventListener("kaps:test_kapscare", handleLocalTest);
      document.body.classList.remove("kap-shake-active");
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, [socket, currentUserId]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeJumpscare();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div
      className="fixed inset-0 z-[99999999] bg-black flex items-center justify-center overflow-hidden select-none animate-in fade-in duration-75"
      style={{
        animation: "kapscareGlitch 0.15s infinite alternate"
      }}
      onClick={closeJumpscare}
    >
      {/* Red Horror Flashing Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          boxShadow: "inset 0 0 120px 40px rgba(220, 38, 38, 0.85)",
          animation: "kapscareFlash 0.2s infinite alternate"
        }}
      />

      {/* Static / Noise Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25 z-20 mix-blend-screen bg-repeat"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 0)",
          backgroundSize: "4px 4px"
        }}
      />

      {/* Video Jumpscare Container */}
      <div className="relative w-full h-full flex items-center justify-center max-w-full max-h-full">
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          autoPlay
          preload="auto"
          className="w-full h-full object-contain md:object-cover scale-105 filter drop-shadow-2xl"
          onEnded={closeJumpscare}
          onError={() => {
            console.error("[Kapscare] Video playback error");
            setHasError(true);
          }}
        />

        {/* Fallback Graphic if video takes a second or has decode issue */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950 text-white p-6 text-center space-y-4">
            <AlertTriangle className="w-24 h-24 text-red-500 animate-bounce" />
            <h1 className="text-4xl md:text-6xl font-black tracking-widest text-red-500 animate-pulse">
              💀 KAPSCARE! 💀
            </h1>
            <p className="text-xl font-bold text-slate-200">
              BOO! Emirgan sana jumpscare yolladı!
            </p>
          </div>
        )}
      </div>

      {/* Discreet Close Button (in top corner so user can escape if needed) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          closeJumpscare();
        }}
        className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/70 hover:text-white border border-white/20 transition-all cursor-pointer backdrop-blur-md"
        title="Kapat (ESC)"
      >
        <X size={20} />
      </button>

      {/* Audio Indicator */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-900/80 text-white text-xs font-mono font-bold border border-red-500/50 backdrop-blur-md">
        <Volume2 size={14} className="animate-pulse text-red-400" />
        <span>KAPSCARE 🔊</span>
      </div>

      <style>{`
        @keyframes kapscareFlash {
          0% { opacity: 0.6; filter: brightness(1); }
          100% { opacity: 1; filter: brightness(1.4); }
        }
        @keyframes kapscareGlitch {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-4px, 3px) scale(1.02); }
          100% { transform: translate(4px, -2px) scale(0.99); }
        }
      `}</style>
    </div>
  );
}
