import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch({ channel: "chrome", args: ["--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=CalculateNativeWinOcclusion"] });
  const p = await b.newPage({ viewport: { width: 1720, height: 1250 } });
  await p.goto("http://localhost:3400/v2", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(12000);
  for (const [x, y] of [[365,690],[370,700],[1010,900],[1010,880],[1360,700]]) {
    await p.mouse.move(x - 50, y - 50); await p.waitForTimeout(100);
    await p.mouse.click(x, y); await p.waitForTimeout(900);
    const text = (await p.locator("main").innerText()).replace(/\s+/g, " ");
    const hit = /MODELL|ANBIETER|SPEZIALPROFIL/i.test(text);
    console.log(x, y, hit ? "TREFFER" : "daneben");
  }
  await b.close();
})();
