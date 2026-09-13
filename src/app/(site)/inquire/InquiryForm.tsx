"use client";
import { useActionState, useState } from "react";
import { submitInquiry, type InquiryFormState } from "@/app/actions/inquiries";
import { SpaceImage } from "@/components/space/SpaceImage";
import { Field, Spinner } from "@/components/ui";
import { EVENT_TYPES, PRIVACY_LEVELS } from "@/lib/taxonomy";

type SpaceLite = { id: string; slug: string; name: string; restaurantName: string; neighborhoodName: string | null; photoUrl: string | null; spaceType: string; maxSeated: number | null; maxStanding: number | null };

export function InquiryForm({ spaces, defaults, snapshot }: { spaces: SpaceLite[]; defaults: Record<string, string | undefined>; snapshot: string }) {
  const [state, action, pending] = useActionState<InquiryFormState, FormData>(submitInquiry, {});
  const [preferred, setPreferred] = useState(spaces[0]?.slug ?? "");
  const [selected, setSelected] = useState<string[]>(spaces.map((s) => s.slug));
  const err = (k: string) => state.fieldErrors?.[k];
  const toggle = (slug: string) => setSelected((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  return (
    <form action={action} className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="spaces" value={selected.join(",")} />
      <input type="hidden" name="preferred" value={preferred} />
      <input type="hidden" name="snapshot" value={snapshot} />
      <div className="space-y-8">
        <Section title="Your event">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Occasion" htmlFor="eventType">
              <select id="eventType" name="eventType" defaultValue={defaults.event ?? ""} className="input">
                <option value="">Choose one</option>
                {EVENT_TYPES.map((e) => (
                  <option key={e.key} value={e.key}>{e.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Guest count" htmlFor="guestCount">
              <input id="guestCount" name="guestCount" type="number" min={1} required defaultValue={defaults.guests ?? ""} className="input" />
              {err("guestCount") ? <p className="mt-1 text-[12.5px] text-rope-700">Enter a number of guests.</p> : null}
            </Field>
            <Field label="Date" htmlFor="eventDate">
              <input id="eventDate" name="eventDate" type="date" defaultValue={defaults.date ?? ""} className="input" />
            </Field>
            <Field label="Preferred start time" htmlFor="startTime">
              <input id="startTime" name="startTime" type="time" step={900} defaultValue={defaults.time ?? ""} className="input" />
            </Field>
            <Field label="Acceptable time range" htmlFor="timeFlexibility" hint="e.g. Anytime between 6 and 8 PM">
              <input id="timeFlexibility" name="timeFlexibility" className="input" placeholder="Flexible" />
            </Field>
            <Field label="Expected duration" htmlFor="durationMinutes">
              <select id="durationMinutes" name="durationMinutes" defaultValue="" className="input">
                <option value="">Not sure</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
                <option value="240">4 hours</option>
                <option value="360">6 hours</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Budget & requirements">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget" htmlFor="budget" hint="Approximate is fine. Helps us negotiate.">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">$</span>
                  <input id="budget" name="budget" type="number" min={0} step={50} defaultValue={defaults.budget ?? ""} className="input !pl-7" placeholder="3,000" />
                </div>
                <label className="flex items-center gap-1.5 text-[13.5px] text-ink-700">
                  <input type="checkbox" name="budgetIsPerPerson" className="accent-rope-600" /> per person
                </label>
              </div>
            </Field>
            <Field label="Privacy" htmlFor="privacyRequirement">
              <select id="privacyRequirement" name="privacyRequirement" defaultValue="" className="input">
                <option value="">No preference</option>
                {PRIVACY_LEVELS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </Field>
            <Field label="AV requirements" htmlFor="avRequirements" hint="Screen, projector, microphone, a slideshow…">
              <input id="avRequirements" name="avRequirements" className="input" placeholder="None" />
            </Field>
            <Field label="Food preferences" htmlFor="foodPreferences">
              <input id="foodPreferences" name="foodPreferences" className="input" placeholder="Family style, three-course, cocktail bites…" />
            </Field>
            <Field label="Dietary needs" htmlFor="dietaryNeeds">
              <input id="dietaryNeeds" name="dietaryNeeds" className="input" placeholder="Vegetarian options, nut allergy…" />
            </Field>
          </div>
          <Field label="Anything else" htmlFor="specialRequests">
            <textarea id="specialRequests" name="specialRequests" rows={3} className="input" placeholder="Cake, decor, a toast, parking for 10 cars, must be quiet enough for a speech…" />
          </Field>
        </Section>

        <Section title="How to reach you">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="contactName">
              <input id="contactName" name="contactName" required defaultValue={defaults.name ?? ""} className="input" />
              {err("contactName") ? <p className="mt-1 text-[12.5px] text-rope-700">Please enter your name.</p> : null}
            </Field>
            <Field label="Email" htmlFor="contactEmail" hint="We'll send a link to track progress.">
              <input id="contactEmail" name="contactEmail" type="email" required defaultValue={defaults.email ?? ""} className="input" />
              {err("contactEmail") ? <p className="mt-1 text-[12.5px] text-rope-700">Enter a valid email.</p> : null}
            </Field>
            <Field label="Phone (optional)" htmlFor="contactPhone">
              <input id="contactPhone" name="contactPhone" type="tel" defaultValue={defaults.phone ?? ""} className="input" />
            </Field>
            <Field label="Company (optional)" htmlFor="company">
              <input id="company" name="company" className="input" />
            </Field>
          </div>
        </Section>

        {state.error ? <p className="rounded-xl bg-rope-50 px-4 py-3 text-[14px] text-rope-800">{state.error}</p> : null}
        <button type="submit" disabled={pending || !selected.length} className="btn-primary w-full sm:w-auto">
          {pending ? <Spinner /> : null} Send to Red Rope
        </button>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-4">
          <h3 className="text-[15px] font-semibold text-ink-900">Spaces to pursue</h3>
          <p className="mt-0.5 text-[13px] text-ink-500">We'll contact all selected venues in parallel. Mark your favorite.</p>
          <ul className="mt-3 space-y-2">
            {spaces.map((s) => {
              const on = selected.includes(s.slug);
              return (
                <li key={s.id} className={`flex gap-3 rounded-xl border p-2 ${on ? "border-ink-300" : "border-ink-100 opacity-60"}`}>
                  <SpaceImage src={s.photoUrl} alt={s.name} spaceType={s.spaceType} className="h-16 w-20 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-ink-900">{s.name}</p>
                    <p className="truncate text-[12.5px] text-ink-600">{s.restaurantName}{s.neighborhoodName ? ` · ${s.neighborhoodName}` : ""}</p>
                    <div className="mt-1 flex gap-2 text-[12px]">
                      <label className="flex items-center gap-1 text-ink-700">
                        <input type="checkbox" checked={on} onChange={() => toggle(s.slug)} className="accent-rope-600" /> include
                      </label>
                      <label className="flex items-center gap-1 text-ink-700">
                        <input type="radio" name="_preferred" checked={preferred === s.slug} onChange={() => setPreferred(s.slug)} disabled={!on} className="accent-rope-600" /> favorite
                      </label>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-500">Red Rope never shares your contact details with a restaurant until you approve a booking.</p>
      </aside>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 font-display text-[22px] text-ink-900">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
