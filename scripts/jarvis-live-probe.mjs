/**
 * Eine einzige echte Frage — die ganze Kette.
 *
 * Die andere Sonde löst die Ereignisse selbst aus und prüft damit nur die
 * Anzeige. Diese hier tippt eine Frage ein und sieht zu, was wirklich
 * passiert: Suche, Abtastwelle, Quellen, Kometen, Antwort, Stimme.
 *
 * **Genau eine Frage**, und das ist Absicht. Der Weg geht durch Onurs
 * laufenden Hermes und damit durch sein Kontingent. Für den Nachweis, dass
 * die Kette hält, reicht eine; jede weitere wäre auf seine Rechnung.
 *
 * Der Mund wird gemessen, nicht behauptet: während die Stimme läuft, wird das
 * Gesichts-Canvas mehrfach ausgelesen. Bewegt sich der Mund, schwankt die
 * Zahl der hellen Bildpunkte. Steht er still, tut sie das nicht.
 */
import { chromium } from "playwright";

const FRAGE = "Wer ist Pedro?";

const litPixels = `(() => {
  const c = document.querySelector("canvas[aria-label^='Jarvis']");
  if (!c) return -1;
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 12) lit++;
  return lit;
})()`;

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    args: [
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=CalculateNativeWinOcclusion",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1720, height: 1250 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const calls = [];
  page.on("requestfailed", (r) => calls.push(`FAIL ${r.url()}`));
  page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.includes("speak")) calls.push(`-> ${u.pathname}`); });
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/jarvis")) calls.push(`${r.status()} ${u.pathname}`);
  });

  await page.goto("http://localhost:3410/v2", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(13000);
  await page.getByRole("button", { name: /^wissen$/i }).first().click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /^jarvis$/i }).first().click();
  await page.waitForTimeout(1000);

  // Gesicht, damit der Mund messbar ist. Und Vorlesen an.
  await page.getByRole("button", { name: "Gesicht", exact: true }).first().click();
  await page.locator("button[title*='still anzeigen']").first().click();
  await page.waitForTimeout(400);

  await page.getByPlaceholder("Was denke ich über…?").fill(FRAGE);
  await page.keyboard.press("Enter");

  // Während der Suche: die Welle.
  await page.waitForTimeout(1400);
  console.log("Zustand kurz nach der Frage:", await page.locator("canvas[aria-label^='Jarvis']").getAttribute("aria-label"));
  await page.screenshot({ path: "shots/live-suche.png" });

  // Auf die Quellen warten — sie erscheinen, bevor die Antwort fertig ist.
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "shots/live-kometen.png" });

  // Auf das Ende der Antwort warten.
  await page
    .waitForFunction(
      () =>
        document
          .querySelector("canvas[aria-label^='Jarvis']")
          ?.getAttribute("aria-label")
          ?.includes("bereit"),
      { timeout: 120000 },
    )
    .catch(() => console.log("(Antwort kam nicht innerhalb von zwei Minuten zurück)"));

  // Auf die Stimme warten — und zwar auf die Antwort der Route, nicht auf gut
  // Glück. Beim ersten Lauf schloss die Sonde den Browser, während der
  // Entwicklungsserver die Route noch übersetzte; das sah aus wie eine
  // stumme Stimme und war eine zu kurze Messung.
  const spoken = await page
    .waitForResponse((r) => r.url().includes('/api/jarvis/speak'), { timeout: 60000 })
    .catch(() => null);
  console.log('Stimme:', spoken ? spoken.status() + ' ' + (spoken.headers()['x-jarvis-cache'] ?? '') : 'keine Antwort');
  await page.waitForTimeout(600);

  // Der Mund, während gesprochen wird.
  const samples = [];
  for (let i = 0; i < 14; i++) {
    samples.push(await page.evaluate(litPixels));
    await page.waitForTimeout(400);
  }
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  console.log("Gesicht, helle Bildpunkte:", samples.join(" "));
  console.log(`Schwankung: ${max - min} (0 hieße: der Mund steht still)`);

  // Die Antwort steht in ihrem eigenen Absatz im Panel. Sie im Fließtext der
  // ganzen Seite zu suchen, war der Grund, warum hier zweimal "nicht gefunden"
  // stand, während sie im Bild gut zu lesen war — ein Sondenfehler, kein
  // Fehler der Sache.
  const answer = await page
    .locator("p.whitespace-pre-wrap")
    .first()
    .innerText()
    .catch(() => "(keine Antwort im Panel)");
  console.log("Antwort:", answer.replace(/\s+/g, " ").slice(0, 200));
  console.log("Aufrufe:", calls.join(" | "));
  console.log("Fehler:", errors.length ? errors.slice(0, 4) : "keine");

  await page.screenshot({ path: "shots/live-antwort.png" });
  await browser.close();
})();
