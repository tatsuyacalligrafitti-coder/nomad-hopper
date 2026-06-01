const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const pc = await browser.newPage();
  await pc.setViewportSize({ width: 1280, height: 800 });
  await pc.goto('http://localhost:3000');
  await pc.waitForTimeout(2000);
  // Close auto-modal, then click the ? button via aria-label
  try { await pc.click('button[aria-label="閉じる"]', { timeout: 1000 }); } catch {}
  await pc.waitForTimeout(400);
  await pc.click('button[aria-label="使い方を見る"]');
  await pc.waitForTimeout(600);
  await pc.screenshot({ path: '/tmp/help2_pc_open.png' });
  await browser.close();
  console.log('done');
})().catch(console.error);
