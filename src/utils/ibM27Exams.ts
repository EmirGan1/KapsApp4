import { COURSE_ROLES, CourseRole } from "../types";

export type ExamSession = "morning" | "afternoon";

export interface IbM27ExamPaper {
  id: string;
  date: string; // YYYY-MM-DD
  dateLabelTr: string; // e.g. "23 Nisan 2027 Cuma"
  dayNameTr: string; // e.g. "Cuma"
  session: ExamSession;
  sessionLabelTr: string; // "Sabah Oturumu" | "Öğleden Sonra Oturumu"
  startTime: string; // "09:00" | "13:00"
  duration: string; // e.g. "1s 30dk"
  subjectTitleTr: string;
  subjectTitleEn: string;
  paper: string; // e.g. "Paper 1", "Paper 1 (1A & 1B)", "Paper 2"
  level: "HL" | "SL" | "HL & SL";
  roleIds: string[]; // Matches COURSE_ROLES ids in src/types.ts
  subjectGroup: CourseRole["subjectGroup"] | "elective";
  color: string;
  notesTr?: string;
}

export interface CalendarWindowDay {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  month: 4 | 5;
  monthLabelTr: string;
  dayOfWeekIndex: number; // 0 = Pazartesi ... 6 = Pazar
  dayNameTr: string;
  dayShortTr: string;
  isWeekend: boolean;
  isOfficialHoliday?: boolean;
  holidayLabelTr?: string;
  isExamWindow: boolean;
  exams: IbM27ExamPaper[];
}

export interface ExamCountdownResult {
  targetDateIso: string;
  targetTitleTr: string;
  targetSubtitleTr: string;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isStarted: boolean;
  firstExam: IbM27ExamPaper;
}

/**
 * Official IB Diploma Programme May 2027 (M27) Examination Schedule
 * Window: Friday, 23 April 2027 – Tuesday, 18 May 2027 (Zone A / B / C Official Final Schedule)
 */
