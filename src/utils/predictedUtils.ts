import { COURSE_ROLES, CourseRole } from '../types';

export interface PredictedPoolUser {
  userId: number;
  username: string;
  avatar: string | null;
  color?: string;
  roles: string[];
  predictedScore: number | null;
  voteCount: number;
  averageCore: number;
  courseStats: { [courseId: string]: { sum: number; count: number; avg: number } };
  highestSubject: { courseId: string; avg: number } | null;
  userVotedForTarget: boolean;
  myVoteForTarget?: {
    id: number;
    totalScore: number;
    corePoints: number;
    tokGrade: string;
    eeGrade: string;
    courseScores: { [courseId: string]: number };
    createdAt: string;
  } | null;
  rank?: number | null;
}

export interface PredictedOverviewData {
  poolUsers: PredictedPoolUser[];
  myStats: {
    totalInPool: number;
    totalVotedByMe: number;
    remainingToVote: number;
  };
  isEmirgan: boolean;
  myUserId: number;
}

export interface PredictedAuditVote {
  id: number;
  voterId: number;
  voterUsername: string;
  voterAvatar: string | null;
  voterColor?: string;
  courseScores: { [courseId: string]: number };
  tokGrade: string;
  eeGrade: string;
  corePoints: number;
  totalScore: number;
  createdAt: string;
}

// Fallback IB courses if target user has no course roles
export const DEFAULT_FALLBACK_COURSES: CourseRole[] = [
  { id: "turkish_sl", label: "Turkish A SL", color: "#F97316", level: "SL" },
  { id: "eng_b_hl", label: "English B HL", color: "#2563EB", level: "HL" },
  { id: "math_hl", label: "Mathematics HL", color: "#0284C7", level: "HL" },
  { id: "physics_sl", label: "Physics SL", color: "#A855F7", level: "SL" },
  { id: "titc", label: "TITC SL", color: "#E11D48", level: "SL" },
  { id: "digital_society_sl", label: "Digital Society SL", color: "#06B6D4", level: "SL" },
];

/**
 * Filter user's course roles from COURSE_ROLES list,
 * excluding non-course / admin / special roles.
 */
export function getTargetUserCourseRoles(userRoleIds: string[] = []): CourseRole[] {
  if (!Array.isArray(userRoleIds) || userRoleIds.length === 0) {
    return DEFAULT_FALLBACK_COURSES;
  }

  const matched = COURSE_ROLES.filter((role) => userRoleIds.includes(role.id));
  if (matched.length === 0) {
    return DEFAULT_FALLBACK_COURSES;
  }

  return matched;
}

/**
 * Official IB TOK/EE Matrix Points calculation
 * A, B, C, D, E
 */
export function calculateTOKEEPoints(tokGrade: string, eeGrade: string): number {
  const tok = (tokGrade || "").trim().toUpperCase();
  const ee = (eeGrade || "").trim().toUpperCase();

  if (!tok || !ee || tok === "E" || ee === "E") {
    return 0;
  }

  const pair = tok + ee;
  // 3 Points: A+A, A+B, B+A
  if (pair === "AA" || pair === "AB" || pair === "BA") {
    return 3;
  }
  // 2 Points: A+C, C+A, B+B, B+C, C+B, A+D, D+A
  if (
    pair === "AC" || pair === "CA" ||
    pair === "BB" ||
    pair === "BC" || pair === "CB" ||
    pair === "AD" || pair === "DA"
  ) {
    return 2;
  }
  // 1 Point: C+C, B+D, D+B
  if (pair === "CC" || pair === "BD" || pair === "DB") {
    return 1;
  }
  // 0 Points: C+D, D+C, D+D
  return 0;
}

/**
 * Full IB 45 Point Calculation
 * 6 Courses (max 42) + Core (max 3) = Max 45
 */
