import { chromium as playwrightChromium, type Browser, type BrowserContext, type Page } from "playwright";
import { v4 as uuidv4 } from "uuid";
import type { AssetManifest, CaptureResult, CaptureSettings, ElementInfo } from "./types";
import { validateUrl, VIEWPORT_CONFIGS, type Viewport } from "./url-validator";
import { validatePublicNetworkUrl } from "./server-url-validator";
import { saveCaptureToStorage } from "./storage";
import { normalizeInternalPageLinks } from "./page-discovery";

export const CAPTURE_SCHEMA_VERSION = "1.0.0";
const NAVIGATION_TIMEOUT = 30_000;
const MAX_ASSETS = 100;
const MAX_ASSET_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 40 * 1024 * 1024;
const MAX_FULL_PAGE_HEIGHT = 4_000;

export function generateCaptureId(): string { return uuidv4(); }
export function getViewportConfig(viewport: Viewport): { width: number; height: number } {
  return VIEWPORT_CONFIGS[viewport];
}

export async function startCapture(url: string, settings: Partial<CaptureSettings> = {}): Promise<CaptureResult> {
  const validation = validateUrl(url);
  if (!validation.valid || !validation.parsedUrl) throw new Error(validation.error || "Invalid URL");
  const parsedUrl = validation.parsedUrl;
  if (!(await validatePublicNetworkUrl(parsedUrl))) throw new Error("This URL does not resolve to a public network address.");
  const captureSettings: CaptureSettings = {
    url: parsedUrl.href,
    viewport: settings.viewport || "desktop",
    fullPageScreenshot: settings.fullPageScreenshot ?? false,
    captureAssets: settings.captureAssets ?? true,
    captureSchemaVersion: settings.captureSchemaVersion || 1,
  };
  const timestamp = new Date().toISOString();
  const capture: CaptureResult = {
    id: generateCaptureId(), status: "running", originalUrl: parsedUrl.href, finalUrl: parsedUrl.href,
    pageMetadata: { originalUrl: parsedUrl.href, finalUrl: parsedUrl.href, title: "", description: "",
      viewportWidth: 0, viewportHeight: 0, scrollWidth: 0, scrollHeight: 0,
      captureTimestamp: timestamp, captureSchemaVersion: captureSettings.captureSchemaVersion,
      userAgent: "", languages: [] },
    elements: [], assets: [], warnings: [], errors: [], captureTimestamp: timestamp, captureSettings,
    manifest: { captureVersion: CAPTURE_SCHEMA_VERSION, sourceUrl: parsedUrl.href, timestamp,
      assetList: [], captureSettings, warnings: [], packageContents: [] },
  };

  const browser = await launchBrowser();
  try {
    const viewport = getViewportConfig(captureSettings.viewport);
    const context = await browser.newContext({ viewport, locale: "en-US" });
    await installRequestPolicy(context);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
    const consoleErrors: string[] = [];
    page.on("pageerror", (error) => addConsoleError(consoleErrors, error.message));
    page.on("console", (message) => {
      if (message.type() === "error") addConsoleError(consoleErrors, message.text());
    });
    if (await navigateWithRetry(page, parsedUrl.href)) {
      capture.warnings.push("The initial navigation failed transiently and succeeded after one retry.");
    }
    await page.waitForTimeout(750);
    capture.finalUrl = page.url();
    capture.pageMetadata = await page.evaluate((meta) => ({
      ...meta,
      finalUrl: location.href,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      userAgent: navigator.userAgent,
      languages: [...navigator.languages],
      captureTimestamp: new Date().toISOString(),
    }), capture.pageMetadata);
    capture.elements = await extractElements(page);
    if (captureSettings.captureAssets) await extractAssets(page, capture);

    const viewportBuffer = await page.screenshot({ type: "png", timeout: 10_000 });
    const fullPageHeight = Math.min(capture.pageMetadata.scrollHeight, MAX_FULL_PAGE_HEIGHT);
    let fullPageBuffer: Buffer | undefined;
    if (captureSettings.fullPageScreenshot) {
      if (capture.pageMetadata.scrollHeight > MAX_FULL_PAGE_HEIGHT) {
        capture.warnings.push(`Full-page screenshot limited to ${MAX_FULL_PAGE_HEIGHT}px height.`);
      }
      fullPageBuffer = await page.screenshot({ type: "png", fullPage: false, clip: {
        x: 0, y: 0, width: Math.min(capture.pageMetadata.scrollWidth, 8_000), height: Math.max(1, fullPageHeight),
      }, timeout: 10_000 });
    }
    capture.screenshot = { width: viewport.width, height: viewport.height, format: "png", path: "screenshots/viewport.png" };
    if (fullPageBuffer) capture.fullPageScreenshot = {
      width: Math.min(capture.pageMetadata.scrollWidth, 8_000), height: fullPageHeight,
      format: "png", path: "screenshots/full-page.png",
    };
    capture.errors = consoleErrors;
    capture.status = "completed";
    capture.manifest.assetList = capture.assets;
    capture.manifest.warnings = capture.warnings;
    capture.manifest.packageContents = ["manifest.json", "page.json", "screenshots/", "assets/", "README.md"];
    await saveCaptureToStorage(capture, { viewport: viewportBuffer, fullPage: fullPageBuffer });
    await context.close();
    return capture;
  } catch (error) {
    capture.status = "failed";
    capture.errors.push(error instanceof Error ? error.message : "Capture failed");
    throw error;
  } finally {
    await browser.close();
  }
}

