import { loadServerConfig } from "@urlpulse/config";

/** Loaded and validated once per process. Fails fast on misconfiguration. */
export const config = loadServerConfig();
