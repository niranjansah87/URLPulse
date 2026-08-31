import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "./AuthForm";
import styles from "./auth.module.css";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Link href="/" aria-label="URLPulse home">
            <img className={`${styles.logo} ${styles.logoLight}`} src="/brand/logo/horizontal/urlpulse-light.png" alt="URLPulse" />
            <img className={`${styles.logo} ${styles.logoDark}`} src="/brand/logo/horizontal/urlpulse-dark.png" alt="URLPulse" />
          </Link>
        </div>
        <h1 className={styles.title}>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
        <p className={styles.subtitle}>
          {mode === "signup" ? "Start monitoring your URLs in minutes." : "Sign in to your URLPulse workspace."}
        </p>
        {/* useSearchParams requires a Suspense boundary during static rendering. */}
        <Suspense fallback={null}>
          <AuthForm mode={mode} />
        </Suspense>
      </div>
    </div>
  );
}
