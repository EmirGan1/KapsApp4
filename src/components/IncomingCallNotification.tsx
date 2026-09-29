import React from 'react';
import { useCall } from '../context/CallContext';
import { Phone, X } from 'lucide-react';
import Avatar from './Avatar';

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
        @keyframes slide-down {
          0% { transform: translate(-50%, -100%) scale(0.9); opacity: 0; }
          100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
        }
        .animate-slide-down {
          animation: slide-down 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
      `}</style>

      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-md animate-slide-down">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl shadow-emerald-500/20 rounded-2xl p-4 text-white flex flex-col gap-4">
          
          {/* Header Info */}
          <div className="flex items-center gap-4">
            {/* Avatar with Waving Rings */}
            <div className="relative shrink-0">
              <span className="absolute inset-0 rounded-full animate-ping ring-2 ring-emerald-400 opacity-75"></span>
              <div className="relative z-10 ring-2 ring-emerald-400 rounded-full overflow-hidden">
                <Avatar 
                  name={peer.peerUsername} 
                  url={peer.peerAvatar} 
                  size={12} 
                  color={peer.peerColor || '#10b981'}
                />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1 text-white border border-slate-900 animate-bounce">
                <Phone size={10} className="fill-current" />
              </div>
            </div>

            {/* Caller Details */}
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white text-base truncate">
                {peer.peerUsername}
              </h4>
              <p className="text-emerald-400 text-xs font-semibold animate-pulse flex items-center gap-1">
                <span>📞 Gelen Sesli Arama...</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Reject Button */}
            <button
              onClick={rejectCall}
              className="flex-1 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 animate-phone-shake transition-all duration-150 group"
            >
              <X size={18} className="group-hover:rotate-90 transition-transform duration-200" />
              <span>Reddet</span>
            </button>

            {/* Accept Button */}
            <button
              onClick={acceptCall}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 animate-phone-shake transition-all duration-150"
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

export default IncomingCallNotification;
