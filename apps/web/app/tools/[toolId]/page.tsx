import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "../../../components/Navbar";
import SiteFooter from "../../../components/SiteFooter";
import ToolWorkspace from "../../../components/tools/ToolWorkspace";
import styles from "../../../components/tools/tools.module.css";
import { TOOL_PAGES, WORD_TRIAL_PER_DAY } from "../../../lib/toolPages";
import { getFreeTools, getTool } from "../../../lib/tools";

export function generateStaticParams() {
  return getFreeTools().map((t) => ({ toolId: t.id }));
}

export function generateMetadata({ params }: { params: { toolId: string } }): Metadata {
  const page = TOOL_PAGES[params.toolId];
  const tool = getTool(params.toolId);
  if (!page || !tool) return { title: "Tool — VaultDocAI" };
  return { title: page.seoTitle, description: page.seoDescription, alternates: { canonical: tool.route } };
}

/** One page per free tool: the tool itself, then how it works, FAQ and related tools. */
export default function ToolPage({ params }: { params: { toolId: string } }) {
  const tool = getTool(params.toolId);
  const page = TOOL_PAGES[params.toolId];
  if (!tool || !page) notFound();

  // FAQ as structured data, so search engines can show it as rich results
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <section className={styles.hero}>
          <h1 className={styles.title}>{page.heading}</h1>
          <p className={styles.subtitle}>{page.subheading}</p>
          <span className={styles.badge}>
            {page.local ? "🔒 Private: files never leave your device" : "🔒 Encrypted upload, deleted right after conversion"}
            {
              {
                open: " · Free · No sign-up",
                "word-trial": ` · Free · ${WORD_TRIAL_PER_DAY} a day without sign-up`,
                account: " · Free with an account",
                pro: " · Pro",
              }[page.access]
            }
          </span>
        </section>

        <section className={styles.workspace} aria-label={page.heading}>
          <ToolWorkspace page={page} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>How it works</h2>
          <div className={styles.steps}>
            {page.steps.map((s, i) => (
              <div key={s} className={styles.step}>
                <div className={styles.stepNumber}>{i + 1}</div>
                <div className={styles.stepText}>{s}</div>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Questions</h2>
          <div className={styles.faq}>
            {page.faq.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>More free tools</h2>
          <div className={styles.related}>
            {page.related
              .map((id) => getTool(id))
              .filter((t): t is NonNullable<typeof t> => !!t)
              .map((t) => (
                <Link key={t.id} href={t.route} className={styles.relatedItem}>
                  <div className={styles.relatedName}>{t.name}</div>
                  <div className={styles.relatedDesc}>{t.description}</div>
                </Link>
              ))}
          </div>
        </section>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      </main>
      <SiteFooter />
    </>
  );
}
