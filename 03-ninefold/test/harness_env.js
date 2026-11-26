// Wrap the artifact body in a document skeleton like the host does, route CDN scripts to local copies.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(__dirname, 'shots', 'next'), { recursive: true }); // tests write screenshots here
function wrap() {
  const body = fs.readFileSync(path.join(ROOT, '' + (process.env.NF_APP || 'app') + '/dist/ninefold.html'), 'utf8');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${body}</body></html>`;
}
async function open(opts = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext(Object.assign({ viewport: opts.viewport || { width: 1440, height: 900 }, deviceScaleFactor: opts.dpr || 1 }, opts.mobile ? { isMobile: true, hasTouch: true } : {}));
  const page = await context.newPage();
  const logs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '')));
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://nf.local/')) return route.fulfill({ status: 200, contentType: 'text/html', body: wrap() });
    const m = url.match(/three(?:\.js\/r128\/three\.min\.js|@0\.128\.0\/examples\/js\/(?:shaders|postprocessing)\/([A-Za-z]+\.js))/);
    if (m) {
      const file = url.endsWith('three.min.js') ? 'three.min.js' : m[1];
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'app/vendor', file)) });
    }
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) return route.continue();
    return route.continue();
  });
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto('http://nf.local/' + (opts.hash || ''), { waitUntil: 'load' });
  return { browser, page, logs };
}
module.exports = { open };
