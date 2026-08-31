"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Mail, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { authClient } from "../client";
import { PasswordInput } from "./PasswordInput";
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

/** Text input with a leading icon (name / email), matching the references. */
function IconField({
  label,
  icon,
  ...input
}: {
  label: string;
  icon: ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.inputWrap}>
        <span className={styles.inputIcon}>{icon}</span>
        <input className={styles.input} {...input} />
      </span>
    </label>
  );
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
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
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
    const address = email.trim();

    if (mode === "signup") {
      if (password !== confirm) {
        setError("Passwords do not match.");
        return;
      }
      if (!agree) {
        setError("Please accept the Terms of Service and Privacy Policy to continue.");
        return;
      }
    }

    setBusy(true);
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

      const result = await authClient.signIn.email({ email: address, password, rememberMe: remember });
      if (result.error) {
        const code = result.error.code;
        // Too many wrong passwords: the account is locked and a reset link was
        // already emailed by the API — don't resend a verification email here.
        if (code === "ACCOUNT_LOCKED") {
          toast.error("Account temporarily locked", {
            description: "Too many failed attempts. We've emailed you a password reset link.",
          });
          return;
        }
        // Grace period exhausted: verification now required. Resend and inform.
        if (code === "EMAIL_VERIFICATION_REQUIRED") {
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
      setError(mode === "signup" ? "Can't reach the sign-up service. Please try again." : "Can't reach the sign-in service. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {mode === "signup" ? (
        <IconField
          label="Full name"
          icon={<User size={18} />}
          type="text"
          autoComplete="name"
          placeholder="Enter your full name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      ) : null}

      <IconField
        label="Email address"
        icon={<Mail size={18} />}
        type="email"
        autoComplete="email"
        placeholder="Enter your email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <PasswordInput
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        hint={mode === "signup" ? "Use at least 8 characters with letters, numbers & symbols." : undefined}
      />

      {mode === "signup" ? (
        <PasswordInput
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          placeholder="Confirm your password"
          autoComplete="new-password"
          invalid={confirm.length > 0 && confirm !== password}
        />
      ) : null}

      {mode === "login" ? (
        <div className={styles.row}>
          <label className={styles.check}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me
          </label>
          <Link href="/forgot-password" className={styles.link}>
            Forgot password?
          </Link>
        </div>
      ) : (
        <label className={styles.check}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
          <span>
            I agree to the <Link href="/#legal" className={styles.link}>Terms of Service</Link> and{" "}
            <Link href="/#legal" className={styles.link}>Privacy Policy</Link>
          </span>
        </label>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" className={styles.submit} disabled={busy} aria-busy={busy}>
        {busy ? (mode === "signup" ? "Creating account…" : "Signing in…") : mode === "signup" ? "Create account" : "Login"}
        <ArrowRight size={18} aria-hidden />
      </Button>

      <div className={styles.divider}>or</div>

      {mode === "login" ? (
        <div className={styles.note}>
          <span className={styles.noteIcon}>
            <ShieldCheck size={20} strokeWidth={1.75} />
          </span>
          <span>
            <span className={styles.noteTitle}>Secure &amp; private</span>
            <span className={styles.noteText}>Your data is encrypted and never shared.</span>
          </span>
        </div>
      ) : null}

      <p className={styles.switch}>
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login" className={styles.link}>Login</Link>
          </>
        ) : (
          <>
            Don&apos;t have an account? <Link href="/signup" className={styles.link}>Sign up</Link>
          </>
        )}
      </p>
    </form>
  );
}
