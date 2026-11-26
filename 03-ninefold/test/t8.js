const { open } = require('./harness_env');
const fill = async (page, which) => page.evaluate(async (which) => {
  const G = NF.Game, g = G.grid, act = NF.DATA.acts[G.act];
  let targets;
  if (which === 'prelude') targets = g.cells.filter(c => !c.given).map(c => [c.i, +act.prelude.solution[c.i]]);
  else if (which === 'seeds') targets = act.stages[G.stage].seeds.map(([r, c]) => [r * 9 + c, +G.solution[r * 9 + c]]);
  else targets = g.cells.filter(c => !c.given && c.v !== +G.solution[c.i]).map(c => [c.i, +G.solution[c.i]]);
  for (const [i, v] of targets) { g.select([i]); g.input(v); await new Promise(r => setTimeout(r, 5)); }
  return targets.length;
}, which);
const ready = (page, act, stage) => page.waitForFunction(([a, s]) => {
  const G = NF.Game; return G.act === a && (s == null || G.stage === s) && !G.busy && G.grid && !G.grid.locked && document.getElementById('card').hidden;
}, [act, stage], { timeout: 120000, polling: 300 });
(async () => {
  const t0 = Date.now();
  const { browser, page, logs } = await open({ viewport: { width: 1000, height: 680 }, init: () => { try { localStorage.clear(); } catch (e) {} window.NF_NO3D = true; } });
  const log = (m) => console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', m);
  await page.waitForTimeout(2000);
  await fill(page, 'prelude'); await ready(page, 0, 0); log('act1 unfolded');
  for (let s = 0; s < 3; s++) { await fill(page, 'seeds'); await ready(page, 0, s + 1); }
  await fill(page, 'all'); await ready(page, 1, 0); log('act2');
  for (let s = 0; s < 3; s++) { await fill(page, 'seeds'); await ready(page, 1, s + 1); }
  await fill(page, 'all'); await ready(page, 2, 0); log('act3');
  await fill(page, 'all'); await ready(page, 3, 0); log('act4');
  await fill(page, 'seeds'); await ready(page, 3, 1); log('act4 evening');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: 'shots/e2e_a4_evening.png' });
  await fill(page, 'all');
  await page.waitForFunction(() => NF.Island && NF.Island.active && !NF.Island.busy, null, { timeout: 120000, polling: 300 });
  log('act5');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shots/e2e_a5.png' });
  const n = await page.evaluate(() => NF.DATA.acts[4].panels.length);
  for (let k = 0; k < n; k++) {
    await page.waitForFunction(() => NF.Island.open, null, { timeout: 30000, polling: 200 });
    if (k === 0 || k === n - 1) await page.screenshot({ path: `shots/e2e_flat_panel${k}.png` });
    await page.evaluate(() => NF.Island.reveal());
    log('panel ' + k + ' solved');
    await page.waitForTimeout(1600);
  }
  await page.waitForTimeout(9000);
  await page.screenshot({ path: 'shots/e2e_finale.png' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'shots/e2e_credits.png' });
  console.log(logs.filter(l => !l.includes('GPU stall')).slice(0, 20).join('\n') || 'no console errors');
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
