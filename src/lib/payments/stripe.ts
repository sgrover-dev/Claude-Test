import "server-only";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { addInquiryEvent, setInquiryStatus } from "@/lib/data/inquiries";

let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
}

export function isStripeEnabled() {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Red Rope collects its own deposit/fee. Restaurant settlement is deliberately
 * out of scope (future: Stripe Connect), so this never touches venue payouts.
 */
export async function createDepositRequest(inquiryId: string, amountCents: number, description: string, actorUserId: string | null) {
  const [payment] = await db
    .insert(schema.payments)
    .values({ inquiryId, kind: "red_rope_deposit", amountCents, description, status: "pending" })
    .returning();
  await addInquiryEvent({ inquiryId, kind: "deposit_request", actorUserId, subject: `Deposit requested: $${(amountCents / 100).toLocaleString()}`, body: description, metadata: { paymentId: payment.id } });
  const inquiry = await db.query.inquiries.findFirst({ where: eq(schema.inquiries.id, inquiryId) });
  if (inquiry && inquiry.status !== "deposit_required" && ["customer_selected", "options_available", "customer_reviewing", "booking_pending"].includes(inquiry.status)) {
    await setInquiryStatus(inquiryId, "deposit_required", actorUserId, "Deposit requested");
  }
  return payment;
}

export async function createCheckoutSession(paymentId: string, opts: { successUrl: string; cancelUrl: string; customerEmail?: string | null }) {
  const s = getStripe();
  if (!s) throw new Error("Stripe is not configured");
  const payment = await db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
  if (!payment || payment.status !== "pending") throw new Error("Payment is not payable");
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer_email: opts.customerEmail ?? undefined,
    line_items: [{ price_data: { currency: payment.currency, unit_amount: payment.amountCents, product_data: { name: payment.description ?? "Red Rope deposit" } }, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    metadata: { paymentId: payment.id, inquiryId: payment.inquiryId ?? "" },
  });
  await db.update(schema.payments).set({ stripeCheckoutSessionId: session.id, updatedAt: new Date() }).where(eq(schema.payments.id, payment.id));
  return session.url!;
}

export async function markPaymentSucceeded(paymentId: string, paymentIntentId: string | null) {
  const [payment] = await db
    .update(schema.payments)
    .set({ status: "succeeded", stripePaymentIntentId: paymentIntentId, updatedAt: new Date() })
    .where(eq(schema.payments.id, paymentId))
    .returning();
  if (payment?.inquiryId) {
    await addInquiryEvent({ inquiryId: payment.inquiryId, kind: "system", actorType: "system", subject: `Deposit received: $${(payment.amountCents / 100).toLocaleString()}`, metadata: { paymentId } });
    const inquiry = await db.query.inquiries.findFirst({ where: eq(schema.inquiries.id, payment.inquiryId) });
    if (inquiry?.status === "deposit_required") await setInquiryStatus(payment.inquiryId, "booking_pending", null, "Deposit paid");
  }
  return payment;
}
