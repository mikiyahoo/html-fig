import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUrl } from "@/lib/url-validator";
import { startCapture } from "@/lib/capture";

const captureBodySchema = z.object({
  url: z.string().url(),
  viewport: z.enum(["desktop", "tablet", "mobile"]).optional(),
  fullPageScreenshot: z.boolean().optional(),
  captureAssets: z.boolean().optional(),
  captureSchemaVersion: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = captureBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const validation = validateUrl(parsed.data.url);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "URL validation failed", details: validation.error },
        { status: 400 }
      );
    }

    const result = await startCapture(validation.parsedUrl!.href, {
      viewport: parsed.data.viewport || "desktop",
      fullPageScreenshot: parsed.data.fullPageScreenshot || false,
      captureAssets: parsed.data.captureAssets ?? true,
      captureSchemaVersion: parsed.data.captureSchemaVersion || 1,
    });

    const { assetFiles: _assetFiles, ...publicResult } = result;
    return NextResponse.json(publicResult);

  } catch (error) {
    console.error("Capture request error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "CAPTURE_ERROR" },
      { status: 500 }
    );
  }
}
