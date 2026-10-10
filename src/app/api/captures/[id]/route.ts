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

    const pagePath = path.join(captureDir, "page.json");
    const pageData = fs.existsSync(pagePath)
      ? JSON.parse(fs.readFileSync(pagePath, "utf-8"))
      : null;

    if (!pageData) {
      return NextResponse.json({ error: "Capture data not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(pageData);

  } catch (error) {
    console.error("Capture status error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "STATUS_ERROR" },
      { status: 500 }
    );
  }
}
