/**
 * Sind die Teilchen da, und bewegen sie sich?
 *
 * Zwei Bilder aus derselben Sicht im Abstand von anderthalb Sekunden. Der
 * eingebettete Browser rendert nicht, wenn sein Fenster verdeckt ist — dort
 * ist jede Aussage über eine Animation wertlos, deshalb läuft das hier in
 * einem echten Chrome mit denselben Anti-Drossel-Flags wie die Bildratenmessung.
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
  await page.waitForTimeout(12000);
  await page.getByLabel("Entwicklerwerte").click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "shots/dust-1.png" });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "shots/dust-2.png" });
  const readout = (await page.locator("text=/fps · /").first().innerText()).trim();
  console.log("Zuhause:", readout);
  await browser.close();
})();
