import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://urlpulse.dev";

/**
 * Application pages are behind navigation and are not indexable; only marketing/
 * docs-style public routes would be. For now, disallow app routes and expose the
 * sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/batches", "/history", "/alerts", "/settings"] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
