import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import Avatar from './Avatar';

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
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    if (!invite) return;
    setTimeLeft(30);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onReject(invite);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [invite, onReject]);

  if (!invite) return null;

  return (
    <>
      <style>{`
        @keyframes phone-shake {
          0%, 100% { transform: rotate(0deg) scale(1); }
          15% { transform: rotate(-12deg) scale(1.06); }
          30% { transform: rotate(12deg) scale(1.06); }
          45% { transform: rotate(-10deg) scale(1.06); }
          60% { transform: rotate(10deg) scale(1.06); }
          75% { transform: rotate(-5deg) scale(1.03); }
        }
        .animate-phone-shake {
          animation: phone-shake 1.2s infinite ease-in-out;
        }
        @keyframes radar-pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 0.3; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        .animate-radar {
          animation: radar-pulse 2s infinite cubic-bezier(0, 0, 0.2, 1);
        }
      `}</style>

      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-blue-500/40 shadow-2xl shadow-blue-500/20 rounded-3xl p-6 text-white max-w-sm w-full flex flex-col items-center text-center relative overflow-hidden">
          
          {/* Radial Glowing Background Element */}
          <div className="absolute -top-20 -left-20 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none"></div>

          {/* Close / Quick Dismiss */}
          <button
            onClick={() => onReject(invite)}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Caller Avatar with Radar Pulsing Rings */}
          <div className="relative mt-2 mb-5">
            <span className="absolute inset-0 rounded-full ring-4 ring-blue-500/50 animate-radar pointer-events-none"></span>
            <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400/60 animate-ping pointer-events-none"></span>
            <div className="relative z-10 ring-4 ring-blue-500/80 rounded-full overflow-hidden shadow-2xl">
              <Avatar
                name={invite.inviter.username}
                url={invite.inviter.avatar}
                size={24}
                color={invite.inviter.color || '#3b82f6'}
              />
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 bg-blue-600 rounded-full p-1.5 text-white border-2 border-slate-900 shadow-lg">
              <Video size={14} className="fill-current" />
            </div>
          </div>

          {/* Caller Details & Text */}
          <h3 className="font-extrabold text-xl text-white tracking-wide mb-1">
            {invite.inviter.username}
          </h3>
          <p className="text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Gelen Sesli Oda Daveti</span>
          </p>
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 mb-6 w-full text-slate-300 text-xs sm:text-sm">
            <span className="font-semibold text-white">{invite.inviter.username}</span> sizi <span className="text-blue-400 font-bold">"{invite.roomName}"</span> sesli odasına davet ediyor.
          </div>

          {/* Timeout Indicator */}
          <div className="text-[11px] text-slate-400 mb-5 font-mono">
            Otomatik kapanma: <span className="text-amber-400 font-bold">{timeLeft}s</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 w-full">
            {/* Reject Button */}
            <button
              onClick={() => onReject(invite)}
              className="flex-1 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold py-3 px-4 rounded-2xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all duration-150"
            >
              <PhoneOff size={18} />
              <span>Reddet</span>
            </button>

            {/* Accept Button */}
            <button
              onClick={() => onAccept(invite)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-3 px-4 rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 animate-phone-shake transition-all duration-150"
            >
              <Phone size={18} className="animate-bounce" />
              <span>Kabul Et</span>
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default VoiceCallInviteModal;
