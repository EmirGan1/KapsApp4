import { useEffect, useState } from "react";
import { Snail, Volume2, VolumeX } from "lucide-react";
import {
  getGermanVoiceStatus,
  speakGermanWithStatus,
  subscribeGermanVoiceStatus,
  type GermanVoiceStatus,
} from "./api";
import type { PronunciationGuide } from "./types";

export function useGermanVoiceStatus(): GermanVoiceStatus {
  const [status, setStatus] = useState<GermanVoiceStatus>(() => getGermanVoiceStatus());
  useEffect(() => {
    setStatus(getGermanVoiceStatus());
    const unsub = subscribeGermanVoiceStatus(() => {
      setStatus(getGermanVoiceStatus());
    });
    const timer = setTimeout(() => {
      setStatus(getGermanVoiceStatus());
    }, 1250);
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);
  return status;
}

export function GermanSpeakButtons({
  text,
  compact = false,
  onUnavailable,
}: {
  text: string;
  compact?: boolean;
  onUnavailable?: () => void;
}) {
  const voiceStatus = useGermanVoiceStatus();
  const [notice, setNotice] = useState("");

  const play = (rate: number) => {
    setNotice("");
    const res = speakGermanWithStatus(text, rate);
    if (!res.ok) {
      if (res.reason === "no-german-voice" || res.reason === "unsupported") {
        setNotice(
          "Bu cihazda yerel Almanca (de-DE) ses paketi bulunamadı. Aşağıdaki Türkçe okunuş rehberini kullanabilirsin.",
        );
        onUnavailable?.();
      } else {
        setNotice("Ses şu an çalınamıyor.");
      }
    }
  };

  return (
    <div className="kg-speak-group">
      <div className="kg-speak-btns">
        <button
          type="button"
          className={compact ? "kg-audio-btn" : "kg-btn kg-btn-blue kg-btn-sm"}
          aria-label={`${text} normal hızda Almanca dinle`}
          title={
            voiceStatus.status === "no-german-voice"
              ? "Almanca ses paketi bulunamadı"
              : "Dinle (Almanca)"
          }
          onClick={() => play(0.95)}
        >
          {voiceStatus.status === "no-german-voice" || !voiceStatus.supported ? (
            <VolumeX size={16} />
          ) : (
            <Volume2 size={16} />
          )}
          {!compact && <span>Dinle</span>}
        </button>

        <button
          type="button"
          className={compact ? "kg-audio-btn" : "kg-btn kg-btn-sm"}
          aria-label={`${text} yavaş hızda Almanca dinle`}
          title="Yavaş Dinle (0.68x)"
          onClick={() => play(0.68)}
        >
          <Snail size={15} />
          {!compact && <span>Yavaş Dinle</span>}
        </button>
      </div>
      {notice && (
        <div className="kg-voice-notice" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

export function PronunciationGuideBox({
  pronunciation,
  showTurkishPronunciation = true,
  compact = false,
}: {
  pronunciation?: PronunciationGuide | null;
  showTurkishPronunciation?: boolean;
  compact?: boolean;
}) {
  if (!pronunciation || !showTurkishPronunciation) return null;

  return (
    <div className={`kg-pron-box ${compact ? "is-compact" : ""}`}>
      <div className="kg-pron-top">
        <div className="kg-pron-main">
          <span className="kg-pron-label">Okunuş:</span>
          <strong className="kg-pron-tr">{pronunciation.turkishApprox}</strong>
          {pronunciation.ipa && (
            <span className="kg-pron-ipa" lang="und">
              {pronunciation.ipa}
            </span>
          )}
        </div>
        <span
          className={`kg-pron-status ${pronunciation.verified ? "is-verified" : "is-estimated"}`}
        >
          {pronunciation.verified ? "Doğrulanmış" : "Tahmini okunuş"}
        </span>
      </div>

      {!compact && pronunciation.syllables && pronunciation.syllables.length > 1 && (
        <div className="kg-pron-syllables" aria-label="Hece vurgusu">
          {pronunciation.syllables.map((syl, idx) => (
            <span
              key={`${syl}-${idx}`}
              className={`kg-pron-syl ${idx === pronunciation.stressSyllable ? "is-stressed" : ""}`}
            >
              {syl}
            </span>
          ))}
        </div>
      )}

      {!compact && pronunciation.notesTr && (
        <p className="kg-pron-note">{pronunciation.notesTr}</p>
      )}
    </div>
  );
}
