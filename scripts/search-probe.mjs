/**
 * Beweist, dass die Suche auch im Text der Notizen sucht.
 *
 * Die erste Fassung dieser Sonde meldete dreimal "keine Angabe" und ich hätte
 * daraus fast geschlossen, die Funktion sei kaputt. Sie war es nicht: die
 * Trefferzeile steht per CSS in Großbuchstaben da, `innerText` liefert genau
 * das gerenderte "20 TREFFER", und das Muster suchte nach "Treffer".
 * Deshalb druckt die Sonde jetzt den rohen Text der Trefferliste mit — eine
 * Sonde, die nur "nein" sagen kann, ohne zu zeigen was sie gesehen hat, ist
 * keine Messung.
 */
import { chromium } from "playwright";

const TERMS = ["Pedro", "Ströer", "Techniker"];

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
  await p.getByRole("button", { name: /^wissen$/i }).first().click();
  await p.waitForTimeout(4500);

  for (const term of TERMS) {
    const field = p.getByPlaceholder(/Notiz oder Ordner suchen/);
    await field.fill("");
    await field.fill(term);
    // Die Volltextsuche wartet 220 ms und fragt dann den Server. 2,5 s decken
    // beides ab, ohne dass die Sonde raten muss.
    await p.waitForTimeout(2500);
    const raw = (await p.locator("body").innerText()).replace(/\s+/g, " ").trim();
    const count = raw.match(/(\d+)\s+treffer/i);
    const panel = raw.slice(0, 400);
    console.log("—".repeat(60));
    console.log(term.padEnd(12), count ? count[0] : "KEIN TREFFER GEFUNDEN");
    console.log("  Panel:", panel);
    await p.screenshot({ path: `shots/suche-${term.toLowerCase().replace(/[^a-z]/g, "")}.png` });
  }

  await b.close();
})();
