import crypto from "node:crypto";
import type { Page } from "playwright";
import { v4 as uuidv4 } from "uuid";
import {
  captureOpenPage, collectConsoleErrors, createCaptureRecord, getViewportConfig,
  installRequestPolicy, launchBrowser, navigateWithRetry, NAVIGATION_TIMEOUT,
} from "./capture";
import { validateUrl } from "./url-validator";
import { validatePublicNetworkUrl } from "./server-url-validator";
import { classifyActionRisk, isSensitiveField } from "./flow-safety";
import {
  actionPathTo, describeAction, FLOW_SCHEMA_VERSION, MAX_FLOW_STEPS,
  type FlowAction, type FlowRecord, type FlowStep, type FlowTarget,
} from "./flow-types";
import type { CaptureResult } from "./types";

const ACTION_TIMEOUT = 5_000;

export class FlowActionError extends Error {
  constructor(message: string, readonly code: "REPLAY_FAILED" | "ACTION_FAILED" | "SENSITIVE_FIELD" | "BRANCH_CLOSED" | "STEP_LIMIT") {
    super(message);
  }
}

/** Create a flow whose first step is the captured start page. */
export async function createFlow(name: string, startUrl: string, viewport: FlowRecord["viewport"]): Promise<FlowRecord> {
  const now = new Date().toISOString();
  const flow: FlowRecord = {
    schemaVersion: FLOW_SCHEMA_VERSION, id: uuidv4(), name, startUrl, viewport, steps: [], createdAt: now, updatedAt: now,
  };
  await recordFlowStep(flow, null, { type: "start" });
  return flow;
}

/**
 * Replay the path to `parentId` in a fresh browser, perform `action`, then capture the resulting state
 * as a new step. The flow is updated in place; the caller persists it.
 */
export async function recordFlowStep(flow: FlowRecord, parentId: string | null, action: FlowAction, name?: string): Promise<FlowStep> {
  if (flow.steps.length >= MAX_FLOW_STEPS) throw new FlowActionError(`A flow can have at most ${MAX_FLOW_STEPS} steps.`, "STEP_LIMIT");
  const path = parentId ? actionPathTo(flow, parentId) : [];
  if (parentId && !path.length) throw new FlowActionError("The step to continue from no longer exists.", "REPLAY_FAILED");
  // Replaying a confirmed high-risk action would repeat it on the live site, so that branch ends there.
  if (path.some((step) => step.risk === "high")) {
    throw new FlowActionError("Steps can't be recorded after a high-risk action, because replaying it would repeat it on the live site.", "BRANCH_CLOSED");
  }

  const startUrl = await assertPublicUrl(flow.startUrl);
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ viewport: getViewportConfig(flow.viewport), locale: "en-US" });
    await installRequestPolicy(context);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT);
    const consoleErrors = collectConsoleErrors(page);
    await navigateWithRetry(page, startUrl);
    await settle(page);

    for (const [index, step] of path.entries()) {
      if (step.action.type === "start") continue;
      try {
        await performAction(page, step.action);
      } catch (error) {
        throw new FlowActionError(`Replay stopped at step ${index + 1} (“${step.name}”): ${messageOf(error)}`, "REPLAY_FAILED");
      }
    }
    if (action.type !== "start") {
      try {
        await performAction(page, action);
      } catch (error) {
        if (error instanceof FlowActionError) throw error;
        throw new FlowActionError(`${describeAction(action)} failed: ${messageOf(error)}`, "ACTION_FAILED");
      }
    }
    // A blocked or failed navigation leaves Chromium on its own error page; that is not a state of the site.
    if (!/^https?:/.test(page.url())) {
      throw new FlowActionError(`${describeAction(action)} led to a page that couldn't be loaded (blocked or unreachable), so no step was saved.`, "ACTION_FAILED");
    }

    const capture = createCaptureRecord(page.url(), {
      viewport: flow.viewport, fullPageScreenshot: true, captureAssets: true, captureSchemaVersion: 1,
    });
    capture.flowId = flow.id;
    await captureOpenPage(page, capture, consoleErrors);
    await context.close();

    const parent = parentId ? flow.steps.find((step) => step.id === parentId) : undefined;
    const fingerprint = fingerprintCapture(capture);
    const warnings = [...capture.warnings];
    if (parent && parent.fingerprint === fingerprint) warnings.unshift("No visible change was detected since the previous step.");
    const step: FlowStep = {
      id: uuidv4(),
      name: (name || "").trim() || defaultStepName(flow, action, capture),
      parentId,
      action,
      risk: classifyActionRisk(action),
      captureId: capture.id,
      url: capture.finalUrl,
      title: capture.pageMetadata.title,
      fingerprint,
      warnings,
      createdAt: new Date().toISOString(),
    };
    // Insert right after the parent's last descendant in display order so branches stay grouped.
    const parentIndex = parent ? flow.steps.lastIndexOf(lastDescendant(flow, parent)) : -1;
    flow.steps.splice(parent ? parentIndex + 1 : flow.steps.length, 0, step);
    flow.updatedAt = step.createdAt;
    return step;
  } finally {
    await browser.close();
  }
}

