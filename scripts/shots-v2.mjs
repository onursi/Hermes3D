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

  // The search: the same cosmos, asked a question.
  const searchBox = page.getByPlaceholder(/Notiz oder Ordner suchen/i).first();
  if (await searchBox.count()) {
    await searchBox.fill("hermes");
    await page.waitForTimeout(2200);
    await page.screenshot({ path: OUT + "/4-kosmos-suche.png" });
    console.log("4 suche");
    await searchBox.fill("");
    await page.waitForTimeout(600);
  }

  // The yard, with a berth selected so the panel shows real vault data.
  await page.getByRole("button", { name: /projekte/i }).first().click().catch(() => {});
  await page.waitForTimeout(7000);
  const box = await page.locator("canvas").first().boundingBox();
  if (box) {
    outer: for (let fy = 0.42; fy <= 0.82; fy += 0.08) {
      for (let fx = 0.2; fx <= 0.8; fx += 0.075) {
        await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
        await page.waitForTimeout(300);
        const hit = await page
          .locator("aside")
          .filter({ hasText: /Zuletzt bearbeitet/ })
          .first()
          .isVisible()
          .catch(() => false);
        if (hit) break outer;
      }
    }
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "/5-ergebniswerft.png" });
  console.log("5 werft");

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
