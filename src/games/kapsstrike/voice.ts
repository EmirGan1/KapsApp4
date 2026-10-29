import type { Socket } from "socket.io-client";

export interface VoiceParticipantInfo {
  userId: number;
  username: string;
  isSpeaking: boolean;
  volume: number; // 0 to 1.5
  mutedByLocal: boolean;
}

export class StrikeVoiceManager {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private peerConnections = new Map<number, RTCPeerConnection>();
  private remoteGainNodes = new Map<number, GainNode>();
  private remoteAudioElements = new Map<number, HTMLAudioElement>();
  private speakingListeners = new Set<(speakingMap: Map<number, boolean>) => void>();
  private speakingMap = new Map<number, boolean>();
  private isMuted = true;
  private isPushToTalk = true;
  private isPttActive = false;
  private animFrameId: number | null = null;
  private activeRoomId: string | null = null;

  constructor(
    private socket: Socket | null,
    private currentUserId: number,
    private username: string
  ) {
    this.setupSocket();
  }

  private setupSocket() {
    if (!this.socket) return;

    this.socket.on("strike:voice_signal", async (payload: {
      fromUserId: number;
      fromSocketId: string;
      data: any;
      speaking?: boolean;
    }) => {
      const { fromUserId, data, speaking } = payload;

      if (typeof speaking === "boolean") {
        this.speakingMap.set(fromUserId, speaking);
        this.notifySpeaking();
      }

      if (!data) return;

      try {
        if (data.type === "offer") {
          await this.handleOffer(fromUserId, data.sdp);
        } else if (data.type === "answer") {
          await this.handleAnswer(fromUserId, data.sdp);
        } else if (data.type === "candidate") {
          await this.handleCandidate(fromUserId, data.candidate);
        }
      } catch (err) {
        console.warn("[StrikeVoice] Signaling handle error:", err);
      }
    });
  }

  public async initMicrophone(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.localStream) return { success: true };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1,
        },
        video: false,
      });

      this.localStream = stream;

      // Start muted by default or apply current state
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted && (!this.isPushToTalk || this.isPttActive);
      });

      this.setupLocalAudioAnalysis(stream);
      return { success: true };
    } catch (err: any) {
      const msg =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Mikrofon izni verilmedi. Oyun içi ses kapalı devam edebilirsiniz."
          : "Mikrofon başlatılamadı.";
      return { success: false, error: msg };
    }
  }

  private setupLocalAudioAnalysis(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      let wasSpeaking = false;

      const check = () => {
        if (!this.analyser || !this.localStream) return;
        const track = this.localStream.getAudioTracks()[0];
        if (track && track.enabled) {
          this.analyser.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) sum += buffer[i];
          const avg = sum / buffer.length;
          const isSpeakingNow = avg > 18;

          if (isSpeakingNow !== wasSpeaking) {
            wasSpeaking = isSpeakingNow;
            this.speakingMap.set(this.currentUserId, isSpeakingNow);
            this.notifySpeaking();
            if (this.socket && this.activeRoomId) {
              this.socket.emit("strike:voice_signal", { speaking: isSpeakingNow });
            }
          }
        } else if (wasSpeaking) {
          wasSpeaking = false;
          this.speakingMap.set(this.currentUserId, false);
          this.notifySpeaking();
          if (this.socket && this.activeRoomId) {
            this.socket.emit("strike:voice_signal", { speaking: false });
          }
        }
        this.animFrameId = requestAnimationFrame(check);
      };
      check();
    } catch (e) {
      console.warn("[StrikeVoice] Audio analysis setup error:", e);
    }
  }

  public joinRoomVoice(roomId: string, otherUserIds: number[]) {
    this.activeRoomId = roomId;
    // Create peer connections to other players in room
    for (const remoteId of otherUserIds) {
      if (remoteId === this.currentUserId) continue;
      this.initiatePeerConnection(remoteId);
    }
  }

  private getOrCreatePeer(remoteUserId: number): RTCPeerConnection {
    let pc = this.peerConnections.get(remoteUserId);
    if (pc) return pc;

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.activeRoomId) {
        this.socket.emit("strike:voice_signal", {
          targetUserId: remoteUserId,
          data: { type: "candidate", candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      this.attachRemoteStream(remoteUserId, remoteStream);
    };

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    this.peerConnections.set(remoteUserId, pc);
    return pc;
  }

  private async initiatePeerConnection(remoteUserId: number) {
    try {
      const pc = this.getOrCreatePeer(remoteUserId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      if (this.socket && this.activeRoomId) {
        this.socket.emit("strike:voice_signal", {
          targetUserId: remoteUserId,
          data: { type: "offer", sdp: pc.localDescription },
        });
      }
    } catch (err) {
      console.warn("[StrikeVoice] initiatePeerConnection error:", err);
    }
  }

  private async handleOffer(fromUserId: number, sdp: RTCSessionDescriptionInit) {
    try {
      const pc = this.getOrCreatePeer(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.socket && this.activeRoomId) {
        this.socket.emit("strike:voice_signal", {
          targetUserId: fromUserId,
          data: { type: "answer", sdp: pc.localDescription },
        });
      }
    } catch (err) {
      console.warn("[StrikeVoice] handleOffer error:", err);
    }
  }

  private async handleAnswer(fromUserId: number, sdp: RTCSessionDescriptionInit) {
    try {
      const pc = this.peerConnections.get(fromUserId);
      if (pc && pc.signalingState !== "closed") {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    } catch (err) {
      console.warn("[StrikeVoice] handleAnswer error:", err);
    }
  }

  private async handleCandidate(fromUserId: number, candidate: RTCIceCandidateInit) {
    try {
      const pc = this.peerConnections.get(fromUserId);
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.warn("[StrikeVoice] handleCandidate error:", err);
    }
  }

  private attachRemoteStream(remoteUserId: number, stream: MediaStream) {
    try {
      let audio = this.remoteAudioElements.get(remoteUserId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.remoteAudioElements.set(remoteUserId, audio);
      }
      audio.srcObject = stream;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn("[StrikeVoice] attachRemoteStream error:", e);
    }
  }

  public setPlayerVolume(remoteUserId: number, volume: number) {
    const audio = this.remoteAudioElements.get(remoteUserId);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    this.updateTrackState();
  }

  public setPushToTalk(enabled: boolean) {
    this.isPushToTalk = enabled;
    this.updateTrackState();
  }

  public setPttActive(active: boolean) {
    this.isPttActive = active;
    this.updateTrackState();
  }

  private updateTrackState() {
    if (!this.localStream) return;
    const canSpeak = !this.isMuted && (!this.isPushToTalk || this.isPttActive);
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = canSpeak;
    }
  }

  public onSpeakingChange(fn: (speakingMap: Map<number, boolean>) => void) {
    this.speakingListeners.add(fn);
    fn(this.speakingMap);
    return () => this.speakingListeners.delete(fn);
  }

  private notifySpeaking() {
    for (const listener of this.speakingListeners) {
      listener(this.speakingMap);
    }
  }

  public leaveVoice() {
    this.activeRoomId = null;
    for (const pc of this.peerConnections.values()) {
      try {
        pc.close();
      } catch {}
    }
    this.peerConnections.clear();
    for (const audio of this.remoteAudioElements.values()) {
      try {
        audio.srcObject = null;
        audio.pause();
      } catch {}
    }
    this.remoteAudioElements.clear();
    this.speakingMap.clear();
    this.notifySpeaking();
  }

  public dispose() {
    this.leaveVoice();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      this.localStream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch {}
    }
    this.speakingListeners.clear();
  }
}
