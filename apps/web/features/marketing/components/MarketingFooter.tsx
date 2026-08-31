import { Code } from "lucide-react";
import styles from "../landing.module.css";

/** Minimal site footer: personal credit + GitHub. Shared by the landing page and the public 404. */
export function MarketingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerBar}`}>
        <p className={styles.copyright}>
          Created by{" "}
          <a href="https://niranjansah87.com.np" target="_blank" rel="noopener noreferrer">
            Niranjan Sah
          </a>{" "}
          · © 2026 All rights reserved
        </p>
        <a href="https://github.com/niranjansah87" target="_blank" rel="noopener noreferrer" className={styles.footerGithub}>
          <Code size={16} aria-hidden /> niranjansah87
        </a>
      </div>
    </footer>
  );
}
