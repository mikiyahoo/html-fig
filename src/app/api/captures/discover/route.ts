import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { discoverInternalPages } from "@/lib/capture";

const discoverySchema = z.object({ url: z.string().url() });

export async function POST(request: NextRequest) {
  try {
    const parsed = discoverySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: "Enter a valid HTTP or HTTPS URL." }, { status: 400 });
    }
    const pages = await discoverInternalPages(parsed.data.url, 10);
    return NextResponse.json({ pages, limit: 10 });
  } catch (error) {
    console.error("Page discovery error:", error);
    return NextResponse.json({
      error: "Could not discover pages",
      code: "DISCOVERY_ERROR",
      details: error instanceof Error ? error.message.slice(0, 300) : "Unexpected discovery error.",
    }, { status: 500 });
  }
}
