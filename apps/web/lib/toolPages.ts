/**
 * Page content and behaviour for each free tool, keyed by tool id
 * (ids come from @vaultdocai/core). A tool without an entry here shows
 * "Coming soon".
 */
export type ToolKind =
  | { kind: "images-to-pdf" }
  | { kind: "merge" }
  | { kind: "organize"; focus: "reorder" | "rotate" | "remove" }
  | { kind: "office" }
  | { kind: "image-edit" };

export type ToolPage = ToolKind & {
  /** File picker filter */
  accept: string;
  /** Shown in the drop zone, e.g. "JPG, JPEG" */
  acceptLabel: string;
  multiple: boolean;
  heading: string;
  subheading: string;
  /** <title> and meta description for search engines */
  seoTitle: string;
  seoDescription: string;
  steps: [string, string, string];
  faq: { q: string; a: string }[];
  related: string[];
  /** Runs fully in the browser (shown as a privacy promise) */
  local: boolean;
};

const IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

const imagesToPdf = (fmt: string, ext: string): ToolPage => ({
  kind: "images-to-pdf",
  accept: IMAGE_ACCEPT,
  acceptLabel: `${fmt} (also JPG, PNG, WebP)`,
  multiple: true,
  heading: `${fmt} to PDF`,
  subheading: `Turn ${fmt} images into one PDF in seconds. Reorder, rotate, choose page size, and make it small enough for any upload portal.`,
  seoTitle: `${fmt} to PDF converter: free, fast, private | VaultDocAI`,
  seoDescription: `Convert ${fmt} to PDF free online. Combine multiple ${ext} files, choose A4 or Letter, add margins, and compress for upload portals. Files never leave your device.`,
  steps: [`Add your ${fmt} files`, "Arrange pages and pick options", "Download your PDF"],
  faq: [
    { q: "Are my images uploaded?", a: "No. Everything happens in your browser, so your images never leave your device." },
    { q: "Can I combine several images into one PDF?", a: "Yes. Add as many as you like, drag them into order, and each becomes a page." },
    {
      q: "My upload portal says the file is too big. What should I do?",
      a: "Turn on “Smaller file”. It reduces image resolution and quality just enough to keep documents readable while cutting the size a lot.",
    },
  ],
  related: ["merge-pdf", "rotate-pdf", "resize-crop-image"],
  local: true,
});

const ORGANIZE_IDS = { reorder: "reorder-pdf-pages", rotate: "rotate-pdf", remove: "remove-pdf-pages" } as const;

const organize = (
  focus: "reorder" | "rotate" | "remove",
  heading: string,
  subheading: string,
  seo: string,
): ToolPage => ({
  kind: "organize",
  focus,
  accept: ".pdf,application/pdf",
  acceptLabel: "PDF",
  multiple: false,
  heading,
  subheading,
  seoTitle: `${heading}: free online PDF tool | VaultDocAI`,
  seoDescription: seo,
  steps: ["Add your PDF", focus === "reorder" ? "Drag pages into order" : focus === "rotate" ? "Rotate the pages you need" : "Select pages to delete", "Download the new PDF"],
  faq: [
    { q: "Is my PDF uploaded?", a: "No. Pages are shown and edited in your browser; the file never leaves your device." },
    { q: "Will the text stay sharp?", a: "Yes. Pages are moved, rotated or removed as they are, without re-printing or lowering quality." },
    { q: "Does it work with password-protected PDFs?", a: "Not yet. Remove the password in your PDF reader first, then try again." },
  ],
  related: ["merge-pdf", ...Object.values(ORGANIZE_IDS)].filter((id) => id !== ORGANIZE_IDS[focus]),
  local: true,
});

