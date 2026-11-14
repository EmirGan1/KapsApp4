import { IncomingActivityInvites } from "./components/ActivityInvites";
import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { App as CapApp } from "@capacitor/app";
import { 
  MessageSquare, 
  LayoutGrid, 
  Users, 
  UserCircle2, 
  Globe, 
  Bell, 
  Folder, 
  Moon, 
  Sun, 
  Gamepad2, 
  Radio, 
  MapPin, 
  Megaphone, 
  Crown, 
  CalendarDays, 
  CloudSun, 
  GraduationCap, 
  Home,
  MoreHorizontal,
  Menu,
  X,
  FolderX,
  LogOut,
  KeyRound,
  Calculator,
  Compass,
  Settings as SettingsIcon,
  Palette,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeft,
  BellOff
} from "lucide-react";
import { APP_ROUTES, getTabFromPathname, getPathFromTab, AppTab } from "./routes";
import { useSEO } from "./components/SEO";
import Auth from "./components/Auth";
import ResetPasswordView from "./components/ResetPasswordView";
import Dashboard from "./components/Dashboard";
import Feed from "./components/Feed";
import Chats from "./components/Chats";
import Friends from "./components/Friends";
import Profile from "./components/Profile";
import GlobalChat from "./components/GlobalChat";
import Notifications from "./components/Notifications";
import Games from "./components/Games";
import VoiceChat from "./components/VoiceChat";
import LiveMap from "./components/LiveMap";
import WeatherDashboard from "./components/WeatherDashboard";
import AyvalikCasPanel from "./components/AyvalikCasPanel";
import Settings from "./components/Settings";
import CommandPalette from "./components/CommandPalette";
import Announcements, { AnnouncementItem } from "./components/Announcements";
import KapsculatorHub from "./components/KapsculatorHub";
import IbM27ExamsPanel from "./components/IbM27ExamsPanel";
import AnnouncementModal from "./components/AnnouncementModal";
import ToastContainer, { ToastItem } from "./components/ToastContainer";
import DeviceBanScreen from "./components/DeviceBanScreen";
import Agenda from "./components/Agenda";
import AdminPanel from "./components/AdminPanel";
import SubjectsDirectory from "./components/SubjectsDirectory";
import BottomNav from "./components/BottomNav";
import { CallProvider } from "./context/CallContext";
import IncomingCallNotification from "./components/IncomingCallNotification";
import ActiveCallPanel from "./components/ActiveCallPanel";
import VoiceCallInviteModal, { VoiceCallInvite } from "./components/VoiceCallInviteModal";
import KapAttackOverlay from "./components/KapAttackOverlay";
import KapscareOverlay from "./components/KapscareOverlay";
import RemotePopupOverlay from "./components/RemotePopupOverlay";
import { getSocketUrl, getApiUrl } from "./utils/api";
import { getCachedHardwareFingerprint, getHardwareFingerprint } from "./utils/deviceFingerprint";
import { isVisibleToUser } from "./types";
import { getCachedWeather, fetchWeatherForecast, DEFAULT_ISTANBUL_LOCATION, getWeatherMeta, WeatherData } from "./utils/weatherService";
import { ThemeId, applyTheme, getStoredTheme } from "./utils/theme";
import {
  UserPreferences,
  getStoredPreferences,
  savePreferences,
  resetPreferencesToDefault,
  applyPreferencesToDOM,
  playNotificationChime,
} from "./utils/preferences";

