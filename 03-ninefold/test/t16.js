// Phone checks (touch contexts) on app_next.
const { open } = require('./harness_env');
const assert = (c, m) => { if (!c) { console.log('  FAIL ' + m); process.exitCode = 1; } else console.log('  ok   ' + m); };
const settle = (page) => page.waitForFunction(() => { const G = NF.Game; return !G.busy && G.grid && !G.grid.locked && document.getElementById('card').hidden; }, null, { timeout: 60000, polling: 200 });
const saveFor = (act, stage) => JSON.stringify(JSON.stringify({ v: 2, act, unlocked: act, sound: false, acts: { [act]: { stage, size: 9, cells: null, fog: null } } }));
async function touchSwipe(page, x, y, dy) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let k = 1; k <= 8; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy * k / 8 }] }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
(async () => {
  {
    console.log('Act II at 390x844');
    const { browser, page, logs } = await open({ mobile: true, dpr: 2, viewport: { width: 390, height: 844 }, init: `(() => { try { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${saveFor(1, 0)}); } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page); await page.waitForTimeout(800);
    const cell = await page.evaluate(() => { const g = NF.Game.grid; const c = g.cells.find(c => !c.given); const b = c.bg.getBoundingClientRect(); return { i: c.i, x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.touchscreen.tap(cell.x, cell.y);
    const key = await page.evaluate(() => { const b = document.querySelector('#pad button[data-d="7"]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.touchscreen.tap(key.x, key.y);
    const v1 = await page.evaluate((i) => NF.Game.grid.cells[i].v, cell.i);
    assert(v1 === 7, 'tap cell + tap key 7 enters 7');
    await page.evaluate((i) => { const g = NF.Game.grid; g.select([i]); g.clear(); }, cell.i);
    await touchSwipe(page, key.x, key.y, -250);
    await page.waitForTimeout(400);
    const v2 = await page.evaluate((i) => NF.Game.grid.cells[i].v, cell.i);
    assert(v2 === 0, 'a swipe starting on a key does not enter a digit (cell = ' + v2 + ')');
    // header: scroll a little and check what sits under r1c9
    await page.evaluate(() => { document.getElementById('stage').scrollTop = 40; });
    await page.waitForTimeout(200);
    const hit = await page.evaluate(() => { const g = NF.Game.grid; const c = g.cells[8]; const b = c.bg.getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, Math.max(b.y + b.height / 2, 1)); const hdr = document.getElementById('top').getBoundingClientRect(); return { el: el && (el.id || el.className && el.className.baseVal || el.tagName), cellMidY: Math.round(b.y + b.height / 2), hdrBottom: Math.round(hdr.bottom) }; });
    const edges = await page.evaluate(() => ({ stageTop: Math.round(document.getElementById('stage').getBoundingClientRect().top), hdr: Math.round(document.getElementById('top').getBoundingClientRect().bottom) }));
    assert(edges.stageTop >= edges.hdr - 1, 'scrolling area starts below the header (stage top ' + edges.stageTop + ', header bottom ' + edges.hdr + '), so scrolled cells are clipped, not covered');
    await page.evaluate(() => { document.getElementById('stage').scrollTop = 0; });
    // growth on a phone: page does not scroll away; a toast names the new rules
    await page.evaluate(async () => { const G = NF.Game, g = G.grid, act = NF.DATA.acts[G.act]; for (const [r, c] of act.stages[G.stage].seeds) { g.select([r * 9 + c]); g.input(+G.solution[r * 9 + c]); } });
    await page.waitForFunction(() => NF.Game.stage === 1, null, { timeout: 30000 });
    await page.waitForTimeout(2600);
    const after = await page.evaluate(() => ({ st: document.getElementById('stage').scrollTop, toast: document.getElementById('toast').textContent, on: document.getElementById('toast').classList.contains('on') }));
    assert(after.st === 0, 'growth leaves the page at the top (scrollTop ' + after.st + ')');
    assert(after.on && /below the keypad/.test(after.toast), 'toast: "' + after.toast + '"');
    const how = await page.evaluate(() => { document.getElementById('menuBtn').click(); document.getElementById('howBtn').click(); return [...document.querySelectorAll('#how li')].filter(li => getComputedStyle(li).display !== 'none').map(li => li.textContent.slice(0, 40)); });
    assert(how.some(t => /^Tap a cell/.test(t)) && !how.some(t => /^Click or drag/.test(t)), 'How to play shows the touch version');
    await page.screenshot({ path: 'shots/next/phone_a2_growth.png' });
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  {
    console.log('Act III at 360x640');
    const { browser, page, logs } = await open({ mobile: true, dpr: 3, viewport: { width: 360, height: 640 }, hash: '#act3', init: () => { try { localStorage.clear(); } catch (e) { } window.NF_NO3D = true; } });
    await settle(page); await page.waitForTimeout(800);
    await page.evaluate(() => NF.Game.fog.liftAll());
    await page.waitForTimeout(3000);
    const sz = await page.evaluate(() => { const t = document.querySelector('.c-sky .out-text'), q = document.querySelector('.quad-text'), l = document.querySelector('.lk-text'); const h = (n) => n ? Math.round(n.getBoundingClientRect().height * 10) / 10 : null; return { sky: h(t), quad: h(q), lk: h(l) }; });
    console.log('  text heights (css px):', JSON.stringify(sz));
    await page.screenshot({ path: 'shots/next/phone_a3_lifted.png' });
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  {
    console.log('Island hint on touch');
    const { browser, page, logs } = await open({ mobile: true, viewport: { width: 390, height: 844 }, hash: '#act5', init: () => { try { localStorage.clear(); } catch (e) { } } });
    await page.waitForTimeout(9000);
    const h = await page.evaluate(() => ({ hint: document.getElementById('islandHint').textContent, failed: NF.World.failed }));
    assert(/Tap the panel/.test(h.hint) || h.failed, 'island hint: "' + h.hint + '"');
    await page.screenshot({ path: 'shots/next/phone_island.png' });
    console.log(logs.filter(l => !/GPU stall|GL Driver/i.test(l)).join('\n') || '  no console errors');
    await browser.close();
  }
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
