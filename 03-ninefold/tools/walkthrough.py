"""Build the walkthrough HTML (rendered to PDF with Chromium)."""
import json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, os.environ.get("NF_APP", "app"), "src")
OUT = os.path.join(ROOT, "walkthrough")
os.makedirs(OUT, exist_ok=True)

figs = json.load(open(os.path.join(ROOT, "tools", "wt_figs.json")))
data_js = open(os.path.join(SRC, "data.js")).read()
css = open(os.path.join(SRC, "style.css")).read()
css = re.sub(r'#app\[data-act="(\d)"\]', r'.act-\1', css)
js = "\n".join(open(os.path.join(SRC, f)).read() for f in ["grid.js", "constraints.js"])
island_js = open(os.path.join(SRC, "island.js")).read()

def F(fid, cls=""):
    return f'<figure class="fig {cls}" data-fig="{fid}"><div class="fig-grid"></div><figcaption></figcaption></figure>'

def P(pid, cls=""):
    return f'<figure class="fig panelfig {cls}" data-panel="{pid}"><div class="fig-panel"></div><figcaption></figcaption></figure>'

BODY = f"""
<section class="cover">
  <p class="kicker">A solving companion</p>
  <h1>Ninefold</h1>
  <p class="sub">A sudoku that grows: one 4×4 seed, four 9×9 grids, seven line panels. This guide walks the whole thing the way a person would solve it, with no guessing.</p>
  <ol class="toc">
    <li><span>I</span> Paper — the seed, then cages, a thermometer, an arrow, X and kropki</li>
    <li><span>II</span> Vines — nine kinds of line</li>
    <li><span>III</span> Fog — sandwiches, X-sums, skyscrapers, little killers, quadruples, under fog of war</li>
    <li><span>IV</span> Survey — invented rules: every digit is a height</li>
    <li><span>V</span> Island — sudoku left behind; draw the rules yourself</li>
  </ol>
  <div class="howto">
    <h3>How to read this</h3>
    <p>Cells are named by row and column: r3c7 is row 3, column 7, and r1c1 is top left. Boxes are numbered 1–9 left to right, top to bottom. In the diagrams, given digits are bold; digits found earlier are in the act's own ink (blue on paper and on the survey map, green on the vines, gold in the fog); tinted cells are the ones the current step places.</p>
    <p>Each act grows in stages. A stage grows once you have correctly placed the cells its rules let you work out (the game calls them <b>seeds</b>; turn on <i>Seed hints</i> in the menu to have them marked). Then the next set of rules appears. The guide follows the same rhythm: the key deductions of each stage, then the board once that stage is done.</p>
    <p>Every step here was checked against a solver that only uses local, human-style logic (singles, locked candidates, small subsets, and reasoning about one clue at a time), and every grid and panel has exactly one solution.</p>
  </div>
</section>

<section class="act">
  <header><span class="num">I</span><h2>Paper</h2><p>Every puzzle starts small.</p></header>

  <h3>The seed</h3>
  <div class="row">
    {F("a1-seed", "small")}
    <div class="txt">
      <p>The first screen is a 4×4 sudoku with four givens. Each of them leaves one empty cell in some row, column or box that can take only one digit, and the grid fills in a minute.</p>
      <p>When it is solved, the 4×4 unfolds. Its sixteen digits spread apart and land on the even rows and even columns of a 9×9: the top row of the seed becomes r2c2, r2c4, r2c6, r2c8, and so on. Four new givens appear: 1 at r1c7, 9 at r3c3, 2 at r7c7 and 1 at r9c3.</p>
    </div>
  </div>

  <h3>Growth 1 · a classic sudoku with a hidden structure</h3>
  <p>The useful thing to notice: rows 2, 4, 6 and 8 already contain 1, 2, 3 and 4, and so do columns 2, 4, 6 and 8. So every empty cell in an even row <i>or</i> an even column must hold 5–9. The small digits 1–4 can only go where an odd row meets an odd column (r1c1, r1c3, r1c5 …), and each odd row needs four of its five such cells.</p>
  <p>Fill them box by box:</p>
  <ul>
    <li><b>Box 2</b> already holds 2 (r2c4) and 3 (r2c6). Its 1 and 4 must sit in its two odd-odd cells, r1c5 and r3c5. Row 1 has a 1 at r1c7, so <b>r1c5 = 4</b> and <b>r3c5 = 1</b>.</li>
    <li><b>Box 8</b> holds 1 and 4; its 2 and 3 go in r7c5/r9c5. Row 7 has the given 2, so <b>r7c5 = 3</b>, <b>r9c5 = 2</b>.</li>
    <li><b>Box 4</b> holds 3 and 4; its 1 and 2 go in r5c1/r5c3. Column 3 has the 1 at r9c3, so <b>r5c3 = 2</b>, <b>r5c1 = 1</b>. Box 6 works the same way once columns 7 and 9 are crosshatched.</li>
    <li>The corner boxes have four odd-odd cells for three small digits; crosshatching rows and columns fills them (r1c1 = 2, r1c3 = 3, r3c1 = 4, and so on).</li>
  </ul>
  <p>The seeds of this stage are exactly the seventeen missing small digits. Once they are in, the grid is a checkerboard: small digits on the even-even and odd-odd cells, large digits (5–9) on the rest, with five odd-odd exceptions that also hold large digits (r1c9, r3c3, r5c5, r7c1, r9c7). The classic rules can say nothing more about which large digit goes where, and the puzzle grows.</p>
  <div class="row two">{F("a1-g1")}{F("a1-cages")}</div>

  <h3>Growth 2 · killer cages</h3>
  <p>Every cage mixes known small digits with unknown large ones, so each total shrinks to a sum of large digits.</p>
  <ul>
    <li><b>23 cage</b> (r4c4, r4c5, r5c5, r6c5). r4c4 is 4, so the other three sum to 19, and from 5–9 that is only 5 + 6 + 8. Box 5's remaining large cells, r5c4 and r5c6, are therefore 7 and 9.</li>
    <li><b>16 cage</b> along row 5. With 1 and 2 known, r5c2 + r5c4 = 13. r5c4 is 7 or 9, and 9 would need a 4, so <b>r5c4 = 7</b>, <b>r5c2 = 6</b>, and <b>r5c6 = 9</b>.</li>
    <li><b>18 cage</b> (r7c1, r7c2, r8c2). r8c2 is 2, so r7c1 + r7c2 = 16 = 7 + 9. In column 2 the 9 cannot go in box 1 (box 1's 9 is r3c3), so it is at r7c2 or r9c2; either way box 7's 9 is in column 2. So <b>r7c2 = 9</b> and <b>r7c1 = 7</b>.</li>
    <li><b>15 cage</b> (r5c8, r6c8, r7c8). r6c8 is 1, so the other two sum to 14: 5 + 9 or 6 + 8. Rows 5 and 7 both have a 9, so it is 6 + 8, and row 5 already has its 6: <b>r5c8 = 8</b>, <b>r7c8 = 6</b>. Row 5's last large digit gives <b>r5c5 = 5</b>.</li>
  </ul>
  <p>Singles then give r1c9 = 6, r9c2 = 5, r2c9 = 8 and r9c7 = 8.</p>

  <h3>Growth 3 · a thermometer and an arrow</h3>
  <p>The thermometer runs from the 4 at r1c5 through r2c5 and r3c4 into the given 9 at r3c3, so r2c5 and r3c4 sit strictly between 4 and 9 and increase. Column 5 already has 5 (r5c5) and the 6/8 pair in r4c5/r6c5, so <b>r2c5 = 7</b> and then <b>r3c4 = 8</b>.</p>
  <p>The arrow says r8c5 = r9c5 + r9c6 = 2 + r9c6, and r8c5 is a large-digit cell. Column 5 now holds 5, 7 and the 6/8 pair, so <b>r8c5 = 9</b> and <b>r9c6 = 7</b>. Most of the top and bottom bands then fill with singles.</p>
  <div class="row two">{F("a1-g2")}{F("a1-g3")}</div>

  <h3>Growth 4 · X and kropki</h3>
  <p>The X between r7c3 (4) and r8c3 makes <b>r8c3 = 6</b>. The white dot joins r9c9 (4) and r8c9; a consecutive neighbour of 4 is 3 or 5, and r8c9 is a large-digit cell, so <b>r8c9 = 5</b>. The X between r4c1 and r5c1 (1) makes <b>r4c1 = 9</b>. From those three, every remaining cell is a single.</p>
  <div class="row">{F("a1-g4", "small")}<div class="txt"><p>When the page is complete, the digits glow, most of them fall away like leaves, and the solved grid rises out of the sea as the first plateau of an island. Ten digits stay where they are. They are the bridge into Act II.</p></div></div>
</section>

<section class="act">
  <header><span class="num">II</span><h2>Vines</h2><p>What you solve takes root.</p></header>
  <p>The ten inherited digits are r1c2 8, r2c8 4, r3c5 1, r4c7 5, r5c4 7, r5c6 9, r6c3 7, r7c5 3, r8c2 2 and r9c8 9. Lines grow over the grid in four waves.</p>
  <div class="row">{F("a2-start", "small")}<div class="txt">
  <p>A note on whispers, used throughout: adjacent digits differ by at least 5, so a whisper never holds 5, and its digits alternate between low (1–4) and high (6–9).</p>
  </div></div>

  <h3>Growth 1 · German whispers and renban</h3>
  <ul>
    <li><b>The short whisper</b> (r4c5, r5c6, r6c5, r5c4) bends around the given 9 and 7. r6c5 touches both on the line, so it is at most 2; column 5 already has 1, so <b>r6c5 = 2</b>. r4c5 touches the 9, so it is at most 4, and column 5 now has 1, 2 and 3: <b>r4c5 = 4</b>.</li>
    <li><b>The pink renban</b> has seven cells and contains the 8 at r1c2, so its digits are 2–8 or 3–9: no 1, and no second 8. In box 2 the 8 can't be in row 1 (r1c2) or on the four renban cells, which leaves only <b>r2c4 = 8</b>.</li>
    <li><b>The long whisper</b> runs r5c5, r4c4, r4c3, r5c3, r4c2, r5c1, r6c1. Box 5 now holds 2, 4, 7, 9 and column 5 holds 1 and 3, so r5c5 is 5, 6 or 8, and not 5: it is high. So r4c3, r4c2 and r6c1 are high and r4c4, r5c3, r5c1 are low. Box 4's three high cells must be 6, 8 and 9. Column 2 has 8, so r4c2 is 6 or 9, and 6 would force both of its line neighbours r5c3 and r5c1 to be 1 in the same row. So <b>r4c2 = 9</b>.</li>
    <li><b>The bottom whisper</b> runs r8c3, r9c3, r8c4, r9c4, r9c5, r9c6, r8c6. Column 5 leaves r9c5 high (6, 7 or 8), so r9c4 and r9c6 are low; if r9c5 were 6 both would be 1, so they are 1 and 2 in some order. r8c4 is high and touches r9c3 and r9c4; 6 would need both to be 1, so <b>r8c4 = 9</b>. Now r9c3 can't be 1 or 2, so it is 3 or 4, which pushes its neighbour r8c3 to 8 or more: <b>r8c3 = 8</b> and <b>r9c3 = 3</b>.</li>
    <li>Back in box 4, column 3 has 8, so <b>r4c3 = 6</b> and <b>r6c1 = 8</b>. A low digit beside a 6 on a whisper is 1, so <b>r4c4 = 1</b> and <b>r5c3 = 1</b>; then r9c4 = 2 and r9c6 = 1, and singles finish the stage.</li>
  </ul>
  <div class="row two">{F("a2-g1")}{F("a2-g2")}</div>

  <h3>Growth 2 · a palindrome and a region-sum line</h3>
  <ul>
    <li>The grey palindrome pairs r5c9 with r7c8, r4c8 with r8c7, and r5c7 with r7c6. Row 5 needs a 4. r5c1 sits beside the 8 on the whisper, so it is at most 3; r5c2 can't (box 4's 4 is at r6c2); r5c5 is 6 or 8; column 8 already has 4, so r5c8 can't; and r5c9 can't either, because its mirror r7c8 is also in column 8. So <b>r5c7 = 4</b> and its mirror <b>r7c6 = 4</b>. Singles follow: r4c6 = 8, r5c5 = 6, r9c5 = 8, and the renban then makes r3c4 = 4.</li>
    <li>r4c8 and r8c7 mirror each other and are 3 or 7. Box 8's 7 has to sit in row 8 (r8c5 or r8c6), so r8c7 isn't 7: <b>r8c7 = 3</b> and <b>r4c8 = 3</b>.</li>
    <li>The blue line splits into r1c8, r2c7, r3c8 (box 3) and r4c9, r5c8, r6c8 (box 6), and both halves have the same sum. With r4c9 = 7, the box-6 half is 7 + (2 or 8) + (1 or 6), so the total is 10, 15, 16 or 21. Column 8 holds a 2/8 pair in r5c8 and r7c8, which takes 2 and 8 out of r1c8 and r3c8, and r3c8 is at least 5. A total of 10 would need a 1 in both halves of column 8. A total of 16 would need r2c7 to be 3, 4 or 5, none of which it can be. The two totals left, 15 and 21, both use <b>r6c8 = 6</b>, and in both the box-3 half only works with <b>r2c7 = 9</b>.</li>
  </ul>

  <h3>Growth 3 · between, entropic and modular lines</h3>
  <ul>
    <li>The between line r5c2–r6c2–r7c2 has r5c2 = 5 in one circle and r6c2 = 4 on the line, so the other circle, r7c2, must be below 4. Column 2 has its 2 and row 7 has its 3, so <b>r7c2 = 1</b>. Hidden singles place the remaining 1s, including r8c8.</li>
    <li>With r8c8 = 1, r1c8 can't be 1, and the total of 15 needed exactly that. So the blue line totals 21: <b>r5c8 = 8</b>, and r7c8 = 2.</li>
    <li>The entropic line r6c4–r7c4–r7c3 needs one low, one middle and one high digit. r7c4 is 5 or 6, a middle digit either way, so neither of the others can be middle: r6c4 (3 or 5) is <b>3</b> and r7c3 (5 or 9) is <b>9</b>.</li>
    <li>The modular line r8c8–r7c9–r8c9–r9c9 starts with r8c8 = 1, so every third cell from it (r9c9) is in the 1/4/7 group: <b>r9c9 = 4</b>.</li>
  </ul>
  <div class="row two">{F("a2-g3")}{F("a2-g4")}</div>

  <h3>Growth 4 · Dutch whisper and zipper</h3>
  <p>The orange Dutch whisper r3c1–r4c1–r3c2 has r3c1 = 9 and r4c1 = 2, so r3c2 must differ from 2 by at least 4: it can't be 3, which makes <b>r2c2 = 3</b> a hidden single. The renban then fixes <b>r3c6 = 3</b>. The purple zipper r1c1–r2c2–r3c3 is an odd line, so r1c1 + r3c3 equals the centre r2c2 = 3; with r1c1 = 1, <b>r3c3 = 2</b>. Everything else is singles.</p>
</section>

<section class="act">
  <header><span class="num">III</span><h2>Fog</h2><p>You can only see what you have earned.</p></header>
  <p>Night falls and fog covers the grid. Two digits survive from Act II: <b>r4c4 = 1</b> and <b>r6c6 = 5</b>. Each correct digit clears the fog in the 3×3 around it and reveals any clue underneath; a clue outside the grid appears when the first cell it points into is cleared (for a little killer, the first cell along its arrow). The rule types are listed from the start (sandwich sums, X-sums, skyscrapers, little killers, quadruples); only their positions are hidden. In the diagrams, the pale cells are still fogged.</p>

  <h3>Round 1 · four quadruples</h3>
  <p>The quadruple between r6c6, r6c7, r7c6 and r7c7 asks for 2, 2 and 7. r6c6 is 5, so the other three cells hold exactly 2, 2 and 7. The two 2s can't share a row or column, so they sit on the diagonal: <b>r6c7 = 2</b>, <b>r7c6 = 2</b>, <b>r7c7 = 7</b>. The 1-4-9 quadruple at r5c7/r5c8/r6c7/r6c8 then puts 1, 4 and 9 into r5c7, r5c8, r6c8, a naked triple for box 6.</p>
  <div class="row two">{F("a3-r0")}{F("a3-r1")}</div>

  <h3>Round 2 · another quadruple</h3>
  <p>The newly visible 6-6-8 quadruple (r6c8, r6c9, r7c8, r7c9) has r6c8 in the 1/4/9 triple, so the other three cells are 6, 6 and 8, the 6s again on a diagonal: <b>r6c9 = 6</b>, <b>r7c8 = 6</b>, <b>r7c9 = 8</b>. The 4-7-9 quadruple below now forces 4 and 9 into r8c7/r8c8.</p>

  <h3>Round 3 · the first sandwich</h3>
  <p>A sandwich 8 appears to the right of row 8, and 4 and 9 are locked in r8c7/r8c8. If the 9 were at r8c8, the 4 beside it would already be in the sandwich, and no position of the 1 adds up to exactly 8 without repeating a 1 or a 4. So <b>r8c7 = 9</b> and <b>r8c8 = 4</b>. The 1 must be to the left of the 9: column 4 already has its 1, and three or more cells between 1 and 9 would sum to at least 2 + 3 + 5 = 10. That leaves <b>r8c5 = 1</b> with a single cell between, <b>r8c6 = 8</b>. Then r5c7 = 4, and the 2-3-8 quadruple gives r7c5 = 3.</p>
  <div class="row two">{F("a3-r2")}{F("a3-r3")}</div>

  <h3>Round 4 · X-sum, sandwich, skyscraper and a little killer</h3>
  <p>Column 5 now shows an X-sum of 26 read from the bottom, so r9c5 is the count X, and above it sit r8c5 = 1 and r7c5 = 3. X = 4 can't reach 26; X = 6 would need three more cells summing to 16 and X = 7 four cells summing to 15, and the column's remaining candidates can't do either. X = 5 works only with r6c5 and r5c5 being 8 and 9. So <b>r9c5 = 5</b>.</p><p>A sandwich 3 appears under column 6. A 1 is one of the crusts, so a total of 3 can only be a single 3 between them. Column 6's 1 can only be in its top three cells; its 9 can't be in box 5 (the 8/9 pair in column 5 takes it) and the row-9 skyscraper rules out r9c6, so the 9 is up there too. A 1 and a 9 two apart in r1c6–r3c6 put the 3 in the middle: <b>r2c6 = 3</b>. The 3-5-7 quadruple then gives r3c7 = 3 and r3c8 = 7.</p><p>Clearing the fog around r8c5 has also uncovered a little killer of 15 below column 3. Its arrow points up and to the right, along r9c4, r8c5, r7c6, r6c7, r5c8 and r4c9. That diagonal already holds 1, 2 and 2, so its other three cells sum to 10. r5c8 is 1 or 9 (box 6's triple, with the 4 now at r5c7), and 9 would leave only 1 for the last two cells, so <b>r5c8 = 1</b>. Now r9c4 and r4c9 sum to 9. r4c9 is 3, 5 or 7 (box 6 still needs 3, 5, 7 and 8, and column 9 has its 8), and r9c4 can't be 2 (box 8 has its 2 at r7c6), so r4c9 isn't 7. With r9c5 = 5, box 9's 5 can only go at r8c9, so <b>r4c9 = 3</b> and <b>r9c4 = 6</b>.</p>

  <h3>Rounds 5–7 · the other little killers and the last quadruple</h3>
  <p>Round 5 uncovers a second little killer of 15, above column 6 and pointing down and to the right, and an X-sum of 15 to the right of row 3. The short diagonal r1c7, r2c8, r3c9 must sum to 15, which settles <b>r1c7 = 6</b>. Reading row 3 from the right, r3c9 is the count: 4 + 7 + 3 + 1 = 15 makes <b>r3c9 = 4</b> and <b>r3c6 = 1</b>, and the diagonal's middle cell is then <b>r2c8 = 5</b>. In round 6 the 32 little killer above column 9 runs down and to the left through the eight cells r1c8 to r8c1, and gives r4c5 = 4 and r7c2 = 5. Finally the 1-3-5 quadruple at r5c1/r5c2/r6c1/r6c2 and the skyscraper 3 on row 6 clear the last of the fog.</p>
  <div class="row two">{F("a3-r4")}{F("a3-r6")}</div>
</section>

<section class="act">
  <header><span class="num">IV</span><h2>Survey</h2><p>Every digit is a height.</p></header>
  <p>Dawn. The grid becomes a survey map and, from here on, every digit you place raises a column of land in the 3D view. There are no given digits. The rules are new:</p>
  <ul class="rules">
    <li><b>Rivers</b> run from a spring (white circle) to the sea at the edge. Each next river cell is lower than the current cell and lower than all of the current cell's other orthogonal neighbours: water takes the lowest way down.</li>
    <li><b>Lakes</b>: every lake cell is lower than every cell orthogonally adjacent to the lake (its shore).</li>
    <li><b>Contours</b> (ticks point downhill): every cell on the uphill side is higher than every cell on the downhill side. A number on a contour also puts the uphill cells above that height and the downhill cells at or below it.</li>
    <li><b>Summits</b> (▲) are higher than all orthogonal neighbours.</li>
    <li>In growth 2, the <b>evening sun</b> sits low in the west at 45°. A cell is in shadow when some cell k columns to its left in the same row is at least k higher. <svg class="inline-mark" viewBox="0 0 22 22" aria-label="sun"><circle cx="11" cy="11" r="4.2" fill="#f1b53a"/><path d="M17.5 11h2.5M2 11h2.5M11 17.5V20M11 2v2.5M15.6 15.6l1.8 1.8M4.6 4.6l1.8 1.8M15.6 6.4l1.8-1.8M4.6 17.4l1.8-1.8" stroke="#f1b53a" stroke-width="1.6" stroke-linecap="round"/></svg> marks a sunlit cell, <svg class="inline-mark" viewBox="0 0 22 22" aria-label="shade"><circle cx="11" cy="11" r="7" fill="none" stroke="#4b3b2c" stroke-width="1.4"/><path d="M11 4 A7 7 0 0 0 11 18 Z" fill="#4b3b2c"/></svg> a shaded one.</li>
  </ul>
  <div class="row two">{F("a4-map")}{F("a4-g1")}</div>

  <h3>Growth 1 · where does the water go?</h3>
  <p>Start with the lowest digits. A river step a → b says b is lower than every other neighbour of a, so <i>every cell beside a river, except the cell the water flows into, is higher than something</i> and can't be 1. The same is true of every shore cell around a lake, every summit, and every cell on the uphill side of a contour. Crossing these out leaves many columns with a single place for their 1:</p>
  <ul>
    <li><b>Column 3.</b> Every cell except r1c3 is upstream on a river, beside a river, or on the uphill side of the western contour. So <b>r1c3 = 1</b>, the mouth of the northern river (r3c2 → r3c3 → r2c3 → r1c3).</li>
    <li><b>Column 4.</b> r1c4 shares row 1 with that 1 and r9c4 is on a lake shore: <b>r4c4 = 1</b>.</li>
    <li><b>Column 6.</b> r1c6 is uphill of the 5-contour, r9c6 is on a shore and r4c6 shares row 4 with the new 1: <b>r2c6 = 1</b>.</li>
    <li><b>Column 8.</b> Only the lake cells r2c8 and r3c8 remain, and row 2 has its 1: <b>r3c8 = 1</b>. Then column 7 gives <b>r8c7 = 1</b>, column 5 gives <b>r9c5 = 1</b> (a lake cell; r5c5 shares box 5 with r4c4), and column 2 gives <b>r7c2 = 1</b>.</li>
  </ul>
  <p>The 2s fall the same way (r2c3, r1c4, r8c5, r3c7, r4c6), helped by the rivers' strict descent: the northern river's four cells must decrease to the 1 at its mouth, so r2c3 = 2 sits right behind it.</p>
  <p>The labelled contours split cells into "above 5" and "5 or below". In the south-east, r8c8, r8c9, r9c7 and r9c8 are all 6+, and their downhill neighbours r7c8, r7c9, r8c7, r9c6 and r9c9 are all 5 or less. Along the top, r1c6 and r1c7 are 6+ while r1c5, r1c8, r2c6 and r2c7 are at most 5. That leaves row 1 with a 4/5 pair, and row 7 with a 3/4 pair in r7c8/r7c9. From there hidden singles run through the middle of the map: r7c1 = 2, r7c7 = 5, r9c9 = 2, then r2c7 = 4, r2c8 = 3 and onward until 47 cells are fixed. The rest can't be settled yet: many different landscapes still fit every river, lake, contour and summit.</p>

  <h3>Growth 2 · evening shadows</h3>
  <p>The sun drops into the west and four marks appear. In the 3D view the land really does cast these shadows.</p>
  <ul>
    <li><b>r2c5 is shaded.</b> After growth 1, row 2 reads ?, ?, 2, 5, ? with r2c5 at least 6. To shade it, a cell k steps to the left must be at least r2c5 + k. r2c4 = 5 and r2c3 = 2 are too low, and r2c1 would need to be 10 or more. Only r2c2 can do it, three steps away: r2c2 ≥ r2c5 + 3. With r2c5 ≥ 6 that forces <b>r2c5 = 6</b> and <b>r2c2 = 9</b>.</li>
    <li><b>r3c6 is sunlit</b>, so no cell to its left may tower over it. That caps r3c5 below 9 and r3c6 can't be 7; singles then place 9s in r6c5, r4c3 and r9c1.</li>
    <li><b>r6c4 is shaded.</b> r6c3 = 5 can't shade a 6 or 7, and r6c1 can no longer be 9 (column 1's 9 is at r9c1), so r6c2 must: r6c2 ≥ r6c4 + 2. Column 2 already has its 9, so <b>r6c2 = 8</b> and <b>r6c4 = 6</b>.</li>
    <li><b>r4c8 is shaded.</b> Its near neighbours to the left are now known or too low, and only r4c7 can throw the shadow: <b>r4c7 = 8</b>, <b>r4c8 = 7</b>.</li>
  </ul>
  <p>Everything else is singles. When the last column rises, the camera pulls back and all four grids stand together as the island.</p>
  <div class="row">{F("a4-g2", "small")}<div class="txt"><p>The finished survey. Water runs exactly as the rivers say, the lakes sit below their shores, and the evening shadows fall on the marked cells.</p></div></div>
</section>

<section class="act">
  <header><span class="num">V</span><h2>Island</h2><p>Now draw the rules yourself.</p></header>
  <p>Sudoku is left behind. Seven stone panels stand on the island you built. On each, draw a line from the circle to the notch along the grid; the line can't visit a point twice. It cuts the panel into regions, and the symbols say what each region needs. Solving a panel sends a light along the ground to the next one.</p>

  <div class="row">{P("first", "small")}<div class="txt"><h3>1 · First light</h3><p>Gaps block the line, and it must pass both diamonds. The bottom diamond's left side is cut, and the two gaps in the middle block the short way between the diamonds. The only route takes the top diamond first, snakes down through the centre to the bottom diamond, and climbs the right edge to the exit.</p></div></div>
  <div class="row">{P("tally", "small")}<div class="txt"><h3>2 · Tally</h3><p>Every region sums to 10. The digits total 30, so there are three regions. The 8 in the corner needs exactly 2 more, and the only neighbour that gives it is the 2 beside it, so that pair is a region. The top row (1 + 4 + 5) is another, and the remaining four cells (4 + 2 + 3 + 1) make the third. One line draws those borders.</p></div></div>
  <div class="row">{P("stones", "small")}<div class="txt"><h3>3 · Stones</h3><p>Black and white stones may not share a region, so the line must run between any black and white stones that touch, and must wall off the others. Start from the stones in the middle, where the separating edges are forced, then route the line so it reaches the border between the groups.</p></div></div>
  <div class="row">{P("petals", "small")}<div class="txt"><h3>4 · Petals</h3><p>A flower with k petals has exactly k of its four sides on the line. The three-petal flowers fix three sides each, and the one-petal flowers forbid the line from hugging them. These are slitherlink counts on an open path.</p></div></div>
  <div class="row">{P("tally2", "small")}<div class="txt"><h3>5 · Tally, again</h3><p>Sixteen digits that total 48, so four regions of 12. The bottom row already sums to 12, and so does the third row (1 + 1 + 1 + 9). The 9 in the top row needs exactly 3 more, which is the 3 beside it. The remaining six cells also total 12, and one line traces all four borders.</p></div></div>
  <div class="row">{P("shade", "small")}<div class="txt"><h3>6 · Evening</h3><p>The stones are now patches of sun and shade: sunlit and shaded cells may not share a region. It is the stones rule, re-dressed to match the evening light of Act IV.</p></div></div>
  <div class="row">{P("ninefold", "small")}<div class="txt"><h3>7 · Ninefold</h3><p>The last panel stands at the centre of the island and combines everything: every region's digits sum to 15, the three flowers each touch the line on three sides, and the corner diamond must be visited. The way in is the corner: the 6 and 9 at the bottom left already make 15, so they must be cut off as a pair. The three-petal flowers each pin a U-shaped stretch of line, and joining those pieces so the other regions also total 15 (4 + 3 + 7 + 1, 6 + 1 + 8, 1 + 4 + 7 + 3) leaves a single path. When it lights, the line is drawn again across the whole island at sunset.</p></div></div>
</section>

<section class="act appendix">
  <header><span class="num">∗</span><h2>Solutions</h2></header>
  <div class="row two">{F("a1-g4")}{F("a2-g4")}</div>
  <div class="row two">{F("a3-r6")}{F("a4-g2")}</div>
</section>
"""

