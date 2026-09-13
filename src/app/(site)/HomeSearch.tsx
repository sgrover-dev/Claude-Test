"use client";
import { useState, type ReactNode } from "react";

export function HomeSearch({ searchBar, concierge }: { searchBar: ReactNode; concierge: ReactNode }) {
  const [mode, setMode] = useState<"structured" | "concierge">("structured");
  return (
    <div>
      <div className="mb-3 inline-flex rounded-full bg-white/10 p-1 backdrop-blur">
        {(["structured", "concierge"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-4 py-1.5 text-[13.5px] font-medium transition ${mode === m ? "bg-white text-ink-900 shadow-sm" : "text-white/80 hover:text-white"}`}>
            {m === "structured" ? "Search" : "Tell Red Rope what you're looking for"}
          </button>
        ))}
      </div>
      <div className="fade-up" key={mode}>
        {mode === "structured" ? searchBar : concierge}
      </div>
    </div>
  );
}
