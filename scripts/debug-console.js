const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:3420/v2', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const projekteBtn = page.locator('button[aria-label="Projekte"], button:has-text("Projekte")').first();
  await projekteBtn.click();
  await page.waitForTimeout(4000);
  await browser.close();
})();
