import { ITool } from "./ITool";

/**
 * Free tools listed in the site menu. Each implements the ITool contract;
 * the web app supplies the UI for each id.
 */
const pdfTool = (id: string, name: string, description: string, icon: string): ITool => ({
  id,
  name,
  description,
  icon,
  category: "Free Tool",
  group: "PDF tools",
  route: `/tools/${id}`,
});

export const JpgToPdfTool = pdfTool("jpg-to-pdf", "JPG to PDF", "Turn photos and scans into a PDF", "image");
export const PngToPdfTool = pdfTool("png-to-pdf", "PNG to PDF", "Convert PNG images into a PDF", "image");
export const WebpToPdfTool = pdfTool("webp-to-pdf", "WebP to PDF", "Convert WebP images into a PDF", "image");
export const WordToPdfTool = pdfTool("word-to-pdf", "Word to PDF", "Convert .docx documents to PDF", "doc");
export const DocToPdfTool = pdfTool("doc-to-pdf", "DOC to PDF", "Convert older .doc files to PDF", "doc");
export const MergePdfTool = pdfTool("merge-pdf", "Merge PDF", "Combine PDFs and images into one", "merge");
export const ReorderPdfTool = pdfTool("reorder-pdf-pages", "Reorder PDF pages", "Drag pages into a new order", "reorder");
export const RotatePdfTool = pdfTool("rotate-pdf", "Rotate PDF pages", "Fix sideways or upside-down pages", "rotate");
export const RemovePdfPagesTool = pdfTool("remove-pdf-pages", "Remove PDF pages", "Delete pages you don't need", "remove");
export const EditPdfTool = pdfTool("edit-pdf", "Edit PDF", "Add text, sign, white out and redact", "edit");

export const ResizeCropImageTool: ITool = {
  id: "resize-crop-image",
  name: "Resize or crop an image",
  description: "Crop, resize, or shrink a photo to any KB size",
  icon: "image",
  category: "Free Tool",
  group: "Image tools",
  route: "/tools/resize-crop-image",
};

export const FREE_TOOLS: ITool[] = [
  JpgToPdfTool,
  PngToPdfTool,
  WebpToPdfTool,
  WordToPdfTool,
  DocToPdfTool,
  MergePdfTool,
  ReorderPdfTool,
  RotatePdfTool,
  RemovePdfPagesTool,
  EditPdfTool,
  ResizeCropImageTool,
];
