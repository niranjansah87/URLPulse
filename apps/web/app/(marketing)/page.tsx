import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BarChart3, Bell, Check, Clock, ListChecks, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { MarketingFooter } from "@/features/marketing/components/MarketingFooter";
import { MarketingNav } from "@/features/marketing/components/MarketingNav";
import { StartBatchPanel } from "@/features/marketing/components/StartBatchPanel";
import styles from "@/features/marketing/landing.module.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://urlpulse.dev";

export const metadata: Metadata = {
  title: { absolute: "URLPulse | Real-time URL Health Monitoring" },
  description:
    "Monitor thousands of URLs in real time. Get instant status, response time, and page title so you can fix issues before your users do.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "URLPulse",
    title: "URLPulse | Real-time URL Health Monitoring",
    description: "Monitor thousands of URLs in real time with instant status, response time, and page title.",
    images: [{ url: "/og/urlpulse-og.png", width: 1200, height: 630, alt: "URLPulse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "URLPulse | Real-time URL Health Monitoring",
    description: "Monitor thousands of URLs in real time with instant status, response time, and page title.",
    images: ["/og/urlpulse-og.png"],
  },
};

const FEATURES = [
  { Icon: Zap, title: "Real-time Monitoring", text: "Get live results as URLs are checked in the background." },
  { Icon: ShieldCheck, title: "Reliable & Accurate", text: "Global rate limiting, retries, and smart error handling." },
  { Icon: Clock, title: "Save Time", text: "Monitor thousands of URLs in minutes, not hours." },
  { Icon: Bell, title: "Stay Informed", text: "Get alerts and history to track what matters." },
];

const STEPS = [
  { n: "1", title: "Add Your URLs", text: "Paste a list of URLs or upload a CSV. We'll take care of the rest." },
  { n: "2", title: "We Monitor", text: "URLs are checked in the background with real-time updates." },
  { n: "3", title: "Get Results", text: "View status, response time, and page title — all in one place." },
];

const BULLETS = [
  { Icon: ListChecks, title: "Batch Monitoring", text: "Run bulk checks and monitor progress in real time." },
  { Icon: BarChart3, title: "Detailed Results", text: "Status code, response time, and page title for every URL." },
  { Icon: Activity, title: "History & Insights", text: "Track performance over time and spot issues early." },
  { Icon: Bell, title: "Alerts", text: "Get notified when something breaks." },
];

export default function LandingPage() {
  return (
    <>
      <MarketingNav />

      <main>
        <section className={styles.container} id="product">
          <div className={styles.hero}>
            <Reveal>
              <span className={styles.pill}>
                <span className={styles.pillDot} aria-hidden />
                Real-time URL Monitoring
              </span>
              <h1 className={styles.headline}>
                Monitor URLs
                <br />
                at Scale.
                <br />
                <span className={styles.headlineAccent}>Stay Ahead.</span>
              </h1>
              <p className={styles.lede}>
                URLPulse helps you monitor thousands of URLs in real-time. Get instant status, response time, and page title so you
                can fix issues before your users do.
              </p>
              <div className={styles.heroActions}>
                <Link href="/batches/new">
                  <Button variant="accent" size="lg">
                    Start Monitoring Free
                  </Button>
                </Link>
                <Link href="/batches">
                  <Button variant="secondary" size="lg">
                    View Demo
                  </Button>
                </Link>
              </div>
              <ul className={styles.reassure}>
                {["No credit card required", "Free 1,000 checks", "Cancel anytime"].map((t) => (
                  <li key={t}>
                    <Check size={14} aria-hidden /> {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08}>
              <div className={styles.panelWrap}>
                <img className={`${styles.illo} ${styles.illoLight}`} src="/illustration/urlpulse-dashboard-illustration-light.png" alt="" aria-hidden />
                <img className={`${styles.illo} ${styles.illoDark}`} src="/illustration/urlpulse-dashboard-illustration-dark.png" alt="" aria-hidden />
                <StartBatchPanel />
              </div>
            </Reveal>
          </div>
        </section>

        <section className={styles.container} id="features">
          <Stagger className={styles.featureBand}>
            {FEATURES.map(({ Icon, title, text }) => (
              <StaggerItem key={title} className={styles.feature}>
                <span className={styles.featureIcon} aria-hidden>
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <div className={styles.featureTitle}>{title}</div>
                  <p className={styles.featureText}>{text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className={`${styles.container} ${styles.section}`} id="how-it-works">
          <Reveal>
            <h2 className={styles.sectionTitle}>How URLPulse Works</h2>
            <p className={styles.sectionLede}>Get started in minutes. Monitor with confidence.</p>
          </Reveal>
          <Stagger className={styles.steps}>
            {STEPS.map((s) => (
              <StaggerItem key={s.n}>
                <div className={styles.stepNum} data-n={s.n} aria-hidden>
                  {s.n}
                </div>
                <div className={styles.featureTitle}>{s.title}</div>
                <p className={styles.featureText}>{s.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        <section className={`${styles.container} ${styles.section}`} id="docs">
          <Reveal>
            <div className={styles.product}>
              <div className={styles.productVisual}>
                <img src="/illustration/dashboard-dark.png" alt="URLPulse dashboard: batches, progress, overall health and live activity" />
              </div>
              <div>
                <h2 className={styles.productTitle}>
                  Everything you need
                  <br />
                  to keep your links
                  <br />
                  healthy
                </h2>
                <ul className={styles.bullets}>
                  {BULLETS.map(({ Icon, title, text }) => (
                    <li key={title} className={styles.feature}>
                      <span className={styles.featureIcon} aria-hidden>
                        <Icon size={18} strokeWidth={1.75} />
                      </span>
                      <div>
                        <div className={styles.featureTitle}>{title}</div>
                        <p className={styles.featureText}>{text}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <MarketingFooter />
    </>
  );
}