import { SUBJECTS } from "./utils/subjectResources";
import SubjectResources from "./components/SubjectResources";

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("lan_token"));
  const [username, setUsername] = useState<string>(localStorage.getItem("lan_username") || "");
  const [avatar, setAvatar] = useState<string | null>(() => {
    const stored = localStorage.getItem("lan_avatar");
    return stored === "null" ? null : stored;
  });
  const [color, setColor] = useState<string | undefined>(localStorage.getItem("lan_color") || undefined);
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("lan_user_roles");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  
  const location = useLocation();
  const resourceParams = new URLSearchParams(location.search);
  const resourceView = resourceParams.get("kaynak");
  const resourceFolder = resourceParams.get("klasor") ?? undefined;
  const navigate = useNavigate();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number>(Number(localStorage.getItem("lan_user_id")) || 0);
  
  // Resolve initial tab & params directly from current URL path
  const initialResolved = getTabFromPathname(location.pathname);
  const [activeTab, setActiveTab] = useState<AppTab>(initialResolved.tab);
  const [activeSubject, setActiveSubject] = useState<string | null>(initialResolved.subject || null);
  const [viewingUserId, setViewingUserId] = useState<number>(initialResolved.userId || currentUserId);
  const [targetChatUserId, setTargetChatUserId] = useState<number | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<number | string | null>(null);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);
  const [resetPasswordToken, setResetPasswordToken] = useState<string | null>(null);
  const isEmirgan = (username || "").trim().toLowerCase() === "emirgan" || (localStorage.getItem("lan_account_role") || "").toUpperCase() === "ROOT";

  // 1. Synchronize URL changes to activeTab and state (Back/Forward or Direct Navigation)
  useEffect(() => {
    const resolved = getTabFromPathname(location.pathname);
    if (resolved.tab === "admin" && !isEmirgan) {
      navigate("/", { replace: true });
      return;
    }
    setActiveTab(resolved.tab);
    if (resolved.subject) {
      setActiveSubject(resolved.subject);
    } else if (resolved.tab !== "subject") {
      setActiveSubject(null);
    }
    if (resolved.userId) {
      setViewingUserId(resolved.userId);
    } else if (resolved.tab === "profile") {
      setViewingUserId(currentUserId);
    }

    // URL Search Params (Query string) handling
    try {
      const searchParams = new URLSearchParams(location.search);
      const roomParam = searchParams.get("room") || searchParams.get("group") || searchParams.get("chatId") || searchParams.get("roomId");
      const dmParam = searchParams.get("dm") || searchParams.get("user");
      const tokenParam = searchParams.get("token");

      if (roomParam) {
        setTargetGroupId(roomParam);
      }
      if (dmParam) {
        setTargetChatUserId(Number(dmParam));
      }
      if ((location.pathname === "/sifre-sifirla" || location.pathname === "/reset-password") && tokenParam) {
        setResetPasswordToken(tokenParam);
      }
    } catch (e) {}
  }, [location.pathname, location.search, isEmirgan, currentUserId, navigate]);

  // 2. Dynamic SEO updates per route (Title, Description, Canonical, OG tags)
  const currentRouteMeta = Object.values(APP_ROUTES).find(r => r.path === location.pathname) || {
    title: activeTab === 'subject' && activeSubject 
      ? `${activeSubject} Ders Notları ve Klasörleri | KapsApp`
      : "KapsApp - Sesli Sohbet, Canlı Harita, Ders Klasörleri ve Sosyal Oyunlar",
    description: activeTab === 'subject' && activeSubject
      ? `${activeSubject} dersi için paylaşılan ders notları, çalışma klasörleri ve öğrenci tartışmaları.`
      : "KapsApp; gerçek zamanlı sesli sohbet kanalları, canlı harita ve ders klasörleri platformudur.",
    canonical: `https://kapsapp.online${location.pathname}`,
    noindex: false,
  };

  useSEO({
    title: currentRouteMeta.title,
    description: currentRouteMeta.description,
    canonical: currentRouteMeta.canonical,
    noindex: !!currentRouteMeta.noindex,
  });

  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [unreadGlobalCount, setUnreadGlobalCount] = useState(0);
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [isInVoiceRoom, setIsInVoiceRoom] = useState(false);

  // Announcements & Drop-down Modal State
  const [hasUnreadAnnouncement, setHasUnreadAnnouncement] = useState(false);
  const [activeAnnouncementModal, setActiveAnnouncementModal] = useState<AnnouncementItem | null>(null);
  const latestAnnouncementIdRef = useRef<number>(0);

  // Hardware / Device Ban State
  const [isDeviceBanned, setIsDeviceBanned] = useState(false);
  const [deviceBanReason, setDeviceBanReason] = useState("");

  // Listen to Global Device Ban events from safeFetchJson or sockets
  useEffect(() => {
    const handleDeviceBanEvent = (e: any) => {
      setIsDeviceBanned(true);
      if (e.detail?.error || e.detail?.message) {
        setDeviceBanReason(e.detail.error || e.detail.message);
      }
    };
    window.addEventListener("kaps:device_banned", handleDeviceBanEvent);
    return () => {
      window.removeEventListener("kaps:device_banned", handleDeviceBanEvent);
    };
  }, []);

  // Real-time Floating Toast Notifications with Stacking / Grouping
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [activeDmChatUserId, setActiveDmChatUserId] = useState<number | null>(null);
  const activeDmChatUserIdRef = useRef<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Incoming Voice Room Invite State (VoiceCallInviteModal)
  const [voiceInvite, setVoiceInvite] = useState<VoiceCallInvite | null>(null);

  // Live Weather Mini Badge State for Sidebar & Mobile Nav
  const [miniWeatherBadge, setMiniWeatherBadge] = useState<{ emoji: string; temp: number } | null>(() => {
    const cached = getCachedWeather();
    if (cached) {
      const meta = getWeatherMeta(cached.current.weatherCode, cached.current.isDay);
      return { emoji: meta.emoji, temp: cached.current.temperature };
    }
    return null;
  });

  // Fetch or listen for weather badge updates
  useEffect(() => {
    const handleWeatherUpdated = (e: any) => {
      const w: WeatherData = e.detail;
      if (w?.current) {
        const meta = getWeatherMeta(w.current.weatherCode, w.current.isDay);
        setMiniWeatherBadge({ emoji: meta.emoji, temp: w.current.temperature });
      }
    };
    window.addEventListener("kaps:weather_updated", handleWeatherUpdated);

    // Initial silent badge fetch if not cached
    if (!miniWeatherBadge) {
      fetchWeatherForecast(DEFAULT_ISTANBUL_LOCATION.latitude, DEFAULT_ISTANBUL_LOCATION.longitude, DEFAULT_ISTANBUL_LOCATION.name)
        .then((data) => {
          const meta = getWeatherMeta(data.current.weatherCode, data.current.isDay);
          setMiniWeatherBadge({ emoji: meta.emoji, temp: data.current.temperature });
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("kaps:weather_updated", handleWeatherUpdated);
    };
  }, []);

  // Ctrl + W Accident Prevention & Warning Toast State
  const [ctrlWWarn, setCtrlWWarn] = useState(false);

  useEffect(() => {
    let warnTimer: NodeJS.Timeout | null = null;
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isW = e.key === "w" || e.key === "W" || e.code === "KeyW" || e.keyCode === 87;
      if (isCtrlOrCmd && isW) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setCtrlWWarn(true);
        if (warnTimer) clearTimeout(warnTimer);
        warnTimer = setTimeout(() => {
          setCtrlWWarn(false);
        }, 4000);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      if (warnTimer) clearTimeout(warnTimer);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, []);

  // Only warn on beforeunload when user is actively in Games or Voice Room
  useEffect(() => {
    if (!token || (activeTab !== "games" && !isInVoiceRoom)) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Sayfayı veya aktif oyununuzu kapatmak istediğinize emin misiniz?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [token, activeTab, isInVoiceRoom]);

  // Active Screen Time Tracking Heartbeat (Every 60s, only while tab is visible)
  useEffect(() => {
    if (!token || token.startsWith("demo-") || token.startsWith("mock-")) return;

    const intervalSeconds = 60;
    const interval = setInterval(async () => {
      // Avoid firing background requests if the user switched tabs or minimized browser
      if (document.visibilityState !== "visible") return;

      try {
        await fetch(getApiUrl("/api/user/screen-time"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ seconds: intervalSeconds })
        });
      } catch (err) {
        // Silently ignore background tracking failures
      }
    }, intervalSeconds * 1000);

    return () => clearInterval(interval);
  }, [token]);


  const handleAcceptVoiceInvite = (invite: VoiceCallInvite) => {
    if (socket) {
      socket.emit("voice:invite_response", {
        accepted: true,
        roomId: invite.roomId,
        inviterId: invite.inviter.id
      });
      socket.emit("join_voice_room", { roomId: invite.roomId });
    }
    setVoiceInvite(null);
    handleTabChange("voice");
  };

  const handleRejectVoiceInvite = (invite: VoiceCallInvite) => {
    if (socket) {
      socket.emit("voice:invite_response", {
        accepted: false,
        roomId: invite.roomId,
        inviterId: invite.inviter.id
      });
    }
    setVoiceInvite(null);
  };

  const dismissToast = (id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const [preferences, setPreferences] = useState<UserPreferences>(() => getStoredPreferences());
  const preferencesRef = useRef<UserPreferences>(preferences);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    preferencesRef.current = preferences;
    applyPreferencesToDOM(preferences);
  }, [preferences]);

  useEffect(() => {
    const handlePrefsEvent = (e: Event) => {
      const custom = e as CustomEvent<UserPreferences>;
      if (custom.detail) {
        setPreferences(custom.detail);
        setCurrentTheme(custom.detail.theme);
      }
    };
    window.addEventListener("kaps:preferences_changed", handlePrefsEvent);
    return () => window.removeEventListener("kaps:preferences_changed", handlePrefsEvent);
  }, []);

  // Global Command Palette Shortcut (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  const addToast = (incoming: {
    type: string;
    title?: string;
    text: string;
    senderId?: number | null;
    senderName?: string;
    senderAvatar?: string | null;
    senderColor?: string;
    target_id?: number | null;
    notifId?: number;
  }) => {
    // Respect Do Not Disturb / Odak Modu
    if (preferencesRef.current.doNotDisturb) {
      return;
    }

    const isDm = incoming.type === "new_message" || incoming.type === "dm";
    const senderId = incoming.senderId ? Number(incoming.senderId) : null;

    // 2. AKTİF SOHBETTE İKEN BİLDİRİMİ ENGELLE
    if (isDm && senderId && activeTabRef.current === "chats" && activeDmChatUserIdRef.current === senderId) {
      return;
    }

    if (preferencesRef.current.soundEnabled) {
      playNotificationChime(preferencesRef.current.soundVolume);
    }

    const toastId = isDm && senderId ? `dm-notify-${senderId}` : `notif-${incoming.notifId || Math.random().toString(36).substring(2, 9)}`;

    setToasts((prevNotifications) => {
      // 1. Bu kullanıcıdan daha önce gelen açık bir bildirim kartı var mı?
      const existingIndex = prevNotifications.findIndex((n) => {
        if (isDm && senderId && n.senderId) {
          return Number(n.senderId) === senderId;
        }
        return n.id === toastId;
      });

      if (existingIndex !== -1) {
        // 2. Varsa: YENİ KART AÇMA, mevcut kartı güncelle (STACKLE)
        const updated = [...prevNotifications];
        const target = updated[existingIndex];

        // Reset auto-dismiss timer (6000ms)
        const existingTimer = toastTimersRef.current.get(target.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const newTimer = setTimeout(() => {
          dismissToast(target.id);
        }, 6000);
        toastTimersRef.current.set(target.id, newTimer);

        updated[existingIndex] = {
          ...target,
          messages: [...(target.messages || []), incoming.text],
          lastMessage: incoming.text,
          unreadCount: (target.unreadCount || 1) + 1,
          timestamp: Date.now(),
          senderName: incoming.senderName || target.senderName,
          senderAvatar: incoming.senderAvatar || target.senderAvatar,
          notifId: incoming.notifId || target.notifId,
          target_id: incoming.target_id || target.target_id,
        };
        return updated;
      } else {
        // 3. Yoksa: İlk kez bir bildirim kartı oluştur
        const newToast: ToastItem = {
          id: toastId,
          type: incoming.type,
          senderId: senderId,
          senderName: incoming.senderName,
          senderAvatar: incoming.senderAvatar,
          senderColor: incoming.senderColor,
          title: incoming.title,
          messages: [incoming.text],
          lastMessage: incoming.text,
          unreadCount: 1,
          timestamp: Date.now(),
          target_id: incoming.target_id,
          notifId: incoming.notifId,
        };

        // Set auto-dismiss timer (6000ms)
        const timer = setTimeout(() => {
          dismissToast(toastId);
        }, 6000);
        toastTimersRef.current.set(toastId, timer);

        return [...prevNotifications, newToast];
      }
    });
  };

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
    const currentActiveDmId = activeTab === "chats" ? activeDmChatUserId : null;
    activeDmChatUserIdRef.current = currentActiveDmId;

    if (socket) {
      if (currentActiveDmId) {
        socket.emit("dm:enter_chat", { partnerId: currentActiveDmId });
      } else {
        socket.emit("dm:leave_chat");
      }
    }
  }, [activeTab, activeDmChatUserId, socket]);

  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => getStoredTheme());
  const darkMode = currentTheme !== "light";

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const handleUpdatePreferences = (partial: Partial<UserPreferences>) => {
    const updated = savePreferences(partial);
    setPreferences(updated);
    setCurrentTheme(updated.theme);
  };

  const handleResetPreferences = () => {
    const reset = resetPreferencesToDefault();
    setPreferences(reset);
    setCurrentTheme(reset.theme);
  };

  const handleThemeChange = (newTheme: ThemeId) => {
    handleUpdatePreferences({ theme: newTheme });
  };

  const handleToggleDarkMode = () => {
    const nextTheme: ThemeId = darkMode ? "light" : "dark";
    handleThemeChange(nextTheme);
  };

  const handleNotificationClick = (notif: any) => {
    if (notif.id) {
      dismissToast(notif.id);
    }
    if (notif.notifId && socket) {
      socket.emit("mark_single_notification_read", notif.notifId);
    } else if (notif.id && socket && typeof notif.id === "number") {
      socket.emit("mark_single_notification_read", notif.id);
    }
    setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));

    const senderId = notif.senderId || notif.sender_id;
    const groupId = notif.chatId || notif.groupId || notif.group_id || notif.roomId || notif.room_id || (notif.type === "new_group_message" ? notif.target_id : null);

    if (notif.type === "new_group_message" || notif.type === "group_invite" || groupId) {
      if (groupId) {
        setTargetGroupId(groupId);
        navigate(`/sohbetler?room=${groupId}`);
      } else {
        navigate("/sohbetler");
      }
      handleTabChange("chats");
    } else if (notif.type === "new_message" || notif.type === "dm") {
      if (senderId) {
        setTargetChatUserId(senderId);
        navigate(`/sohbetler?dm=${senderId}`);
      } else {
        navigate("/sohbetler");
      }
      handleTabChange("chats");
    } else if (notif.type === "like" || notif.type === "comment") {
      handleTabChange("notifications");
    }
  };

  useEffect(() => {
    if (token) {
      const socketUrl = getSocketUrl();
      const hwFingerprint = getCachedHardwareFingerprint();
      const socketOptions = { 
        path: "/socket.io",
        transports: ["websocket", "polling"],
        withCredentials: true,
        autoConnect: true,
        auth: { token, deviceId: hwFingerprint, hardwareFingerprint: hwFingerprint },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      };
      const isDemoSession =
        token?.startsWith("demo-") ||
        token?.startsWith("mock-") ||
        localStorage.getItem("lan_is_demo") === "true";

      const newSocket = io(socketUrl || undefined, socketOptions);
      
      const onConnect = () => {
        setSocket(newSocket);
        newSocket.emit("heartbeat");
        newSocket.emit("get_notifications", (notifs: any[]) => {
          if (Array.isArray(notifs)) {
            setUnreadNotificationsCount(notifs.filter(n => !n.read).length);
          }
        });
        newSocket.emit("get_friends", (data: any[]) => {
          if (Array.isArray(data)) {
            const total = data.reduce((acc, f) => acc + (f.unreadCount || 0), 0);
            setUnreadDmCount(total);
          }
        });
      };

      newSocket.on("connect", onConnect);

      newSocket.on("session_revoked", () => {
        if (!isDemoSession) handleLogout();
      });

      newSocket.on("connect_error", (err) => {
        if (err.message && (err.message.includes("DEVICE_BANNED") || err.message.includes("cihaz") || err.message.includes("yasaklanmıştır") || err.message.includes("uzaklaştırılmıştır"))) {
          if (!isDemoSession) {
            setIsDeviceBanned(true);
            setDeviceBanReason(err.message.replace(/^DEVICE_BANNED:\s*/, ""));
          }
        } else if (err.message === "Invalid token" || err.message === "No token" || err.message.includes("askıya")) {
          if (!isDemoSession) {
            handleLogout();
          }
        }
      });

      // Socket Device and Account Moderation Listeners
      newSocket.on("hardware_ban_enforced", (data: any) => {
        setIsDeviceBanned(true);
        if (data?.message || data?.reason) {
          setDeviceBanReason(data.reason || data.message);
        }
      });

      newSocket.on("device_banned", (data: any) => {
        setIsDeviceBanned(true);
        if (data?.message || data?.reason) {
          setDeviceBanReason(data.reason || data.message);
        }
      });

      newSocket.on("account_banned", (data: any) => {
        alert(data?.message || "Hesabınız yönetici tarafından banlanmıştır.");
        handleLogout();
      });

      newSocket.on("account_deleted", (msg: string) => {
        alert(msg || "Hesabınız silinmiştir.");
        handleLogout();
      });

      newSocket.on("online_users", (users: number[]) => {
        setOnlineUsers(users);
      });

      newSocket.on("your_id", (id: number) => {
        setCurrentUserId(id);
        setViewingUserId(id);
        localStorage.setItem("lan_user_id", id.toString());
      });
      
      newSocket.on("new_notification", (notif: any) => {
        // Smart suppression: If user is actively inside the DM chat with the sender, do NOT show toast or increment badge
        const senderId = Number(notif?.sender_id || notif?.senderId);
        if ((notif.type === "new_message" || notif.type === "dm") && activeTabRef.current === "chats" && activeDmChatUserIdRef.current && activeDmChatUserIdRef.current === senderId) {
          return;
        }

        setUnreadNotificationsCount(prev => prev + 1);
        if (notif && notif.content) {
          let title = "Yeni Bildirim";
          if (notif.type === "new_message") title = "Yeni Mesaj";
          else if (notif.type === "like") title = "Yeni Beğeni";
          else if (notif.type === "comment") title = "Yeni Yorum";
          else if (notif.type === "follow") title = "Yeni Takipçi";
          else if (notif.type === "friend_request") title = "Arkadaşlık İsteği";
          else if (notif.type === "friend_accept") title = "İstek Kabul Edildi";

          const colonIdx = notif.content.indexOf(":");
          const hasColon = colonIdx !== -1;
          const senderName = hasColon ? notif.content.substring(0, colonIdx).trim() : undefined;
          const text = hasColon ? notif.content.substring(colonIdx + 1).trim() : notif.content;

          addToast({
            type: notif.type,
            title,
            text,
            senderId: notif.sender_id,
            senderName,
            target_id: notif.target_id,
            notifId: notif.id,
          });
        }
      });

      newSocket.on("new_global_message", () => {
        if (activeTabRef.current !== 'global') {
          setUnreadGlobalCount(prev => prev + 1);
        }
      });

      newSocket.on("new_message", (msg: any) => {
        const senderId = Number(msg?.sender);
        if (activeTabRef.current === 'chats' && activeDmChatUserIdRef.current && activeDmChatUserIdRef.current === senderId) {
          return; // Suppress unread count for current open DM
        }
        if (activeTabRef.current !== 'chats') {
          setUnreadDmCount(prev => prev + 1);
        }
      });

      const fetchPendingApprovals = async () => {
        if (isDemoSession) return;
        if (localStorage.getItem("lan_username")?.toLowerCase() !== "emirgan") return;
        try {
          const token = localStorage.getItem("lan_token") || "";
          const res = await fetch(getApiUrl("/api/emirgan/pending-users"), {
            headers: { Authorization: `Bearer ${token}`, "X-Username": "emirgan" }
          });
          if (res.ok) {
            const data = await res.json();
            setPendingApprovalsCount((data.users || []).length);
          }
        } catch (e) {}
      };

      fetchPendingApprovals();

      newSocket.on("user:pending_approval", (data: any) => {
        if (localStorage.getItem("lan_username")?.toLowerCase() === "emirgan") {
          fetchPendingApprovals();
          addToast({
            type: "user_approval_request",
            title: "👑 Yeni Kayıt Onayı Bekleniyor",
            text: `"${data?.username || 'Yeni kullanıcı'}" sisteme kayıt olmak için onayınızı bekliyor.`,
            senderName: data?.username,
          });
        }
      });

      newSocket.on("voice:invite_user", (data: VoiceCallInvite) => {
        setVoiceInvite(data);
      });

      newSocket.on("pending_count_updated", fetchPendingApprovals);
      newSocket.on("user:approved", fetchPendingApprovals);
      newSocket.on("user:rejected", fetchPendingApprovals);

      // User Roles Updated socket listener (Emirgan instant role management)
      newSocket.on("user:roles_updated", (data: any) => {
        if (Number(data?.userId) === Number(currentUserId) && Array.isArray(data?.roles)) {
          setCurrentUserRoles(data.roles);
          localStorage.setItem("lan_user_roles", JSON.stringify(data.roles));
          addToast({
            type: "system",
            title: "🎖️ IB Ders Rolleri Güncellendi",
            text: "Ders rolleriniz yönetici tarafından güncellendi.",
            senderName: "Sistem",
            senderColor: "#6366f1"
          });
        }
      });

      // Fetch user's current roles if not set
      if (currentUserId && !isDemoSession) {
        fetch(getApiUrl(`/api/users/${currentUserId}`), {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((r) => r.json())
          .then((uData) => {
            if (uData && Array.isArray(uData.roles) && uData.roles.length > 0) {
              setCurrentUserRoles(uData.roles);
              localStorage.setItem("lan_user_roles", JSON.stringify(uData.roles));
            }
          })
          .catch(() => {});
      }

      // Announcements socket listeners & initial unread checking (Role-filtered)
      const isEmirganUser = (username || "").trim().toLowerCase() === "emirgan";
      const handleIncomingAnnouncement = (announcement: AnnouncementItem) => {
        if (announcement && announcement.id) {
          const isVisible = isVisibleToUser(announcement.targetRoles, currentUserRoles, isEmirganUser);
          if (!isVisible) return;

          latestAnnouncementIdRef.current = Math.max(latestAnnouncementIdRef.current, Number(announcement.id));
          const lastRead = Number(localStorage.getItem("latest_read_announcement_id") || 0);
          if (Number(announcement.id) > lastRead) {
            setHasUnreadAnnouncement(true);
            setActiveAnnouncementModal(announcement);
          }
        }
      };

      newSocket.on("new_announcement", handleIncomingAnnouncement);
      newSocket.on("new_global_announcement", handleIncomingAnnouncement);

      // Admin Broadcast Live Alert Listener
      newSocket.on("admin_broadcast_alert", (alert: any) => {
        addToast({
          type: "system",
          title: alert.title || "📢 YÖNETİCİ DUYURUSU",
          text: alert.message,
          senderName: "Emirgan (Yönetici)",
          senderColor: "#e11d48"
        });
      });

      // Initial check for unread announcements
      newSocket.emit("get_announcements", (res: any) => {
        if (res?.announcements && Array.isArray(res.announcements) && res.announcements.length > 0) {
          const visibleList = res.announcements.filter((a: any) =>
            isVisibleToUser(a.targetRoles, currentUserRoles, isEmirganUser)
          );
          if (visibleList.length > 0) {
            const newestId = Math.max(...visibleList.map((a: any) => Number(a.id)));
            latestAnnouncementIdRef.current = newestId;
            const lastRead = Number(localStorage.getItem("latest_read_announcement_id") || 0);
            if (newestId > lastRead) {
              setHasUnreadAnnouncement(true);
            }
          }
        }
      });

      // Handle mobile visibility change & window focus to immediately refresh presence and re-connect if needed
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          if (!newSocket.connected) {
            newSocket.connect();
          } else {
            newSocket.emit("heartbeat");
          }
        }
      };

      const handleFocus = () => {
        if (!newSocket.connected) {
          newSocket.connect();
        } else {
          newSocket.emit("heartbeat");
        }
      };

      // Periodic heartbeat every 30s to keep socket alive and active
      const heartbeatInterval = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit("heartbeat");
        }
      }, 30000);

      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleFocus);
      window.addEventListener("online", handleFocus);

      return () => {
        clearInterval(heartbeatInterval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.removeEventListener("focus", handleFocus);
        window.removeEventListener("online", handleFocus);
        newSocket.disconnect();
      };
    }
  }, [token]);

  const handleAuthSuccess = (newToken: string, newUsername: string, newAvatar: string | null, id: number, newColor?: string) => {
    localStorage.setItem("lan_token", newToken);
    localStorage.setItem("lan_username", newUsername);
    localStorage.setItem("lan_user_id", id.toString());
    if(newAvatar) localStorage.setItem("lan_avatar", newAvatar);
    else localStorage.removeItem("lan_avatar");
    if(newColor) localStorage.setItem("lan_color", newColor);
    setToken(newToken);
    setUsername(newUsername);
    setAvatar(newAvatar);
    setColor(newColor);
    setCurrentUserId(id);
    setViewingUserId(id);
    const startTab = preferences.defaultStartTab || "dashboard";
    handleTabChange(startTab);
  };

  const handleAvatarUpdated = (newAvatar: string) => {
    localStorage.setItem("lan_avatar", newAvatar);
    setAvatar(newAvatar);
  };

  const handleLogout = async () => {
    const curToken = token || localStorage.getItem("lan_token") || localStorage.getItem("token");
    if (curToken) {
      try {
        await fetch(getApiUrl("/api/auth/logout"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${curToken}`
          },
          body: JSON.stringify({ token: curToken })
        }).catch(() => {});
      } catch (e) {}
    }
    localStorage.removeItem("lan_account_role");
    localStorage.removeItem("lan_token");
    localStorage.removeItem("lan_username");
    localStorage.removeItem("lan_avatar");
    localStorage.removeItem("lan_color");
    localStorage.removeItem("lan_user_id");
    localStorage.removeItem("lan_user_roles");
    localStorage.removeItem("lan_is_demo");
    localStorage.removeItem("token");
    setToken(null);
    setCurrentUserRoles([]);
    setUsername("");
    setAvatar(null);
    setColor(undefined);
    if (socket) socket.disconnect();
    navigate("/");
  };

  const handleTabChange = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab === "announcements") {
      setHasUnreadAnnouncement(false);
      if (latestAnnouncementIdRef.current > 0) {
        localStorage.setItem("latest_read_announcement_id", String(latestAnnouncementIdRef.current));
      }
    }
    if (tab === "global") {
      setUnreadGlobalCount(0);
    }
    if (tab === "profile") {
      setViewingUserId(currentUserId);
    }
    if (tab === "notifications" && socket) {
      socket.emit("mark_notifications_read");
      setUnreadNotificationsCount(0);
    }
    if (tab !== "subject") {
      setActiveSubject(null);
    }

    const targetPath = getPathFromTab(tab, tab === "subject" ? activeSubject : null, null, currentUserId);
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }
  };

  const handleSubjectClick = (subject: string) => {
    setActiveSubject(subject);
    setActiveTab("subject");
    navigate(`/dersler/${encodeURIComponent(subject)}`);
  };

  const handleUserClick = (userId: number) => {
    setViewingUserId(userId);
    setActiveTab("profile");
    if (userId === currentUserId) {
      navigate("/profil");
    } else {
      navigate(`/profil/${userId}`);
    }
  };

  const handleOpenChat = (targetId: number) => {
    setTargetChatUserId(targetId);
    setActiveTab("chats");
    navigate("/sohbetler");
  };

  // If user is currently on predicted page but loses access, redirect safely

  // Android Hardware Back Button Handler (Capacitor Native)
  const lastBackPressRef = useRef<number>(0);

  useEffect(() => {
    let capListener: any = null;

    const handleHardwareBack = () => {
      // 0. If user is in ban screen or not authenticated (Auth screen)
      if (isDeviceBanned || !token) {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          try {
            CapApp.exitApp();
          } catch (e) {}
        } else {
          lastBackPressRef.current = now;
        }
        return;
      }

      // 1. Dispatch custom event for child components & active modals (e.g. Chat active thread, Game rooms, KVKK, Chip manager, etc.)
      const backEvt = new CustomEvent("kaps:hardware_back", {
        cancelable: true,
        detail: { handled: false }
      });
      window.dispatchEvent(backEvt);

      if (backEvt.detail?.handled) {
        return;
      }

      // 2. Check if top-level Announcement Modal is open
      if (activeAnnouncementModal) {
        localStorage.setItem("latest_read_announcement_id", String(activeAnnouncementModal.id));
        setHasUnreadAnnouncement(false);
        setActiveAnnouncementModal(null);
        return;
      }

      // 3. Check if inside a Subject / Folder view
      if (activeSubject) {
        setActiveSubject(null);
        navigate("/dersler");
        return;
      }

      // 4. Check if viewing another user's profile
      if (activeTab === "profile" && viewingUserId !== currentUserId) {
        setViewingUserId(currentUserId);
        navigate("/profil");
        return;
      }

      // 5. If not on root path, navigate back
      if (location.pathname !== "/") {
        navigate(-1);
        return;
      }

      // 6. On root / main tab: Double press within 2000ms to exit app
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        try {
          CapApp.exitApp();
        } catch (e) {
          // In browser environment, exitApp is a safe no-op
        }
      } else {
        lastBackPressRef.current = now;
        addToast({
          type: "system_info",
          title: "KapsApp",
          text: "Uygulamadan çıkmak için tekrar dokunun."
        });
      }
    };

    // Listen on Capacitor App backButton event
    try {
      CapApp.addListener("backButton", () => {
        handleHardwareBack();
      }).then((handle) => {
        capListener = handle;
      }).catch(() => {});
    } catch (e) {}

    return () => {
      if (capListener && typeof capListener.remove === "function") {
        capListener.remove();
      }
    };
  }, [activeAnnouncementModal, activeSubject, activeTab, currentUserId, viewingUserId, isDeviceBanned, token, location.pathname, navigate]);

  if (isDeviceBanned) {
    return <DeviceBanScreen reason={deviceBanReason} onRetry={() => window.location.reload()} />;
  }

  // Password Reset View (Deep-link /sifre-sifirla?token=...)
  const isResetPasswordRoute = location.pathname === "/sifre-sifirla" || location.pathname === "/reset-password";
  const resetTokenFromUrl = new URLSearchParams(location.search).get("token") || resetPasswordToken;

  if (isResetPasswordRoute && resetTokenFromUrl) {
    return (
      <ResetPasswordView
        token={resetTokenFromUrl}
        onSuccess={() => {
          setResetPasswordToken(null);
          navigate("/", { replace: true });
        }}
        onCancel={() => {
          setResetPasswordToken(null);
          navigate("/", { replace: true });
        }}
      />
    );
  }

  if (!token) {
    return (
      <Auth 
        onAuthSuccess={handleAuthSuccess} 
        onNavigateToReset={(tok) => {
          setResetPasswordToken(tok);
          navigate(`/sifre-sifirla?token=${tok}`);
        }}
      />
    );
  }

  return (
    <CallProvider
      socket={socket}
      currentUserId={currentUserId}
      onOpenChatWithUser={(targetId) => {
        handleOpenChat(targetId);
      }}
      onShowToast={(msg, type) => {
        addToast({
          type: type === "error" ? "system_error" : "system_info",
          title: type === "error" ? "Hata" : "Sistem",
          text: msg
        });
      }}
    >
      <div className="app-shell flex flex-col lg:flex-row h-[100dvh] w-full max-w-[100vw] bg-white dark:bg-slate-900 md:bg-slate-50 md:dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      <IncomingActivityInvites key={currentUserId} socket={socket} />
      {/* Semantic Top Heading for Search Crawlers & Accessibility */}
      <h1 className="sr-only">KapsApp - Canlı Harita ve Çevrimiçi Oyun Platformu</h1>

      {/* Floating Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={dismissToast}
        onClick={handleNotificationClick}
      />

      {/* Screen-center dropping animated Announcement Modal */}
      <AnnouncementModal
        announcement={activeAnnouncementModal}
        onClose={() => {
          if (activeAnnouncementModal) {
            localStorage.setItem("latest_read_announcement_id", String(activeAnnouncementModal.id));
            setHasUnreadAnnouncement(false);
          }
          setActiveAnnouncementModal(null);
        }}
        onGoToAnnouncements={() => {
          if (activeAnnouncementModal) {
            localStorage.setItem("latest_read_announcement_id", String(activeAnnouncementModal.id));
            setHasUnreadAnnouncement(false);
          }
          setActiveAnnouncementModal(null);
          handleTabChange("announcements");
        }}
      />

      {/* Global Command Palette (Ctrl+K / Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigateTab={(tab: AppTab) => handleTabChange(tab)}
        onNavigateSubject={(subject: string) => handleSubjectClick(subject)}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        isEmirgan={isEmirgan}
      />

      {/* Mobile Top Header with Command Palette Trigger, Settings & Theme Toggle */}
      <div className="lg:hidden flex items-center justify-between px-3.5 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shrink-0 z-20 transition-colors duration-200">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-xs shadow-xs">
            KA
          </div>
          <span className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">KapsApp</span>
          {isEmirgan && (
            <span className="text-[10px] font-mono font-bold text-amber-500">· ROOT</span>
          )}
          {preferences.doNotDisturb && (
            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1" title="Odak Modu (Rahatsız Etmeyin) Aktif">
              <BellOff size={12} />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mobile Command Search Button */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            title="Hızlı Arama & Komut Paleti (Ctrl+K)"
            aria-label="Hızlı Arama & Komut Paleti"
          >
            <Search size={17} />
          </button>

          {/* Mobile Direct Settings Button */}
          <Link
            to="/ayarlar"
            onClick={() => handleTabChange('settings')}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              activeTab === 'settings'
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200/60 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="Ayarlar & Temalar"
          >
            <SettingsIcon size={17} />
          </Link>

          {/* Mobile Direct Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={handleToggleDarkMode}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
            title={darkMode ? "Açık Temaya Geç" : "Koyu Temaya Geç"}
          >
            {darkMode ? (
              <Sun size={16} className="text-amber-500" />
            ) : (
              <Moon size={16} className="text-indigo-500" />
            )}
            <span className="text-xs font-bold">{darkMode ? "Açık" : "Koyu"}</span>
          </button>
        </div>
      </div>

      {/* Desktop Sidebar — Collapsible & Categorized */}
      <div
        className={`hidden lg:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800/90 transition-all duration-200 shrink-0 ${
          preferences.sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header + Collapse Button */}
        <div className={`h-16 px-4 flex items-center border-b border-slate-200/70 dark:border-slate-800/70 ${preferences.sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-blue-600/20 shrink-0">
              KA
            </div>
            {!preferences.sidebarCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                    KapsApp
                  </h1>
                  {isEmirgan && (
                    <span className="text-[10px] font-mono font-bold text-amber-500">· ROOT</span>
                  )}
                </div>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
                  Akademik & Sosyal Çalışma Alanı
                </p>
              </div>
            )}
          </div>
          {!preferences.sidebarCollapsed && (
            <button
              type="button"
              onClick={() => handleUpdatePreferences({ sidebarCollapsed: true })}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kenar Çubuğunu Daralt"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        {/* Command Palette Quick Search Button */}
        <div className="px-3 pt-3 pb-1">
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className={`w-full flex items-center ${
              preferences.sidebarCollapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
            } rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 transition-all cursor-pointer group`}
            title="Hızlı Arama & Komut Paleti (Ctrl+K)"
          >
            <span className="flex items-center gap-2.5 text-xs font-semibold group-hover:text-slate-800 dark:group-hover:text-slate-200">
              <Search size={15} className="text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
              {!preferences.sidebarCollapsed && <span>Hızlı Ara...</span>}
            </span>
            {!preferences.sidebarCollapsed && (
              <kbd className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200/80 dark:border-slate-700">
                ⌘K
              </kbd>
            )}
          </button>
        </div>

        {/* Categorized Navigation Scroll Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-4">
          {/* En Üst Özel Bölüm: IB M27 Sınavları */}
          <div className="space-y-1">
            <NavItem 
              to="/ib-m27-sinavlari"
              collapsed={preferences.sidebarCollapsed}
              icon={<GraduationCap size={18} className="text-amber-500" />} 
              label="IB M27 Sınavları" 
              active={activeTab === 'ib-m27'} 
              extraBadge={
                <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 tabular-nums">
                  M27
                </span>
              }
              onClick={() => handleTabChange('ib-m27')} 
            />
          </div>

          {/* Group 1: Çalışma Alanı */}
          <div className="space-y-1">
            {!preferences.sidebarCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Çalışma Alanı
              </div>
            )}
            <NavItem 
              to="/"
              collapsed={preferences.sidebarCollapsed}
              icon={<Home size={18} />} 
              label="Ana Sayfa" 
              active={activeTab === 'dashboard'} 
              onClick={() => handleTabChange('dashboard')} 
            />
            {isEmirgan && (
              <NavItem 
                to="/emirgan"
                collapsed={preferences.sidebarCollapsed}
                icon={<Crown size={18} className="text-amber-500" />} 
                label="Emirgan Panel" 
                active={activeTab === 'admin'} 
                badge={pendingApprovalsCount} 
                onClick={() => handleTabChange('admin')} 
              />
            )}
            <NavItem 
              to="/duyurular"
              collapsed={preferences.sidebarCollapsed}
              icon={<Megaphone size={18} />} 
              label="Duyurular" 
              active={activeTab === 'announcements'} 
              dotBadge={hasUnreadAnnouncement} 
              onClick={() => handleTabChange('announcements')} 
            />
            <NavItem 
              to="/ajanda"
              collapsed={preferences.sidebarCollapsed}
              icon={<CalendarDays size={18} />} 
              label="Ajanda" 
              active={activeTab === 'agenda'} 
              onClick={() => handleTabChange('agenda')} 
            />
            <NavItem 
              to="/bildirimler" 
              collapsed={preferences.sidebarCollapsed}
              icon={<Bell size={18} />} 
              label="Bildirimler" 
              active={activeTab === 'notifications'} 
              badge={unreadNotificationsCount} 
              onClick={() => handleTabChange('notifications')} 
            />
          </div>

          {/* Group 2: Akademik & Kamp */}
          <div className="space-y-1">
            {!preferences.sidebarCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Akademik & Kamp
              </div>
            )}
            <NavItem 
              to="/dersler" 
              collapsed={preferences.sidebarCollapsed}
              icon={<Folder size={18} />} 
              label="Ders Klasörleri" 
              active={activeTab === 'folders' || activeTab === 'subject'} 
              onClick={() => handleTabChange('folders')} 
            />
            <NavItem 
              to="/ib-hesaplayici"
              collapsed={preferences.sidebarCollapsed}
              icon={<Calculator size={18} />} 
              label="KapsCulator (IB)" 
              active={activeTab === 'ib-calculator'} 
              onClick={() => handleTabChange('ib-calculator')} 
            />
            <NavItem 
              to="/ayvalik-cas"
              collapsed={preferences.sidebarCollapsed}
              icon={<Compass size={18} className="text-emerald-500" />} 
              label="Ayvalık CAS" 
              active={activeTab === 'ayvalik-cas'} 
              extraBadge={
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  25-27 Kas
                </span>
              }
              onClick={() => handleTabChange('ayvalik-cas')} 
            />
            <NavItem 
              to="/hava-durumu"
              collapsed={preferences.sidebarCollapsed}
              icon={<CloudSun size={18} />} 
              label="Hava Durumu" 
              active={activeTab === 'weather'} 
              extraBadge={
                miniWeatherBadge ? (
                  <span className="text-[11px] font-mono font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                    {miniWeatherBadge.emoji} {miniWeatherBadge.temp}°
                  </span>
                ) : null
              }
              onClick={() => handleTabChange('weather')} 
            />
          </div>

          {/* Group 3: İletişim & Sosyal */}
          <div className="space-y-1">
            {!preferences.sidebarCollapsed && (
              <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                İletişim & Sosyal
              </div>
            )}
            <NavItem 
              to="/sohbetler" 
              collapsed={preferences.sidebarCollapsed}
              icon={<MessageSquare size={18} />} 
              label="Özel Mesajlar" 
              active={activeTab === 'chats'} 
              badge={unreadDmCount} 
              onClick={() => handleTabChange('chats')} 
            />
            <NavItem 
              to="/genel-sohbet" 
              collapsed={preferences.sidebarCollapsed}
              icon={<Globe size={18} />} 
              label="Genel Sohbet" 
              active={activeTab === 'global'} 
              badge={unreadGlobalCount} 
              onClick={() => handleTabChange('global')} 
            />
            <NavItem 
              to="/sesli-sohbet" 
              collapsed={preferences.sidebarCollapsed}
              icon={<Radio size={18} />} 
              label="Sesli & Görüntülü" 
              active={activeTab === 'voice'} 
              onClick={() => handleTabChange('voice')} 
            />
            <NavItem 
              to="/akis" 
              collapsed={preferences.sidebarCollapsed}
              icon={<LayoutGrid size={18} />} 
              label="Sosyal Akış" 
              active={activeTab === 'feed'} 
              onClick={() => handleTabChange('feed')} 
            />
            <NavItem 
              to="/arkadaslar" 
              collapsed={preferences.sidebarCollapsed}
              icon={<Users size={18} />} 
              label="Arkadaşlar" 
              active={activeTab === 'friends'} 
              onClick={() => handleTabChange('friends')} 
            />
            <NavItem 
              to="/harita" 
              collapsed={preferences.sidebarCollapsed}
              icon={<MapPin size={18} />} 
              label="Canlı Harita" 
              active={activeTab === 'map'} 
              onClick={() => handleTabChange('map')} 
            />
            <NavItem 
              to="/oyunlar" 
              collapsed={preferences.sidebarCollapsed}
              icon={<Gamepad2 size={18} />} 
              label="Oyun Merkezi" 
              active={activeTab === 'games'} 
              onClick={() => handleTabChange('games')} 
            />
          </div>

          {/* Group 4: Hesap & Sistem */}
          <div className="space-y-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
            {!preferences.sidebarCollapsed && (
              <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Sistem
              </div>
            )}
            <NavItem 
              to="/profil" 
              collapsed={preferences.sidebarCollapsed}
              icon={<UserCircle2 size={18} />} 
              label="Profilim" 
              active={activeTab === 'profile'} 
              onClick={() => handleTabChange('profile')} 
            />
            <NavItem 
              to="/ayarlar" 
              collapsed={preferences.sidebarCollapsed}
              icon={<SettingsIcon size={18} />} 
              label="Ayarlar & Temalar" 
              active={activeTab === 'settings'} 
              onClick={() => handleTabChange('settings')} 
            />
          </div>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-1.5">
          {preferences.sidebarCollapsed && (
            <button
              type="button"
              onClick={() => handleUpdatePreferences({ sidebarCollapsed: false })}
              className="w-full flex items-center justify-center p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kenar Çubuğunu Genişlet"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}
          <div className={`flex items-center ${preferences.sidebarCollapsed ? 'flex-col gap-1.5' : 'gap-1.5'}`}>
            <button 
              type="button"
              onClick={handleToggleDarkMode}
              className={`flex-1 flex items-center ${preferences.sidebarCollapsed ? 'justify-center p-2.5' : 'justify-start gap-2.5 px-3 py-2'} rounded-xl transition-all text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer`}
              title={darkMode ? "Açık Temaya Geç" : "Koyu Temaya Geç"}
            >
              {darkMode ? <Sun size={16} className="text-amber-500 shrink-0" /> : <Moon size={16} className="text-indigo-500 shrink-0" />}
              {!preferences.sidebarCollapsed && <span>{darkMode ? "Açık Tema" : "Koyu Tema"}</span>}
            </button>

            <button
              type="button"
              onClick={() => handleUpdatePreferences({ doNotDisturb: !preferences.doNotDisturb })}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                preferences.doNotDisturb
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={preferences.doNotDisturb ? "Odak Modu Aktif (Bildirimler Sessiz)" : "Odak Modunu Aç"}
            >
              <BellOff size={15} />
            </button>
          </div>

          {!preferences.sidebarCollapsed && (
            <div className="px-2 py-0.5 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
              <span>Destek</span>
              <a href="mailto:destekkapsapp@gmail.com" className="text-blue-500 hover:underline font-medium">
                destekkapsapp@gmail.com
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="app-content flex-1 flex flex-col min-h-0 min-w-0 relative w-full max-w-full overflow-hidden">
        {activeTab === 'dashboard' && (
          <Dashboard 
            socket={socket} 
            currentUserId={currentUserId} 
            currentUsername={username} 
            avatar={avatar} 
            color={color} 
            currentUserRoles={currentUserRoles} 
            onlineUsers={onlineUsers} 
            onNavigate={(tab) => handleTabChange(tab)} 
            onUserClick={handleUserClick} 
            onStartChat={(targetId) => handleOpenChat(targetId)} 
            miniWeatherBadge={miniWeatherBadge} 
            unreadDmCount={unreadDmCount} 
            unreadGlobalCount={unreadGlobalCount} 
            hasUnreadAnnouncement={hasUnreadAnnouncement} 
            isEmirgan={isEmirgan}
            preferences={preferences}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          />
        )}
        {activeTab === 'admin' && isEmirgan && (
          <AdminPanel 
            socket={socket} 
            currentUsername={username} 
            onUserClick={handleUserClick} 
            onPendingCountChange={setPendingApprovalsCount}
          />
        )}
        {activeTab === 'announcements' && (
          <Announcements 
            socket={socket} 
            username={username} 
            currentUserId={currentUserId} 
            currentUserRoles={currentUserRoles}
            onAnnouncementsRead={(latestId) => {
              latestAnnouncementIdRef.current = latestId;
              localStorage.setItem("latest_read_announcement_id", String(latestId));
              setHasUnreadAnnouncement(false);
            }}
          />
        )}
        {activeTab === 'ib-m27' && (
          <IbM27ExamsPanel 
            currentUserRoles={currentUserRoles} 
            onUpdateUserRoles={setCurrentUserRoles}
            onNavigateCalculator={() => handleTabChange('ib-calculator')}
          />
        )}
        {activeTab === 'ib-calculator' && (
          <KapsculatorHub currentUserRoles={currentUserRoles} />
        )}
        {activeTab === 'agenda' && (
          <Agenda 
            socket={socket} 
            currentUserId={currentUserId} 
            currentUsername={username} 
            currentUserRoles={currentUserRoles}
          />
        )}
        {activeTab === 'global' && <GlobalChat socket={socket} currentUserId={currentUserId} currentUsername={username} onlineUsers={onlineUsers} onUserClick={handleUserClick} />}
        {activeTab === 'chats' && (
          <Chats 
            socket={socket} 
            currentUserId={currentUserId} 
            currentUsername={username} 
            onlineUsers={onlineUsers} 
            onUserClick={handleUserClick} 
            onUnreadDMsChange={setUnreadDmCount}
            targetUserId={targetChatUserId}
            onTargetUserHandled={() => setTargetChatUserId(null)}
            targetGroupId={targetGroupId}
            onTargetGroupHandled={() => setTargetGroupId(null)}
            onActiveChatUserChange={setActiveDmChatUserId}
            onActiveChatChange={setIsChatOpen}
          />
        )}
        {activeTab === 'feed' && <Feed socket={socket} currentUserId={currentUserId} currentUsername={username} onUserClick={handleUserClick} />}
        {activeTab === 'folders' && (
          <SubjectsDirectory 
            subjects={SUBJECTS}
            userRoles={currentUserRoles}
            onSelectSubject={handleSubjectClick} 
            socket={socket} 
          />
        )}
        {activeTab === 'subject' && (
          !activeSubject || (!SUBJECTS.includes(activeSubject) && !SUBJECTS.some(s => s.toLowerCase() === (activeSubject || '').toLowerCase())) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-950">
              <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
                  <FolderX size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Ders Bulunamadı (404)</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Aradığınız ders klasörü ({activeSubject || "Geçersiz Adres"}) mevcut değil veya adı hatalı girilmiş.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleTabChange('folders')}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  Tüm Ders Klasörlerine Dön
                </button>
              </div>
            </div>
          ) : resourceView === "sec" || resourceView === "ia" || resourceView === "ee" ? (
            <SubjectResources
              key={JSON.stringify([activeSubject, resourceView, resourceFolder])}
              subject={activeSubject}
              collection={resourceView === "sec" ? undefined : resourceView}
              folder={resourceFolder}
            />
          ) : (
            <Feed 
              socket={socket} 
              currentUserId={currentUserId} 
              currentUsername={username} 
              onUserClick={handleUserClick} 
              activeSubject={activeSubject} 
              onBackToFolders={() => handleTabChange('folders')}
            />
          )
        )}
        {activeTab === 'friends' && (
          <Friends 
            socket={socket} 
            currentUsername={username} 
            onlineUsers={onlineUsers} 
            onUserClick={handleUserClick} 
            onOpenChat={(targetId) => {
              setTargetChatUserId(targetId);
              setActiveTab('chats');
            }}
          />
        )}
        {activeTab === 'notifications' && <Notifications socket={socket} onNotificationClick={handleNotificationClick} />}
        {activeTab === 'profile' && (
          <Profile 
            socket={socket} 
            currentUserId={currentUserId} 
            viewingUserId={viewingUserId} 
            username={username} 
            avatar={avatar} 
            color={color} 
            onLogout={handleLogout} 
            onAvatarUpdated={handleAvatarUpdated} 
            onUserClick={handleUserClick}
            onOpenChat={(targetId) => {
              setTargetChatUserId(targetId);
              setActiveTab('chats');
            }}
            darkMode={darkMode}
            onToggleDarkMode={handleToggleDarkMode}
          />
        )}
        
        {/* Weather Dashboard Tab */}
        {activeTab === 'weather' && (
          <WeatherDashboard 
            darkMode={darkMode}
            onBackToMain={() => handleTabChange('dashboard')} 
          />
        )}

        {/* Ayvalık CAS 2026 Panel Tab */}
        {activeTab === 'ayvalik-cas' && (
          <AyvalikCasPanel 
            socket={socket}
            currentUserId={currentUserId}
            currentUsername={username}
            avatar={avatar}
            color={color}
            currentUserRoles={currentUserRoles}
            isEmirgan={isEmirgan}
            onBackToMain={() => handleTabChange('dashboard')}
          />
        )}

        {/* Ayarlar (Settings) Tab */}
        {activeTab === 'settings' && (
          <Settings 
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
            preferences={preferences}
            onUpdatePreferences={handleUpdatePreferences}
            onResetPreferences={handleResetPreferences}
            currentUsername={username}
            currentUserId={currentUserId}
            currentUserRoles={currentUserRoles}
            isEmirgan={isEmirgan}
            onLogout={handleLogout}
          />
        )}

        {/* Persistently mounted LiveMap tab to prevent re-initialization and gray tiles when switching tabs */}
        <div className={`flex-1 flex-col relative w-full h-full ${activeTab === 'map' ? 'flex' : 'hidden'}`}>
          <LiveMap 
            socket={socket} 
            currentUserId={currentUserId} 
            username={username} 
            avatar={avatar} 
            color={color} 
            isActive={activeTab === 'map'}
            onUserClick={handleUserClick}
            onOpenChat={(targetId) => {
              setTargetChatUserId(targetId);
              setActiveTab('chats');
            }}
          />
        </div>
        
        {/* Persistently mounted Voice Chat tab to preserve audio connection when switching tabs */}
        <div className={`flex-1 flex-col relative w-full h-full ${activeTab === 'voice' ? 'flex' : 'hidden'}`}>
          <VoiceChat socket={socket} currentUserId={currentUserId} currentUsername={username} avatar={avatar} color={color} onUserClick={handleUserClick} onRoomActiveChange={setIsInVoiceRoom} />
        </div>

        {/* Persistently mounted Games tab to preserve room and game state when navigating */}
        <div className={`flex-1 flex-col relative w-full h-full ${activeTab === 'games' ? 'flex' : 'hidden'}`}>
          <Games socket={socket} currentUserId={currentUserId} username={username} avatar={avatar} color={color} onUserClick={handleUserClick} />
        </div>
      </div>

      {/* Mobile Bottom Nav Bar (4 Ana Sekme + 1 'Daha Fazla' Çekmecesi) */}
      <BottomNav
        activeTab={activeTab}
        unreadDmCount={unreadDmCount}
        unreadNotificationsCount={unreadNotificationsCount}
        hasUnreadAnnouncement={hasUnreadAnnouncement}
        isMobileMoreOpen={isMobileMoreOpen}
        setIsMobileMoreOpen={setIsMobileMoreOpen}
        handleTabChange={handleTabChange}
        username={username}
        isEmirgan={isEmirgan}
        unreadGlobalCount={unreadGlobalCount}
        pendingApprovalsCount={pendingApprovalsCount}
        darkMode={darkMode}
        setDarkMode={(v: boolean) => handleThemeChange(v ? 'dark' : 'light')}
        handleLogout={handleLogout}
        isInVoiceRoom={isInVoiceRoom}
        isChatOpen={activeTab === 'chats' && isChatOpen}
      />

      {/* Global Birebir Sesli Arama ve Sesli Oda Davet Modülü Katmanları */}
      <IncomingCallNotification />
      <ActiveCallPanel />
      <VoiceCallInviteModal 
        invite={voiceInvite}
        onAccept={handleAcceptVoiceInvite}
        onReject={handleRejectVoiceInvite}
      />
      {/* Global Screen Shake & Flying "kap" Text Overlay */}
      <KapAttackOverlay socket={socket} />

      {/* Kapscare Jumpscare Video Overlay (FNAF Foxy Jumpscare) */}
      <KapscareOverlay socket={socket} currentUserId={currentUserId} />

      {/* Remote Custom Popup Overlay (Text, Image, Video Pop-up from Emirgan) */}
      <RemotePopupOverlay socket={socket} currentUserId={currentUserId} />

      {/* Ctrl + W Accident Prevention Warning Toast */}
      {ctrlWWarn && (
        <div 
          role="alert" 
          aria-live="assertive"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[999999] animate-bounce max-w-md w-full px-4 pointer-events-auto"
        >
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white rounded-2xl shadow-2xl border-2 border-amber-300 p-4 flex items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-black/30 border border-white/20 flex items-center justify-center text-xl shrink-0">
                ⚠️
              </div>
              <div className="min-w-0">
                <div className="font-black text-sm uppercase tracking-wider text-amber-200 flex items-center gap-2">
                  <span>ctrl + w</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 border border-amber-300/40 text-white">Engellendi</span>
                </div>
                <div className="text-xs font-semibold text-white/95 mt-0.5">
                  Sayfayı ve oyununuzu yanlışlıkla kapatmanızı önlemek için kısayol engellendi!
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCtrlWWarn(false)}
              className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer font-bold text-xs"
              title="Kapat"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
    </CallProvider>
  );
}

function DrawerGridItem({
  icon,
  label,
  active,
  badge,
  dotBadge,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  dotBadge?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center relative cursor-pointer ${
        active
          ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-extrabold shadow-xs"
          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      <div className="relative mb-1">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -top-1.5 -right-2 px-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border border-white dark:border-slate-900 leading-none shadow-sm">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : dotBadge ? (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse shadow-sm shadow-red-500/50"></span>
        ) : null}
      </div>
      <span className="text-[11px] font-bold leading-tight truncate max-w-full">
        {label}
      </span>
    </button>
  );
}

function NavItem({ 
  icon, 
  label, 
  to,
  active, 
  badge, 
  dotBadge, 
  extraBadge, 
  collapsed = false,
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  to?: string;
  active: boolean; 
  badge?: number; 
  dotBadge?: boolean; 
  extraBadge?: React.ReactNode; 
  collapsed?: boolean;
  onClick?: () => void; 
}) {
  const commonClass = `w-full flex items-center ${
    collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
  } rounded-xl transition-all relative cursor-pointer no-underline group text-[13px] ${
    active
      ? 'bg-blue-50/90 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold border border-blue-200/70 dark:border-blue-800/60 shadow-2xs'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 font-medium border border-transparent'
  }`;

  const tooltipId = `nav-tooltip-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

  const content = (
    <>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`relative shrink-0 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}>
          {icon}
          {collapsed && badge && badge > 0 ? (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-900" />
          ) : null}
          {collapsed && dotBadge && !badge ? (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
          ) : null}
        </div>
        {!collapsed && <span className="truncate">{label}</span>}
      </div>

      {/* Collapsed Sidebar Tooltip */}
      {collapsed && (
        <div 
          id={tooltipId}
          role="tooltip" 
          className="hidden group-hover:flex group-focus-visible:flex absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl z-50 whitespace-nowrap pointer-events-none items-center gap-1.5 border border-slate-700/80"
        >
          <span>{label}</span>
          {badge && badge > 0 && (
            <span className="px-1.5 py-0.2 bg-red-500 rounded-full text-[10px] font-bold">
              {badge}
            </span>
          )}
        </div>
      )}

      {!collapsed && (
        extraBadge ? (
          <div className="flex items-center shrink-0">
            {extraBadge}
          </div>
        ) : badge && badge > 0 ? (
           <span className="px-1.5 min-w-[18px] h-4.5 bg-red-500 text-white text-[10px] font-mono flex items-center justify-center rounded-md font-bold tabular-nums">
             {badge > 99 ? '99+' : badge}
           </span>
        ) : dotBadge ? (
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        ) : null
      )}
    </>
  );

  if (to) {
    return (
      <Link 
        to={to}
        onClick={onClick}
        className={commonClass}
        title={label}
        aria-label={label}
        aria-describedby={tooltipId}
      >
        {content}
      </Link>
    );
  }

  return (
    <button 
      type="button"
      onClick={onClick}
      className={commonClass}
      title={label}
      aria-label={label}
      aria-describedby={tooltipId}
    >
      {content}
    </button>
  );
}

