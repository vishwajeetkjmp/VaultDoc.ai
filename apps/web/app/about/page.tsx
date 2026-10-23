import type { Metadata } from "next";
import Link from "next/link";
import SitePage from "../../components/SitePage";
import HeroPrimaryButton from "../../components/HeroPrimaryButton";
import styles from "../../components/site.module.css";

export const metadata: Metadata = {
  title: "About — VaultDocAI",
  description: "VaultDocAI keeps your documents private and helps you understand them.",
};

const FEATURES = [
  {
    icon: "📁",
    title: "My Space",
    text: "Upload PDFs, Word, Excel, images and ZIPs. Organise them in folders and find anything fast. Each account's files are private to that account.",
  },
  {
    icon: "🔐",
    title: "Secure Vault",
    text: "For your most sensitive papers. Files are encrypted on your device before upload, so nobody else can open them, including the VaultDoc team.",
  },
  {
    icon: "✨",
    title: "AI answers (coming soon)",
    text: "Ask questions in plain language about your documents and get answers that point to the exact page.",
  },
];

export default function AboutPage() {
  return (
    <SitePage>
      <span className={styles.eyebrow}>About VaultDocAI</span>
      <h1 className={styles.title}>Your documents, private and understood.</h1>
      <p className={styles.lead}>
        Contracts, bills, policies, ID papers. Most of us keep them scattered across email, WhatsApp and downloads.
        VaultDocAI gives them one secure home and, soon, helps you understand what&apos;s inside.
      </p>

      <section className={styles.section}>
        <h2 className={styles.h2}>What you get</h2>
        <div className={styles.grid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.card}>
              <div className={styles.cardIcon} aria-hidden>
                {f.icon}
              </div>
              <div className={styles.cardTitle}>{f.title}</div>
              <p className={styles.cardText}>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>How we protect your data</h2>
        <ul className={styles.list}>
          <li>Every account&apos;s files are isolated; security rules on our servers block access to anyone else&apos;s.</li>
          <li>Files are stored in Google Cloud in India (Delhi region).</li>
          <li>Secure Vault files are end-to-end encrypted: only your devices hold the key.</li>
          <li>You can delete any file or folder at any time, and it&apos;s removed from storage.</li>
        </ul>
      </section>

      <section className={styles.section} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <HeroPrimaryButton className={styles.button} />
        <Link href="/pricing" className={styles.buttonGhost}>
          See pricing
        </Link>
      </section>
    </SitePage>
  );
}
