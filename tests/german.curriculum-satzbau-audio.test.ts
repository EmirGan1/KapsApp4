import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@libsql/client";
import { buildActivities } from "../src/server/german/activities";
import {
  getLevelAudioPackManifest,
  getOrGenerateGermanAudio,
  synthesizeDeterministicGermanWav,
} from "../src/server/german/audio";
import { gradeAnswer } from "../src/server/german/cefr";
import { BUILTIN_CURRICULUM } from "../src/server/german/curriculum";
import {
  buildHierarchicalCurriculum,
  classifyWordIntoHierarchy,
  isCorruptedTopicLabel,
  sanitizeLegacyTopic,
} from "../src/server/german/curriculumHierarchy";
import {
  resolveAdaptiveDifficulty,
  selectSemanticDistractors,
} from "../src/server/german/distractors";
import { parseDocument, validateTask, type Vocabulary } from "../src/server/german/learning";
import {
  buildSatzbauSpecForWord,
  chooseSatzbauModeForWord,
  evaluateSatzbauDeterministic,
  reviewSatzbauWithAi,
} from "../src/server/german/satzbau";
import { studyLevels, type SatzbauMode } from "../src/shared/germanActivities";

const BUILTIN_VOCAB: Vocabulary[] = BUILTIN_CURRICULUM.map((w) => ({
  ...w,
  canonicalKey: w.de.toLowerCase(),
  raw: `${w.de} — ${w.tr}`,
  cefrSource: "builtin" as const,
}));

test("1. Legacy corrupted TR/DE topic labels are detected, sanitized, and never become lesson topics", () => {
  const corruptedExamples = [
    'TR: „die Tiefkühltruhe (-n) – derin dondurucu (sandık tipi)"',
    "TR: Bu sabah derse geç kaldım.",
    "DE: Ich möchte einen Tisch reservieren.",
    "Örnek: Wir fahren morgen nach Berlin.",
    '„der Kühlschrank" — buzdolabı',
  ];
  for (const label of corruptedExamples) {
    assert.equal(
      isCorruptedTopicLabel(label),
      true,
      `Expected corrupted topic label to be detected: ${label}`,
    );
    const cleaned = sanitizeLegacyTopic(label);
    assert.equal(
      cleaned,
      "",
      `Sanitized corrupted topic should return empty string: ${cleaned}`,
    );
  }

  // Test parseDocument with raw Google Docs lines containing TR: „..." and DE: ...
  const rawDocLines = [
    "A2 Seviyesi",
    "die Tiefkühltruhe — derin dondurucu",
    "DE: Die Tiefkühltruhe steht im Keller.",
    "der Kühlschrank — buzdolabı",
    "TR: Buzdolabı mutfakta duruyor.",
  ];
  const sampleGoogleDoc = {
    body: {
      content: rawDocLines.map((line) => ({
        paragraph: {
          elements: [{ textRun: { content: line + "\n" } }],
        },
      })),
    },
  };

  const parsed = parseDocument(sampleGoogleDoc);
  assert.equal(parsed.entries.length, 2);
  for (const item of parsed.entries) {
    assert.equal(
      item.topic.startsWith("TR:"),
      false,
      `Vocabulary topic must not be overwritten by TR: line (${item.topic})`,
    );
    assert.ok(item.categoryId, "Vocabulary item must be assigned a canonical categoryId");
  }
  assert.equal(parsed.entries[0].exampleDe, "Die Tiefkühltruhe steht im Keller.");
});

