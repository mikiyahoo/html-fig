import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { extractAssets, extractElements } from "@/lib/capture";
import type { CaptureResult } from "@/lib/types";

describe("capture extraction", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    await page.setContent(`
      <main>
        <section style="display:flex; flex-direction:column; gap:12px; padding:16px">
          <h1 style="color:rgb(255, 0, 0); font-size:32px">Hello capture</h1>
          <p>A paragraph</p>
          <button type="button">Continue</button>
          <img alt="A test mark" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3C/svg%3E">
        </section>
      </main>
    `);
  });

  it("extracts visible text, images, computed styles, bounds and parent links", async () => {
    const elements = await extractElements(page);
    const heading = elements.find((element) => element.tag === "h1");
    const button = elements.find((element) => element.tag === "button");
    const image = elements.find((element) => element.tag === "img");

    expect(heading?.textContent).toBe("Hello capture");
    expect(heading?.fontSize).toBe("32px");
    expect(heading?.color).toBe("rgb(255, 0, 0)");
    expect(heading?.parentId).toBe(elements.find((element) => element.tag === "section")?.id);
    expect(button?.textContent).toBe("Continue");
    expect(image?.alt).toBe("A test mark");
    expect(image?.imageSrc).toContain("data:image/svg+xml");
    expect(elements.every((element) => Number.isFinite(element.boundingRect.x + element.boundingRect.width))).toBe(true);
  });

  it("creates a valid PNG screenshot", async () => {
    const screenshot = await page.screenshot({ type: "png" });
    expect(screenshot.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("records rejected asset URLs instead of claiming they were downloaded", async () => {
    const capture = {
      finalUrl: "https://example.com/",
      assets: [],
      warnings: [],
    } as unknown as CaptureResult;

    await extractAssets(page, capture);

    expect(capture.assets).toHaveLength(1);
    expect(capture.assets[0].downloadStatus).toBe("failed");
    expect(capture.assets[0].localPath).toBeNull();
    expect(capture.warnings[0]).toContain("Could not collect image asset");
  });
});
