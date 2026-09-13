import Link from "next/link";
import { notFound } from "next/navigation";
import { addDocument, addProvenance, archiveRestaurant, deleteDocument, deleteProvenance, saveLocation } from "@/app/admin/actions/inventory";
import { RestaurantForm } from "@/components/admin/RestaurantForm";
import { Input, PageHeader, Panel, Select, StatusPill, SubmitButton, Table, Td, TextArea } from "@/components/admin/ui";
import { ConfidenceBadge } from "@/components/ui";
import { getRestaurantForAdmin } from "@/lib/data/admin";
import { getCityBySlug, listNeighborhoods } from "@/lib/data/cities";
import { restaurantDemandSummary } from "@/lib/data/inquiries";
import { formatCents, formatDate } from "@/lib/format";
import { CONFIDENCE_LEVELS, SOURCE_TYPES, labelFor } from "@/lib/taxonomy";

export default async function RestaurantAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getRestaurantForAdmin(id);
  if (!r) notFound();
  const city = await getCityBySlug("houston");
  const [hoods, demand] = await Promise.all([city ? listNeighborhoods(city.id) : [], restaurantDemandSummary(r.id)]);
  const tri = [{ key: "yes", label: "Yes" }, { key: "no", label: "No" }];
  return (
    <>
      <PageHeader
        title={r.name}
        eyebrow={<><StatusPill value={r.status} /> <Link href={`/restaurants/${r.slug}`} className="ml-2 text-rope-700 hover:underline">View public page</Link></>}
        back={{ href: "/admin/restaurants", label: "Restaurants" }}
        actions={<form action={archiveRestaurant}><input type="hidden" name="id" value={r.id} /><SubmitButton variant="danger">Archive</SubmitButton></form>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="card px-4 py-3"><p className="text-[12px] text-ink-500">Space views (30d)</p><p className="font-display text-[24px]">{demand.views}</p></div>
        <div className="card px-4 py-3"><p className="text-[12px] text-ink-500">Customers requesting dates (30d)</p><p className="font-display text-[24px]">{demand.inquiries}</p></div>
        <div className="card px-4 py-3"><p className="text-[12px] text-ink-500">Estimated event demand (30d)</p><p className="font-display text-[24px]">{formatCents(demand.estimatedDemandCents)}</p></div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Panel title="Details">
            <RestaurantForm restaurant={r} />
          </Panel>

          <Panel title="Locations">
            {r.locations.map((l) => (
              <details key={l.id} className="mb-3 rounded-lg border border-ink-200" open={r.locations.length === 1}>
                <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-[13.5px]">
                  <span className="font-medium">{l.name ?? l.neighborhood?.name ?? "Location"} — {[l.addressLine1, l.cityName].filter(Boolean).join(", ") || "no address"}</span>
                  <span className="text-ink-500">{l.spaces.length} spaces{l.lat ? "" : " · no coordinates"}</span>
                </summary>
                <form action={saveLocation} className="grid gap-3 border-t border-ink-100 p-3 sm:grid-cols-3">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="restaurantId" value={r.id} />
                  <input type="hidden" name="cityId" value={l.cityId} />
                  <Input label="Location name" name="name" defaultValue={l.name} hint="e.g. Galleria" />
                  <Select label="Neighborhood" name="neighborhoodId" defaultValue={l.neighborhoodId} options={hoods.map((h) => ({ key: h.id, label: h.name }))} />
                  <Input label="Phone" name="phone" defaultValue={l.phone} />
                  <Input label="Address line 1" name="addressLine1" defaultValue={l.addressLine1} className="sm:col-span-2" />
                  <Input label="Address line 2" name="addressLine2" defaultValue={l.addressLine2} />
                  <Input label="City" name="cityName" defaultValue={l.cityName} />
                  <Input label="State" name="state" defaultValue={l.state} />
                  <Input label="ZIP" name="postalCode" defaultValue={l.postalCode} />
                  <Input label="Latitude" name="lat" defaultValue={l.lat} />
                  <Input label="Longitude" name="lng" defaultValue={l.lng} />
                  <Input label="Parking notes" name="parkingNotes" defaultValue={l.parkingNotes} />
                  <Select label="Valet" name="hasValet" defaultValue={l.hasValet == null ? "" : l.hasValet ? "yes" : "no"} options={tri} blank="Unknown" />
                  <Select label="Parking lot / garage" name="hasParkingLot" defaultValue={l.hasParkingLot == null ? "" : l.hasParkingLot ? "yes" : "no"} options={tri} blank="Unknown" />
                  <Select label="Wheelchair accessible" name="isWheelchairAccessible" defaultValue={l.isWheelchairAccessible == null ? "" : l.isWheelchairAccessible ? "yes" : "no"} options={tri} blank="Unknown" />
                  <div className="flex items-end gap-2 sm:col-span-3">
                    <SubmitButton>Save location</SubmitButton>
                    <Link href={`/admin/spaces/new?location=${l.id}`} className="btn-secondary btn-sm">Add space here</Link>
                  </div>
                </form>
                <div className="border-t border-ink-100 p-3">
                  <Table head={["Space", "Type", "Seated", "Standing", "Pricing", "Verification", "Score"]}>
                    {l.spaces.filter((s) => s.status !== "archived").map((s) => (
                      <tr key={s.id} className="hover:bg-ink-50">
                        <Td><Link href={`/admin/spaces/${s.id}`} className="font-medium hover:text-rope-700">{s.name}</Link></Td>
                        <Td className="text-ink-600">{s.spaceType.replace(/_/g, " ")}</Td>
                        <Td>{s.maxSeated ?? "—"}</Td>
                        <Td>{s.maxStanding ?? "—"}</Td>
                        <Td>{s.fbMinimumCents ? formatCents(s.fbMinimumCents) : s.estPerPersonLowCents ? `${formatCents(s.estPerPersonLowCents)}/pp` : "—"}</Td>
                        <Td><StatusPill value={s.verificationStatus} /></Td>
                        <Td>{s.completenessScore}%</Td>
                      </tr>
                    ))}
                  </Table>
                </div>
              </details>
            ))}
            <details className="rounded-lg border border-dashed border-ink-300">
              <summary className="cursor-pointer px-3 py-2 text-[13.5px] font-medium text-ink-700">+ Add a location</summary>
              <form action={saveLocation} className="grid gap-3 border-t border-ink-100 p-3 sm:grid-cols-3">
                <input type="hidden" name="restaurantId" value={r.id} />
                <input type="hidden" name="cityId" value={city?.id ?? ""} />
                <Input label="Location name" name="name" hint="e.g. Memorial City" />
                <Select label="Neighborhood" name="neighborhoodId" options={hoods.map((h) => ({ key: h.id, label: h.name }))} />
                <Input label="Phone" name="phone" />
                <Input label="Address line 1" name="addressLine1" className="sm:col-span-2" />
                <Input label="ZIP" name="postalCode" />
                <Input label="City" name="cityName" defaultValue="Houston" />
                <Input label="State" name="state" defaultValue="TX" />
                <div className="flex items-end"><SubmitButton>Create location</SubmitButton></div>
              </form>
            </details>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Documents & menus">
            <ul className="mb-3 space-y-1.5 text-[13px]">
              {r.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2">
                  <a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="truncate text-rope-700 hover:underline">{d.title} <span className="text-ink-400">({d.kind.replace(/_/g, " ")})</span></a>
                  <form action={deleteDocument}><input type="hidden" name="id" value={d.id} /><input type="hidden" name="back" value={`/admin/restaurants/${r.id}`} /><button className="text-[12px] text-ink-400 hover:text-rope-700">remove</button></form>
                </li>
              ))}
              {!r.documents.length ? <li className="text-ink-500">No documents yet.</li> : null}
            </ul>
            <form action={addDocument} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="entityType" value="restaurant" />
              <input type="hidden" name="entityId" value={r.id} />
              <Input label="Title" name="title" placeholder="Private dining menu" />
              <Select label="Kind" name="kind" defaultValue="menu" options={[{ key: "menu", label: "Menu" }, { key: "private_dining_packet", label: "Private dining packet" }, { key: "floor_plan", label: "Floor plan" }, { key: "contract", label: "Contract" }, { key: "other", label: "Other" }]} blank={null} />
              <Input label="URL" name="url" type="url" className="sm:col-span-2" />
              <label className="block text-[12px] font-medium text-ink-600 sm:col-span-2">or upload PDF<input type="file" name="file" accept="application/pdf,image/*" className="mt-1 block text-[12.5px]" /></label>
              <div><SubmitButton variant="secondary">Attach</SubmitButton></div>
            </form>
          </Panel>

          <Panel title="Sources & provenance">
            <ul className="mb-3 space-y-1.5 text-[12.5px]">
              {r.provenance.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2">
                  <span><ConfidenceBadge confidence={p.confidence} compact /> {labelFor(SOURCE_TYPES, p.sourceType)} {p.sourceUrl ? <a href={p.sourceUrl} className="text-rope-700 hover:underline" target="_blank" rel="noreferrer">link</a> : null}{p.field ? <span className="text-ink-500"> · {p.field}</span> : null}{p.note ? <span className="text-ink-500"> — {p.note}</span> : null} <span className="text-ink-400">{formatDate(p.createdAt)}</span></span>
                  <form action={deleteProvenance}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={`/admin/restaurants/${r.id}`} /><button className="text-ink-400 hover:text-rope-700">×</button></form>
                </li>
              ))}
            </ul>
            <form action={addProvenance} className="grid gap-2 sm:grid-cols-2">
              <input type="hidden" name="entityType" value="restaurant" />
              <input type="hidden" name="entityId" value={r.id} />
              <Select label="Source" name="sourceType" options={SOURCE_TYPES} blank={null} defaultValue="restaurant_website" />
              <Select label="Confidence" name="confidence" options={CONFIDENCE_LEVELS} blank={null} defaultValue="publicly_listed" />
              <Input label="URL" name="sourceUrl" type="url" className="sm:col-span-2" />
              <TextArea label="Note" name="note" rows={2} className="sm:col-span-2" />
              <div><SubmitButton variant="secondary">Add source</SubmitButton></div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
