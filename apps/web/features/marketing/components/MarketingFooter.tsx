import styles from "../landing.module.css";

/** GitHub mark. lucide-react 1.37 ships no brand icons, so the logo is inlined. */
function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.53.11-3.19 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.89.12 3.19.77.84 1.24 1.92 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.29 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}

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
          <GithubIcon /> niranjansah87
        </a>
      </div>
    </footer>
  );
}
