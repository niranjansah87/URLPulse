"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Info, Pause, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmationDialog } from "@/components/ui/Dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/Toast";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { batchesApi } from "../../api/batches-api";
import { toBatchRow } from "../../lib/view";
import type { BatchRow, BatchStatus } from "../../types";
import { StateCard } from "./StateCard";
import styles from "./states.module.css";

const NO_BACKEND = "Not available yet — no backend support for this action.";

/** Most recent batch per status; the API list is newest-first. */
function latestByStatus(rows: BatchRow[]): Partial<Record<BatchStatus, BatchRow>> {
  const out: Partial<Record<BatchStatus, BatchRow>> = {};
  for (const r of rows) if (!out[r.status]) out[r.status] = r;
  return out;
}

export function BatchStatesGrid() {
  const toast = useToast();
  const [rows, setRows] = useState<BatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "cancel" | "retry"; id: string } | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { items } = await batchesApi.list({ page: 1, pageSize: 50 });
      setRows(items.map(toBatchRow));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : "Couldn't load batches.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (kind: "cancel" | "retry", id: string) => {
    try {
      if (kind === "cancel") await batchesApi.cancel(id);
      else await batchesApi.retryFailed(id);
      toast.show({ title: kind === "cancel" ? "Batch cancelled" : "Retrying failed URLs", tone: "success" });
      await load();
    } catch (err) {
      toast.show({ title: "Action failed", body: err instanceof ApiClientError ? err.userMessage : undefined, tone: "error" });
    }
  };

  if (error) return <ErrorState title="Couldn't load batches" body={error} onRetry={() => void load()} />;
  if (rows === null) {
    return (
      <div className={styles.grid} role="status" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton height={220} />
          </Card>
        ))}
        <span className="sr-only">Loading batches…</span>
      </div>
    );
  }

  const by = latestByStatus(rows);
  const running = by.PROCESSING ?? null;
  const completed = by.COMPLETED ?? null;
  const withErrors = by.FAILED ?? null;
  const cancelled = by.CANCELLED ?? null;

  return (
    <>
      <Stagger className={styles.grid}>
        <StaggerItem>
          <StateCard
            title="1. Running (In Progress)"
            badge="Running"
            tone="accent"
            batch={running}
            caption="Checking URLs…"
            footLeft={(b) => `Started ${formatDateTime(b.createdAt)}`}
            actions={
              running ? (
                <>
                  <Button variant="secondary" leftIcon={<Trash2 size={14} />} onClick={() => setConfirm({ kind: "cancel", id: running.id })} style={{ color: "var(--color-error-fg)" }}>
                    Cancel Batch
                  </Button>
                  <div className={styles.actionsRight}>
                    <Button variant="secondary" leftIcon={<Pause size={14} />} disabled title={NO_BACKEND}>
                      Pause Batch
                    </Button>
                  </div>
                </>
              ) : null
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StateCard
            title="2. Completed Successfully"
            badge="Completed"
            tone="success"
            batch={completed}
            caption="All checks passed"
            footLeft={(b) => `Completed · ${formatDateTime(b.createdAt)}`}
            actions={
              completed ? (
                <>
                  <Button variant="secondary" leftIcon={<RefreshCw size={14} />} disabled title={NO_BACKEND}>
                    Run Again
                  </Button>
                  <div className={styles.actionsRight}>
                    <Button variant="secondary" leftIcon={<Download size={14} />} disabled title={NO_BACKEND}>
                      Download CSV
                    </Button>
                  </div>
                </>
              ) : null
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StateCard
            title="3. Completed with Errors"
            badge="Completed with Errors"
            tone="warning"
            batch={withErrors}
            caption="Some checks failed"
            footLeft={(b) => `Completed · ${formatDateTime(b.createdAt)}`}
            actions={
              withErrors ? (
                <>
                  <Button variant="secondary" leftIcon={<RefreshCw size={14} />} disabled title={NO_BACKEND}>
                    Run Again
                  </Button>
                  <Button variant="secondary" leftIcon={<RefreshCw size={14} />} onClick={() => setConfirm({ kind: "retry", id: withErrors.id })} style={{ color: "var(--color-warning-fg)" }}>
                    Retry Failed Only
                  </Button>
                  <div className={styles.actionsRight}>
                    <Button variant="secondary" leftIcon={<Download size={14} />} disabled title={NO_BACKEND}>
                      Download CSV
                    </Button>
                  </div>
                </>
              ) : null
            }
          />
        </StaggerItem>
        <StaggerItem>
          <StateCard
            title="4. Cancelled"
            badge="Cancelled"
            tone="neutral"
            batch={cancelled}
            caption="Stopped by user"
            footLeft={(b) => `Cancelled · ${formatDateTime(b.createdAt)}`}
            actions={
              cancelled ? (
                <>
                  <Button variant="secondary" leftIcon={<RefreshCw size={14} />} disabled title={NO_BACKEND}>
                    Run Again
                  </Button>
                  <div className={styles.actionsRight}>
                    <Button variant="secondary" leftIcon={<RefreshCw size={14} />} disabled title="Cancelled batches can't retry failed URLs.">
                      Retry Failed Only
                    </Button>
                  </div>
                </>
              ) : null
            }
          />
        </StaggerItem>
      </Stagger>

      <Card className={styles.note}>
        <span className={styles.noteIcon} aria-hidden>
          <Info size={18} />
        </span>
        <div>
          <div className={styles.noteTitle}>Note</div>
          <p className={styles.noteText}>
            All batch states are persisted in real-time. You can safely refresh or share the batch URL at any time to view the latest status.
          </p>
        </div>
      </Card>

      <ConfirmationDialog
        open={confirm?.kind === "cancel"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void act("cancel", confirm.id)}
        title="Cancel this batch?"
        description="Queued URLs will stop and in-flight checks will be abandoned. Completed results are kept. This can't be undone."
        confirmLabel="Cancel Batch"
        destructive
      />
      <ConfirmationDialog
        open={confirm?.kind === "retry"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void act("retry", confirm.id)}
        title="Retry failed URLs"
        description="Only URLs that failed will be re-run. Successful URLs are not affected."
        confirmLabel="Retry Failed"
      />
    </>
  );
}
