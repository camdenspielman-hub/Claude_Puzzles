from nf import *
from spec import *
import pickle, json
g = Geo(9)
SEED = 32
sol, st1, st2 = pickle.load(open(f"a4b_{SEED}.pkl", "rb"))

def to_con(d):
    t = d["type"]
    cells = [r * 9 + c for r, c in d.get("cells", [])]
    if t == "river": return terrain_river(g, cells)
    if t == "lake": return terrain_lake(g, cells)
    if t in ("peak", "hollow"): return terrain_peak(g, cells[0], t == "peak")
    if t == "contour":
        U = [r * 9 + c for r, c in d["up"]]; D = [r * 9 + c for r, c in d["down"]]
        aa = AllAbove(U, D, "contour", d["h"])
        return Group("contour", [aa], {"up": d["up"], "down": d["down"], "h": d["h"]}, U + D)
    if t in ("sun", "shade"): return Shadow(cells[0], t == "sun", g)
    raise ValueError(t)

C1 = [to_con(d) for _, d in st1]
C2 = [to_con(d) for _, d in st2]
if __name__ == "__main__":
    print(show(sol, is_cand=False))
    for kw in (dict(use_subsets=False), dict(use_subsets=True)):
        for name, cons in (("stage1", C1), ("all", C1 + C2)):
            st, err = logic_solve(g, cons, {}, **kw)
            print(kw, name, sum(1 for c in range(81) if pc(st.cand[c]) == 1), err)
    print("CP unique:", len(solve_cp(g, C1 + C2, {})))
    print("CP stage1 solutions (>=2 expected):", len(solve_cp(g, C1, {})))

def export_json():
    from export import stage_seeds
    # seeds for stage 1 = first cells the logic places
    st, err = logic_solve(g, C1, {}, use_subsets=True)
    order = []
    for ev in st.log:
        if ev[0] == "place" and ev[1] not in order: order.append(ev[1])
    seeds = [[c // 9, c % 9] for c in order[:8]]
    kinds = []
    for _, d in st1:
        k = d["type"]
        if k not in kinds: kinds.append(k)
    order_r = ["contour", "river", "peak", "hollow", "lake"]
    rules1 = ["elevation"] + [k for k in order_r if k in kinds]
    data = {"key": "survey", "n": "IV", "title": "Survey", "line": "Every digit is a height.",
            "solution": "".join(map(str, sol)), "terrain": True, "baseRules": ["classic9", "seeds"],
            "givens": [],
            "stages": [
                {"add": [d for _, d in st1], "rules": rules1, "seeds": seeds,
                 "hint": "No digits this time, only land. Read the map: rivers, lakes, contours, summits."},
                {"add": [d for _, d in st2], "rules": ["sun"], "event": "evening",
                 "hint": "Evening. The sun drops into the west and the hills throw long shadows."},
            ]}
    json.dump(data, open("act4.json", "w"))
    print("wrote act4.json", rules1, len(seeds))

if __name__ == "__main__":
    export_json()
