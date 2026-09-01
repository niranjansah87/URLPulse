"use client";

// Global error boundary: replaces the root layout, so it must render <html>/<body>.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8fa",
          color: "#18181b",
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#71717a", marginBottom: 16 }}>An unexpected error occurred. Please try again.</p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: "#18181b",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
