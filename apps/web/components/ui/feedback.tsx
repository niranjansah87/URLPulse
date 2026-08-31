import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import styles from "./ui.module.css";

export function Skeleton({
  width,
  height = 16,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className={cn(styles.skeleton, className)}
      style={{ display: "block", width: width ?? "100%", height, ...style }}
    />
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state}>
      <span className={styles.stateIcon}>{icon ?? <Inbox size={28} strokeWidth={1.5} />}</span>
      <p className={styles.stateTitle}>{title}</p>
      {body ? <p className={styles.stateBody}>{body}</p> : null}
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <Skeleton width={180} height={12} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorState({
  title = "Something needs your attention",
  body = "We couldn't load this content. Please try again.",
  onRetry,
}: {
  title?: string;
  body?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.state} role="alert">
      <span className={styles.stateIcon}>
        <AlertTriangle size={28} strokeWidth={1.5} />
      </span>
      <p className={styles.stateTitle}>{title}</p>
      <p className={styles.stateBody}>{body}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
