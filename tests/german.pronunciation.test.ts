import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILTIN_CURRICULUM } from "../src/server/german/curriculum";
import {
  CURATED_PRONUNCIATION_MAP,
  estimateUnverifiedPronunciation,
  lookupCuratedPronunciation,
  resolvePronunciation,
} from "../src/server/german/pronunciation";
import { selectGermanVoice } from "../src/components/german/api";

test("Curated German pronunciations: full builtin A1-C1 coverage with verified=true & valid IPA/syllables", () => {
  assert.ok(CURATED_PRONUNCIATION_MAP.size >= 175);

  const missing: string[] = [];
  for (const entry of BUILTIN_CURRICULUM) {
    const pron = lookupCuratedPronunciation(entry.de);
    if (!pron) {
      missing.push(`${entry.level}: ${entry.de}`);
      continue;
    }
    assert.equal(pron.verified, true, `Builtin word "${entry.de}" must be verified`);
    assert.equal(pron.source, "curated");
    assert.ok(pron.ipa.trim().length > 0, `Missing IPA for "${entry.de}"`);
    assert.ok(pron.turkishApprox.trim().length > 0, `Missing Turkish approx for "${entry.de}"`);
    assert.ok(Array.isArray(pron.syllables) && pron.syllables.length >= 1, `Missing syllables for "${entry.de}"`);
  }

  assert.deepEqual(missing, [], `Missing curated pronunciation for builtin entries: ${missing.join(", ")}`);
});

test("Custom unverified words NEVER receive verified=true automatically", () => {
  const est = estimateUnverifiedPronunciation("die Sonderprüfung");
  assert.equal(est.verified, false);
  assert.equal(est.source, "estimated");
  assert.ok(est.turkishApprox.includes("dii"));
  assert.ok(est.notesTr.includes("Tahmini") || est.notesTr.includes("tahmini"));

  const resolved = resolvePronunciation("das Kunstwortxyz");
  assert.equal(resolved.verified, false);
  assert.equal(resolved.source, "estimated");

  // Curated lookup works even without article or via resolvePronunciation
  const apfel = resolvePronunciation("der Apfel");
  assert.equal(apfel.verified, true);
  assert.equal(apfel.source, "curated");
  assert.equal(apfel.ipa, "/deːɐ̯ ˈapfəl/");
});

test("Strict German TTS voice selection: NEVER falls back to Turkish or English voices", () => {
  const onlyTurkishAndEnglish = [
    { lang: "tr-TR", name: "Yelda (Türkçe)", localService: true, default: true },
    { lang: "en-US", name: "Samantha", localService: true, default: false },
  ];
  assert.equal(
    selectGermanVoice(onlyTurkishAndEnglish),
    null,
    "Must return null instead of picking Turkish or English default voice",
  );

  assert.equal(selectGermanVoice([]), null);

  const mixedVoices = [
    { lang: "tr-TR", name: "Microsoft Emel - Turkish (Turkey)", localService: false, default: true },
    { lang: "de-AT", name: "Jonas (German Austria)", localService: true, default: false },
    { lang: "de-DE", name: "Microsoft Katja Online (Natural) - German", localService: false, default: false },
  ];
  const chosen = selectGermanVoice(mixedVoices);
  assert.ok(chosen);
  assert.equal(chosen.lang, "de-DE");
  assert.ok(chosen.name.includes("Katja"));
});
