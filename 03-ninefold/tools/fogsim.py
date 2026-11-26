"""Fog-of-war construction and simulation (Act III)."""
from nf import *
from spec import side_cells, lk_cells
import random, itertools

def around(i):
    r, c = divmod(i, 9)
    for dr in (-1,0,1):
        for dc in (-1,0,1):
            rr, cc = r+dr, c+dc
            if 0 <= rr < 9 and 0 <= cc < 9:
                yield rr*9+cc

def anchor_visible(k, cleared):
    if isinstance(k, Quad):
        return any(c in cleared for c in k.cells)
    return k.cells[0] in cleared

def build_pool(sol, rnd):
    pool = []
    for i in range(9):
        side = rnd.choice(["L","R"])
        cells = side_cells(side, i)
        v = [sol[c] for c in cells]; a, b = sorted((v.index(1), v.index(9)))
        pool.append(Sandwich(cells, sum(v[a+1:b]), (side, i)))
        side = rnd.choice(["T","B"])
        cells = side_cells(side, i)
        v = [sol[c] for c in cells]; a, b = sorted((v.index(1), v.index(9)))
        pool.append(Sandwich(cells, sum(v[a+1:b]), (side, i)))
        for side in "LRTB":
            cells = side_cells(side, i)
            v = [sol[c] for c in cells]
            pool.append(XSum(cells, sum(v[:v[0]]), (side, i)))
            seen = mx = 0
            for x in v:
                if x > mx: seen += 1; mx = x
            pool.append(Skyscraper(cells, seen, (side, i)))
    # little killers
    for (dr, dc) in ((1,1),(1,-1),(-1,1),(-1,-1)):
        starts = set()
        for k in range(9):
            for first in ((0 if dr==1 else 8, k), (k, 0 if dc==1 else 8)):
                starts.add(first)
        for (r, c) in starts:
            cells = lk_cells(r*9+c, dr, dc)
            if len(cells) < 3 or len(cells) > 8: continue
            pool.append(LittleKiller(cells, sum(sol[x] for x in cells), (r-dr, c-dc), (dr, dc)))
    # quads
    for r in range(8):
        for c in range(8):
            cells = [r*9+c, r*9+c+1, (r+1)*9+c, (r+1)*9+c+1]
            vals = sorted(sol[x] for x in cells)
            for k in (2, 3):
                for sub in itertools.combinations(vals, k):
                    pool.append(Quad(cells, list(sub)))
    # parity markers
    for c in range(81):
        pool.append(Parity1(c, sol[c] % 2 == 0))
    return pool

def simulate(geo, sol, givens, start_clear, clues, kw, trace=False):
    cleared = set()
    for i in list(givens) + list(start_clear):
        cleared |= set(around(i))
    steps = []
    last_solved = -1
    while True:
        vis = [k for k in clues if anchor_visible(k, cleared)]
        try:
            st = State(geo, vis, givens, log=False); st.propagate(**kw)
        except Contradiction as e:
            return None, cleared, steps
        solved = [c for c in range(81) if pc(st.cand[c]) == 1]
        newc = set(cleared)
        for c in solved:
            newc |= set(around(c))
        if trace:
            steps.append((len(vis), len(solved), len(newc)))
        if len(solved) == 81:
            return st, newc, steps
        if newc == cleared:
            return st, cleared, steps
        cleared = newc
