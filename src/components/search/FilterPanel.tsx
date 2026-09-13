"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSearch } from "@/app/actions/saved";
import { searchFiltersToParams } from "@/lib/search/params";
import type { SearchFilters } from "@/lib/search/types";
import { AMBIANCE, CUISINES, EVENT_TYPES, FOOD_STYLES, INDOOR_OUTDOOR, PRIVACY_LEVELS, SPACE_TYPES } from "@/lib/taxonomy";

export function FilterPanel({ filters, isSignedIn }: { filters: SearchFilters; isSignedIn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "naming" | "saved">("idle");
  const [saveName, setSaveName] = useState("");

  const update = (patch: Partial<SearchFilters>) => {
    const next = { ...filters, ...patch, page: 1 };
    const qs = searchFiltersToParams(next).toString();
    start(() => router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  };
  const toggleIn = (key: keyof SearchFilters, value: string) => {
    const current = (filters[key] as string[] | undefined) ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.length ? next : undefined } as Partial<SearchFilters>);
  };
  const clearAll = () => update({
    privacy: undefined, budgetCents: undefined, budgetPerPerson: undefined, eventType: undefined, cuisines: undefined, ambiance: undefined,
    foodStyles: undefined, indoorOutdoor: undefined, amenities: undefined, avRequired: undefined, displayRequired: undefined, accessible: undefined,
    parking: undefined, alcohol: undefined, privateBar: undefined, format: undefined, durationMinutes: undefined, maxMinimumCents: undefined, spaceTypes: undefined, q: undefined,
  });

  const activeCount = [
    filters.privacy?.length, filters.budgetCents, filters.eventType, filters.cuisines?.length, filters.ambiance?.length, filters.foodStyles?.length,
    filters.indoorOutdoor?.length, filters.avRequired, filters.displayRequired, filters.accessible, filters.parking, filters.alcohol, filters.privateBar,
    filters.format, filters.durationMinutes, filters.maxMinimumCents, filters.spaceTypes?.length, filters.q,
  ].filter(Boolean).length;

  const onSave = () =>
    start(async () => {
      const res = await saveSearch(saveName || "My search", filters as unknown as Record<string, unknown>, `${pathname}?${searchFiltersToParams(filters)}`);
      if ("redirect" in res) router.push(res.redirect);
      else if ("ok" in res) setSaveState("saved");
    });

  return (
    <aside className={`space-y-6 ${pending ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink-900">Filters {activeCount ? <span className="ml-1 rounded-full bg-ink-900 px-1.5 py-0.5 text-[11px] text-white">{activeCount}</span> : null}</h2>
        {activeCount ? (
          <button onClick={clearAll} className="text-[13px] text-ink-500 hover:text-rope-700">
            Clear all
          </button>
        ) : null}
      </div>

      <Group title="Privacy">
        {PRIVACY_LEVELS.map((p) => (
          <Check key={p.key} label={p.label} hint={p.hint} checked={filters.privacy?.includes(p.key as never) ?? false} onChange={() => toggleIn("privacy", p.key)} />
        ))}
      </Group>

      <Group title="Budget">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">$</span>
            <input
              type="number"
              min={0}
              step={50}
              defaultValue={filters.budgetCents ? filters.budgetCents / 100 : ""}
              key={filters.budgetCents ?? "none"}
              placeholder="3,000"
              onBlur={(e) => update({ budgetCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined })}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="input !pl-7 !py-2 text-[14px]"
            />
          </div>
          <select value={filters.budgetPerPerson ? "pp" : "total"} onChange={(e) => update({ budgetPerPerson: e.target.value === "pp" || undefined })} className="input !w-auto !py-2 text-[14px]">
            <option value="total">total</option>
            <option value="pp">per person</option>
          </select>
        </div>
        <div className="mt-2">
          <label className="text-[12.5px] text-ink-500">Max F&B minimum</label>
          <div className="relative mt-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">$</span>
            <input
              type="number"
              min={0}
              step={250}
              key={filters.maxMinimumCents ?? "none"}
              defaultValue={filters.maxMinimumCents ? filters.maxMinimumCents / 100 : ""}
              placeholder="any"
              onBlur={(e) => update({ maxMinimumCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined })}
              className="input !pl-7 !py-2 text-[14px]"
            />
          </div>
        </div>
      </Group>

      <Group title="Occasion">
        <select value={filters.eventType ?? ""} onChange={(e) => update({ eventType: e.target.value || undefined })} className="input !py-2 text-[14px]">
          <option value="">Any occasion</option>
          {EVENT_TYPES.map((e) => (
            <option key={e.key} value={e.key}>
              {e.label}
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-1.5">
          {(["seated", "standing"] as const).map((f) => (
            <button key={f} type="button" onClick={() => update({ format: filters.format === f ? undefined : f })} className={`chip ${filters.format === f ? "chip-active" : ""}`}>
              {f === "seated" ? "Seated" : "Standing / reception"}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Requirements">
        <Check label="AV (mic, speakers, screen)" checked={!!filters.avRequired} onChange={() => update({ avRequired: !filters.avRequired || undefined })} />
        <Check label="TV / projector / screen" checked={!!filters.displayRequired} onChange={() => update({ displayRequired: !filters.displayRequired || undefined })} />
        <Check label="Private bar" checked={!!filters.privateBar} onChange={() => update({ privateBar: !filters.privateBar || undefined })} />
        <Check label="Alcohol available" checked={!!filters.alcohol} onChange={() => update({ alcohol: !filters.alcohol || undefined })} />
        <Check label="Parking or valet" checked={!!filters.parking} onChange={() => update({ parking: !filters.parking || undefined })} />
        <Check label="Wheelchair accessible" checked={!!filters.accessible} onChange={() => update({ accessible: !filters.accessible || undefined })} />
      </Group>

      <Group title="Setting">
        <div className="flex flex-wrap gap-1.5">
          {INDOOR_OUTDOOR.map((o) => (
            <button key={o.key} type="button" onClick={() => toggleIn("indoorOutdoor", o.key)} className={`chip ${filters.indoorOutdoor?.includes(o.key as never) ? "chip-active" : ""}`}>
              {o.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SPACE_TYPES.filter((t) => t.key !== "other").map((t) => (
            <button key={t.key} type="button" onClick={() => toggleIn("spaceTypes", t.key)} className={`chip ${filters.spaceTypes?.includes(t.key) ? "chip-active" : ""}`}>
              {t.label}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Cuisine" collapsible defaultOpen={!!filters.cuisines?.length}>
        <div className="flex flex-wrap gap-1.5">
          {CUISINES.map((c) => (
            <button key={c.key} type="button" onClick={() => toggleIn("cuisines", c.key)} className={`chip ${filters.cuisines?.includes(c.key) ? "chip-active" : ""}`}>
              {c.label}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Ambiance" collapsible defaultOpen={!!filters.ambiance?.length}>
        <div className="flex flex-wrap gap-1.5">
          {AMBIANCE.map((c) => (
            <button key={c.key} type="button" onClick={() => toggleIn("ambiance", c.key)} className={`chip ${filters.ambiance?.includes(c.key) ? "chip-active" : ""}`}>
              {c.label}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Food style" collapsible defaultOpen={!!filters.foodStyles?.length}>
        <div className="flex flex-wrap gap-1.5">
          {FOOD_STYLES.map((c) => (
            <button key={c.key} type="button" onClick={() => toggleIn("foodStyles", c.key)} className={`chip ${filters.foodStyles?.includes(c.key) ? "chip-active" : ""}`}>
              {c.label}
            </button>
          ))}
        </div>
      </Group>

      <Group title="Duration" collapsible defaultOpen={!!filters.durationMinutes}>
        <select value={filters.durationMinutes ?? ""} onChange={(e) => update({ durationMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined })} className="input !py-2 text-[14px]">
          <option value="">Not sure</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
          <option value="180">3 hours</option>
          <option value="240">4 hours</option>
          <option value="300">5+ hours</option>
        </select>
      </Group>

      <div className="border-t border-ink-200 pt-4">
        {saveState === "saved" ? (
          <p className="text-[13px] text-sage-700">Saved to your account.</p>
        ) : saveState === "naming" ? (
          <div className="flex gap-2">
            <input autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Name this search" className="input !py-2 text-[14px]" />
            <button onClick={onSave} className="btn-dark btn-sm">
              Save
            </button>
          </div>
        ) : (
          <button onClick={() => (isSignedIn ? setSaveState("naming") : router.push(`/login?next=${encodeURIComponent(`${pathname}?${searchFiltersToParams(filters)}`)}`))} className="btn-secondary w-full">
            Save this search
          </button>
        )}
      </div>
    </aside>
  );
}

function Group({ title, children, collapsible = false, defaultOpen = true }: { title: string; children: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-ink-200 pt-4">
      <button type="button" onClick={() => collapsible && setOpen((o) => !o)} className={`mb-2.5 flex w-full items-center justify-between text-[13px] font-semibold uppercase tracking-wider text-ink-600 ${collapsible ? "" : "cursor-default"}`}>
        {title}
        {collapsible ? <span className="text-ink-400">{open ? "−" : "+"}</span> : null}
      </button>
      {open ? <div className="space-y-1.5">{children}</div> : null}
    </div>
  );
}

function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 py-0.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 rounded border-ink-300 text-rope-600 accent-rope-600" />
      <span className="text-[14px] leading-tight text-ink-800">
        {label}
        {hint ? <span className="block text-[12px] text-ink-500">{hint}</span> : null}
      </span>
    </label>
  );
}
