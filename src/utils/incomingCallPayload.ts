export type IncomingCallType = 'direct' | 'voice_room';
export type IncomingCallAction = 'open' | 'accept' | 'reject';

export interface ParsedIncomingCallPayload {
  callType: IncomingCallType;
  callId: string;
  callerId: number;
  callerUsername: string;
  callerAvatar: string | null;
  callerColor: string;
  roomId?: string;
  roomName?: string;
  autoAction: IncomingCallAction;
}

export function buildIncomingCallUrl(params: {
  callType: IncomingCallType;
  callId: string;
  callerId: number;
  callerUsername: string;
  callerAvatar?: string | null;
  callerColor?: string;
  roomId?: string;
  roomName?: string;
  action?: IncomingCallAction;
}): string {
  const search = new URLSearchParams();
  search.set('incomingCall', params.callType);
  search.set('callId', params.callId);
  search.set('callerId', String(params.callerId));
  search.set('callerUsername', params.callerUsername || 'Kullanıcı');

  if (
    params.callerAvatar &&
    typeof params.callerAvatar === 'string' &&
    params.callerAvatar.length <= 240 &&
    !params.callerAvatar.startsWith('data:')
  ) {
    search.set('callerAvatar', params.callerAvatar);
  }
  if (params.callerColor && typeof params.callerColor === 'string') {
    search.set('callerColor', params.callerColor);
  }
  if (params.roomId) {
    search.set('roomId', params.roomId);
  }
  if (params.roomName) {
    search.set('roomName', params.roomName);
  }
  if (params.action && params.action !== 'open') {
    search.set('callAction', params.action);
  }

  return `/?${search.toString()}`;
}

export function parseIncomingCallFromSearch(searchStr: string): ParsedIncomingCallPayload | null {
  if (!searchStr) return null;
  const params = new URLSearchParams(searchStr.startsWith('?') ? searchStr : `?${searchStr}`);

  const rawType = params.get('incomingCall');
  const legacyPushCall = params.get('pushCall');

  if (!rawType && !legacyPushCall) {
    return null;
  }

  const callType: IncomingCallType = rawType === 'voice_room' ? 'voice_room' : 'direct';
  const roomId = params.get('roomId') || undefined;
  const callId =
    params.get('callId') ||
    legacyPushCall ||
    (roomId ? `call_voice_${roomId}` : `call_${Date.now()}`);

  const callerIdNum = Number(params.get('callerId') || 0);
  const callerUsername = (params.get('callerUsername') || 'KapsApp Kullanıcısı').trim();
  const callerAvatar = params.get('callerAvatar') || null;
  const callerColor = params.get('callerColor') || (callType === 'voice_room' ? '#3b82f6' : '#10b981');
  const roomName = params.get('roomName') || 'Sesli Sohbet Odası';
  const rawAction = params.get('callAction');
  const autoAction: IncomingCallAction =
    rawAction === 'accept' || rawAction === 'reject' ? rawAction : 'open';

  if (callType === 'voice_room' && !roomId) {
    return null;
  }

  return {
    callType,
    callId,
    callerId: callerIdNum > 0 ? callerIdNum : 999,
    callerUsername,
    callerAvatar,
    callerColor,
    roomId,
    roomName: callType === 'voice_room' ? roomName : undefined,
    autoAction,
  };
}

export function parseIncomingCallFromPushAlert(
  alert: Record<string, any> | null | undefined,
  action: string = 'open'
): ParsedIncomingCallPayload | null {
  if (!alert || typeof alert !== 'object') return null;

  // First check if alert has explicit fields
  const tag = String(alert.tag || '');
  const isVoiceInvite =
    alert.callType === 'voice_room' || tag.startsWith('call_voice_') || Boolean(alert.roomId);
  const isDirectCall =
    alert.callType === 'direct' || (tag.startsWith('call_') && !isVoiceInvite);

  if (!isVoiceInvite && !isDirectCall) {
    // Fallback: try parsing alert.url if present
    if (typeof alert.url === 'string' && alert.url.includes('?')) {
      const qIndex = alert.url.indexOf('?');
      const parsedUrl = parseIncomingCallFromSearch(alert.url.slice(qIndex));
      if (parsedUrl) {
        return {
          ...parsedUrl,
          autoAction: action === 'accept' || action === 'reject' ? action : parsedUrl.autoAction,
        };
      }
    }
    return null;
  }

  // Also parse URL if some fields are encoded there
  let urlFallback: ParsedIncomingCallPayload | null = null;
  if (typeof alert.url === 'string' && alert.url.includes('?')) {
    urlFallback = parseIncomingCallFromSearch(alert.url.slice(alert.url.indexOf('?')));
  }

  const callType: IncomingCallType = isVoiceInvite ? 'voice_room' : 'direct';
  const roomId = alert.roomId || urlFallback?.roomId;
  if (callType === 'voice_room' && !roomId) return null;

  const callId = String(alert.callId || tag || urlFallback?.callId || `call_${Date.now()}`);
  const callerId = Number(alert.callerId || urlFallback?.callerId || 999);
  const callerUsername = String(
    alert.callerUsername ||
      urlFallback?.callerUsername ||
      (typeof alert.body === 'string' ? alert.body.split(' ')[0] : 'KapsApp Kullanıcısı')
  );
  const callerAvatar =
    (typeof alert.callerAvatar === 'string' ? alert.callerAvatar : null) ||
    (typeof alert.avatar === 'string' ? alert.avatar : null) ||
    urlFallback?.callerAvatar ||
    null;
  const callerColor = String(
    alert.callerColor || urlFallback?.callerColor || (callType === 'voice_room' ? '#3b82f6' : '#10b981')
  );
  const roomName = String(alert.roomName || urlFallback?.roomName || 'Sesli Sohbet Odası');
  const autoAction: IncomingCallAction =
    action === 'accept' || action === 'reject' ? action : urlFallback?.autoAction || 'open';

  return {
    callType,
    callId,
    callerId,
    callerUsername,
    callerAvatar,
    callerColor,
    roomId,
    roomName: callType === 'voice_room' ? roomName : undefined,
    autoAction,
  };
}
