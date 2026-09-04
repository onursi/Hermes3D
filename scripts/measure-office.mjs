/**
 * The office, measured the same way every time.
 *
 * Every performance claim in this project until today was either arithmetic or
 * a screenshot somebody took by hand, and both produced numbers that
 * contradicted each other. Two measurements on the same build disagreed
 * because one was taken while `npm run build` was using every core, and
 * another because the resolution regulator had not settled yet. A day went to
 * a hypothesis that a single reliable reading would have killed in a minute.
 *
 * So the measurement is a script. It fixes the things that made readings
 * disagree:
 *
 *   - the window is Onur's reference size, half a 34" ultrawide, not whatever
 *     the browser happened to open at
 *   - the quality preset is set explicitly, not inherited from localStorage
 *   - the onboarding wizard is dismissed, because it renders over the scene
 *   - it waits for the resolution regulator to settle before sampling
 *   - it samples for twenty seconds and reports the median, because a single
 *     frame is noise
 *
 * Usage:  node scripts/measure-office.mjs [--url http://localhost:3300/office]
 *                                         [--quality medium] [--json out.json]
 *
 * Requires a server already running. It deliberately does not start one: a
 * build or a dev server competing for the CPU is exactly what corrupted the
 * readings this is meant to replace.
 */

import fs from "node:fs";
import { chromium } from "playwright";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const URL = arg("url", "http://localhost:3300/office");
const QUALITY = arg("quality", "medium");
const JSON_OUT = arg("json", null);

/**
 * Onur's reference: half of a 3440x1440 ultrawide, minus browser chrome. He
 * never uses fullscreen.
 *
 * This number matters more than it looks. The scene is fill-rate bound, so
 * frame time tracks pixel count almost directly: measured at 1291x966 it
 * reported 41 fps and at 1720x1400 — 1.9x the pixels — it reported 15, on the
 * same build, same machine, same minute. Neither reading is wrong; they answer
 * different questions.
 *
 * Which is the point of fixing it here: **the absolute number this script
 * prints is only comparable to another run of this script.** It is a
 * regression tool, not a claim about what Onur sees. When the plan says
 * "measure after every stage", it means this, at this size, twice — before and
 * after.
 */
const VIEWPORT = { width: 1720, height: 1250 };

/** Seconds given to loading, shader compilation and the DPR regulator. */
const SETTLE_SECONDS = 25;

/** Seconds of sampling once settled. */
const SAMPLE_SECONDS = 20;

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/**
 * The HUD line, parsed.
 *
 * Reading the rendered text rather than a value exported for the purpose:
 * this measures what the number actually says to Onur. If the HUD ever lies,
 * the measurement lies the same way, and that is the failure worth catching.
 */
const parseHud = (text) => {
  const number = (pattern) => {
    const match = text.match(pattern);
    return match ? Number(match[1]) : null;
  };
  return {
    fps: number(/(\d+)\s*fps/),
    draws: number(/(\d+)\s*Draws/),
    triangles: number(/(\d+)k\s*Dreiecke/),
    jsMs: number(/([\d.]+)\s*ms JS/),
    renderMs: number(/\(([\d.]+)\s*render\)/),
    frameMs: number(/([\d.]+)\s*ms Frame/),
  };
};

const run = async () => {
  const HEADED = process.argv.includes("--headed");
  const browser = await chromium.launch({ channel: "chrome", headless: !HEADED });
  const page = await browser.newPage({ viewport: VIEWPORT });

  await page.addInitScript((quality) => {
    localStorage.setItem("hermes-office-graphics-quality-v1", quality);
  }, QUALITY);

  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text().slice(0, 160));
  });

  process.stdout.write(`Lade ${URL} (${QUALITY}, ${VIEWPORT.width}x${VIEWPORT.height})\n`);
  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  // The welcome wizard covers the scene on a fresh profile.
  await page.keyboard.press("Escape").catch(() => {});
  for (const label of ["Close", "Schließen", "Überspringen", "Skip"]) {
    const button = page.getByRole("button", { name: label }).first();
    if (await button.count().catch(() => 0)) {
      await button.click().catch(() => {});
      break;
    }
  }
  await page.waitForTimeout(1000);

  // F toggles the frame meter.
  await page.keyboard.press("f").catch(() => {});

  process.stdout.write(`Warte ${SETTLE_SECONDS}s auf Stabilisierung…\n`);
  await page.waitForTimeout(SETTLE_SECONDS * 1000);

  /**
   * Which GPU this actually ran on.
   *
   * An automated browser may fall back to a software rasteriser, and then the
   * absolute numbers say nothing about what Onur sees. Reported alongside the
   * result rather than assumed, because a measurement that quietly changes
   * meaning is worse than no measurement.
   */
  const renderer = await page
    .evaluate(() => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!gl) return "kein WebGL";
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "unbekannt";
    })
    .catch(() => "unbekannt");

  process.stdout.write(`Messe ${SAMPLE_SECONDS}s…\n`);
  const samples = [];
  const until = Date.now() + SAMPLE_SECONDS * 1000;
  while (Date.now() < until) {
    // Only the meter's own element. Reading document.body.innerText forces a
    // full layout of a very large DOM on every sample, which showed up in the
    // frame time as a cost the scene was not actually paying.
    const text = await page
      .evaluate(() => {
        const nodes = Array.from(document.querySelectorAll("div"));
        const meter = nodes.find((node) => /\d+\s*fps/.test(node.textContent ?? ""));
        return meter?.textContent ?? "";
      })
      .catch(() => "");
    const sample = parseHud(text);
    if (sample.fps !== null) samples.push(sample);
    await page.waitForTimeout(700);
  }

  await browser.close();

  if (samples.length === 0) {
    process.stdout.write(
      "\nKeine Messwerte. Läuft der Server, und zeigt das HUD den Frame-Meter?\n",
    );
    process.exitCode = 1;
    return;
  }

  const pick = (key) => median(samples.map((s) => s[key]).filter((v) => v !== null));
  const fpsValues = samples.map((s) => s.fps).filter((v) => v !== null);

  const result = {
    url: URL,
    quality: QUALITY,
    viewport: VIEWPORT,
    takenAt: new Date().toISOString(),
    samples: samples.length,
    fps: { median: pick("fps"), min: Math.min(...fpsValues), max: Math.max(...fpsValues) },
    draws: pick("draws"),
    trianglesK: pick("triangles"),
    jsMs: pick("jsMs"),
    renderMs: pick("renderMs"),
    frameMs: pick("frameMs"),
    renderer,
    consoleErrors: errors.slice(0, 5),
  };

  process.stdout.write(
    [
      "",
      `  fps        ${result.fps.median}   (${result.fps.min}–${result.fps.max})`,
      `  Draws      ${result.draws}`,
      `  Dreiecke   ${result.trianglesK}k`,
      `  ms JS      ${result.jsMs}  (davon ${result.renderMs} three.js)`,
      `  ms Frame   ${result.frameMs}`,
      `  Proben     ${result.samples}`,
      `  GPU        ${result.renderer}`,
      errors.length > 0 ? `  Konsolenfehler: ${errors.length}` : "  Konsolenfehler: keine",
      "",
    ].join("\n"),
  );

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`Geschrieben nach ${JSON_OUT}\n`);
  }
};

run().catch((error) => {
  process.stdout.write(`Messung fehlgeschlagen: ${error.message}\n`);
  process.exitCode = 1;
});
