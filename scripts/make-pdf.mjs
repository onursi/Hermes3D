import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

const [, , input, output] = process.argv;

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  // Hell drucken: auf Papier gibt es kein dunkles Thema des Betrachters.
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(pathToFileURL(input).href, { waitUntil: "networkidle" });
  // Schriften abwarten, sonst druckt er die Ersatzschrift.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.pdf({
    path: output,
    format: "A4",
    printBackground: true,
    margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" },
  });
  await browser.close();
  console.log("geschrieben:", output);
})();
