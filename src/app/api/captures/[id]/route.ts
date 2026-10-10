import { type NextRequest, NextResponse } from "next/server";
import { readCapture } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Capture not found", code: "NOT_FOUND" }, { status: 404 });
    }

    const pageData = await readCapture(id);

    if (!pageData) {
      return NextResponse.json({ error: "Capture data not found", code: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json(pageData);

  } catch (error) {
    console.error("Capture status error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "STATUS_ERROR" },
      { status: 500 }
    );
  }
}
