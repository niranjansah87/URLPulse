import { describe, it, expect } from "vitest";
import { DEFAULT_USER_SETTINGS } from "@urlpulse/types";
import { createSettingsRepository } from "./settings";
import type { Db } from "../lib/db";

/** Fake tagged-template db that resolves whatever rows it is constructed with. */
function fakeDb(rows: unknown[]): Db {
  return (() => Promise.resolve(rows)) as unknown as Db;
}

describe("settingsRepository.get", () => {
  it("returns defaults when the user has no settings row", async () => {
    const repo = createSettingsRepository(fakeDb([]));
    const settings = await repo.get("user-1");
    expect(settings).toEqual(DEFAULT_USER_SETTINGS);
  });

  it("maps a snake_case row to the camelCase DTO", async () => {
    const repo = createSettingsRepository(
      fakeDb([
        {
          check_interval_minutes: 15,
          timeout_seconds: 30,
          retry_attempts: 1,
          user_agent: "Chrome (desktop)",
          status_codes_down: "500, 502",
          follow_redirects: false,
          ssl_validation: true,
        },
      ]),
    );
    const settings = await repo.get("user-1");
    expect(settings.checkIntervalMinutes).toBe(15);
  });
});
