import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { callSoundEngine } from '../utils/callSoundEngine';

export type CallState = 'idle' | 'incoming_ringing' | 'outgoing_calling' | 'connecting' | 'connected' | 'ended';

export interface CallPartner {
  peerId: number;
  peerUsername: string;
  peerAvatar?: string | null;
  peerColor?: string;
}

export interface CurrentCall {
  callId: string;
  peer: CallPartner;
  isCaller: boolean;
}

interface CallContextType {
  callState: CallState;
  currentCall: CurrentCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeakingLocal: boolean;
  isSpeakingRemote: boolean;
  formattedDuration: string;
  isMinimized: boolean;
  setIsMinimized: (val: boolean) => void;
  startCall: (targetUserId: number) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const pcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export const CallProvider: React.FC<{
  children: React.ReactNode;
  socket: Socket | null;
  currentUserId: number | null;
  onOpenChatWithUser?: (userId: number) => void;
  onShowToast?: (msg: string, type: 'info' | 'error' | 'success') => void;
}> = ({ children, socket, currentUserId, onOpenChatWithUser, onShowToast }) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const [isSpeakingRemote, setIsSpeakingRemote] = useState(false);
  
  const [callDuration, setCallDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  
  // Audio Analyzer refs for speaking detection
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioContextRef = useRef<AudioContext | null>(null);
  const localAnalysisIntervalRef = useRef<any>(null);
  const remoteAnalysisIntervalRef = useRef<any>(null);

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Mute state sync ref
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Deafened state sync ref
  const isDeafenedRef = useRef(isDeafened);
  useEffect(() => {
    isDeafenedRef.current = isDeafened;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isDeafened;
    }
  }, [isDeafened]);

