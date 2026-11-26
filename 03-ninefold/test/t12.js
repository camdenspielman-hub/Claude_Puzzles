// Targeted checks for the audit fixes (run with NF_APP=app_next).
const { open } = require('./harness_env');
const assert = (c, m) => { if (!c) { console.log('  FAIL ' + m); process.exitCode = 1; } else console.log('  ok   ' + m); };
const settle = (page) => page.waitForFunction(() => { const G = NF.Game; return !G.busy && G.grid && !G.grid.locked && document.getElementById('card').hidden; }, null, { timeout: 60000, polling: 200 });

(async () => {
  // 1. v1 save migrates into the per-act format and restores
  {
    console.log('1. v1 save migration');
    const v1 = { act: 0, stage: 1, unlocked: 0, size: 9, fog: null, panels: null, sound: true, cells: Array(81).fill(null) };
    v1.cells[0] = [0, [1, 2], [], []]; v1.cells[4] = [7, [], [], []];
    const { browser, page, logs } = await open({ init: `(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); localStorage.setItem('ninefold-save-v1', ${JSON.stringify(JSON.stringify(v1))}); sessionStorage.setItem('x','1'); } } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    const r = await page.evaluate(() => ({ act: NF.Game.act, stage: NF.Game.stage, c0: NF.Game.grid.cells[0].corner, c10: NF.Game.grid.cells[4].v, v2: !!localStorage.getItem('ninefold-save-v2'), v1: !!localStorage.getItem('ninefold-save-v1'), label: document.getElementById('msStage').textContent }));
    assert(r.act === 0 && r.stage === 1, 'restored act 1 growth 2 (got ' + r.act + '/' + r.stage + ')');
    assert(JSON.stringify(r.c0) === '[1,2]' && r.c10 === 7, 'cells and marks restored');
    assert(r.v2 && !r.v1, 'save rewritten as v2, v1 removed');
    assert(r.label === 'growth 2 of 4', 'seed hints off by default: no counter in "' + r.label + '"');
    // 2. menu jump keeps progress per act
    console.log('2. menu jump keeps progress');
    await page.evaluate(() => { const g = NF.Game.grid; g.select([2]); g.input(5); });
    await page.evaluate(() => NF.jumpTo(1));
    await settle(page);
    const a2 = await page.evaluate(() => { const g = NF.Game.grid; const i = g.cells.findIndex(c => !c.given); g.select([i]); g.input(3); return { act: NF.Game.act, i }; });
    assert(a2.act === 1, 'jumped to Act II');
    await page.evaluate(() => NF.jumpTo(0));
    await settle(page);
    const back = await page.evaluate(() => ({ act: NF.Game.act, stage: NF.Game.stage, v2: NF.Game.grid.cells[2].v, v10: NF.Game.grid.cells[4].v, c0: NF.Game.grid.cells[0].corner }));
    assert(back.act === 0 && back.stage === 1 && back.v2 === 5 && back.v10 === 7 && JSON.stringify(back.c0) === '[1,2]', 'Act I progress intact after visiting Act II (' + JSON.stringify(back) + ')');
    await page.evaluate(() => NF.jumpTo(1));
    await settle(page);
    const back2 = await page.evaluate((i) => NF.Game.grid.cells[i].v, a2.i);
    assert(back2 === 3, 'Act II progress intact too');
    await page.reload(); await settle(page);
    const rl = await page.evaluate(() => NF.Game.act);
    assert(rl === 1, 'reload returns to the act last played');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  // 3. fog overlay: own entries visible over fog, hidden clues still hidden
  {
    console.log('3. fog overlay');
    const { browser, page, logs } = await open({ hash: '#act3', init: () => { try { localStorage.clear(); } catch (e) { } window.NF_NO3D = true; } });
    await settle(page);
    const r = await page.evaluate(() => {
      const G = NF.Game, g = G.grid;
      const fogged = g.cells.filter(c => c.fogged && !c.given);
      const t = fogged[0];
      g.select([t.i]); g.input(9 === +G.solution[t.i] ? 8 : 9);
      const t2 = fogged[1];
      g.select([t2.i]); g.input(2, 'corner'); g.input(4, 'corner');
      const top = document.querySelector('#gridWrap > .nf-top');
      const hidden = G.rendered.filter(rd => rd.g.classList.contains('fogged-hide'));
      const hiddenInTop = hidden.filter(rd => top.contains(rd.g)).length;
      const visQuads = G.rendered.filter(rd => rd.data.type === 'quad' && !rd.g.classList.contains('fogged-hide'));
      return {
        hasTop: !!top, digitsInTop: top.contains(t.val), selInTop: top.contains(t.sel), val: t.val.textContent,
        markCount: t2.corners.length, foggedClass: t.g.classList.contains('fogged'),
        hidden: hidden.length, hiddenInTop, visQuads: visQuads.length, visQuadsInTop: visQuads.filter(rd => top.contains(rd.g)).length,
        topPE: getComputedStyle(top).pointerEvents,
      };
    });
    assert(r.hasTop && r.digitsInTop && r.selInTop, 'digits and selection live in the overlay above the fog');
    assert(r.val && r.foggedClass, 'a digit typed into fog is shown (' + r.val + ')');
    assert(r.markCount === 2, 'corner marks in a fogged cell are drawn');
    assert(r.hidden > 0 && r.hiddenInTop === 0, 'hidden clues stay hidden in the grid (' + r.hidden + ' hidden, ' + r.hiddenInTop + ' in overlay)');
    assert(r.visQuads > 0 && r.visQuads === r.visQuadsInTop, 'revealed quads drawn above the fog (' + r.visQuadsInTop + '/' + r.visQuads + ')');
    assert(r.topPE === 'none', 'overlay is click-through');
    // clicking still selects through the overlay
    const box = await page.evaluate(() => { const g = NF.Game.grid; const c = g.cells[40]; const b = c.bg.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.click(box.x, box.y);
    const sel = await page.evaluate(() => [...NF.Game.grid.selection]);
    assert(sel.length === 1 && sel[0] === 40, 'clicking a cell under the overlay selects it');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'shots/next_fog_overlay.png' });
    // leaving the act stops the fog loop
    const fog = await page.evaluate(async () => { const f = NF.Game.fog; await NF.jumpTo(1); return null; });
    await settle(page);
    const running = await page.evaluate(() => ({ fog: NF.Game.fog, tops: document.querySelectorAll('#gridWrap > .nf-top').length }));
    assert(running.fog === null && running.tops === 0, 'fog stopped and overlay removed after leaving Act III');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  // 4. reserved corner slots, rule highlight, rules list at the top
  {
    console.log('4. reserved slots / highlight / rules scroll');
    const save = { v: 2, act: 0, unlocked: 0, sound: true, acts: { 0: { stage: 1, size: 9, cells: null, fog: null } } };
    const { browser, page, logs } = await open({ viewport: { width: 1280, height: 720 }, init: `(() => { try { localStorage.clear(); localStorage.setItem('ninefold-save-v2', ${JSON.stringify(JSON.stringify(save))}); } catch(e){} window.NF_NO3D = true; })()` });
    await settle(page);
    const r = await page.evaluate(() => {
      const G = NF.Game, g = G.grid;
      const cage = G.rendered.find(rd => rd.data.type === 'killer' && !g.cells[rd.reserve[0][0] * 9 + rd.reserve[0][1]].given);
      const [r0, c0] = cage.reserve[0];
      const cell = g.cells[r0 * 9 + c0];
      g.select([cell.i]); g.input(1, 'corner'); g.input(3, 'corner');
      const first = cell.corners[0];
      return { x: +first.getAttribute('x'), y: +first.getAttribute('y'), slot0: [0.2 * 64, 0.24 * 64] };
    });
    assert(!(Math.abs(r.x - r.slot0[0]) < 1 && Math.abs(r.y - r.slot0[1]) < 1), 'first corner mark skips the cage-total slot (' + r.x + ',' + r.y + ')');
    await page.hover('#ruleList li[data-rule="killer"]');
    await page.waitForTimeout(300);
    const h = await page.evaluate(() => {
      const G = NF.Game;
      return { on: G.grid.svg.classList.contains('hl-on'), lit: G.rendered.filter(rd => rd.g.classList.contains('hl')).map(rd => rd.data.type), dimOp: getComputedStyle((G.rendered.find(rd => rd.data.type !== 'killer') || G.rendered[0]).g).opacity };
    });
    assert(h.on && h.lit.length && h.lit.every(t => t === 'killer'), 'hovering the cage rule lights only cages (' + h.lit.join(',') + ')');
    await page.mouse.move(5, 400);
    await page.waitForTimeout(300);
    const off = await page.evaluate(() => NF.Game.grid.svg.classList.contains('hl-on'));
    assert(!off, 'highlight clears on leaving the rule');
    await page.evaluate(() => NF.jumpTo(3));
    await settle(page);
    const sc = await page.evaluate(() => { const l = document.getElementById('ruleList'); return { top: l.scrollTop, scrolls: l.scrollHeight > l.clientHeight, cls: l.className }; });
    assert(sc.top === 0, 'Act IV opens with its rules scrolled to the top (scrollTop ' + sc.top + ', scrollable ' + sc.scrolls + ', ' + sc.cls + ')');
    await page.screenshot({ path: 'shots/next_a4_1280.png' });
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  // 5. Act IV on a phone
  {
    console.log('5. Act IV phone layout');
    const { browser, page, logs } = await open({ hash: '#act4', viewport: { width: 390, height: 844 }, init: () => { try { localStorage.clear(); } catch (e) { } window.NF_NO3D = true; } });
    await settle(page);
    const m = await page.evaluate(() => ({ side: document.getElementById('side').getBoundingClientRect().width, btn: document.querySelector('#pad button').getBoundingClientRect().width, sw: document.getElementById('stage').scrollWidth, view: !document.getElementById('viewToggle').hidden }));
    assert(m.side > 340 && m.btn > 30, 'side column ' + Math.round(m.side) + 'px, keypad buttons ' + Math.round(m.btn) + 'px');
    assert(m.sw <= 390, 'no horizontal overflow (' + m.sw + ')');
    assert(!m.view, '"View the land" hidden without 3D');
    await page.screenshot({ path: 'shots/next_a4_phone.png' });
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
