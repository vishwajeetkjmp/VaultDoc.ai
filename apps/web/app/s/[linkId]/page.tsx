import type { Metadata } from "next";
import SharePage from "../../../components/share/SharePage";

// Shared links are private: keep them out of search engines and link previews
export const metadata: Metadata = {
  title: "Shared with you — VaultDocAI",
  robots: { index: false, follow: false },
};

export default function SharedLinkPage({ params }: { params: { linkId: string } }) {
  return <SharePage linkId={params.linkId} />;
}
