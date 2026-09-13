import Link from "next/link";
import { formatCapacity } from "@/lib/format";
import type { SpaceSummary } from "@/lib/data/spaces";
import type { RankedSpace } from "@/lib/search/rank";
import { AMENITIES, SPACE_TYPES, labelFor } from "@/lib/taxonomy";
import { Badge, CheckIcon, PrivacyBadge } from "@/components/ui";
import { SpaceImage } from "@/components/space/SpaceImage";
import { SaveButton } from "@/components/space/SaveButton";
import { CompareToggle } from "./CompareContext";

export function SpaceCard({ item, saved = false, guests }: { item: RankedSpace<SpaceSummary> | { space: SpaceSummary }; saved?: boolean; guests?: number }) {
  const s = item.space;
  const ranked = "estimate" in item ? item : null;
  const estimateLabel = ranked?.estimate.label ?? null;
  const topAmenities = s.amenities.filter((a) => ["tv", "projector", "screen", "private_bar", "wifi", "separate_entrance"].includes(a)).slice(0, 3);
  const query = guests ? `?guests=${guests}` : "";
  return (
    <article className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-pop">
      <Link href={`/spaces/${s.slug}${query}`} className="relative block aspect-[4/3] overflow-hidden">
        <SpaceImage src={s.photoUrl} alt={`${s.name} at ${s.restaurantName}`} spaceType={s.spaceType} className="h-full w-full transition duration-500 group-hover:scale-[1.03]" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          {s.verificationStatus === "verified" ? (
            <Badge tone="ink" className="!bg-white/95 !text-sage-700 shadow-sm">
              <CheckIcon /> Verified
            </Badge>
          ) : null}
          {ranked?.distanceMiles != null && ranked.distanceMiles >= 0.15 ? <Badge tone="ink" className="!bg-black/40 !text-white backdrop-blur">~{ranked.distanceMiles.toFixed(1)} mi</Badge> : null}
        </div>
        <div className="absolute right-3 top-3">
          <SaveButton spaceId={s.id} initialSaved={saved} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[20px] leading-tight text-ink-900">
              <Link href={`/spaces/${s.slug}${query}`} className="hover:text-rope-700">
                {s.name}
              </Link>
            </h3>
            <p className="mt-0.5 truncate text-[14px] text-ink-600">
              <span className="font-medium text-ink-800">{s.restaurantName}</span>
              {s.neighborhoodName ? <span> · {s.neighborhoodName}</span> : null}
            </p>
          </div>
          <span className="shrink-0 text-[12px] text-ink-500">{labelFor(SPACE_TYPES, s.spaceType)}</span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13.5px]">
          <div>
            <dt className="text-ink-500">Capacity</dt>
            <dd className="font-medium text-ink-900">{formatCapacity(s.maxSeated, s.maxStanding, s.minGuests)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Pricing</dt>
            <dd className="font-medium text-ink-900">{estimateLabel ?? "On request"}</dd>
          </div>
        </dl>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <PrivacyBadge privacy={s.privacy} />
          {topAmenities.map((a) => (
            <Badge key={a} tone="outline">
              {labelFor(AMENITIES, a)}
            </Badge>
          ))}
        </div>

        {ranked && (ranked.reasons.length || ranked.warnings.length) ? (
          <ul className="mt-3 space-y-0.5 text-[12.5px]">
            {ranked.reasons.slice(0, 2).map((r) => (
              <li key={r} className="flex items-center gap-1.5 text-sage-700">
                <CheckIcon className="h-3 w-3 shrink-0" /> {r}
              </li>
            ))}
            {ranked.warnings.slice(0, 1).map((w) => (
              <li key={w} className="flex items-center gap-1.5 text-gold-700">
                <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" /> {w}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <CompareToggle item={{ id: s.id, slug: s.slug, name: s.name, restaurantName: s.restaurantName }} />
          <Link href={`/inquire?spaces=${s.slug}${guests ? `&guests=${guests}` : ""}`} className="btn-dark btn-sm">
            Help me book this
          </Link>
        </div>
      </div>
    </article>
  );
}
