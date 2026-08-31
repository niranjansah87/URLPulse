"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Copy, Download, Filter, Globe, MoreVertical, Search } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Menu } from "@/components/ui/Menu";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { UrlResult, UrlStatus } from "../types";
import { httpStatusText, httpStatusTone, urlStatusView, type Tone } from "../lib/status";
import ui from "@/components/ui/ui.module.css";
import styles from "./batch-detail.module.css";

const TONE_TEXT: Record<Tone, string> = {
  success: "var(--color-success-fg)",
  accent: "var(--color-accent)",
  warning: "var(--color-warning-fg)",
  error: "var(--color-error-fg)",
  neutral: "var(--color-text-muted)",
};

type FilterValue = "all" | UrlStatus;
const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All statuses", value: "all" },
  { label: "Completed", value: "SUCCESS" },
  { label: "In Progress", value: "PROCESSING" },
  { label: "Queued", value: "PENDING" },
  { label: "Failed", value: "FAILED" },
];

function toCsv(rows: UrlResult[]): string {
  const header = ["URL", "Status", "HTTP Status", "Response Time (ms)"];
  const body = rows.map((r) =>
    [r.url, urlStatusView(r.status).label, r.httpStatus ?? "", r.responseTimeMs ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}

function isTerminal(status: UrlStatus): boolean {
  return status === "SUCCESS" || status === "FAILED" || status === "CANCELLED";
}

export function UrlResultsSection({ urls, checkedAt }: { urls: UrlResult[]; checkedAt: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const toast = useToast();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return urls.filter(
      (u) => (filter === "all" || u.status === filter) && (q === "" || u.url.toLowerCase().includes(q)),
    );
  }, [urls, query, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "url-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <SectionHeader
        title="URL Results"
        actions={
          <>
            <label className={styles.controlsSearch}>
              <span className="sr-only">Search URLs</span>
              <span className={ui.inputWrap} style={{ width: "100%" }}>
                <Search size={16} aria-hidden />
                <input
                  className={ui.input}
                  type="search"
                  placeholder="Search URLs…"
                  value={query}
                  onChange={(e) => reset(() => setQuery(e.target.value))}
                />
              </span>
            </label>
            <Menu
              label="Filter"
              leftIcon={<Filter size={16} />}
              trailingIcon={<ChevronDown size={14} />}
              items={FILTERS.map((f) => ({ label: f.label, onSelect: () => reset(() => setFilter(f.value)) }))}
            />
            <Menu
              label="Export"
              leftIcon={<Download size={16} />}
              trailingIcon={<ChevronDown size={14} />}
              items={[{ label: "Export as CSV", onSelect: exportCsv }]}
            />
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState title="No URLs match" body="Try a different search or clear the status filter." />
      ) : (
        <>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status</th>
                  <th>HTTP Status</th>
                  <th>Response Time</th>
                  <th>Last Checked</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((u) => {
                  const view = urlStatusView(u.status);
                  const terminal = isTerminal(u.status);
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className={styles.urlCell}>
                          <Globe size={15} aria-hidden style={{ color: "var(--color-text-muted)", flex: "none" }} />
                          <span className={cn(styles.urlText, ui.mono)} title={u.url}>
                            {u.url}
                          </span>
                        </span>
                      </td>
                      <td>
                        <StatusBadge tone={view.tone} label={view.label} />
                      </td>
                      <td>
                        <span className={ui.mono} style={{ color: TONE_TEXT[httpStatusTone(u.httpStatus)], whiteSpace: "nowrap" }}>
                          {httpStatusText(u.httpStatus)}
                        </span>
                      </td>
                      <td className={ui.num} style={{ whiteSpace: "nowrap" }}>
                        {formatDuration(u.responseTimeMs)}
                      </td>
                      <td style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                        {terminal ? formatDateTime(checkedAt) : "—"}
                      </td>
                      <td className={styles.rowActions}>
                        <Menu
                          iconTrigger={<MoreVertical size={16} />}
                          triggerLabel={`Actions for ${u.url}`}
                          items={[
                            {
                              label: "Copy URL",
                              icon: <Copy size={14} />,
                              onSelect: () =>
                                void navigator.clipboard?.writeText(u.url).then(() => toast.show({ title: "URL copied", tone: "success" })),
                            },
                            { label: "Open in new tab", onSelect: () => window.open(u.url, "_blank", "noopener,noreferrer") },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={current}
            pageSize={pageSize}
            total={filtered.length}
            onPage={setPage}
            onPageSize={(s) => {
              setPageSize(s);
              setPage(1);
            }}
            noun="URLs"
          />
        </>
      )}
    </Card>
  );
}
