import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { extractElements } from "@/lib/capture";
import { fingerprintCapture, FlowActionError, flowTargetsFromCapture, performAction } from "@/lib/flow-recorder";
import type { CaptureResult } from "@/lib/types";

// A same-URL modal, a form field, and a dangerous-looking button.
const FIXTURE = `
  <main style="padding:24px">
    <h1>Dashboard</h1>
    <button id="send" type="button" onclick="document.getElementById('modal').hidden = false">Send money</button>
    <a href="#history" style="display:inline-block; margin-left:12px">History</a>
    <div id="modal" hidden style="margin-top:24px; padding:16px; border:1px solid #ccc">
      <h2>Recipient</h2>
      <label>Name <input name="recipient" placeholder="Recipient name"></label>
      <label>PIN <input name="pin" type="password"></label>
      <button type="button" onclick="document.querySelector('h2').textContent = 'Review'">Continue</button>
    </div>
  </main>
`;

// Unmatched selectors wait out the 5 s action timeout before falling back, so allow more than vitest's default.
describe("flow recorder actions", { timeout: 20_000 }, () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    await page.setContent(FIXTURE);
  });

  const snapshot = async () => ({ finalUrl: page.url(), elements: await extractElements(page) }) as CaptureResult;

  it("gives interactive elements replayable selectors and exposes them as picker targets", async () => {
    const capture = await snapshot();
    const targets = flowTargetsFromCapture(capture);
    const send = targets.find((target) => target.label === "Send money");
    expect(send?.selector).toBe("#send");
    expect(targets.find((target) => target.label === "History")?.selector).toMatch(/^body > main > a/);
    // Headings are not interactive, so they are not offered as click targets.
    expect(targets.some((target) => target.tag === "h1")).toBe(false);
    expect(await page.locator(targets.find((target) => target.label === "History")!.selector).count()).toBe(1);
  });

  it("captures a modal on the same URL as a distinct state", async () => {
    const before = await snapshot();
    await performAction(page, { type: "click", selector: "#send", label: "Send money" });
    const after = await snapshot();
    expect(after.finalUrl).toBe(before.finalUrl);
    expect(after.elements.some((element) => element.textContent === "Recipient")).toBe(true);
    expect(fingerprintCapture(after)).not.toBe(fingerprintCapture(before));
    expect(fingerprintCapture(await snapshot())).toBe(fingerprintCapture(after));
  });

  it("clicks by visible text, then replays a fill into a picked field", async () => {
    await performAction(page, { type: "click", text: "Send money", label: "Send money" });
    const field = flowTargetsFromCapture(await snapshot()).find((target) => target.fillable && target.label === "Recipient name");
    expect(field).toBeDefined();
    await performAction(page, { type: "fill", selector: field!.selector, value: "Test Recipient", label: field!.label });
    expect(await page.inputValue('input[name="recipient"]')).toBe("Test Recipient");
    await performAction(page, { type: "click", text: "Continue", label: "Continue" });
    expect(await page.textContent("h2")).toBe("Review");
  });

  it("refuses to type into password fields", async () => {
    await performAction(page, { type: "click", selector: "#send", label: "Send money" });
    await expect(performAction(page, { type: "fill", selector: 'input[name="pin"]', value: "1234", label: "PIN" }))
      .rejects.toBeInstanceOf(FlowActionError);
    expect(await page.inputValue('input[name="pin"]')).toBe("");
  });

  it("falls back to the picked point when the selector no longer matches", async () => {
    const box = (await page.locator("#send").boundingBox())!;
    await performAction(page, {
      type: "click", selector: "#renamed-button", label: "Send money",
      point: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    });
    expect(await page.isVisible("#modal")).toBe(true);
  });

  it("reports a missing target instead of capturing an unchanged state", async () => {
    await expect(performAction(page, { type: "click", selector: "#missing", label: "Missing" })).rejects.toThrow(/Could not find/);
  });
});
