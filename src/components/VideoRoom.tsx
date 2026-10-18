import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Headphones, 
  PhoneOff, 
  Crown, 
  Camera, 
  CameraOff, 
  MoreVertical, 
  X, 
  VolumeX, 
  AlertCircle,
  Radio,
  Monitor,
  MonitorOff,
  Volume2,
  Volume1,
  ChevronUp,
  UserPlus,
  Sliders,
  Sparkles,
  Tv,
  Smartphone,
  Maximize2,
  ShieldCheck,
  Check,
  SwitchCamera,
  ZoomIn
} from 'lucide-react';
import { VoiceParticipant } from '../types';
import Avatar from './Avatar';
import VideoCell from './VideoCell';
import VoiceInviteModal from './VoiceInviteModal';
import MediaSettingsModal from './MediaSettingsModal';
import ScreenShareModal from './ScreenShareModal';
import { 
  CameraResolutionMode, 
  NoiseSuppressionMode, 
  VideoAspectRatioMode, 
  VideoFitMode,
  isMobileOrTablet
} from '../utils/webrtcConfig';

interface VideoTileProps {
  participant: VoiceParticipant;
  isSelf: boolean;
  isHost: boolean;
  isCurrentRoomHost: boolean;
  stream: MediaStream | null;
  isDeafened: boolean;
  isScreenSharing?: boolean;
  isScreenAudioEnabled?: boolean;
  isSpotlight?: boolean;
  aspectRatioMode?: VideoAspectRatioMode;
  fitMode?: VideoFitMode;
  onKick?: (userId: number) => void;
  onForceMute?: (userId: number) => void;
  onForceCameraOff?: (userId: number) => void;
  onUserClick?: (userId: number) => void;
}

