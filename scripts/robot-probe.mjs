/**
 * Reagieren die Figuren auf Zeiger und Klick?
 *
 * Der eingebettete Browser rendert nicht, wenn er verdeckt ist. Also echter
 * Chrome mit den Anti-Drossel-Flags. Geprüft wird zweierlei: das Bild (Gesten,
 * Wangen, Oktaeder) und der Inspektor, denn dessen Text steht im DOM und ist
 * damit belegbar statt nur ansehbar.
 */
import { chromium } from "playwright";

const targets = [
  { name: "links", x: 365, y: 690 },
  { name: "vorne", x: 1010, y: 900 },
  { name: "rechts", x: 1360, y: 700 },
];

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
  await page.waitForTimeout(1200);

  for (const target of targets) {
    // Zwei Bewegungen: manche Zeigerbehandlungen brauchen eine echte Änderung.
    await page.mouse.move(target.x - 60, target.y - 60);
    await page.waitForTimeout(150);
    await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `shots/robot-${target.name}-hover.png` });

    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `shots/robot-${target.name}-klick.png` });

    const readout = (await page.locator("text=/fps · /").first().innerText()).trim();
    let panel = "kein Inspektor";
    try {
      panel = (await page.locator("aside").first().innerText()).replace(/\s+/g, " ").slice(0, 90);
    } catch {
      panel = "kein Inspektor";
    }
    console.log(target.name.padEnd(8), "|", panel);
    console.log("        ", readout);
  }

  await browser.close();
})();
