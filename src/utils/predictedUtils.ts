import { CourseRole } from '../types';

export interface PredictedPoolUser {
  id: number;
  userId?: number;
  username: string;
  avatar: string | null;
  color?: string;
  totalScore: number;
  averageScore: number;
  averageCore: number;
  predictedScore: number;
  predictedTotal: number;
  voteCount: number;
  rank?: number;
  calculatedRank?: number | null;
  userVotedForTarget?: boolean;
  myVoteForTarget?: any;
  highestSubject?: { courseId: string; name: string; avg: number; score: number };
  courseStats?: Record<string, any>;
  subjects?: Record<string, number>;
  roles?: CourseRole[];
}

export interface PredictedAuditVote {
  id: number;
  targetUserId: number;
  voterId: number;
  voterUsername?: string;
  voterAvatar?: string | null;
  voterColor?: string;
  scores: Record<string, number>;
  tokScore?: number;
  eeScore?: number;
  tokGrade?: string;
  eeGrade?: string;
  corePoints?: number;
  bonusPoints?: number;
  totalScore: number;
  comment?: string;
  createdAt: string;
}

export function getTargetUserCourseRoles(userOrRoles: any): CourseRole[] {
  if (!userOrRoles) return [];
  if (Array.isArray(userOrRoles)) return userOrRoles;
  return userOrRoles.roles || [];
}

export function calculateClientIBPoints(scores: Record<string, any>, tokScore: any = 0, eeScore: any = 0): {
  normalizedCourseScore: number;
  corePoints: number;
  totalScore: number;
} {
  const t = Number(tokScore) || 0;
  const e = Number(eeScore) || 0;
  let corePoints = 0;
  if (t + e >= 5) corePoints = 3;
  else if (t + e >= 3) corePoints = 2;
  else if (t + e >= 1) corePoints = 1;

  let sum = 0;
  if (scores && typeof scores === 'object') {
    for (const val of Object.values(scores)) {
      sum += Number(val) || 0;
    }
  }

  return {
    normalizedCourseScore: sum,
    corePoints,
    totalScore: sum + corePoints,
  };
}

export function getScoreBadgeStyle(score?: number): any {
  const s = score || 0;
  if (s >= 38) {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
      badgeBg: 'bg-emerald-500/20',
      badgeText: 'text-emerald-300',
      badgeBorder: 'border-emerald-500/30',
      progressColor: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      label: 'Harika',
      gradient: 'from-emerald-500 to-teal-500',
      percent: '100%',
    };
  }
  if (s >= 30) {
    return {
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/20',
      badgeBg: 'bg-blue-500/20',
      badgeText: 'text-blue-300',
      badgeBorder: 'border-blue-500/30',
      progressColor: 'bg-blue-500',
      textColor: 'text-blue-400',
      label: 'İyi',
      gradient: 'from-blue-500 to-cyan-500',
      percent: '75%',
    };
  }
  if (s >= 24) {
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-300',
      badgeBorder: 'border-amber-500/30',
      progressColor: 'bg-amber-500',
      textColor: 'text-amber-400',
      label: 'Geçer',
      gradient: 'from-amber-500 to-yellow-500',
      percent: '55%',
    };
  }
  return {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    badgeBorder: 'border-rose-500/30',
    progressColor: 'bg-rose-500',
    textColor: 'text-rose-400',
    label: 'Zayıf',
    gradient: 'from-rose-500 to-red-500',
    percent: '35%',
  };
}

export function getCourseScoreColor(score?: number): any {
  return getScoreBadgeStyle(score ? score * 6 : 0);
}

export function getCoreScoreColor(grade?: string | number | null): any {
  return getScoreBadgeStyle(35);
}
