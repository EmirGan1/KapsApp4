import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { X, Volume2, AlertTriangle, VolumeX } from "lucide-react";

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
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [showTapToUnmute, setShowTapToUnmute] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAudioUnlockedRef = useRef<boolean>(false);

  const videoSrc = "/assets/aistudio/Ads_z_tasar_m_cc5bf91b.mp4";

  // Pre-unlock audio on user gesture anywhere on screen
  useEffect(() => {
    const handleUserGesture = () => {
      isAudioUnlockedRef.current = true;
      if (videoRef.current) {
        // Pre-warm video element on first touch
        videoRef.current.load();
      }
      window.removeEventListener("touchstart", handleUserGesture);
      window.removeEventListener("click", handleUserGesture);
    };

    window.addEventListener("touchstart", handleUserGesture, { passive: true, once: true });
    window.addEventListener("click", handleUserGesture, { passive: true, once: true });

    return () => {
      window.removeEventListener("touchstart", handleUserGesture);
      window.removeEventListener("click", handleUserGesture);
    };
  }, []);

  // Trigger high-intensity jumpscare with video's own sound
  const triggerJumpscare = () => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

    setHasError(false);
    setShowTapToUnmute(false);
    setIsAudioMuted(false);
    setIsActive(true);

    // Screen Shake on body for intense punch
    document.body.classList.add("kap-shake-active");

    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.volume = 1.0;
      video.muted = false;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Playing with unmuted sound successfully
            setIsAudioMuted(false);
            setShowTapToUnmute(false);
          })
          .catch((err) => {
            console.warn("[Kapscare] Unmuted autoplay restricted on mobile, starting muted:", err);
            // If mobile browser blocks sound autoplay, play muted first so video NEVER freezes!
            video.muted = true;
            video.play()
              .then(() => {
                setIsAudioMuted(true);
                setShowTapToUnmute(true);
              })
              .catch(() => {
                setHasError(true);
              });
          });
      }
    }

    // Safety fallback: auto-close if ended event does not fire within 4.5 seconds
    safetyTimeoutRef.current = setTimeout(() => {
      closeJumpscare();
    }, 4500);
  };

  const unmuteSound = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      setIsAudioMuted(false);
      setShowTapToUnmute(false);
    }
  };

  const closeJumpscare = () => {
    setIsActive(false);
    setShowTapToUnmute(false);
    document.body.classList.remove("kap-shake-active");
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch (e) {}
    }
  };

  // Socket listener & local test event listener
  useEffect(() => {
    const handleRemoteKapscare = (payload: KapscareEventPayload) => {
      if (!payload) return;
      const target = payload.targetUserId;

      // Resolve my ID from props or fallback to localStorage
      let myId = Number(currentUserId);
      if (!myId || myId <= 0) {
        const storedId = localStorage.getItem("lan_user_id") || localStorage.getItem("user_id");
        if (storedId) myId = Number(storedId);
      }

      // Check if event targets everyone ('all') or this specific user
      if (
        target === "all" || 
        target === undefined || 
        target === null || 
        (myId > 0 && (Number(target) === myId || String(target) === String(myId)))
      ) {
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
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
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

  return (
    <>
      {/* Video element permanently mounted in DOM for fast caching & preloading */}
      <video
        ref={videoRef}
        src={videoSrc}
        preload="auto"
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        onEnded={closeJumpscare}
        onError={() => {
          if (isActive) setHasError(true);
        }}
        className={
          isActive
            ? "fixed inset-0 z-[99999995] w-full h-full object-contain md:object-cover scale-105 pointer-events-none"
            : "hidden"
        }
      />

      {isActive && (
        <div
          className="fixed inset-0 z-[99999990] bg-black overflow-hidden select-none animate-in fade-in duration-75"
          style={{
            animation: "kapscareGlitch 0.12s infinite alternate"
          }}
          onClick={showTapToUnmute ? unmuteSound : closeJumpscare}
        >
          {/* Red Horror Flashing Vignette */}
          <div 
            className="absolute inset-0 pointer-events-none z-[99999996]"
            style={{
              boxShadow: "inset 0 0 140px 50px rgba(220, 38, 38, 0.9)",
              animation: "kapscareFlash 0.18s infinite alternate"
            }}
          />

          {/* Static / Noise Overlay */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-20 z-[99999997] mix-blend-screen bg-repeat"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 0)",
              backgroundSize: "4px 4px"
            }}
          />

          {/* Fallback Graphic if video decode fails */}
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950 text-white p-6 text-center space-y-4 z-[99999998]">
              <AlertTriangle className="w-24 h-24 text-red-500 animate-bounce" />
              <h1 className="text-4xl md:text-6xl font-black tracking-widest text-red-500 animate-pulse">
                💀 KAPSCARE! 💀
              </h1>
              <p className="text-xl font-bold text-slate-200">
                BOO! Emirgan sana jumpscare yolladı!
              </p>
            </div>
          )}

          {/* Tap to Unmute Banner if mobile browser blocked audio autoplay */}
          {showTapToUnmute && (
            <button
              type="button"
              onClick={unmuteSound}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[99999999] px-6 py-4 rounded-3xl bg-red-600/95 text-white text-base font-black shadow-2xl border-2 border-white animate-pulse flex items-center gap-3 cursor-pointer backdrop-blur-md"
            >
              <VolumeX size={26} className="text-white animate-bounce" />
              <span>SESİ AÇMAK İÇİN DOKUN! 🔊</span>
            </button>
          )}

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeJumpscare();
            }}
            className="absolute top-4 right-4 z-[99999999] p-3 rounded-full bg-black/70 hover:bg-black/95 text-white/80 hover:text-white border border-white/20 transition-all cursor-pointer backdrop-blur-md"
            title="Kapat (ESC)"
          >
            <X size={22} />
          </button>

          {/* Audio Indicator: Only original video sound */}
          <div className="absolute bottom-4 left-4 z-[99999999] flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-950/85 text-white text-xs font-mono font-bold border border-red-500/60 backdrop-blur-md">
            <Volume2 size={15} className={`text-red-400 ${isAudioMuted ? "opacity-50" : "animate-pulse"}`} />
            <span>KAPSCARE 🔊</span>
          </div>

          <style>{`
            @keyframes kapscareFlash {
              0% { opacity: 0.65; filter: brightness(1); }
              100% { opacity: 1; filter: brightness(1.5); }
            }
            @keyframes kapscareGlitch {
              0% { transform: translate(0, 0) scale(1.02); }
              50% { transform: translate(-5px, 3px) scale(1.04); }
              100% { transform: translate(4px, -3px) scale(1.01); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
