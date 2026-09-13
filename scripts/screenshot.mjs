import { chromium } from "playwright-core";
const [,, url, out, w = "1280", h = "900", full = "1"] = process.argv;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.screenshot({ path: out, fullPage: full === "1" });
await browser.close();
