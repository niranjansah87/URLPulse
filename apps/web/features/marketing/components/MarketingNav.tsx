"use client";

import { Logo } from "@/components/ui/Logo";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import styles from "../landing.module.css";

export function MarketingNav() {
  const { status } = useCurrentUser();
  const authenticated = status === "authenticated";

  return (
    <header className={styles.nav}>
      <div className={styles.container}>
        <div className={styles.navRow}>
          <Logo href="/" size="md" />
          <div className={styles.navActions}>
            <ThemeToggle />
            {authenticated ? (
              <Link href="/batches">
                <Button variant="accent">Dashboard</Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="accent">Get Started</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
