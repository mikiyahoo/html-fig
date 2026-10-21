import { NextRequest, NextResponse } from "next/server";
import { flowErrorResponse, flowNotFound } from "@/lib/flow-api";
import { readCapture, readFlow } from "@/lib/storage";
import { createFlowZip } from "@/lib/zip-export";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const flow = await readFlow(params.id);
    if (!flow) return flowNotFound();
    const archive = await createFlowZip(flow, readCapture);
    const filename = `${flow.name.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-|-$/g, "") || "flow"}-flow.zip`;
    return new NextResponse(archive as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(archive.length),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return flowErrorResponse(error);
  }
}
