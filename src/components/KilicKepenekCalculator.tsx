import React, { useState, useEffect } from "react";
import { 
  Calculator, 
  BookOpen, 
  GraduationCap, 
  Settings2, 
  Plus, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  HelpCircle, 
  Percent, 
  Award, 
  Bookmark, 
  TrendingUp, 
  Sliders,
  Sparkles,
  Info,
  ArrowLeft,
  ArrowRight
} from "lucide-react";

export interface Assessment {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: number; // For weighted mode
}

export interface SubjectBoundary {
  grade: number; // 7 down to 1
  minPercentage: number;
  maxPercentage: number;
}

export interface Subject {
  id: string;
  name: string;
  category: string;
  level: "SL" | "HL";
  assessments: Assessment[];
  boundaries: SubjectBoundary[];
  calculationMode: "simple_sum" | "weighted";
}

// Default initial database content
const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: "sub-dig-soc",
    name: "Digital Society",
    category: "Individuals & Societies",
    level: "HL",
    calculationMode: "simple_sum",
    assessments: [
      { id: "ds-p1", name: "Paper 1", score: 68, maxScore: 80, weight: 50 },
      { id: "ds-p2", name: "Paper 2", score: 38, maxScore: 50, weight: 50 },
    ],
    boundaries: [
      { grade: 7, minPercentage: 72, maxPercentage: 100 },
      { grade: 6, minPercentage: 62, maxPercentage: 71 },
      { grade: 5, minPercentage: 51, maxPercentage: 61 },
      { grade: 4, minPercentage: 41, maxPercentage: 50 },
      { grade: 3, minPercentage: 27, maxPercentage: 40 },
      { grade: 2, minPercentage: 13, maxPercentage: 26 },
      { grade: 1, minPercentage: 0, maxPercentage: 12 },
    ]
  },
  {
    id: "sub-turk-a",
    name: "Turkish A",
    category: "Studies in Language & Literature",
    level: "SL",
    calculationMode: "simple_sum",
    assessments: [
      { id: "ta-p1", name: "Paper 1", score: 32, maxScore: 40, weight: 100 },
    ],
    boundaries: [
      { grade: 7, minPercentage: 76, maxPercentage: 100 },
      { grade: 6, minPercentage: 65, maxPercentage: 75 },
      { grade: 5, minPercentage: 53, maxPercentage: 64 },
      { grade: 4, minPercentage: 42, maxPercentage: 52 },
      { grade: 3, minPercentage: 27, maxPercentage: 41 },
      { grade: 2, minPercentage: 14, maxPercentage: 26 },
      { grade: 1, minPercentage: 0, maxPercentage: 13 },
    ]
  },
  {
    id: "sub-math-aa",
    name: "Mathematics AA",
    category: "Mathematics",
    level: "HL",
    calculationMode: "simple_sum",
    assessments: [
      { id: "ma-p1", name: "Paper 1", score: 85, maxScore: 110, weight: 35 },
      { id: "ma-p2", name: "Paper 2", score: 78, maxScore: 110, weight: 35 },
      { id: "ma-p3", name: "Paper 3", score: 40, maxScore: 55, weight: 30 },
    ],
    boundaries: [
      { grade: 7, minPercentage: 79, maxPercentage: 100 },
      { grade: 6, minPercentage: 65, maxPercentage: 78 },
      { grade: 5, minPercentage: 52, maxPercentage: 64 },
      { grade: 4, minPercentage: 37, maxPercentage: 51 },
      { grade: 3, minPercentage: 26, maxPercentage: 36 },
      { grade: 2, minPercentage: 14, maxPercentage: 25 },
      { grade: 1, minPercentage: 0, maxPercentage: 13 },
    ]
  },
  {
    id: "sub-eng-b",
    name: "English B",
    category: "Language Acquisition",
    level: "HL",
    calculationMode: "simple_sum",
    assessments: [
      { id: "eb-p1", name: "Paper 1", score: 58, maxScore: 60, weight: 50 },
      { id: "eb-p2", name: "Paper 2", score: 55, maxScore: 65, weight: 50 },
    ],
    boundaries: [
      { grade: 7, minPercentage: 90, maxPercentage: 100 },
      { grade: 6, minPercentage: 73, maxPercentage: 89 },
      { grade: 5, minPercentage: 56, maxPercentage: 72 },
      { grade: 4, minPercentage: 39, maxPercentage: 55 },
      { grade: 3, minPercentage: 24, maxPercentage: 38 },
      { grade: 2, minPercentage: 12, maxPercentage: 23 },
      { grade: 1, minPercentage: 0, maxPercentage: 11 },
    ]
  },
  {
    id: "sub-turk-20th",
    name: "Turkey in the 20th Century",
    category: "Individuals & Societies",
    level: "SL",
    calculationMode: "simple_sum",
    assessments: [
      { id: "tk-p1", name: "Paper 1", score: 31, maxScore: 40, weight: 50 },
      { id: "tk-p2", name: "Paper 2", score: 33, maxScore: 40, weight: 50 },
    ],
    boundaries: [
      { grade: 7, minPercentage: 81, maxPercentage: 100 },
      { grade: 6, minPercentage: 67, maxPercentage: 80 },
      { grade: 5, minPercentage: 58, maxPercentage: 66 },
      { grade: 4, minPercentage: 44, maxPercentage: 57 },
      { grade: 3, minPercentage: 27, maxPercentage: 43 },
      { grade: 2, minPercentage: 13, maxPercentage: 26 },
      { grade: 1, minPercentage: 0, maxPercentage: 12 },
    ]
  },
  {
    id: "sub-phys",
    name: "Physics",
    category: "Sciences",
    level: "SL",
    calculationMode: "simple_sum",
    assessments: [
      { id: "ph-p1", name: "Paper 1", score: 24, maxScore: 30, weight: 50 },
      { id: "ph-p2", name: "Paper 2", score: 38, maxScore: 50, weight: 50 },
    ],
    boundaries: [
      { grade: 7, minPercentage: 63, maxPercentage: 100 },
      { grade: 6, minPercentage: 53, maxPercentage: 62 },
      { grade: 5, minPercentage: 42, maxPercentage: 52 },
      { grade: 4, minPercentage: 32, maxPercentage: 41 },
      { grade: 3, minPercentage: 20, maxPercentage: 31 },
      { grade: 2, minPercentage: 12, maxPercentage: 19 },
      { grade: 1, minPercentage: 0, maxPercentage: 11 },
    ]
  }
];

