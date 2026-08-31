import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { Reveal } from "@/components/motion/Reveal";
import { batchRepository } from "@/features/batches/lib/repository";
import { serverAuthHeaders } from "@/lib/server-auth";
import type { BatchRow } from "@/features/batches/types";
import { CreateBatchForm } from "@/features/batches/components/create/CreateBatchForm";
import { CreateSidebar } from "@/features/batches/components/create/CreateSidebar";
import ui from "@/components/ui/ui.module.css";
import styles from "@/features/batches/components/create/create.module.css";

export const metadata: Metadata = { title: "Create Batch", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CreateBatchPage() {
  let recent: BatchRow[] = [];
  let recentFailed = false;
  try {
    recent = (await batchRepository.listBatches({ page: 1, pageSize: 5 }, { headers: await serverAuthHeaders() })).rows;
  } catch {
    recentFailed = true;
  }

  return (
    <>
      <PageHeader
        title="Create New Batch"
        description="Monitor multiple URLs at once"
        actions={
          <>
            <Link href="/batches/new" className={ui.btn} data-variant="primary" data-size="md">
              <Plus size={16} strokeWidth={2} aria-hidden />
              New Batch
            </Link>
            <NotificationBell />
          </>
        }
      />
      <div className={styles.layout}>
        <Reveal>
          <CreateBatchForm />
        </Reveal>
        <Reveal delay={0.05}>
          <CreateSidebar recent={recent} recentFailed={recentFailed} />
        </Reveal>
      </div>
    </>
  );
}
