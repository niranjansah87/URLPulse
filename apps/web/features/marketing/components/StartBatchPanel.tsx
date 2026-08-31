"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Upload } from "lucide-react";
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

/** Real batch creation from the landing page: POSTs to the API and opens the new batch. */
export function StartBatchPanel() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const urls = parseUrls(text);
  const canSubmit = !busy && (file !== null || urls.length > 0);

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
    <div className={styles.panel}>
      <div className={styles.panelTitle}>Start a New Batch</div>
      <p className={styles.panelSub}>Paste URLs or upload a CSV to get started</p>
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
      <div className={styles.panelMeta}>
        <span aria-live="polite">{file ? file.name : `${urls.length} URL${urls.length === 1 ? "" : "s"}`}</span>
        <label className={styles.upload}>
          <Upload size={14} aria-hidden />
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) setText("");
            }}
          />
        </label>
      </div>
      {error ? (
        <p className={styles.panelError} role="alert">
          {error}
        </p>
      ) : null}
      <Button variant="accent" size="lg" style={{ width: "100%" }} disabled={!canSubmit} aria-busy={busy} onClick={submit}>
        {busy ? "Creating batch…" : "Check URLs Now"}
        {!busy ? <ArrowRight size={16} aria-hidden /> : null}
      </Button>
      <p className={styles.panelFoot}>By checking URLs you agree to our Terms of Service.</p>
    </div>
  );
}
