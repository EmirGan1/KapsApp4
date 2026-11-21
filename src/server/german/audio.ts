import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Client } from "@libsql/client";
import { CefrLevel, isCefrLevel } from "./cefr.ts";
import { Vocabulary } from "./learning.ts";

const execFileAsync = promisify(execFile);

export type GermanAudioRate = "normal" | "slow";

export interface GermanAudioPayload {
  cacheKey: string;
  normalizedText: string;
  rate: GermanAudioRate;
  mimeType: string;
  buffer: Buffer;
  filePath: string;
  source: "disk_cache" | "remote_tts" | "formant_fallback";
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

const CACHE_DIR = path.resolve(process.cwd(), "data", "german-audio-cache");
const inFlightRequests = new Map<string, Promise<GermanAudioPayload>>();
const ipRateWindow = new Map<string, { count: number; resetAt: number }>();

export function checkGermanAudioRateLimit(key: string, isAuthenticated: boolean): boolean {
  const now = Date.now();
  const limit = isAuthenticated ? 240 : 60;
  const windowMs = 60_000;
  const entry = ipRateWindow.get(key);
  if (!entry || now > entry.resetAt) {
    ipRateWindow.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) {
    return false;
  }
  entry.count += 1;
  return true;
}

export function sanitizeGermanSpeechText(raw: string): string {
  const cleaned = String(raw || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    throw new Error("Seslendirilecek Almanca metin boş olamaz.");
  }
  if (cleaned.length > 260) {
    return cleaned.slice(0, 260).trim();
  }
  return cleaned;
}

export function computeAudioCacheKey(text: string, rate: GermanAudioRate): string {
  const normalized = sanitizeGermanSpeechText(text).toLowerCase();
  return createHash("sha256")
    .update(`de-DE:v1:${rate}:${normalized}`)
    .digest("hex");
}

async function ensureCacheDir(): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

/**
 * Fetches authentic Standard German (`de-DE`) speech MP3 from Google Translate TTS endpoint.
 */
async function fetchStandardGermanTtsMp3(text: string, rate: GermanAudioRate): Promise<Buffer | null> {
  try {
    const ttsspeed = rate === "slow" ? "0.24" : "1";
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&ttsspeed=${ttsspeed}&q=${encodeURIComponent(text)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7500);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.byteLength < 256) return null;
    return buf;
  } catch {
    return null;
  }
}

/**
 * Optionally slows down an existing normal-speed MP3 via ffmpeg atempo=0.75 using safe execFile arguments.
 */
async function slowDownMp3WithFfmpeg(inputMp3Path: string, outputMp3Path: string): Promise<boolean> {
  try {
    await execFileAsync(
      "/usr/bin/ffmpeg",
      ["-y", "-i", inputMp3Path, "-filter:a", "atempo=0.75", "-vn", outputMp3Path],
      { timeout: 6000 },
    );
    const stat = await fs.stat(outputMp3Path);
    return stat.size > 256;
  } catch {
    return false;
  }
}

/**
 * Pure-Node deterministic German vowel/consonant formant WAV synthesizer fallback.
 * Guarantees a valid playable audio response (`audio/wav`) even in completely air-gapped test environments.
 */
