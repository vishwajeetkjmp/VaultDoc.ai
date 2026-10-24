import type { Metadata } from "next";
import Navbar from "../../components/Navbar";
import SiteFooter from "../../components/SiteFooter";
import PricingFaq from "../../components/pricing/PricingFaq";
import PricingPlans from "../../components/pricing/PricingPlans";
import styles from "../../components/pricing/pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing — VaultDocAI",
  description: "Start free with 1 GB of private document storage and a Secure Vault.",
};

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.heading}>Pricing</h1>
          <p className={styles.sub}>Start free. Upgrade when you need AI answers, more space, or a shared vault.</p>
        </header>
        <PricingPlans />
        <PricingFaq />
      </main>
      <SiteFooter />
    </>
  );
}
