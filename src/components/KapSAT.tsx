import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Calculator,
  Timer,
  CheckCircle2,
  XCircle,
  Flag,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Layers,
  Award,
  BarChart3,
  Search,
  Eye,
  EyeOff,
  AlertCircle,
  HelpCircle,
  Check,
  X,
  Compass,
  Zap,
  Target,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  FileQuestion,
  GraduationCap
} from "lucide-react";
import MathRenderer from "./MathRenderer";
import { getApiUrl } from "../utils/api";

export interface KapSATProps {
  onClose?: () => void;
  initialMode?: "dashboard" | "mini_test" | "full_test" | "topic_practice";
  initialSection?: "math" | "reading_writing";
  initialTopic?: string;
}

interface QuestionItem {
  id: number;
  section: "math" | "reading_writing";
  domain: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  question_text: string;
  context_passage?: string | null;
  question_type: "multiple_choice" | "student_produced";
  options?: string[] | null;
  correct_answer?: string;
  explanation?: string;
  question_number?: number;
}

interface UserAnswerRecord {
  question_id: number;
  selected_answer: string;
  is_correct?: boolean;
  correct_answer?: string;
  explanation?: string;
  time_spent_seconds: number;
  flagged?: boolean;
  eliminated_options?: string[]; // Options crossed out by user
}

interface TopicBreakdown {
  section: string;
  domain: string;
  topic: string;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  accuracy: number;
}

interface SatStats {
  total_pool: number;
  pool_by_section: { math: number; reading_writing: number };
  total_answered: number;
  total_correct: number;
  accuracy: number;
  avg_time: number;
  today_answered: number;
  today_correct: number;
  topics_breakdown: TopicBreakdown[];
  recent_sessions: any[];
}

