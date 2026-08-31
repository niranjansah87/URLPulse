import type { Metadata } from "next";
import { ErrorState } from "@/components/ui/feedback";
import { Reveal } from "@/components/motion/Reveal";
import { batchRepository } from "@/features/batches/lib/repository";
import { serverAuthHeaders } from "@/lib/server-auth";
import { DashboardHero } from "@/features/batches/components/dashboard/DashboardHero";
import { DashboardMetrics } from "@/features/batches/components/dashboard/DashboardMetrics";
import { RecentBatches } from "@/features/batches/components/dashboard/RecentBatches";
import { OverallHealthCard } from "@/features/batches/components/dashboard/OverallHealthCard";
import styles from "@/features/batches/components/dashboard/dashboard.module.css";

export const metadata: Metadata = { title: "Batches", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABLE_PAGE_SIZE = 10;
/** Most recent batches used for the metric cards + health donut (API max page size). */
const STATS_PAGE_SIZE = 100;

export default async function BatchesPage() {
  let rows: Awaited<ReturnType<typeof batchRepository.listBatches>>["rows"] = [];
  let total = 0;
  let failed = false;
  try {
    const res = await batchRepository.listBatches({ page: 1, pageSize: STATS_PAGE_SIZE }, { headers: await serverAuthHeaders() });
    rows = res.rows;
    total = res.meta.total;
  } catch {
    failed = true;
  }

  return (
    <>
      <Reveal>
        <DashboardHero />
      </Reveal>

      {failed ? (
        <ErrorState title="Couldn't load batches" body="The API is unreachable right now. Please try again shortly." />
      ) : (
        <>
          <DashboardMetrics rows={rows} total={total} />
          <Reveal delay={0.1}>
            <div className={styles.layout}>
              <RecentBatches initialRows={rows.slice(0, TABLE_PAGE_SIZE)} initialMeta={{ page: 1, pageSize: TABLE_PAGE_SIZE, total }} />
              {rows.length > 0 ? (
                <div className={styles.rightCol}>
                  <OverallHealthCard rows={rows} />
                </div>
              ) : null}
            </div>
          </Reveal>
        </>
      )}
    </>
  );
}
