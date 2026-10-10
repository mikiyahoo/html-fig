import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { CaptureResult } from "@/lib/types";
import { getBatchDir, getCaptureDir } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Capture package not found", code: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const manifestPath = path.join(getBatchDir(id), "batch.json");
    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json({ error: "Capture package not found", code: "NOT_FOUND" }, { status: 404 });
    }
    const batch = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { pageCaptureIds: string[]; failures: Array<{ url: string; error: string }> };
    const captures: CaptureResult[] = [];
    for (const captureId of batch.pageCaptureIds) {
      if (!/^[0-9a-f-]{36}$/i.test(captureId)) continue;
      const pagePath = path.join(getCaptureDir(captureId), "page.json");
      if (fs.existsSync(pagePath)) captures.push(JSON.parse(fs.readFileSync(pagePath, "utf8")) as CaptureResult);
    }
    return NextResponse.json({ batchId: id, captures, failures: batch.failures || [] });
  } catch (error) {
    console.error("Batch status error:", error);
    return NextResponse.json({ error: "Could not load the capture package." }, { status: 500 });
  }
}
