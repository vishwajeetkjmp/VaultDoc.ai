import Navbar from "./Navbar";
import styles from "./site.module.css";

/** Navbar + centred content column, for simple pages like About and Pricing. */
export default function SitePage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className={styles.main}>{children}</main>
    </>
  );
}
