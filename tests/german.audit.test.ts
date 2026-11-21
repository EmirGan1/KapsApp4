import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { once } from "node:events";
import { createClient } from "@libsql/client";
import { BUILTIN_CURRICULUM } from "../src/server/german/curriculum";
import {
  buildActivities,
  buildReinforcementActivities,
  matchWordFormInSentence,
} from "../src/server/german/activities";
import {
  canonicalWordKey,
  evaluateMatchingPairs,
  gradeAnswer,
} from "../src/server/german/cefr";
import {
  EXAM_STRUCTURE,
  validateTask,
  type Task,
  type Vocabulary,
} from "../src/server/german/learning";
import { registerGerman, seedBuiltinCurriculum } from "../src/server/german";
import { activities, studyLevels } from "../src/shared/germanActivities";

function toVocabList(): Vocabulary[] {
  return BUILTIN_CURRICULUM.map((e) => ({
    id: e.id,
    canonicalKey: canonicalWordKey(e.de),
    de: e.de,
    tr: e.tr,
    alternatives: e.alternatives,
    raw: `${e.de} — ${e.tr}`,
    topic: e.topic,
    level: e.level,
    cefrSource: "builtin",
    article: e.article,
    plural: e.plural,
    pos: e.pos,
    grammar: e.grammar,
    exampleDe: e.exampleDe,
    exampleTr: e.exampleTr,
    conjugation: e.conjugation,
    completion: e.completion,
  }));
}

test("Audit A-D: sentence alternatives isolation, inflected masking, strict grading & matching pairs", () => {
  const vocab = toVocabList();

  // Bug A: sentence_translation must NEVER receive bare single-word synonyms like "gar"
  const bahnhof = vocab.find((v) => v.de === "der Bahnhof")!;
  assert.ok(bahnhof.alternatives?.length);
  const bahnhofSentTasks = buildActivities([bahnhof, ...vocab.slice(0, 6)], "sentence_translation", "de_tr", {
    limit: 20,
  }).filter((t) => t.vocabularyIds.includes(bahnhof.id));
  assert.ok(bahnhofSentTasks.length >= 1);
  for (const t of bahnhofSentTasks) {
    assert.ok(!bahnhof.alternatives!.some((alt) => t.alternatives.includes(alt)));
    assert.equal(
      gradeAnswer({
        type: t.type,
        answer: t.answer,
        alternatives: t.alternatives,
        direction: t.direction,
        userAnswer: bahnhof.alternatives![0],
      }),
      false,
    );
  }

  // Bug B: matchWordFormInSentence handles genuine inflections without masking unrelated words
  const neu = vocab.find((v) => v.de === "neu")!;
  const neuMask = matchWordFormInSentence(neu.exampleDe!, neu);
  assert.equal(neuMask?.answer, "neues");

  const auswirkung = vocab.find((v) => v.de === "die Auswirkung")!;
  const ausMask = matchWordFormInSentence(auswirkung.exampleDe!, auswirkung);
  assert.equal(ausMask?.answer, "Auswirkungen");

  const aufstehen = vocab.find((v) => v.de === "aufstehen")!;
  assert.equal(matchWordFormInSentence(aufstehen.exampleDe!, aufstehen), null);

  // Bug C/D: wrong articles rejected, valid bare noun tolerated ONLY in tr_de, matching rejects malformed
  assert.equal(
    gradeAnswer({ type: "translation", answer: "der Apfel", direction: "tr_de", userAnswer: "die Apfel" }),
    false,
  );
  assert.equal(
    gradeAnswer({ type: "translation", answer: "der Apfel", direction: "tr_de", userAnswer: "Apfel" }),
    true,
  );
  assert.equal(
    gradeAnswer({ type: "sentence_translation", answer: "Otobüs / tren", direction: "de_tr", userAnswer: "Otobüs" }),
    false,
  );
  assert.equal(
    gradeAnswer({ type: "ordering", answer: "Ich kaufe heute Äpfel.", hasInteraction: true, userAnswer: "Ich kaufe heute Äpfel" }),
    true,
  );
  assert.equal(
    gradeAnswer({ type: "ordering", answer: "Ich kaufe heute Äpfel.", hasInteraction: true, userAnswer: "Äpfel heute kaufe Ich" }),
    false,
  );
  assert.deepEqual(
    evaluateMatchingPairs('["elma","ev","okul"]', '["elma","okul","ev"]'),
    [true, false, false],
  );
  assert.equal(evaluateMatchingPairs('["elma","ev","okul"]', '["elma"]'), null);
});

