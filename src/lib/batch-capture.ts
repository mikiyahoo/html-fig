import { startCapture } from "@/lib/capture";
import { send } from "@/lib/queue-client";
import { readBatchManifest, saveBatchManifest } from "@/lib/storage";
import type { CaptureSettings } from "@/lib/types";
import type { Viewport } from "@/lib/url-validator";

export type BatchCaptureJob = {
  batchId: string;
  urls: string[];
  viewports: Viewport[];
  settings: Pick<CaptureSettings, "fullPageScreenshot" | "captureAssets" | "captureSchemaVersion">;
  layoutIndex: number;
};

export async function processQueuedCapture(job: BatchCaptureJob) {
  const batch = await readBatchManifest(job.batchId);
  if (!batch) throw new Error(`Capture batch ${job.batchId} does not exist`);
  if (batch.status === "completed" || batch.status === "failed") return;

  batch.status = "running";
  batch.failures ||= [];
  batch.pageCaptureIds ||= [];
  const layouts = job.urls.flatMap((url) => job.viewports.map((viewport) => ({ url, viewport, label: `${viewport} · ${url}` })));
  const current = layouts[job.layoutIndex];
  if (!current) throw new Error(`Invalid layout index ${job.layoutIndex} for batch ${job.batchId}`);

  if (!batch.completedLayouts?.includes(current.label)) {
    batch.progress = `Rendering layout ${job.layoutIndex + 1} of ${layouts.length} · ${current.label}`;
    await saveBatchManifest(job.batchId, batch);
    try {
      const capture = await startCapture(current.url, { ...job.settings, viewport: current.viewport });
      batch.pageCaptureIds.push(capture.id);
    } catch (error) {
      batch.failures.push({ url: current.label, error: error instanceof Error ? error.message : "Capture failed" });
    }
    batch.completedLayouts ||= [];
    batch.completedLayouts.push(current.label);
    batch.progress = `Finished layout ${job.layoutIndex + 1} of ${layouts.length}`;
    await saveBatchManifest(job.batchId, batch);
  }

  const nextIndex = job.layoutIndex + 1;
  if (nextIndex < layouts.length) {
    await send("html-to-figma-captures", { ...job, layoutIndex: nextIndex }, { idempotencyKey: `${job.batchId}:${nextIndex}` });
    return;
  }

  batch.status = batch.pageCaptureIds.length ? "completed" : "failed";
  batch.progress = batch.pageCaptureIds.length
    ? `Captured ${batch.pageCaptureIds.length} of ${layouts.length} page layout(s)`
    : "All selected page layouts failed";
  batch.completedAt = new Date().toISOString();
  await saveBatchManifest(job.batchId, batch);
}
