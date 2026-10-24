import type { MetadataRoute } from "next";
import { TOOL_PAGES } from "../lib/toolPages";

export const dynamic = "force-static";

const SITE = "https://vaultdocai.com";

/** Public pages and every live free tool (tools appear here automatically when they get a page). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: [string, number][] = [
    ["/", 1],
    ["/pricing", 0.8],
    ["/about", 0.6],
    ["/contact", 0.4],
    ["/privacy", 0.3],
    ["/terms", 0.3],
    ["/refunds", 0.3],
  ];
  return [
    ...pages.map(([path, priority]) => ({ url: `${SITE}${path}`, changeFrequency: "monthly" as const, priority })),
    ...Object.keys(TOOL_PAGES).map((id) => ({ url: `${SITE}/tools/${id}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
