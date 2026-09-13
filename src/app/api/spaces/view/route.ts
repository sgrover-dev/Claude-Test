import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { recordSpaceView } from "@/lib/data/spaces";

const Body = z.object({ spaceId: z.string().uuid(), referrer: z.string().nullable().optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const jar = await cookies();
  let visitorId = jar.get("rr_vid")?.value;
  const res = NextResponse.json({ ok: true });
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    res.cookies.set("rr_vid", visitorId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  const user = await getCurrentUser();
  await recordSpaceView(parsed.data.spaceId, { userId: user?.id ?? null, visitorId, referrer: parsed.data.referrer ?? null }).catch(() => {});
  return res;
}
