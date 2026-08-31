"use client";

import { UNREAD_ALERT_COUNT } from "../mocks/alerts";

/**
 * Unread alert count for the bell/sidebar badge. Alerts have no backend yet, so
 * this reads the isolated mock seed; swap for an API hook when alerts land.
 */
export function useUnreadAlertCount(): number {
  return UNREAD_ALERT_COUNT;
}
