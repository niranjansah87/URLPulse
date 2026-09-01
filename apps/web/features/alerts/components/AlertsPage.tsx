"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Filter,
  Info,
  MoreVertical,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchInput } from "@/components/ui/SearchInput";
import { MetricCard } from "@/components/ui/MetricCard";
import { Card, SectionHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Menu } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/feedback";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { cn } from "@/lib/cn";
import { formatRelativeTime } from "@/lib/format";
import type { Tone } from "@/features/batches/lib/status";
import ui from "@/components/ui/ui.module.css";
import { useAlertsStore } from "../hooks/useAlertsStore";
import type { Alert, AlertSeverity } from "../types";
import { formatDatePart, formatTimePart, SEVERITY_VIEW, STATUS_VIEW } from "../lib/view";
import styles from "../alerts.module.css";

type TabValue = "all" | AlertSeverity | "resolved";
const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "All Alerts" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "resolved", label: "Resolved" },
];

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
const SEV_ICON: Record<AlertSeverity, LucideIcon> = { critical: AlertCircle, warning: AlertTriangle, info: Info };

/** Icon + tone for a row: resolved alerts read as success regardless of severity. */
function rowVisual(a: Alert): { Icon: LucideIcon; tone: Tone } {
  if (a.status === "resolved") return { Icon: CheckCircle2, tone: "success" };
  return { Icon: SEV_ICON[a.severity], tone: SEVERITY_VIEW[a.severity].tone };
}

function matchesTab(a: Alert, tab: TabValue): boolean {
  if (tab === "all") return true;
  if (tab === "resolved") return a.status === "resolved";
  return a.severity === tab && a.status !== "resolved";
}

