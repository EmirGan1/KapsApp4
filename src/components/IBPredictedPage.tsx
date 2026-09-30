import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import {
  GraduationCap,
  Award,
  Crown,
  Medal,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Clock,
  UserCheck,
  Users,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import Avatar from './Avatar';
import IBGradingModal from './IBGradingModal';
import ManagePoolModal from './ManagePoolModal';
import {
  PredictedPoolUser,
  PredictedOverviewData,
  getScoreBadgeStyle,
  getTargetUserCourseRoles
} from '../utils/predictedUtils';

interface IBPredictedPageProps {
  currentUserId: number;
  username: string;
  avatar: string | null;
  color?: string;
  darkMode?: boolean;
  socket: Socket | null;
  onOpenChat?: (targetId: number) => void;
  onUserClick?: (userId: number) => void;
}

export default function IBPredictedPage({
  currentUserId,
  username,
  avatar,
  color,
  darkMode,
  socket,
  onOpenChat,
  onUserClick
}: IBPredictedPageProps) {
  const [data, setData] = useState<PredictedOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'unvoted' | 'voted'>('all');

  // Modals state
  const [selectedUserForGrading, setSelectedUserForGrading] = useState<PredictedPoolUser | null>(null);
  const [showManagePoolModal, setShowManagePoolModal] = useState<boolean>(false);

  // Fetch overview data
  const fetchOverview = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const token = localStorage.getItem('lan_token');
      const isEmirganUser = username.trim().toLowerCase() === 'emirgan';
      const res = await fetch('/api/predicted/overview', {
        headers: {
          Authorization: `Bearer ${token || ''}`,
          ...(isEmirganUser ? { 'x-username': 'emirgan' } : {})
        }
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch predicted overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [username]);

  // Initial load
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;

    const handleUpdated = () => {
      fetchOverview(true);
    };

    socket.on('predicted:updated', handleUpdated);
    socket.on('predicted:pool_updated', handleUpdated);
    socket.on('predicted:vote_submitted', handleUpdated);

    return () => {
      socket.off('predicted:updated', handleUpdated);
      socket.off('predicted:pool_updated', handleUpdated);
      socket.off('predicted:vote_submitted', handleUpdated);
    };
  }, [socket, fetchOverview]);

  // Keep selected user in modal updated with latest data
  useEffect(() => {
    if (selectedUserForGrading && data) {
      const updated = data.poolUsers.find((u) => u.userId === selectedUserForGrading.userId);
      if (updated) {
        setSelectedUserForGrading(updated);
      }
    }
  }, [data, selectedUserForGrading]);

  // Filtered members list
  const filteredUsers = useMemo(() => {
    if (!data) return [];
    let list = [...data.poolUsers];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((u) => u.username.toLowerCase().includes(q));
    }

    // Filter by vote status
    if (filterMode === 'unvoted') {
      list = list.filter((u) => !u.userVotedForTarget && u.userId !== currentUserId);
    } else if (filterMode === 'voted') {
      list = list.filter((u) => u.userVotedForTarget);
    }

    return list;
  }, [data, searchQuery, filterMode, currentUserId]);

  // Top 3 Podium Candidates (must have at least one score)
  const top3Podium = useMemo(() => {
    if (!data) return [];
    return data.poolUsers.filter((u) => u.predictedScore !== null).slice(0, 3);
  }, [data]);

  const isEmirgan = data?.isEmirgan ?? (username.trim().toLowerCase() === 'emirgan');

  // Personal Progress computation
  const progressPercent = useMemo(() => {
    if (!data || !data.myStats || data.myStats.totalInPool === 0) return 0;
    return Math.round((data.myStats.totalVotedByMe / data.myStats.totalInPool) * 100);
  }, [data]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-y-auto font-sans select-none transition-colors duration-200">
      {/* ====================================================================== */}
      {/* 1. TOP HEADER & PROGRESS HERO */}
      {/* ====================================================================== */}
      <div className="border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
              <GraduationCap size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 dark:from-amber-400 dark:to-yellow-300 bg-clip-text text-transparent">
                  IB Predicted Grade (Tahmini Diploma)
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  45 Puan Skalası
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Resmi IB kriterleriyle 6 Ders (42 Puan) + TOK & EE Core (+3 Puan) Akran Tahminleri
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {isEmirgan && (
              <button
                onClick={() => setShowManagePoolModal(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white text-xs font-black shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Crown size={15} />
                <span>Üye Havuzunu Yönet</span>
              </button>
            )}

            <button
              onClick={() => fetchOverview()}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Yenile"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin text-amber-500' : ''} />
            </button>
          </div>
        </div>

        {/* PERSONAL PROGRESS BAR */}
        {data && data.myStats && data.myStats.totalInPool > 0 && (
          <div className="max-w-6xl mx-auto mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <span>
                  Havuzdaki <strong>{data.myStats.totalInPool}</strong> kişiden{' '}
                  <strong className="text-amber-600 dark:text-amber-400">{data.myStats.totalVotedByMe}</strong>'sini puanladın
                </span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {data.myStats.remainingToVote === 0 ? (
                  <span className="text-emerald-500 font-bold">Tüm Adaylar Puanlandı! 🎉</span>
                ) : (
                  `Kalan: ${data.myStats.remainingToVote}`
                )}
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 transition-all duration-500 shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================== */}
      {/* 2. MAIN CONTENT BODY */}
      {/* ====================================================================== */}
      <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-8 flex-1">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">IB Predicted verileri yükleniyor...</span>
          </div>
        ) : !data || data.poolUsers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <GraduationCap size={32} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                Henüz Predicted Havuzunda Üye Yok
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isEmirgan
                  ? 'Yukarıdaki "Üye Havuzunu Yönet" butonuna tıklayarak sınıf veya IB grubundaki adayları ekleyin.'
                  : 'Yönetici henüz Predicted listesine aday eklememiş.'}
              </p>
            </div>
            {isEmirgan && (
              <button
                onClick={() => setShowManagePoolModal(true)}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Crown size={15} />
                <span>Aday Ekle</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ====================================================================== */}
            {/* 3. TOP 3 PODIUM CARDS (PODYUM KARTLARI) */}
            {/* ====================================================================== */}
            {top3Podium.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrophyIcon className="text-amber-500" />
                    <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Zirvedeki Tahminler (Top 3 Podyum)
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">45 Puan Üzerinden</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  {/* #2 SILVER (2. Sıra) */}
                  {top3Podium[1] && (
                    <PodiumCard
                      user={top3Podium[1]}
                      rank={2}
                      currentUserId={currentUserId}
                      onSelect={() => setSelectedUserForGrading(top3Podium[1])}
                    />
                  )}

                  {/* #1 GOLD (1. Sıra - Elevated) */}
                  {top3Podium[0] && (
                    <PodiumCard
                      user={top3Podium[0]}
                      rank={1}
                      currentUserId={currentUserId}
                      onSelect={() => setSelectedUserForGrading(top3Podium[0])}
                      elevated
                    />
                  )}

                  {/* #3 BRONZE (3. Sıra) */}
                  {top3Podium[2] && (
                    <PodiumCard
                      user={top3Podium[2]}
                      rank={3}
                      currentUserId={currentUserId}
                      onSelect={() => setSelectedUserForGrading(top3Podium[2])}
                    />
                  )}
                </div>
              </section>
            )}

            {/* ====================================================================== */}
            {/* 4. FULL RANKED LEADERBOARD & MEMBER CARDS GRID */}
            {/* ====================================================================== */}
            <section className="space-y-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-blue-500" />
                  <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                    Tüm IB Adayları ve Sıralama Tablosu
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {filteredUsers.length} Aday
                  </span>
                </div>

                {/* Filter & Search Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Search */}
                  <div className="relative flex-1 sm:w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Aday ara..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Filter tabs */}
                  <div className="flex p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 text-[11px] font-bold">
                    <button
                      onClick={() => setFilterMode('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterMode === 'all'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Tümü
                    </button>
                    <button
                      onClick={() => setFilterMode('unvoted')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterMode === 'unvoted'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Puanlamadıklarım
                    </button>
                    <button
                      onClick={() => setFilterMode('voted')}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterMode === 'voted'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      Puanladıklarım
                    </button>
                  </div>
                </div>
              </div>

              {/* CARDS GRID */}
              {filteredUsers.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  Filtreye uygun IB adayı bulunamadı.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredUsers.map((user) => {
                    const isSelf = user.userId === currentUserId;
                    const style = getScoreBadgeStyle(user.predictedScore);
                    const courseRoles = getTargetUserCourseRoles(user.roles);

                    return (
                      <div
                        key={user.userId}
                        onClick={() => setSelectedUserForGrading(user)}
                        className={`p-4 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group hover:shadow-xl hover:scale-[1.01] ${
                          isSelf
                            ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                            : 'bg-white dark:bg-slate-900/80 border-slate-200/80 dark:border-slate-800 hover:border-amber-400/50 dark:hover:border-amber-500/40'
                        }`}
                      >
                        {/* CARD TOP INFO */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative">
                              <Avatar
                                url={user.avatar}
                                name={user.username}
                                color={user.color}
                                size={10}
                                className="ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-amber-400 transition-colors"
                              />
                              {user.rank && (
                                <span
                                  className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full flex items-center justify-center font-mono font-black text-[9px] shadow-sm ${
                                    user.rank === 1
                                      ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-300'
                                      : user.rank === 2
                                      ? 'bg-slate-300 text-slate-900 ring-2 ring-slate-200'
                                      : user.rank === 3
                                      ? 'bg-amber-700 text-amber-100 ring-2 ring-amber-600'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {user.rank}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                  {user.username}
                                </span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400">
                                    Siz
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Users size={11} />
                                <span>{user.voteCount} Değerlendirme</span>
                              </span>
                            </div>
                          </div>

                          {/* SCORE PILL */}
                          <div className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black border ${style.badgeBg} ${style.badgeText} ${style.badgeBorder} shrink-0`}>
                            {user.predictedScore !== null ? `${user.predictedScore.toFixed(1)} / 45` : '- / 45'}
                          </div>
                        </div>

                        {/* IB COURSES BADGES ROW */}
                        <div className="flex flex-wrap items-center gap-1 py-1">
                          {courseRoles.slice(0, 4).map((c) => (
                            <span
                              key={c.id}
                              className="px-1.5 py-0.5 rounded-md text-[9px] font-bold truncate max-w-[110px]"
                              style={{
                                backgroundColor: `${c.color || '#3b82f6'}15`,
                                color: c.color || '#3b82f6',
                                borderColor: `${c.color || '#3b82f6'}30`,
                                borderWidth: '1px'
                              }}
                            >
                              {c.label || c.name}
                            </span>
                          ))}
                          {courseRoles.length > 4 && (
                            <span className="text-[9px] text-slate-400 font-bold">
                              +{courseRoles.length - 4}
                            </span>
                          )}
                        </div>

                        {/* PROGRESS BAR OUT OF 45 */}
                        <div className="space-y-1">
                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${style.progressColor}`}
                              style={{ width: `${user.predictedScore ? (user.predictedScore / 45) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* CARD FOOTER CTA */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          {isSelf ? (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <GraduationCap size={13} />
                              <span>Karnenizi İnceleyin</span>
                            </span>
                          ) : user.userVotedForTarget ? (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>Puanlandı ({user.myVoteForTarget?.totalScore || '-'} / 45)</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:underline">
                              <Clock size={13} />
                              <span>⏳ Tahmin Gir</span>
                            </span>
                          )}

                          <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ====================================================================== */}
      {/* 5. MODALS */}
      {/* ====================================================================== */}
      {selectedUserForGrading && (
        <IBGradingModal
          targetUser={selectedUserForGrading}
          currentUserId={currentUserId}
          isEmirgan={isEmirgan}
          onClose={() => setSelectedUserForGrading(null)}
          onVoteSubmitted={() => {
            setSelectedUserForGrading(null);
            fetchOverview(true);
          }}
          onVoteDeleted={() => {
            fetchOverview(true);
          }}
        />
      )}

      {showManagePoolModal && (
        <ManagePoolModal
          currentPoolUsers={data?.poolUsers || []}
          onClose={() => setShowManagePoolModal(false)}
          onPoolChanged={() => fetchOverview(true)}
        />
      )}
    </div>
  );
}

// ======================================================================
// PODIUM COMPONENT (GOLD, SILVER, BRONZE)
// ======================================================================
function PodiumCard({
  user,
  rank,
  currentUserId,
  onSelect,
  elevated
}: {
  user: PredictedPoolUser;
  rank: 1 | 2 | 3;
  currentUserId: number;
  onSelect: () => void;
  elevated?: boolean;
}) {
  const isSelf = user.userId === currentUserId;
  const courseRoles = getTargetUserCourseRoles(user.roles);

  const config = {
    1: {
      title: '1. SIRA (ZİRVE)',
      border: 'border-amber-400/80 dark:border-amber-500/80',
      bg: 'bg-gradient-to-b from-amber-500/15 via-yellow-500/5 to-transparent bg-white dark:bg-slate-900',
      badgeBg: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 font-black',
      scoreText: 'text-amber-500 dark:text-amber-400',
      crownColor: 'text-amber-400',
      ringColor: 'ring-4 ring-amber-400/40'
    },
    2: {
      title: '2. SIRA (GÜMÜŞ)',
      border: 'border-slate-300 dark:border-slate-700',
      bg: 'bg-gradient-to-b from-slate-400/10 to-transparent bg-white dark:bg-slate-900',
      badgeBg: 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold',
      scoreText: 'text-slate-700 dark:text-slate-200',
      crownColor: 'text-slate-400',
      ringColor: 'ring-3 ring-slate-300/40'
    },
    3: {
      title: '3. SIRA (BRONZ)',
      border: 'border-amber-700/40 dark:border-amber-800/40',
      bg: 'bg-gradient-to-b from-amber-800/10 to-transparent bg-white dark:bg-slate-900',
      badgeBg: 'bg-amber-800/20 text-amber-700 dark:text-amber-400 border border-amber-700/30 font-bold',
      scoreText: 'text-amber-700 dark:text-amber-400',
      crownColor: 'text-amber-700',
      ringColor: 'ring-3 ring-amber-700/40'
    }
  }[rank];

  return (
    <div
      onClick={onSelect}
      className={`p-5 rounded-3xl border shadow-xl flex flex-col items-center text-center cursor-pointer transition-all duration-300 hover:scale-[1.02] group ${config.border} ${config.bg} ${
        elevated ? 'md:-translate-y-2 md:shadow-2xl shadow-amber-500/10' : ''
      }`}
    >
      {/* Rank Icon & Badge */}
      <div className="flex items-center gap-1.5 mb-3">
        {rank === 1 ? (
          <Crown className={config.crownColor} size={20} />
        ) : (
          <Medal className={config.crownColor} size={18} />
        )}
        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-mono ${config.badgeBg}`}>
          {config.title}
        </span>
      </div>

      {/* Avatar */}
      <div className="relative mb-3">
        <Avatar
          url={user.avatar}
          name={user.username}
          color={user.color}
          size={elevated ? 14 : 11}
          className={`${config.ringColor} shadow-lg`}
        />
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-slate-900 text-white border border-slate-700">
          #{rank}
        </span>
      </div>

      {/* User Name */}
      <h3 className="font-extrabold text-base text-slate-900 dark:text-white truncate max-w-[200px] mb-1">
        {user.username}
      </h3>

      {/* Score */}
      <div className="my-1">
        <span className={`text-3xl sm:text-4xl font-black font-mono tracking-tight ${config.scoreText}`}>
          {user.predictedScore ? user.predictedScore.toFixed(1) : '-'}
        </span>
        <span className="text-xs text-slate-400 font-bold ml-1">/ 45</span>
      </div>

      <span className="text-[11px] text-slate-400 font-medium">
        {user.voteCount} Değerlendirme • Core: +{user.averageCore.toFixed(1)}
      </span>

      {/* Best subject badge */}
      {user.highestSubject && (
        <div className="mt-2.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 flex items-center gap-1">
          <TrendingUp size={11} className="text-emerald-500" />
          <span>Zirve Ders: {user.highestSubject.courseId.toUpperCase()} ({user.highestSubject.avg})</span>
        </div>
      )}

      {/* Action Button */}
      <button className="mt-4 w-full py-2 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black group-hover:bg-amber-500 dark:group-hover:bg-amber-400 dark:group-hover:text-slate-950 transition-colors">
        {isSelf
          ? 'Karneniz'
          : user.userVotedForTarget
          ? 'Puanlandı ✅'
          : 'Puanla ⏳'}
      </button>
    </div>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className || ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
