"use client";

import dynamic from "next/dynamic";
import type { ToolPage } from "../../lib/toolPages";
import LoginRequired from "./LoginRequired";
import styles from "./tools.module.css";

// Each tool's code loads only on its own page
const loading = () => <div className={styles.drop} aria-busy="true" />;
const PdfBuilder = dynamic(() => import("./PdfBuilder"), { ssr: false, loading });
const PdfOrganizer = dynamic(() => import("./PdfOrganizer"), { ssr: false, loading });
const ImageEditor = dynamic(() => import("./ImageEditor"), { ssr: false, loading });
const OfficeConverter = dynamic(() => import("./OfficeConverter"), { ssr: false, loading });

export default function ToolWorkspace({ page }: { page: ToolPage }) {
  const tool = <Workspace page={page} />;
  return page.loginRequired ? (
    <LoginRequired toolName={page.heading} local={page.local}>
      {tool}
    </LoginRequired>
  ) : (
    tool
  );
}

function Workspace({ page }: { page: ToolPage }) {
  switch (page.kind) {
    case "images-to-pdf":
      return <PdfBuilder mode="images" accept={page.accept} acceptLabel={page.acceptLabel} />;
    case "merge":
      return <PdfBuilder mode="merge" accept={page.accept} acceptLabel={page.acceptLabel} />;
    case "organize":
      return <PdfOrganizer focus={page.focus} />;
    case "image-edit":
      return <ImageEditor />;
    case "office":
      return <OfficeConverter accept={page.accept} acceptLabel={page.acceptLabel} />;
  }
}
