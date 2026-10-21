import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "node:os";
import { del, get, list, put } from "@vercel/blob";
import type { CaptureResult } from "./types";
import type { FlowRecord } from "./flow-types";

// Temporary storage directory
const STORAGE_DIR = process.env.STORAGE_DIR || (process.env.VERCEL
  ? path.join(os.tmpdir(), "html-to-figma", "captures")
  : "temp/captures");
const BLOB_PREFIX = "html-to-figma/captures";

// Retention period (in days)
export const RETENTION_PERIOD = parseInt(process.env.CAPTURE_RETENTION_DAYS || "7", 10);
type RecentCapture = {
  id: string; batchId?: string; originalUrl: string; state: "pending" | "running" | "completed" | "failed"; progress: string;
  errors: string[]; warnings: string[]; screenshotUrl: string | null; elapsedTime: number;
  startedAt: string; completedAt: string;
};

/**
 * Ensure the storage directory exists
 */
export function ensureStorageDir(): void {
  if (useBlobStorage()) return;
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
export async function saveCaptureToStorage(
  capture: CaptureResult,
  screenshots: { viewport?: Buffer; fullPage?: Buffer } = {}
): Promise<string> {
  const captureDir = path.join(STORAGE_DIR, capture.id);

  const { assetFiles: _assetFiles, ...serializableCapture } = capture;
  const files: Array<{ path: string; body: Buffer | string; contentType?: string }> = [
    { path: `${capture.id}/manifest.json`, body: JSON.stringify(capture.manifest, null, 2), contentType: "application/json" },
    { path: `${capture.id}/page.json`, body: JSON.stringify(serializableCapture, null, 2), contentType: "application/json" },
    { path: `${capture.id}/README.md`, body: generateReadme(capture), contentType: "text/markdown; charset=utf-8" },
  ];
  if (screenshots.viewport) files.push({ path: `${capture.id}/screenshots/viewport.png`, body: screenshots.viewport, contentType: "image/png" });
  if (screenshots.fullPage) files.push({ path: `${capture.id}/screenshots/full-page.png`, body: screenshots.fullPage, contentType: "image/png" });
  for (const asset of capture.assets) {
    if (asset.localPath) {
      const data = capture.assetFiles?.[asset.fileName];
      if (data) files.push({ path: `${capture.id}/assets/${path.basename(asset.fileName)}`, body: Buffer.from(data, "base64"), contentType: asset.mimeType || "application/octet-stream" });
    }
  }
  await writeStoredFiles(files);

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
export async function cleanupOldCaptures(): Promise<void> {
  if (useBlobStorage()) {
    const blobs = await listAllBlobFiles();
    const latestByFolder = new Map<string, number>();
    const folderOf = (pathname: string) => {
      const parts = pathname.slice(`${BLOB_PREFIX}/`.length).split("/");
      return NESTED_FOLDERS.has(parts[0]) ? `${parts[0]}/${parts[1]}` : parts[0];
    };
    for (const blob of blobs) {
      const folder = folderOf(blob.pathname);
      latestByFolder.set(folder, Math.max(latestByFolder.get(folder) || 0, blob.uploadedAt.getTime()));
    }
    const cutoff = Date.now() - RETENTION_PERIOD * 24 * 60 * 60 * 1000;
    const expired = blobs.filter((blob) => latestByFolder.get(folderOf(blob.pathname))! < cutoff);
    if (expired.length) await del(expired.map((blob) => blob.pathname));
    return;
  }
  if (!fs.existsSync(STORAGE_DIR)) return;

  const now = Date.now();
  const retentionMs = RETENTION_PERIOD * 24 * 60 * 60 * 1000;
  const cutoff = now - retentionMs;

  // Capture folders are direct children of STORAGE_DIR. Batch and flow
  // manifests live one level deeper, so clean each one independently instead
  // of relying on the parent directory's timestamp.
  for (const item of fs.readdirSync(STORAGE_DIR, { withFileTypes: true })) {
    const itemPath = path.join(STORAGE_DIR, item.name);
    try {
      if (!item.isDirectory()) continue;
      if (NESTED_FOLDERS.has(item.name)) {
        for (const nested of fs.readdirSync(itemPath, { withFileTypes: true })) {
          if (!nested.isDirectory()) continue;
          const nestedPath = path.join(itemPath, nested.name);
          if (latestModified(nestedPath) < cutoff) {
            fs.rmSync(nestedPath, { recursive: true, force: true });
          }
        }
        continue;
      }
      if (fs.statSync(itemPath).mtimeMs < cutoff) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      }
    } catch {
      // A concurrent capture or filesystem cleanup should not fail a request.
    }
  }
}

/** Folders whose children are independent packages with their own retention clock. */
const NESTED_FOLDERS = new Set(["batches", "flows", "figma"]);

function latestModified(dirPath: string): number {
  let latest = fs.statSync(dirPath).mtimeMs;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isFile()) latest = Math.max(latest, fs.statSync(path.join(dirPath, entry.name)).mtimeMs);
  }
  return latest;
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

