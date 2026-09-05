import { chromium } from "playwright";
const OUT = process.argv[2];

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1250 } });
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message.slice(0, 160)));

  await page.goto("http://localhost:3400/v2", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(13000);

  // Developer values on, so every shot carries its own numbers.
  await page.getByLabel("Entwicklerwerte").click().catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT + "/1-zuhause.png" });
  console.log("1 zuhause");

  // Jarvis: a real question, real sources, real flights.
  await page.getByRole("button", { name: /jarvis/i }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const field = page.getByPlaceholder(/Was denke ich/i).first();
  if (await field.count()) {
    await field.click();
    await field.fill("Was ist das Zielbild von Hermes 3D?");
    await page.keyboard.press("Enter");
    // Sources arrive before the answer finishes; the flights start with them.
    await page.waitForTimeout(9000);
  }
  await page.screenshot({ path: OUT + "/2-jarvis-quellen.png" });
  console.log("2 jarvis");

  // Into the cosmos.
  await page.getByRole("button", { name: /wissen/i }).first().click().catch(() => {});
  await page.waitForTimeout(9000);
  await page.screenshot({ path: OUT + "/3-kosmos.png" });
  console.log("3 kosmos");

  const meter = await page
    .evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("div"));
      const el = nodes.find((n) => /\d+\s*fps/.test(n.textContent || ""));
      return el ? el.textContent : null;
    })
    .catch(() => null);
  console.log("messwert:", meter);
  console.log("fehler:", errors.length ? errors.slice(0, 4).join(" | ") : "keine");
  await browser.close();
})();
