import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ConfidenceBadge, PrivacyBadge, VerificationBadge } from "@/components/ui";
import { SpaceImage } from "@/components/space/SpaceImage";
import { listSpacesBySlugs } from "@/lib/data/spaces";
import { estimateSpend } from "@/lib/search/estimate";
import { formatCents, formatDate } from "@/lib/format";
import { AMENITIES, AV_AMENITIES, CUISINES, PARKING_AMENITIES, labelFor } from "@/lib/taxonomy";
import { haversineMiles } from "@/lib/geo";
import { getCityBySlug, listNeighborhoods } from "@/lib/data/cities";

export const metadata: Metadata = { title: "Compare spaces", robots: { index: false } };

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ spaces?: string; guests?: string; neighborhood?: string }> }) {
  const sp = await searchParams;
  const slugs = (sp.spaces ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const guests = sp.guests ? parseInt(sp.guests, 10) || undefined : undefined;
  const spaces = await listSpacesBySlugs(slugs);
  if (spaces.length < 2) {
    return (
      <div className="container-page py-16">
        <EmptyState title="Pick at least two spaces to compare" body="Use the Compare button on any space card, then come back here." action={<Link href="/search" className="btn-primary">Browse spaces</Link>} />
      </div>
    );
  }
  const city = await getCityBySlug("houston");
  const hoods = city ? await listNeighborhoods(city.id) : [];
  const origin = sp.neighborhood ? hoods.find((h) => h.slug === sp.neighborhood) : null;
  const originLatLng = origin && origin.lat && origin.lng ? { lat: Number(origin.lat), lng: Number(origin.lng) } : null;
  const g = guests ?? 20;

  const rows: { label: string; cells: React.ReactNode[] }[] = [
    { label: "Restaurant", cells: spaces.map((s) => <Link key={s.id} href={`/restaurants/${s.restaurantSlug}`} className="hover:text-rope-700">{s.restaurantName}</Link>) },
    { label: "Neighborhood", cells: spaces.map((s) => s.neighborhoodName ?? "—") },
    { label: originLatLng ? `Distance from ${origin!.name}` : "Distance", cells: spaces.map((s) => (originLatLng && s.latLng ? `${haversineMiles(originLatLng, s.latLng).toFixed(1)} mi` : "—")) },
    { label: "Seated", cells: spaces.map((s) => (s.maxSeated != null ? `${s.minGuests ? `${s.minGuests}–` : "up to "}${s.maxSeated}` : "Unknown")) },
    { label: "Standing", cells: spaces.map((s) => (s.maxStanding != null ? `up to ${s.maxStanding}` : "Unknown")) },
    { label: "Privacy", cells: spaces.map((s) => <PrivacyBadge key={s.id} privacy={s.privacy} />) },
    { label: "F&B minimum", cells: spaces.map((s) => (s.fbMinimumCents != null ? formatCents(s.fbMinimumCents) : "—")) },
    { label: "Room fee", cells: spaces.map((s) => (s.roomFeeCents != null ? formatCents(s.roomFeeCents) : "—")) },
    { label: "Per person", cells: spaces.map((s) => (s.estPerPersonLowCents != null ? `${formatCents(s.estPerPersonLowCents)}${s.estPerPersonHighCents && s.estPerPersonHighCents !== s.estPerPersonLowCents ? `–${formatCents(s.estPerPersonHighCents)}` : ""}` : "—")) },
    { label: "Deposit", cells: spaces.map((s) => (s.depositCents != null ? formatCents(s.depositCents) : "—")) },
    {
      label: `Est. all-in for ${g}`,
      cells: spaces.map((s) => {
        const e = estimateSpend(s, g);
        return e.lowCents != null ? (
          <span key={s.id}>
            <span className="font-semibold text-ink-900">{formatCents(e.lowCents)}{e.highCents && e.highCents !== e.lowCents ? `–${formatCents(e.highCents)}` : ""}</span>
            <span className="block text-[12px] text-ink-500">≈ {formatCents(e.perPersonLowCents)}/person · <ConfidenceBadge confidence="estimate" compact /></span>
          </span>
        ) : (
          "Pricing on request"
        );
      }),
    },
    { label: "Cuisine", cells: spaces.map((s) => s.cuisines.map((c) => labelFor(CUISINES, c)).join(", ") || "—") },
    { label: "AV", cells: spaces.map((s) => s.amenities.filter((a) => AV_AMENITIES.includes(a as never)).map((a) => labelFor(AMENITIES, a)).join(", ") || "Not listed") },
    { label: "Parking", cells: spaces.map((s) => [s.hasValet ? "Valet" : null, s.hasParkingLot ? "Lot" : null, ...s.amenities.filter((a) => PARKING_AMENITIES.includes(a as never)).map((a) => labelFor(AMENITIES, a))].filter(Boolean).join(", ") || "Not listed") },
    { label: "Other amenities", cells: spaces.map((s) => s.amenities.filter((a) => !AV_AMENITIES.includes(a as never) && !PARKING_AMENITIES.includes(a as never)).map((a) => labelFor(AMENITIES, a)).join(", ") || "—") },
    { label: "Availability", cells: spaces.map((s) => (s.availabilityMode === "rules" ? "Known event days" : s.availabilityMode === "instant" ? "Instant book" : "On request")) },
    { label: "Verification", cells: spaces.map((s) => <span key={s.id} className="inline-flex flex-col gap-1"><VerificationBadge status={s.verificationStatus} />{s.lastVerifiedAt ? <span className="text-[12px] text-ink-500">{formatDate(s.lastVerifiedAt)}</span> : null}</span>) },
    { label: "Data completeness", cells: spaces.map((s) => `${s.completenessScore}%`) },
  ];

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[34px] text-ink-900">Compare spaces</h1>
          <p className="mt-1 text-[14.5px] text-ink-600">Estimates use each space's known pricing plus standard assumptions; confirmed quotes replace them once you inquire.</p>
        </div>
        <Link href={`/inquire?spaces=${spaces.map((s) => s.slug).join(",")}${guests ? `&guests=${guests}` : ""}`} className="btn-primary">
          Help me book one of these
        </Link>
      </div>
      <form className="mt-4 flex items-center gap-2 text-[14px]">
        <input type="hidden" name="spaces" value={slugs.join(",")} />
        <label className="text-ink-600">Guests</label>
        <input name="guests" type="number" min={1} defaultValue={g} className="input !w-24 !py-1.5" />
        <label className="text-ink-600">From</label>
        <select name="neighborhood" defaultValue={sp.neighborhood ?? ""} className="input !w-auto !py-1.5">
          <option value="">—</option>
          {hoods.map((h) => (
            <option key={h.slug} value={h.slug}>{h.name}</option>
          ))}
        </select>
        <button className="btn-secondary btn-sm">Update</button>
      </form>
      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-200 bg-white">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead>
            <tr className="align-top">
              <th className="w-44 p-4" />
              {spaces.map((s) => (
                <th key={s.id} className="p-4 text-left font-normal">
                  <SpaceImage src={s.photoUrl} alt={s.name} spaceType={s.spaceType} className="mb-2 h-28 w-full rounded-xl" />
                  <Link href={`/spaces/${s.slug}`} className="font-display text-[19px] leading-tight text-ink-900 hover:text-rope-700">{s.name}</Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-ink-100 align-top">
                <th className="p-4 text-left text-[12.5px] font-medium uppercase tracking-wider text-ink-500">{r.label}</th>
                {r.cells.map((c, i) => (
                  <td key={i} className="p-4 text-ink-800">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
