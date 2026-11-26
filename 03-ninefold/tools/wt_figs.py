"""Compute walkthrough figures (grid snapshots) from the verified designs."""
from nf import *
from spec import *
from fogsim import around, anchor_visible
import act1, act2, act4, pickle, json

g = Geo(9)

def run_stages(stages, base_givens, upto, kw=dict(use_subsets=True)):
    cons, giv, prev = [], dict(base_givens), None
    states = []
    for i, (n, t) in enumerate(stages[:upto + 1]):
        c2, g2 = parse(t, g); cons += c2; giv.update(g2)
        st = State(g, cons, giv, cand=prev, log=False)
        if prev: st.placed = set(c for c in range(81) if pc(prev[c]) == 1)
        st.propagate(**kw)
        states.append((list(cons), dict(giv), list(st.cand)))
        prev = list(st.cand)
    return states

def solved(cand):
    return {c: lo(cand[c]) for c in range(81) if pc(cand[c]) == 1}

def fig(fid, act, cons, givens, known, new=(), marks=None, fog=None, margin=0, caption="", small=False, size=9, vine=False):
    return {"id": fid, "act": act, "size": size, "margin": margin, "caption": caption, "small": small, "vine": vine,
            "givens": [[c // size, c % size, v] for c, v in sorted(givens.items())],
            "digits": [[c // size, c % size, v] for c, v in sorted(known.items()) if c not in givens],
            "new": [[c // size, c % size] for c in new],
            "marks": [[c // size, c % size, m] for c, m in (marks or {}).items()],
            "fog": [[c // size, c % size] for c in (fog or [])],
            "cons": [k.js() for k in cons if k.js() is not None]}

FIGS = []
# ---------------- Act I
S4 = act1.S4
g4 = {k: int(S4[k]) for k in act1.G4}
FIGS.append({"id": "a1-seed", "act": 1, "size": 4, "margin": 0, "caption": "The 4×4 seed, solved. Bold black digits are the four givens.",
             "givens": [[k // 4, k % 4, v] for k, v in g4.items()], "digits": [[k // 4, k % 4, int(S4[k])] for k in range(16) if k not in g4],
             "new": [], "marks": [], "fog": [], "cons": [], "small": True, "vine": False})
st1 = run_stages(act1.STAGES, act1.fixed, 3)
prev = set(act1.fixed)
names = ["a1-g1", "a1-g2", "a1-g3", "a1-g4"]
caps = ["After growth 1: every small digit is placed. Empty cells now hold 5–9 (centre marks).",
        "After growth 2 (killer cages).", "After growth 3 (thermometer and arrow).", "After growth 4: the solved page."]
for i, (cons, giv, cand) in enumerate(st1):
    known = solved(cand)
    new = [c for c in known if c not in prev and c not in giv]
    marks = {}
    if i == 0:
        for c in range(81):
            if c not in known: marks[c] = "5–9"
    FIGS.append(fig(names[i], 1, cons, giv, known, new, marks=marks, caption=caps[i]))
    prev |= set(known)
# start-of-growth-2 view (cages just appeared)
cons2, giv2, _ = st1[1]
FIGS.append(fig("a1-cages", 1, cons2, giv2, solved(st1[0][2]), [], caption="Growth 2 begins: four cages appear."))

# ---------------- Act II
st2 = run_stages(act2.STAGES, act2.GIVENS, 3)
FIGS.append(fig("a2-start", 2, st2[0][0], act2.GIVENS, dict(act2.GIVENS), [], caption="Act II opens: ten inherited digits and the first vines.", vine=True))
prev = set(act2.GIVENS)
caps = ["After growth 1 (whispers and renban).", "After growth 2 (palindrome and region sum).", "After growth 3 (between, entropic, modular).", "After growth 4: solved."]
for i, (cons, giv, cand) in enumerate(st2):
    known = solved(cand)
    new = [c for c in known if c not in prev and c not in giv]
    FIGS.append(fig(f"a2-g{i+1}", 2, cons, giv, known, new, caption=caps[i], vine=True))
    prev |= set(known)

# ---------------- Act III (fog rounds)
sol3, giv3, clues3 = pickle.load(open("a3_final.pkl", "rb"))
cleared = set()
for i in giv3: cleared |= set(around(i))
prevc = None; prevk = set(giv3); rnd = 0
rounds = []
while True:
    vis = [k for k in clues3 if anchor_visible(k, cleared)]
    st = State(g, vis, giv3, cand=prevc, log=False)
    if prevc: st.placed = set(c for c in range(81) if pc(prevc[c]) == 1)
    st.propagate(use_subsets=True)
    known = solved(st.cand)
    new = [c for c in known if c not in prevk]
    fogcells = [c for c in range(81) if c not in cleared]
    rounds.append((rnd, vis, known, new, fogcells))
    newc = set(cleared)
    for c in known: newc |= set(around(c))
    if len(known) == 81 or newc == cleared: break
    cleared = newc; prevc = list(st.cand); prevk = set(known); rnd += 1
for rnd_, vis, known, new, fogcells in rounds:
    FIGS.append(fig(f"a3-r{rnd_}", 3, vis, giv3, known, new, fog=fogcells, margin=1,
                    caption=f"Round {rnd_ + 1}: what is visible, and what it gives."))

# ---------------- Act IV
st4a = State(g, act4.C1, {}, log=False); st4a.propagate(use_subsets=True)
k1 = solved(st4a.cand)
FIGS.append(fig("a4-map", 4, act4.C1, {}, {}, [], caption="Act IV, growth 1: the survey map. No digits are given."))
FIGS.append(fig("a4-g1", 4, act4.C1, {}, k1, list(k1), caption="After growth 1: 47 cells from the land alone."))
st4b = State(g, act4.C1 + act4.C2, {}, cand=list(st4a.cand), log=False)
st4b.placed = set(k1); st4b.propagate(use_subsets=True)
k2 = solved(st4b.cand)
FIGS.append(fig("a4-g2", 4, act4.C1 + act4.C2, {}, k2, [c for c in k2 if c not in k1], caption="After growth 2: the evening shadows finish the map."))
# candidate snapshot early in Act IV for the 1s and 2s
json.dump(FIGS, open("wt_figs.json", "w"))
print("figures:", len(FIGS), [f["id"] for f in FIGS])
