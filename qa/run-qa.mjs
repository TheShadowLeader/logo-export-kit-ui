// QA gate: upload fixture SVGs → generate → assert tree, file count, zip
// contents, previews. Run against a server on :4490 (`npm start` after build).
// Local runs have no api/cmyk.py (Vercel-only) — pass CMYK=0 to skip the CMYK
// toggle and require zero warnings; on the deployed URL run with BASE + CMYK=1.
import { chromium } from "playwright";
import { unzipSync } from "fflate";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:4490";
const WITH_CMYK = process.env.CMYK === "1";
const OUT = path.join(import.meta.dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#1A1A2E"/><circle cx="50" cy="50" r="18" fill="#E94560"/></svg>`;
const HORIZ = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100"><circle cx="50" cy="50" r="40" fill="#1A1A2E"/><circle cx="50" cy="50" r="18" fill="#E94560"/><rect x="110" y="35" width="170" height="30" rx="4" fill="#16324F"/></svg>`;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });

// upload fixtures via the hidden input
await page.setInputFiles('input[type="file"]', [
  { name: "mark.svg", mimeType: "image/svg+xml", buffer: Buffer.from(MARK) },
  { name: "horizontal-positive.svg", mimeType: "image/svg+xml", buffer: Buffer.from(HORIZ) },
]);
await page.waitForTimeout(400);

// chips detected
const chips = await page.locator(".chip").count();
if (chips !== 2) throw new Error(`expected 2 chips, got ${chips}`);
const undetected = await page.locator(".chip.undetected").count();
if (undetected !== 0) throw new Error(`undetected chips: ${undetected}`);

// options
await page.getByTestId("client-name").fill("QA Client");
if (!WITH_CMYK) await page.locator('.togglerow label:has-text("CMYK") input').uncheck();

// brand bg auto-extraction: horizontal has #16324F not present in mark
const pbgHex = await page.locator(".colorrow .hex").first().textContent();
if (pbgHex?.toUpperCase() !== "#16324F") throw new Error(`bg extraction failed: ${pbgHex}`);

await page.getByTestId("generate").click();
await page.getByTestId("download-zip").waitFor({ timeout: 120000 });

// warnings: none expected without CMYK; with CMYK the API must exist
const warns = await page.locator(".warnbox div").allTextContents();
if (!WITH_CMYK && warns.length) throw new Error(`unexpected warnings: ${warns.join(" | ")}`);
if (WITH_CMYK && warns.some((w) => w.includes("CMYK"))) throw new Error(`CMYK warnings on deployed run: ${warns.join(" | ")}`);

// tree + grid present
await page.getByTestId("tree").waitFor();
const treeText = await page.getByTestId("tree").textContent();
for (const must of ["QA_Client_Logos/", "Social/", "Favicon/", "Print/", "favicon.ico"])
  if (!treeText.includes(must)) throw new Error(`tree missing ${must}`);

// zip: fetch the blob URL content via the page and verify entries
const zipB64 = await page.evaluate(async () => {
  const a = document.querySelector('[data-testid="download-zip"]');
  const r = await fetch(a.href);
  const ab = await r.arrayBuffer();
  let s = ""; const u = new Uint8Array(ab);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
});
const zip = unzipSync(new Uint8Array(Buffer.from(zipB64, "base64")));
const names = Object.keys(zip);
const expect = [
  "QA_Client_Logos/Social/Instagram/Positive/Instagram_Profile_320x320.png",
  "QA_Client_Logos/Web/Favicon/favicon.ico",
  "QA_Client_Logos/Web/Logo_Mark/Full_Color/mark_full-color_400px.png",
  "QA_Client_Logos/Print/Logo_Mark/Black/mark_black_print.svg",
];
if (WITH_CMYK) expect.push("QA_Client_Logos/Print/Logo_Mark/Full_Color/mark_full-color_print_4000x4000_300dpi_CMYK.tif");
for (const e of expect) if (!names.includes(e)) throw new Error(`zip missing ${e}\nhave: ${names.slice(0, 8).join("\n")}`);
// PNG magic on a social composite
const png = zip["QA_Client_Logos/Social/Instagram/Positive/Instagram_Profile_320x320.png"];
if (!(png[0] === 0x89 && png[1] === 0x50)) throw new Error("social PNG magic wrong");

await page.screenshot({ path: path.join(OUT, "qa-ui.png"), fullPage: true });
if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);

console.log(`QA PASS — ${names.length} files in zip, ${chips} chips, bg=#16324F, cmyk=${WITH_CMYK ? "on" : "off (local)"}`);
await browser.close();
