import Link from "next/link";
import { startFileJob, startTextJob, startUrlJob } from "@/app/admin/actions/ingestion";
import { Input, Notice, PageHeader, Panel, StatusPill, SubmitButton, Table, Td, TextArea } from "@/components/admin/ui";
import { isAiEnabled } from "@/lib/ai/client";
import { listJobs } from "@/lib/ingestion/jobs";
import { relativeTime } from "@/lib/format";

export default async function IngestionPage() {
  const jobs = await listJobs(60);
  const pending = jobs.filter((j) => j.status === "needs_review");
  return (
    <>
      <PageHeader title="Ingestion & review queue" eyebrow={`${pending.length} job(s) awaiting review`} />
      {!isAiEnabled() ? <div className="mb-4"><Notice tone="warn">No ANTHROPIC_API_KEY configured — URL, text and PDF extraction fall back to rule-based heuristics (lower recall). CSV import is unaffected.</Notice></div> : null}
      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <Panel title="From a URL">
          <form action={startUrlJob} className="space-y-2">
            <Input label="Private events page or restaurant site" name="url" type="url" placeholder="https://restaurant.com/private-dining" required />
            <p className="text-[11.5px] text-ink-500">Fetches the page, extracts candidate spaces, and finds linked PDFs. Nothing goes live until you approve it.</p>
            <SubmitButton>Fetch & extract</SubmitButton>
          </form>
        </Panel>
        <Panel title="From a file">
          <form action={startFileJob} className="space-y-2">
            <label className="block text-[12px] font-medium text-ink-600">CSV (venue research format) or PDF (private dining packet)<input type="file" name="file" accept=".csv,text/csv,application/pdf" required className="mt-1 block text-[12.5px]" /></label>
            <Input label="Source URL (optional, for PDFs)" name="sourceUrl" type="url" />
            <label className="flex items-center gap-2 text-[12.5px] text-ink-700"><input type="checkbox" name="applyDirectly" className="accent-rope-600" /> CSV: apply directly (skip review; fills blanks, never overwrites)</label>
            <SubmitButton>Upload</SubmitButton>
          </form>
        </Panel>
        <Panel title="Paste text">
          <form action={startTextJob} className="space-y-2">
            <Input label="Restaurant / title" name="title" placeholder="Brennan's of Houston" />
            <Input label="Source URL (optional)" name="sourceUrl" type="url" />
            <TextArea label="Text from a website, email or brochure" name="text" rows={4} />
            <SubmitButton>Extract</SubmitButton>
          </form>
        </Panel>
      </div>
      <Panel title="Jobs">
        <p className="mb-3 text-[12.5px] text-ink-500">CSV template columns: restaurant_name, address, neighborhood, private_dining_page_url, space_name, space_type, capacity_seated, capacity_standing, min_guests, amenities, pricing, event_contact_name, event_contact_email, event_contact_phone, menu_pdf_urls, source_urls, last_verified, notes. See <code>data/imports/houston-venues.csv</code>.</p>
        <Table head={["Source", "Input", "Status", "Summary", "Candidates", "Created"]}>
          {jobs.map((j) => (
            <tr key={j.id} className="hover:bg-ink-50">
              <Td className="font-medium uppercase">{j.source}</Td>
              <Td><Link href={`/admin/ingestion/${j.id}`} className="text-rope-700 hover:underline">{j.inputLabel ?? j.inputUrl ?? j.id.slice(0, 8)}</Link></Td>
              <Td><StatusPill value={j.status} /></Td>
              <Td className="text-ink-600">{j.error ? <span className="text-rope-700">{j.error}</span> : j.summary}</Td>
              <Td>{j.candidates.filter((c) => c.status === "pending").length} pending / {j.candidates.length}</Td>
              <Td className="text-ink-500">{relativeTime(j.createdAt)}</Td>
            </tr>
          ))}
          {!jobs.length ? <tr><Td className="text-ink-500">No jobs yet.</Td></tr> : null}
        </Table>
      </Panel>
    </>
  );
}
