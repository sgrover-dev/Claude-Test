"use client";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CompareItem = { id: string; slug: string; name: string; restaurantName: string };

type Ctx = {
  items: CompareItem[];
  has: (id: string) => boolean;
  toggle: (item: CompareItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const CompareCtx = createContext<Ctx | null>(null);
const KEY = "rr.compare";
export const COMPARE_MAX = 4;

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  useEffect(() => {
    // localStorage is only available after hydration; a single post-mount read is intentional.
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);
  const persist = useCallback((next: CompareItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      items,
      has: (id) => items.some((i) => i.id === id),
      toggle: (item) => {
        if (items.some((i) => i.id === item.id)) persist(items.filter((i) => i.id !== item.id));
        else if (items.length < COMPARE_MAX) persist([...items, item]);
      },
      remove: (id) => persist(items.filter((i) => i.id !== id)),
      clear: () => persist([]),
    }),
    [items, persist],
  );
  return (
    <CompareCtx.Provider value={value}>
      {children}
      <CompareTray />
    </CompareCtx.Provider>
  );
}

export function useCompare() {
  const ctx = useContext(CompareCtx);
  if (!ctx) throw new Error("useCompare must be used inside CompareProvider");
  return ctx;
}

function CompareTray() {
  const { items, remove, clear } = useCompare();
  if (!items.length) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex w-full max-w-3xl items-center gap-3 rounded-2xl border border-ink-200 bg-white/95 p-2.5 pl-4 shadow-pop backdrop-blur">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="shrink-0 text-[13px] font-semibold text-ink-700">Compare ({items.length}/{COMPARE_MAX})</span>
          {items.map((i) => (
            <button key={i.id} onClick={() => remove(i.id)} className="chip shrink-0 !py-0.5" title="Remove">
              {i.name} <span className="text-ink-400">×</span>
            </button>
          ))}
        </div>
        <button onClick={clear} className="btn-ghost btn-sm shrink-0">
          Clear
        </button>
        <Link href={`/compare?spaces=${items.map((i) => i.slug).join(",")}`} className={`btn-primary btn-sm shrink-0 ${items.length < 2 ? "pointer-events-none opacity-50" : ""}`}>
          Compare
        </Link>
      </div>
    </div>
  );
}

export function CompareToggle({ item, className = "" }: { item: CompareItem; className?: string }) {
  const { has, toggle, items } = useCompare();
  const active = has(item.id);
  const full = !active && items.length >= COMPARE_MAX;
  return (
    <button
      type="button"
      onClick={() => toggle(item)}
      disabled={full}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition ${active ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700 hover:border-ink-400"} disabled:opacity-50 ${className}`}
      title={full ? `Compare up to ${COMPARE_MAX}` : active ? "Remove from compare" : "Add to compare"}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
        <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h3A1.5 1.5 0 0 1 9 4.5v11A1.5 1.5 0 0 1 7.5 17h-3A1.5 1.5 0 0 1 3 15.5v-11Zm8 0A1.5 1.5 0 0 1 12.5 3h3A1.5 1.5 0 0 1 17 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-11Z" />
      </svg>
      {active ? "Comparing" : "Compare"}
    </button>
  );
}
