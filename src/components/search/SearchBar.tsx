"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { searchHref } from "@/lib/search/params";
import type { SearchFilters } from "@/lib/search/types";

type Hood = { slug: string; name: string };

export function SearchBar({ neighborhoods, initial = {}, compact = false }: { neighborhoods: Hood[]; initial?: Partial<SearchFilters>; compact?: boolean }) {
  const router = useRouter();
  const [neighborhood, setNeighborhood] = useState(initial.neighborhood ?? "");
  const [date, setDate] = useState(initial.date ?? "");
  const [time, setTime] = useState(initial.startTime ?? "");
  const [guests, setGuests] = useState(initial.guests ? String(initial.guests) : "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(
      searchHref({
        ...initial,
        neighborhood: neighborhood || undefined,
        date: date || undefined,
        startTime: time || undefined,
        guests: guests ? parseInt(guests, 10) : undefined,
        page: 1,
      }),
    );
  };

  const field = compact ? "px-3 py-2" : "px-4 py-3";
  return (
    <form onSubmit={submit} className={`grid gap-2 rounded-2xl bg-white p-2 shadow-pop ${compact ? "sm:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto]" : "sm:grid-cols-[1.4fr_1fr_1fr_0.9fr_auto]"}`}>
      <label className="flex flex-col rounded-xl px-3 py-1.5 hover:bg-ink-50">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Where</span>
        <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="bg-transparent text-[15px] font-medium text-ink-900 outline-none">
          <option value="">Anywhere in Houston</option>
          {neighborhoods.map((n) => (
            <option key={n.slug} value={n.slug}>
              {n.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col rounded-xl px-3 py-1.5 hover:bg-ink-50">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Date</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-transparent text-[15px] font-medium text-ink-900 outline-none" />
      </label>
      <label className="flex flex-col rounded-xl px-3 py-1.5 hover:bg-ink-50">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Start time</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} step={900} className="bg-transparent text-[15px] font-medium text-ink-900 outline-none" />
      </label>
      <label className="flex flex-col rounded-xl px-3 py-1.5 hover:bg-ink-50">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Guests</span>
        <input type="number" min={1} max={1000} inputMode="numeric" placeholder="25" value={guests} onChange={(e) => setGuests(e.target.value)} className="bg-transparent text-[15px] font-medium text-ink-900 outline-none placeholder:text-ink-400" />
      </label>
      <button type="submit" className={`btn-primary ${field} rounded-xl`}>
        Search spaces
      </button>
    </form>
  );
}
