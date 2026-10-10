import { NextRequest, NextResponse } from "next/server";
import type { CaptureResult } from "@/lib/types";
import { createCaptureZip, createSiteCaptureZip } from "@/lib/zip-export";
import { readCapture, readFigmaImportTicket } from "@/lib/storage";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  const { token } = params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return NextResponse.json({ error: "This Figma transfer link is invalid." }, { status: 404, headers: corsHeaders });
  }

  try {
    const ticket = await readFigmaImportTicket(token);
    if (!ticket || Date.parse(ticket.expiresAt) <= Date.now()) {
      return NextResponse.json({ error: "This Figma transfer link has expired. Create a new link in HTML to Figma." }, { status: 410, headers: corsHeaders });
    }
    const captures: CaptureResult[] = [];
    for (const id of ticket.captureIds) {
      const capture = await readCapture(id);
      if (capture?.status === "completed") captures.push(capture);
    }
    if (!captures.length) {
      return NextResponse.json({ error: "The capture package is no longer available." }, { status: 404, headers: corsHeaders });
    }

    const archive = captures.length === 1
      ? await createCaptureZip(captures[0])
      : await createSiteCaptureZip(captures);
    return new NextResponse(archive as unknown as BodyInit, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Length": String(archive.length),
        "Content-Disposition": 'attachment; filename="figma-import.zip"',
      },
    });
  } catch (error) {
    console.error("Figma import package error:", error);
    return NextResponse.json({ error: "Could not prepare the Figma import package." }, { status: 500, headers: corsHeaders });
  }
}
