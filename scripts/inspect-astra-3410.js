const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const shotDir = 'C:/Users/User/.gemini/antigravity-ide/brain/5a6cb656-da30-4f42-8da4-7d616d41604b';

  console.log('Navigating to Astra on http://localhost:3410/v2...');
  await page.goto('http://localhost:3410/v2', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 1. Astra Home
  await page.screenshot({ path: path.join(shotDir, 'real_astra_1_home.png') });

  // 2. Astra Projekte
  const projekteBtn = page.locator('button[aria-label="Projekte"], button:has-text("Projekte")').first();
  await projekteBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(shotDir, 'real_astra_2_projekte.png') });

  // Log HTML of flight & title
  const titleHtml = await page.locator('.r10-title').innerHTML().catch(() => 'no .r10-title');
  const flightHtml = await page.locator('.r10-flight').innerHTML().catch(() => 'no .r10-flight');
  const projectListHtml = await page.locator('.r10-project-list').innerHTML().catch(() => 'no .r10-project-list');
  console.log('Astra Projekte Title HTML:', titleHtml);
  console.log('Astra Flight HTML:', flightHtml);
  console.log('Astra Project List HTML:', projectListHtml);

  // Click first project button if any
  const firstProjectBtn = page.locator('.r10-project-list button').first();
  if (await firstProjectBtn.isVisible()) {
    console.log('Clicking first project planet in Astra...');
    await firstProjectBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(shotDir, 'real_astra_3_project_selected.png') });
  }

  // 3. Astra Memory
  const memoryBtn = page.locator('button[aria-label="Memory"], button:has-text("Memory")').first();
  await memoryBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(shotDir, 'real_astra_4_memory_saturn.png') });

  // Log Memory HUD HTML
  const memoryHudHtml = await page.locator('.r10-memory-hud, .r10-memory-controls').first().innerHTML().catch(() => 'no memory hud');
  console.log('Astra Memory HUD HTML:', memoryHudHtml);

  // Click Carousel in Astra
  const carouselBtn = page.locator('button:has-text("Karussell"), button:has-text("Erinnerungen direkt öffnen")').first();
  if (await carouselBtn.isVisible()) {
    console.log('Toggling carousel in Astra...');
    await carouselBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(shotDir, 'real_astra_5_memory_carousel.png') });
  }

  await browser.close();
  console.log('Astra inspection finished!');
})();
