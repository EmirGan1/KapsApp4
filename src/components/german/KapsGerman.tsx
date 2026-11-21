import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Compass,
  Dumbbell,
  Flame,
  Sparkles,
  User,
} from "lucide-react";
import {
  type CefrLevel,
  type DistractorDifficulty,
  type SatzbauMode,
  type StudyDirection,
} from "../../shared/germanActivities";
import {
  createPersonalizedReinforcement,
  fetchAccess,
  fetchOverview,
  saveStudyPreferences,
  startStudySession,
} from "./api";
import { ExerciseRunner } from "./ExerciseRunner";
import { HomeLearnView } from "./HomeLearnView";
import { PracticeHubView } from "./PracticeHubView";
import { ProfileAdminView } from "./ProfileAdminView";
import { ProgressDashboardView } from "./ProgressDashboardView";
import type { GermanTab, OverviewResponse } from "./types";
import { VocabularyLibraryView } from "./VocabularyLibraryView";
import "./german.css";

function normalizeTab(raw: string | null): GermanTab {
  switch (raw) {
    case "practice":
    case "goethe":
      return "practice";
    case "words":
    case "vocabulary":
      return "words";
    case "progress":
    case "history":
      return "progress";
    case "profile":
    case "admin":
      return "profile";
    default:
      return "learn";
  }
}

const NAV_ITEMS: Array<{ id: GermanTab; label: string; icon: any }> = [
  { id: "learn", label: "Öğren", icon: Compass },
  { id: "practice", label: "Pratik", icon: Dumbbell },
  { id: "words", label: "Kelimeler", icon: BookOpen },
  { id: "progress", label: "İlerleme", icon: BarChart3 },
  { id: "profile", label: "Profil", icon: User },
];

