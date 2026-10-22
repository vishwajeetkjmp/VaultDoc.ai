import { ITool } from "./ITool";

/**
 * Concrete tools — metadata only in Phase 1 (no execution logic yet).
 * Each implements the ITool contract.
 */

export const ConvertToPdfTool: ITool = {
  id: "convert-to-pdf",
  name: "Convert to PDF",
  category: "Free Tool",
  route: "/tools/convert-to-pdf",
  icon: "file",
};

export const ResizeCropImageTool: ITool = {
  id: "resize-crop-image",
  name: "Resize or crop an image",
  category: "Free Tool",
  route: "/tools/resize-crop-image",
  icon: "image",
};