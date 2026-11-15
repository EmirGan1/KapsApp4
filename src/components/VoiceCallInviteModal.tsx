import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, Radio } from 'lucide-react';
import Avatar from './Avatar';
import { callSoundEngine } from '../utils/callSoundEngine';

export interface VoiceCallInvite {
  roomId: string;
  roomName: string;
  inviter: {
    id: number;
    username: string;
    avatar: string | null;
    color?: string;
  };
}

interface VoiceCallInviteModalProps {
  invite: VoiceCallInvite | null;
  onAccept: (invite: VoiceCallInvite) => void;
  onReject: (invite: VoiceCallInvite) => void;
}

export const VoiceCallInviteModal: React.FC<VoiceCallInviteModalProps> = ({
  invite,
  onAccept,
  onReject
}) => {
  const [timeLeft, setTimeLeft] = useState(40);

  useEffect(() => {
    if (!invite) {
      callSoundEngine.stopAll();
      return;
    }
    setTimeLeft(40);
    callSoundEngine.startIncomingRing();

    const canVibrate = () => {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
      const ua = (navigator as any).userActivation;
      return ua ? Boolean(ua.hasBeenActive) : true;
    };

    let vibrateTimer: any = null;
    try {
      if (canVibrate()) {
        navigator.vibrate([450, 200, 450, 200, 450]);
      }
      vibrateTimer = setInterval(() => {
        try {
          if (canVibrate()) navigator.vibrate([450, 200, 450]);
        } catch {}
      }, 2500);
    } catch {}

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          callSoundEngine.stopAll();
          onReject(invite);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      if (vibrateTimer) clearInterval(vibrateTimer);
      try {
        if (canVibrate()) navigator.vibrate(0);
      } catch {}
      callSoundEngine.stopAll();
    };
  }, [invite, onReject]);

  if (!invite) return null;

  const handleAcceptClick = () => {
    callSoundEngine.stopAll();
    callSoundEngine.playConnectTone();
    onAccept(invite);
  };

  const handleRejectClick = () => {
    callSoundEngine.stopAll();
    callSoundEngine.playDisconnectTone();
    onReject(invite);
  };

  return (
    <>
      <style>{`
        @keyframes voice-phone-shake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-12deg) scale(1.06); }
          30% { transform: rotate(12deg) scale(1.06); }
          45% { transform: rotate(-10deg) scale(1.06); }
          60% { transform: rotate(10deg) scale(1.06); }
          75% { transform: rotate(-5deg) scale(1.03); }
        }
        .animate-voice-phone-shake {
          animation: voice-phone-shake 1.2s infinite ease-in-out;
        }
        @keyframes voice-call-sonar {
          0% { transform: scale(1); opacity: 0.65; }
          100% { transform: scale(1.85); opacity: 0; }
        }
        .animate-voice-sonar-1 {
          animation: voice-call-sonar 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-voice-sonar-2 {
          animation: voice-call-sonar 2s cubic-bezier(0, 0, 0.2, 1) 0.7s infinite;
        }
      `}</style>

      {/* Full-Screen Native Phone/Video Call UI on Mobile/Tablet (<1024px) & Floating Card on Desktop (lg+) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${invite.inviter.username} sesli oda araması`}
        data-testid="voice-invite-call-screen"
        className="fixed inset-0 lg:inset-auto lg:top-5 lg:left-1/2 lg:-translate-x-1/2 z-[999999] w-full h-[100dvh] lg:h-auto lg:w-[440px] bg-gradient-to-b from-slate-950 via-indigo-950/95 to-slate-950 lg:bg-slate-900/95 backdrop-blur-2xl lg:border lg:border-blue-500/40 lg:shadow-2xl lg:shadow-blue-500/20 lg:rounded-3xl flex flex-col justify-between lg:justify-start items-center pt-[max(3rem,calc(env(safe-area-inset-top)+1.5rem))] pb-[max(3.25rem,calc(env(safe-area-inset-bottom)+1.75rem))] px-7 lg:p-6 text-white select-none"
      >
        {/* Top Call Badge (Mobile Full-Screen Header) */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide uppercase">
            <Radio size={14} className="text-blue-400 animate-pulse" />
            <span>Sesli & Görüntülü Sohbet Araması</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Çalıyor • {timeLeft}s
          </span>
        </div>

        {/* Center Caller Profile & Sonar Rings */}
        <div className="flex flex-col items-center text-center my-auto lg:my-4 w-full">
          <div className="relative flex items-center justify-center shrink-0 mb-6 lg:mb-4">
            <span className="absolute w-28 h-28 lg:w-20 lg:h-20 rounded-full border-2 border-blue-400/60 animate-voice-sonar-1 pointer-events-none" />
            <span className="absolute w-28 h-28 lg:w-20 lg:h-20 rounded-full border border-emerald-300/40 animate-voice-sonar-2 pointer-events-none" />
            <div className="relative z-10 ring-4 ring-blue-400/90 rounded-full overflow-hidden shadow-2xl shadow-blue-500/30 transform scale-150 lg:scale-110 my-4 lg:my-1">
              <Avatar
                name={invite.inviter.username}
                url={invite.inviter.avatar}
                size={16}
                color={invite.inviter.color || '#3b82f6'}
              />
            </div>
            <div className="absolute -bottom-1 -right-2 z-20 bg-blue-600 rounded-full p-1.5 text-white border-2 border-slate-950 shadow-lg">
              <Video size={14} className="fill-current" />
            </div>
          </div>

          <h2 className="font-black text-white text-3xl lg:text-xl tracking-tight truncate max-w-[85vw]">
            {invite.inviter.username}
          </h2>
          <p className="text-emerald-400 text-sm lg:text-xs font-semibold animate-pulse mt-1">
            📞 Sizi Sesli & Görüntülü Odaya Çaldırıyor...
          </p>

          <div className="mt-4 px-4 py-3 rounded-2xl bg-white/8 border border-white/15 max-w-xs w-full">
            <div className="text-[11px] uppercase tracking-wider text-blue-300 font-bold">
              Davet Edilen Oda
            </div>
            <div className="text-sm font-extrabold text-white truncate mt-0.5">
              {invite.roomName}
            </div>
          </div>
        </div>

        {/* Bottom Ergonomic Native Call Action Buttons */}
        <div className="w-full max-w-xs lg:max-w-none flex items-center justify-around lg:justify-between gap-6 lg:gap-3 lg:mt-4">
          {/* Reject Button */}
          <div className="flex flex-col items-center gap-2 lg:flex-1">
            <button
              type="button"
              data-testid="voice-invite-reject"
              onClick={handleRejectClick}
              className="w-20 h-20 lg:w-full lg:h-12 rounded-full lg:rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold shadow-2xl shadow-rose-600/40 flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer"
              aria-label="Aramayı Reddet"
            >
              <PhoneOff size={28} className="lg:w-[18px] lg:h-[18px]" />
              <span className="hidden lg:inline text-sm">Reddet</span>
            </button>
            <span className="text-xs font-bold text-rose-300 lg:hidden">
              Reddet
            </span>
          </div>

          {/* Accept Button */}
          <div className="flex flex-col items-center gap-2 lg:flex-1">
            <button
              type="button"
              data-testid="voice-invite-accept"
              onClick={handleAcceptClick}
              className="w-20 h-20 lg:w-full lg:h-12 rounded-full lg:rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold shadow-2xl shadow-emerald-500/40 flex items-center justify-center gap-2 animate-voice-phone-shake transition-all duration-150 cursor-pointer"
              aria-label="Aramayı Yanıtla ve Odaya Katıl"
            >
              <Phone size={28} className="lg:w-[18px] lg:h-[18px]" />
              <span className="hidden lg:inline text-sm">Odaya Katıl</span>
            </button>
            <span className="text-xs font-bold text-emerald-300 lg:hidden">
              Yanıtla & Katıl
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default VoiceCallInviteModal;
