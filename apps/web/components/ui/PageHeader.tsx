import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import styles from "./ui.module.css";

/**
 * Standard page top per the references: optional breadcrumb, title + subtitle
 * on the left, and a right-aligned action cluster (search, filter, primary
 * button, notification bell).
 */
export function PageHeader({
  breadcrumbs,
  title,
  description,
  actions,
}: {
  breadcrumbs?: Crumb[];
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.pageHeader}>
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className={styles.pageHeaderRow}>
        <div>
          <h1 className={styles.pageTitle}>{title}</h1>
          {description ? <p className={styles.pageDescription}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.pageActions}>{actions}</div> : null}
      </div>
    </div>
  );
}
