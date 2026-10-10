import { type NextRequest, NextResponse } from "next/server";
import type { CaptureResult } from "@/lib/types";
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
    return NextResponse.json({ batchId: id, captures, failures: batch.failures || [] });
  } catch (error) {
    console.error("Batch status error:", error);
    return NextResponse.json({ error: "Could not load the capture package." }, { status: 500 });
  }
}
