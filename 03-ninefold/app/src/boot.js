/* start once fonts are ready (digits measure correctly for the transitions) */
(function () {
  const go = () => NF.boot().catch(e => console.error(e));
  if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]).then(go);
  else go();
})();