export async function discoverInternalPages(url: string, limit = 10): Promise<string[]> {
  const validation = validateUrl(url);
  if (!validation.valid || !validation.parsedUrl) throw new Error(validation.error || "Invalid URL");
  const parsedUrl = validation.parsedUrl;
  if (!(await validatePublicNetworkUrl(parsedUrl))) throw new Error("This URL does not resolve to a public network address.");

  const browser = await launchBrowser();
  let context: BrowserContext | undefined;
  try {
    context = await browser.newContext({ viewport: VIEWPORT_CONFIGS.desktop });
    await installRequestPolicy(context);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
    await navigateWithRetry(page, parsedUrl.href);
    await page.waitForTimeout(500);
    const links = await page.locator("a[href]").evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).href));
    return normalizeInternalPageLinks(page.url(), links, limit);
  } finally {
    await context?.close();
    await browser.close();
  }
}

/** Use the bundled Linux binary on Vercel; use the Playwright-managed browser locally. */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    const { default: serverlessChromium } = await import("@sparticuz/chromium");
    return playwrightChromium.launch({
      args: serverlessChromium.args,
      executablePath: await serverlessChromium.executablePath(),
      headless: true,
    });
  }

  return playwrightChromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}

async function navigateWithRetry(page: Page, url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT });
      return attempt > 0;
    } catch (error) {
      if (attempt === 0 && isTransientNavigationError(error)) {
        await page.waitForTimeout(500);
        continue;
      }
      throw error;
    }
  }
  return false;
}

function isTransientNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Timeout \d+ms exceeded|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_NETWORK_CHANGED|ERR_CONNECTION_TIMED_OUT/i.test(message);
}

function addConsoleError(errors: string[], message: string): void {
  const normalized = message.trim().slice(0, 500);
  if (normalized && errors.length < 20 && !errors.includes(normalized)) errors.push(normalized);
}

async function installRequestPolicy(context: BrowserContext): Promise<void> {
  // Every browser request, including redirects and subresources, is checked before Chromium follows it.
  await context.route("**/*", async (route) => {
    try {
      const target = new URL(route.request().url());
      if (!validateUrl(target.href).valid || !(await validatePublicNetworkUrl(target))) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    } catch {
      await route.abort("blockedbyclient");
    }
  });
}

