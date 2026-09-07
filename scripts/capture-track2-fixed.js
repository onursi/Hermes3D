const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const shotDir = 'C:/Users/User/.gemini/antigravity-ide/brain/5a6cb656-da30-4f42-8da4-7d616d41604b';

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  console.log('Navigating to http://localhost:3420/v2 ...');
  await page.goto('http://localhost:3420/v2', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);

  // 1. Home
  await page.screenshot({ path: path.join(shotDir, 'track2_fixed_1_home.png') });

  // 2. Projekte (Singularity)
  console.log('Clicking Projekte...');
  const projekteBtn = page.locator('button[aria-label="Projekte"], button:has-text("Projekte")').first();
  await projekteBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(shotDir, 'track2_fixed_2_projekte.png') });

  // 3. Singularity Dive
  const diveBtn = page.locator('button:has-text("Singularity Dive")').first();
  if (await diveBtn.isVisible()) {
    console.log('Testing Singularity Dive...');
    await diveBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(shotDir, 'track2_fixed_3_dive.png') });
  }

  // 4. Click a project planet
  const firstProject = page.locator('.r10-project-list button').first();
  if (await firstProject.isVisible()) {
    console.log('Clicking project in list...');
    await firstProject.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(shotDir, 'track2_fixed_4_project_selected.png') });
  }

  // 5. Memory Saturn
  console.log('Clicking Memory...');
  const memoryBtn = page.locator('button[aria-label="Memory"], button:has-text("Memory")').first();
  await memoryBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(shotDir, 'track2_fixed_5_memory_saturn.png') });

  await page.close();
  await browser.close();
  console.log('Track 2 fixed screenshots captured successfully!');
})();
