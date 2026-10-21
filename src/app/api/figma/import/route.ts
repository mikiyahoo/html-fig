import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateCaptureId } from "@/lib/capture";
import { assertStorageConfigured, readCapture, readFlow, saveFigmaImportTicket } from "@/lib/storage";

export const runtime = "nodejs";

const requestSchema = z.union([
  z.object({ captureIds: z.array(z.string().uuid()).min(1).max(10) }),
  z.object({ flowId: z.string().uuid() }),
]);

export async function POST(request: NextRequest) {
  try {
    assertStorageConfigured();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Select at least one completed capture." }, { status: 400 });

    let captureIds: string[] = [];
    let flowId: string | undefined;
    if ("flowId" in parsed.data) {
      const flow = await readFlow(parsed.data.flowId);
      if (!flow || !flow.steps.length) return NextResponse.json({ error: "This flow is no longer available." }, { status: 404 });
      flowId = flow.id;
    } else {
      captureIds = [...new Set(parsed.data.captureIds)];
      for (const id of captureIds) {
        const capture = await readCapture(id);
        if (!capture || capture.status !== "completed") {
          return NextResponse.json({ error: "One of the selected captures is no longer available." }, { status: 404 });
        }
      }
    }

    const token = generateCaptureId();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await saveFigmaImportTicket(token, { captureIds, flowId, expiresAt });
    return NextResponse.json({
      importUrl: `${request.nextUrl.origin}/api/figma/import/${token}`,
      expiresAt,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare the Figma import." }, { status: 500 });
  }
}
