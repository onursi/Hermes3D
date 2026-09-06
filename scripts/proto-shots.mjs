import { chromium } from "playwright";
(async () => {
  const b = await chromium.launch({ channel: "chrome", args: ["--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=CalculateNativeWinOcclusion"] });
  const p = await b.newPage({ viewport: { width: 1720, height: 1250 } });
  await p.goto("http://localhost:3410/v2", { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(13000);
  await p.getByLabel("Entwicklerwerte").click().catch(() => {});
  await p.waitForTimeout(1200);
  const read = async () => (await p.locator("text=/fps · /").first().innerText()).trim();
  await p.screenshot({ path: "shots/proto-zuhause.png" });
  console.log("Zuhause: ", await read());
  const hints = await p.locator("body").innerText();
  console.log("Hinweise sichtbar:", /W A S D|Agent auswählen/i.test(hints) ? "ja" : "nein");
  await p.getByRole("button", { name: /^reisen$/i }).first().click();
  await p.waitForTimeout(5000);
  await p.screenshot({ path: "shots/proto-all.png" });
  console.log("Unterwegs:", await read());
  await b.close();
})();
