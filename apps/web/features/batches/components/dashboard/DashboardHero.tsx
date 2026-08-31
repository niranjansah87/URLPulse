import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import styles from "./dashboard.module.css";

/** Hero band per the dashboard reference: overline, headline, copy, actions, and the existing illustration asset. */
export function DashboardHero() {
  return (
    <Card padded={false} className={styles.hero}>
      <div>
        <div className={styles.overline}>Welcome back,</div>
        <h2 className={styles.headline}>Keep your links healthy and reliable.</h2>
        <p className={styles.heroText}>
          Submit a list of URLs and let URLPulse handle the rest. Fast. Reliable. Real-time.
        </p>
        <div className={styles.heroActions}>
          <Link href="/batches/new">
            <Button variant="primary" size="lg" leftIcon={<Plus size={16} strokeWidth={2} />}>
              New Batch
            </Button>
          </Link>
          <Link href="https://github.com/niranjansah87/URLPulse/tree/main/docs" target="_blank" rel="noreferrer">
            <Button variant="ghost" size="lg">
              View documentation <ArrowRight size={16} aria-hidden />
            </Button>
          </Link>
        </div>
      </div>
      <div className={styles.heroArt} aria-hidden>
        <img
          className={cn(styles.illustration, styles.illustrationLight)}
          src="/illustration/urlpulse-dashboard-illustration-light.png"
          alt=""
          loading="eager"
        />
        <img
          className={cn(styles.illustration, styles.illustrationDark)}
          src="/illustration/urlpulse-dashboard-illustration-dark.png"
          alt=""
          loading="eager"
        />
      </div>
    </Card>
  );
}
