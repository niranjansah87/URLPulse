"use client";

import { useEffect } from "react";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Reveal } from "@/components/motion/Reveal";
import { useToast } from "@/components/ui/Toast";
import type { BatchDetailData } from "../types";
import { useBatchDetail } from "../hooks/useBatchDetail";
import { BatchHeader } from "./BatchHeader";
import { ProgressSummaryCard } from "./ProgressSummaryCard";
import { UrlResultsSection } from "./UrlResultsSection";
import { OverallHealthPanel } from "./OverallHealthPanel";
import { LiveActivityPanel } from "./LiveActivityPanel";
import { BatchDetailsPanel } from "./BatchDetailsPanel";
import styles from "./batch-detail.module.css";

/**
 * Client composition of the batch detail page. Receives the server-fetched
 * snapshot, then keeps it fresh from the SSE stream (see useBatchDetail).
 */
export function BatchDetailView({ initial }: { initial: BatchDetailData }) {
  const { data, live, busy, error, refetch, cancel, retryFailed, clearError } = useBatchDetail(initial);
  const toast = useToast();
  const { batch, urls, activity } = data;

  useEffect(() => {
    if (!error) return;
    toast.show({ title: "Update failed", body: error.userMessage, tone: "error" });
    clearError();
  }, [error, toast, clearError]);

  const overview = (
    <div className={styles.layout}>
      <div className={styles.mainCol}>
        <Reveal>
          <ProgressSummaryCard batch={batch} />
        </Reveal>
        <Reveal delay={0.05}>
          <UrlResultsSection urls={urls} />
        </Reveal>
      </div>
      <div className={styles.rightCol}>
        <Reveal delay={0.05}>
          <OverallHealthPanel stats={batch.statistics} />
        </Reveal>
        <Reveal delay={0.1}>
          <LiveActivityPanel activity={activity} live={live} />
        </Reveal>
        <Reveal delay={0.15}>
          <BatchDetailsPanel batch={batch} />
        </Reveal>
      </div>
    </div>
  );

  const tabs: TabItem[] = [
    { id: "overview", label: "Overview", content: overview },
    { id: "url-results", label: "URL Results", content: <UrlResultsSection urls={urls} /> },
  ];

  return (
    <>
      <BatchHeader
        batch={batch}
        actions={{ busy, onCancel: cancel, onRetryFailed: retryFailed, onRefresh: refetch }}
      />
      <Tabs items={tabs} defaultTabId="overview" />
    </>
  );
}
