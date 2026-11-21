// node capture.js <worker> <nWorkers> <outDir> [fmt=jpeg|png] [startFrame endFrame]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
const FPS = 30;
(async () => {
  const [wi, nw, outDir, fmt = 'jpeg', sf, ef] = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'index.html'));
  await page.evaluate(async () => {
    await document.fonts.load('600 20px Inter'); await document.fonts.load('800 20px Inter');
    await document.fonts.load('800 20px "JetBrains Mono"'); await document.fonts.load('800 20px "Inter Display"'); await document.fonts.ready;
  });
  const tl = await page.evaluate(() => ({ total: window.TL.total, audio: window.TL.audio }));
  if (+wi === 0) fs.writeFileSync(path.join(outDir, 'timeline.json'), JSON.stringify(tl));
  const F = Math.ceil(tl.total * FPS);
  const chunk = Math.ceil(F / +nw);
  let start = +wi * chunk, end = Math.min(F, (+wi + 1) * chunk);
  if (sf !== undefined) { start = +sf; end = +ef; }
  const out = path.join(outDir, `seg_${String(wi).padStart(2, '0')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', fmt === 'png' ? 'png' : 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-threads', '2', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise(r => ff.on('close', r));
  const t0 = Date.now();
  // warm up state (renderAt is stateless, but first layout can be slow)
  await page.evaluate(t => window.renderAt(t), start / FPS);
  for (let f = start; f < end; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    const buf = await page.screenshot(fmt === 'png' ? { type: 'png' } : { type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - start) % 600 === 0) console.log(`[w${wi}] frame ${f - start}/${end - start}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await done;
  console.log(`[w${wi}] done ${end - start} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${out}`);
  await browser.close();
})();
