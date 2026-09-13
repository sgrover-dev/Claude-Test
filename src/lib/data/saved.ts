import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { listSpacesByIds } from "./spaces";

export async function savedSpaceIdsForCurrentUser(): Promise<Set<string>> {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const rows = await db.select({ spaceId: schema.savedSpaces.spaceId }).from(schema.savedSpaces).where(eq(schema.savedSpaces.userId, user.id));
  return new Set(rows.map((r) => r.spaceId));
}

export async function savedSpacesForUser(userId: string) {
  const rows = await db.select({ spaceId: schema.savedSpaces.spaceId }).from(schema.savedSpaces).where(eq(schema.savedSpaces.userId, userId)).orderBy(desc(schema.savedSpaces.createdAt));
  return listSpacesByIds(rows.map((r) => r.spaceId));
}

export async function savedSearchesForUser(userId: string) {
  return db.query.savedSearches.findMany({ where: eq(schema.savedSearches.userId, userId), orderBy: desc(schema.savedSearches.createdAt) });
}
