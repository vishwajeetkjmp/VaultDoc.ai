import Link from "next/link";
import styles from "./site.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <span>© {new Date().getFullYear()} VaultDocAI</span>
      <Link href="/about">About</Link>
      <Link href="/pricing">Pricing</Link>
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
    </footer>
  );
}
