// node capture.js <worker> <nWorkers> <outDir> [startFrame endFrame]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const FPS = 30;
(async () => {
  const [wi, nw, outDir, sf, ef] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.evaluate(async () => { for (const f of ['700 20px Unbounded','900 20px Unbounded','400 20px Unbounded','500 20px Grotesk','700 20px Grotesk','800 20px Mono','700 20px Mono']) await document.fonts.load(f); await document.fonts.ready; });
  const tl = await page.evaluate(() => ({ total: window.TL.total, audio: window.TL.audio,
    segs: window.TL.segs.map(s => ({ type: s.type, t0: s.t0, t1: s.t1, rules: !!(s.st && s.st.rules) })) }));
  if (+wi === 0) fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(tl));
  const F = Math.ceil(tl.total * FPS), chunk = Math.ceil(F / +nw);
  let start = +wi * chunk, end = Math.min(F, (+wi + 1) * chunk);
  if (sf !== undefined) { start = +sf; end = +ef; }
  const out = path.join(outDir, `seg_${String(wi).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-threads', '2', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r));
  const t0 = Date.now();
  await page.evaluate(t => window.renderAt(t), start / FPS);
  for (let f = start; f < end; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - start) % 900 === 0) console.log(`[w${wi}] frame ${f - start}/${end - start}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await done;
  console.log(`[w${wi}] done ${end - start} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  await browser.close();
})();