export default function KapSAT({
  onClose,
  initialMode = "dashboard",
  initialSection = "reading_writing",
  initialTopic
}: KapSATProps) {
  // Sayfaya girildiğinde robots meta etiketini noindex yap (Google indeks ve sitelinks engeli)
  useEffect(() => {
    let metaRobots = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    if (!metaRobots) {
      metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      document.head.appendChild(metaRobots);
    }
    const previousContent = metaRobots.content;
    metaRobots.content = 'noindex, nofollow';

    // Kullanıcı sayfadan çıktığında eski haline döndür
    return () => {
      metaRobots.content = previousContent || 'index, follow';
    };
  }, []);

  // App views: 'dashboard' | 'testing' | 'results'
  const [currentView, setCurrentView] = useState<"dashboard" | "testing" | "results">(
    initialMode === "dashboard" ? "dashboard" : "testing"
  );
  const [testMode, setTestMode] = useState<"topic_practice" | "mini_test" | "full_test">(
    initialMode === "dashboard" ? "mini_test" : initialMode
  );

  // Stats & Topic Catalog
  const [stats, setStats] = useState<SatStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [selectedSection, setSelectedSection] = useState<"reading_writing" | "math">(initialSection);
  const [selectedDomainFilter, setSelectedDomainFilter] = useState<string>("all");
  const [searchTopicQuery, setSearchTopicQuery] = useState("");

  // Testing Session State
  const [testTitle, setTestTitle] = useState("Digital SAT Sınavı");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, UserAnswerRecord>>({});
  const [loadingTest, setLoadingTest] = useState(false);
  const [allCompletedAlert, setAllCompletedAlert] = useState<{
    topic: string;
    total: number;
    answered: number;
  } | null>(null);

  // Timer State
  const [timeRemaining, setTimeRemaining] = useState<number>(2100); // in seconds
  const [timerVisible, setTimerVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const questionStartTimeRef = useRef<number>(Date.now());

  // In Practice Mode: Immediate checking
  const [checkedQuestions, setCheckedQuestions] = useState<Record<number, {
    is_correct: boolean;
    correct_answer: string;
    explanation: string;
  }>>({});
  const [checkingAnswer, setCheckingAnswer] = useState(false);

  // Review Drawer & Modals
  const [isReviewDrawerOpen, setIsReviewDrawerOpen] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // Results State
  const [resultData, setResultData] = useState<{
    total_questions: number;
    correct_count: number;
    incorrect_count: number;
    unanswered_count: number;
    accuracy_percent: number;
    scaled_score: number;
    time_spent_total: number;
    graded_answers: any[];
  } | null>(null);
  const [resultFilter, setResultFilter] = useState<"all" | "incorrect" | "flagged">("all");
  const [activeReviewQuestionId, setActiveReviewQuestionId] = useState<number | null>(null);

  // Fetch Stats on mount or view change
  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const res = await fetch(getApiUrl("/api/sat/stats"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("[kapSAT] fetchStats error:", e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // Handle Initial Launch with custom mode/topic
  useEffect(() => {
    if (initialMode === "mini_test") {
      startMiniTest();
    } else if (initialMode === "full_test") {
      startFullTest();
    } else if (initialMode === "topic_practice" && initialTopic) {
      startTopicPractice(initialSection, initialTopic);
    }
  }, []);

  // Timer Tick
  useEffect(() => {
    if (currentView === "testing" && (testMode === "mini_test" || testMode === "full_test")) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleFinishTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [currentView, testMode]);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // -------------------------------------------------------------------------
  // UNIVERSAL DEDUPLICATION SHIELD
  // -------------------------------------------------------------------------
  const deduplicateQuestions = (list: any[]): QuestionItem[] => {
    const seen = new Set<string>();
    return (list || []).filter((q) => {
      if (!q) return false;
      const key = q.id !== undefined && q.id !== null ? `id_${q.id}` : `text_${String(q.question_text || "").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // -------------------------------------------------------------------------
  // START MINI TEST (30 Questions, 35 Min)
  // -------------------------------------------------------------------------
  const startMiniTest = async () => {
    try {
      setLoadingTest(true);
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const res = await fetch(getApiUrl("/api/sat/mini-test"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const uniqueQ = deduplicateQuestions(data.questions || []);
        setTestTitle(data.title || "kapSAT Mini Deneme Sınavı");
        setSessionId(data.session_id);
        setQuestions(uniqueQ);
        setTestMode("mini_test");
        setTimeRemaining(data.time_limit_seconds || 2100);
        setCurrentIndex(0);
        setAnswers({});
        setCheckedQuestions({});
        setCurrentView("testing");
        startTimeRef.current = Date.now();
        questionStartTimeRef.current = Date.now();
      }
    } catch (e) {
      console.error("[kapSAT] startMiniTest error:", e);
    } finally {
      setLoadingTest(false);
    }
  };

  // -------------------------------------------------------------------------
  // START FULL TEST
  // -------------------------------------------------------------------------
  const startFullTest = async () => {
    try {
      setLoadingTest(true);
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const res = await fetch(getApiUrl("/api/sat/full-test"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        const uniqueQ = deduplicateQuestions(data.questions || []);
        setTestTitle(data.title || "kapSAT Komple Deneme Sınavı");
        setSessionId(data.session_id);
        setQuestions(uniqueQ);
        setTestMode("full_test");
        setTimeRemaining(data.time_limit_seconds || 4000);
        setCurrentIndex(0);
        setAnswers({});
        setCheckedQuestions({});
        setCurrentView("testing");
        startTimeRef.current = Date.now();
        questionStartTimeRef.current = Date.now();
      }
    } catch (e) {
      console.error("[kapSAT] startFullTest error:", e);
    } finally {
      setLoadingTest(false);
    }
  };

  // -------------------------------------------------------------------------
  // START TOPIC PRACTICE
  // -------------------------------------------------------------------------
  const startTopicPractice = async (
    section: "math" | "reading_writing",
    topic: string,
    retryIncorrect = false
  ) => {
    try {
      setLoadingTest(true);
      setAllCompletedAlert(null);
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const params = new URLSearchParams({
        section,
        topic,
        limit: "15",
        retry_incorrect: retryIncorrect ? "true" : "false"
      });

      const res = await fetch(getApiUrl(`/api/sat/practice?${params.toString()}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (res.ok) {
        const data = await res.json();
        const uniqueQ = deduplicateQuestions(data.questions || []);

        if (data.all_completed && uniqueQ.length === 0) {
          setAllCompletedAlert({
            topic,
            total: data.total_in_category || 0,
            answered: data.answered_in_category || 0
          });
          return;
        }

        if (uniqueQ.length > 0) {
          setTestTitle(`${topic} — Konu Alıştırması`);
          setSessionId(null);
          setQuestions(uniqueQ);
          setTestMode("topic_practice");
          setCurrentIndex(0);
          setAnswers({});
          setCheckedQuestions({});
          setCurrentView("testing");
          startTimeRef.current = Date.now();
          questionStartTimeRef.current = Date.now();
        } else {
          alert("Bu konuda çözülmemiş soru kalmadı veya henüz soru bulunmuyor.");
        }
      }
    } catch (e) {
      console.error("[kapSAT] startTopicPractice error:", e);
    } finally {
      setLoadingTest(false);
    }
  };

  // Reset progress for topic
  const handleResetTopic = async (topic: string, onlyIncorrect = false) => {
    try {
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const res = await fetch(getApiUrl("/api/sat/reset-answers"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ topic, only_incorrect: onlyIncorrect })
      });
      if (res.ok) {
        setAllCompletedAlert(null);
        await fetchStats();
        startTopicPractice(selectedSection, topic, false);
      }
    } catch (e) {
      console.error("[kapSAT] handleResetTopic error:", e);
    }
  };

  // Record Answer for current question
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  const handleSelectAnswer = (ans: string) => {
    if (!currentQuestion) return;
    const now = Date.now();
    const spentDelta = Math.round((now - questionStartTimeRef.current) / 1000);

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        question_id: currentQuestion.id,
        selected_answer: ans,
        time_spent_seconds: (prev[currentQuestion.id]?.time_spent_seconds || 0) + spentDelta,
        flagged: prev[currentQuestion.id]?.flagged || false,
        eliminated_options: prev[currentQuestion.id]?.eliminated_options || []
      }
    }));
  };

  // Toggle Option Elimination (Strikethrough - Bluebook feature)
  const handleToggleEliminateOption = (opt: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentQuestion) return;
    const currentOptLetter = opt.replace(/[\)\.\s].*$/, "").toUpperCase();

    setAnswers((prev) => {
      const existing = prev[currentQuestion.id] || {
        question_id: currentQuestion.id,
        selected_answer: "",
        time_spent_seconds: 0,
        flagged: false,
        eliminated_options: []
      };
      const isEliminated = existing.eliminated_options?.includes(currentOptLetter);
      const updatedList = isEliminated
        ? existing.eliminated_options?.filter((o) => o !== currentOptLetter)
        : [...(existing.eliminated_options || []), currentOptLetter];

      return {
        ...prev,
        [currentQuestion.id]: {
          ...existing,
          eliminated_options: updatedList
        }
      };
    });
  };

  // Toggle Flag (Mark for Review)
  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    setAnswers((prev) => {
      const existing = prev[currentQuestion.id] || {
        question_id: currentQuestion.id,
        selected_answer: "",
        time_spent_seconds: 0,
        flagged: false,
        eliminated_options: []
      };
      return {
        ...prev,
        [currentQuestion.id]: {
          ...existing,
          flagged: !existing.flagged
        }
      };
    });
  };

  // Check Answer instantly in Topic Practice mode
  const handleCheckAnswerPractice = async () => {
    if (!currentQuestion || !currentAnswer?.selected_answer || checkingAnswer) return;
    try {
      setCheckingAnswer(true);
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const res = await fetch(getApiUrl("/api/sat/submit-answer"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          selected_answer: currentAnswer.selected_answer,
          time_spent_seconds: currentAnswer.time_spent_seconds || 15,
          mode: "topic_practice"
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCheckedQuestions((prev) => ({
          ...prev,
          [currentQuestion.id]: {
            is_correct: data.is_correct,
            correct_answer: data.correct_answer,
            explanation: data.explanation
          }
        }));
      }
    } catch (e) {
      console.error("[kapSAT] handleCheckAnswerPractice error:", e);
    } finally {
      setCheckingAnswer(false);
    }
  };

  // Navigate between questions
  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      questionStartTimeRef.current = Date.now();
      setCurrentIndex(index);
      setIsReviewDrawerOpen(false);
    }
  };

  // Finish and Submit Test
  const handleFinishTest = async () => {
    setShowSubmitConfirmModal(false);
    try {
      setLoadingTest(true);
      const token = localStorage.getItem("lan_token") || localStorage.getItem("token");
      const timeSpentTotal = Math.round((Date.now() - startTimeRef.current) / 1000);

      const payloadAnswers = questions.map((q) => {
        const ans = answers[q.id];
        return {
          question_id: q.id,
          selected_answer: ans?.selected_answer || "",
          time_spent_seconds: ans?.time_spent_seconds || 0
        };
      });

      const res = await fetch(getApiUrl("/api/sat/submit-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          session_id: sessionId,
          test_type: testMode === "topic_practice" ? "topic" : testMode === "mini_test" ? "mini" : "full",
          answers: payloadAnswers,
          time_spent_total: timeSpentTotal
        })
      });

      if (res.ok) {
        const data = await res.json();
        setResultData(data);
        setCurrentView("results");
        fetchStats(); // refresh background stats
      }
    } catch (e) {
      console.error("[kapSAT] handleFinishTest error:", e);
    } finally {
      setLoadingTest(false);
    }
  };

  // Group topics by domain for topic practice catalog
  const filteredTopics = (stats?.topics_breakdown || []).filter((item) => {
    if (item.section !== selectedSection) return false;
    if (selectedDomainFilter !== "all" && item.domain !== selectedDomainFilter) return false;
    if (searchTopicQuery.trim()) {
      const q = searchTopicQuery.toLowerCase();
      return (
        item.topic.toLowerCase().includes(q) ||
        item.domain.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const availableDomains = Array.from(
    new Set(
      (stats?.topics_breakdown || [])
        .filter((t) => t.section === selectedSection)
        .map((t) => t.domain)
    )
  );

  const handleRequestExit = () => {
    if (currentView === "testing" && (testMode === "mini_test" || testMode === "full_test")) {
      setShowExitConfirmModal(true);
    } else if (currentView === "testing" && testMode === "topic_practice") {
      setCurrentView("dashboard");
    } else if (onClose) {
      onClose();
    }
  };

  return (
    <div className="flex-1 min-h-0 h-full w-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden select-none transition-colors duration-200">
      {/* =================================================================== */}
      {/* 1. TOP MAIN HEADER */}
      {/* =================================================================== */}
      <header className="px-3 sm:px-4 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Back to Courses Button */}
          {onClose && (
            <button
              type="button"
              onClick={handleRequestExit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 font-bold text-xs transition-all cursor-pointer shadow-2xs shrink-0"
              title="Dersler Ana Sayfasına Geri Dön"
            >
              <ArrowLeft size={15} className="shrink-0 text-indigo-500" />
              <span className="font-extrabold">Dersler</span>
            </button>
          )}

          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <GraduationCap size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-base tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                kapSAT
              </span>
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Digital SAT
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
              {currentView === "dashboard"
                ? "Sınav ve Konu Hazırlık Merkezi"
                : testTitle}
            </p>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-2">
          {currentView === "testing" && (testMode === "mini_test" || testMode === "full_test") && (
            <div className="flex items-center gap-2">
              {/* Timer Toggle */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-black border transition-all ${
                  timeRemaining < 300
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 animate-pulse"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                }`}
              >
                <Timer size={14} className={timeRemaining < 300 ? "text-rose-500" : "text-indigo-500"} />
                <span>{timerVisible ? formatTime(timeRemaining) : "Gizli"}</span>
                <button
                  type="button"
                  onClick={() => setTimerVisible(!timerVisible)}
                  className="ml-1 opacity-70 hover:opacity-100 cursor-pointer"
                  title={timerVisible ? "Sayacı Gizle" : "Sayacı Göster"}
                >
                  {timerVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              {/* Question Navigator Grid Button */}
              <button
                type="button"
                onClick={() => setIsReviewDrawerOpen(!isReviewDrawerOpen)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Layers size={14} className="text-indigo-500" />
                <span className="hidden sm:inline">Soru Gezgini</span>
              </button>

              {/* Submit Test Button */}
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
              >
                Sınavı Bitir
              </button>
            </div>
          )}

          {currentView === "testing" && testMode === "topic_practice" && (
            <button
              type="button"
              onClick={() => setCurrentView("dashboard")}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            >
              Alıştırmadan Çık
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Kapat"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. DASHBOARD VIEW */}
      {/* =================================================================== */}
      {currentView === "dashboard" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 touch-pan-y overscroll-y-contain">
          <div className="max-w-5xl mx-auto space-y-6 pb-20">
            
            {/* HERO BANNER & STATS */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 p-6 sm:p-8 text-white shadow-xl">
              <div className="absolute top-0 right-0 -mr-12 -mt-12 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 right-24 w-48 h-48 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-bold text-indigo-200 border border-white/15 mb-3">
                    <Sparkles size={13} className="text-amber-400" />
                    <span>2026-2027 College Board Formatı</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
                    Digital SAT Çalışma ve Sınav Motoru
                  </h1>
                  <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
                    Soru tekrarını önleyen akıllı havuz, 35 dakikalık mini denemeler ve resmi Bluebook sınav arayüzü ile SAT skorunu zirveye taşı.
                  </p>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full md:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={startMiniTest}
                    disabled={loadingTest}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-black text-sm shadow-lg shadow-indigo-500/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Zap size={16} className="text-amber-300" />
                    <span>Mini Deneme (30 Soru)</span>
                  </button>
                  <button
                    type="button"
                    onClick={startFullTest}
                    disabled={loadingTest}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <span>Komple Deneme</span>
                  </button>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
                <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Bugün Çözülen
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-white">
                      {stats?.today_answered ?? 0}
                    </span>
                    <span className="text-xs text-slate-400">/ 20 hedef</span>
                  </div>
                  {/* Daily Goal Progress Bar */}
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-2">
                    <div
                      className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (((stats?.today_answered ?? 0) / 20) * 100))}%`
                      }}
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Toplam Çözülen
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-white">
                      {stats?.total_answered ?? 0}
                    </span>
                    <span className="text-xs text-slate-400">
                      / {stats?.total_pool ?? 0} soru
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold mt-1 block">
                    Soru Tekrarı Engelli 🛡️
                  </span>
                </div>

                <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Doğruluk Oranı
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-emerald-400">
                      %{stats?.accuracy ?? 0}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                    {stats?.total_correct ?? 0} doğru cevap
                  </span>
                </div>

                <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Tahmini SAT Skoru
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-amber-400">
                      {stats && stats.total_answered > 0
                        ? Math.round(400 + (stats.accuracy / 100) * 1200)
                        : "—"}
                    </span>
                    <span className="text-xs text-slate-400">/ 1600</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">
                    Performans projeksiyonu
                  </span>
                </div>
              </div>
            </div>

            {/* ALERT: Topic All Completed Dialog */}
            {allCompletedAlert && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Award size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                      Tebrikler! "{allCompletedAlert.topic}" konusundaki tüm soruları çözdünüz 🎉
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Havuzda çözülmemiş yeni soru kalmadı ({allCompletedAlert.answered}/{allCompletedAlert.total} Soru). İsterseniz yanlışlarınızı tekrar çözebilir veya konuyu sıfırlayabilirsiniz.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startTopicPractice(selectedSection, allCompletedAlert.topic, true)}
                    className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-colors cursor-pointer"
                  >
                    Yanlışları Tekrar Çöz
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetTopic(allCompletedAlert.topic, false)}
                    className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Konuyu Sıfırla
                  </button>
                </div>
              </div>
            )}

            {/* SECTION SELECTOR (Math vs Reading & Writing) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Target size={18} className="text-indigo-500" />
                    <span>Konu Konu Çalış & Eksiklerini Kapat</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Çözdüğün sorular sistem tarafından kaydedilir ve bir daha karşına çıkmaz.
                  </p>
                </div>

                {/* Section Toggle Pill */}
                <div className="flex items-center p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-2xl border border-slate-300/50 dark:border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSection("reading_writing");
                      setSelectedDomainFilter("all");
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      selectedSection === "reading_writing"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    <BookOpen size={15} />
                    <span>Reading & Writing ({stats?.pool_by_section.reading_writing ?? 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSection("math");
                      setSelectedDomainFilter("all");
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      selectedSection === "math"
                        ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    <Calculator size={15} />
                    <span>Math ({stats?.pool_by_section.math ?? 0})</span>
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTopicQuery}
                    onChange={(e) => setSearchTopicQuery(e.target.value)}
                    placeholder="Konu veya alt alan ara (Örn: Transitions, Quadratic, Circles)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Domain chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDomainFilter("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                      selectedDomainFilter === "all"
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    Tüm Alanlar
                  </button>
                  {availableDomains.map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => setSelectedDomainFilter(dom)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors ${
                        selectedDomainFilter === dom
                          ? "bg-indigo-600 text-white"
                          : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {dom}
                    </button>
                  ))}
                </div>
              </div>

              {/* TOPICS GRID & SKELETON LOADER */}
              {loadingStats && !stats ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {[1, 2, 3, 4, 5, 6].map((sk) => (
                    <div
                      key={`skeleton-${sk}`}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3 animate-pulse"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                          <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
                        </div>
                        <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md" />
                        <div className="space-y-1 mt-2">
                          <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full" />
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
                        </div>
                      </div>
                      <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded-xl" />
                    </div>
                  ))}
                </div>
              ) : filteredTopics.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                    <Search size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Aramanıza uygun konu bulunamadı
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    "{searchTopicQuery}" için sonuç yok. Başka bir anahtar kelime deneyebilir veya filtreyi temizleyebilirsiniz.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTopicQuery("");
                      setSelectedDomainFilter("all");
                    }}
                    className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-100 transition-colors cursor-pointer"
                  >
                    Filtreleri Temizle
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredTopics.map((topicItem) => {
                    const isDone = topicItem.answered_count >= topicItem.total_questions && topicItem.total_questions > 0;
                    const progressPct = topicItem.total_questions > 0
                      ? Math.round((topicItem.answered_count / topicItem.total_questions) * 100)
                      : 0;

                    return (
                      <div
                        key={topicItem.topic}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs hover:border-indigo-400 dark:hover:border-indigo-600 transition-all flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {topicItem.domain}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                isDone
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              {topicItem.answered_count} / {topicItem.total_questions} Çözüldü
                            </span>
                          </div>

                          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 line-clamp-1">
                            {topicItem.topic}
                          </h4>

                          {/* Progress and Accuracy */}
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>İlerleme (%{progressPct})</span>
                              <span className="font-bold text-slate-700 dark:text-slate-300">
                                {topicItem.answered_count > 0 ? `Doğruluk: %${topicItem.accuracy}` : "Henüz başlanmadı"}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isDone ? "bg-emerald-500" : "bg-indigo-600"
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {isDone ? (
                            <>
                              <button
                                type="button"
                                onClick={() => startTopicPractice(selectedSection, topicItem.topic, true)}
                                className="flex-1 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 font-bold text-xs transition-colors cursor-pointer text-center"
                              >
                                Yanlışları Tekrarla
                              </button>
                              <button
                                type="button"
                                onClick={() => handleResetTopic(topicItem.topic, false)}
                                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
                                title="Konuyu Sıfırla"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startTopicPractice(selectedSection, topicItem.topic, false)}
                              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <span>Çalışmaya Başla</span>
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. TESTING / EXAM BLUEBOOK-STYLE VIEW */}
      {/* =================================================================== */}
      {currentView === "testing" && currentQuestion && (
        <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
          {/* Soru Gezgini Drawer Modal */}
          {isReviewDrawerOpen && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-in fade-in">
              <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                      Soru Gezgini ({questions.length} Soru)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      İstediğin soruya zıplayabilir veya işaretlediklerini inceleyebilirsin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReviewDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-indigo-600" />
                    <span>Cevaplandı</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-slate-200 dark:bg-slate-700" />
                    <span>Boş</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-amber-500" />
                    <span>İşaretlendi</span>
                  </div>
                </div>

                {/* Question Grid */}
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 max-h-60 overflow-y-auto p-1">
                  {questions.map((q, idx) => {
                    const ans = answers[q.id];
                    const isAnswered = !!ans?.selected_answer;
                    const isFlagged = !!ans?.flagged;
                    const isCurrent = idx === currentIndex;

                    let bg = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
                    if (isAnswered) bg = "bg-indigo-600 text-white";
                    if (isFlagged) bg = "bg-amber-500 text-slate-950 font-black";

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToQuestion(idx)}
                        className={`h-10 rounded-xl font-mono text-xs font-black relative flex items-center justify-center transition-all cursor-pointer ${bg} ${
                          isCurrent ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900" : ""
                        }`}
                      >
                        <span>{idx + 1}</span>
                        {isFlagged && (
                          <Flag size={9} className="absolute top-1 right-1 text-slate-950 fill-slate-950" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsReviewDrawerOpen(false)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sınavı Bitir Onay Modalı */}
          {showSubmitConfirmModal && (
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-in fade-in">
              <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                    <AlertCircle size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                      Sınavı Bitirmek İstiyor musun?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Cevapların kaydedilecek ve detaylı karne oluşturulacaktır.
                    </p>
                  </div>
                </div>

                {/* Summary counts */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cevaplanan Soru:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {Object.values(answers).filter((a) => !!a.selected_answer).length} / {questions.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Boş Kalan:</span>
                    <span className="font-bold text-rose-500">
                      {questions.length - Object.values(answers).filter((a) => !!a.selected_answer).length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">İşaretlenen (Review):</span>
                    <span className="font-bold text-amber-500">
                      {Object.values(answers).filter((a) => a.flagged).length}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirmModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    Sorulara Dön
                  </button>
                  <button
                    type="button"
                    onClick={handleFinishTest}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black text-xs shadow-md cursor-pointer"
                  >
                    Evet, Bitir
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Subheader Toolbar: Question X of Y + Mark for Review */}
          <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-slate-500">
                Soru {currentIndex + 1} / {questions.length}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {currentQuestion.domain} — {currentQuestion.topic}
              </span>
            </div>

            {/* Mark for Review Button */}
            <button
              type="button"
              onClick={handleToggleFlag}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                currentAnswer?.flagged
                  ? "bg-amber-500 text-slate-950 font-black shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
              }`}
            >
              <Flag size={13} className={currentAnswer?.flagged ? "fill-slate-950" : ""} />
              <span>{currentAnswer?.flagged ? "İşaretlendi" : "Gözden Geçir (Flag)"}</span>
            </button>
          </div>

          {/* SPLIT 2-COLUMN QUESTION AREA (Digital SAT Bluebook style) */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            
            {/* LEFT COLUMN: Passage or Context */}
            <div className="flex-1 md:w-1/2 p-5 sm:p-6 overflow-y-auto border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
              {currentQuestion.context_passage ? (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileQuestion size={13} className="text-indigo-500" />
                    <span>Okuma Pasajı / Metin</span>
                  </div>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed sm:text-base font-serif antialiased">
                    <MathRenderer content={currentQuestion.context_passage} />
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col justify-center items-center text-center p-6 text-slate-400">
                  <Calculator size={36} className="text-indigo-400 mb-3 opacity-60" />
                  <h4 className="font-bold text-slate-600 dark:text-slate-300 text-sm">
                    {currentQuestion.domain}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Bu sorunun ek pasajı bulunmamaktadır. Problemi sağ taraftaki alandan çözebilirsiniz.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Question Prompt & Options */}
            <div className="flex-1 md:w-1/2 p-5 sm:p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/60 flex flex-col justify-between">
              <div className="space-y-5">
                {/* Question Prompt */}
                <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
                  <MathRenderer content={currentQuestion.question_text} />
                </div>

                {/* MULTIPLE CHOICE OPTIONS */}
                {currentQuestion.question_type === "multiple_choice" && currentQuestion.options && (
                  <div className="space-y-2.5">
                    {currentQuestion.options.map((optionStr) => {
                      const optLetter = optionStr.replace(/[\)\.\s].*$/, "").toUpperCase();
                      const isSelected = currentAnswer?.selected_answer?.toUpperCase().startsWith(optLetter);
                      const isEliminated = currentAnswer?.eliminated_options?.includes(optLetter);

                      return (
                        <div
                          key={optionStr}
                          onClick={() => {
                            if (!isEliminated) handleSelectAnswer(optLetter);
                          }}
                          className={`group relative p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            isEliminated
                              ? "opacity-35 line-through bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                              : isSelected
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/25 scale-[1.01]"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-xl font-mono text-xs font-black flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-white text-indigo-700"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {optLetter}
                            </div>
                            <div className="text-xs sm:text-sm flex-1 leading-snug">
                              <MathRenderer content={optionStr.replace(/^[A-D]\)\s*/, "")} />
                            </div>
                          </div>

                          {/* Strikethrough / Eliminator button (Bluebook Style) */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleEliminateOption(optionStr, e)}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              isEliminated
                                ? "bg-rose-500 text-white"
                                : isSelected
                                ? "bg-white/20 text-white hover:bg-white/30"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                            title={isEliminated ? "Şıkkı Geri Al" : "Şıkkı Ele (Strikethrough)"}
                          >
                            <span className="line-through">ABC</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* STUDENT-PRODUCED RESPONSE (GRID-IN / NUMERIC) */}
                {currentQuestion.question_type === "student_produced" && (
                  <div className="space-y-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Açık Uçlu Sayısal Cevap (Grid-in)
                    </span>
                    <p className="text-xs text-slate-500">
                      Cevabınızı tam sayı, ondalık (örn: 3.5) veya kesir (örn: 7/2) olarak girin.
                    </p>
                    <input
                      type="text"
                      value={currentAnswer?.selected_answer || ""}
                      onChange={(e) => handleSelectAnswer(e.target.value)}
                      placeholder="Cevabınızı yazın (Örn: 14/3 veya 28)..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}

                {/* IMMEDIATE PRACTICE FEEDBACK & EXPLANATION */}
                {testMode === "topic_practice" && (
                  <div className="pt-2">
                    {!checkedQuestions[currentQuestion.id] ? (
                      <button
                        type="button"
                        onClick={handleCheckAnswerPractice}
                        disabled={!currentAnswer?.selected_answer || checkingAnswer}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white font-black text-xs shadow-md transition-all cursor-pointer disabled:opacity-40"
                      >
                        {checkingAnswer ? "Kontrol Ediliyor..." : "Cevabı Kontrol Et & Açıklamayı Gör"}
                      </button>
                    ) : (
                      <div
                        className={`p-4 rounded-2xl border transition-all ${
                          checkedQuestions[currentQuestion.id].is_correct
                            ? "bg-emerald-500/10 border-emerald-500/30"
                            : "bg-rose-500/10 border-rose-500/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2 font-black text-sm">
                          {checkedQuestions[currentQuestion.id].is_correct ? (
                            <>
                              <CheckCircle2 size={18} className="text-emerald-500" />
                              <span className="text-emerald-700 dark:text-emerald-400">Doğru Cevap! 🎉</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={18} className="text-rose-500" />
                              <span className="text-rose-700 dark:text-rose-400">
                                Yanlış! Doğru Cevap: {checkedQuestions[currentQuestion.id].correct_answer}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                          <span className="font-bold text-slate-800 dark:text-slate-100 block mb-1">
                            Detaylı Çözüm Açıklaması:
                          </span>
                          <MathRenderer content={checkedQuestions[currentQuestion.id].explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* BOTTOM NAVIGATION CONTROLS */}
              <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ArrowLeft size={14} />
                  <span>Önceki Soru</span>
                </button>

                {/* Quick navigator bubble strip */}
                <div className="hidden sm:flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[200px]">
                  {questions.map((q, idx) => {
                    const isAnswered = !!answers[q.id]?.selected_answer;
                    const isCurrent = idx === currentIndex;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => goToQuestion(idx)}
                        className={`w-6 h-6 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                          isCurrent
                            ? "bg-indigo-600 text-white ring-2 ring-indigo-400"
                            : isAnswered
                            ? "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => goToQuestion(currentIndex + 1)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                  >
                    <span>Sonraki Soru</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubmitConfirmModal(true)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                  >
                    <span>Sınavı Tamamla</span>
                    <CheckCircle2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. RESULTS & DETAILED REVIEW VIEW */}
      {/* =================================================================== */}
      {currentView === "results" && resultData && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 touch-pan-y overscroll-y-contain">
          <div className="max-w-4xl mx-auto space-y-6 pb-20">
            
            {/* SCORE CARD HERO */}
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white border border-indigo-500/20 shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black mb-3">
                    <CheckCircle2 size={13} />
                    <span>Sınav Başarıyla Tamamlandı</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Dijital SAT Sınav Raporu
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-md">
                    College Board ölçeklendirmesine göre hesaplanan tahmini skor ve soru bazlı detaylı çözümler.
                  </p>
                </div>

                {/* Big Score Box */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 text-center min-w-[180px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200 block">
                    Tahmini SAT Skoru
                  </span>
                  <div className="text-4xl sm:text-5xl font-black text-white my-1 tracking-tight">
                    {resultData.scaled_score}
                  </div>
                  <span className="text-xs text-indigo-300 font-mono font-bold">
                    1600 üzerinden
                  </span>
                </div>
              </div>

              {/* Performance Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-center">
                  <span className="text-[11px] text-slate-400 font-bold uppercase block">Doğru</span>
                  <span className="text-2xl font-black text-emerald-400 mt-1 block">
                    {resultData.correct_count}
                  </span>
                </div>
                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-center">
                  <span className="text-[11px] text-slate-400 font-bold uppercase block">Yanlış</span>
                  <span className="text-2xl font-black text-rose-400 mt-1 block">
                    {resultData.incorrect_count}
                  </span>
                </div>
                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-center">
                  <span className="text-[11px] text-slate-400 font-bold uppercase block">Boş</span>
                  <span className="text-2xl font-black text-slate-300 mt-1 block">
                    {resultData.unanswered_count}
                  </span>
                </div>
                <div className="bg-white/5 rounded-2xl p-3 border border-white/5 text-center">
                  <span className="text-[11px] text-slate-400 font-bold uppercase block">Doğruluk</span>
                  <span className="text-2xl font-black text-indigo-300 mt-1 block">
                    %{resultData.accuracy_percent}
                  </span>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setResultFilter("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                    resultFilter === "all"
                      ? "bg-indigo-600 text-white"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Tüm Sorular ({resultData.graded_answers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter("incorrect")}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-colors cursor-pointer ${
                    resultFilter === "incorrect"
                      ? "bg-rose-600 text-white"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  Yanlış ve Boşlar ({resultData.incorrect_count + resultData.unanswered_count})
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentView("dashboard")}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  Ana Ekrana Dön
                </button>
                <button
                  type="button"
                  onClick={startMiniTest}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-colors cursor-pointer"
                >
                  Yeni Mini Deneme Başlat
                </button>
              </div>
            </div>

            {/* DETAILED QUESTION REVIEW LIST */}
            <div className="space-y-4">
              {resultData.graded_answers
                .filter((item) => {
                  if (resultFilter === "incorrect") return !item.is_correct;
                  return true;
                })
                .map((ansItem, index) => {
                  const originalQ = questions.find((q) => q.id === ansItem.question_id);
                  const isExpanded = activeReviewQuestionId === ansItem.question_id;

                  return (
                    <div
                      key={ansItem.question_id}
                      className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 sm:p-5 shadow-xs transition-all ${
                        ansItem.is_correct
                          ? "border-emerald-500/30 dark:border-emerald-500/20"
                          : "border-rose-500/30 dark:border-rose-500/20"
                      }`}
                    >
                      <div
                        onClick={() =>
                          setActiveReviewQuestionId(isExpanded ? null : ansItem.question_id)
                        }
                        className="flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl font-mono text-xs font-black flex items-center justify-center shrink-0 ${
                              ansItem.is_correct
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                            }`}
                          >
                            {ansItem.is_correct ? <Check size={16} /> : <X size={16} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-500">
                                Soru #{index + 1}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                {ansItem.section === "math" ? "Math" : "Reading & Writing"} — {ansItem.topic}
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 mt-1 line-clamp-1">
                              {originalQ?.question_text || "Soru"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right text-xs">
                            <span className="text-slate-400 block text-[10px]">Cevabınız:</span>
                            <span
                              className={`font-mono font-black ${
                                ansItem.is_correct ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {ansItem.selected_answer || "Boş"}
                            </span>
                          </div>
                          <ChevronRight
                            size={16}
                            className={`text-slate-400 transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expanded Solution View */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in">
                          {originalQ?.context_passage && (
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs font-serif leading-relaxed text-slate-700 dark:text-slate-300">
                              <span className="font-bold font-sans text-[10px] uppercase text-slate-400 block mb-1">
                                Pasaj Metni:
                              </span>
                              <MathRenderer content={originalQ.context_passage} />
                            </div>
                          )}

                          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                            <MathRenderer content={originalQ?.question_text || ""} />
                          </div>

                          <div className="flex flex-wrap gap-4 text-xs">
                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 flex-1 min-w-[120px]">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">
                                Sizin Cevabınız
                              </span>
                              <span className="font-mono font-black text-slate-800 dark:text-slate-200 mt-0.5 block">
                                {ansItem.selected_answer || "Boş Bırakıldı"}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-1 min-w-[120px]">
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase block">
                                Doğru Cevap
                              </span>
                              <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                                {ansItem.correct_answer}
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                            <span className="font-bold text-indigo-700 dark:text-indigo-400 block mb-1">
                              Detaylı Çözüm Açıklaması:
                            </span>
                            <MathRenderer content={ansItem.explanation} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* EXIT TEST CONFIRMATION MODAL */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Sınavdan Çıkmak İstiyor musunuz?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Devam eden bir testiniz var, çıkmak istediğinize emin misiniz? İlerlemeniz kaydedilmeyebilir.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowExitConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                İptal (Teste Devam Et)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirmModal(false);
                  if (onClose) {
                    onClose();
                  } else {
                    setCurrentView("dashboard");
                  }
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
