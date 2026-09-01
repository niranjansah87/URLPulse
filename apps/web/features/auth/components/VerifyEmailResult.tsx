"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { authClient } from "../client";
import styles from "./auth.module.css";

/**
 * Result of clicking an email-verification link. The API verifies the token and
 * redirects here; a failure adds `?error=...`. On success the user is already
 * signed in (autoSignInAfterVerification) and can go straight to the dashboard;
 * on failure they can request a fresh link.
 */
export function VerifyEmailResult() {
  const params = useSearchParams();
  const error = params.get("error");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  if (!error) {
    return (
      <div className={styles.form}>
        <p className={styles.success} role="status">
          <CheckCircle2 size={18} aria-hidden /> Your email address has been verified. You&apos;re all set.
        </p>
        <Link href="/batches" className={styles.backLink}>
          Go to Dashboard <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    );
  }

  const resend = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: "/verify-email" });
      toast.success("Verification email sent", { description: "Check your inbox for a new link." });
    } catch {
      toast.error("Couldn't send the email", { description: "Please try again in a moment." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={resend} noValidate>
      <p className={styles.error} role="alert">
        This verification link is invalid or has expired.
      </p>
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
            placeholder="Enter your email to resend"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </span>
      </label>
      <Button type="submit" variant="accent" size="lg" className={styles.submit} disabled={busy} aria-busy={busy}>
        {busy ? "Sending…" : "Resend verification link"}
        <ArrowRight size={18} aria-hidden />
      </Button>
      <Link href="/login" className={styles.backLink}>
        Back to login
      </Link>
    </form>
  );
}
