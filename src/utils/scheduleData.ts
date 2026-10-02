// Weekly Course Schedule Data & Role-Based Subject Resolver (12 G IB)

export interface SchedulePeriod {
  periodNumber: number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  subjectKey: string;
  defaultName: string;
  roomOrNote?: string;
}

export interface DaySchedule {
  dayIndex: number; // 1 = Pazartesi, 2 = Salı, 3 = Çarşamba, 4 = Perşembe, 5 = Cuma
  dayName: string;
  dayShort: string;
  periods: SchedulePeriod[];
}

export interface ResolvedSubject {
  name: string;
  group: string;
  level?: "SL" | "HL";
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  isElective: boolean;
  notes?: string;
}

// 1. Period Standard & Wednesday Bell Times
export const STANDARD_SCHEDULE_TIMES = [
  { period: 1, start: '08:00', end: '08:40' },
  { period: 2, start: '09:00', end: '09:40' },
  { period: 3, start: '09:50', end: '10:30' },
  { period: 4, start: '10:40', end: '11:20' },
  { period: 5, start: '11:30', end: '12:10' },
  { period: 6, start: '13:10', end: '13:50' },
  { period: 7, start: '14:00', end: '14:40' },
  { period: 8, start: '14:50', end: '15:30' }
];

export const WEDNESDAY_SCHEDULE_TIMES = [
  { period: 1, start: '08:00', end: '08:40' },
  { period: 2, start: '08:50', end: '09:30' },
  { period: 3, start: '09:40', end: '10:20' },
  { period: 4, start: '10:30', end: '11:10' },
  { period: 5, start: '11:20', end: '12:00' },
  { period: 6, start: '12:45', end: '13:25' },
  { period: 7, start: '13:35', end: '14:15' },
  { period: 8, start: '14:25', end: '15:05' },
  { period: 9, start: '15:15', end: '15:55' }
];

// Fallback constant to preserve type definition without breaking existing imports
export const PERIOD_BELL_TIMES = WEDNESDAY_SCHEDULE_TIMES;

export const LUNCH_BREAK = {
  start: "12:00",
  end: "12:45",
  title: "Öğle Yemeği & Dinlenme Arası",
};

export function getLunchBreakForDay(dayIndex: number) {
  if (dayIndex === 3) {
    return {
      start: "12:00",
      end: "12:45",
      title: "Öğle Yemeği & Dinlenme Arası",
      durationMin: 45
    };
  }
  return {
    start: "12:10",
    end: "13:10",
    title: "Öğle Yemeği & Dinlenme Arası",
    durationMin: 60
  };
}

