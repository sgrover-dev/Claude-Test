import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, eyebrow, actions, back }: { title: ReactNode; eyebrow?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back ? <Link href={back.href} className="text-[12.5px] text-ink-500 hover:text-rope-700">← {back.label}</Link> : null}
        {eyebrow ? <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-500">{eyebrow}</p> : null}
        <h1 className="font-display text-[26px] leading-tight text-ink-900">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-ink-200 bg-white ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-600">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Table({ head, children, className = "" }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-ink-200 bg-white ${className}`}>
      <table className="w-full text-[13px]">
        <thead className="bg-ink-50 text-left text-[11.5px] font-semibold uppercase tracking-wider text-ink-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

export function Input({ label, name, defaultValue, type = "text", placeholder, hint, required, step, className = "" }: { label: string; name: string; defaultValue?: string | number | null; type?: string; placeholder?: string; hint?: string; required?: boolean; step?: string | number; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[12px] font-medium text-ink-600">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} required={required} step={step} className="input !py-1.5 !text-[13.5px]" />
      {hint ? <span className="mt-0.5 block text-[11.5px] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function TextArea({ label, name, defaultValue, rows = 3, hint, placeholder, className = "" }: { label: string; name: string; defaultValue?: string | null; rows?: number; hint?: string; placeholder?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[12px] font-medium text-ink-600">{label}</span>
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={rows} placeholder={placeholder} className="input !py-1.5 !text-[13.5px]" />
      {hint ? <span className="mt-0.5 block text-[11.5px] text-ink-500">{hint}</span> : null}
    </label>
  );
}

export function Select({ label, name, defaultValue, options, className = "", blank = "—" }: { label: string; name: string; defaultValue?: string | null; options: readonly { key: string; label: string }[]; className?: string; blank?: string | null }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[12px] font-medium text-ink-600">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className="input !py-1.5 !text-[13.5px]">
        {blank !== null ? <option value="">{blank}</option> : null}
        {options.map((o) => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function CheckGroup({ label, name, options, selected, columns = 3 }: { label: string; name: string; options: readonly { key: string; label: string }[]; selected: string[]; columns?: number }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[12px] font-medium text-ink-600">{label}</legend>
      <div className={`grid gap-x-3 gap-y-1 ${columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        {options.map((o) => (
          <label key={o.key} className="flex items-center gap-1.5 text-[13px] text-ink-800">
            <input type="checkbox" name={name} value={o.key} defaultChecked={selected.includes(o.key)} className="accent-rope-600" /> {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "good" | "warn" | "bad"; children: ReactNode }) {
  const tones = { info: "bg-ink-100 text-ink-700", good: "bg-sage-100 text-sage-700", warn: "bg-gold-100 text-gold-700", bad: "bg-rope-50 text-rope-800" };
  return <div className={`rounded-lg px-3 py-2 text-[13px] ${tones[tone]}`}>{children}</div>;
}

export function StatusPill({ value }: { value: string }) {
  const tone =
    /verified|booked|active|available|quote_received|completed|approved|succeeded/.test(value) ? "bg-sage-100 text-sage-700"
    : /unavailable|cancelled|rejected|failed|archived|customer_rejected/.test(value) ? "bg-ink-100 text-ink-600"
    : /needs_review|awaiting|contacted|follow_up|needs_clarification|deposit|pending|researching|draft/.test(value) ? "bg-gold-100 text-gold-700"
    : "bg-ink-100 text-ink-700";
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ${tone}`}>{value.replace(/_/g, " ")}</span>;
}

export function SubmitButton({ children, variant = "primary", className = "", formAction, name, value, confirm }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "ghost"; className?: string; formAction?: (formData: FormData) => void | Promise<void>; name?: string; value?: string; confirm?: string }) {
  const cls = variant === "primary" ? "btn-dark btn-sm" : variant === "danger" ? "btn btn-sm border border-rope-200 bg-white text-rope-700 hover:bg-rope-50" : variant === "ghost" ? "btn-ghost btn-sm" : "btn-secondary btn-sm";
  return (
    <button type="submit" formAction={formAction} name={name} value={value} className={`${cls} ${className}`} {...(confirm ? { onClick: undefined, "data-confirm": confirm } : {})}>
      {children}
    </button>
  );
}
