import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { HeroGreeting } from "./HeroGreeting";
import styles from "./dashboard.module.css";

/** Welcome band: greeting, headline, copy, and the primary actions. */
export function DashboardHero() {
  return (
    <Card padded={false} className={styles.hero}>
      <HeroGreeting />
      <h2 className={styles.headline}>Keep your links healthy and reliable.</h2>
      <p className={styles.heroText}>
        Submit a list of URLs and let URLPulse handle the rest. Fast. Reliable. Real-time.
      </p>
      <div className={styles.heroActions}>
        <Link href="/batches/new">
          <Button variant="primary" leftIcon={<Plus size={16} strokeWidth={2} />}>
            New Batch
          </Button>
        </Link>
        <Link href="https://github.com/niranjansah87/URLPulse/tree/main/docs" target="_blank" rel="noreferrer">
          <Button variant="ghost">
            View documentation <ArrowRight size={16} aria-hidden />
          </Button>
        </Link>
      </div>
    </Card>
  );
}
