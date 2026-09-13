import { saveRestaurant } from "@/app/admin/actions/inventory";
import type { Restaurant } from "@/db/schema";
import { CUISINES } from "@/lib/taxonomy";
import { CheckGroup, Input, Select, TextArea } from "./ui";

export function RestaurantForm({ restaurant }: { restaurant?: Restaurant | null }) {
  const r = restaurant;
  return (
    <form action={saveRestaurant} className="space-y-5">
      {r ? <input type="hidden" name="id" value={r.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Name" name="name" defaultValue={r?.name} required className="sm:col-span-2" />
        <TextArea label="Description" name="description" defaultValue={r?.description} className="sm:col-span-2" />
        <Select label="Price tier" name="priceTier" defaultValue={r?.priceTier ? String(r.priceTier) : ""} options={[{ key: "1", label: "$" }, { key: "2", label: "$$" }, { key: "3", label: "$$$" }, { key: "4", label: "$$$$" }]} />
        <Select label="Status" name="status" defaultValue={r?.status ?? "active"} options={[{ key: "active", label: "Active" }, { key: "draft", label: "Draft (hidden)" }, { key: "archived", label: "Archived" }]} blank={null} />
        <Input label="Website" name="websiteUrl" defaultValue={r?.websiteUrl} type="url" />
        <Input label="Private events page" name="eventsPageUrl" defaultValue={r?.eventsPageUrl} type="url" />
        <Input label="Main phone" name="phone" defaultValue={r?.phone} />
        <Input label="General email" name="email" defaultValue={r?.email} type="email" />
        <Input label="Hero image URL" name="heroImageUrl" defaultValue={r?.heroImageUrl} className="sm:col-span-2" />
      </div>
      <CheckGroup label="Cuisines" name="cuisines" options={CUISINES} selected={r?.cuisines ?? []} columns={4} />
      <fieldset className="rounded-lg border border-ink-200 p-3">
        <legend className="px-1 text-[12px] font-semibold text-ink-600">Events contact</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Name" name="eventsContactName" defaultValue={r?.eventsContactName} />
          <Input label="Email" name="eventsContactEmail" defaultValue={r?.eventsContactEmail} type="email" />
          <Input label="Phone" name="eventsContactPhone" defaultValue={r?.eventsContactPhone} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-[13px] text-ink-700">
          <input type="checkbox" name="contactVerified" className="accent-rope-600" /> Mark contact as verified now{r?.contactVerifiedAt ? ` (last verified ${r.contactVerifiedAt.toLocaleDateString()})` : ""}
        </label>
      </fieldset>
      <TextArea label="Internal notes" name="internalNotes" defaultValue={r?.internalNotes} rows={3} hint="Research notes, who to call, quirks. Never shown to consumers." />
      <button className="btn-dark">Save restaurant</button>
    </form>
  );
}
