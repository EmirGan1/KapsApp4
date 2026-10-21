import { 
  FinalGradeBoundary, 
  ComponentGradeBoundary, 
  ComponentStructure, 
  HistoricalAverage,
  IBSession,
  IBTimezone,
  GradeBoundaryRecord
} from '../types';

export const IB_DATA_SOURCES: Record<string, { title: string; url: string }> = {
  S1: { title: "Starley Biology SL Boundaries", url: "https://starley.io/grade-boundaries/ib-biology-sl" },
  S2: { title: "Starley Biology HL Boundaries", url: "https://starley.io/grade-boundaries/ib-biology-hl" },
  S3: { title: "IB Predict Physics SL", url: "https://ibpredict.org/subjects/physics" },
  S4: { title: "IB Predict Chemistry SL", url: "https://ibpredict.org/subjects/chemistry" },
  S5: { title: "IB Predict Chemistry HL", url: "https://ibpredict.org/subjects/chemistry?lvl=HL" },
  S6: { title: "IB Predict Digital Society HL", url: "https://ibpredict.org/subjects/digital-society?lvl=HL" },
  S7: { title: "IB Predict Psychology SL", url: "https://ibpredict.org/subjects/psychology" },
  S8: { title: "IB Predict Math AA SL", url: "https://ibpredict.org/subjects/analysis-and-approaches" },
  S9: { title: "IB Predict Physics HL", url: "https://ibpredict.org/subjects/physics?lvl=HL" },
  S10: { title: "RevisionDojo Digital Society SL", url: "https://www.revisiondojo.com/blog/ib-digital-society-sl-grade-boundaries-2025" },
  S11: { title: "RevisionDojo Digital Society HL", url: "https://www.revisiondojo.com/blog/ib-digital-society-hl-grade-boundaries-2025" },
  S13: { title: "May 2025 Grade Boundaries Official Archive (dl.ibdocs.re)", url: "https://dl.ibdocs.re/IB%20DOCUMENTS/Grade%20Boundaries/May%202025%20Grade%20Boundaries.pdf" },
  S14: { title: "TestPrep Istanbul Math AA HL Boundaries", url: "https://www.testprepistanbul.com/ib-grade-boundaries" },
  S15: { title: "IB Predict Math AA HL", url: "https://ibpredict.org/subjects/analysis-and-approaches?lvl=HL" },
  S16: { title: "IB Predict Psychology HL", url: "https://ibpredict.org/subjects/psychology?lvl=HL" },
  S17: { title: "IB Predict English B HL", url: "https://ibpredict.org/subjects/language-b?lang=English&lvl=HL" },
  S18: { title: "IB Predict Psychology HL (2026)", url: "https://ibpredict.org/subjects/psychology?lvl=HL" },
  S19: { title: "May 2025 Grade Boundaries PDF (Component Sheets)", url: "https://dl.ibdocs.re/IB%20DOCUMENTS/Grade%20Boundaries/May%202025%20Grade%20Boundaries.pdf" },
  S20: { title: "HeLovesMath IB Psychology Grade Calculator", url: "https://helovesmath.com/ib-score-calculator/ib-psychology-grade-calculator/" }
};

/**
 * Tablo A & EK: FINAL Grade Boundaries (Weighted overall percentage minimums out of 100).
 * Note: Missing/unverified boundaries are strictly `null` (null !== 0).
 */
