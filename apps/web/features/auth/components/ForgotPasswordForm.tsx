"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Info, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { authClient } from "../client";
import styles from "./auth.module.css";

const GENERIC_SENT = "If an account exists for that email, you'll receive a password reset link shortly.";

/**
 * Request a password reset. Anti-enumeration: a valid submission always shows the
 * same generic confirmation whether or not the email has an account - the server
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
        <p className={styles.success} role="status">
          {GENERIC_SENT}
        </p>
        <div className={styles.divider}>or</div>
        <Link href="/login" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden /> Back to login
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>Email address</span>
        <span className={styles.inputWrap}>
          <span className={styles.inputIcon}>
            <Mail size={18} />
          </span>
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            placeholder="Enter your email address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </span>
      </label>

      <div className={styles.note} data-tone="accent">
        <span className={styles.noteIcon}>
          <Info size={20} strokeWidth={1.75} />
        </span>
        <span className={styles.noteText}>Make sure to check your spam or junk folder if you don&apos;t see the email in your inbox.</span>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" className={styles.submit} disabled={busy} aria-busy={busy}>
        {busy ? "Sending…" : "Send Reset Link"}
        <ArrowRight size={18} aria-hidden />
      </Button>

      <div className={styles.divider}>or</div>

      <Link href="/login" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden /> Back to login
      </Link>
    </form>
  );
}
