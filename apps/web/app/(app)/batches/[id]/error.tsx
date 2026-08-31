"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/feedback";

export default function BatchDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Couldn't load this batch"
      body="The batch details failed to load. Please try again."
      onRetry={reset}
    />
  );
}
