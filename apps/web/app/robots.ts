import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Only the public landing page is indexable. Authenticated app routes and the
 * thin auth pages are disallowed so crawlers do not index private dashboards or
 * duplicate login/signup screens. The sitemap is advertised absolutely.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/batches",
          "/history",
          "/alerts",
          "/login",
          "/signup",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
