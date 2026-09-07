const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3420/v2', { waitUntil: 'networkidle' });
  const projekteBtn = page.locator('button[aria-label="Projekte"], button:has-text("Projekte")').first();
  await projekteBtn.click();
  await page.waitForTimeout(4000);

  const cam = await page.evaluate(() => {
    // find three.js canvas and inspect camera
    const el = document.querySelector('canvas');
    return {
      url: window.location.href,
      html: document.body.innerText.slice(0, 200)
    };
  });
  console.log('Page info:', cam);
  await page.screenshot({ path: 'C:/Users/User/.gemini/antigravity-ide/brain/5a6cb656-da30-4f42-8da4-7d616d41604b/debug_cam_projekte.png' });
  await browser.close();
})();
