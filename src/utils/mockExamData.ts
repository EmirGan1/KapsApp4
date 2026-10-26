// Official IB DP 2027 Pre-Mock 3 Examination Schedule & Overlay Engine
// Period: 12 - 26 Ekim 2026

import { 
  WEEKLY_SCHEDULE, 
  WEDNESDAY_SCHEDULE_TIMES,
  STANDARD_SCHEDULE_TIMES,
  resolveSubjectByRole, 
  getCurrentPeriodStatus, 
  SchedulePeriod, 
  ResolvedSubject, 
  PeriodTimeStatus 
} from "./scheduleData";

export interface MockExamSession {
  id: string;
  subject: string; // "Physics", "Mathematics", vb.
  date: string; // "YYYY-MM-DD"
  startTime: string; // "09:00"
  slDurationMinutes: number; // 90
  hlDurationMinutes: number; // 135
  room: string;
  affectedCourseIds?: string[]; // Bu sınavın çakıştığı derslerin ID'leri
}

export interface MockExam {
  id: string;
  title: string;
  subject: string;
  level: "HL" | "SL" | "SL/HL";
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm (default / maximum end time)
  slDurationMinutes?: number;
  hlDurationMinutes?: number;
  slEndTime?: string;
  hlEndTime?: string;
  targetRoles: string[];
  targetCourses?: string[];
  room: string;
  description?: string;
  paper?: string;
  durationMin?: number;
  affectedCourseIds?: string[];
}

export interface CancelledClassInfo {
  periodNumber: number | number[];
  name: string;
  originalSubjectKey: string;
  startTime: string;
  endTime: string;
  roomOrNote?: string;
  reason: string;
  resolved?: ResolvedSubject;
}

export interface ScheduleEntry {
  id: string;
  type: "class" | "mock_exam" | "break";
  periodNumber?: number | number[];
  startTime: string;
  endTime: string;
  title: string;
  subjectKey?: string;
  defaultName?: string;
  roomOrNote?: string;
  isBlock?: boolean;
  resolved?: ResolvedSubject;
  folderTarget?: string;
  isUserEnrolled?: boolean;
  statusInfo?: PeriodTimeStatus;
  
  // Mock Exam Overlay Properties
  isExamSlot?: boolean;
  overriddenByExam?: MockExam;
  cancelledClasses?: CancelledClassInfo[];
}

export const MOCK_EXAM_START_DATE = "2026-10-12";
export const MOCK_EXAM_END_DATE = "2026-10-27";

/**
 * Returns true if the provided date is within the official two-week mock exam window
 */
export function isMockExamPeriod(date: string | Date = new Date()): boolean {
  try {
    let dateStr: string;
    if (typeof date === "string") {
      dateStr = date.split("T")[0];
    } else {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      dateStr = `${year}-${month}-${day}`;
    }
    return dateStr >= MOCK_EXAM_START_DATE && dateStr <= MOCK_EXAM_END_DATE;
  } catch {
    return false;
  }
}

/**
 * Adds minutes to an HH:mm formatted string and returns HH:mm
 */
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  try {
    const [h, m] = timeStr.split(":").map(Number);
    const total = (h || 0) * 60 + (m || 0) + minutesToAdd;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  } catch {
    return timeStr;
  }
}

/**
 * Time overlap detector between two HH:mm intervals
 */
export function doesTimesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const s1 = toMin(start1);
  const e1 = toMin(end1);
  const s2 = toMin(start2);
  const e2 = toMin(end2);

  return Math.max(s1, s2) < Math.min(e1, e2);
}

/**
 * Normalizes user role string for robust comparison
 */
