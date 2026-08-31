import { DEFAULT_USER_SETTINGS, type UserSettings } from "@urlpulse/types";
import type { Db } from "../lib/db";

/**
 * Data access for per-user monitoring settings. Every query is scoped to a
 * user_id so one user can never read or mutate another's settings. Returns a
 * camelCase DTO, never raw rows; a user with no row yet reads
 * DEFAULT_USER_SETTINGS (identical to the column defaults).
 */

interface SettingsRow {
  check_interval_minutes: number;
  timeout_seconds: number;
  retry_attempts: number;
  user_agent: UserSettings["userAgent"];
  status_codes_down: string;
  follow_redirects: boolean;
  ssl_validation: boolean;
}

function toSettings(row: SettingsRow): UserSettings {
  return {
    checkIntervalMinutes: row.check_interval_minutes,
    timeoutSeconds: row.timeout_seconds,
    retryAttempts: row.retry_attempts,
    userAgent: row.user_agent,
    statusCodesDown: row.status_codes_down,
    followRedirects: row.follow_redirects,
    sslValidation: row.ssl_validation,
  };
}

export interface SettingsRepository {
  get(userId: string): Promise<UserSettings>;
  upsert(userId: string, settings: UserSettings): Promise<UserSettings>;
}

export function createSettingsRepository(db: Db): SettingsRepository {
  return {
    async get(userId) {
      const [row] = await db<SettingsRow[]>`
        SELECT check_interval_minutes, timeout_seconds, retry_attempts,
               user_agent, status_codes_down, follow_redirects, ssl_validation
        FROM user_settings
        WHERE user_id = ${userId}
      `;
      return row ? toSettings(row) : DEFAULT_USER_SETTINGS;
    },

    async upsert(userId, s) {
      // Full-object write: the client always sends the complete settings object,
      // so the upsert is atomic (no read-modify-write race between concurrent
      // saves — last write wins, which is correct for a user editing their own).
      const [row] = await db<SettingsRow[]>`
        INSERT INTO user_settings (
          user_id, check_interval_minutes, timeout_seconds, retry_attempts,
          user_agent, status_codes_down, follow_redirects, ssl_validation
        ) VALUES (
          ${userId}, ${s.checkIntervalMinutes}, ${s.timeoutSeconds}, ${s.retryAttempts},
          ${s.userAgent}, ${s.statusCodesDown}, ${s.followRedirects}, ${s.sslValidation}
        )
        ON CONFLICT (user_id) DO UPDATE SET
          check_interval_minutes = EXCLUDED.check_interval_minutes,
          timeout_seconds = EXCLUDED.timeout_seconds,
          retry_attempts = EXCLUDED.retry_attempts,
          user_agent = EXCLUDED.user_agent,
          status_codes_down = EXCLUDED.status_codes_down,
          follow_redirects = EXCLUDED.follow_redirects,
          ssl_validation = EXCLUDED.ssl_validation,
          updated_at = now()
        RETURNING check_interval_minutes, timeout_seconds, retry_attempts,
                  user_agent, status_codes_down, follow_redirects, ssl_validation
      `;
      // INSERT ... ON CONFLICT DO UPDATE always returns exactly one row.
      return toSettings(row!);
    },
  };
}
