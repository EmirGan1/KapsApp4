export interface CourseRole {
  id: string;
  key?: string;
  label: string;
  name?: string;
  color: string;
  position?: number;
  isDefault?: boolean;
  isCustom?: boolean;
  description?: string;
  subjectGroup?: string;
  level?: "SL" | "HL";
}

export const COURSE_ROLES: CourseRole[] = [
  { id: "titc", label: "TITC", color: "#E11D48", isDefault: true, position: 100 },
  { id: "eng_b_hl", label: "English B HL", color: "#2563EB", isDefault: true, subjectGroup: "english", level: "HL", position: 90 },
  { id: "turkish_sl", label: "Turkish A SL", color: "#F97316", subjectGroup: "turkish", level: "SL", position: 80 },
  { id: "turkish_hl", label: "Turkish A HL", color: "#EA580C", subjectGroup: "turkish", level: "HL", position: 79 },
  { id: "math_sl", label: "Mathematics SL", color: "#38BDF8", subjectGroup: "math", level: "SL", position: 70 },
  { id: "math_hl", label: "Mathematics HL", color: "#0284C7", subjectGroup: "math", level: "HL", position: 69 },
  { id: "physics_sl", label: "Physics SL", color: "#A855F7", subjectGroup: "physics", level: "SL", position: 60 },
  { id: "physics_hl", label: "Physics HL", color: "#7E22CE", subjectGroup: "physics", level: "HL", position: 59 },
  { id: "psychology_sl", label: "Psychology SL", color: "#EC4899", subjectGroup: "psychology", level: "SL", position: 50 },
  { id: "psychology_hl", label: "Psychology HL", color: "#BE185D", subjectGroup: "psychology", level: "HL", position: 49 },
  { id: "chemistry_sl", label: "Chemistry SL", color: "#14B8A6", subjectGroup: "chemistry", level: "SL", position: 45 },
  { id: "chemistry_hl", label: "Chemistry HL", color: "#0F766E", subjectGroup: "chemistry", level: "HL", position: 44 },
  { id: "biology_sl", label: "Biology SL", color: "#22C55E", subjectGroup: "biology", level: "SL", position: 40 },
  { id: "biology_hl", label: "Biology HL", color: "#15803D", subjectGroup: "biology", level: "HL", position: 39 },
  { id: "digital_society_sl", label: "Digital Society SL", color: "#06B6D4", subjectGroup: "digital_society", level: "SL", position: 30 },
  { id: "digital_society_hl", label: "Digital Society HL", color: "#0891B2", subjectGroup: "digital_society", level: "HL", position: 29 },
];

export interface User {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  token?: string;
  last_seen: string;
  signup_ip?: string | null;
  last_ip?: string | null;
  roles?: string[];
  is_admin?: number;
}

export interface Post {
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  color?: string;
  image: string | null;
  media_type?: 'image' | 'video' | 'file';
  attachments?: any[] | string;
  caption: string;
  subject?: string;
  created_at: string;
  likes_count: number;
  is_liked: boolean;
  comments?: Comment[];
  likes?: any[];
}

export interface Comment {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  color?: string;
  content: string;
  created_at: string;
}

export interface Story {
  id: number;
  user_id: number;
  username: string;
  avatar: string | null;
  color?: string;
  image: string;
  media_type?: 'image' | 'video';
  created_at: string;
}

export interface MessageReaction {
  user_id: number;
  emoji: string;
}

export interface Message {
  id: number;
  sender: number;
  receiver: number;
  group_id?: number;
  sender_name?: string;
  sender_avatar?: string;
  sender_color?: string;
  type: 'text' | 'image' | 'video' | 'voice' | 'file';
  content: string;
  file_name?: string;
  file_size?: string;
  reply_to?: number;
  reply_message?: Message;
  reactions?: MessageReaction[];
  created_at: string;
}

export interface Friend {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  roles?: string[];
  status: 0 | 1; // 0 = pending, 1 = accepted
  is_sender: boolean; // Did current user send the request?
  signup_ip?: string | null;
  last_ip?: string | null;
  lastMessageText?: string | null;
  lastMessageTime?: string | null;
  lastMessageSender?: number | null;
  unreadCount?: number;
}

export interface TableChatMessage {
  id: string | number;
  senderId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  text: string;
  time: string;
}

export interface AppNotification {
  id: number;
  user_id: number;
  type: 'new_message' | 'dm' | 'like' | 'comment' | 'follow' | 'friend_request' | 'friend_accept' | 'group_invite' | 'new_group_message' | 'user_approval_request' | string;
  content: string;
  read: number;
  sender_id?: number | null;
  target_id?: number | null;
  metadata?: string | any;
  created_at: string;
}

export interface UserProfileData {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  friendStatus?: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  signup_ip?: string | null;
  last_ip?: string | null;
  roles?: string[];
  is_admin?: number;
}

