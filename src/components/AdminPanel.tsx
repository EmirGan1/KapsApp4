import React, { useState, useEffect, useCallback } from "react";
import { Socket } from "socket.io-client";
import { 
  Users, Laptop, Trash2, CheckCircle2, 
  RefreshCw, Megaphone, Search, Clock, 
  Unlock, Crown, AlertTriangle, Eye, UserX,
  Radio, HardDrive, Terminal, X, Check, Edit3, 
  ShieldAlert, Ban, UserCheck, ShieldCheck, Gamepad2, Tag,
  Award, Plus, ArrowUp, ArrowDown, Layers, Sparkles, Palette, Flame
} from "lucide-react";
import { getApiUrl } from "../utils/api";
import { COURSE_ROLES, CourseRole, sortRolesByPosition } from "../types";
import RoleBadges from "./RoleBadges";
import EditRolesModal from "./EditRolesModal";
import CreateRoleModal from "./CreateRoleModal";

interface AdminOverview {
  totalUsers: number;
  onlineCount: number;
  bannedUsersCount: number;
  bannedHardwareCount: number;
  totalPosts: number;
  totalMessages: number;
  totalAnnouncements: number;
  uptimeSeconds: number;
  memoryRssMb: number;
  nodeVersion: string;
  serverTime: string;
}

interface UserItem {
  id: number;
  username: string;
  email?: string;
  avatar?: string | null;
  color?: string;
  status?: string;
  is_admin?: number;
  is_banned?: number;
  isBanned?: number;
  banned_at?: string;
  ban_reason?: string;
  created_at?: string;
  last_seen?: string;
  device_fingerprint?: string;
  last_device_id?: string;
  signup_ip?: string;
  last_ip?: string;
  isOnline?: boolean;
  roles?: string[];
}

interface PendingUserItem {
  id: number;
  username: string;
  email?: string;
  signup_ip?: string;
  last_ip?: string;
  device_fingerprint?: string;
  last_device_id?: string;
  created_at?: string;
  status?: string;
}

interface BannedHardwareItem {
  id: number;
  device_fingerprint: string;
  banned_user_id?: string;
  banned_by?: string;
  reason?: string;
  banned_at?: string;
}

interface AccessLogItem {
  id: number;
  userId?: number;
  ipAddress?: string;
  action?: string;
  timestamp?: string;
}

interface AdminPanelProps {
  socket: Socket | null;
  currentUsername: string;
  onUserClick?: (userId: number) => void;
  onPendingCountChange?: (count: number) => void;
}

