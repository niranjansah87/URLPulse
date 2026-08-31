"use client";

import { useState } from "react";
import { MoreHorizontal, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { ConfirmationDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import type { BatchStatus } from "../types";

export function BatchHeaderActions({
  status,
  failedCount,
  busy,
  onCancel,
  onRetryFailed,
  onRefresh,
}: {
  status: BatchStatus;
  failedCount: number;
  busy: "cancel" | "retry" | null;
  onCancel: () => Promise<boolean>;
  onRetryFailed: () => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState<"cancel" | "retry" | null>(null);
  const toast = useToast();

  const canCancel = status === "PENDING" || status === "PROCESSING";
  // retry-failed is rejected on cancelled batches (ADR-027) and pointless without failures.
  const canRetry = failedCount > 0 && status !== "CANCELLED";

  return (
    <>
      <Menu
        iconTrigger={<MoreHorizontal size={18} />}
        triggerLabel="More actions"
        items={[
          { label: "Refresh", icon: <RefreshCw size={14} />, onSelect: () => void onRefresh() },
          { label: "Cancel batch", icon: <XCircle size={14} />, destructive: true, disabled: !canCancel, onSelect: () => setConfirm("cancel") },
        ]}
      />
      <Button
        variant="primary"
        leftIcon={<RefreshCw size={16} />}
        disabled={!canRetry || busy !== null}
        aria-busy={busy === "retry"}
        onClick={() => setConfirm("retry")}
      >
        {busy === "retry" ? "Retrying…" : "Retry Failed"}
      </Button>

      <ConfirmationDialog
        open={confirm === "retry"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          void onRetryFailed().then((ok) =>
            toast.show(
              ok
                ? { title: "Retrying failed URLs", body: `${failedCount} URL${failedCount === 1 ? "" : "s"} requeued.`, tone: "success" }
                : { title: "Couldn't retry", body: "Please try again.", tone: "error" },
            ),
          );
        }}
        title="Retry failed URLs"
        description={`This will re-run ${failedCount} failed URL${failedCount === 1 ? "" : "s"}. Successful URLs are not affected.`}
        confirmLabel="Retry Failed"
      />
      <ConfirmationDialog
        open={confirm === "cancel"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          void onCancel().then((ok) =>
            toast.show(ok ? { title: "Batch cancelled", tone: "success" } : { title: "Couldn't cancel", body: "Please try again.", tone: "error" }),
          );
        }}
        title="Cancel this batch?"
        description="Queued URLs will stop and in-flight checks will be abandoned. Completed results are kept. This can't be undone."
        confirmLabel="Cancel Batch"
        destructive
      />
    </>
  );
}
