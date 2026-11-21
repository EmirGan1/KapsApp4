import { useEffect, useRef, useState } from "react";
import { RotateCcw, Volume2 } from "lucide-react";
import { activityLabel } from "../../shared/germanActivities";
import { isSpeechSupported, speakGerman } from "./api";
import type { GermanTask, TaskResult } from "./types";

const GERMAN_CHARS = ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"];

function reconstructTileIndices(
  tiles: string[],
  value: string,
  isSpelling: boolean,
): number[] {
  if (!value) return [];
  const tokens = isSpelling ? Array.from(value) : value.split(" ");
  const indices: number[] = [];
  for (const token of tokens) {
    const idx = tiles.findIndex((v, j) => v === token && !indices.includes(j));
    if (idx >= 0) indices.push(idx);
  }
  return indices;
}

export default function ActivityInput({
  task,
  value,
  onChange,
  disabled,
  result,
}: {
  task: GermanTask;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  result?: TaskResult;
}) {
  const tiles = task.interaction?.tiles;
  const isSpelling = task.type === "spelling";
  const [selectedTiles, setSelectedTiles] = useState<number[]>(() =>
    tiles ? reconstructTileIndices(tiles, value, isSpelling) : [],
  );
  const [activeLeftIdx, setActiveLeftIdx] = useState<number | null>(null);
  const [showAudioFallback, setShowAudioFallback] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setActiveLeftIdx(null);
    setShowAudioFallback(false);
    if (tiles) {
      setSelectedTiles(reconstructTileIndices(tiles, value, isSpelling));
    } else {
      setSelectedTiles([]);
    }
  }, [task.id, tiles, isSpelling, value]);

  const selectTiles = (next: number[]) => {
    if (!tiles || disabled) return;
    setSelectedTiles(next);
    onChange(next.map((i) => tiles[i]).join(isSpelling ? "" : " "));
  };

  // Matching (tap-to-pair interactive cards)
  if (task.type === "matching" && task.interaction?.left && task.interaction?.right) {
    const leftItems = task.interaction.left;
    const rightItems = task.interaction.right;
    let pairs: string[] = [];
    try {
      const parsed = JSON.parse(value || "[]");
      if (Array.isArray(parsed)) pairs = parsed;
    } catch {
      pairs = [];
    }

    const handleLeftClick = (idx: number) => {
      if (disabled) return;
      if (pairs[idx]) {
        // Clicking an already paired left item clears its pairing
        const next = [...pairs];
        next[idx] = "";
        onChange(JSON.stringify(next));
        setActiveLeftIdx(idx);
        return;
      }
      setActiveLeftIdx(activeLeftIdx === idx ? null : idx);
    };

    const handleRightClick = (rightVal: string) => {
      if (disabled) return;
      const existingOwner = pairs.findIndex((p) => p === rightVal);
      if (activeLeftIdx !== null) {
        const next = leftItems.map((_, i) => pairs[i] || "");
        if (existingOwner >= 0) next[existingOwner] = "";
        next[activeLeftIdx] = rightVal;
        onChange(JSON.stringify(next));
        // Auto-advance to next unpaired left item for smooth speed
        const nextUnpaired = next.findIndex((p, i) => i !== activeLeftIdx && !p);
        setActiveLeftIdx(nextUnpaired >= 0 ? nextUnpaired : null);
      } else if (existingOwner >= 0) {
        const next = [...pairs];
        next[existingOwner] = "";
        onChange(JSON.stringify(next));
      } else {
        const firstEmpty = leftItems.findIndex((_, i) => !pairs[i]);
        if (firstEmpty >= 0) {
          const next = leftItems.map((_, i) => pairs[i] || "");
          next[firstEmpty] = rightVal;
          onChange(JSON.stringify(next));
        }
      }
    };

    const isReverseMatch = task.direction === "tr_de";
    const leftAriaLabel = isReverseMatch ? "Türkçe ifadeler" : "Almanca kelimeler";
    const rightAriaLabel = isReverseMatch ? "Almanca karşılıklar" : "Türkçe karşılıklar";
    const matchingHint = isReverseMatch
      ? "Önce soldan bir Türkçe ifade seç, ardından sağdaki Almanca karşılığına dokun."
      : "Önce soldan bir Almanca kart seç, ardından sağdaki Türkçe karşılığına dokun.";

    return (
      <div className="kg-activity-input">
        <div className="kg-matching-grid">
          <div className="kg-matching-col" aria-label={leftAriaLabel}>
            {leftItems.map((left, idx) => {
              const pairedWith = pairs[idx];
              const isSelected = activeLeftIdx === idx;
              return (
                <button
                  key={`${left}-${idx}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleLeftClick(idx)}
                  className={`kg-pair-card ${isSelected ? "is-selected" : ""} ${pairedWith ? "is-paired" : ""}`}
                >
                  <span lang={isReverseMatch ? "tr" : "de"}>{left}</span>
                  {pairedWith && <span className="kg-pair-badge">{idx + 1}</span>}
                </button>
              );
            })}
          </div>
          <div className="kg-matching-col" aria-label={rightAriaLabel}>
            {rightItems.map((right, rIdx) => {
              const ownerIdx = pairs.findIndex((p) => p === right);
              const isPaired = ownerIdx >= 0;
              return (
                <button
                  key={`${right}-${rIdx}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleRightClick(right)}
                  className={`kg-pair-card ${isPaired ? "is-paired" : ""}`}
                >
                  <span lang={isReverseMatch ? "de" : "tr"}>{right}</span>
                  {isPaired && <span className="kg-pair-badge">{ownerIdx + 1}</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <p className="kg-section-sub" style={{ margin: 0 }}>
            {matchingHint}
          </p>
          {!disabled && pairs.some(Boolean) && (
            <button
              type="button"
              className="kg-btn kg-btn-ghost kg-btn-sm"
              onClick={() => {
                setActiveLeftIdx(null);
                onChange("[]");
              }}
            >
              <RotateCcw size={14} /> Eşlemeyi Sıfırla
            </button>
          )}
        </div>
      </div>
    );
  }

  // Tile ordering / spelling
  if (tiles && tiles.length > 0) {
    return (
      <div className="kg-activity-input">
        <div
          className="kg-tile-answer"
          aria-label="Oluşturduğun yanıt"
          aria-live="polite"
        >
          {selectedTiles.length > 0 ? (
            selectedTiles.map((tileIdx, orderIdx) => (
              <button
                key={`${tileIdx}-${orderIdx}`}
                type="button"
                disabled={disabled}
                className="kg-tile-btn"
                aria-label={`${tiles[tileIdx] === " " ? "Boşluk" : tiles[tileIdx]} taşını kaldır`}
                onClick={() =>
                  selectTiles(selectedTiles.filter((_, j) => j !== orderIdx))
                }
              >
                {tiles[tileIdx] === " " ? "␣" : tiles[tileIdx]}
              </button>
            ))
          ) : (
            <span className="kg-section-sub" style={{ margin: 0 }}>
              Aşağıdaki taşlara dokunarak cümleyi oluştur
            </span>
          )}
        </div>

        <div className="kg-tile-bank">
          {tiles.map((tile, i) => (
            <button
              key={`${tile}-${i}`}
              type="button"
              disabled={disabled || selectedTiles.includes(i)}
              className="kg-tile-btn"
              onClick={() => selectTiles([...selectedTiles, i])}
            >
              {tile === " " ? "␣" : tile}
            </button>
          ))}
        </div>

        {!disabled && (
          <div>
            <button
              type="button"
              className="kg-btn kg-btn-ghost kg-btn-sm"
              onClick={() => selectTiles([])}
              disabled={selectedTiles.length === 0}
            >
              <RotateCcw size={14} /> Temizle
            </button>
          </div>
        )}
      </div>
    );
  }

  const audioText = task.interaction?.audioText;
  const speechOk = isSpeechSupported();

  // Listening Audio Box (optional above options)
  const listeningControls =
    task.type === "listening" && audioText ? (
      <div className="kg-listen-box">
        <button
          type="button"
          className="kg-btn kg-btn-blue kg-btn-sm"
          onClick={() => {
            if (!speakGerman(audioText, 0.95)) setShowAudioFallback(true);
          }}
        >
          <Volume2 size={17} /> Dinle (Normal)
        </button>
        <button
          type="button"
          className="kg-btn kg-btn-sm"
          onClick={() => {
            if (!speakGerman(audioText, 0.72)) setShowAudioFallback(true);
          }}
        >
          0.75x Yavaş
        </button>
        {!speechOk && (
          <button
            type="button"
            className="kg-btn kg-btn-ghost kg-btn-sm"
            onClick={() => setShowAudioFallback((v) => !v)}
          >
            {showAudioFallback ? "Metni Gizle" : "Ses desteklenmiyorsa metni gör"}
          </button>
        )}
        {showAudioFallback && (
          <strong lang="de" style={{ width: "100%", fontSize: 15 }}>
            {audioText}
          </strong>
        )}
      </div>
    ) : null;

  // Options (choice, article, conjugation, gap, sentence_completion, listening, true_false, multi)
  if (task.options && task.options.length > 0) {
    const isMulti = task.type === "multi";
    const isArticle = task.type === "article" && task.options.length === 3;
    const multiSelected = value ? value.split(" | ") : [];

    return (
      <div className="kg-activity-input">
        {listeningControls}
        <div className={`kg-options-grid ${isArticle ? "is-articles" : ""}`}>
          {task.options.map((opt, idx) => {
            const pressed = isMulti ? multiSelected.includes(opt) : value === opt;
            let stateClass = "";
            if (result && !result.skipped && result.score !== null) {
              if (result.suggestedAnswer === opt) stateClass = "is-correct";
              else if (pressed && result.score < 0.8) stateClass = "is-wrong";
            }
            return (
              <button
                key={`${opt}-${idx}`}
                type="button"
                disabled={disabled}
                aria-pressed={pressed}
                className={`kg-option-card ${stateClass}`}
                onClick={() => {
                  if (isMulti) {
                    const next = multiSelected.includes(opt)
                      ? multiSelected.filter((v) => v !== opt)
                      : [...multiSelected, opt];
                    onChange(next.sort().join(" | "));
                  } else {
                    onChange(opt);
                  }
                }}
              >
                <span className="kg-option-num">{idx + 1}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
        {isMulti && (
          <p className="kg-section-sub" style={{ margin: 0 }}>
            Birden fazla doğru seçenek işaretleyebilirsin.
          </p>
        )}
      </div>
    );
  }

  // Free-text input (translation, sentence_translation, Schreiben, Sprechen)
  const insertChar = (ch: string) => {
    if (disabled) return;
    const el = textareaRef.current;
    if (!el) {
      onChange(value + ch);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const expectsGermanText = task.direction !== "de_tr";

  return (
    <div className="kg-activity-input">
      {listeningControls}
      {expectsGermanText && (
        <div className="kg-umlaut-bar" role="group" aria-label="Almanca özel karakterler">
          {GERMAN_CHARS.map((ch) => (
            <button
              key={ch}
              type="button"
              disabled={disabled}
              className="kg-umlaut-key"
              onClick={() => insertChar(ch)}
            >
              {ch}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        lang={expectsGermanText ? "de" : "tr"}
        aria-label="Yanıtın"
        className="kg-textarea"
        rows={task.module === "vocabulary" ? 3 : 7}
        maxLength={12000}
        value={value}
        disabled={disabled}
        placeholder={
          task.module === "vocabulary"
            ? expectsGermanText
              ? "Almanca karşılığını buraya yaz…"
              : "Türkçe anlamını buraya yaz…"
            : "Almanca yanıtını buraya yaz…"
        }
        autoCapitalize="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="kg-section-sub" style={{ margin: 0 }}>
        {expectsGermanText
          ? "Büyük/küçük harf ve son noktalama esnek değerlendirilir; umlaut (ä, ö, ü) ve ß harflerine dikkat et."
          : "Büyük/küçük harf ve son noktalama esnek değerlendirilir."}
      </p>
    </div>
  );
}
