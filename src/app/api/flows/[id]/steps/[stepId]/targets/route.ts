import { NextRequest, NextResponse } from "next/server";
import { flowTargetsFromCapture } from "@/lib/flow-recorder";
import { flowErrorResponse, flowNotFound } from "@/lib/flow-api";
import { readCapture, readFlow } from "@/lib/storage";

export const runtime = "nodejs";

/** Clickable/fillable elements of a step's capture, plus the screenshot size their rects refer to. */
export async function GET(_request: NextRequest, { params }: { params: { id: string; stepId: string } }) {
  try {
    const flow = await readFlow(params.id);
    const step = flow?.steps.find((candidate) => candidate.id === params.stepId);
    if (!flow || !step) return flowNotFound();
    const capture = await readCapture(step.captureId);
    if (!capture) return NextResponse.json({ error: "This step's capture has expired.", code: "NOT_FOUND" }, { status: 404 });
    const image = capture.fullPageScreenshot || capture.screenshot;
    return NextResponse.json({
      targets: flowTargetsFromCapture(capture),
      image: {
        url: `/api/captures/${capture.id}/screenshot${capture.fullPageScreenshot ? "?variant=full" : ""}`,
        width: image?.width || capture.pageMetadata.viewportWidth,
        height: image?.height || capture.pageMetadata.viewportHeight,
      },
    });
  } catch (error) {
    return flowErrorResponse(error);
  }
}
