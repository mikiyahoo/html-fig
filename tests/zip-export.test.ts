import fs from "node:fs";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { createCaptureZip } from "@/lib/zip-export";
import { getCaptureDir, saveCaptureToStorage } from "@/lib/storage";
import type { CaptureResult } from "@/lib/types";

const captureId = "123e4567-e89b-12d3-a456-426614174000";

function makeCapture(): CaptureResult {
  const timestamp = "2026-10-10T00:00:00.000Z";
  const settings = {
    url: "https://example.com/",
    viewport: "desktop" as const,
    fullPageScreenshot: false,
    captureAssets: false,
    captureSchemaVersion: 1,
  };
  return {
    id: captureId,
    status: "completed",
    originalUrl: settings.url,
    finalUrl: settings.url,
    pageMetadata: {
      originalUrl: settings.url,
      finalUrl: settings.url,
      title: "Example page",
      description: "",
      viewportWidth: 1440,
      viewportHeight: 900,
      scrollWidth: 1440,
      scrollHeight: 900,
      captureTimestamp: timestamp,
      captureSchemaVersion: 1,
      userAgent: "test",
      languages: ["en"],
    },
    elements: [],
    assets: [],
    screenshot: { width: 1440, height: 900, format: "png", path: "screenshots/viewport.png" },
    warnings: [],
    errors: [],
    captureTimestamp: timestamp,
    captureSettings: settings,
    manifest: {
      captureVersion: "1.0.0",
      sourceUrl: settings.url,
      timestamp,
      assetList: [],
      captureSettings: settings,
      warnings: [],
      packageContents: ["manifest.json", "page.json", "screenshots/", "assets/", "README.md"],
    },
  };
}

afterEach(() => {
  const captureDir = getCaptureDir(captureId);
  if (fs.existsSync(captureDir)) fs.rmSync(captureDir, { recursive: true, force: true });
});

describe("capture ZIP export", () => {
  it("contains valid manifest and page JSON, README, and saved screenshots", async () => {
    const capture = makeCapture();
    const screenshot = Buffer.from("test png payload");
    saveCaptureToStorage(capture, { viewport: screenshot });

    const archive = await JSZip.loadAsync(await createCaptureZip(capture));
    expect(Object.keys(archive.files).sort()).toEqual([
      "README.md",
      "design.json",
      "manifest.json",
      "page.json",
      "screenshots/",
      "screenshots/viewport.png",
    ]);
    expect(JSON.parse(await archive.file("manifest.json")!.async("string")).sourceUrl).toBe(capture.originalUrl);
    expect(JSON.parse(await archive.file("page.json")!.async("string")).pageMetadata.title).toBe("Example page");
    expect(JSON.parse(await archive.file("design.json")!.async("string")).root.name).toBe("Example page");
    expect(await archive.file("screenshots/viewport.png")!.async("nodebuffer")).toEqual(screenshot);
  });
});
