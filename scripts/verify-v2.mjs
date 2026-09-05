/**
 * The A/B acceptance checks, run against the running V2.
 *
 * Section B names them: a real source survives the round trip, repeated
 * journeys do not duplicate listeners, and no second scene keeps running.
 * Each is checked by observation rather than by assertion in the code that
 * would be doing the thing — a test that asks the implementation whether it
 * worked is not a test.
 */
import { chromium } from "playwright";

const AT = (label, ok, detail) =>
  console.log(`${ok ? "OK  " : "FEHL"}  ${label}${detail ? "  — " + detail : ""}`);

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1250 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 120)));

  await page.goto("http://localhost:3400/v2", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(13000);
  await page.getByLabel("Entwicklerwerte").click().catch(() => {});

  // --- Jarvis: a real question with real sources ----------------------------
  await page.getByRole("button", { name: /jarvis/i }).first().click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/Was denke ich/i).first().fill("Was ist das Zielbild von Hermes 3D?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(10000);

  const sourceCount = await page.locator("text=/^\\[\\d\\]$/").count().catch(() => 0);
  AT("Jarvis liefert Quellen", sourceCount > 0, sourceCount + " Quellen");

  const selectedBefore = await page
    .locator("aside")
    .filter({ hasText: "QUELLE" })
    .first()
    .textContent()
    .catch(() => null);
  AT("Quelle ist ausgewählt", Boolean(selectedBefore), (selectedBefore || "").slice(0, 46));

  // --- Round trip: home -> cosmos -> home -----------------------------------
  const canvasesBefore = await page.locator("canvas").count();

  await page.getByRole("button", { name: /wissen/i }).first().click();
  await page.waitForTimeout(6000);
  const inCosmos = await page.locator("header").first().textContent();
  AT("Reise in den Kosmos", /Wissenskosmos/.test(inCosmos || ""), (inCosmos || "").slice(0, 30));

  await page.getByRole("button", { name: /zuhause/i }).first().click();
  await page.waitForTimeout(6000);
  const backHome = await page.locator("header").first().textContent();
  AT("Rückkehr nach Hause", /Kommandodeck/.test(backHome || ""), (backHome || "").slice(0, 30));

  const selectedAfter = await page
    .locator("aside")
    .filter({ hasText: "QUELLE" })
    .first()
    .textContent()
    .catch(() => null);
  AT(
    "Auswahl überlebt die Reise",
    Boolean(selectedAfter) && selectedAfter === selectedBefore,
    (selectedAfter || "keine").slice(0, 46),
  );

  // --- Second round trip: no leaks -----------------------------------------
  await page.getByRole("button", { name: /wissen/i }).first().click();
  await page.waitForTimeout(4500);
  await page.getByRole("button", { name: /zuhause/i }).first().click();
  await page.waitForTimeout(4500);

  const canvasesAfter = await page.locator("canvas").count();
  AT(
    "Keine zweite Szene nach zwei Reisen",
    canvasesAfter === canvasesBefore,
    `${canvasesBefore} → ${canvasesAfter} Canvas`,
  );

  // --- Escape returns home --------------------------------------------------
  await page.keyboard.press("Escape"); // closes the inspector
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /wissen/i }).first().click();
  await page.waitForTimeout(4500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(4000);
  const afterEscape = await page.locator("header").first().textContent();
  AT("Escape führt heim", /Kommandodeck/.test(afterEscape || ""), (afterEscape || "").slice(0, 30));

  // --- Measurement, once it has settled ------------------------------------
  const samples = [];
  const until = Date.now() + 16000;
  while (Date.now() < until) {
    const text = await page
      .evaluate(() => {
        const nodes = Array.from(document.querySelectorAll("div"));
        const el = nodes.find((n) => /^\d+ fps · /.test((n.textContent || "").trim()));
        return el ? el.textContent : "";
      })
      .catch(() => "");
    const m = (text || "").match(/(\d+) fps · (\d+) Draws · (\d+)k/);
    if (m) samples.push({ fps: +m[1], draws: +m[2], tri: +m[3] });
    await page.waitForTimeout(600);
  }
  if (samples.length) {
    const fps = samples.map((s) => s.fps).sort((a, b) => a - b);
    console.log(
      `\nMESSUNG Zuhause @1720x1250: fps Median ${fps[Math.floor(fps.length / 2)]} ` +
        `(${fps[0]}–${fps[fps.length - 1]}), ${samples[0].draws} Draws, ${samples[0].tri}k Dreiecke, ` +
        `${samples.length} Proben`,
    );
  } else {
    console.log("\nMESSUNG: keine Proben (Entwicklerwerte aus?)");
  }

  AT("Keine Laufzeitfehler", errors.length === 0, errors.slice(0, 2).join(" | ") || "keine");
  await browser.close();
})();
