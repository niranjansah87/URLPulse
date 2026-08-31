import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AtSign, BarChart3, Bell, Check, Clock, Code, ListChecks, ShieldCheck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
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

const LOGOS = ["Acme", "Vertex", "Sitemark", "Brandly", "Boldline", "Northwind"];

const FOOTER: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "How it works", href: "#how-it-works" }, { label: "Pricing", href: "#pricing" }, { label: "Updates", href: "/" }] },
  { title: "Resources", links: [{ label: "Docs", href: "#docs" }, { label: "API Reference", href: "#docs" }, { label: "Blog", href: "/" }, { label: "Status", href: "/" }] },
  { title: "Company", links: [{ label: "About", href: "/" }, { label: "Careers", href: "/" }, { label: "Contact", href: "/" }] },
  { title: "Legal", links: [{ label: "Terms of Service", href: "/" }, { label: "Privacy Policy", href: "/" }] },
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
                <img className={styles.illoLight} src="/illustration/urlpulse-dashboard-illustration-light.png" alt="URLPulse dashboard illustration" />
                <img className={styles.illoDark} src="/illustration/urlpulse-dashboard-illustration-dark.png" alt="URLPulse dashboard illustration" />
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

        <section className={`${styles.container} ${styles.section} ${styles.trusted}`} id="pricing">
          <Reveal>
            <h2 className={styles.trustedTitle}>Trusted by teams who care about uptime</h2>
            <div className={styles.logos} aria-label="Customer logos">
              {LOGOS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </Reveal>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div>
              <img className={`${styles.logo} ${styles.logoLight}`} src="/brand/logo/horizontal/urlpulse-light.png" alt="URLPulse" />
              <img className={`${styles.logo} ${styles.logoDark}`} src="/brand/logo/horizontal/urlpulse-dark.png" alt="URLPulse" />
              <p className={styles.footerBrandText}>Real-time URL monitoring for teams who care about uptime.</p>
              <div className={styles.social}>
                {/* lucide ships no brand marks; generic glyphs with accessible names. */}
                <a href="https://github.com/niranjansah87/URLPulse" aria-label="GitHub">
                  <Code size={18} />
                </a>
                <a href="/" aria-label="Twitter">
                  <AtSign size={18} />
                </a>
                <a href="/" aria-label="LinkedIn">
                  <Users size={18} />
                </a>
              </div>
            </div>
            {FOOTER.map((col) => (
              <div key={col.title} className={styles.footerCol}>
                <h3>{col.title}</h3>
                <ul>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href}>{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className={styles.footerCol}>
              <h3>Stay in the loop</h3>
              <p className={styles.featureText}>Get product updates and monitoring tips delivered to your inbox.</p>
              <div className={styles.newsletter}>
                <input type="email" placeholder="Coming soon" aria-label="Email address" disabled />
                <Button variant="accent" disabled title="Newsletter coming soon">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
          <p className={styles.copyright}>© 2025 URLPulse. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
