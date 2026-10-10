import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { CaptureResult } from "./types";

// Temporary storage directory
const STORAGE_DIR = process.env.STORAGE_DIR || "temp/captures";

// Retention period (in days)
export const RETENTION_PERIOD = parseInt(process.env.CAPTURE_RETENTION_DAYS || "7", 10);

/**
 * Ensure the storage directory exists
 */
export function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Generate a unique, safe filename
 */
export function generateSafeFilename(baseName: string, extension: string): string {
  const sanitized = baseName.replace(/[^a-zA-Z0-9-_]/g, "_");
  return `${sanitized}.${extension}`;
}

/**
 * Generate a content hash for deduplication
 */
export function generateContentHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex").substring(0, 16);
}

/**
 * Save a file to storage
 */
export function saveFile(filePath: string, content: Buffer | string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

/**
 * Save a capture to local storage
 */
export function saveCaptureToStorage(
  capture: CaptureResult,
  screenshots: { viewport?: Buffer; fullPage?: Buffer } = {}
): string {
  const captureDir = path.join(STORAGE_DIR, capture.id);
  const screenshotsDir = path.join(captureDir, "screenshots");
  const assetsDir = path.join(captureDir, "assets");

  // Ensure directories exist
  [captureDir, screenshotsDir, assetsDir].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Save manifest
  const manifestPath = path.join(captureDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(capture.manifest, null, 2));

  // Save page data
  const pagePath = path.join(captureDir, "page.json");
  const { assetFiles: _assetFiles, ...serializableCapture } = capture;
  fs.writeFileSync(pagePath, JSON.stringify(serializableCapture, null, 2));

  // Save screenshots
  if (capture.screenshot) {
    const viewportScreenshotPath = path.join(screenshotsDir, "viewport.png");
    if (screenshots.viewport) fs.writeFileSync(viewportScreenshotPath, screenshots.viewport);
  }

  if (capture.fullPageScreenshot) {
    const fullPageScreenshotPath = path.join(screenshotsDir, "full-page.png");
    if (screenshots.fullPage) fs.writeFileSync(fullPageScreenshotPath, screenshots.fullPage);
  }

  // Save assets
  for (const asset of capture.assets) {
    if (asset.localPath) {
      const assetPath = path.join(assetsDir, asset.fileName);
      const data = capture.assetFiles?.[asset.fileName];
      if (data) fs.writeFileSync(assetPath, Buffer.from(data, "base64"));
    }
  }

  // Save README
  const readmePath = path.join(captureDir, "README.md");
  fs.writeFileSync(readmePath, generateReadme(capture));

  return captureDir;
}

/**
 * Generate a README for the capture package
 */
function generateReadme(capture: CaptureResult): string {
  const date = new Date(capture.captureTimestamp).toLocaleString();
  const warnings = capture.warnings.length > 0 ? capture.warnings.slice(0, 5).join("\n- ") : "None";

  return [
    "# HTML-to-Figma Capture Package",
    "",
    "## Source Website",
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
    "The plugin reads page.json for element data and manifest.json for metadata.",
    "",
    "## Limitations",
    `- ${warnings}`,
  ].join("\n");
}

/**
 * Clean up old captures based on retention period
 */
export function cleanupOldCaptures(): void {
  if (!fs.existsSync(STORAGE_DIR)) return;

  const now = Date.now();
  const retentionMs = RETENTION_PERIOD * 24 * 60 * 60 * 1000;

  fs.readdirSync(STORAGE_DIR).forEach((item) => {
    const itemPath = path.join(STORAGE_DIR, item);
    try {
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory() && (now - stats.mtimeMs) > retentionMs) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore errors
    }
  });
}

/**
 * Get capture directory for an ID
 */
export function getCaptureDir(captureId: string): string {
  return path.join(STORAGE_DIR, captureId);
}

/** Get the local storage directory for a multi-page capture manifest. */
export function getBatchDir(batchId: string): string {
  return path.join(STORAGE_DIR, "batches", batchId);
}

/**
 * Get screenshot path
 */
export function getScreenshotPath(captureId: string, filename: string): string {
  return path.join(getCaptureDir(captureId), "screenshots", filename);
}

/**
 * Get assets directory
 */
export function getAssetsDir(captureId: string): string {
  return path.join(getCaptureDir(captureId), "assets");
}

/** Return saved captures and website packages, newest first, for the dashboard. */
export function listRecentCaptures(limit = 20): Array<{
  id: string; batchId?: string; originalUrl: string; state: "completed"; progress: string;
  errors: string[]; warnings: string[]; screenshotUrl: string; elapsedTime: number;
  startedAt: string; completedAt: string;
}> {
  if (!fs.existsSync(STORAGE_DIR)) return [];
  const items: ReturnType<typeof listRecentCaptures> = [];
  for (const entry of fs.readdirSync(STORAGE_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(STORAGE_DIR, entry.name);
    if (entry.name === "batches") {
      for (const batchEntry of fs.readdirSync(entryPath, { withFileTypes: true })) {
        if (!batchEntry.isDirectory()) continue;
        try {
          const batchId = batchEntry.name;
          const batch = JSON.parse(fs.readFileSync(path.join(entryPath, batchId, "batch.json"), "utf8")) as { pageCaptureIds: string[]; failures?: Array<{ error: string }> };
          const firstPath = path.join(getCaptureDir(batch.pageCaptureIds[0] || ""), "page.json");
          const capture = JSON.parse(fs.readFileSync(firstPath, "utf8")) as CaptureResult;
          items.push({ id: capture.id, batchId, originalUrl: capture.originalUrl, state: "completed", progress: `Captured ${batch.pageCaptureIds.length} page(s)`, errors: (batch.failures || []).map((failure) => failure.error), warnings: capture.warnings, screenshotUrl: `/api/captures/${capture.id}/screenshot`, elapsedTime: 0, startedAt: capture.captureTimestamp, completedAt: capture.captureTimestamp });
        } catch { /* Ignore incomplete or expired package metadata. */ }
      }
      continue;
    }
    try {
      const capture = JSON.parse(fs.readFileSync(path.join(entryPath, "page.json"), "utf8")) as CaptureResult;
      items.push({ id: capture.id, originalUrl: capture.originalUrl, state: "completed", progress: "Capture complete", errors: capture.errors, warnings: capture.warnings, screenshotUrl: `/api/captures/${capture.id}/screenshot`, elapsedTime: 0, startedAt: capture.captureTimestamp, completedAt: capture.captureTimestamp });
    } catch { /* Ignore incomplete captures. */ }
  }
  return items.sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, Math.max(1, limit));
}
