import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const file = await storage.get(decodeURIComponent(key));
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), { headers: { "Content-Type": file.contentType, "Cache-Control": "public, max-age=31536000, immutable" } });
}
