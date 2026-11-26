from nf import *
from spec import *
import json
g = Geo(9)
S4 = "1234341243212143"
G4 = [0, 7, 8, 15]   # 4x4 givens (cell indices in the 4x4)
fixed = {}
for i in range(4):
    for j in range(4):
        fixed[(2*i+1)*9 + (2*j+1)] = int(S4[i*4+j])
sol = random_solution(g, seed=1, fixed=fixed)
SOL = "".join(map(str, sol))
STAGES = [
 ("classic", "given: r1c7=1 r3c3=9 r7c7=2 r9c3=1"),
 ("killer", """
cage 23: r4c4 r4c5 r5c5 r6c5
cage 15: r5c8 r6c8 r7c8
cage 18: r7c1 r7c2 r8c2
cage 16: r5c1 r5c2 r5c3 r5c4
"""),
 ("thermo-arrow", """
thermo: r1c5 r2c5 r3c4 r3c3
arrow: r8c5 | r9c5 r9c6
"""),
 ("xv-kropki", """
X: r7c3 r8c3
white: r8c9 r9c9
X: r4c1 r5c1
"""),
]
def build(verbose=True):
    out, cons, giv = evaluate(g, STAGES, fixed, sol=sol, kw=dict(use_subsets=True), verbose=verbose, show_final=False)
    return out, cons, giv
if __name__ == "__main__":
    out, cons, giv = build()
    print(show(sol, is_cand=False))
    sols = solve_cp(g, cons, giv)
    print("CP solutions:", len(sols))
    # per stage newly solved in order of discovery
    prev = set()
    for name, n, st, err in out:
        order = []
        for ev in st.log:
            if ev[0]=="place" and ev[1] not in order: order.append(ev[1])
        new = [c for c in order if c not in prev and c not in giv]
        print(name, n, "new:", len(new), [rc(c) for c in new[:12]])
        prev |= {c for c in range(81) if pc(st.cand[c])==1}
