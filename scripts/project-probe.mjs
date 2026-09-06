/**
 * Ein Projekt betreten und wieder verlassen.
 *
 * Gerastert statt geraten: Wo ein Liegeplatz auf dem Bildschirm landet, hängt
 * am Seitenverhältnis und an der Zahl der Projekte im Vault. Von Hand
 * geratene Koordinaten haben hier schon dreimal nur bewiesen, dass sie das
 * falsche Werkzeug sind.
 */
import { chromium } from "playwright";

(async () => {
  const b = await chromium.launch({
    channel: "chrome",
    args: [
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=CalculateNativeWinOcclusion",
    ],
  });
  const p = await b.newPage({ viewport: { width: 1720, height: 1250 } });
  await p.goto("http://localhost:3400/v2", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);
  await p.getByLabel("Entwicklerwerte").click().catch(() => {});
  await p.getByRole("button", { name: /^projekte$/i }).first().click();
  await p.waitForTimeout(4500);

  const read = async () => (await p.locator("text=/fps · /").first().innerText()).trim();
  console.log("Werft:  ", await read());
  await p.screenshot({ path: "shots/werft.png" });

  const box = await p.locator("canvas").first().boundingBox();
  const aim = [];
  for (let fy = 0.42; fy <= 0.84; fy += 0.07) {
    for (let fx = 0.2; fx <= 0.8; fx += 0.07) aim.push([fx, fy]);
  }

  let hitAt = null;
  for (const [fx, fy] of aim) {
    if (!box) break;
    const x = box.x + box.width * fx;
    const y = box.y + box.height * fy;
    await p.mouse.click(x, y);
    await p.waitForTimeout(280);
    const hit = await p
      .locator("aside")
      .filter({ hasText: /Zuletzt bearbeitet/ })
      .first()
      .isVisible()
      .catch(() => false);
    if (hit) {
      hitAt = [x, y];
      break;
    }
  }

  if (!hitAt) {
    console.log("Kein Liegeplatz getroffen — das waere ein Fehler.");
    await b.close();
    return;
  }
  console.log("Liegeplatz getroffen bei", hitAt.map(Math.round).join(", "));

  // Zweiter Klick auf denselben Punkt: betreten.
  await p.mouse.click(hitAt[0], hitAt[1]);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: "shots/projektwelt.png" });
  console.log("Innen:  ", await read());

  // Eine Notiz anfassen: der Zeiger sollte einen Titel zeigen.
  await p.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "shots/projektwelt-hover.png" });

  // Und wieder heraus.
  await p.keyboard.press("Escape");
  await p.waitForTimeout(2000);
  const backText = (await p.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 60);
  console.log("Zurueck:", backText);

  await b.close();
})();
