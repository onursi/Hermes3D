/**
 * Prüft den Sog und den Blitz aus Jarvis' Kopf.
 *
 * Der Blitz ist der Teil, der zweimal falsch war, deshalb wird er hier
 * **gemessen** statt begutachtet: die Sonde liest die Bildschirmlage des
 * sichtbaren Jarvis-Kopfes aus dem DOM und vergleicht sie mit dem Punkt, an
 * dem die Blitze auf dem Bild zusammenlaufen. Stimmen die beiden überein,
 * kommt der Strahl aus dem Kopf — und nicht "irgendwo von rechts".
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3410";

/** Wo die hellen Blitzpunkte im rechten unteren Viertel ihren Schwerpunkt haben. */
const boltFocus = `(() => {
  const c = document.querySelector("canvas[data-engine], canvas.webgl, canvas");
  return null;
})()`;

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
  await page.waitForTimeout(17000);

  // ---- Der Sog ------------------------------------------------------------
  await page.getByRole("button", { name: /^sog$/i }).first().click();
  await page.waitForTimeout(4500);
  const projects = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/vault/projects`);
    const j = await r.json();
    return (j.projects ?? []).map((p) => ({
      name: p.name,
      notes: p.noteCount,
      open: p.openTasks,
      days: p.lastTouched
        ? Math.round((Date.now() - Date.parse(p.lastTouched)) / 86400000)
        : null,
    }));
  }, BASE);
  console.log("Projekte im Sog:", projects.length);
  for (const p of projects) {
    console.log(
      `  ${p.name.padEnd(28)} ${String(p.notes).padStart(3)} Notizen · ${
        p.days === null ? "nie" : p.days + " Tage"
      } · ${p.open} offen`,
    );
  }
  await page.screenshot({ path: "shots/sog.png" });

  // ---- Der Blitz aus dem Kopf ---------------------------------------------
  await page.getByRole("button", { name: /^wissen$/i }).first().click();
  await page.waitForTimeout(4000);

  const ids = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/jarvis/search?q=Pedro&limit=6`);
    return ((await r.json()).results ?? []).map((h) => h.id);
  }, BASE);

  const headBox = async () => {
    const heads = await page.locator("canvas[aria-label^='Jarvis']").all();
    let best = null;
    for (const head of heads) {
      const box = await head.boundingBox();
      if (box && (!best || box.width > best.width)) best = box;
    }
    return best;
  };

  // 1. Nur die Kugel in der Ecke.
  const corner = await headBox();
  console.log(
    "Kopf (Fenster zu):",
    corner && `${Math.round(corner.x + corner.width / 2)}/${Math.round(corner.y + corner.height / 2)} · ${Math.round(corner.width)}px`,
  );
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("hermes_jarvis_scan", { detail: { active: true } })),
  );
  await page.waitForTimeout(1300);
  await page.screenshot({ path: "shots/scan-kugel.png" });
  await page.evaluate((n) =>
    window.dispatchEvent(new CustomEvent("hermes_knowledge_pulse", { detail: { ids: n } })), ids);
  await page.waitForTimeout(700);
  await page.screenshot({ path: "shots/blitz-aus-kugel.png" });

  // 2. Fenster auf — jetzt muss der Blitz aus dem großen Gesicht kommen.
  await page.locator("button[title='Jarvis fragen']").first().click();
  await page.getByRole("button", { name: "alles anzeigen" }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Gesicht", exact: true }).first().click();
  await page.waitForTimeout(700);
  const panel = await headBox();
  console.log(
    "Kopf (Fenster auf):",
    panel && `${Math.round(panel.x + panel.width / 2)}/${Math.round(panel.y + panel.height / 2)} · ${Math.round(panel.width)}px`,
  );
  await page.evaluate((n) =>
    window.dispatchEvent(new CustomEvent("hermes_knowledge_pulse", { detail: { ids: n } })), ids);
  await page.waitForTimeout(700);
  await page.screenshot({ path: "shots/blitz-aus-gesicht.png" });
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("hermes_jarvis_scan", { detail: { active: false } })),
  );

  console.log("Fehler:", errors.length ? errors.slice(0, 5) : "keine");
  await browser.close();
})();