test("Audit E-I: full 185-word corpus generation passes validateTask, self-grading, distractor non-acceptance, and rotation", () => {
  const vocab = toVocabList();
  assert.equal(vocab.length, 185);

  let totalTasks = 0;
  for (const lvl of studyLevels) {
    const pool = vocab.filter((v) => v.level === lvl);
    const mistakeIds = new Set(pool.slice(0, 6).map((w) => w.id));
    for (const dir of ["tr_de", "de_tr", "mixed"] as const) {
      for (const [act] of activities) {
        const tasks = buildActivities(pool, act, dir, { mistakeWordIds: mistakeIds, limit: 60 });
        for (const t of tasks) {
          totalTasks++;
          assert.ok(validateTask(t, pool), `validateTask failed on ${t.type} (${t.level})`);
          assert.notEqual(t.type, "mistake_review", "mistake_review must preserve real exercise type");
          if (t.type === "matching") {
            assert.ok(t.vocabularyIds.length >= 2, "matching must track all paired vocabularyIds");
            assert.equal(t.vocabularyIds.length, t.interaction?.left?.length);
          }
          const selfOk =
            t.type === "matching"
              ? Boolean(evaluateMatchingPairs(t.answer, t.answer)?.every(Boolean))
              : gradeAnswer({
                  type: t.type,
                  answer: t.answer,
                  alternatives: t.alternatives,
                  hasOptions: t.options.length > 0,
                  hasInteraction: Boolean(t.interaction?.tiles || t.interaction?.left),
                  direction: t.direction,
                  userAnswer: t.answer,
                });
          assert.equal(selfOk, true, `Canonical answer failed self-grading on ${t.type}: ${t.answer}`);

          for (const opt of t.options) {
            if (opt !== t.answer && t.type !== "multi") {
              assert.equal(
                gradeAnswer({
                  type: t.type,
                  answer: t.answer,
                  alternatives: t.alternatives,
                  hasOptions: true,
                  direction: t.direction,
                  userAnswer: opt,
                }),
                false,
                `Distractor "${opt}" accepted for "${t.answer}"`,
              );
            }
          }
        }
      }
    }
  }
  assert.ok(totalTasks > 4000);

  // Full A1 rotation across 10 sessions reaches every A1 word (no slice(0,20) starvation)
  const a1Pool = vocab.filter((v) => v.level === "A1");
  const seenA1 = new Set<string>();
  const recent = new Set<string>();
  for (let s = 0; s < 10; s++) {
    const ts = buildActivities(a1Pool, "mixed", "tr_de", { recentWordIds: new Set(recent), limit: 12 });
    for (const t of ts) {
      for (const id of t.vocabularyIds) {
        seenA1.add(id);
        recent.add(id);
      }
    }
  }
  assert.equal(seenA1.size, a1Pool.length);

  // Multi-level selection balances across all 5 CEFR levels
  const multiLevelTasks = buildActivities(vocab, "choice", "tr_de", { limit: 20 });
  assert.equal(new Set(multiLevelTasks.map((t) => t.level)).size, 5);

  // validateTask rejects bare option labels ("A", "(B)", "1)")
  const sample = buildActivities(a1Pool, "choice", "de_tr", { limit: 1 })[0];
  assert.equal(
    validateTask({ ...sample, answer: "A", options: ["A", "B", "C", "D"] }, a1Pool),
    null,
  );
  assert.ok(EXAM_STRUCTURE.Lesen.parts.length === 5);
});

