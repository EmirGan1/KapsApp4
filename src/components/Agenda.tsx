import React, { useState, useEffect, useMemo } from "react";
import { Socket } from "socket.io-client";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  Utensils, 
  BookOpen, 
  GraduationCap, 
  Sparkles, 
  Trash2, 
  Edit3, 
  X, 
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Layers,
  Filter,
  Eye,
  Users,
  Target,
  Flame,
  Award,
  ArrowRight,
  Star,
  Timer,
  Search,
  ListFilter
} from "lucide-react";
import { getApiUrl } from "../utils/api";
import { AgendaEvent, isVisibleToUser, parseTargetRoles } from "../types";
import TargetRoleSelector from "./TargetRoleSelector";
import TargetRoleBadge from "./TargetRoleBadge";
import DailyScheduleModal from "./DailyScheduleModal";
import AgendaCalendar from "./AgendaCalendar";
import { 
  isMockExamPeriod, 
  buildDayScheduleWithOverlay, 
  CancelledClassInfo,
  OFFICIAL_MOCK_EXAMS,
  isUserEnrolledInExam
} from "../utils/mockExamData";

interface AgendaProps {
  socket: Socket | null;
  currentUserId: number;
  currentUsername?: string;
  currentUserRoles?: string[];
}

const MONTH_NAMES_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
];

const WEEKDAY_NAMES_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

