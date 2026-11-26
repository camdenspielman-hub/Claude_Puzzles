"""Build app/src/data.js from the verified designs."""
from nf import *
from spec import *
import act1, act2, pickle, json, os, glob

g = Geo(9)

def solve_order(st):
    order = []
    for ev in st.log:
        if ev[0] == "place" and ev[1] not in order:
            order.append(ev[1])
    return order

def stage_seeds(geo, stages, base_givens, sol, cap=8):
    out, cons, giv = evaluate(geo, stages, base_givens, sol=sol, kw=dict(use_subsets=True), verbose=False)
    seeds = []
    prev = set(giv)
    for name, n, st, err in out:
        assert err is None, (name, err)
        order = solve_order(st)
        new = [c for c in order if c not in prev]
        seeds.append(new)
        prev |= {c for c in range(81) if pc(st.cand[c]) == 1}
    return seeds, out, cons, giv

def rc2(c): return [c // 9, c % 9]

def act1_data():
    sol = act1.sol
    S4 = act1.S4
    G4 = act1.G4
    prelude = {"size": 4, "solution": S4,
               "givens": [[k // 4, k % 4, int(S4[k])] for k in G4],
               "map": [[2 * (k // 4) + 1, 2 * (k % 4) + 1] for k in range(16)]}
    seeds, out, cons, giv = stage_seeds(g, act1.STAGES, act1.fixed, sol)
    stages = []
    rules = [["classic9", "seeds"], ["killer"], ["thermo", "arrow"], ["xv", "kropki"]]
    hints = [
        "Sprouts mark the cells you can already work out. Fill every one and see what grows.",
        "Cages have grown. Their totals reach into the large digits.",
        "A thermometer and an arrow. Read the bulb first.",
        "The last marks are on the edges. Finish the page.",
    ]
    for i, (name, text) in enumerate(act1.STAGES):
        c2, g2 = parse(text, g)
        st = {"add": [k.js() for k in c2], "rules": rules[i], "hint": hints[i]}
        if g2: st["givens"] = [[c // 9, c % 9, v] for c, v in sorted(g2.items())]
        if i < len(act1.STAGES) - 1:
            st["seeds"] = [rc2(c) for c in (seeds[i] if i == 0 else seeds[i][:8])]
        stages.append(st)
    return {"key": "paper", "n": "I", "title": "Paper", "line": "Every puzzle starts small.",
            "solution": "".join(map(str, sol)), "prelude": prelude,
            "givens": [[c // 9, c % 9, v] for c, v in sorted(act1.fixed.items())],
            "stages": stages}

def act2_data():
    sol = act2.sol
    seeds, out, cons, giv = stage_seeds(g, act2.STAGES, act2.GIVENS, sol)
    rules = [["whisper", "renban"], ["regionsum", "palindrome"], ["between", "entropic", "modular"], ["dutch", "zipper"]]
    hints = [
        "Some digits survived the fall. Vines are climbing over the grid.",
        "New growth: blue and grey.",
        "Three more kinds of vine.",
        "The last tendrils. Finish the grid.",
    ]
    stages = []
    for i, (name, text) in enumerate(act2.STAGES):
        c2, g2 = parse(text, g)
        st = {"add": [k.js() for k in c2], "rules": rules[i], "hint": hints[i]}
        if i < len(act2.STAGES) - 1:
            st["seeds"] = [rc2(c) for c in seeds[i][:8]]
        stages.append(st)
    return {"key": "vines", "n": "II", "title": "Vines", "line": "What you solve takes root.",
            "solution": "".join(map(str, sol)), "baseRules": ["classic9", "seeds"],
            "givens": [[c // 9, c % 9, v] for c, v in sorted(act2.GIVENS.items())],
            "stages": stages}

def act3_data():
    sol, givens, clues = pickle.load(open("a3_final.pkl", "rb"))
    kinds = []
    for k in clues:
        t = k.js()["type"]
        key = {"sandwich": "sandwich", "xsum": "xsum", "skyscraper": "skyscraper", "littlekiller": "littlekiller", "quad": "quad", "even": "parity1", "odd": "parity1"}[t]
        if key not in kinds: kinds.append(key)
    order = ["sandwich", "xsum", "skyscraper", "littlekiller", "quad", "parity1"]
    kinds = [k for k in order if k in kinds]
    return {"key": "fog", "n": "III", "title": "Fog", "line": "You can only see what you have earned.",
            "solution": "".join(map(str, sol)), "fog": True, "margin": 1,
            "baseRules": ["classic9", "fog"] + kinds,
            "givens": [[c // 9, c % 9, v] for c, v in sorted(givens.items())],
            "constraints": [k.js() for k in clues],
            "stages": [{"hint": "Two embers survived the night. Place correct digits to push the fog back."}],
            "hint": "Two embers survived the night. Place correct digits to push the fog back."}

def act4_data():
    files = sorted(glob.glob("act4_final.pkl"))
    if not files:
        return None
    sol, st1, st2 = pickle.load(open(files[0], "rb"))
    return None

def main():
    data = {"acts": [act1_data(), act2_data(), act3_data()]}
    a4 = None
    if os.path.exists("act4.json"):
        a4 = json.load(open("act4.json"))
        data["acts"].append(a4)
    if os.path.exists("act5.json"):
        data["acts"].append(json.load(open("act5.json")))
    rules = set()
    for a in data["acts"]:
        for k in a.get("baseRules", []): rules.add(k)
        for s in a.get("stages", []):
            for k in s.get("rules", []): rules.add(k)
    data["ruleCount"] = len(rules - {"seeds", "classic9", "classic4", "elevation", "fog"}) + 3
    js = "/* generated by tools/export.py */\nwindow.NF = window.NF || {};\nNF.DATA = " + json.dumps(data, separators=(",", ":")) + ";\n"
    open("../app/src/data.js", "w").write(js)
    print("acts:", len(data["acts"]), "bytes:", len(js), "rules:", data["ruleCount"])

if __name__ == "__main__":
    main()