// 2. Weekly Schedule Master Data (12 G IB - Güncel)
export const WEEKLY_SCHEDULE: DaySchedule[] = [
  {
    dayIndex: 1,
    dayName: "Pazartesi",
    dayShort: "Pzt",
    periods: [
      { periodNumber: 1, startTime: "08:00", endTime: "08:40", subjectKey: "tok", defaultName: "TOK" },
      { periodNumber: 2, startTime: "09:00", endTime: "09:40", subjectKey: "physics_biology", defaultName: "Fizik / Biyoloji" },
      { periodNumber: 3, startTime: "09:50", endTime: "10:30", subjectKey: "physics_biology", defaultName: "Fizik / Biyoloji" },
      { periodNumber: 4, startTime: "10:40", endTime: "11:20", subjectKey: "math", defaultName: "Matematik" },
      { periodNumber: 5, startTime: "11:30", endTime: "12:10", subjectKey: "math", defaultName: "Matematik" },
      { periodNumber: 6, startTime: "13:10", endTime: "13:50", subjectKey: "foreign_language", defaultName: "Yabancı Dil" },
      { periodNumber: 7, startTime: "14:00", endTime: "14:40", subjectKey: "foreign_language", defaultName: "Yabancı Dil" },
      { periodNumber: 8, startTime: "14:50", endTime: "15:30", subjectKey: "religion", defaultName: "Din Kültürü" },
    ],
  },
  {
    dayIndex: 2,
    dayName: "Salı",
    dayShort: "Sal",
    periods: [
      { periodNumber: 1, startTime: "08:00", endTime: "08:40", subjectKey: "foreign_languages_lit", defaultName: "Yabancı Diller Ed." },
      { periodNumber: 2, startTime: "09:00", endTime: "09:40", subjectKey: "chemistry_digsoc_psychology", defaultName: "Kimya / DigSoc / Psikoloji" },
      { periodNumber: 3, startTime: "09:50", endTime: "10:30", subjectKey: "chemistry_digsoc_psychology", defaultName: "Kimya / DigSoc / Psikoloji" },
      { periodNumber: 4, startTime: "10:40", endTime: "11:20", subjectKey: "classic_ethics", defaultName: "Klasik Ahlak" },
      { periodNumber: 5, startTime: "11:30", endTime: "12:10", subjectKey: "physics_biology", defaultName: "Fizik / Biyoloji" },
      { periodNumber: 6, startTime: "13:10", endTime: "13:50", subjectKey: "physics_biology", defaultName: "Fizik / Biyoloji" },
      { periodNumber: 7, startTime: "14:00", endTime: "14:40", subjectKey: "math", defaultName: "Matematik" },
      { periodNumber: 8, startTime: "14:50", endTime: "15:30", subjectKey: "math", defaultName: "Matematik" },
    ],
  },
  {
    dayIndex: 3,
    dayName: "Çarşamba",
    dayShort: "Çar",
    periods: [
      { periodNumber: 1, startTime: "08:00", endTime: "08:40", subjectKey: "history_20th", defaultName: "20. Yy Türkiye" },
      { periodNumber: 2, startTime: "08:50", endTime: "09:30", subjectKey: "history_20th", defaultName: "20. Yy Türkiye" },
      { periodNumber: 3, startTime: "09:40", endTime: "10:20", subjectKey: "tok", defaultName: "TOK" },
      { periodNumber: 4, startTime: "10:30", endTime: "11:10", subjectKey: "math", defaultName: "Matematik" },
      { periodNumber: 5, startTime: "11:20", endTime: "12:00", subjectKey: "math", defaultName: "Matematik" },
      { periodNumber: 6, startTime: "12:45", endTime: "13:25", subjectKey: "pe_music", defaultName: "Beden / Müzik" },
      { periodNumber: 7, startTime: "13:35", endTime: "14:15", subjectKey: "chemistry_digsoc_psychology", defaultName: "Kimya / DigSoc / Psikoloji" },
      { periodNumber: 8, startTime: "14:25", endTime: "15:05", subjectKey: "literature", defaultName: "Edebiyat" },
      { periodNumber: 9, startTime: "15:15", endTime: "15:55", subjectKey: "literature", defaultName: "Edebiyat" },
    ],
  },
  {
    dayIndex: 4,
    dayName: "Perşembe",
    dayShort: "Per",
    periods: [
      { periodNumber: 1, startTime: "08:00", endTime: "08:40", subjectKey: "chemistry_digsoc_psychology", defaultName: "Kimya / DigSoc / Psikoloji" },
      { periodNumber: 2, startTime: "09:00", endTime: "09:40", subjectKey: "chemistry_digsoc_psychology", defaultName: "Kimya / DigSoc / Psikoloji" },
      { periodNumber: 3, startTime: "09:50", endTime: "10:30", subjectKey: "project_guidance", defaultName: "Proje / Rehberlik" },
      { periodNumber: 4, startTime: "10:40", endTime: "11:20", subjectKey: "history_20th", defaultName: "20. Yy Türkiye" },
      { periodNumber: 5, startTime: "11:30", endTime: "12:10", subjectKey: "history_20th", defaultName: "20. Yy Türkiye" },
      { periodNumber: 6, startTime: "13:10", endTime: "13:50", subjectKey: "tok", defaultName: "TOK" },
      { periodNumber: 7, startTime: "14:00", endTime: "14:40", subjectKey: "literature", defaultName: "Edebiyat" },
      { periodNumber: 8, startTime: "14:50", endTime: "15:30", subjectKey: "religion", defaultName: "Din Kültürü" },
    ],
  },
  {
    dayIndex: 5,
    dayName: "Cuma",
    dayShort: "Cum",
    periods: [
      { periodNumber: 1, startTime: "08:00", endTime: "08:40", subjectKey: "literature", defaultName: "Edebiyat" },
      { periodNumber: 2, startTime: "09:00", endTime: "09:40", subjectKey: "literature", defaultName: "Edebiyat" },
      { periodNumber: 3, startTime: "09:50", endTime: "10:30", subjectKey: "foreign_language", defaultName: "Yabancı Dil" },
      { periodNumber: 4, startTime: "10:40", endTime: "11:20", subjectKey: "foreign_language", defaultName: "Yabancı Dil" },
      { periodNumber: 5, startTime: "11:30", endTime: "12:10", subjectKey: "math", defaultName: "Matematik" },
      { periodNumber: 6, startTime: "13:10", endTime: "13:50", subjectKey: "math", defaultName: "Matematik" },
      { periodNumber: 7, startTime: "14:00", endTime: "14:40", subjectKey: "physics_biology", defaultName: "Fizik / Biyoloji" },
      { periodNumber: 8, startTime: "14:50", endTime: "15:30", subjectKey: "physics_biology", defaultName: "Fizik / Biyoloji" },
    ],
  },
];