export function calculateClientIBPoints(
  courseScores: { [courseId: string]: number },
  tokGrade: string,
  eeGrade: string
): {
  courseScoreSum: number;
  courseAverage: number;
  normalizedCourseScore: number;
  corePoints: number;
  totalScore: number;
  gradedCourseCount: number;
} {
  const scores = Object.values(courseScores).filter((s) => typeof s === "number" && s >= 1 && s <= 7);
  const n = scores.length;
  let normalizedCourseScore = 0;
  let courseScoreSum = 0;
  let courseAverage = 0;

  if (n === 0) {
    normalizedCourseScore = 0;
  } else if (n === 6) {
    courseScoreSum = scores.reduce((a, b) => a + b, 0);
    courseAverage = Math.round((courseScoreSum / 6) * 10) / 10;
    normalizedCourseScore = courseScoreSum;
  } else {
    courseScoreSum = scores.reduce((a, b) => a + b, 0);
    courseAverage = courseScoreSum / n;
    // Normalize to 6 subjects base (42 points)
    normalizedCourseScore = Math.round(((courseScoreSum / n) * 6) * 10) / 10;
  }

  const corePoints = calculateTOKEEPoints(tokGrade, eeGrade);
  const totalScore = Math.round((normalizedCourseScore + corePoints) * 10) / 10;

  return {
    courseScoreSum,
    courseAverage: Math.round(courseAverage * 10) / 10,
    normalizedCourseScore,
    corePoints,
    totalScore,
    gradedCourseCount: n,
  };
}

/**
 * Returns color style for a score out of 45
 */
export function getScoreBadgeStyle(score: number | null): {
  text: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  progressColor: string;
} {
  if (score === null || score === undefined) {
    return {
      text: "- / 45",
      badgeBg: "bg-slate-100 dark:bg-slate-800",
      badgeText: "text-slate-500 dark:text-slate-400",
      badgeBorder: "border-slate-200 dark:border-slate-700",
      progressColor: "bg-slate-300 dark:bg-slate-700",
    };
  }

  if (score >= 40) {
    return {
      text: `${score.toFixed(1)} / 45`,
      badgeBg: "bg-amber-500/10 dark:bg-amber-500/20",
      badgeText: "text-amber-600 dark:text-amber-400",
      badgeBorder: "border-amber-500/30",
      progressColor: "bg-gradient-to-r from-amber-400 to-yellow-500",
    };
  }

  if (score >= 35) {
    return {
      text: `${score.toFixed(1)} / 45`,
      badgeBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      badgeText: "text-emerald-600 dark:text-emerald-400",
      badgeBorder: "border-emerald-500/30",
      progressColor: "bg-gradient-to-r from-emerald-400 to-teal-500",
    };
  }

  if (score >= 30) {
    return {
      text: `${score.toFixed(1)} / 45`,
      badgeBg: "bg-blue-500/10 dark:bg-blue-500/20",
      badgeText: "text-blue-600 dark:text-blue-400",
      badgeBorder: "border-blue-500/30",
      progressColor: "bg-gradient-to-r from-blue-400 to-indigo-500",
    };
  }

  return {
    text: `${score.toFixed(1)} / 45`,
    badgeBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    badgeText: "text-indigo-600 dark:text-indigo-400",
    badgeBorder: "border-indigo-500/30",
    progressColor: "bg-gradient-to-r from-indigo-400 to-purple-500",
  };
}

/**
 * 7-point scale color mapper according to user brief:
 * 6.00 – 7.00: Zümrüt Yeşili (from-emerald-500 to-green-400 / text-emerald-500) — Çok Yüksek
 * 5.00 – 5.99: Gökyüzü Mavisi (from-sky-500 to-blue-500 / text-sky-500) — İyi
 * 4.00 – 4.99: Kehribar Sarısı (from-amber-500 to-yellow-400 / text-amber-500) — Orta
 * 1.00 – 3.99: Mercan Kırmızısı (from-rose-500 to-red-500 / text-rose-500) — Düşük
 */
