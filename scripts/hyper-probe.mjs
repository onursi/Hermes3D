/**
 * Der Hyperlicht-Ritt, unter kontrollierten Bedingungen.
 *
 * Der eingebettete Browser rendert nicht, wenn sein Fenster verdeckt ist —
 * dort sind Bildschirmfotos alte Einzelbilder und jede Aussage über eine
 * Animation wertlos. Dieses Skript öffnet einen echten Chrome mit denselben
 * drei Flags wie die Bildratenmessung, zündet den Ritt und hält fest, was
 * sich dabei ändert: Zeichenaufrufe, Bildrate, und zwei Bilder zum Ansehen.
 */
import { chromium } from "playwright";

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
  await page.goto("http://localhost:3400/v2", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(11000);
  await page.getByLabel("Entwicklerwerte").click().catch(() => {});
  await page.waitForTimeout(1500);

  await page.getByRole("button", { name: /^reisen$/i }).first().click();
  await page.waitForTimeout(6000);

  const readout = async () => (await page.locator("text=/fps · /").first().innerText()).trim();

  console.log("vor dem Ritt:   ", await readout());
  await page.screenshot({ path: "shots/hyper-aus.png" });

  await page.getByRole("button", { name: /hyperlicht/i }).first().click();
  await page.waitForTimeout(2500);
  console.log("waehrend:      ", await readout(), "|", await page.title());
  await page.screenshot({ path: "shots/hyper-an.png" });

  await page.waitForTimeout(2500);
  console.log("nach 5 s:      ", await readout());
  await page.screenshot({ path: "shots/hyper-an-2.png" });

  await page.getByRole("button", { name: /hyperlicht/i }).first().click();
  await page.waitForTimeout(3000);
  console.log("nach dem Ritt: ", await readout());

  await browser.close();
})();
