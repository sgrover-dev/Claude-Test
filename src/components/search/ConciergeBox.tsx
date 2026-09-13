"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/components/ui";

const EXAMPLES = [
  "Somewhere nice but not stuffy near the Galleria for a 20-person management dinner next Tuesday. Need a screen for 20 minutes. Around $100/person.",
  "Casual cocktail party for about 30 around Montrose. We'd like our own area but don't need total privacy. Maybe $2,500.",
  "Rehearsal dinner for 40 in the Heights on a Friday in October, family-style Italian, under $4k.",
];

export function ConciergeBox({ compact = false, initialText = "" }: { compact?: boolean; initialText?: string }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/concierge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "Something went wrong");
      const data = (await res.json()) as { href: string; summary: string; unresolved: string[]; provider: string };
      try {
        sessionStorage.setItem("rr.concierge", JSON.stringify({ text, ...data }));
      } catch {}
      router.push(data.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className={`rounded-2xl bg-white p-3 shadow-pop ${compact ? "" : "sm:p-4"}`}>
      <label className="sr-only" htmlFor="concierge">
        Tell Red Rope what you're looking for
      </label>
      <textarea
        id="concierge"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        rows={compact ? 2 : 3}
        placeholder="e.g. Nice but not stuffy near the Galleria for 20 people next Tuesday. Need a screen. Around $100/person."
        className="w-full resize-none rounded-xl border-0 bg-ink-50 px-4 py-3 text-[15px] text-ink-900 outline-none placeholder:text-ink-400 focus:ring-4 focus:ring-rope-100"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {compact ? (
          <span className="text-[12.5px] text-ink-500">We'll turn this into filters you can adjust.</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((ex, i) => (
              <button key={i} type="button" onClick={() => setText(ex)} className="chip !py-0.5 text-[12px]">
                Example {i + 1}
              </button>
            ))}
          </div>
        )}
        <button type="submit" disabled={loading || !text.trim()} className="btn-primary">
          {loading ? <Spinner /> : null} {loading ? "Interpreting…" : "Find spaces"}
        </button>
      </div>
      {error ? <p className="mt-2 text-[13px] text-rope-700">{error}</p> : null}
    </form>
  );
}
