# Possible-values explorer: for a constraint subset (+ extra facts), compute candidate sets for every cell & every rank.
import sys, time, json
from ortools.sat.python import cp_model
import model as M

def possibles(skip=(), extra=None, t_each=60, cells=True, ranks=True):
    m, g, rank, RD, ext = M.build(extra=extra, skip=skip)
    s = cp_model.CpSolver(); s.parameters.num_workers = 4; s.parameters.max_time_in_seconds = t_each
    seen_g = {k: set() for k in g}; seen_r = {i: set() for i in range(36)}
    unknown = []
    def record():
        for k, v in g.items(): seen_g[k].add(s.Value(v))
        for i, v in enumerate(rank): seen_r[i].add(s.Value(v))
    st = s.Solve(m)
    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE): return None
    record()
    targets = []
    if cells: targets += [("g", k, v) for k in g for v in range(1,10)]
    if ranks: targets += [("r", i, v) for i in range(36) for v in range(1,37)]
    for kind, key, val in targets:
        if kind == "g" and val in seen_g[key]: continue
        if kind == "r" and val in seen_r[key]: continue
        var = g[key] if kind == "g" else rank[key]
        # quick domain prune: skip values obviously outside group etc.? just test
        b = m.NewBoolVar("")
        m.Add(var == val).OnlyEnforceIf(b)
        m.ClearAssumptions(); m.AddAssumption(b)
        st = s.Solve(m)
        if st in (cp_model.OPTIMAL, cp_model.FEASIBLE): record()
        elif st == cp_model.UNKNOWN: unknown.append((kind, key, val))
        m.ClearAssumptions()
    return seen_g, seen_r, unknown

def fmt(seen_g, seen_r):
    out = []
    for r in range(1,10):
        out.append(" ".join(("".join(map(str,sorted(seen_g[r,c])))).ljust(9) for c in range(1,10)))
    out.append("")
    for i,(lab,_) in enumerate(M.readings()):
        vals = sorted(seen_r[i])
        out.append(f"{lab}: {vals if len(vals)<=12 else str(len(vals))+' vals '+str(vals[:3])+'..'+str(vals[-3:])}")
    return "\n".join(out)

if __name__ == "__main__":
    skip = tuple(sys.argv[1].split(",")) if len(sys.argv) > 1 and sys.argv[1] else ()
    t0 = time.time()
    res = possibles(skip=skip)
    sg, sr, unk = res
    print(fmt(sg, sr)); print("unknown:", unk[:20], len(unk)); print("time", time.time()-t0)
