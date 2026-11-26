// Critic's issues on app_next2.
const { open } = require('./harness_env');
const assert = (c, m) => { if (!c) { console.log('  FAIL ' + m); process.exitCode = 1; } else console.log('  ok   ' + m); };
const settle = (page) => page.waitForFunction(() => { const G = NF.Game; return !G.busy && !(G.transitioning > 0) && G.grid && !G.grid.locked && document.getElementById('card').hidden; }, null, { timeout: 120000, polling: 300 });
const sv = (o) => JSON.stringify(JSON.stringify(o));
(async () => {
  { console.log('K1 replayed Act II lands in Act IV without the dusk fog');
    const save = { v: 2, act: 3, unlocked: 3, sound: false, acts: { 0: { solved: true }, 1: { solved: true }, 2: { solved: true }, 3: { stage: 0, size: 9, cells: null, fog: null } } };
    const { browser, page, logs } = await open({ init: `(() => { try { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${sv(save)}); } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    await page.evaluate(() => NF.jumpTo(1)); await settle(page);
    for (let k = 0; k < 4; k++) {
      await page.evaluate(() => { const G = NF.Game, g = G.grid, act = NF.DATA.acts[G.act]; const last = G.stage === act.stages.length - 1; const t = last ? g.cells.filter(c => !c.given).map(c => [c.r, c.c]) : act.stages[G.stage].seeds; t.forEach(([r, c]) => { const i = r * 9 + c; if (g.cells[i].v !== +G.solution[i]) { g.select([i]); g.input(+G.solution[i]); } }); });
      await page.waitForTimeout(1500);
      await settle(page);
    }
    await page.waitForTimeout(3500);
    const r = await page.evaluate(() => ({ act: NF.Game.act, rolls: document.querySelectorAll('#gridWrap > .fog-roll').length }));
    assert(r.act === 3 && r.rolls === 0, 'back in Act IV with no fog roll left (' + JSON.stringify(r) + ')');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { console.log('K2 storage blocked');
    const { browser, page, logs } = await open({ hash: '#act3', init: () => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); window.NF_NO3D = true; } });
    await settle(page);
    const before = await page.evaluate(() => { const G = NF.Game, g = G.grid; const cs = g.cells.filter(c => !c.given && !c.fogged).slice(0, 3); cs.forEach(c => { g.select([c.i]); g.input(+G.solution[c.i]); }); return { filled: g.cells.filter(c => !c.given && c.v).length, cleared: G.fog.cleared.size }; });
    await page.evaluate(() => NF.jumpTo(0)); await settle(page);
    await page.evaluate(() => NF.jumpTo(2)); await settle(page);
    const after = await page.evaluate(() => ({ filled: NF.Game.grid.cells.filter(c => !c.given && c.v).length, cleared: NF.Game.fog.cleared.size, toast: document.getElementById('toast').textContent }));
    assert(after.filled === before.filled && after.cleared === before.cleared, 'Act III progress kept in memory across chapter jumps (' + JSON.stringify(before) + ' -> ' + JSON.stringify(after) + ')');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { console.log('K3 rotate a tablet mid-act');
    const fresh = async (w, h) => { const { browser, page } = await open({ mobile: true, hash: '#act2', viewport: { width: w, height: h }, init: () => { try { localStorage.clear(); } catch (e) { } window.NF_NO3D = true; } }); await page.waitForTimeout(3500); const s = await page.evaluate(() => Math.round(document.getElementById('gridWrap').getBoundingClientRect().width)); await browser.close(); return s; };
    const target = await fresh(1024, 768);
    const { browser, page, logs } = await open({ mobile: true, hash: '#act2', viewport: { width: 768, height: 1024 }, init: () => { try { localStorage.clear(); } catch (e) { } window.NF_NO3D = true; } });
    await page.waitForTimeout(3500);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(3500);
    const got = await page.evaluate(() => Math.round(document.getElementById('gridWrap').getBoundingClientRect().width));
    assert(Math.abs(got - target) <= 4, 'grid after rotating to landscape ' + got + ' px vs fresh load ' + target + ' px');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { console.log('fog loop cost');
    const { browser, page } = await open({ hash: '#act3', viewport: { width: 390, height: 844 }, mobile: true, dpr: 3, init: () => { try { localStorage.clear(); } catch (e) { } window.NF_NO3D = true; } });
    await settle(page); await page.waitForTimeout(1500);
    const n = await page.evaluate(() => new Promise(res => { const f = NF.Game.fog; let k = 0; const d = f.draw.bind(f); f.draw = () => { k++; d(); }; setTimeout(() => res({ draws: k, canvas: f.canvas.width }), 3000); }));
    console.log('  draws in 3 s:', n.draws, 'canvas buffer', n.canvas);
    await browser.close();
  }
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