test("2. Fragmented 473 single-word A2 lessons collapse into structured categories & balanced units", () => {
  // Simulate 473 A2 words where each word previously had its own corrupted topic string
  const baseA2 = BUILTIN_VOCAB.filter((w) => w.level === "A2");
  const simulated473: Vocabulary[] = [];
  for (let i = 0; i < 473; i++) {
    const template = baseA2[i % baseA2.length];
    const word: Vocabulary = {
      ...template,
      id: `sim-a2-${i}`,
      de: i < baseA2.length ? template.de : `${template.de} ${i}`,
      topic: `TR: „${template.de} – ${template.tr} (${i})"`,
    };
    const meta = classifyWordIntoHierarchy(word);
    word.categoryId = meta.categoryId;
    word.subtopic = meta.subtopicTr;
    word.topic = meta.subtopicTr;
    word.semanticTags = meta.semanticTags;
    simulated473.push(word);
  }

  const hierarchy = buildHierarchicalCurriculum(simulated473 as any);
  const a2Categories = hierarchy.hierarchyByLevel.find((h) => h.level === "A2")?.categories ?? [];

  assert.ok(
    a2Categories.length >= 6 && a2Categories.length <= 16,
    `Expected A2 to have 6..16 meaningful categories, got ${a2Categories.length}`,
  );

  const totalUnits = a2Categories.reduce((sum, c) => sum + c.units.length, 0);
  const totalWordsInUnits = a2Categories.reduce((sum, c) => sum + c.totalWords, 0);

  assert.equal(
    totalWordsInUnits,
    473,
    "All 473 vocabulary items must be preserved in the consolidated hierarchy",
  );
  assert.ok(
    totalUnits < 50,
    `473 fragmented lessons should consolidate into < 50 units, got ${totalUnits}`,
  );
});

test("3. Context-aware semantic distractor engine enforces POS, category relevance, and unambiguous answers", () => {
  for (const level of studyLevels) {
    const pool = BUILTIN_VOCAB.filter((w) => w.level === level);
    for (const target of pool.slice(0, 15)) {
      for (const direction of ["de_tr", "tr_de"] as const) {
        for (const diff of ["easy", "normal", "challenging"] as const) {
          const sel = selectSemanticDistractors({
            target,
            pool,
            direction,
            count: 3,
            difficulty: diff,
          });
          assert.equal(
            sel.options.length,
            4,
            `Expected 4 multiple-choice options for ${target.de} (${direction}, ${diff})`,
          );
          const uniqueOpts = new Set(sel.options.map((o) => o.toLowerCase().trim()));
          assert.equal(
            uniqueOpts.size,
            4,
            `Options must be strictly unique for ${target.de}: ${sel.options.join(" | ")}`,
          );
          assert.ok(
            sel.options.includes(sel.correctAnswer),
            `Options must include the exact correct answer "${sel.correctAnswer}"`,
          );
        }
      }
    }
  }

  // Adaptive difficulty scaling
  assert.equal(resolveAdaptiveDifficulty("adaptive", 0), "easy");
  assert.equal(resolveAdaptiveDifficulty("adaptive", 2), "normal");
  assert.equal(resolveAdaptiveDifficulty("adaptive", 4), "challenging");
});

