import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch({ channel: "chrome", args: ["--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=CalculateNativeWinOcclusion"] });
  const p = await b.newPage({ viewport: { width: 1720, height: 1250 } });
  await p.goto("http://localhost:3410/v2", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);
  await p.getByLabel("Entwicklerwerte").click().catch(() => {});
  await p.getByRole("button", { name: /^projekte$/i }).first().click();
  await p.waitForTimeout(4500);

  const box = await p.locator("canvas").first().boundingBox();
  // Liegeplatz suchen und betreten.
  let seat = null;
  for (let fy = 0.42; fy <= 0.84 && !seat; fy += 0.07) {
    for (let fx = 0.2; fx <= 0.8 && !seat; fx += 0.07) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      await p.mouse.click(x, y); await p.waitForTimeout(260);
      if (await p.locator("aside").filter({ hasText: /Zuletzt bearbeitet/ }).first().isVisible().catch(() => false)) seat = [x, y];
    }
  }
  if (!seat) { console.log("kein Liegeplatz"); await b.close(); return; }
  await p.mouse.click(seat[0], seat[1]); await p.waitForTimeout(3000);

  // Jetzt eine Notiz suchen.
  let hit = null;
  for (let fy = 0.35; fy <= 0.85 && !hit; fy += 0.022) {
    for (let fx = 0.15; fx <= 0.85 && !hit; fx += 0.022) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      await p.mouse.click(x, y); await p.waitForTimeout(130);
      const text = await p.locator("body").innerText();
      if (/IM RAUM GEÖFFNET/i.test(text)) hit = [Math.round(x), Math.round(y)];
    }
  }
  console.log(hit ? "Notiz getroffen bei " + hit.join(", ") : "keine Notiz getroffen");
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "shots/raumflaeche.png" });
  console.log("fps:", (await p.locator("text=/fps · /").first().innerText()).trim());
  await b.close();
})();
