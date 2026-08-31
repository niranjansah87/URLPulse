"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { authClient } from "../client";
import styles from "./auth.module.css";

type Mode = "login" | "signup";

/** Only allow same-site relative redirects from `?next=` (never an external URL). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/batches";
}

/** Email + password sign-in / sign-up against the Better Auth routes on the API. */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "signup"
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message || "Sign-in failed. Check your details and try again.");
        return;
      }
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch {
      setError("Can't reach the sign-in service. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {mode === "signup" ? (
        <label className={styles.field}>
          <span className={styles.label}>Full name</span>
          <input className={styles.input} type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      ) : null}
      <label className={styles.field}>
        <span className={styles.label}>Email</span>
        <input className={styles.input} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>Password</span>
        <input
          className={styles.input}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={mode === "signup" ? "pw-hint" : undefined}
        />
        {mode === "signup" ? (
          <span id="pw-hint" className={styles.hint}>
            At least 8 characters.
          </span>
        ) : null}
      </label>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" disabled={busy} aria-busy={busy} style={{ width: "100%" }}>
        {busy ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "signup" ? "Create account" : "Sign in"}
      </Button>

      <p className={styles.switch}>
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login">Sign in</Link>
          </>
        ) : (
          <>
            New to URLPulse? <Link href="/signup">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