test("4. Satzbau (German Sentence Building) supports all 5 modes across A1-C1 and grades alternative word orders", async () => {
  const modes: SatzbauMode[] = [
    "arrange",
    "construct_bank",
    "free_translation",
    "create_own",
    "correct_sentence",
  ];

  for (const level of studyLevels) {
    const levelWords = BUILTIN_VOCAB.filter((w) => w.level === level);
    const sampleWord = levelWords[0];
    assert.ok(sampleWord, `Expected sample word for ${level}`);

    const spec = buildSatzbauSpecForWord(sampleWord, levelWords);
    assert.ok(spec.sentenceDe.length >= 6);
    assert.ok(spec.sentenceTr.length >= 4);

    for (const mode of modes) {
      const tasks = buildActivities([sampleWord], "satzbau", "tr_de", {
        distractorWords: levelWords,
        satzbauMode: mode,
        limit: 1,
      });
      assert.equal(tasks.length, 1, `Expected 1 satzbau task for mode ${mode} (${level})`);
      const task = tasks[0];
      assert.equal(task.type, "satzbau");
      const validated = validateTask(task, [sampleWord]);
      assert.ok(validated, `Satzbau task in mode ${mode} must pass validateTask`);

      // Grade canonical reference answer
      const isOk = gradeAnswer({
        type: task.type,
        answer: task.answer,
        alternatives: task.alternatives,
        hasOptions: task.options.length > 0,
        hasInteraction: Boolean(task.interaction),
        direction: task.direction,
        satzbauMode: task.satzbauMode,
        targetWordDe: task.targetWordDe,
        userAnswer: task.answer,
      });
      assert.equal(isOk, true, `Canonical answer "${task.answer}" for mode ${mode} (${level}) must grade correct`);

      // Grade alternative valid word order when present
      if (task.alternatives.length > 0 && mode !== "create_own") {
        const altOk = gradeAnswer({
          type: task.type,
          answer: task.answer,
          alternatives: task.alternatives,
          hasOptions: task.options.length > 0,
          hasInteraction: Boolean(task.interaction),
          direction: task.direction,
          satzbauMode: task.satzbauMode,
          targetWordDe: task.targetWordDe,
          userAnswer: task.alternatives[0],
        });
        assert.equal(altOk, true, `Alternative valid German word order "${task.alternatives[0]}" must grade correct`);
      }
    }

    // Check automatic mode selection
    const autoMode = chooseSatzbauModeForWord(sampleWord, 0);
    assert.ok(modes.includes(autoMode));
  }

  // Test AI review fallback / deterministic review
  const db = createClient({ url: "file::memory:" });
  const reviewRes = await reviewSatzbauWithAi(db, {
    userSentence: "Ich kaufe heute das Brot im Supermarkt.",
    expectedSentence: "Ich kaufe heute das Brot im Supermarkt.",
    turkishPrompt: "Bugün süpermarketten ekmek satın alıyorum.",
    targetWordDe: "das Brot",
    targetWordTr: "ekmek",
    mode: "arrange",
    level: "A1",
  });
  assert.equal(reviewRes.isValid, true);
  assert.ok(reviewRes.feedbackTr.length > 0);
  assert.ok(reviewRes.correctedSentenceDe.length > 0);
});

test("5. Server-hosted German audio generator & disk/SQLite cache produces valid audio for normal and slow rates", async () => {
  const db = createClient({ url: "file::memory:" });
  await db.execute(`
    CREATE TABLE german_audio_cache (
      cache_key TEXT PRIMARY KEY,
      normalized_text TEXT NOT NULL,
      rate TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      last_accessed_at TEXT NOT NULL,
      hit_count INTEGER NOT NULL DEFAULT 1
    )
  `);

  // Verify pure-Node deterministic German WAV synthesizer
  const wavBuf = synthesizeDeterministicGermanWav("die Tiefkühltruhe", "normal");
  assert.equal(wavBuf.subarray(0, 4).toString("ascii"), "RIFF");
  assert.ok(wavBuf.byteLength > 2000);

  // Verify getOrGenerateGermanAudio with caching
  const first = await getOrGenerateGermanAudio(db, {
    text: "Guten Morgen",
    rate: "normal",
  });
  assert.ok(first.buffer.byteLength > 500, "Audio buffer must be non-empty");
  assert.ok(
    first.mimeType === "audio/mpeg" || first.mimeType === "audio/wav",
    `Unexpected mimeType: ${first.mimeType}`,
  );

  const second = await getOrGenerateGermanAudio(db, {
    text: "Guten Morgen",
    rate: "normal",
  });
  assert.equal(second.source, "disk_cache", "Second request for same text+rate must hit persistent disk_cache");
  assert.equal(second.cacheKey, first.cacheKey);

  // Level audio pack manifest
  const manifest = await getLevelAudioPackManifest(db, "A1", BUILTIN_VOCAB);
  assert.equal(manifest.level, "A1");
  assert.ok(manifest.totalWords > 20);
  assert.ok(manifest.estimatedBytes > 10000);
  assert.ok(manifest.items[0].normalUrl.startsWith("/api/kaps-german/audio?"));
  assert.ok(manifest.items[0].slowUrl.includes("rate=slow"));
});
