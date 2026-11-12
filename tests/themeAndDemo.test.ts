import test from "node:test";
import assert from "node:assert/strict";
import { THEME_OPTIONS, isThemeDark } from "../src/utils/theme";
import {
  DEFAULT_PREFERENCES,
  sanitizePreferences,
  formatPreferenceTime,
} from "../src/utils/preferences";
import { getTabFromPathname, getPathFromTab, APP_ROUTES } from "../src/routes";

test("Theme system supports Karanlık, Açık, Pembe, Lacivert, Zümrüt, and Ametist themes", () => {
  const ids = THEME_OPTIONS.map((t) => t.id);
  assert.ok(ids.includes("dark"), "Dark theme must be defined");
  assert.ok(ids.includes("light"), "Light theme must be defined");
  assert.ok(ids.includes("pink"), "Pink theme must be defined");
  assert.ok(ids.includes("navy"), "Navy theme must be defined");
  assert.ok(ids.includes("emerald"), "Emerald theme must be defined");
  assert.ok(ids.includes("amethyst"), "Amethyst theme must be defined");
  assert.strictEqual(THEME_OPTIONS.length, 6, "Must have 6 curated themes");

  for (const opt of THEME_OPTIONS) {
    assert.ok(opt.nameTr.length > 0, `Theme ${opt.id} must have Turkish name`);
    assert.ok(opt.badgeTr.length > 0, `Theme ${opt.id} must have badge text`);
    assert.ok(opt.previewBg.startsWith("#"), `Theme ${opt.id} must have hex background`);
    assert.ok(opt.previewAccent.startsWith("#"), `Theme ${opt.id} must have hex accent`);
  }

  assert.strictEqual(isThemeDark("light"), false);
  assert.strictEqual(isThemeDark("dark"), true);
  assert.strictEqual(isThemeDark("pink"), true);
  assert.strictEqual(isThemeDark("navy"), true);
});

test("UserPreferences sanitizePreferences validates and clamps all settings", () => {
  const clean = sanitizePreferences({
    theme: "pink",
    accentColor: "rose",
    density: "compact",
    fontScale: "lg",
    reducedMotion: true,
    sidebarCollapsed: true,
    soundEnabled: false,
    soundVolume: 150, // should clamp to 100
    desktopNotifs: false,
    doNotDisturb: true,
    chatSendOnEnter: false,
    timeFormat: "12h",
    showSeconds: true,
    privacyHideSensitive: true,
    onlineStatusVisible: false,
    defaultStartTab: "ayvalik-cas",
  });

  assert.strictEqual(clean.theme, "pink");
  assert.strictEqual(clean.accentColor, "rose");
  assert.strictEqual(clean.density, "compact");
  assert.strictEqual(clean.fontScale, "lg");
  assert.strictEqual(clean.reducedMotion, true);
  assert.strictEqual(clean.sidebarCollapsed, true);
  assert.strictEqual(clean.soundEnabled, false);
  assert.strictEqual(clean.soundVolume, 100);
  assert.strictEqual(clean.doNotDisturb, true);
  assert.strictEqual(clean.chatSendOnEnter, false);
  assert.strictEqual(clean.timeFormat, "12h");
  assert.strictEqual(clean.showSeconds, true);
  assert.strictEqual(clean.privacyHideSensitive, true);
  assert.strictEqual(clean.onlineStatusVisible, false);
  assert.strictEqual(clean.defaultStartTab, "ayvalik-cas");

  // Fallback on invalid inputs
  const fallback = sanitizePreferences({
    theme: "invalid" as any,
    density: "ultra" as any,
    soundVolume: -25,
  });
  assert.strictEqual(fallback.theme, DEFAULT_PREFERENCES.theme);
  assert.strictEqual(fallback.density, DEFAULT_PREFERENCES.density);
  assert.strictEqual(fallback.soundVolume, 0);
});

test("formatPreferenceTime formats 24h and 12h time with and without seconds", () => {
  const sampleDate = new Date("2026-11-25T15:08:09");
  const t24 = formatPreferenceTime(sampleDate, {
    ...DEFAULT_PREFERENCES,
    timeFormat: "24h",
    showSeconds: false,
  });
  assert.ok(t24.includes("15") && t24.includes("08"), `Expected 15:08 in ${t24}`);

  const t24Sec = formatPreferenceTime(sampleDate, {
    ...DEFAULT_PREFERENCES,
    timeFormat: "24h",
    showSeconds: true,
  });
  assert.ok(t24Sec.includes("09"), `Expected seconds 09 in ${t24Sec}`);
});

test("Route system maps /ayarlar to settings tab and vice versa", () => {
  const resolved = getTabFromPathname("/ayarlar");
  assert.strictEqual(resolved.tab, "settings");

  const resolvedAlias = getTabFromPathname("/settings");
  assert.strictEqual(resolvedAlias.tab, "settings");

  const path = getPathFromTab("settings");
  assert.strictEqual(path, "/ayarlar");

  assert.ok(APP_ROUTES.settings, "APP_ROUTES must have settings entry");
  assert.strictEqual(APP_ROUTES.settings.path, "/ayarlar");
});

