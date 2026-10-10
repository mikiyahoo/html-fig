import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUrl } from "@/lib/url-validator";
import { startCapture } from "@/lib/capture";
import { listRecentCaptures } from "@/lib/storage";

export async function GET() {
  return NextResponse.json({ captures: listRecentCaptures() });
}

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
    if (error instanceof Error && /Executable doesn't exist|Please run npx playwright install/i.test(error.message)) {
      return NextResponse.json(
        {
          error: "Chromium is not installed for Playwright.",
          code: "BROWSER_NOT_INSTALLED",
          details: "Run `npx playwright install chromium` in the project, then restart the app.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: "Capture failed",
        code: "CAPTURE_ERROR",
        details: error instanceof Error ? error.message.slice(0, 300) : "An unexpected capture error occurred.",
      },
      { status: 500 }
    );
  }
}
