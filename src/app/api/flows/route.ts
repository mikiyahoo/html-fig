import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateUrl } from "@/lib/url-validator";
import { createFlow } from "@/lib/flow-recorder";
import { flowErrorResponse, toFlowSummary } from "@/lib/flow-api";
import { assertStorageConfigured, cleanupOldCaptures, listFlows, saveFlow } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    await cleanupOldCaptures();
    return NextResponse.json({ flows: (await listFlows()).map(toFlowSummary) });
  } catch (error) {
    return flowErrorResponse(error);
  }
}

const createFlowSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startUrl: z.string().url(),
  viewport: z.enum(["desktop", "tablet", "mobile"]).default("desktop"),
});

export async function POST(request: NextRequest) {
  try {
    assertStorageConfigured();
    const parsed = createFlowSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter a flow name and a valid start URL.", code: "VALIDATION_FAILED" }, { status: 400 });
    const validation = validateUrl(parsed.data.startUrl);
    if (!validation.valid || !validation.parsedUrl) {
      return NextResponse.json({ error: validation.error || "Invalid URL", code: "URL_INVALID" }, { status: 400 });
    }
    const flow = await createFlow(parsed.data.name, validation.parsedUrl.href, parsed.data.viewport);
    await saveFlow(flow);
    return NextResponse.json({ flow }, { status: 201 });
  } catch (error) {
    return flowErrorResponse(error);
  }
}
