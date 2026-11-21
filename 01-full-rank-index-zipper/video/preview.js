// usage: node preview.js out_dir t1 t2 ...   (t may be "beat:N" to jump to N-th beat start + 3s)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [outDir, ...ts] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('console:', m.text()));
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.evaluate(async () => { await document.fonts.load('700 20px Inter'); await document.fonts.load('800 20px "JetBrains Mono"'); await document.fonts.load('800 20px "Inter Display"'); await document.fonts.ready; });
  const info = await page.evaluate(() => ({ total: window.TOTAL, nbeats: window.TL.beats.length, segs: window.TL.segs.map(s => [s.type, +s.t0.toFixed(1), s.st ? s.st.title : s.name]) }));
  console.log('total', info.total.toFixed(1), 's =', (info.total/60).toFixed(2), 'min; beats', info.nbeats);
  if (process.env.SEGS) console.log(info.segs.map(s => s.join(' | ')).join('\n'));
  for (const tt of ts) {
    let t = tt;
    if (tt.startsWith('beat:')) t = await page.evaluate(n => window.TL.beats[n].t0 + 3.5, +tt.slice(5));
    t = +t;
    const t0 = Date.now();
    await page.evaluate(t => window.renderAt(t), t);
    await page.screenshot({ path: path.join(outDir, `f_${tt.replace(':','_')}.png`) });
    console.log('frame', tt, '->', t.toFixed(2), (Date.now() - t0) + 'ms');
  }
  await browser.close();
})();