export default function AdminPanel({ socket, currentUsername, onUserClick, onPendingCountChange }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "users" | "roles" | "tables" | "hardware" | "broadcast" | "logs" | "activity">("pending");
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  
  // Data
  const [pendingUsers, setPendingUsers] = useState<PendingUserItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [bannedHardware, setBannedHardware] = useState<BannedHardwareItem[]>([]);
  const [logs, setLogs] = useState<AccessLogItem[]>([]);
  const [activeTables, setActiveTables] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<CourseRole[]>(COURSE_ROLES);

  // Screen Time Leaderboard States
  const [screenTimeLeaderboard, setScreenTimeLeaderboard] = useState<any[]>([]);
  const [screenTimeRange, setScreenTimeRange] = useState<"today" | "week" | "all">("all");
  const [loadingScreenTime, setLoadingScreenTime] = useState<boolean>(false);
  
  // Role Creator & Manager States
  const [newRoleName, setNewRoleName] = useState<string>("");
  const [newRoleKey, setNewRoleKey] = useState<string>("");
  const [newRoleColor, setNewRoleColor] = useState<string>("#F59E0B");
  const [newRolePosition, setNewRolePosition] = useState<number>(55);
  const [newRoleDescription, setNewRoleDescription] = useState<string>("");
  const [editingRole, setEditingRole] = useState<CourseRole | null>(null);
  const [editRoleName, setEditRoleName] = useState<string>("");
  const [editRoleColor, setEditRoleColor] = useState<string>("#6366F1");
  const [editRolePosition, setEditRolePosition] = useState<number>(0);
  const [editRoleDescription, setEditRoleDescription] = useState<string>("");
  const [roleActionLoading, setRoleActionLoading] = useState<boolean>(false);
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState<boolean>(false);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userFilter, setUserFilter] = useState<"all" | "online" | "banned" | "admins">("all");

  // Modals & Action States
  const [selectedUserForUsername, setSelectedUserForUsername] = useState<UserItem | null>(null);
  const [newUsernameInput, setNewUsernameInput] = useState<string>("");

  const [selectedUserForBan, setSelectedUserForBan] = useState<UserItem | null>(null);
  const [banType, setBanType] = useState<"account" | "hardware">("account");
  const [banReason, setBanReason] = useState<string>("Kural ihlali sebebiyle erişiminiz engellendi.");

  const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserItem | null>(null);
  const [selectedUserForRoles, setSelectedUserForRoles] = useState<UserItem | null>(null);

  // Broadcast
  const [broadcastTitle, setBroadcastTitle] = useState<string>("📢 YÖNETİCİ DUYURUSU");
  const [broadcastMessage, setBroadcastMessage] = useState<string>("");
  const [broadcastType, setBroadcastType] = useState<"urgent" | "info" | "warning">("urgent");

  // Manual Hardware Ban
  const [manualHardwareFp, setManualHardwareFp] = useState<string>("");
  const [manualHardwareReason, setManualHardwareReason] = useState<string>("Kural ihlali sebebiyle donanım banlandı.");

  // Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token") || localStorage.getItem("lan_token") || "";
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "X-Username": "emirgan"
    };
  };

  // 1. Fetch Pending Users
  const fetchPendingUsers = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/emirgan/pending-users"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = data.users || [];
        setPendingUsers(list);
        if (onPendingCountChange) onPendingCountChange(list.length);
      }
    } catch (e) {
      console.error("Error fetching pending users:", e);
    }
  }, [onPendingCountChange]);

  // 2. Fetch All Users (Sorted with Online first)
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const baseUrl = getApiUrl("/api/emirgan/all-users");
      const res = await fetch(baseUrl, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const rawUsers: UserItem[] = data.users || [];
        // Ensure online users are at top
        const sorted = [...rawUsers].sort((a, b) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
        setUsers(sorted);
      }
    } catch (e) {
      console.error("Error fetching all users:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. Fetch Overview & Hardware
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/overview"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (e) {
      console.error("Error fetching overview:", e);
    }
  }, []);

  const fetchBannedHardware = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/banned-hardware"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBannedHardware(data.hardware || []);
      }
    } catch (e) {
      console.error("Error fetching banned hardware:", e);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/access-logs"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Error fetching logs:", e);
    }
  }, []);

  const fetchActiveTables = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/admin/active-tables"), { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.tables)) {
          setActiveTables(data.tables);
        }
      }
    } catch (e) {
      console.error("Error fetching active tables:", e);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl("/api/roles"));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.roles)) {
          const mapped: CourseRole[] = data.roles.map((r: any) => {
            const staticMatch = COURSE_ROLES.find(
              (cr) => cr.id.toLowerCase() === (r.key || r.id).toLowerCase()
            );
            return {
              id: r.key || r.id,
              key: r.key || r.id,
              label: r.name || r.label,
              name: r.name || r.label,
              color: r.color || "#6366F1",
              position: Number(r.position) || 0,
              isCustom: Boolean(r.isCustom),
              description: r.description || staticMatch?.description,
              subjectGroup: staticMatch?.subjectGroup || (r.isCustom ? "custom" : undefined),
              level: staticMatch?.level
            };
          });
          setRolesList(mapped.sort((a, b) => (b.position || 0) - (a.position || 0)));
        }
      }
    } catch (e) {
      console.error("Error fetching roles:", e);
    }
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      showToast("Rol adı zorunludur.", "error");
      return;
    }
    const key = newRoleKey.trim() || newRoleName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    setRoleActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/roles"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: newRoleName.trim(),
          key,
          color: newRoleColor,
          position: Number(newRolePosition) || 50,
          description: newRoleDescription.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`"${newRoleName}" özel rolü başarıyla oluşturuldu!`, "success");
        setNewRoleName("");
        setNewRoleKey("");
        setNewRoleColor("#F59E0B");
        setNewRolePosition(55);
        setNewRoleDescription("");
        fetchRoles();
        if (socket && socket.connected) {
          socket.emit("roles:updated");
        }
      } else {
        showToast(data.error || "Rol oluşturulamadı.", "error");
      }
    } catch (err: any) {
      showToast("Hata: " + err.message, "error");
    } finally {
      setRoleActionLoading(false);
    }
  };

  const handleMoveRole = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rolesList.length) return;

    const updated = [...rolesList];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    // Recalculate descending positions with gap
    const highestPos = Math.max(...rolesList.map((r) => r.position || 0), 100);
    const reordered = updated.map((r, i) => ({
      id: r.id,
      key: r.key || r.id,
      position: highestPos - i * 5
    }));

    setRolesList(updated.map((r, i) => ({ ...r, position: highestPos - i * 5 })));

    try {
      const res = await fetch(getApiUrl("/api/admin/roles/order"), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ roles: reordered })
      });
      if (res.ok) {
        showToast("Rol hiyerarşisi ve görünüm sırası güncellendi.", "success");
        fetchRoles();
        if (socket && socket.connected) {
          socket.emit("roles:updated");
        }
      } else {
        showToast("Sıralama güncellenemedi.", "error");
      }
    } catch (err: any) {
      showToast("Hata: " + err.message, "error");
    }
  };

  const handleDeleteRole = async (role: CourseRole) => {
    if (!role.isCustom) {
      showToast("Standart IB ders rollerini silemezsiniz. Ancak kullanıcı profillerinden dilediğiniz gibi kaldırabilirsiniz.", "error");
      return;
    }
    if (!window.confirm(`"${role.label || role.name}" özel rolünü kalıcı olarak silmek istediğinize emin misiniz?`)) {
      return;
    }
    setRoleActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/roles/${role.id}`), {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Özel rol başarıyla silindi.", "success");
        fetchRoles();
        if (socket && socket.connected) {
          socket.emit("roles:updated");
        }
      } else {
        showToast(data.error || "Rol silinemedi.", "error");
      }
    } catch (err: any) {
      showToast("Hata: " + err.message, "error");
    } finally {
      setRoleActionLoading(false);
    }
  };

  const handleSaveEditedRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    setRoleActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/roles/${editingRole.id}`), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: editRoleName.trim(),
          color: editRoleColor,
          position: Number(editRolePosition) || 0,
          description: editRoleDescription.trim() || undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Rol başarıyla güncellendi.", "success");
        setEditingRole(null);
        fetchRoles();
        if (socket && socket.connected) {
          socket.emit("roles:updated");
        }
      } else {
        showToast(data.error || "Rol güncellenemedi.", "error");
      }
    } catch (err: any) {
      showToast("Hata: " + err.message, "error");
    } finally {
      setRoleActionLoading(false);
    }
  };

  const handleCloseTable = async (tableId: string) => {
    if (!window.confirm(`Masa (${tableId}) kapatılacak ve oyuncular lobiye yönlendirilecek. Onaylıyor musunuz?`)) return;
    setActionLoading(true);
    try {
      // 1. Emit instant socket events to close table across all clients immediately
      if (socket && socket.connected) {
        socket.emit("table:delete", { tableId });
        socket.emit("table:close", { tableId });
        socket.emit("admin_close_table", { tableId });
      }

      // Optimistically remove from state
      setActiveTables((prev) => prev.filter((t) => t.id !== tableId));

      // 2. Perform backend REST delete
      const res = await fetch(getApiUrl(`/api/admin/tables/${tableId}`), {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Masa ${tableId} başarıyla kapatıldı.`, "success");
      } else {
        // Fallback: try POST /api/admin/tables/:id/close
        const resFallback = await fetch(getApiUrl(`/api/admin/tables/${tableId}/close`), {
          method: "POST",
          headers: getAuthHeaders()
        });
        const dataFallback = await resFallback.json();
        if (resFallback.ok) {
          showToast(`Masa ${tableId} başarıyla kapatıldı.`, "success");
        } else {
          showToast(data.error || dataFallback.error || "Masa kapatılamadı.", "error");
        }
      }
      fetchActiveTables();
    } catch (err: any) {
      showToast("Hata: " + err.message, "error");
      fetchActiveTables();
    } finally {
      setActionLoading(false);
    }
  };

  // Initial load & socket listeners
  useEffect(() => {
    fetchPendingUsers();
    fetchUsers();
    fetchOverview();
    fetchActiveTables();
    fetchRoles();

    const interval = setInterval(() => {
      fetchPendingUsers();
      fetchActiveTables();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchPendingUsers, fetchUsers, fetchOverview, fetchActiveTables, fetchRoles]);

  useEffect(() => {
    if (!socket) return;

    const handlePendingUpdate = () => {
      fetchPendingUsers();
      fetchUsers();
      fetchOverview();
      fetchActiveTables();
    };

    const handleActiveTablesUpdate = (tables: any[]) => {
      if (Array.isArray(tables)) {
        setActiveTables(tables);
      }
    };

    socket.on("user:pending_approval", handlePendingUpdate);
    socket.on("pending_count_updated", handlePendingUpdate);
    socket.on("user:approved", handlePendingUpdate);
    socket.on("user:rejected", handlePendingUpdate);
    const handleRolesUpdate = (data: any) => {
      const uid = Number(data?.userId || data?.id);
      if (uid && data?.roles && Array.isArray(data.roles)) {
        setUsers((prev) => prev.map((u) => u.id === uid ? { ...u, roles: data.roles } : u));
      } else {
        fetchUsers();
      }
    };

    socket.on("user_banned", handlePendingUpdate);
    socket.on("user_unbanned", handlePendingUpdate);
    socket.on("user_deleted", handlePendingUpdate);
    socket.on("user:roles_updated", handleRolesUpdate);
    socket.on("roles:updated", fetchRoles);
    socket.on("active_tables_updated", handleActiveTablesUpdate);
    socket.on("online_users", () => {
      fetchUsers();
    });

    socket.emit("get_active_tables", (tables: any[]) => {
      if (Array.isArray(tables)) setActiveTables(tables);
    });

    return () => {
      socket.off("user:pending_approval", handlePendingUpdate);
      socket.off("pending_count_updated", handlePendingUpdate);
      socket.off("user:approved", handlePendingUpdate);
      socket.off("user:rejected", handlePendingUpdate);
      socket.off("user_banned", handlePendingUpdate);
      socket.off("user_unbanned", handlePendingUpdate);
      socket.off("user_deleted", handlePendingUpdate);
      socket.off("user:roles_updated", handleRolesUpdate);
      socket.off("roles:updated", fetchRoles);
      socket.off("active_tables_updated", handleActiveTablesUpdate);
      socket.off("online_users");
    };
  }, [socket, fetchPendingUsers, fetchUsers, fetchOverview, fetchActiveTables, fetchRoles]);

  // Fetch Screen Time Leaderboard from backend
  const fetchScreenTimeLeaderboard = async (rangeToFetch?: "today" | "week" | "all") => {
    const targetRange = rangeToFetch || screenTimeRange;
    setLoadingScreenTime(true);
    try {
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const res = await fetch(getApiUrl(`/api/admin/screen-time-leaderboard?range=${targetRange}`), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setScreenTimeLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error("Error fetching screen time leaderboard:", e);
    } finally {
      setLoadingScreenTime(false);
    }
  };

  // Tab change handler
  const handleTabChange = (tab: "pending" | "users" | "roles" | "tables" | "hardware" | "broadcast" | "logs" | "activity") => {
    setActiveTab(tab);
    if (tab === "pending") fetchPendingUsers();
    if (tab === "users") fetchUsers();
    if (tab === "roles") fetchRoles();
    if (tab === "tables") fetchActiveTables();
    if (tab === "hardware") fetchBannedHardware();
    if (tab === "logs") { fetchLogs(); fetchOverview(); }
    if (tab === "activity") { fetchScreenTimeLeaderboard(); }
  };

  // 1. Hesabı Onayla (Approve) - Kesin Çözüm
  const handleApprove = async (userId: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${userId}/approve`), {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Kullanıcı hesabı onaylandı.", "success");
        // Başarılı olursa listeden hemen düşür
        setPendingUsers(prev => {
          const updated = prev.filter(user => user.id !== userId);
          if (onPendingCountChange) onPendingCountChange(updated.length);
          return updated;
        });
        fetchUsers();
      } else {
        showToast(data.error || "İşlem başarısız", "error");
      }
    } catch (err: any) {
      console.error("Approve error:", err);
      showToast("Hata: " + err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Kaydı Reddet ve Sil (Reject) - Kesin Çözüm
  const handleReject = async (userId: number) => {
    if (!window.confirm("Bu kayıt başvurusunu reddetmek ve silmek istediğinize emin misiniz?")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${userId}/reject`), {
        method: "POST",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Kayıt reddedildi ve silindi.", "success");
        // Başarılı olursa listeden hemen düşür
        setPendingUsers(prev => {
          const updated = prev.filter(user => user.id !== userId);
          if (onPendingCountChange) onPendingCountChange(updated.length);
          return updated;
        });
        fetchUsers();
      } else {
        showToast(data.error || "İşlem başarısız", "error");
      }
    } catch (err: any) {
      console.error("Reject error:", err);
      showToast("Hata: " + err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUsername = async () => {
    if (!selectedUserForUsername || !newUsernameInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${selectedUserForUsername.id}/update-username`), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ newUsername: newUsernameInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı adı güncellendi.", "success");
        setSelectedUserForUsername(null);
        setNewUsernameInput("");
        fetchUsers();
      } else {
        showToast(data.error || "Kullanıcı adı güncellenemedi.", "error");
      }
    } catch (e: any) {
      showToast("Hata: " + e.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBan = async (user: UserItem) => {
    const isBanned = user.is_banned === 1 || user.isBanned === 1;
    if (isBanned) {
      // Unban
      setActionLoading(true);
      try {
        const res = await fetch(getApiUrl("/api/admin/unban-user"), {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId: user.id })
        });
        const data = await res.json();
        if (res.ok) {
          showToast(data.message || "Kullanıcı yasağı kaldırıldı.", "success");
          fetchUsers();
        } else {
          showToast(data.error || "İşlem başarısız oldu.", "error");
        }
      } catch (e: any) {
        showToast("Hata: " + e.message, "error");
      } finally {
        setActionLoading(false);
      }
    } else {
      setSelectedUserForBan(user);
      setBanType("account");
    }
  };

  const handleExecuteBan = async () => {
    if (!selectedUserForBan) return;
    setActionLoading(true);
    try {
      const endpoint = banType === "hardware" 
        ? `/api/admin/users/${selectedUserForBan.id}/ban-hardware`
        : `/api/admin/users/${selectedUserForBan.id}/ban-account`;

      const res = await fetch(getApiUrl(endpoint), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          reason: banReason,
          hardwareFingerprint: selectedUserForBan.device_fingerprint || selectedUserForBan.last_device_id
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı başarıyla banlandı.", "success");
        setSelectedUserForBan(null);
        fetchUsers();
        fetchBannedHardware();
      } else {
        showToast(data.error || "Banlama başarısız oldu.", "error");
      }
    } catch (e: any) {
      showToast("Hata: " + e.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleHardDeleteUser = async () => {
    if (!selectedUserForDelete) return;
    const deletedId = selectedUserForDelete.id;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/emirgan/users/${deletedId}`), {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Kullanıcı kalıcı olarak silindi.", "success");
        setUsers((prev) => prev.filter((u) => u.id !== deletedId));
        setPendingUsers((prev) => prev.filter((u) => u.id !== deletedId));
        setSelectedUserForDelete(null);
        fetchUsers();
        fetchPendingUsers();
        fetchOverview();
      } else {
        showToast(data.error || "Silme işlemi başarısız.", "error");
      }
    } catch (e: any) {
      showToast("Hata: " + e.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/broadcast-alert"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Canlı duyuru tüm kullanıcılara gönderildi.", "success");
        setBroadcastMessage("");
      } else {
        showToast(data.error || "Duyuru gönderilemedi.", "error");
      }
    } catch (e: any) {
      showToast("Hata: " + e.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnbanHardware = async (item: BannedHardwareItem) => {
    if (!window.confirm(`"${item.device_fingerprint}" donanım banını kaldırmak istediğinize emin misiniz?`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/unban-hardware"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ device_fingerprint: item.device_fingerprint, id: item.id })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Donanım banı kaldırıldı.", "success");
        fetchBannedHardware();
      } else {
        showToast(data.error || "İşlem başarısız oldu.", "error");
      }
    } catch (e: any) {
      showToast("Hata: " + e.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddManualHardwareBan = async () => {
    if (!manualHardwareFp.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/admin/ban-hardware-manual"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          device_fingerprint: manualHardwareFp.trim(),
          reason: manualHardwareReason
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Cihaz parmak izi banlandı.", "success");
        setManualHardwareFp("");
        fetchBannedHardware();
      } else {
        showToast(data.error || "İşlem başarısız oldu.", "error");
      }
    } catch (e: any) {
      showToast("Hata: " + e.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered users list (Always maintains Online-first sorting)
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchQuery = !q || u.username.toLowerCase().includes(q) || String(u.id).includes(q) || (u.last_ip && u.last_ip.includes(q));
    if (!matchQuery) return false;

    if (userFilter === "online") return Boolean(u.isOnline);
    if (userFilter === "banned") return u.is_banned === 1 || u.isBanned === 1;
    if (userFilter === "admins") return u.is_admin === 1 || u.username.toLowerCase() === 'emirgan';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-sm font-semibold border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-4 ${
          toastMessage.type === "success" 
            ? "bg-emerald-950/90 text-emerald-200 border-emerald-500/40" 
            : "bg-rose-950/90 text-rose-200 border-rose-500/40"
        }`}>
          {toastMessage.type === "success" ? <CheckCircle2 size={18} className="text-emerald-400" /> : <AlertTriangle size={18} className="text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 font-black">
            <Crown size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
                👑 Emirgan Yönetim Paneli
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                ROOT YÖNETİCİ
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>PANEL AKTİF</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Kayıt onayları, kullanıcı moderasyonu, çevrim içi durumu ve donanım güvenliği
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* KAP ATTACK TRIGGER BUTTONS */}
          <button
            onClick={() => {
              if (!socket) {
                showToast("Socket bağlantısı bulunamadı!", "error");
                return;
              }
              socket.emit("admin:trigger_kap_attack");
              showToast("🚀 KAP ATTACK BAŞLATILDI! (Tüm ekranlar 5 saniye sallanacak)", "success");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-500 hover:via-orange-400 hover:to-amber-400 text-white text-xs font-black tracking-wide shadow-md shadow-red-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Tüm kullanıcılara 5 saniyelik ekran sarsıntısı ve kap yağmuru gönderir"
          >
            <Flame size={14} className="text-yellow-200 animate-pulse" />
            <span>🚀 KAP ATTACK BAŞLAT</span>
          </button>

          <button
            onClick={() => {
              if (!socket) {
                showToast("Socket bağlantısı bulunamadı!", "error");
                return;
              }
              socket.emit("admin:stop_kap_attack");
              showToast("🛑 KAP ATTACK DURDURULDU!", "success");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-red-950/70 text-red-400 hover:text-red-300 text-xs font-bold transition-all border border-red-900/40 hover:border-red-700 cursor-pointer"
            title="KAP Attack efektini anında durdurur"
          >
            <span>🛑 KAP ATTACK DURDUR</span>
          </button>

          <button
            onClick={() => {
              fetchPendingUsers();
              fetchUsers();
              fetchOverview();
              showToast("Veriler yenilendi.", "success");
            }}
            disabled={loading || actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors border border-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading || actionLoading ? "animate-spin" : ""} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="px-4 sm:px-6 pt-3 border-b border-slate-800 bg-slate-900/50 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <button
          onClick={() => handleTabChange("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "pending"
              ? "bg-slate-950 text-amber-400 border-amber-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <ShieldCheck size={16} />
          <span>📋 Kayıt Onayları</span>
          {pendingUsers.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-amber-500 text-slate-950 animate-pulse">
              {pendingUsers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("users")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "users"
              ? "bg-slate-950 text-blue-400 border-blue-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Users size={16} />
          <span>👥 Tüm Kullanıcılar ({users.length})</span>
          {users.filter(u => u.isOnline).length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {users.filter(u => u.isOnline).length} Online
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("roles")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "roles"
              ? "bg-slate-950 text-indigo-400 border-indigo-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Award size={16} />
          <span>🏷️ Rol Yönetimi & Hiyerarşi ({rolesList.length})</span>
        </button>

        <button
          onClick={() => handleTabChange("tables")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "tables"
              ? "bg-slate-950 text-emerald-400 border-emerald-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Gamepad2 size={16} />
          <span>🎴 Aktif Masalar ({activeTables.length})</span>
          {activeTables.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("hardware")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "hardware"
              ? "bg-slate-950 text-rose-400 border-rose-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Laptop size={16} />
          <span>💻 Donanım Banları</span>
          {bannedHardware.length > 0 && (
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-950 text-rose-300 border border-rose-800">
              {bannedHardware.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange("broadcast")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "broadcast"
              ? "bg-slate-950 text-amber-400 border-amber-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Megaphone size={16} />
          <span>📢 Canlı Duyuru</span>
        </button>

        <button
          onClick={() => handleTabChange("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "logs"
              ? "bg-slate-950 text-emerald-400 border-emerald-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Terminal size={16} />
          <span>📊 Sistem Logları</span>
        </button>

        <button
          onClick={() => handleTabChange("activity")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === "activity"
              ? "bg-slate-950 text-purple-400 border-purple-500 shadow-sm"
              : "text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/50"
          }`}
        >
          <Clock size={16} className="text-purple-400" />
          <span>⏱️ Ekran Süresi</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 touch-pan-y overscroll-y-contain">
        
        {/* ========================================================= */}
        {/* TAB 1: KAYIT ONAYLARI (PENDING USERS)                     */}
        {/* ========================================================= */}
        {activeTab === "pending" && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500 text-slate-950 rounded-xl font-black shadow-md">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>Onay Bekleyen Kayıt Başvuruları</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950">
                        {pendingUsers.length} bekleyen
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Kullanıcılar siz onay verene kadar sisteme giriş yapamaz. Onayladığınız an hesap anında aktifleşir.
                    </p>
                  </div>
                </div>

                <button
                  onClick={fetchPendingUsers}
                  className="self-start sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/40 transition-colors cursor-pointer"
                >
                  <RefreshCw size={13} />
                  <span>Listeyi Yenile</span>
                </button>
              </div>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-base font-bold text-white">Harika! Onay Bekleyen Kayıt Yok</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Sisteme yeni bir kullanıcı kayıt olduğunda anında bu ekranda ve sol menü rozetinizde belirecektir.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-slate-900 border border-amber-500/30 hover:border-amber-500/60 rounded-2xl p-4 sm:p-5 transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-lg shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-white truncate">
                            {user.username}
                          </span>
                          <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ONAY BEKLİYOR
                          </span>
                          <span className="text-xs text-slate-500">
                            #ID: {user.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="text-slate-500" />
                            {user.created_at ? new Date(user.created_at).toLocaleString("tr-TR") : "Yeni"}
                          </span>
                          {user.signup_ip && (
                            <span className="flex items-center gap-1">
                              <Radio size={13} className="text-slate-500" />
                              IP: {user.signup_ip}
                            </span>
                          )}
                          {(user.device_fingerprint || user.last_device_id) && (
                            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-500 truncate max-w-[200px]">
                              <Laptop size={13} />
                              FP: {(user.device_fingerprint || user.last_device_id || "").slice(0, 12)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleApprove(user.id)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <UserCheck size={16} />
                        <span>✓ Onayla</span>
                      </button>

                      <button
                        onClick={() => handleReject(user.id)}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 hover:text-white text-rose-300 text-xs font-bold rounded-xl border border-rose-500/40 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                        <span>✕ Reddet ve Sil</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: TÜM KULLANICILAR (ONLINE ÖNCELİKLİ & ŞİFRESİZ)       */}
        {/* ========================================================= */}
        {activeTab === "users" && (
          <div className="space-y-4 max-w-6xl mx-auto">
            {/* Filter & Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Kullanıcı adı, ID veya IP ile ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                {(["all", "online", "banned", "admins"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setUserFilter(f)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors whitespace-nowrap cursor-pointer ${
                      userFilter === f
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    {f === "all" ? "Tümü" : f === "online" ? "🟢 Çevrim İçi" : f === "banned" ? "Banlı" : "Yöneticiler"}
                  </button>
                ))}

                <button
                  onClick={() => setIsCreateRoleModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer whitespace-nowrap shrink-0 ml-1"
                >
                  <Plus size={14} />
                  <span>Yeni Rol Oluştur</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="p-3.5 sm:p-4">Kullanıcı</th>
                      <th className="p-3.5 sm:p-4">Çevrim İçi Durumu</th>
                      <th className="p-3.5 sm:p-4 hidden md:table-cell">Kayıt / Son Görülme</th>
                      <th className="p-3.5 sm:p-4 hidden lg:table-cell">IP & Cihaz</th>
                      <th className="p-3.5 sm:p-4 text-right">Moderasyon İşlemleri</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                          Arama kriterlerine uygun kullanıcı bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const isBanned = user.is_banned === 1 || user.isBanned === 1;
                        const isRoot = user.username.toLowerCase() === "emirgan";
                        const isOnline = Boolean(user.isOnline);

                        return (
                          <tr key={user.id} className={`transition-colors ${isOnline ? 'bg-emerald-950/15 hover:bg-emerald-950/30' : 'hover:bg-slate-800/40'}`}>
                            <td className="p-3.5 sm:p-4">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm text-white ${user.color || "bg-blue-600"}`}>
                                    {user.username.charAt(0).toUpperCase()}
                                  </div>
                                  {isOnline && (
                                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse"></span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white truncate">{user.username}</span>
                                    {isRoot && (
                                      <Crown size={14} className="text-amber-400 shrink-0" />
                                    )}
                                  </div>
                                  <span className="text-[11px] text-slate-500 font-mono">ID: {user.id}</span>
                                  {/* IB Course Roles Badges */}
                                  <div className="mt-1">
                                    <RoleBadges
                                      roles={user.roles}
                                      size="sm"
                                      className="max-w-[260px]"
                                    />
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="p-3.5 sm:p-4">
                              <div className="flex items-center gap-2">
                                {isOnline ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-900/30">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Çevrim İçi
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-950 text-slate-400 border border-slate-800">
                                    <span className="w-2 h-2 rounded-full bg-slate-600"></span>
                                    Çevrim Dışı
                                  </span>
                                )}

                                {isBanned && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    YASAKLI (BAN)
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-3.5 sm:p-4 hidden md:table-cell text-xs text-slate-400">
                              <div>Kayıt: {user.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "-"}</div>
                              <div className="text-[11px] text-slate-500">
                                Son: {user.last_seen ? new Date(user.last_seen).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "-"}
                              </div>
                            </td>

                            <td className="p-3.5 sm:p-4 hidden lg:table-cell text-xs text-slate-400 font-mono">
                              <div className="truncate max-w-[150px]">{user.last_ip || user.signup_ip || "-"}</div>
                              <div className="text-[10px] text-slate-500 truncate max-w-[150px]">
                                {user.device_fingerprint ? `FP: ${user.device_fingerprint.slice(0, 10)}...` : "-"}
                              </div>
                            </td>

                            <td className="p-3.5 sm:p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Rol Ekle / Düzenle */}
                                <button
                                  onClick={() => setSelectedUserForRoles(user)}
                                  title="IB Ders Rollerini Düzenle"
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-700/50 transition-all cursor-pointer text-xs font-bold"
                                >
                                  <Tag size={13} />
                                  <span className="hidden sm:inline">Roller</span>
                                </button>

                                {/* İsim Değiştir */}
                                <button
                                  onClick={() => {
                                    setSelectedUserForUsername(user);
                                    setNewUsernameInput(user.username);
                                  }}
                                  title="Kullanıcı Adını Değiştir"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <Edit3 size={15} />
                                </button>

                                {/* Ban / Dondur Toggle */}
                                {!isRoot && (
                                  <button
                                    onClick={() => handleToggleBan(user)}
                                    title={isBanned ? "Banı Kaldır" : "Hesabı Dondur / Banla"}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      isBanned
                                        ? "bg-emerald-950 text-emerald-400 hover:bg-emerald-900 border border-emerald-800"
                                        : "bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white"
                                    }`}
                                  >
                                    {isBanned ? <Unlock size={15} /> : <Ban size={15} />}
                                  </button>
                                )}

                                {/* Cihaz / Donanım Banı */}
                                {!isRoot && (
                                  <button
                                    onClick={() => {
                                      setSelectedUserForBan(user);
                                      setBanType("hardware");
                                    }}
                                    title="Cihaz (Hardware) Banı Uygula"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Laptop size={15} />
                                  </button>
                                )}

                                {/* Kalıcı Sil */}
                                {!isRoot && (
                                  <button
                                    onClick={() => setSelectedUserForDelete(user)}
                                    title="Kullanıcıyı Kalıcı Olarak Sil"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: ROL YÖNETİMİ, ÖZEL ROL OLUŞTURUCU & HİYERARŞİ        */}
        {/* ========================================================= */}
        {activeTab === "roles" && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-indigo-500/15 via-purple-500/10 to-transparent border border-indigo-500/30 rounded-2xl p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-600 text-white rounded-xl font-black shadow-md shadow-indigo-600/30">
                    <Award size={24} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>Discord Tarzı Rol Yönetimi, Özel Roller & Hiyerarşi</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500 text-white">
                        {rolesList.length} Toplam Rol
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ders ve özel rollerin sıralamasını (hiyerarşisini) ayarlayın; profillerde ve bilgi kartlarında en üstte listelensin.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCreateRoleModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>+ Yeni Rol Oluştur</span>
                  </button>
                  <button
                    onClick={fetchRoles}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <RefreshCw size={13} className={roleActionLoading ? "animate-spin" : ""} />
                    <span>Yenile</span>
                  </button>
                </div>
              </div>

              {/* Quick Role Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-indigo-500/20 text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-slate-400 text-[11px]">Standart IB Dersleri</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {rolesList.filter((r) => !r.isCustom).length} Rol
                  </p>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-slate-400 text-[11px]">Özel Oluşturulan Roller</p>
                  <p className="text-sm font-bold text-amber-400 mt-0.5">
                    {rolesList.filter((r) => r.isCustom).length} Özel Rol
                  </p>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-slate-400 text-[11px]">Digital Society</p>
                  <p className="text-sm font-bold text-cyan-400 mt-0.5">SL & HL Aktif</p>
                </div>
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                  <p className="text-slate-400 text-[11px]">Zorunlu Rol Durumu</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">Tam Esnek (%100)</p>
                </div>
              </div>
            </div>

            {/* Main 2-Column Grid: Creator + Hierarchy Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Column 1: Custom Role Creator Box (lg:col-span-5) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800">
                    <Sparkles size={18} className="text-amber-400" />
                    <div>
                      <h3 className="text-sm font-bold text-white">Yeni Özel Rol Oluştur</h3>
                      <p className="text-[11px] text-slate-400">Emirgan/Admin özel yetkili rozetleri</p>
                    </div>
                  </div>

                  <form onSubmit={handleCreateRole} className="space-y-3.5 text-xs">
                    {/* Role Name */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Rol Adı (Title / Label) <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: Öğrenci Temsilcisi, Kulüp Başkanı"
                        value={newRoleName}
                        onChange={(e) => {
                          setNewRoleName(e.target.value);
                          if (!newRoleKey || newRoleKey === newRoleName.toLowerCase().replace(/[^a-z0-9_]/g, "_")) {
                            setNewRoleKey(e.target.value.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_"));
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-medium"
                        required
                      />
                    </div>

                    {/* Role Key / Slug */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Benzersiz Kod / ID (Key Slug)
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: student_rep, club_lead"
                        value={newRoleKey}
                        onChange={(e) => setNewRoleKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">Otomatik oluşturulur veya elle düzenleyebilirsiniz.</p>
                    </div>

                    {/* Color Picker & Presets */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                        <span>Rol Rengi (Color)</span>
                        <span className="font-mono text-[11px] text-slate-400">{newRoleColor}</span>
                      </label>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="color"
                          value={newRoleColor}
                          onChange={(e) => setNewRoleColor(e.target.value)}
                          className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-950 cursor-pointer p-0.5 shrink-0"
                        />
                        <input
                          type="text"
                          value={newRoleColor}
                          onChange={(e) => setNewRoleColor(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 font-mono text-xs uppercase"
                        />
                      </div>
                      {/* Color Presets */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {[
                          "#EF4444", "#F97316", "#F59E0B", "#10B981", "#14B8A6",
                          "#06B6D4", "#0284C7", "#3B82F6", "#6366F1", "#8B5CF6",
                          "#EC4899", "#E11D48"
                        ].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setNewRoleColor(c)}
                            style={{ backgroundColor: c }}
                            className={`w-5 h-5 rounded-lg transition-transform cursor-pointer shrink-0 ${
                              newRoleColor.toLowerCase() === c.toLowerCase() ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900" : "hover:scale-110 opacity-80 hover:opacity-100"
                            }`}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Hierarchy / Position */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                        <span>Görünüm Sırası / Hiyerarşi (Position)</span>
                        <span className="text-amber-400 font-bold">Değer: {newRolePosition}</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={newRolePosition}
                        onChange={(e) => setNewRolePosition(Number(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Daha yüksek değer (Örn: 95) rolün profilde daha üstte ve ilk sırada görünmesini sağlar.
                      </p>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">
                        Rol Açıklaması (İsteğe Bağlı)
                      </label>
                      <input
                        type="text"
                        placeholder="Örn: 2026 Dönem Öğrenci Temsilciliği Yetkisi"
                        value={newRoleDescription}
                        onChange={(e) => setNewRoleDescription(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Live Preview Box */}
                    <div className="p-3 bg-slate-950 border border-slate-800/90 rounded-xl space-y-1">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Canlı Önizleme</p>
                      <div className="flex items-center gap-2">
                        <div
                          style={{
                            backgroundColor: `${newRoleColor}20`,
                            borderColor: `${newRoleColor}60`
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-semibold shadow-xs"
                        >
                          <span
                            style={{
                              backgroundColor: newRoleColor,
                              boxShadow: `0 0 6px ${newRoleColor}99`
                            }}
                            className="w-2 h-2 rounded-full shrink-0"
                          />
                          <span className="text-slate-100 font-bold">
                            {newRoleName.trim() || "Rol Adı"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          (Sıra: {newRolePosition})
                        </span>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={roleActionLoading || !newRoleName.trim()}
                      className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Plus size={15} />
                      <span>{roleActionLoading ? "Kaydediliyor..." : "Özel Rolü Oluştur ve Kaydet"}</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Column 2: Hierarchy List & Ordering (lg:col-span-7) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
                  <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Rol Hiyerarşisi & Görünüm Sıralaması</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Üstteki roller profillerde en önde listelenir. Sıralamayı değiştirmek için okları kullanın.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-950 text-indigo-400 border border-slate-800">
                      En Üst ⬆ En Yüksek
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {rolesList.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">Kayıtlı rol bulunamadı.</div>
                    ) : (
                      rolesList.map((role, index) => {
                        return (
                          <div
                            key={role.id || role.key}
                            className={`flex items-center justify-between gap-2 p-2.5 sm:p-3 rounded-xl border transition-all ${
                              role.isCustom
                                ? "bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50"
                                : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                            }`}
                          >
                            {/* Left: Rank & Move Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-xs font-black text-slate-500 w-5 text-center">
                                #{index + 1}
                              </span>

                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveRole(index, "up")}
                                  disabled={index === 0}
                                  title="Yukarı Taşı (Hiyerarşiyi Yükselt)"
                                  className="p-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
                                >
                                  <ArrowUp size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveRole(index, "down")}
                                  disabled={index === rolesList.length - 1}
                                  title="Aşağı Taşı (Hiyerarşiyi Düşür)"
                                  className="p-1 rounded bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
                                >
                                  <ArrowDown size={11} />
                                </button>
                              </div>
                            </div>

                            {/* Middle: Role Badge & Details */}
                            <div className="flex-1 min-w-0 px-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div
                                  style={{
                                    backgroundColor: `${role.color}1A`,
                                    borderColor: `${role.color}4D`
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-bold"
                                >
                                  <span
                                    style={{ backgroundColor: role.color }}
                                    className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                                  />
                                  <span className="text-white">{role.label || role.name}</span>
                                </div>

                                {role.isCustom ? (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    ⭐ Özel Rol
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                    IB Dersi
                                  </span>
                                )}

                                <span className="text-[11px] font-mono text-slate-400">
                                  Hiyerarşi: <strong className="text-indigo-400">{role.position || 0}</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                                <span className="font-mono text-slate-500">ID: {role.key || role.id}</span>
                                {role.description && (
                                  <>
                                    <span className="text-slate-600">•</span>
                                    <span className="truncate max-w-[200px]">{role.description}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRole(role);
                                  setEditRoleName(role.label || role.name || "");
                                  setEditRoleColor(role.color || "#6366F1");
                                  setEditRolePosition(role.position || 0);
                                  setEditRoleDescription(role.description || "");
                                }}
                                title="Rolü Düzenle"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <Edit3 size={13} />
                              </button>

                              {role.isCustom && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRole(role)}
                                  title="Özel Rolü Sil"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-rose-400 hover:text-white transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: AKTİF MASALAR & ODALAR (MASA 21 SENKRONİZASYONU)     */}
        {/* ========================================================= */}
        {activeTab === "tables" && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/30 rounded-2xl p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500 text-slate-950 rounded-xl font-black shadow-md">
                    <Gamepad2 size={24} />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <span>Anlık Açık Oyun Masaları ve Odalar</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-slate-950">
                        {activeTables.length} Açık Masa
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Masa 21 ve saatlik/canlı açılan tüm oyundaki masalar anlık senkronize olarak burada listelenir.
                    </p>
                  </div>
                </div>

                <button
                  onClick={fetchActiveTables}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  <span>Yenile</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {activeTables.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <p className="text-3xl">🎴</p>
                  <p className="text-sm font-semibold">Şu anda açık canlı masa bulunmuyor.</p>
                  <p className="text-xs text-slate-500">Kullanıcılar masa açtığında veya Masa 21 oluşturulduğunda burada anında görüntülenecektir.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                      <tr>
                        <th className="p-3">Masa İsmi & ID</th>
                        <th className="p-3">Oyun Tipi</th>
                        <th className="p-3">Masa Sahibi (Host)</th>
                        <th className="p-3">Oyuncular & Bot</th>
                        <th className="p-3">Durum</th>
                        <th className="p-3">Açılış Zamanı</th>
                        <th className="p-3 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {activeTables.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{t.gameType === 'blackjack' ? '🃏' : t.gameType === 'batak' ? '♠️' : '🀄'}</span>
                              <div>
                                <div>{t.title || `Masa ${t.id}`}</div>
                                <div className="text-[10px] text-slate-500 font-mono">ID: {t.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 capitalize font-bold text-amber-400">
                            {t.gameType} {t.gameMode ? `(${t.gameMode})` : ''}
                          </td>
                          <td className="p-3 font-semibold text-slate-200">
                            {t.hostName} (ID: {t.hostId})
                          </td>
                          <td className="p-3 text-slate-300">
                            <span className="font-bold text-emerald-400">{t.playerCount}/{t.maxPlayers || 4}</span> Oyuncu
                            {t.botCount > 0 && <span className="text-slate-500 text-[10px] ml-1">({t.botCount} Bot)</span>}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'Oyunda' ? 'bg-amber-950 text-amber-300 border border-amber-800' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}>
                              ● {t.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[11px]">
                            {t.createdAt || '-'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleCloseTable(t.id)}
                              className="px-2.5 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-[11px] transition-all cursor-pointer"
                            >
                              Masayı Kapat
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: DONANIM BANLARI (HARDWARE BANS)                    */}
        {/* ========================================================= */}
        {activeTab === "hardware" && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {/* Manuel Donanım Banı Ekleme */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Laptop size={16} className="text-rose-400" />
                <span>Manuel Donanım Parmak İzi (Hardware FP) Banlama</span>
              </h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  placeholder="Hardware Fingerprint / Cihaz ID..."
                  value={manualHardwareFp}
                  onChange={(e) => setManualHardwareFp(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-rose-500"
                />
                <input
                  type="text"
                  placeholder="Yasaklama Sebebi..."
                  value={manualHardwareReason}
                  onChange={(e) => setManualHardwareReason(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
                />
                <button
                  onClick={handleAddManualHardwareBan}
                  disabled={!manualHardwareFp.trim() || actionLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                  Yasakla
                </button>
              </div>
            </div>

            {/* Yasaklı Donanımlar Listesi */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                <span>Yasaklanmış Cihazlar ({bannedHardware.length})</span>
                <button
                  onClick={fetchBannedHardware}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} /> Yenile
                </button>
              </h3>

              {bannedHardware.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">
                  Yasaklanmış cihaz veya donanım bulunmuyor.
                </p>
              ) : (
                <div className="space-y-2">
                  {bannedHardware.map((hw) => (
                    <div
                      key={hw.id || hw.device_fingerprint}
                      className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-rose-300 font-bold truncate">
                          {hw.device_fingerprint}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Sebep: {hw.reason || "Kural ihlali"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleUnbanHardware(hw)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        Banı Kaldır
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: CANLI DUYURU & ACİL BİLDİRİM                      */}
        {/* ========================================================= */}
        {activeTab === "broadcast" && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40 font-bold">
                <Megaphone size={22} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Anlık Sistem Duyurusu / Acil Bildirim</h2>
                <p className="text-xs text-slate-400">
                  Tüm aktif kullanıcılara canlı modal veya bildirim olarak doğrudan iletilir.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Duyuru Başlığı</label>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Duyuru Türü</label>
                <div className="flex gap-3">
                  {(["urgent", "info", "warning"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setBroadcastType(t)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer ${
                        broadcastType === t
                          ? "bg-amber-500 text-slate-950 font-black shadow-md"
                          : "bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800"
                      }`}
                    >
                      {t === "urgent" ? "🚨 Acil" : t === "info" ? "ℹ️ Bilgi" : "⚠️ Uyarı"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Duyuru İçeriği</label>
                <textarea
                  rows={4}
                  placeholder="Duyuru metnini buraya yazın..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={handleSendBroadcast}
                disabled={!broadcastMessage.trim() || actionLoading}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Canlı Duyuruyu Herkese Gönder
              </button>
            </div>

            {/* KAP ATTACK TRIGGER PANEL */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              <div className="p-4 rounded-xl bg-gradient-to-br from-red-950/40 via-orange-950/30 to-slate-900 border border-red-500/30">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 text-red-400 font-black text-sm">
                    <Flame className="text-red-500 animate-pulse" size={18} />
                    <span>🔥 GLOBAL KAP ATTACK KONSOLU</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                    Eğlence Modu
                  </span>
                </div>
                <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                  Bu butona basıldığında sunucuya bağlı <strong>tüm kullanıcıların</strong> ekranı 5 saniye boyunca sarsılır (screen shake) ve ekranda rastgele neon &quot;kap&quot; yazıları uçuşur.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (!socket) {
                        showToast("Socket bağlantısı bulunamadı!", "error");
                        return;
                      }
                      socket.emit("admin:trigger_kap_attack");
                      showToast("🚀 KAP ATTACK BAŞLATILDI!", "success");
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-500 hover:to-orange-400 text-white font-black text-sm shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>🚀 KAP ATTACK BAŞLAT</span>
                  </button>
                  <button
                    onClick={() => {
                      if (!socket) {
                        showToast("Socket bağlantısı bulunamadı!", "error");
                        return;
                      }
                      socket.emit("admin:stop_kap_attack");
                      showToast("🛑 KAP ATTACK DURDURULDU!", "success");
                    }}
                    className="py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-red-400 hover:text-red-300 font-bold text-sm border border-red-900/50 hover:border-red-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🛑 KAP ATTACK DURDUR</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: SİSTEM & 5651 LOGLARI                              */}
        {/* ========================================================= */}
        {activeTab === "logs" && (
          <div className="space-y-4 max-w-5xl mx-auto">
            {overview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                  <p className="text-xs text-slate-400 font-medium">Toplam Kullanıcı</p>
                  <p className="text-xl font-black text-white mt-1">{overview.totalUsers}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                  <p className="text-xs text-slate-400 font-medium">Çevrimiçi</p>
                  <p className="text-xl font-black text-emerald-400 mt-1">{overview.onlineCount}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                  <p className="text-xs text-slate-400 font-medium">Yasaklı Hesaplar</p>
                  <p className="text-xl font-black text-rose-400 mt-1">{overview.bannedUsersCount}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-center">
                  <p className="text-xs text-slate-400 font-medium">Sunucu RAM</p>
                  <p className="text-xl font-black text-blue-400 mt-1">{overview.memoryRssMb} MB</p>
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                <span>5651 Sayılı Kanun Erişim ve Güvenlik Kayıtları</span>
                <button
                  onClick={fetchLogs}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} /> Yenile
                </button>
              </h3>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs max-h-96 overflow-y-auto space-y-1.5">
                {logs.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">Kayıt bulunamadı.</p>
                ) : (
                  logs.map((l) => (
                    <div key={l.id} className="text-slate-404 flex items-center justify-between gap-2 border-b border-slate-900 pb-1">
                      <span className="text-slate-300">
                        [{new Date(l.timestamp || "").toLocaleString("tr-TR")}] UID:{l.userId || "anon"} IP:{l.ipAddress}
                      </span>
                      <span className="text-amber-400 font-bold uppercase">{l.action}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 8: EKRAN SÜRESİ & AKTİFLİK LİDERLİK TABLOSU            */}
        {/* ========================================================= */}
        {activeTab === "activity" && (
          <div className="space-y-4 max-w-4xl mx-auto animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Clock size={18} className="text-purple-400" />
                  <span>Ekran Süresi & Aktiflik Liderlik Tablosu</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Kullanıcıların KapsApp üzerinde geçirdikleri aktif ekran sürelerinin liderlik tablosu
                </p>
              </div>

              {/* Time Range Selector & Refresh */}
              <div className="flex items-center gap-2.5">
                <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                  <button
                    onClick={() => {
                      setScreenTimeRange("today");
                      fetchScreenTimeLeaderboard("today");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      screenTimeRange === "today"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Bugün
                  </button>
                  <button
                    onClick={() => {
                      setScreenTimeRange("week");
                      fetchScreenTimeLeaderboard("week");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      screenTimeRange === "week"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Son 7 Gün
                  </button>
                  <button
                    onClick={() => {
                      setScreenTimeRange("all");
                      fetchScreenTimeLeaderboard("all");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      screenTimeRange === "all"
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Tüm Zamanlar
                  </button>
                </div>

                <button
                  onClick={() => fetchScreenTimeLeaderboard()}
                  disabled={loadingScreenTime}
                  className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer flex items-center justify-center"
                  title="Yenile"
                >
                  <RefreshCw size={14} className={loadingScreenTime ? "animate-spin text-purple-400" : ""} />
                </button>
              </div>
            </div>

            {/* Leaderboard Table Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              {loadingScreenTime && screenTimeLeaderboard.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-2">
                  <RefreshCw size={24} className="animate-spin text-purple-500 mx-auto" />
                  <p className="text-xs">Süre verileri yükleniyor...</p>
                </div>
              ) : screenTimeLeaderboard.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-xs">Bu zaman aralığında kaydedilmiş aktiflik verisi bulunmuyor.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        <th className="py-4 px-4 text-center w-16">Sıra</th>
                        <th className="py-4 px-4">Kullanıcı</th>
                        <th className="py-4 px-4 text-center">Toplam Süre</th>
                        <th className="py-4 px-4">Son Aktiflik</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {screenTimeLeaderboard.map((item, idx) => {
                        const rank = idx + 1;
                        
                        // Human-readable active time formatter
                        const formatSeconds = (totalSeconds: number) => {
                          if (totalSeconds <= 0) return "0sn";
                          const h = Math.floor(totalSeconds / 3600);
                          const m = Math.floor((totalSeconds % 3600) / 60);
                          const s = totalSeconds % 60;
                          
                          if (h > 0) return `${h}sa ${m}dk`;
                          if (m > 0) return `${m}dk ${s}sn`;
                          return `${s}sn`;
                        };

                        // Last active date helper
                        const lastSeenDate = item.last_seen 
                          ? new Date(item.last_seen).toLocaleString("tr-TR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "-";

                        // Ranking style highlight
                        let rankBadgeClass = "text-slate-400";
                        if (rank === 1) rankBadgeClass = "bg-amber-500 text-slate-950 font-black";
                        else if (rank === 2) rankBadgeClass = "bg-slate-300 text-slate-950 font-black";
                        else if (rank === 3) rankBadgeClass = "bg-amber-700 text-white font-black";

                        return (
                          <tr
                            key={item.user_id}
                            className="hover:bg-slate-800/30 transition-colors text-slate-300 text-xs font-semibold"
                          >
                            {/* Rank Column */}
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] ${
                                rank <= 3 ? rankBadgeClass : "border border-slate-800 text-slate-400"
                              }`}>
                                {rank}
                              </span>
                            </td>

                            {/* User details */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                {item.avatar_url ? (
                                  <img
                                    src={item.avatar_url.startsWith("/uploads/") || item.avatar_url.startsWith("http") ? item.avatar_url : `/uploads/${item.avatar_url}`}
                                    alt={item.username}
                                    className="w-8 h-8 rounded-full object-cover border border-purple-500/30"
                                    onError={(e) => {
                                      (e.target as any).src = "https://www.gravatar.com/avatar?d=mp";
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                                    style={{ backgroundColor: item.color || "#4F46E5" }}
                                  >
                                    {String(item.username || "?").substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="font-extrabold text-white text-xs flex items-center gap-1.5">
                                    <span>{item.name || item.username}</span>
                                    {item.username.toLowerCase() === "emirgan" && (
                                      <span className="px-1 text-[8px] font-black rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wide">
                                        KURUCU
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[10px] text-slate-500">@{item.username}</p>
                                </div>
                              </div>
                            </td>

                            {/* Total Screen Time */}
                            <td className="py-3.5 px-4 text-center font-mono font-black text-white text-xs">
                              {formatSeconds(item.total_seconds)}
                            </td>

                            {/* Last Activity */}
                            <td className="py-3.5 px-4 text-slate-400 text-[11px] font-medium">
                              {lastSeenDate}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODALS SECTION                                            */}
      {/* ========================================================= */}

      {/* Modal 1: Kullanıcı Adı Değiştir */}
      {selectedUserForUsername && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 size={18} className="text-indigo-400" />
                <span>Kullanıcı Adı Güncelle</span>
              </h3>
              <button
                onClick={() => setSelectedUserForUsername(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yeni Kullanıcı Adı</label>
              <input
                type="text"
                value={newUsernameInput}
                onChange={(e) => setNewUsernameInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForUsername(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleUpdateUsername}
                disabled={!newUsernameInput.trim() || actionLoading}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Ban / Donanım Banı Uygulama */}
      {selectedUserForBan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Ban size={18} className="text-rose-400" />
                <span>Yasakla: {selectedUserForBan.username}</span>
              </h3>
              <button
                onClick={() => setSelectedUserForBan(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Yasaklama Türü</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBanType("account")}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                    banType === "account"
                      ? "bg-rose-600 text-white border-rose-500"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  Hesap Banı (Dondur)
                </button>
                <button
                  type="button"
                  onClick={() => setBanType("hardware")}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                    banType === "hardware"
                      ? "bg-purple-600 text-white border-purple-500"
                      : "bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  💻 Cihaz / Donanım Banı
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Yasaklama Sebebi</label>
              <textarea
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForBan(null)}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl cursor-pointer"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleExecuteBan}
                disabled={actionLoading}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                Yasağı Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Kalıcı Kullanıcı Silme Onayı */}
      {selectedUserForDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-600 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <Trash2 size={24} />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-white">Hesabı Kalıcı Olarak Sil?</h3>
              <p className="text-xs text-slate-300 mt-1">
                <strong className="text-white font-bold">{selectedUserForDelete.username}</strong> hesabını ve ilişkili tüm verileri kalıcı olarak silmek üzeresiniz. Bu işlem <u>geri alınamaz</u>.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedUserForDelete(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleHardDeleteUser}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-xs font-black text-white rounded-xl cursor-pointer disabled:opacity-50"
              >
                Evet, Kalıcı Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Emirgan IB Ders Rolleri Düzenleme Modalı */}
      {selectedUserForRoles && (
        <EditRolesModal
          isOpen={Boolean(selectedUserForRoles)}
          onClose={() => setSelectedUserForRoles(null)}
          userId={selectedUserForRoles.id}
          username={selectedUserForRoles.username}
          currentRoles={selectedUserForRoles.roles}
          socket={socket}
          onRolesUpdated={(newRoles) => {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === selectedUserForRoles.id ? { ...u, roles: newRoles } : u
              )
            );
            setSelectedUserForRoles((prev) =>
              prev ? { ...prev, roles: newRoles } : null
            );
            showToast(`"${selectedUserForRoles.username}" kullanıcısının rolleri güncellendi.`, "success");
          }}
        />
      )}

      {/* Modal 5: Rol Düzenleme Modalı (İsim, Renk, Hiyerarşi) */}
      {editingRole && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: `${editRoleColor}20`, borderColor: `${editRoleColor}60` }}
                  className="p-2 rounded-xl border text-white font-bold"
                >
                  <Edit3 size={18} style={{ color: editRoleColor }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Rolü Düzenle</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {editingRole.key || editingRole.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditedRole} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Rol Adı (Label)</label>
                <input
                  type="text"
                  value={editRoleName}
                  onChange={(e) => setEditRoleName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>Rol Rengi</span>
                  <span className="font-mono text-slate-400">{editRoleColor}</span>
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value={editRoleColor}
                    onChange={(e) => setEditRoleColor(e.target.value)}
                    className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-950 cursor-pointer p-0.5 shrink-0"
                  />
                  <input
                    type="text"
                    value={editRoleColor}
                    onChange={(e) => setEditRoleColor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-slate-200 font-mono uppercase"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "#EF4444", "#F97316", "#F59E0B", "#10B981", "#14B8A6",
                    "#06B6D4", "#0284C7", "#3B82F6", "#6366F1", "#8B5CF6",
                    "#EC4899", "#E11D48"
                  ].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditRoleColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-5 h-5 rounded-lg cursor-pointer shrink-0 ${
                        editRoleColor.toLowerCase() === c.toLowerCase() ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900" : "opacity-80 hover:opacity-100"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center justify-between">
                  <span>Hiyerarşi / Sıralama Değeri (Position)</span>
                  <span className="text-amber-400 font-bold">{editRolePosition}</span>
                </label>
                <input
                  type="number"
                  value={editRolePosition}
                  onChange={(e) => setEditRolePosition(Number(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Açıklama</label>
                <input
                  type="text"
                  value={editRoleDescription}
                  onChange={(e) => setEditRoleDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRole(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={roleActionLoading || !editRoleName.trim()}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {roleActionLoading ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal 6: Discord Tarzı Özel Rol Oluşturucu Modalı */}
      <CreateRoleModal
        isOpen={isCreateRoleModalOpen}
        onClose={() => setIsCreateRoleModalOpen(false)}
        existingRoles={rolesList}
        socket={socket}
        onRoleCreated={(newRole) => {
          fetchRoles();
          showToast(`"${newRole.name || newRole.label}" özel rolü başarıyla oluşturuldu!`, "success");
        }}
      />
    </div>
  );
}
