import React from 'react';
import { useCall } from '../context/CallContext';
import { Phone, PhoneOff, ShieldCheck } from 'lucide-react';
import Avatar from './Avatar';
import CallAudioOutput from './CallAudioOutput';

const IncomingCallNotification: React.FC = () => {
  const { callState, currentCall, acceptCall, rejectCall } = useCall();

  if (callState !== 'incoming_ringing' || !currentCall) {
    return null;
  }

  const peer = currentCall.peer;

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
        @keyframes call-sonar {
          0% { transform: scale(1); opacity: 0.65; }
          100% { transform: scale(1.85); opacity: 0; }
        }
        .animate-call-sonar-1 {
          animation: call-sonar 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        .animate-call-sonar-2 {
          animation: call-sonar 2s cubic-bezier(0, 0, 0.2, 1) 0.7s infinite;
        }
      `}</style>

      {/* Full-Screen Native Phone Call Experience on Mobile/Tablet (<1024px) & Floating Card on Desktop (lg+) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${peer.peerUsername} gelen sesli arama`}
        data-testid="incoming-call-screen"
        className="fixed inset-0 lg:inset-auto lg:top-5 lg:left-1/2 lg:-translate-x-1/2 z-[999999] w-full h-[100dvh] lg:h-auto lg:w-[420px] bg-gradient-to-b from-slate-950 via-slate-900 to-emerald-950/95 lg:bg-slate-900/95 backdrop-blur-2xl lg:border lg:border-emerald-500/40 lg:shadow-2xl lg:shadow-emerald-500/20 lg:rounded-3xl flex flex-col justify-between lg:justify-start items-center pt-[max(3rem,calc(env(safe-area-inset-top)+1.5rem))] pb-[max(3.25rem,calc(env(safe-area-inset-bottom)+1.75rem))] px-8 lg:p-6 text-white select-none"
      >
        {/* Top Call Badge (Mobile Full-Screen Header) */}
        <div className="flex flex-col items-center gap-1.5 lg:hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold tracking-wide uppercase">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>KapsApp Sesli Arama</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Gelen Doğrudan Arama...
          </span>
        </div>

        <CallAudioOutput />
        {/* Center Caller Profile & Sonar Rings */}
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-4 my-auto lg:my-0 lg:w-full">
          <div className="relative flex items-center justify-center shrink-0">
            <span className="absolute w-28 h-28 lg:w-14 lg:h-14 rounded-full border-2 border-emerald-400/60 animate-call-sonar-1 pointer-events-none" />
            <span className="absolute w-28 h-28 lg:w-14 lg:h-14 rounded-full border border-emerald-300/40 animate-call-sonar-2 pointer-events-none" />
            <div className="relative z-10 ring-4 lg:ring-2 ring-emerald-400/90 rounded-full overflow-hidden shadow-2xl shadow-emerald-500/30 transform scale-150 lg:scale-100 my-4 lg:my-0">
              <Avatar
                name={peer.peerUsername}
                url={peer.peerAvatar}
                size={16}
                color={peer.peerColor || '#10b981'}
              />
            </div>
          </div>

          <div className="flex flex-col items-center lg:items-start text-center lg:text-left min-w-0 flex-1 mt-3 lg:mt-0">
            <h2 className="font-black text-white text-3xl lg:text-lg tracking-tight truncate max-w-[85vw] lg:max-w-full">
              {peer.peerUsername}
            </h2>
            <p className="text-emerald-400 text-sm lg:text-xs font-semibold animate-pulse mt-1 flex items-center gap-1.5">
              <span>📞 Seni Arıyor...</span>
            </p>
          </div>
        </div>

        {/* Bottom Ergonomic Native Call Action Buttons */}
        <div className="w-full max-w-xs lg:max-w-none flex items-center justify-around lg:justify-between gap-6 lg:gap-3 lg:mt-5">
          {/* Reject Call Button */}
          <div className="flex flex-col items-center gap-2 lg:flex-1">
            <button
              type="button"
              data-testid="incoming-call-reject"
              onClick={rejectCall}
              className="w-20 h-20 lg:w-full lg:h-11 rounded-full lg:rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold shadow-2xl shadow-rose-600/40 flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer"
              aria-label="Aramayı Reddet"
            >
              <PhoneOff size={28} className="lg:w-[18px] lg:h-[18px]" />
              <span className="hidden lg:inline text-sm">Reddet</span>
            </button>
            <span className="text-xs font-bold text-rose-300 lg:hidden">
              Reddet
            </span>
          </div>

          {/* Accept Call Button */}
          <div className="flex flex-col items-center gap-2 lg:flex-1">
            <button
              type="button"
              data-testid="incoming-call-accept"
              onClick={acceptCall}
              className="w-20 h-20 lg:w-full lg:h-11 rounded-full lg:rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-white font-bold shadow-2xl shadow-emerald-500/40 flex items-center justify-center gap-2 animate-phone-shake transition-all duration-150 cursor-pointer"
              aria-label="Aramayı Kabul Et"
            >
              <Phone size={28} className="lg:w-[18px] lg:h-[18px]" />
              <span className="hidden lg:inline text-sm">Kabul Et</span>
            </button>
            <span className="text-xs font-bold text-emerald-300 lg:hidden">
              Kabul Et
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default IncomingCallNotification;

