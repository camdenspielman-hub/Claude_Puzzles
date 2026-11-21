// Hand-written opening: intro, rules, Chapter 1 (cipher), start of Chapter 2.
window.STEPS_HEAD = [
{ kind:'intro', dur:10.5 },

// ───────────────────────── THE RULES
{ chapter:'The Rules', rules:true, pal:'violet', chapterSub:'Five ingredients, one loop', title:'One loop', beats:[
  { t:'Draw **one loop** along the grid lines. It may never **touch or cross itself**, not even at a corner.', cam:'all',
    acts:[['demo','r2c2:r3c5','r4c3:r5c4','r5c5']] },
  { t:'Every cell **inside** the loop holds a digit 1–9, with no repeats in any row or column. Cells **outside** stay empty.',
    hl:{cyan:['r2c2:r3c5','r4c3:r5c4','r5c5']}, acts:[['ghost','r2c2',4],['ghost','r2c3',7],['ghost','r3c4',6],['ghost','r4c3',9],['ghost','r5c5',3]] },
]},
{ chapter:'The Rules', rules:true, pal:'violet', title:'Small digits count walls', beats:[
  { t:'Every **1**, **2** or **3** says exactly how many of its four sides are part of the loop. Digits 4–9 make no such promise.', cam:'r8c2:r9c5',
    acts:[['demo','r8c2:r9c4'],[1.6,'ghost','r8c2',2],[2.2,'ghost','r8c3',1],[2.8,'ghost','r9c4',2],[3.4,'ghost','r8c4',5],[4.4,'tag','r8c2','2 walls'],[5.0,'tag','r8c3','1 wall']] },
  { t:'So a 2 with empty cells on both its left and right already has both its walls, and the cells above and below it must be inside. Likewise a 1 always has exactly three inside neighbours.' },
]},
{ chapter:'The Rules', rules:true, pal:'violet', title:'Group totals', beats:[
  { t:'Clues outside the grid give the **totals of each group** of consecutive digits in that row or column, in order. Empty cells split the groups.', cam:'R2',
    acts:[['ghostin','r2c1','r2c2','r2c4','r2c7:r2c9'],[1.3,'ghost','r2c1',3],[1.5,'ghost','r2c2',5],[1.7,'ghost','r2c4',9],[1.9,'ghost','r2c7',1],[2.1,'ghost','r2c8',2],[2.3,'ghost','r2c9',4],
      [3.2,'tag','r2c1','8'],[3.6,'tag','r2c4','9'],[4.0,'tag','r2c8','7']] },
  { t:'Here that row would be clued **8 · 9 · 7**. Rows without clues have no totals to meet.' },
]},
{ chapter:'The Rules', rules:true, pal:'violet', title:'The cipher', beats:[
  { t:'The letters **A–J** are the digits **0–9** in disguise, each letter a different digit. A **?** can be any digit.', cam:'all',
    tok:['C5:1','C12:1','C1:3','C1:4','R1:3','C10:1'] },
  { t:'Two-character clues are two-digit totals, so $J$H means "tens digit $J, units digit $H". No clue may start with 0.' },
]},

// ───────────────────────── CHAPTER 1 · CRACKING THE CIPHER
{ chapter:'Chapter 1 · Cracking the Cipher', chapterSub:'Ten letters, ten digits', pal:'amber', title:'Who can be zero?', beats:[
  { t:'$A, $C, $D, $F, $H and $I appear **alone** as totals, so none of them is 0. $J, $A and $F **start** two-digit clues, so they aren’t 0 either.', cam:'all',
    tok:['C10:1','C3:2','C6:1','R10:3','C1:2','R12:1','C5:1','C7:1','C11:4'],
    acts:[['lc','A','1–9'],['lc','C','1–9'],['lc','D','1–9'],['lc','F','1–9'],['lc','H','1–9'],['lc','I','1–9'],['lc','J','1–9']] },
  { t:'So the **0 is one of $B, $E or $G**: the letters that only ever appear as a units digit.', tok:['C1:3','C1:4','C3:1','R10:1','C5:3'],
    acts:[['lc','B','0–9'],['lc','E','0–9'],['lc','G','0–9']] },
]},
{ chapter:'Chapter 1 · Cracking the Cipher', pal:'amber', title:'Four equal totals', beats:[
  { t:'{C9} has **four** groups, each adding up to the same digit $C, and no digit may repeat in the column.', cam:'C9', hl:{gold:['C9']}, tok:['C9'] },
  { t:'So we need four **separate** sets of digits with the same total. Small totals run out of sets: 6 only gives {6}, {1,5}, {2,4}, and {1,2,3} reuses digits. So **$C ≥ 7**.',
    acts:[['diag',{type:'eq',title:'Four disjoint sets, same total',lines:['5 :  {5} {1,4} {2,3}            → 3 sets','6 :  {6} {1,5} {2,4}            → 3 sets','7 :  {7} {1,6} {2,5} {3,4}      → 4 ✓','8, 9 : plenty of ways']}],[5.5,'lc','C','789']] },
]},
{ chapter:'Chapter 1 · Cracking the Cipher', pal:'amber', title:'Row 1’s budget: $J = 1', beats:[
  { t:'{R1} has **three** groups, all with two-digit totals: ??, ?$I and $J$C. A row holds at most nine different digits, so it adds up to **at most 45**.', cam:'R1', hl:{gold:['R1']}, tok:['R1'] },
  { t:'The first two totals are at least 10 each, leaving $J$C ≤ 25. With $C ≥ 7, a tens digit of 2 would give at least 27. So ^$J = 1^.',
    acts:[['diag',{type:'eq',title:'Row 1',lines:['?? + ?$I + $J$C  ≤  45','≥10 + ≥10      ⇒  $J$C ≤ 25','$C ≥ 7  ⇒  $J$C ∈ {17, 18, 19}','⇒  $J = 1']}],[5.2,'let','J',1]] },
]},
{ chapter:'Chapter 1 · Cracking the Cipher', pal:'amber', title:'Small tens digits', beats:[
  { t:'{C7} is a **single** group with a two-digit total $A?. A column adds to at most 45, so $A is 2, 3 or 4 (not 1, since $J = 1).', cam:'C7', hl:{gold:['C7']}, tok:['C7'],
    acts:[['lc','A','234']] },
  { t:'Similarly $F starts the total $F? in {C11}, so $F is 2, 3 or 4 (not 0 or 1).', hl:{gold:['C11']}, tok:['C11:4'], acts:[['lc','F','234']] },
]},
{ chapter:'Chapter 1 · Cracking the Cipher', pal:'amber', title:'Squeezing {C11}', beats:[
  { t:'{C11} has five groups: ?, $F, ?, $F?, ?. Five groups need four empty gaps, so the column holds **at most 8 digits**.', cam:'C11', hl:{cyan:['C11']}, tok:['C11'] },
  { t:'$F? is at least 20, so it needs at least 3 cells (two digits make at most 17). The other four groups take at least one cell each, so $F? gets **at most 4** cells. $F = 4 would need 7 cells to reach 40, so $F is 2 or 3.',
    acts:[['diag',{type:'eq',title:'Cells needed for F?',lines:['$F = 2 :  20–29  →  ≥ 3 cells','$F = 3 :  30–39  →  4 cells (6+7+8+9 = 30)','$F = 4 :  40+    →  7 cells  ✗']}],[4.5,'lc','F','23']] },
  { t:'$F = 3 would use all 8 cells: groups of 1, 1, 1, 4, 1 with single gaps, a completely fixed pattern. The 4-cell group {6,7,8,9} would cover rows 7–10.',
    acts:[['diag',{type:'arr',tag:'C11',clueText:'[?, 3, ?, 30, ?]',pats:['101010111101'],digs:[['?','','3','','?','','6–9','6–9','6–9','6–9','','?']],forced:'101010111101'}],
      [2.5,'ghostin','r1c11','r3c11','r5c11','r7c11:r10c11','r12c11'],[2.7,'ghostout','r2c11','r4c11','r6c11','r11c11'],[3.5,'ghost','r10c11','6+']] },
]},
{ chapter:'Chapter 1 · Cracking the Cipher', pal:'amber', title:'$F = 3 breaks row 10', beats:[
  { t:'Then [r10c11] would hold 6 or more. But {R10} ends with a group totalling $F = 3, which would have to sit to its right, in [r10c12].',
    cam:'r8c9:r11c12', hl:{pink:['r10c11'], gold:['r10c12']}, tok:['R10:3'],
    acts:[['ghostin','r7c11:r10c11'],['ghost','r10c11','6+'],[1.6,'ghost','r10c12',3]] },
  { t:'But [r10c12] touches [r10c11], so they’d be one group. !!Contradiction!! So ^$F = 2^, and $A is 3 or 4.',
    hl:{red:['r10c11','r10c12']}, acts:[['bad'],[1.6,'clearGhosts'],[1.8,'let','F',2],[2.4,'lc','A','34']] },
]},

// ───────────────────────── CHAPTER 2 · THE EAST FLANK
{ chapter:'Chapter 2 · The East Flank', chapterSub:'Lonely twos pin the loop', pal:'cyan', title:'Lonely twos', beats:[
  { t:'A total of 2 can only be a **single cell holding 2** (1+1 would repeat). {R10} ends with one, and so does the second group of {C11}.', cam:'all',
    tok:['R10:3','C11:2'], hl:{gold:['R10','C11']} },
  { t:'Such a 2 already has loop walls on both sides along its line. With exactly two walls, its two **other** neighbours must be inside.',
    acts:[['diag',{type:'html',html:'<div class="dhdr"><span>A lone 2</span><span>walls on both sides → neighbours inside</span></div><svg width="820" height="250" viewBox="0 0 820 250"><g transform="translate(250,20)"><rect x="80" y="0" width="70" height="70" rx="10" fill="rgba(79,240,255,.35)" stroke="#4ff0ff" stroke-width="2"/><rect x="80" y="80" width="70" height="70" rx="10" fill="rgba(255,209,102,.25)" stroke="#ffd166" stroke-width="3"/><text x="115" y="128" text-anchor="middle" font-family="Unbounded" font-weight="900" font-size="38" fill="#fff">2</text><rect x="80" y="160" width="70" height="70" rx="10" fill="rgba(79,240,255,.35)" stroke="#4ff0ff" stroke-width="2"/><rect x="0" y="80" width="70" height="70" rx="10" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.2)"/><rect x="160" y="80" width="70" height="70" rx="10" fill="rgba(0,0,0,.5)" stroke="rgba(255,255,255,.2)"/><line x1="76" y1="78" x2="76" y2="152" stroke="#ff4fd8" stroke-width="7" stroke-linecap="round"/><line x1="154" y1="78" x2="154" y2="152" stroke="#ff4fd8" stroke-width="7" stroke-linecap="round"/><text x="-60" y="122" font-family="Grotesk" font-size="20" fill="#ff9ee6">wall</text><text x="250" y="122" font-family="Grotesk" font-size="20" fill="#ff9ee6">wall</text><text x="240" y="40" font-family="Grotesk" font-size="20" fill="#9ff">inside</text><text x="240" y="200" font-family="Grotesk" font-size="20" fill="#9ff">inside</text></g></svg>'}]] },
]},
];
