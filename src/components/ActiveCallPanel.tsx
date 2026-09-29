import React from 'react';
import { useCall } from '../context/CallContext';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Maximize2, Minimize2, MessageSquare, ShieldAlert } from 'lucide-react';
import Avatar from './Avatar';

const ActiveCallPanel: React.FC = () => {
  const {
    callState,
    currentCall,
    isMuted,
    isDeafened,
    isSpeakingLocal,
    isSpeakingRemote,
    formattedDuration,
    isMinimized,
    setIsMinimized,
    endCall,
    toggleMute,
    toggleDeafen,
  } = useCall();

  if (callState === 'idle' || callState === 'incoming_ringing' || !currentCall) {
    return null;
  }

  const peer = currentCall.peer;
  const isConnecting = callState === 'connecting';
  const isOutgoing = callState === 'outgoing_calling';
  const isConnected = callState === 'connected';

  // --- MINIMIZED VIEW ---
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-[9999] animate-bounce-short">
        <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 text-white">
          {/* Audio Speaking Avatar */}
          <div className="relative shrink-0">
            <div className={`rounded-full transition-all duration-300 ${isSpeakingRemote ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 animate-pulse' : 'ring-1 ring-slate-700'}`}>
              <Avatar 
                name={peer.peerUsername} 
                url={peer.peerAvatar} 
                size={8} 
                color={peer.peerColor || '#10b981'}
              />
            </div>
            {isSpeakingRemote && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </div>

          {/* Details & Controls */}
          <div className="flex flex-col">
            <span className="text-xs font-bold truncate max-w-[80px]">{peer.peerUsername}</span>
            <span className="text-[10px] text-emerald-400 font-mono">
              {isOutgoing ? 'Aranıyor...' : isConnecting ? 'Bağlanıyor...' : formattedDuration}
            </span>
          </div>

          {/* Mini Buttons */}
          <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
            {/* Toggle Mic */}
            <button
              onClick={toggleMute}
              className={`p-1.5 rounded-full hover:bg-slate-800 transition-colors ${isMuted ? 'text-rose-500 bg-rose-500/10' : 'text-slate-300'}`}
              title={isMuted ? 'Mikrofonu Aç' : 'Sesi Sessize Al'}
            >
              {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            </button>

            {/* Toggle Deafen */}
            <button
              onClick={toggleDeafen}
              className={`p-1.5 rounded-full hover:bg-slate-800 transition-colors ${isDeafened ? 'text-rose-500 bg-rose-500/10' : 'text-slate-300'}`}
              title={isDeafened ? 'Hoparlörü Aç' : 'Sesi Kapat'}
            >
              {isDeafened ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>

            {/* Expand Call */}
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1.5 rounded-full text-slate-300 hover:bg-slate-800 transition-colors"
              title="Ekranı Büyüt"
            >
              <Maximize2 size={14} />
            </button>

            {/* End Call */}
            <button
              onClick={endCall}
              className="p-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              title="Aramayı Kapat"
            >
              <PhoneOff size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- EXPANDED OVERLAY VIEW ---
  return (
    <>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.5; }
          50% { transform: scale(1.15); opacity: 0.3; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        .animate-pulse-ring {
          animation: pulse-ring 2s infinite ease-out;
        }
        @keyframes wave-flow {
          0% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
          100% { transform: scaleY(0.3); }
        }
        .wave-bar {
          animation: wave-flow 1.2s infinite ease-in-out;
        }
      `}</style>

      <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl w-full max-w-sm overflow-hidden flex flex-col text-white">
          
          {/* Header Bar */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800/60 bg-slate-950/20">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
              <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-ping'}`} />
              {isOutgoing ? 'Arama Yapılıyor' : isConnecting ? 'Bağlantı Kuruluyor' : 'Sesli Görüşme'}
            </span>

            {/* Minimize button */}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all duration-150 active:scale-95"
              title="Simge Durumuna Küçült"
            >
              <Minimize2 size={18} />
            </button>
          </div>

          {/* Center Call Panel */}
          <div className="flex-1 py-10 flex flex-col items-center justify-center relative px-6">
            
            {/* Visual Call Pulse */}
            <div className="relative mb-6">
              {/* Pulsing ring indicator */}
              {(isOutgoing || isConnecting || isSpeakingRemote) && (
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-pulse-ring" />
              )}
              {isSpeakingRemote && (
                <div className="absolute inset-0 rounded-full bg-emerald-400/10 animate-pulse-ring" style={{ animationDelay: '0.6s' }} />
              )}

              {/* Avatar Frame */}
              <div className={`relative z-10 rounded-full p-1.5 transition-all duration-300 ${
                isSpeakingRemote 
                  ? 'ring-4 ring-emerald-400 ring-offset-4 ring-offset-slate-900 scale-105' 
                  : 'ring-2 ring-slate-700'
              }`}>
                <Avatar 
                  name={peer.peerUsername} 
                  url={peer.peerAvatar} 
                  size={28} 
                  color={peer.peerColor || '#3b82f6'}
                />
              </div>

              {/* Status Dot */}
              <div className={`absolute bottom-1 right-2 z-20 rounded-full p-2 border-2 border-slate-900 ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-bounce'
              }`}>
                {isConnected ? (
                  <Volume2 size={16} className="text-slate-900 font-bold" />
                ) : (
                  <PhoneOff size={16} className="text-slate-900 font-bold" />
                )}
              </div>
            </div>

            {/* Peer Username */}
            <h3 className="text-2xl font-black text-white text-center mb-1 select-none">
              {peer.peerUsername}
            </h3>

            {/* Connecting status detail */}
            <div className="text-center select-none h-6">
              {isOutgoing && (
                <p className="text-slate-400 text-sm animate-pulse">Çalıyor...</p>
              )}
              {isConnecting && (
                <p className="text-slate-400 text-sm flex items-center gap-1.5">
                  <span className="h-4 w-4 border-2 border-t-transparent border-slate-400 rounded-full animate-spin" />
                  Ses şifreleniyor...
                </p>
              )}
              {isConnected && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-emerald-400 text-base font-mono font-bold tracking-widest">
                    {formattedDuration}
                  </span>
                  {/* Voice Activity Flowing Waves */}
                  {isSpeakingRemote && (
                    <div className="flex items-center gap-0.5 h-3 mt-1 justify-center">
                      <span className="w-0.5 h-2 bg-emerald-400 rounded wave-bar" style={{ animationDelay: '0.1s' }} />
                      <span className="w-0.5 h-3 bg-emerald-400 rounded wave-bar" style={{ animationDelay: '0.3s' }} />
                      <span className="w-0.5 h-1 bg-emerald-400 rounded wave-bar" style={{ animationDelay: '0.5s' }} />
                      <span className="w-0.5 h-2.5 bg-emerald-400 rounded wave-bar" style={{ animationDelay: '0.2s' }} />
                      <span className="w-0.5 h-1.5 bg-emerald-400 rounded wave-bar" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Muted Warn */}
            {isMuted && isConnected && (
              <div className="mt-4 flex items-center gap-1.5 bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-semibold select-none">
                <MicOff size={12} />
                Mikrofonunuz Sessizde
              </div>
            )}
          </div>

          {/* Bottom Interactive Dashboard Controller */}
          <div className="bg-slate-950 p-6 flex flex-col gap-4 border-t border-slate-800/80">
            {/* Control Panel Grid */}
            <div className="flex items-center justify-around gap-2">
              {/* Mute toggle */}
              <button
                onClick={toggleMute}
                className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-150 border active:scale-95 ${
                  isMuted 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-lg shadow-rose-500/10' 
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850 hover:text-white'
                }`}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                <span className="text-[10px] font-bold uppercase tracking-wider">{isMuted ? 'Sessiz' : 'Sustur'}</span>
              </button>

              {/* Deafen toggle */}
              <button
                onClick={toggleDeafen}
                className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all duration-150 border active:scale-95 ${
                  isDeafened 
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 shadow-lg shadow-rose-500/10' 
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850 hover:text-white'
                }`}
              >
                {isDeafened ? <VolumeX size={22} /> : <Volume2 size={22} />}
                <span className="text-[10px] font-bold uppercase tracking-wider">{isDeafened ? 'Sağır' : 'Ses Kapat'}</span>
              </button>

              {/* Local Voice Indicator Preview */}
              <div className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 border bg-slate-900 text-slate-400 border-slate-800 ${
                isSpeakingLocal && !isMuted ? 'text-emerald-400 border-emerald-500/20' : ''
              }`}>
                <div className="relative">
                  <Avatar name="Siz" size={6} color="#94a3b8" />
                  {isSpeakingLocal && !isMuted && (
                    <span className="absolute inset-0 rounded-full ring-2 ring-emerald-400 animate-ping opacity-60" />
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {isMuted ? 'Kapalı' : isSpeakingLocal ? 'Konuşuyor' : 'Dinliyor'}
                </span>
              </div>
            </div>

            {/* Hangup Red Action Button */}
            <button
              onClick={endCall}
              className="bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold py-4 rounded-2xl shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all duration-150"
            >
              <PhoneOff size={20} className="fill-current" />
              <span>Görüşmeyi Sonlandır</span>
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default ActiveCallPanel;