/** Execute one recorded action and wait for the page to settle. */
export async function performAction(page: Page, action: FlowAction): Promise<void> {
  switch (action.type) {
    case "start":
      return;
    case "click": {
      const locator = action.selector
        ? page.locator(action.selector).first()
        : action.text
          ? page.getByRole("button", { name: action.text }).or(page.getByRole("link", { name: action.text })).or(page.getByText(action.text)).first()
          : null;
      try {
        if (!locator) throw new Error("No selector");
        await locator.click({ timeout: ACTION_TIMEOUT });
      } catch (error) {
        if (!action.point) throw new Error(`Could not find “${action.label || action.text || action.selector}” on the page.`);
        // Fall back to the point the user picked on the screenshot (document coordinates).
        const scroll = await page.evaluate(({ y }) => {
          window.scrollTo(0, Math.max(0, y - innerHeight / 2));
          return { x: scrollX, y: scrollY };
        }, action.point);
        await page.mouse.click(action.point.x - scroll.x, action.point.y - scroll.y);
      }
      break;
    }
    case "fill": {
      const locator = page.locator(action.selector).first();
      const attributes = await locator.evaluate((el) => ({
        type: el.getAttribute("type"), name: el.getAttribute("name"), autocomplete: el.getAttribute("autocomplete"), id: el.id,
      }), undefined, { timeout: ACTION_TIMEOUT }).catch(() => null);
      if (!attributes) throw new Error(`Could not find the field “${action.label}”.`);
      if (isSensitiveField(attributes)) {
        throw new FlowActionError("The recorder does not type into password, one-time-code, or payment fields.", "SENSITIVE_FIELD");
      }
      await locator.fill(action.value, { timeout: ACTION_TIMEOUT });
      break;
    }
    case "press":
      await page.keyboard.press(action.key === "Space" ? " " : action.key);
      break;
    case "wait":
      await page.waitForTimeout(action.ms);
      break;
    case "navigate":
      await navigateWithRetry(page, await assertPublicUrl(action.url));
      break;
  }
  await settle(page);
}

/** Bounded wait for navigation and network activity triggered by an action; never waits indefinitely. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}

async function assertPublicUrl(url: string): Promise<string> {
  const validation = validateUrl(url);
  if (!validation.valid || !validation.parsedUrl) throw new FlowActionError(validation.error || "Invalid URL", "ACTION_FAILED");
  if (!(await validatePublicNetworkUrl(validation.parsedUrl))) {
    throw new FlowActionError("This URL does not resolve to a public network address.", "ACTION_FAILED");
  }
  return validation.parsedUrl.href;
}

/** Cheap visual-state signature: URL plus the visible structure and text. Equal fingerprints mean "nothing changed". */
export function fingerprintCapture(capture: Pick<CaptureResult, "finalUrl" | "elements">): string {
  const hash = crypto.createHash("sha256").update(capture.finalUrl);
  for (const element of capture.elements) {
    const rect = element.boundingRect;
    hash.update(`|${element.tag}:${element.textContent.slice(0, 80)}:${rect.x},${rect.y},${rect.width},${rect.height}`);
  }
  return hash.digest("hex").slice(0, 24);
}

/** Clickable and fillable elements of a captured step, for the target picker. */
export function flowTargetsFromCapture(capture: CaptureResult): FlowTarget[] {
  return capture.elements
    .filter((element) => element.selector && element.boundingRect.width > 0 && element.boundingRect.height > 0)
    .map((element) => ({
      selector: element.selector!,
      tag: element.tag,
      label: (element.textContent || element.alt || element.tag).replace(/\s+/g, " ").trim().slice(0, 80),
      rect: element.boundingRect,
      fillable: ["input", "textarea"].includes(element.tag),
    }));
}

function defaultStepName(flow: FlowRecord, action: FlowAction, capture: CaptureResult): string {
  if (action.type === "start") return capture.pageMetadata.title ? `Start — ${capture.pageMetadata.title}`.slice(0, 80) : "Start";
  return `Step ${flow.steps.length + 1}`;
}

function lastDescendant(flow: FlowRecord, step: FlowStep): FlowStep {
  let last = step;
  for (const candidate of flow.steps) {
    if (actionPathTo(flow, candidate.id).includes(step)) {
      if (flow.steps.indexOf(candidate) > flow.steps.indexOf(last)) last = candidate;
    }
  }
  return last;
}

function messageOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 300);
}
