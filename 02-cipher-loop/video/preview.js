const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [outDir, ...ts] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()); });
  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.evaluate(async () => { for (const f of ['700 20px Unbounded','900 20px Unbounded','500 20px Grotesk','700 20px Grotesk','800 20px Mono','700 20px Mono']) await document.fonts.load(f); await document.fonts.ready; });
  const info = await page.evaluate(() => ({ total: window.TOTAL, segs: window.TL.segs.map(s => [s.type, +s.t0.toFixed(1), s.st ? s.st.title : (s.name||'')]) }));
  console.log('total', info.total.toFixed(1), 's');
  if (process.env.SEGS) console.log(info.segs.map(s => s.join(' | ')).join('\n'));
  for (const tt of ts) {
    const t = +tt, t0 = Date.now();
    await page.evaluate(t => window.renderAt(t), t);
    await page.screenshot({ path: path.join(outDir, `p_${tt}.jpg`), type: 'jpeg', quality: 85 });
    console.log('frame', tt, (Date.now() - t0) + 'ms');
  }
  await browser.close();
})();