export const OFFICIAL_IB_M27_EXAMS: IbM27ExamPaper[] = [
  // ==========================================
  // CUMA, 23 NİSAN 2027 (AÇILIŞ / PRE-SESSION)
  // ==========================================
  {
    id: "m27-2027-04-23-pm-titc-p1",
    date: "2027-04-23",
    dateLabelTr: "23 Nisan 2027 Cuma",
    dayNameTr: "Cuma",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "TITC (20. Yüzyılda Türkiye / SBS)",
    subjectTitleEn: "School-based Syllabus (TITC) SL",
    paper: "Paper 1",
    level: "SL",
    roleIds: ["titc"],
    subjectGroup: "individuals",
    color: "#E11D48",
    notesTr: "Resmi IB M27 sınav döneminin ilk oturumu (School-based syllabus SL Paper 1).",
  },
  {
    id: "m27-2027-04-23-pm-langcult-p1",
    date: "2027-04-23",
    dateLabelTr: "23 Nisan 2027 Cuma",
    dayNameTr: "Cuma",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Language & Culture",
    subjectTitleEn: "Language & Culture SL",
    paper: "Paper 1",
    level: "SL",
    roleIds: [],
    subjectGroup: "language",
    color: "#64748B",
  },

  // ==========================================
  // PAZARTESİ, 26 NİSAN 2027 (1. HAFTA BAŞLANGICI)
  // ==========================================
  {
    id: "m27-2027-04-26-am-titc-p2",
    date: "2027-04-26",
    dateLabelTr: "26 Nisan 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 30dk",
    subjectTitleTr: "TITC (20. Yüzyılda Türkiye / SBS)",
    subjectTitleEn: "School-based Syllabus (TITC) SL",
    paper: "Paper 2",
    level: "SL",
    roleIds: ["titc"],
    subjectGroup: "individuals",
    color: "#E11D48",
    notesTr: "TITC SL ikinci ve son yazılı sınav kağıdı.",
  },
  {
    id: "m27-2027-04-26-pm-turkish-hl-p1",
    date: "2027-04-26",
    dateLabelTr: "26 Nisan 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 15dk",
    subjectTitleTr: "Turkish A: Literature HL",
    subjectTitleEn: "Language A Literature HL (Turkish)",
    paper: "Paper 1 (Guided Literary Analysis)",
    level: "HL",
    roleIds: ["turkish_hl"],
    subjectGroup: "language",
    color: "#EA580C",
    notesTr: "İngilizce, Fransızca ve İspanyolca dışındaki tüm Language A dersleri.",
  },
  {
    id: "m27-2027-04-26-pm-turkish-sl-p1",
    date: "2027-04-26",
    dateLabelTr: "26 Nisan 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 15dk",
    subjectTitleTr: "Turkish A: Literature SL",
    subjectTitleEn: "Language A Literature SL (Turkish)",
    paper: "Paper 1 (Guided Literary Analysis)",
    level: "SL",
    roleIds: ["turkish_sl"],
    subjectGroup: "language",
    color: "#F97316",
    notesTr: "İngilizce, Fransızca ve İspanyolca dışındaki tüm Language A dersleri.",
  },

  // ==========================================
  // SALI, 27 NİSAN 2027
  // ==========================================
  {
    id: "m27-2027-04-27-am-turkish-hl-p2",
    date: "2027-04-27",
    dateLabelTr: "27 Nisan 2027 Salı",
    dayNameTr: "Salı",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 45dk",
    subjectTitleTr: "Turkish A: Literature HL",
    subjectTitleEn: "Language A Literature HL (Turkish)",
    paper: "Paper 2 (Comparative Essay)",
    level: "HL",
    roleIds: ["turkish_hl"],
    subjectGroup: "language",
    color: "#EA580C",
  },
  {
    id: "m27-2027-04-27-am-turkish-sl-p2",
    date: "2027-04-27",
    dateLabelTr: "27 Nisan 2027 Salı",
    dayNameTr: "Salı",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 45dk",
    subjectTitleTr: "Turkish A: Literature SL",
    subjectTitleEn: "Language A Literature SL (Turkish)",
    paper: "Paper 2 (Comparative Essay)",
    level: "SL",
    roleIds: ["turkish_sl"],
    subjectGroup: "language",
    color: "#F97316",
  },
  {
    id: "m27-2027-04-27-pm-bm-p1",
    date: "2027-04-27",
    dateLabelTr: "27 Nisan 2027 Salı",
    dayNameTr: "Salı",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Business Management",
    subjectTitleEn: "Business Management HL & SL",
    paper: "Paper 1 & HL Paper 3",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },

  // ==========================================
  // ÇARŞAMBA, 28 NİSAN 2027
  // ==========================================
  {
    id: "m27-2027-04-28-am-bm-p2",
    date: "2027-04-28",
    dateLabelTr: "28 Nisan 2027 Çarşamba",
    dayNameTr: "Çarşamba",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 45dk",
    subjectTitleTr: "Business Management",
    subjectTitleEn: "Business Management HL & SL",
    paper: "Paper 2",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },
  {
    id: "m27-2027-04-28-pm-physics-hl-p1",
    date: "2027-04-28",
    dateLabelTr: "28 Nisan 2027 Çarşamba",
    dayNameTr: "Çarşamba",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 00dk",
    subjectTitleTr: "Physics HL",
    subjectTitleEn: "Physics HL",
    paper: "Paper 1 (Parts 1A & 1B)",
    level: "HL",
    roleIds: ["physics_hl"],
    subjectGroup: "sciences",
    color: "#7E22CE",
    notesTr: "Çoktan seçmeli (1A) ve veri analizi (1B) birleşik oturumu.",
  },
  {
    id: "m27-2027-04-28-pm-physics-sl-p1",
    date: "2027-04-28",
    dateLabelTr: "28 Nisan 2027 Çarşamba",
    dayNameTr: "Çarşamba",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Physics SL",
    subjectTitleEn: "Physics SL",
    paper: "Paper 1 (Parts 1A & 1B)",
    level: "SL",
    roleIds: ["physics_sl"],
    subjectGroup: "sciences",
    color: "#A855F7",
    notesTr: "Çoktan seçmeli (1A) ve veri analizi (1B) birleşik oturumu.",
  },

  // ==========================================
  // PERŞEMBE, 29 NİSAN 2027
  // ==========================================
  {
    id: "m27-2027-04-29-am-physics-hl-p2",
    date: "2027-04-29",
    dateLabelTr: "29 Nisan 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "2s 30dk",
    subjectTitleTr: "Physics HL",
    subjectTitleEn: "Physics HL",
    paper: "Paper 2",
    level: "HL",
    roleIds: ["physics_hl"],
    subjectGroup: "sciences",
    color: "#7E22CE",
  },
  {
    id: "m27-2027-04-29-am-physics-sl-p2",
    date: "2027-04-29",
    dateLabelTr: "29 Nisan 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 30dk",
    subjectTitleTr: "Physics SL",
    subjectTitleEn: "Physics SL",
    paper: "Paper 2",
    level: "SL",
    roleIds: ["physics_sl"],
    subjectGroup: "sciences",
    color: "#A855F7",
  },
  {
    id: "m27-2027-04-29-pm-psych-hl-p1",
    date: "2027-04-29",
    dateLabelTr: "29 Nisan 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 00dk",
    subjectTitleTr: "Psychology HL",
    subjectTitleEn: "Psychology HL",
    paper: "Paper 1",
    level: "HL",
    roleIds: ["psychology_hl"],
    subjectGroup: "individuals",
    color: "#BE185D",
    notesTr: "Biyolojik, bilişsel ve sosyokültürel yaklaşımlar (Paper 1).",
  },
  {
    id: "m27-2027-04-29-pm-psych-sl-p1",
    date: "2027-04-29",
    dateLabelTr: "29 Nisan 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 00dk",
    subjectTitleTr: "Psychology SL",
    subjectTitleEn: "Psychology SL",
    paper: "Paper 1",
    level: "SL",
    roleIds: ["psychology_sl"],
    subjectGroup: "individuals",
    color: "#EC4899",
    notesTr: "Biyolojik, bilişsel ve sosyokültürel yaklaşımlar (Paper 1).",
  },

  // ==========================================
  // CUMA, 30 NİSAN 2027
  // ==========================================
  {
    id: "m27-2027-04-30-am-psych-hl-p2p3",
    date: "2027-04-30",
    dateLabelTr: "30 Nisan 2027 Cuma",
    dayNameTr: "Cuma",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "3s 00dk",
    subjectTitleTr: "Psychology HL",
    subjectTitleEn: "Psychology HL",
    paper: "Paper 2 & Paper 3 (Research Methods)",
    level: "HL",
    roleIds: ["psychology_hl"],
    subjectGroup: "individuals",
    color: "#BE185D",
    notesTr: "Paper 2 (2s 00dk) ve HL Paper 3 Araştırma Yöntemleri (1s 00dk).",
  },
  {
    id: "m27-2027-04-30-am-psych-sl-p2",
    date: "2027-04-30",
    dateLabelTr: "30 Nisan 2027 Cuma",
    dayNameTr: "Cuma",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 00dk",
    subjectTitleTr: "Psychology SL",
    subjectTitleEn: "Psychology SL",
    paper: "Paper 2",
    level: "SL",
    roleIds: ["psychology_sl"],
    subjectGroup: "individuals",
    color: "#EC4899",
    notesTr: "Seçmeli psikoloji modülü yazılı sınavı (Paper 2).",
  },
  {
    id: "m27-2027-04-30-pm-cs-ess-p1",
    date: "2027-04-30",
    dateLabelTr: "30 Nisan 2027 Cuma",
    dayNameTr: "Cuma",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Computer Science / ESS",
    subjectTitleEn: "Computer Science & ESS",
    paper: "Paper 1",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "sciences",
    color: "#64748B",
  },

  // ==========================================
  // PAZARTESİ, 3 MAYIS 2027 (2. HAFTA BAŞLANGICI)
  // ==========================================
  {
    id: "m27-2027-05-03-am-cs-ess-p2",
    date: "2027-05-03",
    dateLabelTr: "3 Mayıs 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "2s 00dk",
    subjectTitleTr: "Computer Science / ESS",
    subjectTitleEn: "Computer Science & ESS",
    paper: "Paper 2 & HL Paper 3",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "sciences",
    color: "#64748B",
  },
  {
    id: "m27-2027-05-03-pm-history-p1p2",
    date: "2027-05-03",
    dateLabelTr: "3 Mayıs 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 30dk",
    subjectTitleTr: "History",
    subjectTitleEn: "History HL & SL",
    paper: "Paper 1 & Paper 2",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },

  // ==========================================
  // SALI, 4 MAYIS 2027
  // ==========================================
  {
    id: "m27-2027-05-04-am-history-p3",
    date: "2027-05-04",
    dateLabelTr: "4 Mayıs 2027 Salı",
    dayNameTr: "Salı",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "2s 30dk",
    subjectTitleTr: "History HL",
    subjectTitleEn: "History HL",
    paper: "Paper 3",
    level: "HL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },
  {
    id: "m27-2027-05-04-pm-glopol-p1p2",
    date: "2027-05-04",
    dateLabelTr: "4 Mayıs 2027 Salı",
    dayNameTr: "Salı",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "3s 00dk",
    subjectTitleTr: "Global Politics",
    subjectTitleEn: "Global Politics HL & SL",
    paper: "Paper 1 & Paper 2",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },

  // ==========================================
  // ÇARŞAMBA, 5 MAYIS 2027
  // ==========================================
  {
    id: "m27-2027-05-05-am-engb-hl-p2-listen",
    date: "2027-05-05",
    dateLabelTr: "5 Mayıs 2027 Çarşamba",
    dayNameTr: "Çarşamba",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 00dk",
    subjectTitleTr: "English B HL",
    subjectTitleEn: "English B HL",
    paper: "Paper 2 (Listening Comprehension)",
    level: "HL",
    roleIds: ["eng_b_hl"],
    subjectGroup: "language",
    color: "#2563EB",
    notesTr: "English B HL dinleme (Listening) sınavı.",
  },
  {
    id: "m27-2027-05-05-pm-chem-hl-p1",
    date: "2027-05-05",
    dateLabelTr: "5 Mayıs 2027 Çarşamba",
    dayNameTr: "Çarşamba",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 00dk",
    subjectTitleTr: "Chemistry HL",
    subjectTitleEn: "Chemistry HL",
    paper: "Paper 1 (Parts 1A & 1B)",
    level: "HL",
    roleIds: ["chemistry_hl"],
    subjectGroup: "sciences",
    color: "#0F766E",
    notesTr: "Çoktan seçmeli (1A) ve veri tabanlı sorular (1B).",
  },
  {
    id: "m27-2027-05-05-pm-chem-sl-p1",
    date: "2027-05-05",
    dateLabelTr: "5 Mayıs 2027 Çarşamba",
    dayNameTr: "Çarşamba",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Chemistry SL",
    subjectTitleEn: "Chemistry SL",
    paper: "Paper 1 (Parts 1A & 1B)",
    level: "SL",
    roleIds: ["chemistry_sl"],
    subjectGroup: "sciences",
    color: "#14B8A6",
    notesTr: "Çoktan seçmeli (1A) ve veri tabanlı sorular (1B).",
  },

  // ==========================================
  // PERŞEMBE, 6 MAYIS 2027
  // ==========================================
  {
    id: "m27-2027-05-06-am-chem-hl-p2",
    date: "2027-05-06",
    dateLabelTr: "6 Mayıs 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "2s 30dk",
    subjectTitleTr: "Chemistry HL",
    subjectTitleEn: "Chemistry HL",
    paper: "Paper 2",
    level: "HL",
    roleIds: ["chemistry_hl"],
    subjectGroup: "sciences",
    color: "#0F766E",
  },
  {
    id: "m27-2027-05-06-am-chem-sl-p2",
    date: "2027-05-06",
    dateLabelTr: "6 Mayıs 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 30dk",
    subjectTitleTr: "Chemistry SL",
    subjectTitleEn: "Chemistry SL",
    paper: "Paper 2",
    level: "SL",
    roleIds: ["chemistry_sl"],
    subjectGroup: "sciences",
    color: "#14B8A6",
  },
  {
    id: "m27-2027-05-06-pm-engb-hl-p1p2-read",
    date: "2027-05-06",
    dateLabelTr: "6 Mayıs 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 30dk",
    subjectTitleTr: "English B HL",
    subjectTitleEn: "English B HL",
    paper: "Paper 1 (Writing) & Paper 2 (Reading)",
    level: "HL",
    roleIds: ["eng_b_hl"],
    subjectGroup: "language",
    color: "#2563EB",
    notesTr: "Paper 1 Yazma (1s 30dk) ve Paper 2 Okuma-Anlama (1s 00dk).",
  },

  // ==========================================
  // CUMA, 7 MAYIS 2027
  // ==========================================
  {
    id: "m27-2027-05-07-am-enga-p2",
    date: "2027-05-07",
    dateLabelTr: "7 Mayıs 2027 Cuma",
    dayNameTr: "Cuma",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 45dk",
    subjectTitleTr: "English A Literature / L&L",
    subjectTitleEn: "English A HL & SL",
    paper: "Paper 2",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "language",
    color: "#64748B",
  },
  {
    id: "m27-2027-05-07-pm-geo-p1",
    date: "2027-05-07",
    dateLabelTr: "7 Mayıs 2027 Cuma",
    dayNameTr: "Cuma",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Geography",
    subjectTitleEn: "Geography HL & SL",
    paper: "Paper 1",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },

  // ==========================================
  // PAZARTESİ, 10 MAYIS 2027 (3. HAFTA BAŞLANGICI)
  // ==========================================
  {
    id: "m27-2027-05-10-am-geo-p2p3",
    date: "2027-05-10",
    dateLabelTr: "10 Mayıs 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "2s 15dk",
    subjectTitleTr: "Geography / Philosophy",
    subjectTitleEn: "Geography & Philosophy",
    paper: "Paper 2 & HL Paper 3",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },
  {
    id: "m27-2027-05-10-pm-bio-hl-p1",
    date: "2027-05-10",
    dateLabelTr: "10 Mayıs 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 00dk",
    subjectTitleTr: "Biology HL",
    subjectTitleEn: "Biology HL",
    paper: "Paper 1 (Parts 1A & 1B)",
    level: "HL",
    roleIds: ["biology_hl"],
    subjectGroup: "sciences",
    color: "#15803D",
    notesTr: "Çoktan seçmeli (1A) ve veri tabanlı sorular (1B).",
  },
  {
    id: "m27-2027-05-10-pm-bio-sl-p1",
    date: "2027-05-10",
    dateLabelTr: "10 Mayıs 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Biology SL",
    subjectTitleEn: "Biology SL",
    paper: "Paper 1 (Parts 1A & 1B)",
    level: "SL",
    roleIds: ["biology_sl"],
    subjectGroup: "sciences",
    color: "#22C55E",
    notesTr: "Çoktan seçmeli (1A) ve veri tabanlı sorular (1B).",
  },

  // ==========================================
  // SALI, 11 MAYIS 2027
  // ==========================================
  {
    id: "m27-2027-05-11-am-bio-hl-p2",
    date: "2027-05-11",
    dateLabelTr: "11 Mayıs 2027 Salı",
    dayNameTr: "Salı",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "2s 30dk",
    subjectTitleTr: "Biology HL",
    subjectTitleEn: "Biology HL",
    paper: "Paper 2",
    level: "HL",
    roleIds: ["biology_hl"],
    subjectGroup: "sciences",
    color: "#15803D",
  },
  {
    id: "m27-2027-05-11-am-bio-sl-p2",
    date: "2027-05-11",
    dateLabelTr: "11 Mayıs 2027 Salı",
    dayNameTr: "Salı",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 30dk",
    subjectTitleTr: "Biology SL",
    subjectTitleEn: "Biology SL",
    paper: "Paper 2",
    level: "SL",
    roleIds: ["biology_sl"],
    subjectGroup: "sciences",
    color: "#22C55E",
  },
  {
    id: "m27-2027-05-11-pm-econ-p2",
    date: "2027-05-11",
    dateLabelTr: "11 Mayıs 2027 Salı",
    dayNameTr: "Salı",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 45dk",
    subjectTitleTr: "Economics",
    subjectTitleEn: "Economics HL & SL",
    paper: "Paper 2",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },

  // ==========================================
  // ÇARŞAMBA, 12 MAYIS 2027
  // ==========================================
  {
    id: "m27-2027-05-12-am-econ-p1p3",
    date: "2027-05-12",
    dateLabelTr: "12 Mayıs 2027 Çarşamba",
    dayNameTr: "Çarşamba",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "3s 00dk",
    subjectTitleTr: "Economics",
    subjectTitleEn: "Economics HL & SL",
    paper: "Paper 1 & HL Paper 3",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "individuals",
    color: "#64748B",
  },
  {
    id: "m27-2027-05-12-pm-german-spanish-p1",
    date: "2027-05-12",
    dateLabelTr: "12 Mayıs 2027 Çarşamba",
    dayNameTr: "Çarşamba",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 15dk",
    subjectTitleTr: "German / Spanish B",
    subjectTitleEn: "German & Spanish B / Ab Initio",
    paper: "Paper 1 & Paper 2 (Reading)",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "language",
    color: "#64748B",
  },

  // ==========================================
  // PERŞEMBE, 13 MAYIS 2027
  // ==========================================
  {
    id: "m27-2027-05-13-pm-math-hl-p1",
    date: "2027-05-13",
    dateLabelTr: "13 Mayıs 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 00dk",
    subjectTitleTr: "Mathematics HL (AA / AI)",
    subjectTitleEn: "Mathematics AA / AI HL",
    paper: "Paper 1",
    level: "HL",
    roleIds: ["math_hl"],
    subjectGroup: "mathematics",
    color: "#0284C7",
    notesTr: "Mathematics Analysis & Approaches (AA) ve Applications & Interpretation (AI) HL Paper 1.",
  },
  {
    id: "m27-2027-05-13-pm-math-sl-p1",
    date: "2027-05-13",
    dateLabelTr: "13 Mayıs 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Mathematics SL (AA / AI)",
    subjectTitleEn: "Mathematics AA / AI SL",
    paper: "Paper 1",
    level: "SL",
    roleIds: ["math_sl"],
    subjectGroup: "mathematics",
    color: "#38BDF8",
    notesTr: "Mathematics Analysis & Approaches (AA) ve Applications & Interpretation (AI) SL Paper 1.",
  },
  {
    id: "m27-2027-05-13-pm-ds-hl-p1",
    date: "2027-05-13",
    dateLabelTr: "13 Mayıs 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Digital Society HL",
    subjectTitleEn: "Digital Society HL",
    paper: "Paper 1",
    level: "HL",
    roleIds: ["digital_society_hl"],
    subjectGroup: "individuals",
    color: "#0891B2",
  },
  {
    id: "m27-2027-05-13-pm-ds-sl-p1",
    date: "2027-05-13",
    dateLabelTr: "13 Mayıs 2027 Perşembe",
    dayNameTr: "Perşembe",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 30dk",
    subjectTitleTr: "Digital Society SL",
    subjectTitleEn: "Digital Society SL",
    paper: "Paper 1",
    level: "SL",
    roleIds: ["digital_society_sl"],
    subjectGroup: "individuals",
    color: "#06B6D4",
  },

  // ==========================================
  // CUMA, 14 MAYIS 2027
  // ==========================================
  {
    id: "m27-2027-05-14-am-math-hl-p2",
    date: "2027-05-14",
    dateLabelTr: "14 Mayıs 2027 Cuma",
    dayNameTr: "Cuma",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "2s 00dk",
    subjectTitleTr: "Mathematics HL (AA / AI)",
    subjectTitleEn: "Mathematics AA / AI HL",
    paper: "Paper 2 (GDC Allowed)",
    level: "HL",
    roleIds: ["math_hl"],
    subjectGroup: "mathematics",
    color: "#0284C7",
    notesTr: "Grafik hesap makinesi (GDC) kullanımı serbest.",
  },
  {
    id: "m27-2027-05-14-am-math-sl-p2",
    date: "2027-05-14",
    dateLabelTr: "14 Mayıs 2027 Cuma",
    dayNameTr: "Cuma",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 30dk",
    subjectTitleTr: "Mathematics SL (AA / AI)",
    subjectTitleEn: "Mathematics AA / AI SL",
    paper: "Paper 2 (GDC Allowed)",
    level: "SL",
    roleIds: ["math_sl"],
    subjectGroup: "mathematics",
    color: "#38BDF8",
    notesTr: "Grafik hesap makinesi (GDC) kullanımı serbest.",
  },

  // ==========================================
  // PAZARTESİ, 17 MAYIS 2027 (4. HAFTA BAŞLANGICI)
  // ==========================================
  {
    id: "m27-2027-05-17-am-ds-hl-p2p3",
    date: "2027-05-17",
    dateLabelTr: "17 Mayıs 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "2s 15dk",
    subjectTitleTr: "Digital Society HL",
    subjectTitleEn: "Digital Society HL",
    paper: "Paper 2 & Paper 3",
    level: "HL",
    roleIds: ["digital_society_hl"],
    subjectGroup: "individuals",
    color: "#0891B2",
  },
  {
    id: "m27-2027-05-17-am-ds-sl-p2",
    date: "2027-05-17",
    dateLabelTr: "17 Mayıs 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "morning",
    sessionLabelTr: "Sabah Oturumu",
    startTime: "09:00",
    duration: "1s 15dk",
    subjectTitleTr: "Digital Society SL",
    subjectTitleEn: "Digital Society SL",
    paper: "Paper 2",
    level: "SL",
    roleIds: ["digital_society_sl"],
    subjectGroup: "individuals",
    color: "#06B6D4",
  },
  {
    id: "m27-2027-05-17-pm-french-p1p2",
    date: "2027-05-17",
    dateLabelTr: "17 Mayıs 2027 Pazartesi",
    dayNameTr: "Pazartesi",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "2s 15dk",
    subjectTitleTr: "French B / Ab Initio",
    subjectTitleEn: "French B & Ab Initio",
    paper: "Paper 1 & Paper 2 (Reading)",
    level: "HL & SL",
    roleIds: [],
    subjectGroup: "language",
    color: "#64748B",
  },

  // ==========================================
  // SALI, 18 MAYIS 2027 (KAPANIŞ GÜNÜ)
  // ==========================================
  {
    id: "m27-2027-05-18-pm-math-hl-p3",
    date: "2027-05-18",
    dateLabelTr: "18 Mayıs 2027 Salı",
    dayNameTr: "Salı",
    session: "afternoon",
    sessionLabelTr: "Öğleden Sonra Oturumu",
    startTime: "13:00",
    duration: "1s 15dk",
    subjectTitleTr: "Mathematics HL (AA / AI)",
    subjectTitleEn: "Mathematics AA / AI HL",
    paper: "Paper 3",
    level: "HL",
    roleIds: ["math_hl"],
    subjectGroup: "mathematics",
    color: "#0284C7",
    notesTr: "IB M27 döneminin kapanış sınavı (Mathematics HL Paper 3).",
  },
];

const TURKISH_DAYS = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
];