// Helper: Normalize role string for uniform matching
const normalizeRole = (role: string): string => {
  return String(role || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
};

/**
 * 3. Dynamic Course Resolver (Role-Based Subject Parser)
 * Resolves elective blocks ("Kimya / DigSoc / Psikoloji", "Fizik / Biyoloji")
 * and appends correct SL / HL level tags based on user's active roles.
 */
export function resolveSubjectByRole(subjectKey: string, rawRoles: string[] = []): ResolvedSubject {
  const roles = (rawRoles || []).map(normalizeRole);

  // Helper detectors
  const hasRole = (...keywords: string[]) => {
    return keywords.some((kw) => roles.some((r) => r.includes(kw)));
  };

  const getRoleLevel = (groupPrefix: string, defaultLevel: "SL" | "HL" = "SL"): "SL" | "HL" => {
    for (const r of roles) {
      if (r.startsWith(groupPrefix) || r.includes(groupPrefix)) {
        if (r.endsWith("_hl") || r.includes("hl")) return "HL";
        if (r.endsWith("_sl") || r.includes("sl")) return "SL";
      }
    }
    return defaultLevel;
  };

  switch (subjectKey) {
    // -------------------------------------------------------------
    // BLOCK 1: Kimya / Digital Society / Psikoloji
    // -------------------------------------------------------------
    case "chemistry_digsoc_psychology": {
      // 1. Digital Society (HL in 12G IB or matching role)
      if (hasRole("digital_society", "digsoc", "digitalsociety")) {
        const level = getRoleLevel("digital_society", "HL");
        return {
          name: `Digital Society (${level})`,
          group: "Digital Society",
          level,
          color: "#06B6D4",
          bgColor: "bg-cyan-500/10 dark:bg-cyan-500/20",
          borderColor: "border-cyan-500/40",
          icon: "💻",
          isElective: true,
          notes: "Seçmeli Grup 3: Digital Society",
        };
      }
      // 2. Chemistry (Kimya)
      if (hasRole("chemistry", "kimya")) {
        const level = getRoleLevel("chemistry", "SL");
        return {
          name: `Kimya (${level})`,
          group: "Chemistry",
          level,
          color: "#14B8A6",
          bgColor: "bg-teal-500/10 dark:bg-teal-500/20",
          borderColor: "border-teal-500/40",
          icon: "🧪",
          isElective: true,
          notes: "Seçmeli Grup 4: Chemistry",
        };
      }
      // 3. Psychology (Psikoloji)
      if (hasRole("psychology", "psikoloji")) {
        const level = getRoleLevel("psychology", "SL");
        return {
          name: `Psikoloji (${level})`,
          group: "Psychology",
          level,
          color: "#EC4899",
          bgColor: "bg-pink-500/10 dark:bg-pink-500/20",
          borderColor: "border-pink-500/40",
          icon: "🧠",
          isElective: true,
          notes: "Seçmeli Grup 3: Psychology",
        };
      }
      // Fallback if no matching role chosen
      return {
        name: "Kimya / DigSoc / Psikoloji",
        group: "Elective Block",
        color: "#64748B",
        bgColor: "bg-slate-500/10 dark:bg-slate-500/20",
        borderColor: "border-slate-500/30",
        icon: "🔬",
        isElective: true,
        notes: "Rolünüz henüz tanımlanmamış (Profil > Rol Düzenle)",
      };
    }

    // -------------------------------------------------------------
    // BLOCK 2: Fizik / Biyoloji
    // -------------------------------------------------------------
    case "physics_biology": {
      // 1. Physics (Fizik)
      if (hasRole("physics", "fizik")) {
        const level = getRoleLevel("physics", "SL");
        return {
          name: `Fizik (${level})`,
          group: "Physics",
          level,
          color: "#A855F7",
          bgColor: "bg-purple-500/10 dark:bg-purple-500/20",
          borderColor: "border-purple-500/40",
          icon: "⚡",
          isElective: true,
          notes: "Seçmeli Fen Grubu: Physics",
        };
      }
      // 2. Biology (Biyoloji)
      if (hasRole("biology", "biyoloji")) {
        const level = getRoleLevel("biology", "SL");
        return {
          name: `Biyoloji (${level})`,
          group: "Biology",
          level,
          color: "#22C55E",
          bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
          borderColor: "border-emerald-500/40",
          icon: "🧬",
          isElective: true,
          notes: "Seçmeli Fen Grubu: Biology",
        };
      }
      // Fallback
      return {
        name: "Fizik / Biyoloji",
        group: "Elective Science Block",
        color: "#64748B",
        bgColor: "bg-slate-500/10 dark:bg-slate-500/20",
        borderColor: "border-slate-500/30",
        icon: "🔭",
        isElective: true,
        notes: "Fizik veya Biyoloji seçiminize göre gösterilir",
      };
    }

    // -------------------------------------------------------------
    // MATHEMATICS: Detect SL or HL from role
    // -------------------------------------------------------------
    case "math": {
      const level = getRoleLevel("math", "HL");
      return {
        name: `Matematik AA (${level})`,
        group: "Mathematics",
        level,
        color: "#0284C7",
        bgColor: "bg-sky-500/10 dark:bg-sky-500/20",
        borderColor: "border-sky-500/40",
        icon: "📐",
        isElective: false,
        notes: `Analysis and Approaches ${level}`,
      };
    }

    // -------------------------------------------------------------
    // LITERATURE (Turkish A): Detect SL or HL from role
    // -------------------------------------------------------------
    case "literature": {
      const level = getRoleLevel("turkish", "SL");
      return {
        name: `Türk Dili ve Edebiyatı (${level})`,
        group: "Turkish A",
        level,
        color: "#EA580C",
        bgColor: "bg-orange-500/10 dark:bg-orange-500/20",
        borderColor: "border-orange-500/40",
        icon: "📖",
        isElective: false,
        notes: `Turkish A: Literature ${level}`,
      };
    }

    // -------------------------------------------------------------
    // TOK: Theory of Knowledge
    // -------------------------------------------------------------
    case "tok": {
      return {
        name: "TOK (Bilgi Kuramı)",
        group: "TOK",
        color: "#D97706",
        bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
        borderColor: "border-amber-500/40",
        icon: "💡",
        isElective: false,
        notes: "Theory of Knowledge / Çekirdek Müfredat",
      };
    }

    // -------------------------------------------------------------
    // FOREIGN LANGUAGE: English B HL
    // -------------------------------------------------------------
    case "foreign_language": {
      return {
        name: "English B (HL)",
        group: "English",
        level: "HL",
        color: "#2563EB",
        bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
        borderColor: "border-blue-500/40",
        icon: "🌐",
        isElective: false,
        notes: "Language B: English Higher Level",
      };
    }

    // -------------------------------------------------------------
    // FOREIGN LANGUAGES LITERATURE: İkinci Yabancı Dil
    // -------------------------------------------------------------
    case "foreign_languages_lit": {
      return {
        name: "Yabancı Diller Edebiyatı",
        group: "Second Foreign Language",
        color: "#6366F1",
        bgColor: "bg-indigo-500/10 dark:bg-indigo-500/20",
        borderColor: "border-indigo-500/40",
        icon: "🗣️",
        isElective: false,
        notes: "Almanca / Fransızca / İkinci Dil Edebiyat",
      };
    }

    // -------------------------------------------------------------
    // 20. YY TÜRKİYE: T.C. İnkılap Tarihi ve Atatürkçülük (TITC)
    // -------------------------------------------------------------
    case "history_20th": {
      return {
        name: "20. Yy Türkiye (T.C. İnkılap Tarihi)",
        group: "TITC",
        color: "#E11D48",
        bgColor: "bg-rose-500/10 dark:bg-rose-500/20",
        borderColor: "border-rose-500/40",
        icon: "🏛️",
        isElective: false,
        notes: "M.E.B. Zorunlu Müfredat & T.C. İnkılap Tarihi",
      };
    }

    // -------------------------------------------------------------
    // RELIGION: Din Kültürü ve Ahlak Bilgisi
    // -------------------------------------------------------------
    case "religion": {
      return {
        name: "Din Kültürü ve Ahlak Bilgisi",
        group: "Religion",
        color: "#059669",
        bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
        borderColor: "border-emerald-500/40",
        icon: "🌙",
        isElective: false,
        notes: "M.E.B. Zorunlu Kültür Dersi",
      };
    }

    // -------------------------------------------------------------
    // CLASSIC ETHICS: Klasik Ahlak Metinleri
    // -------------------------------------------------------------
    case "classic_ethics": {
      return {
        name: "Klasik Ahlak Metinleri",
        group: "Philosophy",
        color: "#CA8A04",
        bgColor: "bg-yellow-500/10 dark:bg-yellow-500/20",
        borderColor: "border-yellow-500/40",
        icon: "📜",
        isElective: false,
        notes: "Felsefe & Ahlak Metinleri",
      };
    }

    // -------------------------------------------------------------
    // PE & MUSIC: Beden Eğitimi / Müzik
    // -------------------------------------------------------------
    case "pe_music": {
      return {
        name: "Beden Eğitimi ve Spor / Müzik",
        group: "Arts & Sports",
        color: "#16A34A",
        bgColor: "bg-green-500/10 dark:bg-green-500/20",
        borderColor: "border-green-500/40",
        icon: "⚽",
        isElective: false,
        notes: "Beden Eğitimi ve Müzik Etkinlikleri",
      };
    }

    // -------------------------------------------------------------
    // PROJECT & GUIDANCE: Proje / Rehberlik
    // -------------------------------------------------------------
    case "project_guidance": {
      return {
        name: "Proje Hazırlama / Rehberlik",
        group: "Guidance",
        color: "#7C3AED",
        bgColor: "bg-violet-500/10 dark:bg-violet-500/20",
        borderColor: "border-violet-500/40",
        icon: "🎯",
        isElective: false,
        notes: "IB EE / CAS Danışmanlığı & Sınıf Rehberliği",
      };
    }

    default:
      return {
        name: subjectKey,
        group: "General",
        color: "#64748B",
        bgColor: "bg-slate-500/10 dark:bg-slate-500/20",
        borderColor: "border-slate-500/30",
        icon: "📖",
        isElective: false,
      };
  }
}

/**
 * 4. Time Status Calculator (Past, Current, Next, Future)
 * Checks whether a given period on a given day is completed, currently active, or upcoming.
 */
export type PeriodStatus = "past" | "current" | "next" | "future";

export interface PeriodTimeStatus {
  status: PeriodStatus;
  progressPercent?: number; // 0 to 100 for current period
  remainingMinutes?: number;
  label: string;
}

export function getCurrentPeriodStatus(
  startTime: string,
  endTime: string,
  scheduleDayIndex: number, // 1 = Mon .. 5 = Fri
  customNow?: Date
): PeriodTimeStatus {
  const now = customNow || new Date();
  
  // JavaScript getDay(): 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
  const currentDayOfWeek = now.getDay();

  // If viewing a past day of the current week (e.g. today is Wed, viewing Mon)
  if (currentDayOfWeek >= 1 && currentDayOfWeek <= 5) {
    if (scheduleDayIndex < currentDayOfWeek) {
      return { status: "past", label: "Tamamlandı" };
    }
    if (scheduleDayIndex > currentDayOfWeek) {
      return { status: "future", label: "Gelecek Gün" };
    }
  } else {
    // Weekend (Sat/Sun): all upcoming for the next school week
    return { status: "future", label: "Haftaya" };
  }

  // Same day: calculate time within day
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const nowInMinutes = currentHours * 60 + currentMinutes;

  const [sH, sM] = startTime.split(":").map(Number);
  const [eH, eM] = endTime.split(":").map(Number);

  const startInMinutes = sH * 60 + sM;
  const endInMinutes = eH * 60 + eM;

  // Period has ended
  if (nowInMinutes > endInMinutes) {
    return { status: "past", label: "Tamamlandı" };
  }

  // Period is happening right now!
  if (nowInMinutes >= startInMinutes && nowInMinutes <= endInMinutes) {
    const elapsed = nowInMinutes - startInMinutes;
    const duration = endInMinutes - startInMinutes;
    const progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / duration) * 100)));
    const remainingMinutes = endInMinutes - nowInMinutes;

    return {
      status: "current",
      progressPercent,
      remainingMinutes,
      label: `Şu An (${remainingMinutes} dk kaldı)`,
    };
  }

  // If starting within next 20 minutes (or during the break immediately prior)
  if (startInMinutes - nowInMinutes <= 20 && startInMinutes - nowInMinutes > 0) {
    return {
      status: "next",
      remainingMinutes: startInMinutes - nowInMinutes,
      label: `Sırada (${startInMinutes - nowInMinutes} dk sonra)`,
    };
  }

  // Upcoming later today
  return { status: "future", label: "Gelecek Ders" };
}
