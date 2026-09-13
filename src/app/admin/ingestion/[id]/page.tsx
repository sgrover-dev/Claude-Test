import Link from "next/link";
import { notFound } from "next/navigation";
import { reviewCandidate } from "@/app/admin/actions/ingestion";
import { CheckGroup, Input, Notice, PageHeader, Panel, Select, StatusPill, SubmitButton, TextArea } from "@/components/admin/ui";
import { getCityBySlug, listNeighborhoods } from "@/lib/data/cities";
import { getJob } from "@/lib/ingestion/jobs";
import type { InventoryPayload } from "@/lib/ingestion/types";
import { CUISINES, PRIVACY_LEVELS, SPACE_TYPES } from "@/lib/taxonomy";

const cents = (c: number | null | undefined) => (c == null ? "" : String(c / 100));

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const city = await getCityBySlug("houston");
  const hoods = city ? await listNeighborhoods(city.id) : [];
  const raw = (job.rawPayload ?? {}) as Record<string, unknown>;
  return (
    <>
      <PageHeader title={job.inputLabel ?? job.inputUrl ?? "Ingestion job"} eyebrow={<><span className="uppercase">{job.source}</span> · <StatusPill value={job.status} /></>} back={{ href: "/admin/ingestion", label: "Ingestion" }} />
      {job.error ? <div className="mb-4"><Notice tone="bad">{job.error}</Notice></div> : null}
      {job.summary ? <div className="mb-4"><Notice tone="info">{job.summary}</Notice></div> : null}
      {Array.isArray(raw.pdfLinks) && (raw.pdfLinks as string[]).length ? (
        <div className="mb-4 text-[13px]"><span className="font-medium">PDFs found on page:</span> {(raw.pdfLinks as string[]).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="ml-2 text-rope-700 hover:underline">{u.split("/").pop()?.slice(0, 40)}</a>)}</div>
      ) : null}
      {Array.isArray(raw.eventLinks) && (raw.eventLinks as string[]).length ? (
        <div className="mb-4 text-[13px]"><span className="font-medium">Related pages:</span> {(raw.eventLinks as string[]).slice(0, 6).map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="ml-2 text-rope-700 hover:underline">{new URL(u).pathname.slice(0, 40)}</a>)}</div>
      ) : null}

      <div className="space-y-6">
        {job.candidates.map((c) => {
          const p = c.payload as unknown as InventoryPayload;
          const done = c.status !== "pending";
          return (
            <Panel key={c.id} title={<>{p.restaurant.name} <StatusPill value={c.status} /> {c.overallConfidence ? <span className="ml-2 normal-case text-ink-500">confidence {Math.round(Number(c.overallConfidence) * 100)}%</span> : null}</>} actions={c.appliedEntityId ? <Link href={`/admin/restaurants/${c.appliedEntityId}`} className="text-[12.5px] text-rope-700 hover:underline">Open restaurant</Link> : null}>
              <form action={reviewCandidate} className="space-y-4">
                <input type="hidden" name="candidateId" value={c.id} />
                <input type="hidden" name="spaceCount" value={p.spaces.length} />
                <fieldset disabled={done} className="space-y-4 disabled:opacity-70">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input label="Restaurant" name="restaurant.name" defaultValue={p.restaurant.name} />
                    <Input label="Website" name="restaurant.websiteUrl" defaultValue={p.restaurant.websiteUrl} />
                    <Input label="Events page" name="restaurant.eventsPageUrl" defaultValue={p.restaurant.eventsPageUrl} />
                    <Input label="Address" name="location.addressLine1" defaultValue={p.location.addressLine1} />
                    <Input label="City" name="location.cityName" defaultValue={p.location.cityName ?? "Houston"} />
                    <Input label="ZIP" name="location.postalCode" defaultValue={p.location.postalCode} />
                    <Select label="Neighborhood" name="location.neighborhoodSlug" defaultValue={p.location.neighborhoodSlug} options={hoods.map((h) => ({ key: h.slug, label: h.name }))} blank={p.location.neighborhoodRaw ? `Unmapped: ${p.location.neighborhoodRaw}` : "—"} />
                    <Input label="Events contact" name="restaurant.eventsContactName" defaultValue={p.restaurant.eventsContactName} />
                    <Input label="Contact email" name="restaurant.eventsContactEmail" defaultValue={p.restaurant.eventsContactEmail} />
                    <Input label="Contact phone" name="restaurant.eventsContactPhone" defaultValue={p.restaurant.eventsContactPhone} />
                    <Input label="Main phone" name="restaurant.phone" defaultValue={p.restaurant.phone} />
                  </div>
                  <CheckGroup label="Cuisines" name="restaurant.cuisines" options={CUISINES} selected={p.restaurant.cuisines ?? []} columns={4} />
                  {p.restaurant.internalNotes ? <p className="rounded-lg bg-ink-50 p-2 text-[12.5px] text-ink-600"><span className="font-medium">Notes:</span> {p.restaurant.internalNotes}</p> : null}
                  {p.restaurant.documents?.length ? <p className="text-[12.5px] text-ink-600"><span className="font-medium">Documents:</span> {p.restaurant.documents.map((d) => <a key={d.url} href={d.url} className="ml-1 text-rope-700 hover:underline" target="_blank" rel="noreferrer">{d.title}</a>)}</p> : null}

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-[12.5px]">
                      <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="p-1">Incl.</th><th className="p-1">Space</th><th className="p-1">Type</th><th className="p-1">Privacy</th><th className="p-1">Min</th><th className="p-1">Seated</th><th className="p-1">Standing</th><th className="p-1">Minimum $</th><th className="p-1">Room $</th><th className="p-1">PP low</th><th className="p-1">PP high</th><th className="p-1">Deposit</th><th className="p-1">Conf.</th></tr></thead>
                      <tbody>
                        {p.spaces.map((s, i) => (
                          <tr key={i} className="border-t border-ink-100 align-top">
                            <td className="p-1"><input type="checkbox" name={`s${i}.include`} defaultChecked className="accent-rope-600" /></td>
                            <td className="p-1"><input name={`s${i}.name`} defaultValue={s.name} className="input !w-44 !px-2 !py-1 !text-[12.5px]" /><textarea name={`s${i}.description`} defaultValue={s.description ?? ""} rows={2} className="input mt-1 !w-44 !px-2 !py-1 !text-[11.5px]" placeholder="Description" />{s.researchNotes ? <p className="mt-1 w-44 text-[11px] text-ink-500">{s.researchNotes}</p> : null}</td>
                            <td className="p-1"><select name={`s${i}.spaceType`} defaultValue={s.spaceType ?? "other"} className="input !w-36 !px-2 !py-1 !text-[12.5px]">{SPACE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></td>
                            <td className="p-1"><select name={`s${i}.privacy`} defaultValue={s.privacy ?? ""} className="input !w-32 !px-2 !py-1 !text-[12.5px]"><option value="">Unknown</option>{PRIVACY_LEVELS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select></td>
                            <td className="p-1"><input name={`s${i}.minGuests`} defaultValue={s.minGuests ?? ""} className="input !w-14 !px-2 !py-1 !text-[12.5px]" /></td>
                            <td className="p-1"><input name={`s${i}.maxSeated`} defaultValue={s.maxSeated ?? ""} className="input !w-14 !px-2 !py-1 !text-[12.5px]" /></td>
                            <td className="p-1"><input name={`s${i}.maxStanding`} defaultValue={s.maxStanding ?? ""} className="input !w-14 !px-2 !py-1 !text-[12.5px]" /></td>
                            <td className="p-1"><input name={`s${i}.fbMinimum`} defaultValue={cents(s.fbMinimumCents)} className="input !w-20 !px-2 !py-1 !text-[12.5px]" /></td>
                            <td className="p-1"><input name={`s${i}.roomFee`} defaultValue={cents(s.roomFeeCents)} className="input !w-20 !px-2 !py-1 !text-[12.5px]" /></td>
                            <td className="p-1"><input name={`s${i}.perPersonLow`} defaultValue={cents(s.estPerPersonLowCents)} className="input !w-16 !px-2 !py-1 !text-[12.5px]" /></td>
                            <td className="p-1"><input name={`s${i}.perPersonHigh`} defaultValue={cents(s.estPerPersonHighCents)} className="input !w-16 !px-2 !py-1 !text-[12.5px]" /></td>
                            <td className="p-1"><input name={`s${i}.deposit`} defaultValue={cents(s.depositCents)} className="input !w-20 !px-2 !py-1 !text-[12.5px]" /></td>
                            <td className="p-1 text-ink-500">{s.confidence != null ? `${Math.round(s.confidence * 100)}%` : "—"}</td>
                          </tr>
                        ))}
                        {!p.spaces.length ? <tr><td colSpan={13} className="p-2 text-ink-500">No spaces extracted — approve to create the restaurant only, then add spaces manually.</td></tr> : null}
                      </tbody>
                    </table>
                  </div>
                  <TextArea label="Reviewer notes" name="notes" rows={2} defaultValue={c.reviewerNotes} />
                </fieldset>
                {!done ? (
                  <div className="flex flex-wrap gap-2">
                    <SubmitButton name="decision" value="approve">Approve & publish</SubmitButton>
                    <SubmitButton name="decision" value="approve_draft" variant="secondary">Approve as draft (hidden)</SubmitButton>
                    <SubmitButton name="decision" value="reject" variant="danger">Reject</SubmitButton>
                  </div>
                ) : <p className="text-[12.5px] text-ink-500">Reviewed {c.reviewedAt?.toLocaleString()}.</p>}
              </form>
            </Panel>
          );
        })}
        {!job.candidates.length ? <Notice tone="info">No candidates were produced.</Notice> : null}
        {typeof raw.textPreview === "string" ? (
          <details className="rounded-xl border border-ink-200 bg-white p-4 text-[12.5px] text-ink-600"><summary className="cursor-pointer font-medium text-ink-800">Extracted text preview</summary><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap">{raw.textPreview as string}</pre></details>
        ) : null}
      </div>
    </>
  );
}
