import JSZip from "jszip";
import { readStoredFile } from "./storage";
import { buildDesignTree } from "./design-tree";
import type { CaptureResult } from "./types";
import { describeAction, FLOW_SCHEMA_VERSION, type FlowAction, type FlowRecord } from "./flow-types";

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
  const design = buildDesignTree(capture);
  const manifest = {
    ...capture.manifest,
    packageContents: [...new Set([...capture.manifest.packageContents, "design.json"])],
    warnings: [...new Set([...capture.manifest.warnings, ...design.warnings])],
  };

  // Add manifest
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  // Add page metadata
  zip.file("page.json", JSON.stringify(capture, null, 2));
  zip.file("design.json", JSON.stringify(design, null, 2));

  // Add screenshots
  if (capture.screenshot) {
    const screenshot = await readStoredFile(`${capture.id}/screenshots/viewport.png`);
    if (screenshot) zip.file("screenshots/viewport.png", screenshot);
  }
  if (capture.fullPageScreenshot) {
    const screenshot = await readStoredFile(`${capture.id}/screenshots/full-page.png`);
    if (screenshot) zip.file("screenshots/full-page.png", screenshot);
  }

  // Add assets
  for (const asset of capture.assets) {
    if (asset.localPath && asset.fileName) {
      const filename = asset.fileName.split(/[\\/]/).pop() || asset.fileName;
      const assetData = await readStoredFile(`${capture.id}/assets/${filename}`);
      if (assetData) zip.file(`assets/${filename}`, assetData);
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

/** Package successful page captures together as an organized site import. */
export async function createSiteCaptureZip(captures: CaptureResult[]): Promise<Buffer> {
  const zip = new JSZip();
  const pageManifest: Array<{ path: string; sourceUrl: string; title: string; viewport: string }> = [];

  for (const [index, capture] of captures.entries()) {
    const pageName = `${String(index + 1).padStart(2, "0")}-${safeSlug(capture.pageMetadata.title || new URL(capture.originalUrl).hostname)}`;
    const folder = `pages/${pageName}`;
    const pageZip = await JSZip.loadAsync(await createCaptureZip(capture));
    for (const [entryName, entry] of Object.entries(pageZip.files)) {
      if (entry.dir) continue;
      zip.file(`${folder}/${entryName}`, await entry.async("uint8array"));
    }
    pageManifest.push({
      path: folder,
      sourceUrl: capture.finalUrl,
      title: capture.pageMetadata.title,
      viewport: capture.captureSettings.viewport,
    });
  }

  zip.file("site-manifest.json", JSON.stringify({ schemaVersion: "1.0.0", pages: pageManifest }, null, 2));
  zip.file("README.md", [
    "# Website Capture Package",
    "",
    "Each page folder contains its own `design.json`, `page.json`, screenshot, and assets.",
    "Import this ZIP into the Web to Figma plugin to create one Figma frame per captured page layout and viewport.",
    "",
    `Captured page layouts: ${pageManifest.length}`,
  ].join("\n"));
  return zip.generateAsync({ type: "nodebuffer" });
}

/**
 * Package a recorded flow: one folder per step (design.json, page.json, screenshots, assets)
 * plus `flows/<slug>.json` describing step order and the transitions between steps.
 */
export async function createFlowZip(flow: FlowRecord, loadCapture: (id: string) => Promise<CaptureResult | null>): Promise<Buffer> {
  const zip = new JSZip();
  const slug = safeSlug(flow.name) || "flow";
  const warnings: string[] = [];
  const steps = [];

  for (const [index, step] of flow.steps.entries()) {
    const folder = `flows/${slug}/steps/${String(index + 1).padStart(2, "0")}-${safeSlug(step.name)}/`;
    const capture = await loadCapture(step.captureId);
    if (!capture || capture.status !== "completed") {
      warnings.push(`Step “${step.name}” is no longer available and was left out.`);
      continue;
    }
    const stepZip = await JSZip.loadAsync(await createCaptureZip(capture));
    for (const [entryName, entry] of Object.entries(stepZip.files)) {
      if (entry.dir) continue;
      zip.file(`${folder}${entryName}`, await entry.async("uint8array"));
    }
    steps.push({
      id: step.id,
      index: index + 1,
      name: step.name,
      parentId: step.parentId,
      action: redactAction(step.action),
      actionLabel: describeAction(step.action),
      risk: step.risk,
      url: step.url,
      title: step.title,
      note: step.note || null,
      capturedAt: step.createdAt,
      folder,
      design: `${folder}design.json`,
      screenshot: `${folder}screenshots/viewport.png`,
      warnings: step.warnings,
    });
  }

  const included = new Set(steps.map((step) => step.id));
  const flowDocument = {
    schemaVersion: FLOW_SCHEMA_VERSION,
    flow: { id: flow.id, name: flow.name, startUrl: flow.startUrl, viewport: flow.viewport, createdAt: flow.createdAt, updatedAt: flow.updatedAt },
    steps,
    transitions: steps
      .filter((step) => step.parentId && included.has(step.parentId))
      .map((step) => ({ from: step.parentId, to: step.id, action: step.action, label: step.actionLabel })),
  };
  zip.file(`flows/${slug}.json`, JSON.stringify(flowDocument, null, 2));
  zip.file("manifest.json", JSON.stringify({
    schemaVersion: FLOW_SCHEMA_VERSION,
    product: "Web to Figma",
    kind: "flow",
    flowId: flow.id,
    createdAt: new Date().toISOString(),
    source: { kind: "url", startUrl: flow.startUrl },
    counts: { flows: 1, states: steps.length },
    flows: [`flows/${slug}.json`],
    warnings,
  }, null, 2));
  zip.file("README.md", [
    `# ${flow.name} — Recorded User Flow`,
    "",
    `Start URL: ${flow.startUrl}`,
    `Steps: ${steps.length}`,
    "",
    `\`flows/${slug}.json\` lists the steps in order, the action that led to each one, and the transitions between them.`,
    "Each step folder contains its own `design.json`, `page.json`, screenshots, and assets.",
    "Import this ZIP into the Web to Figma plugin to create one Figma frame per step, grouped in a section.",
    "Typed values are redacted from this package.",
    ...(warnings.length ? ["", "## Warnings", ...warnings.map((warning) => `- ${warning}`)] : []),
  ].join("\n"));
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Typed values stay on the server for replay; exports only record that something was typed. */
function redactAction(action: FlowAction): FlowAction {
  return action.type === "fill" ? { ...action, value: "[redacted]" } : action;
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
    `- design.json: Normalized editable frames, text, images, and layout hints`,
    `- screenshots/: Page screenshots`,
    `- assets/: Downloaded assets (images, fonts, etc.)`,
    "",
    "## Usage",
    "This package is designed for import by a Figma plugin.",
    "The companion Web to Figma plugin reads `design.json` to build editable frames, text, and image nodes.",
    "Use `page.json` for the source capture data and `manifest.json` for package metadata.",
    "",
    "## Limitations",
    `${capture.warnings.length > 0 ? capture.warnings.slice(0, 5).join("\n- ") : "None"}${capture.warnings.length > 5 ? `\n- ... and ${capture.warnings.length - 5} more warnings` : ""}`,
  ];

  return lines.join("\n");
}

function safeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "page";
}
