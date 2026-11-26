// Seed hints: off by default, on from the menu, remembered.
const { open } = require('./harness_env');
const assert = (c, m) => { if (!c) { console.log('  FAIL ' + m); process.exitCode = 1; } else console.log('  ok   ' + m); };
const settle = (page) => page.waitForFunction(() => { const G = NF.Game; return !G.busy && !(G.transitioning > 0) && G.grid && !G.grid.locked && document.getElementById('card').hidden; }, null, { timeout: 90000, polling: 200 });
const save = JSON.stringify(JSON.stringify({ v: 2, act: 0, unlocked: 0, sound: false, acts: { 0: { stage: 1, size: 9, cells: null, fog: null } } }));
(async () => {
  const { browser, page, logs } = await open({ init: `(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${save}); sessionStorage.setItem('x','1'); } } catch(e){} window.NF_NO3D = true; })()` });
  await settle(page);
  const off = await page.evaluate(() => {
    const G = NF.Game, g = G.grid, st = NF.DATA.acts[0].stages[1];
    const seedCell = g.cells[st.seeds[0][0] * 9 + st.seeds[0][1]];
    g.select([seedCell.i]); [1, 2, 3, 4].forEach(d => g.input(d, 'corner'));
    const seedsVisible = getComputedStyle(g.gSeeds).display !== 'none';
    const slots = seedCell.corners.map(t => t.getAttribute('x') + ',' + t.getAttribute('y'));
    const plain = g.cells.find(c => !c.given && !c.seed && !c.v); g.select([plain.i]); [1, 2, 3, 4].forEach(d => g.input(d, 'corner'));
    const plainSlots = plain.corners.map(t => t.getAttribute('x') + ',' + t.getAttribute('y'));
    return { seedsVisible, label: document.getElementById('msStage').textContent, rule: document.querySelector('#ruleList li[data-rule="seeds"]').textContent, sameLayout: slots.join('|') === plainSlots.join('|'), btn: document.getElementById('seedHintBtn').textContent };
  });
  assert(!off.seedsVisible, 'sprouts hidden by default');
  assert(!/seeds/.test(off.label), 'no seed counter: "' + off.label + '"');
  assert(off.sameLayout, 'pencil marks in a seed cell are laid out like any other cell');
  assert(/Growth/.test(off.rule) && off.btn === 'Seed hints: off', 'rule reads "' + off.rule.slice(0, 50) + '…"; button ' + off.btn);
  // growth still works with hints off
  await page.evaluate(() => { const G = NF.Game, g = G.grid; for (const [r, c] of NF.DATA.acts[0].stages[1].seeds) { g.select([r * 9 + c]); g.input(+G.solution[r * 9 + c]); } });
  await page.waitForFunction(() => NF.Game.stage === 2, null, { timeout: 20000 }).then(() => assert(true, 'the stage still grows when its cells are placed')).catch(() => assert(false, 'no growth with hints off'));
  await settle(page);
  await page.evaluate(() => { document.getElementById('menuBtn').click(); document.getElementById('seedHintBtn').click(); document.getElementById('menuClose').click(); });
  const on = await page.evaluate(() => ({ vis: getComputedStyle(NF.Game.grid.gSeeds).display !== 'none', label: document.getElementById('msStage').textContent, n: NF.Game.grid.gSeeds.childElementCount }));
  assert(on.vis && on.n === 8 && /seeds 0\/8/.test(on.label), 'turning hints on shows 8 sprouts and the counter: "' + on.label + '"');
  await page.reload(); await settle(page);
  const kept = await page.evaluate(() => document.getElementById('app').classList.contains('seed-hints'));
  assert(kept, 'the setting survives a reload');
  console.log(logs.length ? logs.join('\n') : '  no console errors');
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