FIGJS = r"""
(function(){
  const FIGS = __FIGS__;
  const byId = {}; FIGS.forEach(f => byId[f.id] = f);
  document.querySelectorAll('figure[data-fig]').forEach(fe => {
    const f = byId[fe.dataset.fig]; if (!f) return;
    const host = fe.querySelector('.fig-grid');
    host.classList.add('act-' + f.act);
    const g = new NF.Grid(host, { size: f.size, margin: f.margin || 0 });
    g.vineMode = !!f.vine; g.showConflicts = false;
    f.givens.forEach(([r,c,v]) => g.setGiven(r*f.size+c, v));
    f.digits.forEach(([r,c,v]) => { const cell = g.cells[r*f.size+c]; cell.v = v; g.renderCell(cell); });
    f.marks.forEach(([r,c,m]) => { const cell = g.cells[r*f.size+c]; if (!cell.v) { cell.centre.textContent = m; cell.centre.setAttribute('class', 'd-centre mark'); } });
    f.new.forEach(([r,c]) => g.cells[r*f.size+c].bg.classList.add('fresh'));
    f.cons.forEach(k => { const rd = NF.renderConstraint(g, k); if (rd) rd.grow(0); });
    const S = NF.S;
    // fog sits under the clues and digits, as in the game: revealed quads and your own digits show above it
    const fogG = NF.svgEl('g', { class: 'wt-fog-layer' }); g.root.insertBefore(fogG, g.gOver);
    f.fog.forEach(([r,c]) => { NF.svgEl('rect', { x: g.M + c*S, y: g.M + r*S, width: S, height: S, class: 'wt-fog' }, fogG); });
    if (f.margin) {
      // fog the outside positions whose clue isn't shown yet: skip (outside clues shown only when visible)
    }
    fe.querySelector('figcaption').textContent = f.caption || '';
  });
  const panels = {}; NF.DATA.acts[4].panels.forEach(p => panels[p.id] = p);
  document.querySelectorAll('figure[data-panel]').forEach(fe => {
    const p = panels[fe.dataset.panel]; if (!p) return;
    const view = NF.Island.buildPanelSVG(p, fe.querySelector('.fig-panel'));
    view.line.setAttribute('points', p.solution.map(([x,y]) => `${view.X(x)},${view.Y(y)}`).join(' '));
    // the text refers to the diamonds: keep them above the drawn line
    Object.values(view.dotEls || {}).forEach(d => view.svg.appendChild(d));
    const e = p.solution[p.solution.length-1];
    view.head.setAttribute('cx', view.X(e[0])); view.head.setAttribute('cy', view.Y(e[1])); view.head.setAttribute('opacity', 1);
    view.svg.classList.add('solved');
    fe.querySelector('figcaption').textContent = 'Solution: ' + p.title;
  });
  document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} });
  document.body.dataset.ready = '1';
})();
"""

