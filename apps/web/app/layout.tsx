import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://urlpulse.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "URLPulse | URL Health Monitoring",
    template: "%s | URLPulse",
  },
  description:
    "URLPulse monitors the health of many URLs in the background and streams progress and results in real time.",
  applicationName: "URLPulse",
  authors: [{ name: "Niranjan Sah" }],
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-96x96.png", type: "image/png", sizes: "96x96" },
    ],
    shortcut: "/icons/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "URLPulse",
    title: "URLPulse | URL Health Monitoring",
    description: "Reliable background URL health checking with real-time progress.",
    url: siteUrl,
    images: [{ url: "/og/urlpulse-og.png", width: 1200, height: 630, alt: "URLPulse" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "URLPulse | URL Health Monitoring",
    description: "Reliable background URL health checking with real-time progress.",
    images: ["/og/urlpulse-og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

// Apply the stored theme before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem("urlpulse-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

/** Root layout: document + global providers only. Route groups add their own frames. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a href="#main-content" className="sr-only">
          Skip to content
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
