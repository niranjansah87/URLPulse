import type { UserSettings } from "@urlpulse/types";
import { api } from "@/lib/api";

/**
 * Typed calls to the Fastify settings endpoints. Per-user monitoring settings;
 * PostgreSQL is authoritative (docs/03-backend/api.md).
 */
export const settingsApi = {
  async get(): Promise<UserSettings> {
    const { data } = await api.get<UserSettings>("/settings");
    return data;
  },

  async save(settings: UserSettings): Promise<UserSettings> {
    const { data } = await api.post<UserSettings>("/settings", settings);
    return data;
  },
};
