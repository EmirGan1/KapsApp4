import React, { useState, useMemo } from 'react';
import {
  X,
  GraduationCap,
  Award,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Info,
  Sparkles,
  BookOpen,
  Calendar,
  Lock,
  ShieldAlert
} from 'lucide-react';
import Avatar from './Avatar';
import { CourseRole } from '../types';
import {
  PredictedPoolUser,
  PredictedAuditVote,
  getTargetUserCourseRoles,
  calculateClientIBPoints,
  getScoreBadgeStyle,
  getCourseScoreColor,
  getCoreScoreColor
} from '../utils/predictedUtils';

interface IBGradingModalProps {
  targetUser: PredictedPoolUser;
  currentUserId: number;
  currentUsername?: string;
  isEmirgan: boolean;
  onClose: () => void;
  onVoteSubmitted: () => void;
  onVoteDeleted?: () => void;
}

export default function IBGradingModal({
  targetUser,
  currentUserId,
  currentUsername,
  isEmirgan,
  onClose,
  onVoteSubmitted,
  onVoteDeleted
}: IBGradingModalProps) {
  const isSelf =
    targetUser.userId === currentUserId ||
    (!!currentUsername && targetUser.username.trim().toLowerCase() === currentUsername.trim().toLowerCase());
  const isAlreadyVoted = !!targetUser.userVotedForTarget;

  // Active Tab for Emirgan (Grading vs Audit)
  const [activeTab, setActiveTab] = useState<'grade' | 'audit'>('grade');

  // Candidate course roles
  const targetCourses: CourseRole[] = useMemo(() => {
    return getTargetUserCourseRoles(targetUser.roles);
  }, [targetUser.roles]);

  // Initial grading state
  const [courseScores, setCourseScores] = useState<{ [courseId: string]: number }>(() => {
    if (targetUser.myVoteForTarget?.courseScores) {
      return targetUser.myVoteForTarget.courseScores;
    }
    const initial: { [courseId: string]: number } = {};
    targetCourses.forEach((c) => {
      initial[c.id] = 5; // Default sensible 5
    });
    return initial;
  });

  const [tokGrade, setTokGrade] = useState<string>(() => {
    return targetUser.myVoteForTarget?.tokGrade || 'B';
  });

  const [eeGrade, setEeGrade] = useState<string>(() => {
    return targetUser.myVoteForTarget?.eeGrade || 'B';
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Audit state (Emirgan view)
  const [auditVotes, setAuditVotes] = useState<PredictedAuditVote[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [deletingVoteId, setDeletingVoteId] = useState<number | null>(null);

  // Live points computation
  const liveCalculation = useMemo(() => {
    return calculateClientIBPoints(courseScores, tokGrade, eeGrade);
  }, [courseScores, tokGrade, eeGrade]);

  // Load audit votes if emirgan switches to audit tab
  const fetchAuditVotes = async () => {
    setLoadingAudit(true);
    try {
      const token = localStorage.getItem('lan_token');
      const res = await fetch(`/api/predicted/audit/${targetUser.userId}`, {
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'x-username': 'emirgan'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditVotes(data);
      }
    } catch (e) {
      console.error('Audit fetch error:', e);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleTabChange = (tab: 'grade' | 'audit') => {
    setActiveTab(tab);
    if (tab === 'audit' && auditVotes.length === 0) {
      fetchAuditVotes();
    }
  };

  // Submit vote
  const handleSubmitVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSelf || isAlreadyVoted) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const token = localStorage.getItem('lan_token');
      const res = await fetch('/api/predicted/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          targetUserId: targetUser.userId,
          courseScores,
          tokGrade,
          eeGrade
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Puanlama gönderilemedi.');
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        onVoteSubmitted();
      }, 1000);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Emirgan delete a vote
  const handleDeleteVote = async (voteId: number) => {
    if (!window.confirm('Bu kullanıcının verdiği tahmini puanı silmek istediğinize emin misiniz?')) {
      return;
    }

    setDeletingVoteId(voteId);
    try {
      const token = localStorage.getItem('lan_token');
      const res = await fetch(`/api/predicted/vote/${voteId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'x-username': 'emirgan'
        }
      });

      if (res.ok) {
        setAuditVotes((prev) => prev.filter((v) => v.id !== voteId));
        if (onVoteDeleted) onVoteDeleted();
      } else {
        const d = await res.json();
        alert(d.error || 'Oy silinemedi.');
      }
    } catch (e) {
      alert('İşlem başarısız.');
    } finally {
      setDeletingVoteId(null);
    }
  };

  const scoreStyle = getScoreBadgeStyle(targetUser.predictedScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in select-none">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 animate-in zoom-in-95"
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar 
              url={targetUser.avatar} 
              name={targetUser.username} 
              color={targetUser.color} 
              size={11} 
              className="ring-2 ring-amber-500/30"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white truncate">
                  {targetUser.username}
                </h3>
                {isSelf && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                    Siz
                  </span>
                )}
                {targetUser.rank && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                    #{targetUser.rank}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <GraduationCap size={13} className="text-amber-500" />
                <span>IB Predicted Akran Değerlendirmesi</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Score Badge */}
            <div className={`px-2.5 py-1 rounded-xl text-xs font-black font-mono border ${scoreStyle.badgeBg} ${scoreStyle.badgeText} ${scoreStyle.badgeBorder} shrink-0`}>
              {scoreStyle.text}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ================= EMİRGAN TAB SWITCHER ================= */}
        {isEmirgan && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-950/40 px-5 pt-2 gap-2 text-xs font-bold shrink-0">
            <button
              onClick={() => handleTabChange('grade')}
              className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'grade'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Award size={14} />
              <span>{isSelf ? 'Karneniz' : isAlreadyVoted ? 'Girdiğiniz Tahmin' : 'Tahmin Girişi'}</span>
            </button>
            <button
              onClick={() => handleTabChange('audit')}
              className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <ShieldAlert size={14} className="text-indigo-500" />
              <span>🛡️ Denetim: Kim Kaç Verdi? ({targetUser.voteCount})</span>
            </button>
          </div>
        )}

        {/* ================= MODAL BODY ================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: GRADING / REPORT CARD VIEW */}
          {activeTab === 'grade' && (
            isSelf ? (
              /* KİŞİSEL IB TAHMİN KARNEM (Puanlama araçları tamamen kaldırılmış renk skalalı görünüm) */
              <div className="space-y-6">
                {/* 1. ÜST ÖZET ALANI (Top Summary Card) */}
                <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-850 to-indigo-950 text-white border border-slate-800 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="text-amber-400" size={22} />
                        <h3 className="font-extrabold text-base sm:text-lg text-white">
                          Kişisel IB Tahmin Karnem
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {targetUser.voteCount} Oy Alındı
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 max-w-md">
                        Sınıf / IB akranlarınızın sizin için girdiği ders ve diploma tahminlerinin ağırlıklı ortalamasıdır.
                      </p>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div className="flex items-baseline gap-1 sm:justify-end">
                        <span className="text-3xl sm:text-4xl font-black font-mono text-amber-400">
                          {targetUser.predictedScore !== null ? targetUser.predictedScore.toFixed(1) : '-'}
                        </span>
                        <span className="text-sm font-bold text-slate-400 font-mono">/ 45 Puan</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-300 block mt-0.5">
                        {targetUser.voteCount === 0 ? 'Henüz değerlendirilmedi' : targetUser.predictedScore && targetUser.predictedScore >= 38 ? 'Zirve Başarı 🌟' : 'Diploma Tahmini 🎯'}
                      </span>
                    </div>
                  </div>

                  {/* 45'lik Genel Renkli İlerleme Çubuğu */}
                  <div className="mt-5 relative z-10 space-y-1.5">
                    <div className="flex justify-between items-center text-[11px] font-mono font-bold text-slate-300">
                      <span>Genel Diploma İlerlemesi</span>
                      <span>
                        {targetUser.predictedScore !== null 
                          ? `%${Math.min(100, Math.round((targetUser.predictedScore / 45) * 100))}` 
                          : '%0'}
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-800/90 border border-slate-700/60 p-0.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-700 shadow-sm"
                        style={{
                          width: targetUser.predictedScore !== null
                            ? `${Math.min(100, Math.max(0, (targetUser.predictedScore / 45) * 100))}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. DERS BAZLI RENK SKALASI (Color-Coded Scale Bar) */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <BookOpen size={16} className="text-blue-500" />
                      <span>Ders Bazlı Akran Ortalamaları (1 - 7 Skalası)</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {targetCourses.length} Ders
                    </span>
                  </div>

                  {/* Renk Skalası Lejantı */}
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-[10px] font-bold">
                    <span className="text-slate-400 uppercase tracking-wider mr-1">Renk Skalası:</span>
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> 6.0 – 7.0 (Çok Yüksek)
                    </span>
                    <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                      <span className="w-2 h-2 rounded-full bg-sky-500" /> 5.0 – 5.9 (İyi)
                    </span>
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> 4.0 – 4.9 (Orta)
                    </span>
                    <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> 1.0 – 3.9 (Düşük)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {targetCourses.map((course) => {
                      const stats = targetUser.courseStats?.[course.id];
                      const hasScore = stats && stats.count > 0;
                      const avgScore = hasScore ? stats.avg : null;
                      const colorMeta = getCourseScoreColor(avgScore);

                      return (
                        <div
                          key={course.id}
                          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: course.color || '#3b82f6' }}
                              />
                              <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                                {course.label || course.name}
                              </span>
                              {course.level && (
                                <span
                                  className="px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0"
                                  style={{
                                    backgroundColor: `${course.color || '#3b82f6'}20`,
                                    color: course.color || '#3b82f6'
                                  }}
                                >
                                  {course.level}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${colorMeta.badgeBg} ${colorMeta.textColor} ${colorMeta.badgeBorder}`}>
                                {colorMeta.label}
                              </span>
                              <div className="text-right">
                                {hasScore ? (
                                  <span className="font-black font-mono text-sm sm:text-base text-slate-900 dark:text-white">
                                    <span className={colorMeta.textColor}>{avgScore?.toFixed(1)}</span>
                                    <span className="text-xs text-slate-400 font-normal"> / 7.0</span>
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 font-medium">
                                    Henüz değerlendirilmedi (- / 7)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar with Dynamic Color Scale */}
                          <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-gradient-to-r ${colorMeta.gradient} transition-all duration-500`}
                              style={{ width: `${colorMeta.percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. TOK & EE (CORE) ORTALAMASI */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 via-slate-50 to-blue-50/60 dark:from-indigo-950/20 dark:via-slate-900 dark:to-blue-950/20 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Award className="text-indigo-500" size={18} />
                      <div>
                        <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                          TOK & EE (Core) Bonus Ortalaması
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Resmi IB Diploma Matrisinden (+3 Puan) Akran Ortalaması
                        </p>
                      </div>
                    </div>

                    <div>
                      {targetUser.voteCount > 0 ? (
                        <div className="text-right">
                          <span className="font-black font-mono text-base sm:text-lg text-indigo-600 dark:text-indigo-400">
                            +{targetUser.averageCore.toFixed(1)}
                          </span>
                          <span className="text-xs text-slate-400 font-normal ml-1">/ 3.0 Puan</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">
                          Henüz değerlendirilmedi (- / 3)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Core Progress Bar */}
                  {(() => {
                    const coreMeta = getCoreScoreColor(targetUser.voteCount > 0 ? targetUser.averageCore : null);
                    return (
                      <div className="space-y-1.5">
                        <div className="w-full h-2.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${coreMeta.gradient} transition-all duration-500`}
                            style={{ width: `${coreMeta.percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                          <span>0 Bonus</span>
                          <span className={`${coreMeta.textColor} font-bold`}>{coreMeta.label}</span>
                          <span>+3 Bonus Puan</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              /* DİĞER KULLANICILAR İÇİN PUANLAMA FORMU (VEYA GÖNDERİLMİŞ OY ÖZETİ) */
              <>
                {/* STATUS BANNER */}
                {isAlreadyVoted ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-700 dark:text-emerald-300 text-xs">
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold mb-0.5">Bu Kullanıcıyı Zaten Puanladınız</strong>
                      Her aday için yalnızca 1 kez tahmin gönderilebilir. Aşağıda bu kullanıcı için verdiğiniz puanlar ve adayın güncel sınıf ortalaması listelenmiştir.
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
                    <span className="flex items-center gap-2">
                      <Sparkles size={15} className="text-amber-500 animate-pulse" />
                      <strong>Resmi IB 45 Puan Motoru:</strong> 6 Ders (42 Puan) + TOK & EE Bonus (3 Puan)
                    </span>
                    <span className="text-[10px] font-mono opacity-80">1 Oy Hakkı</span>
                  </div>
                )}

                {/* OVERALL CANDIDATE STATS OVERVIEW */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Genel Ortalama</span>
                    <span className="text-lg sm:text-xl font-black text-amber-500 font-mono mt-0.5 block">
                      {targetUser.predictedScore ? `${targetUser.predictedScore.toFixed(1)}` : '-'}
                      <span className="text-xs text-slate-400 font-normal"> / 45</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Değerlendirme</span>
                    <span className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5 block">
                      {targetUser.voteCount} <span className="text-xs text-slate-400 font-normal">Oy</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Core Ortalaması</span>
                    <span className="text-lg sm:text-xl font-black text-teal-500 font-mono mt-0.5 block">
                      {targetUser.voteCount > 0 ? `+${targetUser.averageCore.toFixed(1)}` : '-'}
                      <span className="text-xs text-slate-400 font-normal"> / 3</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">En Güçlü Ders</span>
                    <span className="text-xs sm:text-sm font-bold text-indigo-500 truncate mt-1 block">
                      {targetUser.highestSubject ? (
                        `${targetUser.highestSubject.courseId.toUpperCase()} (${targetUser.highestSubject.avg})`
                      ) : (
                        'Henüz Yok'
                      )}
                    </span>
                  </div>
                </div>

                {/* FORM: IB COURSES EVALUATION (1-7 GRADES) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <BookOpen size={16} className="text-blue-500" />
                      <span>Ders Puanları (1 - 7 Not Skalası)</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {targetCourses.length} Ders Algılandı {targetCourses.length !== 6 ? '(42 Puan Tabanına Normalize Edilir)' : ''}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {targetCourses.map((course) => {
                      const currentScore = courseScores[course.id] || 5;
                      const averageSubjectScore = targetUser.courseStats?.[course.id]?.avg;

                      return (
                        <div
                          key={course.id}
                          className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: course.color || '#3b82f6' }}
                            />
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {course.label || course.name}
                            </span>
                            {course.level && (
                              <span 
                                className="px-1.5 py-0.5 rounded text-[10px] font-black shrink-0"
                                style={{ 
                                  backgroundColor: `${course.color || '#3b82f6'}20`,
                                  color: course.color || '#3b82f6'
                                }}
                              >
                                {course.level}
                              </span>
                            )}
                            {averageSubjectScore !== undefined && (
                              <span className="text-[11px] text-slate-400 font-mono ml-auto sm:ml-2">
                                (Ort: <strong className="text-amber-500 font-bold">{averageSubjectScore}</strong>)
                              </span>
                            )}
                          </div>

                          {/* Grade Buttons 1-7 */}
                          <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                            {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                              const isSelected = currentScore === num;
                              const isUserDisabled = isAlreadyVoted;

                              return (
                                <button
                                  key={num}
                                  type="button"
                                  disabled={isUserDisabled}
                                  onClick={() => {
                                    if (isUserDisabled) return;
                                    setCourseScores((prev) => ({
                                      ...prev,
                                      [course.id]: num
                                    }));
                                  }}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-mono font-black text-xs transition-all flex items-center justify-center ${
                                    isSelected
                                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500'
                                  } ${isUserDisabled ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
                                >
                                  {num}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CORE BONUS POINTS: TOK & EXTENDED ESSAY (A - E) */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-slate-50 to-blue-50/50 dark:from-indigo-950/20 dark:via-slate-850 dark:to-blue-950/20 border border-indigo-200/60 dark:border-indigo-900/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Award size={16} className="text-indigo-500" />
                      <h4 className="font-black text-xs sm:text-sm text-slate-900 dark:text-white uppercase tracking-wider">
                        IB Core: TOK & Extended Essay (+3 Bonus)
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-xs font-black font-mono">
                      +{liveCalculation.corePoints} Bonus Puan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* TOK Grade Picker */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span>TOK (Theory of Knowledge)</span>
                        <span className="font-mono text-indigo-500 font-black">{tokGrade}</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                          const isSelected = tokGrade === letter;
                          const isUserDisabled = isAlreadyVoted;
                          return (
                            <button
                              key={letter}
                              type="button"
                              disabled={isUserDisabled}
                              onClick={() => !isUserDisabled && setTokGrade(letter)}
                              className={`flex-1 py-1.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                              } ${isUserDisabled ? 'cursor-default opacity-85' : 'active:scale-95'}`}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* EE Grade Picker */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <span>EE (Extended Essay)</span>
                        <span className="font-mono text-indigo-500 font-black">{eeGrade}</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        {['A', 'B', 'C', 'D', 'E'].map((letter) => {
                          const isSelected = eeGrade === letter;
                          const isUserDisabled = isAlreadyVoted;
                          return (
                            <button
                              key={letter}
                              type="button"
                              disabled={isUserDisabled}
                              onClick={() => !isUserDisabled && setEeGrade(letter)}
                              className={`flex-1 py-1.5 sm:py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 scale-105'
                                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                              } ${isUserDisabled ? 'cursor-default opacity-85' : 'active:scale-95'}`}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Matrix Explanation Note */}
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Resmi IB Kuralı:</span>
                    <span>A+A, A+B (3 Puan) • B+B, A+C (2 Puan) • C+C, B+D (1 Puan) • Herhangi biri E ise 0 Puan</span>
                  </div>
                </div>

                {/* LIVE CALCULATION BANNER */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-lg shrink-0">
                      45
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {isAlreadyVoted ? 'Gönderdiğiniz Tahmin' : 'Canlı Tahmin Hesaplaması'}
                      </span>
                      <div className="text-sm sm:text-base font-extrabold text-white">
                        Dersler: <strong className="text-blue-400">{liveCalculation.normalizedCourseScore}</strong> / 42 + Core:{' '}
                        <strong className="text-teal-400">+{liveCalculation.corePoints}</strong> / 3
                      </div>
                    </div>
                  </div>

                  <div className="text-center sm:text-right">
                    <span className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
                      {liveCalculation.totalScore}
                    </span>
                    <span className="text-xs text-slate-400 font-bold ml-1">/ 45 Puan</span>
                  </div>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} />
                    <span>{submitError}</span>
                  </div>
                )}

                {submitSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 size={15} />
                    <span>Tahmin başarıyla kaydedildi! Sayfa güncelleniyor...</span>
                  </div>
                )}
              </>
            )
          )}

          {/* TAB 2: EMİRGAN AUDIT VIEW */}
          {activeTab === 'audit' && isEmirgan && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldAlert size={16} className="text-indigo-500" />
                    <span>Emirgan Denetim: Kullanıcıya Verilen Oylar</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Troll veya haksız düşük oyları silebilirsiniz. Silinen oylar ortalamayı anında yeniler.
                  </p>
                </div>
                <button
                  onClick={fetchAuditVotes}
                  disabled={loadingAudit}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  {loadingAudit ? 'Yenileniyor...' : 'Yenile'}
                </button>
              </div>

              {loadingAudit ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Oylar yükleniyor...
                </div>
              ) : auditVotes.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Bu kullanıcıya henüz hiç oy verilmemiş.
                </div>
              ) : (
                <div className="space-y-3">
                  {auditVotes.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          url={v.voterAvatar}
                          name={v.voterUsername}
                          color={v.voterColor}
                          size={9}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {v.voterUsername}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({new Date(v.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })})
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>TOK: <strong>{v.tokGrade}</strong></span>
                            <span>•</span>
                            <span>EE: <strong>{v.eeGrade}</strong></span>
                            <span>•</span>
                            <span>Core: <strong>+{v.corePoints}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <span className="text-lg font-black font-mono text-amber-500">
                            {v.totalScore}
                          </span>
                          <span className="text-[11px] text-slate-400"> / 45</span>
                        </div>

                        <button
                          onClick={() => handleDeleteVote(v.id)}
                          disabled={deletingVoteId === v.id}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer"
                          title="Bu oyu sil ve ortalamayı yeniden hesapla"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Kapat
          </button>

          {!isSelf && !isAlreadyVoted && activeTab === 'grade' && (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitVote}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-white text-xs font-black shadow-lg shadow-amber-500/25 transition-all cursor-pointer flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Tahmini Kaydet ({liveCalculation.totalScore} / 45)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