export interface KilicKepenekCalculatorProps {
  onBackToHub?: () => void;
  onSwitchToOriginal?: () => void;
}

export default function KilicKepenekCalculator({
  onBackToHub,
  onSwitchToOriginal
}: KilicKepenekCalculatorProps = {}) {
  // Use localStorage to persist the state
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem("ib_grades_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Localstorage parsed error, using defaults", e);
      }
    }
    return DEFAULT_SUBJECTS;
  });

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(DEFAULT_SUBJECTS[0].id);
  const [corePoints, setCorePoints] = useState<number>(3); // Standard default value of 2 or 3 core points
  const [activeTab, setActiveTab] = useState<"grades" | "boundaries" | "info">("grades");
  const [showNotification, setShowNotification] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem("ib_grades_data", JSON.stringify(subjects));
  }, [subjects]);

  const triggerNotification = (message: string) => {
    setShowNotification(message);
    setTimeout(() => {
      setShowNotification(null);
    }, 2500);
  };

  const resetToDefault = () => {
    if (window.confirm("Are you sure you want to reset all assessments, scores, and boundaries to default values?")) {
      setSubjects(DEFAULT_SUBJECTS);
      setSelectedSubjectId(DEFAULT_SUBJECTS[0].id);
      setCorePoints(3);
      triggerNotification("Reset completely to official default boundaries & mock scores!");
    }
  };

  const handleUpdateAssessment = (
    subjectId: string, 
    assessmentId: string, 
    field: keyof Assessment, 
    value: string | number
  ) => {
    setSubjects(prevSubjects => 
      prevSubjects.map(sub => {
        if (sub.id !== subjectId) return sub;
        
        return {
          ...sub,
          assessments: sub.assessments.map(ass => {
            if (ass.id !== assessmentId) return ass;
            const updated = { ...ass };
            
            if (field === "name") {
              updated.name = value as string;
            } else if (field === "score") {
              const numVal = Math.max(0, Number(value));
              updated.score = isNaN(numVal) ? 0 : numVal;
            } else if (field === "maxScore") {
              const numVal = Math.max(1, Number(value));
              updated.maxScore = isNaN(numVal) ? 100 : numVal;
            } else if (field === "weight") {
              const numVal = Math.max(0, Math.min(100, Number(value)));
              updated.weight = isNaN(numVal) ? 0 : numVal;
            }

            // Cap score to maxScore just to be logical (optional but helpful, we'll let users exceed if they get extra credit but usually cap it)
            if (field === "maxScore" && updated.score > updated.maxScore) {
              updated.score = updated.maxScore;
            } else if (field === "score" && updated.score > updated.maxScore) {
              updated.maxScore = updated.score;
            }

            return updated;
          })
        };
      })
    );
  };

  const handleAddAssessment = (subjectId: string) => {
    setSubjects(prevSubjects => 
      prevSubjects.map(sub => {
        if (sub.id !== subjectId) return sub;
        const newId = `ass-${Date.now()}`;
        const newNumber = sub.assessments.length + 1;
        
        // Find appropriate equal weight representation
        const currentCount = sub.assessments.length + 1;
        const nextWeight = Math.round(100 / currentCount);
        
        const newAssessment: Assessment = {
          id: newId,
          name: `Exam ${newNumber}`,
          score: 0,
          maxScore: 100,
          weight: nextWeight
        };

        const updatedAssessments = [...sub.assessments, newAssessment];
        
        // Automatically rebalance weights if they are all identical
        const rebalanced = updatedAssessments.map(item => ({
          ...item,
          weight: Math.round(100 / currentCount)
        }));

        return {
          ...sub,
          assessments: rebalanced
        };
      })
    );
    triggerNotification("Added a new flexible assessment.");
  };

  const handleDeleteAssessment = (subjectId: string, assessmentId: string) => {
    const targetSub = subjects.find(s => s.id === subjectId);
    if (targetSub && targetSub.assessments.length <= 1) {
      alert("A subject must have at least one assessment.");
      return;
    }

    setSubjects(prevSubjects => 
      prevSubjects.map(sub => {
        if (sub.id !== subjectId) return sub;
        const filtered = sub.assessments.filter(ass => ass.id !== assessmentId);
        
        // Rebalance weights
        const rebalanced = filtered.map(item => ({
          ...item,
          weight: Math.round(100 / filtered.length)
        }));

        return {
          ...sub,
          assessments: rebalanced
        };
      })
    );
    triggerNotification("Assessment removed.");
  };

  const handleUpdateBoundary = (
    subjectId: string, 
    grade: number, 
    field: "minPercentage" | "maxPercentage", 
    value: number
  ) => {
    setSubjects(prevSubjects => 
      prevSubjects.map(sub => {
        if (sub.id !== subjectId) return sub;
        
        const updatedBoundaries = sub.boundaries.map(b => {
          if (b.grade !== grade) return b;
          return {
            ...b,
            [field]: Math.max(0, Math.min(100, value))
          };
        });

        return {
          ...sub,
          boundaries: updatedBoundaries
        };
      })
    );
  };

  const handleToggleCalculationMode = (subjectId: string) => {
    setSubjects(prevSubjects => 
      prevSubjects.map(sub => {
        if (sub.id !== subjectId) return sub;
        return {
          ...sub,
          calculationMode: sub.calculationMode === "simple_sum" ? "weighted" : "simple_sum"
        };
      })
    );
    triggerNotification("Toggled percentage calculation formula.");
  };

  // Helper calculation logic
  const calculateSubjectPercentage = (subject: Subject): number => {
    const list = subject.assessments;
    if (list.length === 0) return 0;

    if (subject.calculationMode === "simple_sum") {
      const sumUser = list.reduce((sum, item) => sum + item.score, 0);
      const sumMax = list.reduce((sum, item) => sum + item.maxScore, 0);
      if (sumMax === 0) return 0;
      return Math.round((sumUser / sumMax) * 1000) / 10;
    } else {
      // Weighted mode
      let totalWeight = list.reduce((sum, item) => sum + item.weight, 0);
      if (totalWeight === 0) totalWeight = 1;
      
      const contribution = list.reduce((sum, item) => {
        const itemPct = item.maxScore > 0 ? (item.score / item.maxScore) * 100 : 0;
        return sum + (itemPct * item.weight);
      }, 0);
      
      return Math.round((contribution / totalWeight) * 10) / 10;
    }
  };

  const getGradeForPercentage = (subject: Subject, percentage: number): number => {
    // Sort boundaries descending to check from Grade 7 down to 1
    const sorted = [...subject.boundaries].sort((a, b) => b.grade - a.grade);
    const pct = Math.round(percentage);

    for (const b of sorted) {
      if (pct >= b.minPercentage && pct <= b.maxPercentage) {
        return b.grade;
      }
    }

    // Fallback if there is standard offset gap, look for closest from below
    for (const b of sorted) {
      if (pct >= b.minPercentage) {
        return b.grade;
      }
    }
    return 1;
  };

  const getGradeColorClass = (grade: number) => {
    switch(grade) {
      case 7: return "bg-emerald-550 border-emerald-650 text-white shadow-emerald-100/50";
      case 6: return "bg-teal-500 border-teal-600 text-white shadow-teal-100/50";
      case 5: return "bg-sky-500 border-sky-600 text-white shadow-sky-100/50";
      case 4: return "bg-blue-500 border-blue-600 text-white shadow-blue-100/50";
      case 3: return "bg-amber-500 border-amber-600 text-white shadow-amber-100/50";
      case 2: return "bg-orange-500 border-orange-600 text-white shadow-orange-100/50";
      default: return "bg-rose-500 border-rose-600 text-white shadow-rose-100/50";
    }
  };

  const getTextColorForGrade = (grade: number) => {
    switch(grade) {
      case 7: return "text-emerald-600 dark:text-emerald-450";
      case 6: return "text-teal-600 dark:text-teal-450";
      case 5: return "text-sky-600 dark:text-sky-450";
      case 4: return "text-blue-600 dark:text-blue-450";
      case 3: return "text-amber-600 dark:text-amber-500";
      case 2: return "text-orange-600 dark:text-orange-500";
      default: return "text-rose-600 dark:text-rose-500";
    }
  };

  // Process status for the 6 subjects
  const subjectSummaries = subjects.map(sub => {
    const percentage = calculateSubjectPercentage(sub);
    const grade = getGradeForPercentage(sub, percentage);
    return {
      ...sub,
      percentage,
      grade
    };
  });

  const selectedSubject = subjectSummaries.find(s => s.id === selectedSubjectId) || subjectSummaries[0];

  // IB total score
  const totalSubjectScore = subjectSummaries.reduce((sum, item) => sum + item.grade, 0); // Out of 42
  const finalIBScore_coreProps = totalSubjectScore + corePoints; // Out of 45

  // Average percentage
  const averagePercentage = subjectSummaries.length > 0 
    ? Math.round(subjectSummaries.reduce((sum, item) => sum + item.percentage, 0) / subjectSummaries.length * 10) / 10
    : 0;

  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased transition-colors duration-300">

      {/* Toast Notification */}
      {showNotification && (
        <div id="toast-notif" className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in text-sm border border-slate-700/50">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{showNotification}</span>
        </div>
      )}

      {/* KapsCulator Navigation Bar */}
      {(onBackToHub || onSwitchToOriginal) && (
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs shrink-0 z-40 shadow-sm">
          <div className="flex items-center gap-2.5">
            {onBackToHub && (
              <button
                onClick={onBackToHub}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold transition-all border border-slate-700 hover:border-slate-600 cursor-pointer shadow-xs active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>KapsCulator Ana Sayfası</span>
              </button>
            )}
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Kılıç Kepenek Version Aktif
            </span>
          </div>
          {onSwitchToOriginal && (
            <button
              onClick={onSwitchToOriginal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95"
            >
              <span>KapsCulator Original'a Geç</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Header Bar */}
      <header id="header-bar" className="bg-white/90 backdrop-blur-md border-b border-slate-200 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">IB Diploma Grade Calculator</h1>
              <p className="text-xs text-slate-500 font-medium">Official Boundaries Mapping & NO-IA Dynamic Model</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              id="btn-tab-grades"
              onClick={() => setActiveTab("grades")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "grades" 
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Assessments List
            </button>
            <button
              id="btn-tab-boundaries"
              onClick={() => setActiveTab("boundaries")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "boundaries" 
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Boundary Setup
            </button>
            <button
              id="btn-tab-ref"
              onClick={() => setActiveTab("info")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "info" 
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10" 
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              IB Info & Guide
            </button>
            <button
              id="btn-reset-grades"
              onClick={resetToDefault}
              title="Reset scores and boundaries"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-6 pb-12">

        {/* TOP METRICS SUMMARY PANEL */}
        <section id="metrics-panel" className="bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 rounded-2xl text-white p-6 sm:p-8 shadow-xl relative overflow-hidden mb-8">
          {/* Subtle design elements in background */}
          <div className="absolute right-0 bottom-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
          <div className="absolute left-1/3 top-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl -z-10" />
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 h-full">
            
            <div className="space-y-4 max-w-lg">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                <GraduationCap className="w-3.5 h-3.5" /> IB Diploma Summary (No-IA Mode)
              </span>
              <h2 className="text-3xl font-bold tracking-tight">Your Projected Diploma Score</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                We mapped each of your dynamic papers into official M25/standard grade boundaries ( Turkish A SL, Physics SL, Mathematics AA HL, English B HL, Turkey 20th Century SL, and Digital Society HL ). Let's tweak your scores to calculate your final grade.
              </p>
              
              {/* Core points toggle bar */}
              <div id="core-points-selector" className="bg-slate-850/80 backdrop-blur-sm border border-slate-700/60 p-3.5 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">EE / TOK Core points:</span>
                  <span className="text-xs font-bold text-indigo-400">+{corePoints} Extra Points</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3].map((val) => (
                    <button
                      key={val}
                      id={`btn-core-pt-${val}`}
                      onClick={() => setCorePoints(val)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        corePoints === val 
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/40" 
                          : "bg-slate-700/50 hover:bg-slate-700 text-slate-300"
                      }`}
                    >
                      +{val}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Score Badges */}
            <div id="mega-score-display" className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:w-[500px]">
              
              {/* Mapped out of 45 badge */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 flex flex-col justify-between border border-white/10 shadow-inner relative group">
                <div className="text-xs text-indigo-300 font-semibold tracking-wider uppercase mb-1">Projected Total</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-4xl font-extrabold text-white">{finalIBScore_coreProps}</span>
                  <span className="text-slate-400 text-lg">/ 45</span>
                </div>
                <div className="text-[10px] text-slate-300 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Subject {totalSubjectScore} + Core {corePoints}</span>
                </div>
              </div>

              {/* Mapped out of 42 badge */}
              <div className="bg-white/5 rounded-xl p-4 flex flex-col justify-between border border-white/5">
                <div className="text-xs text-slate-400 font-semibold tracking-wider uppercase mb-1">Subject Points</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-3xl font-bold text-white">{totalSubjectScore}</span>
                  <span className="text-slate-500 text-sm">/ 42</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-2 block">
                  Sum of 6 mapped subjects
                </span>
              </div>

              {/* Status Indicator */}
              <div className="bg-white/5 rounded-xl p-4 flex flex-col justify-between border border-white/5">
                <div className="text-xs text-slate-400 font-semibold tracking-wider uppercase mb-1">Overall Stats</div>
                <div className="mt-1">
                  <span className="text-md font-bold text-white">Avg {averagePercentage}%</span>
                  <div className="text-[10px] text-zinc-400 mt-1">
                    GPA: {(totalSubjectScore / 6).toFixed(2)} / 7.0
                  </div>
                </div>
                <span className="text-[10px] text-indigo-300 font-medium mt-2 flex items-center gap-1">
                  {finalIBScore_coreProps >= 24 ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Diploma Pass Eligible
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Less than 24 pts
                    </span>
                  )}
                </span>
              </div>

            </div>

          </div>

          {/* Quick note on preset comparison of 2 and 3 core points */}
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-400 inline" />
              <span>Comparing points breakdown:</span>
              <strong className="text-white ml-1">with +2 Core:</strong> {totalSubjectScore + 2}/45 | 
              <strong className="text-white ml-1">with +3 Core:</strong> {totalSubjectScore + 3}/45
            </span>
            <span className="text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded-md self-start">
              Subject grades are mapped out of 7 utilizing strict boundary logic
            </span>
          </div>

        </section>

        {/* MAIN TAB SWITCH CONTENT */}

        {activeTab === "grades" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: 6 SUBJECTS SIDEBAR (5 COLS) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Your IB Classes</h3>
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                  6 Subjects Active
                </span>
              </div>

              <div id="subject-list" className="space-y-3.5">
                {subjectSummaries.map((sub) => {
                  const isSelected = sub.id === selectedSubjectId;
                  const examsCount = sub.assessments.length;
                  
                  return (
                    <button
                      id={`subject-item-${sub.id}`}
                      key={sub.id}
                      onClick={() => setSelectedSubjectId(sub.id)}
                      className={`w-full text-left p-4 rounded-xl transition-all border ${
                        isSelected 
                          ? "bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-100 ring-2 ring-indigo-500 ring-offset-2" 
                          : "bg-white hover:bg-slate-100/85 border-slate-200 text-slate-800"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                              isSelected ? "bg-white/20 text-indigo-100" : "bg-slate-100 text-slate-500"
                            }`}>
                              {sub.level}
                            </span>
                            <span className={`text-[10px] font-semibold ${
                              isSelected ? "text-indigo-200" : "text-slate-400"
                            }`}>
                              {sub.category}
                            </span>
                          </div>
                          
                          <h4 className="font-bold text-base mt-1.5 tracking-tight">
                            {sub.name}
                          </h4>
                        </div>

                        {/* Mapped Large Grade Dial */}
                        <div className="flex flex-col items-end">
                          <span className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg border-2 ${
                            isSelected 
                              ? "bg-white/10 border-white text-white" 
                              : getGradeColorClass(sub.grade)
                          }`}>
                            {sub.grade}
                          </span>
                          <span className={`text-[10px] mt-1 font-medium ${
                            isSelected ? "text-indigo-100" : "text-slate-500"
                          }`}>
                            Grade out of 7
                          </span>
                        </div>
                      </div>

                      {/* Small inline status list */}
                      <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200/40 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 opacity-75" />
                          <span>{examsCount} Assessment{examsCount !== 1 ? 's' : ''} ({sub.calculationMode === "simple_sum" ? "Sum mode" : "Weighted"})</span>
                        </span>
                        
                        <span className="font-bold">
                          {sub.percentage}%
                        </span>
                      </div>

                      {/* Simple miniature progress line */}
                      <div className="w-full h-1.5 {isSelected ? 'bg-indigo-750' : 'bg-slate-100'} rounded-full mt-2 overflow-hidden">
                        <div 
                          className={`h-full ${isSelected ? "bg-white" : "bg-indigo-600"}`} 
                          style={{ width: `${Math.min(100, sub.percentage)}%` }} 
                        />
                      </div>

                    </button>
                  );
                })}
              </div>

              {/* Dynamic Add Subject Support (Optional - standard 6 subjects are core but can customize) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Need standard combination?</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Pre-populated default is the exact six image subjects from your criteria.</p>
                </div>
                <button
                  id="btn-revert-preset"
                  onClick={() => {
                    if (window.confirm("Do you want to re-seed to defaults? All changes will be re-set.")) {
                      setSubjects(DEFAULT_SUBJECTS);
                      triggerNotification("Re-seeded perfect template!");
                    }
                  }}
                  className="px-3 py-1.5 border border-indigo-200 text-indigo-700 font-semibold text-xs rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  Reload Defaults
                </button>
              </div>

            </div>

            {/* RIGHT COLUMN: ASSESSMENT DETAIL AND DYNAMIC CONTROLS (7 COLS) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Focus Header */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                       <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-extrabold">
                         {selectedSubject.level} Degree
                       </span>
                       <span className="text-xs text-slate-500 font-medium">{selectedSubject.category}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">{selectedSubject.name} Grade Mapper</h3>
                  </div>

                  <div className="flex items-center gap-1.5 self-start sm:self-center">
                    <span className="text-xs text-slate-500">Method:</span>
                    <button
                      id="btn-toggle-formula"
                      onClick={() => handleToggleCalculationMode(selectedSubject.id)}
                      className="px-3 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200/80 rounded-lg text-xs font-bold transition-all text-slate-700 flex items-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      {selectedSubject.calculationMode === "simple_sum" ? "Sum of Raw points" : "Weighted formula (%)"}
                    </button>
                  </div>
                </div>

                {/* Info block regarding NO IA */}
                <div className="bg-amber-50/70 border border-amber-200/60 p-3 rounded-xl mt-4 flex items-start gap-2.5 text-xs text-amber-800">
                  <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Strict Request Met: </span> 
                    No IA (Internal Assessments) or Paper 1 sections have been added according to your instructions. 
                    {selectedSubject.id === "sub-turk-a" ? " (Turkish A is Paper 1 only)." : ""}
                    {selectedSubject.id === "sub-math-aa" ? " (Maths has Paper 1, 2, and 3)." : ""}
                    {" Enter your scores below. You can change max points freely!"}
                  </div>
                </div>

                {/* THE ASSESSMENTS TABLE OR GRID */}
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Active Exams / Assessments</h4>
                    <button
                      id="btn-add-assessment"
                      onClick={() => handleAddAssessment(selectedSubject.id)}
                      className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors border border-indigo-100/50"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Assessment
                    </button>
                  </div>

                  <div className="space-y-3">
                    {selectedSubject.assessments.map((ass, index) => {
                      return (
                        <div 
                          key={ass.id} 
                          id={`assessment-row-${ass.id}`}
                          className="p-4 rounded-xl border border-slate-250 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 group"
                        >
                          {/* Assessment details */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <input
                                id={`input-name-${ass.id}`}
                                type="text"
                                value={ass.name}
                                onChange={(e) => handleUpdateAssessment(selectedSubject.id, ass.id, "name", e.target.value)}
                                className="font-semibold text-sm text-slate-800 bg-transparent hover:bg-slate-200/50 focus:bg-white focus:ring-1 focus:ring-indigo-500 px-1.5 py-0.5 rounded cursor-pointer transition-all border border-transparent hover:border-slate-300 w-full"
                              />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3.5">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Obtained Score</label>
                                <div className="mt-1 flex items-center relative">
                                  <input
                                    id={`input-score-${ass.id}`}
                                    type="number"
                                    min="0"
                                    value={ass.score}
                                    step="0.5"
                                    onChange={(e) => handleUpdateAssessment(selectedSubject.id, ass.id, "score", e.target.value)}
                                    className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Max Score (Out of)</label>
                                <div className="mt-1 flex items-center">
                                  <input
                                    id={`input-max-${ass.id}`}
                                    type="number"
                                    min="1"
                                    value={ass.maxScore}
                                    onChange={(e) => handleUpdateAssessment(selectedSubject.id, ass.id, "maxScore", e.target.value)}
                                    className="w-full bg-white border border-slate-250 rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Calculation details (Percent and weight or delete option) */}
                          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 bg-white sm:bg-transparent p-3 sm:p-0 rounded-lg border border-slate-200/60 sm:border-0">
                            
                            {/* Individual Paper Stats */}
                            <div className="text-right">
                              <span className="block text-[10px] font-bold text-slate-400 uppercase">Percentage</span>
                              <span className="font-extrabold text-sm text-indigo-700">
                                {ass.maxScore > 0 ? Math.round((ass.score / ass.maxScore) * 100) : 0}%
                              </span>
                            </div>

                            {/* Weighting percentage wrapper */}
                            {selectedSubject.calculationMode === "weighted" && (
                              <div className="text-right">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Weight %</label>
                                <input
                                  id={`input-weight-${ass.id}`}
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={ass.weight}
                                  onChange={(e) => handleUpdateAssessment(selectedSubject.id, ass.id, "weight", e.target.value)}
                                  className="w-16 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-right font-black text-slate-700"
                                />
                              </div>
                            )}

                            {/* Delete button */}
                            <button
                              id={`delete-btn-${ass.id}`}
                              onClick={() => handleDeleteAssessment(selectedSubject.id, ass.id)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors duration-150 shrink-0 self-end"
                              title="Delete this assessment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>

                        </div>
                      );
                    })}
                  </div>

                  {/* Calculations breakdown info card */}
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between text-xs text-indigo-900">
                    <span className="font-medium">
                      Calculated overall score percentage:
                    </span>
                    <strong className="text-sm text-indigo-800">
                      {selectedSubject.percentage}%
                    </strong>
                  </div>
                </div>

                {/* THERMOMETER ST SCALE / RANGE BOUNDARY VISUALIZATION */}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Grade Mapping Scale Checker</h4>
                  
                  {/* Visual gauge bar */}
                  <div className="space-y-5">
                    
                    <div className="relative pt-6">
                      <div className="h-4 bg-slate-100 rounded-full flex overflow-hidden border border-slate-200/80">
                        {/* Sort boundaries lowest to highest min values to display correctly from left to right */}
                        {[...selectedSubject.boundaries].sort((a,b) => a.minPercentage - b.minPercentage).map((bound) => {
                          const widthPct = bound.maxPercentage - bound.minPercentage + 1;
                          const isCurrentGrade = selectedSubject.grade === bound.grade;
                          return (
                            <div 
                              key={bound.grade}
                              style={{ width: `${widthPct}%` }}
                              title={`Grade ${bound.grade}: ${bound.minPercentage}% - ${bound.maxPercentage}%`}
                              className={`h-full relative group transition-all duration-300 ${
                                isCurrentGrade 
                                  ? `${getGradeColorClass(bound.grade)} opacity-100 ring-2 ring-offset-1 ring-indigo-600/50 z-10` 
                                  : "bg-slate-200 hover:bg-slate-350 opacity-60 hover:opacity-85 border-r border-slate-300"
                              }`}
                            >
                              {/* Inner boundary title centered */}
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black pointer-events-none">
                                G{bound.grade}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Current Score Pin Overlay on gauge bar */}
                      <div 
                        className="absolute -top-1.5 transition-all duration-500 ease-out-back" 
                        style={{ left: `${Math.max(0, Math.min(100, selectedSubject.percentage))}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className="flex flex-col items-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold text-white shadow-md ${getGradeColorClass(selectedSubject.grade)}`}>
                            {selectedSubject.percentage}% (Mapped: Grade {selectedSubject.grade})
                          </span>
                          <span className="w-1.5 h-3 bg-slate-900 rounded-full mt-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Numeric details row */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 divide-y divide-slate-100">
                      <div className="pb-3 flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-medium">Mapped Grade</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`${getTextColorForGrade(selectedSubject.grade)} font-extrabold text-base`}>
                            Grade {selectedSubject.grade} out of 7
                          </span>
                          <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                            Official Boundary mapped
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">To reach next level:</span>
                        <span>
                          {selectedSubject.grade === 7 ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 inline" /> Already at Maximum Grade 7!
                            </span>
                          ) : (() => {
                            const nextGrade = selectedSubject.grade + 1;
                            const boundary = selectedSubject.boundaries.find(b => b.grade === nextGrade);
                            if (boundary) {
                              const diff = Math.round((boundary.minPercentage - selectedSubject.percentage) * 10) / 10;
                              return (
                                <span className="text-indigo-700 font-semibold">
                                  Need <strong className="font-extrabold text-sm">{diff}% MORE</strong> to reach Grade {nextGrade} (starts at {boundary.minPercentage}%)
                                </span>
                              );
                            }
                            return <span className="text-slate-400">Top-end reached</span>;
                          })()}
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

        {/* BOUNDARIES TAB CONTROLS */}
        {activeTab === "boundaries" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            
            <div className="border-b border-slate-100 pb-5">
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">Configure IB Grade Boundaries</h3>
              <p className="text-slate-500 text-sm mt-1">
                You can alter or adjust the ranges according to the official mock boundary sheets or different year averages. The app maps live scores according to these boundaries!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map((sub) => (
                <div key={sub.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between mb-3.5">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1">
                      <Bookmark className="w-4 h-4 text-indigo-600" /> {sub.name} ({sub.level})
                    </h4>
                    <span className="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-bold">Boundary</span>
                  </div>

                  <div className="space-y-2">
                    {/* Display boundaries from Grade 7 down to 1 */}
                    {[...sub.boundaries].sort((a,b) => b.grade - a.grade).map((b) => (
                      <div key={b.grade} className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-lg border border-slate-150">
                        <span className={`w-6 h-6 rounded flex items-center justify-center font-black ${getGradeColorClass(b.grade)}`}>
                          {b.grade}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <label className="text-slate-400 text-[10px] font-bold">Min %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={b.minPercentage}
                            onChange={(e) => handleUpdateBoundary(sub.id, b.grade, "minPercentage", Number(e.target.value))}
                            className="w-12 bg-slate-105 border border-slate-200 rounded text-center font-bold px-1 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>

                        <div className="flex items-center gap-1">
                          <label className="text-slate-400 text-[10px] font-bold">Max %</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={b.maxPercentage}
                            onChange={(e) => handleUpdateBoundary(sub.id, b.grade, "maxPercentage", Number(e.target.value))}
                            className="w-12 bg-slate-105 border border-slate-200 rounded text-center font-bold px-1 py-0.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                id="btn-restore-boundaries"
                onClick={resetToDefault}
                className="flex items-center gap-1.5 text-slate-700 hover:text-indigo-600 bg-slate-100 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-slate-200"
              >
                <RotateCcw className="w-4 h-4" /> Restore Official IB Boundaries
              </button>
            </div>

          </div>
        )}

        {/* INFO AND SYSTEM INFORMATION TAB */}
        {activeTab === "info" && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">IB Diploma Passing Matrix & Calculations</h3>
              <p className="text-slate-500 text-sm mt-1">
                How does the calculation out of 45 work? Let's check below.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-indigo-700">
                  <Award className="w-4.5 h-4.5" /> Passing Requirements (Rules for 24+ Scores)
                </h4>
                <ul className="space-y-3.5 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                    <span>You must achieve a total of at least <strong className="font-bold text-slate-800">24 points</strong> overall (out of 45 points), including subject grades + EE/TOK core points.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                    <span>There must be no "1" awarded for any subject, nor more than two "2" grades overall.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                    <span>For Higher Level (HL) subjects (e.g. Mathematics AA HL, Digital Society HL, English B HL), you must achieve at least 12 points in total.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-2" />
                    <span>For Standard Level (SL) subjects (e.g. Turkish A SL, Physics SL, Turkey 20th Century SL), you must compile at least 9 points in total.</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-indigo-700">
                  <TrendingUp className="w-4.5 h-4.5" /> Dynamic Weighting Modes
                </h4>
                
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3 text-xs text-slate-600">
                  <p>
                    <strong>1. Sum of Raw Marks (Default recommended):</strong> Simple sum maps percentage as `(Sum of obtained Marks / Sum of maximum Marks) * 100`. Ideal if papers already represent the correct relative proportions through their maximum marks.
                  </p>
                  <p>
                    <strong>2. custom Weight Percentage (%):</strong> Each paper has custom specified percent weight (e.g. Paper 1 counts 45% and Paper 2 counts 55%). Percentage is mapped as `Sum( (Obtained / Max) * Weight )`. Extremely flexible for adding dynamic mini quiz/grades!
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-start gap-2.5">
                  <HelpCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Important Note on IAs:</span>
                    <p className="mt-1">In compliance with your instruction, no internal assessment or general coursework entries are added to this model, allowing pristine mapping solely of written paper categories.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* HIGH FIDELITY REPORT CARD CARD ON THE BOTTOM FOR MOTIVATION */}
            <div className="mt-8 border-t border-slate-100 pt-6">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Interactive Diploma Transcript Mockup</h4>
              
              <div className="max-w-xl mx-auto bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-xl border-t-8 border-indigo-600">
                <div className="absolute top-3 right-3 text-white/5 font-black text-6xl select-none uppercase pointer-events-none">
                  IB
                </div>

                <div className="text-center pb-4 border-b border-white/10 space-y-1">
                  <h5 className="font-serif text-lg tracking-wider font-semibold text-amber-100">INTERNATIONAL BACCALAUREATE</h5>
                  <p className="text-[10px] tracking-widest text-slate-400 uppercase">Estimated Diploma Results Transcript</p>
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  {subjectSummaries.map((sub) => (
                    <div key={sub.id} className="flex justify-between items-center py-1.5 border-b border-white/5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-1 bg-white/10 text-slate-350 rounded">{sub.level}</span>
                        <span className="font-semibold">{sub.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400">{sub.percentage}%</span>
                        <strong className="w-4 h-4 rounded-md text-slate-900 bg-amber-100 flex items-center justify-center font-black text-[10px]">
                          {sub.grade}
                        </strong>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="font-bold text-amber-100">EE & TOK Core Points</span>
                    <strong className="text-amber-100">+{corePoints}</strong>
                  </div>

                  <div className="mt-4 pt-2 flex justify-between items-center text-sm font-extrabold text-white">
                    <span className="tracking-wide text-indigo-300">Total Awarded Score:</span>
                    <span className="text-xl text-amber-200">
                      {finalIBScore_coreProps} <span className="text-xs text-slate-400">/ 45 Pts</span>
                    </span>
                  </div>

                  <p className="text-center text-[9px] text-zinc-500 mt-5 italic">
                    For verification and personal planning. Safe calculations completed offline.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 text-center border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-2">
          <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
            Enis Kılıç Kepenek Production
          </p>
        </div>
      </footer>

    </div>
  );
}
