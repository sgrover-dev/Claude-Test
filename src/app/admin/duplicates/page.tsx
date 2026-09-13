import Link from "next/link";
import { mergeRestaurants, mergeSpaces } from "@/app/admin/actions/inventory";
import { PageHeader, Panel, SubmitButton } from "@/components/admin/ui";
import { findDuplicates } from "@/lib/data/admin";

export default async function DuplicatesPage() {
  const { spaceDupes, restaurantDupes } = await findDuplicates();
  return (
    <>
      <PageHeader title="Potential duplicates" eyebrow="Same location + similar name, or restaurants with matching names" />
      <div className="space-y-6">
        <Panel title={`Spaces (${spaceDupes.length} groups)`}>
          {spaceDupes.length ? spaceDupes.map((g, i) => (
            <div key={i} className="mb-4 rounded-lg border border-ink-200 p-3">
              <p className="mb-2 text-[12.5px] text-ink-500">{g[0].restaurantName}</p>
              <ul className="space-y-1 text-[13.5px]">
                {g.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/spaces/${s.id}`} className="font-medium hover:text-rope-700">{s.name}</Link>
                    <span className="text-ink-500">{s.completeness}% complete</span>
                    {g.filter((o) => o.id !== s.id).map((o) => (
                      <form key={o.id} action={mergeSpaces}>
                        <input type="hidden" name="sourceId" value={o.id} />
                        <input type="hidden" name="targetId" value={s.id} />
                        <SubmitButton variant="secondary">Keep this, merge “{o.name}” into it</SubmitButton>
                      </form>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )) : <p className="text-[13px] text-ink-500">No duplicate spaces detected.</p>}
        </Panel>
        <Panel title={`Restaurants (${restaurantDupes.length} groups)`}>
          {restaurantDupes.length ? restaurantDupes.map((g, i) => (
            <div key={i} className="mb-4 rounded-lg border border-ink-200 p-3">
              <ul className="space-y-1 text-[13.5px]">
                {g.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/restaurants/${r.id}`} className="font-medium hover:text-rope-700">{r.name}</Link>
                    {g.filter((o) => o.id !== r.id).map((o) => (
                      <form key={o.id} action={mergeRestaurants}>
                        <input type="hidden" name="sourceId" value={o.id} />
                        <input type="hidden" name="targetId" value={r.id} />
                        <SubmitButton variant="secondary">Keep this, merge “{o.name}” into it</SubmitButton>
                      </form>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          )) : <p className="text-[13px] text-ink-500">No duplicate restaurants detected.</p>}
        </Panel>
      </div>
    </>
  );
}
