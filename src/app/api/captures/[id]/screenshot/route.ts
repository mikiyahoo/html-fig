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
      return NextResponse.json({ error: "Screenshot not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const captureDir = getCaptureDir(id);
    const screenshotPath = path.join(captureDir, "screenshots", "viewport.png");

    if (!fs.existsSync(screenshotPath)) {
      return NextResponse.json(
        { error: "Screenshot not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    const imageBuffer = fs.readFileSync(screenshotPath);
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": imageBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });

  } catch (error) {
    console.error("Screenshot error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "SCREENSHOT_ERROR" },
      { status: 500 }
    );
  }
}