export async function extractElements(page: Page): Promise<ElementInfo[]> {
  return page.evaluate(() => {
    const tags = new Set(["section", "div", "header", "footer", "nav", "main", "article", "aside",
      "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "button", "img", "span", "ul", "ol", "li",
      "table", "form", "input", "label", "select", "textarea"]);
    const nodes = Array.from(document.body.querySelectorAll<HTMLElement>("*"))
      .filter((el) => tags.has(el.tagName.toLowerCase()) && el.getAttribute("type") !== "password")
      .filter((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; });
    const ids = new Map(nodes.map((node, i) => [node, `el-${i}`]));
    return nodes.map((el): ElementInfo => {
      const tag = el.tagName.toLowerCase();
      const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
      const cssProperties: Record<string, string> = {};
      for (const property of Array.from(style)) cssProperties[property] = style.getPropertyValue(property);
      let parentNode = el.parentElement;
      while (parentNode && !ids.has(parentNode)) parentNode = parentNode.parentElement;
      const image = el as HTMLImageElement;
      return {
        id: ids.get(el)!, parentId: parentNode ? ids.get(parentNode)! : null, tag,
        role: el.getAttribute("role") || tag,
        textContent: tag === "input" || tag === "textarea" ? (el.getAttribute("aria-label") || el.getAttribute("placeholder") || "") : (el.innerText || "").trim().slice(0, 500),
        boundingRect: { x: Math.round(rect.x + scrollX), y: Math.round(rect.y + scrollY), width: Math.round(rect.width), height: Math.round(rect.height) },
        display: style.display, position: style.position, flexDirection: style.flexDirection, flexWrap: style.flexWrap,
        justifyContent: style.justifyContent, alignItems: style.alignItems, gridTemplateColumns: style.gridTemplateColumns,
        gridTemplateRows: style.gridTemplateRows, padding: style.padding, margin: style.margin, gap: style.gap,
        fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight,
        textAlign: style.textAlign, color: style.color, backgroundColor: style.backgroundColor,
        borderWidth: style.borderWidth, borderStyle: style.borderStyle, borderColor: style.borderColor,
        borderRadius: style.borderRadius, boxShadow: style.boxShadow, opacity: style.opacity,
        imageSrc: tag === "img" ? image.currentSrc || image.src : null, alt: tag === "img" ? image.alt : null,
        visibility: style.visibility, zIndex: style.zIndex, cssProperties,
      };
    });
  });
}

export async function extractAssets(page: Page, capture: CaptureResult): Promise<void> {
  const candidates = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLImageElement>("img[src], source[src]"))
    .map((el) => ({ url: el.currentSrc || el.src, alt: el.getAttribute("alt") })));
  const seen = new Set<string>(); let totalBytes = 0;
  for (const candidate of candidates) {
    if (capture.assets.length >= MAX_ASSETS) { capture.warnings.push(`Asset collection limited to ${MAX_ASSETS} items.`); break; }
    try {
      const url = new URL(candidate.url, capture.finalUrl);
      if (seen.has(url.href)) continue; seen.add(url.href);
      if (!validateUrl(url.href).valid || !(await validatePublicNetworkUrl(url))) throw new Error("Private or unsupported destination");
      const response = await page.request.get(url.href, { timeout: 8_000, maxRedirects: 0 });
      if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
      const mimeType = (response.headers()["content-type"] || "").split(";")[0].toLowerCase();
      if (!mimeType.startsWith("image/")) throw new Error("Response is not an image");
      const declaredSize = Number(response.headers()["content-length"] || 0);
      if (declaredSize > MAX_ASSET_BYTES || totalBytes + declaredSize > MAX_TOTAL_ASSET_BYTES) throw new Error("Asset size limit exceeded");
      const data = await response.body();
      if (data.length > MAX_ASSET_BYTES || totalBytes + data.length > MAX_TOTAL_ASSET_BYTES) throw new Error("Asset size limit exceeded");
      totalBytes += data.length;
      const ext = mimeType === "image/svg+xml" ? "svg" : mimeType.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "img";
      const fileName = `${capture.assets.length}-${uuidv4()}.${ext}`;
      capture.assets.push({ originalUrl: url.href, assetType: mimeType === "image/svg+xml" ? "svg" : "image",
        mimeType, downloadStatus: "success", localPath: `assets/${fileName}`, fileName, fileSize: data.length,
        altText: candidate.alt, contentHash: null });
      capture.assetFiles ??= {};
      capture.assetFiles[fileName] = data.toString("base64");
    } catch (error) {
      capture.assets.push({ originalUrl: candidate.url, assetType: "image", mimeType: "", downloadStatus: "failed",
        localPath: null, fileName: "", fileSize: null, altText: candidate.alt,
        contentHash: null });
      capture.warnings.push(`Could not collect image asset: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
}
