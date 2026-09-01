"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Link2, Play } from "lucide-react";
import { httpUrlSchema, MAX_URLS_PER_BATCH } from "@urlpulse/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { ApiClientError } from "@/lib/api";
import { batchesApi } from "../../api/batches-api";
import styles from "./create.module.css";

type Mode = "manual" | "file";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** URLs a guest tried in the landing demo, carried through signup (StartBatchPanel). */
const PENDING_URLS_KEY = "urlpulse-pending-urls";

interface Entry {
  line: number;
  raw: string;
  error: string | null;
}

function parseEntries(text: string): Entry[] {
  return text
    .split("\n")
    .map((raw, i) => ({ line: i + 1, raw: raw.trim() }))
    .filter((e) => e.raw !== "")
    .map((e) => {
      const r = httpUrlSchema.safeParse(e.raw);
      return { ...e, error: r.success ? null : (r.error.issues[0]?.message ?? "Invalid URL") };
    });
}

export function CreateBatchForm() {
  const router = useRouter();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>("manual");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Pick up URLs a guest tried in the landing demo (stashed before signup), then
  // clear them so they only prefill once.
  useEffect(() => {
    let urls: string[] = [];
    try {
      const stored = localStorage.getItem(PENDING_URLS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) urls = parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0);
      }
      localStorage.removeItem(PENDING_URLS_KEY);
    } catch {
      /* ignore bad storage */
    }
    if (urls.length > 0) {
      setMode("manual");
      setText(urls.join("\n"));
      toast.show({ title: "We kept your URLs", body: "Picked up from the demo - review and create your batch.", tone: "success" });
    }
    // Run once on mount; toast is stable for the session.
  }, []);

  const entries = useMemo(() => parseEntries(text), [text]);
  const valid = entries.filter((e) => e.error === null);
  const invalid = entries.filter((e) => e.error !== null);
  const invalidLines = new Set(invalid.map((e) => e.line));
  const overLimit = valid.length > MAX_URLS_PER_BATCH;
  const lineCount = Math.max(5, text.split("\n").length);

  const canSubmit =
    !submitting && !overLimit && (mode === "manual" ? valid.length > 0 && invalid.length === 0 : file !== null);

  const acceptFile = (f: File | null) => {
    setFileError(null);
    if (!f) return setFile(null);
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") return setFileError("Please choose a .csv file.");
    if (f.size > MAX_FILE_BYTES) return setFileError("File is larger than 5 MB.");
    setFile(f);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const batch =
        mode === "file" && file
          ? await batchesApi.createFromCsv(file)
          : await batchesApi.create(valid.map((e) => e.raw));
      toast.show({ title: "Batch created", body: `${batch.totalCount} URLs queued for checking.`, tone: "success" });
      router.push(`/batches/${batch.id}`);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.userMessage : "Something went wrong. Please try again.";
      setSubmitError(message);
      toast.show({ title: "Couldn't create batch", body: message, tone: "error" });
      setSubmitting(false);
    }
  };

  const urlsLabel = mode === "file" ? (file ? file.name : "-") : String(valid.length);
  const methodLabel = mode === "file" ? "CSV upload" : "Manual input";

  return (
    <Card>
      {/* Step 1 */}
      <div className={styles.step}>
        <div className={styles.stepHead}>
          <span className={styles.stepNum} aria-hidden>
            1
          </span>
          <div>
            <h2 className={styles.stepTitle}>Add URLs</h2>
            <p className={styles.stepSub}>Add URLs manually or upload a file</p>
          </div>
        </div>
        <div className={styles.segmented} role="group" aria-label="Input method">
          {(["manual", "file"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={styles.segment}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  setMode(m === "manual" ? "file" : "manual");
                }
              }}
            >
              {m === "manual" ? "Manual Input" : "Upload File"}
            </button>
          ))}
        </div>
      </div>

      {mode === "manual" ? (
        <>
          <div className={styles.editor}>
            <div className={styles.editorBody}>
              <div ref={gutterRef} className={styles.gutter} aria-hidden>
                {Array.from({ length: lineCount }, (_, i) => i + 1).map((n) => (
                  <div key={n} className={cn(invalidLines.has(n) && styles.gutterInvalid)}>
                    {n}
                  </div>
                ))}
                <div>…</div>
              </div>
              <label className="sr-only" htmlFor="batch-urls">
                URLs, one per line
              </label>
              <textarea
                id="batch-urls"
                className={styles.textarea}
                placeholder="Enter URLs (one per line)"
                value={text}
                spellCheck={false}
                aria-invalid={invalid.length > 0 || overLimit}
                aria-describedby="batch-urls-status"
                onChange={(e) => setText(e.target.value)}
                onScroll={(e) => {
                  if (gutterRef.current) gutterRef.current.style.transform = `translateY(-${e.currentTarget.scrollTop}px)`;
                }}
              />
            </div>
            <div className={styles.editorFoot} id="batch-urls-status">
              <Link2 size={16} aria-hidden style={{ color: "var(--color-accent)" }} />
              <span>
                {valid.length} URL{valid.length === 1 ? "" : "s"} added
                {invalid.length > 0 ? ` · ${invalid.length} invalid` : ""}
              </span>
              <span className={styles.editorFootRight}>
                <span style={{ color: overLimit ? "var(--color-error-fg)" : undefined }}>
                  {valid.length} / {MAX_URLS_PER_BATCH.toLocaleString()} max
                </span>
                <button type="button" className={styles.linkBtn} onClick={() => setText("")} disabled={text === ""}>
                  Clear
                </button>
              </span>
            </div>
          </div>
          {invalid.length > 0 ? (
            <ul className={styles.errors} role="alert">
              {invalid.slice(0, 5).map((e) => (
                <li key={e.line}>
                  Line {e.line}: {e.error}
                </li>
              ))}
              {invalid.length > 5 ? <li>…and {invalid.length - 5} more</li> : null}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <label
            className={cn(styles.dropzone, dragging && styles.dropzoneActive)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files[0] ?? null);
            }}
          >
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-describedby="csv-help"
              onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
            />
            <FileUp size={24} strokeWidth={1.5} aria-hidden />
            {file ? (
              <span className={styles.fileChip}>
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </span>
            ) : (
              <span className={styles.dropTitle}>Drop a CSV here or click to choose</span>
            )}
            <span id="csv-help" style={{ fontSize: "var(--text-xs)" }}>
              One URL per row · up to 5 MB
            </span>
          </label>
          {fileError ? (
            <p className={styles.submitError} role="alert">
              {fileError}
            </p>
          ) : null}
          {file ? (
            <div className={styles.editorFoot} style={{ borderTop: "none", paddingLeft: 0 }}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => {
                  setFile(null);
                  setFileError(null);
                }}
              >
                Remove file
              </button>
            </div>
          ) : null}
        </>
      )}

      <div className={styles.divider} />

      {/* Step 2 */}
      <div className={styles.stepHead}>
        <span className={styles.stepNum} aria-hidden>
          2
        </span>
        <div>
          <h2 className={styles.stepTitle}>Review &amp; Create</h2>
          <p className={styles.stepSub}>URLs are checked with the system defaults (timeout, retries, rate limits)</p>
        </div>
      </div>
      <div className={styles.reviewGrid}>
        <ReviewTile icon={<Link2 size={16} />} label="URLs" value={urlsLabel} />
        <ReviewTile icon={<FileUp size={16} />} label="Source" value={methodLabel} />
      </div>

      {submitError ? (
        <p className={styles.submitError} role="alert">
          {submitError}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button variant="secondary" size="lg" onClick={() => router.push("/batches")} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="primary" size="lg" leftIcon={<Play size={16} />} disabled={!canSubmit} aria-busy={submitting} onClick={submit}>
          {submitting ? "Creating…" : "Create Batch"}
        </Button>
      </div>
    </Card>
  );
}

function ReviewTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className={styles.reviewTile}>
      <span className={styles.reviewIcon} aria-hidden>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className={styles.reviewLabel}>{label}</div>
        <div className={styles.reviewValue} title={value}>
          {value}
        </div>
      </div>
    </div>
  );
}
