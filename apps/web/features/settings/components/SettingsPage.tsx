"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  CreditCard,
  Crown,
  Download,
  KeyRound,
  LayoutGrid,
  LayoutList,
  Mail,
  Monitor,
  Puzzle,
  RefreshCw,
  RotateCcw,
  Settings,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ConfirmationDialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/Toast";
import { Reveal } from "@/components/motion/Reveal";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import { authClient } from "@/features/auth/client";
import { batchesApi } from "@/features/batches/api/batches-api";
import { usePreferences } from "../lib/preferences";
import styles from "../settings.module.css";

const TIMEZONES = [
  ["Asia/Kathmandu", "(GMT+05:45) Asia/Kathmandu"],
  ["Asia/Kolkata", "(GMT+05:30) Asia/Kolkata"],
  ["Europe/London", "(GMT+00:00) Europe/London"],
  ["America/New_York", "(GMT-04:00) America/New_York"],
  ["UTC", "(GMT+00:00) UTC"],
] as const;
const LANGUAGES = [["en-US", "English (US)"], ["en-GB", "English (UK)"]] as const;

function Placeholder({ title }: { title: string }) {
  return (
    <Card>
      <EmptyState title={`${title} settings coming soon`} body="This section will be available in a future release." />
    </Card>
  );
}

export function SettingsPage() {
  const others: { label: string; icon: React.ReactNode }[] = [
    { label: "Monitoring", icon: <Activity size={16} /> },
    { label: "Notifications", icon: <Bell size={16} /> },
    { label: "Team", icon: <Users size={16} /> },
    { label: "Billing", icon: <CreditCard size={16} /> },
    { label: "API Keys", icon: <KeyRound size={16} /> },
    { label: "Integrations", icon: <Puzzle size={16} /> },
  ];
  const tabs: TabItem[] = [
    { id: "general", label: "General", icon: <Settings size={16} />, content: <GeneralTab /> },
    ...others.map(({ label, icon }) => ({
      id: label.toLowerCase().replace(" ", "-"),
      label,
      icon,
      content: <Placeholder title={label} />,
    })),
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Batches", href: "/batches" }, { label: "Settings" }]}
        title="Settings"
        description="Manage your account, monitoring preferences and notifications"
        actions={<NotificationBell />}
      />
      <Tabs items={tabs} defaultTabId="general" />
    </>
  );
}

