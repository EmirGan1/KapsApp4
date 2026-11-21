import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, Snail, Square, Trash2, Volume2 } from "lucide-react";
import type { CefrLevel } from "../../shared/germanActivities";
import {
  clearBrowserCachedGermanAudio,
  downloadLevelAudioPackToBrowserCache,
  fetchLevelAudioPack,
  getBrowserCachedAudioStats,
  getGermanVoiceStatus,
  speakGermanWithStatus,
  stopGermanSpeech,
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
    return () => {
      unsub();
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
  const [playingMode, setPlayingMode] = useState<"idle" | "normal" | "slow">("idle");
  const [notice, setNotice] = useState("");

  const play = (rate: number, mode: "normal" | "slow") => {
    setNotice("");
    setPlayingMode(mode);
    const res = speakGermanWithStatus(text, {
      rate,
      onEnd: () => setPlayingMode("idle"),
      onError: () => {
        setPlayingMode("idle");
        setNotice("Ses şu an çalınamıyor. Aşağıdaki Türkçe okunuş rehberini kullanabilirsin.");
        onUnavailable?.();
      },
    });
    if (!res.ok) {
      setPlayingMode("idle");
      setNotice("Ses şu an çalınamıyor.");
    }
  };

  const handleStop = () => {
    stopGermanSpeech();
    setPlayingMode("idle");
  };

  return (
    <div className="kg-speak-group">
      <div className="kg-speak-btns">
        <button
          type="button"
          className={`${compact ? "kg-audio-btn" : "kg-btn kg-btn-blue kg-btn-sm"} ${
            playingMode === "normal" ? "is-playing" : ""
          }`}
          aria-label={`${text} normal hızda Almanca dinle`}
          title="Dinle (Standart Almanca de-DE)"
          onClick={() => play(0.95, "normal")}
        >
          <Volume2 size={16} />
          {!compact && <span>{playingMode === "normal" ? "Çalıyor..." : "Dinle"}</span>}
        </button>

        <button
          type="button"
          className={`${compact ? "kg-audio-btn" : "kg-btn kg-btn-sm"} ${
            playingMode === "slow" ? "is-playing" : ""
          }`}
          aria-label={`${text} yavaş hızda Almanca dinle`}
          title="Yavaş Dinle (0.68x)"
          onClick={() => play(0.68, "slow")}
        >
          <Snail size={15} />
          {!compact && <span>{playingMode === "slow" ? "Yavaş..." : "Yavaş Dinle"}</span>}
        </button>

        {playingMode !== "idle" && !compact && (
          <button
            type="button"
            className="kg-btn kg-btn-sm"
            aria-label="Sesi durdur"
            title="Sesi Durdur"
            onClick={handleStop}
          >
            <Square size={14} />
          </button>
        )}
      </div>
      {notice && (
        <div className="kg-voice-notice" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

export function GermanLevelAudioPackCard({
  level,
  compact = false,
}: {
  level: CefrLevel;
  compact?: boolean;
}) {
  const [manifestInfo, setManifestInfo] = useState<{
    totalWords: number;
    estimatedBytes: number;
  } | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [cachedEntries, setCachedEntries] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    bytesDownloaded: number;
  } | null>(null);
  const [readyOffline, setReadyOffline] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;
    setManifestInfo(null); setReadyOffline(false); setDownloadError(''); setProgress(null);
    void fetchLevelAudioPack(level).then(async m => [m, await getBrowserCachedAudioStats(m)] as const)
      .then(([m, st]) => {
        if (!mounted) return;
        setManifestInfo({
          totalWords: m.totalWords,
          estimatedBytes: m.estimatedBytes,
        });
        setCachedEntries(st.entryCount);
        setReadyOffline(m.totalWords > 0 && st.entryCount >= m.totalWords);
      })
      .catch(() => { if (mounted) setDownloadError("Ses paketi bilgisi alınamadı. Birazdan yeniden deneyebilirsin."); });
    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, [level]);

  const formatMb = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb < 0.1 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${mb.toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    if (downloading) {
      abortRef.current?.abort();
      setDownloading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDownloading(true);
    setDownloadError("");
    setProgress({ completed: 0, total: manifestInfo?.totalWords ?? 1, bytesDownloaded: 0 });
    try {
      await downloadLevelAudioPackToBrowserCache(
        level,
        (p) => setProgress({ ...p }),
        ctrl.signal,
      );
      const manifest = await fetchLevelAudioPack(level);
      const st = await getBrowserCachedAudioStats(manifest);
      setCachedEntries(st.entryCount);
      const ready = manifest.totalWords > 0 && st.entryCount >= manifest.totalWords;
      setReadyOffline(ready);
      if (!ctrl.signal.aborted && !ready) setDownloadError('Paketin tamamı kaydedilemedi. Bağlantını ve cihazındaki boş alanı kontrol edip yeniden dene.');
    } catch (error) {
      setReadyOffline(false);
      if (!ctrl.signal.aborted) setDownloadError(error instanceof Error ? error.message : 'Ses paketi indirilemedi.');
    } finally {
      setDownloading(false);
    }
  };

  const handleClear = async () => {
    await clearBrowserCachedGermanAudio();
    setCachedEntries(0);
    setReadyOffline(false);
    setProgress(null);
  };

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : readyOffline
        ? 100
        : 0;

  return (
    <div className={`kg-audio-pack-bar ${compact ? "is-compact" : ""}`}>
      <div className="kg-audio-pack-info">
        <span className="kg-audio-pack-badge">de-DE Sunucu Ses Paketi</span>
        <strong>
          {level} Almanca Telaffuz Paketi{" "}
          {manifestInfo ? `(${manifestInfo.totalWords} kelime • ~${formatMb(manifestInfo.estimatedBytes)})` : ""}
        </strong>
        <span className="kg-audio-pack-sub">
          {readyOffline
            ? "Çevrimdışı kullanıma hazır • Cihaz önbelleğine kaydedildi"
            : "Almanca sesleri sunucudan dinleyebilir, bu seviyenin paketini çevrimdışı kullanım için kaydedebilirsin."}
        </span>
      </div>

      {downloadError && <p className="kg-voice-notice" role="status">{downloadError}</p>}
      <div className="kg-audio-pack-actions">
        {readyOffline ? (
          <span className="kg-pill kg-pill-emerald">
            <CheckCircle2 size={14} /> Çevrimdışı Hazır ({cachedEntries})
          </span>
        ) : null}

        <button
          type="button"
          className="kg-btn kg-btn-sm kg-btn-blue"
          onClick={() => void handleDownload()}
        >
          {downloading ? (
            <>
              <Loader2 size={14} className="kg-spin" />
              <span>
                İndiriliyor %{percent} ({progress?.completed ?? 0}/{progress?.total ?? 0})
              </span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>{readyOffline ? `${level} Paketini Güncelle` : "Almanca Ses Paketini İndir"}</span>
            </>
          )}
        </button>

        {cachedEntries > 0 && !downloading && (
          <button
            type="button"
            className="kg-btn kg-btn-sm"
            title="İndirilen ses önbelleğini temizle"
            onClick={() => void handleClear()}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
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
