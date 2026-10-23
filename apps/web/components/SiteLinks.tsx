"use client";

import Link from "next/link";
import ToolDropdown from "./ToolDropdown";
import styles from "./navbar.module.css";

/** Free tools, Pricing and About for the My Files and Vault top bars, so the rest of the site is one click away. */
export default function SiteLinks() {
  return (
    <div className={styles.siteLinks}>
      <ToolDropdown />
      <Link href="/pricing" className={styles.link}>
        Pricing
      </Link>
      <Link href="/about" className={styles.link}>
        About
      </Link>
    </div>
  );
}
