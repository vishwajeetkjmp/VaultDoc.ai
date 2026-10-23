"use client";

import { useEffect, useState } from "react";
import styles from "./site.module.css";

/** One-time confirmation shown on the home page after an account is deleted. */
export default function AccountDeletedNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("accountDeleted") !== "1") return;
    setShow(true);
    window.history.replaceState(null, "", "/");
    const t = setTimeout(() => setShow(false), 6000);
    return () => clearTimeout(t);
  }, []);
  return show ? (
    <div className={styles.notice} role="status">
      Your account and all its data have been deleted.
    </div>
  ) : null;
}