/** Persist a batch manifest in the same backend as its page captures. */
export async function saveBatchManifest(batchId: string, value: unknown): Promise<void> {
  await writeStoredFile(`batches/${batchId}/batch.json`, JSON.stringify(value, null, 2), "application/json");
}

/** Read a stored package file from local disk or the connected private Blob store. */
export async function readStoredFile(relativePath: string): Promise<Buffer | null> {
  if (useBlobStorage()) {
    const result = await get(blobPath(relativePath), { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }
  const filePath = path.join(STORAGE_DIR, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}

export async function readCapture(captureId: string): Promise<CaptureResult | null> {
  const data = await readStoredFile(`${captureId}/page.json`);
  return data ? JSON.parse(data.toString("utf8")) as CaptureResult : null;
}

export type BatchManifest = {
  id?: string;
  originalUrl?: string;
  status?: "pending" | "running" | "completed" | "failed";
  progress?: string;
  pageCaptureIds: string[];
  completedLayouts?: string[];
  failures?: Array<{ url: string; error: string }>;
  createdAt?: string;
  completedAt?: string;
};

export type FigmaImportTicket = {
  captureIds: string[];
  /** When set, the ticket exports this recorded flow instead of standalone captures. */
  flowId?: string;
  expiresAt: string;
};

export async function saveFlow(flow: FlowRecord): Promise<void> {
  await writeStoredFile(`flows/${flow.id}/flow.json`, JSON.stringify(flow, null, 2), "application/json");
}

export async function readFlow(flowId: string): Promise<FlowRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(flowId)) return null;
  const data = await readStoredFile(`flows/${flowId}/flow.json`);
  return data ? JSON.parse(data.toString("utf8")) as FlowRecord : null;
}

/** Return recorded flows, most recently updated first. */
export async function listFlows(limit = 50): Promise<FlowRecord[]> {
  const ids = new Set<string>();
  if (useBlobStorage()) {
    for (const blob of await listAllBlobFiles("flows/")) {
      const parts = blob.pathname.slice(`${BLOB_PREFIX}/`.length).split("/");
      if (parts[2] === "flow.json") ids.add(parts[1]);
    }
  } else {
    const flowsDir = path.join(STORAGE_DIR, "flows");
    if (fs.existsSync(flowsDir)) {
      for (const entry of fs.readdirSync(flowsDir, { withFileTypes: true })) if (entry.isDirectory()) ids.add(entry.name);
    }
  }
  const flows: FlowRecord[] = [];
  for (const id of ids) {
    try {
      const flow = await readFlow(id);
      if (flow) flows.push(flow);
    } catch { /* Ignore partial flow metadata. */ }
  }
  return flows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, Math.max(1, limit));
}

/** Delete a flow and every step capture it owns. */
export async function deleteFlow(flow: FlowRecord): Promise<void> {
  for (const step of flow.steps) await deleteCaptureProject(step.captureId);
  const prefix = `flows/${flow.id}/`;
  if (useBlobStorage()) {
    const blobs = await listAllBlobFiles(prefix);
    if (blobs.length) await del(blobs.map((blob) => blob.pathname));
    return;
  }
  fs.rmSync(path.join(STORAGE_DIR, "flows", flow.id), { recursive: true, force: true });
}

export async function saveFigmaImportTicket(token: string, value: FigmaImportTicket): Promise<void> {
  await writeStoredFile(`figma/tickets/${token}.json`, JSON.stringify(value), "application/json");
}

export async function readFigmaImportTicket(token: string): Promise<FigmaImportTicket | null> {
  const data = await readStoredFile(`figma/tickets/${token}.json`);
  return data ? JSON.parse(data.toString("utf8")) as FigmaImportTicket : null;
}

export async function readBatchManifest(batchId: string): Promise<BatchManifest | null> {
  const data = await readStoredFile(`batches/${batchId}/batch.json`);
  return data ? JSON.parse(data.toString("utf8")) as BatchManifest : null;
}

/** Delete one recent project, including every page that belongs to a batch. */
export async function deleteCaptureProject(captureId: string, batchId?: string): Promise<boolean> {
  const batch = batchId ? await readBatchManifest(batchId) : null;
  if (batchId && !batch) return false;
  const captureIds = (batch ? batch.pageCaptureIds : [captureId]).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const paths = [...captureIds.map((id) => `${id}/`), ...(batchId ? [`batches/${batchId}/`] : [])];

  if (useBlobStorage()) {
    const blobs = (await Promise.all(paths.map((prefix) => listAllBlobFiles(prefix)))).flat();
    if (blobs.length === 0) return false;
    await del(blobs.map((blob) => blob.pathname));
    return true;
  }

  let deleted = false;
  for (const relativePath of paths) {
    const target = path.resolve(STORAGE_DIR, relativePath);
    const root = path.resolve(STORAGE_DIR);
    if (!target.startsWith(`${root}${path.sep}`)) continue;
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      deleted = true;
    }
  }
  return deleted;
}

