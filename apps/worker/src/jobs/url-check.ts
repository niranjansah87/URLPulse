import type { Job } from "bullmq";
import { urlCheckJobDataSchema, type UrlCheckJobData } from "@urlpulse/types";

/**
 * URL-check job processor.
 *
 * SCAFFOLD ONLY. This validates the job payload and returns. The real work —
 * the outbound HTTP health check, the global 10 req/s rate-limit permit, the
 * Redis TTL-leased global concurrency slot (ADR-022), and idempotent DB state
 * transitions (docs/03-backend/retries-and-idempotency.md) — is the next phase.
 * It deliberately performs no database writes so it cannot corrupt state.
 */
export async function urlCheckProcessor(job: Job<UrlCheckJobData>): Promise<void> {
  const data = urlCheckJobDataSchema.parse(job.data);
  console.log(
    `[worker] received url-check job ${job.id ?? "?"} for url ${data.urlId} ` +
      `(batch ${data.batchId}) — processing not implemented yet`,
  );
}
