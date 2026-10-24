"use client";

import { useState } from "react";
import { FAQ } from "../../lib/pricingDetails";
import Tabs from "./Tabs";
import styles from "./pricing.module.css";

/** FAQ: tabs for the groups, then questions that open and close (several can be open at once). */
export default function PricingFaq() {
  const [groupId, setGroupId] = useState(FAQ[0].id);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const group = FAQ.find((g) => g.id === groupId) ?? FAQ[0];

  function toggle(q: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  }

  return (
    <section className={styles.faq} aria-labelledby="faq-heading">
      <h2 id="faq-heading" className={styles.sectionHeading}>
        FAQ
      </h2>
      <Tabs label="Question topics" idPrefix="faq" tabs={FAQ} value={group.id} onChange={setGroupId} />
      <div id="faq-panel" role="tabpanel" aria-labelledby={`faq-tab-${group.id}`} className={styles.faqList}>
        <h3 className={styles.faqGroupTitle}>{group.label}</h3>
        {group.items.map((item, i) => {
          const isOpen = open.has(item.q);
          const id = `faq-${group.id}-${i}`;
          return (
            <div key={item.q} className={isOpen ? styles.faqItemOpen : styles.faqItem}>
              <h4 className={styles.faqQuestionWrap}>
                <button type="button" className={styles.faqTrigger} aria-expanded={isOpen} aria-controls={id} onClick={() => toggle(item.q)}>
                  <span className={styles.faqQuestion}>{item.q}</span>
                  <span className={styles.faqIcon} aria-hidden>
                    <span className={styles.faqIconLine} />
                    <span className={styles.faqIconLineVertical} />
                  </span>
                </button>
              </h4>
              <div id={id} role="region" className={styles.faqContent} inert={!isOpen}>
                <div className={styles.faqContentInner}>
                  <p className={styles.faqAnswer}>{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
