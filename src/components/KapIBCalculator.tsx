import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Trophy, 
  Sliders, 
  Sparkles, 
  Info, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  RotateCcw,
  BookOpen,
  Award,
  ChevronRight,
  TrendingUp,
  Percent,
  AlertTriangle,
  ExternalLink,
  Layers,
  Plus,
  Trash2,
  Calendar,
  Compass,
  ArrowRight,
  UserCheck,
  ArrowLeftRight,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  initialIBSubjects, 
  ALL_IB_SUBJECTS_CATALOG, 
  matchRolesToIBSubjects, 
  switchSubjectLevel 
} from '../data/ibSubjects';
import { 
  FINAL_BOUNDARIES, 
  COMPONENT_BOUNDARIES, 
  HISTORICAL_AVERAGES, 
  IB_DATA_SOURCES,
  getAllFinalVariantsForSubject,
  getFinalBoundaries
} from '../data/gradeBoundaries';
import { Subject, GradeBoundary } from '../types';
import { 
  calculateSubjectFinalPercentage, 
  restoreSubjectDefaultComponents 
} from '../utils/calculatorEngine';

const STORAGE_KEY = 'kapsapp_kapsculator_data_v3';
const CORE_STORAGE_KEY = 'kapsapp_kapsculator_core_points_v3';

interface KapIBCalculatorProps {
  currentUserRoles?: string[];
}

