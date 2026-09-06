/**
 * Springt die Tonausgabe beim Hyperlicht wirklich an?
 *
 * Hoeren kann ich nicht. Pruefbar ist aber, ob ueberhaupt ein Audiogeraet
 * geoeffnet und freigegeben wird — genau daran hat es gelegen: der Knopf hat
 * die Ausgabe nie entsperrt, also blieb sie stumm, egal wie gut der Klang war.
 */
import { chromium } from "playwright";

(async () => {
  const b = await chromium.launch({
    channel: "chrome",
    args: [
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=CalculateNativeWinOcclusion",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const p = await b.newPage({ viewport: { width: 1720, height: 1250 } });
  await p.addInitScript(() => {
    const w = window;
    w.__ctx = [];
    const Real = w.AudioContext;
    w.AudioContext = class extends Real {
      constructor(...args) {
        super(...args);
        w.__ctx.push(this);
      }
    };
  });
  await p.goto("http://localhost:3400/v2", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);

  const before = await p.evaluate(() => window.__ctx.length);
  console.log("Audiogeraete vor dem Klick:", before);

  await p.getByRole("button", { name: /^reisen$/i }).first().click();
  await p.waitForTimeout(5000);
  await p.getByRole("button", { name: /hyperlicht/i }).first().click();
  await p.waitForTimeout(2500);

  const after = await p.evaluate(() =>
    window.__ctx.map((c) => ({ state: c.state, rate: c.sampleRate })),
  );
  console.log("Audiogeraete nach dem Klick:", JSON.stringify(after));
  await p.screenshot({ path: "shots/sound-an.png" });
  await b.close();
})();