export default function Agenda({
  socket,
  currentUserId,
  currentUsername,
  currentUserRoles = []
}: AgendaProps) {
  const isEmirgan = (currentUsername || "").trim().toLowerCase() === "emirgan";

  // Effective roles for current user
  const effectiveRoles = useMemo(() => {
    if (Array.isArray(currentUserRoles)) {
      return currentUserRoles;
    }
    try {
      const stored = localStorage.getItem("lan_user_roles");
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [currentUserRoles]);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [onlyMyExams, setOnlyMyExams] = useState<boolean>(false);
  const [agendaSearchQuery, setAgendaSearchQuery] = useState<string>("");
  const [agendaViewMode, setAgendaViewMode] = useState<"calendar" | "list" | "mock_overlay">("calendar");
  const [isLoading, setIsLoading] = useState(false);

  // Selected Day for Desktop Live Inspector & Mobile Bottom Drawer
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(() => new Date().toISOString().split("T")[0]);
  const [isDayDrawerOpen, setIsDayDrawerOpen] = useState(false);

  // Dedicated Food Menu Modal State
  const [selectedFoodEvent, setSelectedFoodEvent] = useState<AgendaEvent | null>(null);

  // Dedicated Exam Detail Modal State
  const [selectedExamEvent, setSelectedExamEvent] = useState<AgendaEvent | null>(null);

  // Dynamic Course Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Admin Event Form Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<AgendaEvent | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formType, setFormType] = useState<"food" | "homework" | "exam" | "event" | "study">("exam");
  const [formDescription, setFormDescription] = useState("");
  const [formTargetRoles, setFormTargetRoles] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Hover Tooltip state (Desktop)
  const [hoveredEvent, setHoveredEvent] = useState<{ event: AgendaEvent; x: number; y: number } | null>(null);

  // Live Countdown to Upcoming Exam:
  // Targets 1. Yarıyıl 1. Sınav Kuşağı (First Exam: 05 Kasım 2026 09:00 - Türk Dili ve Edebiyatı)
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPassed: boolean;
    title: string;
    subtitle: string;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPassed: false,
    title: "1. Yarıyıl 1. Sınav Kuşağı (12 G IB)",
    subtitle: "İlk Sınav: 05 Kasım 2026 Perşembe 09:00 • Türk Dili ve Edebiyatı"
  });

  useEffect(() => {
    const targetDate = new Date("2026-11-05T09:00:00+03:00").getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const diff = targetDate - now;

      if (diff <= 0) {
        setCountdown({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPassed: true,
          title: "1. Yarıyıl 1. Sınav Kuşağı (12 G IB)",
          subtitle: "Sınav Kuşağı Başladı! (03 - 13 Kasım 2026)"
        });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({
          days,
          hours,
          minutes,
          seconds,
          isPassed: false,
          title: "1. Yarıyıl 1. Sınav Kuşağı (12 G IB)",
          subtitle: "İlk Sınav: 05 Kasım 2026 Perşembe 09:00 • Türk Dili ve Edebiyatı"
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper to check if current user is enrolled in an exam's target roles
  const isEnrolledInEvent = (ev: AgendaEvent): boolean => {
    const targetRoles = parseTargetRoles((ev as any).targetRoles || (ev as any).target_roles);
    if (targetRoles.length === 0 || targetRoles.includes("all")) return true;
    const normalizedUserRoles = effectiveRoles.map(r => r.toLowerCase().trim());
    return targetRoles.some(tr => normalizedUserRoles.includes(tr.toLowerCase().trim()));
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedExamEvent) setSelectedExamEvent(null);
        else if (selectedFoodEvent) setSelectedFoodEvent(null);
        else if (isFormModalOpen) setIsFormModalOpen(false);
        else if (isDayDrawerOpen) setIsDayDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedExamEvent, selectedFoodEvent, isFormModalOpen, isDayDrawerOpen]);

  // Lock background body scroll when any modal or drawer is active on mobile / iOS
  useEffect(() => {
    const isAnyModalActive = Boolean(
      selectedExamEvent || selectedFoodEvent || isFormModalOpen || isDayDrawerOpen || isScheduleModalOpen
    );
    if (isAnyModalActive) {
      const origOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = origOverflow;
      };
    }
  }, [selectedExamEvent, selectedFoodEvent, isFormModalOpen, isDayDrawerOpen, isScheduleModalOpen]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Fetch events for current month (or all)
  const loadEvents = () => {
    setIsLoading(true);
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");

    if (socket && socket.connected) {
      socket.emit("get_agenda_events", { month: monthStr }, (data: AgendaEvent[]) => {
        setIsLoading(false);
        if (Array.isArray(data)) {
          setEvents(data);
        }
      });
    } else {
      fetch(getApiUrl(`/api/agenda?month=${monthStr}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then((res) => res.json())
        .then((data) => {
          setIsLoading(false);
          if (Array.isArray(data)) {
            setEvents(data);
          }
        })
        .catch((err) => {
          console.error("Agenda fetch error:", err);
          setIsLoading(false);
        });
    }
  };

  useEffect(() => {
    loadEvents();

    if (socket) {
      const onNewEvent = (newEvent: AgendaEvent) => {
        setEvents((prev) => {
          if (prev.some((e) => e.id === newEvent.id)) return prev;
          return [...prev, newEvent];
        });
      };
      const onUpdatedEvent = (updated: AgendaEvent) => {
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      };
      const onDeletedEvent = (data: { id: number }) => {
        setEvents((prev) => prev.filter((e) => e.id !== data.id));
      };
      const onRefresh = () => loadEvents();

      socket.on("new_agenda_event", onNewEvent);
      socket.on("agenda_event_updated", onUpdatedEvent);
      socket.on("agenda_event_deleted", onDeletedEvent);
      socket.on("agenda_updated", onRefresh);

      return () => {
        socket.off("new_agenda_event", onNewEvent);
        socket.off("agenda_event_updated", onUpdatedEvent);
        socket.off("agenda_event_deleted", onDeletedEvent);
        socket.off("agenda_updated", onRefresh);
      };
    }
  }, [socket, year, month]);

  // Calendar Grid Generation (Monday first)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const totalDays = lastDayOfMonth.getDate();
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = new Date().toISOString().split("T")[0];

    // Previous month padding days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const prevMonth = month === 0 ? 12 : month;
      const prevYear = month === 0 ? year - 1 : year;
      const dStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
      });
    }

    // Next month padding days to complete 35 or 42 grid items
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      const dStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dStr === todayStr,
      });
    }

    return days;
  }, [year, month]);

  // Group events by date string (filtered by user course roles, search & user selections)
  const eventsByDate = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    const q = agendaSearchQuery.trim().toLowerCase();
    events.forEach((ev) => {
      // Role visibility check: hidden if not visible to this user
      if (!isVisibleToUser((ev as any).targetRoles || (ev as any).target_roles, effectiveRoles, isEmirgan)) {
        return;
      }
      // "Sadece Benim Sınavlarım" filter toggle
      if (onlyMyExams && ev.event_type === "exam") {
        if (!isEnrolledInEvent(ev)) return;
      }
      if (selectedTypeFilter !== "all" && ev.event_type !== selectedTypeFilter) {
        return;
      }
      if (q) {
        const hay = `${ev.title || ""} ${ev.description || ""} ${ev.event_date || ""}`.toLowerCase();
        if (!hay.includes(q)) return;
      }
      if (!map[ev.event_date]) map[ev.event_date] = [];
      map[ev.event_date].push(ev);
    });
    return map;
  }, [events, selectedTypeFilter, onlyMyExams, agendaSearchQuery, effectiveRoles, isEmirgan]);

  const handlePrevMonth = () => {
    const next = new Date(year, month - 1, 1);
    setCurrentDate(next);
    setSelectedDayDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const handleNextMonth = () => {
    const next = new Date(year, month + 1, 1);
    setCurrentDate(next);
    setSelectedDayDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayDate(today.toISOString().split("T")[0]);
    if (window.innerWidth < 1024) {
      setIsDayDrawerOpen(true);
    }
  };

  const handleJumpToPreMock = () => {
    // Jump to October 2026
    setCurrentDate(new Date(2026, 9, 1)); // 9 = October
    setSelectedDayDate("2026-10-12");
    setSelectedTypeFilter("all");
    if (window.innerWidth < 1024) {
      setIsDayDrawerOpen(true);
    }
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDayDate(dateStr);
    if (window.innerWidth < 1024) {
      setIsDayDrawerOpen(true);
    }
  };

  const handleOpenAddForm = (dateStr?: string) => {
    setEditingEvent(null);
    setFormTitle("");
    setFormDate(dateStr || selectedDayDate || new Date().toISOString().split("T")[0]);
    setFormTime("");
    setFormType("exam");
    setFormDescription("");
    setFormTargetRoles([]);
    setIsFormModalOpen(true);
  };

  const handleOpenEditForm = (ev: AgendaEvent) => {
    setEditingEvent(ev);
    setFormTitle(ev.title);
    setFormDate(ev.event_date);
    setFormTime(ev.event_time || "");
    setFormType(ev.event_type);
    setFormDescription(ev.description || "");
    setFormTargetRoles(parseTargetRoles((ev as any).targetRoles || (ev as any).target_roles));
    setIsFormModalOpen(true);
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm("Bu etkinliği takvimden silmek istediğinize emin misiniz?")) return;

    if (socket && socket.connected) {
      socket.emit("delete_agenda_event", id, (res: any) => {
        if (res?.error) alert(res.error);
        else {
          setEvents((prev) => prev.filter((e) => e.id !== id));
        }
      });
    } else {
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      try {
        const res = await fetch(getApiUrl(`/api/agenda/${id}`), {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          setEvents((prev) => prev.filter((e) => e.id !== id));
        }
      } catch (err) {
        console.error("Delete event error:", err);
      }
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) {
      alert("Lütfen etkinlik başlığı ve tarihi girin.");
      return;
    }

    setFormSubmitting(true);
    const payload = {
      title: formTitle.trim(),
      event_date: formDate,
      event_time: formTime.trim() || null,
      event_type: formType,
      description: formDescription.trim() || null,
      targetRoles: formTargetRoles,
    };

    const token = localStorage.getItem("lan_token") || localStorage.getItem("token");

    if (editingEvent) {
      if (socket && socket.connected) {
        socket.emit("update_agenda_event", { id: editingEvent.id, ...payload }, (res: any) => {
          setFormSubmitting(false);
          if (res?.error) {
            alert(res.error);
          } else {
            setIsFormModalOpen(false);
            loadEvents();
          }
        });
      } else {
        try {
          const res = await fetch(getApiUrl(`/api/agenda/${editingEvent.id}`), {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          setFormSubmitting(false);
          if (data?.error) {
            alert(data.error);
          } else {
            setIsFormModalOpen(false);
            loadEvents();
          }
        } catch (err) {
          console.error("Update error:", err);
          setFormSubmitting(false);
        }
      }
    } else {
      if (socket && socket.connected) {
        socket.emit("create_agenda_event", payload, (res: any) => {
          setFormSubmitting(false);
          if (res?.error) {
            alert(res.error);
          } else {
            setIsFormModalOpen(false);
            loadEvents();
          }
        });
      } else {
        try {
          const res = await fetch(getApiUrl("/api/agenda"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          setFormSubmitting(false);
          if (data?.error) {
            alert(data.error);
          } else {
            setIsFormModalOpen(false);
            loadEvents();
          }
        } catch (err) {
          console.error("Create error:", err);
          setFormSubmitting(false);
        }
      }
    }
  };

  const getEventTypeStyles = (type: AgendaEvent["event_type"], isMyExam: boolean = false) => {
    switch (type) {
      case "exam":
        return {
          badge: isMyExam 
            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400 font-black ring-1 ring-amber-400/50" 
            : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300/50 font-bold",
          pill: isMyExam
            ? "bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400 dark:border-amber-500/60 hover:bg-amber-500/25 shadow-xs ring-1 ring-amber-400/30"
            : "bg-rose-50 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60",
          dot: isMyExam ? "bg-amber-400 ring-2 ring-amber-300" : "bg-rose-500",
          label: isMyExam ? "⭐ Sınavım" : "Sınav / Pre-Mock",
          icon: <GraduationCap size={13} className={`shrink-0 ${isMyExam ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`} />
        };
      case "food":
        return {
          badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300/50",
          pill: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60",
          dot: "bg-emerald-500",
          label: "Yemek Menüsü",
          icon: <Utensils size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        };
      case "study":
        return {
          badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300/50",
          pill: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20",
          dot: "bg-indigo-500",
          label: "Etüt / Destek",
          icon: <BookOpen size={13} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
        };
      case "homework":
        return {
          badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300/50",
          pill: "bg-blue-50 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60",
          dot: "bg-blue-500",
          label: "Ödev / Proje",
          icon: <BookOpen size={13} className="shrink-0 text-blue-600 dark:text-blue-400" />
        };
      default:
        return {
          badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300/50",
          pill: "bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60",
          dot: "bg-amber-500",
          label: "Etkinlik",
          icon: <Sparkles size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
        };
    }
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDayDate) return [];
    let list = eventsByDate[selectedDayDate] || [];
    if (onlyMyExams) {
      list = list.filter((e) => e.event_type !== "exam" || isEnrolledInEvent(e));
    }
    return list;
  }, [selectedDayDate, eventsByDate, onlyMyExams]);

  const sortedEventDates = useMemo(() => {
    return Object.keys(eventsByDate)
      .filter((d) => (eventsByDate[d] || []).length > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [eventsByDate]);

  const totalMonthFilteredEvents = useMemo(() => {
    return sortedEventDates.reduce((acc, d) => acc + (eventsByDate[d]?.length || 0), 0);
  }, [sortedEventDates, eventsByDate]);

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-200">
      
      {/* 1. THEME-ADAPTIVE EXAM WINDOW COMMAND BAR */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-2.5 shrink-0 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
            <span className="font-bold text-slate-900 dark:text-white">
              {countdown.title}
            </span>
            <span className="text-slate-400 hidden sm:inline">·</span>
            <span className="text-slate-500 dark:text-slate-400 truncate">
              {countdown.subtitle}
            </span>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            {!countdown.isPassed ? (
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums text-rose-600 dark:text-rose-400">
                <span>{countdown.days}g</span>
                <span>:</span>
                <span>{String(countdown.hours).padStart(2, "0")}s</span>
                <span>:</span>
                <span>{String(countdown.minutes).padStart(2, "0")}d</span>
                <span className="hidden xs:inline">:</span>
                <span className="hidden xs:inline">{String(countdown.seconds).padStart(2, "0")}sn</span>
              </div>
            ) : (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Sınav Dönemi Aktif · 03–13 Kasım 2026
              </span>
            )}

            <button
              onClick={handleJumpToPreMock}
              className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs transition-all cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
            >
              <span>Ekim 2026'ya Git</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. TOP WORKSPACE TOOLBAR: MONTH NAV, SEARCH, VIEW MODES & FILTERS */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 py-4 shadow-2xs shrink-0 z-10 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex flex-col gap-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Title & Month Navigation */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 flex items-center justify-center shrink-0">
                <CalendarDays size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                    {MONTH_NAMES_TR[month]} {year}
                  </h1>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Önceki Ay"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={handleTodayClick}
                      className="px-2 py-0.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    >
                      Bugün
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      title="Sonraki Ay"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                  Akademik Takvim, Pre-Mock Sınavları ve Yemek Menüsü · Bu ayda {totalMonthFilteredEvents} kayıt
                </p>
              </div>
            </div>

            {/* Search Input + Schedule Modal + Admin Add */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 sm:flex-initial sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={agendaSearchQuery}
                  onChange={(e) => setAgendaSearchQuery(e.target.value)}
                  placeholder="Sınav, etüt veya menü ara..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                {agendaSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setAgendaSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 whitespace-nowrap"
                title="Kişiselleştirilmiş Günlük ve Haftalık Ders Programınızı Görüntüleyin"
              >
                <CalendarDays size={15} className="shrink-0" />
                <span>Günlük Ders Programım</span>
              </button>

              {isEmirgan && (
                <button
                  type="button"
                  onClick={() => handleOpenAddForm()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <Plus size={15} />
                  <span>Etkinlik Ekle</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Sub-Tabs & 3-Way View Mode Switcher */}
          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {[
                { id: "all", label: "Tümü" },
                { id: "exam", label: "Sınavlar", dot: "bg-rose-500" },
                { id: "food", label: "Yemek Menüsü", dot: "bg-emerald-500" },
                { id: "study", label: "Etütler", dot: "bg-indigo-500" },
                { id: "homework", label: "Ödev & Proje", dot: "bg-blue-500" },
                { id: "event", label: "Etkinlikler", dot: "bg-amber-500" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedTypeFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedTypeFilter === f.id
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {f.dot && <span className={`w-2 h-2 rounded-full ${f.dot}`} />}
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {/* 3-Way View Mode Switcher */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setAgendaViewMode("calendar")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    agendaViewMode === "calendar"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Ay & Gün İnceleyici
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaViewMode("list")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    agendaViewMode === "list"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <ListFilter size={13} />
                  <span>Zaman Çizelgesi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAgendaViewMode("mock_overlay")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    agendaViewMode === "mock_overlay"
                      ? "bg-amber-400 text-slate-950 font-black shadow-xs"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <span>Mock Sınav Çizelgesi</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                </button>
              </div>

              {/* User's Own Enrolled Courses Toggle */}
              <button
                onClick={() => setOnlyMyExams(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shrink-0 ${
                  onlyMyExams
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                }`}
                title="Sadece kayıtlı olduğunuz IB derslerinin sınavlarını görüntüler"
              >
                <Star size={13} className={onlyMyExams ? "fill-slate-950 text-slate-950" : "text-amber-500"} />
                <span>Yalnızca Sınavlarım</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN MASTER-DETAIL WORKSPACE */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-24 sm:p-5 sm:pb-8 touch-pan-y overscroll-y-contain pb-safe">
        {agendaViewMode === "mock_overlay" ? (
          <div className="max-w-7xl mx-auto">
            <AgendaCalendar
              currentUserRoles={effectiveRoles}
              currentUsername={currentUsername}
              onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
            />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* LEFT / MAIN ZONE (8 columns on Desktop): Month Grid OR Chronological Timeline List */}
            <div className="lg:col-span-8 min-w-0">
              {agendaViewMode === "list" ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        {MONTH_NAMES_TR[month]} {year} · Kronolojik Zaman Çizelgesi
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                        {sortedEventDates.length} aktif günde toplam {totalMonthFilteredEvents} etkinlik listeleniyor
                      </p>
                    </div>
                  </div>

                  {sortedEventDates.length === 0 ? (
                    <div className="py-16 text-center">
                      <CalendarDays size={36} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Bu filtreyle eşleşen etkinlik bulunamadı
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Farklı bir ay seçebilir veya arama/kategori filtresini temizleyebilirsiniz.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedEventDates.map((dStr) => {
                        const dayList = eventsByDate[dStr] || [];
                        const isSelected = selectedDayDate === dStr;
                        return (
                          <div
                            key={dStr}
                            onClick={() => handleDayClick(dStr)}
                            className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                              isSelected
                                ? "border-indigo-500/70 bg-indigo-50/20 dark:bg-indigo-950/20 ring-1 ring-indigo-500/30"
                                : "border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                                <span className="px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 font-mono tabular-nums">
                                  {dStr.split("-").reverse().join(".")}
                                </span>
                                <span>
                                  {new Date(dStr).toLocaleDateString("tr-TR", {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long"
                                  })}
                                </span>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                                {dayList.length} kayıt
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {dayList.map((ev) => {
                                const isMyExam = ev.event_type === "exam" && isEnrolledInEvent(ev);
                                const st = getEventTypeStyles(ev.event_type, isMyExam);
                                return (
                                  <div
                                    key={ev.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedDayDate(dStr);
                                      if (ev.event_type === "exam") setSelectedExamEvent(ev);
                                      else if (ev.event_type === "food") setSelectedFoodEvent(ev);
                                      else if (window.innerWidth < 1024) setIsDayDrawerOpen(true);
                                    }}
                                    className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-400 transition-all flex flex-col justify-between gap-1.5"
                                  >
                                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                      <span className="font-semibold flex items-center gap-1">
                                        {st.icon}
                                        <span>{st.label}</span>
                                      </span>
                                      {ev.event_time && (
                                        <span className="font-mono tabular-nums">{ev.event_time}</span>
                                      )}
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                                      {ev.title}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xs border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col transition-colors duration-200">
                  {/* Weekday Header Row */}
                  <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-center py-2.5 font-bold text-xs text-slate-600 dark:text-slate-400">
                    {WEEKDAY_NAMES_TR.map((wd, i) => (
                      <div key={wd} className={i >= 5 ? "text-rose-500 dark:text-rose-400" : ""}>
                        {wd}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Day Grid (Monday to Sunday) */}
                  <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800/80 border-b border-slate-100 dark:border-slate-800/80">
                    {calendarDays.map((dayItem) => {
                      const dayEvents = eventsByDate[dayItem.dateStr] || [];
                      const isWeekend = new Date(dayItem.dateStr).getDay() === 0 || new Date(dayItem.dateStr).getDay() === 6;
                      const isAraTatil = dayItem.dateStr >= "2026-11-16" && dayItem.dateStr <= "2026-11-20";
                      const isSelectedDay = selectedDayDate === dayItem.dateStr;

                      return (
                        <div
                          key={dayItem.dateStr}
                          onClick={() => handleDayClick(dayItem.dateStr)}
                          className={`min-h-[56px] sm:min-h-[112px] xl:min-h-[124px] p-1 sm:p-2 flex flex-col justify-between transition-colors duration-150 cursor-pointer group relative ${
                            !dayItem.isCurrentMonth
                              ? "bg-slate-50/50 dark:bg-slate-950/40 text-slate-300 dark:text-slate-600 opacity-60"
                              : isAraTatil
                              ? "bg-amber-50/70 dark:bg-amber-950/25 border-amber-300/60 dark:border-amber-700/40 hover:bg-amber-100/50 dark:hover:bg-amber-950/40"
                              : isWeekend
                              ? "bg-slate-50/30 dark:bg-slate-900/40"
                              : "bg-white dark:bg-slate-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20"
                          } ${dayItem.isToday ? "ring-2 ring-blue-500 ring-inset z-10 bg-blue-50/20 dark:bg-blue-950/30" : ""} ${
                            isSelectedDay && !dayItem.isToday ? "ring-2 ring-indigo-500/80 ring-inset z-10 bg-indigo-50/25 dark:bg-indigo-950/30" : ""
                          }`}
                        >
                          {/* Top Bar inside Date Box */}
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-xs sm:text-sm font-bold tabular-nums w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all ${
                                dayItem.isToday
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : isSelectedDay
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : isAraTatil
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black"
                                  : dayItem.isCurrentMonth
                                  ? isWeekend
                                    ? "text-rose-500 dark:text-rose-400"
                                    : "text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                                  : "text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {dayItem.dayNumber}
                            </span>

                            {isEmirgan && dayItem.isCurrentMonth && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAddForm(dayItem.dateStr);
                                }}
                                className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer"
                                title="Bu Güne Etkinlik Ekle"
                              >
                                <Plus size={13} />
                              </button>
                            )}
                          </div>

                          {/* Desktop Event Pills */}
                          <div className={`hidden sm:flex flex-col gap-1 overflow-hidden my-auto ${dayItem.dateStr < new Date().toISOString().split("T")[0] ? "opacity-55 hover:opacity-100 transition-opacity" : ""}`}>
                            {(() => {
                              const foodEvent = dayEvents.find((e) => e.event_type === "food");
                              const otherEvents = dayEvents.filter((e) => e.event_type !== "food" && !e.title?.toLowerCase().includes("ara tatil"));
                              const isPast = dayItem.dateStr < new Date().toISOString().split("T")[0];

                              return (
                                <>
                                  {isAraTatil && (
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDayClick(dayItem.dateStr);
                                      }}
                                      className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40 cursor-pointer truncate"
                                      title="1. Dönem Ara Tatili"
                                    >
                                      <span>🌴</span>
                                      <span className="truncate">Ara Tatil</span>
                                    </div>
                                  )}

                                  {foodEvent && (
                                    <div 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setSelectedDayDate(dayItem.dateStr);
                                        setSelectedFoodEvent(foodEvent); 
                                      }}
                                      className={`mt-0.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border cursor-pointer transition-all truncate ${
                                        isPast 
                                          ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50' 
                                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:bg-emerald-500/20'
                                      }`}
                                      title="Yemek Menüsünü Gör"
                                    >
                                      <span>🍽️</span>
                                      <span className="truncate">Menü</span>
                                    </div>
                                  )}

                                  {otherEvents.slice(0, (foodEvent || isAraTatil) ? 2 : 3).map((ev) => {
                                    const isMyExam = ev.event_type === "exam" && isEnrolledInEvent(ev);
                                    const st = getEventTypeStyles(ev.event_type, isMyExam);

                                    return (
                                      <div
                                        key={ev.id}
                                        onMouseEnter={(e) => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setHoveredEvent({
                                            event: ev,
                                            x: rect.left + rect.width / 2,
                                            y: rect.top - 8,
                                          });
                                        }}
                                        onMouseLeave={() => setHoveredEvent(null)}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDayDate(dayItem.dateStr);
                                          if (ev.event_type === "exam") {
                                            setSelectedExamEvent(ev);
                                          } else if (window.innerWidth < 1024) {
                                            setIsDayDrawerOpen(true);
                                          }
                                        }}
                                        className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold truncate flex items-center gap-1 transition-all ${st.pill}`}
                                      >
                                        {st.icon}
                                        <span className="truncate">{ev.title}</span>
                                      </div>
                                    );
                                  })}

                                  {otherEvents.length > ((foodEvent || isAraTatil) ? 2 : 3) && (
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 pl-1 tabular-nums">
                                      +{otherEvents.length - ((foodEvent || isAraTatil) ? 2 : 3)} daha
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* Mobile Compact Indicators */}
                          <div className="sm:hidden flex items-center justify-center gap-1 mt-auto flex-wrap">
                            {(() => {
                              const foodEvent = dayEvents.find((e) => e.event_type === "food");
                              const otherEvents = dayEvents.filter((e) => e.event_type !== "food" && !e.title?.toLowerCase().includes("ara tatil"));

                              return (
                                <>
                                  {isAraTatil && (
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedDayDate(dayItem.dateStr);
                                        setIsDayDrawerOpen(true);
                                      }}
                                      className="text-[9px] px-1 py-0.5 rounded font-black bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/40 whitespace-nowrap cursor-pointer flex items-center gap-0.5"
                                    >
                                      <span>🌴</span>
                                    </span>
                                  )}
                                  {foodEvent && (
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFoodEvent(foodEvent);
                                      }}
                                      className="text-[11px] cursor-pointer"
                                    >
                                      🍽️
                                    </span>
                                  )}
                                  {otherEvents.slice(0, (foodEvent || isAraTatil) ? 2 : 3).map((ev) => {
                                    const isMyExam = ev.event_type === "exam" && isEnrolledInEvent(ev);
                                    const st = getEventTypeStyles(ev.event_type, isMyExam);
                                    return (
                                      <span
                                        key={ev.id}
                                        className={`w-1.5 h-1.5 rounded-full ${st.dot}`}
                                      />
                                    );
                                  })}
                                  {otherEvents.length > ((foodEvent || isAraTatil) ? 2 : 3) && (
                                    <span className="text-[8px] font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                                      +{otherEvents.length - ((foodEvent || isAraTatil) ? 2 : 3)}
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT ZONE (4 columns on Desktop): LIVE SELECTED-DAY INSPECTOR & DAILY TIMELINE */}
            <aside className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col lg:sticky lg:top-4">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/60">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-0.5">
                    Seçili Gün İnceleyici
                  </div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedDayDate
                      ? new Date(selectedDayDate).toLocaleDateString("tr-TR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric"
                        })
                      : "Bir Gün Seçin"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {selectedDayEvents.length} planlanan kayıt · {selectedDayDate || ""}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {isEmirgan && selectedDayDate && (
                    <button
                      type="button"
                      onClick={() => handleOpenAddForm(selectedDayDate)}
                      className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors cursor-pointer"
                      title="Bu Güne Etkinlik Ekle"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                  {selectedDayDate && (
                    <button
                      type="button"
                      onClick={() => setIsDayDrawerOpen(true)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Tam Pencerede Aç"
                    >
                      Büyüt
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5 max-h-[560px] overflow-y-auto">
                {selectedDayDate && selectedDayDate >= "2026-11-16" && selectedDayDate <= "2026-11-20" && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                    <span className="text-xl shrink-0">🌴</span>
                    <div>
                      <h4 className="font-bold text-amber-800 dark:text-amber-300 text-xs">
                        1. Dönem Ara Tatili (16–20 Kasım)
                      </h4>
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 mt-0.5 leading-relaxed">
                        Bu tarihlerde ders ve yemek servisi yapılmamaktadır.
                      </p>
                    </div>
                  </div>
                )}

                {selectedDayEvents.length === 0 ? (
                  <div className="py-10 text-center">
                    <CalendarDays size={32} className="mx-auto text-slate-300 dark:text-slate-700 mb-2.5" />
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs sm:text-sm">
                      Bu günde kayıtlı etkinlik yok
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Takvimden başka bir güne tıklayarak o günün yemek menüsünü ve sınav programını anında inceleyebilirsiniz.
                    </p>
                  </div>
                ) : (
                  selectedDayEvents.map((ev) => {
                    const isMyExam = ev.event_type === "exam" && isEnrolledInEvent(ev);
                    const st = getEventTypeStyles(ev.event_type, isMyExam);
                    return (
                      <div
                        key={ev.id}
                        onClick={() => {
                          if (ev.event_type === "exam") setSelectedExamEvent(ev);
                          else if (ev.event_type === "food") setSelectedFoodEvent(ev);
                          else setIsDayDrawerOpen(true);
                        }}
                        className={`rounded-2xl border p-3.5 transition-all cursor-pointer hover:shadow-sm ${
                          isMyExam
                            ? "border-amber-400/80 bg-amber-500/10"
                            : "border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 hover:border-indigo-400/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">
                          <span className="font-bold flex items-center gap-1 text-slate-700 dark:text-slate-200">
                            {st.icon}
                            <span>{st.label}</span>
                          </span>
                          {ev.event_time && (
                            <span className="font-mono tabular-nums">{ev.event_time}</span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-1">
                          {ev.title}
                        </h4>
                        {ev.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 whitespace-pre-line leading-relaxed">
                            {ev.description}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Haftalık Ders Çizelgesi</span>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Programı Aç</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </aside>

          </div>
        )}
      </div>

      {/* Desktop Hover Tooltip */}
      {hoveredEvent && (
        <div
          style={{
            position: "fixed",
            left: `${hoveredEvent.x}px`,
            top: `${hoveredEvent.y}px`,
            transform: "translate(-50%, -100%)",
            pointerEvents: "none",
            zIndex: 50,
          }}
          className="bg-slate-900/95 dark:bg-slate-800/95 text-white p-3.5 rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700/60 max-w-xs animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold mb-1 text-rose-400">
            {getEventTypeStyles(hoveredEvent.event.event_type, isEnrolledInEvent(hoveredEvent.event)).icon}
            <span>{getEventTypeStyles(hoveredEvent.event.event_type, isEnrolledInEvent(hoveredEvent.event)).label}</span>
            {hoveredEvent.event.event_time && (
              <span className="text-slate-300 font-mono text-[11px] ml-auto">
                🕒 {hoveredEvent.event.event_time}
              </span>
            )}
          </div>
          <h4 className="font-bold text-sm text-white mb-1.5">
            {hoveredEvent.event.title}
          </h4>
          <div className="my-1">
            <TargetRoleBadge targetRolesRaw={(hoveredEvent.event as any).targetRoles || (hoveredEvent.event as any).target_roles} size="sm" />
          </div>
          {hoveredEvent.event.description && (
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed line-clamp-4 mt-1">
              {hoveredEvent.event.description}
            </p>
          )}
        </div>
      )}

      {/* 4. DEDICATED EXAM DETAIL POPUP MODAL (Pre-Mock 3 Card) */}
      {selectedExamEvent && (
        <div 
          className="mobile-window fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedExamEvent(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-rose-500/30 overflow-hidden flex flex-col max-h-[88dvh] sm:max-h-[90vh] pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Gradient Header */}
            <div className="p-5 bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white flex items-start justify-between relative overflow-hidden shrink-0">
              <div className="absolute -right-6 -bottom-6 text-white/10 pointer-events-none select-none">
                <GraduationCap size={130} />
              </div>

              <div className="flex items-center gap-3.5 z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md text-white flex items-center justify-center text-2xl shadow-inner shrink-0 border border-white/20">
                  🎓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-md border border-white/20">
                      Pre-Mock 3 Sınavı
                    </span>
                    {isEnrolledInEvent(selectedExamEvent) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
                        <Star size={10} className="fill-slate-950" />
                        Dersinize Ait
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1 leading-tight tracking-tight">
                    {selectedExamEvent.title}
                  </h3>
                  <p className="text-xs text-rose-100/90 font-medium">
                    IB DP 2027 Resmi Deneme Sınav Takvimi
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedExamEvent(null)}
                className="z-10 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Exam Details Body */}
            <div 
              className="p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-4 bg-slate-50/60 dark:bg-slate-900/60 flex-1 min-h-0 text-xs sm:text-sm"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              
              {/* Date & Time Info Box */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <CalendarDays size={12} /> Sınav Tarihi
                  </span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                    {new Date(selectedExamEvent.event_date).toLocaleDateString("tr-TR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock size={12} /> Sınav Saati
                  </span>
                  <p className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs sm:text-sm">
                    {selectedExamEvent.event_time || "08:50"}
                  </p>
                </div>
              </div>

              {/* Roles / Subject Badges */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  İlgili Ders ve Seviyeler
                </span>
                <TargetRoleBadge targetRolesRaw={(selectedExamEvent as any).targetRoles || (selectedExamEvent as any).target_roles} size="md" />
              </div>

              {/* Description & Paper Guidelines */}
              {selectedExamEvent.description && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Sınav Yönergeleri & Detaylar
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedExamEvent.description}
                  </p>
                </div>
              )}

              {/* Sınav Nedeniyle İptal Edilen Normal Dersler */}
              {(() => {
                if (!selectedExamEvent.event_date || !isMockExamPeriod(selectedExamEvent.event_date)) return null;
                const dOfWeek = new Date(selectedExamEvent.event_date).getDay();
                const overlaid = buildDayScheduleWithOverlay(dOfWeek, selectedExamEvent.event_date, effectiveRoles, new Date());
                const matchingSlot = overlaid.find(
                  (o) =>
                    o.isExamSlot &&
                    o.overriddenByExam &&
                    (selectedExamEvent.title.toLowerCase().includes(o.overriddenByExam.subject.toLowerCase()) ||
                     o.overriddenByExam.title.toLowerCase().includes(selectedExamEvent.title.toLowerCase()))
                );
                const cancelled = matchingSlot?.cancelledClasses || [];
                if (cancelled.length === 0) return null;
                return (
                  <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2 w-full min-w-0 overflow-hidden">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                      ↳ Sınav Nedeniyle İptal Edilen Dersler
                    </span>
                    <div className="space-y-1.5 w-full min-w-0">
                      {cancelled.map((cc, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-amber-400/20 text-xs text-slate-700 dark:text-slate-300 w-full min-w-0 shadow-2xs">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            Bu saatteki normal <span className="underline text-amber-600 dark:text-amber-400 font-bold">{cc.name}</span> dersi yerine yapılmaktadır
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-700">
                            <span>Derslik: {cc.roomOrNote || "302"}</span>
                            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{cc.startTime} - {cc.endTime}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              {isEmirgan ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const ev = selectedExamEvent;
                      setSelectedExamEvent(null);
                      handleOpenEditForm(ev);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit3 size={14} /> Düzenle
                  </button>
                  <button
                    onClick={() => {
                      const id = selectedExamEvent.id;
                      setSelectedExamEvent(null);
                      handleDeleteEvent(id);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Sil
                  </button>
                </div>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedExamEvent(null)}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Dedicated Food Menu Modal / Bottom Drawer */}
      {selectedFoodEvent && (
        <div 
          className="mobile-window fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-xs transition-opacity duration-200"
          onClick={() => setSelectedFoodEvent(null)}
        >
          <div
            className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-emerald-500/20 max-h-[88dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>
            {/* Emerald Gradient Header */}
            <div className="p-5 bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white flex items-start justify-between relative overflow-hidden shrink-0">
              <div className="absolute -right-6 -bottom-6 text-white/10 pointer-events-none select-none">
                <Utensils size={120} />
              </div>

              <div className="flex items-center gap-3.5 z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md text-white flex items-center justify-center text-2xl shadow-inner shrink-0 border border-white/20">
                  🍽️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-md border border-white/20">
                      Öğle Yemeği Menüsü
                    </span>
                    {selectedFoodEvent.event_time && (
                      <span className="text-xs text-white/90 font-mono flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-md">
                        <Clock size={11} /> {selectedFoodEvent.event_time}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1 leading-tight tracking-tight">
                    {new Date(selectedFoodEvent.event_date).toLocaleDateString("tr-TR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </h3>
                  <p className="text-xs text-emerald-100/90 font-medium">
                    FMV Özel Işık Okulları (1-4. Sınıflar)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedFoodEvent(null)}
                className="z-10 p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
                title="Kapat (ESC)"
              >
                <X size={20} />
              </button>
            </div>

            {/* Menu Items List */}
            <div 
              className="p-5 overflow-y-auto overscroll-contain touch-pan-y space-y-3 bg-slate-50/60 dark:bg-slate-900/60 flex-1 min-h-0"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div className="flex items-center justify-between px-1 mb-1">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Günün Menü Kalemleri</span>
                </h4>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Dengeli Beslenme
                </span>
              </div>

              {(() => {
                const lines = (selectedFoodEvent.description || "")
                  .split("\n")
                  .map((l) => l.replace(/^[•\-\*]\s*/, "").trim())
                  .filter(Boolean);

                if (lines.length === 0) {
                  return (
                    <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-500">Bu gün için henüz menü detayı girilmemiş.</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {lines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs"
                      >
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-sm shrink-0">
                          {idx + 1}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                          {line}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              {isEmirgan ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const ev = selectedFoodEvent;
                      setSelectedFoodEvent(null);
                      handleOpenEditForm(ev);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit3 size={14} /> Düzenle
                  </button>
                  <button
                    onClick={() => {
                      const id = selectedFoodEvent.id;
                      setSelectedFoodEvent(null);
                      handleDeleteEvent(id);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={14} /> Sil
                  </button>
                </div>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedFoodEvent(null)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Day Events Drawer / Detail Modal */}
      {isDayDrawerOpen && selectedDayDate && (
        <div 
          onClick={() => setIsDayDrawerOpen(false)}
          className="mobile-window fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        >
          <div
            className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[88dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-200 relative pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CalendarIcon size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {new Date(selectedDayDate).toLocaleDateString("tr-TR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {selectedDayEvents.length} kayıtlı etkinlik, sınav & menü
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEmirgan && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAddForm(selectedDayDate);
                    }}
                    className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 transition-colors cursor-pointer"
                    title="Bu Güne Yeni Ekle"
                  >
                    <Plus size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsDayDrawerOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Events List Body */}
            <div 
              className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-5 space-y-3.5 min-h-0"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              {selectedDayDate && selectedDayDate >= "2026-11-16" && selectedDayDate <= "2026-11-20" && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-3 shadow-2xs">
                  <span className="text-2xl shrink-0">🌴</span>
                  <div>
                    <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">
                      1. Dönem Ara Tatili
                    </h4>
                    <p className="text-xs text-amber-700/90 dark:text-amber-400/90 mt-0.5 leading-relaxed">
                      16 - 20 Kasım 2026 tarihleri arasında okulumuz ara tatildedir. Bu tarihlerde ders ve yemek servisi yapılmamaktadır.
                    </p>
                  </div>
                </div>
              )}

              {selectedDayEvents.length === 0 ? (
                <div className="py-12 text-center">
                  <CalendarDays size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    Bu güne ait etkinlik veya sınav bulunamadı
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {isEmirgan ? "Yukarıdaki '+' butonuna tıklayarak yeni etkinlik ekleyebilirsiniz." : "Bu tarih için planlanan bir etkinlik bulunmuyor."}
                  </p>
                </div>
              ) : (
                selectedDayEvents.map((ev) => {
                  const isMyExam = ev.event_type === "exam" && isEnrolledInEvent(ev);
                  const st = getEventTypeStyles(ev.event_type, isMyExam);

                  const isMockPeriodDate = Boolean(selectedDayDate && isMockExamPeriod(selectedDayDate));
                  let cancelledClassesForExam: CancelledClassInfo[] = [];
                  if (ev.event_type === "exam" && isMockPeriodDate && selectedDayDate) {
                    const dOfWeek = new Date(selectedDayDate).getDay();
                    const overlaid = buildDayScheduleWithOverlay(dOfWeek, selectedDayDate, effectiveRoles, new Date());
                    const matchingSlot = overlaid.find(
                      (o) =>
                        o.isExamSlot &&
                        o.overriddenByExam &&
                        (ev.title.toLowerCase().includes(o.overriddenByExam.subject.toLowerCase()) ||
                         o.overriddenByExam.title.toLowerCase().includes(ev.title.toLowerCase()))
                    );
                    if (matchingSlot && matchingSlot.cancelledClasses) {
                      cancelledClassesForExam = matchingSlot.cancelledClasses;
                    }
                  }

                  return (
                    <div
                      key={ev.id}
                      onClick={() => {
                        if (ev.event_type === "exam") {
                          setSelectedExamEvent(ev);
                        } else if (ev.event_type === "food") {
                          setSelectedFoodEvent(ev);
                        }
                      }}
                      className={`rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden group cursor-pointer ${
                        isMyExam 
                          ? "border-amber-400 ring-2 ring-amber-400/60 shadow-[0_0_20px_rgba(251,191,36,0.35)] bg-gradient-to-r from-amber-500/15 to-amber-600/10 text-amber-100" 
                          : ev.event_type === "exam"
                          ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60"
                          : "border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800/80"
                      }`}
                    >
                      {/* Left color bar */}
                      <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isMyExam ? "bg-amber-400" : st.dot}`} />

                      <div className="flex items-start justify-between gap-2 mb-2 pl-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1 ${st.badge}`}>
                            {st.icon}
                            <span>{st.label}</span>
                          </span>
                          {isMyExam && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
                              ✍️ Gireceğin Sınav
                            </span>
                          )}
                          {ev.event_time && (
                            <span className="flex items-center gap-1 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md">
                              <Clock size={12} />
                              <span>{ev.event_time}</span>
                            </span>
                          )}
                          <TargetRoleBadge targetRolesRaw={(ev as any).targetRoles || (ev as any).target_roles} size="sm" />
                        </div>

                        {/* Admin Action Buttons */}
                        {isEmirgan && (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(ev)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                              title="Düzenle"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                              title="Sil"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </div>

                      <h4 className={`font-bold text-sm sm:text-base pl-1.5 mb-1.5 ${
                        isMyExam ? "text-amber-950 dark:text-white font-black" : "text-slate-900 dark:text-slate-100"
                      }`}>
                        {ev.title}
                      </h4>

                      {/* İkame Edilen Ders Gösterimi (Kompakt Taşmayan Çipler) */}
                      {cancelledClassesForExam.length > 0 && (
                        <div className="mt-2 mb-2 pt-2 border-t border-amber-400/25 flex flex-wrap items-center gap-1.5 w-full min-w-0 overflow-hidden pl-1.5">
                          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400/80"></span>
                            Yerine:
                          </span>
                          {cancelledClassesForExam.map((cc, cIdx) => (
                            <div 
                              key={cIdx} 
                              className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 opacity-75 line-through truncate min-w-0 shadow-2xs"
                              title={`${cc.name} (${cc.roomOrNote || "302"}) • ${cc.startTime} - ${cc.endTime}`}
                            >
                              <span className="truncate max-w-[150px] sm:max-w-[200px]">{cc.name}</span>
                              <span className="text-[10px] text-slate-400 no-underline shrink-0">({cc.roomOrNote || "302"})</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {ev.description && (
                        <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap pl-1.5 bg-slate-50/70 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                          {ev.description}
                          {ev.event_type === "exam" && (
                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-end">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedExamEvent(ev);
                                }}
                                className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
                              >
                                <span>🎓 Sınav Kartını İncele</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDayDrawerOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Admin Create / Edit Modal Form */}
      {isFormModalOpen && isEmirgan && (
        <div 
          onClick={() => setIsFormModalOpen(false)}
          className="mobile-window fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90dvh] pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <CalendarDays size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {editingEvent ? "Etkinliği Düzenle" : "Yeni Etkinlik / Sınav / Menü Ekle"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Sadece 'emirgan' yöneticisi tarafından düzenlenebilir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form 
              onSubmit={handleFormSubmit} 
              className="p-5 space-y-4 overflow-y-auto overscroll-contain touch-pan-y flex-1 min-h-0"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Etkinlik / Sınav Başlığı *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Sınav: Chemistry Paper 1 / Günün Öğle Yemeği Menüsü"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Tarih *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Saat / Aralık (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: 08:50 - 10:20"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Etkinlik Türü *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { type: "exam", label: "🎓 Sınav", color: "border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/40" },
                    { type: "food", label: "🍲 Yemek", color: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" },
                    { type: "study", label: "📚 Etüt", color: "border-indigo-500 text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" },
                    { type: "homework", label: "📝 Ödev", color: "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40" },
                    { type: "event", label: "🎯 Etkinlik", color: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setFormType(item.type as any)}
                      className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        formType === item.type
                          ? `${item.color} ring-2 ring-blue-500`
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Açıklama / Sınav Kuralları / Detaylar
                </label>
                <textarea
                  rows={4}
                  placeholder="Sınav süresi, soru sayısı, paper bilgisi veya menü kalemleri..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
                />
              </div>

              {/* Target Course Roles Selector */}
              <TargetRoleSelector
                selectedRoles={formTargetRoles}
                onChange={setFormTargetRoles}
                label="Kimler Görebilir? (Hedef Ders Rolleri)"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? "Kaydediliyor..." : editingEvent ? "Güncelle" : "Yayınla"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Course Schedule Modal */}
      <DailyScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        userRoles={effectiveRoles}
        currentUsername={currentUsername}
      />

    </div>
  );
}
