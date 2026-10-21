import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { flowErrorResponse, flowNotFound } from "@/lib/flow-api";
import { deleteCaptureProject, deleteFlow, readFlow, saveFlow } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const flow = await readFlow(params.id);
    return flow ? NextResponse.json({ flow }) : flowNotFound();
  } catch (error) {
    return flowErrorResponse(error);
  }
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  /** The full desired step list in display order. Steps left out are deleted. */
  steps: z.array(z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    note: z.string().max(1_000).optional(),
  })).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const flow = await readFlow(params.id);
    if (!flow) return flowNotFound();
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid flow update.", code: "VALIDATION_FAILED" }, { status: 400 });

    if (parsed.data.name) flow.name = parsed.data.name;
    let removed: typeof flow.steps = [];
    if (parsed.data.steps) {
      const byId = new Map(flow.steps.map((step) => [step.id, step]));
      if (parsed.data.steps.some((update) => !byId.has(update.id)) || new Set(parsed.data.steps.map((update) => update.id)).size !== parsed.data.steps.length) {
        return NextResponse.json({ error: "The step list doesn't match this flow. Reload and try again.", code: "STEP_MISMATCH" }, { status: 409 });
      }
      const kept = new Set(parsed.data.steps.map((update) => update.id));
      removed = flow.steps.filter((step) => !kept.has(step.id));
      // Later steps are reproduced by replaying their parents, so a parent can't be removed while its children stay.
      const orphan = flow.steps.find((step) => kept.has(step.id) && step.parentId && !kept.has(step.parentId));
      if (orphan) {
        return NextResponse.json({ error: `Delete the steps recorded after “${byId.get(orphan.parentId!)!.name}” first.`, code: "STEP_HAS_CHILDREN" }, { status: 409 });
      }
      flow.steps = parsed.data.steps.map((update) => ({ ...byId.get(update.id)!, name: update.name, note: update.note ?? byId.get(update.id)!.note }));
    }
    flow.updatedAt = new Date().toISOString();
    await saveFlow(flow);
    for (const step of removed) await deleteCaptureProject(step.captureId);
    return NextResponse.json({ flow });
  } catch (error) {
    return flowErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const flow = await readFlow(params.id);
    if (!flow) return flowNotFound();
    await deleteFlow(flow);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return flowErrorResponse(error);
  }
}
