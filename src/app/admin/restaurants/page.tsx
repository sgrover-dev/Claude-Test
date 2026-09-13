import Link from "next/link";
import { PageHeader, StatusPill, Table, Td } from "@/components/admin/ui";
import { listRestaurantsForAdmin } from "@/lib/data/admin";
import { relativeTime } from "@/lib/format";
import { CUISINES, labelFor } from "@/lib/taxonomy";

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await listRestaurantsForAdmin(q);
  return (
    <>
      <PageHeader title="Restaurants" eyebrow={`${rows.length} shown`} actions={<Link href="/admin/restaurants/new" className="btn-dark btn-sm">New restaurant</Link>} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Search restaurants" className="input !w-72 !py-1.5" />
        <button className="btn-secondary btn-sm">Search</button>
      </form>
      <Table head={["Restaurant", "Neighborhood", "Cuisine", "Spaces", "Events contact", "Status", "Updated"]}>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-ink-50">
            <Td>
              <Link href={`/admin/restaurants/${r.id}`} className="font-medium text-ink-900 hover:text-rope-700">{r.name}</Link>
              {r.claimedAt ? <span className="ml-1 text-[11px] text-sage-700">claimed</span> : null}
            </Td>
            <Td>{r.neighborhood ?? "—"}</Td>
            <Td className="text-ink-600">{r.cuisines.map((c) => labelFor(CUISINES, c)).join(", ") || "—"}</Td>
            <Td>{r.spaceCount}{r.locationCount > 1 ? <span className="text-ink-500"> · {r.locationCount} locations</span> : null}</Td>
            <Td className="text-ink-600">
              {r.eventsContactEmail ?? r.eventsContactPhone ?? <span className="text-gold-700">none</span>}
              {r.contactVerifiedAt ? <span className="ml-1 text-[11px] text-sage-700">✓</span> : null}
            </Td>
            <Td><StatusPill value={r.status} /></Td>
            <Td className="text-ink-500">{relativeTime(r.updatedAt)}</Td>
          </tr>
        ))}
      </Table>
    </>
  );
}
