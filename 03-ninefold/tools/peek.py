"""Show candidates of chosen cells just before a target placement happens in the logic trace."""
from nf import *
from spec import *
import sys

def replay(geo, cons, givens, cand=None):
    st = State(geo, cons, givens, cand=cand, log=True)
    if cand: st.placed = set(c for c in range(81) if pc(cand[c]) == 1)
    st.propagate(use_subsets=True)
    return st

def cands_before(st0_cand, log, target_cell, cells):
    cand = list(st0_cand)
    for ev in log:
        if ev[0] == 'place' and ev[1] == target_cell:
            break
        if ev[0] == 'elim':
            cand[ev[1]] &= ~ev[2]
    return {rc(c): digs(cand[c]) for c in cells}

def stage_state(geo, stages, givens, upto):
    cons = []; giv = dict(givens); prev = None; st = None
    for i, (n, t) in enumerate(stages[:upto + 1]):
        c2, g2 = parse(t, geo); cons += c2; giv.update(g2)
        if i < upto:
            st = replay(geo, cons, giv, prev); prev = list(st.cand)
    return cons, giv, prev

if __name__ == "__main__":
    mod = __import__(sys.argv[1])
    stage = int(sys.argv[2]); target = parse_cells(sys.argv[3])[0]
    cells = parse_cells(" ".join(sys.argv[4:]))
    g = Geo(9)
    base = getattr(mod, 'fixed', None) or getattr(mod, 'GIVENS')
    cons, giv, prev = stage_state(g, mod.STAGES, base, stage)
    init = State(g, cons, giv, cand=prev, log=False)
    start = list(init.cand)
    st = replay(g, cons, giv, prev)
    print(cands_before(start, st.log, target, cells))
