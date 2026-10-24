import type { MetadataRoute } from "next";

export const dynamic = "force-static";

/**
 * Search engines may list the public pages; private areas and shared links stay out.
 * (While testing, firebase.json also sends "X-Robots-Tag: noindex" on every page; removing that header
 * on launch day is what lets Google list the site. See docs/operations.md, "Launch day".)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/vault", "/account", "/s/", "/login", "/signup", "/reset-password"] },
    sitemap: "https://vaultdocai.com/sitemap.xml",
    host: "https://vaultdocai.com",
  };
}
