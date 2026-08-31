"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/feedback";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface for developers; user sees a friendly message, never the raw error.
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This page hit a snag"
      body="We couldn't display this content. You can try again."
      onRetry={reset}
    />
  );
}
