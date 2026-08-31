"use client";

import { useId, useState } from "react";
import { CheckCircle2, Circle, Eye, EyeOff, Lock } from "lucide-react";
import { assess } from "../lib/password-strength";
import styles from "./auth.module.css";

/**
 * Password field with a leading lock icon and a show/hide toggle (per the
 * references). Opt into a strength meter with `showStrength` (colored bars +
 * label, and the input border tints weak → strong) and the requirement
 * checklist with `showChecklist`. Both are shared across sign-up and reset.
 */
export function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  hint,
  invalid,
  describedBy,
  showStrength = false,
  showChecklist = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  invalid?: boolean;
  describedBy?: string;
  showStrength?: boolean;
  showChecklist?: boolean;
}) {
  const [show, setShow] = useState(false);
  const hintId = useId();
  const meterId = useId();
  const strength = showStrength || showChecklist ? assess(value) : null;
  // A weak (or mismatched) password tints the border; a valid one is neutral.
  const dataStrength = invalid ? "weak" : strength && value ? strength.tone : undefined;

  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputWrap} data-trailing="true">
        <span className={styles.inputIcon}>
          <Lock size={18} />
        </span>
        <input
          className={styles.input}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          minLength={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-strength={dataStrength}
          aria-invalid={invalid || undefined}
          aria-describedby={[hint ? hintId : null, strength ? meterId : null, describedBy ?? null].filter(Boolean).join(" ") || undefined}
        />
        <button
          type="button"
          className={styles.eyeBtn}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>

      {strength ? (
        <div id={meterId} aria-live="polite">
          {showStrength ? (
            <div className={styles.strength}>
              <div className={styles.strengthBars} aria-hidden>
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={styles.strengthBar} data-on={strength.score >= n} data-tone={strength.tone} />
                ))}
              </div>
              <span className={styles.strengthLabel} data-tone={strength.tone}>
                {value ? strength.label : ""}
              </span>
            </div>
          ) : null}
          {showChecklist ? (
            <ul className={styles.checklist} style={showStrength ? { marginTop: "var(--space-2)" } : undefined}>
              {strength.checks.map((c) => (
                <li key={c.label} data-ok={c.ok}>
                  {c.ok ? <CheckCircle2 size={16} aria-hidden /> : <Circle size={16} aria-hidden />}
                  {c.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {hint ? (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}
