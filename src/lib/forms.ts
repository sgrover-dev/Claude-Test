/** Small helpers for parsing FormData in server actions. */
export const fd = {
  str(f: FormData, key: string): string | null {
    const v = f.get(key);
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t === "" ? null : t;
  },
  int(f: FormData, key: string): number | null {
    const s = fd.str(f, key);
    if (s == null) return null;
    const n = parseInt(s.replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  },
  /** Dollars in the form → integer cents. */
  money(f: FormData, key: string): number | null {
    const s = fd.str(f, key);
    if (s == null) return null;
    const n = parseFloat(s.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  },
  pct(f: FormData, key: string): string | null {
    const s = fd.str(f, key);
    if (s == null) return null;
    const n = parseFloat(s.replace(/%/g, ""));
    return Number.isFinite(n) ? String(n) : null;
  },
  bool(f: FormData, key: string): boolean {
    const v = f.get(key);
    return v === "on" || v === "true" || v === "1";
  },
  /** Tri-state select: "" → null, "yes" → true, "no" → false. */
  tri(f: FormData, key: string): boolean | null {
    const s = fd.str(f, key);
    return s === "yes" ? true : s === "no" ? false : null;
  },
  arr(f: FormData, key: string): string[] {
    return f.getAll(key).map(String).filter(Boolean);
  },
  lines(f: FormData, key: string): string[] {
    return (fd.str(f, key) ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  },
  date(f: FormData, key: string): Date | null {
    const s = fd.str(f, key);
    if (!s) return null;
    const d = new Date(s.length === 10 ? `${s}T12:00:00` : s);
    return Number.isNaN(d.getTime()) ? null : d;
  },
};

/** "Name: 18 seated / 30 standing" lines → configurations. */
export function parseConfigurationLines(lines: string[]) {
  return lines
    .map((l) => {
      const [name, rest = ""] = l.split(":");
      const seated = rest.match(/(\d+)\s*seated/i);
      const standing = rest.match(/(\d+)\s*standing/i);
      return { name: name.trim(), seated: seated ? parseInt(seated[1], 10) : null, standing: standing ? parseInt(standing[1], 10) : null };
    })
    .filter((c) => c.name);
}

/** "Fri/Sat dinner: $5,000" lines → daypart minimums. */
export function parseDaypartLines(lines: string[]) {
  return lines
    .map((l) => {
      const idx = l.lastIndexOf(":");
      if (idx < 0) return null;
      const label = l.slice(0, idx).trim();
      const amount = parseFloat(l.slice(idx + 1).replace(/[$,\s]/g, ""));
      return label && Number.isFinite(amount) ? { label, amountCents: Math.round(amount * 100) } : null;
    })
    .filter((x): x is { label: string; amountCents: number } => !!x);
}
