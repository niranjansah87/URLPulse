"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { authClient } from "../client";
import styles from "./auth.module.css";

const GENERIC_SENT =
  "If an account exists for that email, you'll receive a password reset link shortly.";

/**
 * Request a password reset. Anti-enumeration: a valid submission always shows the
 * same generic confirmation whether or not the email has an account — the server
 * never reveals existence, and neither does this UI. The reset URL is built
 * server-side from the trusted WEB_ORIGIN; `redirectTo` is only a same-site path.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { error: resErr } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });
      // A rate-limit is the one case worth surfacing distinctly; every other
      // outcome (including an unknown email) resolves to the same generic notice.
      if (resErr?.status === 429) {
        setError("Too many attempts. Please try again in a few minutes.");
        return;
      }
      setSent(true);
    } catch {
      setError("Can't reach the server right now. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className={styles.form}>
        <p className={styles.subtitle} role="status" style={{ margin: 0 }}>
          {GENERIC_SENT}
        </p>
        <p className={styles.switch}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input
          className={styles.input}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" disabled={busy} aria-busy={busy} style={{ width: "100%" }}>
        {busy ? "Sending…" : "Send reset link"}
      </Button>

      <p className={styles.switch}>
        Remembered it? <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
