export const MIN_PASSWORD = 8;

export type StrengthTone = "empty" | "weak" | "fair" | "good" | "strong";

export interface Strength {
  /** 0 (empty) to 4 (strong). */
  score: number;
  tone: StrengthTone;
  /** "" when empty, otherwise Weak / Fair / Good / Strong. */
  label: string;
  checks: { label: string; ok: boolean }[];
}

/** Simple, explainable strength: length, mixed case, and numbers/symbols. */
export function assess(pw: string): Strength {
  const checks = [
    { label: `At least ${MIN_PASSWORD} characters`, ok: pw.length >= MIN_PASSWORD },
    { label: "Contains uppercase and lowercase letters", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: "Contains numbers and special characters", ok: /\d/.test(pw) && /[^A-Za-z0-9]/.test(pw) },
  ];
  const passed = checks.filter((c) => c.ok).length;
  // Fourth (Strong) tier only for long passwords that pass every check.
  const score = pw.length === 0 ? 0 : passed === 3 && pw.length >= 12 ? 4 : Math.max(1, passed);
  const tone: StrengthTone = score === 0 ? "empty" : score === 1 ? "weak" : score === 2 ? "fair" : score === 3 ? "good" : "strong";
  const label = score >= 4 ? "Strong" : score === 3 ? "Good" : score === 2 ? "Fair" : score === 1 ? "Weak" : "";
  return { score, tone, label, checks };
}
