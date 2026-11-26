// Act V: panel progress survives visiting another chapter + reload; landscape panel layout; flat Escape.
const { open } = require('./harness_env');
const assert = (c, m) => { if (!c) { console.log('  FAIL ' + m); process.exitCode = 1; } else console.log('  ok   ' + m); };
(async () => {
  {
    const { browser, page, logs } = await open({ hash: '#act5', init: `(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x','1'); } } catch(e){} window.NF_NO3D = true; })()` });
    await page.waitForFunction(() => NF.Island && NF.Island.open, null, { timeout: 30000 });
    for (let k = 0; k < 3; k++) { await page.evaluate(() => NF.Island.reveal()); await page.waitForTimeout(1600); }
    const s1 = await page.evaluate(() => Object.keys(NF.Island.saveState().solved));
    assert(s1.length === 3, '3 panels solved: ' + s1.join(','));
    await page.evaluate(() => NF.jumpTo(3));
    await page.waitForFunction(() => NF.Game.act === 3 && NF.Game.grid && !NF.Game.busy, null, { timeout: 30000 });
    await page.evaluate(() => history.replaceState(null, '', location.pathname)); // drop #act5 so reload follows the save
    await page.reload();
    await page.waitForFunction(() => NF.Game && NF.Game.grid && !NF.Game.busy, null, { timeout: 30000 });
    const a = await page.evaluate(() => ({ act: NF.Game.act, saved: JSON.parse(localStorage.getItem('ninefold-save-v2')) }));
    assert(a.act === 3, 'reload lands in the chapter last visited (IV)');
    assert(a.saved.panels && Object.keys(a.saved.panels.solved).length === 3, 'saved panels kept after reload in another chapter');
    await page.evaluate(() => NF.jumpTo(4));
    await page.waitForFunction(() => NF.Island && NF.Island.open, null, { timeout: 30000 });
    const t = await page.evaluate(() => document.querySelector('.pt-n').textContent);
    assert(/^4 \//.test(t), 'back on the island at panel ' + t);
    // flat mode Escape keeps the panel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const still = await page.evaluate(() => !!document.querySelector('#panelHost .panel-svg'));
    assert(still, 'Escape in flat mode keeps the panel on screen');
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
  {
    const { browser, page, logs } = await open({ hash: '#act5', viewport: { width: 844, height: 390 }, init: () => { try { localStorage.clear(); } catch (e) { } window.NF_NO3D = true; } });
    await page.waitForFunction(() => NF.Island && NF.Island.open, null, { timeout: 30000 });
    for (let k = 0; k < 6; k++) { await page.evaluate(() => NF.Island.reveal()); await page.waitForTimeout(1600); }
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => { const s = document.querySelector('#panelHost .panel-svg').getBoundingClientRect(); const l = document.querySelector('#panelHost .panel-legend').getBoundingClientRect(); const w = document.querySelector('#panelHost .panel-wrap').getBoundingClientRect(); return { svgW: Math.round(s.width), svgH: Math.round(s.height), legendW: Math.round(l.width), wrapTop: Math.round(w.top), wrapBottom: Math.round(w.bottom) }; });
    assert(m.svgH >= 260, 'landscape: last panel ' + m.svgW + 'x' + m.svgH + ', legend ' + m.legendW + 'px wide, wrap ' + m.wrapTop + '..' + m.wrapBottom);
    assert(m.wrapTop >= 0 && m.wrapBottom <= 390, 'panel fits the screen height');
    await page.screenshot({ path: 'shots/next/landscape_panel7.png' });
    console.log(logs.length ? logs.join('\n') : '  no console errors');
    await browser.close();
  }
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
