"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { authClient } from "../client";
import styles from "./auth.module.css";

type Mode = "login" | "signup";

/** Only allow same-site relative redirects from `?next=` (never an external URL). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/batches";
}

/** A signed-in session with the user's verification state (Better Auth shape). */
interface SignInData {
  user?: { emailVerified?: boolean };
}

/**
 * Email + password sign-in / sign-up against the Better Auth routes on the API.
 *
 * Verification flow: a verification email is sent on sign-up. An unverified user
 * may still sign in a few times — each shows a reminder toast — after which the
 * API blocks sign-in (403 EMAIL_VERIFICATION_REQUIRED); we then resend the link
 * and tell them to check their inbox. Verified users sign in normally.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function resendVerification(address: string) {
    try {
      await authClient.sendVerificationEmail({ email: address, callbackURL: "/batches" });
    } catch {
      // best-effort; the toast below still tells the user to check their inbox
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const address = email.trim();
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({ name: name.trim(), email: address, password });
        if (result.error) {
          setError(result.error.message || "Sign-up failed. Please try again.");
          return;
        }
        toast.success("Account created", {
          description: "Check your inbox to verify your email address.",
        });
        router.replace(safeNext(params.get("next")));
        router.refresh();
        return;
      }

      const result = await authClient.signIn.email({ email: address, password });
      if (result.error) {
        // Grace period exhausted: verification now required. Resend and inform.
        if (result.error.code === "EMAIL_VERIFICATION_REQUIRED" || result.error.status === 403) {
          await resendVerification(address);
          toast.info("Please verify your email", {
            description: "We've sent a new verification link to your inbox.",
          });
          return;
        }
        setError(result.error.message || "Sign-in failed. Check your details and try again.");
        return;
      }

      // Signed in. Remind unverified users (they still have a few sign-ins left).
      if ((result.data as SignInData | undefined)?.user?.emailVerified === false) {
        toast.warning("Verify your email", {
          description: "Please verify your email address to keep full access.",
        });
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
    <motion.form
      className={styles.form}
      onSubmit={submit}
      noValidate
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
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

      {mode === "login" ? (
        <p className={styles.switch} style={{ textAlign: "right", marginTop: "calc(-1 * var(--space-2))" }}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
      ) : null}

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
    </motion.form>
  );
}
