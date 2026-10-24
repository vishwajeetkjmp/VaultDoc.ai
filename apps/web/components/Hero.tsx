import Link from "next/link";
import HeroBackground from "./hero/HeroBackground";
import HeroPrimaryButton from "./HeroPrimaryButton";
import InstallSheet from "./InstallSheet";
import ToolCards from "./home/ToolCards";
import styles from "./home/hero.module.css";

/** Home hero (headline above the animation on laptops, below it on phones; see hero.module.css), then the free tools. */
export default function Hero() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.badgeRow}>
          <span className={styles.badge}>🔒 Private to your account</span>
        </div>

        <div className={styles.copy}>
          <h1 className={styles.title}>A secure and intelligent space for your private documents</h1>
          <p className={styles.lead}>
            A secure, intelligent home for your contracts, reports, invoices and research. Ask questions and get answers from your own files.
          </p>
        </div>

        {/* Robot-and-vault animation on its own row, so it never runs through the text */}
        <div className={styles.animation}>
          <HeroBackground />
        </div>

        <div className={styles.actions}>
          <HeroPrimaryButton className={styles.primary} />
          <Link href="/about" className={styles.secondary}>
            Learn more
          </Link>
        </div>
      </section>
      <ToolCards />
      <InstallSheet />
    </>
  );
}