export interface MediaModalData {
  url: string;
  type: 'image' | 'video' | 'file';
  items?: { url: string; type: 'image' | 'video' | 'file'; name?: string; size?: number }[];
  initialIndex?: number;
  authorName?: string;
  authorAvatar?: string | null;
  authorColor?: string;
  authorId?: number;
  caption?: string;
  timestamp?: string;
  postId?: number;
  likesCount?: number;
  isLiked?: boolean;
  comments?: Comment[];
  fileName?: string;
  fileSize?: string;
  reactions?: MessageReaction[];
  onLike?: () => void;
  onAddComment?: (text: string) => void;
  onDeleteComment?: (commentId: number) => void;
  onDeletePost?: (postId: number) => void;
}

export interface VoiceParticipant {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  socketId: string;
  isHost: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  isDeafened?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  joinedAt: string;
}

export interface VoiceRoom {
  id: string;
  name: string;
  hostId: number;
  hostUsername: string;
  maxParticipants: number;
  participants: VoiceParticipant[];
  createdAt: string;
}

export interface DrawGuessPlayer {
  id: number;
  username: string;
  avatar: string | null;
  color?: string;
  score: number;
  roundScore: number;
  hasGuessed: boolean;
  isDrawing: boolean;
  isHost: boolean;
  socketId: string;
}

export interface DrawGuessRoom {
  id: string;
  name: string;
  hostId: number;
  hostUsername: string;
  maxPlayers: number;
  totalRounds: number;
  currentRound: number;
  currentDrawerIndex: number;
  drawerId: number | null;
  drawerUsername: string | null;
  status: 'lobby' | 'choosing' | 'drawing' | 'round_end' | 'game_over';
  currentWord?: string; // only revealed to drawer or at round end
  wordMask?: string; // e.g. "_ _ _ _ _"
  wordLength?: number;
  wordChoices?: { word: string; category?: string; difficulty: 'easy' | 'medium' | 'hard'; points: number }[];
  timer: number;
  roundDuration: number;
  players: DrawGuessPlayer[];
  lastRoundWinner?: string | null;
  revealedWord?: string | null;
  createdAt: string;
}

export interface DrawLineData {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  size: number;
  isEraser?: boolean;
}

export interface DrawGuessChatMessage {
  id: string;
  userId: number;
  username: string;
  text: string;
  isCorrect?: boolean;
  isCorrectGuess?: boolean;
  isClose?: boolean;
  isCloseGuess?: boolean;
  isWarning?: boolean;
  isSystem?: boolean;
  createdAt: string;
}

export interface AgendaEvent {
  id: number;
  title: string;
  event_date: string; // YYYY-MM-DD
  event_time?: string | null; // HH:mm
  event_type: "food" | "homework" | "exam" | "event" | "study";
  description?: string | null;
  targetRoles?: string[];
  created_by?: string;
  created_at?: string;
}

export interface AnnouncementStyles {
  color?: string;
  fontWeight?: "normal" | "medium" | "bold";
  fontSize?: "sm" | "base" | "lg" | "xl";
}

export interface AnnouncementItem {
  id: number;
  title: string;
  content: string;
  styles?: AnnouncementStyles | string;
  targetRoles?: string[];
  author_id: number;
  author_username: string;
  created_at: string;
}

export const parseTargetRoles = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {}
    if (raw.trim() && raw.trim() !== "[]" && raw.trim() !== "all") {
      return [raw.trim()];
    }
  }
  return [];
};

export const isVisibleToUser = (
  targetRolesRaw: any,
  userRoles: string[] = [],
  isEmirganOrAdmin: boolean = false
): boolean => {
  if (isEmirganOrAdmin) return true;
  const targetRoles = parseTargetRoles(targetRolesRaw);
  // If targetRoles is empty or contains "all" -> visible to everyone
  if (targetRoles.length === 0 || targetRoles.includes("all")) {
    return true;
  }
  // Check if at least one target role matches the user's roles
  const normalizedUserRoles = (userRoles || []).map((r) => r.toLowerCase().trim());
  return targetRoles.some((tr) => normalizedUserRoles.includes(tr.toLowerCase().trim()));
};

export const sortRolesByPosition = (
  roleIds: string[] | null | undefined,
  allRoles: CourseRole[] = COURSE_ROLES
): CourseRole[] => {
  if (!Array.isArray(roleIds) || roleIds.length === 0) return [];
  const rolesMap = new Map<string, CourseRole>();
  allRoles.forEach((r) => {
    rolesMap.set(r.id.toLowerCase(), r);
    if (r.key) rolesMap.set(r.key.toLowerCase(), r);
  });

  const matched: CourseRole[] = [];
  roleIds.forEach((id) => {
    const rawId = String(id).toLowerCase().trim();
    if (!rawId) return;
    const r = rolesMap.get(rawId);
    if (r) {
      if (!matched.some((m) => m.id === r.id)) {
        matched.push(r);
      }
    } else {
      matched.push({
        id: rawId,
        label: String(id),
        color: "#6366F1",
        position: 0,
        isCustom: true
      });
    }
  });

  return matched.sort((a, b) => (b.position || 0) - (a.position || 0));
};
