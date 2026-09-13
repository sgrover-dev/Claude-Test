import "server-only";
import * as cheerio from "cheerio";

export type FetchedPage = { url: string; title: string | null; text: string; pdfLinks: string[]; eventLinks: string[]; contentType: string };

const MAX_BYTES = 3_000_000;

/** Fetches a page and reduces it to readable text plus interesting links. */
export async function fetchPageText(url: string): Promise<FetchedPage> {
  const res = await fetch(url, { headers: { "User-Agent": "RedRopeBot/0.1 (+https://redrope.co; inventory research)", Accept: "text/html,application/pdf;q=0.9,*/*;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const contentType = res.headers.get("content-type") ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error("Page too large");
  if (/application\/pdf/.test(contentType) || /\.pdf(\?|$)/i.test(url)) {
    const text = await pdfToText(buf);
    return { url, title: null, text, pdfLinks: [], eventLinks: [], contentType: "application/pdf" };
  }
  const $ = cheerio.load(buf.toString("utf8"));
  $("script, style, noscript, svg, iframe, header nav, footer, [aria-hidden=true]").remove();
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || null;
  const base = new URL(url);
  const links = $("a[href]")
    .map((_, a) => {
      try {
        return new URL($(a).attr("href")!, base).toString();
      } catch {
        return null;
      }
    })
    .get()
    .filter((x): x is string => !!x);
  const pdfLinks = uniq(links.filter((l) => /\.pdf(\?|$)/i.test(l)));
  const eventLinks = uniq(links.filter((l) => /private|event|party|group|banquet|catering|buyout/i.test(l) && !/\.pdf/i.test(l) && l !== url)).slice(0, 15);
  // Preserve block structure so headings/capacity lines stay on their own lines.
  $("br").replaceWith("\n");
  $("p, div, li, h1, h2, h3, h4, h5, h6, tr, section, article").each((_, el) => {
    $(el).append("\n");
  });
  const text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return { url, title, text, pdfLinks, eventLinks, contentType };
}

export async function pdfToText(buf: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    return result.text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function uniq<T>(a: T[]) {
  return Array.from(new Set(a));
}
