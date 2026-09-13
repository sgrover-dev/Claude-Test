import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { createCheckoutSession, isStripeEnabled } from "@/lib/payments/stripe";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const paymentId = url.searchParams.get("payment");
  if (!paymentId) return NextResponse.json({ error: "Missing payment" }, { status: 400 });
  if (!isStripeEnabled()) return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, url.origin));
  const payment = await db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId), with: { inquiry: true } });
  if (!payment?.inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const owns = payment.inquiry.userId === user.id || payment.inquiry.contactEmail === user.email;
  if (!owns) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const base = `${url.origin}/account/inquiries/${payment.inquiryId}`;
  const checkoutUrl = await createCheckoutSession(payment.id, { successUrl: `${base}?paid=1`, cancelUrl: `${base}?cancelled=1`, customerEmail: user.email });
  return NextResponse.redirect(checkoutUrl);
}