export const FINAL_BOUNDARIES: FinalGradeBoundary[] = [
  // 1. Turkish A Literature SL (Tablo A)
  {
    subjectKey: "turkish-a-lit",
    subjectName: "Turkish A Literature",
    level: "SL",
    session: "M25",
    timezone: "unconfirmed",
    source: "S13",
    boundaries: { 7: 81, 6: 70, 5: 60, 4: 49, 3: null, 2: null, 1: 0 }
  },
  // 2. Turkish A Literature HL (Tablo A)
  {
    subjectKey: "turkish-a-lit",
    subjectName: "Turkish A Literature",
    level: "HL",
    session: "M25",
    timezone: "unconfirmed",
    source: "S13",
    boundaries: { 7: 82, 6: 70, 5: 58, 4: 46, 3: null, 2: null, 1: 0 }
  },
  // 3. English B HL - M26 TZ1 (Tablo A & EK)
  {
    subjectKey: "english-b",
    subjectName: "English B",
    level: "HL",
    session: "M26",
    timezone: "TZ1",
    source: "S17",
    boundaries: { 7: 87, 6: 72, 5: 57, 4: 43, 3: 28, 2: 13, 1: 0 }
  },
  // English B HL - EK Variants
  {
    subjectKey: "english-b",
    subjectName: "English B",
    level: "HL",
    session: "M26",
    timezone: "TZ2",
    source: "S17",
    boundaries: { 7: 86, 6: 69, 5: 55, 4: 39, 3: 25, 2: 13, 1: 0 }
  },
  {
    subjectKey: "english-b",
    subjectName: "English B",
    level: "HL",
    session: "M26",
    timezone: "TZ3",
    source: "S17",
    boundaries: { 7: 87, 6: 71, 5: 57, 4: 41, 3: 27, 2: 13, 1: 0 }
  },
  {
    subjectKey: "english-b",
    subjectName: "English B",
    level: "HL",
    session: "N25",
    timezone: "TZ1",
    source: "S19",
    boundaries: { 7: 89, 6: 71, 5: 54, 4: 37, 3: 25, 2: 12, 1: 0 }
  },
  {
    subjectKey: "english-b",
    subjectName: "English B",
    level: "HL",
    session: "N25",
    timezone: "TZ3",
    source: "S19",
    boundaries: { 7: 90, 6: 73, 5: 57, 4: 41, 3: 27, 2: 13, 1: 0 }
  },
  {
    subjectKey: "english-b",
    subjectName: "English B",
    level: "HL",
    session: "M25",
    timezone: "TZ1",
    source: "S19",
    boundaries: { 7: 91, 6: 76, 5: 60, 4: 46, 3: 28, 2: 13, 1: 0 }
  },
  {
    subjectKey: "english-b",
    subjectName: "English B",
    level: "HL",
    session: "M25",
    timezone: "TZ2",
    source: "S19",
    boundaries: { 7: 89, 6: 73, 5: 57, 4: 41, 3: 24, 2: 11, 1: 0 }
  },
  // 4. Turkey in the 20th Century SL (TITC - Tablo A)
  {
    subjectKey: "titc",
    subjectName: "Turkey in the 20th Century",
    level: "SL",
    session: "M25",
    timezone: "unconfirmed",
    source: "S13",
    boundaries: { 7: 81, 6: 67, 5: 58, 4: 44, 3: null, 2: null, 1: 0 }
  },
  // 5. Math AA SL (Tablo A)
  {
    subjectKey: "math-aa",
    subjectName: "Mathematics: Analysis and Approaches",
    level: "SL",
    session: "M26",
    timezone: "TZ1",
    source: "S8",
    boundaries: { 7: 75, 6: 59, 5: 43, 4: 28, 3: 17, 2: 8, 1: 0 }
  },
  // 6. Math AA HL (Tablo A)
  {
    subjectKey: "math-aa",
    subjectName: "Mathematics: Analysis and Approaches",
    level: "HL",
    session: "M25",
    timezone: "unconfirmed",
    source: "S14",
    boundaries: { 7: 79, 6: 65, 5: 52, 4: 37, 3: null, 2: null, 1: 0 }
  },
  // 7. Physics SL (Tablo A)
  {
    subjectKey: "physics",
    subjectName: "Physics",
    level: "SL",
    session: "M26",
    timezone: "TZ1",
    source: "S3",
    boundaries: { 7: 67, 6: 57, 5: 46, 4: 36, 3: 22, 2: 13, 1: 0 }
  },
  // 8. Physics HL (Tablo A)
  {
    subjectKey: "physics",
    subjectName: "Physics",
    level: "HL",
    session: "M25",
    timezone: "TZ1",
    source: "S9",
    boundaries: { 7: 67, 6: 56, 5: 45, 4: 35, 3: 24, 2: 13, 1: 0 }
  },
  // 9. Digital Society SL (Tablo A)
  {
    subjectKey: "digital-society",
    subjectName: "Digital Society",
    level: "SL",
    session: "M25",
    timezone: "unspecified",
    source: "S10",
    boundaries: { 7: 67, 6: 57, 5: 47, 4: 36, 3: 23, 2: 11, 1: 0 }
  },
  // 10. Digital Society HL (Tablo A)
  {
    subjectKey: "digital-society",
    subjectName: "Digital Society",
    level: "HL",
    session: "M26",
    timezone: "TZ1",
    source: "S6",
    boundaries: { 7: 69, 6: 59, 5: 50, 4: 40, 3: 29, 2: 14, 1: 0 }
  },
  // 11. Biology SL (Tablo A)
  {
    subjectKey: "biology",
    subjectName: "Biology",
    level: "SL",
    session: "M26",
    timezone: "TZ1",
    source: "S1",
    boundaries: { 7: 77, 6: 64, 5: 51, 4: 38, 3: 26, 2: 14, 1: 0 }
  },
  // 12. Biology HL (Tablo A)
  {
    subjectKey: "biology",
    subjectName: "Biology",
    level: "HL",
    session: "M26",
    timezone: "TZ1",
    source: "S2",
    boundaries: { 7: 76, 6: 62, 5: 49, 4: 35, 3: 22, 2: 13, 1: 0 }
  },
  // 13. Chemistry SL (Tablo A)
  {
    subjectKey: "chemistry",
    subjectName: "Chemistry",
    level: "SL",
    session: "M26",
    timezone: "TZ1",
    source: "S4",
    boundaries: { 7: 73, 6: 60, 5: 48, 4: 36, 3: 26, 2: 15, 1: 0 }
  },
  // 14. Chemistry HL (Tablo A)
  {
    subjectKey: "chemistry",
    subjectName: "Chemistry",
    level: "HL",
    session: "M26",
    timezone: "TZ1",
    source: "S5",
    boundaries: { 7: 75, 6: 63, 5: 52, 4: 39, 3: 25, 2: 15, 1: 0 }
  },
  // 15. Psychology SL (Tablo A)
  {
    subjectKey: "psychology",
    subjectName: "Psychology",
    level: "SL",
    session: "M26",
    timezone: "TZ1",
    source: "S7",
    boundaries: { 7: 68, 6: 55, 5: 46, 4: 33, 3: 24, 2: 11, 1: 0 }
  },
  // 16. Psychology HL (Tablo A & EK)
  {
    subjectKey: "psychology",
    subjectName: "Psychology",
    level: "HL",
    session: "M26",
    timezone: "TZ1",
    source: "S18",
    boundaries: { 7: 70, 6: 58, 5: 46, 4: 34, 3: 22, 2: 10, 1: 0 }
  },
  {
    subjectKey: "psychology",
    subjectName: "Psychology",
    level: "HL",
    session: "M26",
    timezone: "TZ2",
    source: "S18",
    boundaries: { 7: 73, 6: 61, 5: 50, 4: 37, 3: 25, 2: 12, 1: 0 }
  },
  {
    subjectKey: "psychology",
    subjectName: "Psychology",
    level: "HL",
    session: "M26",
    timezone: "TZ3",
    source: "S18",
    boundaries: { 7: 74, 6: 61, 5: 48, 4: 35, 3: 22, 2: 10, 1: 0 }
  },
  {
    subjectKey: "psychology",
    subjectName: "Psychology",
    level: "HL",
    session: "N25",
    timezone: "TZ1",
    source: "S20",
    boundaries: { 7: 72, 6: 60, 5: 48, 4: 36, 3: 21, 2: 10, 1: 0 }
  },
  {
    subjectKey: "psychology",
    subjectName: "Psychology",
    level: "HL",
    session: "N25",
    timezone: "TZ3",
    source: "S20",
    boundaries: { 7: 73, 6: 61, 5: 49, 4: 37, 3: 23, 2: 11, 1: 0 }
  },
  {
    subjectKey: "psychology",
    subjectName: "Psychology",
    level: "HL",
    session: "M25",
    timezone: "TZ1",
    source: "S20",
    boundaries: { 7: 73, 6: 60, 5: 47, 4: 34, 3: 22, 2: 10, 1: 0 }
  },
  {
    subjectKey: "psychology",
    subjectName: "Psychology",
    level: "HL",
    session: "M25",
    timezone: "TZ2",
    source: "S20",
    boundaries: { 7: 73, 6: 60, 5: 47, 4: 33, 3: 22, 2: 10, 1: 0 }
  }
];

