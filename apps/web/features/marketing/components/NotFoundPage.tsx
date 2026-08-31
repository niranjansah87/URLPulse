import { Logo } from "@/components/ui/Logo";
import Link from "next/link";
import { ArrowRight, Bell, FileText, History, Home, Layers, LayoutGrid, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { MarketingFooter } from "./MarketingFooter";
import styles from "./not-found.module.css";

const SUGGESTIONS = [
  { icon: LayoutGrid, tone: "accent", title: "Dashboard", text: "View an overview of your URL monitoring.", cta: "Go to Dashboard", href: "/batches" },
  { icon: Layers, tone: "success", title: "Batches", text: "Create and manage your monitoring batches.", cta: "View Batches", href: "/batches" },
  { icon: TrendingUp, tone: "warning", title: "History", text: "Check the history of your URL checks.", cta: "View History", href: "/history" },
  { icon: Bell, tone: "error", title: "Alerts", text: "Stay updated with the latest alerts and incidents.", cta: "View Alerts", href: "/alerts" },
] as const;

/**
 * Public 404 (per the reference): big accent "404", primary/secondary CTAs into
 * the app, a "you might be looking for" grid, and the site footer. App links
 * route through the (app) session gate, so a signed-out visitor lands on /login.
 */
export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Logo href="/" size="md" />
        <Link href="/" className={styles.homeLink}>
          <Home size={18} aria-hidden /> Go to Homepage <ArrowRight size={16} aria-hidden />
        </Link>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <Reveal>
            <p className={styles.code} aria-hidden>
              404
            </p>
            <h1 className={styles.title}>
              Page Not <span className={styles.titleAccent}>Found</span>
            </h1>
            <p className={styles.lede}>Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
            <span className={styles.rule} aria-hidden />
            <div className={styles.actions}>
              <Link href="/batches">
                <Button variant="accent" size="lg">
                  <Home size={18} aria-hidden /> Go to Dashboard
                </Button>
              </Link>
              <Link href="/batches">
                <Button variant="secondary" size="lg">
                  <FileText size={18} aria-hidden /> View Batches
                </Button>
              </Link>
              <Link href="/history">
                <Button variant="secondary" size="lg">
                  <History size={18} aria-hidden /> View History
                </Button>
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.08} className={styles.illustration}>
            <img src="/illustration/not-found-dark.png" alt="" />
          </Reveal>
        </section>

        <Reveal delay={0.12}>
          <section className={styles.suggest} aria-labelledby="nf-suggest">
            <h2 id="nf-suggest" className={styles.suggestTitle}>
              You might be looking for
            </h2>
            <Stagger className={styles.grid}>
              {SUGGESTIONS.map((s) => (
                <StaggerItem key={s.title} className={styles.tile}>
                  <span className={styles.tileIcon} data-tone={s.tone} aria-hidden>
                    <s.icon size={26} strokeWidth={1.75} />
                  </span>
                  <h3 className={styles.tileTitle}>{s.title}</h3>
                  <p className={styles.tileText}>{s.text}</p>
                  <Link href={s.href} className={styles.tileLink}>
                    {s.cta} <ArrowRight size={16} aria-hidden />
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        </Reveal>
      </main>

      <MarketingFooter />
    </div>
  );
}
