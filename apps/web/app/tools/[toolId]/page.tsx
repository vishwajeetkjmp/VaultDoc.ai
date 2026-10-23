import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SitePage from "../../../components/SitePage";
import styles from "../../../components/site.module.css";
import { getFreeTools, getTool, isComingSoon } from "../../../lib/tools";

export function generateStaticParams() {
  return getFreeTools().map((t) => ({ toolId: t.id }));
}

export function generateMetadata({ params }: { params: { toolId: string } }): Metadata {
  const tool = getTool(params.toolId);
  return { title: tool ? `${tool.name} — VaultDocAI` : "Tool — VaultDocAI" };
}

/** Landing spot for each free tool; shows "coming soon" until the tool is built. */
export default function ToolPage({ params }: { params: { toolId: string } }) {
  const tool = getTool(params.toolId);
  if (!tool) notFound();

  return (
    <SitePage>
      <span className={styles.eyebrow}>Free tool</span>
      <h1 className={styles.title}>{tool.name}</h1>
      {isComingSoon(tool) && (
        <>
          <p className={styles.lead}>
            This free tool is coming soon. It will work right in your browser, with no sign-up needed.
          </p>
          <div className={styles.section} style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/" className={styles.buttonGhost}>
              Back to home
            </a>
            <a href="/signup" className={styles.button}>
              Try VaultDocAI free
            </a>
          </div>
        </>
      )}
    </SitePage>
  );
}
