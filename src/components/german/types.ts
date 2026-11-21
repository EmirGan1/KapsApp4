import type {
  CefrLevel,
  DistractorDifficulty,
  MasteryStatus,
  SatzbauMode,
  StoredCefrLevel,
  StudyDirection,
} from "../../shared/germanActivities";

export type GermanTab = "learn" | "practice" | "words" | "progress" | "profile";

export interface PronunciationGuide {
  ipa: string;
  turkishApprox: string;
  syllables: string[];
  stressSyllable: number;
  notesTr: string;
  source: "curated" | "admin" | "ai_needs_review" | "estimated";
  verified: boolean;
}

export interface MasteryRecord {
  wordId: string;
  cefrLevel: StoredCefrLevel;
  consecutiveCorrect: number;
  totalCorrect: number;
  totalIncorrect: number;
  masteryStatus: MasteryStatus;
  lastPracticedAt: string | null;
  masteredAt: string | null;
}

export interface CurriculumUnitNode {
  id: string;
  categoryId: string;
  level: CefrLevel;
  unitNumber: number;
  titleTr: string;
  titleDe: string;
  objectiveTr: string;
  estimatedMinutes: number;
  wordIds: string[];
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  mistakeWords: number;
  percent: number;
  status: "completed" | "in_progress" | "not_started";
}

export interface CurriculumCategoryNode {
  id: string;
  level: CefrLevel;
  order: number;
  titleTr: string;
  titleDe: string;
  descriptionTr: string;
  icon: string;
  accentColor: string;
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  mistakeWords: number;
  percent: number;
  totalUnits: number;
  completedUnits: number;
  status: "completed" | "in_progress" | "not_started";
  units: CurriculumUnitNode[];
}

export interface ProgressByLevelItem {
  level: CefrLevel;
  trName: string;
  enName: string;
  subtitle: string;
  accent: string;
  total: number;
  mastered: number;
  almostMastered: number;
  learning: number;
  notLearned: number;
  mistakes: number;
  remaining: number;
  percent: number;
  statusText: string;
  totalCategories?: number;
  totalUnits?: number;
  completedUnits?: number;
}

export interface GermanStats {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDay: string | null;
  dailyGoalXp: number;
  todayXp: number;
  todayWordsMastered: number;
  todayExercises: number;
  todayCorrect: number;
  todayTotal: number;
  selectedLevels: CefrLevel[];
  preferredDirection: StudyDirection;
  distractorDifficulty?: DistractorDifficulty;
  perfectLessons: number;
  showTurkishPronunciation?: boolean;
  autoSessionReview?: boolean;
}

