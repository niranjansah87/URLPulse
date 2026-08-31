"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, FileText, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ApiClientError } from "@/lib/api";
import { batchesApi } from "@/features/batches/api/batches-api";
import styles from "../landing.module.css";

const PLACEHOLDER = "https://example.com\nhttps://example.org\nhttps://example.net";

function parseUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function isCsv(file: File): boolean {
  return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
}

/** Real batch creation from the landing page: POSTs to the API and opens the new batch. */
export function StartBatchPanel() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const urls = parseUrls(text);
  const canSubmit = !busy && (file !== null || urls.length > 0);

  const chooseFile = (f: File | null) => {
    if (f && !isCsv(f)) {
      setError("Please choose a .csv file.");
      return;
    }
    setError(null);
    setFile(f);
    if (f) setText("");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    chooseFile(e.dataTransfer.files?.[0] ?? null);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const batch = file ? await batchesApi.createFromCsv(file) : await batchesApi.create(urls);
      router.push(`/batches/${batch.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.userMessage : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <motion.div
      className={styles.panel}
      data-dragging={dragging || undefined}
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className={styles.panelHead}>
        <span className={styles.panelBadge} aria-hidden>
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <div>
          <div className={styles.panelTitle}>Start a New Batch</div>
          <p className={styles.panelSub}>Paste URLs or drop a CSV to get started</p>
        </div>
      </div>

      <label htmlFor="landing-urls" className="sr-only">
        URLs, one per line
      </label>
      <textarea
        id="landing-urls"
        className={styles.textarea}
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (file) setFile(null);
        }}
        disabled={busy}
        spellCheck={false}
      />

      <AnimatePresence>
        {dragging ? (
          <motion.div
            className={styles.dropHint}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden
          >
            <Upload size={18} /> Drop your CSV to upload
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className={styles.panelMeta}>
        <span aria-live="polite" className={styles.count}>
          {file ? (
            <span className={styles.fileChip}>
              <FileText size={13} aria-hidden />
              {file.name}
              <button type="button" aria-label="Remove file" className={styles.fileClear} onClick={() => chooseFile(null)}>
                <X size={13} />
              </button>
            </span>
          ) : (
            <>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={urls.length}
                  className={styles.countNum}
                  data-active={urls.length > 0 || undefined}
                  initial={reduce ? false : { y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { y: 8, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                >
                  {urls.length}
                </motion.span>
              </AnimatePresence>
              {` URL${urls.length === 1 ? "" : "s"}`}
            </>
          )}
        </span>
        <button type="button" className={styles.upload} disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload size={14} aria-hidden />
          Upload CSV
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={busy}
          onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error ? (
        <p className={styles.panelError} role="alert">
          {error}
        </p>
      ) : null}

      <Button variant="accent" size="lg" className={styles.panelSubmit} disabled={!canSubmit} aria-busy={busy} onClick={submit}>
        {busy ? "Creating batch…" : "Check URLs Now"}
        {!busy ? <ArrowRight size={16} aria-hidden className={styles.panelSubmitArrow} /> : null}
      </Button>
      <p className={styles.panelFoot}>By checking URLs you agree to our Terms of Service.</p>
    </motion.div>
  );
}
