import { BATCH_EVENTS_CHANNEL, sseBatchUpdatedSchema, type SseBatchUpdated } from "@urlpulse/types";

/**
 * Cross-instance live-update fan-out (live-updates.md). A single Redis subscriber
 * per API process listens on BATCH_EVENTS_CHANNEL; each incoming notification is
 * delivered to the local SSE clients watching that batch. Workers and other API
 * instances publish to the same channel, so a client connected to any instance
 * is notified regardless of which process changed the state.
 *
 * The event is only a notification — the client refetches authoritative state
 * from PostgreSQL (ADR-005). One subscriber connection is shared for all clients;
 * per-batch subscriptions are avoided.
 */
export interface SubscriberClient {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(event: "message", listener: (channel: string, message: string) => void): unknown;
}

export type SendFn = (payload: SseBatchUpdated) => void;

export interface EventBus {
  start(): Promise<void>;
  /** Register an SSE client for a batch; returns a function to deregister it. */
  addClient(batchId: string, send: SendFn): () => void;
  clientCount(batchId: string): number;
}

export function createEventBus(subscriber: SubscriberClient): EventBus {
  const clients = new Map<string, Set<SendFn>>();

  subscriber.on("message", (channel, message) => {
    if (channel !== BATCH_EVENTS_CHANNEL) return;
    let payload: SseBatchUpdated;
    try {
      payload = sseBatchUpdatedSchema.parse(JSON.parse(message));
    } catch {
      return; // ignore malformed notifications
    }
    const set = clients.get(payload.batchId);
    if (!set) return;
    for (const send of set) {
      try {
        send(payload);
      } catch {
        // a broken client stream must not affect the others
      }
    }
  });

  return {
    async start() {
      await subscriber.subscribe(BATCH_EVENTS_CHANNEL);
    },
    addClient(batchId, send) {
      let set = clients.get(batchId);
      if (!set) {
        set = new Set();
        clients.set(batchId, set);
      }
      set.add(send);
      return () => {
        const current = clients.get(batchId);
        if (!current) return;
        current.delete(send);
        if (current.size === 0) clients.delete(batchId);
      };
    },
    clientCount(batchId) {
      return clients.get(batchId)?.size ?? 0;
    },
  };
}