const TURKISH_DAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/**
 * Checks if a given exam matches any of the user's assigned course roles.
 */
export function isExamRegisteredForUser(
  exam: IbM27ExamPaper,
  userRoles: string[]
): boolean {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return false;
  if (!exam.roleIds || exam.roleIds.length === 0) return false;

  const normalizedUserRoles = userRoles.map((r) => String(r).trim().toLowerCase());
  return exam.roleIds.some((roleId) =>
    normalizedUserRoles.includes(roleId.toLowerCase())
  );
}

/**
 * Returns the matched CourseRole objects for a given exam and user's role list.
 */
export function getMatchedRolesForExam(
  exam: IbM27ExamPaper,
  userRoles: string[]
): CourseRole[] {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return [];
  const normalizedUserRoles = userRoles.map((r) => String(r).trim().toLowerCase());
  const matchedIds = exam.roleIds.filter((id) =>
    normalizedUserRoles.includes(id.toLowerCase())
  );
  return COURSE_ROLES.filter((cr) => matchedIds.includes(cr.id));
}

/**
 * Generates the exact exam window calendar days:
 * - Second half of April 2027: 15 April 2027 – 30 April 2027
 * - First / Exam half of May 2027: 1 May 2027 – 19 May 2027
 * No earlier or later months or outside dates are included.
 */
