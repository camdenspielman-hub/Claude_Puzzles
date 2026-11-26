// Progression edge cases on app_next.
const { open } = require('./harness_env');
const assert = (c, m) => { if (!c) { console.log('  FAIL ' + m); process.exitCode = 1; } else console.log('  ok   ' + m); };
const settle = (page) => page.waitForFunction(() => { const G = NF.Game; return !G.busy && G.grid && !G.grid.locked && document.getElementById('card').hidden; }, null, { timeout: 90000, polling: 200 });
const saveFor = (act, stage) => JSON.stringify(JSON.stringify({ v: 2, act, unlocked: act, sound: false, acts: { [act]: { stage, size: 9, cells: null, fog: null } } }));
const fillSeeds = (page) => page.evaluate(() => { const G = NF.Game, g = G.grid, act = NF.DATA.acts[G.act]; for (const [r, c] of act.stages[G.stage].seeds) { g.select([r * 9 + c]); g.input(+G.solution[r * 9 + c]); } });
const fillAll = (page) => page.evaluate(() => { const G = NF.Game, g = G.grid; g.cells.filter(c => !c.given && c.v !== +G.solution[c.i]).forEach(c => { g.select([c.i]); g.input(+G.solution[c.i]); }); });
(async () => {
  { // 1. reload right after the last seed: the growth still happens
    console.log('1. reload mid-growth');
    const { browser, page, logs } = await open({ init: `(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${saveFor(0, 1)}); sessionStorage.setItem('x','1'); } } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    await fillSeeds(page);
    await page.waitForTimeout(250);
    await page.reload();
    await page.waitForFunction(() => NF.Game && NF.Game.stage === 2 && !NF.Game.busy, null, { timeout: 20000 }).then(() => assert(true, 'after reload the solved stage grows to growth 3')).catch(() => assert(false, 'solved stage did not grow after reload'));
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { // 2. Undo / Reveal during the next act's title card
    console.log('2. undo during the act change');
    const { browser, page, logs } = await open({ init: `(() => { try { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${saveFor(0, 3)}); } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    await page.evaluate(() => { const g = NF.Game.grid; const c = g.cells.find(c => !c.given); g.select([c.i]); g.input(c.v === 1 ? 2 : 1); });
    await fillAll(page);
    await page.waitForFunction(() => !document.getElementById('card').hidden && /Vines/.test(document.getElementById('cardTitle').textContent), null, { timeout: 60000 });
    for (let k = 0; k < 4; k++) { await page.click('#undoBtn', { force: true }).catch(() => { }); await page.keyboard.press('Control+z'); await page.waitForTimeout(400); }
    await settle(page);
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => { const G = NF.Game; const act = NF.DATA.acts[G.act]; const seeds = act.stages[G.stage].seeds.map(([r, c]) => r * 9 + c).sort((a, b) => a - b).join(); const marked = G.grid.cells.filter(c => c.seed).map(c => c.i).sort((a, b) => a - b).join(); return { act: G.act, stage: G.stage, types: [...new Set(G.rendered.map(r => r.data.type))], seedsOk: seeds === marked }; });
    assert(st.act === 1 && st.stage === 0, 'landed in Act II growth 1 (' + st.act + '/' + st.stage + ')');
    assert(!st.types.includes('killer') && st.seedsOk, 'no Act I clues or seeds carried over (' + st.types.join(',') + ')');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { // 3. state leaks between acts: land view, outside margin, world class
    console.log('3. per-act page state');
    const { browser, page, logs } = await open({ hash: '#act4', init: () => { try { localStorage.clear(); } catch (e) { } window.NF_NO3D = true; } });
    await settle(page);
    await page.evaluate(() => document.getElementById('app').classList.add('terrain-view'));
    await page.evaluate(() => NF.jumpTo(1)); await settle(page);
    const a = await page.evaluate(() => ({ tv: document.getElementById('app').classList.contains('terrain-view'), op: getComputedStyle(document.getElementById('stage')).opacity }));
    await page.waitForTimeout(1500);
    const a2 = await page.evaluate(() => ({ tv: document.getElementById('app').classList.contains('terrain-view'), op: getComputedStyle(document.getElementById('stage')).opacity, pe: getComputedStyle(document.getElementById('stage')).pointerEvents }));
    assert(!a.tv && a2.op === '1' && a2.pe !== 'none', 'land view does not leak into Act II (' + JSON.stringify(a) + ' then ' + JSON.stringify(a2) + ')');
    await page.evaluate(() => NF.jumpTo(2)); await settle(page);
    await page.evaluate(() => NF.jumpTo(0)); await settle(page);
    const b = await page.evaluate(() => ({ om: document.getElementById('app').classList.contains('outside-margin'), wo: document.getElementById('app').classList.contains('world-on'), paper: getComputedStyle(document.getElementById('paper')).opacity }));
    assert(!b.om && !b.wo, 'Act I after Act III: no outside-margin sheet, paper restored (' + JSON.stringify(b) + ')');
    await page.evaluate(() => NF.jumpTo(1)); await settle(page);
    const c = await page.evaluate(() => document.getElementById('app').classList.contains('world-on'));
    assert(c, 'Act II after Act I is back in the world');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { // 4. reveal: one undo takes back only the reveal; reveal selected cell
    console.log('4. reveal');
    const { browser, page, logs } = await open({ init: `(() => { try { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${saveFor(1, 3)}); } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    const r = await page.evaluate(() => {
      const G = NF.Game, g = G.grid;
      const empties = g.cells.filter(c => !c.given && !c.v);
      const mine = empties[0]; g.select([mine.i]); g.input(+G.solution[mine.i]);
      const target = empties[5]; g.select([target.i]);
      document.getElementById('menuBtn').click();
      const btn = document.getElementById('revealCellBtn');
      const shown = !btn.hidden, label = btn.textContent;
      btn.click(); document.getElementById('confirmYes').click();
      const filled = target.v === +G.solution[target.i];
      g.undo();
      return { shown, label, filled, undone: target.v === 0, mineKept: mine.v === +G.solution[mine.i] };
    });
    assert(r.shown && r.filled, 'Reveal selected cell fills just that cell (' + r.label + ')');
    assert(r.undone && r.mineKept, 'one undo removes only the revealed digit');
    const txt = await page.evaluate(() => { document.getElementById('menuBtn').click(); document.getElementById('revealBtn').click(); return document.getElementById('confirmText').textContent; });
    assert(/completes this act/.test(txt), 'final-stage reveal says it completes the act: "' + txt + '"');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
