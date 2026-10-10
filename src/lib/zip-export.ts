import JSZip from "jszip";
import fs from "node:fs";
import path from "node:path";
import { getAssetsDir, getScreenshotPath } from "./storage";
import type { CaptureResult } from "./types";

/**
 * Generate a unique, safe filename
 */
export function generateSafeFilename(baseName: string, extension: string): string {
  const sanitized = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${sanitized}.${extension}`;
}

/**
 * Create the ZIP export for a capture result
 */
export async function createCaptureZip(capture: CaptureResult): Promise<Buffer> {
  const zip = new JSZip();

  // Add manifest
  zip.file("manifest.json", JSON.stringify(capture.manifest, null, 2));

  // Add page metadata
  zip.file("page.json", JSON.stringify(capture, null, 2));

  // Add screenshots
  if (capture.screenshot) {
    const screenshotPath = getScreenshotPath(capture.id, "viewport.png");
    if (fs.existsSync(screenshotPath)) zip.file("screenshots/viewport.png", fs.readFileSync(screenshotPath));
  }
  if (capture.fullPageScreenshot) {
    const screenshotPath = getScreenshotPath(capture.id, "full-page.png");
    if (fs.existsSync(screenshotPath)) zip.file("screenshots/full-page.png", fs.readFileSync(screenshotPath));
  }

  // Add assets
  for (const asset of capture.assets) {
    if (asset.localPath && asset.fileName) {
      const assetPath = path.join(getAssetsDir(capture.id), path.basename(asset.fileName));
      if (fs.existsSync(assetPath)) zip.file(`assets/${path.basename(asset.fileName)}`, fs.readFileSync(assetPath));
    }
  }

  // Add README
  zip.file("README.md", generateReadme(capture));

  // Generate ZIP file
  const zipBlob = await zip.generateAsync({ type: "nodebuffer" });

  // `jszip` resolves `type: "nodebuffer"` to a Uint8Array. Node's `Buffer`
  // accepts that and NextResponse treats a Buffer-like as BodyInit.
  return zipBlob;
}

/**
 * Generate a README for the capture package
 */
function generateReadme(capture: CaptureResult): string {
  const date = new Date(capture.captureTimestamp).toLocaleString();
  const lines = [
    "# HTML-to-Figma Capture Package",
    "",
    `## Source Website`,
    `- Original URL: ${capture.originalUrl}`,
    `- Final URL: ${capture.finalUrl}`,
    `- Title: ${capture.pageMetadata.title || "N/A"}`,
    `- Captured: ${date}`,
    "",
    "## Package Contents",
    `- manifest.json: Capture metadata and manifest`,
    `- page.json: Normalized page elements and metadata`,
    `- screenshots/: Page screenshots`,
    `- assets/: Downloaded assets (images, fonts, etc.)`,
    "",
    "## Usage",
    "This package is designed for import by a Figma plugin.",
    "The plugin reads `page.json` for element data and `manifest.json` for metadata.",
    "",
    "## Limitations",
    `${capture.warnings.length > 0 ? capture.warnings.slice(0, 5).join("\n- ") : "None"}${capture.warnings.length > 5 ? `\n- ... and ${capture.warnings.length - 5} more warnings` : ""}`,
  ];

  return lines.join("\n");
}