export const VideoTile = React.memo(({
  participant,
  isSelf,
  isHost,
  isCurrentRoomHost,
  stream,
  isDeafened,
  isScreenSharing = false,
  isScreenAudioEnabled = false,
  isSpotlight = false,
  aspectRatioMode = 'auto',
  fitMode = 'cover',
  onKick,
  onForceMute,
  onForceCameraOff,
  onUserClick
}: VideoTileProps) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check if stream has active video track
  const videoTrack = stream ? stream.getVideoTracks()[0] : null;
  const isSharingActive = isScreenSharing || Boolean(participant.isScreenSharing);
  const hasLiveVideoTrack = Boolean(
    videoTrack && 
    (videoTrack.readyState === 'live' || isVideoPlaying) && 
    videoTrack.enabled && 
    (!participant.isVideoOff || isSharingActive)
  );

  // Outside click handler for host control dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const showVideo = Boolean(hasLiveVideoTrack || (isSharingActive && stream));

  // Dynamic aspect ratio calculation
  const aspectClass = isSharingActive || isSpotlight
    ? 'w-full h-full'
    : aspectRatioMode === 'landscape'
    ? 'aspect-video w-full max-h-full max-w-full mx-auto'
    : aspectRatioMode === 'portrait'
    ? 'aspect-[9/16] h-full max-h-full max-w-full mx-auto'
    : 'w-full h-full';

  return (
    <div className={`relative ${aspectClass} rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-200 flex flex-col justify-between shadow-md group ${
      isSharingActive
        ? 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.45)] ring-2 ring-blue-500/80'
        : participant.isSpeaking
        ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-500/80'
        : 'border-slate-800 hover:border-slate-700'
    }`}>
      
      {/* Video Stream Element with Anti-Black Screen VideoCell */}
      {stream && (
        <div className={`absolute inset-0 w-full h-full bg-neutral-950 transition-opacity duration-300 ${
          showVideo ? 'opacity-100 z-0' : 'opacity-0 -z-10 pointer-events-none'
        }`}>
          <VideoCell
            stream={stream}
            isLocal={isSelf}
            isScreenSharing={isSharingActive}
            username={participant.username}
            fitMode={fitMode}
            onVideoPlaying={setIsVideoPlaying}
          />
        </div>
      )}

      {/* Video Off / Fallback: Centered Avatar Placeholder */}
      {!showVideo && (
        <div 
          onClick={() => onUserClick && onUserClick(participant.id)}
          className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 cursor-pointer select-none"
        >
          <div className="relative">
            <div 
              className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-black text-xl sm:text-2xl text-white shadow-xl transition-all duration-300 ${
                participant.isSpeaking
                  ? 'ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-900 scale-105 animate-pulse'
                  : 'ring-2 ring-slate-700'
              }`}
            >
              <Avatar url={participant.avatar} color={participant.color} name={participant.username} size={14} />
            </div>

            {/* Camera Off Mini Badge */}
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800/90 text-slate-300 flex items-center justify-center border-2 border-slate-900 shadow">
              <CameraOff size={11} />
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-2.5 bg-slate-800/70 px-2 py-0.5 rounded-full border border-slate-700/60">
            {isSharingActive ? 'Ekran Aktarılıyor...' : 'Kamera Kapalı'}
          </span>
        </div>
      )}

      {/* Top Overlay: Badges & Host Actions Menu */}
      <div className="relative z-10 p-2 sm:p-2.5 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {isScreenSharing && (
            <span className="px-2 py-0.5 rounded-lg bg-blue-600/90 text-white text-[10px] font-black flex items-center gap-1.5 shadow-md border border-blue-400/40 animate-pulse">
              <Monitor size={11} />
              <span>Ekran Paylaşımı</span>
              {(isScreenAudioEnabled || participant.isScreenAudioEnabled) && (
                <span className="flex items-center gap-0.5 text-emerald-300 bg-blue-800/90 px-1.5 py-0.2 rounded border border-emerald-400/30 font-bold" title="Ekran Sesi Paylaşılıyor">
                  <Volume2 size={10} />
                  <span>Ses Açık</span>
                </span>
              )}
            </span>
          )}
          {isHost && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-slate-950 text-[10px] font-black flex items-center gap-1 shadow-sm">
              <Crown size={10} />
              Host
            </span>
          )}
          {participant.isMuted && (
            <span className="p-1 rounded bg-rose-600/90 text-white text-[10px] font-bold flex items-center shadow-sm" title="Mikrofon Kapalı">
              <MicOff size={11} />
            </span>
          )}
          {!isScreenSharing && participant.isVideoOff && (
            <span className="p-1 rounded bg-slate-800/90 text-slate-300 text-[10px] font-bold flex items-center shadow-sm" title="Kamera Kapalı">
              <VideoOff size={11} />
            </span>
          )}
        </div>

        {/* Host Control Actions Dropdown */}
        {isCurrentRoomHost && !isSelf && (
          <div className="relative pointer-events-auto" ref={menuRef}>
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Yönetici İşlemleri"
              className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 text-white/80 hover:text-white flex items-center justify-center backdrop-blur-sm transition-colors border border-white/10 cursor-pointer"
            >
              <MoreVertical size={14} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-700 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-800 truncate">
                  {participant.username}
                </div>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceMute && onForceMute(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-amber-400 hover:bg-amber-950/40 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <MicOff size={13} />
                  <span>Sustur (Mute)</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onForceCameraOff && onForceCameraOff(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-blue-400 hover:bg-blue-950/40 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <CameraOff size={13} />
                  <span>Kamerayı Kapatmaya Zorla</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onKick && onKick(participant.id);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <X size={13} />
                  <span>Odadan At (Kick)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Overlay: Participant Name & Speaking Pulse */}
      <div className="relative z-10 p-2 sm:p-2.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-sm">
            {participant.username} {isSelf && '(Sen)'}
          </span>
        </div>

        {participant.isSpeaking && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            Konuşuyor
          </span>
        )}
      </div>
    </div>
  );
});

VideoTile.displayName = 'VideoTile';

interface VideoRoomViewProps {
  roomId?: string;
  roomName: string;
  hostUsername: string;
  maxParticipants: number;
  participants: VoiceParticipant[];
  currentUserId: number;
  isHost: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing?: boolean;
  isScreenAudioEnabled?: boolean;
  isScreenShareSupported?: boolean;
  isDeafened: boolean;
  isSpeakingLocal: boolean;
  mediaPermissionError: string | null;
  socket?: Socket | null;
  resolution?: CameraResolutionMode;
  noiseSuppressionLevel?: NoiseSuppressionMode;
  audioOutputMode?: 'speaker' | 'earpiece';
  cameraFacingMode?: 'user' | 'environment';
  cameraZoom?: number;
  cameraZoomRange?: { min: number; max: number; step: number };
  onChangeResolution?: (res: CameraResolutionMode) => void;
  onChangeNoiseSuppression?: (level: NoiseSuppressionMode) => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare?: (withAudio?: boolean) => void;
  onStartScreenShare?: (withAudio: boolean) => void;
  onStopScreenShare?: () => void;
  onToggleDeafen: () => void;
  onToggleAudioOutput?: () => void;
  onToggleCameraFacingMode?: () => void;
  onChangeCameraZoom?: (zoom: number) => void;
  onLeaveRoom: () => void;
  onKickUser?: (userId: number) => void;
  onForceMuteUser?: (userId: number) => void;
  onForceCameraOffUser?: (userId: number) => void;
  onUserClick?: (userId: number) => void;
}

export function VideoRoomView({
  roomId,
  roomName,
  hostUsername,
  maxParticipants,
  participants,
  currentUserId,
  isHost,
  localStream,
  remoteStreams,
  isMuted,
  isVideoOff,
  isScreenSharing = false,
  isScreenAudioEnabled = false,
  isScreenShareSupported = true,
  isDeafened,
  isSpeakingLocal,
  mediaPermissionError,
  socket,
  resolution = 'auto',
  noiseSuppressionLevel = 'high',
  audioOutputMode = 'speaker',
  cameraFacingMode = 'user',
  cameraZoom = 1,
  cameraZoomRange = { min: 1, max: 1, step: 0.1 },
  onChangeResolution,
  onChangeNoiseSuppression,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onStartScreenShare,
  onStopScreenShare,
  onToggleDeafen,
  onToggleAudioOutput,
  onToggleCameraFacingMode,
  onChangeCameraZoom,
  onLeaveRoom,
  onKickUser,
  onForceMuteUser,
  onForceCameraOffUser,
  onUserClick
}: VideoRoomViewProps) {
  const count = participants.length;

  // Find if someone is currently sharing screen
  const screenSharer = participants.find((p) => {
    if (p.id === currentUserId) return isScreenSharing || p.isScreenSharing;
    return p.isScreenSharing;
  });

  const isSpotlightMode = Boolean(screenSharer);
  const [isStartingShare, setIsStartingShare] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Aspect ratio and fit mode states (persisted in localStorage)
  const [aspectRatioMode, setAspectRatioMode] = useState<VideoAspectRatioMode>(() => {
    return (localStorage.getItem('kapsapp_video_aspect_mode') as VideoAspectRatioMode) || 'auto';
  });
  const [fitMode, setFitMode] = useState<VideoFitMode>(() => {
    return (localStorage.getItem('kapsapp_video_fit_mode') as VideoFitMode) || 'cover';
  });

  const handleAspectRatioChange = (mode: VideoAspectRatioMode) => {
    setAspectRatioMode(mode);
    try {
      localStorage.setItem('kapsapp_video_aspect_mode', mode);
    } catch (e) {}
  };

  const handleFitModeChange = (mode: VideoFitMode) => {
    setFitMode(mode);
    try {
      localStorage.setItem('kapsapp_video_fit_mode', mode);
    } catch (e) {}
  };

  const cycleAspectRatio = () => {
    const next: VideoAspectRatioMode = 
      aspectRatioMode === 'auto' ? 'landscape' :
      aspectRatioMode === 'landscape' ? 'portrait' : 'auto';
    handleAspectRatioChange(next);
  };

  const cycleNoiseSuppression = () => {
    if (!onChangeNoiseSuppression) return;
    const current = noiseSuppressionLevel || 'high';
    const next: NoiseSuppressionMode = 
      current === 'high' ? 'standard' :
      current === 'standard' ? 'off' : 'high';
    onChangeNoiseSuppression(next);
  };

  // Dynamic Screen-Filling Smart Grid calculation tailored for mobile & desktop (eliminates empty side bars)
  const getGridClasses = (total: number) => {
    if (total <= 1) {
      return 'w-full h-full max-w-5xl mx-auto flex items-center justify-center p-1 sm:p-2';
    }
    if (total === 2) {
      // 2 People: Screen-filling responsive grid
      // On desktop / landscape: 2 columns, 1 row (fills 100% width and 100% height without empty pillars)
      // On mobile / portrait: 1 column, 2 rows (fills 100% width and 50% height each, zero wasted margins)
      return 'grid grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1 gap-2 sm:gap-3 w-full h-full flex-1 auto-rows-fr';
    }
    if (total <= 4) {
      // 2x2 grid filling entire area
      return 'grid grid-cols-2 grid-rows-2 gap-2 sm:gap-3 w-full h-full flex-1 auto-rows-fr';
    }
    if (total <= 6) {
      return 'grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full h-full flex-1 auto-rows-fr';
    }
    if (total <= 9) {
      return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2 w-full h-full flex-1 auto-rows-fr';
    }
    if (total <= 12) {
      return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 sm:gap-2 w-full h-full flex-1 auto-rows-fr';
    }
    if (total <= 16) {
      return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 gap-1.5 sm:gap-2 w-full h-full flex-1 auto-rows-fr';
    }
    return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 w-full h-full flex-1 auto-rows-fr';
  };

  // Direct, unblocked screen share invocation with debounce - zero delay, preserves user activation token
  const lastTriggerTimeRef = useRef(0);
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);

  // Invoke screen share with specified audio setting
  const startSharingProcess = useCallback(async (withAudio: boolean = false) => {
    setIsStartingShare(true);
    try {
      if (onStartScreenShare) {
        await onStartScreenShare(withAudio);
      } else if (onToggleScreenShare) {
        await onToggleScreenShare(withAudio);
      }
    } catch (triggerErr) {
      console.warn('[ScreenShare] Start trigger error:', triggerErr);
    } finally {
      setIsStartingShare(false);
    }
  }, [onStartScreenShare, onToggleScreenShare]);

  // Click on screen share button: if already active -> stop; if not active -> on PC open modal, on mobile start directly
  const handleScreenShareClick = useCallback((e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const now = Date.now();
    if (now - lastTriggerTimeRef.current < 400) {
      return;
    }
    lastTriggerTimeRef.current = now;

    if (isScreenSharing) {
      if (onStopScreenShare) {
        onStopScreenShare();
      } else if (onToggleScreenShare) {
        onToggleScreenShare();
      }
    } else {
      const isMobile = isMobileOrTablet();
      if (isMobile) {
        // Mobile browsers cannot capture system audio via getDisplayMedia
        startSharingProcess(false);
      } else {
        // On PC / Desktop: open modal to let user choose screen sound!
        setShowScreenShareModal(true);
      }
    }
  }, [isScreenSharing, onStopScreenShare, onToggleScreenShare, startSharingProcess]);

  const handleConfirmScreenShare = useCallback(async (withAudio: boolean) => {
    setShowScreenShareModal(false);
    await startSharingProcess(withAudio);
  }, [startSharingProcess]);

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full max-h-[100dvh] w-full overflow-hidden relative bg-slate-950">
      
      {/* Top Header Bar */}
      <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Radio size={18} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-white truncate">
              {roomName}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <Crown size={12} className="text-amber-500" />
                {hostUsername}
              </span>
              <span>•</span>
              <span className="font-semibold text-blue-400">{count}/{maxParticipants} Kişi</span>
              {isSpotlightMode && (
                <>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Monitor size={12} />
                    <span>{screenSharer?.username} ekran paylaşıyor</span>
                    {(screenSharer?.isScreenAudioEnabled || (screenSharer?.id === currentUserId && isScreenAudioEnabled)) && (
                      <span className="flex items-center gap-0.5 text-blue-300 bg-blue-950/90 px-1.5 py-0.2 rounded border border-blue-500/30 text-[10px] font-bold">
                        <Volume2 size={10} />
                        <span>Sesli</span>
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Actions: Quick Aspect, Settings, Invite User & Leave Room */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Quick Aspect Ratio Toggle */}
          <button
            onClick={cycleAspectRatio}
            className="min-h-[36px] px-2.5 sm:px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
            title={`Görünüm Oranı: ${aspectRatioMode.toUpperCase()} (Değiştirmek için tıkla)`}
          >
            {aspectRatioMode === 'landscape' ? (
              <Tv size={14} className="text-blue-400" />
            ) : aspectRatioMode === 'portrait' ? (
              <Smartphone size={14} className="text-blue-400" />
            ) : (
              <Maximize2 size={14} className="text-blue-400" />
            )}
            <span className="hidden md:inline">
              {aspectRatioMode === 'auto' ? 'Otomatik' : aspectRatioMode === 'landscape' ? '16:9' : '9:16'}
            </span>
          </button>

          {/* Quick Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="min-h-[36px] px-2.5 sm:px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
            title="Medya, Çözünürlük ve Gürültü Ayarları"
          >
            <Sliders size={14} className="text-purple-400" />
            <span className="hidden sm:inline">Ayarlar</span>
            {resolution !== 'auto' && (
              <span className="text-[10px] font-black text-purple-400 bg-purple-950/80 px-1 py-0.2 rounded border border-purple-500/30">
                {resolution}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowInviteModal(true)}
            className="min-h-[36px] px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all active:scale-95 shadow-sm shrink-0 cursor-pointer"
            title="Kullanıcı Davet Et"
          >
            <UserPlus size={15} />
            <span className="hidden xs:inline">Davet Et</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="min-h-[36px] px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all active:scale-95 shadow-sm shrink-0 cursor-pointer"
          >
            <PhoneOff size={15} />
            <span className="hidden xs:inline">Ayrıl</span>
          </button>
        </div>
      </div>

      {/* Permission alert */}
      {mediaPermissionError && (
        <div className="mx-4 mt-3 p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-center gap-2 shrink-0">
          <AlertCircle size={16} className="shrink-0 text-amber-400" />
          <span>{mediaPermissionError}</span>
        </div>
      )}

      {/* Video Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-3 pb-24 sm:pb-28 flex flex-col justify-center items-center touch-pan-y overscroll-y-contain w-full h-full">
        
        {/* Spotlight Mode: Large Screen Share with Participant Thumbnails Below */}
        {isSpotlightMode && screenSharer ? (
          <div className="w-full h-full max-w-6xl mx-auto flex flex-col gap-3 justify-center items-center">
            
            {/* Featured Large Screen Share Tile */}
            <div className="w-full flex-1 min-h-[220px] max-h-[62vh] sm:max-h-[66vh] rounded-2xl overflow-hidden shadow-2xl">
              {(() => {
                const isSelf = screenSharer.id === currentUserId;
                const stream = isSelf ? localStream : (remoteStreams.get(screenSharer.socketId) || null);
                return (
                  <VideoTile
                    participant={screenSharer}
                    isSelf={isSelf}
                    isHost={screenSharer.isHost}
                    isCurrentRoomHost={isHost}
                    stream={stream}
                    isDeafened={isDeafened}
                    isScreenSharing={true}
                    isSpotlight={true}
                    aspectRatioMode={aspectRatioMode}
                    fitMode={fitMode}
                    onKick={onKickUser}
                    onForceMute={onForceMuteUser}
                    onForceCameraOff={onForceCameraOffUser}
                    onUserClick={onUserClick}
                  />
                );
              })()}
            </div>

            {/* Other Participants Strip Below */}
            {participants.length > 1 && (
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 shrink-0 max-h-[120px] sm:max-h-[140px]">
                {participants
                  .filter((p) => p.id !== screenSharer.id)
                  .map((participant) => {
                    const isSelf = participant.id === currentUserId;
                    const stream = isSelf ? localStream : (remoteStreams.get(participant.socketId) || null);

                    return (
                      <div key={participant.id} className="w-full h-[110px] sm:h-[130px]">
                        <VideoTile
                          participant={participant}
                          isSelf={isSelf}
                          isHost={participant.isHost}
                          isCurrentRoomHost={isHost}
                          stream={stream}
                          isDeafened={isDeafened}
                          isScreenSharing={isSelf ? isScreenSharing : Boolean(participant.isScreenSharing)}
                          aspectRatioMode={aspectRatioMode}
                          fitMode={fitMode}
                          onKick={onKickUser}
                          onForceMute={onForceMuteUser}
                          onForceCameraOff={onForceCameraOffUser}
                          onUserClick={onUserClick}
                        />
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          /* Normal Dynamic Screen-Filling Smart Grid */
          <div className="w-full h-full flex-1 flex flex-col justify-center items-center">
            <div className={getGridClasses(count)}>
              {participants.map((participant) => {
                const isSelf = participant.id === currentUserId;
                const stream = isSelf 
                  ? localStream 
                  : (remoteStreams.get(participant.socketId) || null);

                return (
                  <div key={participant.id} className="w-full h-full flex items-center justify-center min-h-0 overflow-hidden">
                    <VideoTile
                      participant={participant}
                      isSelf={isSelf}
                      isHost={participant.isHost}
                      isCurrentRoomHost={isHost}
                      stream={stream}
                      isDeafened={isDeafened}
                      isScreenSharing={isSelf ? isScreenSharing : Boolean(participant.isScreenSharing)}
                      aspectRatioMode={aspectRatioMode}
                      fitMode={fitMode}
                      onKick={onKickUser}
                      onForceMute={onForceMuteUser}
                      onForceCameraOff={onForceCameraOffUser}
                      onUserClick={onUserClick}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Bottom Control Dock */}
      <div className="absolute bottom-4 left-0 right-0 px-2 sm:px-4 flex justify-center z-40 pointer-events-none pb-safe">
        <div className="relative pointer-events-auto touch-manipulation z-50 w-full max-w-2xl px-2">
          <div className="bg-slate-900/95 backdrop-blur-xl px-2.5 sm:px-5 py-2 sm:py-3 rounded-2xl border border-slate-800 shadow-2xl flex items-center gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar scroll-smooth justify-start sm:justify-around w-full">
            
            {/* Mic Button */}
            <button
              onClick={onToggleMute}
              title={isMuted ? 'Mikrofonu Aç' : 'Mikrofonu Kapat'}
              className={`min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer touch-manipulation shrink-0 ${
                isMuted
                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30'
                  : isSpeakingLocal
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isMuted ? <MicOff size={19} className="pointer-events-none" /> : <Mic size={19} className="pointer-events-none" />}
            </button>

            {/* AI Noise Suppression Quick Button */}
            <button
              onClick={cycleNoiseSuppression}
              title={`Gürültü Engelleme: ${
                noiseSuppressionLevel === 'high' ? 'Yüksek (AI Filtre)' : noiseSuppressionLevel === 'standard' ? 'Standart' : 'Kapalı'
              } (Değiştirmek için tıkla)`}
              className={`min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl flex flex-col items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer touch-manipulation shrink-0 ${
                noiseSuppressionLevel === 'high'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 ring-2 ring-amber-500/30'
                  : noiseSuppressionLevel === 'standard'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
              }`}
            >
              {noiseSuppressionLevel === 'high' ? (
                <Sparkles size={16} className="text-amber-400" />
              ) : noiseSuppressionLevel === 'standard' ? (
                <ShieldCheck size={16} className="text-blue-400" />
              ) : (
                <Mic size={16} className="text-slate-400" />
              )}
              <span className="text-[8.5px] font-black uppercase tracking-tighter mt-0.5">
                {noiseSuppressionLevel === 'high' ? 'AI' : noiseSuppressionLevel === 'standard' ? 'STD' : 'OFF'}
              </span>
            </button>

            {/* Camera Button */}
            <button
              onClick={onToggleVideo}
              title={isVideoOff ? 'Kamerayı Aç' : 'Kamerayı Kapat'}
              className={`min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer touch-manipulation shrink-0 ${
                isVideoOff
                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-2 ring-rose-500/30'
                  : 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-500/30'
              }`}
            >
              {isVideoOff ? <CameraOff size={19} className="pointer-events-none" /> : <Camera size={19} className="pointer-events-none" />}
            </button>

            {/* Speakerphone / Earpiece Audio Output Mode Toggle Button */}
            {onToggleAudioOutput && (
              <button
                onClick={onToggleAudioOutput}
                title={`Ses Çıkışı: ${audioOutputMode === 'speaker' ? 'Hoparlör (Speaker)' : 'Ahize (Earpiece)'}`}
                className={`min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl flex flex-col items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer touch-manipulation shrink-0 ${
                  audioOutputMode === 'speaker'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 ring-1 ring-blue-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {audioOutputMode === 'speaker' ? <Volume2 size={16} className="text-blue-400" /> : <Volume1 size={16} className="text-slate-300" />}
                <span className="text-[8px] font-black uppercase tracking-tighter mt-0.5">
                  {audioOutputMode === 'speaker' ? 'HOP' : 'AHİZ'}
                </span>
              </button>
            )}

            {/* Quick Aspect Ratio Cycle Button */}
            <button
              onClick={cycleAspectRatio}
              title={`Kamera Görünüm Oranı: ${aspectRatioMode.toUpperCase()} (Tıkla: Değiştir)`}
              className={`min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl flex flex-col items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer touch-manipulation shrink-0 ${
                aspectRatioMode !== 'auto'
                  ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 ring-1 ring-blue-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {aspectRatioMode === 'landscape' ? (
                <Tv size={16} className="text-blue-400" />
              ) : aspectRatioMode === 'portrait' ? (
                <Smartphone size={16} className="text-blue-400" />
              ) : (
                <Maximize2 size={16} />
              )}
              <span className="text-[8.5px] font-black uppercase tracking-tighter mt-0.5">
                {aspectRatioMode === 'auto' ? 'AUTO' : aspectRatioMode === 'landscape' ? '16:9' : '9:16'}
              </span>
            </button>

            {/* Screen Share Button */}
            <button
              type="button"
              onClick={handleScreenShareClick}
              disabled={isStartingShare}
              title={isScreenSharing ? 'Ekran Paylaşımını Durdur' : 'Ekranını Paylaş'}
              className={`min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer relative z-50 pointer-events-auto touch-manipulation select-none shrink-0 ${
                isScreenSharing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-4 ring-emerald-500/40 animate-pulse'
                  : isStartingShare
                  ? 'bg-blue-600/80 text-white ring-2 ring-blue-500/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              aria-label="Ekran Paylaş"
            >
              {isStartingShare ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin pointer-events-none" />
              ) : isScreenSharing ? (
                <MonitorOff size={19} className="pointer-events-none" />
              ) : (
                <Monitor size={19} className="pointer-events-none" />
              )}
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              title="Kamera Çözünürlüğü ve Gelişmiş Ayarlar"
              className="min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <Sliders size={19} />
            </button>

            {/* Deafen Button */}
            <button
              onClick={onToggleDeafen}
              title={isDeafened ? 'Sesi Aç' : 'Kulaklığı Kapat (Sağırlaştır)'}
              className={`min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer shrink-0 ${
                isDeafened
                  ? 'bg-amber-600 hover:bg-amber-500 text-white ring-2 ring-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isDeafened ? <VolumeX size={19} /> : <Headphones size={19} />}
            </button>

            {/* Leave Button */}
            <button
              onClick={onLeaveRoom}
              title="Odadan Ayrıl"
              className="min-w-[42px] min-h-[42px] sm:min-w-[46px] sm:min-h-[46px] rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <PhoneOff size={19} />
            </button>
          </div>
        </div>
      </div>

      {/* Voice Invite Modal */}
      {showInviteModal && (
        <VoiceInviteModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          roomId={roomId || ''}
          roomName={roomName}
          socket={socket || null}
          currentUserId={currentUserId}
        />
      )}

      {/* Media & Camera Settings Modal */}
      <MediaSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        resolution={resolution}
        onChangeResolution={(res) => {
          onChangeResolution && onChangeResolution(res);
        }}
        noiseSuppressionLevel={noiseSuppressionLevel}
        onChangeNoiseSuppression={(lvl) => {
          onChangeNoiseSuppression && onChangeNoiseSuppression(lvl);
        }}
        aspectRatioMode={aspectRatioMode}
        onChangeAspectRatio={handleAspectRatioChange}
        fitMode={fitMode}
        onChangeFitMode={handleFitModeChange}
      />

      {/* Screen Share Configuration Modal (PC Audio Choice) */}
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onConfirm={handleConfirmScreenShare}
        isStarting={isStartingShare}
      />
    </div>
  );
}
