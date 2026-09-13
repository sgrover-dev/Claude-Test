import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SpaceForm } from "@/components/admin/SpaceForm";
import { PageHeader } from "@/components/admin/ui";

export default async function NewSpacePage({ searchParams }: { searchParams: Promise<{ location?: string }> }) {
  const { location } = await searchParams;
  if (!location) notFound();
  const loc = await db.query.locations.findFirst({ where: eq(schema.locations.id, location), with: { restaurant: true } });
  if (!loc) notFound();
  return (
    <>
      <PageHeader title={`New space at ${loc.restaurant.name}`} back={{ href: `/admin/restaurants/${loc.restaurantId}`, label: loc.restaurant.name }} />
      <SpaceForm locationId={loc.id} />
    </>
  );
}
