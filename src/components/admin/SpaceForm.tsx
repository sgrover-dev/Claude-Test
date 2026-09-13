import { saveSpace } from "@/app/admin/actions/inventory";
import type { Space } from "@/db/schema";
import { AMBIANCE, AMENITIES, CONFIDENCE_LEVELS, EVENT_TYPES, FOOD_STYLES, INDOOR_OUTDOOR, PRIVACY_LEVELS, SOURCE_TYPES, SPACE_TYPES } from "@/lib/taxonomy";
import { CheckGroup, Input, Select, TextArea } from "./ui";

const cents = (c: number | null | undefined) => (c == null ? "" : String(c / 100));

export function SpaceForm({ space, locationId }: { space?: Space | null; locationId: string }) {
  const s = space;
  return (
    <form action={saveSpace} className="space-y-6">
      {s ? <input type="hidden" name="id" value={s.id} /> : null}
      <input type="hidden" name="locationId" value={locationId} />

      <Group title="Identity">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Space name" name="name" defaultValue={s?.name} required className="sm:col-span-2" />
          <Select label="Status" name="status" defaultValue={s?.status ?? "active"} options={[{ key: "active", label: "Active" }, { key: "draft", label: "Draft (hidden)" }, { key: "archived", label: "Archived" }]} blank={null} />
          <Select label="Space type" name="spaceType" defaultValue={s?.spaceType ?? "private_dining_room"} options={SPACE_TYPES} blank={null} />
          <Select label="Privacy" name="privacy" defaultValue={s?.privacy} options={PRIVACY_LEVELS} blank="Unknown" />
          <Select label="Setting" name="indoorOutdoor" defaultValue={s?.indoorOutdoor} options={INDOOR_OUTDOOR} blank="Unknown" />
          <TextArea label="Description (consumer-facing)" name="description" defaultValue={s?.description} rows={4} className="sm:col-span-3" />
        </div>
      </Group>

      <Group title="Capacity">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Minimum guests" name="minGuests" type="number" defaultValue={s?.minGuests} />
          <Input label="Max seated" name="maxSeated" type="number" defaultValue={s?.maxSeated} />
          <Input label="Max standing / reception" name="maxStanding" type="number" defaultValue={s?.maxStanding} />
          <TextArea label="Configurations" name="configurations" rows={3} className="sm:col-span-3" hint='One per line: "U-shape: 18 seated" or "Reception: 60 standing"' defaultValue={(s?.configurations ?? []).map((c) => `${c.name}: ${[c.seated != null ? `${c.seated} seated` : null, c.standing != null ? `${c.standing} standing` : null].filter(Boolean).join(" / ")}`).join("\n")} />
        </div>
      </Group>

      <Group title="Pricing" hint="Dollars; leave blank when unknown. Never guess.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label="F&B minimum ($)" name="fbMinimum" defaultValue={cents(s?.fbMinimumCents)} />
          <Input label="Room fee ($)" name="roomFee" defaultValue={cents(s?.roomFeeCents)} />
          <Input label="Per person low ($)" name="perPersonLow" defaultValue={cents(s?.estPerPersonLowCents)} />
          <Input label="Per person high ($)" name="perPersonHigh" defaultValue={cents(s?.estPerPersonHighCents)} />
          <Input label="Deposit ($)" name="deposit" defaultValue={cents(s?.depositCents)} />
          <Input label="Service charge %" name="serviceChargePct" defaultValue={s?.serviceChargePct} />
          <Input label="Admin fee %" name="adminFeePct" defaultValue={s?.adminFeePct} />
          <Input label="Tax %" name="taxPct" defaultValue={s?.taxPct} />
          <TextArea label="Minimums by day / time" name="daypartMinimums" rows={3} className="sm:col-span-2" hint='One per line: "Fri/Sat dinner: 5000"' defaultValue={(s?.daypartMinimums ?? []).map((d) => `${d.label}: ${d.amountCents / 100}`).join("\n")} />
          <TextArea label="Deposit notes" name="depositNotes" rows={3} className="sm:col-span-2" defaultValue={s?.depositNotes} />
          <TextArea label="Cancellation policy" name="cancellationPolicy" rows={2} className="sm:col-span-2" defaultValue={s?.cancellationPolicy} />
          <TextArea label="Pricing notes (consumer-facing)" name="pricingNotes" rows={2} className="sm:col-span-2" defaultValue={s?.pricingNotes} />
        </div>
      </Group>

      <Group title="Amenities & food">
        <CheckGroup label="Amenities" name="amenities" options={AMENITIES} selected={s?.amenities ?? []} columns={4} />
        <CheckGroup label="Food styles" name="foodStyles" options={FOOD_STYLES} selected={s?.foodStyles ?? []} columns={4} />
        <CheckGroup label="Ambiance" name="ambiance" options={AMBIANCE} selected={s?.ambiance ?? []} columns={4} />
        <CheckGroup label="Suited for" name="suitableFor" options={EVENT_TYPES} selected={s?.suitableFor ?? []} columns={4} />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea label="Menu notes" name="menuNotes" rows={2} defaultValue={s?.menuNotes} />
          <TextArea label="Dietary accommodations" name="dietaryAccommodations" rows={2} defaultValue={s?.dietaryAccommodations} />
          <TextArea label="Raw feature text from source" name="featureNotes" rows={2} defaultValue={s?.featureNotes} className="sm:col-span-2" hint="Kept for reference; the checkboxes above drive search." />
        </div>
      </Group>

      <Group title="Operational">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Availability mode" name="availabilityMode" defaultValue={s?.availabilityMode ?? "request"} options={[{ key: "request", label: "Request / unknown" }, { key: "rules", label: "Known rules" }, { key: "instant", label: "Instant book (future)" }]} blank={null} />
          <Input label="Max duration (minutes)" name="maxDurationMinutes" type="number" defaultValue={s?.maxDurationMinutes} />
          <Input label="Age restriction" name="ageRestriction" defaultValue={s?.ageRestriction} />
          <TextArea label="Availability notes" name="availabilityNotes" rows={2} defaultValue={s?.availabilityNotes} className="sm:col-span-3" />
          <Input label="Outside cake policy" name="outsideCakePolicy" defaultValue={s?.outsideCakePolicy} />
          <Input label="Decor policy" name="decorPolicy" defaultValue={s?.decorPolicy} />
          <Input label="Outside vendor policy" name="outsideVendorPolicy" defaultValue={s?.outsideVendorPolicy} />
          <TextArea label="Other restrictions" name="otherRestrictions" rows={2} defaultValue={s?.otherRestrictions} className="sm:col-span-3" />
          <TextArea label="Research notes (internal)" name="researchNotes" rows={3} defaultValue={s?.researchNotes} className="sm:col-span-3" />
        </div>
      </Group>

      <Group title="Record where this edit came from" hint="Optional, but keeps provenance honest.">
        <div className="grid gap-3 sm:grid-cols-4">
          <Select label="Source" name="editSourceType" options={SOURCE_TYPES} blank="No source recorded" />
          <Select label="Confidence" name="editConfidence" options={CONFIDENCE_LEVELS} defaultValue="publicly_listed" blank={null} />
          <Input label="Source URL" name="editSourceUrl" type="url" />
          <Input label="Note" name="editNote" />
        </div>
      </Group>

      <div className="flex gap-2">
        <button className="btn-dark">Save space</button>
      </div>
    </form>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-ink-200 p-4">
      <legend className="px-1 text-[12px] font-semibold uppercase tracking-wider text-ink-600">{title}</legend>
      {hint ? <p className="mb-3 text-[12px] text-ink-500">{hint}</p> : null}
      <div className="space-y-4">{children}</div>
    </fieldset>
  );
}
