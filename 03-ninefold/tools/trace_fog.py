from nf import *
from fogsim import *
import pickle
g = Geo(9)
sol, givens, clues = pickle.load(open('a3_final.pkl','rb'))
KW = dict(use_subsets=True)
cleared = set()
for i in givens: cleared |= set(around(i))
prev = None
rnd_no = 0
while True:
    vis = [k for k in clues if anchor_visible(k, cleared)]
    st = State(g, vis, givens, cand=prev, log=True)
    if prev: st.placed = set(c for c in range(81) if pc(prev[c]) == 1)
    st.propagate(**KW)
    solved = [c for c in range(81) if pc(st.cand[c]) == 1]
    print(f"===== round {rnd_no}: visible {[ (type(k).__name__, k.js().get('value', k.js().get('sum', k.js().get('digits')))) for k in vis]}")
    last = {}
    for ev in st.log:
        if ev[0] == 'elim':
            last[ev[1]] = ev[3]
            if 'sees it' not in ev[3]: print(f"   - {rc(ev[1])} not {digs(ev[2])} ({ev[3]})")
        else:
            print(f" * {rc(ev[1])} = {ev[2]} [{last.get(ev[1], 'given')}]")
    newc = set(cleared)
    for c in solved: newc |= set(around(c))
    if len(solved) == 81 or newc == cleared: break
    cleared = newc; prev = list(st.cand); rnd_no += 1