/**
 * Tablo B & EK: Component Grade Boundaries (RAW marks minimum).
 * These are raw component thresholds, NOT percentage minimums.
 */
export const COMPONENT_BOUNDARIES: ComponentGradeBoundary[] = [
  // Biology SL (M26, S1)
  {
    subjectKey: "biology",
    level: "SL",
    session: "M26",
    componentId: "p1a",
    componentName: "Paper 1A",
    maxMarks: 30,
    source: "S1",
    boundaries: { 7: 22, 6: 19, 5: 17, 4: 14, 3: 12, 2: 8, 1: 0 }
  },
  {
    subjectKey: "biology",
    level: "SL",
    session: "M26",
    componentId: "p1b",
    componentName: "Paper 1B",
    maxMarks: 25,
    source: "S1",
    boundaries: { 7: 18, 6: 15, 5: 11, 4: 8, 3: 5, 2: 3, 1: 0 }
  },
  {
    subjectKey: "biology",
    level: "SL",
    session: "M26",
    componentId: "p2",
    componentName: "Paper 2",
    maxMarks: 50,
    source: "S1",
    boundaries: { 7: 41, 6: 34, 5: 26, 4: 19, 3: 12, 2: 6, 1: 0 }
  },
  {
    subjectKey: "biology",
    level: "SL",
    session: "M26",
    componentId: "ia",
    componentName: "Internal Assessment",
    maxMarks: 24,
    source: "S1",
    boundaries: { 7: 20, 6: 17, 5: 14, 4: 11, 3: 7, 2: 4, 1: 0 }
  },

  // Biology HL (M26, S2)
  {
    subjectKey: "biology",
    level: "HL",
    session: "M26",
    componentId: "p1a",
    componentName: "Paper 1A",
    maxMarks: 40,
    source: "S2",
    boundaries: { 7: 32, 6: 27, 5: 23, 4: 18, 3: 16, 2: 11, 1: 0 }
  },
  {
    subjectKey: "biology",
    level: "HL",
    session: "M26",
    componentId: "p1b",
    componentName: "Paper 1B",
    maxMarks: 35,
    source: "S2",
    boundaries: { 7: 24, 6: 19, 5: 14, 4: 9, 3: 5, 2: 3, 1: 0 }
  },
  {
    subjectKey: "biology",
    level: "HL",
    session: "M26",
    componentId: "p2",
    componentName: "Paper 2",
    maxMarks: 80,
    source: "S2",
    boundaries: { 7: 61, 6: 49, 5: 38, 4: 26, 3: 14, 2: 7, 1: 0 }
  },
  {
    subjectKey: "biology",
    level: "HL",
    session: "M26",
    componentId: "ia",
    componentName: "Internal Assessment",
    maxMarks: 24,
    source: "S2",
    boundaries: { 7: 20, 6: 17, 5: 14, 4: 11, 3: 7, 2: 4, 1: 0 }
  },

  // Digital Society HL (M25, S11)
  {
    subjectKey: "digital-society",
    level: "HL",
    session: "M25",
    componentId: "ia",
    componentName: "Inquiry Project",
    maxMarks: 24,
    source: "S11",
    boundaries: { 7: 19, 6: 16, 5: 13, 4: 10, 3: 7, 2: 4, 1: 0 }
  },
  {
    subjectKey: "digital-society",
    level: "HL",
    session: "M25",
    componentId: "p1",
    componentName: "Paper 1",
    maxMarks: 52,
    source: "S11",
    boundaries: { 7: 34, 6: 29, 5: 24, 4: 19, 3: 13, 2: 7, 1: 0 }
  },
  {
    subjectKey: "digital-society",
    level: "HL",
    session: "M25",
    componentId: "p2",
    componentName: "Paper 2",
    maxMarks: 24,
    source: "S11",
    boundaries: { 7: 17, 6: 15, 5: 12, 4: 10, 3: 7, 2: 4, 1: 0 }
  },
  {
    subjectKey: "digital-society",
    level: "HL",
    session: "M25",
    componentId: "p3",
    componentName: "Paper 3",
    maxMarks: 30,
    source: "S11",
    boundaries: { 7: 25, 6: 22, 5: 20, 4: 17, 3: 10, 2: 5, 1: 0 }
  },

  // Digital Society SL (M25, S10)
  {
    subjectKey: "digital-society",
    level: "SL",
    session: "M25",
    componentId: "ia",
    componentName: "Inquiry Project",
    maxMarks: 24,
    source: "S10",
    boundaries: { 7: 19, 6: 16, 5: 13, 4: 10, 3: 7, 2: 4, 1: 0 }
  },
  {
    subjectKey: "digital-society",
    level: "SL",
    session: "M25",
    componentId: "p1",
    componentName: "Paper 1",
    maxMarks: 40,
    source: "S10",
    boundaries: { 7: 25, 6: 21, 5: 18, 4: 14, 3: 8, 2: 4, 1: 0 }
  },
  {
    subjectKey: "digital-society",
    level: "SL",
    session: "M25",
    componentId: "p2",
    componentName: "Paper 2",
    maxMarks: 24,
    source: "S10",
    boundaries: { 7: 17, 6: 15, 5: 12, 4: 10, 3: 7, 2: 4, 1: 0 }
  },

  // English B HL - 2025 Paper/Oral Raw Boundaries (TZ2, May 2025 Grade Boundaries PDF)
  {
    subjectKey: "english-b",
    level: "HL",
    session: "M25",
    componentId: "ia",
    componentName: "IA: Individual Oral",
    maxMarks: 30,
    source: "S19",
    boundaries: { 7: 27, 6: 22, 5: 18, 4: 13, 3: 7, 2: 4, 1: 0 }
  },
  {
    subjectKey: "english-b",
    level: "HL",
    session: "M25",
    componentId: "p1",
    componentName: "Paper 1: Writing",
    maxMarks: 30,
    source: "S19",
    boundaries: { 7: 27, 6: 21, 5: 16, 4: 10, 3: 6, 2: 3, 1: 0 }
  },
  {
    subjectKey: "english-b",
    level: "HL",
    session: "M25",
    componentId: "p2_listen",
    componentName: "Paper 2: Listening",
    maxMarks: 25,
    source: "S19",
    boundaries: { 7: 24, 6: 21, 5: 17, 4: 14, 3: 8, 2: 4, 1: 0 }
  },
  {
    subjectKey: "english-b",
    level: "HL",
    session: "M25",
    componentId: "p2_read",
    componentName: "Paper 2: Reading",
    maxMarks: 40,
    source: "S19",
    boundaries: { 7: 36, 6: 30, 5: 23, 4: 17, 3: 12, 2: 6, 1: 0 }
  }
];

