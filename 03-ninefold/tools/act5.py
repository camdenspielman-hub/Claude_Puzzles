import json, math, subprocess
from paths import Panel
def P(js):
    return json.loads(js)
first = {"R": 3, "C": 3, "start": [0, 3], "end": [3, 0]}
# First light: rebuild from the generator output (dots 14, 2; gaps (13,14),(10,6),(6,7)) in node ids, W=4
def nxy(n, C=3): return [n % (C + 1), n // (C + 1)]
first["dots"] = [nxy(14), nxy(2)]
first["gaps"] = [[nxy(13), nxy(14)], [nxy(10), nxy(6)], [nxy(6), nxy(7)]]
tally = P('{"R": 3, "C": 3, "start": [0, 3], "end": [3, 0], "solution": [[0, 3], [1, 3], [1, 2], [2, 2], [3, 2], [3, 1], [2, 1], [1, 1], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0]], "digits": [[0, 0, 1], [0, 1, 4], [0, 2, 5], [1, 0, 4], [1, 1, 2], [1, 2, 3], [2, 0, 1], [2, 1, 2], [2, 2, 8]], "target": 10}')
stones = P('{"R": 4, "C": 4, "start": [0, 4], "end": [4, 0], "solution": [[0, 4], [1, 4], [2, 4], [3, 4], [3, 3], [3, 2], [4, 2], [4, 1], [3, 1], [2, 1], [1, 1], [1, 2], [2, 2], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], "colors": [[2, 2, 1], [2, 1, 0], [1, 1, 1], [3, 1, 1], [3, 3, 0], [3, 0, 1], [1, 3, 1], [2, 3, 0]]}')
petals = P('{"R": 4, "C": 4, "start": [0, 4], "end": [4, 0], "solution": [[0, 4], [0, 3], [0, 2], [1, 2], [2, 2], [2, 3], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [3, 3], [3, 2], [3, 1], [3, 0], [4, 0]], "counts": [[1, 0, 1], [1, 2, 1], [0, 2, 1], [2, 1, 3], [3, 1, 3], [3, 3, 3]]}')
tally2 = P('{"R": 4, "C": 4, "start": [0, 4], "end": [4, 0], "solution": [[0, 4], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [4, 2], [3, 2], [2, 2], [1, 2], [0, 2], [0, 1], [0, 0], [1, 0], [1, 1], [2, 1], [3, 1], [3, 0], [4, 0]], "digits": [[0, 0, 4], [0, 1, 9], [0, 2, 3], [0, 3, 1], [1, 0, 2], [1, 1, 3], [1, 2, 1], [1, 3, 1], [2, 0, 1], [2, 1, 1], [2, 2, 1], [2, 3, 9], [3, 0, 5], [3, 1, 4], [3, 2, 2], [3, 3, 1]], "target": 12}')
shade = P('{"R": 4, "C": 4, "start": [4, 4], "end": [0, 0], "solution": [[4, 4], [4, 3], [3, 3], [3, 2], [3, 1], [2, 1], [2, 0], [1, 0], [1, 1], [1, 2], [2, 2], [2, 3], [1, 3], [1, 4], [0, 4], [0, 3], [0, 2], [0, 1], [0, 0]], "colors": [[3, 3, 1], [2, 1, 0], [3, 0, 0], [3, 1, 1], [1, 1, 1], [2, 2, 1], [2, 3, 0], [0, 2, 0], [1, 3, 0], [0, 1, 1]]}')
shade["stoneStyle"] = "light"
final = P('{"R": 5, "C": 5, "start": [0, 5], "end": [5, 0], "solution": [[0, 5], [1, 5], [2, 5], [2, 4], [1, 4], [0, 4], [0, 3], [1, 3], [2, 3], [2, 2], [1, 2], [1, 1], [2, 1], [2, 0], [3, 0], [4, 0], [4, 1], [3, 1], [3, 2], [4, 2], [4, 3], [3, 3], [3, 4], [3, 5], [4, 5], [5, 5], [5, 4], [5, 3], [5, 2], [5, 1], [5, 0]], "digits": [[0, 1, 4], [0, 4, 1], [1, 0, 3], [2, 0, 7], [2, 1, 1], [3, 1, 6], [3, 2, 1], [3, 3, 4], [3, 4, 7], [4, 0, 6], [4, 1, 9], [4, 2, 8], [4, 3, 3]], "target": 15, "counts": [[1, 3, 3], [1, 1, 3], [0, 3, 3]], "dots": [[5, 5]]}')
# verify each panel is unique with the python checker
def to_panel(d):
    R, C = d["R"], d["C"]; W = C + 1
    nid = lambda x, y: y * W + x
    kw = {}
    if "digits" in d: kw["sums"] = {r * C + c: v for r, c, v in d["digits"]}; kw["target"] = d["target"]
    if "dots" in d: kw["dots"] = [nid(*p) for p in d["dots"]]
    if "gaps" in d: kw["gaps"] = [(nid(*a), nid(*b)) for a, b in d["gaps"]]
    if "colors" in d: kw["colors"] = {r * C + c: k for r, c, k in d["colors"]}
    if "counts" in d: kw["counts"] = {r * C + c: k for r, c, k in d["counts"]}
    return Panel(R, C, nid(*d["start"]), nid(*d["end"]), **kw), nid
panels = [
  ("first", "First light", first, "Draw from the circle to the notch. The line cannot cross a gap, and it must pass every diamond.", {"x": 0.0, "z": 11.5, "rot": 0.0}),
  ("tally", "Tally", tally, "The line cuts the panel into regions. The digits in every region add up to the number in the corner.", {"x": -11.4, "z": -5.5, "rot": -math.pi / 2}),
  ("stones", "Stones", stones, "Black stones and white stones may never share a region.", {"x": 5.5, "z": -11.4, "rot": math.pi}),
  ("petals", "Petals", petals, "A flower counts its cell’s sides that the line runs along: one petal per side.", {"x": -5.5, "z": 11.5, "rot": 0.0}),
  ("tally2", "Tally, again", tally2, "Same arithmetic, larger field. Every region still sums to the corner number.", {"x": 11.4, "z": 5.5, "rot": math.pi / 2}),
  ("shade", "Evening", shade, "Sunlit cells and shaded cells may never share a region.", {"x": 5.5, "z": 11.5, "rot": 0.0}),
  ("ninefold", "Ninefold", final, "Everything at once: sums, petals, and the diamond. This one stands at the heart of the island.", {"x": 0.0, "z": 0.0, "rot": 0.0, "y": 0.6}),
]
out = []
for pid, title, d, legend, place in panels:
    p, nid = to_panel(d)
    sols = p.solve(limit=2)
    assert len(sols) == 1, (pid, len(sols))
    C = d["C"]
    sol = [[n % (C + 1), n // (C + 1)] for n in sols[0]]
    if "solution" in d: assert sol == d["solution"], pid
    d = dict(d); d["solution"] = sol
    d.update({"id": pid, "title": title, "legend": legend, "place": place})
    out.append(d)
    print(pid, "unique ok", len(sol))
data = {"key": "island", "n": "V", "title": "Island", "line": "Now draw the rules yourself.", "island": True, "panels": out}
json.dump(data, open("act5.json", "w"))
print("wrote act5.json")
