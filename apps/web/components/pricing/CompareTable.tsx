import { Cell, COMPARE } from "../../lib/pricingDetails";
import type { PlanTab } from "../../lib/plans";
import styles from "./pricing.module.css";

/** "Compare features across plans": one column per plan of the tab, rows grouped into sections. */
export default function CompareTable({ tab }: { tab: PlanTab }) {
  const sections = COMPARE[tab.id];
  if (!sections) return null;

  return (
    <section className={styles.compare} aria-labelledby="compare-heading">
      <h2 id="compare-heading" className={styles.sectionHeading}>
        Compare features across plans
      </h2>
      <div className={styles.compareScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.rowLabel}>
                <span className={styles.srOnly}>Feature</span>
              </th>
              {tab.plans.map((p) => (
                <th key={p.id} scope="col" className={styles.colHead}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          {sections.map((s) => (
            <tbody key={s.title}>
              <tr>
                <th scope="colgroup" colSpan={tab.plans.length + 1} className={styles.tableSection}>
                  {s.title}
                </th>
              </tr>
              {s.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className={styles.rowLabel}>
                    {r.label}
                  </th>
                  {tab.plans.map((p) => (
                    <td key={p.id} className={styles.cell}>
                      <CellValue value={r.values[p.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

function CellValue({ value }: { value: Cell | undefined }) {
  if (value === true) {
    return (
      <>
        <svg className={styles.yes} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
        <span className={styles.srOnly}>Included</span>
      </>
    );
  }
  if (value === false || value === undefined) {
    return (
      <>
        <span className={styles.no} aria-hidden>
          –
        </span>
        <span className={styles.srOnly}>Not included</span>
      </>
    );
  }
  return <>{value}</>;
}
