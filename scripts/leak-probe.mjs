/**
 * Wo genau wachsen die Geometrien?
 *
 * Die Abnahme sagt, dass zwischen frisch und benutzt fünfzehn dazukommen.
 * Sie sagt nicht, wobei. Dieses Skript geht die Schritte einzeln durch und
 * liest nach jedem die Zahl — dann steht die Ursache in einer Tabelle statt
 * in einer Vermutung.
 */
import { chromium } from "playwright";

const read = async (page) =>
  page
    .evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("div"));
      const el = nodes.find((n) => /^[0-9]+ fps/.test((n.textContent || "").trim()));
      const m = el ? (el.textContent || "").match(/([0-9]+) fps.*?([0-9]+) Geo.*?([0-9]+) Loops/) : null;
      return m ? { fps: +m[1], geo: +m[2], loops: +m[3] } : null;
    })
    .catch(() => null);

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    args: [
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=CalculateNativeWinOcclusion",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1250 } });
  await page.goto("http://localhost:3400/v2?lab=1", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(11000);
  await page.getByLabel("Entwicklerwerte").click().catch(() => {});
  await page.waitForTimeout(2500);

  const rows = [];
  // Mehrere Proben je Marke: eine einzelne Ablesung faengt zufaellig den
  // Frame nach einem Weltwechsel und sagt dann nichts ueber den Dauerzustand.
  const mark = async (label) => {
    await page.waitForTimeout(2500);
    const taken = [];
    for (let i = 0; i < 8; i += 1) {
      const value = await read(page);
      if (value) taken.push(value);
      await page.waitForTimeout(500);
    }
    const fps = taken.map((t) => t.fps).sort((a, b) => a - b);
    rows.push({
      label,
      geo: taken.length ? taken[taken.length - 1].geo : -1,
      loops: taken.length ? taken[taken.length - 1].loops : -1,
      fps: fps.length ? fps[Math.floor(fps.length / 2)] : -1,
    });
  };

  const go = async (name, ms = 2600) => {
    await page.getByRole("button", { name: new RegExp(`^${name}$`, "i") }).first().click().catch(() => {});
    await page.waitForTimeout(ms);
  };

  // Optional: Bloom aus, bevor gemessen wird. Der Nachbrenner ist der
  // teuerste einzelne Effekt in dieser Szene; die Frage ist, wie teuer.
  if (process.argv[3] === "ohne-bloom") {
    await page.getByRole("button", { name: /Bloom/i }).first().click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  await mark("frisch (Zuhause)");

  for (const world of (process.argv[2] || "wissen,projekte,reisen,bibliothek").split(",")) {
    await go(world);
    await go("zuhause");
    await mark(`nach ${world} und zurück`);
  }

  // Auswahl und Leser: beide bauen Geometrie auf (Auswahlring, Bahnen).
  await go("wissen");
  const search = page.getByPlaceholder(/Notiz oder Ordner suchen/i).first();
  if (await search.count()) {
    await search.fill("Zielbild");
    await page.waitForTimeout(900);
    await page.locator("button", { hasText: /Zielbild/ }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  await mark("nach Auswahl im Wissen");

  const read1 = page.getByRole("button", { name: /Notiz lesen/i }).first();
  if (await read1.isVisible().catch(() => false)) {
    await read1.click();
    await page.waitForTimeout(2500);
    await page.keyboard.press("Escape");
  }
  await mark("nach Leser auf und zu");

  await go("zuhause");
  await mark("wieder Zuhause");

  const first = rows[0]?.geo ?? 0;
  console.log("\n  fps   Geo   Schritt");
  for (const row of rows) {
    const delta = row.geo - first;
    console.log(
      `  ${String(row.fps).padStart(3)}   ${String(row.geo).padStart(3)}  ${String(row.loops).padStart(3)}   ${row.label} (Geo ${delta >= 0 ? "+" : ""}${delta})`,
    );
  }
  await browser.close();
})();
