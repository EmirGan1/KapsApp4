import {
  formatTurkishPercent,
  type PersonalCefrLevel,
  type PersonalCefrSummary,
} from "../../shared/germanPersonal";

const LEVEL_COLORS: Record<PersonalCefrLevel, string> = {
  A1: "#0d9488",
  A2: "#2563eb",
  B1: "#6366f1",
  B2: "#d97706",
  C1: "#be123c",
  C2: "#7c3aed",
  UNKNOWN: "#64748b",
};

const LEVEL_LABELS: Record<PersonalCefrLevel, string> = {
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2",
  UNKNOWN: "Belirsiz",
};

export function PersonalCefrChart({
  summary,
  compact = false,
}: {
  summary: PersonalCefrSummary;
  compact?: boolean;
}) {
  if (!summary || summary.total === 0) {
    return (
      <p className="text-xs text-[var(--kg-ink-muted)] m-0">
        CEFR seviye dağılımı için henüz kelime yok.
      </p>
    );
  }

  const activeSegments = summary.breakdown.filter((b) => b.count > 0);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Stacked visual distribution bar */}
      <div
        className="w-full h-3 rounded-md overflow-hidden flex bg-[var(--kg-surface-soft)] border border-[var(--kg-border)]"
        role="img"
        aria-label={summary.summaryTr}
      >
        {activeSegments.map((seg) => (
          <div
            key={seg.level}
            style={{
              width: `${Math.max(2, seg.percent)}%`,
              backgroundColor: LEVEL_COLORS[seg.level],
            }}
            title={`${LEVEL_LABELS[seg.level]}: ${seg.count} kelime (${formatTurkishPercent(seg.percent)})`}
          />
        ))}
      </div>

      {/* Numeric breakdown grid (clean tabular data, no pill clutter) */}
      <div
        className={`grid gap-2 ${
          compact ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"
        }`}
      >
        {summary.breakdown.map((entry) => {
          const dimmed = entry.count === 0;
          return (
            <div
              key={entry.level}
              className={`flex flex-col gap-0.5 px-2.5 py-1.5 rounded-lg border border-[var(--kg-border)] bg-[var(--kg-surface-soft)] ${
                dimmed ? "opacity-45" : ""
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: LEVEL_COLORS[entry.level] }}
                  aria-hidden="true"
                />
                <span className="text-xs font-extrabold text-[var(--kg-ink)]">
                  {LEVEL_LABELS[entry.level]}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-1 tabular-nums">
                <span className="text-sm font-extrabold text-[var(--kg-ink)]">
                  {entry.count}
                </span>
                <span className="text-[11px] font-semibold text-[var(--kg-ink-muted)]">
                  {formatTurkishPercent(entry.percent)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {!compact && (
        <p className="text-xs font-medium text-[var(--kg-ink-muted)] m-0">
          {summary.summaryTr}
        </p>
      )}
    </div>
  );
}