const office = (fmt: string, ext: string): ToolPage => ({
  kind: "office",
  accept: ".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword",
  acceptLabel: `${ext} (Word .docx and .doc)`,
  multiple: false,
  heading: `${fmt} to PDF`,
  subheading: `Convert ${fmt} documents to PDF with layout, fonts and tables preserved.`,
  seoTitle: `${fmt} to PDF converter: keeps formatting | VaultDocAI`,
  seoDescription: `Convert ${ext} to PDF free. Keeps fonts, tables, headers and page breaks. Files are deleted right after conversion.`,
  steps: [`Add your ${ext} file`, "We convert it securely", "Download your PDF"],
  faq: [
    {
      q: "What happens to my document?",
      a: "It's sent over an encrypted connection to our converter in India, turned into a PDF, and deleted immediately. We don't store or read it.",
    },
    { q: "Will the formatting match Word?", a: "Very closely. Unusual fonts may be replaced with similar ones if they aren't embedded in the document." },
    { q: "Is there a size limit?", a: "Files up to 20 MB, and a few conversions per hour per visitor to keep the service fast for everyone." },
  ],
  related: ["merge-pdf", "jpg-to-pdf", "remove-pdf-pages"],
  local: false,
});

export const TOOL_PAGES: Record<string, ToolPage> = {
  "jpg-to-pdf": imagesToPdf("JPG", "JPG/JPEG"),
  "png-to-pdf": imagesToPdf("PNG", "PNG"),
  "webp-to-pdf": imagesToPdf("WebP", "WebP"),
  "word-to-pdf": office("Word", ".docx"),
  "doc-to-pdf": office("DOC", ".doc"),
  "merge-pdf": {
    kind: "merge",
    accept: ".pdf,application/pdf," + IMAGE_ACCEPT,
    acceptLabel: "PDF (images too)",
    multiple: true,
    heading: "Merge PDF",
    subheading: "Combine PDFs, and even photos, into a single PDF in the order you choose.",
    seoTitle: "Merge PDF files free online: fast and private | VaultDocAI",
    seoDescription: "Combine multiple PDFs and images into one PDF. Drag to reorder. Files never leave your device.",
    steps: ["Add PDFs or images", "Drag them into order", "Download one merged PDF"],
    faq: [
      { q: "Are my files uploaded?", a: "No. Merging happens in your browser; nothing is sent to a server." },
      { q: "Can I mix PDFs and photos?", a: "Yes. Each photo becomes a page, sized with your page-size and margin settings." },
      { q: "Is there a limit?", a: "No fixed limit. Very large files depend on your device's memory." },
    ],
    related: ["reorder-pdf-pages", "remove-pdf-pages", "jpg-to-pdf"],
    local: true,
  },
  "reorder-pdf-pages": organize(
    "reorder",
    "Reorder PDF pages",
    "See every page and drag them into the order you want.",
    "Rearrange PDF pages by dragging thumbnails. Free, fast, and your PDF never leaves your device.",
  ),
  "rotate-pdf": organize(
    "rotate",
    "Rotate PDF pages",
    "Fix sideways or upside-down pages: rotate one page or all of them.",
    "Rotate PDF pages free online. Turn single pages or the whole document. Your PDF never leaves your device.",
  ),
  "remove-pdf-pages": organize(
    "remove",
    "Remove PDF pages",
    "Select the pages you don't need and download a cleaner PDF.",
    "Delete pages from a PDF free online. Pick pages visually and download. Your PDF never leaves your device.",
  ),
  "resize-crop-image": {
    kind: "image-edit",
    accept: IMAGE_ACCEPT,
    acceptLabel: "JPG, PNG, WebP",
    multiple: false,
    heading: "Resize or crop an image",
    subheading: "Crop, resize, and shrink photos to an exact size in KB, perfect for exam, job and government forms.",
    seoTitle: "Resize image to KB, crop photo online: free | VaultDocAI",
    seoDescription: "Resize photos to 20 KB, 50 KB or any size. Crop to passport or square, change dimensions, convert to JPG, PNG or WebP. Images never leave your device.",
    steps: ["Add your photo", "Crop, resize or set a size limit", "Download"],
    faq: [
      { q: "Is my photo uploaded?", a: "No. All editing happens in your browser." },
      {
        q: "How do I make a photo under 50 KB?",
        a: "Choose “Under 50 KB”. We automatically find the best quality and size that fits.",
      },
      { q: "Which format should I use?", a: "JPG for photos and forms, PNG for screenshots or images with sharp text, WebP for the smallest files on the web." },
    ],
    related: ["jpg-to-pdf", "png-to-pdf", "merge-pdf"],
    local: true,
  },
};
