// Hand-written: rest of Chapter 2 (engine steps 13-32)
window.STEPS_MID = [
{ chapter:'Chapter 2 · The East Flank', pal:'cyan', title:'Column 11 settles', beats:[
  { t:'Could row 10’s lone 2 be in {C11}? Then rows 9–11 of the column would be one run, and with 5 groups to fit there’d be no room left for the groups above and below it.',
    cam:'C11', hl:{gold:['r10c11'], cyan:['C11']}, tok:['C11','R10:3'] },
  { t:'So [r10c11] is **empty**: any digit there would have to be row 10’s final lone 2, since there’s no room for a gap and another group after it. The bottom two rows can hold only one group, so the other four must squeeze into rows 1–9: single, gap, the 2, gap, single, gap, three cells.',
    acts:[['out','r10c11'],['diag',{type:'arr',tag:'C11',clueText:'[?, 2, ?, 2?, ?]',pats:['101010111010','101010111001','101010111011'],forced:'1010101110??'}],
      [3.2,'in','r1c11','r3c11','r5c11','r7c11','r8c11','r9c11'],[3.9,'out','r2c11','r4c11','r6c11'],[4.6,'d','r3c11',2]] },
  { t:'That 2 is alone in its column, so its top and bottom are walls; its left and right neighbours must be **inside**.',
    cam:'r2c9:r4c12', hl:{gold:['r3c11'], cyan:['r3c10','r3c12']}, acts:[['in','r3c10','r3c12']] },
]},
{ chapter:'Chapter 2 · The East Flank', pal:'cyan', title:'Row 3 ends small', beats:[
  { t:'{R3}’s last group already contains [r3c10], the 2 and [r3c12], and its total is a single digit $D.', cam:'R3', hl:{gold:['r3c10','r3c11','r3c12']}, tok:['R3:4'] },
  { t:'Adding [r3c9] would make four different digits, at least 1+2+3+4 = 10. So [r3c9] is **empty**, and $D = [r3c10] + 2 + [r3c12] is at least 6.',
    hl:{red:['r3c9'], gold:['r3c10','r3c11','r3c12']}, acts:[['out','r3c9'],['lc','D','6789']] },
]},
{ chapter:'Chapter 2 · The East Flank', pal:'cyan', title:'The top of column 10', beats:[
  { t:'If [r2c10] were inside, {C10}’s first group (total $A, 3 or 4) would run down through [r3c10] and stop there, since a third cell would already make 6+. So it is just two cells, making 1+2 or 1+3.',
    cam:'r1c8:r4c12', hl:{pink:['r2c10'], gold:['r3c10']}, tok:['C10:1'], acts:[['ghostin','r2c10']] },
  { t:'Either way there’s a 1, and it would already have two walls: at [r3c10], empty cells to its left and below; at [r2c10], empty cells above and to its right. A 1 allows only one. !!No good!!: [r2c10] is **empty**.',
    acts:[['bad'],[1.4,'clearGhosts'],[1.6,'out','r2c10']] },
  { t:'Now [r2c9] can’t be inside either: it would touch [r3c10] only at a corner, and the loop can’t pinch itself like that.',
    hl:{red:['r2c9'], cyan:['r3c10']}, acts:[['out','r2c9']] },
]},
{ chapter:'Chapter 2 · The East Flank', pal:'cyan', title:'Column 9 lines up', beats:[
  { t:'{C9} needs four groups, each totalling $C. At most one group can be a single cell (two single cells would both be $C), and rows 2 and 3 are already empty.', cam:'C9', hl:{cyan:['C9']}, tok:['C9'] },
  { t:'Without row 1, the four groups would need 7+ cells plus 3 gaps in rows 4–12: too many. So [r1c9] is a lone **$C**, and the other three groups are pairs or one triple.',
    acts:[['in','r1c9'],['pm','r1c9','789']] },
  { t:'Every way to fit three such groups into rows 4–12 uses rows **5, 8 and 11**.',
    acts:[['diag',{type:'arr',tag:'C9',clueText:'[C, C, C, C]',pats:['100110110110','100110110011','100110011011','100011011011','100111011011','100110111011','100110110111'],forced:'100?1??1??1?'}],[3.6,'in','r5c9','r8c9','r11c9']] },
]},
{ chapter:'Chapter 2 · The East Flank', pal:'cyan', title:'Is $A 3 or 4?', beats:[
  { t:'Suppose $A = 3. If [r1c10] were inside, it would be {C10}’s whole first group ([r2c10] is empty), so a 3. But it would have walls above and below and inside neighbours left and right: only two walls. So [r1c10] would be **empty**.',
    cam:'r1c8:r5c12', hl:{pink:['r1c10']}, tok:['C10:1','C12:1'], acts:[['ghostout','r1c10']] },
  { t:'Row 1’s last group would then be just [r1c11] and [r1c12], which must make 17+: an 8 and a 9 (with $C = 7).', hl:{gold:['r1c11','r1c12']}, tok:['R1:3'],
    acts:[['ghost','r1c11','8/9'],['ghost','r1c12','8/9']] },
  { t:'But {C12} starts with the total 1$A = 13. 8 or 9 on top isn’t enough, so the group runs down through [r2c12] and [r3c12], which must make just 4 or 5. It stops there (a third cell would make 6+), so [r4c12] is empty. Every split (1+3, 1+4, 2+3) puts a 1 or a 3 in one of these cells with only two walls: the grid edge plus [r2c11] or [r4c12]. !!Contradiction!!',
    hl:{red:['r1c12','r2c12','r3c12']}, tok:['C12:1'], acts:[['ghostin','r2c12'],['ghostout','r4c12'],[2.6,'bad']] },
  { t:'So ^$A = 4^.', hl:{}, acts:[['clearGhosts'],[0.6,'let','A',4]] },
]},
];
