"use client";

import { useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CheckCircle2, FileText, RotateCcw, Sparkles, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { api, ApiClientError } from "@/lib/api";
import { batchesApi } from "@/features/batches/api/batches-api";
import { useCurrentUser } from "@/features/auth/useCurrentUser";
import styles from "../landing.module.css";

const PLACEHOLDER = "https://example.com\nhttps://example.org\nhttps://example.net";
const DEMO_MAX = 5;
const PENDING_URLS_KEY = "urlpulse-pending-urls";

/** Mirror of the API's demo result shape (apps/api/src/lib/demo-check.ts). */
interface DemoCheckResult {
  url: string;
  ok: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  pageTitle: string | null;
  error: string | null;
}

function parseUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function isCsv(file: File): boolean {
  return file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
}

/**
 * Landing-page batch entry. A signed-in user creates a real, persisted batch and
 * is taken to its detail page. A guest runs the capped, unauthenticated demo
 * (apps/api /demo/checks) and sees results inline, with a CTA to sign up — their
 * pasted URLs are stashed so signup can pick up where they left off.
 */
export function StartBatchPanel() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const { status } = useCurrentUser();
  const authed = status === "authenticated";

  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState<DemoCheckResult[] | null>(null);

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

  const runDemo = async () => {
    if (urls.length === 0) {
      setError("Paste a URL or two to try the demo. Sign up to upload a CSV.");
      return;
    }
    try {
      localStorage.setItem(PENDING_URLS_KEY, JSON.stringify(urls));
    } catch {
      /* storage may be unavailable; the demo still runs */
    }
    setError(null);
    setBusy(true);
    try {
      const { data } = await api.post<DemoCheckResult[]>("/demo/checks", { urls: urls.slice(0, DEMO_MAX) });
      setResults(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.status === 429 ? err.message || "Too many demo checks. Sign up for unlimited checks." : err.userMessage);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const createBatch = async () => {
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

  const submit = () => (authed ? void createBatch() : void runDemo());

  const reset = () => {
    setResults(null);
    setError(null);
  };

  return (
    <motion.div
      className={styles.panel}
      data-dragging={dragging || undefined}
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      onDragOver={(e) => {
        if (results) return;
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={results ? undefined : onDrop}
    >
      <div className={styles.panelHead}>
        <span className={styles.panelBadge} aria-hidden>
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <div>
          <div className={styles.panelTitle}>{results ? "Demo results" : "Start a New Batch"}</div>
          <p className={styles.panelSub}>
            {results ? "A quick, free preview — sign up to save and monitor more" : authed ? "Paste URLs or drop a CSV to get started" : "Try it free — paste a few URLs, no account needed"}
          </p>
        </div>
      </div>

      {results ? (
        <DemoResults results={results} reduce={!!reduce} onReset={reset} />
      ) : (
        <>
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
              <motion.div className={styles.dropHint} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden>
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
                    <XCircle size={13} />
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
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => chooseFile(e.target.files?.[0] ?? null)} />
          </div>

          {error ? (
            <p className={styles.panelError} role="alert">
              {error}
            </p>
          ) : null}

          <Button variant="accent" size="lg" className={styles.panelSubmit} disabled={!canSubmit} aria-busy={busy} onClick={submit}>
            {busy ? (authed ? "Creating batch…" : "Checking…") : authed ? "Check URLs Now" : "Try it free"}
            {!busy ? <ArrowRight size={16} aria-hidden className={styles.panelSubmitArrow} /> : null}
          </Button>
          <p className={styles.panelFoot}>
            {authed ? "By checking URLs you agree to our Terms of Service." : `Free preview checks up to ${DEMO_MAX} URLs. No account needed.`}
          </p>
        </>
      )}
    </motion.div>
  );
}

function DemoResults({ results, reduce, onReset }: { results: DemoCheckResult[]; reduce: boolean; onReset: () => void }) {
  return (
    <>
      <ul className={styles.results}>
        {results.map((r, i) => (
          <motion.li
            key={`${r.url}-${i}`}
            className={styles.resultRow}
            initial={reduce ? false : { opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: reduce ? 0 : i * 0.05 }}
          >
            <span className={styles.resultDot} data-ok={r.ok} aria-hidden>
              {r.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            </span>
            <span className={styles.resultBody}>
              <span className={styles.resultUrl} title={r.url}>
                {r.url}
              </span>
              {r.pageTitle ? <span className={styles.resultTitle}>{r.pageTitle}</span> : null}
            </span>
            <span className={styles.resultMeta}>
              <span className={styles.resultStatus} data-ok={r.ok}>
                {r.httpStatus ?? r.error ?? "—"}
              </span>
              {r.responseTimeMs !== null ? <span className={styles.resultTime}>{r.responseTimeMs} ms</span> : null}
            </span>
          </motion.li>
        ))}
      </ul>

      <div className={styles.demoCta}>
        <Link href="/signup" className={styles.demoCtaLink}>
          <Button variant="accent" size="lg" className={styles.panelSubmit}>
            Sign up to monitor more
            <ArrowRight size={16} aria-hidden />
          </Button>
        </Link>
        <button type="button" className={styles.upload} onClick={onReset}>
          <RotateCcw size={14} aria-hidden /> Run another
        </button>
      </div>
      <p className={styles.panelFoot}>Sign up to check more URLs, upload CSVs, and keep your history.</p>
    </>
  );
}