export function getIbM27WindowDays(
  exams: IbM27ExamPaper[] = OFFICIAL_IB_M27_EXAMS
): {
  aprilSecondHalf: CalendarWindowDay[];
  mayFirstHalf: CalendarWindowDay[];
  allWindowDays: CalendarWindowDay[];
} {
  const examsByDate = new Map<string, IbM27ExamPaper[]>();
  for (const exam of exams) {
    const existing = examsByDate.get(exam.date) || [];
    existing.push(exam);
    examsByDate.set(exam.date, existing);
  }

  const buildDay = (year: number, month: 4 | 5, day: number): CalendarWindowDay => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    const jsDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const utcDay = jsDate.getUTCDay(); // 0=Sun..6=Sat
    const mondayFirstIdx = (utcDay + 6) % 7; // 0=Mon..6=Sun
    const isWeekend = utcDay === 0 || utcDay === 6;
    const isMayDay = month === 5 && day === 1;
    const isApril23 = month === 4 && day === 23;

    const dayExams = examsByDate.get(dateStr) || [];
    const isExamWindow =
      (month === 4 && day >= 23) || (month === 5 && day <= 18);

    return {
      date: dateStr,
      dayOfMonth: day,
      month,
      monthLabelTr: month === 4 ? "Nisan 2027" : "Mayıs 2027",
      dayOfWeekIndex: mondayFirstIdx,
      dayNameTr: TURKISH_DAYS[utcDay],
      dayShortTr: TURKISH_DAYS_SHORT[utcDay],
      isWeekend,
      isOfficialHoliday: isMayDay || isApril23,
      holidayLabelTr: isMayDay
        ? "1 Mayıs Emek ve Dayanışma Günü (Resmi IB Tatili — Sınav Yok)"
        : isApril23
        ? "23 Nisan Ulusal Egemenlik ve Çocuk Bayramı · IB M27 Açılış Günü"
        : undefined,
      isExamWindow,
      exams: dayExams,
    };
  };

  const aprilSecondHalf: CalendarWindowDay[] = [];
  for (let d = 15; d <= 30; d++) {
    aprilSecondHalf.push(buildDay(2027, 4, d));
  }

  const mayFirstHalf: CalendarWindowDay[] = [];
  for (let d = 1; d <= 19; d++) {
    mayFirstHalf.push(buildDay(2027, 5, d));
  }

  return {
    aprilSecondHalf,
    mayFirstHalf,
    allWindowDays: [...aprilSecondHalf, ...mayFirstHalf],
  };
}

