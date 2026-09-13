export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = slugify(base) || "item";
  let i = 2;
  while (taken.has(slug)) slug = `${slugify(base)}-${i++}`;
  taken.add(slug);
  return slug;
}
