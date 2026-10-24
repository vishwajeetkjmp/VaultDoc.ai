import type { Metadata } from "next";
import SharedLink from "../../components/share/SharedLink";

// Shared links are private: keep them out of search engines and link previews
export const metadata: Metadata = {
  title: "Shared with you — VaultDocAI",
  robots: { index: false, follow: false },
};

/** Every /s/<link> address is served this one static page (see firebase.json); the link is read in the browser. */
export default function SharedLinkPage() {
  return <SharedLink />;
}
