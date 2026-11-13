/**
 * Strict gate for showing the UI-only Demo / Preview login button.
 * Only permitted in Vite DEV mode AND when embedded inside an AI Studio iframe.
 * Never enabled in standalone browser tabs, external hosts, or production builds.
 */
export function isAiStudioDemoEnvironment(
  isDev: boolean,
  win?: {
    self?: unknown;
    top?: unknown;
    location?: { ancestorOrigins?: ArrayLike<string> | null };
  } | null,
  doc?: { referrer?: string } | null
): boolean {
  if (!isDev || !win) return false;
  try {
    if (!win.top || win.self === win.top) return false;
    const ref = typeof doc?.referrer === "string" ? doc.referrer.toLowerCase() : "";
    if (ref.includes("aistudio.google.com")) return true;
    const origins = win.location?.ancestorOrigins;
    if (origins && typeof origins.length === "number") {
      for (let i = 0; i < origins.length; i++) {
        const origin = String(origins[i] || "").toLowerCase();
        if (origin.includes("aistudio.google.com")) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
