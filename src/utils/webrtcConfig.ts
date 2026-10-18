/**
 * WebRTC Configuration & Adaptive Optimization Utility
 * Tuned for smooth multi-party rooms, ideal device compatibility, and zero-black-screen reliability.
 */

export const MAX_ROOM_USERS = 20;

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

export type AudioOutputMode = 'speaker' | 'earpiece';
export type CameraResolutionMode = 'auto' | '1080p' | '720p' | '480p';
export type NoiseSuppressionMode = 'off' | 'standard' | 'high';
export type VideoAspectRatioMode = 'auto' | 'landscape' | 'portrait';
export type VideoFitMode = 'cover' | 'contain';

/**
 * Audio Media Constraints with Hardware AEC, AGC, and disabled browser-side double suppression
 */
export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: false, // Prevents browser double-filtering and voice muffling
  autoGainControl: { ideal: true },
  // @ts-ignore
  googEchoCancellation: { ideal: true },
  // @ts-ignore
  googAutoGainControl: { ideal: true },
  // @ts-ignore
  googNoiseSuppression: { ideal: false },
  // @ts-ignore
  googHighpassFilter: { ideal: true },
  sampleRate: 48000,
  channelCount: 1
};

/**
 * Flexible Camera & Audio Constraints with Ideal Dimensions (prevents camera initialization crashes)
 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user'
  },
  audio: AUDIO_CONSTRAINTS
};

/**
 * Audio Track constraints generator based on selected noise suppression level
 */
export function getAudioTrackConstraints(mode: NoiseSuppressionMode = 'standard'): MediaTrackConstraints {
  return {
    echoCancellation: { ideal: true },
    noiseSuppression: false, // In-app Web Audio pipeline handles noise suppression cleanly
    autoGainControl: { ideal: true },
    // @ts-ignore
    googEchoCancellation: { ideal: true },
    // @ts-ignore
    googAutoGainControl: { ideal: true },
    // @ts-ignore
    googNoiseSuppression: { ideal: false },
    // @ts-ignore
    googHighpassFilter: { ideal: true },
    sampleRate: 48000,
    channelCount: 1
  };
}

/**
 * Adaptive Video Constraints based on active participant count
 */
export function getVideoConstraints(participantCount: number = 1): MediaTrackConstraints {
  if (participantCount > 10) {
    // High-density room (11-20 users): 360p @ 20 FPS ideal
    return {
      width: { ideal: 480 },
      height: { ideal: 270 },
      frameRate: { ideal: 20, max: 20 },
      facingMode: 'user'
    };
  } else if (participantCount > 4) {
    // Medium room (5-10 users): 480p/360p @ 24 FPS ideal
    return {
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 24, max: 24 },
      facingMode: 'user'
    };
  }

  // Small room (1-4 users): 720p / 480p ideal
  return {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user'
  };
}

/**
 * Video constraints tailored to explicit user resolution choice or auto-adaptation
 */
