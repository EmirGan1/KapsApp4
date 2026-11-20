import { test } from "node:test";
import assert from "node:assert/strict";
import { buildActivities } from "../src/server/german/activities";
import { BUILTIN_CURRICULUM } from "../src/server/german/curriculum";
import { activities, validStudyFilters } from "../src/shared/germanActivities";
import { parseDocument } from "../src/server/german/learning";
import { gradeAnswer, parseCefrHeading } from "../src/server/german/cefr";

const words = parseDocument({
  body: {
    content: [
      "A1",
      "der Apfel — elma / elma meyvesi",
      "die Schule — okul",
      "das Haus — ev",
      "B1",
      "Ich freue mich darauf. — Bunu sabırsızlıkla bekliyorum.",
      "obwohl — rağmen",
      "die Bewerbung — başvuru",
    ].map((content) => ({ paragraph: { elements: [{ textRun: { content } }] } })),
  },
}).entries;

test("built-in curriculum covers all 5 CEFR levels strictly with authentic examples", () => {
  for (const level of ["A1", "A2", "B1", "B2", "C1"] as const) {
    const sub = BUILTIN_CURRICULUM.filter((w) => w.level === level).map((w) => ({
      ...w,
      canonicalKey: w.de.toLowerCase(),
      raw: `${w.de} — ${w.tr}`,
      cefrSource: "builtin" as const,
    }));
    assert.ok(sub.length >= 20, `${level} should have at least 20 curated entries`);
    const tasks = buildActivities(sub, "mixed", "tr_de");
    assert.ok(tasks.length >= 10, `${level} should generate mixed tasks`);
    assert.ok(
      tasks.every((t) => t.level === level),
      `${level} mixed tasks must never leak another CEFR level`,
    );
  }
});

test("strict CEFR level filtering across single and multi-level selections", () => {
  const a1Words = BUILTIN_CURRICULUM.filter((w) => w.level === "A1").map((w) => ({
    ...w,
    canonicalKey: w.de.toLowerCase(),
    raw: `${w.de} — ${w.tr}`,
    cefrSource: "builtin" as const,
  }));
  const a2Words = BUILTIN_CURRICULUM.filter((w) => w.level === "A2").map((w) => ({
    ...w,
    canonicalKey: w.de.toLowerCase(),
    raw: `${w.de} — ${w.tr}`,
    cefrSource: "builtin" as const,
  }));
  const b1Words = BUILTIN_CURRICULUM.filter((w) => w.level === "B1").map((w) => ({
    ...w,
    canonicalKey: w.de.toLowerCase(),
    raw: `${w.de} — ${w.tr}`,
    cefrSource: "builtin" as const,
  }));

  // Test 1 — A1 only
  const a1Tasks = buildActivities(a1Words, "mixed", "mixed");
  assert.ok(a1Tasks.every((t) => t.level === "A1"));
  assert.ok(a1Tasks.every((t) => t.vocabularyIds.every((id) => a1Words.some((w) => w.id === id))));

  // Test 2 — A2 only
  const a2Tasks = buildActivities(a2Words, "mixed", "mixed");
  assert.ok(a2Tasks.every((t) => t.level === "A2"));
  assert.ok(a2Tasks.every((t) => t.vocabularyIds.every((id) => a2Words.some((w) => w.id === id))));

  // Test 3 — A1 + B1 only
  const a1b1 = [...a1Words, ...b1Words];
  const mixedTasks = buildActivities(a1b1, "mixed", "mixed");
  assert.ok(mixedTasks.every((t) => t.level === "A1" || t.level === "B1"));
  assert.ok(!mixedTasks.some((t) => t.level === "A2"));

  // Unclassified words must NEVER be included in generated activities
  const unclassified = [
    ...words.map((w) => ({ ...w, level: "UNCLASSIFIED" as const })),
  ];
  assert.deepEqual(buildActivities(unclassified, "mixed"), []);
});

test("all supported activity types are built cleanly with internally consistent answers", () => {
  const fullA1 = BUILTIN_CURRICULUM.filter((w) => w.level === "A1").map((w) => ({
    ...w,
    canonicalKey: w.de.toLowerCase(),
    raw: `${w.de} — ${w.tr}`,
    cefrSource: "builtin" as const,
  }));
  const typesToCheck = activities.map((a) => a[0]).filter((t) => t !== "mistake_review");
  for (const type of typesToCheck) {
    const tasks = buildActivities(fullA1, type, "tr_de");
    assert.ok(tasks.length > 0, `Expected tasks for ${type}`);
    for (const task of tasks) {
      assert.equal(task.type, type);
      assert.ok(task.vocabularyIds.every((id) => fullA1.some((w) => w.id === id)));
      if (task.options.length && String(task.type) !== "multi") {
        assert.ok(task.options.includes(task.answer), `Missing answer in options for ${type}`);
      }
      if (task.interaction?.tiles) {
        assert.deepEqual(
          [...task.interaction.tiles].sort(),
          task.answer.split(" ").sort(),
        );
      }
      if (task.type === "matching") {
        assert.deepEqual(
          [...JSON.parse(task.answer)].sort(),
          [...task.interaction!.right!].sort(),
        );
      }
      if (task.type === "listening") {
        assert.ok(task.interaction?.audioText);
      }
    }
  }
});

test("CEFR heading parser handles varied heading formats without misclassifying translations", () => {
  assert.equal(parseCefrHeading("A1"), "A1");
  assert.equal(parseCefrHeading("Seviye A2"), "A2");
  assert.equal(parseCefrHeading("## B1 — Alltag & Beruf"), "B1");
  assert.equal(parseCefrHeading("[B2] Akademik Kelimeler"), "B2");
  assert.equal(parseCefrHeading("Level: C1.1"), "C1");
  assert.equal(parseCefrHeading("der Apfel — elma"), null);
});

test("answer validation handles capitalization, punctuation, alternatives, eszett and keeps umlaut distinction", () => {
  assert.equal(
    gradeAnswer({
      type: "translation",
      answer: "der Apfel",
      userAnswer: "  DER APFEL! ",
    }),
    true,
  );
  assert.equal(
    gradeAnswer({
      type: "translation",
      answer: "elma / elma meyvesi",
      userAnswer: "elma",
    }),
    true,
  );
  assert.equal(
    gradeAnswer({
      type: "sentence_translation",
      answer: "Das ist groß.",
      userAnswer: "das ist gross",
    }),
    true,
  );
  assert.equal(
    gradeAnswer({
      type: "translation",
      answer: "schön",
      userAnswer: "schon",
    }),
    false,
  );
});

test("filters and insufficient sources never fabricate material", () => {
  for (const [id] of activities) {
    if (id === "mistake_review") continue;
    assert.ok(buildActivities(words, id).every((t) => t.type === id));
  }
  assert.deepEqual(buildActivities([]), []);
  assert.deepEqual(buildActivities([words[0]], "matching"), []);
  assert.deepEqual(buildActivities([words[4]], "article"), []);
  assert.deepEqual(buildActivities([words[4]], "ordering"), []);
});

test("multi-level selection rejects empty or invalid client settings", () => {
  assert.ok(validStudyFilters("mixed", ["A2", "B1"]));
  assert.equal(validStudyFilters("de_tr", []), false);
  assert.equal(validStudyFilters("de_tr", ["C9"]), false);
  assert.equal(validStudyFilters("xx", ["B1"]), false);
});
