import Link from "next/link";
import { notFound } from "next/navigation";
import { addDocument, addPhoto, addProvenance, archiveSpace, deleteDocument, deletePhoto, deleteProvenance, markSpaceVerified, saveAvailabilityRules } from "@/app/admin/actions/inventory";
import { SpaceForm } from "@/components/admin/SpaceForm";
import { Input, Notice, PageHeader, Panel, Select, StatusPill, SubmitButton, Table, Td, TextArea } from "@/components/admin/ui";
import { SpaceImage } from "@/components/space/SpaceImage";
import { ConfidenceBadge } from "@/components/ui";
import { getSpaceForAdmin } from "@/lib/data/admin";
import { inquiriesForSpace, spaceDemandStats } from "@/lib/data/inquiries";
import { formatDate, relativeTime } from "@/lib/format";
import { isStale, missingFields } from "@/lib/inventory/quality";
import { CONFIDENCE_LEVELS, SOURCE_TYPES, labelFor } from "@/lib/taxonomy";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VERIFIABLE_FIELDS = [["maxSeated", "Capacity"], ["privacy", "Privacy"], ["fbMinimumCents", "Minimum"], ["roomFeeCents", "Room fee"], ["estPerPersonLowCents", "Per person"], ["depositCents", "Deposit"], ["serviceChargePct", "Service charge"], ["amenities", "Amenities"], ["cancellationPolicy", "Cancellation"], ["availabilityNotes", "Availability"]];

