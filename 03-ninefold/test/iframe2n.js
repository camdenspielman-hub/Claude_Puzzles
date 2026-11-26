// Real keyboard input inside a cross-origin iframe, as on the artifact host.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
function wrap() {
  const body = fs.readFileSync(path.join(ROOT, (process.env.NF_APP || 'app') + '/dist/ninefold.html'), 'utf8');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0}[hidden]{display:none!important}</style></head><body>${body}</body></html>`;
}
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://host.local/')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body style="margin:0"><input id="hostbox" style="position:fixed;top:0;left:0;width:10px"><iframe id="f" src="http://nf.local/' + (process.argv[2] || '') + '" style="width:100vw;height:100vh;border:0"></iframe></body></html>' });
    if (url.startsWith('http://nf.local/')) return route.fulfill({ status: 200, contentType: 'text/html', body: wrap() });
    if (url.includes('three.min.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'app/vendor/three.min.js')) });
    return route.continue();
  });
  await page.goto('http://host.local/');
  await page.focus('#hostbox'); // the host page starts with focus, as it would on claude.ai
  const frame = page.frames().find(f => f.url().startsWith('http://nf.local/'));
  await frame.waitForFunction(() => window.NF && NF.Game && NF.Game.grid, null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const centre = (i) => frame.evaluate((i) => { const r = NF.Game.grid.cells[i].bg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, i);
  const cell = (i) => frame.evaluate((i) => { const c = NF.Game.grid.cells[i]; return { v: c.v, corner: c.corner, centre: c.centreMarks }; }, i);
  let p = await centre(1);
  await page.mouse.click(p[0], p[1]);
  await page.keyboard.press('2');
  console.log('digit 2 ->', JSON.stringify(await cell(1)));
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Shift+3');
  await page.keyboard.press('Shift+4');
  console.log('shift+3, shift+4 ->', JSON.stringify(await cell(1)));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Control+2');
  await page.keyboard.press('Control+4');
  console.log('arrow right, ctrl+2, ctrl+4 -> cell 2', JSON.stringify(await cell(2)));
  await page.keyboard.press('x');
  await page.keyboard.press('1');
  console.log('mode x then 1 -> cell 2', JSON.stringify(await cell(2)), 'mode', await frame.evaluate(() => NF.Game.grid.mode));
  await page.keyboard.press('z');
  await page.keyboard.press('Control+z');
  console.log('ctrl+z undo -> cell 2', JSON.stringify(await cell(2)));
  // click a keypad button, then keep typing: focus must stay inside the frame
  const pb = await frame.evaluate(() => { const b = document.querySelector('#preludePad button[data-d="3"]'); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(pb[0], pb[1]);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('4');
  console.log('after pad click, arrow left + 4 -> cell 1', JSON.stringify(await cell(1)), 'cell 2', JSON.stringify(await cell(2)));
  console.log('frame has focus:', await frame.evaluate(() => document.hasFocus()));
  await page.screenshot({ path: 'shots/keys_' + (process.argv[2] || '#prelude').slice(1) + '.png' });
  await browser.close();
})();
