"use client";
import { useEffect, useState } from "react";

type Stored = { text: string; summary: string; unresolved: string[]; provider: string };

export function ConciergeSummary() {
  const [data, setData] = useState<Stored | null>(null);
  useEffect(() => {
    // sessionStorage is only available after hydration; a single post-mount read is intentional.
    try {
      const raw = sessionStorage.getItem("rr.concierge");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setData(JSON.parse(raw));
    } catch {}
  }, []);
  if (!data) return null;
  return (
    <div className="fade-up mb-5 rounded-2xl border border-rope-200 bg-rope-50 px-4 py-3.5">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-rope-700">Red Rope heard</p>
      <p className="mt-1 text-[15px] text-ink-900">{data.summary}</p>
      <p className="mt-1 text-[13px] text-ink-600">“{data.text}”</p>
      {data.unresolved.length ? (
        <ul className="mt-2 space-y-0.5 text-[13px] text-gold-700">
          {data.unresolved.map((u) => (
            <li key={u}>• {u}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[12px] text-ink-500">Adjust any filter on the left — nothing is locked in.{data.provider === "fallback" ? " (Rule-based interpretation; connect an AI key for richer parsing.)" : ""}</p>
    </div>
  );
}
