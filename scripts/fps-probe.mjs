/**
 * Eine Zahl, unter kontrollierten Bedingungen.
 *
 * `node scripts/fps-probe.mjs <Weltwechsel> <Weltname>` misst Zuhause, nachdem
 * N mal in die genannte Welt und zurück gewechselt wurde. Der Vergleich von 0
 * gegen N ist der Test auf ein Leck: gleiche Draw Calls bei fallender Bildrate
 * bedeutet, dass sich etwas ansammelt, das kein Zeichenaufruf ist.
 *
 * Die drei Chrome-Flags sind nicht optional. Ohne sie drosselt Chrome ein
 * verdecktes Fenster auf dreißig Bilder, und man misst den Sparmodus des
 * Browsers statt der Szene.
 */
import { chromium } from "playwright";

const rounds = Number(process.argv[2] ?? 0);
const world = process.argv[3] ?? "wissen";

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
  await page.waitForTimeout(2000);

  // Optional: die Jarvis-Konsole einmal oeffnen und wieder schliessen. Sie
  // bringt eine zweite WebGL-Canvas mit; die Frage ist, ob sie beim
  // Schliessen auch wirklich verschwindet.
  if (process.argv[4] === "jarvis") {
    await page.getByRole("button", { name: /^jarvis$/i }).first().click().catch(() => {});
    await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /^jarvis$/i }).first().click().catch(() => {});
    await page.waitForTimeout(2000);
  }

  for (let i = 0; i < rounds; i += 1) {
    await page.getByRole("button", { name: new RegExp(`^${world}$`, "i") }).first().click().catch(() => {});
    await page.waitForTimeout(2200);
    await page.getByRole("button", { name: /^zuhause$/i }).first().click().catch(() => {});
    await page.waitForTimeout(2200);
  }

  // Optional: eine Notiz auswaehlen, damit Inspektor und Nachbarschaft offen
  // sind. Beide legen eine weitere Flaeche mit backdrop-blur ueber die Szene,
  // und die kostet echte Zeit auf der Grafikeinheit.
  if (process.argv[5] === "auswahl") {
    await page.getByRole("button", { name: /^wissen$/i }).first().click().catch(() => {});
    await page.waitForTimeout(3000);
    const box = page.getByPlaceholder(/Notiz oder Ordner suchen/i).first();
    await box.fill("Zielbild").catch(() => {});
    await page.waitForTimeout(900);
    await page.locator("button", { hasText: /Zielbild/ }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: /^zuhause$/i }).first().click().catch(() => {});
    await page.waitForTimeout(2500);
  }

  const samples = [];
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const text = await page
      .evaluate(() => {
        const nodes = Array.from(document.querySelectorAll("div"));
        const el = nodes.find((n) => /^\d+ fps/.test((n.textContent || "").trim()));
        return el ? el.textContent : "";
      })
      .catch(() => "");
    const m = (text || "").match(/(\d+) fps.*?(\d+) Draws.*?(\d+)k Dreiecke.*?(\d+) Geo.*?(\d+) Tex/);
    if (m) samples.push({ fps: +m[1], draws: +m[2], geo: +m[4], tex: +m[5] });
    await page.waitForTimeout(500);
  }

  if (!samples.length) {
    console.log(`nach ${rounds} Wechseln in ${world}: keine Proben`);
  } else {
    const fps = samples.map((s) => s.fps).sort((a, b) => a - b);
    const last = samples[samples.length - 1];
    console.log(
      `nach ${rounds} Wechseln in ${world}: Median ${fps[Math.floor(fps.length / 2)]} fps ` +
        `(${fps[0]}–${fps[fps.length - 1]}), ${last.draws} Draws, ${last.geo} Geometrien, ${last.tex} Texturen`,
    );
  }
  await browser.close();
})();
