import {
  CEFR_META,
  studyLevels,
  type CefrLevel,
} from "../../shared/germanActivities";
import type { ProgressByLevelItem } from "./types";

export function CefrLevelSelector({
  selected,
  onChange,
  progressByLevel,
  singleSelect = false,
  compact = false,
}: {
  selected: CefrLevel[];
  onChange: (next: CefrLevel[]) => void;
  progressByLevel?: ProgressByLevelItem[];
  singleSelect?: boolean;
  compact?: boolean;
}) {
  const toggle = (lvl: CefrLevel) => {
    if (singleSelect) {
      onChange([lvl]);
      return;
    }
    if (selected.includes(lvl)) {
      if (selected.length <= 1) return; // Always keep at least 1 active level
      onChange(selected.filter((x) => x !== lvl));
    } else {
      const merged = [...selected, lvl];
      onChange(studyLevels.filter((x) => merged.includes(x)));
    }
  };

  return (
    <div
      className={`kg-level-selector ${compact ? "is-compact" : ""}`}
      role="group"
      aria-label="CEFR Seviye Seçimi"
    >
      {studyLevels.map((lvl) => {
        const meta = CEFR_META[lvl];
        const info = progressByLevel?.find((p) => p.level === lvl);
        const active = selected.includes(lvl);
        return (
          <button
            key={lvl}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(lvl)}
            className={`kg-level-chip ${active ? "is-active" : ""}`}
            style={{
              ["--chip-accent" as any]: meta.accent,
              ["--chip-accent-dark" as any]: meta.accentDark,
            }}
          >
            <span className="kg-level-chip-code">{lvl}</span>
            {!compact && <span className="kg-level-chip-name">{meta.trName}</span>}
            {info && (
              <span className="kg-level-chip-pct tabular-nums">
                %{Math.round(info.percent)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
