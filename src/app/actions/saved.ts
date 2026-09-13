"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";

export async function toggleSavedSpace(spaceId: string, currentPath: string): Promise<{ saved: boolean } | { redirect: string }> {
  const user = await getCurrentUser();
  if (!user) return { redirect: `/login?next=${encodeURIComponent(currentPath)}` };
  const existing = await db.query.savedSpaces.findFirst({ where: and(eq(schema.savedSpaces.userId, user.id), eq(schema.savedSpaces.spaceId, spaceId)) });
  if (existing) {
    await db.delete(schema.savedSpaces).where(eq(schema.savedSpaces.id, existing.id));
    revalidatePath("/account");
    return { saved: false };
  }
  await db.insert(schema.savedSpaces).values({ userId: user.id, spaceId });
  revalidatePath("/account");
  return { saved: true };
}

export async function saveSearch(name: string, query: Record<string, unknown>, currentPath: string): Promise<{ ok: true } | { redirect: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { redirect: `/login?next=${encodeURIComponent(currentPath)}` };
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) return { error: "Give the search a name." };
  await db.insert(schema.savedSearches).values({ userId: user.id, name: trimmed, query });
  revalidatePath("/account");
  return { ok: true };
}

export async function deleteSavedSearch(id: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await db.delete(schema.savedSearches).where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, user.id)));
  revalidatePath("/account");
}
