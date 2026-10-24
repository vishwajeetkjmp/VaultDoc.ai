import Link from "next/link";
import type { Metadata } from "next";
import SitePage from "../../components/SitePage";
import styles from "../../components/site.module.css";
import { CONTACT_EMAIL } from "../../lib/contact";

export const metadata: Metadata = { title: "Contact — VaultDocAI" };

const link = { color: "var(--primary)" };

export default function ContactPage() {
  return (
    <SitePage>
      <span className={styles.eyebrow}>Contact</span>
      <h1 className={styles.title} style={{ fontSize: 34 }}>
        Get in touch
      </h1>
      <div className={styles.legal}>
        <p>We usually reply within 1–2 working days.</p>

        <h2>Email</h2>
        <p>
          <a href={`mailto:${CONTACT_EMAIL}`} style={link}>
            {CONTACT_EMAIL}
          </a>
          <br />
          For payments, include the payment ID from your receipt or <Link href="/account" style={link}>Account</Link> page.
        </p>

        <h2>Address</h2>
        <p>
          VaultDocAI (operated by Vishwajeet Kumar)
          <br />
          Sector-168, Noida
          <br />
          Uttar Pradesh 201305, India
        </p>

        <h2>Policies</h2>
        <p>
          <Link href="/terms" style={link}>Terms of Service</Link> · <Link href="/privacy" style={link}>Privacy Policy</Link> ·{" "}
          <Link href="/refunds" style={link}>Refund and cancellation policy</Link>
        </p>
      </div>
    </SitePage>
  );
}
