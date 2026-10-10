// FMV Ayazağa Işık Lisesi 12-IB DP 2026-2027 1. Yarıyıl
// Resmi Hafta Sonu Akademik Destek (Cumartesi Etüt) Çizelgesi

export interface SaturdayBellTime {
  periodNumber: number;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

// 1. Kesin Ders Saatleri (Blok & Teneffüs Düzeni)
export const OFFICIAL_SATURDAY_BELL_TIMES: SaturdayBellTime[] = [
  { periodNumber: 1, startTime: "08:30", endTime: "09:10" },
  { periodNumber: 2, startTime: "09:20", endTime: "10:00" },
  { periodNumber: 3, startTime: "10:10", endTime: "10:50" },
  { periodNumber: 4, startTime: "11:00", endTime: "11:40" },
  { periodNumber: 5, startTime: "11:45", endTime: "12:25" }, // 5 dakikalık hızlı geçiş
  { periodNumber: 6, startTime: "12:35", endTime: "13:15" }
];

export interface OfficialSaturdayPeriod {
  periodNumber: number;
  startTime: string;
  endTime: string;
  rawSubject: string;       // e.g. "PHYSICS SL-HL" or "BIOLOGY SL-HL / PHYSICS HL"
  defaultName: string;
  blockLabel: string;       // e.g. "Sabah Bloğu (1-3. Dersler)"
}

export interface OfficialSaturdayDateEntry {
  date: string; // YYYY-MM-DD
  displayDate: string; // DD.MM.YYYY
  periods: OfficialSaturdayPeriod[];
}

// 2. Tarih Bazlı Müfredat Eşleme Tablosu
export const OFFICIAL_SATURDAY_SCHEDULE_DATES: Record<string, OfficialSaturdayDateEntry> = {
  // 10.10.2026
  "2026-10-10": {
    date: "2026-10-10",
    displayDate: "10.10.2026",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "PHYSICS SL-HL", defaultName: "Physics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "PHYSICS SL-HL", defaultName: "Physics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "PHYSICS SL-HL", defaultName: "Physics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Öğle Bloğu" }
    ]
  },
  // 17.10.2026
  "2026-10-17": {
    date: "2026-10-17",
    displayDate: "17.10.2026",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "BIOLOGY SL-HL", defaultName: "Biology SL-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "BIOLOGY SL-HL", defaultName: "Biology SL-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "BIOLOGY SL-HL", defaultName: "Biology SL-HL", blockLabel: "Öğle Bloğu" }
    ]
  },
  // 24.10.2026
  "2026-10-24": {
    date: "2026-10-24",
    displayDate: "24.10.2026",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "TURKISH A-HL", defaultName: "Turkish A-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "TURKISH A-HL", defaultName: "Turkish A-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "TURKISH A-HL", defaultName: "Turkish A-HL", blockLabel: "Öğle Bloğu" }
    ]
  },
  // 14.11.2026
  "2026-11-14": {
    date: "2026-11-14",
    displayDate: "14.11.2026",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Öğle Bloğu" }
    ]
  },
  // 05.12.2026
  "2026-12-05": {
    date: "2026-12-05",
    displayDate: "05.12.2026",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Öğle Bloğu" }
    ]
  },
  // 12.12.2026
  "2026-12-12": {
    date: "2026-12-12",
    displayDate: "12.12.2026",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Öğle Bloğu" }
    ]
  },
  // 19.12.2026
  "2026-12-19": {
    date: "2026-12-19",
    displayDate: "19.12.2026",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "MATHEMATICS SL-HL", defaultName: "Mathematics SL-HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "CHEMISTRY SL-HL / TURKISH A-HL", defaultName: "Chemistry SL-HL / Turkish A-HL", blockLabel: "Öğle Bloğu" }
    ]
  },
  // 26.12.2026
  "2026-12-26": {
    date: "2026-12-26",
    displayDate: "26.12.2026",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "MATHEMATICS HL", defaultName: "Mathematics HL", blockLabel: "Öğle Bloğu" }
    ]
  },
  // 16.01.2027
  "2027-01-16": {
    date: "2027-01-16",
    displayDate: "16.01.2027",
    periods: [
      { periodNumber: 1, startTime: "08:30", endTime: "09:10", rawSubject: "TITC", defaultName: "TITC (T.C. İnkılap Tarihi)", blockLabel: "Sabah Bloğu" },
      { periodNumber: 2, startTime: "09:20", endTime: "10:00", rawSubject: "TITC", defaultName: "TITC (T.C. İnkılap Tarihi)", blockLabel: "Sabah Bloğu" },
      { periodNumber: 3, startTime: "10:10", endTime: "10:50", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Sabah Bloğu" },
      { periodNumber: 4, startTime: "11:00", endTime: "11:40", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 5, startTime: "11:45", endTime: "12:25", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Öğle Bloğu" },
      { periodNumber: 6, startTime: "12:35", endTime: "13:15", rawSubject: "BIOLOGY SL-HL / PHYSICS HL", defaultName: "Biology SL-HL / Physics HL", blockLabel: "Öğle Bloğu" }
    ]
  }
};

// Rol Bazlı Ders Eşleşmesi ve Seçmeli Çözümleme
export interface ResolvedOfficialSaturdaySubject {
  name: string;
  isEnrolled: boolean;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  folderTarget: string;
}

export function resolveOfficialSaturdaySubject(
  rawSubject: string,
  userRoles: string[] = []
): ResolvedOfficialSaturdaySubject {
  const normRoles = userRoles.map(r => r.toLowerCase().trim().replace(/[\s-]+/g, "_"));
  const upper = rawSubject.toUpperCase();

  // Helper check
  const hasRole = (...keywords: string[]) => {
    return normRoles.some(r => keywords.some(kw => r.includes(kw)));
  };

  // 1. PHYSICS SL-HL
  if (upper === "PHYSICS SL-HL") {
    const isEnrolled = hasRole("physics", "fizik");
    return {
      name: "Physics SL-HL",
      isEnrolled,
      color: "#8B5CF6",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-400",
      icon: "⚛️",
      folderTarget: "Physics"
    };
  }

  // 2. MATHEMATICS HL
  if (upper === "MATHEMATICS HL") {
    // If student has math_hl or general math
    const isEnrolled = hasRole("math_hl", "matematik_hl") || (hasRole("math", "matematik") && !hasRole("math_sl", "matematik_sl"));
    return {
      name: "Mathematics HL",
      isEnrolled,
      color: "#3B82F6",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-400",
      icon: "📐",
      folderTarget: "Mathematics"
    };
  }

  // 3. MATHEMATICS SL-HL
  if (upper === "MATHEMATICS SL-HL") {
    const isEnrolled = hasRole("math", "matematik");
    return {
      name: "Mathematics SL-HL",
      isEnrolled,
      color: "#2563EB",
      bgColor: "bg-blue-600/10",
      borderColor: "border-blue-500",
      icon: "📐",
      folderTarget: "Mathematics"
    };
  }

  // 4. BIOLOGY SL-HL
  if (upper === "BIOLOGY SL-HL") {
    const isEnrolled = hasRole("biology", "biyoloji");
    return {
      name: "Biology SL-HL",
      isEnrolled,
      color: "#10B981",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-400",
      icon: "🧬",
      folderTarget: "Biology"
    };
  }

  // 5. TURKISH A-HL
  if (upper === "TURKISH A-HL") {
    const isEnrolled = hasRole("turkish", "turkce", "edebiyat", "literature");
    return {
      name: "Turkish A-HL",
      isEnrolled,
      color: "#F59E0B",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-400",
      icon: "📚",
      folderTarget: "Turkish"
    };
  }

  // 6. TITC
  if (upper === "TITC") {
    // Tüm 12. sınıf öğrencileri zorunlu TITC alır
    return {
      name: "20. Yy Türkiye (TITC)",
      isEnrolled: true,
      color: "#E11D48",
      bgColor: "bg-rose-500/10",
      borderColor: "border-rose-400",
      icon: "🏛️",
      folderTarget: "TITC"
    };
  }

  // 7. SEÇMELİ BLOK: BIOLOGY SL-HL / PHYSICS HL
  if (upper.includes("BIOLOGY") && upper.includes("PHYSICS")) {
    const takesPhysics = hasRole("physics", "fizik");
    const takesBiology = hasRole("biology", "biyoloji");

    if (takesPhysics && !takesBiology) {
      return {
        name: "Physics HL (Seçmeli Grup)",
        isEnrolled: true,
        color: "#8B5CF6",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-400",
        icon: "⚛️",
        folderTarget: "Physics"
      };
    }
    if (takesBiology && !takesPhysics) {
      return {
        name: "Biology SL-HL (Seçmeli Grup)",
        isEnrolled: true,
        color: "#10B981",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-400",
        icon: "🧬",
        folderTarget: "Biology"
      };
    }
    return {
      name: "Biology SL-HL / Physics HL",
      isEnrolled: takesPhysics || takesBiology,
      color: "#6366F1",
      bgColor: "bg-indigo-500/10",
      borderColor: "border-indigo-400",
      icon: "🔬",
      folderTarget: takesPhysics ? "Physics" : "Biology"
    };
  }

  // 8. SEÇMELİ BLOK: CHEMISTRY SL-HL / TURKISH A-HL
  if (upper.includes("CHEMISTRY") && upper.includes("TURKISH")) {
    const takesChemistry = hasRole("chemistry", "kimya");
    const takesTurkish = hasRole("turkish", "edebiyat");

    if (takesChemistry && !takesTurkish) {
      return {
        name: "Chemistry SL-HL (Seçmeli Grup)",
        isEnrolled: true,
        color: "#14B8A6",
        bgColor: "bg-teal-500/10",
        borderColor: "border-teal-400",
        icon: "🧪",
        folderTarget: "Chemistry"
      };
    }
    if (takesTurkish && !takesChemistry) {
      return {
        name: "Turkish A-HL (Seçmeli Grup)",
        isEnrolled: true,
        color: "#F59E0B",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-400",
        icon: "📚",
        folderTarget: "Turkish"
      };
    }
    return {
      name: "Chemistry SL-HL / Turkish A-HL",
      isEnrolled: takesChemistry || takesTurkish,
      color: "#0D9488",
      bgColor: "bg-teal-500/10",
      borderColor: "border-teal-400",
      icon: "🧪",
      folderTarget: takesChemistry ? "Chemistry" : "Turkish"
    };
  }

  // Fallback
  return {
    name: rawSubject,
    isEnrolled: false,
    color: "#64748B",
    bgColor: "bg-slate-500/10",
    borderColor: "border-slate-400",
    icon: "📖",
    folderTarget: "Mathematics"
  };
}
