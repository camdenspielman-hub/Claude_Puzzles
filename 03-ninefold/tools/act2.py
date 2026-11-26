from nf import *
from spec import *
from design import *
import act1, random
g = Geo(9)
S1 = act1.sol
rnd0 = random.Random(5)
for attempt in range(50):
    pairs = [(c, 80-c) for c in range(41)]
    P = set()
    for a,b in rnd0.sample(pairs, 5):
        P.add(a); P.add(b)
    fixedP = {c: S1[c] for c in P}
    S2 = random_solution(g, seed=rnd0.randint(0,10**6), fixed=fixedP)
    if S2: break
sol = S2
GIVENS = {c: S2[c] for c in P}
STAGES = [
 ("whisper-renban", """
whisper: r4c5 r5c6 r6c5 r5c4
renban: r2c1 r1c2 r2c3 r3c4 r2c5 r2c6 r3c6
whisper: r5c5 r4c4 r4c3 r5c3 r4c2 r5c1 r6c1
whisper: r8c3 r9c3 r8c4 r9c4 r9c5 r9c6 r8c6
"""),
 ("regionsum-palindrome", """
palindrome: r5c9 r4c8 r5c7 r6c7 r7c6 r8c7 r7c8
regionsum: r1c8 r2c7 r3c8 r4c9 r5c8 r6c8
"""),
 ("between-entropic-modular", """
between: r5c2 r6c2 r7c2
entropic: r6c4 r7c4 r7c3
modular: r8c8 r7c9 r8c9 r9c9
"""),
 ("dutch-zipper", """
dutch: r3c1 r4c1 r3c2
zipper: r1c1 r2c2 r3c3
"""),
]
if __name__ == "__main__":
    import sys
    out, cons, giv = evaluate(g, STAGES, GIVENS, sol=sol, kw=dict(use_subsets=True), show_final=False)
    print(show(sol, is_cand=False))
    used = set(c for k in cons for c in k.cells) | set(GIVENS)
    # candidate extra lines for variety
    for kind in sys.argv[1:]:
        pool = make_line_pool(g, sol, kind, 3, 6)
        pool = [p for p in pool if not set(p.cells) & used]
        print(kind, len(pool))
        for p in pool[:400]:
            pass
