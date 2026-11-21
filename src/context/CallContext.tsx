import { applyAudioOutput } from '../utils/audioOutput';
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { callSoundEngine } from '../utils/callSoundEngine';
import {
  parseIncomingCallFromSearch,
  parseIncomingCallFromPushAlert,
  ParsedIncomingCallPayload,
} from '../utils/incomingCallPayload';
import { ICE_SERVERS, AUDIO_CONSTRAINTS } from '../utils/webrtcConfig';

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
  isCameraOn: boolean;
  toggleCamera: () => Promise<void>;
  audioOutputMode: 'speaker' | 'earpiece' | 'system' | 'device';
  audioOutputs: MediaDeviceInfo[];
  audioOutputId: string;
  audioOutputLabel: string;
  selectAudioOutput: (id: string) => Promise<void>;
  toggleAudioOutput: () => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

const pcConfig = ICE_SERVERS;

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
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [audioOutputMode, setAudioOutputMode] = useState<'speaker' | 'earpiece' | 'system' | 'device'>('system');
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputId, setAudioOutputId] = useState('');
  const [audioOutputLabel, setAudioOutputLabel] = useState('Sistem ses çıkışı');
  const selectedOutputRef = useRef('');
  const outputBusyRef = useRef(false);
  const ensureRemoteAudio = () => {
    if (!remoteAudioRef.current) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', '');
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }
    return remoteAudioRef.current;
  };
  const selectAudioOutput = async (id: string, deviceLabel?: string) => {
    if (outputBusyRef.current) return;
    outputBusyRef.current = true;
    try {
      const audio = ensureRemoteAudio();
      await applyAudioOutput([audio], id);
      const device = audioOutputs.find(d => d.deviceId === id);
      const label = deviceLabel || device?.label;
      selectedOutputRef.current = audio.sinkId;
      setAudioOutputId(audio.sinkId);
      setAudioOutputLabel(!id || id === 'default' ? 'Sistem ses çıkışı' : label || 'Seçili ses cihazı');
      setAudioOutputMode(!id || id === 'default' ? 'system' : /earpiece|receiver|ahize/i.test(label || '') ? 'earpiece' : /speaker|hoparlör/i.test(label || '') ? 'speaker' : 'device');
    } catch (error) {
      onShowToast?.(error instanceof Error ? error.message : 'Ses çıkışı değiştirilemedi.', 'error');
    } finally { outputBusyRef.current = false; }
  };
  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      const devices = await navigator.mediaDevices?.enumerateDevices?.().catch(() => []);
      if (disposed) return;
      const outputs = devices?.filter(d => d.kind === 'audiooutput') || [];
      setAudioOutputs(outputs);
      const id = selectedOutputRef.current;
      if (id && id !== 'default' && !outputs.some(d => d.deviceId === id)) {
        let resetVerified = false;
        try {
          if (remoteAudioRef.current?.setSinkId) { await applyAudioOutput([remoteAudioRef.current], ''); resetVerified = true; }
        } catch {}
        selectedOutputRef.current = resetVerified ? '' : remoteAudioRef.current?.sinkId || '';
        setAudioOutputId(selectedOutputRef.current); setAudioOutputMode('system');
        setAudioOutputLabel(resetVerified ? 'Sistem ses çıkışı' : 'Ses çıkışı doğrulanamadı');
        onShowToast?.('Ses cihazı bağlantısı kesildi. Sistem ses çıkışını kontrol edin.', 'info');
      }
    };
    void refresh();
    navigator.mediaDevices?.addEventListener('devicechange', refresh);
    return () => { disposed = true; navigator.mediaDevices?.removeEventListener('devicechange', refresh); };
  }, [callState]);
  
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
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);

  const flushIce = async (pc: RTCPeerConnection) => {
    const candidates = pendingIceRef.current.splice(0);
    for (const candidate of candidates) {
      try { await pc.addIceCandidate(candidate); }
      catch (error) { console.warn('Arama ICE adayı eklenemedi:', error); }
    }
  };

  const attachRemoteTrack = (event: RTCTrackEvent) => {
    const stream = event.streams[0] || new MediaStream([event.track]);
    if (event.track.kind === 'video') {
      setRemoteStream(stream);
      return;
    }
    remoteStreamRef.current = stream;
    setupSpeakingDetection(stream, false);
    const audio = ensureRemoteAudio();
    audio.srcObject = new MediaStream([event.track]);
    audio.muted = isDeafenedRef.current;
    void audio.play().catch(error => console.warn('Arama sesi başlatılamadı:', error));
  };

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

  useEffect(() => {
    const resumeAudio = () => {
      const audio = remoteAudioRef.current;
      if (audio?.paused && audio.srcObject) void audio.play().catch(() => {});
    };
    window.addEventListener('pointerdown', resumeAudio, { passive: true });
    window.addEventListener('touchstart', resumeAudio, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('touchstart', resumeAudio);
    };
  }, []);

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
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
      selectedOutputRef.current = ''; setAudioOutputId(''); setAudioOutputMode('system'); setAudioOutputLabel('Sistem ses çıkışı');
    }
    pendingIceRef.current = [];
    videoSenderRef.current = null;
    setIsCameraOn(false);

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

  const pendingAutoAcceptCallIdRef = useRef<string | null>(null);

  const triggerIncomingCall = (data: {
    callId: string;
    callerId: number;
    callerUsername: string;
    callerAvatar?: string | null;
    callerColor?: string;
  }) => {
    if (callState !== 'idle' && currentCall?.callId === data.callId) return;
    if (callState !== 'idle' && callState !== 'incoming_ringing') return;
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
    callSoundEngine.startIncomingRing();
  };

  const applyParsedIncomingPayload = (parsed: ParsedIncomingCallPayload | null) => {
    if (!parsed) return;
    if (parsed.callType === 'voice_room' && parsed.roomId) {
      window.dispatchEvent(
        new CustomEvent('kaps:incoming_voice_invite', {
          detail: parsed,
        })
      );
      return;
    }

    if (parsed.autoAction === 'reject') {
      if (socket?.connected) {
        socket.emit('direct_call_reject', { callId: parsed.callId });
      }
      cleanupCall();
      return;
    }

    if (parsed.autoAction === 'accept') {
      pendingAutoAcceptCallIdRef.current = parsed.callId;
    }

    triggerIncomingCall({
      callId: parsed.callId,
      callerId: parsed.callerId,
      callerUsername: parsed.callerUsername,
      callerAvatar: parsed.callerAvatar,
      callerColor: parsed.callerColor,
    });
  };

  // Immediately inspect URL query parameters on boot (before socket connects)
  useEffect(() => {
    const parsed = parseIncomingCallFromSearch(window.location.search);
    if (parsed) {
      applyParsedIncomingPayload(parsed);
      // Clean URL query params while preserving history state
      try {
        const cleanUrl = window.location.pathname;
        window.history.replaceState(window.history.state, '', cleanUrl);
      } catch {}
    }
  }, []);

  // Listen to Service Worker push/action messages even if socket is still connecting
  useEffect(() => {
    const onSwMessage = (event: MessageEvent) => {
      const msgType = event.data?.type;
      if (msgType === 'kaps:incoming_call_push' || msgType === 'kaps:incoming_call_action') {
        const parsed = parseIncomingCallFromPushAlert(
          event.data?.alert,
          event.data?.action || 'open'
        );
        if (parsed) {
          applyParsedIncomingPayload(parsed);
        }
        if (socket?.connected) {
          socket.emit('direct_call_pending');
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [socket, callState, currentCall]);

  useEffect(() => {
    const onSimulateIncoming = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {};
      triggerIncomingCall({
        callId: detail.callId || `sim-call-${Date.now()}`,
        callerId: detail.callerId || 999,
        callerUsername: detail.callerUsername || 'Emirgan',
        callerAvatar: detail.callerAvatar || null,
        callerColor: detail.callerColor || '#10b981',
      });
    };
    window.addEventListener('kaps:simulate_incoming_call', onSimulateIncoming);
    return () => {
      window.removeEventListener('kaps:simulate_incoming_call', onSimulateIncoming);
    };
  }, [callState]);

  // Auto-accept when user tapped "📞 Yanıtla" on the background notification and socket connects
  useEffect(() => {
    if (
      pendingAutoAcceptCallIdRef.current &&
      currentCall &&
      currentCall.callId === pendingAutoAcceptCallIdRef.current &&
      callState === 'incoming_ringing' &&
      socket?.connected
    ) {
      pendingAutoAcceptCallIdRef.current = null;
      void acceptCall();
    }
  }, [callState, currentCall, socket?.connected]);

  // Listen for socket signaling events
  useEffect(() => {
    if (!socket) return;

    const incoming = (data: {
      callId: string;
      callerId: number;
      callerUsername: string;
      callerAvatar?: string | null;
      callerColor?: string;
    }) => {
      triggerIncomingCall(data);
    };
    socket.on('direct_call_incoming', incoming);
    const checkPending = () => {
      if (socket.connected) socket.emit('direct_call_pending');
    };
    socket.on('connect', checkPending);
    if (callState === 'idle' && socket.connected) checkPending();

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && callState === 'idle') {
        checkPending();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

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
          const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS }).catch((err) => {
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
          videoSenderRef.current = pc.addTransceiver('video', { direction: 'sendrecv' }).sender;

          pc.onicecandidate = (event) => {
            if (event.candidate) {
              socket.emit('direct_call_signal_ice', { callId: data.callId, candidate: event.candidate });
            }
          };

          pc.ontrack = attachRemoteTrack;

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
        const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS }).catch((err) => {
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
        videoSenderRef.current = pc.addTransceiver('video', { direction: 'sendrecv' }).sender;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('direct_call_signal_ice', { callId: data.callId, candidate: event.candidate });
          }
        };

        pc.ontrack = attachRemoteTrack;

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected') {
            setCallState('connected');
          } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
            cleanupCall();
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        await flushIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('direct_call_signal_answer', { callId: data.callId, answer });

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
        if (peerConnectionRef.current.remoteDescription) await flushIce(peerConnectionRef.current);
      }
    });

    socket.on('direct_call_signal_ice', async (data: { callId: string; candidate: any }) => {
      if (!data.candidate) return;
      const pc = peerConnectionRef.current;
      if (!pc?.remoteDescription) pendingIceRef.current.push(data.candidate);
      else await pc.addIceCandidate(data.candidate).catch(error => console.warn('Arama ICE hatası:', error));
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
      socket.off('direct_call_incoming', incoming);
      socket.off('connect', checkPending);
      socket.off('direct_call_accepted');
      socket.off('direct_call_signal_offer');
      socket.off('direct_call_signal_answer');
      socket.off('direct_call_signal_ice');
      socket.off('direct_call_rejected');
      socket.off('direct_call_timeout');
      socket.off('direct_call_ended');
      document.removeEventListener('visibilitychange', onVisibility);
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
    if (!currentCall || callState !== 'incoming_ringing') return;
    if (!socket || !socket.connected) {
      callSoundEngine.stopAll();
      onShowToast?.('Aramayı yanıtlamak için bağlantı bekleniyor.', 'info');
      return;
    }

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
    if (!currentCall) return;
    if (socket?.connected) {
      socket.emit('direct_call_reject', { callId: currentCall.callId });
    }
    cleanupCall();
  };

  const endCall = () => {
    if (!currentCall) return;
    if (socket?.connected) {
      socket.emit('direct_call_end', { callId: currentCall.callId });
    }
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

  const toggleCamera = async () => {
    const sender = videoSenderRef.current;
    if (!sender || callState !== 'connected') return;
    if (sender.track) {
      const oldTrack = sender.track;
      await sender.replaceTrack(null);
      oldTrack.stop();
      localStreamRef.current?.removeTrack(oldTrack);
      setLocalStream(current => current ? new MediaStream(current.getAudioTracks()) : null);
      setIsCameraOn(false);
      return;
    }
    try {
      const camera = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      const track = camera.getVideoTracks()[0];
      if (!track) throw new Error('Kamera bulunamadı');
      try { await sender.replaceTrack(track); }
      catch (error) { track.stop(); throw error; }
      track.onended = () => { setIsCameraOn(false); };
      setLocalStream(current => new MediaStream([...(current?.getAudioTracks() || []), track]));
      localStreamRef.current?.addTrack(track);
      setIsCameraOn(true);
    } catch (error) {
      console.warn('Arama kamerası açılamadı:', error);
      onShowToast?.('Kamera açılamadı. Kamera iznini kontrol edin.', 'error');
    }
  };

  const toggleAudioOutput = async () => {
    const devices = navigator.mediaDevices as MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> };
    if (!ensureRemoteAudio().setSinkId) {
      onShowToast?.('Bu tarayıcı ses çıkışını seçtirmiyor. Ahize, hoparlör veya Bluetooth için telefonun sistem ses menüsünü kullanın.', 'info');
      return;
    }
    try {
      if (devices?.selectAudioOutput) {
        const selected = await devices.selectAudioOutput();
        setAudioOutputs(previous => [...previous.filter(d => d.deviceId !== selected.deviceId), selected]);
        await selectAudioOutput(selected.deviceId, selected.label);
      } else {
        onShowToast?.('Ses çıkışı listesinden izin verilen cihazı seçin. Listelenmeyen ahize veya Bluetooth için sistem ses menüsünü kullanın.', 'info');
      }
    } catch (error) {
      if ((error as DOMException).name !== 'NotAllowedError') onShowToast?.('Ses cihazı seçilemedi. Sistem ses çıkışı menüsünü kullanın.', 'info');
    }
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
        isCameraOn,
        toggleCamera,
        audioOutputMode,
        audioOutputs, audioOutputId, audioOutputLabel, selectAudioOutput,
        toggleAudioOutput,
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
