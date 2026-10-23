import type { Metadata } from "next";
import SitePage from "../../components/SitePage";
import styles from "../../components/site.module.css";

export const metadata: Metadata = {
  title: "Pricing — VaultDocAI",
  description: "Start free with 1 GB of private document storage and a Secure Vault.",
};

export default function PricingPage() {
  return (
    <SitePage>
      <span className={styles.eyebrow}>Pricing</span>
      <h1 className={styles.title}>Start free. Upgrade when you need more.</h1>
      <p className={styles.lead}>Everything below is available today on the free plan.</p>

      <section className={styles.section}>
        <div className={styles.grid}>
          <div className={styles.planFeatured}>
            <div className={styles.planName}>Free</div>
            <div className={styles.price}>₹0</div>
            <div className={styles.priceNote}>No card needed</div>
            <ul className={styles.features}>
              <li>✅ 1 GB of private storage</li>
              <li>✅ Files up to 20 MB each</li>
              <li>✅ Folders, search, drag &amp; drop upload</li>
              <li>✅ ZIP upload, unpacked into folders</li>
              <li>✅ Secure Vault with end-to-end encryption</li>
              <li>✅ Works on phone and desktop</li>
            </ul>
            <a href="/signup" className={styles.button}>
              Get started free
            </a>
          </div>

          <div className={styles.plan}>
            <div className={styles.planName}>Pro</div>
            <div className={styles.price} style={{ fontSize: 28 }}>
              Coming soon
            </div>
            <div className={styles.priceNote}>Pricing to be announced</div>
            <ul className={styles.features}>
              <li>✨ AI answers about your documents</li>
              <li>📦 More storage and bigger files</li>
              <li>⏰ Reminders for expiring documents</li>
              <li>👨‍👩‍👧 Shared family vault</li>
            </ul>
            <span className={styles.buttonGhost} aria-disabled style={{ opacity: 0.7, cursor: "default" }}>
              Not available yet
            </span>
          </div>
        </div>
      </section>
    </SitePage>
  );
}
