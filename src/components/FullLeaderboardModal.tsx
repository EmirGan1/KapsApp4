import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Trophy,
  Award,
  Crown,
  ChevronRight,
  TrendingUp,
  Sparkles,
  Users
} from 'lucide-react';
import Avatar from './Avatar';
import {
  PredictedPoolUser,
  getScoreBadgeStyle,
  getTargetUserCourseRoles
} from '../utils/predictedUtils';

interface FullLeaderboardModalProps {
  poolUsers: PredictedPoolUser[];
  currentUserId: number;
  currentUsername: string;
  onClose: () => void;
  onSelectUser: (user: PredictedPoolUser) => void;
}

export default function FullLeaderboardModal({
  poolUsers,
  currentUserId,
  currentUsername,
  onClose,
  onSelectUser
}: FullLeaderboardModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Ranked pool users (maintaining official rank calculation)
  const rankedUsers = useMemo(() => {
    let currentRank = 1;
    return poolUsers.map((user, idx) => {
      if (idx > 0) {
        const prev = poolUsers[idx - 1];
        if (
          user.predictedScore !== null &&
          prev.predictedScore !== null &&
          user.predictedScore === prev.predictedScore
        ) {
          // tie in score
        } else {
          currentRank = idx + 1;
        }
      }
      return {
        ...user,
        calculatedRank: user.predictedScore !== null ? currentRank : null
      };
    });
  }, [poolUsers]);

  // Filtered by search query
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rankedUsers;
    return rankedUsers.filter((u) => u.username.toLowerCase().includes(q));
  }, [rankedUsers, searchQuery]);

  // Top score in pool
  const topScore = poolUsers.length > 0 && poolUsers[0].predictedScore !== null
    ? poolUsers[0].predictedScore.toFixed(1)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* ================= MODAL HEADER ================= */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 shrink-0">
              <Trophy size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                  IB Predicted Tam Sıralama Tablosu
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                  {poolUsers.length} Aday
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Resmi IB 45 Puan üzerinden tüm adayların canlı sıralaması
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            title="Kapat (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* ================= SEARCH & TOOLBAR ================= */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Aday ara (kullanıcı adı)..."
              className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>

          {topScore && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-700 dark:text-amber-300 font-bold shrink-0 self-end sm:self-auto">
              <Sparkles size={14} className="text-amber-500" />
              <span>Zirve Tahmin:</span>
              <span className="font-black font-mono text-amber-600 dark:text-amber-400">{topScore} / 45</span>
            </div>
          )}
        </div>

        {/* ================= FULL RANKINGS LIST ================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 space-y-2">
              <Users size={32} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium">Aramanıza uygun aday bulunamadı.</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelf =
                user.userId === currentUserId ||
                (!!currentUsername && user.username.trim().toLowerCase() === currentUsername.trim().toLowerCase());
              const style = getScoreBadgeStyle(user.predictedScore);
              const rank = user.calculatedRank;
              const courseRoles = getTargetUserCourseRoles(user.roles);

              return (
                <div
                  key={user.userId}
                  onClick={() => {
                    onClose();
                    onSelectUser(user);
                  }}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                    isSelf
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-800/80 shadow-xs'
                      : rank === 1
                      ? 'bg-gradient-to-r from-amber-50/30 to-white dark:from-amber-950/20 dark:to-slate-900 border-amber-300/60 dark:border-amber-800/50'
                      : 'bg-white dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm'
                  }`}
                >
                  {/* Left: Rank + Avatar + Name + Subtext */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Badge */}
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs shrink-0">
                      {rank === 1 ? (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/30 font-black">
                          <Crown size={14} className="mr-0.5" />
                          <span>1</span>
                        </div>
                      ) : rank === 2 ? (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 flex items-center justify-center shadow-sm font-black">
                          <span>2</span>
                        </div>
                      ) : rank === 3 ? (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center shadow-sm font-black">
                          <span>3</span>
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold border border-slate-200/60 dark:border-slate-700/60">
                          {rank ? `#${rank}` : '-'}
                        </div>
                      )}
                    </div>

                    {/* Avatar with Status Ring */}
                    <div className="relative shrink-0">
                      <Avatar
                        url={user.avatar}
                        name={user.username}
                        color={user.color}
                        size={10}
                      />
                    </div>

                    {/* Name + Meta */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                          {user.username}
                        </span>
                        {isSelf && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500 text-white">
                            Siz
                          </span>
                        )}
                        {user.userVotedForTarget && !isSelf && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                            ✓ Puanladınız
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                        <span>{user.voteCount} Oy</span>
                        <span>•</span>
                        <span>Core: +{user.averageCore.toFixed(1)}</span>
                        {user.highestSubject && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-500 font-semibold flex items-center gap-0.5">
                              <TrendingUp size={10} />
                              {user.highestSubject.courseId.toUpperCase()} ({user.highestSubject.avg})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Score Display + Progress Bar + Action Button */}
                  <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-800">
                    <div className="w-28 sm:w-36 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-black font-mono text-slate-900 dark:text-white">
                          {user.predictedScore !== null ? user.predictedScore.toFixed(1) : '-'}
                          <span className="text-[10px] text-slate-400 font-normal"> / 45</span>
                        </span>
                        <span className={`text-[10px] font-bold ${style.badgeText}`}>
                          {user.predictedScore ? `%${Math.round((user.predictedScore / 45) * 100)}` : '%0'}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${style.progressColor}`}
                          style={{
                            width: user.predictedScore
                              ? `${Math.min(100, Math.max(0, (user.predictedScore / 45) * 100))}%`
                              : '0%'
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black group-hover:bg-amber-500 dark:group-hover:bg-amber-400 dark:group-hover:text-slate-950 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>
                        {isSelf
                          ? 'Karneniz'
                          : user.userVotedForTarget
                          ? 'İncele'
                          : 'Puanla'}
                      </span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ================= MODAL FOOTER ================= */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
          <span>Toplam {poolUsers.length} IB adayı listelendi</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
