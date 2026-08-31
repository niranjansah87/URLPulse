"use client";

import { Logo } from "@/components/ui/Logo";
import { useState } from "react";
import Link from "next/link";
import { Menu as MenuIcon, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "@/components/ui/Button";
import styles from "../landing.module.css";

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Docs", href: "#docs" },
];

export function MarketingNav() {
  const [open, setOpen] = useState(false);

  const links = LINKS.map((l) => (
    <a key={l.href} href={l.href} className={styles.navLink} onClick={() => setOpen(false)}>
      {l.label}
    </a>
  ));

  return (
    <header className={styles.nav}>
      <div className={styles.container}>
        <div className={styles.navRow}>
          <Logo href="/" size="md" />
          <nav className={styles.navLinks} aria-label="Site">
            {links}
          </nav>
          <div className={styles.navActions}>
            <Link href="/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button variant="accent">Get Started</Button>
            </Link>
          </div>
          <IconButton
            className={styles.menuBtn}
            label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="marketing-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} /> : <MenuIcon size={20} />}
          </IconButton>
        </div>
        {open ? (
          <nav id="marketing-menu" className={styles.mobileMenu} aria-label="Site">
            {links}
            <Link href="/login" className={styles.navLink}>
              Log in
            </Link>
            <Link href="/signup">
              <Button variant="accent">Get Started</Button>
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