function GeneralTab() {
  const { user, status } = useCurrentUser();
  const { data: session } = authClient.useSession();
  const toast = useToast();
  const [prefs, update, reset] = usePreferences();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user]);

  const authed = status === "authenticated";

  const saveProfile = async () => {
    setSaving(true);
    try {
      await authClient.updateUser({ name: name.trim() });
      toast.show({ title: "Profile updated", tone: "success" });
    } catch {
      toast.show({ title: "Couldn't update profile", body: "Please try again.", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!authed) {
      toast.show({ title: "Sign-in service unavailable", body: "Account deletion needs an active session.", tone: "error" });
      return;
    }
    try {
      await authClient.deleteUser();
      toast.show({ title: "Account deleted", tone: "success" });
    } catch {
      toast.show({ title: "Couldn't delete account", body: "Please try again.", tone: "error" });
    }
  };

  const memberSince = session?.user.createdAt
    ? new Date(session.user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <Reveal>
      <div className={styles.layout}>
        <div className={styles.col}>
          <Card>
            <SectionHeader
              title="Profile Settings"
              subtitle="Manage your profile information and account details."
              actions={
                <Button variant="secondary" onClick={saveProfile} disabled={!authed || saving || name.trim() === ""}>
                  {saving ? "Saving…" : "Update Profile"}
                </Button>
              }
            />
            <div className={styles.formGrid}>
              <Field label="Full Name" htmlFor="full-name">
                <span className={styles.inputWrap}>
                  <User size={16} aria-hidden />
                  <input id="full-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} disabled={status === "loading"} />
                </span>
              </Field>
              <Field label="Email Address" htmlFor="email">
                <span className={styles.inputWrap}>
                  <Mail size={16} aria-hidden />
                  <input id="email" className={styles.input} value={user?.email ?? ""} readOnly />
                </span>
              </Field>
              <Field label="Timezone" htmlFor="timezone">
                <Select id="timezone" value={prefs.timezone} onChange={(e) => update({ timezone: e.target.value })}>
                  {TIMEZONES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Language" htmlFor="language">
                <Select id="language" value={prefs.language} onChange={(e) => update({ language: e.target.value })}>
                  {LANGUAGES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            {status === "unavailable" ? <p className={styles.note}>Sign-in service unavailable — showing a demo account; profile changes are disabled.</p> : null}
          </Card>

          <Card>
            <SectionHeader
              title="Default Monitoring Settings"
              subtitle="Saved on this device; applied when per-batch settings are available."
              actions={
                <Button variant="secondary" leftIcon={<RotateCcw size={16} />} onClick={reset}>
                  Reset to Defaults
                </Button>
              }
            />
            <div className={styles.formGrid4}>
              <Field label="Check Interval" htmlFor="check-interval" hint="How often to check URLs">
                <Select id="check-interval" value={prefs.checkIntervalMinutes} onChange={(e) => update({ checkIntervalMinutes: Number(e.target.value) })}>
                  {[1, 5, 15, 30, 60].map((m) => (
                    <option key={m} value={m}>
                      {m} minute{m === 1 ? "" : "s"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Timeout" htmlFor="timeout" hint="Request timeout duration">
                <Select id="timeout" value={prefs.timeoutSeconds} onChange={(e) => update({ timeoutSeconds: Number(e.target.value) })}>
                  {[5, 10, 20, 30].map((s) => (
                    <option key={s} value={s}>
                      {s} seconds
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Retry Attempts" htmlFor="retries" hint="Number of retries on failure">
                <Select id="retries" value={prefs.retryAttempts} onChange={(e) => update({ retryAttempts: Number(e.target.value) })}>
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} attempt{n === 1 ? "" : "s"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="User Agent" htmlFor="user-agent" hint="User agent for requests">
                <Select id="user-agent" value={prefs.userAgent} onChange={(e) => update({ userAgent: e.target.value })}>
                  {["URLPulse Bot", "Chrome (desktop)", "Safari (mobile)"].map((ua) => (
                    <option key={ua} value={ua}>
                      {ua}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <SectionHeader title="Other Preferences" subtitle="Configure other application preferences." />
            <PrefRow icon={<LayoutList size={18} />} title="Compact Dashboard" sub="Show more data in less space">
              <Toggle checked={prefs.compactDashboard} onChange={(v) => update({ compactDashboard: v })} label="Compact Dashboard" />
            </PrefRow>
            <PrefRow icon={<RefreshCw size={18} />} title="Auto-refresh Dashboard" sub="Automatically refresh dashboard data">
              <Toggle checked={prefs.autoRefreshDashboard} onChange={(v) => update({ autoRefreshDashboard: v })} label="Auto-refresh Dashboard" />
            </PrefRow>
            <PrefRow icon={<Download size={18} />} title="Export With Title" sub="Include page title in exports when available">
              <Toggle checked={prefs.exportWithTitle} onChange={(v) => update({ exportWithTitle: v })} label="Export With Title" />
            </PrefRow>
          </Card>
        </div>

        <div className={styles.col}>
          <PlanUsage />

          <Card>
            <SectionHeader title="Account" />
            <div className={styles.kv}>
              <span className={styles.kvKey}>Email</span>
              <span>{user?.email ?? "—"}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvKey}>Member Since</span>
              <span>{memberSince}</span>
            </div>
            <div className={styles.kv}>
              <span className={styles.kvKey}>Role</span>
              <Badge tone="accent">Owner</Badge>
            </div>
          </Card>

          <Card>
            <h2 className={styles.dangerTitle}>Danger Zone</h2>
            <p className={styles.dangerSub}>Delete Account</p>
            <p className={styles.dangerText}>Permanently delete your account and all associated data. This action cannot be undone.</p>
            <Button variant="secondary" className={styles.dangerBtn} leftIcon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)}>
              Delete Account
            </Button>
          </Card>
        </div>
      </div>

      <footer className={styles.footer}>
        <span>© 2025 URLPulse. All rights reserved.</span>
        <nav className={styles.footerLinks} aria-label="Legal">
          <Link href="/">Docs</Link>
          <Link href="/">Privacy Policy</Link>
          <Link href="/">Terms of Service</Link>
        </nav>
      </footer>

      <ConfirmationDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => void deleteAccount()}
        title="Delete account"
        description="This permanently deletes your account and all associated batches. This cannot be undone."
        confirmLabel="Delete Account"
        destructive
      />
    </Reveal>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
      </label>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}

function PrefRow({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className={styles.prefRow}>
      <span className={styles.prefIcon} aria-hidden>
        {icon}
      </span>
      <div className={styles.prefText}>
        <div className={styles.prefTitle}>{title}</div>
        <div className={styles.prefSub}>{sub}</div>
      </div>
      {children}
    </div>
  );
}

/** Usage from the real batch list; plan limits are placeholders until billing exists. */
function PlanUsage() {
  const [usage, setUsage] = useState<{ batches: number; urls: number; partial: boolean } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    batchesApi
      .list({ page: 1, pageSize: 50 })
      .then(({ items, meta }) =>
        setUsage({ batches: meta.total, urls: items.reduce((s, b) => s + b.totalCount, 0), partial: meta.total > items.length }),
      )
      .catch(() => setFailed(true));
  }, []);

  const BATCH_LIMIT = 100;
  const URL_LIMIT = 50_000;

  return (
    <Card>
      <SectionHeader title="Plan & Usage" actions={<Badge tone="success">Free plan</Badge>} />
      <p className={styles.hint} style={{ marginTop: "calc(-1 * var(--space-2))" }}>
        Limits not enforced yet
      </p>
      <UsageRow icon={<LayoutGrid size={16} />} label="Batches" value={usage ? `${usage.batches} / ${BATCH_LIMIT}` : failed ? "—" : "…"} pct={usage ? (usage.batches / BATCH_LIMIT) * 100 : 0} />
      <UsageRow
        icon={<Monitor size={16} />}
        label={usage?.partial ? "URLs Checked (this page)" : "URLs Checked"}
        value={usage ? `${usage.urls.toLocaleString()} / ${URL_LIMIT.toLocaleString()}` : failed ? "—" : "…"}
        pct={usage ? (usage.urls / URL_LIMIT) * 100 : 0}
      />
      <UsageRow icon={<Users size={16} />} label="Team Members" value="1 / 1" pct={100} />
      <Button variant="primary" disabled title="Plans are not available yet" style={{ width: "100%", marginTop: "var(--space-4)" }} leftIcon={<Crown size={16} />}>
        Upgrade Plan
      </Button>
    </Card>
  );
}

function UsageRow({ icon, label, value, pct }: { icon: React.ReactNode; label: string; value: string; pct: number }) {
  return (
    <div className={styles.usageRow}>
      <span className={styles.usageIcon} aria-hidden>
        {icon}
      </span>
      <div className={styles.usageBody}>
        <div className={styles.usageHead}>
          <span>{label}</span>
          <span className={styles.usageValue}>{value}</span>
        </div>
        <ProgressBar value={pct} tone="accent" label={`${label} usage`} />
      </div>
    </div>
  );
}
