import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCaptureId, startCapture } from "@/lib/capture";
import { assertStorageConfigured, cleanupOldCaptures, saveBatchManifest } from "@/lib/storage";
import { validateUrl } from "@/lib/url-validator";
import { validatePublicNetworkUrl } from "@/lib/server-url-validator";

export const runtime = "nodejs";

const batchSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(10),
  viewport: z.enum(["desktop", "tablet", "mobile"]).optional(),
  viewports: z.array(z.enum(["desktop", "tablet", "mobile"])).min(1).max(3).optional(),
  fullPageScreenshot: z.boolean().optional(),
  captureAssets: z.boolean().optional(),
  captureSchemaVersion: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await cleanupOldCaptures();
    assertStorageConfigured();
    const parsed = batchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: "Select between 1 and 10 valid page URLs." }, { status: 400 });
    }

    const uniqueUrls = [...new Set(parsed.data.urls)];
    const viewports = [...new Set(parsed.data.viewports || [parsed.data.viewport || "desktop"])];
    if (uniqueUrls.length * viewports.length > 10) {
      return NextResponse.json({ error: "Capture batch is too large", details: "Capture at most 10 page layouts per import. Responsive imports support up to 3 selected pages." }, { status: 400 });
    }
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

    const layoutCount = validatedUrls.length * viewports.length;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); }
          catch { /* The client may leave while a capture is running. */ }
        };

        void (async () => {
          const captures = [];
          const failures: Array<{ url: string; error: string }> = [];
          let current = 0;
          try {
            for (const url of validatedUrls) {
              for (const viewport of viewports) {
                current += 1;
                send({ type: "progress", progress: `Rendering layout ${current} of ${layoutCount} · ${viewport} · ${url}` });
                try {
                  captures.push(await startCapture(url, {
                    viewport,
                    fullPageScreenshot: parsed.data.fullPageScreenshot ?? false,
                    captureAssets: parsed.data.captureAssets ?? true,
                    captureSchemaVersion: parsed.data.captureSchemaVersion || 1,
                  }));
                } catch (error) {
                  failures.push({ url: `${url} (${viewport})`, error: error instanceof Error ? error.message : "Capture failed" });
                }
                send({ type: "progress", progress: `Finished layout ${current} of ${layoutCount}` });
              }
            }

            if (!captures.length) {
              send({ type: "error", error: "None of the selected page layouts could be captured.", code: "CAPTURE_FAILED", failures });
              return;
            }

            send({ type: "progress", progress: "Saving capture package…" });
            const batchId = generateCaptureId();
            await saveBatchManifest(batchId, {
              id: batchId,
              createdAt: new Date().toISOString(),
              pageCaptureIds: captures.map((capture) => capture.id),
              failures,
            });

            const publicCaptures = captures.map(({ assetFiles: _assetFiles, ...capture }) => capture);
            send({
              type: "complete",
              batchId,
              captures: publicCaptures,
              failures,
              exportUrl: `/api/captures/batch/${batchId}/export`,
            });
          } catch (error) {
            send({ type: "error", error: "Could not finish the capture package.", code: "BATCH_CAPTURE_ERROR", details: error instanceof Error ? error.message.slice(0, 300) : "Unexpected capture error." });
          } finally {
            try { controller.close(); } catch { /* The client already closed the stream. */ }
          }
        })();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Batch capture error:", error);
    return NextResponse.json({
      error: "Could not capture selected pages",
      code: "BATCH_CAPTURE_ERROR",
      details: error instanceof Error ? error.message.slice(0, 300) : "Unexpected batch capture error.",
    }, { status: 500 });
  }
}
