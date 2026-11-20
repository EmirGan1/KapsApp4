import {
  CEFR_META,
  MASTERY_STATUS_LABELS,
  MASTERY_TARGET,
  isCefrLevel,
  masteryStatusFromStreak,
  type StoredCefrLevel,
} from "../../shared/germanActivities";

export function MasteryPips({
  streak,
  status,
  compact = false,
  showLabel = true,
}: {
  streak: number;
  status?: string;
  compact?: boolean;
  showLabel?: boolean;
}) {
  const safeStreak = Math.max(0, Math.min(MASTERY_TARGET, streak));
  const resolvedStatus =
    status === "mastered"
      ? "mastered"
      : masteryStatusFromStreak(safeStreak, false);
  const label = MASTERY_STATUS_LABELS[resolvedStatus];
  const filledCount = resolvedStatus === "mastered" ? MASTERY_TARGET : safeStreak;

  return (
    <div
      className={`kg-mastery-pips ${compact ? "is-compact" : ""} is-${resolvedStatus}`}
      title={`${filledCount}/${MASTERY_TARGET} ardışık doğru · ${label}`}
      aria-label={`Ustalık ${filledCount} / ${MASTERY_TARGET}: ${label}`}
    >
      <div className="kg-pips-track" aria-hidden="true">
        {Array.from({ length: MASTERY_TARGET }, (_, idx) => (
          <span
            key={idx}
            className={`kg-pip ${idx < filledCount ? "is-filled" : ""}`}
          />
        ))}
      </div>
      <span className="kg-pips-count tabular-nums">
        {filledCount}/{MASTERY_TARGET}
      </span>
      {showLabel && !compact && (
        <span className="kg-pips-label">{label}</span>
      )}
    </div>
  );
}

export function CefrTag({
  level,
  size = "sm",
}: {
  level: StoredCefrLevel | string;
  size?: "sm" | "md";
}) {
  if (!isCefrLevel(level)) {
    return (
      <span className={`kg-cefr-tag is-unclassified is-${size}`}>
        Sınıflandırılmadı
      </span>
    );
  }
  const meta = CEFR_META[level];
  return (
    <span
      className={`kg-cefr-tag is-${level.toLowerCase()} is-${size}`}
      style={{ ["--cefr-color" as any]: meta.accent }}
    >
      {level}
    </span>
  );
}
