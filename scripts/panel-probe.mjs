/**
 * Die fertige Projektwelt: Bereich anfliegen, Notiz im Raum öffnen.
 *
 * Gerastert statt geraten, und am grössten Projekt statt am erstbesten —
 * ein Projekt mit zwei Notizen hat womöglich beide auf der Rückseite, und
 * dann beweist ein Fehlschlag nichts.
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
  await p.goto("http://localhost:3410/v2", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);
  await p.getByLabel("Entwicklerwerte").click().catch(() => {});
  await p.getByRole("button", { name: /^projekte$/i }).first().click();
  await p.waitForTimeout(4500);

  const box = await p.locator("canvas").first().boundingBox();
  const read = async () => (await p.locator("text=/fps · /").first().innerText()).trim();

  // Den Liegeplatz mit den meisten Notizen suchen: Hermes Agent OS.
  let seat = null;
  for (let fy = 0.4; fy <= 0.86 && !seat; fy += 0.05) {
    for (let fx = 0.15; fx <= 0.85 && !seat; fx += 0.05) {
      const x = box.x + box.width * fx;
      const y = box.y + box.height * fy;
      await p.mouse.click(x, y);
      await p.waitForTimeout(220);
      const shown = await p.locator("aside").first().innerText().catch(() => "");
      if (/Hermes Agent OS/.test(shown)) seat = [x, y];
    }
  }
  if (!seat) {
    console.log("Hermes Agent OS nicht gefunden");
    await b.close();
    return;
  }
  await p.mouse.click(seat[0], seat[1]);
  await p.waitForTimeout(3000);
  await p.screenshot({ path: "shots/pw-innen.png" });
  console.log("Innen:      ", await read());

  // Notiz suchen.
  let note = null;
  for (let fy = 0.3; fy <= 0.9 && !note; fy += 0.02) {
    for (let fx = 0.1; fx <= 0.9 && !note; fx += 0.02) {
      const x = box.x + box.width * fx;
      const y = box.y + box.height * fy;
      await p.mouse.click(x, y);
      await p.waitForTimeout(90);
      if (/IM RAUM GEÖFFNET/i.test(await p.locator("body").innerText())) {
        note = [Math.round(x), Math.round(y)];
      }
    }
  }
  console.log(note ? "Notiz offen bei " + note.join(", ") : "keine Notiz getroffen");
  await p.waitForTimeout(1400);
  await p.screenshot({ path: "shots/pw-notiz.png" });
  console.log("Mit Notiz:  ", await read());
  await b.close();
})();