export function normalizeRole(role: string): string {
  return String(role || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

/**
 * Resolves whether the current user is SL or HL for a given subject.
 */
export function getUserLevelForSubject(
  subject: string,
  userRoles: string[] = [],
  courseLevels?: Record<string, "SL" | "HL">
): "SL" | "HL" {
  if (courseLevels && courseLevels[subject]) {
    return courseLevels[subject];
  }

  const normSubject = subject.toLowerCase();
  const normalizedRoles = (userRoles || []).map(normalizeRole);

  for (const r of normalizedRoles) {
    const matchesSubject = 
      (normSubject.includes("physic") && (r.includes("physic") || r.includes("fizik"))) ||
      (normSubject.includes("math") && (r.includes("math") || r.includes("matematik"))) ||
      (normSubject.includes("chem") && (r.includes("chem") || r.includes("kimya"))) ||
      (normSubject.includes("bio") && (r.includes("bio") || r.includes("biyoloji"))) ||
      (normSubject.includes("turk") && (r.includes("turk") || r.includes("literature") || r.includes("edebiyat"))) ||
      (normSubject.includes("eng") && (r.includes("eng") || r.includes("ingiliz"))) ||
      (normSubject.includes("digsoc") && (r.includes("digsoc") || r.includes("digital_society"))) ||
      (normSubject.includes("psych") && (r.includes("psych") || r.includes("psikoloji")));

    if (matchesSubject) {
      if (r.includes("_hl") || r.endsWith("hl") || r.includes("hl")) return "HL";
      if (r.includes("_sl") || r.endsWith("sl") || r.includes("sl")) return "SL";
    }
  }

  // Check general HL role
  const hasGenericHL = normalizedRoles.some((r) => r.includes("hl") && !r.includes("sl"));
  if (hasGenericHL) return "HL";

  return "SL";
}

export interface UserExamTiming {
  userLevel: "SL" | "HL";
  userStartTime: string;
  userEndTime: string;
  userDurationMinutes: number;
  hasDifferentHlExtension: boolean;
  hlEndTime: string;
  hlDurationMinutes: number;
  slEndTime: string;
  slDurationMinutes: number;
  isOnlyHl: boolean;
  isOnlySl: boolean;
  displayBadgeText: string;
  displayTimeRange: string;
  extensionNotice?: string;
}

/**
 * Computes exact timing and dynamic display parameters based on student's SL vs HL role
 */
export function getUserExamTiming(
  exam: MockExam,
  userRoles: string[] = [],
  courseLevels?: Record<string, "SL" | "HL">
): UserExamTiming {
  const isOnlyHl = exam.level === "HL";
  const isOnlySl = exam.level === "SL";

  const userLevel: "SL" | "HL" = isOnlyHl
    ? "HL"
    : isOnlySl
    ? "SL"
    : getUserLevelForSubject(exam.subject, userRoles, courseLevels);

  const slDuration = exam.slDurationMinutes || exam.durationMin || 90;
  const hlDuration = exam.hlDurationMinutes || (exam.level === "HL" ? (exam.durationMin || 90) : 120);

  const slEndTime = exam.slEndTime || addMinutesToTime(exam.startTime, slDuration);
  const hlEndTime = exam.hlEndTime || addMinutesToTime(exam.startTime, hlDuration);

  const isUserSL = userLevel === "SL" && !isOnlyHl;
  const userDurationMinutes = isUserSL ? slDuration : hlDuration;
  const userEndTime = isUserSL ? slEndTime : hlEndTime;

  const hasDifferentHlExtension =
    isUserSL && exam.level === "SL/HL" && hlDuration > slDuration;

  const displayTimeRange = `${exam.startTime} - ${userEndTime} (${userDurationMinutes} dk - ${userLevel})`;
  const displayBadgeText = isOnlyHl
    ? "HL Sınavı"
    : isOnlySl
    ? "SL Sınavı"
    : `${userLevel} Sınavı`;

  const extensionNotice = hasDifferentHlExtension
    ? `🏷️ HL Sınavı: ${hlEndTime}'ye kadar devam eder`
    : undefined;

  return {
    userLevel,
    userStartTime: exam.startTime,
    userEndTime,
    userDurationMinutes,
    hasDifferentHlExtension,
    hlEndTime,
    hlDurationMinutes: hlDuration,
    slEndTime,
    slDurationMinutes: slDuration,
    isOnlyHl,
    isOnlySl,
    displayBadgeText,
    displayTimeRange,
    extensionNotice
  };
}

/**
 * Checks whether the current user is enrolled in the mock exam
 */
export function isUserEnrolledInExam(
  exam: MockExam,
  rawUserRoles: string[] = []
): boolean {
  if (!exam.targetRoles || exam.targetRoles.length === 0) return true;
  if (exam.targetRoles.includes("all")) return true;

  const userRoles = rawUserRoles.map(normalizeRole);

  return exam.targetRoles.some((targetRole) => {
    const targetNorm = normalizeRole(targetRole);
    if (userRoles.includes(targetNorm)) return true;

    const subjectPrefix = targetNorm.split("_")[0];
    return userRoles.some(
      (ur) => ur.includes(targetNorm) || (subjectPrefix && ur.includes(subjectPrefix))
    );
  });
}

/**
 * OFFICIAL IB DP 2027 PRE-MOCK 3 EXAMINATION SCHEDULE
 * October 12, 2026 - October 26, 2026
 * Configured with dynamic SL and HL durations and exact end times
 */
export const OFFICIAL_MOCK_EXAMS: MockExam[] = [
  // --- HAFTA 1 (WEEK 1) ---
  // 12.10.2026 Pazartesi (Monday)
  {
    id: "mock_20261012_chem_p1",
    title: "Chemistry Paper 1 (SL/HL)",
    subject: "Chemistry",
    level: "SL/HL",
    date: "2026-10-12",
    startTime: "08:50",
    endTime: "10:50",
    slDurationMinutes: 90,
    hlDurationMinutes: 120,
    slEndTime: "10:20",
    hlEndTime: "10:50",
    targetRoles: ["chemistry_sl", "chemistry_hl", "chemistry", "kimya"],
    targetCourses: ["Chemistry"],
    room: "Salon A (Derslik 302)",
    paper: "Paper 1",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Chemistry Paper 1 (SL: 90 dk bitiş: 10:20, HL: 120 dk bitiş: 10:50)",
    affectedCourseIds: ["chemistry_digsoc_psychology"]
  },
  {
    id: "mock_20261012_digsoc_p1",
    title: "Digital Society Paper 1 (SL/HL)",
    subject: "Digital Society",
    level: "SL/HL",
    date: "2026-10-12",
    startTime: "08:50",
    endTime: "11:05",
    slDurationMinutes: 90,
    hlDurationMinutes: 135,
    slEndTime: "10:20",
    hlEndTime: "11:05",
    targetRoles: ["digital_society_sl", "digital_society_hl", "digital_society", "digsoc"],
    targetCourses: ["Digital Society"],
    room: "Laboratuvar 1 (Bilişim)",
    paper: "Paper 1",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Digital Society Paper 1 (SL: 90 dk bitiş: 10:20, HL: 135 dk bitiş: 11:05)",
    affectedCourseIds: ["chemistry_digsoc_psychology"]
  },
  {
    id: "mock_20261012_psych_p1",
    title: "Psychology Paper 1 (SL/HL)",
    subject: "Psychology",
    level: "SL/HL",
    date: "2026-10-12",
    startTime: "08:50",
    endTime: "10:50",
    slDurationMinutes: 90,
    hlDurationMinutes: 120,
    slEndTime: "10:20",
    hlEndTime: "10:50",
    targetRoles: ["psychology_sl", "psychology_hl", "psychology", "psikoloji"],
    targetCourses: ["Psychology"],
    room: "Salon B (Derslik 304)",
    paper: "Paper 1",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Psychology Paper 1 (SL: 90 dk, HL: 120 dk)",
    affectedCourseIds: ["chemistry_digsoc_psychology"]
  },

  // 13.10.2026 Salı (Tuesday)
  {
    id: "mock_20261013_chem_p2",
    title: "Chemistry Paper 2 (SL/HL)",
    subject: "Chemistry",
    level: "SL/HL",
    date: "2026-10-13",
    startTime: "08:50",
    endTime: "11:20",
    slDurationMinutes: 90,
    hlDurationMinutes: 150,
    slEndTime: "10:20",
    hlEndTime: "11:20",
    targetRoles: ["chemistry_sl", "chemistry_hl", "chemistry", "kimya"],
    targetCourses: ["Chemistry"],
    room: "Salon A (Derslik 302)",
    paper: "Paper 2",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Chemistry Paper 2 (SL: 90 dk bitiş: 10:20, HL: 150 dk bitiş: 11:20)",
    affectedCourseIds: ["chemistry_digsoc_psychology"]
  },
  {
    id: "mock_20261013_digsoc_p2",
    title: "Digital Society Paper 2 (SL/HL)",
    subject: "Digital Society",
    level: "SL/HL",
    date: "2026-10-13",
    startTime: "08:50",
    endTime: "10:05",
    slDurationMinutes: 75,
    hlDurationMinutes: 75,
    slEndTime: "10:05",
    hlEndTime: "10:05",
    targetRoles: ["digital_society_sl", "digital_society_hl", "digital_society", "digsoc"],
    targetCourses: ["Digital Society"],
    room: "Laboratuvar 1 (Bilişim)",
    paper: "Paper 2",
    durationMin: 75,
    description: "IB DP Pre-Mock 3 • Digital Society Paper 2 (SL & HL: 75 dk bitiş: 10:05)",
    affectedCourseIds: ["chemistry_digsoc_psychology"]
  },
  {
    id: "mock_20261013_psych_p2",
    title: "Psychology Paper 2 (SL/HL)",
    subject: "Psychology",
    level: "SL/HL",
    date: "2026-10-13",
    startTime: "08:50",
    endTime: "10:50",
    slDurationMinutes: 90,
    hlDurationMinutes: 120,
    slEndTime: "10:20",
    hlEndTime: "10:50",
    targetRoles: ["psychology_sl", "psychology_hl", "psychology", "psikoloji"],
    targetCourses: ["Psychology"],
    room: "Salon B (Derslik 304)",
    paper: "Paper 2",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Psychology Paper 2 (SL: 90 dk, HL: 120 dk)",
    affectedCourseIds: ["chemistry_digsoc_psychology"]
  },
  {
    id: "mock_20261013_digsoc_p3",
    title: "Digital Society Paper 3 (HL)",
    subject: "Digital Society",
    level: "HL",
    date: "2026-10-13",
    startTime: "13:35",
    endTime: "14:50",
    slDurationMinutes: 0,
    hlDurationMinutes: 75,
    slEndTime: "13:35",
    hlEndTime: "14:50",
    targetRoles: ["digital_society_hl", "digital_society", "digsoc"],
    targetCourses: ["Digital Society"],
    room: "Laboratuvar 1",
    paper: "Paper 3",
    durationMin: 75,
    description: "IB DP Pre-Mock 3 • Digital Society Paper 3 HL (75 dk bitiş: 14:50)",
    affectedCourseIds: ["tok", "literature"]
  },
  {
    id: "mock_20261013_psych_p3",
    title: "Psychology Paper 3 (HL)",
    subject: "Psychology",
    level: "HL",
    date: "2026-10-13",
    startTime: "13:35",
    endTime: "15:20",
    slDurationMinutes: 0,
    hlDurationMinutes: 105,
    slEndTime: "13:35",
    hlEndTime: "15:20",
    targetRoles: ["psychology_hl", "psychology", "psikoloji"],
    targetCourses: ["Psychology"],
    room: "Salon B",
    paper: "Paper 3",
    durationMin: 105,
    description: "IB DP Pre-Mock 3 • Psychology Paper 3 HL (105 dk bitiş: 15:20)",
    affectedCourseIds: ["tok", "literature"]
  },

  // 15.10.2026 Perşembe (Thursday) - Math Paper 1 (CANCELLED)
  {
    id: "mock_20261015_math_p1_cancelled",
    title: "Mathematics Paper 1 (CANCELLED)",
    subject: "Mathematics",
    level: "SL/HL",
    date: "2026-10-15",
    startTime: "08:50",
    endTime: "11:00",
    slDurationMinutes: 90,
    hlDurationMinutes: 130,
    slEndTime: "10:20",
    hlEndTime: "11:00",
    targetRoles: ["math_sl", "math_hl", "math", "matematik"],
    targetCourses: ["Mathematics"],
    room: "İptal (Yağmur Nedeniyle)",
    paper: "Paper 1",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Mathematics AA / AI Paper 1 (İPTAL - Yağmur Nedeniyle 26 Ekim'e ertelendi)",
    affectedCourseIds: []
  },

  // 16.10.2026 Cuma (Friday) - Math Paper 2 & 3 (CANCELLED)
  {
    id: "mock_20261016_math_p2_cancelled",
    title: "Mathematics Paper 2 (CANCELLED)",
    subject: "Mathematics",
    level: "SL/HL",
    date: "2026-10-16",
    startTime: "08:50",
    endTime: "10:50",
    slDurationMinutes: 90,
    hlDurationMinutes: 120,
    slEndTime: "10:20",
    hlEndTime: "10:50",
    targetRoles: ["math_sl", "math_hl", "math", "matematik"],
    targetCourses: ["Mathematics"],
    room: "İptal (Yağmur Nedeniyle)",
    paper: "Paper 2",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Mathematics AA / AI Paper 2 (İPTAL - Yağmur Nedeniyle 27 Ekim'e ertelendi)",
    affectedCourseIds: []
  },
  {
    id: "mock_20261016_math_p3_cancelled",
    title: "Mathematics Paper 3 (CANCELLED)",
    subject: "Mathematics",
    level: "HL",
    date: "2026-10-16",
    startTime: "13:35",
    endTime: "14:50",
    slDurationMinutes: 0,
    hlDurationMinutes: 75,
    slEndTime: "13:35",
    hlEndTime: "14:50",
    targetRoles: ["math_hl"],
    targetCourses: ["Mathematics"],
    room: "İptal (Yağmur Nedeniyle)",
    paper: "Paper 3",
    durationMin: 75,
    description: "IB DP Pre-Mock 3 • Mathematics HL Paper 3 (İPTAL - Yağmur Nedeniyle 27 Ekim'e ertelendi)",
    affectedCourseIds: []
  },

  // NEW DATES FOR RESCHEDULED MATH EXAMS
  // 26.10.2026 Pazartesi (Monday) - Rescheduled Math P1
  {
    id: "mock_20261026_math_p1",
    title: "Mathematics Paper 1 (Rescheduled)",
    subject: "Mathematics",
    level: "SL/HL",
    date: "2026-10-26",
    startTime: "09:00",
    endTime: "11:10",
    slDurationMinutes: 90,
    hlDurationMinutes: 130,
    slEndTime: "10:20",
    hlEndTime: "11:00",
    targetRoles: ["math_sl", "math_hl", "math", "matematik"],
    targetCourses: ["Mathematics"],
    room: "Ana Konferans Salonu",
    paper: "Paper 1",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Mathematics AA / AI Paper 1 (Rescheduled)",
    affectedCourseIds: ["math"]
  },
  // 27.10.2026 Salı (Tuesday) - Rescheduled Math P2 & P3
  {
    id: "mock_20261027_math_p2",
    title: "Mathematics Paper 2 (Rescheduled)",
    subject: "Mathematics",
    level: "SL/HL",
    date: "2026-10-27",
    startTime: "09:00",
    endTime: "11:00",
    slDurationMinutes: 90,
    hlDurationMinutes: 120,
    slEndTime: "10:20",
    hlEndTime: "10:50",
    targetRoles: ["math_sl", "math_hl", "math", "matematik"],
    targetCourses: ["Mathematics"],
    room: "Ana Konferans Salonu",
    paper: "Paper 2",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Mathematics AA / AI Paper 2 (Rescheduled)",
    affectedCourseIds: ["math"]
  },
  {
    id: "mock_20261027_math_p3",
    title: "Mathematics Paper 3 (Rescheduled)",
    subject: "Mathematics",
    level: "SL/HL",
    date: "2026-10-27",
    startTime: "14:00",
    endTime: "15:15",
    slDurationMinutes: 75,
    hlDurationMinutes: 75,
    slEndTime: "15:15",
    hlEndTime: "15:15",
    targetRoles: ["math_sl", "math_hl", "math", "matematik"],
    targetCourses: ["Mathematics"],
    room: "Derslik 301",
    paper: "Paper 3",
    durationMin: 75,
    description: "IB DP Pre-Mock 3 • Mathematics Paper 3 (75 dk bitiş: 15:15)",
    affectedCourseIds: ["math"]
  },

  // --- HAFTA 2 (WEEK 2) ---
  // 19.10.2026 Pazartesi (Monday)
  {
    id: "mock_20261019_phys_p1",
    title: "Physics Paper 1 (SL/HL)",
    subject: "Physics",
    level: "SL/HL",
    date: "2026-10-19",
    startTime: "08:50",
    endTime: "10:50",
    slDurationMinutes: 90,
    hlDurationMinutes: 120,
    slEndTime: "10:20",
    hlEndTime: "10:50",
    targetRoles: ["physics_sl", "physics_hl", "physics", "fizik"],
    targetCourses: ["Physics"],
    room: "Fizik Amfisi (Derslik 305)",
    paper: "Paper 1",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Physics Paper 1 (SL: 90 dk bitiş: 10:20, HL: 120 dk bitiş: 10:50)",
    affectedCourseIds: ["physics_biology"]
  },
  {
    id: "mock_20261019_bio_p1",
    title: "Biology Paper 1 (SL/HL)",
    subject: "Biology",
    level: "SL/HL",
    date: "2026-10-19",
    startTime: "08:50",
    endTime: "10:50",
    slDurationMinutes: 90,
    hlDurationMinutes: 120,
    slEndTime: "10:20",
    hlEndTime: "10:50",
    targetRoles: ["biology_sl", "biology_hl", "biology", "biyoloji"],
    targetCourses: ["Biology"],
    room: "Biyoloji Laboratuvarı",
    paper: "Paper 1",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Biology Paper 1 (SL: 90 dk bitiş: 10:20, HL: 120 dk bitiş: 10:50)",
    affectedCourseIds: ["physics_biology"]
  },
  {
    id: "mock_20261019_eng_p1",
    title: "English B Paper 1 (HL)",
    subject: "English",
    level: "HL",
    date: "2026-10-19",
    startTime: "13:35",
    endTime: "15:05",
    slDurationMinutes: 0,
    hlDurationMinutes: 90,
    slEndTime: "13:35",
    hlEndTime: "15:05",
    targetRoles: ["eng_b_hl", "english_b", "english", "ingilizce"],
    targetCourses: ["English"],
    room: "Derslik 204",
    paper: "Paper 1 (Writing)",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • English B Paper 1 Writing HL (90 dk bitiş: 15:05)",
    affectedCourseIds: ["foreign_language", "math"]
  },

  // 20.10.2026 Salı (Tuesday)
  {
    id: "mock_20261020_phys_p2",
    title: "Physics Paper 2 (SL/HL)",
    subject: "Physics",
    level: "SL/HL",
    date: "2026-10-20",
    startTime: "08:50",
    endTime: "11:20",
    slDurationMinutes: 90,
    hlDurationMinutes: 150,
    slEndTime: "10:20",
    hlEndTime: "11:20",
    targetRoles: ["physics_sl", "physics_hl", "physics", "fizik"],
    targetCourses: ["Physics"],
    room: "Fizik Amfisi (Derslik 305)",
    paper: "Paper 2",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Physics Paper 2 (SL: 90 dk bitiş: 10:20, HL: 150 dk bitiş: 11:20)",
    affectedCourseIds: ["physics_biology"]
  },
  {
    id: "mock_20261020_bio_p2",
    title: "Biology Paper 2 (SL/HL)",
    subject: "Biology",
    level: "SL/HL",
    date: "2026-10-20",
    startTime: "08:50",
    endTime: "11:20",
    slDurationMinutes: 90,
    hlDurationMinutes: 150,
    slEndTime: "10:20",
    hlEndTime: "11:20",
    targetRoles: ["biology_sl", "biology_hl", "biology", "biyoloji"],
    targetCourses: ["Biology"],
    room: "Biyoloji Laboratuvarı",
    paper: "Paper 2",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • Biology Paper 2 (SL: 90 dk bitiş: 10:20, HL: 150 dk bitiş: 11:20)",
    affectedCourseIds: ["physics_biology"]
  },
  {
    id: "mock_20261020_eng_p2_read",
    title: "English B Paper 2 Reading (HL)",
    subject: "English",
    level: "HL",
    date: "2026-10-20",
    startTime: "13:35",
    endTime: "14:35",
    slDurationMinutes: 0,
    hlDurationMinutes: 60,
    slEndTime: "13:35",
    hlEndTime: "14:35",
    targetRoles: ["eng_b_hl", "english_b", "english", "ingilizce"],
    targetCourses: ["English"],
    room: "Derslik 204",
    paper: "Paper 2 (Reading)",
    durationMin: 60,
    description: "IB DP Pre-Mock 3 • English B Paper 2 Reading Comprehension HL (60 dk bitiş: 14:35)",
    affectedCourseIds: ["foreign_language"]
  },
  {
    id: "mock_20261020_eng_p2_list",
    title: "English B Paper 2 Listening (HL)",
    subject: "English",
    level: "HL",
    date: "2026-10-20",
    startTime: "14:35",
    endTime: "15:35",
    slDurationMinutes: 0,
    hlDurationMinutes: 60,
    slEndTime: "14:35",
    hlEndTime: "15:35",
    targetRoles: ["eng_b_hl", "english_b", "english", "ingilizce"],
    targetCourses: ["English"],
    room: "Derslik 204",
    paper: "Paper 2 (Listening)",
    durationMin: 60,
    description: "IB DP Pre-Mock 3 • English B Paper 2 Listening Comprehension HL (60 dk bitiş: 15:35)",
    affectedCourseIds: ["foreign_language", "math"]
  },

  // 22.10.2026 Perşembe (Thursday)
  {
    id: "mock_20261022_turk_p1",
    title: "Turkish A: Literature Paper 1 (SL/HL)",
    subject: "Turkish",
    level: "SL/HL",
    date: "2026-10-22",
    startTime: "08:50",
    endTime: "11:05",
    slDurationMinutes: 75,
    hlDurationMinutes: 135,
    slEndTime: "10:05",
    hlEndTime: "11:05",
    targetRoles: ["turkish_sl", "turkish_hl", "literature", "edebiyat", "turk"],
    targetCourses: ["Turkish"],
    room: "Ana Konferans Salonu",
    paper: "Paper 1",
    durationMin: 75,
    description: "IB DP Pre-Mock 3 • Turkish A: Literature Paper 1 (SL: 75 dk bitiş: 10:05, HL: 135 dk bitiş: 11:05)",
    affectedCourseIds: ["chemistry_digsoc_psychology", "physics_biology"]
  },
  {
    id: "mock_20261022_titc_p2",
    title: "TITC Paper 2 (SL)",
    subject: "TITC",
    level: "SL",
    date: "2026-10-22",
    startTime: "13:35",
    endTime: "15:05",
    slDurationMinutes: 90,
    hlDurationMinutes: 90,
    slEndTime: "15:05",
    hlEndTime: "15:05",
    targetRoles: ["titc", "inkılap", "tarih"],
    targetCourses: ["TITC"],
    room: "Derslik 303",
    paper: "Paper 2",
    durationMin: 90,
    description: "IB DP Pre-Mock 3 • TITC Paper 2 SL (90 dk bitiş: 15:05)",
    affectedCourseIds: ["tok", "literature"]
  },

  // 23.10.2026 Cuma (Friday)
  {
    id: "mock_20261023_titc_p1",
    title: "TITC Paper 1 (SL)",
    subject: "TITC",
    level: "SL",
    date: "2026-10-23",
    startTime: "08:50",
    endTime: "09:50",
    slDurationMinutes: 60,
    hlDurationMinutes: 60,
    slEndTime: "09:50",
    hlEndTime: "09:50",
    targetRoles: ["titc", "inkılap", "tarih"],
    targetCourses: ["TITC"],
    room: "Derslik 303",
    paper: "Paper 1",
    durationMin: 60,
    description: "IB DP Pre-Mock 3 • TITC Paper 1 SL (60 dk bitiş: 09:50)",
    affectedCourseIds: ["literature"]
  }
];

/**
 * Returns mock exams for a given date
 */
export function getMockExamsForDate(dateInput: string | Date): MockExam[] {
  let dateStr: string;
  if (typeof dateInput === "string") {
    dateStr = dateInput.split("T")[0];
  } else {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, "0");
    const d = String(dateInput.getDate()).padStart(2, "0");
    dateStr = `${y}-${m}-${d}`;
  }
  return OFFICIAL_MOCK_EXAMS.filter((exam) => exam.date === dateStr);
}

/**
 * Map subject text to standard folder ID
 */
export function getCourseFolderTarget(subject: string): string {
  const norm = subject.toLowerCase();
  if (norm.includes("physic") || norm.includes("fizik")) return "Physics";
  if (norm.includes("math") || norm.includes("matematik")) return "Mathematics";
  if (norm.includes("chem") || norm.includes("kimya")) return "Chemistry";
  if (norm.includes("bio") || norm.includes("biyoloji")) return "Biology";
  if (norm.includes("turkish") || norm.includes("edebiyat") || norm.includes("turk")) return "Turkish";
  if (norm.includes("english") || norm.includes("ingiliz")) return "English";
  if (norm.includes("titc") || norm.includes("inkılap") || norm.includes("tarih")) return "TITC";
  if (norm.includes("digsoc") || norm.includes("digital society") || norm.includes("psycholog")) return "Digital Society";
  return "Mathematics";
}

/**
 * CORE OVERLAY ALGORITHM:
 * Replaces normal courses with Mock Exam cards when there is an overlap during
 * the 2-week mock exam period (12 - 26 Ekim 2026).
 * Computes dynamic SL vs HL finish times for user enrollment.
 */
export function buildDayScheduleWithOverlay(
  dayIndex: number,
  dateStr: string,
  userRoles: string[] = [],
  now: Date = new Date(),
  courseLevels?: Record<string, "SL" | "HL">
): ScheduleEntry[] {
  const inMockPeriod = isMockExamPeriod(dateStr);
  const daySchedule = WEEKLY_SCHEDULE.find((d) => d.dayIndex === dayIndex);
  if (!daySchedule || !daySchedule.periods) return [];

  // If outside mock exam period, return standard day periods
  if (!inMockPeriod) {
    return daySchedule.periods.map((period, idx) => {
      const resolved = resolveSubjectByRole(period.subjectKey, userRoles);
      const statusInfo = getCurrentPeriodStatus(period.startTime, period.endTime, dayIndex, now);
      return {
        id: `std_${dayIndex}_${idx}_${period.startTime}`,
        type: "class",
        periodNumber: period.periodNumber,
        startTime: period.startTime,
        endTime: period.endTime,
        title: resolved.name,
        subjectKey: period.subjectKey,
        defaultName: period.defaultName,
        roomOrNote: period.roomOrNote,
        isBlock: period.isBlock,
        resolved,
        folderTarget: getCourseFolderTarget(resolved.group || period.subjectKey),
        isUserEnrolled: true,
        statusInfo,
        isExamSlot: false
      };
    });
  }

  // WITHIN MOCK EXAM PERIOD:
  const dayMockExams = getMockExamsForDate(dateStr);

  // If no exams scheduled on this particular weekday (e.g. Wednesday 14.10 or 21.10)
  if (dayMockExams.length === 0) {
    return daySchedule.periods.map((period, idx) => {
      const resolved = resolveSubjectByRole(period.subjectKey, userRoles);
      const statusInfo = getCurrentPeriodStatus(period.startTime, period.endTime, dayIndex, now);
      return {
        id: `std_mock_${dayIndex}_${idx}`,
        type: "class",
        periodNumber: period.periodNumber,
        startTime: period.startTime,
        endTime: period.endTime,
        title: resolved.name,
        subjectKey: period.subjectKey,
        defaultName: period.defaultName,
        roomOrNote: period.roomOrNote,
        isBlock: period.isBlock,
        resolved,
        folderTarget: getCourseFolderTarget(resolved.group || period.subjectKey),
        isUserEnrolled: true,
        statusInfo,
        isExamSlot: false
      };
    });
  }

  // Separate user exams vs other group exams
  const userMockExams = dayMockExams.filter((exam) => isUserEnrolledInExam(exam, userRoles));
  const activeExamsToOverlay = userMockExams.length > 0 ? userMockExams : dayMockExams;

  const entries: ScheduleEntry[] = [];
  const processedPeriodIndices = new Set<number>();

  // 1. Group exams and find their overlapping periods
  for (const exam of activeExamsToOverlay) {
    const isEnrolled = isUserEnrolledInExam(exam, userRoles);
    const userTiming = getUserExamTiming(exam, userRoles, courseLevels);
    const cancelledClasses: CancelledClassInfo[] = [];

    // Check overlap using maximum span so all affected classes are captured
    const maxExamEnd = exam.hlEndTime || exam.endTime;

    daySchedule.periods.forEach((period, pIdx) => {
      if (doesTimesOverlap(exam.startTime, maxExamEnd, period.startTime, period.endTime)) {
        processedPeriodIndices.add(pIdx);
        const resolved = resolveSubjectByRole(period.subjectKey, userRoles);
        cancelledClasses.push({
          periodNumber: period.periodNumber,
          name: resolved.name,
          originalSubjectKey: period.subjectKey,
          startTime: period.startTime,
          endTime: period.endTime,
          roomOrNote: period.roomOrNote || "Derslik 302",
          reason: "Mock Sınav Nedeniyle İptal",
          resolved
        });
      }
    });

    // Use student's personal end time (SL vs HL) for live status / countdown calculation
    const statusInfo = getCurrentPeriodStatus(exam.startTime, userTiming.userEndTime, dayIndex, now);

    entries.push({
      id: `exam_${exam.id}`,
      type: "mock_exam",
      startTime: exam.startTime,
      endTime: userTiming.userEndTime,
      title: exam.title,
      roomOrNote: exam.room,
      isExamSlot: true,
      overriddenByExam: exam,
      cancelledClasses,
      isUserEnrolled: isEnrolled,
      folderTarget: getCourseFolderTarget(exam.subject),
      statusInfo,
      resolved: {
        name: exam.title,
        group: exam.subject,
        level: userTiming.userLevel,
        color: isEnrolled ? "#F59E0B" : "#64748B",
        bgColor: isEnrolled ? "bg-amber-500/10 dark:bg-amber-500/20" : "bg-slate-500/10",
        borderColor: isEnrolled ? "border-amber-400" : "border-slate-600",
        icon: "📝",
        isElective: false,
        notes: exam.room
      }
    });
  }

  // 2. Add non-overlapping normal curriculum periods
  daySchedule.periods.forEach((period, pIdx) => {
    if (!processedPeriodIndices.has(pIdx)) {
      const resolved = resolveSubjectByRole(period.subjectKey, userRoles);
      const statusInfo = getCurrentPeriodStatus(period.startTime, period.endTime, dayIndex, now);
      entries.push({
        id: `norm_${dayIndex}_${pIdx}`,
        type: "class",
        periodNumber: period.periodNumber,
        startTime: period.startTime,
        endTime: period.endTime,
        title: resolved.name,
        subjectKey: period.subjectKey,
        defaultName: period.defaultName,
        roomOrNote: period.roomOrNote,
        isBlock: period.isBlock,
        resolved,
        folderTarget: getCourseFolderTarget(resolved.group || period.subjectKey),
        isUserEnrolled: true,
        statusInfo,
        isExamSlot: false
      });
    }
  });

  // 3. Sort entries chronologically by startTime
  entries.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return entries;
}
