"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./Button";
import { Select } from "./Select";
import styles from "./ui.module.css";

const PAGE_SIZES = [10, 25, 50];

/** Builds a compact page list: 1 … current-1 current current+1 … last. */
function pageItems(current: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const lo = Math.max(2, current - 1);
  const hi = Math.min(count - 1, current + 1);
  if (lo > 2) items.push("…");
  for (let p = lo; p <= hi; p++) items.push(p);
  if (hi < count - 1) items.push("…");
  items.push(count);
  return items;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  noun = "results",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  noun?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span className={styles.paginationInfo}>
        Showing {start} to {end} of {total} {noun}
      </span>
      <div className={styles.pager}>
        {onPageSize ? (
          <Select value={String(pageSize)} onChange={(e) => onPageSize(Number(e.target.value))} aria-label="Rows per page">
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} per page
              </option>
            ))}
          </Select>
        ) : null}
        <IconButton label="Previous page" bordered disabled={current === 1} onClick={() => onPage(current - 1)}>
          <ChevronLeft size={16} />
        </IconButton>
        {pageItems(current, pageCount).map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className={styles.pageEllipsis} aria-hidden>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === current ? "page" : undefined}
              className={cn(styles.pageBtn, p === current && styles.pageBtnActive)}
              onClick={() => onPage(p)}
            >
              {p}
            </button>
          ),
        )}
        <IconButton label="Next page" bordered disabled={current === pageCount} onClick={() => onPage(current + 1)}>
          <ChevronRight size={16} />
        </IconButton>
      </div>
    </nav>
  );
}