/** Return saved captures and website packages, newest first, for the dashboard. */
export async function listRecentCaptures(limit = 20): Promise<RecentCapture[]> {
  if (useBlobStorage()) {
    const blobs = await listAllBlobFiles();
    const items: RecentCapture[] = [];
    const captureIds = new Set<string>();
    const batchIds = new Set<string>();
    for (const blob of blobs) {
      const parts = blob.pathname.slice(`${BLOB_PREFIX}/`.length).split("/");
      if (parts[0] === "batches" && parts[2] === "batch.json") batchIds.add(parts[1]);
      else if (parts.length === 2 && parts[1] === "page.json") captureIds.add(parts[0]);
    }
    const batchedCaptureIds = new Set<string>();
    for (const batchId of batchIds) {
      try {
        const batch = await readBatchManifest(batchId);
        batch?.pageCaptureIds.forEach((captureId) => batchedCaptureIds.add(captureId));
        const capture = batch?.pageCaptureIds[0] ? await readCapture(batch.pageCaptureIds[0]) : null;
        if (batch && capture) items.push({ id: capture.id, batchId, originalUrl: capture.originalUrl, state: "completed", progress: `Captured ${batch.pageCaptureIds.length} page(s)`, errors: (batch.failures || []).map((failure) => failure.error), warnings: capture.warnings, screenshotUrl: `/api/captures/${capture.id}/screenshot`, elapsedTime: 0, startedAt: capture.captureTimestamp, completedAt: capture.captureTimestamp });
        else if (batch && batch.status && batch.status !== "completed") items.push({ id: batchId, batchId, originalUrl: batch.originalUrl || "Capture batch", state: batch.status, progress: batch.progress || "Capture queued", errors: (batch.failures || []).map((failure) => failure.error), warnings: [], screenshotUrl: null, elapsedTime: 0, startedAt: batch.createdAt || new Date(0).toISOString(), completedAt: batch.completedAt || batch.createdAt || new Date(0).toISOString() });
      } catch { /* Ignore partial package metadata. */ }
    }
    for (const captureId of captureIds) {
      if (batchedCaptureIds.has(captureId)) continue;
      try {
        const capture = await readCapture(captureId);
        if (capture && !capture.flowId) items.push({ id: capture.id, originalUrl: capture.originalUrl, state: "completed", progress: "Capture complete", errors: capture.errors, warnings: capture.warnings, screenshotUrl: `/api/captures/${capture.id}/screenshot`, elapsedTime: 0, startedAt: capture.captureTimestamp, completedAt: capture.captureTimestamp });
      } catch { /* Ignore partial capture metadata. */ }
    }
    return items.sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, Math.max(1, limit));
  }
  if (!fs.existsSync(STORAGE_DIR)) return [];
  const items: RecentCapture[] = [];
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
      if (capture.flowId) continue;
      items.push({ id: capture.id, originalUrl: capture.originalUrl, state: "completed", progress: "Capture complete", errors: capture.errors, warnings: capture.warnings, screenshotUrl: `/api/captures/${capture.id}/screenshot`, elapsedTime: 0, startedAt: capture.captureTimestamp, completedAt: capture.captureTimestamp });
    } catch { /* Ignore incomplete captures. */ }
  }
  return items.sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, Math.max(1, limit));
}

function useBlobStorage(): boolean {
  if (!process.env.VERCEL) return false;
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Persistent capture storage is not connected. Create a private Vercel Blob store and connect it to this project.");
  }
  return true;
}

export function assertStorageConfigured(): void {
  useBlobStorage();
}

function blobPath(relativePath: string): string {
  return `${BLOB_PREFIX}/${relativePath.replace(/\\/g, "/")}`;
}

async function writeStoredFile(relativePath: string, body: Buffer | string, contentType = "application/octet-stream"): Promise<void> {
  if (useBlobStorage()) {
    await put(blobPath(relativePath), body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType, multipart: Buffer.byteLength(body) > 4 * 1024 * 1024 });
    return;
  }
  const filePath = path.join(STORAGE_DIR, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body);
}

async function writeStoredFiles(files: Array<{ path: string; body: Buffer | string; contentType?: string }>): Promise<void> {
  for (let index = 0; index < files.length; index += 6) {
    await Promise.all(files.slice(index, index + 6).map((file) => writeStoredFile(file.path, file.body, file.contentType)));
  }
}

async function listAllBlobFiles(relativePrefix = "") {
  const blobs: Awaited<ReturnType<typeof list>>["blobs"] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${BLOB_PREFIX}/${relativePrefix}`, limit: 1000, cursor });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}