export default function KapIBCalculator({ currentUserRoles = [] }: KapIBCalculatorProps) {
  // 1. Auto-populate from user profile roles or saved local storage
  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not load saved KapsCulator data:', e);
    }
    // Auto-populate based on user roles if available, else standard 6-course pack
    return matchRolesToIBSubjects(currentUserRoles);
  });

  const [corePoints, setCorePoints] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CORE_STORAGE_KEY);
      if (saved !== null) {
        const num = Number(saved);
        if (!isNaN(num) && num >= 0 && num <= 3) return num;
      }
    } catch (e) {}
    return 0;
  });

  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [showDisclaimerModal, setShowDisclaimerModal] = useState<boolean>(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'calculator' | 'boundaries' | 'sources'>('calculator');
  const [boundariesSubTab, setBoundariesSubTab] = useState<'tabA' | 'tabB' | 'tabC'>('tabA');
  const [roleAutoLoadNotice, setRoleAutoLoadNotice] = useState<string | null>(null);

  // Save changes to localStorage (session state, does NOT modify user profile roles)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
    } catch (e) {}
  }, [subjects]);

  useEffect(() => {
    try {
      localStorage.setItem(CORE_STORAGE_KEY, String(corePoints));
    } catch (e) {}
  }, [corePoints]);

  // Reset to default standard subjects
  const handleResetToDefaults = () => {
    if (confirm('Tüm ders notlarını ve IA ayarlarını varsayılan standart IB ders paketine sıfırlamak istiyor musunuz?')) {
      setSubjects(initialIBSubjects);
      setCorePoints(0);
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CORE_STORAGE_KEY);
      } catch (e) {}
    }
  };

  // Re-sync with User Profile Roles
  const handlePopulateFromRoles = () => {
    const matched = matchRolesToIBSubjects(currentUserRoles);
    setSubjects(matched);
    setRoleAutoLoadNotice(`Kullanıcı profil rollerinizden (${currentUserRoles.length} rol) dersler başarıyla yüklendi!`);
    setTimeout(() => setRoleAutoLoadNotice(null), 4000);
  };

  // Handle score updates for papers
  const handlePaperScoreChange = (subjectId: string, paperId: string, value: string) => {
    const numValue = value === '' ? '' : Math.max(0, Number(value));
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        papers: sub.papers.map(p => {
          if (p.id !== paperId) return p;
          const max = typeof p.maxScore === 'number' ? p.maxScore : 999;
          const clamped = typeof numValue === 'number' ? Math.min(numValue, max) : '';
          return { ...p, achievedScore: clamped };
        })
      };
    }));
  };

  // Handle max score updates for papers
  const handlePaperMaxChange = (subjectId: string, paperId: string, value: string) => {
    const numValue = value === '' ? '' : Math.max(1, Number(value));
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        papers: sub.papers.map(p => {
          if (p.id !== paperId) return p;
          return { ...p, maxScore: numValue };
        })
      };
    }));
  };

  // Handle IA / Individual Oral changes
  const handleIAChange = (subjectId: string, field: 'achievedScore' | 'maxScore' | 'enabled', value: any) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      const currentIA = sub.ia;
      let updatedValue = value;
      if (field === 'achievedScore' || field === 'maxScore') {
        updatedValue = value === '' ? '' : Math.max(0, Number(value));
        if (field === 'achievedScore' && typeof currentIA.maxScore === 'number') {
          updatedValue = Math.min(updatedValue, currentIA.maxScore);
        }
      }
      return {
        ...sub,
        ia: { ...currentIA, [field]: updatedValue }
      };
    }));
  };

  // Switch between SL and HL for a subject
  const handleToggleSubjectLevel = (subjectId: string) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      const targetLevel = sub.level === 'SL' ? 'HL' : 'SL';
      return switchSubjectLevel(sub, targetLevel);
    }));
  };

  // Handle variant change (Timezone or Session)
  const handleVariantChange = (subjectId: string, newSession: any, newTimezone: any) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;

      const keyCandidate = sub.id.replace(/-(sl|hl)$/, '');
      const exactBoundary = getFinalBoundaries(keyCandidate, sub.level, newSession, newTimezone);

      if (exactBoundary) {
        const newBoundaries: GradeBoundary[] = [];
        for (let g = 7; g >= 1; g--) {
          const minVal = exactBoundary.boundaries[g as keyof typeof exactBoundary.boundaries];
          newBoundaries.push({
            grade: g,
            min: minVal !== undefined ? minVal : null
          });
        }
        return {
          ...sub,
          session: newSession,
          timezone: newTimezone,
          source: exactBoundary.source,
          boundaries: newBoundaries
        };
      }
      return sub;
    }));
  };

  // Remove a subject from active calculator list (does not change user roles)
  const handleRemoveSubject = (subjectId: string) => {
    if (subjects.length <= 1) {
      alert('Hesaplayıcıda en az 1 ders bulunmalıdır.');
      return;
    }
    setSubjects(prev => prev.filter(s => s.id !== subjectId));
  };

  // Add a subject from the full 16-course catalog
  const handleAddSubjectFromCatalog = (catalogSubject: Subject) => {
    if (subjects.some(s => s.id === catalogSubject.id)) {
      alert('Bu ders zaten listenizde bulunuyor.');
      return;
    }
    setSubjects(prev => [...prev, JSON.parse(JSON.stringify(catalogSubject))]);
    setShowAddSubjectModal(false);
  };

  // Toggle paper active/inactive (dynamic re-weighting)
  const handleTogglePaper = (subjectId: string, paperId: string, forceState?: boolean) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        papers: sub.papers.map(p => {
          if (p.id !== paperId) return p;
          const nextState = forceState !== undefined ? forceState : (p.isActive === false ? true : false);
          return { ...p, isActive: nextState };
        })
      };
    }));
  };

  // Toggle IA active/inactive (dynamic re-weighting)
  const handleToggleIA = (subjectId: string, forceState?: boolean) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      const nextState = forceState !== undefined ? forceState : (sub.ia.isActive === false ? true : false);
      return {
        ...sub,
        ia: { ...sub.ia, isActive: nextState }
      };
    }));
  };

  // Restore all components for a subject to official default weights and active state
  const handleRestoreSubjectComponents = (subjectId: string) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return restoreSubjectDefaultComponents(sub);
    }));
  };

  // Exact dynamic re-weighting and normalization calculation engine
  const subjectCalculations = useMemo(() => {
    return subjects.map(sub => calculateSubjectFinalPercentage(sub));
  }, [subjects]);

  const totalSubjectGrade = subjectCalculations.reduce((sum, item) => sum + item.grade, 0);
  const finalScore = totalSubjectGrade + corePoints;
  const isPassing = finalScore >= 24;

  const getGradeStyle = (grade: number) => {
    switch (grade) {
      case 7:
        return 'bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 text-white shadow-purple-500/30 ring-2 ring-purple-400/50';
      case 6:
        return 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-cyan-500/20';
      case 5:
        return 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-emerald-500/20';
      case 4:
        return 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-amber-500/20';
      case 3:
        return 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-orange-500/20';
      default:
        return 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-red-500/20';
    }
  };

  const getProgressBarColor = (grade: number) => {
    switch (grade) {
      case 7: return 'from-purple-500 to-pink-500';
      case 6: return 'from-cyan-500 to-teal-500';
      case 5: return 'from-emerald-500 to-green-500';
      case 4: return 'from-amber-400 to-yellow-500';
      case 3: return 'from-orange-400 to-amber-500';
      default: return 'from-rose-500 to-red-600';
    }
  };

  return (
    <div className="flex-1 flex flex-col w-full h-full min-h-0 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-y-auto">
      
      {/* Role Auto-Load Feedback Toast */}
      {roleAutoLoadNotice && (
        <div className="bg-emerald-500 text-white px-4 py-2 text-xs font-bold text-center shadow-md animate-in fade-in duration-200">
          {roleAutoLoadNotice}
        </div>
      )}

      {/* Disclaimer / Provisional Data Banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/25 px-4 py-2 text-xs text-amber-900 dark:text-amber-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <span className="font-semibold">
              <span className="font-bold underline">Third-Party Sourced / Provisional (Geçici Veri)</span>: 
              RevisionDojo, IB Predict ve resmi 2024–2025 arşivlerinden derlenmiştir. Doğrulanmamış veriler null (—) bırakılmıştır.
            </span>
          </div>
          <button
            onClick={() => setShowDisclaimerModal(true)}
            className="text-amber-700 dark:text-amber-300 font-bold hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <span>Detay & Feragatname</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Top Header Banner */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
              <Calculator size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  KapsCulator
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800/60">
                  IB Predicted Grade Simülatörü
                </span>
                {currentUserRoles.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                    <UserCheck size={12} />
                    <span>Roller Eşlendi</span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Kullanıcı rollerine göre otomatik listeleme, Türkçe A Paper 1+2 & Bireysel Sözlü, English B Individual Oral ve 2026 fen müfredatı.
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <button
                onClick={() => setActiveTab('calculator')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'calculator'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Hesap Makinesi
              </button>
              <button
                onClick={() => setActiveTab('boundaries')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'boundaries'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Not Sınırları
              </button>
              <button
                onClick={() => setActiveTab('sources')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                  activeTab === 'sources'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Kaynaklar (S1–S20)
              </button>
            </div>

            {/* Populate from User Roles Button */}
            {currentUserRoles.length > 0 && (
              <button
                onClick={handlePopulateFromRoles}
                title="Kullanıcı profilimdeki ders rollerine göre listeyi yeniden yükle"
                className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <UserCheck size={14} />
                <span className="hidden sm:inline">Rollerimi Yükle</span>
              </button>
            )}

            <button
              onClick={() => setShowSummaryModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Sparkles size={15} />
              <span>Özet Rapor</span>
            </button>

            <button
              onClick={handleResetToDefaults}
              title="Varsayılan Derslere Sıfırla"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-700/60 cursor-pointer"
            >
              <RotateCcw size={17} />
            </button>
          </div>

        </div>
      </div>

      {/* Sticky Score Summary Bar */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Circular Score Gauge */}
          <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto justify-between md:justify-start">
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle 
                  cx="28" cy="28" r="23" 
                  stroke="currentColor" 
                  strokeWidth="5" 
                  className="text-slate-200 dark:text-slate-800" 
                  fill="transparent" 
                />
                <circle 
                  cx="28" cy="28" r="23" 
                  stroke="currentColor" 
                  strokeWidth="5" 
                  className={isPassing ? 'text-emerald-500' : 'text-rose-500'} 
                  fill="transparent" 
                  strokeDasharray={144.5}
                  strokeDashoffset={144.5 - (144.5 * Math.min(finalScore, 45)) / 45}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-black leading-none">{finalScore}</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Toplam Predicted Puan
              </div>
              <div className="text-xl sm:text-2xl font-black flex items-baseline gap-2">
                <span>{finalScore} <span className="text-xs sm:text-sm font-normal text-slate-400">/ 45</span></span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                  Dersler: {totalSubjectGrade} + Core: {corePoints}
                </span>
              </div>
            </div>

            {/* Diploma Status Badge (Mobile) */}
            <div className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 border font-bold text-xs shadow-xs md:hidden ${
              isPassing 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300' 
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/60 text-rose-700 dark:text-rose-300'
            }`}>
              {isPassing ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <span>{isPassing ? 'Geçti (>=24)' : 'Riskte (<24)'}</span>
            </div>
          </div>

          {/* Diploma Status Badge (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 border font-bold text-sm shadow-xs ${
              isPassing 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-300' 
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/60 text-rose-700 dark:text-rose-300'
            }`}>
              {isPassing ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>{isPassing ? 'DİPLOMA BARAJINI GEÇTİ (>=24)' : 'DİPLOMA RİSKTE (<24)'}</span>
            </div>
          </div>

          {/* Core Points Selector (EE/TOK) */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 w-full md:w-auto justify-between md:justify-start">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 pl-1">
              Core (EE / TOK):
            </span>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map(pt => (
                <button
                  key={pt}
                  onClick={() => setCorePoints(pt)}
                  className={`w-8 h-8 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    corePoints === pt 
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 scale-105' 
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 shadow-xs'
                  }`}
                >
                  +{pt}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full">
        {activeTab === 'calculator' && (
          <div className="space-y-6">
            
            {/* Introductory Card & Subject Controls */}
            <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-pink-950/40 p-5 sm:p-6 rounded-3xl border border-indigo-200 dark:border-indigo-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Award size={18} className="text-indigo-500" />
                  <span>Dinamik Ders Listesi ({subjects.length} Ders Aktif)</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
                  Dersleriniz profil rolleriniz taranarak listelendi. Her karttan seviyeyi (SL ⇄ HL) değiştirebilir, dersi silebilir veya kataloğumuzdaki 16 dersten yenisini ekleyebilirsiniz.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => setShowAddSubjectModal(true)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Ders Ekle</span>
                </button>
              </div>
            </div>

            {/* Subject Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              {subjects.map(subject => {
                const calc = subjectCalculations.find(s => s.id === subject.id)!;
                const variants = getAllFinalVariantsForSubject(subject.id.replace(/-(sl|hl)$/, ''), subject.level);
                const hasMultipleVariants = variants.length > 1;

                // Terminology labels
                const oralOrIAName = subject.ia.name || (
                  subject.id.includes('turkish') 
                    ? 'Bireysel Sözlü (Individual Oral)' 
                    : (subject.id.includes('english') ? 'Individual Oral' : 'Internal Assessment (IA)')
                );

                return (
                  <div 
                    key={subject.id} 
                    className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between"
                  >
                    
                    {/* Card Header */}
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleToggleSubjectLevel(subject.id)}
                            title="Seviyeyi Değiştir (SL ⇄ HL)"
                            className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 ${
                              subject.level === 'HL' 
                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60' 
                                : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                            }`}
                          >
                            <span>{subject.level}</span>
                            <ArrowLeftRight size={10} className="opacity-70" />
                          </button>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                            {subject.name}
                          </h3>
                        </div>

                        {/* Session, Timezone & Source Tags & Visual Indicator Badge */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {subject.session || 'M26'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {subject.timezone || 'TZ1'}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                            {subject.source || 'Provisional'}
                          </span>

                          {/* Variant Selector for English B & Psychology */}
                          {hasMultipleVariants && (
                            <select
                              value={`${subject.session || 'M26'}-${subject.timezone || 'TZ1'}`}
                              onChange={(e) => {
                                const [sess, tz] = e.target.value.split('-');
                                handleVariantChange(subject.id, sess, tz);
                              }}
                              className="text-[10px] font-bold py-0.5 px-1.5 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 focus:outline-none"
                            >
                              {variants.map(v => (
                                <option key={`${v.session}-${v.timezone}`} value={`${v.session}-${v.timezone}`}>
                                  {v.session} {v.timezone}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* User Guidance Visual Indicator (Re-weighted Partial Evaluation) */}
                          {calc.isPartialEvaluation && (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40"
                              title={`Dersin bazı sınavları devre dışı bırakıldı. Başarı yüzdesi kalan %${Math.round(calc.totalActiveWeight)} ağırlık %100 kabul edilerek dinamik olarak hesaplanmaktadır.`}
                            >
                              <AlertTriangle size={11} className="text-amber-500 shrink-0" />
                              <span>(Kısmi Değerlendirme: Kalan %{Math.round(calc.totalActiveWeight)} üzerinden)</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Grade Badge & Delete Subject Button */}
                      <div className="flex items-center gap-2">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl shadow-md transition-transform hover:scale-105 shrink-0 ${getGradeStyle(calc.grade)}`}>
                          {calc.grade}
                        </div>
                        <button
                          onClick={() => handleRemoveSubject(subject.id)}
                          title="Dersi Bu Hesaplamadan Kaldır"
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Card Body - Papers & IA/Oral */}
                    <div className="p-5 space-y-5 flex-1">
                      
                      {/* Papers Section */}
                      <div className="space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Sliders size={13} />
                            <span>Yazılı Sınavlar (Papers)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                              Ağırlıklı Başarı: %{calc.percentage}
                            </span>
                            {calc.isPartialEvaluation && (
                              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 hidden sm:inline">
                                (%{Math.round(calc.totalActiveWeight)} üzerinden normalize)
                              </span>
                            )}
                          </div>
                        </div>

                        {subject.papers.map(paper => {
                          const isPaperActive = paper.isActive !== false;
                          const comp = calc.components.find(c => c.id === paper.id);
                          const max = typeof paper.maxScore === 'number' ? paper.maxScore : 100;
                          const val = typeof paper.achievedScore === 'number' ? paper.achievedScore : 0;
                          const origWeight = paper.weight !== undefined ? paper.weight : 0;
                          const normWeight = comp ? Math.round(comp.normalizedWeight * 10) / 10 : origWeight;

                          if (!isPaperActive) {
                            // Dimmed / Deactivated Paper row
                            return (
                              <div 
                                key={paper.id} 
                                className="p-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/20 opacity-75 hover:opacity-100 transition-all flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-xs text-slate-500 dark:text-slate-400 line-through truncate">
                                        {paper.name}
                                      </span>
                                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        Orijinal: %{origWeight}
                                      </span>
                                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                        Hesaplamaya Dahil Edilmiyor
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                      Maks. {max} puan • Kalan sınavlar %100'e ölçeklendi
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleTogglePaper(subject.id, paper.id, true)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-2xs"
                                  title="Bu sınavı tekrar hesaplamaya dahil et"
                                >
                                  <Plus size={13} />
                                  <span>Geri Ekle</span>
                                </button>
                              </div>
                            );
                          }

                          // Active Paper row
                          return (
                            <div key={paper.id} className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                              <div className="flex justify-between items-center text-xs sm:text-sm">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{paper.name}</span>
                                  {calc.isPartialEvaluation ? (
                                    <span 
                                      className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/40 flex items-center gap-1"
                                      title={`Orijinal: %${origWeight} → Kalan sınavlar içinde ölçeklenmiş ağırlık: %${normWeight}`}
                                    >
                                      <span>%{origWeight}</span>
                                      <span className="text-amber-500">→</span>
                                      <span className="font-black">%{normWeight} (Norm.)</span>
                                    </span>
                                  ) : (
                                    origWeight > 0 && (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                                        %{origWeight}
                                      </span>
                                    )
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={paper.achievedScore}
                                      onChange={(e) => handlePaperScoreChange(subject.id, paper.id, e.target.value)}
                                      className="w-16 px-2 py-1 text-center font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      placeholder="0"
                                    />
                                    <span className="text-slate-400">/</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={paper.maxScore}
                                      onChange={(e) => handlePaperMaxChange(subject.id, paper.id, e.target.value)}
                                      className="w-14 px-2 py-1 text-center text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      title="Maksimum Puan"
                                    />
                                  </div>

                                  {/* Kaldır / Devre Dışı Bırak Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePaper(subject.id, paper.id, false)}
                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                    title="Bu sınavı henüz girmediyseniz hesaplamadan çıkarın (Ağırlık kalan sınavlara dağıtılır)"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>

                              <input
                                type="range"
                                min="0"
                                max={max}
                                value={val}
                                onChange={(e) => handlePaperScoreChange(subject.id, paper.id, e.target.value)}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* Official Oral / IA Component Section */}
                      {(() => {
                        const isIAActive = subject.ia.isActive !== false;
                        const iaComp = calc.components.find(c => c.isIA);
                        const origIAWeight = Number(subject.ia.weight) || 20;
                        const normIAWeight = iaComp ? Math.round(iaComp.normalizedWeight * 10) / 10 : origIAWeight;

                        if (!isIAActive) {
                          // Deactivated IA card
                          return (
                            <div className="p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/20 opacity-75 hover:opacity-100 transition-all flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-xs text-slate-500 dark:text-slate-400 line-through truncate">
                                      {oralOrIAName}
                                    </span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                      Orijinal: %{origIAWeight}
                                    </span>
                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                      Hesaplamaya Dahil Edilmiyor
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                    Maks. {subject.ia.maxScore} puan • %{origIAWeight} ağırlık yazılı sınavlara eşit oranda dağıtıldı
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleIA(subject.id, true)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 shadow-2xs"
                                title="Bu bileşeni tekrar hesaplamaya dahil et"
                              >
                                <Plus size={13} />
                                <span>Geri Ekle</span>
                              </button>
                            </div>
                          );
                        }

                        // Active IA Component
                        return (
                          <div className={`p-4 rounded-2xl border transition-colors ${
                            subject.ia.enabled 
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/50' 
                              : 'bg-slate-50 dark:bg-slate-800/20 border-slate-200/80 dark:border-slate-800'
                          }`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                                  {oralOrIAName}
                                </span>
                                {calc.isPartialEvaluation ? (
                                  <span 
                                    className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold border border-amber-300/40 flex items-center gap-1"
                                    title={`Orijinal: %${origIAWeight} → Normalize Ağırlık: %${normIAWeight}`}
                                  >
                                    <span>%{origIAWeight}</span>
                                    <span className="text-amber-500">→</span>
                                    <span className="font-black">%{normIAWeight} Ağırlık</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800/40">
                                    %{origIAWeight} Ağırlık
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleIAChange(subject.id, 'enabled', !subject.ia.enabled)}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                                    subject.ia.enabled 
                                      ? 'bg-indigo-600 text-white shadow-sm' 
                                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                                  }`}
                                >
                                  {subject.ia.enabled ? 'Not Belli (Aktif)' : 'Henüz Belli Değil'}
                                </button>

                                {/* Kaldır / Devre Dışı Bırak Button */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleIA(subject.id, false)}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="Bu bileşeni henüz yapmadıysanız hesaplamadan çıkarın"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {subject.ia.enabled ? (
                              <div className="space-y-2.5 mt-3 pt-3 border-t border-indigo-200 dark:border-indigo-800/40">
                                <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Alınan Ham Puan (Maks: {subject.ia.maxScore})
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      value={subject.ia.achievedScore}
                                      onChange={(e) => handleIAChange(subject.id, 'achievedScore', e.target.value)}
                                      className="w-16 px-2 py-1 text-center font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                      placeholder="0"
                                    />
                                    <span className="text-slate-400">/</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={subject.ia.maxScore}
                                      onChange={(e) => handleIAChange(subject.id, 'maxScore', e.target.value)}
                                      className="w-14 px-2 py-1 text-center text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                  </div>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max={typeof subject.ia.maxScore === 'number' ? subject.ia.maxScore : 40}
                                  value={typeof subject.ia.achievedScore === 'number' ? subject.ia.achievedScore : 0}
                                  onChange={(e) => handleIAChange(subject.id, 'achievedScore', e.target.value)}
                                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                              </div>
                            ) : (
                              calc.projections && (
                                <div className="mt-3 space-y-2 pt-3 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                                  <div className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                    <Info size={13} className="text-indigo-500" />
                                    <span>Olası {oralOrIAName.split('(')[0].trim()} Senaryoları (Tahmini Not):</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                                      <div className="text-slate-400 text-[10px]">Düşük (%35)</div>
                                      <div className="font-bold text-sm text-amber-500">{calc.projections.low} / 7</div>
                                    </div>
                                    <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                                      <div className="text-slate-400 text-[10px]">Ortalama (%65)</div>
                                      <div className="font-bold text-sm text-emerald-500">{calc.projections.avg} / 7</div>
                                    </div>
                                    <div className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60">
                                      <div className="text-slate-400 text-[10px]">Yüksek (%90)</div>
                                      <div className="font-bold text-sm text-purple-500">{calc.projections.high} / 7</div>
                                    </div>
                                  </div>

                                  {calc.projections.minIANeeded && (
                                    <div className="text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 px-3 py-1.5 rounded-xl font-medium flex items-center justify-between text-xs">
                                      <span>Bir üst nota ({calc.projections.minIANeeded.targetGrade}) çıkmak için:</span>
                                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                        {calc.projections.minIANeeded.isPossible 
                                          ? `Min. ${calc.projections.minIANeeded.raw} / ${subject.ia.maxScore} gerekli`
                                          : 'Maksimum puan alsanız dahi yetmeyebilir'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        );
                      })()}

                      {/* Deactivated Components Toolbar & Restore Actions */}
                      {(() => {
                        const inactiveComponents = calc.components.filter(c => !c.isActive);
                        if (inactiveComponents.length === 0) return null;

                        return (
                          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
                              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold">
                                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                <span>{inactiveComponents.length} sınav devre dışı (Kalan Ağırlık: %{Math.round(calc.totalActiveWeight)})</span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRestoreSubjectComponents(subject.id)}
                                className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                title="Bu dersin tüm sınavlarını orijinal ağırlıklarıyla geri getir"
                              >
                                <RotateCcw size={12} />
                                <span>Varsayılan Bileşenleri Sıfırla / Geri Getir</span>
                              </button>
                            </div>

                            {/* Quick Add Chips for each inactive component */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-amber-400/20">
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                                Hızlı Ekle:
                              </span>
                              {inactiveComponents.map(comp => (
                                <button
                                  key={comp.id}
                                  type="button"
                                  onClick={() => {
                                    if (comp.isIA) {
                                      handleToggleIA(subject.id, true);
                                    } else {
                                      handleTogglePaper(subject.id, comp.id, true);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                >
                                  <Plus size={12} className="text-emerald-600 dark:text-emerald-400" />
                                  <span>+ {comp.name.split(':')[0]} Ekle</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Division by Zero / All components inactive warning */}
                      {calc.activeComponentsCount === 0 && (
                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-center space-y-2">
                          <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                            Bu derste aktif sınav kalmadı. Başarı %0 olarak değerlendirilmektedir.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRestoreSubjectComponents(subject.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          >
                            <RotateCcw size={13} />
                            <span>Varsayılan Sınavları Geri Yükle</span>
                          </button>
                        </div>
                      )}

                    </div>

                    {/* Card Footer Progress Bar */}
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-500 dark:text-slate-400">
                          Yüzde Dağılımı {calc.isPartialEvaluation ? `(Kalan %${Math.round(calc.totalActiveWeight)} üzerinden)` : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          {calc.isPartialEvaluation && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                              Kısmi
                            </span>
                          )}
                          <span className="text-indigo-600 dark:text-indigo-400">%{calc.percentage}</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                        <div 
                          className={`h-full bg-gradient-to-r ${getProgressBarColor(calc.grade)} transition-all duration-500 rounded-full`}
                          style={{ width: `${Math.min(100, Math.max(2, calc.percentage))}%` }}
                        />
                      </div>
                    </div>


                  </div>
                );
              })}
            </div>

          </div>
        )}

        {activeTab === 'boundaries' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg sm:text-xl font-black flex items-center gap-2 text-slate-900 dark:text-slate-100">
                  <HelpCircle className="text-indigo-600" />
                  <span>IB Not Sınırları & Bileşen Eşikleri Kılavuzu</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  RevisionDojo, IB Predict, Starley ve resmi IB belgelerinden derlenen 2025–2026 veri tabloları.
                </p>
              </div>

              {/* Sub-tabs for Tablo A, Tablo B, Tablo C */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setBoundariesSubTab('tabA')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    boundariesSubTab === 'tabA'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Tablo A: Final (%)
                </button>
                <button
                  onClick={() => setBoundariesSubTab('tabB')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    boundariesSubTab === 'tabB'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Tablo B: Ham (RAW)
                </button>
                <button
                  onClick={() => setBoundariesSubTab('tabC')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    boundariesSubTab === 'tabC'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Tablo C: 5 Yıl Ort.
                </button>
              </div>
            </div>

            {/* Tablo A: Final Percentage Boundaries */}
            {boundariesSubTab === 'tabA' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold">Tablo A:</span> Her ders için en yeni erişilen FINAL grade boundary (100 puan üzerinden ağırlıklandırılmış yüzde alt sınırları). Doğrulanmamış veriler kasıtlı olarak <span className="font-mono font-bold">— (null)</span> olarak gösterilmiştir.
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                        <th className="p-3.5">Ders & Seviye</th>
                        <th className="p-3.5 text-center">Oturum</th>
                        <th className="p-3.5 text-center">TZ</th>
                        <th className="p-3.5 text-center text-purple-600 dark:text-purple-400">Grade 7</th>
                        <th className="p-3.5 text-center text-cyan-600 dark:text-cyan-400">Grade 6</th>
                        <th className="p-3.5 text-center text-emerald-600 dark:text-emerald-400">Grade 5</th>
                        <th className="p-3.5 text-center text-amber-600 dark:text-amber-400">Grade 4</th>
                        <th className="p-3.5 text-center text-orange-600 dark:text-orange-400">Grade 3</th>
                        <th className="p-3.5 text-center text-rose-600 dark:text-rose-400">Grade 2</th>
                        <th className="p-3.5 text-center">Kaynak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {FINAL_BOUNDARIES.map((fb, idx) => {
                        const fmt = (val: number | null) => (val !== null ? `%${val}` : '—');
                        return (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-bold flex items-center gap-2">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                fb.level === 'HL' 
                                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
                                  : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                              }`}>
                                {fb.level}
                              </span>
                              <span>{fb.subjectName}</span>
                            </td>
                            <td className="p-3.5 text-center font-mono text-xs">{fb.session}</td>
                            <td className="p-3.5 text-center font-mono text-xs">{fb.timezone}</td>
                            <td className="p-3.5 text-center font-bold text-purple-600 dark:text-purple-400">{fmt(fb.boundaries[7])}</td>
                            <td className="p-3.5 text-center font-semibold text-cyan-600 dark:text-cyan-400">{fmt(fb.boundaries[6])}</td>
                            <td className="p-3.5 text-center font-semibold text-emerald-600 dark:text-emerald-400">{fmt(fb.boundaries[5])}</td>
                            <td className="p-3.5 text-center font-semibold text-amber-600 dark:text-amber-400">{fmt(fb.boundaries[4])}</td>
                            <td className="p-3.5 text-center font-semibold text-orange-600 dark:text-orange-400">{fmt(fb.boundaries[3])}</td>
                            <td className="p-3.5 text-center font-semibold text-rose-600 dark:text-rose-400">{fmt(fb.boundaries[2])}</td>
                            <td className="p-3.5 text-center text-xs font-mono text-slate-400">{fb.source}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tablo B: Component RAW Boundaries */}
            {boundariesSubTab === 'tabB' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold">Tablo B & EK:</span> Paper / Bireysel Sözlü / IA minimum ham not eşikleri (Grade 7–2 ham puan alt sınırları).
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                        <th className="p-3.5">Ders</th>
                        <th className="p-3.5">Oturum</th>
                        <th className="p-3.5">Bileşen Adı</th>
                        <th className="p-3.5 text-center">Max Puan</th>
                        <th className="p-3.5 text-center text-purple-600 dark:text-purple-400">Grade 7</th>
                        <th className="p-3.5 text-center text-cyan-600 dark:text-cyan-400">Grade 6</th>
                        <th className="p-3.5 text-center text-emerald-600 dark:text-emerald-400">Grade 5</th>
                        <th className="p-3.5 text-center text-amber-600 dark:text-amber-400">Grade 4</th>
                        <th className="p-3.5 text-center text-orange-600 dark:text-orange-400">Grade 3</th>
                        <th className="p-3.5 text-center text-rose-600 dark:text-rose-400">Grade 2</th>
                        <th className="p-3.5 text-center">Kaynak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {COMPONENT_BOUNDARIES.map((cb, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-bold uppercase">{cb.subjectKey} {cb.level}</td>
                          <td className="p-3.5 font-mono text-xs">{cb.session}</td>
                          <td className="p-3.5 font-medium">{cb.componentName}</td>
                          <td className="p-3.5 text-center font-bold text-slate-500">{cb.maxMarks}</td>
                          <td className="p-3.5 text-center font-bold text-purple-600 dark:text-purple-400">{cb.boundaries[7] ?? '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-cyan-600 dark:text-cyan-400">{cb.boundaries[6] ?? '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-emerald-600 dark:text-emerald-400">{cb.boundaries[5] ?? '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-amber-600 dark:text-amber-400">{cb.boundaries[4] ?? '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-orange-600 dark:text-orange-400">{cb.boundaries[3] ?? '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-rose-600 dark:text-rose-400">{cb.boundaries[2] ?? '—'}</td>
                          <td className="p-3.5 text-center text-xs font-mono text-slate-400">{cb.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tablo C: Historical 5-Year Averages */}
            {boundariesSubTab === 'tabC' && (
              <div className="space-y-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-bold">Tablo C:</span> Son 5 Mayıs oturumunun FINAL ortalaması (2022–2026).
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold">
                        <th className="p-3.5">Ders</th>
                        <th className="p-3.5 text-center">N (Yıl Sayısı)</th>
                        <th className="p-3.5 text-center text-purple-600">G7 Ort.</th>
                        <th className="p-3.5 text-center text-cyan-600">G6 Ort.</th>
                        <th className="p-3.5 text-center text-emerald-600">G5 Ort.</th>
                        <th className="p-3.5 text-center text-amber-600">G4 Ort.</th>
                        <th className="p-3.5 text-center text-orange-600">G3 Ort.</th>
                        <th className="p-3.5 text-center text-rose-600">G2 Ort.</th>
                        <th className="p-3.5">Durum</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {HISTORICAL_AVERAGES.map((ha, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-bold uppercase">{ha.subjectKey} {ha.level}</td>
                          <td className="p-3.5 text-center font-mono text-xs">{ha.yearsCount}</td>
                          <td className="p-3.5 text-center font-bold text-purple-600">{ha.averages ? `%${ha.averages[7]}` : '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-cyan-600">{ha.averages ? `%${ha.averages[6]}` : '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-emerald-600">{ha.averages ? `%${ha.averages[5]}` : '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-amber-600">{ha.averages ? `%${ha.averages[4]}` : '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-orange-600">{ha.averages ? `%${ha.averages[3]}` : '—'}</td>
                          <td className="p-3.5 text-center font-semibold text-rose-600">{ha.averages ? `%${ha.averages[2]}` : '—'}</td>
                          <td className="p-3.5 text-xs">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              ha.yearsCount > 0 
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                            }`}>
                              {ha.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Sources Tab */}
        {activeTab === 'sources' && (
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 shadow-sm space-y-5">
            <div>
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <BookOpen className="text-indigo-600" />
                <span>Kullanılan Veri Kaynakları & Doğrulama İndeksi (S1–S20)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                KapsCulator altyapısında kullanılan harici veri kaynakları:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(IB_DATA_SOURCES).map(([code, src]) => (
                <a
                  key={code}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 hover:border-indigo-300 dark:hover:border-indigo-700/60 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                        {code}
                      </span>
                      <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 truncate">
                        {src.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 truncate block mt-0.5 font-mono">
                      {src.url}
                    </span>
                  </div>
                  <ExternalLink size={15} className="text-slate-400 group-hover:text-indigo-600 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Summary Modal / Dialog */}
      <AnimatePresence>
        {showSummaryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-tight">KapsCulator Diploma Puan Özeti</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Genel başarı ve mezuniyet durumu</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{subjects.length} Ders Toplamı</div>
                    <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                      {totalSubjectGrade} <span className="text-xs font-normal text-slate-400">/ {subjects.length * 7}</span>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Core Points (EE/TOK)</div>
                    <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">
                      +{corePoints} <span className="text-xs font-normal text-slate-400">/ 3</span>
                    </div>
                  </div>
                </div>

                <div className={`p-4 sm:p-5 rounded-2xl border flex items-center justify-between gap-3 ${
                  isPassing 
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300' 
                    : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-700/60 text-rose-800 dark:text-rose-300'
                }`}>
                  <div>
                    <div className="font-black text-sm sm:text-base">
                      {isPassing ? 'TEBRİKLER! DİPLOMA BARAJINI GEÇTİNİZ' : 'DİPLOMA KRİTİK SEVİYEDE (<24 PUAN)'}
                    </div>
                    <div className="text-xs opacity-80 mt-0.5">
                      Toplam: {finalScore} / 45 (Geçme barajı: 24 puan)
                    </div>
                  </div>
                  <div className="text-3xl font-black shrink-0">{finalScore}</div>
                </div>

                {/* Breakdown List */}
                <div className="space-y-2 mt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ders Notu Dağılımı
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {subjects.map(sub => {
                      const calc = subjectCalculations.find(s => s.id === sub.id)!;
                      return (
                        <div key={sub.id} className="flex justify-between items-center p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-xs sm:text-sm">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{sub.name}</span>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs text-slate-400">%{calc.percentage}</span>
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-xs ${getGradeStyle(calc.grade)}`}>
                              {calc.grade}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowSummaryModal(false)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl shadow-md shadow-indigo-600/30 transition-all text-center text-sm cursor-pointer"
              >
                Kapat ve Düzenlemeye Dön
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disclaimer Modal */}
      <AnimatePresence>
        {showDisclaimerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Veri Kalitesi ve Yasal Feragatname
                  </h3>
                  <p className="text-xs text-slate-500">Third-Party Sourced / Provisional</p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 space-y-3 leading-relaxed mb-6">
                <p>
                  Bu sürümdeki not sınırları, RevisionDojo, IB Predict, Starley ve 2024–2025 resmi Grade Boundary arşiv belgeleri üzerinden derlenmiştir.
                </p>
                <p>
                  Sayfa üzerinde görünen hesaplayıcı verisi <strong>resmî IB belgesinin nihai onayı değildir</strong>. Henüz doğrulanmamış bileşen eşikleri ve beş yıllık ortalamalar kasıtlı olarak boş (<span className="font-mono font-bold">null / —</span>) bırakılmıştır.
                </p>
                <p>
                  Türkçe A derslerinde sözlü bileşeni <strong>Bireysel Sözlü (Individual Oral)</strong> olarak adlandırılmış olup Paper 2 Karşılaştırmalı Deneme bileşeni resmi ağırlıklarıyla (%35 SL, %25 HL) hesaplamaya dahildir.
                </p>
                <p>
                  2025–2026 yeni fen müfredatında (Biology, Chemistry, Physics) eski Paper 3 bileşeni yer almamaktadır; hesaplayıcı sadece <strong>Paper 1A, Paper 1B, Paper 2 ve IA</strong> bileşenlerini baz almaktadır.
                </p>
              </div>

              <button
                onClick={() => setShowDisclaimerModal(false)}
                className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold rounded-xl text-xs cursor-pointer"
              >
                Anladım
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Swap Subject Modal */}
      <AnimatePresence>
        {showAddSubjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    16 IB Dersi Kataloğundan Ders Ekle
                  </h3>
                  <p className="text-xs text-slate-500">
                    Eklemek istediğiniz dersi seçin (Listenizde mevcut olanlar pasiftir)
                  </p>
                </div>
                <button
                  onClick={() => setShowAddSubjectModal(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {ALL_IB_SUBJECTS_CATALOG.map(catSub => {
                  const alreadyAdded = subjects.some(s => s.id === catSub.id);
                  return (
                    <button
                      key={catSub.id}
                      disabled={alreadyAdded}
                      onClick={() => handleAddSubjectFromCatalog(catSub)}
                      className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        alreadyAdded 
                          ? 'opacity-40 bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                          : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 cursor-pointer shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                            catSub.level === 'HL' 
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' 
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}>
                            {catSub.level}
                          </span>
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                            {catSub.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {catSub.papers.length} Yazılı Sınav + {catSub.ia.name || 'Sözlü/IA'}
                        </span>
                      </div>
                      <Plus size={16} className={alreadyAdded ? 'text-slate-400' : 'text-indigo-600'} />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
