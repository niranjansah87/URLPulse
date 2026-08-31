import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="app-header">
        <Link href="/" aria-label="URLPulse home">
          <picture>
            <source
              media="(prefers-color-scheme: dark)"
              srcSet="/brand/logo/horizontal/urlpulse-light.png"
            />
            <img
              src="/brand/logo/horizontal/urlpulse-dark.png"
              alt="URLPulse"
              height={28}
              style={{ display: "block", height: 28, width: "auto" }}
            />
          </picture>
        </Link>
        <nav className="app-nav">
          <Link href="/batches">Batches</Link>
          <ThemeToggle />
        </nav>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