/**
 * Bileşen yapısı (Calculator kaynakları):
 * Component weights (%) and maximum marks per syllabus.
 * Note: 2025-2026 science syllabus does NOT have Paper 3 (P1a, P1b, P2, IA only).
 */
export const COMPONENT_STRUCTURES: Record<string, ComponentStructure[]> = {
  // Digital Society HL (S6): P1 35% /52 | P2 20% /24 | P3 25% /30 | Project 20% /24
  "digital-society-hl": [
    { id: "p1", name: "Paper 1", weight: 35, maxMarks: 52 },
    { id: "p2", name: "Paper 2", weight: 20, maxMarks: 24 },
    { id: "p3", name: "Paper 3", weight: 25, maxMarks: 30 },
    { id: "ia", name: "Inquiry Project (IA)", weight: 20, maxMarks: 24, isIA: true }
  ],

  // Digital Society SL (S10): P1 45% /40 | P2 25% /24 | Project 30% /24
  "digital-society-sl": [
    { id: "p1", name: "Paper 1", weight: 45, maxMarks: 40 },
    { id: "p2", name: "Paper 2", weight: 25, maxMarks: 24 },
    { id: "ia", name: "Inquiry Project (IA)", weight: 30, maxMarks: 24, isIA: true }
  ],

  // Physics SL (S3): P1a 19% /25 | P1b 17% /20 | P2 44% /50 | IA 20% /24
  "physics-sl": [
    { id: "p1a", name: "Paper 1A", weight: 19, maxMarks: 25 },
    { id: "p1b", name: "Paper 1B", weight: 17, maxMarks: 20 },
    { id: "p2", name: "Paper 2", weight: 44, maxMarks: 50 },
    { id: "ia", name: "Internal Assessment", weight: 20, maxMarks: 24, isIA: true }
  ],

  // Physics HL (S9): P1a 19% /40 | P1b 17% /20 | P2 44% /90 | IA 20% /24
  "physics-hl": [
    { id: "p1a", name: "Paper 1A", weight: 19, maxMarks: 40 },
    { id: "p1b", name: "Paper 1B", weight: 17, maxMarks: 20 },
    { id: "p2", name: "Paper 2", weight: 44, maxMarks: 90 },
    { id: "ia", name: "Internal Assessment", weight: 20, maxMarks: 24, isIA: true }
  ],

  // Chemistry SL (S4): P1a 19% /30 | P1b 17% /25 | P2 44% /50 | IA 20% /24
  "chemistry-sl": [
    { id: "p1a", name: "Paper 1A", weight: 19, maxMarks: 30 },
    { id: "p1b", name: "Paper 1B", weight: 17, maxMarks: 25 },
    { id: "p2", name: "Paper 2", weight: 44, maxMarks: 50 },
    { id: "ia", name: "Internal Assessment", weight: 20, maxMarks: 24, isIA: true }
  ],

  // Chemistry HL (S5): P1a 19% /40 | P1b 17% /35 | P2 44% /90 | IA 20% /24
  "chemistry-hl": [
    { id: "p1a", name: "Paper 1A", weight: 19, maxMarks: 40 },
    { id: "p1b", name: "Paper 1B", weight: 17, maxMarks: 35 },
    { id: "p2", name: "Paper 2", weight: 44, maxMarks: 90 },
    { id: "ia", name: "Internal Assessment", weight: 20, maxMarks: 24, isIA: true }
  ],

  // Biology SL (S1): P1a 19% /30 | P1b 17% /25 | P2 44% /50 | IA 20% /24
  "biology-sl": [
    { id: "p1a", name: "Paper 1A", weight: 19, maxMarks: 30 },
    { id: "p1b", name: "Paper 1B", weight: 17, maxMarks: 25 },
    { id: "p2", name: "Paper 2", weight: 44, maxMarks: 50 },
    { id: "ia", name: "Internal Assessment", weight: 20, maxMarks: 24, isIA: true }
  ],

  // Biology HL (S2): P1a 19% /40 | P1b 17% /35 | P2 44% /80 | IA 20% /24
  "biology-hl": [
    { id: "p1a", name: "Paper 1A", weight: 19, maxMarks: 40 },
    { id: "p1b", name: "Paper 1B", weight: 17, maxMarks: 35 },
    { id: "p2", name: "Paper 2", weight: 44, maxMarks: 80 },
    { id: "ia", name: "Internal Assessment", weight: 20, maxMarks: 24, isIA: true }
  ],

  // Math AA SL (S8): P1 40% /80 | P2 40% /80 | IA 20% /20
  "math-aa-sl": [
    { id: "p1", name: "Paper 1", weight: 40, maxMarks: 80 },
    { id: "p2", name: "Paper 2", weight: 40, maxMarks: 80 },
    { id: "ia", name: "Math Exploration (IA)", weight: 20, maxMarks: 20, isIA: true }
  ],

  // Math AA HL (S15): P1 30% /110 | P2 30% /110 | P3 20% /55 | IA 20% /20
  "math-aa-hl": [
    { id: "p1", name: "Paper 1", weight: 30, maxMarks: 110 },
    { id: "p2", name: "Paper 2", weight: 30, maxMarks: 110 },
    { id: "p3", name: "Paper 3", weight: 20, maxMarks: 55 },
    { id: "ia", name: "Math Exploration (IA)", weight: 20, maxMarks: 20, isIA: true }
  ],

  // Psychology SL (S7): P1 50% /49 | P2 25% /22 | IA 25% /22
  "psychology-sl": [
    { id: "p1", name: "Paper 1", weight: 50, maxMarks: 49 },
    { id: "p2", name: "Paper 2", weight: 25, maxMarks: 22 },
    { id: "ia", name: "Internal Assessment", weight: 25, maxMarks: 22, isIA: true }
  ],

  // Psychology HL (S16): P1 40% /49 | P2 20% /44 | P3 20% /24 | IA 20% /22
  "psychology-hl": [
    { id: "p1", name: "Paper 1", weight: 40, maxMarks: 49 },
    { id: "p2", name: "Paper 2", weight: 20, maxMarks: 44 },
    { id: "p3", name: "Paper 3", weight: 20, maxMarks: 24 },
    { id: "ia", name: "Internal Assessment", weight: 20, maxMarks: 22, isIA: true }
  ],

  // English B HL (S19): Writing 25% / 30 | Reading 25% / 40 | Listening 25% / 25 | Individual Oral 25% / 30
  "english-b-hl": [
    { id: "p1", name: "Paper 1: Writing", weight: 25, maxMarks: 30 },
    { id: "p2_read", name: "Paper 2: Reading", weight: 25, maxMarks: 40 },
    { id: "p2_listen", name: "Paper 2: Listening", weight: 25, maxMarks: 25 },
    { id: "ia", name: "Individual Oral", weight: 25, maxMarks: 30, isIA: true }
  ],

  // Turkish A Literature SL: Paper 1 35% / 40 | Paper 2 35% / 30 | Bireysel Sözlü 30% / 40
  "turkish-a-lit-sl": [
    { id: "p1", name: "Paper 1: Rehberli Edebi Analiz", weight: 35, maxMarks: 40 },
    { id: "p2", name: "Paper 2: Karşılaştırmalı Deneme", weight: 35, maxMarks: 30 },
    { id: "ia", name: "Bireysel Sözlü (Individual Oral)", weight: 30, maxMarks: 40, isIA: true }
  ],

  // Turkish A Literature HL: Paper 1 35% / 40 | Paper 2 25% / 30 | HL Essay 20% / 20 | Bireysel Sözlü 20% / 40
  "turkish-a-lit-hl": [
    { id: "p1", name: "Paper 1: Rehberli Edebi Analiz", weight: 35, maxMarks: 40 },
    { id: "p2", name: "Paper 2: Karşılaştırmalı Deneme", weight: 25, maxMarks: 30 },
    { id: "hl_essay", name: "HL Essay (HL Denemesi)", weight: 20, maxMarks: 20 },
    { id: "ia", name: "Bireysel Sözlü (Individual Oral)", weight: 20, maxMarks: 40, isIA: true }
  ],

  // Turkey in the 20th Century SL (S13): P1 35% /24 | P2 40% /30 | IA 25% /25
  "titc-sl": [
    { id: "p1", name: "Paper 1", weight: 35, maxMarks: 24 },
    { id: "p2", name: "Paper 2", weight: 40, maxMarks: 30 },
    { id: "ia", name: "Internal Assessment", weight: 25, maxMarks: 25, isIA: true }
  ]
};

