const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../walkthrough/walkthrough.html'), { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.pdf({ path: path.resolve(__dirname, '../walkthrough/Ninefold-Walkthrough.pdf'), format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '17mm', left: '15mm', right: '15mm' } });
  await page.emulateMedia({ media: 'print' });
  console.log(errs.join('\n') || 'no errors');
  await browser.close();
})();