  // Duration timer
  useEffect(() => {
    let timer: any = null;
    if (callState === 'connected') {
      setCallDuration(0);
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  const formattedDuration = (() => {
    const hrs = Math.floor(callDuration / 3600);
    const mins = Math.floor((callDuration % 3600) / 60);
    const secs = callDuration % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  })();

  // Peer Connection cleanup
  const cleanupCall = () => {
    callSoundEngine.stopAll();

    // Clear voice analyzers
    if (localAnalysisIntervalRef.current) clearInterval(localAnalysisIntervalRef.current);
    if (remoteAnalysisIntervalRef.current) clearInterval(remoteAnalysisIntervalRef.current);
    
    try {
      if (localAudioContextRef.current && localAudioContextRef.current.state !== 'closed') {
        localAudioContextRef.current.close();
      }
    } catch (e) {}
    try {
      if (remoteAudioContextRef.current && remoteAudioContextRef.current.state !== 'closed') {
        remoteAudioContextRef.current.close();
      }
    } catch (e) {}
    
    localAnalyserRef.current = null;
    remoteAnalyserRef.current = null;
    localAudioContextRef.current = null;
    remoteAudioContextRef.current = null;
    
    setIsSpeakingLocal(false);
    setIsSpeakingRemote(false);

    // Stop streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    setLocalStream(null);
    localStreamRef.current = null;

    setRemoteStream(null);
    remoteStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setCallState('idle');
    setCurrentCall(null);
    setIsMinimized(false);
  };

  // Setup Speaking Detection for a stream
  const setupSpeakingDetection = (stream: MediaStream, isLocal: boolean) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const actx = new AudioContextClass();
      const source = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      if (isLocal) {
        localAudioContextRef.current = actx;
        localAnalyserRef.current = analyser;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        localAnalysisIntervalRef.current = setInterval(() => {
          if (!localAnalyserRef.current || isMutedRef.current) {
            setIsSpeakingLocal(false);
            return;
          }
          localAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setIsSpeakingLocal(average > 8); // Speeking threshold
        }, 150);
      } else {
        remoteAudioContextRef.current = actx;
        remoteAnalyserRef.current = analyser;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        remoteAnalysisIntervalRef.current = setInterval(() => {
          if (!remoteAnalyserRef.current || isDeafenedRef.current) {
            setIsSpeakingRemote(false);
            return;
          }
          remoteAnalyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          setIsSpeakingRemote(average > 8);
        }, 150);
      }
    } catch (err) {
      console.warn("Failed to set up voice detection:", err);
    }
  };

  // Listen for socket signaling events
  useEffect(() => {
    if (!socket) return;

    socket.on('direct_call_incoming', (data: {
      callId: string;
      callerId: number;
      callerUsername: string;
      callerAvatar?: string | null;
      callerColor?: string;
    }) => {
      if (callState !== 'idle') {
        // We are already in a call/calling!
        // The server blocks incoming, but as a safety guard:
        return;
      }

      setCallState('incoming_ringing');
      setCurrentCall({
        callId: data.callId,
        peer: {
          peerId: data.callerId,
          peerUsername: data.callerUsername,
          peerAvatar: data.callerAvatar,
          peerColor: data.callerColor
        },
        isCaller: false
      });

      // Play ringing
      callSoundEngine.startIncomingRing();
    });

    socket.on('direct_call_accepted', async (data: {
      callId: string;
      peerId: number;
      peerUsername: string;
      peerAvatar?: string | null;
      peerColor?: string;
    }) => {
      // Receiver accepted the call
      callSoundEngine.stopAll();
      callSoundEngine.playConnectTone();
      setCallState('connecting');

      // If we are the caller, we initiate the WebRTC Offer
      if (currentCall && currentCall.isCaller) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
            console.warn("Microphone permission denied or unavailable:", err);
            return null;
          });
          if (!stream) {
            onShowToast?.("Lütfen uygulama ayarlarından KapsApp'e mikrofon izni verin.", "error");
            endCall();
            return;
          }

          setLocalStream(stream);
          localStreamRef.current = stream;
          setupSpeakingDetection(stream, true);

          const pc = new RTCPeerConnection(pcConfig);
          peerConnectionRef.current = pc;

          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('direct_call_signal_ice', { callId: data.callId, candidate: event.candidate });
            }
          };

          pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
              const rStream = event.streams[0];
              setRemoteStream(rStream);
              remoteStreamRef.current = rStream;
              setupSpeakingDetection(rStream, false);

              // Audio output element
              let audio = remoteAudioRef.current;
              if (!audio) {
                audio = document.createElement('audio');
                audio.autoplay = true;
                remoteAudioRef.current = audio;
              }
              audio.srcObject = rStream;
              audio.muted = isDeafenedRef.current;
              audio.play().catch(() => {});
            }
          };

          pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'connected') {
              setCallState('connected');
            } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
              cleanupCall();
            }
          };

          const offer = await pc.createOffer({
            offerToReceiveAudio: true
          });
          await pc.setLocalDescription(offer);

          socket.emit('direct_call_signal_offer', { callId: data.callId, offer });

        } catch (err) {
          console.error("WebRTC caller connection error:", err);
          onShowToast?.("Ses bağlantısı kurulamadı.", "error");
          endCall();
        }
      }
    });

    socket.on('direct_call_signal_offer', async (data: { callId: string; offer: any }) => {
      // Receiver gets the WebRTC SDP offer from the caller
      if (!currentCall || currentCall.isCaller) return;

      setCallState('connecting');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch((err) => {
          console.warn("Microphone permission denied or unavailable:", err);
          return null;
        });
        if (!stream) {
          onShowToast?.("Lütfen uygulama ayarlarından KapsApp'e mikrofon izni verin.", "error");
          endCall();
          return;
        }

        setLocalStream(stream);
        localStreamRef.current = stream;
        setupSpeakingDetection(stream, true);

        const pc = new RTCPeerConnection(pcConfig);
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('direct_call_signal_ice', { callId: data.callId, candidate: event.candidate });
          }
        };

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            const rStream = event.streams[0];
            setRemoteStream(rStream);
            remoteStreamRef.current = rStream;
            setupSpeakingDetection(rStream, false);

            let audio = remoteAudioRef.current;
            if (!audio) {
              audio = document.createElement('audio');
              audio.autoplay = true;
              remoteAudioRef.current = audio;
            }
            audio.srcObject = rStream;
            audio.muted = isDeafenedRef.current;
            audio.play().catch(() => {});
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected') {
            setCallState('connected');
          } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            cleanupCall();
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('direct_call_signal_answer', { callId: data.callId, answer });
        setCallState('connected');

      } catch (err) {
        console.error("WebRTC receiver connection error:", err);
        onShowToast?.("Ses bağlantısı kurulamadı.", "error");
        endCall();
      }
    });

    socket.on('direct_call_signal_answer', async (data: { callId: string; answer: any }) => {
      // Caller gets description answer
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer)).catch((e) => {
          console.error("Failed to set remote answer:", e);
        });
        setCallState('connected');
      }
    });

    socket.on('direct_call_signal_ice', async (data: { callId: string; candidate: any }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((e) => {
          // Soft ignore potential candidate errors
        });
      }
    });

    socket.on('direct_call_rejected', (data: { callId: string; reason?: string }) => {
      onShowToast?.("Kullanıcı şu an müsait değil / aramayı reddetti.", "info");
      cleanupCall();
    });

    socket.on('direct_call_timeout', () => {
      onShowToast?.("Görüşme cevapsız kaldı.", "info");
      cleanupCall();
    });

    socket.on('direct_call_ended', () => {
      callSoundEngine.playDisconnectTone();
      cleanupCall();
    });

    return () => {
      socket.off('direct_call_incoming');
      socket.off('direct_call_accepted');
      socket.off('direct_call_signal_offer');
      socket.off('direct_call_signal_answer');
      socket.off('direct_call_signal_ice');
      socket.off('direct_call_rejected');
      socket.off('direct_call_timeout');
      socket.off('direct_call_ended');
    };
  }, [socket, callState, currentCall]);

  // Actions
  const startCall = async (targetUserId: number) => {
    if (!socket || !currentUserId) return;
    if (callState !== 'idle') {
      onShowToast?.("Zaten aktif bir aramanız var.", "error");
      return;
    }

    try {
      socket.emit('direct_call_start', { targetUserId }, (res: any) => {
        if (res.error) {
          onShowToast?.(res.error, "error");
          return;
        }

        setCallState('outgoing_calling');
        setCurrentCall({
          callId: res.callId,
          peer: {
            peerId: res.receiverId,
            peerUsername: res.receiverUsername,
            peerAvatar: res.receiverAvatar,
            peerColor: res.receiverColor
          },
          isCaller: true
        });

        // Play dial tone
        callSoundEngine.startOutgoingDialTone();
      });
    } catch (err) {
      console.error("Error starting direct call:", err);
      onShowToast?.("Arama başlatılamadı.", "error");
    }
  };

  const acceptCall = async () => {
    if (!socket || !currentCall || callState !== 'incoming_ringing') return;

    socket.emit('direct_call_accept', { callId: currentCall.callId }, (res: any) => {
      if (res.error) {
        onShowToast?.(res.error, "error");
        cleanupCall();
        return;
      }

      callSoundEngine.stopAll();
      setCallState('connecting');

      // Navigate receiver to messages/DM
      if (onOpenChatWithUser) {
        onOpenChatWithUser(currentCall.peer.peerId);
      }
    });
  };

  const rejectCall = () => {
    if (!socket || !currentCall) return;
    socket.emit('direct_call_reject', { callId: currentCall.callId });
    cleanupCall();
  };

  const endCall = () => {
    if (!socket || !currentCall) return;
    socket.emit('direct_call_end', { callId: currentCall.callId });
    callSoundEngine.playDisconnectTone();
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleDeafen = () => {
    setIsDeafened((prev) => !prev);
  };

  return (
    <CallContext.Provider
      value={{
        callState,
        currentCall,
        localStream,
        remoteStream,
        isMuted,
        isDeafened,
        isSpeakingLocal,
        isSpeakingRemote,
        formattedDuration,
        isMinimized,
        setIsMinimized,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleDeafen,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
