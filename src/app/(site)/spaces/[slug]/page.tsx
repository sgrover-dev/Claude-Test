import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SpaceCard } from "@/components/search/SpaceCard";
import { CompareToggle } from "@/components/search/CompareContext";
import { SpaceGallery } from "@/components/space/SpaceGallery";
import { PricingBlock } from "@/components/space/PricingBlock";
import { ProvenancePanel } from "@/components/space/ProvenancePanel";
import { SaveButton } from "@/components/space/SaveButton";
import { ViewBeacon } from "@/components/space/ViewBeacon";
import { Badge, PrivacyBadge, VerificationBadge } from "@/components/ui";
import { savedSpaceIdsForCurrentUser } from "@/lib/data/saved";
import { getSpaceBySlug } from "@/lib/data/spaces";
import { formatDate, formatTime } from "@/lib/format";
import { AMBIANCE, AMENITIES, CUISINES, EVENT_TYPES, FOOD_STYLES, INDOOR_OUTDOOR, SPACE_TYPES, labelFor } from "@/lib/taxonomy";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ guests?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const space = await getSpaceBySlug(slug);
  if (!space) return { title: "Space not found" };
  const r = space.location.restaurant;
  const cap = space.maxSeated ? `up to ${space.maxSeated} seated` : space.maxStanding ? `up to ${space.maxStanding} standing` : "group";
  return {
    title: `${space.name} at ${r.name} — ${labelFor(SPACE_TYPES, space.spaceType)} in ${space.location.neighborhood?.name ?? space.location.city.name}`,
    description: `${space.name} at ${r.name}: ${cap}, ${labelFor(SPACE_TYPES, space.spaceType).toLowerCase()}${space.privacy ? `, ${space.privacy.replace(/_/g, " ")}` : ""}. Capacity, pricing and amenities on Red Rope.`,
    alternates: { canonical: `/spaces/${space.slug}` },
    openGraph: { images: space.photos[0]?.url ? [space.photos[0].url] : [] },
  };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function SpacePage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const space = await getSpaceBySlug(slug);
  if (!space || space.status === "archived") notFound();
  const saved = await savedSpaceIdsForCurrentUser();
  const guests = sp.guests ? parseInt(sp.guests, 10) || undefined : undefined;
  const loc = space.location;
  const r = loc.restaurant;
  const address = [loc.addressLine1, loc.cityName, loc.state, loc.postalCode].filter(Boolean).join(", ");
  const inquireHref = `/inquire?spaces=${space.slug}${guests ? `&guests=${guests}` : ""}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    name: `${space.name} at ${r.name}`,
    address: { "@type": "PostalAddress", streetAddress: loc.addressLine1, addressLocality: loc.cityName, addressRegion: loc.state, postalCode: loc.postalCode },
    maximumAttendeeCapacity: space.maxStanding ?? space.maxSeated ?? undefined,
    containedInPlace: { "@type": "Restaurant", name: r.name, url: r.websiteUrl ?? undefined, servesCuisine: r.cuisines.map((c) => labelFor(CUISINES, c)) },
    image: space.photos.map((p) => p.url),
  };

  return (
    <div className="container-page py-6">
      <ViewBeacon spaceId={space.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-[13px] text-ink-500">
        <Link href="/houston" className="hover:text-rope-700">Houston</Link>
        {loc.neighborhood ? (
          <>
            <span className="mx-1.5">/</span>
            <Link href={`/houston/${loc.neighborhood.slug}`} className="hover:text-rope-700">{loc.neighborhood.name}</Link>
          </>
        ) : null}
        <span className="mx-1.5">/</span>
        <Link href={`/restaurants/${r.slug}`} className="hover:text-rope-700">{r.name}</Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="outline">{labelFor(SPACE_TYPES, space.spaceType)}</Badge>
            <PrivacyBadge privacy={space.privacy} />
            <VerificationBadge status={space.verificationStatus} />
          </div>
          <h1 className="font-display mt-2 text-[36px] leading-tight text-ink-900 sm:text-[44px]">{space.name}</h1>
          <p className="mt-1 text-[16px] text-ink-700">
            at <Link href={`/restaurants/${r.slug}`} className="font-medium text-ink-900 underline-offset-2 hover:underline">{r.name}</Link>
            {loc.neighborhood ? <> · {loc.neighborhood.name}</> : null}
            {r.cuisines.length ? <> · {r.cuisines.map((c) => labelFor(CUISINES, c)).join(", ")}</> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveButton spaceId={space.id} initialSaved={saved.has(space.id)} variant="button" />
          <CompareToggle item={{ id: space.id, slug: space.slug, name: space.name, restaurantName: r.name }} className="!py-2.5 !px-4 !text-[15px] !rounded-xl" />
        </div>
      </div>

      <div className="mt-5">
        <SpaceGallery photos={space.photos} name={space.name} spaceType={space.spaceType} />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-10">
          <section>
            <div className="grid gap-4 sm:grid-cols-3">
              <Fact label="Seated" value={space.maxSeated != null ? `${space.minGuests ? `${space.minGuests}–` : "up to "}${space.maxSeated}` : "Unknown"} />
              <Fact label="Standing / reception" value={space.maxStanding != null ? `up to ${space.maxStanding}` : "Unknown"} />
              <Fact label="Setting" value={space.indoorOutdoor ? labelFor(INDOOR_OUTDOOR, space.indoorOutdoor) : "Unknown"} />
            </div>
            {space.configurations.length ? (
              <div className="mt-3 flex flex-wrap gap-2 text-[13px] text-ink-600">
                {space.configurations.map((c) => (
                  <span key={c.name} className="rounded-lg bg-ink-100 px-2.5 py-1">
                    {c.name}: {c.seated != null ? `${c.seated} seated` : ""}{c.seated != null && c.standing != null ? " · " : ""}{c.standing != null ? `${c.standing} standing` : ""}
                  </span>
                ))}
              </div>
            ) : null}
          </section>

          {space.description ? (
            <section>
              <h2 className="font-display text-[24px] text-ink-900">About this space</h2>
              <p className="prose-rr mt-2 text-[15.5px] leading-relaxed text-ink-700">{space.description}</p>
            </section>
          ) : null}

          <section>
            <h2 className="font-display text-[24px] text-ink-900">Amenities</h2>
            {space.amenities.length ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {space.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2 text-[15px] text-ink-800">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-rope-500" /> {labelFor(AMENITIES, a)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[14.5px] text-ink-500">Amenities not yet documented — we'll confirm with the restaurant when you inquire.</p>
            )}
            {(loc.hasValet || loc.hasParkingLot || loc.parkingNotes || loc.isWheelchairAccessible != null) && (
              <div className="mt-4 text-[14px] text-ink-600">
                {loc.hasValet ? <p>Valet available.</p> : null}
                {loc.hasParkingLot ? <p>Parking lot or garage on site.</p> : null}
                {loc.parkingNotes ? <p>{loc.parkingNotes}</p> : null}
                {loc.isWheelchairAccessible === true ? <p>Wheelchair accessible.</p> : loc.isWheelchairAccessible === false ? <p>Not wheelchair accessible.</p> : null}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-display text-[24px] text-ink-900">Food & drink</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {space.foodStyles.map((f) => (
                <Badge key={f} tone="neutral">{labelFor(FOOD_STYLES, f)}</Badge>
              ))}
              {space.ambiance.map((f) => (
                <Badge key={f} tone="outline">{labelFor(AMBIANCE, f)}</Badge>
              ))}
            </div>
            {space.menuNotes ? <p className="mt-3 text-[15px] text-ink-700">{space.menuNotes}</p> : null}
            {space.dietaryAccommodations ? <p className="mt-2 text-[14.5px] text-ink-600"><span className="font-medium text-ink-800">Dietary:</span> {space.dietaryAccommodations}</p> : null}
            {space.documents.length ? (
              <ul className="mt-3 space-y-1.5">
                {space.documents.map((d) => (
                  <li key={d.id}>
                    <a href={d.url ?? "#"} target="_blank" rel="noreferrer" className="text-[14.5px] text-rope-700 underline-offset-2 hover:underline">
                      {d.title} <span className="text-ink-400">({d.kind.replace(/_/g, " ")})</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section>
            <h2 className="font-display text-[24px] text-ink-900">Good to know</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-3 text-[14.5px] sm:grid-cols-2">
              <Row label="Availability">
                {space.availabilityMode === "rules" && space.availabilityRules.length ? (
                  <ul className="space-y-0.5">
                    {space.availabilityRules.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((r) => (
                      <li key={r.id}>
                        {DAYS[r.dayOfWeek]} {r.startTime ? `${formatTime(r.startTime)}–${formatTime(r.endTime)}` : ""} {r.label ? <span className="text-ink-500">({r.label})</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "Confirmed on request — Red Rope checks the date for you."
                )}
                {space.availabilityNotes ? <p className="mt-1 text-ink-500">{space.availabilityNotes}</p> : null}
              </Row>
              <Row label="Time limit">{space.maxDurationMinutes ? `${space.maxDurationMinutes / 60} hours` : "Not specified"}</Row>
              <Row label="Outside cake">{space.outsideCakePolicy ?? "Ask us"}</Row>
              <Row label="Decor">{space.decorPolicy ?? "Ask us"}</Row>
              <Row label="Outside vendors">{space.outsideVendorPolicy ?? "Ask us"}</Row>
              <Row label="Age restrictions">{space.ageRestriction ?? "None listed"}</Row>
              <Row label="Suited for">{space.suitableFor.length ? space.suitableFor.map((s) => labelFor(EVENT_TYPES, s)).join(", ") : "Any group occasion"}</Row>
              <Row label="Address">{address || "Not listed"}</Row>
            </dl>
            {space.otherRestrictions ? <p className="mt-3 text-[14px] text-ink-600">{space.otherRestrictions}</p> : null}
          </section>

          <ProvenancePanel provenance={space.provenance} lastVerifiedAt={space.lastVerifiedAt} verificationStatus={space.verificationStatus} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <PricingBlock space={space} provenance={space.provenance} guests={guests} taxDefault={8.25} />
          <div className="card p-5">
            <h3 className="text-[16px] font-semibold text-ink-900">Want this space?</h3>
            <p className="mt-1 text-[14px] text-ink-600">Tell us your date and headcount. We confirm availability, pricing and details directly with {r.name} — no account needed to start.</p>
            <Link href={inquireHref} className="btn-primary mt-4 w-full">Help me book this</Link>
            <p className="mt-2 text-center text-[12px] text-ink-500">Free for you. Typical first response within one business day.</p>
          </div>
          {space.lastVerifiedAt ? <p className="text-center text-[12px] text-ink-500">Last verified {formatDate(space.lastVerifiedAt)}</p> : null}
        </aside>
      </div>

      {space.siblings.length ? (
        <section className="mt-16">
          <h2 className="font-display text-[26px] text-ink-900">Other spaces at {r.name}</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {space.siblings.map((s) => (
              <SpaceCard key={s.id} item={{ space: s }} saved={saved.has(s.id)} guests={guests} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-[12px] font-medium uppercase tracking-wider text-ink-500">{label}</p>
      <p className="mt-0.5 text-[18px] font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12.5px] font-medium uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-800">{children}</dd>
    </div>
  );
}