PRINT_CSS = """
@page { size: A4; margin: 16mm 15mm 17mm; }
html, body { height: auto !important; overflow: visible !important; }
body { background: #fff; color: #1b1b1b; font-family: "Newsreader", Georgia, serif; font-size: 10.4pt; line-height: 1.45; margin: 0; }
h1, h2, h3 { font-family: "Archivo", "Helvetica Neue", Arial, sans-serif; }
.cover { min-height: 250mm; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
.cover .kicker { font-family: "Archivo", sans-serif; text-transform: uppercase; letter-spacing: .18em; font-size: 9pt; color: #666; margin: 0; }
.cover h1 { font-weight: 800; font-stretch: 62%; text-transform: uppercase; letter-spacing: .14em; font-size: 64pt; margin: 4mm 0 4mm; line-height: .95; }
.cover .sub { font-size: 14pt; max-width: 130mm; margin: 0 0 10mm; }
.toc { list-style: none; padding: 0; margin: 0 0 12mm; border-top: 1.5px solid #1b1b1b; }
.toc li { padding: 2.6mm 0; border-bottom: .6px solid #ccc; font-size: 11pt; display: flex; gap: 6mm; }
.toc li span { width: 10mm; font-style: italic; color: #777; }
.howto { background: #f4f4f0; padding: 6mm 7mm; border-radius: 3mm; }
.howto h3 { margin: 0 0 2mm; font-size: 11pt; text-transform: uppercase; letter-spacing: .1em; }
.howto p { margin: 0 0 2mm; }
.act { page-break-before: always; }
.act header { display: flex; align-items: baseline; gap: 5mm; border-bottom: 1.5px solid #1b1b1b; padding-bottom: 2mm; margin-bottom: 4mm; }
.act header .num { font-family: "Newsreader", serif; font-style: italic; font-size: 20pt; color: #777; }
.act header h2 { font-weight: 800; font-stretch: 70%; text-transform: uppercase; letter-spacing: .12em; font-size: 24pt; margin: 0; }
.act header p { margin: 0 0 0 auto; font-style: italic; color: #666; }
h3 { font-size: 11.5pt; margin: 5mm 0 1.5mm; letter-spacing: .02em; break-after: avoid; }
p { margin: 0 0 2.2mm; }
ul { margin: 0 0 2.5mm; padding-left: 5mm; }
li { margin-bottom: 1.4mm; }
.row { display: flex; gap: 6mm; align-items: flex-start; margin: 3mm 0 4mm; break-inside: avoid; page-break-inside: avoid; }
.row .txt { flex: 1; min-width: 0; }
.row.two .fig { flex: 1; }
.fig { margin: 0; break-inside: avoid; }
.fig.small { width: 70mm; flex: none; }
.fig-grid { position: relative; width: 100%; aspect-ratio: 1; overflow: hidden; }
.fig-grid .nf-grid { position: absolute; inset: 0; }
.fig-panel { width: 100%; }
.fig figcaption { font-size: 8.6pt; color: #555; font-style: italic; margin-top: 1.5mm; }
.cell-bg.fresh { fill: rgba(255, 205, 40, 0.42); }
.d-centre.mark { font-size: 12px; fill: #8a8a8a; }
.wt-fog { fill: url(#hatch); fill: rgba(150, 156, 190, 0.55); }
.act-3 .wt-fog { fill: rgba(170, 176, 210, 0.62); }
.fig-grid.act-2, .fig-grid.act-3, .fig-grid.act-4 { border-radius: 2mm; }
.fig-grid.act-3 { background: #121833; }
.fig-grid.act-2 { background: #eef3ec; }
.fig-grid.act-4 { background: #f4f2e8; }
.panelfig .panel-svg { filter: none; max-height: none; }
.rules li { margin-bottom: 1.2mm; }
.inline-mark { width: 1.05em; height: 1.05em; vertical-align: -0.18em; }
.appendix .row { margin-top: 2mm; }
"""

html = f"""<!doctype html><html><head><meta charset="utf-8"><title>Ninefold — Solving Companion</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Libre+Franklin:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..600&family=IM+Fell+English&display=swap">
<style>{css}</style>
<style>{PRINT_CSS}</style>
</head><body>
<div id="app" data-act="1" style="position:static;background:#fff;"></div>
{BODY}
<script>{data_js}</script>
<script>window.NF = window.NF || {{}};</script>
<script>{js}</script>
<script>{island_js}</script>
<script>{FIGJS.replace("__FIGS__", json.dumps(figs))}</script>
</body></html>"""
open(os.path.join(OUT, "walkthrough.html"), "w").write(html)
print("wrote", os.path.join(OUT, "walkthrough.html"), len(html))
