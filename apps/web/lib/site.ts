/**
 * Canonical public origin, single source for metadata, canonical URLs, robots,
 * and the sitemap. Set NEXT_PUBLIC_SITE_URL at build time (see .env.production);
 * the fallback is the real production domain so a missing env can never emit a
 * canonical/OG URL pointing at a domain we do not own.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://urlpulse.niranjansah87.com.np";
