import React, { useState, useEffect, useRef, useMemo } from "react";
import { Socket } from "socket.io-client";
import { Flame, AlertTriangle } from "lucide-react";

interface KapAttackOverlayProps {
  socket: Socket | null;
}

interface KapParticle {
  id: number;
  text: string;
  top: number; // percentage
  left: number; // percentage
  fontSize: number; // px
  color: string;
  rotation: number; // deg
  animationDuration: number; // seconds
  animationDelay: number; // seconds
  scale: number;
  zIndex: number;
}

const KAP_TEXT_VARIANTS = [
  "kap",
  "KAP!",
  "KAP ATTACK",
  "kapkap",
  "KAPP!",
  "💥 KAP",
  "kap!",
  "KAP",
  "🚨 KAP!",
  "KAPPP"
];

const NEON_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f43f5e", // Rose
];

export default function KapAttackOverlay({ socket }: KapAttackOverlayProps) {
  const [isActive, setIsActive] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Play a quick retro comedy siren / sound effect using Web Audio API
  const playKapSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      // Wobble alarm effect
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(330, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(770, now + 0.45);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Generate random particles once on mount or when attack starts
  const particles = useMemo<KapParticle[]>(() => {
    const list: KapParticle[] = [];
    const count = 45; // 45 floating chaotic words

    for (let i = 0; i < count; i++) {
      const text = KAP_TEXT_VARIANTS[Math.floor(Math.random() * KAP_TEXT_VARIANTS.length)];
      const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
      const top = Math.random() * 92; // 0% to 92%
      const left = Math.random() * 90; // 0% to 90%
      const fontSize = Math.floor(Math.random() * 60) + 22; // 22px to 82px
      const rotation = (Math.random() - 0.5) * 80; // -40deg to +40deg
      const animationDuration = 0.5 + Math.random() * 0.8; // 0.5s to 1.3s
      const animationDelay = Math.random() * 0.3; // 0 to 0.3s
      const scale = 0.8 + Math.random() * 0.6; // 0.8 to 1.4

      list.push({
        id: i,
        text,
        top,
        left,
        fontSize,
        color,
        rotation,
        animationDuration,
        animationDelay,
        scale,
        zIndex: 1000 + i,
      });
    }

    return list;
  }, [isActive]);

  const stopAttack = () => {
    setIsActive(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    document.body.classList.remove("kap-shake-active");
  };

  const startAttack = () => {
    // Clear any existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setIsActive(true);
    setCountdown(5);
    playKapSound();

    // Screen Shake on body
    document.body.classList.add("kap-shake-active");

    // Countdown interval
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-stop after 5 seconds
    timeoutRef.current = setTimeout(() => {
      stopAttack();
    }, 5000);
  };

  // Socket listener registration
  useEffect(() => {
    if (!socket) return;

    socket.on("global:kap_attack_start", startAttack);
    socket.on("global:kap_attack_stop", stopAttack);

    return () => {
      socket.off("global:kap_attack_start", startAttack);
      socket.off("global:kap_attack_stop", stopAttack);
      stopAttack();
    };
  }, [socket]);

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      document.body.classList.remove("kap-shake-active");
    };
  }, []);

  if (!isActive) return null;

  return (
    <>
      {/* Dynamic CSS Styles for Screen Shake and Particle Animation */}
      <style>{`
        @keyframes kapShake {
          0% { transform: translate(3px, 2px) rotate(0deg); }
          15% { transform: translate(-4px, -3px) rotate(1.2deg); }
          30% { transform: translate(3px, 1px) rotate(-1.2deg); }
          45% { transform: translate(-4px, 2px) rotate(0.8deg); }
          60% { transform: translate(4px, -2px) rotate(-0.8deg); }
          75% { transform: translate(-3px, -1px) rotate(1deg); }
          90% { transform: translate(3px, 3px) rotate(-1deg); }
          100% { transform: translate(0px, 0px) rotate(0deg); }
        }

        body.kap-shake-active {
          animation: kapShake 0.22s infinite ease-in-out !important;
          transform-origin: center center !important;
          overflow: hidden !important;
        }

        @keyframes kapFloatPulse {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(0.9);
            opacity: 0.85;
          }
          50% {
            transform: translate(14px, -18px) rotate(12deg) scale(1.15);
            opacity: 1;
          }
          100% {
            transform: translate(-10px, 12px) rotate(-8deg) scale(0.95);
            opacity: 0.9;
          }
        }

        @keyframes kapFlashBorder {
          0%, 100% { border-color: rgba(239, 68, 68, 0.8); box-shadow: 0 0 35px rgba(239, 68, 68, 0.6) inset; }
          50% { border-color: rgba(245, 158, 11, 0.8); box-shadow: 0 0 45px rgba(245, 158, 11, 0.7) inset; }
        }
      `}</style>

      {/* Fullscreen Overlay Container */}
      <div 
        className="fixed inset-0 pointer-events-none select-none z-[99999] overflow-hidden"
        style={{
          border: "8px solid rgba(239, 68, 68, 0.8)",
          animation: "kapFlashBorder 0.4s infinite alternate",
        }}
      >
        {/* Flash Vignette Backdrop */}
        <div className="absolute inset-0 bg-red-500/10 dark:bg-amber-500/15 animate-pulse pointer-events-none" />

        {/* Central Comic Warning Banner */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[100000] pointer-events-auto">
          <div className="px-6 py-3 rounded-3xl bg-slate-950/90 text-white border-2 border-red-500 shadow-2xl flex items-center gap-3 backdrop-blur-md animate-bounce">
            <span className="text-2xl animate-spin">🚨</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-400 to-amber-300 uppercase">
                  KAP ATTACK AKTİF!
                </span>
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-mono text-xs font-black">
                  {countdown}s
                </span>
              </div>
              <p className="text-[11px] font-bold text-amber-300">
                Sistem Emirgan Tarafından Ele Geçirildi
              </p>
            </div>
            <button
              onClick={stopAttack}
              className="ml-2 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer border border-slate-700"
              title="Kapat"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 45+ Flying / Floating "kap" Words */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute font-black tracking-tighter transition-all"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
              fontSize: `${p.fontSize}px`,
              color: p.color,
              transform: `rotate(${p.rotation}deg) scale(${p.scale})`,
              textShadow: "0 0 10px rgba(0,0,0,0.9), 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000",
              animation: `kapFloatPulse ${p.animationDuration}s infinite alternate ease-in-out`,
              animationDelay: `${p.animationDelay}s`,
              zIndex: p.zIndex,
            }}
          >
            {p.text}
          </div>
        ))}
      </div>
    </>
  );
}