/**
 * Parses an exam's date + startTime into a timestamp (Istanbul UTC+3 by default).
 */
export function getExamTimestampMs(exam: IbM27ExamPaper): number {
  const [hourStr, minStr] = (exam.startTime || "09:00").split(":");
  const hh = String(Number(hourStr || 9)).padStart(2, "0");
  const mm = String(Number(minStr || 0)).padStart(2, "0");
  return new Date(`${exam.date}T${hh}:${mm}:00+03:00`).getTime();
}

/**
 * Calculates live countdown to the first official IB M27 exam (or first registered exam).
 */
export function getFirstExamCountdown(
  nowMs: number = Date.now(),
  exams: IbM27ExamPaper[] = OFFICIAL_IB_M27_EXAMS,
  onlyRegisteredForRoles?: string[]
): ExamCountdownResult {
  let pool = [...exams];
  if (onlyRegisteredForRoles && onlyRegisteredForRoles.length > 0) {
    const registered = pool.filter((e) =>
      isExamRegisteredForUser(e, onlyRegisteredForRoles)
    );
    if (registered.length > 0) {
      pool = registered;
    }
  }

  pool.sort((a, b) => getExamTimestampMs(a) - getExamTimestampMs(b));
  const firstExam = pool[0] || OFFICIAL_IB_M27_EXAMS[0];
  const targetMs = getExamTimestampMs(firstExam);
  const diffMs = Math.max(0, targetMs - nowMs);
  const isStarted = nowMs >= targetMs;

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    targetDateIso: `${firstExam.date}T${firstExam.startTime}:00+03:00`,
    targetTitleTr: `${firstExam.subjectTitleTr} — ${firstExam.paper}`,
    targetSubtitleTr: `${firstExam.dateLabelTr} · ${firstExam.sessionLabelTr} (${firstExam.startTime})`,
    totalMs: diffMs,
    days,
    hours,
    minutes,
    seconds,
    isStarted,
    firstExam,
  };
}
