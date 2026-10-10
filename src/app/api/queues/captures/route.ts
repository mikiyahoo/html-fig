import { handleCallback } from "@/lib/queue-client";
import { processQueuedCapture, type BatchCaptureJob } from "@/lib/batch-capture";
import { readBatchManifest, saveBatchManifest } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const handleCaptureMessage = handleCallback(async (job: BatchCaptureJob, metadata) => {
  if (!job || typeof job.batchId !== "string" || !Array.isArray(job.urls) || !Array.isArray(job.viewports)) {
    throw new Error("Invalid capture queue message");
  }
  try {
    await processQueuedCapture(job);
  } catch (error) {
    if (metadata.deliveryCount >= 8) {
      const batch = await readBatchManifest(job.batchId);
      if (batch) {
        batch.status = "failed";
        batch.progress = "Capture worker stopped after repeated delivery failures";
        batch.completedAt = new Date().toISOString();
        batch.failures ||= [];
        batch.failures.push({ url: "Capture worker", error: error instanceof Error ? error.message.slice(0, 300) : "Repeated queue delivery failure" });
        await saveBatchManifest(job.batchId, batch);
      }
      return;
    }
    throw error;
  }
});

export async function POST(request: Request) {
  return handleCaptureMessage(request);
}
