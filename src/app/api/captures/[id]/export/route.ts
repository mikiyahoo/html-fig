import { type NextRequest, NextResponse } from "next/server";
import type { CaptureResult } from "@/lib/types";
import { createCaptureZip } from "@/lib/zip-export";
import { generateSafeFilename, readCapture } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Capture not found", code: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const capture = await readCapture(id);
    if (!capture) {
      return NextResponse.json({ error: "Capture not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const zipBuffer = await createCaptureZip(capture);
    // Node's Buffer is a valid response body at runtime; the DOM BodyInit
    // declaration used by this Next.js version does not include Buffer<ArrayBufferLike>.
    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${generateSafeFilename(id, "zip")}"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Could not create capture export", code: "EXPORT_ERROR" }, { status: 500 });
  }
}
