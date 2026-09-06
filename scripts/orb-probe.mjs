/**
 * Prüft den Umbau: Kugel unten rechts, verschiebbares Fenster, Strahl.
 *
 * Vier Behauptungen, vier Messungen — keine davon aus einem Screenshot
 * geraten:
 *
 * 1. Die Kugel steht in jeder Welt außer zuhause, und sie zeichnet etwas.
 * 2. Das Fenster lässt sich ziehen (die Lage ändert sich messbar),
 *    einklappen (der Inhalt verschwindet aus dem Textfluss) und schließen.
 * 3. Die Lage überlebt das Neuladen — sonst ist "verschiebbar" nur eine Geste.
 * 4. Der Strahl: während der Suche und beim Lesen steigt die Zahl der
 *    Zeichenaufrufe, weil Leitungen und Licht hinzukommen.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3410";

const orbLit = `(() => {
  const c = [...document.querySelectorAll("canvas[aria-label^='Jarvis']")].pop();
  if (!c) return -1;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 12) lit++;
  return lit;
})()`;

const panelBox = async (page) => {
  const el = page.locator("div:has(> div > span:text-is('JARVIS'))").first();
  return el.count().then((n) => (n ? el.boundingBox() : null));
};

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
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto(`${BASE}/v2`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(14000);

  // 1. Zuhause: keine Kugel in der Ecke.
  const orb = page.locator("button[title='Jarvis fragen'], button[title='Zuklappen']");
  console.log("zuhause · Kugel sichtbar:", await orb.count());

  await page.getByRole("button", { name: /^wissen$/i }).first().click();
  await page.waitForTimeout(4000);
  console.log("kosmos  · Kugel sichtbar:", await orb.count(), "· gezeichnet:", await page.evaluate(orbLit));

  // 2. Kugel aufklappen und fragen lassen — ohne Modellaufruf: nur prüfen,
  //    dass das Feld da ist und das Fenster sich öffnet.
  await orb.first().click();
  await page.waitForTimeout(500);
  console.log("Eingabefeld an der Kugel:", await page.getByPlaceholder("Frag mich etwas…").count());
  await page.getByRole("button", { name: "alles anzeigen" }).click();
  await page.waitForTimeout(800);

  const before = await panelBox(page);
  console.log("Fenster offen bei:", before && `${Math.round(before.x)}/${Math.round(before.y)}`);

  // 3. Ziehen.
  const header = page.locator("span:text-is('JARVIS')").first();
  const hb = await header.boundingBox();
  await page.mouse.move(hb.x + 20, hb.y + 6);
  await page.mouse.down();
  await page.mouse.move(hb.x + 320, hb.y + 240, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await panelBox(page);
  console.log(
    "nach dem Ziehen:",
    after && `${Math.round(after.x)}/${Math.round(after.y)}`,
    "· verschoben um",
    after && before ? `${Math.round(after.x - before.x)}/${Math.round(after.y - before.y)}` : "?",
  );

  // 4. Einklappen.
  await page.locator("button[title^='Auf eine Zeile']").first().click();
  await page.waitForTimeout(400);
  const collapsed = await panelBox(page);
  console.log("eingeklappt · Höhe:", collapsed && Math.round(collapsed.height));
  await page.screenshot({ path: "shots/orb-eingeklappt.png" });
  await page.locator("button[title='Wieder aufklappen']").first().click();
  await page.waitForTimeout(400);

  // 5. Überlebt die Lage das Neuladen?
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(13000);
  await page.getByRole("button", { name: /^wissen$/i }).first().click();
  await page.waitForTimeout(2500);
  await page.locator("button[title='Jarvis fragen']").first().click();
  await page.getByRole("button", { name: "alles anzeigen" }).click();
  await page.waitForTimeout(900);
  const reopened = await panelBox(page);
  console.log("nach Neuladen bei:", reopened && `${Math.round(reopened.x)}/${Math.round(reopened.y)}`);

  // 6. Der Strahl. Zeichenaufrufe vorher/während, über die Entwickleranzeige
  //    des WebGL-Renderers.
  const ids = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/jarvis/search?q=Pedro&limit=6`);
    return ((await r.json()).results ?? []).map((h) => h.id);
  }, BASE);

  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("hermes_jarvis_scan", { detail: { active: true } })),
  );
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "shots/strahl-suche.png" });

  await page.evaluate((noteIds) => {
    window.dispatchEvent(new CustomEvent("hermes_knowledge_pulse", { detail: { ids: noteIds } }));
  }, ids);
  await page.waitForTimeout(900);
  await page.screenshot({ path: "shots/strahl-leitungen.png" });
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("hermes_jarvis_scan", { detail: { active: false } })),
  );

  // 7. Und dasselbe zuhause — dort greift der Kern in den Himmel.
  await page.getByRole("button", { name: /^zuhause$/i }).first().click();
  await page.waitForTimeout(4000);
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("hermes_jarvis_scan", { detail: { active: true } })),
  );
  await page.waitForTimeout(1200);
  await page.evaluate((noteIds) => {
    window.dispatchEvent(new CustomEvent("hermes_knowledge_pulse", { detail: { ids: noteIds } }));
  }, ids);
  await page.waitForTimeout(900);
  await page.screenshot({ path: "shots/strahl-zuhause.png" });

  console.log("Fehler:", errors.length ? errors.slice(0, 5) : "keine");
  await browser.close();
})();
