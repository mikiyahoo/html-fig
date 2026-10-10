import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { generateCaptureId, startCapture } from "@/lib/capture";
import { cleanupOldCaptures, getBatchDir } from "@/lib/storage";
import { validateUrl } from "@/lib/url-validator";
import { validatePublicNetworkUrl } from "@/lib/server-url-validator";

export const runtime = "nodejs";

const batchSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
  viewport: z.enum(["desktop", "tablet", "mobile"]).optional(),
  fullPageScreenshot: z.boolean().optional(),
  captureAssets: z.boolean().optional(),
  captureSchemaVersion: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    cleanupOldCaptures();
    const parsed = batchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: "Select between 1 and 10 valid page URLs." }, { status: 400 });
    }

    const uniqueUrls = [...new Set(parsed.data.urls)];
    const validatedUrls: string[] = [];
    let origin: string | undefined;
    for (const rawUrl of uniqueUrls) {
      const validation = validateUrl(rawUrl);
      if (!validation.valid || !validation.parsedUrl) {
        return NextResponse.json({ error: "URL validation failed", details: validation.error }, { status: 400 });
      }
      if (origin && validation.parsedUrl.origin !== origin) {
        return NextResponse.json({ error: "Only pages on the same website can be captured together." }, { status: 400 });
      }
      if (!(await validatePublicNetworkUrl(validation.parsedUrl))) {
        return NextResponse.json({ error: "A selected page does not resolve to a public network address." }, { status: 400 });
      }
      origin = validation.parsedUrl.origin;
      validatedUrls.push(validation.parsedUrl.href);
    }

    const captures = [];
    const failures: Array<{ url: string; error: string }> = [];
    for (const url of validatedUrls) {
      try {
        captures.push(await startCapture(url, {
          viewport: parsed.data.viewport || "desktop",
          fullPageScreenshot: parsed.data.fullPageScreenshot ?? false,
          captureAssets: parsed.data.captureAssets ?? true,
          captureSchemaVersion: parsed.data.captureSchemaVersion || 1,
        }));
      } catch (error) {
        failures.push({ url, error: error instanceof Error ? error.message : "Capture failed" });
      }
    }

    if (!captures.length) {
      return NextResponse.json({ error: "None of the selected pages could be captured.", failures }, { status: 502 });
    }

    const batchId = generateCaptureId();
    const batchDir = getBatchDir(batchId);
    fs.mkdirSync(batchDir, { recursive: true });
    fs.writeFileSync(path.join(batchDir, "batch.json"), JSON.stringify({
      id: batchId,
      createdAt: new Date().toISOString(),
      pageCaptureIds: captures.map((capture) => capture.id),
      failures,
    }, null, 2));

    const publicCaptures = captures.map(({ assetFiles: _assetFiles, ...capture }) => capture);
    return NextResponse.json({
      batchId,
      captures: publicCaptures,
      failures,
      exportUrl: `/api/captures/batch/${batchId}/export`,
    }, { status: 201 });
  } catch (error) {
    console.error("Batch capture error:", error);
    return NextResponse.json({
      error: "Could not capture selected pages",
      code: "BATCH_CAPTURE_ERROR",
      details: error instanceof Error ? error.message.slice(0, 300) : "Unexpected batch capture error.",
    }, { status: 500 });
  }
}
