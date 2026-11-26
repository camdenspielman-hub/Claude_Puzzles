/* Rule texts for the living manuscript. Each entry: glyph (inline SVG markup) + html text. */
(function () {
  const G = {
    grid: '<svg viewBox="0 0 22 22"><rect x="2" y="2" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 2v18M14 2v18M2 8h18M2 14h18" stroke="currentColor" stroke-width="0.8"/></svg>',
    cage: '<svg viewBox="0 0 22 22"><rect x="3" y="3" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="3 2.4"/><text x="5" y="10" font-size="7" font-weight="700" fill="currentColor">12</text></svg>',
    thermo: '<svg viewBox="0 0 22 22"><circle cx="6" cy="16" r="4.4" fill="#bdbdb6"/><path d="M6 16 L17 5" stroke="#bdbdb6" stroke-width="3.6" stroke-linecap="round"/></svg>',
    arrow: '<svg viewBox="0 0 22 22"><circle cx="7" cy="15" r="4.6" fill="none" stroke="#8f8f88" stroke-width="1.5"/><path d="M10.4 11.6 L18 4 M13.6 4 H18 V8.4" fill="none" stroke="#8f8f88" stroke-width="1.5" stroke-linecap="round"/></svg>',
    xv: '<svg viewBox="0 0 22 22"><text x="11" y="16" font-size="14" font-weight="800" fill="currentColor" text-anchor="middle">X</text></svg>',
    kropki: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="4.6" fill="#fff" stroke="currentColor" stroke-width="1.5"/></svg>',
    line: (c) => `<svg viewBox="0 0 22 22"><path d="M3 17 C7 5, 12 19, 19 6" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/></svg>`,
    between: '<svg viewBox="0 0 22 22"><path d="M6 15 L16 7" stroke="#b8b8b8" stroke-width="2.4"/><circle cx="5" cy="16" r="3.6" fill="#fff" stroke="#9a9a9a" stroke-width="1.4"/><circle cx="17" cy="6" r="3.6" fill="#fff" stroke="#9a9a9a" stroke-width="1.4"/></svg>',
    fog: '<svg viewBox="0 0 22 22"><path d="M3 9 h12 M6 13 h13 M2 17 h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".8"/></svg>',
    sandwich: '<svg viewBox="0 0 22 22"><rect x="2" y="6" width="18" height="10" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.4"/><text x="7" y="14.5" font-size="8" font-weight="700" fill="currentColor">15</text></svg>',
    xsum: '<svg viewBox="0 0 22 22"><text x="2" y="17" font-size="11" font-weight="700" fill="currentColor">21</text><text x="15" y="9" font-size="8" font-weight="800" fill="currentColor">x</text></svg>',
    sky: '<svg viewBox="0 0 22 22"><path d="M4 19 V10 H8 V5 H13 V12 H18 V19 Z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    lk: '<svg viewBox="0 0 22 22"><text x="1" y="9" font-size="8" font-weight="700" fill="currentColor">14</text><path d="M9 11 L18 20 M13 20 H18 V15" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    quad: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="1.4"/><text x="6" y="14" font-size="7.5" font-weight="700" fill="currentColor">2 7</text></svg>',
    parity: '<svg viewBox="0 0 22 22"><rect x="2" y="5" width="9" height="9" rx="1.5" fill="rgba(150,150,170,.45)"/><circle cx="16" cy="13" r="4.8" fill="rgba(150,150,170,.45)"/></svg>',
    peak: '<svg viewBox="0 0 22 22"><path d="M3 18 L11 4 L19 18 Z" fill="currentColor"/></svg>',
    hollow: '<svg viewBox="0 0 22 22"><ellipse cx="11" cy="12" rx="8.5" ry="5.5" fill="#a8d1ef" stroke="#2d77b8" stroke-width="1.4"/></svg>',
    river: '<svg viewBox="0 0 22 22"><path d="M4 4 C10 6 7 13 13 14 S17 19 19 20" fill="none" stroke="#4a92cf" stroke-width="3.4" stroke-linecap="round"/><circle cx="4" cy="4" r="2.6" fill="#fff" stroke="#2d77b8" stroke-width="1.4"/></svg>',
    lake: '<svg viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="12" rx="3" fill="rgba(90,160,215,.35)" stroke="#2d77b8" stroke-width="1.4"/></svg>',
    contour: '<svg viewBox="0 0 22 22"><path d="M2 8 H20" stroke="#9a4f22" stroke-width="2.2"/><path d="M6 8 v4 M11 8 v4 M16 8 v4" stroke="#9a4f22" stroke-width="1.3"/></svg>',
    sun: '<svg viewBox="0 0 22 22"><circle cx="11" cy="11" r="4" fill="#f1b53a"/><path d="M11 2v3M11 17v3M2 11h3M17 11h3M4.6 4.6l2.1 2.1M15.3 15.3l2.1 2.1M4.6 17.4l2.1-2.1M15.3 6.7l2.1-2.1" stroke="#f1b53a" stroke-width="1.5" stroke-linecap="round"/></svg>',
    sunMark: '<svg class="inline-mark" viewBox="0 0 22 22" aria-label="sun"><circle cx="11" cy="11" r="4.2" fill="#f1b53a"/><path d="M17.5 11h2.5M2 11h2.5M11 17.5V20M11 2v2.5M15.6 15.6l1.8 1.8M4.6 4.6l1.8 1.8M15.6 6.4l1.8-1.8M4.6 17.4l1.8-1.8" stroke="#f1b53a" stroke-width="1.6" stroke-linecap="round"/></svg>',
    shadeMark: '<svg class="inline-mark" viewBox="0 0 22 22" aria-label="shade"><circle cx="11" cy="11" r="7" fill="none" stroke="#4b3b2c" stroke-width="1.4"/><path d="M11 4 A7 7 0 0 0 11 18 Z" fill="#4b3b2c"/></svg>',
    elev: '<svg viewBox="0 0 22 22"><path d="M2 18 h4 v-5 h4 v-8 h4 v11 h6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  };

  const L = {
    classic4: { g: G.grid, t: 'Place <b>1–4</b> once in every row, column and 2×2 box.' },
    classic9: { g: G.grid, t: 'Place <b>1–9</b> once in every row, column and 3×3 box.' },
    seeds: { g: '<svg viewBox="0 0 22 22"><path d="M11 18 C10 12 13 7 18 5 C18 10 15 15 11 18 Z" fill="#3c8a3a"/><circle cx="11" cy="18" r="2" fill="#3c8a3a"/></svg>', get t() {
      return document.getElementById('app').classList.contains('seed-hints')
        ? '<b>Seeds</b> mark cells you can already work out. Solve every seed and the puzzle grows.'
        : '<b>Growth.</b> Once you have placed the digits the current rules let you work out, the puzzle grows. Seed hints in the menu mark which cells those are.';
    } },
    killer: { g: G.cage, t: '<b>Killer cages.</b> Digits in a cage sum to its small total and do not repeat within the cage.' },
    thermo: { g: G.thermo, t: '<b>Thermometers.</b> Digits strictly increase from the bulb end.' },
    arrow: { g: G.arrow, t: '<b>Arrows.</b> Digits along an arrow sum to the digit in its circle. Digits may repeat on an arrow where sudoku allows.' },
    xv: { g: G.xv, t: '<b>X.</b> Digits joined by an X sum to 10. Not every X is shown: two neighbours that sum to 10 may have no X between them.' },
    kropki: { g: G.kropki, t: '<b>White dot.</b> Digits joined by a white dot are consecutive. Not every dot is shown.' },
    whisper: { g: G.line('#5cc46a'), t: '<b>German whispers</b> (green). Adjacent digits on the line differ by at least 5.' },
    renban: { g: G.line('#e55078'), t: '<b>Renban</b> (pink). The line holds a set of consecutive digits, in any order, with no repeats.' },
    regionsum: { g: G.line('#5a9bf0'), t: '<b>Region sum lines</b> (blue). Each box the line passes through splits it into segments; every segment has the same sum.' },
    palindrome: { g: G.line('#8e8e8e'), t: '<b>Palindromes</b> (grey). The line reads the same from either end.' },
    between: { g: G.between, t: '<b>Between lines.</b> Every digit on the line lies strictly between the two digits in its end circles.' },
    entropic: { g: G.line('#9a6b3f'), t: '<b>Entropic lines</b> (brown). Any three consecutive cells hold one low (1–3), one middle (4–6) and one high (7–9) digit.' },
    modular: { g: G.line('#2fb3a5'), t: '<b>Modular lines</b> (teal). Any three consecutive cells hold one digit from each of {1,4,7}, {2,5,8} and {3,6,9}.' },
    zipper: { g: G.line('#8a6fe0'), t: '<b>Zipper lines</b> (purple). Digits the same distance from the line’s centre sum to the same total; on an odd-length line, that total is the centre digit.' },
    parity: { g: G.line('#ee6f6f'), t: '<b>Parity lines</b> (red). Adjacent digits alternate between odd and even.' },
    dutch: { g: G.line('#f08a3c'), t: '<b>Dutch whispers</b> (orange). Adjacent digits on the line differ by at least 4.' },
    nabner: { g: G.line('#e9c935'), t: '<b>Nabner lines</b> (yellow). No two digits on the line repeat or are consecutive.' },
    fog: { g: G.fog, t: '<b>Fog of war.</b> The grid is hidden. A correct digit clears the fog around its cell and reveals any clues beneath. A clue outside the grid appears once the first cell it points into is clear. Your own digits and marks always show.' },
    sandwich: { g: G.sandwich, t: '<b>Sandwich sums</b> (rounded frame). The clue is the sum of the digits between the 1 and the 9 in that row or column.' },
    xsum: { g: G.xsum, t: '<b>X-sums</b> (marked ˣ). Read from the clue’s side: the first digit is X, and the first X digits sum to the clue.' },
    skyscraper: { g: G.sky, t: '<b>Skyscrapers</b> (tower). Digits are building heights. The clue counts the buildings visible from that side; taller ones hide shorter ones behind them.' },
    littlekiller: { g: G.lk, t: '<b>Little killers.</b> Digits along the arrowed diagonal sum to the clue. Digits may repeat.' },
    quad: { g: G.quad, t: '<b>Quadruples.</b> Every digit in a circle appears in the four cells around it. A digit written twice appears twice.' },
    parity1: { g: G.parity, t: '<b>Shaded squares</b> hold even digits; <b>shaded circles</b> hold odd digits.' },
    elevation: { g: G.elev, t: '<b>Every digit is an elevation.</b> The land rises as you solve.' },
    contour: { g: G.contour, t: '<b>Contour lines.</b> Ticks point downhill. Every cell on a line’s uphill side is higher than every cell on its downhill side. A numbered contour also has its uphill cells above that height and its downhill cells at or below it.' },
    river: { g: G.river, t: '<b>Rivers</b> run from a spring to the sea at the map’s edge, always to the lowest neighbour. Each next river cell is lower than the current cell and lower than all of the current cell’s other orthogonal neighbours.' },
    peak: { g: G.peak, t: '<b>Summits</b> (▲) are higher than every orthogonally adjacent cell.' },
    hollow: { g: G.hollow, t: '<b>Hollows</b> (pond) are lower than every orthogonally adjacent cell.' },
    lake: { g: G.lake, t: '<b>Lakes.</b> Every lake cell is lower than every cell orthogonally adjacent to the lake (its shore).' },
    sun: { g: G.sun, t: `<b>Evening sun</b> sits low in the west at 45°. A cell is in shadow when a cell k columns to its left in the same row is at least k higher. ${G.sunMark} cells are sunlit; ${G.shadeMark} cells are in shadow.` },
  };

  // short names for notices (the bold text isn't always a name, e.g. 'Place <b>1–9</b>…')
  const NAMES = {"classic4": "Classic sudoku", "classic9": "Classic sudoku", "seeds": "Growth", "killer": "Killer cages", "thermo": "Thermometers", "arrow": "Arrows", "xv": "X", "kropki": "White dot", "whisper": "German whispers", "renban": "Renban", "regionsum": "Region sum lines", "palindrome": "Palindromes", "between": "Between lines", "entropic": "Entropic lines", "modular": "Modular lines", "zipper": "Zipper lines", "parity": "Parity lines", "dutch": "Dutch whispers", "nabner": "Nabner lines", "fog": "Fog of war", "sandwich": "Sandwich sums", "xsum": "X-sums", "skyscraper": "Skyscrapers", "littlekiller": "Little killers", "quad": "Quadruples", "parity1": "Shaded squares and circles", "elevation": "Elevation", "contour": "Contour lines", "river": "Rivers", "peak": "Summits", "hollow": "Hollows", "lake": "Lakes", "sun": "Evening sun"};
  Object.keys(L).forEach(k => { L[k].n = NAMES[k] || k; });
  NF.RULES = L;
  NF.GLYPHS = G;
})();
