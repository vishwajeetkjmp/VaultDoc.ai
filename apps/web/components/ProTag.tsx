import styles from "./proTag.module.css";

/** Gold asterisk and "Pro" label next to tools only Pro members can use (the same in every menu and card). */
export default function ProTag() {
  return (
    <>
      <span className={styles.mark} aria-hidden>
        *
      </span>
      <span className={styles.tag}>Pro</span>
    </>
  );
}
