import { type NextRequest, NextResponse } from "next/server";
import type { CaptureResult } from "@/lib/types";
import { createSiteCaptureZip, generateSafeFilename } from "@/lib/zip-export";
import { readBatchManifest, readCapture } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Capture package not found", code: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const batch = await readBatchManifest(id);
    if (!batch) {
      return NextResponse.json({ error: "Capture package not found", code: "NOT_FOUND" }, { status: 404 });
    }
    const captures: CaptureResult[] = [];
    for (const captureId of batch.pageCaptureIds) {
      if (!/^[0-9a-f-]{36}$/i.test(captureId)) continue;
      const capture = await readCapture(captureId);
      if (capture) captures.push(capture);
    }
    if (!captures.length) {
      return NextResponse.json({ error: "No captured pages remain in this package." }, { status: 404 });
    }

    const archive = await createSiteCaptureZip(captures);
    return new NextResponse(archive as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${generateSafeFilename(id, "zip")}"`,
        "Content-Length": String(archive.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Batch export error:", error);
    return NextResponse.json({ error: "Could not create the multi-page export.", code: "EXPORT_ERROR" }, { status: 500 });
  }
}
