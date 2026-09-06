/**
 * Sieht nach, ob Jarvis' Gegenwart und der Zugriffs-Effekt wirklich da sind.
 *
 * Zwei Dinge werden getrennt geprüft, weil sie getrennt kaputtgehen können:
 *
 * 1. **Das Panel** — Kugel und Gesicht als Canvas, und zwar ein Canvas, in dem
 *    etwas steht. Ein leeres Canvas ist im Screenshot nicht von einem dunklen
 *    Hintergrund zu unterscheiden, deshalb wird es ausgelesen und gezählt,
 *    wie viele Bildpunkte überhaupt Farbe haben.
 *
 * 2. **Der Raum** — die Abtastwelle und die Kometen. Die Ereignisse werden
 *    hier von Hand ausgelöst, mit echten Notiz-Kennungen aus der Suche. Das
 *    ist bewusst kein Modellaufruf: geprüft wird die Anzeige, und die hängt
 *    nur an den Ereignissen. Was Jarvis antwortet, ist eine andere Frage.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3410";

const countLitPixels = `(() => {
  const canvases = [...document.querySelectorAll("canvas")];
  return canvases.map((c) => {
    const ctx = c.getContext("2d");
    if (!ctx) return { w: c.width, h: c.height, kind: "webgl" };
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 12) lit++;
    return { w: c.width, h: c.height, kind: "2d", lit };
  });
})()`;

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    args: [
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=CalculateNativeWinOcclusion",
      // Ohne das darf eine Seite ohne Klick keinen Ton abspielen, und die
      // Stimme scheitert an der Freigabe statt an sich selbst.
      "--autoplay-policy=no-user-gesture-required",
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

  // Echte Kennungen holen — dieselben, die Jarvis zitieren würde.
  const ids = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/jarvis/search?q=Pedro&limit=6`);
    const j = await r.json();
    return (j.results ?? []).map((h) => h.id);
  }, BASE);
  console.log("Notiz-Kennungen aus der Suche:", ids.length, ids.slice(0, 3));

  // In den Wissenskosmos, damit die Notizen im Raum stehen.
  await page.getByRole("button", { name: /^wissen$/i }).first().click();
  await page.waitForTimeout(4000);

  // Jarvis öffnen.
  await page.getByRole("button", { name: /^jarvis$/i }).first().click();
  await page.waitForTimeout(1500);

  for (const mode of ["Kugel", "Gesicht"]) {
    await page.getByRole("button", { name: mode, exact: true }).first().click();
    await page.waitForTimeout(900);
    const canvases = await page.evaluate(countLitPixels);
    const two = canvases.filter((c) => c.kind === "2d");
    console.log(`${mode.padEnd(8)} 2D-Canvas:`, JSON.stringify(two));
    await page.screenshot({ path: `shots/jarvis-${mode.toLowerCase()}.png` });
  }

  // Der Zugriff: erst suchen (Welle), dann lesen (Kometen).
  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("hermes_jarvis_scan", { detail: { active: true } }),
    );
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "shots/jarvis-welle.png" });

  await page.evaluate((noteIds) => {
    window.dispatchEvent(
      new CustomEvent("hermes_knowledge_pulse", { detail: { ids: noteIds } }),
    );
  }, ids);
  await page.waitForTimeout(700);
  await page.screenshot({ path: "shots/jarvis-kometen.png" });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "shots/jarvis-gelesen.png" });

  await page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("hermes_jarvis_scan", { detail: { active: false } }),
    );
  });

  console.log("Fehler auf der Seite:", errors.length ? errors.slice(0, 5) : "keine");
  await browser.close();
})();
