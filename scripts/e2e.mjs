/* End-to-end smoke test against a running dev server (npm run dev).
 * Usage: node scripts/e2e.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:3000";
const shots = process.argv[3] ?? "./e2e-shots";
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
const shot = (name) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const step = (msg) => console.log(`• ${msg}`);

// 1. Customer: search → space → inquire
step("search");
await page.goto(`${base}/search?guests=25&neighborhood=montrose&privacy=fully_private`, { waitUntil: "networkidle" });
const firstCard = page.locator("article h3 a").first();
const spaceName = await firstCard.textContent();
await firstCard.click();
await page.waitForLoadState("networkidle");
await shot("02-space");
step(`space page: ${spaceName}`);
await page.getByRole("link", { name: "Help me book this" }).first().click();
await page.waitForLoadState("networkidle");
await page.fill("#guestCount", "25");
await page.fill("#eventDate", "2026-10-08");
await page.fill("#startTime", "19:00");
await page.selectOption("#eventType", "corporate_dinner");
await page.fill("#budget", "3000");
await page.fill("#avRequirements", "Screen for a 20 minute presentation");
await page.fill("#contactName", "Jane Smith");
await page.fill("#contactEmail", "jane@example.com");
await shot("03-inquire");
await page.getByRole("button", { name: "Send to Red Rope" }).click();
await page.waitForURL(/\/inquire\/thanks/);
await shot("04-thanks");
step(`inquiry submitted: ${page.url()}`);
const url = new URL(page.url());
const inquiryId = url.searchParams.get("id");

// 2. Customer signs in through the dev magic link and views tracking page
const devLink = await page.getByRole("link", { name: "open your tracking page" }).getAttribute("href");
if (!devLink) throw new Error("no dev magic link on thanks page (EMAIL_PROVIDER must be console)");
await page.goto(devLink, { waitUntil: "networkidle" });
await page.waitForURL(/\/account\/inquiries\//);
await shot("05-customer-tracking");
await page.fill('input[placeholder^="Ask a question"]', "Can we get a vegetarian option?");
await page.getByRole("button", { name: "Send" }).click();
await page.waitForTimeout(1500);
step("customer message sent");
await page.goto(`${base}/account`, { waitUntil: "networkidle" });
await shot("06-account");
await ctx.clearCookies();

// 3. Ops signs in as admin
await page.goto(`${base}/login`);
await page.fill("#email", "admin@redrope.local");
await page.getByRole("button", { name: /Email me a sign-in link/ }).click();
const adminLink = await page.getByRole("link", { name: "sign in now" }).getAttribute("href");
await page.goto(adminLink, { waitUntil: "networkidle" });
await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
await shot("07-admin-dashboard");
step("admin dashboard");

// 4. Ops works the inquiry
await page.goto(`${base}/admin/inquiries/${inquiryId}`, { waitUntil: "networkidle" });
await shot("08-ops-inquiry");
await page.getByRole("button", { name: /Draft outreach email/ }).first().click();
await page.waitForLoadState("networkidle");
step("outreach draft generated");
await page.getByRole("button", { name: /Approve & mark sent|Approve & send/ }).first().click();
await page.waitForLoadState("networkidle");
step("draft approved");
await page.locator('textarea[name="text"]').first().fill("Hi! Yes, the room is available on October 8th. We require a $2,500 food and beverage minimum plus 20% gratuity and 8.25% sales tax. A $500 deposit holds the date. The screen is available at no charge.");
await page.getByRole("button", { name: /Log & summarize reply/ }).first().click();
await page.waitForLoadState("networkidle");
step("reply summarized");
await page.getByRole("button", { name: /^Apply: set venue/ }).first().click();
await page.waitForLoadState("networkidle");
step("summary applied");
await page.getByRole("button", { name: /Draft customer update/ }).click();
await page.getByRole("button", { name: /Approve & send|Approve & mark sent/ }).first().waitFor({ timeout: 30000 });
await shot("09-ops-inquiry-after");
const text = await page.textContent("body");
for (const needle of ["quote received", "Quote:", "est. all-in", "customer update"]) {
  if (!text.toLowerCase().includes(needle.toLowerCase())) throw new Error(`ops page missing "${needle}"`);
}
step("ops flow verified");

// 5. Admin inventory pages
for (const [name, path] of [["10-admin-spaces", "/admin/spaces?missing=pricing"], ["11-admin-restaurants", "/admin/restaurants"], ["13-admin-ingestion", "/admin/ingestion"], ["14-admin-duplicates", "/admin/duplicates"]]) {
  await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
  await shot(name);
}
await page.goto(`${base}/admin/spaces`, { waitUntil: "networkidle" });
await page.locator("table a").first().click();
await page.waitForLoadState("networkidle");
await shot("12-admin-space-detail");
step("admin pages rendered");

// 6. Ingestion via pasted text (fallback extraction)
await page.goto(`${base}/admin/ingestion`, { waitUntil: "networkidle" });
await page.fill('input[name="title"]', "Test Bistro");
await page.fill('textarea[name="text"]', "Private Dining at Test Bistro\nThe Garden Room\nOur Garden Room seats up to 24 guests and features a projector and screen. Food and beverage minimum of $1,500.\nThe Cellar\nThe Cellar accommodates 12 guests seated. Contact events@testbistro.example or (713) 555-0100. 123 Main St, Houston, TX 77002");
await page.getByRole("button", { name: "Extract", exact: true }).click();
await page.waitForURL(/\/admin\/ingestion\//);
await shot("15-ingestion-review");
await page.getByRole("button", { name: "Approve as draft (hidden)" }).click();
await page.getByText(/^Reviewed /).waitFor({ timeout: 30000 });
step("ingestion review approved");

await browser.close();
const real = errors.filter((e) => !/favicon|images\.unsplash|ERR_/.test(e));
if (real.length) {
  console.log("Browser errors:\n" + real.join("\n"));
  process.exit(1);
}
console.log("E2E OK");
