"use client";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleSavedSpace } from "@/app/actions/saved";

export function SaveButton({ spaceId, initialSaved, variant = "icon" }: { spaceId: string; initialSaved: boolean; variant?: "icon" | "button" }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const onClick = () =>
    start(async () => {
      const res = await toggleSavedSpace(spaceId, pathname);
      if ("redirect" in res) router.push(res.redirect);
      else setSaved(res.saved);
    });
  const icon = (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 21s-7-4.6-9.3-8.6C.7 8.6 3 4.5 7 4.5c2 0 3.5 1 5 2.7 1.5-1.7 3-2.7 5-2.7 4 0 6.3 4.1 4.3 7.9C19 16.4 12 21 12 21Z" strokeLinejoin="round" />
    </svg>
  );
  if (variant === "button") {
    return (
      <button type="button" onClick={onClick} disabled={pending} className={`btn-secondary ${saved ? "text-rope-700" : ""}`}>
        {icon} {saved ? "Saved" : "Save"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={pending}
      aria-label={saved ? "Remove from saved" : "Save space"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-105 ${saved ? "text-rope-600" : "text-ink-700"}`}
    >
      {icon}
    </button>
  );
}