export function synthesizeDeterministicGermanWav(text: string, rate: GermanAudioRate): Buffer {
  const sampleRate = 22050;
  const cleaned = text.toLowerCase().replace(/[^a-zäöüß ]/g, "");
  const chars = cleaned.split("").filter(Boolean);
  const charDurationSec = rate === "slow" ? 0.13 : 0.085;
  const totalSec = Math.min(4.5, Math.max(0.45, chars.length * charDurationSec + 0.12));
  const numSamples = Math.floor(sampleRate * totalSec);
  const pcm = Buffer.alloc(numSamples * 2);

  const vowelFormants: Record<string, [number, number]> = {
    a: [750, 1250],
    ä: [580, 1750],
    e: [460, 1950],
    i: [300, 2300],
    o: [460, 880],
    ö: [450, 1550],
    u: [320, 800],
    ü: [310, 1700],
  };

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const charIdx = Math.min(chars.length - 1, Math.floor(t / charDurationSec));
    const ch = chars[charIdx] || "a";
    const localT = (t % charDurationSec) / charDurationSec;

    // Smooth syllable envelope
    const env = Math.sin(Math.PI * Math.min(1, Math.max(0, localT)));
    const f0 = 135 + ((charIdx % 4) - 1.5) * 6;
    const [f1, f2] = vowelFormants[ch] ?? [520, 1480];

    let sample = 0;
    if (ch === " ") {
      sample = 0;
    } else if ("szßfchsch".includes(ch)) {
      // Soft consonant harmonic + gentle unvoiced texture
      sample =
        0.18 * Math.sin(2 * Math.PI * f0 * t) +
        0.12 * Math.sin(2 * Math.PI * 1800 * t) +
        0.05 * Math.sin(2 * Math.PI * 3100 * t);
    } else {
      sample =
        0.42 * Math.sin(2 * Math.PI * f0 * t) +
        0.26 * Math.sin(2 * Math.PI * f1 * t) +
        0.14 * Math.sin(2 * Math.PI * f2 * t);
    }

    const fadeOut = t > totalSec - 0.08 ? Math.max(0, (totalSec - t) / 0.08) : 1;
    const val = Math.max(-1, Math.min(1, sample * env * fadeOut * 0.65));
    pcm.writeInt16LE(Math.floor(val * 32767), i * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export async function getOrGenerateGermanAudio(
  db: Client,
  input: {
    text: string;
    rate?: GermanAudioRate;
  },
): Promise<GermanAudioPayload> {
  const rate: GermanAudioRate = input.rate === "slow" ? "slow" : "normal";
  const cleanText = sanitizeGermanSpeechText(input.text);
  const cacheKey = computeAudioCacheKey(cleanText, rate);

  const existingInFlight = inFlightRequests.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const promise = (async (): Promise<GermanAudioPayload> => {
    await ensureCacheDir();

    // 1. Check SQLite + disk cache first
    try {
      const rowRes = await db.execute({
        sql: "SELECT file_path, mime_type FROM german_audio_cache WHERE audio_hash=?",
        args: [cacheKey],
      });
      if (rowRes.rows[0]?.file_path) {
        const fileName = String(rowRes.rows[0].file_path);
        const mimeType = String(rowRes.rows[0].mime_type || "audio/mpeg");
        const diskPath = path.join(CACHE_DIR, path.basename(fileName));
        const buf = await fs.readFile(diskPath);
        if (buf.byteLength > 128) {
          return {
            cacheKey,
            normalizedText: cleanText,
            rate,
            mimeType,
            buffer: buf,
            filePath: diskPath,
            source: "disk_cache",
          };
        }
      }
    } catch {}

    // Also check direct deterministic file path on disk in case DB metadata was cleared
    const mp3Name = `${cacheKey}.mp3`;
    const mp3Path = path.join(CACHE_DIR, mp3Name);
    try {
      const diskBuf = await fs.readFile(mp3Path);
      if (diskBuf.byteLength > 128) {
        const nowIso = new Date().toISOString();
        await db
          .execute({
            sql: `INSERT OR REPLACE INTO german_audio_cache(audio_hash, normalized_text, rate, file_path, mime_type, byte_size, created_at, voice_version, engine, is_public)
                  VALUES(?,?,?,?,?,?,?,'de-DE-v1','server',1)`,
            args: [cacheKey, cleanText.toLowerCase(), rate, mp3Name, "audio/mpeg", diskBuf.byteLength, nowIso],
          })
          .catch(() => {});
        return {
          cacheKey,
          normalizedText: cleanText,
          rate,
          mimeType: "audio/mpeg",
          buffer: diskBuf,
          filePath: mp3Path,
          source: "disk_cache",
        };
      }
    } catch {}

    // 2. If slow rate requested and normal MP3 already exists on disk, try ffmpeg atempo=0.75 first
    let remoteMp3: Buffer | null = null;
    if (rate === "slow") {
      const normalKey = computeAudioCacheKey(cleanText, "normal");
      const normalPath = path.join(CACHE_DIR, `${normalKey}.mp3`);
      try {
        await fs.access(normalPath);
        const slowed = await slowDownMp3WithFfmpeg(normalPath, mp3Path);
        if (slowed) {
          remoteMp3 = await fs.readFile(mp3Path);
        }
      } catch {}
    }

    // 3. Fetch authentic Standard German (`de-DE`) TTS MP3
    if (!remoteMp3) {
      remoteMp3 = await fetchStandardGermanTtsMp3(cleanText, rate);
      if (remoteMp3) {
        await fs.writeFile(mp3Path, remoteMp3);
      }
    }

    if (remoteMp3 && remoteMp3.byteLength > 128) {
      const nowIso = new Date().toISOString();
      await db
        .execute({
          sql: `INSERT OR REPLACE INTO german_audio_cache(audio_hash, normalized_text, rate, file_path, mime_type, byte_size, created_at, voice_version, engine, is_public)
                VALUES(?,?,?,?,?,?,?,'de-DE-v1','remote_tts',1)`,
          args: [cacheKey, cleanText.toLowerCase(), rate, mp3Name, "audio/mpeg", remoteMp3.byteLength, nowIso],
        })
        .catch(() => {});
      return {
        cacheKey,
        normalizedText: cleanText,
        rate,
        mimeType: "audio/mpeg",
        buffer: remoteMp3,
        filePath: mp3Path,
        source: "remote_tts",
      };
    }

    // 4. Pure-Node German formant WAV fallback (always succeeds offline)
    const wavBuf = synthesizeDeterministicGermanWav(cleanText, rate);
    const wavName = `${cacheKey}.wav`;
    const wavPath = path.join(CACHE_DIR, wavName);
    await fs.writeFile(wavPath, wavBuf).catch(() => {});
    return {
      cacheKey,
      normalizedText: cleanText,
      rate,
      mimeType: "audio/wav",
      buffer: wavBuf,
      filePath: wavPath,
      source: "formant_fallback",
    };
  })();

  inFlightRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

export async function getLevelAudioPackManifest(
  db: Client,
  level: CefrLevel,
  words: Vocabulary[],
): Promise<LevelAudioPackManifest> {
  const levelWords = words.filter((w) => w.level === level);
  const cacheRows = await db.execute("SELECT audio_hash, byte_size FROM german_audio_cache WHERE is_public=1");
  const sizeByKey = new Map<string, number>();
  for (const r of cacheRows.rows) {
    sizeByKey.set(String(r.audio_hash), Number(r.byte_size ?? 0));
  }

  let cachedCount = 0;
  let estimatedBytes = 0;
  const items: LevelAudioPackItem[] = levelWords.map((w) => {
    const normalKey = computeAudioCacheKey(w.de, "normal");
    const slowKey = computeAudioCacheKey(w.de, "slow");
    const cachedNormal = sizeByKey.has(normalKey);
    const cachedSlow = sizeByKey.has(slowKey);
    const byteSizeNormal = sizeByKey.get(normalKey) ?? 11_500;
    if (cachedNormal) cachedCount++;
    estimatedBytes += byteSizeNormal;
    return {
      wordId: w.id,
      de: w.de,
      tr: w.tr,
      normalUrl: `/api/kaps-german/audio?text=${encodeURIComponent(w.de)}&rate=normal`,
      slowUrl: `/api/kaps-german/audio?text=${encodeURIComponent(w.de)}&rate=slow`,
      cachedNormal,
      cachedSlow,
      byteSizeNormal,
    };
  });

  return {
    level,
    totalWords: items.length,
    cachedCount,
    estimatedBytes,
    items,
  };
}

export async function warmLevelAudioCacheBatch(
  db: Client,
  words: Vocabulary[],
  limit = 25,
): Promise<{ warmed: number }> {
  let warmed = 0;
  for (const w of words.slice(0, limit)) {
    if (!isCefrLevel(w.level)) continue;
    try {
      await getOrGenerateGermanAudio(db, { text: w.de, rate: "normal" });
      warmed++;
    } catch {}
  }
  return { warmed };
}
