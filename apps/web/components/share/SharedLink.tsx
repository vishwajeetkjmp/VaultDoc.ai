"use client";

import { useEffect, useState } from "react";
import SharePage from "./SharePage";

/** Reads the link id from the address (/s/<link>) and shows the shared item. */
export default function SharedLink() {
  const [linkId, setLinkId] = useState<string | null>(null);
  useEffect(() => setLinkId(window.location.pathname.split("/").filter(Boolean)[1] ?? ""), []);
  if (linkId === null) return null;
  return <SharePage linkId={linkId} />;
}
