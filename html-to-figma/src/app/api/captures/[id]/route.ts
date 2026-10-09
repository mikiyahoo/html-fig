import { type NextRequest, NextResponse } from "next/server";
import { getCaptureDir } from "@/lib/storage";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Capture not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const captureDir = getCaptureDir(id);

    // Check if capture exists
    const manifestPath = path.join(captureDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json(
        { error: "Capture not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const pagePath = path.join(captureDir, "page.json");
    const pageData = fs.existsSync(pagePath)
      ? JSON.parse(fs.readFileSync(pagePath, "utf-8"))
      : null;

    // Build response
    const response = {
      id,
      status: "completed",
      originalUrl: manifest.sourceUrl,
      finalUrl: pageData?.finalUrl || manifest.sourceUrl,
      warnings: manifest.warnings,
      errors: [],
      startedAt: manifest.timestamp,
      completedAt: manifest.timestamp,
      screenshotUrl: pageData?.screenshot ? `/api/captures/${id}/screenshot` : null,
      elapsedTime: 0,
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error("Capture status error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "STATUS_ERROR" },
      { status: 500 }
    );
  }
}
