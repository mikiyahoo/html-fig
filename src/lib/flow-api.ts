import { NextResponse } from "next/server";
import { FlowActionError } from "./flow-recorder";
import type { FlowRecord } from "./flow-types";

const STATUS_BY_CODE: Record<FlowActionError["code"], number> = {
  REPLAY_FAILED: 422,
  ACTION_FAILED: 422,
  SENSITIVE_FIELD: 422,
  BRANCH_CLOSED: 409,
  STEP_LIMIT: 409,
};

/** Map recorder and browser failures to the stable `{ error, code }` response shape. */
export function flowErrorResponse(error: unknown): NextResponse {
  if (error instanceof FlowActionError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS_BY_CODE[error.code] });
  }
  console.error("Flow request error:", error);
  const message = error instanceof Error ? error.message : "";
  if (/Executable doesn't exist|Please run npx playwright install/i.test(message)) {
    return NextResponse.json({ error: "Chromium is not installed for Playwright. Run `npx playwright install chromium`, then restart the app.", code: "BROWSER_NOT_INSTALLED" }, { status: 503 });
  }
  if (/storage is not connected/i.test(message)) {
    return NextResponse.json({ error: message, code: "STORAGE_NOT_CONFIGURED" }, { status: 503 });
  }
  return NextResponse.json({ error: message.split("\n")[0].slice(0, 300) || "The flow request failed.", code: "FLOW_ERROR" }, { status: 500 });
}

export function flowNotFound(): NextResponse {
  return NextResponse.json({ error: "This flow no longer exists.", code: "NOT_FOUND" }, { status: 404 });
}

/** List-view shape: enough to render a card without loading every step. */
export function toFlowSummary(flow: FlowRecord) {
  return {
    id: flow.id,
    name: flow.name,
    startUrl: flow.startUrl,
    viewport: flow.viewport,
    stepCount: flow.steps.length,
    coverCaptureId: flow.steps[0]?.captureId || null,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  };
}

export type FlowSummary = ReturnType<typeof toFlowSummary>;