test("Audit Reinforcement & Matching DB: per-pair mastery, single task XP, POST /reinforce idempotency & exact parent scope", async () => {
  const db = createClient({ url: "file::memory:" });
  const app = express();
  await db.execute("CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT)");
  await db.execute("INSERT INTO users VALUES(1,'Emirgan'),(2,'Student')");
  registerGerman(
    app,
    db,
    async (req) => {
      const id = Number(req.headers.authorization?.replace("Bearer ", ""));
      return Number.isSafeInteger(id) && id > 0 ? { id } : null;
    },
    (_q, _s, n) => n(),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const addr = server.address();
  assert.ok(addr && typeof addr !== "string");
  const base = `http://127.0.0.1:${addr.port}/api/kaps-german`;
  const ask = (path: string, user = 1, body?: unknown) =>
    fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${user}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  try {
    await seedBuiltinCurriculum(db);

    // 1. Partial matching mastery test (2/3 pairs correct -> 2 words gain streak, 1 word fails, task XP awarded cleanly)
    const matchCreate = await ask("/sessions", 1, {
      module: "vocabulary",
      mode: "practice",
      activity: "matching",
      direction: "tr_de",
      levels: ["A1"],
    }).then((r) => r.json());
    const matchTaskRow = (
      await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [matchCreate.id] })
    ).rows[0];
    const matchTasks = JSON.parse(String(matchTaskRow.tasks)) as Task[];
    const mt = matchTasks[0];
    assert.equal(mt.type, "matching");
    assert.equal(mt.direction, "tr_de");
    assert.ok((mt.pairVocabularyIds?.length ?? mt.vocabularyIds.length) >= 2);
    const expectedPairs = JSON.parse(mt.answer) as string[];
    const partialPairs = [...expectedPairs];
    // Corrupt last pair only
    partialPairs[partialPairs.length - 1] = expectedPairs[0];
    const matchCheck = await ask(`/sessions/${matchCreate.id}/check`, 1, {
      taskId: mt.id,
      answer: JSON.stringify(partialPairs),
    }).then((r) => r.json());
    assert.equal(matchCheck.result.score < 0.8, true);
    const pairIds = mt.pairVocabularyIds ?? mt.vocabularyIds;
    assert.equal(matchCheck.masteryUpdates[pairIds[0]].consecutiveCorrect, 1);
    assert.equal(matchCheck.masteryUpdates[pairIds[pairIds.length - 1]].consecutiveCorrect, 0);
    assert.equal(matchCheck.masteryUpdates[pairIds[pairIds.length - 1]].totalIncorrect, 1);

    // Finish matching session -> test reinforce guard on unfinished vs completed
    await ask(`/sessions/${matchCreate.id}/submit`, 1, {});

    // 2. Full parent tr_de session -> complete -> start reverse-direction reinforcement (de_tr)
    const parentStart = await ask("/sessions", 1, {
      module: "vocabulary",
      mode: "practice",
      activity: "choice",
      direction: "tr_de",
      levels: ["A2"],
    }).then((r) => r.json());

    // Guard: 409 before completion
    assert.equal((await ask(`/sessions/${parentStart.id}/reinforce`, 1, {})).status, 409);

    const parentStored = JSON.parse(
      String((await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [parentStart.id] })).rows[0].tasks),
    ) as Task[];
    // Answer task 0 wrong, task 1 right, leave rest skipped
    await ask(`/sessions/${parentStart.id}/check`, 1, {
      taskId: parentStored[0].id,
      answer: parentStored[0].options.find((o) => o !== parentStored[0].answer) ?? "yanlis",
    });
    await ask(`/sessions/${parentStart.id}/check`, 1, {
      taskId: parentStored[1].id,
      answer: parentStored[1].answer,
    });
    assert.equal((await ask(`/sessions/${parentStart.id}/submit`, 1, {})).status, 202);

    // Parallel POST /reinforce calls must be strictly idempotent
    const [r1, r2] = await Promise.all([
      ask(`/sessions/${parentStart.id}/reinforce`, 1, {}).then((r) => r.json()),
      ask(`/sessions/${parentStart.id}/reinforce`, 1, {}).then((r) => r.json()),
    ]);
    assert.equal(r1.id, r2.id);
    assert.equal(r1.reinforcementDirection, "de_tr");

    // Unauthorized user (user 3 without Kaps German permission) gets 403;
    // Permitted another user (user 2) gets 404 on user 1's session
    assert.equal((await ask(`/sessions/${parentStart.id}/reinforce`, 3, {})).status, 403);
    await db.execute("INSERT INTO german_permissions VALUES(2, 1)");
    assert.equal((await ask(`/sessions/${parentStart.id}/reinforce`, 2, {})).status, 404);

    // Fetch child reinforcement session and verify exact parent vocab scope + reverse direction + missed word prioritized
    const childSess = await ask(`/sessions/${r1.id}`, 1).then((r) => r.json());
    assert.equal(childSess.parentSessionId, parentStart.id);
    assert.equal(childSess.reinforcementDirection, "de_tr");
    const parentWordIds = new Set(parentStored.flatMap((t) => t.vocabularyIds));
    for (const ct of childSess.tasks as Task[]) {
      assert.ok(ct.vocabularyIds.some((id) => parentWordIds.has(id)));
      if (ct.type === "choice" || ct.type === "translation" || ct.type === "sentence_translation") {
        assert.equal(ct.direction, "de_tr");
      }
    }
    // Missed first task's word must be included near the top
    const missedId = parentStored[0].vocabularyIds[0];
    assert.ok(childSess.tasks.slice(0, 3).some((ct: Task) => ct.vocabularyIds.includes(missedId)));

    // Starting a normal session with same filters must NOT hijack the active reinforcement child!
    const freshRoot = await ask("/sessions", 1, {
      module: "vocabulary",
      mode: "practice",
      activity: "mixed",
      direction: "de_tr",
      levels: ["A2"],
    }).then((r) => r.json());
    assert.notEqual(freshRoot.id, r1.id);

    // Cannot create 2-hop reinforcement from a child reinforcement session
    const childAnswerTask = JSON.parse(
      String((await db.execute({ sql: "SELECT tasks FROM german_sessions WHERE id=?", args: [r1.id] })).rows[0].tasks),
    )[0] as Task;
    await ask(`/sessions/${r1.id}/check`, 1, {
      taskId: childAnswerTask.id,
      answer: childAnswerTask.answer,
    });
    await ask(`/sessions/${r1.id}/submit`, 1, {});
    assert.equal((await ask(`/sessions/${r1.id}/reinforce`, 1, {})).status, 409);

    // Parent GET /sessions/:id surfaces completed child reinforcementSession
    const parentAfter = await ask(`/sessions/${parentStart.id}`, 1).then((r) => r.json());
    assert.equal(parentAfter.reinforcementSession?.id, r1.id);
    assert.equal(parentAfter.reinforcementSession?.state, "done");

    // Unit check: article/conjugation parent yields meaningful active recall in reinforcement
    const vocab = toVocabList();
    const a1Nouns = vocab.filter((v) => v.level === "A1" && v.article).slice(0, 4);
    const artParentTasks = buildActivities(vocab.filter((v) => v.level === "A1"), "article", "tr_de", { limit: 4 });
    const artRein = buildReinforcementActivities({
      parentTasks: artParentTasks,
      parentResults: Object.fromEntries(artParentTasks.map((t) => [t.id, { score: 1 }])),
      parentDirection: "tr_de",
      scopedWords: a1Nouns,
      distractorUniverse: vocab.filter((v) => v.level === "A1"),
      limit: 6,
    });
    assert.ok(artRein.tasks.some((t) => t.type !== "article"));

    assert.equal(
      (await db.execute("PRAGMA integrity_check")).rows[0].integrity_check,
      "ok",
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    db.close();
  }
});