export interface OverallSummary {
  totalValidated: number;
  totalMastered: number;
  totalAlmostMastered: number;
  totalLearning: number;
  totalNotLearned: number;
  totalMistakeWords: number;
  unclassifiedCount: number;
  percent: number;
  accuracy: number | null;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  target: number;
  metric: string;
  current: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface LearningPathNode {
  id: string;
  level: CefrLevel;
  order: number;
  topic: string;
  categoryId?: string;
  unitId?: string;
  totalWords: number;
  masteredWords: number;
  percent: number;
  status: "completed" | "current" | "available" | "review";
}

export interface LearningPathLevel {
  level: CefrLevel;
  nodes: LearningPathNode[];
}

export interface SessionSummaryRow {
  id: string;
  module: string;
  mode: "practice" | "exam";
  state: "active" | "grading" | "done";
  started_at: string;
  deadline: string;
  parent_session_id?: string | null;
  reinforcement_direction?: string | null;
  results: Record<string, TaskResult>;
  filters: {
    levels?: CefrLevel[];
    activity?: string;
    direction?: StudyDirection;
    topic?: string;
    categoryId?: string;
    unitId?: string;
    difficulty?: DistractorDifficulty;
    satzbauMode?: SatzbauMode;
    reviewMode?: boolean;
    parentSessionId?: string;
    reinforcementDirection?: StudyDirection;
  };
}

export interface JobRow {
  id: string;
  started_at: string;
  finished_at?: string | null;
  status: string;
  summary?: string | null;
}

export interface ReportReasonOption {
  id: string;
  labelTr: string;
}

export interface OverviewResponse {
  progressByLevel: ProgressByLevelItem[];
  curriculumHierarchy?: Record<CefrLevel, CurriculumCategoryNode[]>;
  overall: OverallSummary;
  stats: GermanStats;
  achievements: AchievementItem[];
  learningPath: LearningPathLevel[];
  sessions: SessionSummaryRow[];
  jobs: JobRow[];
  examStructure: Record<string, any>;
  audioAvailable: boolean;
  pronunciationAvailable: boolean;
  reportReasons?: ReportReasonOption[];
}

export interface VocabItem {
  id: string;
  de: string;
  tr: string;
  level: StoredCefrLevel;
  cefrSource: string;
  topic: string;
  categoryId?: string;
  unitId?: string;
  subtopic?: string;
  semanticTags?: string[];
  article?: string;
  plural?: string;
  pos?: string;
  grammar?: string;
  exampleDe?: string;
  exampleTr?: string;
  pronunciation?: PronunciationGuide;
  mastery: MasteryRecord;
}

export interface VocabularyResponse {
  items: VocabItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  topics: string[];
  categories?: Array<{ categoryId: string; titleTr: string; count: number }>;
}

export interface VocabularyCardDetail {
  id: string;
  de: string;
  tr: string;
  level: string;
  pos?: string;
  article?: string;
  plural?: string;
  topic: string;
  grammar: string;
  exampleDe?: string;
  exampleTr?: string;
  extraExample?: { de: string; tr: string } | null;
  grammarNoteTr?: string;
  usageTipTr?: string;
  conjugationSummaryTr?: string;
  pronunciation: PronunciationGuide;
  enrichedByAI: boolean;
}

export interface SatzbauReviewResult {
  needsReview?: boolean;
  isValid: boolean;
  score: number;
  feedbackTr: string;
  correctedSentenceDe: string;
  alternativeSentenceDe: string;
  grammarRuleTr: string;
  targetWordUsed: boolean;
  wordOrderValid: boolean;
  source: "deterministic" | "ai" | "cache";
  isCorrect?: boolean;
  correctedDe?: string;
  alternativeDe?: string;
  grammarExplanationTr?: string;
  ruleTipTr?: string;
}

export interface LevelAudioPackItem {
  wordId: string;
  de: string;
  tr: string;
  normalUrl: string;
  slowUrl: string;
  cachedNormal: boolean;
  cachedSlow: boolean;
  byteSizeNormal: number;
}

export interface LevelAudioPackManifest {
  level: CefrLevel;
  totalWords: number;
  cachedCount: number;
  estimatedBytes: number;
  items: LevelAudioPackItem[];
}

export interface GermanTask {
  id: string;
  module: string;
  type: string;
  activity?: string;
  part: number;
  level: string;
  topic?: string;
  direction?: "de_tr" | "tr_de" | "de_only";
  objective?: string;
  isMistakeReview?: boolean;
  pairVocabularyIds?: string[];
  prompt: string;
  subPrompt?: string;
  hint?: string;
  passage: string;
  options: string[];
  answer?: string;
  expected?: string;
  alternatives?: string[];
  explanation?: string;
  vocabularyIds: string[];
  evidence?: string;
  satzbauMode?: SatzbauMode;
  wordBank?: string[];
  distractorWords?: string[];
  targetWordDe?: string;
  targetWordTr?: string;
  turkishPromptSentence?: string;
  flawedSentenceDe?: string;
  grammarExplanationTr?: string;
  grammarFocus?: string;
  audioText?: string;
  pronunciation?: PronunciationGuide;
  interaction?: {
    tiles?: string[];
    left?: string[];
    right?: string[];
    audioText?: string;
    audioLang?: string;
    hintTr?: string;
    wordMeta?: {
      de: string;
      tr: string;
      article?: string;
      topic?: string;
      grammar?: string;
      exampleDe?: string;
      exampleTr?: string;
      pronunciation?: PronunciationGuide;
    };
  };
}

export interface DiffSegment {
  type: "equal" | "removed" | "added";
  text: string;
}

export interface SchreibenCriterionEvaluation {
  band: "gut" | "solide" | "ausbaufähig";
  noteTr: string;
  evidence?: string;
}

export interface SchreibenEvaluationResult {
  score: number;
  confidence?: number;
  unofficialPracticeEstimate?: boolean;
  disclaimerTr?: string;
  cefrLevel?: string;
  taskPart?: number;
  feedback?: string;
  overallEvaluationTr?: string;
  strengths?: string[];
  grammarMistakes?: Array<{
    original: string;
    correction: string;
    explanationTr: string;
    category: string;
  }>;
  vocabularyImprovements?: Array<{
    original: string;
    better: string;
    reasonTr: string;
  }>;
  missedRequirements?: string[];
  correctedVersion?: string;
  suggestedAnswer?: string;
  tips?: string[];
  criteria?: {
    aufgabenerfuellung?: SchreibenCriterionEvaluation;
    kohaerenz?: SchreibenCriterionEvaluation;
    wortschatz?: SchreibenCriterionEvaluation;
    strukturen?: SchreibenCriterionEvaluation;
  };
  diffSegments?: DiffSegment[];
  originalSubmission?: string;
  provider?: string;
  model?: string;
}

export interface TaskResult extends Partial<Omit<SchreibenEvaluationResult, "score">> {
  score: number | null;
  skipped?: boolean;
  feedback?: string;
  suggestedAnswer?: string;
  pending?: boolean;
  unofficial?: boolean;
}

export interface MistakeExplanationResponse {
  headlineTr: string;
  whyWrongOrRightTr: string;
  correctMeaningTr: string;
  ruleTr: string;
  example: { de: string; tr: string };
  memoryTipTr: string;
  detailedNoteTr?: string;
  possibleQuestionIssue: boolean;
  cached: boolean;
  provider: string;
  fallbackUsed: boolean;
}

export interface SessionPerformanceReview {
  overallSummaryTr: string;
  strongestAreas: string[];
  areasNeedingPractice: string[];
  topActions: string[];
  recommendedFollowUp: {
    titleTr: string;
    reasonTr: string;
    suggestedActivity: string;
    levels: CefrLevel[];
  };
  limitedEvidence: boolean;
  metrics: {
    evaluatedCount: number;
    correctCount: number;
    wrongCount: number;
    skippedCount: number;
    accuracy: number;
    weakWords: Array<{ de: string; tr: string }>;
    strongWords: Array<{ de: string; tr: string }>;
    errorTypes: Record<string, number>;
  };
  cached: boolean;
  provider: string;
  fallbackUsed: boolean;
}

export interface QuestionReportItem {
  id: string;
  taskFingerprint: string;
  taskId: string;
  wordId: string;
  exerciseType: string;
  level: string;
  sessionId: string;
  userId: number;
  username?: string;
  reason: string;
  comment: string;
  taskSnapshot: GermanTask;
  currentAnswer: string;
  studentAnswer: string;
  status: string;
  aiReview?: any;
  adminNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface QuestionAuditItem {
  taskFingerprint: string;
  taskId: string;
  module: string;
  level: string;
  auditStatus: "approved" | "needs_review" | "rejected";
  deterministicIssues: Array<{ code: string; severity: string; messageTr: string }>;
  aiReview?: {
    verdict: string;
    summaryTr: string;
    detectedProblems: string[];
    suggestedFix?: {
      prompt?: string;
      answer?: string;
      options?: string[];
      explanation?: string;
    } | null;
  } | null;
  suggestedCorrection?: any;
  taskSnapshot?: GermanTask | null;
  auditedAt: string;
  reviewedAt?: string | null;
}

export interface ActiveSession {
  id: string;
  module: string;
  mode: "practice" | "exam";
  state: "active" | "grading" | "done";
  started_at: string;
  deadline: string;
  version: number;
  position: number;
  parentSessionId?: string | null;
  reinforcementDirection?: StudyDirection | null;
  reinforcementSession?: {
    id: string;
    state: "active" | "grading" | "done";
    direction: StudyDirection | null;
  } | null;
  filters: {
    levels?: CefrLevel[];
    activity?: string;
    direction?: StudyDirection;
    topic?: string;
    wordIds?: string[];
    reviewMode?: boolean;
    parentSessionId?: string;
    reinforcementDirection?: StudyDirection;
    aiGeneratedCount?: number;
  };
  tasks: GermanTask[];
  answers: Record<string, string>;
  results: Record<string, TaskResult>;
  masteryMap: Record<string, MasteryRecord>;
  sessionReview?: SessionPerformanceReview | null;
  serverNow: string;
}

export interface CheckTaskResponse {
  ok: boolean;
  skipped?: boolean;
  alreadyChecked?: boolean;
  result: TaskResult;
  masteryUpdates: Record<string, MasteryRecord>;
  xpAwarded: number;
  newlyMastered: Array<{ wordId: string; de: string; tr: string; level: string }>;
  newlyUnlockedAchievements: string[];
  version: number;
}
