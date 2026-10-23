import Navbar from "./Navbar";
import SiteFooter from "./SiteFooter";
import styles from "./site.module.css";

/** Navbar + centred content column + footer, for simple pages like About and Pricing. */
export default function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className={styles.main}>{children}</main>
      <SiteFooter />
    </>
  );
}
