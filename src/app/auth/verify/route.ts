import { NextResponse } from "next/server";
import { verifyMagicLink } from "@/lib/auth/magic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=Missing+token", url.origin));
  const result = await verifyMagicLink(token);
  if ("error" in result) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(result.error)}`, url.origin));
  return NextResponse.redirect(new URL(result.redirectTo, url.origin));
}
