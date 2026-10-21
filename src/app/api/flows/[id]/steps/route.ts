import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordFlowStep } from "@/lib/flow-recorder";
import { flowErrorResponse, flowNotFound } from "@/lib/flow-api";
import { classifyActionRisk, riskExplanation } from "@/lib/flow-safety";
import { flowActionSchema } from "@/lib/flow-types";
import { assertStorageConfigured, readFlow, saveFlow } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const stepSchema = z.object({
  parentStepId: z.string().uuid(),
  action: flowActionSchema,
  name: z.string().trim().max(120).optional(),
  /** Required for actions classified as high risk; the user has seen and accepted the warning. */
  confirmRisk: z.boolean().optional(),
});

/** Replay the path to the parent step, perform the new action, and capture the result as a step. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertStorageConfigured();
    const parsed = stepSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid step.", code: "VALIDATION_FAILED" }, { status: 400 });
    }
    const { action, parentStepId, name, confirmRisk } = parsed.data;
    if (action.type === "start") return NextResponse.json({ error: "Choose an action to record.", code: "VALIDATION_FAILED" }, { status: 400 });
    if (classifyActionRisk(action) === "high" && !confirmRisk) {
      return NextResponse.json({ error: riskExplanation(action), code: "RISK_CONFIRMATION_REQUIRED" }, { status: 409 });
    }

    const flow = await readFlow(params.id);
    if (!flow) return flowNotFound();
    if (!flow.steps.some((step) => step.id === parentStepId)) {
      return NextResponse.json({ error: "The step to continue from no longer exists.", code: "NOT_FOUND" }, { status: 404 });
    }
    const step = await recordFlowStep(flow, parentStepId, action, name);
    // Recording takes a while; re-read so renames saved meanwhile are kept, then insert where the recorder placed the step.
    const latest = await readFlow(flow.id);
    if (!latest) return flowNotFound();
    const previousId = flow.steps[flow.steps.indexOf(step) - 1]?.id;
    const insertAt = latest.steps.findIndex((existing) => existing.id === previousId) + 1;
    latest.steps.splice(insertAt > 0 ? insertAt : latest.steps.length, 0, step);
    latest.updatedAt = step.createdAt;
    await saveFlow(latest);
    return NextResponse.json({ flow: latest, step }, { status: 201 });
  } catch (error) {
    return flowErrorResponse(error);
  }
}