export function getCourseScoreColor(score: number | null | undefined): {
  label: string;
  gradient: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  percent: number;
} {
  if (score === null || score === undefined || isNaN(score) || score <= 0) {
    return {
      label: "Henüz Değerlendirilmedi",
      gradient: "from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600",
      textColor: "text-slate-400 dark:text-slate-500",
      badgeBg: "bg-slate-100 dark:bg-slate-800",
      badgeBorder: "border-slate-200 dark:border-slate-700",
      percent: 0,
    };
  }

  const percent = Math.min(100, Math.max(0, Math.round((score / 7) * 100)));

  if (score >= 6.0) {
    return {
      label: "Çok Yüksek",
      gradient: "from-emerald-500 to-green-400",
      textColor: "text-emerald-600 dark:text-emerald-400",
      badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
      badgeBorder: "border-emerald-200 dark:border-emerald-800",
      percent,
    };
  }
  if (score >= 5.0) {
    return {
      label: "İyi",
      gradient: "from-sky-500 to-blue-500",
      textColor: "text-sky-600 dark:text-sky-400",
      badgeBg: "bg-sky-50 dark:bg-sky-950/40",
      badgeBorder: "border-sky-200 dark:border-sky-800",
      percent,
    };
  }
  if (score >= 4.0) {
    return {
      label: "Orta",
      gradient: "from-amber-500 to-yellow-400",
      textColor: "text-amber-600 dark:text-amber-400",
      badgeBg: "bg-amber-50 dark:bg-amber-950/40",
      badgeBorder: "border-amber-200 dark:border-amber-800",
      percent,
    };
  }
  return {
    label: "Düşük",
    gradient: "from-rose-500 to-red-500",
    textColor: "text-rose-600 dark:text-rose-400",
    badgeBg: "bg-rose-50 dark:bg-rose-950/40",
    badgeBorder: "border-rose-200 dark:border-rose-800",
    percent,
  };
}

/**
 * Core Bonus (+3 points) scale color mapper
 */
export function getCoreScoreColor(coreScore: number | null | undefined): {
  label: string;
  gradient: string;
  textColor: string;
  badgeBg: string;
  badgeBorder: string;
  percent: number;
} {
  if (coreScore === null || coreScore === undefined || isNaN(coreScore) || coreScore < 0) {
    return {
      label: "Henüz Değerlendirilmedi",
      gradient: "from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600",
      textColor: "text-slate-400 dark:text-slate-500",
      badgeBg: "bg-slate-100 dark:bg-slate-800",
      badgeBorder: "border-slate-200 dark:border-slate-700",
      percent: 0,
    };
  }

  const percent = Math.min(100, Math.max(0, Math.round((coreScore / 3) * 100)));

  if (coreScore >= 2.5) {
    return {
      label: "Çok Yüksek",
      gradient: "from-emerald-500 to-green-400",
      textColor: "text-emerald-600 dark:text-emerald-400",
      badgeBg: "bg-emerald-50 dark:bg-emerald-950/40",
      badgeBorder: "border-emerald-200 dark:border-emerald-800",
      percent,
    };
  }
  if (coreScore >= 2.0) {
    return {
      label: "İyi",
      gradient: "from-sky-500 to-blue-500",
      textColor: "text-sky-600 dark:text-sky-400",
      badgeBg: "bg-sky-50 dark:bg-sky-950/40",
      badgeBorder: "border-sky-200 dark:border-sky-800",
      percent,
    };
  }
  if (coreScore >= 1.0) {
    return {
      label: "Orta",
      gradient: "from-amber-500 to-yellow-400",
      textColor: "text-amber-600 dark:text-amber-400",
      badgeBg: "bg-amber-50 dark:bg-amber-950/40",
      badgeBorder: "border-amber-200 dark:border-amber-800",
      percent,
    };
  }
  return {
    label: "Düşük",
    gradient: "from-rose-500 to-red-500",
    textColor: "text-rose-600 dark:text-rose-400",
    badgeBg: "bg-rose-50 dark:bg-rose-950/40",
    badgeBorder: "border-rose-200 dark:border-rose-800",
    percent,
  };
}