export default async function SpaceAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const s = await getSpaceForAdmin(id);
  if (!s) notFound();
  const [demand, inquiries] = await Promise.all([spaceDemandStats(s.id), inquiriesForSpace(s.id)]);
  const missing = missingFields({ ...s, photoCount: s.photos.length, hasContact: !!(s.location.restaurant.eventsContactEmail || s.location.restaurant.eventsContactPhone || s.location.restaurant.phone) });
  const back = `/admin/spaces/${s.id}`;
  return (
    <>
      <PageHeader
        title={s.name}
        eyebrow={<><Link href={`/admin/restaurants/${s.location.restaurantId}`} className="hover:text-rope-700">{s.location.restaurant.name}</Link> · {s.location.neighborhood?.name ?? "no neighborhood"} · <StatusPill value={s.status} /> <StatusPill value={s.verificationStatus} /> {isStale(s.lastVerifiedAt) ? <span className="text-gold-700">stale</span> : null}</>}
        back={{ href: "/admin/spaces", label: "Spaces" }}
        actions={<><Link href={`/spaces/${s.slug}`} className="btn-secondary btn-sm">Public page</Link><form action={archiveSpace}><input type="hidden" name="id" value={s.id} />{s.status === "archived" ? <input type="hidden" name="restore" value="1" /> : null}<SubmitButton variant={s.status === "archived" ? "secondary" : "danger"}>{s.status === "archived" ? "Restore" : "Archive"}</SubmitButton></form></>}
      />
      {sp.saved ? <div className="mb-4"><Notice tone="good">Saved.</Notice></div> : null}
      {s.mergedIntoSpaceId ? <div className="mb-4"><Notice tone="warn">This space was merged into <Link href={`/admin/spaces/${s.mergedIntoSpaceId}`} className="underline">another space</Link>.</Notice></div> : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="card px-4 py-3"><p className="text-[12px] text-ink-500">Completeness</p><p className={`font-display text-[24px] ${s.completenessScore < 60 ? "text-gold-700" : "text-sage-700"}`}>{s.completenessScore}%</p>{missing.length ? <p className="text-[11.5px] text-ink-500">Missing: {missing.map((m) => m.label).join(", ")}</p> : null}</div>
        <div className="card px-4 py-3"><p className="text-[12px] text-ink-500">Last verified</p><p className="font-display text-[24px]">{s.lastVerifiedAt ? relativeTime(s.lastVerifiedAt) : "never"}</p></div>
        <div className="card px-4 py-3"><p className="text-[12px] text-ink-500">Views (30d)</p><p className="font-display text-[24px]">{demand.views30d}</p></div>
        <div className="card px-4 py-3"><p className="text-[12px] text-ink-500">Inquiries (all time)</p><p className="font-display text-[24px]">{demand.inquiries}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div>
          <SpaceForm space={s} locationId={s.locationId} />
        </div>
        <div className="space-y-6">
          <Panel title="Verify with the restaurant">
            <form action={markSpaceVerified} className="space-y-2">
              <input type="hidden" name="id" value={s.id} />
              <div className="grid gap-2 sm:grid-cols-2">
                <Select label="Method" name="method" options={[{ key: "phone_confirmation", label: "Phone" }, { key: "email_confirmation", label: "Email" }, { key: "restaurant_claimed", label: "Restaurant claimed" }]} blank={null} />
                <Input label="Note" name="note" placeholder="Spoke with events manager" />
              </div>
              <fieldset><legend className="mb-1 text-[12px] font-medium text-ink-600">Fields confirmed</legend>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">{VERIFIABLE_FIELDS.map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" name="fields" value={k} defaultChecked className="accent-rope-600" /> {l}</label>)}</div>
              </fieldset>
              <SubmitButton>Mark verified today</SubmitButton>
            </form>
          </Panel>

          <Panel title="Photos">
            <div className="mb-3 grid grid-cols-3 gap-2">
              {s.photos.map((p) => (
                <div key={p.id} className="relative">
                  <SpaceImage src={p.url} alt={p.alt ?? s.name} spaceType={s.spaceType} className="h-20 w-full rounded-lg" />
                  <form action={deletePhoto} className="absolute right-1 top-1"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="spaceId" value={s.id} /><button className="rounded bg-black/60 px-1.5 text-[11px] text-white">×</button></form>
                </div>
              ))}
              {!s.photos.length ? <p className="col-span-3 text-[13px] text-ink-500">No photos yet.</p> : null}
            </div>
            <form action={addPhoto} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="spaceId" value={s.id} />
              <Input label="Image URL" name="url" type="url" className="sm:col-span-2" />
              <label className="block text-[12px] font-medium text-ink-600 sm:col-span-2">or upload<input type="file" name="file" accept="image/*" className="mt-1 block text-[12.5px]" /></label>
              <Input label="Alt text" name="alt" />
              <Input label="Source URL (credit)" name="sourceUrl" />
              <div><SubmitButton variant="secondary">Add photo</SubmitButton></div>
            </form>
          </Panel>

          <Panel title="Availability rules">
            {s.availabilityRules.length ? <ul className="mb-2 text-[13px] text-ink-700">{s.availabilityRules.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((r) => <li key={r.id}>{DAYS[r.dayOfWeek]} {r.startTime?.slice(0, 5)}–{r.endTime?.slice(0, 5)} {r.label}</li>)}</ul> : null}
            <form action={saveAvailabilityRules} className="space-y-2">
              <input type="hidden" name="spaceId" value={s.id} />
              <TextArea label="Rules" name="rules" rows={3} hint='One per line: "Tue-Thu 17:00-22:00 Dinner", "Sat 11:00-15:00 Lunch". Empty = request-only.' defaultValue={groupRules(s.availabilityRules)} />
              <SubmitButton variant="secondary">Save rules</SubmitButton>
            </form>
          </Panel>

          <Panel title="Documents & menus">
            <ul className="mb-3 space-y-1.5 text-[13px]">
              {s.documents.map((d) => <li key={d.id} className="flex items-center justify-between gap-2"><a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="truncate text-rope-700 hover:underline">{d.title} <span className="text-ink-400">({d.kind.replace(/_/g, " ")})</span></a><form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={back} /><button className="text-[12px] text-ink-400 hover:text-rope-700">remove</button></form></li>)}
              {!s.documents.length ? <li className="text-ink-500">None attached to this space (restaurant-level documents show on the public page too).</li> : null}
            </ul>
            <form action={addDocument} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="entityType" value="space" />
              <input type="hidden" name="entityId" value={s.id} />
              <Input label="Title" name="title" />
              <Select label="Kind" name="kind" defaultValue="menu" options={[{ key: "menu", label: "Menu" }, { key: "private_dining_packet", label: "Private dining packet" }, { key: "floor_plan", label: "Floor plan" }, { key: "contract", label: "Contract" }, { key: "other", label: "Other" }]} blank={null} />
              <Input label="URL" name="url" type="url" className="sm:col-span-2" />
              <label className="block text-[12px] font-medium text-ink-600 sm:col-span-2">or upload PDF<input type="file" name="file" accept="application/pdf" className="mt-1 block text-[12.5px]" /></label>
              <div><SubmitButton variant="secondary">Attach</SubmitButton></div>
            </form>
          </Panel>

          <Panel title="Sources & provenance">
            <ul className="mb-3 max-h-72 space-y-1.5 overflow-y-auto text-[12.5px]">
              {s.provenance.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2">
                  <span><ConfidenceBadge confidence={p.confidence} compact /> {labelFor(SOURCE_TYPES, p.sourceType)} {p.sourceUrl ? <a href={p.sourceUrl} className="text-rope-700 hover:underline" target="_blank" rel="noreferrer">link</a> : null}{p.field ? <span className="text-ink-500"> · {p.field}</span> : null}{p.note ? <span className="text-ink-500"> — {p.note}</span> : null} <span className="text-ink-400">{formatDate(p.verifiedAt ?? p.createdAt)}</span></span>
                  <form action={deleteProvenance}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} /><button className="text-ink-400 hover:text-rope-700">×</button></form>
                </li>
              ))}
            </ul>
            <form action={addProvenance} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="entityType" value="space" />
              <input type="hidden" name="entityId" value={s.id} />
              <Select label="Source" name="sourceType" options={SOURCE_TYPES} blank={null} defaultValue="restaurant_website" />
              <Select label="Confidence" name="confidence" options={CONFIDENCE_LEVELS} blank={null} defaultValue="publicly_listed" />
              <Input label="URL" name="sourceUrl" type="url" className="sm:col-span-2" />
              <fieldset className="sm:col-span-2"><legend className="mb-1 text-[12px] font-medium text-ink-600">Applies to</legend><div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[12.5px]">{VERIFIABLE_FIELDS.map(([k, l]) => <label key={k} className="flex items-center gap-1.5"><input type="checkbox" name="fields" value={k} className="accent-rope-600" /> {l}</label>)}</div></fieldset>
              <TextArea label="Note" name="note" rows={2} className="sm:col-span-2" />
              <div><SubmitButton variant="secondary">Add source</SubmitButton></div>
            </form>
          </Panel>

          <Panel title="Inquiries for this space">
            {inquiries.length ? (
              <Table head={["#", "Customer", "Date", "Guests", "Venue status", "Inquiry"]}>
                {inquiries.map((i) => <tr key={i.id}><Td><Link href={`/admin/inquiries/${i.id}`} className="text-rope-700 hover:underline">#{i.number}</Link></Td><Td>{i.contactName}</Td><Td>{i.eventDate ? formatDate(i.eventDate) : "—"}</Td><Td>{i.guestCount}</Td><Td><StatusPill value={i.candidateStatus} /></Td><Td><StatusPill value={i.status} /></Td></tr>)}
              </Table>
            ) : <p className="text-[13px] text-ink-500">No inquiries yet.</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}

function groupRules(rules: { dayOfWeek: number; startTime: string | null; endTime: string | null; label: string | null }[]) {
  return rules
    .slice()
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((r) => `${DAYS[r.dayOfWeek]} ${r.startTime?.slice(0, 5) ?? "00:00"}-${r.endTime?.slice(0, 5) ?? "23:59"}${r.label ? ` ${r.label}` : ""}`)
    .join("\n");
}
