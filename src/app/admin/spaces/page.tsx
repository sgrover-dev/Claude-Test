import Link from "next/link";
import { PageHeader, StatusPill, Table, Td } from "@/components/admin/ui";
import { listSpacesForAdmin } from "@/lib/data/admin";
import { formatCents, relativeTime } from "@/lib/format";
import { isStale } from "@/lib/inventory/quality";

const MISSING = [["", "Any"], ["capacity", "Capacity"], ["pricing", "Pricing"], ["photos", "Photos"], ["privacy", "Privacy"], ["description", "Description"], ["amenities", "Amenities"], ["contact", "Events contact"]];

export default async function SpacesAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const filter = { q: sp.q, missing: sp.missing, stale: sp.stale === "1", status: sp.status, verification: sp.verification, sort: sp.sort, page: sp.page ? parseInt(sp.page, 10) : 1 };
  const { rows, total, page, pageSize } = await listSpacesForAdmin(filter);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
    return `/admin/spaces?${p}`;
  };
  return (
    <>
      <PageHeader title="Spaces" eyebrow={`${total} matching`} />
      <form className="mb-4 flex flex-wrap items-end gap-2 text-[13px]">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search space or restaurant" className="input !w-64 !py-1.5" />
        <label className="flex flex-col"><span className="text-[11px] text-ink-500">Missing</span>
          <select name="missing" defaultValue={sp.missing ?? ""} className="input !w-auto !py-1.5">{MISSING.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="flex flex-col"><span className="text-[11px] text-ink-500">Verification</span>
          <select name="verification" defaultValue={sp.verification ?? ""} className="input !w-auto !py-1.5"><option value="">Any</option><option value="unverified">Unverified</option><option value="publicly_listed">Publicly listed</option><option value="verified">Verified</option></select>
        </label>
        <label className="flex flex-col"><span className="text-[11px] text-ink-500">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="input !w-auto !py-1.5"><option value="">Active + draft</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
        </label>
        <label className="flex flex-col"><span className="text-[11px] text-ink-500">Sort</span>
          <select name="sort" defaultValue={sp.sort ?? ""} className="input !w-auto !py-1.5"><option value="">Least complete first</option><option value="completeness_desc">Most complete first</option><option value="verified">Oldest verification</option><option value="updated">Recently updated</option><option value="name">Name</option></select>
        </label>
        <label className="flex items-center gap-1.5 pb-2"><input type="checkbox" name="stale" value="1" defaultChecked={sp.stale === "1"} className="accent-rope-600" /> Stale only</label>
        <button className="btn-secondary btn-sm">Apply</button>
        <Link href="/admin/spaces" className="btn-ghost btn-sm">Reset</Link>
      </form>
      <Table head={["Space", "Restaurant", "Type · privacy", "Capacity", "Pricing", "Photos", "Verification", "Score", "Updated"]}>
        {rows.map((s) => (
          <tr key={s.id} className="hover:bg-ink-50">
            <Td><Link href={`/admin/spaces/${s.id}`} className="font-medium text-ink-900 hover:text-rope-700">{s.name}</Link>{s.status !== "active" ? <span className="ml-1 text-[11px] text-ink-500">({s.status})</span> : null}</Td>
            <Td className="text-ink-700">{s.restaurantName}<span className="block text-[11.5px] text-ink-500">{s.neighborhoodName ?? "—"}</span></Td>
            <Td className="text-ink-600">{s.spaceType.replace(/_/g, " ")}<span className="block text-[11.5px]">{s.privacy?.replace(/_/g, " ") ?? <span className="text-gold-700">privacy?</span>}</span></Td>
            <Td>{s.maxSeated ?? "—"} / {s.maxStanding ?? "—"}</Td>
            <Td>{s.fbMinimumCents ? `min ${formatCents(s.fbMinimumCents)}` : s.estPerPersonLowCents ? `${formatCents(s.estPerPersonLowCents)}/pp` : s.roomFeeCents ? `room ${formatCents(s.roomFeeCents)}` : <span className="text-gold-700">—</span>}</Td>
            <Td>{s.photoCount || <span className="text-gold-700">0</span>}</Td>
            <Td><StatusPill value={s.verificationStatus} />{isStale(s.lastVerifiedAt) ? <span className="ml-1 text-[11px] text-gold-700">stale</span> : null}</Td>
            <Td><span className={s.completenessScore < 60 ? "text-gold-700" : "text-sage-700"}>{s.completenessScore}%</span></Td>
            <Td className="text-ink-500">{relativeTime(s.updatedAt)}</Td>
          </tr>
        ))}
      </Table>
      {total > pageSize ? (
        <div className="mt-3 flex items-center gap-2 text-[13px]">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="btn-secondary btn-sm">Previous</Link> : null}
          <span className="text-ink-600">Page {page} of {Math.ceil(total / pageSize)}</span>
          {page * pageSize < total ? <Link href={qs({ page: String(page + 1) })} className="btn-secondary btn-sm">Next</Link> : null}
        </div>
      ) : null}
    </>
  );
}
