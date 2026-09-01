import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Fixed release date of the public landing page. A real timestamp, not
// new Date() per request/build, so lastModified reflects actual content change.
const LANDING_LAST_MODIFIED = new Date("2026-09-01");

/** Only public/indexable routes belong here - not authenticated app pages. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: LANDING_LAST_MODIFIED, changeFrequency: "monthly", priority: 1 },
  ];
}