export function AlertsPage() {
  const { alerts, counts, loading, acknowledge, resolve } = useAlertsStore();
  const [tab, setTab] = useState<TabValue>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = alerts.filter(
      (a) =>
        matchesTab(a, tab) &&
        (q === "" || [a.title, a.detail, a.batchId, a.url].some((s) => s.toLowerCase().includes(q))),
    );
    list.sort((a, b) => (sort === "newest" ? b.detectedAt.localeCompare(a.detectedAt) : a.detectedAt.localeCompare(b.detectedAt)));
    return list;
  }, [alerts, tab, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * pageSize, current * pageSize);

  const recent = useMemo(() => [...alerts].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, 5), [alerts]);

  const segments: DonutSegment[] = [
    { label: "Critical", value: counts.critical, tone: "error" },
    { label: "Warning", value: counts.warning, tone: "warning" },
    { label: "Info", value: counts.info, tone: "accent" },
    { label: "Resolved", value: counts.resolved, tone: "success" },
  ];
  const pct = (n: number) => (counts.total === 0 ? "0.0%" : `${((n / counts.total) * 100).toFixed(1)}%`);

  const selectTab = (t: TabValue) => {
    setTab(t);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Batches", href: "/batches" }, { label: "Alerts" }]}
        title="Alerts"
        description="Monitor and respond to URL issues in real-time"
        actions={
          <>
            <div style={{ width: 280 }} onInput={(e) => { setQuery((e.target as HTMLInputElement).value); setPage(1); }}>
              <SearchInput placeholder="Search alerts…" ariaLabel="Search alerts" />
            </div>
            <Menu
              label="Filter"
              leftIcon={<Filter size={16} />}
              items={TABS.map((t) => ({ label: t.label, onSelect: () => selectTab(t.value) }))}
            />
          </>
        }
      />

      <div className={styles.layout}>
        <div className={styles.mainCol}>
          <Stagger className={styles.metrics}>
            <StaggerItem><MetricCard icon={<AlertCircle size={20} />} label="Critical" value={counts.critical} tone="error" sub="Needs immediate attention" /></StaggerItem>
            <StaggerItem><MetricCard icon={<AlertTriangle size={20} />} label="Warning" value={counts.warning} tone="warning" sub="Needs attention" /></StaggerItem>
            <StaggerItem><MetricCard icon={<Info size={20} />} label="Info" value={counts.info} tone="accent" sub="FYI only" /></StaggerItem>
            <StaggerItem><MetricCard icon={<CheckCircle2 size={20} />} label="Resolved" value={counts.resolved} tone="success" sub="Unresolved cleared" /></StaggerItem>
          </Stagger>

          <Reveal delay={0.1}>
            <Card>
              <div className={styles.tabRow}>
                <div role="tablist" aria-label="Alert filters" className={ui.tabs}>
                  {TABS.map((t) => (
                    <button
                      key={t.value}
                      role="tab"
                      type="button"
                      aria-selected={tab === t.value}
                      className={ui.tab}
                      onClick={() => selectTab(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <label className={styles.sortBy}>
                  Sort by:
                  <Select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")} aria-label="Sort alerts">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </Select>
                </label>
              </div>

              {loading ? (
                <EmptyState title="Loading alerts…" body="Fetching your latest alerts." />
              ) : alerts.length === 0 ? (
                <EmptyState title="No alerts" body="You're all caught up. New alerts will appear here as URLs change health." />
              ) : filtered.length === 0 ? (
                <EmptyState title="No matching alerts" body="Try a different search or switch to another tab." />
              ) : (
                <>
                  <div className={ui.tableWrap}>
                    <table className={ui.table}>
                      <thead>
                        <tr>
                          <th>Alert</th>
                          <th>Batch</th>
                          <th>URL</th>
                          <th>Severity</th>
                          <th>Detected At</th>
                          <th>Status</th>
                          <th><span className="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((a) => {
                          const { Icon, tone } = rowVisual(a);
                          const sev = SEVERITY_VIEW[a.severity];
                          const st = STATUS_VIEW[a.status];
                          return (
                            <tr key={a.id}>
                              <td>
                                <span className={styles.alertCell}>
                                  <span className={styles.sevIcon} style={{ background: TONE_SUBTLE[tone], color: TONE_SOLID[tone] }} aria-hidden>
                                    <Icon size={16} strokeWidth={1.75} />
                                  </span>
                                  <span>
                                    <div className={styles.alertTitle}>{a.title}</div>
                                    <div className={styles.alertDetail}>{a.detail}</div>
                                  </span>
                                </span>
                              </td>
                              <td>
                                <Link href={`/batches/${a.batchId}`} className={cn(styles.batchId, ui.mono)} title={a.batchId}>
                                  #{a.batchId.slice(0, 8)}
                                </Link>
                              </td>
                              <td>
                                <span className={cn(styles.url, ui.mono)} title={a.url}>{a.url}</span>
                              </td>
                              <td><StatusBadge tone={sev.tone} label={sev.label} /></td>
                              <td>
                                <div className={styles.date}>{formatDatePart(a.detectedAt)}</div>
                                <div className={styles.time}>{formatTimePart(a.detectedAt)}</div>
                              </td>
                              <td><StatusBadge tone={st.tone} label={st.label} /></td>
                              <td className={styles.actions}>
                                <Menu
                                  iconTrigger={<MoreVertical size={16} />}
                                  triggerLabel={`Actions for ${a.title}`}
                                  items={[
                                    { label: "Acknowledge", icon: <CheckCircle2 size={14} />, onSelect: () => acknowledge(a.id), disabled: a.status !== "new" },
                                    { label: "Resolve", icon: <CheckCircle2 size={14} />, onSelect: () => resolve(a.id), disabled: a.status === "resolved" },
                                    { label: "Copy URL", icon: <Copy size={14} />, onSelect: () => navigator.clipboard?.writeText(a.url) },
                                  ]}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={current} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} noun="alerts" />
                </>
              )}
            </Card>
          </Reveal>
        </div>

        <div className={styles.rightCol}>
          <Reveal delay={0.15}>
            <Card>
              <SectionHeader title="Alert Overview" />
              <div className={styles.donutWrap}>
                <DonutChart segments={segments} centerValue={String(counts.total)} centerLabel="Total Alerts" />
              </div>
              <div className={styles.legend}>
                {segments.map((s) => (
                  <div key={s.label} className={styles.legendRow}>
                    <span className={styles.legendDot} style={{ background: TONE_SOLID[s.tone] }} aria-hidden />
                    <span className={styles.legendLabel}>{s.label}</span>
                    <span className={styles.legendValue}>{s.value}</span>
                    <span className={styles.legendPct}>({pct(s.value)})</span>
                  </div>
                ))}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.2}>
            <Card>
              <SectionHeader title="Recent Alerts" actions={<Link href="/alerts" style={{ fontSize: "var(--text-sm)" }}>View all</Link>} />
              <div className={styles.recentList}>
                {recent.map((a) => {
                  const { Icon, tone } = rowVisual(a);
                  return (
                    <div key={a.id} className={styles.recentItem}>
                      <span className={styles.sevIcon} style={{ background: TONE_SUBTLE[tone], color: TONE_SOLID[tone] }} aria-hidden>
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <div className={styles.recentBody}>
                        <div className={styles.recentTitle}>{a.title}</div>
                        <div className={styles.recentUrl}>{a.url}</div>
                      </div>
                      <span className={styles.recentTime}>{formatRelativeTime(a.detectedAt, new Date()).replace(" minutes", "m").replace(" hours", "h").replace(" days", "d")}</span>
                    </div>
                  );
                })}
              </div>
              <Link href="/alerts" className={styles.viewAll}>
                View all alerts <ArrowRight size={14} />
              </Link>
            </Card>
          </Reveal>
        </div>
      </div>
    </>
  );
}
