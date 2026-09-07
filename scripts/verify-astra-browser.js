const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  console.log('Navigating to http://localhost:3420/v2...');
  await page.goto('http://localhost:3420/v2', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // 1. Initial Home Screen screenshot
  const shotDir = 'C:/Users/User/.gemini/antigravity-ide/brain/5a6cb656-da30-4f42-8da4-7d616d41604b';
  await page.screenshot({ path: path.join(shotDir, 'astra_1_home.png') });
  console.log('Home loaded successfully');

  // 2. Click Projekte dock button
  console.log('Clicking Projekte button...');
  const projekteBtn = page.locator('button[aria-label="Projekte"], button:has-text("Projekte")').first();
  await projekteBtn.click();
  await page.waitForTimeout(2500);

  // Check for Project Singularity title and flight controls
  const singularityTitle = await page.getByRole('heading', { name: 'Project Singularity' }).isVisible();
  console.log('Project Singularity title visible:', singularityTitle);

  const diveFlight = await page.locator('.r10-flight').isVisible();
  console.log('Dive flight controls visible:', diveFlight);

  await page.screenshot({ path: path.join(shotDir, 'astra_2_projekte_singularity.png') });

  // 3. Test Singularity Dive slider
  console.log('Testing Singularity Dive...');
  const diveBtn = page.locator('button:has-text("Singularity Dive")').first();
  if (await diveBtn.isVisible()) {
    await diveBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(shotDir, 'astra_3_singularity_dive.png') });
  }

  // 4. Click Memory dock button
  console.log('Clicking Memory dock button...');
  const memoryBtn = page.locator('button[aria-label="Memory"], button:has-text("Memory")').first();
  await memoryBtn.click();
  await page.waitForTimeout(2500);

  // Check for Memory HUD
  const memoryHud = await page.locator('.r10-memory-hud, .r10-memory-controls').first().isVisible();
  console.log('Memory HUD visible:', memoryHud);

  await page.screenshot({ path: path.join(shotDir, 'astra_4_memory_saturn.png') });

  // 5. Test Carousel Mode in Memory
  const carouselBtn = page.locator('button:has-text("Erinnerungen direkt öffnen"), button:has-text("Karussell")').first();
  if (await carouselBtn.isVisible()) {
    await carouselBtn.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(shotDir, 'astra_5_memory_carousel.png') });
    console.log('Carousel mode toggled');
  }

  // 6. Test Jarvis Companion & Open Console
  const jarvisPill = page.locator('aside[aria-label="Jarvis Unified Interface"]').first();
  const jarvisVisible = await jarvisPill.isVisible();
  console.log('Jarvis Companion visible:', jarvisVisible);

  const jarvisAvatarBtn = page.locator('aside[aria-label="Jarvis Unified Interface"] button[title*="Konsole"]').first();
  if (await jarvisAvatarBtn.isVisible()) {
    await jarvisAvatarBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(shotDir, 'astra_6_jarvis_in_memory.png') });
    console.log('Jarvis console opened in Memory world');
  }

  console.log('Total Console Errors:', errors.length);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  }

  await browser.close();
  console.log('Verification completed cleanly!');
})();
