import { Logo } from "@/components/ui/Logo";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import type { Tone } from "@/features/batches/lib/status";
import { AuthTransition } from "./AuthTransition";
import styles from "./auth.module.css";

export interface AuthBullet {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  text: string;
}

export interface AuthIllustration {
  light: string;
  dark: string;
  alt?: string;
}

/**
 * Two-column auth shell shared by login / sign-up / forgot / reset (per the
 * references): brand + headline + three feature bullets + illustration on the
 * left, a tall form card on the right. Collapses to a single column on small
 * screens (illustration hidden). The whole frame slides in right-to-left on each
 * auth-route switch.
 */
export function AuthLayout({
  headline,
  headlineAccent,
  lede,
  bullets,
  illustration,
  cardTitle,
  cardSubtitle,
  cardIcon,
  children,
}: {
  headline: string;
  headlineAccent: string;
  lede: string;
  bullets: AuthBullet[];
  illustration: AuthIllustration;
  cardTitle: string;
  cardSubtitle: string;
  /** Optional icon in a tinted circle above the card title (forgot/reset). */
  cardIcon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <AuthTransition className={styles.frame}>
        <header className={styles.header}>
          <Logo href="/" size="md" className={styles.brandLink} />
        </header>

        <div className={styles.columns}>
          <Reveal className={styles.left}>
            <h1 className={styles.headline}>
              {headline}
              <br />
              <span className={styles.headlineAccent}>{headlineAccent}</span>
            </h1>
            <p className={styles.lede}>{lede}</p>
            <ul className={styles.bullets}>
              {bullets.map((b) => (
                <li key={b.title} className={styles.bullet}>
                  <span className={styles.bulletIcon} data-tone={b.tone} aria-hidden>
                    <b.icon size={22} strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className={styles.bulletTitle}>{b.title}</span>
                    <span className={styles.bulletText}>{b.text}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className={styles.illustration} aria-hidden>
              <img className={styles.illoLight} src={illustration.light} alt="" loading="lazy" />
              <img className={styles.illoDark} src={illustration.dark} alt="" loading="lazy" />
            </div>
          </Reveal>

          <Reveal delay={0.06} className={styles.right}>
            <section className={styles.card} aria-labelledby="auth-title">
              {cardIcon ? (
                <span className={styles.cardIcon} aria-hidden>
                  {cardIcon}
                </span>
              ) : null}
              <h2 id="auth-title" className={styles.title}>
                {cardTitle}
              </h2>
              <p className={styles.subtitle}>{cardSubtitle}</p>
              {children}
            </section>
          </Reveal>
        </div>
      </AuthTransition>
    </div>
  );
}
