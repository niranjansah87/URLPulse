import type { ReactNode } from "react";

/** Public marketing frame (no app sidebar). The landing page renders its own header/footer. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <div id="main-content">{children}</div>;
}
