"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy, ExternalLink, Filter, MoreHorizontal, Search } from "lucide-react";
import type { BatchListMeta } from "@urlpulse/types";
import { Card, SectionHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Pagination } from "@/components/ui/Pagination";
import { Menu } from "@/components/ui/Menu";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { BatchRow, BatchStatus } from "../../types";
import { batchesApi } from "../../api/batches-api";
import { toBatchRow } from "../../lib/view";
import { batchStatusView, type Tone } from "../../lib/status";
import ui from "@/components/ui/ui.module.css";
import styles from "./dashboard.module.css";

type FilterValue = "all" | BatchStatus;
const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "In Progress", value: "PROCESSING" },
  { label: "Pending", value: "PENDING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function progressTone(status: BatchStatus): Tone {
  return status === "FAILED" ? "error" : status === "COMPLETED" ? "success" : status === "CANCELLED" ? "neutral" : "accent";
}

/**
 * Recent batches table. Server-rendered first page arrives as props; page and
 * page-size changes refetch from GET /api/batches. Search and status filter
 * narrow the currently loaded page client-side.
 */
export function RecentBatches({ initialRows, initialMeta }: { initialRows: BatchRow[]; initialMeta: BatchListMeta }) {
  const toast = useToast();
  const [rows, setRows] = useState(initialRows);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");

  useEffect(() => {
    // Initial page came from the server; only refetch after the user paginates.
    if (meta.page === initialMeta.page && meta.pageSize === initialMeta.pageSize) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    batchesApi
      .list({ page: meta.page, pageSize: meta.pageSize })
      .then(({ items, meta: m }) => {
        if (cancelled) return;
        setRows(items.map(toBatchRow));
        setMeta(m);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.userMessage : "Couldn't load batches.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [meta.page, meta.pageSize, initialMeta.page, initialMeta.pageSize]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) => (filter === "all" || r.status === filter) && (q === "" || r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)),
    );
  }, [rows, query, filter]);

  const copyLink = (id: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/batches/${id}`).then(
      () => toast.show({ title: "Link copied", tone: "success" }),
      () => toast.show({ title: "Couldn't copy link", tone: "error" }),
    );
  };

  const filterLabel = filter === "all" ? "Filter" : (FILTERS.find((f) => f.value === filter)?.label ?? "Filter");

  return (
    <Card>
      <SectionHeader
        title="Recent Batches"
        subtitle="Your latest URL health checks"
        actions={
          <div className={styles.controls}>
            <label className={styles.search}>
              <span className="sr-only">Search batches</span>
              <span className={ui.inputWrap} style={{ width: "100%" }}>
                <Search size={16} aria-hidden />
                <input className={ui.input} type="search" placeholder="Search batches…" value={query} onChange={(e) => setQuery(e.target.value)} />
              </span>
            </label>
            <Menu
              label={filterLabel}
              leftIcon={<Filter size={16} />}
              trailingIcon={<ChevronDown size={14} />}
              items={FILTERS.map((f) => ({ label: f.label, onSelect: () => setFilter(f.value) }))}
            />
          </div>
        }
      />

      {error ? (
        <ErrorState title="Couldn't load batches" body={error} onRetry={() => setMeta({ ...meta })} />
      ) : loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }} role="status" aria-live="polite">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={44} />
          ))}
          <span className="sr-only">Loading batches…</span>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          title={rows.length === 0 ? "No batches yet" : "No batches match"}
          body={rows.length === 0 ? "Submit a list of URLs and URLPulse will start checking them." : "Try a different search or clear the filter."}
        />
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Batch</th>
                <th>Status</th>
                <th>Progress</th>
                <th>URLs</th>
                <th>Created</th>
                <th>Duration</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const view = batchStatusView(r.status);
                return (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/batches/${r.id}`} className={cn(styles.batchName, styles.rowLink)}>
                        {r.name}
                      </Link>
                      <div className={styles.batchId}>#{r.id.slice(0, 8)}</div>
                    </td>
                    <td>
                      <StatusBadge tone={view.tone} label={view.label} />
                    </td>
                    <td>
                      <div className={styles.progressCell}>
                        <div className={styles.progressBar}>
                          <ProgressBar value={r.progressPercent} tone={progressTone(r.status)} label={`${r.name} progress`} />
                        </div>
                        <span className={styles.progressPct}>{r.progressPercent}%</span>
                      </div>
                    </td>
                    <td className={ui.num} style={{ whiteSpace: "nowrap" }}>
                      {r.done} / {r.total}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.createdAt)}</td>
                    <td style={{ color: "var(--color-text-muted)" }}>—</td>
                    <td className={styles.rowActions}>
                      <Menu
                        iconTrigger={<MoreHorizontal size={16} />}
                        triggerLabel={`Actions for ${r.name}`}
                        items={[
                          { label: "View batch", icon: <ExternalLink size={14} />, href: `/batches/${r.id}` },
                          { label: "Copy link", icon: <Copy size={14} />, onSelect: () => copyLink(r.id) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!error && rows.length > 0 ? (
        <Pagination
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          onPage={(page) => setMeta({ ...meta, page })}
          onPageSize={(pageSize) => setMeta({ ...meta, page: 1, pageSize })}
        />
      ) : null}
    </Card>
  );
}
