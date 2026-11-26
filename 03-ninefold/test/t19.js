// Verification-round progression fixes (NF_APP=app_next2).
const { open } = require('./harness_env');
const assert = (c, m) => { if (!c) { console.log('  FAIL ' + m); process.exitCode = 1; } else console.log('  ok   ' + m); };
const settle = (page) => page.waitForFunction(() => { const G = NF.Game; return !G.busy && !(G.transitioning > 0) && G.grid && !G.grid.locked && document.getElementById('card').hidden; }, null, { timeout: 90000, polling: 200 });
const sv = (o) => JSON.stringify(JSON.stringify(o));
(async () => {
  { // N1: choosing another chapter during the Island card
    console.log('N1 chapter during the Island card');
    const save = { v: 2, act: 1, unlocked: 4, sound: false, acts: { 0: { solved: true }, 2: { solved: true }, 3: { solved: true }, 1: { stage: 0, size: 9, cells: null, fog: null } } };
    const { browser, page, logs } = await open({ init: `(() => { try { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${sv(save)}); } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    await page.evaluate(() => { NF.jumpTo(4); });
    await page.waitForFunction(() => !document.getElementById('card').hidden, null, { timeout: 15000 });
    const dis = await page.evaluate(() => { document.getElementById('menuBtn').click(); const b = [...document.querySelectorAll('#menuActs button')]; const r = b.map(x => x.disabled); document.getElementById('menuClose').click(); return r; });
    assert(dis.every(Boolean), 'all chapter buttons disabled during the jump card (' + dis.join(',') + ')');
    await page.evaluate(() => NF.jumpTo(1)); // programmatic attempt is refused too
    await page.waitForTimeout(6000);
    const st = await page.evaluate(() => ({ act: NF.Game.act, island: NF.Island.active, dataAct: document.getElementById('app').dataset.act }));
    assert(st.act === 4 && st.island && st.dataAct === '5', 'ends on the island it was going to, consistently (' + JSON.stringify(st) + ')');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { // N2 + N3: leaving right after the last panel; the ending recorded
    console.log('N2/N3 the ending');
    const solved = { first: 1, tally: 1, stones: 1, petals: 1, tally2: 1, shade: 1 };
    const save = { v: 2, act: 4, unlocked: 4, sound: false, acts: { 0: { solved: true }, 1: { solved: true }, 2: { solved: true }, 3: { solved: true } }, panels: { solved } };
    const { browser, page, logs } = await open({ init: `(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${sv(save)}); sessionStorage.setItem('x','1'); } } catch(e){} window.NF_NO3D = true; })()` });
    await page.waitForFunction(() => NF.Island && NF.Island.open, null, { timeout: 30000 });
    await page.evaluate(() => NF.Island.reveal());
    await page.waitForTimeout(400);
    await page.evaluate(() => NF.jumpTo(3));
    await page.waitForTimeout(9000);
    const a = await page.evaluate(() => ({ act: NF.Game.act, credits: !!document.getElementById('credits'), inFinale: !!NF.Island.inFinale, tr: NF.Game.transitioning }));
    assert(a.act === 3 && !a.credits && !a.inFinale && !(a.tr > 0), 'leaving mid-ending: Act IV clean, no credits, menu usable (' + JSON.stringify(a) + ')');
    await page.evaluate(() => NF.jumpTo(4));
    await page.waitForFunction(() => !!document.getElementById('credits'), null, { timeout: 20000 }).then(() => assert(true, 'returning plays the interrupted ending once')).catch(() => assert(false, 'ending not replayed on return'));
    const solvedFlag = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('ninefold-save-v2')); return !!(s.acts[4] && s.acts[4].solved); });
    assert(solvedFlag, 'credits record Act V as solved');
    await page.evaluate(() => { document.getElementById('crMenu').click(); });
    const label = await page.evaluate(() => [...document.querySelectorAll('#menuActs button .s')].map(s => s.textContent));
    await page.evaluate(() => { document.getElementById('menuClose').click(); });
    await page.reload();
    await page.waitForTimeout(4000);
    const again = await page.evaluate(() => ({ credits: !!document.getElementById('credits'), hint: document.getElementById('islandHint').textContent }));
    assert(!again.credits && /Every panel is lit/.test(again.hint), 'after a reload the finished island does not replay the ending (' + JSON.stringify(again) + ')');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { // N9: finishing a replay returns to the frontier
    console.log('N9 replay return');
    const save = { v: 2, act: 3, unlocked: 3, sound: false, acts: { 0: { solved: true }, 1: { solved: true }, 2: { solved: true }, 3: { stage: 0, size: 9, cells: null, fog: null } } };
    const { browser, page, logs } = await open({ init: `(() => { try { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${sv(save)}); } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    await page.evaluate(() => { const g = NF.Game.grid, G = NF.Game; const c = g.cells.find(c => !c.given); g.select([c.i]); g.input(+G.solution[c.i]); });
    await page.evaluate(() => NF.jumpTo(2)); await settle(page);
    await page.evaluate(() => { const G = NF.Game, g = G.grid; g.cells.filter(c => !c.given && c.v !== +G.solution[c.i]).forEach(c => { g.select([c.i]); g.input(+G.solution[c.i]); }); });
    await page.waitForFunction(() => NF.Game.act === 3 && !NF.Game.busy && document.getElementById('card').hidden, null, { timeout: 120000 });
    const r = await page.evaluate(() => ({ act: NF.Game.act, filled: NF.Game.grid.cells.filter(c => !c.given && c.v).length }));
    assert(r.act === 3 && r.filled >= 1, 'finishing a replay of Act III returns to Act IV with its progress (' + JSON.stringify(r) + ')');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  { // N6: conflicts survive reload in Act III
    console.log('N6 conflict colouring after reload');
    const { browser, page, logs } = await open({ hash: '#act3', init: `(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x','1'); } } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    await page.evaluate(() => { const g = NF.Game.grid; g.select([0]); g.input(6); g.select([1]); g.input(6); g.select([]); });
    await page.reload(); await settle(page);
    const c = await page.evaluate(() => [0, 1].map(i => NF.Game.grid.cells[i].val.getAttribute('class')));
    assert(c.every(x => /conflict/.test(x)), 'clashing digits are red after reload (' + c.join(' | ') + ')');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
