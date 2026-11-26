"""Print a readable deduction trace for a staged puzzle."""
from nf import *
from spec import *
import sys

def trace(geo, stages, givens, sol, kw=None, stage_from=0, max_lines=60, base_cons=()):
    kw = kw or dict(use_subsets=True)
    cons = list(base_cons); giv = dict(givens)
    prev = None
    for si, (name, text) in enumerate(stages):
        c2, g2 = parse(text, geo); cons += c2; giv.update(g2)
        st = State(geo, cons, giv, cand=prev, log=True)
        st.placed = set(c for c in range(81) if prev and pc(prev[c]) == 1)
        try:
            st.propagate(**kw)
        except Contradiction as e:
            print("CONTRA", e)
        if si >= stage_from:
            print(f"===== stage {si} {name}")
            n = 0
            last_reason = {}
            for ev in st.log:
                if ev[0] == "elim":
                    _, cell, mask, why = ev
                    last_reason[cell] = why
                    if not why.endswith("sees it"):
                        if n < max_lines:
                            print(f"   - {rc(cell)} not {digs(mask)}  ({why})")
                        n += 1
                else:
                    _, cell, d, _ = ev
                    if n < max_lines:
                        print(f" * {rc(cell)} = {d}   [{last_reason.get(cell, 'given/hidden')}]")
                    n += 1
        prev = list(st.cand)
    return st

if __name__ == "__main__":
    import act1
    g = Geo(9)
    which = sys.argv[1]
    if which == "act1":
        trace(g, act1.STAGES, act1.fixed, act1.sol, stage_from=int(sys.argv[2]) if len(sys.argv) > 2 else 0, max_lines=int(sys.argv[3]) if len(sys.argv) > 3 else 60)

if __name__ == "__main__" and sys.argv[1] == "act2":
    import act2
    g = Geo(9)
    trace(g, act2.STAGES, act2.GIVENS, act2.sol, stage_from=0, max_lines=500)

if __name__ == "__main__" and sys.argv[1] == "act4":
    import act4
    from nf import State
    g = Geo(9)
    for name, cons in (("stage1", act4.C1), ("stage2", act4.C1 + act4.C2)):
        pass
    # stage 1
    st = State(g, act4.C1, {}, log=True); st.propagate(use_subsets=True)
    def dump(st, title):
        print("=====", title)
        last = {}
        for ev in st.log:
            if ev[0] == 'elim':
                last[ev[1]] = ev[3]
                if 'sees it' not in ev[3]: print(f"   - {rc(ev[1])} not {digs(ev[2])} ({ev[3]})")
            else:
                print(f" * {rc(ev[1])} = {ev[2]} [{last.get(ev[1], '?')}]")
    dump(st, "stage 1")
    prev = list(st.cand)
    st2 = State(g, act4.C1 + act4.C2, {}, cand=prev, log=True)
    st2.placed = set(c for c in range(81) if pc(prev[c]) == 1)
    st2.propagate(use_subsets=True)
    dump(st2, "stage 2")
