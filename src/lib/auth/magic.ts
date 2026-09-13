import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";
import { generateToken, hashToken } from "./tokens";
import { createSession } from "./session";

const MAGIC_LINK_MINUTES = 15;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function appUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

function safeRedirect(redirectTo?: string | null) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) return "/account";
  return redirectTo;
}

export async function requestMagicLink(rawEmail: string, redirectTo?: string | null) {
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) throw new Error("Please enter a valid email address.");
  const token = generateToken();
  await db.insert(schema.magicLinks).values({
    email,
    tokenHash: hashToken(token),
    redirectTo: safeRedirect(redirectTo),
    expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000),
  });
  const link = appUrl(`/auth/verify?token=${encodeURIComponent(token)}`);
  const result = await sendEmail({
    to: email,
    subject: "Your Red Rope sign-in link",
    text: `Click to sign in to Red Rope:\n\n${link}\n\nThis link expires in ${MAGIC_LINK_MINUTES} minutes. If you didn't request it, you can ignore this email.`,
    html: `<p>Click to sign in to Red Rope:</p><p><a href="${link}">${link}</a></p><p>This link expires in ${MAGIC_LINK_MINUTES} minutes.</p>`,
  });
  if (!result.ok) throw new Error(`Could not send email: ${result.error}`);
  return { email, link };
}

export async function verifyMagicLink(token: string): Promise<{ redirectTo: string } | { error: string }> {
  const tokenHash = hashToken(token);
  const link = await db.query.magicLinks.findFirst({
    where: and(eq(schema.magicLinks.tokenHash, tokenHash), isNull(schema.magicLinks.consumedAt)),
  });
  if (!link) return { error: "This sign-in link is invalid or has already been used." };
  if (link.expiresAt.getTime() < Date.now()) return { error: "This sign-in link has expired. Request a new one." };

  await db.update(schema.magicLinks).set({ consumedAt: new Date() }).where(eq(schema.magicLinks.id, link.id));

  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
  const isAdmin = adminEmails.includes(link.email);

  const [user] = await db
    .insert(schema.users)
    .values({ email: link.email, role: isAdmin ? "admin" : "consumer", lastLoginAt: new Date() })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { lastLoginAt: new Date(), ...(isAdmin ? { role: "admin" as const } : {}) },
    })
    .returning();

  // Attach any inquiries submitted with this email before the account existed.
  await db
    .update(schema.inquiries)
    .set({ userId: user.id })
    .where(and(eq(schema.inquiries.contactEmail, link.email), isNull(schema.inquiries.userId)));

  await createSession(user.id);
  return { redirectTo: link.redirectTo ?? "/account" };
}