export function getVideoConstraintsForResolution(
  resolution: CameraResolutionMode = 'auto',
  participantCount: number = 1
): MediaTrackConstraints {
  if (resolution === '1080p') {
    return {
      width: { ideal: 1920, min: 1280 },
      height: { ideal: 1080, min: 720 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: 'user'
    };
  }

  if (resolution === '720p') {
    return {
      width: { ideal: 1280, min: 960 },
      height: { ideal: 720, min: 540 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: 'user'
    };
  }

  if (resolution === '480p') {
    return {
      width: { ideal: 640, min: 480 },
      height: { ideal: 480, min: 360 },
      frameRate: { ideal: 24, max: 24 },
      facingMode: 'user'
    };
  }

  // Auto
  return getVideoConstraints(participantCount);
}

/**
 * Helper to check if current client is a mobile or tablet browser
 */
export function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isIpadOS = typeof navigator.platform === 'string' &&
    navigator.platform === 'MacIntel' &&
    (navigator.maxTouchPoints || 0) > 1;
  return isMobileUa || isIpadOS;
}

/**
 * Universal detector for Screen Sharing capability across all platforms (Mobile, Tablet, Desktop).
 */
export function checkCanScreenShare(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  return Boolean(
    navigator.mediaDevices && 
    typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

/**
 * Universal Native Screen Capture Engine (Zero-Constraint Progressive Fallback)
 * Directly triggers native display media without complex constraints, popups or blocking alerts.
 * Exclusively captures the system screen (NEVER falls back to camera).
 */
export async function requestScreenStream(withAudio: boolean = false): Promise<MediaStream | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }

  const isMobile = isMobileOrTablet();
  let stream: MediaStream | null = null;

  // Strateji 1: 
  // Mobilde/Tablette veya sessiz paylaşımda İLK ve EN KARARLI parametre: { video: true } (audio anahtarı ASLA eklenmez!)
  // Masaüstünde ve withAudio=true ise: { video: true, audio: true }
  try {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
      if (isMobile || !withAudio) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } else {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
            },
            // @ts-ignore
            systemAudio: 'include'
          });
        } catch (subErr: any) {
          if (subErr?.name === 'NotAllowedError' || subErr?.name === 'AbortError') {
            throw subErr;
          }
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        }
      }
    }
  } catch (err1: any) {
    console.warn('[ScreenShare] 1. Düzey ekran yakalama sonucu:', err1?.name, err1?.message);

    // Kullanıcı sistem onay penceresinde "İptal" veya "Vazgeç" dedi
    if (err1?.name === 'NotAllowedError') {
      if (!err1?.message?.toLowerCase().includes('not supported') && 
          !err1?.message?.toLowerCase().includes('user gesture') && 
          !err1?.message?.toLowerCase().includes('transient')) {
        console.warn('[ScreenShare] Kullanıcı ekran yakalama iznini iptal etti.');
        return null;
      }
    }
    
    if (err1?.name === 'AbortError' || err1?.name === 'PermissionDeniedError') {
      return null;
    }
  }

  // Strateji 2: Parametresiz getDisplayMedia() çağrısı
  if (!stream) {
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        stream = await (navigator.mediaDevices as any).getDisplayMedia();
      }
    } catch (err2: any) {
      console.warn('[ScreenShare] 2. Düzey parametresiz getDisplayMedia sonucu:', err2?.name, err2?.message);
    }
  }

  // Strateji 3: Boş nesne ile çağırma ({})
  if (!stream) {
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        stream = await navigator.mediaDevices.getDisplayMedia({} as any);
      }
    } catch (err3: any) {
      console.warn('[ScreenShare] 3. Düzey boş nesne getDisplayMedia({}) sonucu:', err3?.name, err3?.message);
    }
  }

  // Strateji 4: Eski tarayıcı / vendor prefix uyumluluğu
  if (!stream && typeof (navigator as any).getDisplayMedia === 'function') {
    try {
      stream = await (navigator as any).getDisplayMedia({ video: true });
    } catch (err4: any) {
      console.warn('[ScreenShare] 4. Düzey legacy getDisplayMedia denenemedi:', err4);
    }
  }

  return stream;
}

/**
 * Helper to check if current client is a mobile device (alias for backward compatibility)
 */
export function isMobileBrowser(): boolean {
  return isMobileOrTablet();
}

/**
 * Apply bandwidth / bitrate clamping on RTCRtpSender.
 */
export async function applySenderBitrateLimit(
  sender: RTCRtpSender,
  participantCount: number = 1,
  resolution?: CameraResolutionMode
): Promise<void> {
  if (!sender || sender.track?.kind !== 'video') return;

  let targetBitrateBps = 600_000; // 600 kbps default
  let maxFps = 30;

  if (resolution === '1080p') {
    targetBitrateBps = 1_800_000; // 1.8 Mbps for crisp 1080p
    maxFps = 30;
  } else if (resolution === '720p') {
    targetBitrateBps = 900_000; // 900 kbps for smooth 720p
    maxFps = 30;
  } else if (resolution === '480p') {
    targetBitrateBps = 380_000; // 380 kbps for data-saving / performance
    maxFps = 24;
  } else {
    // Auto based on room density
    if (participantCount > 12) {
      targetBitrateBps = 280_000;
      maxFps = 20;
    } else if (participantCount > 6) {
      targetBitrateBps = 400_000;
      maxFps = 24;
    } else {
      targetBitrateBps = 750_000;
      maxFps = 30;
    }
  }

  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = targetBitrateBps;
    params.encodings[0].maxFramerate = maxFps;
    params.encodings[0].priority = 'low';
    params.encodings[0].networkPriority = 'low';

    await sender.setParameters(params);
  } catch (err) {
    console.debug('Sender bitrate clamp notice:', err);
  }
}

/**
 * Fine-tunes SDP to enforce Opus codec at 32-48 kbps, mono, with DTX enabled.
 */
export function tuneSdpForAudioOpus(sdp: string): string {
  if (!sdp) return sdp;

  const opusMatch = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!opusMatch) return sdp;

  const payloadType = opusMatch[1];
  const fmtpRegex = new RegExp(`a=fmtp:${payloadType} (.*)`, 'i');
  const fmtpMatch = sdp.match(fmtpRegex);

  const opusParams = 'minptime=10;useinbandfec=1;stereo=0;sprop-stereo=0;usedtx=1;maxaveragebitrate=36000';

  if (fmtpMatch) {
    return sdp.replace(fmtpRegex, `a=fmtp:${payloadType} ${opusParams};${fmtpMatch[1]}`);
  } else {
    return sdp.replace(
      opusMatch[0],
      `${opusMatch[0]}\r\na=fmtp:${payloadType} ${opusParams}`
    );
  }
}
