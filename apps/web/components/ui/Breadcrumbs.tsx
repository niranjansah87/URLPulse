import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import styles from "./ui.module.css";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumbs}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={item.label}>
            {item.href && !isLast ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span className={isLast ? styles.breadcrumbCurrent : undefined} aria-current={isLast ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!isLast ? <ChevronRight size={14} aria-hidden /> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
