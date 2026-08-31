import { Logo } from "@/components/ui/Logo";
import { AtSign, Code, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import styles from "../landing.module.css";

const FOOTER: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Product", links: [{ label: "Features", href: "/#features" }, { label: "How it works", href: "/#how-it-works" }, { label: "Updates", href: "/" }] },
  { title: "Resources", links: [{ label: "Docs", href: "/#docs" }, { label: "API Reference", href: "/#docs" }, { label: "Blog", href: "/" }, { label: "Status", href: "/" }] },
  { title: "Company", links: [{ label: "About", href: "/" }, { label: "Careers", href: "/" }, { label: "Contact", href: "/" }] },
  { title: "Legal", links: [{ label: "Terms of Service", href: "/" }, { label: "Privacy Policy", href: "/" }] },
];

/** Site footer shared by the landing page and the public 404 page. */
export function MarketingFooter({ newsletter = true }: { newsletter?: boolean }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerGrid} data-compact={!newsletter || undefined}>
          <div>
            <Logo href="/" size="md" />
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
          {newsletter ? (
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
          ) : null}
        </div>
        <p className={styles.copyright}>© 2025 URLPulse. All rights reserved.</p>
      </div>
    </footer>
  );
}
