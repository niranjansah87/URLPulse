"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api";
import { batchesApi } from "../api/batches-api";
import { toBatchDetailData } from "../lib/view";
import type { BatchDetailData } from "../types";

export type LiveState = "live" | "reconnecting" | "offline";

/**
 * Live batch detail state. PostgreSQL (via the API) stays the source of truth:
 * SSE `batch.updated` events are notifications only — every event triggers a
 * refetch of the authoritative snapshot, and a reconnect refetches too, so a
 * missed event can never leave the page stale (live-updates.md).
 */
export function useBatchDetail(initial: BatchDetailData) {
  const [data, setData] = useState<BatchDetailData>(initial);
  const [live, setLive] = useState<LiveState>("offline");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<"cancel" | "retry" | null>(null);
  const [error, setError] = useState<ApiClientError | null>(null);
  const batchId = initial.batch.id;
  const inFlight = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    // Coalesce bursts of notifications into one request at a time.
    if (inFlight.current) return inFlight.current;
    setRefreshing(true);
    const p = batchesApi
      .get(batchId)
      .then((detail) => {
        setData(toBatchDetailData(detail));
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError) setError(err);
      })
      .finally(() => {
        setRefreshing(false);
        inFlight.current = null;
      });
    inFlight.current = p;
    return p;
  }, [batchId]);

  const isTerminal = data.batch.status === "COMPLETED" || data.batch.status === "FAILED" || data.batch.status === "CANCELLED";

  useEffect(() => {
    // Terminal batches don't change; skip the stream (live-updates.md §14).
    if (isTerminal) {
      setLive("offline");
      return;
    }
    const dispose = batchesApi.subscribe(
      batchId,
      () => void refetch(),
      (state) => {
        setLive(state);
        if (state === "live") void refetch(); // reconcile on (re)connect
      },
    );
    return dispose;
  }, [batchId, isTerminal, refetch]);

  const cancel = useCallback(async () => {
    setBusy("cancel");
    try {
      const detail = await batchesApi.cancel(batchId);
      setData(toBatchDetailData(detail));
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) setError(err);
      return false;
    } finally {
      setBusy(null);
    }
  }, [batchId]);

  const retryFailed = useCallback(async () => {
    setBusy("retry");
    try {
      const detail = await batchesApi.retryFailed(batchId);
      setData(toBatchDetailData(detail));
      return true;
    } catch (err) {
      if (err instanceof ApiClientError) setError(err);
      return false;
    } finally {
      setBusy(null);
    }
  }, [batchId]);

  return { data, live, refreshing, busy, error, refetch, cancel, retryFailed, clearError: () => setError(null) };
}
