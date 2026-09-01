// Alerts share their shape with the backend contract; re-export the canonical
// zod-inferred types so the client and server cannot drift.
export type { Alert, AlertSeverity, AlertStatus, AlertType } from "@urlpulse/types";
