import { describe, expect, it } from "vitest";
import { buildDesignTree } from "@/lib/design-tree";
import type { AssetManifest, CaptureResult, ElementInfo } from "@/lib/types";

function element(overrides: Partial<ElementInfo> & Pick<ElementInfo, "id" | "tag">): ElementInfo {
  const { id, tag, ...rest } = overrides;
  return {
    id,
    parentId: null,
    tag,
    role: tag,
    textContent: "",
    boundingRect: { x: 0, y: 0, width: 100, height: 40 },
    display: "block",
    position: "static",
    flexDirection: null,
    flexWrap: null,
    justifyContent: null,
    alignItems: null,
    gridTemplateColumns: null,
    gridTemplateRows: null,
    padding: "0px",
    margin: "0px",
    gap: "0px",
    fontFamily: "Arial, sans-serif",
    fontSize: "16px",
    fontWeight: "400",
    lineHeight: "normal",
    textAlign: "left",
    color: "rgb(20, 30, 40)",
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderWidth: "0px",
    borderStyle: "none",
    borderColor: "rgba(0, 0, 0, 0)",
    borderRadius: "0px",
    boxShadow: "none",
    opacity: "1",
    imageSrc: null,
    alt: null,
    visibility: "visible",
    zIndex: null,
    cssProperties: {},
    ...rest,
  };
}

function capture(elements: ElementInfo[], assets: AssetManifest[] = []): CaptureResult {
  return {
    id: "capture-id",
    status: "completed",
    originalUrl: "https://example.com/",
    finalUrl: "https://example.com/",
    pageMetadata: {
      originalUrl: "https://example.com/",
      finalUrl: "https://example.com/",
      title: "Example design",
      description: "",
      viewportWidth: 800,
      viewportHeight: 600,
      scrollWidth: 800,
      scrollHeight: 900,
      captureTimestamp: "2026-10-10T00:00:00.000Z",
      captureSchemaVersion: 1,
      userAgent: "test",
      languages: ["en"],
    },
    elements,
    assets,
    warnings: [],
    errors: [],
    captureTimestamp: "2026-10-10T00:00:00.000Z",
    captureSettings: {
      url: "https://example.com/",
      viewport: "desktop",
      fullPageScreenshot: false,
      captureAssets: true,
      captureSchemaVersion: 1,
    },
    manifest: {
      captureVersion: "1.0.0",
      sourceUrl: "https://example.com/",
      timestamp: "2026-10-10T00:00:00.000Z",
      assetList: assets,
      captureSettings: {
        url: "https://example.com/",
        viewport: "desktop",
        fullPageScreenshot: false,
        captureAssets: true,
        captureSchemaVersion: 1,
      },
      warnings: [],
      packageContents: [],
    },
  };
}

describe("design tree conversion", () => {
  it("maps captured hierarchy, text, image assets, colors, and flex layout", () => {
    const elements = [
      element({
        id: "section",
        tag: "section",
        boundingRect: { x: 10, y: 20, width: 300, height: 200 },
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        backgroundColor: "rgb(255, 255, 255)",
        cssProperties: { "padding-top": "16px", "padding-right": "20px", "padding-bottom": "16px", "padding-left": "20px" },
      }),
      element({
        id: "heading",
        tag: "h1",
        parentId: "section",
        textContent: "Hello world",
        boundingRect: { x: 20, y: 30, width: 200, height: 40 },
        fontSize: "32px",
        fontWeight: "700",
      }),
      element({
        id: "button",
        tag: "button",
        parentId: "section",
        textContent: "Continue",
        boundingRect: { x: 20, y: 100, width: 120, height: 48 },
        backgroundColor: "rgb(37, 99, 235)",
        borderRadius: "8px",
      }),
      element({
        id: "image",
        tag: "img",
        parentId: "section",
        boundingRect: { x: 20, y: 160, width: 80, height: 30 },
        imageSrc: "https://example.com/logo.png",
        alt: "Brand mark",
      }),
    ];
    const asset: AssetManifest = {
      originalUrl: "https://example.com/logo.png",
      assetType: "image",
      mimeType: "image/png",
      downloadStatus: "success",
      localPath: "assets/logo.png",
      fileName: "logo.png",
      fileSize: 100,
      altText: "Brand mark",
      contentHash: null,
    };

    const document = buildDesignTree(capture(elements, [asset]));
    const section = document.root.children[0];
    const [heading, button, image] = section.children;

    expect(document.schemaVersion).toBe("1.0.0");
    expect(document.root.bounds.height).toBe(900);
    expect(section.type).toBe("FRAME");
    expect(section.bounds).toMatchObject({ x: 10, y: 20, width: 300, height: 200 });
    expect(section.layout).toMatchObject({ mode: "VERTICAL", gap: 12, padding: { top: 16, right: 20, bottom: 16, left: 20 } });
    expect(heading).toMatchObject({ type: "TEXT", text: "Hello world", bounds: { x: 10, y: 10 } });
    expect(heading.textStyle).toMatchObject({ fontSize: 32, fontWeight: 700 });
    expect(button).toMatchObject({ type: "FRAME", cornerRadius: 8 });
    expect(button.children[0]).toMatchObject({ type: "TEXT", text: "Continue" });
    expect(image.image).toMatchObject({ packagePath: "assets/logo.png", alt: "Brand mark" });
    expect(document.warnings).toEqual([]);
  });

  it("warns about grid layouts, uncollected images, and CSS backgrounds", () => {
    const document = buildDesignTree(capture([
      element({ id: "grid", tag: "div", display: "grid", cssProperties: { "background-image": "linear-gradient(red, blue)" } }),
      element({ id: "unpackaged", tag: "img", imageSrc: "https://example.com/missing.png", alt: "Missing" }),
    ]));

    expect(document.warnings).toHaveLength(3);
    expect(document.warnings.join(" ")).toContain("Grid layout");
    expect(document.warnings.join(" ")).toContain("Background image");
    expect(document.warnings.join(" ")).toContain("Image asset is not packaged");
  });
});
