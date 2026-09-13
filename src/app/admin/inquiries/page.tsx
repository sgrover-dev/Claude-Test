import Link from "next/link";
import { PageHeader, StatusPill, Table, Td } from "@/components/admin/ui";
import { listInquiriesForOps } from "@/lib/data/inquiries";
import { formatCents, formatDate, relativeTime } from "@/lib/format";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_ORDER, candidateNeedsFollowUp } from "@/lib/inquiries/state";
import type { InquiryStatus } from "@/db/schema";

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const rows = await listInquiriesForOps({ status: (sp.status as InquiryStatus | "active" | "all" | undefined) ?? "active", q: sp.q });
  return (
    <>
      <PageHeader title="Inquiries" eyebrow={`${rows.length} shown`} />
      <form className="mb-4 flex flex-wrap gap-2 text-[13px]">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Name, email or #" className="input !w-56 !py-1.5" />
        <select name="status" defaultValue={sp.status ?? "active"} className="input !w-auto !py-1.5">
          <option value="active">All active</option>
          <option value="all">Everything</option>
          {INQUIRY_STATUS_ORDER.map((s) => <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>)}
        </select>
        <button className="btn-secondary btn-sm">Filter</button>
      </form>
      <Table head={["#", "Customer", "Event", "Date", "Guests", "Budget", "Venues", "Status", "Updated"]}>
        {rows.map((i) => {
          const followUps = i.candidates.filter((c) => candidateNeedsFollowUp(c.status, c.lastContactAt)).length;
          return (
            <tr key={i.id} className="hover:bg-ink-50">
              <Td><Link href={`/admin/inquiries/${i.id}`} className="font-medium text-rope-700 hover:underline">#{i.number}</Link></Td>
              <Td><span className="font-medium">{i.contactName}</span><span className="block text-[11.5px] text-ink-500">{i.contactEmail}</span></Td>
              <Td className="text-ink-700">{i.eventType?.replace(/_/g, " ") ?? "—"}</Td>
              <Td>{i.eventDate ? formatDate(i.eventDate, { weekday: "short" }) : "flexible"}</Td>
              <Td>{i.guestCount}</Td>
              <Td>{i.budgetCents ? `${formatCents(i.budgetCents)}${i.budgetIsPerPerson ? "/pp" : ""}` : "—"}</Td>
              <Td className="text-ink-600">{i.candidates.length} {followUps ? <span className="ml-1 rounded bg-gold-100 px-1 text-[11px] text-gold-700">{followUps} follow-up</span> : null}</Td>
              <Td><StatusPill value={i.status} /></Td>
              <Td className="text-ink-500">{relativeTime(i.updatedAt)}</Td>
            </tr>
          );
        })}
        {!rows.length ? <tr><Td className="text-ink-500">No inquiries match.</Td></tr> : null}
      </Table>
    </>
  );
}