/**
 * Tablo C: Son 5 Mayıs oturumunun FINAL ortalaması (2022–2026).
 * Only Biology SL and HL have N=5 established data.
 * All other courses have N=0 and are marked as "Not established".
 */
export const HISTORICAL_AVERAGES: HistoricalAverage[] = [
  {
    subjectKey: "biology",
    level: "SL",
    yearsCount: 5,
    status: "historical FINAL only",
    averages: { 7: 77, 6: 64, 5: 51, 4: 38, 3: 25.8, 2: 14.2, 1: 0 }
  },
  {
    subjectKey: "biology",
    level: "HL",
    yearsCount: 5,
    status: "historical FINAL only",
    averages: { 7: 75.2, 6: 61.4, 5: 48.4, 4: 34.8, 3: 23.8, 2: 13.8, 1: 0 }
  },
  {
    subjectKey: "turkish-a-lit",
    level: "SL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "turkish-a-lit",
    level: "HL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "english-b",
    level: "HL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "titc",
    level: "SL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "math-aa",
    level: "SL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "math-aa",
    level: "HL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "physics",
    level: "SL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "physics",
    level: "HL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "digital-society",
    level: "SL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "digital-society",
    level: "HL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "chemistry",
    level: "SL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "chemistry",
    level: "HL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "psychology",
    level: "SL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  },
  {
    subjectKey: "psychology",
    level: "HL",
    yearsCount: 0,
    status: "Not established",
    averages: null
  }
];

// Helper functions with safe null and fallback handling
export function getFinalBoundaries(
  subjectKey: string,
  level: "SL" | "HL",
  session?: IBSession,
  timezone?: IBTimezone
): FinalGradeBoundary | undefined {
  // If specific session and timezone requested
  if (session && timezone) {
    const exact = FINAL_BOUNDARIES.find(
      b => b.subjectKey === subjectKey && b.level === level && b.session === session && b.timezone === timezone
    );
    if (exact) return exact;
  }

  // Fallback: search by session first
  if (session) {
    const sessionMatch = FINAL_BOUNDARIES.find(
      b => b.subjectKey === subjectKey && b.level === level && b.session === session
    );
    if (sessionMatch) return sessionMatch;
  }

  // General fallback: return the latest available variant
  return FINAL_BOUNDARIES.find(b => b.subjectKey === subjectKey && b.level === level);
}

export function getAllFinalVariantsForSubject(
  subjectKey: string,
  level: "SL" | "HL"
): FinalGradeBoundary[] {
  return FINAL_BOUNDARIES.filter(b => b.subjectKey === subjectKey && b.level === level);
}

export function getComponentBoundariesForSubject(
  subjectKey: string,
  level: "SL" | "HL",
  session?: IBSession
): ComponentGradeBoundary[] {
  return COMPONENT_BOUNDARIES.filter(
    b => b.subjectKey === subjectKey && b.level === level && (!session || b.session === session)
  );
}

export function getComponentStructure(subjectKey: string, level: "SL" | "HL"): ComponentStructure[] | undefined {
  const fullKey = `${subjectKey}-${level.toLowerCase()}`;
  return COMPONENT_STRUCTURES[fullKey];
}

export function getHistoricalAverage(subjectKey: string, level: "SL" | "HL"): HistoricalAverage | undefined {
  return HISTORICAL_AVERAGES.find(h => h.subjectKey === subjectKey && h.level === level);
}
