/** KMK IB conversion: transcript total includes TOK/EE, benchmark maximum is 42.
 * DAAD: https://www.daad.de/en/studying-in-germany/requirements/ib-diploma/
 * Keep one decimal WITHOUT rounding. Scores 42–45 receive 1.0.
 */
export function ibToGermanGrade(score: number): number | null {
  if (!Number.isInteger(score) || score < 24 || score > 45) return null;
  // Integer arithmetic avoids floating-point truncation errors.
  return Math.max(10, Math.floor(((48 - score) * 10) / 6)) / 10;
}
