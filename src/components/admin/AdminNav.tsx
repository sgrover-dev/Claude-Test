"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/inquiries", label: "Inquiries" },
  { href: "/admin/restaurants", label: "Restaurants" },
  { href: "/admin/spaces", label: "Spaces" },
  { href: "/admin/ingestion", label: "Ingestion & review" },
  { href: "/admin/duplicates", label: "Duplicates" },
];

export function AdminNav({ horizontal = false }: { horizontal?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className={horizontal ? "flex gap-1 overflow-x-auto scrollbar-none" : "flex flex-col gap-0.5 p-2"}>
      {ITEMS.map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"} ${horizontal ? "whitespace-nowrap" : ""}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
