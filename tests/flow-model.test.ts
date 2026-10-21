import fs from "node:fs";
import JSZip from "jszip";
import { afterEach, describe, expect, it } from "vitest";
import { classifyActionRisk, isSensitiveField } from "@/lib/flow-safety";
import { actionPathTo, flowActionSchema, type FlowRecord, type FlowStep } from "@/lib/flow-types";
import { createFlowZip } from "@/lib/zip-export";
import { getCaptureDir, saveCaptureToStorage } from "@/lib/storage";
import type { CaptureResult } from "@/lib/types";

const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];

function makeStep(index: number, parentId: string | null, action: FlowStep["action"]): FlowStep {
  return {
    id: ids[index], name: `Step ${index + 1}`, parentId, action, risk: classifyActionRisk(action), captureId: ids[index],
    url: "https://example.com/", title: "Example", fingerprint: `fp-${index}`, warnings: [], createdAt: "2026-10-21T00:00:00.000Z",
  };
}

function makeFlow(): FlowRecord {
  return {
    schemaVersion: "1.0.0", id: "44444444-4444-4444-8444-444444444444", name: "Send money", startUrl: "https://example.com/",
    viewport: "desktop", createdAt: "2026-10-21T00:00:00.000Z", updatedAt: "2026-10-21T00:00:00.000Z",
    steps: [
      makeStep(0, null, { type: "start" }),
      makeStep(1, ids[0], { type: "click", selector: "#send", label: "Send money" }),
      makeStep(2, ids[1], { type: "fill", selector: "#amount", value: "42.00", label: "Amount" }),
    ],
  };
}

function makeCapture(id: string, title: string): CaptureResult {
  const settings = { url: "https://example.com/", viewport: "desktop" as const, fullPageScreenshot: false, captureAssets: false, captureSchemaVersion: 1 };
  return {
    id, status: "completed", originalUrl: settings.url, finalUrl: settings.url,
    pageMetadata: { originalUrl: settings.url, finalUrl: settings.url, title, description: "", viewportWidth: 1440, viewportHeight: 900,
      scrollWidth: 1440, scrollHeight: 900, captureTimestamp: "2026-10-21T00:00:00.000Z", captureSchemaVersion: 1, userAgent: "test", languages: ["en"] },
    elements: [], assets: [], screenshot: { width: 1440, height: 900, format: "png", path: "screenshots/viewport.png" },
    warnings: [], errors: [], captureTimestamp: "2026-10-21T00:00:00.000Z", captureSettings: settings,
    manifest: { captureVersion: "1.0.0", sourceUrl: settings.url, timestamp: "2026-10-21T00:00:00.000Z", assetList: [], captureSettings: settings, warnings: [], packageContents: [] },
  };
}

afterEach(() => {
  for (const id of ids) fs.rmSync(getCaptureDir(id), { recursive: true, force: true });
});

describe("flow safety", () => {
  it("flags actions that could pay, send, submit, or delete", () => {
    expect(classifyActionRisk({ type: "click", label: "Send money" })).toBe("high");
    expect(classifyActionRisk({ type: "click", label: "Place order" })).toBe("high");
    expect(classifyActionRisk({ type: "click", label: "Delete account" })).toBe("high");
    expect(classifyActionRisk({ type: "press", key: "Enter", label: "Enter" })).toBe("high");
    expect(classifyActionRisk({ type: "click", label: "History" })).toBe("low");
    expect(classifyActionRisk({ type: "click", label: "Sender details" })).toBe("low");
    expect(classifyActionRisk({ type: "fill", selector: "#a", value: "x", label: "Amount" })).toBe("low");
  });

  it("detects secret and payment fields", () => {
    expect(isSensitiveField({ type: "password" })).toBe(true);
    expect(isSensitiveField({ autocomplete: "section-pay cc-number" })).toBe(true);
    expect(isSensitiveField({ name: "card_number" })).toBe(true);
    expect(isSensitiveField({ id: "otp-code" })).toBe(true);
    expect(isSensitiveField({ type: "text", name: "recipient" })).toBe(false);
  });

  it("requires a click target", () => {
    expect(flowActionSchema.safeParse({ type: "click", label: "x" }).success).toBe(false);
    expect(flowActionSchema.safeParse({ type: "click", label: "x", text: "Send" }).success).toBe(true);
  });
});

describe("flow graph and export", () => {
  it("builds the replay path from the start step", () => {
    expect(actionPathTo(makeFlow(), ids[2]).map((step) => step.id)).toEqual(ids);
  });

  it("exports ordered steps, transitions, per-step designs, and redacts typed values", async () => {
    const flow = makeFlow();
    const screenshot = Buffer.from("png");
    for (const [index, id] of ids.entries()) await saveCaptureToStorage(makeCapture(id, `State ${index + 1}`), { viewport: screenshot });

    const archive = await JSZip.loadAsync(await createFlowZip(flow, async (id) => makeCapture(id, `State ${ids.indexOf(id) + 1}`)));
    const flowJson = JSON.parse(await archive.file("flows/send-money.json")!.async("string"));
    expect(flowJson.steps.map((step: { name: string }) => step.name)).toEqual(["Step 1", "Step 2", "Step 3"]);
    expect(flowJson.transitions).toHaveLength(2);
    expect(flowJson.steps[2].action.value).toBe("[redacted]");
    expect(JSON.stringify(flowJson)).not.toContain("42.00");
    expect(flowJson.steps[1].risk).toBe("high");
    const secondDesign = JSON.parse(await archive.file(flowJson.steps[1].design)!.async("string"));
    expect(secondDesign.pageTitle).toBe("State 2");
    expect(archive.file(flowJson.steps[0].screenshot)).not.toBeNull();
    expect(JSON.parse(await archive.file("manifest.json")!.async("string")).counts.states).toBe(3);
  });

  it("leaves out expired steps with a warning", async () => {
    const archive = await JSZip.loadAsync(await createFlowZip(makeFlow(), async (id) => id === ids[1] ? null : makeCapture(id, "State")));
    const flowJson = JSON.parse(await archive.file("flows/send-money.json")!.async("string"));
    expect(flowJson.steps).toHaveLength(2);
    expect(flowJson.transitions).toHaveLength(0);
    expect(JSON.parse(await archive.file("manifest.json")!.async("string")).warnings[0]).toContain("Step 2");
  });
});
