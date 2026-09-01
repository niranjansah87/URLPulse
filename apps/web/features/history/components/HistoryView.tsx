"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Copy,
  Eye,
  Globe,
  LayoutGrid,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RotateCw,
  Search,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Menu } from "@/components/ui/Menu";
import { MetricCard } from "@/components/ui/MetricCard";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { StatusBadge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/Toast";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { ApiClientError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { batchesApi } from "@/features/batches/api/batches-api";
import { toBatchRow } from "@/features/batches/lib/view";
import { batchStatusView, type Tone } from "@/features/batches/lib/status";
import type { BatchRow } from "@/features/batches/types";
import type { BatchListMeta } from "@urlpulse/types";
import ui from "@/components/ui/ui.module.css";
import styles from "../history.module.css";
import {
  applyFilters,
  computeStats,
  dailySeries,
  DATE_PRESETS,
  DEFAULT_FILTERS,
  percentOf,
  recentActivity,
  STATUS_FILTERS,
  type DatePreset,
  type HistoryFilters,
  type StatusFilter,
} from "../lib/history";

const TONE_SOLID: Record<Tone, string> = {
  success: "var(--color-success)",
  accent: "var(--color-accent)",
  warning: "var(--color-warning)",
  error: "var(--color-error)",
  neutral: "var(--color-text-muted)",
};
const TONE_SUBTLE: Record<Tone, string> = {
  success: "var(--color-success-subtle)",
  accent: "var(--color-accent-subtle)",
  warning: "var(--color-warning-subtle)",
  error: "var(--color-error-subtle)",
  neutral: "var(--color-bg)",
};
const ACTIVITY_ICON: Record<Tone, LucideIcon> = {
  success: CheckCircle2,
  accent: LoaderCircle,
  warning: LoaderCircle,
  error: XCircle,
  neutral: XCircle,
};

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; rows: BatchRow[]; meta: BatchListMeta };

function splitDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export function HistoryView() {
  const toast = useToast();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const { items, meta } = await batchesApi.list({ page, pageSize });
      setState({ kind: "ready", rows: items.map(toBatchRow), meta });
    } catch (err) {
      setState({ kind: "error", message: err instanceof ApiClientError ? err.userMessage : "Something went wrong. Please try again." });
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  // ⌘/Ctrl-K focuses the search field, matching the shortcut chip in the reference.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = state.kind === "ready" ? state.rows : [];
  const visible = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const stats = useMemo(() => computeStats(visible), [visible]);
  const activity = useMemo(() => recentActivity(rows), [rows]);
  const filtered = filters.date !== "all" || filters.status !== "all" || filters.query !== "";

  const trend = (pick: (r: BatchRow) => boolean) => dailySeries(visible, pick);

  const segments: DonutSegment[] = [
    { label: "Completed", value: stats.completed, tone: "success" },
    { label: "In Progress", value: stats.inProgress, tone: "accent" },
    { label: "Queued", value: stats.queued, tone: "warning" },
    { label: "Failed", value: stats.failed, tone: "error" },
  ];

  const copyLink = (id: string) => {
    void navigator.clipboard?.writeText(`${window.location.origin}/batches/${id}`).then(() => toast.show({ title: "Link copied", tone: "success" }));
  };

  const toggleSort = () => setFilters((f) => ({ ...f, sort: f.sort === "desc" ? "asc" : "desc" }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Batches", href: "/batches" }, { label: "History" }]}
        title="History"
        description="View and manage all your past batches"
        actions={
          <div className={styles.headerActions}>
            <label className={styles.search}>
              <span className="sr-only">Search batches</span>
              <span className={ui.inputWrap} style={{ width: "100%" }}>
                <Search size={16} aria-hidden />
                <input
                  ref={searchRef}
                  className={ui.input}
                  type="search"
                  placeholder="Search batches…"
                  value={filters.query}
                  onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                />
                <kbd className={ui.kbd} aria-hidden>
                  Ctrl K
                </kbd>
              </span>
            </label>
            <Link href="/batches/new">
              <Button variant="primary" leftIcon={<Plus size={16} strokeWidth={2} />}>
                Create Batch
              </Button>
            </Link>
          </div>
        }
      />

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <div className={styles.filters}>
            <span className={styles.filterWithIcon}>
              <Calendar size={16} className={styles.filterIcon} aria-hidden />
              <Select aria-label="Date range" value={filters.date} onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value as DatePreset }))}>
                {DATE_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </span>
            <Select aria-label="Status" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))}>
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Button variant="ghost" className={styles.clear} leftIcon={<RotateCw size={14} />} disabled={!filtered} onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </Button>
          </div>

          <Stagger className={styles.metrics}>
            <StaggerItem>
              <MetricCard icon={<LayoutGrid size={18} />} label="Total Batches" value={stats.total} tone="accent" sub={filtered ? "matching filters" : "on this page"} trend={trend(() => true)} />
            </StaggerItem>
            <StaggerItem>
              <MetricCard icon={<CheckCircle2 size={18} />} label="Completed" value={stats.completed} tone="success" sub={`${percentOf(stats.completed, stats.completed + stats.failed)} success rate`} trend={trend((r) => r.status === "COMPLETED")} />
            </StaggerItem>
            <StaggerItem>
              <MetricCard icon={<LoaderCircle size={18} />} label="In Progress" value={stats.inProgress} tone="accent" sub={`${percentOf(stats.inProgress, stats.total)} of total`} trend={trend((r) => r.status === "PROCESSING")} />
            </StaggerItem>
            <StaggerItem>
              <MetricCard icon={<XCircle size={18} />} label="Failed" value={stats.failed} tone="error" sub={`${percentOf(stats.failed, stats.total)} of total`} trend={trend((r) => r.status === "FAILED")} />
            </StaggerItem>
          </Stagger>

          <Reveal delay={0.08}>
            <Card padded={false}>
              {state.kind === "loading" ? (
                <div style={{ padding: "var(--space-6)", display: "grid", gap: "var(--space-4)" }} role="status" aria-live="polite">
                  {Array.from({ length: 6 }, (_, i) => (
                    <Skeleton key={i} height={40} />
                  ))}
                  <span className="sr-only">Loading batches…</span>
                </div>
              ) : state.kind === "error" ? (
                <ErrorState title="Couldn't load history" body={state.message} onRetry={() => void load()} />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="No batches yet"
                  body="Create your first batch and it will show up here."
                  action={
                    <Link href="/batches/new">
                      <Button variant="primary" leftIcon={<Plus size={16} />}>
                        Create Batch
                      </Button>
                    </Link>
                  }
                />
              ) : visible.length === 0 ? (
                <EmptyState title="No batches match" body="Try a different date range, status, or search." action={<Button onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</Button>} />
              ) : (
                <>
                  <div className={ui.tableWrap}>
                    <table className={ui.table}>
                      <thead>
                        <tr>
                          <th style={{ paddingLeft: "var(--space-6)" }}>Batch Name</th>
                          <th>Status</th>
                          <th>Progress</th>
                          <th>URLs</th>
                          <th aria-sort={filters.sort === "desc" ? "descending" : "ascending"}>
                            <button type="button" className={styles.sortBtn} onClick={toggleSort} aria-label={`Sort by created at, currently ${filters.sort === "desc" ? "newest first" : "oldest first"}`}>
                              Created At {filters.sort === "desc" ? <ArrowDown size={14} aria-hidden /> : <ArrowUp size={14} aria-hidden />}
                            </button>
                          </th>
                          <th>Duration</th>
                          <th className={styles.actionsCell} style={{ paddingRight: "var(--space-6)" }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((r) => {
                          const view = batchStatusView(r.status);
                          const when = splitDate(r.createdAt);
                          return (
                            <tr key={r.id}>
                              <td style={{ paddingLeft: "var(--space-6)" }}>
                                <span className={styles.nameCell}>
                                  <span className={styles.iconTile} aria-hidden>
                                    <Globe size={16} />
                                  </span>
                                  <span style={{ minWidth: 0 }}>
                                    <Link href={`/batches/${r.id}`} className={styles.name}>
                                      {r.name}
                                    </Link>
                                    <div className={styles.subId}>#{r.id.slice(0, 8)}</div>
                                  </span>
                                </span>
                              </td>
                              <td>
                                <StatusBadge tone={view.tone} label={view.label} />
                              </td>
                              <td>
                                <span className={styles.progressCell}>
                                  <ProgressBar value={r.progressPercent} tone={view.tone === "neutral" ? "neutral" : view.tone} label={`${r.name} progress`} />
                                  <span className={ui.num}>{r.progressPercent}%</span>
                                </span>
                              </td>
                              <td className={ui.num} style={{ whiteSpace: "nowrap" }}>
                                {r.done} / {r.total}
                              </td>
                              <td className={styles.dateCell}>
                                <div>{when.date}</div>
                                <div className={styles.dateTime}>{when.time}</div>
                              </td>
                              <td style={{ color: "var(--color-text-muted)" }}>-</td>
                              <td className={styles.actionsCell} style={{ paddingRight: "var(--space-6)" }}>
                                <Menu
                                  iconTrigger={<MoreHorizontal size={16} />}
                                  triggerLabel={`Actions for ${r.name}`}
                                  items={[
                                    { label: "View batch", icon: <Eye size={14} />, href: `/batches/${r.id}` },
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
                  <div style={{ padding: "0 var(--space-6) var(--space-4)" }}>
                    <Pagination page={page} pageSize={pageSize} total={state.meta.total} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} noun="results" />
                  </div>
                </>
              )}
            </Card>
          </Reveal>
        </div>

        <div className={styles.rightCol}>
          <Reveal delay={0.1}>
            <Card>
              <SectionHeader title="History Overview" />
              <div className={styles.donutWrap}>
                <DonutChart segments={segments} centerValue={String(stats.total)} centerLabel="Total Batches" />
              </div>
              <div className={styles.legend}>
                {segments.map((s) => (
                  <div key={s.label} className={styles.legendRow}>
                    <span className={styles.legendDot} style={{ background: TONE_SOLID[s.tone] }} aria-hidden />
                    <span className={styles.legendLabel}>{s.label}</span>
                    <span className={styles.legendValue}>{s.value}</span>
                    <span className={styles.legendPct}>({percentOf(s.value, stats.total)})</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.16}>
            <Card>
              <SectionHeader title="Recent Activity" actions={<Link href="/alerts" style={{ fontSize: "var(--text-sm)" }}>View all</Link>} />
              {activity.length === 0 ? (
                <EmptyState title="No activity yet" body="Batch events will appear here." />
              ) : (
                <div className={styles.activity}>
                  {activity.map((a) => {
                    const Icon = ACTIVITY_ICON[a.tone];
                    return (
                      <div key={a.id} className={styles.activityItem}>
                        <span className={styles.activityIcon} style={{ background: TONE_SUBTLE[a.tone], color: TONE_SOLID[a.tone] }} aria-hidden>
                          <Icon size={14} strokeWidth={2} />
                        </span>
                        <span className={styles.activityBody}>
                          <div className={styles.activityTitle}>{a.title}</div>
                          <div className={styles.activityName}>{a.name}</div>
                          <div className={styles.subId}>#{a.id.slice(0, 8)}</div>
                        </span>
                        <span className={styles.activityWhen}>{formatRelativeTime(a.at)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/alerts" className={styles.viewAll}>
                View all activity <ArrowRight size={14} aria-hidden />
              </Link>
            </Card>
          </Reveal>
        </div>
      </div>
    </>
  );
}
