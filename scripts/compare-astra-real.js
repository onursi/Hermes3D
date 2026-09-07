const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const shotDir = 'C:/Users/User/.gemini/antigravity-ide/brain/5a6cb656-da30-4f42-8da4-7d616d41604b';

  async function captureFlow(port, prefix) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    console.log(`[${prefix}] Navigating to http://localhost:${port}/v2 ...`);
    await page.goto(`http://localhost:${port}/v2`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // 1. Home
    await page.screenshot({ path: path.join(shotDir, `${prefix}_1_home.png`) });

    // 2. Projekte (Singularity)
    console.log(`[${prefix}] Clicking Projekte...`);
    const projekteBtn = page.locator('button[aria-label="Projekte"], button:has-text("Projekte")').first();
    await projekteBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(shotDir, `${prefix}_2_projekte.png`) });

    // 3. Singularity Dive
    const diveBtn = page.locator('button:has-text("Singularity Dive")').first();
    if (await diveBtn.isVisible()) {
      console.log(`[${prefix}] Testing Singularity Dive...`);
      await diveBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(shotDir, `${prefix}_3_dive.png`) });
    }

    // 4. Click a project planet
    const firstProject = page.locator('.r10-project-list button').first();
    if (await firstProject.isVisible()) {
      console.log(`[${prefix}] Clicking project in list...`);
      await firstProject.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(shotDir, `${prefix}_4_project_selected.png`) });
    }

    // 5. Memory Saturn
    console.log(`[${prefix}] Clicking Memory...`);
    const memoryBtn = page.locator('button[aria-label="Memory"], button:has-text("Memory")').first();
    await memoryBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(shotDir, `${prefix}_5_memory_saturn.png`) });

    // 6. Carousel mode
    const carouselBtn = page.locator('button:has-text("Erinnerungen direkt öffnen"), button:has-text("Karussell")').first();
    if (await carouselBtn.isVisible()) {
      console.log(`[${prefix}] Clicking Carousel...`);
      await carouselBtn.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(shotDir, `${prefix}_6_memory_carousel.png`) });
    }

    await page.close();
  }

  try {
    await captureFlow(3462, 'astra_real');
    await captureFlow(3420, 'track2_antigravity');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
    console.log('Capture flow finished!');
  }
})();
