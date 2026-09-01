"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { authClient } from "../client";
import { PasswordInput } from "./PasswordInput";
import { MIN_PASSWORD } from "../lib/password-strength";
import styles from "./auth.module.css";

/**
 * Set a new password from a reset link. The token comes from the URL query (read
 * once, kept only in memory). Better Auth validates and single-use-consumes the
 * token; an invalid/expired token surfaces as a clear terminal state. On success
 * the user is sent to /login to sign in with the new password (no auto-login).
 */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invalidToken, setInvalidToken] = useState(!token);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setInvalidToken(true);
      return;
    }
    setBusy(true);
    try {
      const { error: resErr } = await authClient.resetPassword({ newPassword: password, token });
      if (resErr) {
        // A weak password is already caught above, so a server error here is an
        // invalid/expired/used token - a terminal state, not a retry.
        setInvalidToken(true);
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (invalidToken) {
    return (
      <div className={styles.form}>
        <p className={styles.error} role="alert">
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" className={styles.backLink}>
          Request a new link <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className={styles.form}>
        <p className={styles.success} role="status">
          Password updated successfully. Sign in with your new password.
        </p>
        <Link href="/login" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden /> Back to login
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <PasswordInput
        label="New password"
        value={password}
        onChange={setPassword}
        placeholder="Enter a new password"
        autoComplete="new-password"
        showStrength
        showChecklist
      />

      <PasswordInput
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
        placeholder="Re-enter your new password"
        autoComplete="new-password"
        invalid={confirm.length > 0 && confirm !== password}
      />

      <div className={styles.note} data-tone="accent">
        <span className={styles.noteIcon}>
          <Info size={20} strokeWidth={1.75} />
        </span>
        <span className={styles.noteText}>Make sure both passwords match.</span>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" className={styles.submit} disabled={busy} aria-busy={busy}>
        {busy ? "Resetting…" : "Reset Password"}
        <ArrowRight size={18} aria-hidden />
      </Button>

      <div className={styles.divider}>or</div>

      <Link href="/login" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden /> Back to login
      </Link>
    </form>
  );
}
