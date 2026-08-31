"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { authClient } from "../client";
import styles from "./auth.module.css";

const MIN_PASSWORD = 8;

/**
 * Set a new password from a reset link. The token comes from the URL query (read
 * once, kept only in memory — never persisted to localStorage or app state beyond
 * the request). Better Auth validates and single-use-consumes the token; an
 * invalid/expired token surfaces as a clear terminal state. On success the user
 * is sent to /login to sign in with the new password (no auto-login).
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
        // invalid/expired/used token — a terminal state, not a retry.
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
        <p className={styles.error} role="alert" style={{ margin: 0 }}>
          This password reset link is invalid or has expired.
        </p>
        <p className={styles.switch}>
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className={styles.form}>
        <p className={styles.subtitle} role="status" style={{ margin: 0 }}>
          Password updated successfully. Sign in with your new password.
        </p>
        <Button type="button" variant="accent" size="lg" style={{ width: "100%" }} onClick={() => { window.location.href = "/login"; }}>
          Go to sign in
        </Button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.field}>
        <span className={styles.label}>New password</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="pw-hint"
        />
        <span id="pw-hint" className={styles.hint}>
          At least {MIN_PASSWORD} characters.
        </span>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Confirm new password</span>
        <input
          className={styles.input}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" disabled={busy} aria-busy={busy} style={{ width: "100%" }}>
        {busy ? "Resetting…" : "Reset password"}
      </Button>

      <p className={styles.switch}>
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  );
}