export default function KapsGerman() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const activeTab = normalizeTab(params.get("tab"));
  const sessionId = params.get("session");

  const [access, setAccess] = useState<{ admin: boolean } | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [selectedLevels, setSelectedLevels] = useState<CefrLevel[]>(["A1"]);
  const [direction, setDirection] = useState<StudyDirection>("tr_de");
  const [difficulty, setDifficulty] = useState<DistractorDifficulty>("adaptive");
  const [dailyGoalXp, setDailyGoalXp] = useState<number>(50);
  const [showTurkishPronunciation, setShowTurkishPronunciation] = useState<boolean>(true);
  const [autoSessionReview, setAutoSessionReview] = useState<boolean>(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [vocabLevelFilter, setVocabLevelFilter] = useState<string>("ALL");

  const refreshOverview = useCallback(async () => {
    const data = await fetchOverview(true);
    setOverview(data);
    if (!prefsLoaded && data.stats) {
      if (data.stats.selectedLevels?.length) {
        setSelectedLevels(data.stats.selectedLevels);
      }
      if (data.stats.preferredDirection) {
        setDirection(data.stats.preferredDirection);
      }
      if (data.stats.distractorDifficulty) {
        setDifficulty(data.stats.distractorDifficulty);
      }
      if (data.stats.dailyGoalXp) {
        setDailyGoalXp(data.stats.dailyGoalXp);
      }
      if (typeof data.stats.showTurkishPronunciation === "boolean") {
        setShowTurkishPronunciation(data.stats.showTurkishPronunciation);
      }
      if (typeof data.stats.autoSessionReview === "boolean") {
        setAutoSessionReview(data.stats.autoSessionReview);
      }
      setPrefsLoaded(true);
    }
  }, [prefsLoaded]);

  useEffect(() => {
    let alive = true;
    fetchAccess()
      .then((a) => {
        if (!alive) return;
        setAccess(a);
        return refreshOverview();
      })
      .catch((e: any) => {
        if (alive) setError(e?.message || "Kaps German yüklenemedi.");
      });
    return () => {
      alive = false;
    };
  }, [refreshOverview]);

  const goTab = (tab: GermanTab) => {
    setError("");
    navigate(`/dersler/kaps-german?tab=${tab}`);
  };

  const handleChangeLevels = (next: CefrLevel[]) => {
    setSelectedLevels(next);
    void saveStudyPreferences({ selectedLevels: next }).catch(() => {});
  };

  const handleChangeDirection = (next: StudyDirection) => {
    setDirection(next);
    void saveStudyPreferences({ preferredDirection: next }).catch(() => {});
  };

  const handleChangeDifficulty = (next: DistractorDifficulty) => {
    setDifficulty(next);
    void saveStudyPreferences({ distractorDifficulty: next }).catch(() => {});
  };

  const handleChangeDailyGoal = (xp: number) => {
    setDailyGoalXp(xp);
    void saveStudyPreferences({ dailyGoalXp: xp })
      .then(() => refreshOverview())
      .catch(() => {});
  };

  const handleTogglePronunciation = (next: boolean) => {
    setShowTurkishPronunciation(next);
    void saveStudyPreferences({ showTurkishPronunciation: next }).catch(() => {});
  };

  const handleToggleAutoSessionReview = (next: boolean) => {
    setAutoSessionReview(next);
    void saveStudyPreferences({ autoSessionReview: next }).catch(() => {});
  };

  const handleStartSession = async (opts: {
    module?: string;
    mode?: "practice" | "exam";
    activity?: string;
    levels?: CefrLevel[];
    topic?: string;
    categoryId?: string;
    unitId?: string;
    difficulty?: DistractorDifficulty;
    satzbauMode?: SatzbauMode | "mixed";
    wordIds?: string[];
    reviewMode?: boolean;
  }) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await startStudySession({
        module: opts.module ?? "vocabulary",
        mode: opts.mode ?? "practice",
        activity: opts.activity ?? "mixed",
        direction,
        levels: opts.levels ?? selectedLevels,
        topic: opts.topic,
        categoryId: opts.categoryId,
        unitId: opts.unitId,
        difficulty: opts.difficulty ?? difficulty,
        satzbauMode: opts.satzbauMode === "mixed" ? undefined : opts.satzbauMode,
        wordIds: opts.wordIds,
        reviewMode: opts.reviewMode,
      });
      navigate(`/dersler/kaps-german?tab=${activeTab}&session=${encodeURIComponent(created.id)}`);
    } catch (e: any) {
      setError(e?.message || "Oturum başlatılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const handleStartPersonalizedReinforcement = async (opts: {
    levels: CefrLevel[];
    direction: StudyDirection;
    includeMasteredReview: boolean;
  }) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const created = await createPersonalizedReinforcement({
        levels: opts.levels,
        direction: opts.direction,
        includeMasteredReview: opts.includeMasteredReview,
      });
      navigate(
        `/dersler/kaps-german?tab=${activeTab}&session=${encodeURIComponent(created.sessionId)}`,
      );
    } catch (e: any) {
      setError(e?.message || "Kişiselleştirilmiş pekiştirme oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };

  if (error && !access) {
    return (
      <div className="kg">
        <div className="kg-container" style={{ maxWidth: 620 }}>
          <div className="kg-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h1 className="kg-section-title">Kaps German Erişimi</h1>
            <p className="kg-section-sub">{error}</p>
            <div>
              <Link to="/dersler" className="kg-back-link">
                <ArrowLeft size={16} /> Derslere Dön
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (sessionId) {
    return (
      <main className="kg" aria-label="Kaps German Oturum">
        <ExerciseRunner
          sessionId={sessionId}
          showTurkishPronunciation={showTurkishPronunciation}
          autoSessionReview={autoSessionReview}
          onExit={() => {
            void refreshOverview();
            navigate(`/dersler/kaps-german?tab=${activeTab}`);
          }}
          onOverviewChanged={() => {
            void refreshOverview();
          }}
          onOpenSession={(sid) => {
            navigate(`/dersler/kaps-german?tab=${activeTab}&session=${encodeURIComponent(sid)}`);
          }}
          onRestartSimilar={(filters: any, mod) => {
            void handleStartSession({
              module: mod,
              activity: filters?.activity ?? "mixed",
              levels: filters?.levels?.length ? filters.levels : selectedLevels,
              topic: filters?.topic,
              categoryId: filters?.categoryId,
              unitId: filters?.unitId,
              difficulty: filters?.difficulty ?? difficulty,
              satzbauMode: filters?.satzbauMode,
              reviewMode: filters?.reviewMode,
            });
          }}
        />
      </main>
    );
  }

  return (
    <div className="kg">
      {/* Unified Header */}
      <header className="kg-topbar">
        <div className="kg-topbar-left">
          <Link to="/dersler" className="kg-back-link">
            <ArrowLeft size={15} />
            <span>Dersler</span>
          </Link>
          <div className="kg-brand">
            <span className="kg-brand-mark" aria-hidden="true">
              DE
            </span>
            <div className="kg-brand-text">
              <span className="kg-brand-title">Kaps German</span>
              <span className="kg-brand-sub">CEFR A1–C1 Almanca</span>
            </div>
          </div>
        </div>

        <nav className="kg-desktop-nav" aria-label="Kaps German sekmeleri">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={activeTab === item.id ? "page" : undefined}
                className={`kg-nav-btn ${activeTab === item.id ? "is-active" : ""}`}
                onClick={() => goTab(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="kg-topbar-stats">
          {overview && (
            <>
              <span className="kg-stat-chip is-streak tabular-nums" title="Günlük seri">
                <Flame size={15} />
                {overview.stats.currentStreak}
              </span>
              <span className="kg-stat-chip is-xp tabular-nums" title="Toplam XP">
                <Sparkles size={15} />
                {overview.stats.totalXp} XP
              </span>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="kg-scroll" aria-label="Kaps German">
        {error && (
          <div className="kg-container" style={{ paddingBottom: 0 }}>
            <div className="kg-alert" role="alert">
              <span>{error}</span>
            </div>
          </div>
        )}

        {!overview ? (
          <div className="kg-container">
            <div className="kg-card" role="status">
              Kaps German hazırlanıyor…
            </div>
          </div>
        ) : (
          <>
            {activeTab === "learn" && (
              <HomeLearnView
                overview={overview}
                selectedLevels={selectedLevels}
                onChangeLevels={handleChangeLevels}
                onStartSession={(opts) => void handleStartSession(opts)}
                onOpenProgress={() => goTab("progress")}
                busy={busy}
              />
            )}

            {activeTab === "practice" && (
              <PracticeHubView
                overview={overview}
                selectedLevels={selectedLevels}
                direction={direction}
                difficulty={difficulty}
                onChangeLevels={handleChangeLevels}
                onChangeDirection={handleChangeDirection}
                onChangeDifficulty={handleChangeDifficulty}
                onStartSession={(opts) => void handleStartSession(opts)}
                onStartPersonalizedReinforcement={(opts) =>
                  void handleStartPersonalizedReinforcement(opts)
                }
                busy={busy}
              />
            )}

            {activeTab === "words" && (
              <VocabularyLibraryView
                isAdmin={Boolean(access?.admin)}
                initialLevel={vocabLevelFilter}
                showTurkishPronunciation={showTurkishPronunciation}
                onTogglePronunciation={handleTogglePronunciation}
                onPracticeSelected={(wordIds, lvls) =>
                  void handleStartSession({
                    activity: "mixed",
                    wordIds,
                    levels: lvls,
                  })
                }
                onOverviewChanged={() => void refreshOverview()}
              />
            )}

            {activeTab === "progress" && (
              <ProgressDashboardView
                overview={overview}
                busy={busy}
                onStartLevel={(lvl) => {
                  setSelectedLevels([lvl]);
                  void saveStudyPreferences({ selectedLevels: [lvl] }).catch(() => {});
                  void handleStartSession({ activity: "mixed", levels: [lvl] });
                }}
                onProgressReset={() => void refreshOverview()}
              />
            )}

            {activeTab === "profile" && (
              <ProfileAdminView
                overview={overview}
                isAdmin={Boolean(access?.admin)}
                dailyGoalXp={dailyGoalXp}
                showTurkishPronunciation={showTurkishPronunciation}
                autoSessionReview={autoSessionReview}
                onChangeDailyGoal={handleChangeDailyGoal}
                onTogglePronunciation={handleTogglePronunciation}
                onToggleAutoSessionReview={handleToggleAutoSessionReview}
                onResumeSession={(sid) =>
                  navigate(`/dersler/kaps-german?tab=profile&session=${encodeURIComponent(sid)}`)
                }
                onOverviewChanged={() => void refreshOverview()}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="kg-mobile-nav" aria-label="Kaps German mobil menüsü">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={activeTab === item.id ? "page" : undefined}
              className={`kg-mobile-tab ${activeTab === item.id ? "is-active" : ""}`}
              onClick={() => {
                if (item.id === "words") setVocabLevelFilter("ALL");
                goTab(item.id);
              }}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
