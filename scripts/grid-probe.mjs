import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch({ channel: "chrome", args: ["--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=CalculateNativeWinOcclusion"] });
  const p = await b.newPage({ viewport: { width: 1720, height: 1250 } });
  await p.goto("http://localhost:3400/v2", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);
  let hits = 0;
  for (let x = 880; x <= 1140; x += 65) {
    for (let y = 800; y <= 1010; y += 70) {
      await p.mouse.click(x, y);
      await p.waitForTimeout(320);
      const text = (await p.locator("main").innerText()).replace(/\s+/g, " ");
      if (/MODELL|ANBIETER|SPEZIALPROFIL/i.test(text)) { console.log("TREFFER bei", x, y); hits++; }
    }
  }
  console.log("Treffer gesamt:", hits);
  await b.close();
})();
